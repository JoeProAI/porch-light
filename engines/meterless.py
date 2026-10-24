"""Nemotron explanations only through the authenticated local Meterless gateway."""

from engines.grounded_drafts import request_selections
from engines.runtime_config import BASE_URL, MODEL


def explain(rows: list[dict]) -> dict:
    result = request_selections(rows, "explanation_batch")
    event = result["execution"]
    return {
        "response_id": event["response_id"], "reported_model": event["reported_model"],
        "requested_model": MODEL, "usage": event.get("usage"),
        "thinking_disabled": True, "explanations": [
            {"ccn": draft["ccn"], "text": draft["text"]} for draft in result["drafts"]],
        "endpoint": BASE_URL, "draft_requires_operator_review": True,
        "meterless_receipt": event["meterless_receipt"],
        "budget_attempt": event["budget_attempt"],
    }
