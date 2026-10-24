"""County-selectable real-source preflight, not an application API or a rank."""

import argparse
import json
from collections import Counter

from data.adapters.us.capture_census import replay, source_name, source_records
from data.adapters.us.capture_empower import zip_context
from data.adapters.us.capture_svi import read_percentiles
from data.adapters.us.counties import COUNTIES
from data.adapters.us.county_sources import CMS, EMPOWER, ROOT, SVI, selected_sources
from data.provenance.sidecar import sha256_of, verify


def report_for_county(key: str) -> dict:
    sources = selected_sources(key)
    profile = sources.profile
    geography = {row["ccn"]: row for row in replay(sources.census, profile)}
    tract_ids = {
        row["tract_geoid"] for row in geography.values()
        if row["status"] == "census_geography_returned"
    }
    svi = read_percentiles(SVI, tract_ids)
    facilities = []
    for kind, row, source in source_records(CMS, profile):
        ccn = row["CMS Certification Number (CCN)"]
        geo = geography[ccn]
        item = {
            "ccn": ccn, "source_kind": kind, "name": source_name(kind, row),
            "source_phone": row["Telephone Number"],
            "cms_source_sha256": sha256_of(source), "geography": geo,
        }
        if geo["status"] == "census_geography_returned":
            item["svi"] = svi[geo["tract_geoid"]]
            item["empower"] = zip_context(EMPOWER, row["ZIP Code"], geo["county_geoid"])
        facilities.append(item)
    plan = {"status": "unavailable_no_county_plan_capture"}
    if sources.plan is not None:
        if not verify(sources.plan):
            raise ValueError("The selected county plan must have verified provenance")
        plan = {
            "status": "archived_unverified_applicability",
            "artifact": str(sources.plan.relative_to(ROOT)),
            "sha256": sha256_of(sources.plan),
            "plan_year": sources.plan_year, "adoption_record_year": sources.adoption_year,
            "current_or_2024_applicability_verified": False,
            "nemotron_parse_performed": False,
        }
    return {
        "stage": "ingestion_preflight_only",
        "county": profile.name, "county_fips": profile.fips,
        "scenario": "retrospective Milton",
        "source_facility_rows": len(facilities),
        "geography_status_counts": dict(Counter(row["geography"]["status"] for row in facilities)),
        "unique_census_tracts": len(tract_ids),
        "svi_status_counts": dict(Counter(row["svi"]["status"] for row in facilities if "svi" in row)),
        "empower_status_counts": dict(Counter(row["empower"]["status"] for row in facilities if "empower" in row)),
        "archived_county_plan": plan,
        "zetaris_query_performed": False, "ranking_ready": False,
        "empower_counts_may_repeat_for_shared_zips_do_not_sum_per_facility": True,
        "operator_geocode_quality_review_required": True,
        "facilities": facilities,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--county", choices=tuple(COUNTIES), required=True)
    args = parser.parse_args()
    print(json.dumps(report_for_county(args.county), indent=2))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
