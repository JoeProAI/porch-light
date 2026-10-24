"""Scout Intent engine: a fresh, bounded implementation of the Meterless Scout Intent spec.

Pipeline: Sense -> Interpret -> Guard -> Route -> Recommend -> ExecutionContract.
Porch Light uses it to decide whether an operator action may reach the Meterless Runtime at all.
The grounded-draft executor refuses to call a model without a verified, unexpired, in-scope contract.

Scope that is honest to state: Stage 1 (deterministic lexical) only; the optional Stage 2 local
embedding model is not installed, so the semantic component is skipped and reported as such.
The HMAC key is a local per-machine integrity secret, not a shared trust root.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

REGISTRY_VERSION = 1
POLICY_PACK_VERSION = "porch-light-1"
CONTRACT_TTL_SECONDS = 300
SIGNED_BY = "scout"
WEIGHTS = {"lexical": 0.40, "semantic": 0.35, "contextual": 0.20, "recency": 0.05}
RISK_PENALTY = {"low": 0.0, "medium": 0.03, "high": 0.10}
BANDS = (("high", 0.80), ("medium", 0.55), ("low", 0.40))
HOME = Path.home() / ".porchlight" / "scout-intent"

# Every intent an operator can express in Porch Light. Unregistered intents can never be acted on.
INTENT_REGISTRY: list[dict] = [
    {
        "id": "outreach.call_script", "category": "outreach", "version": 1, "riskClass": "medium",
        "description": "Request one source-grounded Nemotron call script for a verified ranked facility.",
        "parameters": {"ccn": {"type": "string", "pattern": r"^[0-9A-Z]{6}$", "required": True},
                       "run_id": {"type": "string", "pattern": r"^[a-f0-9]{32}$", "required": False}},
        "capabilities": ["model.draft", "source.read"],
        "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["generate live nemotron call script", "generate call script for facility",
                     "draft an outreach script for this facility", "write the call script",
                     "what should I say when I call this facility"],
    },
    {
        "id": "callsheet.export_csv", "category": "callsheet", "version": 1, "riskClass": "low",
        "description": "Export the ranked call sheet and local contact records as CSV.",
        "parameters": {}, "capabilities": ["callsheet.read"],
        "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["export csv", "download the call sheet", "export ranked rows"],
    },
    {
        "id": "callsheet.print", "category": "callsheet", "version": 1, "riskClass": "low",
        "description": "Print the current call sheet.",
        "parameters": {}, "capabilities": ["callsheet.read"],
        "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["print sheet", "print the call sheet"],
    },
    {
        "id": "contact.record_outcome", "category": "contact", "version": 1, "riskClass": "low",
        "description": "Record a manual contact outcome on this device only.",
        "parameters": {"ccn": {"type": "string", "pattern": r"^[0-9A-Z]{6}$", "required": True}},
        "capabilities": ["contact.write_local"],
        "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["record contact outcome", "mark facility reached", "mark no answer"],
    },
    {
        "id": "facility.condition_claim", "category": "facility", "version": 1, "riskClass": "high",
        "description": "Assert a facility's current power, water or access condition. Never inferred by a model.",
        "parameters": {"ccn": {"type": "string", "pattern": r"^[0-9A-Z]{6}$", "required": True}},
        "capabilities": [],
        "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["did the facility lose power", "is the facility flooded", "tell me if this facility has water",
                     "which facilities are without power"],
    },
    {
        "id": "GENERAL", "category": "general", "version": 1, "riskClass": "low",
        "description": "Safe fallback when no registered intent is recognised. Nothing executes.",
        "parameters": {}, "capabilities": [], "surfaces": ["operate", "nationwide"], "roles": ["operator"],
        "examples": ["help", "what can I do here"],
    },
]

POLICY_PACK = {
    "denied_intents": {"facility.condition_claim": "Porch Light never infers or asserts current facility conditions."},
    "rate_limits": {"outreach.call_script": {"window_seconds": 600, "max_requests": 20}},
    "default_rate_limit": {"window_seconds": 60, "max_requests": 120},
}

ROUTES = {
    "outreach.call_script": {
        "modelProfile": "meterless-deep",
        "toolPlan": [{"tool": "meterless.chat_completions", "input": {"model": "meterless/deep", "thinking": False}}],
        # The route is available only when the authenticated local Meterless Runtime token exists.
        "availability": lambda: _meterless_token_present(),
    },
    "callsheet.export_csv": {"modelProfile": "none", "toolPlan": [{"tool": "callsheet.csv", "input": {}}], "availability": lambda: True},
    "callsheet.print": {"modelProfile": "none", "toolPlan": [{"tool": "callsheet.print", "input": {}}], "availability": lambda: True},
    "contact.record_outcome": {"modelProfile": "none", "toolPlan": [{"tool": "contact.local_store", "input": {}}], "availability": lambda: True},
    "GENERAL": {"modelProfile": "none", "toolPlan": [], "availability": lambda: True},
}

INJECTION_PATTERNS = [
    r"ignore (all |any )?(previous|prior|above) instructions", r"system prompt", r"you are now",
    r"developer mode", r"<\|", r"\bbegin system\b", r"\bcall (the )?tool\b", r"\btool_call\b",
    r"\bjailbreak\b", r"disregard (the )?(rules|policy)",
]
SENSITIVITY_PATTERNS = [
    r"\bpatient (name|list|record|chart|diagnosis|dob)s?\b", r"\bmedical record\b", r"\bsocial security\b",
    r"\bssn\b", r"\bdate of birth\b", r"\bdiagnos[ie]s\b",
]
STOPWORDS = {"a", "an", "the", "for", "this", "that", "to", "of", "me", "my", "is", "it", "please", "and", "with"}


class ScoutRefusal(RuntimeError):
    """Raised by executors when a contract is missing, unsigned, tampered, expired or out of scope."""

    def __init__(self, reason: str, detail: str):
        super().__init__(f"Scout Intent refused execution: {detail}")
        self.reason = reason
        self.detail = detail


def _meterless_token_present() -> bool:
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return False
    path = Path(local) / "ai.meterless.runtime/proxy-token"
    try:
        return path.is_file() and bool(path.read_text().strip())
    except OSError:
        return False


def canonical_json(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(moment: datetime) -> str:
    return moment.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ulid(moment: datetime | None = None) -> str:
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    millis = int((moment or _now()).timestamp() * 1000)
    value = (millis << 80) | secrets.randbits(80)
    return "".join(alphabet[(value >> (5 * index)) & 31] for index in range(25, -1, -1))


def tokens(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", text.lower()) if word not in STOPWORDS]


def band_for(score: float) -> str:
    for name, floor in BANDS:
        if score >= floor:
            return name
    return "reject"


class Scout:
    def __init__(self, intent_registry: list[dict] | None = None, policy_pack: dict | None = None,
                 home: Path | None = None, signing_key: bytes | None = None):
        self.registry = intent_registry or INTENT_REGISTRY
        self.policy = policy_pack or POLICY_PACK
        self.home = home or HOME
        self.by_id = {intent["id"]: intent for intent in self.registry}
        for intent in self.registry:
            if not intent.get("examples"):
                raise ValueError(f"Intent {intent['id']} has no examples; the registry is invalid")
        self._key = signing_key
        self.self_test()

    # ---- key and telemetry -------------------------------------------------------------------------
    def key(self) -> bytes:
        if self._key is None:
            self.home.mkdir(parents=True, exist_ok=True)
            path = self.home / "signing.key"
            if not path.exists():
                descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                    stream.write(secrets.token_hex(32))
            self._key = bytes.fromhex(path.read_text(encoding="utf-8").strip())
        return self._key

    def emit(self, event: str, **fields) -> None:
        self.home.mkdir(parents=True, exist_ok=True)
        record = {"event": event, "at": _iso(_now()), **fields}
        with (self.home / "events.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=True, sort_keys=True) + "\n")

    def self_test(self) -> float:
        """Spec requirement: Stage 1 scans the full registry in under 16 ms."""
        started = time.perf_counter()
        self.classify({"prompt": "generate live nemotron call script", "surface": "operate"})
        elapsed = (time.perf_counter() - started) * 1000
        if elapsed >= 16:
            raise RuntimeError(f"Scout Stage 1 self-test took {elapsed:.1f} ms; the registry is too slow")
        return elapsed

    # ---- Sense --------------------------------------------------------------------------------------
    def classify(self, request: dict, top_k: int = 3) -> list[dict]:
        prompt_tokens = tokens(request["prompt"])
        surface = request["surface"]
        context = request.get("context") or {}
        candidates = []
        for intent in self.registry:
            lexical = 0.0
            for example in intent["examples"]:
                example_tokens = tokens(example)
                common = len(set(prompt_tokens) & set(example_tokens))
                if prompt_tokens and example_tokens:
                    lexical = max(lexical, 2 * common / (len(set(prompt_tokens)) + len(set(example_tokens))))
            bound, missing = self.bind(intent, context)
            contextual = 0.0 if surface not in intent["surfaces"] else (0.5 if missing else 1.0)
            recency = 1.0 if context.get("recent_intent") == intent["id"] else 0.0
            # Stage 2 (local embedding) is unavailable here, so the remaining weights are renormalised.
            available = WEIGHTS["lexical"] + WEIGHTS["contextual"] + WEIGHTS["recency"]
            raw = (WEIGHTS["lexical"] * lexical + WEIGHTS["contextual"] * contextual + WEIGHTS["recency"] * recency) / available
            score = round(max(0.0, raw - RISK_PENALTY[intent["riskClass"]]), 4)
            candidates.append({"id": intent["id"], "score": score, "riskClass": intent["riskClass"],
                               "components": {"lexical": round(lexical, 4), "semantic": None,
                                              "contextual": contextual, "recency": recency},
                               "parameters": bound, "missing_parameters": missing})
        candidates.sort(key=lambda item: (-item["score"], item["id"]))
        return candidates[:top_k]

    # ---- Interpret ----------------------------------------------------------------------------------
    @staticmethod
    def bind(intent: dict, context: dict) -> tuple[dict, list[str]]:
        bound, missing = {}, []
        for name, schema in intent["parameters"].items():
            value = context.get(name)
            if isinstance(value, str) and re.fullmatch(schema["pattern"], value):
                bound[name] = value
            elif schema.get("required"):
                missing.append(name)
        return bound, missing

    # ---- Guard --------------------------------------------------------------------------------------
    def guard(self, intent: dict, request: dict, parameters: dict) -> dict:
        prompt = request["prompt"]
        context = request.get("context") or {}
        user = request.get("user") or "anonymous"
        surface = request["surface"]
        role = request.get("role") or "operator"
        layers = []

        untrusted = " ".join(str(value) for value in context.values() if isinstance(value, str))
        injection_hits = [pattern for pattern in INJECTION_PATTERNS if re.search(pattern, prompt, re.IGNORECASE)]
        source_hits = [pattern for pattern in INJECTION_PATTERNS if re.search(pattern, untrusted, re.IGNORECASE)]
        if injection_hits:
            layers.append({"layer": "injection", "result": "block", "kind": "known-pattern", "evidence": injection_hits})
        elif source_hits:
            layers.append({"layer": "injection", "result": "warn", "kind": "untrusted-source-text", "evidence": source_hits})
        else:
            layers.append({"layer": "injection", "result": "pass"})

        denied = self.policy["denied_intents"].get(intent["id"])
        if denied:
            layers.append({"layer": "policy", "result": "block", "reason": denied})
        elif intent["riskClass"] == "high":
            layers.append({"layer": "policy", "result": "block", "reason": "High-risk intents require an approval record; none exists."})
        else:
            layers.append({"layer": "policy", "result": "pass"})

        if surface not in intent["surfaces"] or role not in intent["roles"]:
            layers.append({"layer": "scope", "result": "block", "reason": f"{intent['id']} is not permitted for {role} on {surface}"})
        else:
            layers.append({"layer": "scope", "result": "pass"})

        sensitive = [pattern for pattern in SENSITIVITY_PATTERNS if re.search(pattern, prompt + " " + untrusted, re.IGNORECASE)]
        layers.append({"layer": "sensitivity", "result": "block", "reason": "Patient or personal health information is never requested.",
                       "evidence": sensitive} if sensitive else {"layer": "sensitivity", "result": "pass"})

        layers.append(self.rate_limit(user, intent["id"], surface))

        results = [layer["result"] for layer in layers]
        if "block" in results:
            level = "block"
        elif results.count("warn") >= 2 or intent["riskClass"] == "high":
            level = "high"
        elif "warn" in results or intent["riskClass"] == "medium":
            level = "medium"
        else:
            level = "low"
        flags = [f"{layer['layer']}:{layer['result']}" for layer in layers if layer["result"] != "pass"]
        reasons = [layer["reason"] for layer in layers if layer["result"] == "block" and layer.get("reason")]
        return {"level": level, "flags": flags, "redactions": [], "approvals": [], "layers": layers,
                **({"reason": "; ".join(reasons)} if reasons else {})}

    def rate_limit(self, user: str, intent_id: str, surface: str) -> dict:
        limit = self.policy["rate_limits"].get(intent_id, self.policy["default_rate_limit"])
        folder = self.home / "rate"
        folder.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(f"{user}|{intent_id}|{surface}".encode()).hexdigest()[:24]
        path = folder / f"{digest}.json"
        now = time.time()
        try:
            history = [stamp for stamp in json.loads(path.read_text(encoding="utf-8")) if now - stamp < limit["window_seconds"]]
        except (OSError, ValueError):
            history = []
        if len(history) >= limit["max_requests"]:
            return {"layer": "rate_limit", "result": "block",
                    "reason": f"{intent_id} exceeded {limit['max_requests']} requests per {limit['window_seconds']} s"}
        history.append(now)
        path.write_text(json.dumps(history), encoding="utf-8")
        return {"layer": "rate_limit", "result": "pass", "remaining": limit["max_requests"] - len(history)}

    # ---- Route --------------------------------------------------------------------------------------
    def route(self, intent: dict) -> dict:
        plan = ROUTES[intent["id"]]
        if not plan["availability"]():
            # Out-of-scope substitution is never silent: an unavailable route is a refusal, not a fallback.
            raise ScoutRefusal("route-unavailable", f"No available route for {intent['id']}; the Meterless Runtime token is missing")
        return {"modelProfile": plan["modelProfile"], "toolPlan": plan["toolPlan"]}

    # ---- Decide -------------------------------------------------------------------------------------
    def decide(self, request: dict) -> dict:
        started = time.perf_counter()
        trace_id = (request.get("context") or {}).get("trace_id") or f"trace-{uuid4().hex}"
        ranked = self.classify(request)
        top = ranked[0]
        band = band_for(top["score"])
        decision = {"traceId": trace_id, "stage2": "skipped", "candidates": ranked, "action": "refuse",
                    "intent": {"primary": top["id"], "confidence": top["score"], "band": band,
                               "parameters": top["parameters"], "alternates": [item["id"] for item in ranked[1:]]}}
        clarification = None
        if band == "reject":
            top = {**top, "id": "GENERAL", "score": top["score"]}
            decision["intent"]["primary"] = "GENERAL"
            decision["action"] = "clarify"
            clarification = {"trigger": "reject-band", "question": "That request isn't a registered Porch Light action. Which did you mean?",
                             "options": [item["id"] for item in ranked if item["id"] != "GENERAL"][:4]}
        elif band == "low":
            clarification = {"trigger": "low-band", "question": "Did you mean one of these actions?",
                             "options": [item["id"] for item in ranked][:3]}
        elif band == "medium" and len(ranked) > 1 and ranked[0]["score"] - ranked[1]["score"] < 0.05:
            clarification = {"trigger": "tie", "question": "Two actions match equally well. Which did you mean?",
                             "options": [item["id"] for item in ranked][:2]}
        elif top["missing_parameters"]:
            clarification = {"trigger": "params", "question": f"Which facility? Missing: {', '.join(top['missing_parameters'])}",
                             "options": []}
        elif top["riskClass"] == "high" and top["score"] < 0.95:
            clarification = {"trigger": "high-risk", "question": "This is a high-risk assertion and cannot be guessed.", "options": []}
        intent = self.by_id[top["id"]]
        if clarification:
            decision["action"] = "clarify"
            decision["clarification"] = clarification
            self.emit("scout.clarification", traceId=trace_id, trigger=clarification["trigger"])
        risk = self.guard(intent, request, top["parameters"])
        decision["risk"] = risk
        if risk["level"] == "block":
            decision["action"] = "refuse"
            decision["reason"] = risk.get("reason", "Guard blocked the request")
        if not clarification and risk["level"] != "block":
            try:
                routed = self.route(intent)
            except ScoutRefusal as refusal:
                decision["action"] = "refuse"
                decision["reason"] = refusal.detail
            else:
                decision["action"] = "proceed"
                decision["contract"] = self.issue(intent, top, risk, routed, request, trace_id, parent_id=None)
        decision["latencyMs"] = round((time.perf_counter() - started) * 1000, 2)
        self.emit("scout.decision", traceId=trace_id, intent=decision["intent"]["primary"], band=band,
                  action=decision["action"], latencyMs=decision["latencyMs"], stage2="skipped")
        return decision

    def issue(self, intent: dict, candidate: dict, risk: dict, routed: dict, request: dict,
              trace_id: str, parent_id: str | None) -> dict:
        issued = _now()
        contract = {
            "contractId": ulid(issued), "parentId": parent_id, "traceId": trace_id,
            "intent": {"primary": intent["id"], "parameters": candidate["parameters"], "references": {},
                       "confidence": candidate["score"], "alternates": []},
            "risk": {"level": risk["level"], "flags": risk["flags"], "redactions": [], "approvals": []},
            "toolPlan": routed["toolPlan"], "modelProfile": routed["modelProfile"],
            "scope": {"user": request.get("user") or "anonymous", "surface": request["surface"],
                      "capabilities": list(intent["capabilities"])},
            "issuedAt": _iso(issued), "expiresAt": _iso(issued + timedelta(seconds=CONTRACT_TTL_SECONDS)),
            "registryVersion": REGISTRY_VERSION, "policyPackVersion": POLICY_PACK_VERSION,
            "signedBy": SIGNED_BY,
        }
        contract["signature"] = self.sign(contract)
        self.emit("contract.issued", contractId=contract["contractId"], intent=intent["id"],
                  risk=risk["level"], profile=routed["modelProfile"], parentId=parent_id)
        return contract

    def sign(self, contract: dict) -> str:
        unsigned = {key: value for key, value in contract.items() if key != "signature"}
        return hmac.new(self.key(), canonical_json(unsigned), hashlib.sha256).hexdigest()

    def replan(self, parent: dict, reason: str) -> dict:
        """Long work never extends a TTL; it reissues a child contract on the same trace."""
        self.verify(parent, engine="scout", allow_expired=True)
        intent = self.by_id[parent["intent"]["primary"]]
        candidate = {"parameters": parent["intent"]["parameters"], "score": parent["intent"]["confidence"]}
        routed = {"modelProfile": parent["modelProfile"], "toolPlan": parent["toolPlan"]}
        request = {"user": parent["scope"]["user"], "surface": parent["scope"]["surface"]}
        child = self.issue(intent, candidate, parent["risk"], routed, request, parent["traceId"], parent_id=parent["contractId"])
        self.emit("scout.replan", traceId=parent["traceId"], parentId=parent["contractId"], contractId=child["contractId"], reason=reason)
        return child

    # ---- Verification used by executors -------------------------------------------------------------
    def verify(self, contract: object, engine: str, allow_expired: bool = False) -> dict:
        if not isinstance(contract, dict) or not isinstance(contract.get("signature"), str):
            self.emit("contract.refused", contractId=None, engine=engine, reason="unsigned")
            raise ScoutRefusal("unsigned", "no signed execution contract was presented")
        if contract.get("signedBy") != SIGNED_BY or contract.get("registryVersion") != REGISTRY_VERSION:
            self.emit("contract.refused", contractId=contract.get("contractId"), engine=engine, reason="issuer")
            raise ScoutRefusal("issuer", "the contract was not issued by this Scout registry")
        if not hmac.compare_digest(self.sign(contract), contract["signature"]):
            self.emit("contract.refused", contractId=contract.get("contractId"), engine=engine, reason="tampered")
            raise ScoutRefusal("tampered", "the contract signature does not match its contents")
        expires = datetime.fromisoformat(contract["expiresAt"].replace("Z", "+00:00"))
        if not allow_expired and _now() >= expires:
            self.emit("contract.expired", contractId=contract["contractId"], engine=engine)
            raise ScoutRefusal("expired", "the contract expired; a replan with parentId is required")
        return contract

    def enforce(self, contract: object, engine: str, capability: str, intent_id: str, parameters: dict) -> dict:
        verified = self.verify(contract, engine)
        if verified["intent"]["primary"] != intent_id or capability not in verified["scope"]["capabilities"]:
            self.emit("contract.refused", contractId=verified["contractId"], engine=engine, reason="scope-mismatch")
            raise ScoutRefusal("scope-mismatch", f"{engine} may not use {capability} under intent {verified['intent']['primary']}")
        for name, value in parameters.items():
            if verified["intent"]["parameters"].get(name) != value:
                self.emit("contract.refused", contractId=verified["contractId"], engine=engine, reason="scope-mismatch")
                raise ScoutRefusal("scope-mismatch", f"contract parameter {name} does not cover this request")
        self.emit("contract.verified", contractId=verified["contractId"], engine=engine)
        return verified


def public_decision(decision: dict) -> dict:
    """The part of a decision that is safe and useful to return to the operator UI."""
    contract = decision.get("contract")
    return {
        "engine": "Scout Intent", "spec": "github.com/meterless/meterless engines/scout-intent", "stage2": decision["stage2"],
        "trace_id": decision["traceId"], "action": decision["action"], "intent": decision["intent"],
        "risk": {"level": decision["risk"]["level"], "flags": decision["risk"]["flags"]},
        "latency_ms": decision["latencyMs"], **({"reason": decision["reason"]} if decision.get("reason") else {}),
        **({"clarification": decision["clarification"]} if decision.get("clarification") else {}),
        **({"contract": contract} if contract else {}),
    }
