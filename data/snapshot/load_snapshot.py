"""Load verified public inputs into the dedicated PostGIS database, without destructive writes."""

import argparse
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

from data.adapters.us.capture_census import replay, source_records
from data.adapters.us.capture_empower import read_snapshot
from data.adapters.us.capture_milton import county_zones
from data.adapters.us.capture_svi import read_percentiles
from data.adapters.us.counties import COUNTIES
from data.adapters.us.county_sources import CMS, EMPOWER, SVI, selected_sources, source_directories
from data.provenance.sidecar import sha256_of, verify
from data.snapshot.db import ROOT, psql, query_json


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"))


def collect(keys: tuple[str, ...]) -> tuple[str, list[dict]]:
    keys = tuple(sorted(set(keys)))
    records = []
    artifacts = []
    for directory in source_directories(keys):
        for path in sorted(directory.iterdir()):
            if not path.is_file() or path.name.endswith(".provenance.json"):
                continue
            if not verify(path):
                raise ValueError("Refusing an unverified source artifact: " + relative(path))
            sidecar = path.with_name(path.name + ".provenance.json")
            metadata = json.loads(sidecar.read_bytes())
            artifacts.append({
                "artifact_path": relative(path), "sha256": metadata["sha256"],
                "sidecar_sha256": sha256_of(sidecar),
            })
            records.append({
                "type": "artifact", "artifact_path": relative(path),
                "metadata": metadata,
            })
    wanted_tracts = set()
    facility_keys = set()
    for key in keys:
        sources = selected_sources(key)
        profile = sources.profile
        records.append({
            "type": "county", "county_fips": profile.fips,
            "county_name": profile.name, "state_code": profile.state,
            "plan_artifact_path": relative(sources.plan) if sources.plan else None,
        })
        observations = {row["ccn"]: row for row in replay(sources.census, profile)}
        for kind, row, source in source_records(CMS, profile):
            ccn = row["CMS Certification Number (CCN)"]
            if (kind, ccn) in facility_keys:
                raise ValueError("Duplicate CMS facility identifier in selected source scope")
            facility_keys.add((kind, ccn))
            observation = observations[ccn]
            point = None
            if observation["status"] == "census_geography_returned":
                wanted_tracts.add(observation["tract_geoid"])
                point = {"type": "Point", "coordinates": [observation["lon"], observation["lat"]]}
            census_path = sources.census / f"{kind}-{ccn}.json"
            if census_path.exists() and not verify(census_path):
                raise ValueError("Refusing a corrupt geography observation")
            records.append({
                "type": "facility", "county_fips": profile.fips,
                "source_kind": kind, "ccn": ccn,
                "source_artifact_path": relative(source),
                "raw_record": row, "geography_observation": observation,
                "geography_artifact_path": relative(census_path) if census_path.exists() else None,
                "geometry": point,
            })
        issuance = sources.warning / "milton_issuance.txt"
        if not verify(issuance):
            raise ValueError("Verified original warning issuance is required")
        for zone_id in county_zones(issuance.read_text(), profile):
            path = sources.warning / f"nws_zone_{zone_id}.json"
            if not verify(path):
                raise ValueError("Verified original zone geometry is required")
            document = json.loads(path.read_bytes())
            if document.get("properties", {}).get("id") != zone_id:
                raise ValueError("Zone document identity does not match its source section")
            records.append({
                "type": "zone", "county_fips": profile.fips, "zone_id": zone_id,
                "source_artifact_path": relative(path),
                "raw_record": document, "geometry": document["geometry"],
            })
    found = set()
    read_percentiles(SVI, wanted_tracts)
    with gzip.open(SVI, "rt", encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if row["FIPS"] not in wanted_tracts:
                continue
            if row["FIPS"] in found:
                raise ValueError("SVI tract join would fan out")
            found.add(row["FIPS"])
            records.append({
                "type": "svi", "tract_fips": row["FIPS"],
                "source_artifact_path": relative(SVI), "raw_record": row,
            })
    read_snapshot(EMPOWER)
    for page in sorted(EMPOWER.glob("page-*.json")):
        if page.name.endswith(".provenance.json"):
            continue
        for feature in json.loads(page.read_bytes())["features"]:
            row = feature["attributes"]
            records.append({
                "type": "empower", "object_id": row["OBJECTID"],
                "zip_code": row.get("Zip_Code_Recode"), "county_fips": row.get("FIPS_Code"),
                "source_artifact_path": relative(page), "raw_record": row,
            })
    code = [
        "data/snapshot/load_snapshot.py", "data/snapshot/schema.sql",
        "data/adapters/us/capture_census.py", "data/adapters/us/capture_milton.py",
        "data/adapters/us/capture_cms.py", "data/adapters/us/capture_svi.py",
        "data/adapters/us/capture_empower.py",
        "data/adapters/us/counties.py", "data/adapters/us/county_sources.py",
    ]
    manifest = {
        "county_keys": list(keys), "artifacts": artifacts,
        "code": {name: sha256_of(ROOT / name) for name in code},
        "scope": "selected pilot counties, not national service coverage",
    }
    snapshot = hashlib.sha256(canonical(manifest).encode()).hexdigest()
    records.append({"type": "snapshot", "snapshot_hash": snapshot, "manifest": manifest})
    return snapshot, records


def load(keys: tuple[str, ...] = tuple(COUNTIES)) -> dict:
    snapshot, records = collect(keys)
    psql((ROOT / "data/snapshot/schema.sql").read_text())
    payload = io.StringIO()
    writer = csv.writer(payload, quoting=csv.QUOTE_ALL, lineterminator="\n")
    for record in records:
        writer.writerow([canonical(record)])
    sql = "BEGIN;\nCREATE TEMP TABLE ingest_payload (data jsonb) ON COMMIT DROP;\n"
    sql += "COPY ingest_payload(data) FROM STDIN WITH (FORMAT csv);\n"
    sql += payload.getvalue() + "\\.\n"
    sql += INSERT_SQL
    sql += "\nCOMMIT;\n"
    psql(sql)
    return {
        "snapshot_hash": snapshot,
        "counties": query_json(
            "SELECT county_fips,county_name FROM porch_light.county_profile "
            f"WHERE snapshot_hash='{snapshot}' ORDER BY county_fips"
        ),
        "coverage": query_json(
            "SELECT county_fips,count(*) AS source_rows,"
            "count(*) FILTER (WHERE geom IS NOT NULL) AS geography_rows,"
            "count(*) FILTER (WHERE warning_covers) AS current_zone_covered_rows,"
            "count(*) FILTER (WHERE national_svi_percentile IS NOT NULL) AS svi_rows,"
            "count(*) FILTER (WHERE empower_source_row_count=1) AS empower_rows "
            f"FROM porch_light.facility_context WHERE snapshot_hash='{snapshot}' "
            "GROUP BY county_fips ORDER BY county_fips"
        ),
        "ranking_ready": False, "zetaris_query_performed": False,
    }


INSERT_SQL = r"""
CREATE TEMP TABLE load_identity ON COMMIT DROP AS
SELECT data->>'snapshot_hash' AS snapshot_hash, data->'manifest' AS manifest
FROM ingest_payload WHERE data->>'type'='snapshot';

DO $$
BEGIN
    IF (SELECT count(*) FROM load_identity) <> 1 THEN
        RAISE EXCEPTION 'Exactly one source snapshot identity is required';
    END IF;
    IF EXISTS (
        SELECT 1 FROM porch_light.source_artifact a
        JOIN ingest_payload p ON p.data->>'artifact_path'=a.artifact_path
        WHERE p.data->>'type'='artifact'
          AND (a.sha256 <> p.data->'metadata'->>'sha256'
               OR a.metadata IS DISTINCT FROM p.data->'metadata')
    ) THEN
        RAISE EXCEPTION 'Existing immutable source differs; refusing overwrite';
    END IF;
    IF EXISTS (
        SELECT 1 FROM porch_light.facility_source f
        JOIN load_identity i ON i.snapshot_hash=f.snapshot_hash
        JOIN ingest_payload p ON p.data->>'type'='facility'
          AND p.data->>'source_kind'=f.source_kind AND p.data->>'ccn'=f.ccn
        WHERE f.raw_record IS DISTINCT FROM p.data->'raw_record'
           OR f.geography_observation IS DISTINCT FROM p.data->'geography_observation'
    ) THEN
        RAISE EXCEPTION 'Existing immutable facility differs; refusing overwrite';
    END IF;
END $$;

INSERT INTO porch_light.source_artifact
    (artifact_path,sha256,source_url,fetched_at,license,metadata)
SELECT data->>'artifact_path',data->'metadata'->>'sha256',
       data->'metadata'->>'source_url',
       (data->'metadata'->>'fetched_at_utc')::timestamptz,
       data->'metadata'->>'license',data->'metadata'
FROM ingest_payload WHERE data->>'type'='artifact'
ON CONFLICT (artifact_path) DO NOTHING;

INSERT INTO porch_light.ingest_snapshot (snapshot_hash,manifest)
SELECT snapshot_hash,manifest FROM load_identity
ON CONFLICT (snapshot_hash) DO NOTHING;

INSERT INTO porch_light.snapshot_artifact (snapshot_hash,artifact_path)
SELECT i.snapshot_hash,p.data->>'artifact_path'
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='artifact'
ON CONFLICT DO NOTHING;

INSERT INTO porch_light.county_profile
    (snapshot_hash,county_fips,county_name,state_code,plan_artifact_path)
SELECT i.snapshot_hash,p.data->>'county_fips',p.data->>'county_name',
       p.data->>'state_code',p.data->>'plan_artifact_path'
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='county'
ON CONFLICT DO NOTHING;

INSERT INTO porch_light.facility_source
    (snapshot_hash,county_fips,source_kind,ccn,source_artifact_path,raw_record,
     geography_artifact_path,geography_observation,geom)
SELECT i.snapshot_hash,p.data->>'county_fips',p.data->>'source_kind',p.data->>'ccn',
       p.data->>'source_artifact_path',p.data->'raw_record',
       p.data->>'geography_artifact_path',p.data->'geography_observation',
       CASE WHEN p.data->'geometry' <> 'null'::jsonb
            THEN ST_SetSRID(ST_GeomFromGeoJSON((p.data->'geometry')::text),4326) END
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='facility'
ON CONFLICT DO NOTHING;

INSERT INTO porch_light.svi_tract (snapshot_hash,tract_fips,source_artifact_path,raw_record)
SELECT i.snapshot_hash,p.data->>'tract_fips',p.data->>'source_artifact_path',p.data->'raw_record'
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='svi'
ON CONFLICT DO NOTHING;

INSERT INTO porch_light.empower_zip
    (snapshot_hash,object_id,zip_code,county_fips,source_artifact_path,raw_record)
SELECT i.snapshot_hash,(p.data->>'object_id')::bigint,p.data->>'zip_code',
       p.data->>'county_fips',p.data->>'source_artifact_path',p.data->'raw_record'
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='empower'
ON CONFLICT DO NOTHING;

INSERT INTO porch_light.warning_zone
    (snapshot_hash,county_fips,zone_id,source_artifact_path,raw_record,geom)
SELECT i.snapshot_hash,p.data->>'county_fips',p.data->>'zone_id',
       p.data->>'source_artifact_path',p.data->'raw_record',
       ST_SetSRID(ST_GeomFromGeoJSON((p.data->'geometry')::text),4326)
FROM ingest_payload p CROSS JOIN load_identity i WHERE p.data->>'type'='zone'
ON CONFLICT DO NOTHING;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--county", action="append", choices=tuple(COUNTIES))
    args = parser.parse_args()
    print(json.dumps(load(tuple(args.county or COUNTIES)), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
