"""Ingest official national alerts and CONUS radar outside Git, then publish atomically."""

import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import sha256_of, verify, write_sidecar
from data.snapshot.db import psql
from data.adapters.us.capture_radar_maps import capture_maps

ALERT_URL = "https://api.weather.gov/alerts/active"
RADAR_URL = "https://radar.weather.gov/ridge/standard/CONUS-LARGE_loop.gif"
MAX_BYTES = 16 * 1024 * 1024
FIELDS = (
    "event", "severity", "urgency", "certainty", "areaDesc", "headline",
    "description", "instruction", "effective", "onset", "expires", "ends",
    "senderName", "response", "status", "messageType",
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("Live weather capture refuses redirects")


def fetch(url: str) -> tuple[bytes, dict, str]:
    if url not in (ALERT_URL, RADAR_URL):
        raise ValueError("Unapproved live weather source")
    request = Request(url, headers={
        "User-Agent": "PorchLight (joe@joepro.ai)",
        "Accept": "application/geo+json, image/gif, */*",
    })
    with build_opener(NoRedirect()).open(request, timeout=45) as response:
        if response.geturl() != url:
            raise ValueError("Unexpected weather source location")
        raw = response.read(MAX_BYTES + 1)
        headers = dict(response.headers)
    if len(raw) > MAX_BYTES:
        raise ValueError("Live weather source exceeds the bounded capture limit")
    return raw, headers, datetime.now(timezone.utc).isoformat(timespec="seconds")


def capture() -> dict:
    root = Path(os.environ.get(
        "PORCHLIGHT_WEATHER_CACHE", Path.home() / ".porchlight" / "live-weather"
    )).resolve()
    if ".git" in root.parts or root.is_relative_to(Path(__file__).resolve().parents[3]):
        raise ValueError("National weather captures must be outside the project Git checkout")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    folder = root / f"{stamp}-{uuid4().hex[:8]}"
    folder.mkdir(parents=True)
    alert_bytes, alert_headers, alert_fetched = fetch(ALERT_URL)
    collection = json.loads(alert_bytes)
    if collection.get("type") != "FeatureCollection" or not isinstance(collection.get("features"), list):
        raise ValueError("Official active-alert response is not a FeatureCollection")
    alerts = []
    for feature in collection["features"]:
        properties = feature.get("properties")
        identifier = feature.get("id")
        if not isinstance(properties, dict) or not isinstance(identifier, str):
            raise ValueError("Official alert lacks its source identity")
        if not identifier.startswith("https://api.weather.gov/alerts/"):
            raise ValueError("Unexpected official alert identity")
        alerts.append({
            "id": identifier,
            **{field: properties.get(field) for field in FIELDS},
            "geometry": feature.get("geometry"),
            "affectedZones": properties.get("affectedZones", []),
        })
    radar_bytes, radar_headers, radar_fetched = fetch(RADAR_URL)
    if radar_bytes[:6] not in (b"GIF87a", b"GIF89a"):
        raise ValueError("Official radar response is not a GIF observation loop")
    alert_file = folder / "nws-active-alerts.geojson"
    radar_file = folder / "noaa-conus-loop.gif"
    alert_file.write_bytes(alert_bytes)
    radar_file.write_bytes(radar_bytes)
    for path, url, fetched in (
        (alert_file, ALERT_URL, alert_fetched), (radar_file, RADAR_URL, radar_fetched)
    ):
        write_sidecar(
            path, url, "US National Weather Service public domain; https://www.weather.gov/disclaimer",
            "python -m data.adapters.us.capture_live_weather", fetched,
        )
        if not verify(path):
            raise ValueError("Captured weather source provenance failed")
    modified = radar_headers.get("Last-Modified")
    modified_utc = parsedate_to_datetime(modified).astimezone(timezone.utc).isoformat() if modified else None
    captured_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    identifier = hashlib.sha256(
        (sha256_of(alert_file) + sha256_of(radar_file) + captured_at).encode()
    ).hexdigest()
    payload = {
        "schema_version": "porch-light.live-weather.v1",
        "capture_id": identifier,
        "captured_at": captured_at,
        "alerts": alerts,
        "alert_feed": {
            "source_url": ALERT_URL, "fetched_at": alert_fetched,
            "sha256": sha256_of(alert_file), "coverage": "US National Weather Service active-alert feed",
            "provider_updated_at": collection.get("updated"),
            "etag": alert_headers.get("ETag"),
        },
        "radar": {
            "source_url": RADAR_URL, "fetched_at": radar_fetched,
            "sha256": sha256_of(radar_file), "provider_last_modified": modified_utc,
            "file_path": str(radar_file), "content_type": "image/gif",
            "coverage": "Contiguous United States only. Alaska, Hawaii and territories are not in this radar layer.",
            "observation_time_note": "Read individual frame times from the official image. HTTP Last-Modified is asset metadata, not an inferred observation time.",
        },
        "limits": [
            "Observed weather, not a forecast, outage report or facility-condition feed.",
            "National alert discovery does not establish facility ranking coverage.",
            "Some alerts have no polygon. No geometry is invented from area text.",
            "Follow the original official warning instructions.",
        ],
    }
    try:
        payload["radar_maps"] = capture_maps(folder)
    except Exception as error:
        payload["radar_maps"] = {
            "available": False, "error_type": type(error).__name__,
            "detail": "Transparent radar source unavailable; original official loop remains separate.",
        }
    payload_hex = json.dumps(payload, ensure_ascii=True).encode().hex()
    psql(
        "BEGIN;"
        "CREATE TABLE IF NOT EXISTS porch_light.live_weather_capture("
        "capture_id text PRIMARY KEY,captured_at timestamptz NOT NULL,payload_json text NOT NULL);"
        "GRANT SELECT ON porch_light.live_weather_capture TO porchlight_reader;"
        "INSERT INTO porch_light.live_weather_capture VALUES("
        f"'{identifier}','{captured_at}',convert_from(decode('{payload_hex}','hex'),'UTF8'));"
        "COMMIT;"
    )
    return {
        "capture_id": identifier, "captured_at": captured_at,
        "actual_alerts": len(alerts), "radar_bytes": len(radar_bytes),
        "raw_cache": str(folder), "published": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=int, default=300)
    parser.add_argument("--max-captures", type=int, default=1)
    args = parser.parse_args()
    if args.interval < 300 or not 1 <= args.max_captures <= 288:
        parser.error("Use at least 300 seconds and between 1 and 288 bounded attempts")
    failed = False
    for attempt in range(args.max_captures):
        try:
            print(json.dumps(capture()), flush=True)
        except Exception as error:
            failed = True
            print(json.dumps({"published": False, "error_type": type(error).__name__,
                              "detail": "Capture failed. Prior verified data retained; source details withheld."}),
                  flush=True)
        if attempt + 1 < args.max_captures:
            time.sleep(args.interval)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
