"""Local asynchronous county/alert jobs; all source reads go through Zetaris."""

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from data.provenance.sidecar import verify
from engines.draft_jobs import enrich
from engines.generate_drafts import read_verified_snapshot
from engines.grounded_drafts import DraftFailure, request_selections
from engines.model_budget import BudgetExceeded
from engines.national_alerts import active_scope, warning_matches
from engines.national_run import Chain, county_catalog, run_county
from engines.national_sweep import save

ROOT = Path.home() / ".porchlight/national/jobs"
DEMO = Path(__file__).parent / "snapshots/manatee-zetaris-chain.json"


def catalog() -> dict:
    counties = county_catalog()
    try:
        scope = active_scope()
        weather = {
            "status": "available", "capture_id": scope["weather_capture_id"], "captured_at": scope["captured_at"],
            "selected_at": scope["selected_at"],
            "alerts": [{key: alert.get(key) for key in
                        ("id", "event", "areaDesc", "headline", "expires", "county_fips", "mapping_status")}
                       for alert in scope["alerts"]],
            "data_access": scope["weather_data_access"], "mapping_data_access": scope["mapping_data_access"],
        }
    except (RuntimeError, ValueError) as error:
        weather = {"status": "unavailable", "error_type": type(error).__name__,
                   "message": "Current audited alerts unavailable. County discovery remains separate.",
                   "official_url": "https://api.weather.gov/alerts/active"}
    return {"catalog": counties, "weather": weather}


def alert_run(alert_id: str, weather_capture: str | None, progress) -> dict:
    scope = active_scope(weather_capture)
    selected = next((alert for alert in scope["alerts"] if alert["id"] == alert_id), None)
    if not selected:
        raise ValueError("The selected alert is not active in this verified capture. Refresh the official feed.")
    capture = scope["catalog"]["counties"][0]["capture_id"]
    source_chain = Chain()
    weather_audit = scope["weather_data_access"]["zetaris_audit"]
    source_chain.steps = [
        *scope["catalog"]["data_access"]["chain_steps"],
        {"name": "Read immutable NWS alert capture", "row_count": 1,
         "query_ids": [weather_audit["query_id"]], "audit": weather_audit},
        *scope["mapping_data_access"]["chain_steps"],
    ]
    if not selected["county_fips"]:
        return {"schema_version": "porch-light.national-gap.v1", "state": "source_gap",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_snapshot_hash": capture,
                "county": {"name": selected["event"] + ": " + (selected.get("areaDesc") or "source area"),
                           "fips": "", "state": "US"},
                "reason": "No official county intersection or supported NWS zone mapping exists for this alert. "
                          "No county, facility or warning boundary was guessed.",
                "selected_alert": {**selected, "captured_at": scope["captured_at"],
                                   "capture_id": scope["weather_capture_id"]},
                "counts": None, "facilities": [], "refused": [], "data_access": source_chain.receipt()}
    counties = []
    for index, fips in enumerate(selected["county_fips"]):
        progress("querying_alert_counties", {"completed_counties": index, "total_counties": len(selected["county_fips"])})
        snapshot = run_county(fips, capture)
        if snapshot.get("state") == "source_gap":
            raise RuntimeError("An affected county lacks verified geometry. No incomplete alert call sheet was substituted.")
        covered = warning_matches(capture, scope["weather_capture_id"], alert_id, fips)
        matches = {(row["source_kind"], row["ccn"]): row for row in covered["rows"]}
        keep = []
        for row in snapshot["facilities"]:
            kind = "nursing_homes" if row["type"] == "nursing_home" else "dialysis"
            match = matches.get((kind, row["ccn"]), {})
            row["evidence"]["zetaris_query_ids"] = row["evidence"]["zetaris_query_ids"] + covered["data_access"]["zetaris_query_ids"]
            if match.get("warning_covers") is True:
                keep.append(row)
            else:
                snapshot["refused"].append({
                    "ccn": row["ccn"], "name": row["name"], "source_kind": kind,
                    "reason": "outside_selected_official_warning" if match.get("warning_covers") is False
                              else "official_warning_geometry_join_unavailable",
                    "query_ids": row["evidence"]["zetaris_query_ids"],
                })
        snapshot["facilities"] = keep
        snapshot["data_access"]["chain_steps"].extend(covered["data_access"]["chain_steps"])
        snapshot["data_access"]["zetaris_query_ids"] += covered["data_access"]["zetaris_query_ids"]
        counties.append(snapshot)
    result = counties[0]
    all_rows = [row for snapshot in counties for row in snapshot["facilities"]]
    if len({row["id"] for row in all_rows}) != len(all_rows):
        raise RuntimeError("Alert county scope produced duplicate facility identities")
    all_rows.sort(key=lambda row: (-row["score"]["total"], row["type"], row["ccn"]))
    for index, row in enumerate(all_rows, 1):
        row["rank"] = row["score"]["rank"] = index
    geometry = selected.get("geometry")
    if geometry and geometry.get("type") == "Polygon":
        geometry = {"type": "MultiPolygon", "coordinates": [geometry["coordinates"]]}
    exact_polygon = geometry and geometry.get("type") == "MultiPolygon"
    if not exact_polygon:
        geometry = {"type": "MultiPolygon",
                    "coordinates": [polygon for snapshot in counties for polygon in snapshot["warning_geometry"]["coordinates"]]}
    steps = source_chain.steps + [step for snapshot in counties for step in snapshot["data_access"]["chain_steps"]]
    ids = [identifier for step in steps for identifier in step["query_ids"]]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Alert source steps reused an audit identifier")
    result.update({
        "county": {"name": selected["event"] + " source counties", "state": "US",
                   "fips": ",".join(selected["county_fips"])},
        "facilities": all_rows, "refused": [row for snapshot in counties for row in snapshot["refused"]],
        "warning_geometry": geometry,
        "counts": {"source_rows": sum(snapshot["counts"]["source_rows"] for snapshot in counties),
                   "ranked_rows": len(all_rows), "refused_rows": sum(len(snapshot["refused"]) for snapshot in counties)},
        "scenario": {**result["scenario"], "event": selected["event"], "mode": "live_alert_capture",
                     "geometry_mode": "official_alert_polygon" if exact_polygon else "county_context_not_warning_geometry"},
        "selected_alert": {**selected, "captured_at": scope["captured_at"],
                           "capture_id": scope["weather_capture_id"], "selected_at": scope["selected_at"]},
    })
    result["data_access"].update({"chain_steps": steps, "zetaris_query_ids": ids,
                                  "zetaris_audit": steps[-1]["audit"],
                                  "executed_at": steps[-1]["audit"]["end_time"],
                                  "statement_sha256": hashlib.sha256(steps[-1]["audit"]["sql_query"].encode()).hexdigest()})
    result["limits"] += [
        "Alert inclusion was checked against official NWS polygons or affected zones, not area-description text.",
        "ZIP density percentiles use their own county reference cohorts. Cross-county ordering remains an unvalidated prototype.",
        "County-context outlines are not a substitute warning boundary when the alert has no polygon.",
        "Alerts can expire while a run is processing. Use the original NWS record for current instructions.",
    ]
    return result


def checked_job(identifier: str) -> Path:
    if not re.fullmatch(r"[a-f0-9]{32}", identifier):
        raise ValueError("Invalid local run identifier")
    return ROOT / identifier


def run_job(identifier: str, fips: str | None, alert_id: str | None, weather_capture: str | None) -> None:
    folder = checked_job(identifier)
    folder.mkdir(parents=True, exist_ok=True)

    def progress(phase: str, fields: dict | None = None):
        save(folder / "status.json", {"id": identifier, "phase": phase, **(fields or {})})

    try:
        progress("querying_sources")
        snapshot = alert_run(alert_id, weather_capture, progress) if alert_id else run_county(fips or "")
        if snapshot.get("state") != "source_gap":
            save(folder / "snapshot.json", snapshot)
            progress("grounding_nemotron_drafts", {"eligible_facilities": len(snapshot["facilities"])})
            snapshot = enrich(snapshot, identifier)
        save(folder / "snapshot.json", snapshot)
        progress("completed")
    except Exception as error:
        progress("failed", {"error_type": type(error).__name__,
                            "message": str(error)[:400], "fabricated_fallback": False})


def call_script(ccn: str, run_id: str | None) -> dict:
    if not re.fullmatch(r"[0-9A-Z]{6}", ccn):
        raise ValueError("Invalid source facility identifier")
    if run_id:
        path = checked_job(run_id) / "snapshot.json"
        if not verify(path):
            raise RuntimeError("The selected run did not pass source-artifact integrity checks")
        snapshot = json.loads(path.read_text())
    else:
        snapshot = read_verified_snapshot(DEMO)
    rows = [row for row in snapshot["facilities"] if row["ccn"] == ccn]
    if len(rows) != 1:
        raise ValueError("The facility is not uniquely ranked in this verified source snapshot")
    operation = "call-script:" + (run_id or snapshot["source_snapshot_hash"]) + ":" + ccn
    cache = ROOT.parent / "call-scripts"
    cache.mkdir(parents=True, exist_ok=True)
    output = cache / (hashlib.sha256(operation.encode()).hexdigest() + ".json")
    if output.exists():
        if not verify(output):
            raise RuntimeError("The retained call-script artifact failed integrity verification")
        return json.loads(output.read_text())
    lock = output.with_suffix(".lock")
    with lock.open("x"):
        pass
    try:
        attempts, parent = [], None
        for _ in range(2):
            try:
                result = request_selections(rows, "call_script", retry_of=parent, run_id=operation)
                attempts.append(result["execution"])
                accepted = {"status": "passed", "draft": result["drafts"][0],
                            "execution": result["execution"], "attempts": attempts,
                            "limits": "Operator review required. No call was placed. No facility condition is inferred."}
                save(output, accepted)
                return accepted
            except DraftFailure as error:
                attempts.append(error.event)
                parent = error.event.get("response_id", error.event["event_id"])
            except BudgetExceeded:
                omitted = {"status": "not_attempted_budget" if not attempts else "failed",
                           "attempts": attempts, "fabricated_fallback": False,
                           "message": "The approved request cap prevented this call or its sole retry. No script was substituted."}
                save(output, omitted)
                return omitted
        failed = {"status": "failed", "attempts": attempts, "fabricated_fallback": False,
                  "message": "Grounding or provider validation failed. Each failed attempt is retained; no script was substituted."}
        save(output, failed)
        return failed
    finally:
        lock.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--catalog", action="store_true")
    action.add_argument("--job")
    action.add_argument("--call-script")
    parser.add_argument("--county")
    parser.add_argument("--alert")
    parser.add_argument("--weather-capture")
    parser.add_argument("--source-run")
    args = parser.parse_args()
    if args.catalog:
        print(json.dumps(catalog(), ensure_ascii=True))
    elif args.call_script:
        print(json.dumps(call_script(args.call_script, args.source_run), ensure_ascii=True))
    else:
        if bool(args.county) == bool(args.alert):
            parser.error("Select exactly one actual county or alert")
        run_job(args.job, args.county, args.alert, args.weather_capture)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
