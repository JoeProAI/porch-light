"""Provision/test the private read-only JDBC role without password command arguments."""

import json
import secrets
import subprocess
from pathlib import Path

from data.snapshot.db import CONTAINER, private_database_settings, psql, verify_container

ROLE = "porchlight_zetaris_read"
ENV_FILE = Path.home() / ".porchlight" / "postgis-read.env"


def settings() -> dict[str, str]:
    values = dict(
        line.split("=", 1) for line in ENV_FILE.read_text().splitlines()
        if line and not line.startswith("#")
    )
    if (
        values.get("POSTGRES_USER") != ROLE
        or values.get("POSTGRES_DB") != "porchlight"
        or not values.get("POSTGRES_PASSWORD")
    ):
        raise ValueError("Private read-only database settings are incomplete; values withheld")
    return values


def query(sql: str) -> str:
    verify_container()
    values = settings()
    result = subprocess.run([
        "docker", "exec", "-i", CONTAINER, "psql", "-X",
        "-h", "127.0.0.1", "-U", ROLE, "-d", values["POSTGRES_DB"], "-W",
        "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql,
    ], input=values["POSTGRES_PASSWORD"] + "\n",
        capture_output=True, text=True, encoding="utf-8", timeout=30)
    if result.returncode:
        raise RuntimeError("Read-only database verification failed; output withheld")
    return result.stdout.strip()


def provision() -> dict:
    if not ENV_FILE.parent.is_dir():
        raise ValueError("Restricted private credential directory is missing")
    if not ENV_FILE.exists():
        with ENV_FILE.open("x", encoding="ascii") as output:
            output.write(
                "POSTGRES_DB=porchlight\nPOSTGRES_USER=" + ROLE
                + "\nPOSTGRES_PASSWORD=" + secrets.token_urlsafe(48) + "\n"
            )
    values = settings()
    psql("""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='porchlight_zetaris_read') THEN
        CREATE ROLE porchlight_zetaris_read LOGIN;
    END IF;
END $$;
GRANT porchlight_reader TO porchlight_zetaris_read;
ALTER ROLE porchlight_zetaris_read SET default_transaction_read_only=on;
""")
    admin = private_database_settings()
    result = subprocess.run([
        "docker", "exec", "-i", CONTAINER, "psql", "-X",
        "-U", admin["POSTGRES_USER"], "-d", admin["POSTGRES_DB"],
        "-v", "ON_ERROR_STOP=1",
        "-c", "SET log_statement=none; SET log_min_error_statement=panic; SET log_error_verbosity=terse;",
        "-c", "\\password " + ROLE,
    ], input=(values["POSTGRES_PASSWORD"] + "\n") * 2,
        capture_output=True, text=True, encoding="utf-8", timeout=30)
    if result.returncode:
        raise RuntimeError("Read-only credential provisioning failed; all output withheld")
    proof = query("""
SELECT json_build_object(
    'role',current_user,
    'default_transaction_read_only',current_setting('default_transaction_read_only'),
    'can_select',has_table_privilege(current_user,'porch_light.facility_source','SELECT'),
    'can_insert',has_table_privilege(current_user,'porch_light.facility_source','INSERT'),
    'can_update',has_table_privilege(current_user,'porch_light.facility_source','UPDATE'),
    'can_delete',has_table_privilege(current_user,'porch_light.facility_source','DELETE')
);
""")
    result = json.loads(proof)
    if (
        result.get("default_transaction_read_only") != "on"
        or result.get("can_select") is not True
        or any(result.get(key) is not False for key in ("can_insert", "can_update", "can_delete"))
    ):
        raise RuntimeError("The database role is not restricted to the expected read privileges")
    return result


if __name__ == "__main__":
    print(json.dumps(provision(), indent=2))
