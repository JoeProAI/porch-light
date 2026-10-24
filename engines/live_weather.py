"""Read the real weather filestore publication only through audited Zetaris SQL."""

import argparse
import hashlib
import json
import re

from engines.zetaris_client import audited_query

VIEW = "porchlight_postgis.porchlight_live_weather_v1"
STATEMENT = f"SELECT payload_json FROM {VIEW}"


def register_view() -> dict:
    response = audited_query(
        "CREATE DATASOURCE VIEW porchlight_live_weather_v1 FROM porchlight_postgis AS "
        "SELECT payload_json FROM porch_light.live_weather_capture "
        "ORDER BY captured_at DESC LIMIT 1"
    )
    assets = audited_query(
        "CREATE DATASOURCE VIEW porchlight_weather_captures_v1 FROM porchlight_postgis AS "
        "SELECT capture_id,payload_json FROM porch_light.live_weather_capture"
    )
    return {"view": VIEW, "setup_audit": response["audit"], "asset_setup_audit": assets["audit"]}


def read_live_weather(capture_id: str | None = None) -> dict:
    if capture_id is not None and not re.fullmatch(r"[a-f0-9]{64}", capture_id):
        raise ValueError("Invalid immutable capture reference")
    statement = STATEMENT if capture_id is None else (
        "SELECT payload_json FROM porchlight_postgis.porchlight_weather_captures_v1 "
        f"WHERE capture_id='{capture_id}'"
    )
    response = audited_query(statement)
    rows = response.get("rows", [])
    if len(rows) != 1 or not isinstance(rows[0].get("payload_json"), str):
        raise RuntimeError("No real published weather capture is available")
    weather = json.loads(rows[0]["payload_json"])
    if capture_id is not None and weather.get("capture_id") != capture_id:
        raise RuntimeError("Weather source identity differs from requested capture")
    if weather.get("schema_version") != "porch-light.live-weather.v1":
        raise RuntimeError("Unexpected weather publication schema")
    if not isinstance(weather.get("alerts"), list) or not weather.get("capture_id"):
        raise RuntimeError("Weather source publication is incomplete")
    audit = response["audit"]
    if not audit["finish_successfully"] or not str(audit["query_id"]).isdigit():
        raise RuntimeError("No successful actual vendor audit execution")
    weather["data_access"] = {
        "data_access_mode": "zetaris",
        "executed_at": audit["end_time"],
        "zetaris_query_ids": [audit["query_id"]],
        "statement_sha256": hashlib.sha256(audit["sql_query"].encode()).hexdigest(),
        "zetaris_audit": audit,
    }
    for alert in weather["alerts"]:
        alert["zetaris_query_ids"] = [audit["query_id"]]
    return weather


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register-view", action="store_true")
    parser.add_argument("--capture-id")
    args = parser.parse_args()
    try:
        result = register_view() if args.register_view else read_live_weather(args.capture_id)
    except Exception as error:
        print(json.dumps({
            "error": "Live weather data unavailable. No source or data-access fallback.",
            "error_type": type(error).__name__,
        }))
        return 1
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
