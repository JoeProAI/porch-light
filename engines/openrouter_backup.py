"""Optional OpenRouter Nemotron backup. Meterless Nightshift stays the primary path.

Enabled only when OPENROUTER_API_KEY is present and PORCHLIGHT_OPENROUTER_BACKUP is set.
Default mode from Joe's .env.local is call_script (sweep / explanation_batch stay free-NVIDIA only).
Hard spend ceiling: OPENROUTER_MAX_SPEND_USD (Joe set 5). Never log or return the API key.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"
ALLOWED_MODELS = frozenset({
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
})
# OpenRouter list prices per 1M tokens (2026-10-23 ET scrape). Used only when the
# provider omits a native cost field; receipts still store estimated_usd.
PRICES_PER_M = {
    "nvidia/nemotron-3.5-lightning-30b-a3b": (0.025, 0.12),
    "nvidia/nemotron-3.5-super-vl-120b-a12b": (0.06, 0.35),
}
LEDGER_DIR = Path.home() / ".porchlight" / "openrouter-spend"
LEDGER = LEDGER_DIR / "ledger.jsonl"


class OpenRouterDisabled(RuntimeError):
    pass


class OpenRouterCapExceeded(RuntimeError):
    pass


def _candidate_env_files() -> list[Path]:
    here = Path(__file__).resolve()
    roots = [
        here.parents[1],  # repo root when engines/ is top-level package dir
        Path.cwd(),
        Path(r"D:\Projects\AI_Projects\porch-light-web"),
        Path(r"D:\Projects\AI_Projects\porch-light-engines"),
        Path(r"D:\Projects\AI_Projects\porch-light"),
    ]
    out: list[Path] = []
    for root in roots:
        for name in (".env.local", ".env"):
            path = root / name
            if path.is_file() and path not in out:
                out.append(path)
    return out


def load_dotenv_files() -> list[str]:
    """Load KEY=VALUE from gitignored env files into os.environ (setdefault only)."""
    loaded: list[str] = []
    for path in _candidate_env_files():
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if not key:
                continue
            os.environ.setdefault(key, value)
        loaded.append(str(path))
    return loaded


def backup_mode() -> str:
    load_dotenv_files()
    return (os.environ.get("PORCHLIGHT_OPENROUTER_BACKUP") or "").strip().lower()


def max_spend_usd() -> float:
    load_dotenv_files()
    raw = (os.environ.get("OPENROUTER_MAX_SPEND_USD") or "5").strip()
    try:
        value = float(raw)
    except ValueError as error:
        raise OpenRouterDisabled("OPENROUTER_MAX_SPEND_USD is not a number") from error
    if value <= 0 or value > 100:
        raise OpenRouterDisabled("OPENROUTER_MAX_SPEND_USD must be > 0 and <= 100")
    return value


def api_key_present() -> bool:
    load_dotenv_files()
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    return bool(key) and key.startswith("sk-or-")


def _api_key() -> str:
    load_dotenv_files()
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not key or not key.startswith("sk-or-"):
        raise OpenRouterDisabled("OPENROUTER_API_KEY missing or not an OpenRouter key")
    return key


def spent_usd() -> float:
    if not LEDGER.exists():
        return 0.0
    total = 0.0
    for line in LEDGER.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        amount = row.get("actual_usd")
        if isinstance(amount, (int, float)):
            total += float(amount)
    return round(total, 6)


def remaining_usd() -> float:
    return round(max(0.0, max_spend_usd() - spent_usd()), 6)


def can_backup(purpose: str) -> tuple[bool, str]:
    mode = backup_mode()
    if mode in ("", "0", "false", "off", "no"):
        return False, "PORCHLIGHT_OPENROUTER_BACKUP is off"
    if mode in ("1", "true", "yes", "all"):
        allowed_purposes = {"call_script", "explanation_batch"}
    elif mode == "call_script":
        allowed_purposes = {"call_script"}
    else:
        return False, f"unknown PORCHLIGHT_OPENROUTER_BACKUP mode: {mode}"
    if purpose not in allowed_purposes:
        return False, f"purpose {purpose} not enabled for OpenRouter backup"
    if not api_key_present():
        return False, "OPENROUTER_API_KEY not present"
    try:
        if remaining_usd() <= 0:
            return False, "OPENROUTER_MAX_SPEND_USD exhausted"
    except OpenRouterDisabled as error:
        return False, str(error)
    return True, "ok"


def estimate_usd(model: str, usage: dict | None) -> float:
    prompt = int((usage or {}).get("prompt_tokens") or 0)
    completion = int((usage or {}).get("completion_tokens") or 0)
    rates = PRICES_PER_M.get(model) or PRICES_PER_M[DEFAULT_MODEL]
    return round((prompt * rates[0] + completion * rates[1]) / 1_000_000.0, 6)


def resolve_model(requested: str | None = None) -> str:
    load_dotenv_files()
    candidate = (requested or os.environ.get("OPENROUTER_NEMOTRON_MODEL") or DEFAULT_MODEL).strip()
    # Map Meterless logical routes to concrete Nemotron ids.
    if candidate in ("meterless/deep", "meterless/auto", "meterless/fast", ""):
        candidate = DEFAULT_MODEL
    if candidate not in ALLOWED_MODELS:
        raise OpenRouterDisabled(f"OpenRouter backup refuses non-Nemotron model {candidate!r}")
    return candidate


def _append_ledger(row: dict) -> None:
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(row, ensure_ascii=True) + "\n")


def chat_completions(messages: list, *, max_tokens: int = 4096, purpose: str,
                     run_id: str | None = None) -> dict:
    """Call OpenRouter for a Nemotron completion. Raises on cap / policy / transport errors."""
    ok, reason = can_backup(purpose)
    if not ok:
        raise OpenRouterDisabled(reason)

    model = resolve_model()
    projected_floor = estimate_usd(model, {"prompt_tokens": 500, "completion_tokens": 500})
    if remaining_usd() < projected_floor:
        raise OpenRouterCapExceeded(
            f"OpenRouter spend remaining ${remaining_usd()} is below the safety floor"
        )

    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": messages,
        # Nemotron GOTCHA: disable hidden reasoning so content is non-empty.
        "chat_template_kwargs": {"enable_thinking": False},
        "provider": {"require_parameters": True},
    }
    payload = json.dumps(body).encode("utf-8")
    request = Request(
        OPENROUTER_BASE + "/chat/completions",
        data=payload,
        headers={
            "Authorization": "Bearer " + _api_key(),
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/JoeProAI/porch-light",
            "X-Title": "Porch Light OpenRouter Nemotron backup",
        },
        method="POST",
    )
    started = time.monotonic()
    try:
        with urlopen(request, timeout=180) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
    except HTTPError as error:
        raise RuntimeError(f"OpenRouter HTTP {error.code}") from None
    except (URLError, TimeoutError):
        raise RuntimeError("OpenRouter unavailable or timed out") from None

    if len(raw) > 2 * 1024 * 1024:
        raise ValueError("OpenRouter response exceeds the bounded limit")
    result = json.loads(raw)
    reported = str(result.get("model") or model)
    if "nemotron" not in reported.lower():
        raise ValueError("OpenRouter did not identify a genuine Nemotron execution")
    usage = result.get("usage") if isinstance(result.get("usage"), dict) else {}
    # Prefer provider-native cost when present; else estimate from list prices.
    native = None
    for key in ("total_cost", "cost"):
        if isinstance(usage.get(key), (int, float)):
            native = float(usage[key])
            break
    actual = native if native is not None else estimate_usd(model if model in reported else reported if reported in ALLOWED_MODELS else model, usage)
    # Re-check cap after knowing cost (fail closed if this call would exceed).
    if spent_usd() + actual > max_spend_usd() + 1e-9:
        raise OpenRouterCapExceeded(
            f"OpenRouter call would exceed OPENROUTER_MAX_SPEND_USD={max_spend_usd()}"
        )

    receipt = {
        "provider": "openrouter",
        "backup_of": "meterless",
        "request_id": result.get("id"),
        "reported_model": reported,
        "requested_model": model,
        "usage": usage,
        "actual_usd": actual,
        "cost_source": "native" if native is not None else "list_price_estimate",
        "endpoint": OPENROUTER_BASE,
        "purpose": purpose,
        "run_id": run_id,
        "latency_ms": round((time.monotonic() - started) * 1000),
        "spent_before_usd": spent_usd(),
        "cap_usd": max_spend_usd(),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    _append_ledger(receipt)
    return {"result": result, "receipt": receipt}
