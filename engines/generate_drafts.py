"""Generate six grounded batches, or one operator-requested live call-script draft."""

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from collections import Counter

from data.provenance.sidecar import sha256_of, verify, write_sidecar
from engines.draft_jobs import enrich
from engines.grounded_drafts import audit_lock, compose_selection, request_selections, source_catalog


def read_verified_snapshot(path: Path) -> dict:
    if not verify(path):
        raise ValueError("Snapshot provenance does not verify")
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    receipt = snapshot["data_access"]
    steps = receipt.get("chain_steps", [])
    ids = receipt["zetaris_query_ids"]
    if (receipt["data_access_mode"] != "zetaris" or len(steps) != 7 or len(set(ids)) != 7 or
            any(step["query_ids"] != [step["audit"]["query_id"]] or
                not step["audit"]["finish_successfully"] or not step["audit"]["end_time"] for step in steps) or
            {step["query_ids"][0] for step in steps} != set(ids)):
        raise ValueError("Grounded drafting requires the independently audited source chain")
    rows = snapshot["facilities"]
    if len(rows) != 18 or len({row["ccn"] for row in rows}) != 18:
        raise ValueError("Expected the complete verified eighteen-facility scope")
    for index, row in enumerate(rows):
        if (row["rank"] != index + 1 or row["evidence"]["zetaris_query_ids"] != ids or
                not row["phone"].get("value") or
                abs(sum(term["weighted"] for term in row["score"]["terms"]) - row["score"]["total"]) > 1e-9):
            raise ValueError("Snapshot scope, evidence or deterministic score failed verification")
    return snapshot


def generate_all(snapshot: dict) -> dict:
    rows = snapshot["facilities"]
    by_ccn = {row["ccn"]: row for row in rows}
    log = Path.home() / ".porchlight/model-events.jsonl"
    with audit_lock():
        events = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()] if log.exists() else []
    related = []
    for event in events:
        ccns = event.get("facility_ccns", [])
        if event.get("purpose") != "explanation_batch" or event.get("run_id") is not None or not set(ccns).issubset(by_ccn):
            continue
        digest = hashlib.sha256(json.dumps([source_catalog(by_ccn[ccn]) for ccn in ccns], sort_keys=True).encode()).hexdigest()
        if digest == event.get("input_sha256"):
            related.append(event)
    resolved, blocked = {}, {}
    for event in related:
        ccns = event["facility_ccns"]
        if event.get("status") == "grounding_passed":
            content = event["provider_content"].strip()
            if content.startswith("```json\n") and content.endswith("```"):
                content = content[8:-3].strip()
            for selection in json.loads(content)["drafts"]:
                row = by_ccn[selection["ccn"]]
                resolved[row["ccn"]] = {
                    "ccn": row["ccn"], **compose_selection(row, selection), "status": "passed",
                    "trace_id": event["response_id"], "model_id": event["reported_model"],
                    "mode": event["requested_model"], "effective_mode": event["meterless_receipt"]["effective_mode"],
                    "draft": True, "cache_reuse": "Identical source-clause catalog hash",
                }
        for ccn in ccns:
            if ccn not in resolved and sum(ccn in previous["facility_ccns"] for previous in related) >= 2:
                blocked[ccn] = {
                    "status": "failed", "text": None, "grounding": {"passed": False},
                    "attempts": [previous for previous in related if ccn in previous["facility_ccns"]],
                    "reason": "The initial attempt and its sole retry failed; no third attempt or replacement is permitted.",
                }
    remaining = [row for row in rows if row["ccn"] not in resolved and row["ccn"] not in blocked]
    generated = enrich({"facilities": remaining}, None)
    for row in rows:
        if row["ccn"] in resolved or row["ccn"] in blocked:
            if row["evidence"].get("model_explanation") is not None:
                row["evidence"].setdefault("previous_model_explanations", []).append(row["evidence"]["model_explanation"])
            row["evidence"]["model_explanation"] = resolved.get(row["ccn"]) or blocked[row["ccn"]]
    snapshot.setdefault("historical_model_executions", []).extend(snapshot["model_executions"])
    snapshot["model_executions"] = related + generated["model_executions"]
    passed = sum(row["evidence"]["model_explanation"].get("status") == "passed" for row in rows)
    snapshot["model_report"] = {
        **generated["model_report"], "eligible_facilities": len(rows), "accepted_facilities": passed,
        "unresolved_facilities": len(rows) - passed, "retained_failed_facilities": len(blocked),
        "attempted_facilities": len(rows),
        "reused_accepted_facilities": len(resolved),
        "failure_reasons": dict(Counter(generated["model_report"]["failure_reasons"]) +
                               Counter(event.get("validation_error", "retained_grounding_failure")
                                       for event in related if event.get("status") != "grounding_passed")),
        "provider_requests": len(snapshot["model_executions"]),
        "grounding_pass_rate": passed / len(rows),
        "accepted_facility_rate": passed / len(rows),
        "first_pass_facilities": passed,
        "first_pass_facility_rate": passed / len(rows),
        "first_pass_requests": sum(not event.get("retry_of") for event in snapshot["model_executions"]),
        "retry_requests": sum(bool(event.get("retry_of")) for event in snapshot["model_executions"]),
        "unknown_cost_receipts": sum("meterless_receipt" not in event for event in snapshot["model_executions"]),
    }
    snapshot.pop("model_output_reuse", None)
    snapshot["model_status"] = {
        "state": "grounding_passed" if passed == len(rows) else "grounding_partial",
        "drafts": passed, "new_model_calls": len(generated["model_executions"]),
        "method": "exact_source_clause_catalog_v1", "clinical_validation": False,
        "model_role": "Select and order exact source clauses and bounded verification questions, not unrestricted prose",
        "execution_location": "not_reported",
    }
    snapshot["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return snapshot


def generate_call_script(snapshot: dict, ccn: str) -> dict:
    rows = [row for row in snapshot["facilities"] if row["ccn"] == ccn]
    if len(rows) != 1:
        raise ValueError("Facility is not in the verified ranked snapshot")
    row = rows[0]
    result = request_selections(rows, "call_script")
    draft = result["drafts"][0]
    return {
        "facility_id": row["id"], "ccn": ccn, "facility_name": row["name"],
        "source_phone": row["phone"]["value"], "generated_at": result["execution"]["ended_at"],
        "opening": (
            f"Hello. I'm calling to verify the current contact and operational status for {row['name']}. "
            "Is this the correct facility and the right person to speak with?"
        ),
        "source_context": draft["text"], "questions": draft["questions"],
        "closing": "Thank you. I'll record only the information you confirmed and any agreed follow-up.",
        "limits": [
            "Operator-reviewed draft only. No call or message is sent.",
            "The source snapshot is retrospective. Directory records do not establish current conditions.",
            "Conditions remain unknown until verified with an appropriate contact. No clinical guidance.",
            "Nemotron selected approved source clauses and questions; it did not invent facility conditions.",
        ],
        "grounding": draft["grounding"], "execution": result["execution"],
        "source_snapshot_sha256": snapshot["source_snapshot_hash"],
    }


def publish(snapshot: dict, output: Path) -> None:
    if not output.parent.is_dir():
        raise ValueError("Snapshot output directory does not exist")
    temporary = output.with_name(f".{output.stem}-{uuid4().hex}.json")
    temporary.write_text(json.dumps(snapshot, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    write_sidecar(
        temporary, "http://127.0.0.1:8088/v1/chat/completions",
        "Derived from real public-source records and genuine Nemotron selections; source licenses retained",
        "python -m engines.generate_drafts --snapshot engines/snapshots/manatee-zetaris-chain.json --all",
        snapshot["generated_at"],
    )
    os.replace(temporary, output)
    os.replace(Path(str(temporary) + ".provenance.json"), Path(str(output) + ".provenance.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--all", action="store_true")
    operation.add_argument("--call-script", metavar="CCN")
    args = parser.parse_args()
    try:
        snapshot = read_verified_snapshot(args.snapshot)
        if args.all:
            original = sha256_of(args.snapshot)
            generated = generate_all(snapshot)
            if sha256_of(args.snapshot) != original:
                raise RuntimeError("Snapshot changed during generation; publication refused")
            publish(generated, args.snapshot)
            print(json.dumps({
                "model_report": generated["model_report"],
                "trace_ids": [execution.get("response_id") for execution in generated["model_executions"]],
                "snapshot_sha256": sha256_of(args.snapshot),
            }))
        else:
            print(json.dumps(generate_call_script(snapshot, args.call_script), ensure_ascii=True))
    except (RuntimeError, ValueError, KeyError, OSError):
        print(json.dumps({"error": "Draft generation failed validation or provider access. No substitute draft.",
                          "audit_log": "Private .porchlight/model-events.jsonl records attempted provider calls."}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
