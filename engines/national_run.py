"""Run an auditable county call sheet over complete national source relations."""

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from engines.national_sources import DB
from engines.zetaris_client import audited_query

POLICY_PATH = Path(__file__).resolve().parents[1] / "data/scoring/national_weights.json"
POLICY = json.loads(POLICY_PATH.read_text())
WEIGHTS_PATH = POLICY_PATH.with_name("weights.yaml")
CANONICAL = json.loads(next(line.split(":", 1)[1] for line in WEIGHTS_PATH.read_text().splitlines()
                           if line.startswith("national_source_screen:")))
if CANONICAL["version"] != POLICY["version"] or CANONICAL["terms"] != POLICY["weights"]:
    raise RuntimeError("National policy differs from the fixed canonical weights.yaml formula")


def refusal(row: dict) -> str | None:
    if row.get("source_marked_closed"):
        return "cms_source_marked_closed"
    if not row.get("facility_name"):
        return "missing_source_facility_name"
    if row.get("match_status") != "Match":
        return "census_address_not_matched"
    if row.get("match_type") != "Exact":
        return "census_address_match_not_exact"
    if row.get("county_covers") is not True:
        return "source_point_not_covered_by_current_county_geometry"
    phone = re.sub(r"\D", "", row.get("source_phone") or "")
    if not (len(phone) == 10 or len(phone) == 11 and phone.startswith("1")):
        return "missing_or_invalid_source_phone"
    if row.get("cms_stars") is None:
        return "missing_valid_cms_rating"
    if row.get("svi_pct") is None:
        return "missing_or_suppressed_exact_tract_svi"
    if row.get("empower_source_row_count") is None:
        return "missing_measured_zip_cardinality"
    if int(row["empower_source_row_count"]) != 1:
        return "missing_zip_context" if int(row["empower_source_row_count"]) == 0 else "zip_context_fanout"
    if row.get("dme_count") is None or row.get("medicare_beneficiaries") is None:
        return "missing_published_zip_counts"
    if int(row["dme_count"]) == 11:
        return "ambiguous_or_masked_source_count_11"
    if int(row["medicare_beneficiaries"]) <= 0 or not 0 <= int(row["dme_count"]) <= int(row["medicare_beneficiaries"]):
        return "invalid_published_zip_ratio"
    if row.get("density_pct") is None:
        return "eligible_county_zip_reference_unavailable"
    return None


def facility(row: dict, county: dict, provenance: dict, receipt: dict) -> dict:
    ids = receipt["zetaris_query_ids"]
    inputs = {
        "type_weight": Decimal(POLICY["type_inputs"][row["source_kind"]]),
        "svi_pct": Decimal(str(row["svi_pct"])),
        "empower_density_pct": Decimal(str(row["density_pct"])),
        "cms_risk": (Decimal(5) - Decimal(str(row["cms_stars"]))) / Decimal(4),
    }
    if any(not value.is_finite() or not 0 <= value <= 1 for value in inputs.values()):
        raise RuntimeError("National normalized source or policy input is outside range")
    terms = [{"name": key, "input": float(value), "weight": float(POLICY["weights"][key]),
              "weighted": float(value * Decimal(POLICY["weights"][key]))} for key, value in inputs.items()]
    total = sum(value * Decimal(POLICY["weights"][key]) for key, value in inputs.items())
    sources, dates = [], []
    for name, file in (
        ("CMS " + row["source_kind"], row["source_file"]),
        ("CDC/ATSDR 2022 nationally ranked tract SVI", row["svi_source_file"]),
        ("HHS emPOWER published ZIP aggregate", row["empower_source_file"]),
        ("US Census exact address geography", row["census_source_file"]),
    ):
        if file not in provenance:
            raise RuntimeError("A joined fact has no immutable source provenance")
        source = provenance[file]
        sources.append({"name": name, "url": source["source_url"], "license": source["license"]})
        dates.append({"source": name, "fetched_at": source["fetched_at"], "snapshot_id": row["capture_id"],
                      "stale": name.startswith("CDC/ATSDR")})
    cms = provenance[row["source_file"]]
    kind = "nursing_home" if row["source_kind"] == "nursing_homes" else "dialysis"
    facts = [{"name": name, "value": value, "query_id": query} for name, value, query in (
        ("facility_type", kind, ids[1]), ("cms_star_rating", float(row["cms_stars"]), ids[1]),
        ("source_phone", row["source_phone"], ids[1]), ("svi_pct", float(row["svi_pct"]), ids[2]),
        ("empower_dme_count", int(row["dme_count"]), ids[3]),
        ("empower_medicare_beneficiaries", int(row["medicare_beneficiaries"]), ids[3]),
        ("eligible_county_zip_percentile", float(row["density_pct"]), ids[4]),
    )]
    hops = []
    for step, from_key, to_key, method in (
        (receipt["chain_steps"][1], "ccn", "fips", "postgis_point_in_polygon"),
        (receipt["chain_steps"][2], "tract_geoid", "tract_geoid", "exact_key"),
        (receipt["chain_steps"][3], "zip", "zip", "zip_to_empower"),
    ):
        hops.append({"from_key": from_key, "to_key": to_key, "method": method,
                     "query_id": step["query_ids"][0],
                     "match_rate": step["matched_count"] / step["candidate_count"]})
    score = {"total": float(total), "terms": terms, "formula_version": POLICY["version"],
             "tie_break": POLICY["tie_break"], "rank": 0}
    return {
        "id": "us:ccn:" + row["ccn"], "ccn": row["ccn"], "country": "us",
        "key": {"type": "ccn", "value": row["ccn"]}, "county_key": {"type": "fips", "value": county["fips"]},
        "name": row["facility_name"], "type": kind,
        "lat": float(row["latitude"]), "lon": float(row["longitude"]),
        "address": row.get("address") or "", "zip": row["zip_code"],
        "phone": {"status": "available", "value": row["source_phone"], "source": sources[0],
                  "source_record_key": row["ccn"]},
        "score": score, "rank": 0, "development_only": False,
        "context": {"cms_stars": float(row["cms_stars"]), "national_svi_percentile": float(row["svi_pct"]),
                    "source_reported_zip_dme": int(row["dme_count"]),
                    "source_reported_zip_medicare_beneficiaries": int(row["medicare_beneficiaries"]),
                    "county_zip_reference_rows": int(row["reference_rows"]), "small_count_caution": False},
        "computed_reason": (f"Source tract SVI {row['svi_pct']}; CMS stars {row['cms_stars']}; "
                            f"published ZIP DME {row['dme_count']}/{row['medicare_beneficiaries']}. "
                            "ZIP context is not a facility patient count."),
        "evidence": {
            "zetaris_query_ids": ids, "sources": sources, "data_as_of": dates, "facts": facts,
            "join_path": hops, "failed_joins": [], "score": score,
            "dq_results": [
                {"rule": "exact_census_address_match", "passed": True},
                {"rule": "official_county_geometry_covers_source_point", "passed": True},
                {"rule": "unique_unmasked_zip_context", "passed": True},
                {"rule": "current_operating_status_verified", "passed": False},
                {"rule": "emergency_contact_verified", "passed": False},
                {"rule": "county_plan_context_used", "passed": False},
            ],
            "source_artifact_path": row["source_file"], "source_sha256": cms["sha256"],
            "geography_artifact_path": row["census_source_file"], "svi_artifact_path": row["svi_source_file"],
            "geography": json.dumps({"coordinate_source": "US Census batch geographies",
                                     "address_match_quality": row["match_type"], "county_geoid": row["county_fips"],
                                     "tract_geoid": row["tract_geoid"], "source_record": json.loads(row["geography_evidence_json"])}),
            "operator_geocode_review_required": True, "model_explanation": None,
        },
    }


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


class Chain:
    def __init__(self):
        self.steps = []

    def read(self, name: str, sql: str) -> list[dict]:
        result = audited_query(sql)
        audit = result["audit"]
        identifier = audit["query_id"]
        if not identifier.isdigit() or any(identifier in step["query_ids"] for step in self.steps):
            raise RuntimeError("Source statements need distinct real vendor audit IDs")
        self.steps.append({"name": name, "query_ids": [identifier], "row_count": len(result["rows"]),
                           "audit": {**audit, "source": "Zetaris audit.public.sql_audit_log"}})
        return result["rows"]

    def measured(self, name: str, sql: str) -> list[dict]:
        rows = self.read(name, sql)
        candidates = int(rows[0]["candidate_count"]) if rows else 0
        matches = int(rows[0]["matched_count"]) if rows else 0
        if candidates != len(rows) or not 0 <= matches <= candidates:
            raise RuntimeError("Measured SQL cardinality or match counts are inconsistent")
        self.steps[-1].update({"candidate_count": candidates, "matched_count": matches})
        return rows

    def receipt(self) -> dict:
        last = self.steps[-1]["audit"]
        return {
            "data_access_mode": "zetaris", "executed_at": last["end_time"],
            "statement_sha256": hashlib.sha256(last["sql_query"].encode()).hexdigest(),
            "transaction_id": "zetaris-national-chain",
            "zetaris_query_ids": [step["query_ids"][0] for step in self.steps],
            "zetaris_audit": last, "chain_steps": self.steps,
            "source_topology": "Separate national public-source relations in one read-only PostGIS datasource",
        }


def county_catalog() -> dict:
    chain = Chain()
    rows = chain.read("Read complete loaded NWS county catalog", f"""
SELECT k.fips,k.name,k.state,k.geometry_valid,k.capture_id,n.cms_count,n.geocode_count,n.loaded_at
FROM {DB}.pl_nat_county_catalog_v3 k JOIN {DB}.pl_nat_capture_v1 n ON k.capture_id=n.capture_id
WHERE n.capture_id=(SELECT capture_id FROM {DB}.pl_nat_capture_v1 ORDER BY loaded_at DESC LIMIT 1)
ORDER BY k.state,k.name""")
    if not rows:
        raise RuntimeError("National source capture is not loaded and registered")
    return {"counties": rows, "data_access": chain.receipt(), "policy": POLICY}


def scoped_sql(capture: str, fips: str, state: str, name: str) -> str:
    return f"""
FROM {DB}.pl_nat_cms_v1 c LEFT JOIN {DB}.pl_nat_census_v1 g
ON c.capture_id=g.capture_id AND c.source_kind=g.source_kind AND c.ccn=g.ccn
WHERE c.capture_id={literal(capture)} AND (
g.county_fips={literal(fips)} OR (g.county_fips IS NULL AND c.state={literal(state)}
AND regexp_replace(lower(c.county_name),'[^a-z0-9]','')=
regexp_replace(lower({literal(name)}),'[^a-z0-9]','')))
"""


def run_county(fips: str, capture_id: str | None = None) -> dict:
    if not re.fullmatch(r"\d{5}", fips):
        raise ValueError("A five-digit source county FIPS is required")
    if capture_id is not None and not re.fullmatch(r"[a-f0-9]{64}", capture_id):
        raise ValueError("Invalid frozen source capture")
    started, chain = time.monotonic(), Chain()
    selected = chain.read("Select immutable national capture and actual county geometry", f"""
SELECT k.*,n.cms_count,n.geocode_count,n.loaded_at,n.manifest_sha256
FROM {DB}.pl_nat_county_catalog_v3 k JOIN {DB}.pl_nat_capture_v1 n ON k.capture_id=n.capture_id
WHERE k.fips='{fips}' {f"AND n.capture_id='{capture_id}'" if capture_id else ""}
ORDER BY n.loaded_at DESC LIMIT 1""")
    if len(selected) != 1:
        raise ValueError("County is absent from the official source catalog")
    if not selected[0].get("geometry_valid") or not selected[0].get("geometry_geojson"):
        return {"schema_version": "porch-light.national-gap.v1", "state": "source_gap",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "county": {"fips": fips, "name": selected[0]["name"], "state": selected[0]["state"]},
                "reason": "official_county_geometry_unavailable_or_invalid", "counts": None,
                "facilities": [], "refused": [], "data_access": chain.receipt(),
                "source_snapshot_hash": selected[0]["capture_id"],
                "runtime_seconds": round(time.monotonic() - started, 3)}
    county, capture = selected[0], selected[0]["capture_id"]
    if not re.fullmatch(r"[a-f0-9]{64}", capture):
        raise RuntimeError("Invalid immutable national capture identity")
    scope = scoped_sql(capture, fips, county["state"], county["name"])
    base = f"""SELECT c.*,g.match_status,g.match_type,g.county_fips,g.tract_geoid,
g.longitude,g.latitude,g.geography_evidence_json,g.source_file AS census_source_file {scope}"""
    candidates = chain.measured("CMS contacts to exact Census addresses and official county coverage", f"""
WITH scoped AS ({base})
SELECT s.*,p.county_covers,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN s.match_status='Match' AND s.match_type='Exact' AND p.county_covers=true
THEN 1 ELSE 0 END) OVER() AS matched_count
FROM scoped s LEFT JOIN {DB}.pl_nat_spatial_v2 p
ON s.capture_id=p.capture_id AND s.source_kind=p.source_kind AND s.ccn=p.ccn
AND p.county_fips='{fips}'""")
    svi = chain.measured("Exact Census tract GEOID to national CDC SVI", f"""
WITH scoped AS ({base})
SELECT s.source_kind,s.ccn,v.svi_pct,v.source_file AS svi_source_file,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN v.svi_pct IS NOT NULL THEN 1 ELSE 0 END) OVER() AS matched_count
FROM scoped s LEFT JOIN {DB}.pl_nat_svi_v1 v
ON s.capture_id=v.capture_id AND s.tract_geoid=v.tract_geoid""")
    empower = chain.measured("CMS ZIP and Census county to HHS emPOWER, with fanout counted", f"""
WITH scoped AS ({base}), matched AS (
SELECT s.source_kind,s.ccn,COUNT(e.record_key) AS empower_source_row_count,
MAX(e.dme_count) AS dme_count,MAX(e.medicare_beneficiaries) AS medicare_beneficiaries,
MAX(e.source_file) AS empower_source_file
FROM scoped s LEFT JOIN {DB}.pl_nat_empower_v1 e
ON s.capture_id=e.capture_id AND s.zip_code=e.zip_code AND s.county_fips=e.county_fips
GROUP BY s.source_kind,s.ccn)
SELECT matched.*,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN empower_source_row_count=1 THEN 1 ELSE 0 END) OVER() AS matched_count FROM matched""")
    reference = chain.measured("Join only unique, unmasked county ZIP ratio reference rows", f"""
WITH scoped AS ({base})
SELECT s.source_kind,s.ccn,r.density_pct,r.reference_rows,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN r.density_pct IS NOT NULL THEN 1 ELSE 0 END) OVER() AS matched_count
FROM scoped s LEFT JOIN {DB}.pl_nat_zip_reference_v2 r
ON s.capture_id=r.capture_id AND s.zip_code=r.zip_code AND s.county_fips=r.county_fips""")
    artifacts = chain.read("Read immutable national source provenance", f"""
SELECT source_file,sha256,source_url,fetched_at,license
FROM {DB}.pl_nat_artifact_v1 WHERE capture_id={literal(capture)}""")
    unassigned = chain.read("Measure national source addresses without a returned county", f"""
SELECT c.source_kind,COALESCE(g.match_status,'missing_geocode') AS match_status,COUNT(*) AS source_rows
FROM {DB}.pl_nat_cms_v1 c LEFT JOIN {DB}.pl_nat_census_v1 g
ON c.capture_id=g.capture_id AND c.source_kind=g.source_kind AND c.ccn=g.ccn
WHERE c.capture_id={literal(capture)} AND g.county_fips IS NULL
GROUP BY c.source_kind,COALESCE(g.match_status,'missing_geocode')""")
    keys = {(row["source_kind"], row["ccn"]) for row in candidates}
    maps = []
    if len(keys) != len(candidates):
        raise RuntimeError("Candidate source join fanned out")
    for rows in (svi, empower, reference):
        if len(rows) != len(keys) or {(row["source_kind"], row["ccn"]) for row in rows} != keys:
            raise RuntimeError("A source join changed facility identity or cardinality")
        maps.append({(row["source_kind"], row["ccn"]): row for row in rows})
    provenance = {row["source_file"]: row for row in artifacts}
    receipt = chain.receipt()
    ranked, refused = [], []
    for candidate in candidates:
        key = candidate["source_kind"], candidate["ccn"]
        row = {**candidate, **maps[0][key], **maps[1][key], **maps[2][key]}
        failure = refusal(row)
        if failure:
            refused.append({"ccn": row["ccn"], "name": row["facility_name"], "reason": failure,
                            "source_kind": row["source_kind"], "query_ids": receipt["zetaris_query_ids"]})
        else:
            ranked.append(facility(row, county, provenance, receipt))
    ranked.sort(key=lambda row: (-row["score"]["total"], row["type"], row["ccn"]))
    for index, row in enumerate(ranked, 1):
        row["rank"] = row["score"]["rank"] = index
        row["evidence"]["score"] = row["score"]
    geometry = json.loads(county["geometry_geojson"])
    if geometry["type"] == "Polygon":
        geometry = {"type": "MultiPolygon", "coordinates": [geometry["coordinates"]]}
    return {
        "schema_version": "porch-light.national-run.v1", "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_snapshot_hash": capture,
        "county": {"name": county["name"], "fips": fips, "state": county["state"]},
        "scenario": {"event": "County source discovery", "mode": "county_discovery",
                     "warning_year": datetime.fromisoformat(str(county["loaded_at"]).replace("Z", "+00:00")).year,
                     "zone_geometry_vintage": county["geometry_source"],
                     "historical_2024_boundary_equivalence_verified": False},
        "warning_geometry": geometry, "data_access": receipt,
        "counts": {"source_rows": len(candidates), "ranked_rows": len(ranked), "refused_rows": len(refused)},
        "facilities": ranked, "refused": refused, "model_executions": [],
        "policy": {"version": POLICY["version"], "clinical_validation": False, "plan_year": None,
                   "plan_flag": POLICY["plan_context"], "empower_density_pct": POLICY["empower_density_pct"],
                   "cms_risk": POLICY["cms_risk"], "plan_artifact": None, "plan_sha256": None,
                   "plan_current_applicability_verified": False,
                   "national_weights_sha256": hashlib.sha256(WEIGHTS_PATH.read_bytes()).hexdigest()},
        "national": {"cms_source_rows": int(county["cms_count"]), "geocode_source_rows": int(county["geocode_count"]),
                     "unassigned_by_source": unassigned, "runtime_seconds": round(time.monotonic() - started, 3)},
        "limits": [
            "Source-based prototype, not clinical prioritization or verified facility operating status.",
            "County discovery does not assert that every facility is inside a particular warning polygon.",
            "Exact Census address matching and source county coverage are required; all other matches are refused.",
            "2022 tract SVI is historical demographic context. CMS phones are directory numbers, not verified emergency contacts.",
            "Missing, ambiguous, masked or unrated data never gets a guessed value.",
            "The national policy omits county plans; it never imports Manatee's archived plan or substitutes zero.",
            "A zero-row result means no matching records in these sources, not proof that a county has no care facilities.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--catalog", action="store_true")
    choice.add_argument("--county")
    args = parser.parse_args()
    try:
        result = county_catalog() if args.catalog else run_county(args.county)
        print(json.dumps(result, ensure_ascii=True))
    except (RuntimeError, ValueError, KeyError) as error:
        print(json.dumps({"error": "National run failed closed. No sample or data fallback.",
                          "error_type": type(error).__name__, "detail": str(error)[:500]}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
