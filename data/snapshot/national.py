"""Append complete verified national sources to the dedicated private ingest database."""

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

from data.adapters.us.national_shapes import read_shapes
from data.provenance.sidecar import sha256_of, verify
from data.snapshot.db import psql

SCHEMA = "porch_light_national"


def copy_text(value) -> str:
    if value is None:
        return r"\N"
    return str(value).replace("\\", "\\\\").replace("\t", "\\t").replace("\r", "\\r").replace("\n", "\\n")


def copy_statement(table: str, columns: str, rows: list[list]) -> str:
    return (f"COPY {SCHEMA}.{table}({columns}) FROM STDIN;\n"
            + "\n".join("\t".join(copy_text(value) for value in row) for row in rows) + "\n\\.\n")


def load(folder: Path) -> dict:
    manifest = folder / "manifest.json"
    if not verify(manifest):
        raise ValueError("A completed national source capture is required")
    geocodes = sorted(folder.glob("census-output-*.csv"))
    if not geocodes:
        raise ValueError("Completed national Census address batches are required")
    files = [path for path in folder.iterdir() if path.is_file() and not path.name.endswith(".provenance.json")]
    if any(not verify(path) for path in files):
        raise ValueError("A national source artifact has no valid provenance")
    capture_id = hashlib.sha256("".join(sorted(sha256_of(path) for path in files)).encode()).hexdigest()
    source_rows, cms_ids = [], set()
    for kind in ("nursing_homes", "dialysis", "svi-tract", "svi-county"):
        path = folder / f"{kind}.csv"
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for raw in csv.DictReader(stream):
                key = raw.get("CMS Certification Number (CCN)", raw.get("FIPS", "")).strip()
                if not key:
                    raise ValueError("A source row has no stable source-reported identifier")
                if kind in ("nursing_homes", "dialysis"):
                    cms_ids.add(kind + ":" + key)
                source_rows.append([capture_id, kind, key, path.name, json.dumps(raw, ensure_ascii=True)])
    returned = set()
    for kind in ("census-states", "census-counties"):
        path = folder / f"{kind}.json"
        for feature in json.loads(path.read_bytes())["features"]:
            raw = feature["attributes"]
            source_rows.append([capture_id, kind, raw["GEOID"], path.name, json.dumps(raw)])
    supplemental = folder / "census-missing-county-boundaries.geojson"
    if supplemental.exists():
        for feature in json.loads(supplemental.read_bytes())["features"]:
            source_rows.append([capture_id, "census-county-boundary", feature["properties"]["GEOID"],
                                supplemental.name, json.dumps(feature)])
    for path in geocodes:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for raw in csv.reader(stream):
                if raw[0] in returned:
                    raise ValueError("Census returned duplicate source identities")
                returned.add(raw[0])
                source_rows.append([capture_id, "census", raw[0], path.name, json.dumps(raw, ensure_ascii=True)])
    if returned != cms_ids:
        raise ValueError("Census source scope does not exactly cover the national CMS records")
    for path in sorted(folder.glob("empower-0*.json")):
        if path.name.endswith(".provenance.json"):
            continue
        document = json.loads(path.read_bytes())
        for feature in document["features"]:
            raw = feature["attributes"]
            source_rows.append([capture_id, "empower", str(raw["OBJECTID"]), path.name, json.dumps(raw)])
    alerts = json.loads((folder / "active-alerts.geojson").read_bytes())
    for feature in alerts["features"]:
        source_rows.append([capture_id, "alert", feature["id"], "active-alerts.geojson", json.dumps(feature)])
    shapes = []
    for kind in ("counties", "forecast-zones"):
        path = folder / f"nws-{kind}.zip"
        for index, row in enumerate(read_shapes(path)):
            shapes.append([capture_id, kind, index, path.name, json.dumps(row["properties"]),
                           row["boundary_wkt"], row["srid"]])
    artifacts = []
    for path in files:
        metadata = json.loads(Path(str(path) + ".provenance.json").read_text())
        artifacts.append([capture_id, path.name, metadata["sha256"], metadata["source_url"],
                          metadata["fetched_at_utc"], metadata["license"]])
    sql = f"""
BEGIN;
CREATE SCHEMA IF NOT EXISTS {SCHEMA};
CREATE TABLE IF NOT EXISTS {SCHEMA}.source_row(
 capture_id text NOT NULL,source_kind text NOT NULL,record_key text NOT NULL,source_file text NOT NULL,
 raw_record jsonb NOT NULL,PRIMARY KEY(capture_id,source_kind,record_key));
CREATE TABLE IF NOT EXISTS {SCHEMA}.shape_row(
 capture_id text NOT NULL,source_kind text NOT NULL,record_key integer NOT NULL,source_file text NOT NULL,
 properties jsonb NOT NULL,boundary_wkt text NOT NULL,srid integer NOT NULL,geom geometry(Geometry,4326),
 PRIMARY KEY(capture_id,source_kind,record_key));
CREATE TABLE IF NOT EXISTS {SCHEMA}.artifact(
 capture_id text NOT NULL,source_file text NOT NULL,sha256 text NOT NULL,source_url text NOT NULL,
 fetched_at timestamptz NOT NULL,license text NOT NULL,PRIMARY KEY(capture_id,source_file));
CREATE TABLE IF NOT EXISTS {SCHEMA}.capture(
 capture_id text PRIMARY KEY,loaded_at timestamptz NOT NULL DEFAULT now(),cms_count integer NOT NULL,
 geocode_count integer NOT NULL,manifest_sha256 text NOT NULL);
"""
    sql += copy_statement("source_row", "capture_id,source_kind,record_key,source_file,raw_record", source_rows)
    sql += copy_statement("shape_row", "capture_id,source_kind,record_key,source_file,properties,boundary_wkt,srid", shapes)
    sql += copy_statement("artifact", "capture_id,source_file,sha256,source_url,fetched_at,license", artifacts)
    sql += f"""
UPDATE {SCHEMA}.shape_row SET geom=public.ST_Transform(
 public.ST_BuildArea(public.ST_GeomFromText(boundary_wkt,srid)),4326)
 WHERE capture_id='{capture_id}';
CREATE INDEX IF NOT EXISTS national_shape_geom_idx ON {SCHEMA}.shape_row USING gist(geom);
CREATE INDEX IF NOT EXISTS national_source_snapshot_idx ON {SCHEMA}.source_row(capture_id,source_kind);
CREATE TABLE IF NOT EXISTS {SCHEMA}.county(
 capture_id text NOT NULL,fips text NOT NULL,state text NOT NULL,name text NOT NULL,
 geom geometry(Geometry,4326),raw_record_count integer NOT NULL,PRIMARY KEY(capture_id,fips));
ALTER TABLE {SCHEMA}.county ADD COLUMN IF NOT EXISTS source_name text;
INSERT INTO {SCHEMA}.county
 (capture_id,fips,state,name,geom,raw_record_count)
 SELECT capture_id,properties->>'FIPS',MIN(properties->>'STATE'),MIN(properties->>'COUNTYNAME'),
 public.ST_UnaryUnion(public.ST_Collect(geom)),COUNT(*) FROM {SCHEMA}.shape_row
 WHERE capture_id='{capture_id}' AND source_kind='counties'
 AND properties->>'FIPS' ~ '^[0-9]{{5}}$' AND properties->>'FIPS'<>'00000'
 GROUP BY capture_id,properties->>'FIPS';
UPDATE {SCHEMA}.county SET source_name='nws-counties.zip' WHERE capture_id='{capture_id}';
INSERT INTO {SCHEMA}.county(capture_id,fips,state,name,geom,raw_record_count,source_name)
 SELECT r.capture_id,r.record_key,st.raw_record->>'STUSAB',r.raw_record->'properties'->>'BASENAME',
 public.ST_SetSRID(public.ST_GeomFromGeoJSON((r.raw_record->'geometry')::text),4326),1,r.source_file
 FROM {SCHEMA}.source_row r JOIN {SCHEMA}.source_row st ON r.capture_id=st.capture_id
 AND st.source_kind='census-states' AND r.raw_record->'properties'->>'STATE'=st.record_key
 WHERE r.capture_id='{capture_id}' AND r.source_kind='census-county-boundary'
 AND NOT EXISTS(SELECT 1 FROM {SCHEMA}.county k WHERE k.capture_id=r.capture_id AND k.fips=r.record_key);
CREATE INDEX IF NOT EXISTS national_county_geom_idx ON {SCHEMA}.county USING gist(geom);
CREATE TABLE IF NOT EXISTS {SCHEMA}.county_zone(
 capture_id text NOT NULL,fips text NOT NULL,ugc text NOT NULL,PRIMARY KEY(capture_id,fips,ugc));
INSERT INTO {SCHEMA}.county_zone
 SELECT DISTINCT k.capture_id,k.fips,(z.properties->>'STATE')||'Z'||(z.properties->>'ZONE')
 FROM {SCHEMA}.county k JOIN {SCHEMA}.shape_row z ON k.capture_id=z.capture_id
 AND z.source_kind='forecast-zones' AND public.ST_Intersects(k.geom,z.geom)
 AND NOT public.ST_Touches(k.geom,z.geom) WHERE k.capture_id='{capture_id}';
INSERT INTO {SCHEMA}.county_zone
 SELECT DISTINCT k.capture_id,k.fips,(z.properties->>'STATE')||'C'||RIGHT(z.properties->>'FIPS',3)
 FROM {SCHEMA}.county k JOIN {SCHEMA}.shape_row z ON k.capture_id=z.capture_id
 AND z.source_kind='counties' AND public.ST_Intersects(k.geom,z.geom)
 AND NOT public.ST_Touches(k.geom,z.geom) WHERE k.capture_id='{capture_id}';
INSERT INTO {SCHEMA}.capture(capture_id,cms_count,geocode_count,manifest_sha256)
 VALUES('{capture_id}',{len(cms_ids)},{len(returned)},'{sha256_of(manifest)}');
GRANT USAGE ON SCHEMA {SCHEMA} TO porchlight_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA {SCHEMA} TO porchlight_reader;
COMMIT;
SELECT json_build_object('capture_id','{capture_id}','cms_count',{len(cms_ids)},
 'geocode_count',{len(returned)},'county_count',(SELECT COUNT(*) FROM {SCHEMA}.county
 WHERE capture_id='{capture_id}'),'source_rows',{len(source_rows)});
"""
    output = psql(sql, timeout=1200)
    return json.loads(next(line for line in reversed(output.splitlines()) if line.startswith("{")))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--folder", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(load(args.folder)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
