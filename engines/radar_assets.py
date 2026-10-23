"""Publish IEM captures through audited Zetaris reads, never direct application data reads."""

import argparse
import json
from pathlib import Path

from data.adapters.us.capture_radar_assets import ROOT, capture, source_url
from data.provenance.sidecar import sha256_of, verify
from engines.zetaris_client import audited_query

VIEW = "porchlight_postgis.pl_radar_asset_v1"


def register() -> dict:
    capture(["clock"])
    return audited_query("CREATE DATASOURCE VIEW pl_radar_asset_v1 FROM porchlight_postgis AS "
                         "SELECT DISTINCT ON(source_key) capture_id,source_key,captured_at,payload_json "
                         "FROM porch_light.radar_asset ORDER BY source_key,captured_at DESC")["audit"]


def read(keys: list[str]) -> dict:
    capture(keys)
    literals = ",".join("'" + key + "'" for key in dict.fromkeys(keys))
    response = audited_query(f"SELECT capture_id,source_key,payload_json FROM {VIEW} WHERE source_key IN ({literals})")
    if {row["source_key"] for row in response["rows"]} != set(keys):
        raise RuntimeError("The audited radar read didn't close every requested source")
    assets = []
    for row in response["rows"]:
        value = json.loads(row["payload_json"])
        path = Path(value["file_path"]).resolve()
        if (value["capture_id"] != row["capture_id"] or value["source_key"] != row["source_key"]
                or value["source_url"] != source_url(row["source_key"])[0] or not path.is_relative_to(ROOT.resolve())
                or not verify(path) or sha256_of(path) != value["sha256"]):
            raise RuntimeError("Radar asset identity, filestore boundary or provenance failed closed")
        if row["source_key"] == "clock":
            value["clock"] = json.loads(path.read_text(encoding="utf-8"))
        assets.append(value)
    return {"schema_version": "porch-light.radar-assets.v1", "assets": assets,
            "data_access": {"data_access_mode": "zetaris", "zetaris_query_ids": [response["audit"]["query_id"]],
                            "zetaris_audit": response["audit"]}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register", action="store_true")
    parser.add_argument("--keys")
    args = parser.parse_args()
    try:
        result = {"registration": register()} if args.register else read(json.loads(args.keys or "[]"))
        print(json.dumps(result, ensure_ascii=True))
        return 0
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print(json.dumps({"error": "Radar source or audit unavailable. No tile or timestamp substitution.",
                          "error_type": type(error).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
