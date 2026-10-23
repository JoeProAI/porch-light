"""Local national source smoke. Prints pass/fail, timings, and gaps for five counties.

Uses engines.national_run so the check does not spend the Meterless draft budget.
The web call sheet still runs engines.national_jobs, which drafts ranked rows.
Gap phrases match web/src/lib/national-gaps.ts.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFUSAL = {
    "census_address_match_not_exact": "geocode not exact",
    "census_address_not_matched": "geocode not matched",
    "source_point_not_covered_by_current_county_geometry": "source point is outside official county geometry",
    "cms_source_marked_closed": "CMS source marks this listing closed",
    "missing_or_invalid_source_phone": "CMS phone is missing or not a dialable number",
    "missing_valid_cms_rating": "CMS rating is missing",
    "missing_or_suppressed_exact_tract_svi": "tract SVI is missing or suppressed",
    "missing_zip_context": "no emPOWER ZIP context for this county",
    "outside_selected_official_warning": "facility is outside the selected alert geometry",
    "official_warning_geometry_join_unavailable": "alert geometry join is unavailable",
}


def run_module(module: str, args: list[str], timeout: int) -> tuple[int, str, str, float]:
    started = time.perf_counter()
    completed = subprocess.run(
        [sys.executable, "-m", module, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=timeout, check=False,
    )
    return completed.returncode, completed.stdout, completed.stderr, time.perf_counter() - started


def gaps(snapshot: dict) -> list[str]:
    schema = snapshot.get("schema_version")
    if schema not in ("porch-light.national-run.v1", "porch-light.national-gap.v1"):
        return ["result is not a national sheet"]
    found = ["no county plan captured"]
    if snapshot.get("state") == "source_gap" or schema == "porch-light.national-gap.v1":
        reason = snapshot.get("reason") or "source_gap"
        found.append("official county geometry is unavailable or invalid"
                     if reason == "official_county_geometry_unavailable_or_invalid" else str(reason))
        return found
    counts = snapshot.get("counts") or {}
    if counts.get("source_rows") == 0:
        found.append("no CMS facilities in this county")
    reasons = sorted({row.get("reason") for row in snapshot.get("refused") or [] if isinstance(row, dict)})
    for reason in reasons:
        if reason:
            found.append(REFUSAL.get(str(reason), str(reason)))
    report = snapshot.get("model_report") or {}
    if report.get("unresolved_facilities") or report.get("not_attempted_budget"):
        found.append("grounding failed or was not attempted")
    return found


def county_rows(catalog: dict) -> list[dict]:
    return list((catalog.get("catalog") or {}).get("counties") or [])


def main() -> int:
    failures = 0
    try:
        code, stdout, stderr, elapsed = run_module("engines.national_jobs", ["--catalog"], 180)
    except subprocess.TimeoutExpired:
        print("FAIL catalog  timeout 180s  Zetaris unreachable on this machine")
        return 1
    if code != 0 or not stdout.strip():
        print(f"FAIL catalog  {elapsed:.1f}s  Zetaris unreachable on this machine")
        if stderr.strip():
            print("    engine error withheld from this summary; no sample counties were substituted")
        return 1
    try:
        catalog = json.loads(stdout)
    except json.JSONDecodeError:
        print("FAIL catalog  response was not JSON  no sample counties were substituted")
        return 1
    rows = county_rows(catalog)
    access = (catalog.get("catalog") or {}).get("data_access") or {}
    query_ids = access.get("zetaris_query_ids") or []
    weather = catalog.get("weather") or {}
    print(f"CATALOG  {len(rows)} counties  {elapsed:.1f}s  query {', '.join(map(str, query_ids))}  weather {weather.get('status')}")
    if len(rows) != 3235 or access.get("data_access_mode") != "zetaris" or not query_ids:
        print("FAIL catalog  expected 3235 counties and a Zetaris query id")
        failures += 1
    by_fips = {row.get("fips"): row for row in rows}
    targets = [
        ("12081", "Manatee FL"),
        ("48201", "Harris TX"),
        ("17031", "Cook IL"),
        ("48301", "Loving TX rural"),
    ]
    alert_fips = ""
    alert_label = "active alert county"
    for alert in weather.get("alerts") or []:
        mapped = [fips for fips in alert.get("county_fips") or [] if fips not in {item[0] for item in targets}]
        if mapped:
            alert_fips = mapped[0]
            alert_label = f"active alert {alert.get('event')} / {alert_fips}"
            break
    if alert_fips:
        targets.append((alert_fips, alert_label))
    else:
        print(f"FAIL active-alert county  {weather.get('message') or 'no mapped active alert in the audited feed'}")
        failures += 1

    for fips, label in targets:
        known = by_fips.get(fips)
        if not known:
            print(f"FAIL  {fips} {label}  not in the Census catalog  no substitute county was run")
            failures += 1
            continue
        try:
            code, stdout, stderr, elapsed = run_module("engines.national_run", ["--county", fips], 240)
        except subprocess.TimeoutExpired:
            print(f"FAIL  {fips} {label}  timeout 240s")
            failures += 1
            continue
        if code != 0 or not stdout.strip():
            print(f"FAIL  {fips} {label}  {elapsed:.1f}s  Zetaris unreachable on this machine")
            failures += 1
            continue
        try:
            snapshot = json.loads(stdout)
        except json.JSONDecodeError:
            print(f"FAIL  {fips} {label}  {elapsed:.1f}s  response was not JSON")
            failures += 1
            continue
        schema = snapshot.get("schema_version")
        ids = (snapshot.get("data_access") or {}).get("zetaris_query_ids") or []
        returned = (snapshot.get("county") or {}).get("fips")
        mode = (snapshot.get("data_access") or {}).get("data_access_mode")
        ok = (
            schema in ("porch-light.national-run.v1", "porch-light.national-gap.v1")
            and schema != "porch-light.manatee-development-snapshot.v1"
            and returned == fips
            and mode == "zetaris"
            and ids
            and all(str(item).isdigit() for item in ids)
        )
        rendered = "; ".join(gaps(snapshot))
        runtime = (snapshot.get("national") or {}).get("runtime_seconds", snapshot.get("runtime_seconds"))
        status = "PASS" if ok else "FAIL"
        if not ok:
            failures += 1
        print(f"{status}  {fips} {known.get('name')} {known.get('state')}  wall {elapsed:.1f}s  runtime {runtime}  {rendered}")
        print(f"    query {', '.join(map(str, ids))}")
    print("DONE" if failures == 0 else f"DONE  {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(1)
