"""Measure real source chains and bounded Nemotron drafts without substituting missing data."""

import argparse
import csv
import json
import random
import re
import shutil
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from data.provenance.sidecar import verify, write_sidecar
from engines.draft_jobs import budget_summary, enrich
from engines.national_alerts import active_scope
from engines.national_run import Chain, literal, run_county
from engines.national_sources import DB

ROOT = Path.home() / ".porchlight/national/sweeps"
SOURCE = "jdbc:zetaris:lightning@localhost:10000"
BATCH_FILE = re.compile(r"^model-batch-(\d{5})\.json$")
IDENTITY_ERROR = "A model batch changed source facility identity"
MODEL_BATCH_SIZE = 10


def save(path: Path, document: dict) -> None:
    path.write_text(json.dumps(document, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    write_sidecar(path, SOURCE, "Derived public-source evidence; original source licenses retained",
                  "python -m engines.national_sweep", datetime.now(timezone.utc).isoformat())


def classify(snapshot: dict) -> str:
    if snapshot.get("state") == "source_gap":
        return "source_gap"
    if snapshot["counts"]["ranked_rows"]:
        return "complete_with_ranked_rows"
    return "complete_no_rankable_rows" if snapshot["counts"]["source_rows"] else "complete_no_matching_source_rows"


def paused_before_provider(snapshot: dict) -> bool:
    histories = [attempt for row in snapshot.get("facilities", [])
                 for attempt in (row["evidence"].get("model_explanation") or {}).get("attempts", [])]
    return (not snapshot.get("model_executions") and bool(histories)
            and all(attempt.get("status") == "failed_before_provider_call"
                    and attempt.get("reason") == "Model calls are blocked by a retained provider/cost policy violation"
                    for attempt in histories))


def facility_ccn(row: dict) -> str:
    ccn = row.get("ccn") if isinstance(row, dict) else None
    if not isinstance(ccn, str) or not ccn:
        raise RuntimeError(IDENTITY_ERROR)
    return ccn


def index_cached_batches(documents: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    """Index completed checkpoint facilities by CCN, ignoring file and list order."""
    facility_by_ccn, document_by_ccn = {}, {}
    for document in documents:
        rows = document.get("facilities") if isinstance(document, dict) else None
        if not isinstance(rows, list) or not rows:
            raise RuntimeError(IDENTITY_ERROR)
        seen = set()
        for row in rows:
            ccn = facility_ccn(row)
            if ccn in seen or ccn in facility_by_ccn:
                raise RuntimeError(IDENTITY_ERROR)
            seen.add(ccn)
            facility_by_ccn[ccn] = row
            document_by_ccn[ccn] = document
    return facility_by_ccn, document_by_ccn


def bind_cached_facilities(eligible: list[tuple[str, dict]],
                           facility_by_ccn: dict[str, dict]) -> list[dict | None]:
    """Align cached facilities to a rebuilt eligible list by CCN.

    A facility with no checkpoint yet stays None so resume can generate only the
    remainder. A cached CCN missing from the rebuilt list, a duplicated source CCN,
    or a cached record whose CCN differs from its source row is refused.
    """
    source_ccns, seen = [], set()
    for _, row in eligible:
        ccn = facility_ccn(row)
        if ccn in seen:
            raise RuntimeError(IDENTITY_ERROR)
        seen.add(ccn)
        source_ccns.append(ccn)
    if set(facility_by_ccn) - seen:
        raise RuntimeError(IDENTITY_ERROR)
    bound = []
    for ccn in source_ccns:
        generated = facility_by_ccn.get(ccn)
        if generated is not None and facility_ccn(generated) != ccn:
            raise RuntimeError(IDENTITY_ERROR)
        bound.append(generated)
    return bound


def load_model_checkpoints(folder: Path) -> tuple[list[tuple[Path, dict]], set[Path]]:
    """Load completed model batches. Provider-pause files are archived, not reused as results."""
    completed, paused = [], set()
    paths = sorted(path for path in folder.glob("model-batch-*.json") if BATCH_FILE.match(path.name))
    for path in paths:
        if not verify(path):
            raise RuntimeError("A model batch checkpoint failed its checksum")
        cached = json.loads(path.read_text())
        if paused_before_provider(cached):
            archive = folder / "paused-before-provider"
            archive.mkdir(exist_ok=True)
            for file in (path, path.with_name(path.name + ".provenance.json")):
                target = archive / file.name
                if not target.exists():
                    shutil.copyfile(file, target)
            paused.add(path)
            continue
        completed.append((path, cached))
    return completed, paused


def model_batch_path(folder: Path, index: int) -> Path:
    return folder / f"model-batch-{index:05d}.json"


def _checkpoint_path_free(path: Path, used: set[Path], reusable: set[Path]) -> bool:
    if path in used:
        return False
    return not path.exists() or path in reusable


def assign_checkpoint_paths(folder: Path, pending: list[tuple[int, list]],
                            blocked: set[Path], reusable: set[Path]) -> list[tuple[Path, int, list]]:
    """Choose paths for new batches without replacing a checkpoint for a different facility set."""
    used = set(blocked)
    cursor = 0
    assigned = []
    for index, batch in pending:
        preferred = model_batch_path(folder, index)
        if _checkpoint_path_free(preferred, used, reusable):
            path = preferred
        else:
            while not _checkpoint_path_free(model_batch_path(folder, cursor), used, reusable):
                cursor += 1
            path = model_batch_path(folder, cursor)
            cursor += 1
        used.add(path)
        assigned.append((path, index, batch))
    return assigned


def record_model_facility(snapshots: dict, folder: Path, fips: str, row: dict,
                          generated: dict, executions: list) -> None:
    if facility_ccn(row) != facility_ccn(generated):
        raise RuntimeError(IDENTITY_ERROR)
    row["evidence"]["model_explanation"] = generated["evidence"]["model_explanation"]
    prior = {event["event_id"] for event in snapshots[fips]["model_executions"]}
    snapshots[fips]["model_executions"].extend(
        event for event in executions if event["event_id"] not in prior)
    save(folder / f"county-{fips}.json", snapshots[fips])


def apply_cached_bindings(snapshots: dict, folder: Path, eligible: list[tuple[str, dict]],
                          bound: list[dict | None], document_by_ccn: dict[str, dict]) -> list[tuple[str, dict]]:
    """Copy cached explanations onto source rows by CCN. Return facilities that still need generation."""
    pending = []
    for (fips, row), cached in zip(eligible, bound, strict=True):
        if cached is None:
            pending.append((fips, row))
            continue
        record_model_facility(snapshots, folder, fips, row, cached,
                              document_by_ccn[facility_ccn(row)]["model_executions"])
    return pending


def pending_model_batches(pending: list[tuple[str, dict]]) -> list[tuple[int, list]]:
    """Pack facilities that still need a draft into the usual groups of ten."""
    return [(index, pending[start:start + MODEL_BATCH_SIZE])
            for index, start in enumerate(range(0, len(pending), MODEL_BATCH_SIZE))]


def unassigned(capture: str) -> dict:
    chain = Chain()
    rows = chain.read("List every CMS source row without a current canonical county join", f"""
SELECT c.source_kind,c.ccn,c.facility_name,c.state,c.county_name,g.county_fips,g.match_status,g.match_type
FROM {DB}.pl_nat_cms_v1 c LEFT JOIN {DB}.pl_nat_census_v1 g
ON c.capture_id=g.capture_id AND c.source_kind=g.source_kind AND c.ccn=g.ccn
WHERE c.capture_id={literal(capture)} AND (g.county_fips IS NULL OR NOT EXISTS(
SELECT 1 FROM {DB}.pl_nat_county_catalog_v3 k
WHERE k.capture_id=c.capture_id AND k.fips=g.county_fips))""")
    return {"rows": rows, "data_access": chain.receipt()}


def execute(folder: Path, sample: int, seed: int, all_counties: bool, workers: int, drafts: bool) -> dict:
    started = time.monotonic()
    scope_path = folder / "scope.json"
    if scope_path.exists():
        if not verify(scope_path):
            raise RuntimeError("Existing frozen sweep scope failed its checksum")
        scope = json.loads(scope_path.read_text())
    else:
        scope = active_scope()
        save(scope_path, scope)
    catalog = {county["fips"]: county for county in scope["catalog"]["counties"]}
    capture = next(iter(catalog.values()))["capture_id"]
    active = set(scope["active_counties"])
    remaining = sorted(set(catalog) - active)
    randoms = random.Random(seed).sample(remaining, min(sample, len(remaining)))
    targets = sorted(active) + randoms
    if all_counties:
        targets += sorted(set(catalog) - set(targets))
    groups = {fips: "active_alert" if fips in active else "seeded_random_sample"
              if fips in set(randoms) else "additional_full_sweep" for fips in targets}
    save(folder / "selection.json", {
        "seed": seed, "requested_random_sample": sample, "actual_random_sample": len(randoms),
        "active_counties": len(active), "catalog_counties": len(catalog), "targets": targets,
        "selection_groups": groups, "not_selected": sorted(set(catalog) - set(targets)),
        "source_capture_id": capture, "weather_capture_id": scope["weather_capture_id"],
        "alerts_captured_at": scope["captured_at"], "alerts_selected_at": scope["selected_at"],
    })
    gap_path = folder / "unassigned-source-records.json"
    if not gap_path.exists():
        save(gap_path, unassigned(capture))
    if not verify(gap_path):
        raise RuntimeError("Unassigned-source evidence checksum failed")
    results, snapshots = [], {}
    save(folder / "progress.json", {"phase": "source_chains", "completed": 0, "target": len(targets)})

    def source_run(fips: str) -> tuple[str, dict]:
        path = folder / f"county-{fips}.json"
        if path.exists():
            if not verify(path):
                raise RuntimeError("A cached county artifact failed its checksum")
            snapshot = json.loads(path.read_text())
            if snapshot.get("source_snapshot_hash") != capture:
                raise RuntimeError("A cached county artifact belongs to another source capture")
            return fips, snapshot
        failed = folder / f"failure-{fips}.json"
        if failed.exists():
            if not verify(failed):
                raise RuntimeError("A retained county failure failed its checksum")
            return fips, json.loads(failed.read_text())
        begin = time.monotonic()
        try:
            snapshot = run_county(fips, capture)
            snapshot["sweep_source_seconds"] = round(time.monotonic() - begin, 3)
            save(path, snapshot)
            return fips, snapshot
        except Exception as error:
            failure = {"county": {"fips": fips, "name": catalog[fips]["name"], "state": catalog[fips]["state"]},
                       "status": "runtime_error", "error_type": type(error).__name__, "detail": str(error)[:500],
                       "runtime_seconds": round(time.monotonic() - begin, 3)}
            save(folder / f"failure-{fips}.json", failure)
            return fips, failure

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for future in as_completed([pool.submit(source_run, fips) for fips in targets]):
            fips, snapshot = future.result()
            status = snapshot.get("status") or classify(snapshot)
            result = {"fips": fips, "name": catalog[fips]["name"], "state": catalog[fips]["state"],
                      "selection_group": groups[fips], "status": status,
                      "source_seconds": snapshot.get("sweep_source_seconds", snapshot.get("runtime_seconds")),
                      "source_rows": snapshot.get("counts", {}).get("source_rows") if snapshot.get("counts") else None,
                      "ranked_rows": snapshot.get("counts", {}).get("ranked_rows") if snapshot.get("counts") else None,
                      "refused_rows": snapshot.get("counts", {}).get("refused_rows") if snapshot.get("counts") else None,
                      "query_ids": snapshot.get("data_access", {}).get("zetaris_query_ids", []),
                      "source_join_counts": [
                          {"name": step["name"], "query_ids": step["query_ids"],
                           "candidate_count": step["candidate_count"], "matched_count": step["matched_count"],
                           "unmatched_count": step["candidate_count"] - step["matched_count"]}
                          for step in snapshot.get("data_access", {}).get("chain_steps", [])
                          if "candidate_count" in step],
                      "reason": snapshot.get("reason") or snapshot.get("detail")}
            results.append(result)
            if status.startswith("complete_"):
                snapshots[fips] = snapshot
            if len(results) % 10 == 0 or len(results) == len(targets):
                progress = {"phase": "source_chains", "completed": len(results), "target": len(targets),
                            "elapsed_seconds": round(time.monotonic() - started, 3),
                            "outcomes": dict(Counter(row["status"] for row in results))}
                save(folder / "progress.json", progress)
                print(json.dumps(progress), flush=True)
    source_seconds = (datetime.now(timezone.utc) - datetime.fromisoformat(scope["selected_at"])).total_seconds()
    model_reports = []
    if drafts:
        eligible = [(fips, row) for fips, snapshot in sorted(snapshots.items()) for row in snapshot["facilities"]]
        completed_checkpoints, paused = load_model_checkpoints(folder)
        facility_by_ccn, document_by_ccn = index_cached_batches(
            [document for _, document in completed_checkpoints])
        bound = bind_cached_facilities(eligible, facility_by_ccn)
        for _, document in completed_checkpoints:
            model_reports.append(document["model_report"])
        pending = pending_model_batches(
            apply_cached_bindings(snapshots, folder, eligible, bound, document_by_ccn))
        jobs = assign_checkpoint_paths(
            folder, pending, {path for path, _ in completed_checkpoints}, paused)
        completed_count = len(completed_checkpoints)
        total_batches = completed_count + len(jobs)

        def publish() -> None:
            progress = {"phase": "grounded_drafts", "completed_batches": completed_count,
                        "total_batches": total_batches, "elapsed_seconds": round(time.monotonic() - started, 3),
                        "budget": budget_summary()}
            save(folder / "progress.json", progress)
            if completed_count % 10 == 0 or completed_count == total_batches:
                print(json.dumps({"phase": "grounded_drafts", "completed_batches": completed_count,
                                  "total_batches": total_batches, "budget": progress["budget"]}), flush=True)

        if completed_count:
            publish()

        def model_run(path: Path, batch: list) -> tuple[list, dict]:
            file_index = int(BATCH_FILE.match(path.name).group(1))
            enriched = enrich({"facilities": [row for _, row in batch]}, folder.name + f":batch:{file_index}")
            save(path, enriched)
            return batch, enriched

        if jobs:
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(model_run, path, batch) for path, _, batch in jobs]
                for future in as_completed(futures):
                    batch, enriched = future.result()
                    model_reports.append(enriched["model_report"])
                    for (fips, row), generated in zip(batch, enriched["facilities"], strict=True):
                        record_model_facility(snapshots, folder, fips, row, generated,
                                              enriched["model_executions"])
                    completed_count += 1
                    publish()
    results.sort(key=lambda row: row["fips"])
    outcomes = Counter(row["status"] for row in results)
    reasons = Counter(row["reason"] for snapshot in snapshots.values() for row in snapshot["refused"])
    report = {
        "schema_version": "porch-light.national-sweep.v1", "run_id": folder.name,
        "generated_at": datetime.now(timezone.utc).isoformat(), "source_capture_id": capture,
        "weather_capture_id": scope["weather_capture_id"], "alerts_captured_at": scope["captured_at"],
        "alerts_selected_at": scope["selected_at"], "attempted_counties": len(results),
        "active_alert_counties": len(active), "random_sample_counties": len(randoms), "seed": seed,
        "not_selected_counties": sorted(set(catalog) - set(targets)), "outcomes": dict(outcomes),
        "complete_chain_rate": sum(value for key, value in outcomes.items() if key.startswith("complete_")) / len(results),
        "counties_with_ranked_rows_rate": outcomes["complete_with_ranked_rows"] / len(results),
        "source_phase_seconds": round(source_seconds, 3),
        "total_seconds": round((datetime.now(timezone.utc) - datetime.fromisoformat(scope["selected_at"])).total_seconds(), 3),
        "facility_refusal_reasons": dict(reasons), "county_runs": results,
        "model": {
            "api_attempts": sum(row["provider_requests"] for row in model_reports),
            "first_pass_requests": sum(row["first_pass_requests"] for row in model_reports),
            "retry_requests": sum(row["retry_requests"] for row in model_reports),
            "retry_requests_not_attempted_budget": sum(row["retry_requests_not_attempted_budget"] for row in model_reports),
            "eligible_facilities": sum(row["eligible_facilities"] for row in model_reports),
            "accepted_facilities": sum(row["accepted_facilities"] for row in model_reports),
            "first_pass_facilities": sum(row["first_pass_facilities"] for row in model_reports),
            "retry_recoveries": sum(row["retry_recoveries"] for row in model_reports),
            "unresolved_facilities": sum(row["unresolved_facilities"] for row in model_reports),
            "not_attempted_budget": sum(row["not_attempted_budget"] for row in model_reports),
            "failure_reasons": dict(sum((Counter(row["failure_reasons"]) for row in model_reports), Counter())),
            "global_approval_budget": budget_summary(),
        },
        "scope_gaps": [{"alert_id": alert["id"], "status": alert["mapping_status"]}
                       for alert in scope["alerts"] if alert["mapping_status"] != "mapped"],
        "limits": scope["limits"] + ["No matching source rows is not proof that a county has no care facilities.",
                  "Model failures and cap omissions are retained. Model generation never affects the deterministic score."],
    }
    attempted = report["model"]["eligible_facilities"] - report["model"]["not_attempted_budget"]
    report["model"]["grounding_pass_rate"] = report["model"]["accepted_facilities"] / attempted if attempted else None
    save(folder / "report.json", report)
    with (folder / "county-timings.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)
    write_sidecar(folder / "county-timings.csv", SOURCE, "Derived measured county chain timings",
                  "python -m engines.national_sweep", report["generated_at"])
    save(folder / "progress.json", {"phase": "completed", "report": "report.json",
                                   "total_seconds": report["total_seconds"]})
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=150)
    parser.add_argument("--seed", type=int, default=20261023)
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=4)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--drafts", action="store_true")
    parser.add_argument("--resume", type=Path)
    args = parser.parse_args()
    if args.sample < 100:
        parser.error("A seeded random sample of at least 100 is required")
    folder = args.resume or ROOT / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8])
    folder.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"stage": "sweep_started", "folder": str(folder)}), flush=True)
    report = execute(folder, args.sample, args.seed, args.all, args.workers, args.drafts)
    print(json.dumps({key: report[key] for key in ("run_id", "attempted_counties", "outcomes", "total_seconds", "model")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
