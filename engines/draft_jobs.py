"""Retain each failed attempt and one linked retry; never publish substitute model text."""

import json
from collections import Counter

from engines.grounded_drafts import DraftFailure, request_selections
from engines.model_budget import BudgetExceeded, MAX_ATTEMPTS, ROOT


def enrich(snapshot: dict, run_id: str | None) -> dict:
    executions, accepted, attempts, unattempted = [], {}, {}, []
    rows = snapshot["facilities"]
    skipped_retries = 0
    exhausted = False
    for start in range(0, len(rows), 10):
        batch = rows[start:start + 10]
        if exhausted:
            unattempted.extend(row["ccn"] for row in batch)
            continue
        parent = None
        for index in range(2):
            try:
                result = request_selections(batch, "explanation_batch", retry_of=parent, run_id=run_id)
                event = result["execution"]
                executions.append(event)
                for row in batch:
                    attempts.setdefault(row["ccn"], []).append({
                        "attempt": index + 1, "status": "passed", "trace_id": event["response_id"],
                        "retry_of": parent, "event_id": event["event_id"],
                    })
                accepted.update({draft["ccn"]: draft for draft in result["drafts"]})
                break
            except BudgetExceeded:
                exhausted = True
                unattempted.extend(row["ccn"] for row in batch if row["ccn"] not in attempts)
                if index:
                    skipped_retries += 1
                    for row in batch:
                        attempts[row["ccn"]].append({"status": "retry_not_attempted_budget",
                                                    "reason": "The approved request cap prevented the sole retry."})
                break
            except DraftFailure as error:
                event = error.event
                executions.append(event)
                for row in batch:
                    attempts.setdefault(row["ccn"], []).append({
                        "attempt": index + 1, "status": "failed",
                        "trace_id": event.get("response_id"), "event_id": event["event_id"],
                        "retry_of": parent, "reason": event.get("validation_error", str(error)),
                        "provider_content": event.get("provider_content"),
                    })
                parent = event.get("response_id", event["event_id"])
            except RuntimeError as error:
                for row in batch:
                    attempts.setdefault(row["ccn"], []).append({
                        "status": "failed_before_provider_call", "reason": str(error)[:300]})
                break
    for row in rows:
        history = attempts.get(row["ccn"], [])
        if row["evidence"].get("model_explanation") is not None:
            row["evidence"].setdefault("previous_model_explanations", []).append(row["evidence"]["model_explanation"])
        if row["ccn"] in accepted:
            row["evidence"]["model_explanation"] = {
                **accepted[row["ccn"]], "status": "passed", "attempts": history,
                "run_id": run_id, "operator_review_required": True,
            }
        else:
            row["evidence"]["model_explanation"] = {
                "status": "not_attempted_budget" if row["ccn"] in unattempted else "failed",
                "grounding": {"passed": False}, "attempts": history, "run_id": run_id,
                "text": None, "fabricated_fallback": False,
            }
    failures = [attempt["reason"] for history in attempts.values() for attempt in history
                if attempt["status"].startswith("failed")]
    first_pass = sum(history and history[0]["status"] == "passed" for history in attempts.values())
    snapshot.setdefault("historical_model_executions", []).extend(snapshot.get("model_executions", []))
    snapshot["model_executions"] = executions
    snapshot["model_report"] = {
        "run_id": run_id, "eligible_facilities": len(rows), "attempted_facilities": len(attempts),
        "accepted_facilities": len(accepted), "unresolved_facilities": len(attempts) - len(accepted),
        "not_attempted_budget": len(unattempted), "first_pass_facilities": first_pass,
        "retry_recoveries": len(accepted) - first_pass,
        "provider_requests": len(executions),
        "accepted_facility_rate": len(accepted) / len(attempts) if attempts else None,
        "first_pass_facility_rate": first_pass / len(attempts) if attempts else None,
        "failure_reasons": dict(Counter(failures)),
        "known_actual_usd": sum(value for event in executions
                                if isinstance(value := event.get("meterless_receipt", {}).get("actual_usd"), (int, float))),
        "unknown_cost_receipts": sum("meterless_receipt" not in event for event in executions),
        "first_pass_requests": sum(not event.get("retry_of") for event in executions),
        "retry_requests": sum(bool(event.get("retry_of")) for event in executions),
        "retry_requests_not_attempted_budget": skipped_retries,
        "method": "Nemotron selects and orders exact source clauses and approved verification questions",
        "clinical_validation": False, "max_retries_per_draft": 1, "failed_attempts_retained": True,
    }
    return snapshot


def budget_summary() -> dict:
    records, unresolved, reserved = [], 0, 0
    if ROOT.exists():
        for path in ROOT.glob("attempt-*.json"):
            reserved += 1
            try:
                record = json.loads(path.read_text())
                records.append(record)
                unresolved += int(record.get("status") == "reserved")
            except ValueError:
                unresolved += 1
    return {"approved_attempts": MAX_ATTEMPTS, "reserved_attempts": reserved,
            "completed_records": sum(record.get("status") != "reserved" for record in records),
            "unresolved_reservations": unresolved,
            "known_actual_usd": sum(value for record in records
                                    if isinstance(value := record.get("meterless_receipt", {}).get("actual_usd"), (int, float))),
            "paid_fallback_enabled": False}
