"""Preserve public NWS alerts and affected zone shapes for ingestion, not runtime reads."""

import argparse
import json
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import write_sidecar

USER_AGENT = "PorchLight hackathon, joe@joepro.ai"
LICENSE = "US National Weather Service public domain; https://www.weather.gov/disclaimer"
MAX_BYTES = 16 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("NWS capture refuses redirects")


def validate_url(url: str, kind: str) -> None:
    if kind not in ("alert", "zone"):
        raise ValueError("Unknown NWS resource kind")
    parsed = urlsplit(url)
    pattern = r"/alerts/[^/]+" if kind == "alert" else r"/zones/(forecast|county|fire)/[A-Z]{2}[CZ]\d{3}"
    if (
        parsed.scheme != "https"
        or parsed.netloc != "api.weather.gov"
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(pattern, parsed.path)
    ):
        raise ValueError(f"Refused non-NWS {kind} URL")


def has_polygon_geometry(geometry: object) -> bool:
    if not isinstance(geometry, dict):
        return False
    if geometry.get("type") in ("Polygon", "MultiPolygon"):
        return bool(geometry.get("coordinates"))
    if geometry.get("type") == "GeometryCollection":
        members = geometry.get("geometries")
        return (
            isinstance(members, list)
            and bool(members)
            and all(has_polygon_geometry(member) for member in members)
        )
    return False


def validate_document(document: object, kind: str) -> dict:
    if not isinstance(document, dict) or document.get("type") != "Feature":
        raise ValueError("NWS response is not a GeoJSON Feature")
    properties = document.get("properties")
    if not isinstance(properties, dict):
        raise ValueError("NWS feature has no properties")
    geometry = document.get("geometry")
    if kind == "alert":
        zones = properties.get("affectedZones")
        if not isinstance(zones, list):
            raise ValueError("NWS alert has no affectedZones list")
        if not zones and geometry is None:
            raise ValueError("Alert has neither affected zones nor geometry")
        for zone in zones:
            if not isinstance(zone, str):
                raise ValueError("Invalid affected zone URL")
            validate_url(zone, "zone")
        if geometry is not None and not has_polygon_geometry(geometry):
            raise ValueError("NWS alert has invalid polygon geometry")
    elif kind == "zone":
        if not has_polygon_geometry(geometry):
            raise ValueError("NWS zone has no polygon geometry")
    else:
        raise ValueError("Unknown NWS resource kind")
    return document


def fetch_json(url: str, kind: str) -> tuple[bytes, dict, str]:
    validate_url(url, kind)
    request = Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json, application/json",
    })
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        validate_url(response.geturl(), kind)
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("NWS response exceeds capture limit")
    document = validate_document(json.loads(raw), kind)
    return raw, document, datetime.now(timezone.utc).isoformat(timespec="seconds")


def preserve(directory: Path, filename: str, url: str, kind: str,
             fetch_command: str) -> dict:
    raw, document, fetched_at = fetch_json(url, kind)
    target = directory / filename
    with target.open("xb") as output:
        output.write(raw)
    write_sidecar(target, url, LICENSE, fetch_command, fetched_at)
    return document


def capture(alert_ids: list[str], directory: Path,
            fetch_command: str) -> list[dict]:
    if not fetch_command.strip():
        raise ValueError("Capture requires its actual invocation for provenance")
    if not alert_ids:
        raise ValueError("Capture requires actual alert identifiers")
    directory.mkdir(parents=True, exist_ok=False)
    results = []
    zones: dict[str, dict] = {}
    for index, alert_id in enumerate(dict.fromkeys(alert_ids), start=1):
        url = f"https://api.weather.gov/alerts/{alert_id}"
        result = {"url": url, "status": "failed", "zones": []}
        results.append(result)
        try:
            filename = f"alert-{index:02d}.json"
            document = preserve(directory, filename, url, "alert", fetch_command)
            result.update(status="captured", file=filename)
            affected_zones = document["properties"]["affectedZones"]
            if not affected_zones and document.get("geometry") is None:
                raise ValueError("Alert has neither affected zones nor geometry")
            for zone_url in affected_zones:
                if not isinstance(zone_url, str):
                    raise ValueError("Invalid affected zone URL")
                validate_url(zone_url, "zone")
                if zone_url not in zones:
                    zone_result = {"url": zone_url, "status": "failed"}
                    zones[zone_url] = zone_result
                    try:
                        zone_name = urlsplit(zone_url).path.replace("/", "_").lstrip("_")
                        zone_file = f"{zone_name}.json"
                        preserve(directory, zone_file, zone_url, "zone", fetch_command)
                        zone_result.update(status="captured", file=zone_file)
                    except Exception as error:
                        zone_result["error"] = type(error).__name__
                        if isinstance(error, HTTPError):
                            zone_result["http_status"] = error.code
                result["zones"].append(zones[zone_url])
            if any(zone["status"] != "captured" for zone in result["zones"]):
                result["status"] = "incomplete"
        except Exception as error:
            result.update(status="failed", error=type(error).__name__)
            if isinstance(error, HTTPError):
                result["http_status"] = error.code
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--alert-id", action="append", required=True)
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/nws"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    command = shlex.join([
        sys.executable, "-m", "data.adapters.us.capture_nws", *sys.argv[1:],
    ])
    results = capture(args.alert_id, directory, command)
    print(json.dumps({"directory": str(directory), "results": results}, indent=2))
    return 0 if all(item["status"] == "captured" for item in results) else 1


if __name__ == "__main__":
    sys.exit(main())
