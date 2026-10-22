"""Administrative SQL for the dedicated local ingest database, never an app read path."""

import json
import os
import subprocess
from pathlib import Path

CONTAINER = "porchlight-postgis"
ROOT = Path(__file__).resolve().parents[2]


def private_database_settings() -> dict[str, str]:
    path = Path(os.environ.get(
        "PORCHLIGHT_POSTGIS_ENV_FILE", Path.home() / ".porchlight" / "postgis.env"
    ))
    values = dict(
        line.split("=", 1) for line in path.read_text().splitlines()
        if line and not line.startswith("#")
    )
    if values.get("POSTGRES_DB") != "porchlight" or values.get("POSTGRES_USER") != "porchlight_admin":
        raise ValueError("Refusing an unexpected database target; private values withheld")
    return values


def verify_container() -> None:
    result = subprocess.run(
        ["docker", "inspect", "--format", "{{json .Config.Labels}}", CONTAINER],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode:
        raise RuntimeError("The dedicated PostGIS container is unavailable")
    labels = json.loads(result.stdout)
    if labels.get("com.docker.compose.project") != "porchlight-data":
        raise RuntimeError("Refusing a container not owned by this project's data stack")


def psql(sql: str, timeout: int = 120) -> str:
    verify_container()
    settings = private_database_settings()
    result = subprocess.run([
        "docker", "exec", "-i", CONTAINER, "psql", "-X",
        "-U", settings["POSTGRES_USER"], "-d", settings["POSTGRES_DB"],
        "-v", "ON_ERROR_STOP=1", "-A", "-t",
    ], input=sql, capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    if result.returncode:
        raise RuntimeError("PostGIS ingest SQL failed: " + result.stderr[-1200:])
    return result.stdout.strip()


def query_json(sql: str):
    output = psql(
        "SELECT COALESCE(json_agg(result), '[]'::json) FROM (" + sql.rstrip(";") + ") result;"
    )
    return json.loads(output)
