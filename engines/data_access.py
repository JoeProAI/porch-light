"""Thin data boundary; direct PostGIS is explicitly development-only."""

import hashlib
import json
import os
import re
from typing import Protocol

from data.snapshot.reader import query
from engines.zetaris_client import audited_query, jdbc_query


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


def zetaris_names() -> tuple[str, str]:
    names = (
        os.environ.get("PORCHLIGHT_ZETARIS_DATASOURCE", "porchlight_postgis"),
        os.environ.get("PORCHLIGHT_ZETARIS_BUNDLE_VIEW", "porchlight_manatee_bundle_v1"),
    )
    if any(not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) for name in names):
        raise ValueError("Unsafe Zetaris datasource/view identifier")
    return names


def register_zetaris_bundle_view() -> dict:
    datasource, view = zetaris_names()
    sources = jdbc_query("SHOW DATASOURCES")["rows"]
    if not any(str(row.get("name", "")).lower() == datasource.lower() for row in sources):
        raise RuntimeError(
            f"Zetaris datasource {datasource} is not registered. Register the private "
            "read-only JDBC connection first; no password is sent in audited SQL."
        )
    native_sql = (
        "SELECT CAST(q.bundle_value AS text) AS bundle_json FROM (\n"
        + MANATEE_SQL.strip().rstrip(";") + "\n) AS q(bundle_value)"
    )
    result = audited_query(
        f"CREATE DATASOURCE VIEW {view} FROM {datasource} AS {native_sql}"
    )
    return {"datasource": datasource, "view": view, "audit": result["audit"]}


class ZetarisRepository:
    def read_bundle(self) -> dict:
        datasource, view = zetaris_names()
        statement = f"SELECT bundle_json FROM {datasource}.{view}"
        response = audited_query(statement)
        rows = response.get("rows", [])
        if len(rows) != 1 or not isinstance(rows[0].get("bundle_json"), str):
            raise RuntimeError("Zetaris did not return exactly one actual source bundle")
        result = json.loads(rows[0]["bundle_json"])
        if not result.get("snapshot_hash") or not result.get("rows"):
            raise RuntimeError("Zetaris source bundle is empty or incomplete")
        if any(row.get("county_fips") != "12081" for row in result["rows"]):
            raise RuntimeError("Selected source bundle contains another county")
        audit = response["audit"]
        query_id = audit["query_id"]
        if not isinstance(query_id, str) or not query_id or "mock" in query_id.lower():
            raise RuntimeError("Zetaris did not supply an actual audit execution ID")
        original = dict(result.get("read_receipt", {}))
        result["read_receipt"] = {
            **original,
            "data_access_mode": "zetaris",
            "executed_at": audit["end_time"],
            "statement_sha256": hashlib.sha256(audit["sql_query"].encode()).hexdigest(),
            "zetaris_query_ids": [query_id],
            "zetaris_audit": {
                "source": "Zetaris audit.public.sql_audit_log",
                "query_id": query_id, "query_hash": audit["query_hash"],
                "start_time": audit["start_time"], "end_time": audit["end_time"],
                "finish_successfully": audit["finish_successfully"],
                "sql_query": audit["sql_query"],
                "driver_version": response.get("driver_version"),
            },
            "source_postgis_read_receipt": original,
        }
        for row in result["rows"]:
            row["zetaris_query_ids"] = [query_id]
            row["zetaris_query_performed"] = True
        return result


def repository_for_mode(mode: str) -> ManateeRepository:
    if mode == "zetaris":
        return ZetarisRepository()
    if mode == "postgis_development":
        return PostgisDevelopmentRepository()
    raise ValueError("Unknown data-access mode; no implicit fallback")
