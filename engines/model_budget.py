"""Durable, process-safe reservations for Joe's bounded free NVIDIA approval."""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

MAX_ATTEMPTS = 2000
APPROVAL = "porch-light-national-20261023"
ROOT = Path.home() / ".porchlight" / "model-budget" / APPROVAL


class BudgetExceeded(RuntimeError):
    pass


class RouteViolation(RuntimeError):
    def __init__(self, receipt: dict):
        super().__init__("Meterless did not attest the approved free NVIDIA route; further calls are blocked")
        self.receipt = receipt


def reserve(purpose: str) -> Path:
    ROOT.mkdir(parents=True, exist_ok=True)
    if (ROOT / "ROUTE_STOP.json").exists():
        raise RuntimeError("Model calls are blocked by a retained provider/cost policy violation")
    if (ROOT / f"attempt-{MAX_ATTEMPTS:04}.json").exists():
        raise BudgetExceeded("The approved 2000-attempt Nemotron budget is exhausted")
    for index in range(1, MAX_ATTEMPTS + 1):
        target = ROOT / f"attempt-{index:04}.json"
        try:
            with target.open("x", encoding="utf-8") as stream:
                json.dump({"approval": APPROVAL, "attempt": index, "purpose": purpose,
                           "status": "reserved", "created_at": datetime.now(timezone.utc).isoformat(),
                           "route": "free_nvidia_only", "paid_fallback_enabled": False}, stream)
            return target
        except FileExistsError:
            continue
    raise BudgetExceeded("The approved 2000-attempt Nemotron budget is exhausted")


def finish(ticket: Path, event: dict) -> None:
    event["approval"] = APPROVAL
    event["budget_attempt"] = int(ticket.stem.removeprefix("attempt-"))
    ticket.write_text(json.dumps(event, ensure_ascii=True) + "\n", encoding="utf-8")


def runtime_receipt(response_id: str) -> dict:
    path = Path(os.environ["LOCALAPPDATA"]) / "ai.meterless.runtime/receipts.jsonl"
    deadline = time.monotonic() + 5
    while True:
        if path.exists():
            with path.open("rb") as stream:
                stream.seek(max(0, path.stat().st_size - 8 * 1024 * 1024))
                lines = stream.read().decode("utf-8", errors="replace").splitlines()
            for line in reversed(lines):
                try:
                    receipt = json.loads(line)["body"]["receipt"]
                except (ValueError, KeyError, TypeError):
                    continue
                if receipt.get("request_id") != response_id or receipt.get("app") != "porch-light":
                    continue
                route, cost = receipt.get("winning_route", {}), receipt.get("cost", {})
                observed = {"request_id": response_id, "receipt_id": receipt.get("receipt_id"),
                        "winning_route": route, "actual_usd": cost.get("actual_usd"),
                        "effective_mode": receipt.get("mode"), "requested_mode": receipt.get("requested_mode")}
                if (route.get("provider") != "nvidia" or "nemotron" not in str(route.get("model", "")).lower()
                        or type(cost.get("actual_usd")) not in (int, float) or cost.get("actual_usd") != 0):
                    ROOT.mkdir(parents=True, exist_ok=True)
                    (ROOT / "ROUTE_STOP.json").write_text(json.dumps(observed) + "\n", encoding="utf-8")
                    raise RouteViolation(observed)
                return observed
        if time.monotonic() >= deadline:
            raise RuntimeError("No matching Meterless provider and cost receipt was found")
        time.sleep(.2)
