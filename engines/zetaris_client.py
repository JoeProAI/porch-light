"""Local licensed JDBC bridge. Credentials never enter SQL, JSON or process arguments."""

import json
import hashlib
import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
BRIDGE_LOCK = threading.Lock()


def compiled_bridge(jar: Path) -> Path:
    source = ROOT / "engines/jdbc/ZetarisQuery.java"
    identity = hashlib.sha256(source.read_bytes() + str(jar.resolve()).encode() +
                              str(jar.stat().st_mtime_ns).encode()).hexdigest()
    target = Path.home() / ".porchlight/jdbc-cache" / identity
    target.mkdir(parents=True, exist_ok=True)
    with BRIDGE_LOCK:
        if not (target / "ZetarisQuery.class").exists():
            with tempfile.TemporaryDirectory(dir=target, prefix="compile-") as temporary:
                result = subprocess.run(
                    ["javac", "-encoding", "UTF-8", "-cp", str(jar), "-d", temporary, str(source)],
                    capture_output=True, timeout=60,
                )
                if result.returncode:
                    raise RuntimeError("The licensed JDBC bridge couldn't compile; private output withheld")
                os.replace(Path(temporary) / "ZetarisQuery.class", target / "ZetarisQuery.class")
    return target


def private_settings() -> dict[str, str]:
    path = Path(os.environ.get(
        "PORCHLIGHT_ZETARIS_ENV_FILE", Path.home() / "zetaris-platform" / ".env"
    ))
    values = {}
    for line in path.read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    if not values.get("ZETARIS_ADMIN_EMAIL") or not values.get("ZETARIS_ADMIN_PASSWORD"):
        raise RuntimeError("Zetaris private credentials are unavailable")
    return values


def jdbc_query(sql: str) -> dict:
    settings = private_settings()
    jar = Path(os.environ.get(
        "PORCHLIGHT_ZETARIS_JDBC_JAR",
        Path.home() / "zetaris-platform/jdbc/ndp-jdbc-driver-2.4.3.1-7eff043-driver.jar",
    ))
    if not jar.is_file():
        raise RuntimeError("Licensed Zetaris JDBC driver jar is unavailable")
    environment = {
        **os.environ,
        "PORCHLIGHT_ZETARIS_USER": settings["ZETARIS_ADMIN_EMAIL"],
        "PORCHLIGHT_ZETARIS_PASSWORD": settings["ZETARIS_ADMIN_PASSWORD"],
    }
    try:
        result = subprocess.run(
            ["java", "--class-path", os.pathsep.join((str(compiled_bridge(jar)), str(jar))), "ZetarisQuery"],
            input=json.dumps({"sql": sql}), capture_output=True, text=True,
            encoding="utf-8", env=environment, timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Zetaris JDBC query timed out; no data fallback") from None
    lines = [line for line in result.stdout.splitlines() if line.startswith("PORCHLIGHT_RESULT:")]
    if not lines:
        raise RuntimeError("Zetaris JDBC returned no structured result; private output withheld")
    response = json.loads(lines[-1].removeprefix("PORCHLIGHT_RESULT:"))
    if result.returncode or "error_type" in response:
        message = str(response.get("message", "JDBC request failed"))
        for key in ("ZETARIS_ADMIN_PASSWORD", "POSTGRES_PASSWORD", "TELEMETRY_KEY"):
            if settings.get(key):
                message = message.replace(settings[key], "[redacted]")
        raise RuntimeError("Zetaris JDBC: " + message[:1000])
    return response


def audit_rows(correlation: str) -> list[dict]:
    if not correlation.startswith("porchlight_") or not correlation.replace("_", "").isalnum():
        raise ValueError("Invalid audit correlation marker")
    settings = private_settings()
    user = settings.get("POSTGRES_USER")
    if not user:
        raise RuntimeError("Vendor audit database account is unavailable")
    sql = (
        "SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json) FROM ("
        "SELECT a.id::text AS query_id,a.fk_sql_master_id AS query_hash,"
        "a.start_time,a.end_time,a.finish_successfully,m.sql_query "
        "FROM public.sql_audit_log a JOIN public.sql_master m "
        "ON m.query_hash=a.fk_sql_master_id "
        f"WHERE m.sql_query LIKE '%{correlation}%' ORDER BY a.id) q;"
    )
    result = subprocess.run([
        "docker", "exec", "zetaris-postgres-1", "psql", "-X", "-U", user,
        "-d", "audit", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql,
    ], capture_output=True, text=True, encoding="utf-8", timeout=20)
    if result.returncode:
        raise RuntimeError("Zetaris audit lookup failed; private output withheld")
    return json.loads(result.stdout)


def audited_query(sql: str, audit_wait_seconds: float = 20) -> dict:
    correlation = "porchlight_" + uuid4().hex
    marked_sql = f"/* {correlation} */\n" + sql.strip().rstrip(";")
    result = jdbc_query(marked_sql)
    deadline = time.monotonic() + audit_wait_seconds
    while True:
        matches = audit_rows(correlation)
        successful = [row for row in matches if row["finish_successfully"] and row["end_time"]]
        if successful:
            if len(successful) != 1:
                raise RuntimeError("Ambiguous Zetaris audit receipt; refusing query attribution")
            result["audit"] = successful[0]
            result["correlation_marker"] = correlation
            return result
        if time.monotonic() >= deadline:
            raise RuntimeError("Zetaris result has no successful audit receipt; refusing unaudited data")
        time.sleep(0.5)
