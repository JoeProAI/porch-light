"""Thin data boundary; direct PostGIS is explicitly development-only."""

import hashlib
import json
from typing import Protocol

from data.snapshot.reader import query


class ManateeRepository(Protocol):
    def read_bundle(self) -> dict: ...


MANATEE_SQL = """
WITH chosen AS (
    SELECT i.snapshot_hash
    FROM porch_light.ingest_snapshot i
    JOIN porch_light.county_profile c USING(snapshot_hash)
    WHERE c.county_fips='12081'
    ORDER BY i.loaded_at DESC LIMIT 1
), facilities AS (
    SELECT x.*,f.raw_record,s.source_artifact_path AS svi_source_artifact_path,
           s.raw_record AS svi_raw
    FROM porch_light.facility_export x
    JOIN porch_light.facility_source f USING(snapshot_hash,source_kind,ccn)
    LEFT JOIN porch_light.svi_tract s
      ON s.snapshot_hash=x.snapshot_hash AND s.tract_fips=x.tract_geoid
    JOIN chosen c ON c.snapshot_hash=x.snapshot_hash
    WHERE x.county_fips='12081'
), artifacts AS (
    SELECT a.* FROM porch_light.source_artifact a
    JOIN porch_light.snapshot_artifact sa USING(artifact_path)
    JOIN chosen USING(snapshot_hash)
), receipt AS (
    SELECT clock_timestamp() AS executed_at,pg_backend_pid() AS backend_pid,
           txid_current()::text AS transaction_id,current_user AS database_role
)
SELECT json_build_object(
    'snapshot_hash',(SELECT snapshot_hash FROM chosen),
    'rows',(SELECT json_agg(f ORDER BY f.ccn) FROM facilities f),
    'zip_context',(SELECT json_agg(e.raw_record) FROM porch_light.empower_zip e
                   JOIN chosen USING(snapshot_hash) WHERE e.county_fips='12081'),
    'warning_geojson',(SELECT geometry_geojson FROM porch_light.warning_area_export
                       JOIN chosen USING(snapshot_hash) WHERE county_fips='12081'),
    'artifacts',(SELECT json_object_agg(artifact_path,json_build_object(
        'sha256',sha256,'source_url',source_url,'fetched_at',fetched_at,
        'license',license,'metadata',metadata)) FROM artifacts),
    'read_receipt',(SELECT row_to_json(receipt) FROM receipt)
);
"""


class PostgisDevelopmentRepository:
    def read_bundle(self) -> dict:
        result = json.loads(query(MANATEE_SQL))
        if not result.get("snapshot_hash") or not result.get("rows"):
            raise RuntimeError("No real loaded Manatee snapshot is available")
        result["read_receipt"].update({
            "data_access_mode": "postgis_development",
            "statement_sha256": hashlib.sha256(MANATEE_SQL.encode()).hexdigest(),
            "zetaris_query_ids": [],
        })
        return result
