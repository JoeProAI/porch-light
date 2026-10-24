"""Audited joins across separately projected public-source relations in Zetaris."""

import hashlib
import json
import re

from engines.zetaris_client import audited_query, jdbc_query

SOURCE_VIEWS = {
    "pl_snapshot_v2": (
        "SELECT i.snapshot_hash,i.loaded_at,c.county_name,c.county_fips "
        "FROM porch_light.ingest_snapshot i JOIN porch_light.county_profile c USING(snapshot_hash) "
        "WHERE c.county_fips='12081'"
    ),
    "pl_cms_v2": (
        "SELECT snapshot_hash,county_fips,source_kind,ccn,source_artifact_path,"
        "raw_record::text AS raw_record_json,"
        "COALESCE(raw_record->>'Provider Name',raw_record->>'Facility Name') AS facility_name,"
        "raw_record->>'Telephone Number' AS source_phone,raw_record->>'ZIP Code' AS zip_code "
        "FROM porch_light.facility_source WHERE county_fips='12081'"
    ),
    "pl_geography_v2": (
        "SELECT snapshot_hash,source_kind,ccn,geography_artifact_path,"
        "geography_observation::text AS geography_evidence_json,"
        "geography_observation->>'status' AS geography_status,"
        "geography_observation->>'tract_geoid' AS tract_geoid,"
        "(geography_observation->>'address_quality_review_required')::boolean AS address_quality_review_required,"
        "public.ST_X(geom) AS longitude,public.ST_Y(geom) AS latitude "
        "FROM porch_light.facility_source WHERE county_fips='12081'"
    ),
    "pl_spatial_v2": (
        "SELECT f.snapshot_hash,f.source_kind,f.ccn,"
        "CASE WHEN f.geom IS NOT NULL THEN public.ST_Covers(w.geom,f.geom) END AS warning_covers "
        "FROM porch_light.facility_source f LEFT JOIN porch_light.county_warning_area w "
        "USING(snapshot_hash,county_fips) WHERE f.county_fips='12081'"
    ),
    "pl_svi_v2": (
        "SELECT snapshot_hash,tract_fips,source_artifact_path AS svi_source_artifact_path,"
        "raw_record::text AS svi_raw_json,"
        "CASE WHEN (raw_record->>'RPL_THEMES') ~ '^[0-9]+(\\.[0-9]+)?$' "
        "THEN CASE WHEN (raw_record->>'RPL_THEMES')::numeric BETWEEN 0 AND 1 "
        "THEN (raw_record->>'RPL_THEMES')::double precision END END AS national_svi_percentile "
        "FROM porch_light.svi_tract"
    ),
    "pl_empower_v2": (
        "SELECT snapshot_hash,county_fips,zip_code,object_id,source_artifact_path,"
        "raw_record::text AS raw_record_json,"
        "raw_record->>'Power_Dependent_Devices_DME' AS reported_zip_dme_count,"
        "raw_record->>'Medicare_Benes' AS reported_zip_medicare_beneficiaries "
        "FROM porch_light.empower_zip WHERE county_fips='12081'"
    ),
    "pl_warning_v2": "SELECT * FROM porch_light.warning_area_export WHERE county_fips='12081'",
    "pl_artifacts_v2": (
        "SELECT sa.snapshot_hash,a.artifact_path,a.sha256,a.source_url,a.fetched_at,a.license,"
        "a.metadata::text AS metadata_json FROM porch_light.source_artifact a "
        "JOIN porch_light.snapshot_artifact sa USING(artifact_path)"
    ),
}


def register_chain_views(datasource: str) -> list[dict]:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", datasource):
        raise ValueError("Unsafe datasource identifier")
    receipts = []
    for name, native_sql in SOURCE_VIEWS.items():
        try:
            jdbc_query(f"SELECT * FROM {datasource}.{name} LIMIT 0")
        except RuntimeError:
            response = audited_query(f"CREATE DATASOURCE VIEW {name} FROM {datasource} AS {native_sql}")
            receipts.append({"view": name, "audit": response["audit"]})
    return receipts


class ZetarisChainRepository:
    def __init__(self, datasource: str = "porchlight_postgis"):
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", datasource):
            raise ValueError("Unsafe datasource identifier")
        self.datasource = datasource

    def read_bundle(self) -> dict:
        source = self.datasource
        steps = []

        def execute(name: str, sql: str) -> list[dict]:
            response = audited_query(sql)
            audit = response["audit"]
            identifier = audit["query_id"]
            if not identifier.isdigit() or any(identifier == step["query_ids"][0] for step in steps):
                raise RuntimeError("Each chain statement requires a distinct successful vendor audit ID")
            steps.append({
                "name": name, "query_ids": [identifier], "row_count": len(response["rows"]),
                "audit": {**audit, "source": "Zetaris audit.public.sql_audit_log"},
            })
            return response["rows"]

        selected = execute("Select immutable Manatee source snapshot",
                           f"SELECT snapshot_hash,county_name FROM {source}.pl_snapshot_v2 ORDER BY loaded_at DESC LIMIT 1")
        if len(selected) != 1 or not re.fullmatch(r"[a-f0-9]{64}", selected[0]["snapshot_hash"]):
            raise RuntimeError("No immutable source snapshot selected")
        snapshot = selected[0]["snapshot_hash"]
        where = f"c.snapshot_hash='{snapshot}' AND c.county_fips='12081'"
        geography = execute("CMS contacts to Census geography and PostGIS warning coverage", f"""
SELECT c.*,g.geography_artifact_path,g.geography_evidence_json,g.geography_status,g.tract_geoid,
g.address_quality_review_required,g.longitude,g.latitude,w.warning_covers,
COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN g.geography_status='census_geography_returned' AND w.warning_covers=true
THEN 1 ELSE 0 END) OVER() AS matched_count
FROM {source}.pl_cms_v2 c LEFT JOIN {source}.pl_geography_v2 g
ON c.snapshot_hash=g.snapshot_hash AND c.source_kind=g.source_kind AND c.ccn=g.ccn
LEFT JOIN {source}.pl_spatial_v2 w
ON c.snapshot_hash=w.snapshot_hash AND c.source_kind=w.source_kind AND c.ccn=w.ccn
WHERE {where}""")
        svi = execute("Census tract to CDC SVI exact-key join", f"""
SELECT c.source_kind,c.ccn,s.svi_source_artifact_path,s.svi_raw_json,s.national_svi_percentile,
COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN s.national_svi_percentile IS NOT NULL THEN 1 ELSE 0 END) OVER() AS matched_count
FROM {source}.pl_cms_v2 c LEFT JOIN {source}.pl_geography_v2 g
ON c.snapshot_hash=g.snapshot_hash AND c.source_kind=g.source_kind AND c.ccn=g.ccn
LEFT JOIN {source}.pl_svi_v2 s ON g.snapshot_hash=s.snapshot_hash AND g.tract_geoid=s.tract_fips
WHERE {where}""")
        empower = execute("CMS ZIP and county to HHS emPOWER with cardinality check", f"""
WITH matched AS (
SELECT c.source_kind,c.ccn,COUNT(e.object_id) AS empower_source_row_count,
MAX(e.reported_zip_dme_count) AS reported_zip_dme_count,
MAX(e.reported_zip_medicare_beneficiaries) AS reported_zip_medicare_beneficiaries,
MAX(e.source_artifact_path) AS empower_source_artifact_path
FROM {source}.pl_cms_v2 c LEFT JOIN {source}.pl_geography_v2 g
ON c.snapshot_hash=g.snapshot_hash AND c.source_kind=g.source_kind AND c.ccn=g.ccn
LEFT JOIN {source}.pl_empower_v2 e
ON c.snapshot_hash=e.snapshot_hash AND c.zip_code=e.zip_code
AND get_json_object(g.geography_evidence_json,'$.county_geoid')=e.county_fips
WHERE {where} GROUP BY c.source_kind,c.ccn)
SELECT matched.*,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN empower_source_row_count=1 THEN 1 ELSE 0 END) OVER() AS matched_count FROM matched""")
        reference = execute("Read county ZIP reference population for deterministic percentile",
                            f"SELECT raw_record_json FROM {source}.pl_empower_v2 WHERE snapshot_hash='{snapshot}'")
        warning = execute("Read source warning union",
                          f"SELECT geometry_geojson FROM {source}.pl_warning_v2 WHERE snapshot_hash='{snapshot}'")
        artifacts = execute("Read source provenance for selected snapshot",
                            f"SELECT * FROM {source}.pl_artifacts_v2 WHERE snapshot_hash='{snapshot}'")
        if not geography or len(warning) != 1 or not artifacts or not reference:
            raise RuntimeError("Chain source relations are incomplete")
        keys = {(row["source_kind"], row["ccn"]) for row in geography}
        if len(keys) != len(geography):
            raise RuntimeError("CMS/geography join fanned out")
        for rows in (svi, empower):
            if len(rows) != len(keys) or {(row["source_kind"], row["ccn"]) for row in rows} != keys:
                raise RuntimeError("Chain join changed source cardinality or identity")
        joined = [{(r["source_kind"], r["ccn"]): r for r in rows} for rows in (svi, empower)]
        hops = []
        for data, step, from_key, to_key, method in (
            (geography, steps[1], "ccn", "nws_zone", "postgis_point_in_polygon"),
            (svi, steps[2], "tract_geoid", "tract_geoid", "exact_key"),
            (empower, steps[3], "zip", "zip", "zip_to_empower"),
        ):
            candidates, matches = int(data[0]["candidate_count"]), int(data[0]["matched_count"])
            if candidates != len(keys) or not 0 <= matches <= candidates:
                raise RuntimeError("Invalid measured SQL match counts")
            step.update({"candidate_count": candidates, "matched_count": matches})
            hops.append({"from_key": from_key, "to_key": to_key, "method": method,
                         "match_rate": matches / candidates, "query_id": step["query_ids"][0]})
        ids = [step["query_ids"][0] for step in steps]
        rows = []
        for original in geography:
            key = original["source_kind"], original["ccn"]
            row = {**original, **joined[0][key], **joined[1][key]}
            for field in ("svi_raw_json", "national_svi_percentile", "longitude", "latitude",
                          "source_phone", "warning_covers", "reported_zip_dme_count",
                          "reported_zip_medicare_beneficiaries", "svi_source_artifact_path",
                          "tract_geoid", "geography_artifact_path", "address_quality_review_required"):
                row.setdefault(field, None)
            row["raw_record"] = json.loads(row.pop("raw_record_json"))
            row["svi_raw"] = json.loads(row.pop("svi_raw_json")) if row["svi_raw_json"] else None
            row["national_svi_percentile"] = (
                float(row["national_svi_percentile"]) if row["national_svi_percentile"] is not None else None)
            for field in ("longitude", "latitude"):
                row[field] = float(row[field]) if row[field] is not None else None
            row["empower_source_row_count"] = int(row["empower_source_row_count"])
            if row["empower_source_row_count"] != 1:
                row["reported_zip_dme_count"] = row["reported_zip_medicare_beneficiaries"] = None
            row["small_count_caution"] = str(row["reported_zip_dme_count"]) == "11"
            row["county_name"] = selected[0]["county_name"]
            row["zetaris_query_ids"] = ids
            rows.append(row)
        provenance = {row["artifact_path"]: {
            **{key: row[key] for key in ("sha256", "source_url", "fetched_at", "license")},
            "metadata": json.loads(row["metadata_json"]),
        } for row in artifacts}
        final_audit = steps[-1]["audit"]
        return {
            "snapshot_hash": snapshot, "rows": rows,
            "zip_context": [json.loads(row["raw_record_json"]) for row in reference],
            "warning_geojson": warning[0]["geometry_geojson"], "artifacts": provenance,
            "join_path": hops,
            "fact_query_ids": {
                "facility_type": ids[1], "cms_star_rating": ids[1], "svi_pct": ids[2],
                "empower_dme_count": ids[3], "empower_medicare_beneficiaries": ids[3],
            },
            "read_receipt": {
                "data_access_mode": "zetaris", "executed_at": final_audit["end_time"],
                "transaction_id": "zetaris-chain:" + ":".join(ids),
                "statement_sha256": hashlib.sha256(final_audit["sql_query"].encode()).hexdigest(),
                "zetaris_query_ids": ids, "zetaris_audit": final_audit, "chain_steps": steps,
                "source_topology": "Separate public-source relations, one physical read-only PostGIS datasource",
                "spatial_execution": "PostGIS ST_Covers; relational joins declared in Zetaris SQL",
            },
        }
