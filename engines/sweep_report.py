"""Summarize verified county checkpoints without waiting for the later model phase."""

import argparse
import hashlib
import json
import math
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from data.provenance.sidecar import write_sidecar
from engines.national_sweep import classify


def verified(path: Path) -> dict:
    raw = path.read_bytes()
    sidecar = json.loads(path.with_name(path.name + ".provenance.json").read_text())
    if hashlib.sha256(raw).hexdigest() != sidecar["sha256"]:
        raise ValueError("A sweep checkpoint failed its source checksum")
    return json.loads(raw)


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    return ordered[lower] + (ordered[math.ceil(position)] - ordered[lower]) * (position - lower)


def collect(folder: Path) -> dict:
    selection = verified(folder / "selection.json")
    scope = verified(folder / "scope.json")
    unassigned = verified(folder / "unassigned-source-records.json")
    targets = selection["targets"]
    if len(targets) != len(set(targets)) or set(targets) != {row["fips"] for row in scope["catalog"]["counties"]}:
        raise ValueError("A full source summary requires every county in the actual source catalog exactly once")
    outcomes, reasons, errors = Counter(), Counter(), Counter()
    join_candidates, join_matches = Counter(), Counter()
    times, missing, completed = [], [], set()
    accounted = {(row["source_kind"], row["ccn"]) for row in unassigned["rows"]}
    source_finished = []
    audit_ids = set()
    source_counties = ranked_counties = source_rows = ranked_rows = refused_rows = 0
    for fips in targets:
        path = folder / f"county-{fips}.json"
        if not path.exists():
            path = folder / f"failure-{fips}.json"
        try:
            row = verified(path)
        except (OSError, ValueError, KeyError):
            missing.append(fips)
            continue
        if row.get("status") != "runtime_error" and row.get("source_snapshot_hash") != selection["source_capture_id"]:
            raise ValueError("A county checkpoint belongs to another immutable capture")
        if row["county"]["fips"] != fips:
            raise ValueError("A county checkpoint belongs to another county")
        status = row.get("status") or classify(row)
        if status.startswith("complete_"):
            access = row["data_access"]
            ids = access["zetaris_query_ids"]
            if (len(ids) != 7 or len(access["chain_steps"]) != 7 or len(ids) != len(set(ids))
                    or any(not str(value).isdigit() for value in ids) or audit_ids.intersection(ids)
                    or any(step["audit"]["finish_successfully"] is not True
                           or step["query_ids"] != [step["audit"]["query_id"]]
                           or step["audit"]["query_id"] not in ids for step in access["chain_steps"])):
                raise ValueError("A completed county lacks closed source audit evidence")
            audit_ids.update(ids)
            for step in access["chain_steps"]:
                if "candidate_count" in step:
                    join_candidates[step["name"]] += step["candidate_count"]
                    join_matches[step["name"]] += step["matched_count"]
        outcomes[status] += 1
        completed.add(fips)
        finished_at = row.get("generated_at")
        if not finished_at:
            finished_at = json.loads(path.with_name(path.name + ".provenance.json").read_text())["fetched_at_utc"]
        source_finished.append(datetime.fromisoformat(finished_at.replace("Z", "+00:00")))
        accounted.update((record["source_kind"], record["ccn"]) for record in row.get("refused", []))
        accounted.update(("nursing_homes" if record["type"] == "nursing_home" else "dialysis", record["ccn"])
                         for record in row.get("facilities", []))
        seconds = row.get("sweep_source_seconds", row.get("runtime_seconds"))
        if isinstance(seconds, (float, int)) and math.isfinite(seconds) and seconds >= 0:
            times.append(float(seconds))
        counts = row.get("counts") or {}
        source_counties += bool(counts.get("source_rows", 0))
        ranked_counties += bool(counts.get("ranked_rows", 0))
        source_rows += counts.get("source_rows", 0)
        ranked_rows += counts.get("ranked_rows", 0)
        refused_rows += counts.get("refused_rows", 0)
        reasons.update(item["reason"] for item in row.get("refused", []))
        if status == "source_gap":
            reasons[row["reason"]] += 1
        if status == "runtime_error":
            errors[row["error_type"]] += 1
    active = set(scope["active_counties"])
    passed = sum(count for status, count in outcomes.items() if status.startswith("complete_"))
    return {
        "schema_version": "porch-light.source-sweep-summary.v1", "run_id": folder.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_capture_id": selection["source_capture_id"],
        "weather_capture_id": selection["weather_capture_id"],
        "alerts_captured_at": selection["alerts_captured_at"],
        "target_counties": len(targets), "completed_counties": len(completed),
        "complete": not missing, "missing_counties": missing,
        "audited_chain_pass_count": passed,
        "distinct_closed_county_statement_audits": len(audit_ids),
        "audited_chain_pass_rate": passed / len(completed) if completed else None,
        "counties_with_source_facilities": source_counties, "counties_with_ranked_facilities": ranked_counties,
        "source_facilities": source_rows, "ranked_facilities": ranked_rows, "refused_facilities": refused_rows,
        "unassigned_source_records": len(unassigned["rows"]),
        "cms_input_records": int(scope["catalog"]["counties"][0]["cms_count"]),
        "distinct_cms_records_accounted_for": len(accounted),
        "source_phase_observed_seconds": (
            max(source_finished) - datetime.fromisoformat(scope["selected_at"])).total_seconds() if source_finished else None,
        "active_alert_counties": len(active), "active_alert_counties_completed": len(active & completed),
        "seeded_random_counties": selection["actual_random_sample"],
        "measured_counties": len(times), "p50_seconds": percentile(times, .5),
        "p95_seconds": percentile(times, .95),
        "outcomes": dict(outcomes), "top_gap_reasons": reasons.most_common(15),
        "gap_reasons": reasons.most_common(),
        "measured_join_counts": [
            {"step": name, "candidates": count, "matched": join_matches[name],
             "unmatched": count - join_matches[name]} for name, count in join_candidates.items()],
        "runtime_error_types": dict(errors),
        "unmapped_alerts": sum(alert["mapping_status"] != "mapped" for alert in scope["alerts"]),
        "limits": [
            "This is the source phase only. Nemotron results and their separate attempt cap are reported later.",
            "The alert scope is frozen at its captured timestamp, not claimed current when the sweep finishes.",
            "No matching CMS rows doesn't prove a county has no care facilities.",
            "Ranked rows don't verify operating conditions, emergency contacts or clinical priority.",
            "Percentiles use linear interpolation over measured per-county source wall times, including failures.",
            "Canonical county-join gaps can overlap with county refusals assigned from an exact CMS county label.",
        ],
    }


def markdown(report: dict) -> str:
    if not report["complete"]:
        raise ValueError("An incomplete sweep cannot be published as a final source summary")
    lines = [
        "# Nationwide Source Sweep",
        "", f"Measured {report['generated_at']}. Run `{report['run_id']}`.",
        f"Source capture `{report['source_capture_id']}`.",
        f"NWS capture `{report['weather_capture_id']}`, captured {report['alerts_captured_at']}.",
        "", "## Results", "",
        "| Measurement | Result |", "|---|---:|",
        f"| Counties attempted | {report['completed_counties']} / {report['target_counties']} |",
        f"| Completed audited chains | {report['audited_chain_pass_count']} |",
        f"| Distinct closed county-statement audit IDs | {report['distinct_closed_county_statement_audits']} |",
        f"| Audited-chain pass rate | {report['audited_chain_pass_rate']:.2%} |",
        f"| Counties returning CMS source records | {report['counties_with_source_facilities']} |",
        f"| Counties returning rankable facilities | {report['counties_with_ranked_facilities']} |",
        f"| Ranked facilities / source refusals | {report['ranked_facilities']} / {report['refused_facilities']} |",
        f"| CMS records without a canonical county join | {report['unassigned_source_records']} |",
        f"| Distinct CMS records accounted for, including refusals and county-join gaps | {report['distinct_cms_records_accounted_for']} / {report['cms_input_records']} |",
        f"| Frozen active-alert counties completed | {report['active_alert_counties_completed']} / {report['active_alert_counties']} |",
        f"| Additional seeded random counties | {report['seeded_random_counties']} |",
        f"| Source time p50, seconds | {report['p50_seconds']:.3f} |",
        f"| Source time p95, seconds | {report['p95_seconds']:.3f} |",
        f"| County runs with measured times | {report['measured_counties']} |",
        f"| Source phase observed wall time, seconds | {report['source_phase_observed_seconds']:.3f} |",
        f"| Alerts without a supported county mapping | {report['unmapped_alerts']} |",
        "", "## County Outcomes", "", "| Outcome | Counties |", "|---|---:|",
        *[f"| {key} | {value} |" for key, value in sorted(report["outcomes"].items())],
        "", "## Source Gaps", "", "| Refusal or gap, most frequent first | Records |", "|---|---:|",
        *[f"| {key} | {value} |" for key, value in report["gap_reasons"]],
        "", "## Measured Join Counts", "",
        "SQL candidate/match counts are totaled separately by statement. They aren't unique facility counts.",
        "", "| Source-chain step | Candidates | Matched | Unmatched |", "|---|---:|---:|---:|",
        *[f"| {row['step']} | {row['candidates']} | {row['matched']} | {row['unmatched']} |"
          for row in report["measured_join_counts"]],
        "", "## Runtime Failures", "",
        *([f"- {key}: {value} county runs." for key, value in sorted(report["runtime_error_types"].items())]
          or ["No runtime errors were recorded."]),
        "", "## Limits", "", *[f"- {limit}" for limit in report["limits"]],
        "", "Raw sources, county checkpoints, exact audit IDs and model receipts remain in the private filestore.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--folder", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    while True:
        report = collect(args.folder)
        print(json.dumps({key: report[key] for key in ("complete", "completed_counties", "target_counties",
                                                       "audited_chain_pass_count", "p50_seconds", "p95_seconds")}), flush=True)
        if report["complete"]:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(markdown(report), encoding="utf-8")
            private = args.folder / "source-summary.json"
            private.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            write_sidecar(private, "jdbc:zetaris:lightning@localhost:10000", "Derived measured public-source summary",
                          "python -m engines.sweep_report", report["generated_at"])
            return 0
        if not args.wait:
            return 2
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
