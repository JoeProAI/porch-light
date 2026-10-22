"""Capture the official HHS aggregate ZIP layer, retaining layer identity and masking."""

import argparse
import json
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import verify, write_sidecar

LAYER_ID = 1
LAYER_NAME = "Electricity Dependent DME \u2013 ALL \u2013 ZipLevel"
BASE = (
    "https://services2.arcgis.com/ZQ4jTQn6k7VPXEwO/arcgis/rest/services/"
    "HHS_emPOWER_REST_Service_Public/FeatureServer/1"
)
LICENSE = "HHS emPOWER publicly released aggregate data; reuse terms not specified in ArcGIS layer metadata"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("emPOWER capture refuses redirects")


def preserve(directory: Path, filename: str, url: str, command: str) -> dict:
    if not (url.startswith(BASE + "?") or url.startswith(BASE + "/query?")):
        raise ValueError("Refused unexpected emPOWER layer URL")
    request = Request(url, headers={"User-Agent": "PorchLight hackathon, joe@joepro.ai"})
    with build_opener(NoRedirect()).open(request, timeout=45) as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("emPOWER response exceeds capture limit")
    document = json.loads(raw)
    if not isinstance(document, dict) or document.get("error"):
        raise ValueError("emPOWER returned an error rather than source data")
    fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path = directory / filename
    with path.open("xb") as output:
        output.write(raw)
    write_sidecar(path, url, LICENSE, command, fetched)
    return document


def validate_identity(metadata: dict) -> None:
    if metadata.get("id") != LAYER_ID or metadata.get("name") != LAYER_NAME:
        raise ValueError("emPOWER layer identity does not match the requested measure")


def read_snapshot(directory: Path) -> tuple[dict, list[dict]]:
    metadata_path = directory / "layer.json"
    count_path = directory / "florida_count.json"
    if not verify(metadata_path) or not verify(count_path):
        raise ValueError("Verified emPOWER layer and count captures are required")
    metadata = json.loads(metadata_path.read_bytes())
    validate_identity(metadata)
    expected = json.loads(count_path.read_bytes()).get("count")
    rows = []
    for path in sorted(directory.glob("page-*.json")):
        if path.name.endswith(".provenance.json"):
            continue
        if not verify(path):
            raise ValueError("emPOWER page provenance does not verify")
        document = json.loads(path.read_bytes())
        if document.get("error") or not isinstance(document.get("features"), list):
            raise ValueError("emPOWER page has no valid feature list")
        rows.extend(feature["attributes"] for feature in document["features"])
    ids = [row["OBJECTID"] for row in rows]
    if not isinstance(expected, int) or expected <= 0 or len(rows) != expected or len(ids) != len(set(ids)):
        raise ValueError("emPOWER capture is empty, incomplete or has duplicated object IDs")
    if any(row.get("STATE") != "FL" for row in rows):
        raise ValueError("emPOWER state filter was not honored")
    return metadata, rows


def zip_context(directory: Path, zip_code: str, county_geoid: str) -> dict:
    if not re.fullmatch(r"\d{5}", zip_code) or not re.fullmatch(r"\d{5}", county_geoid):
        raise ValueError("Source ZIP and county identifiers must be five digits")
    metadata, rows = read_snapshot(directory)
    matches = [
        row for row in rows
        if row.get("Zip_Code_Recode") == zip_code and row.get("FIPS_Code") == county_geoid
    ]
    if len(matches) != 1:
        return {
            "status": "refused_missing_zip" if not matches else "refused_zip_fanout",
            "source_zip_row_count": len(matches),
        }
    row = matches[0]
    count, beneficiaries = row.get("Power_Dependent_Devices_DME"), row.get("Medicare_Benes")
    if not isinstance(count, int) or count < 0 or not isinstance(beneficiaries, int) or beneficiaries <= 0:
        return {"status": "refused_missing_or_invalid_counts"}
    return {
        "status": "aggregate_source_row_available",
        "zip": zip_code, "county_geoid": county_geoid,
        "layer_id": metadata["id"], "layer_name": metadata["name"],
        "reported_dme_count": count, "medicare_beneficiaries": beneficiaries,
        "small_count_caution": count == 11,
        "scope": "ZIP aggregate, not facility patients",
        "zetaris_join_measured": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/empower"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([sys.executable, "-m", "data.adapters.us.capture_empower", *sys.argv[1:]])
    try:
        metadata = preserve(directory, "layer.json", BASE + "?f=json", command)
        validate_identity(metadata)
        required = {"OBJECTID", "STATE", "Zip_Code_Recode", "FIPS_Code", "Power_Dependent_Devices_DME", "Medicare_Benes"}
        if not required.issubset({field["name"] for field in metadata.get("fields", [])}):
            raise ValueError("emPOWER layer has missing required fields")
        count_url = BASE + "/query?" + urlencode({
            "where": "STATE='FL'", "returnCountOnly": "true", "f": "json",
        })
        count = preserve(directory, "florida_count.json", count_url, command).get("count")
        if not isinstance(count, int) or not 0 < count <= 10000:
            raise ValueError("Unexpected emPOWER Florida feature count")
        size = min(1000, int(metadata.get("maxRecordCount", 1000)))
        if size <= 0:
            raise ValueError("emPOWER returned an invalid page size")
        for index, offset in enumerate(range(0, count, size)):
            url = BASE + "/query?" + urlencode({
                "where": "STATE='FL'", "outFields": "*", "returnGeometry": "false",
                "orderByFields": "OBJECTID", "resultOffset": offset,
                "resultRecordCount": size, "f": "json",
            })
            preserve(directory, f"page-{index:03d}.json", url, command)
        _, rows = read_snapshot(directory)
        print(json.dumps({
            "directory": str(directory), "status": "captured",
            "florida_zip_features": len(rows),
            "layer_id": metadata["id"], "layer_name": metadata["name"],
            "service_editing_info": metadata.get("editingInfo"),
            "reporting_period_verified": False, "ranking_ready": False,
            "scope": "ZIP aggregate, not facility patients",
        }, indent=2))
        return 0
    except Exception as error:
        print(json.dumps({
            "directory": str(directory), "status": "failed", "error": type(error).__name__,
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
