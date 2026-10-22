"""Capture the real Milton warning and a selected county's actual zone sections."""

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

from data.adapters.us.capture_nws import preserve as preserve_nws
from data.adapters.us.counties import COUNTIES, MANATEE, CountyProfile, county_profile
from data.provenance.sidecar import write_sidecar

BASE = "https://mesonet.agron.iastate.edu/api/1"
VALID_AT = "2024-10-09T06:00:00Z"
LICENSE = (
    "NWS text is US government public domain; IEM API terms permit legal use: "
    "https://mesonet.agron.iastate.edu/api/1/docs"
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("IEM capture refuses redirects")


def preserve(directory: Path, filename: str, url: str, command: str) -> bytes:
    if not url.startswith(BASE + "/"):
        raise ValueError("Refused non-IEM source")
    request = Request(url, headers={"User-Agent": "PorchLight hackathon, joe@joepro.ai"})
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        raw = response.read(8 * 1024 * 1024 + 1)
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("IEM response exceeds capture limit")
    fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
    target = directory / filename
    with target.open("xb") as output:
        output.write(raw)
    write_sidecar(target, url, LICENSE, command, fetched)
    return raw


def select_event(document: dict, profile: CountyProfile = MANATEE) -> dict:
    rows = document.get("data")
    if not isinstance(rows, list):
        raise ValueError("IEM response has no event list")
    selected = [
        row for row in rows
        if row.get("wfo") == "TBW"
        and row.get("ph_sig") == "HU.W"
        and row.get("year") == 2024
        and f"{profile.name} [{profile.state}]" in row.get("locations", "")
    ]
    if len(selected) != 1:
        raise ValueError("Expected exactly one archived county hurricane warning")
    event = selected[0]
    valid = datetime.fromisoformat(VALID_AT.replace("Z", "+00:00"))
    issued = datetime.fromisoformat(event["issue"].replace("Z", "+00:00"))
    expires = datetime.fromisoformat(event["expire"].replace("Z", "+00:00"))
    if not issued <= valid < expires:
        raise ValueError("Archived event dates do not cover the scenario time")
    return event


def county_zones(text: str, profile: CountyProfile = MANATEE) -> list[str]:
    zones = set()
    for section in text.split("\n$$"):
        if not any(label in section for label in (
            f"\nCoastal {profile.name}-", f"\nInland {profile.name}-"
        )):
            continue
        if "KTBW.HU.W.1014." not in section:
            raise ValueError("County section does not carry the selected hurricane warning")
        header = re.search(r"(?m)^(FLZ\d{3})-\d{6}-", section)
        if header is None:
            raise ValueError("County section has no explicit forecast zone identifier")
        zones.add(header.group(1))
    if len(zones) != 2:
        raise ValueError("Expected both real Coastal and Inland county zone sections")
    return sorted(zones)


def manatee_zones(text: str) -> list[str]:
    return county_zones(text, MANATEE)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/iem"))
    parser.add_argument("--county", choices=tuple(COUNTIES), default=MANATEE.key)
    args = parser.parse_args()
    profile = county_profile(args.county)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([
        sys.executable, "-m", "data.adapters.us.capture_milton", *sys.argv[1:],
    ])
    try:
        url = BASE + "/vtec/events_status.json?" + urlencode({"valid": VALID_AT, "wfo": "TBW"})
        raw = preserve(directory, "events_status.json", url, command)
        event = select_event(json.loads(raw), profile)
        product_id = event["issue_product_id"]
        if not isinstance(product_id, str) or any(
            character not in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-" for character in product_id
        ):
            raise ValueError("Invalid archived product identifier")
        product_url = BASE + "/nwstext/" + product_id
        text = preserve(directory, "milton_issuance.txt", product_url, command)
        decoded = text.decode("utf-8")
        vtec = f"KTBW.HU.W.{event['eventid']:04d}."
        if "MILTON" not in decoded.upper() or vtec not in decoded:
            raise ValueError("Archived issuance does not identify the selected Milton event")
        zone_ids = county_zones(decoded, profile)
        for zone_id in zone_ids:
            preserve_nws(
                directory, f"nws_zone_{zone_id}.json",
                "https://api.weather.gov/zones/forecast/" + zone_id, "zone", command,
            )
        print(json.dumps({
            "directory": str(directory), "status": "captured",
            "event": event, "product_url": product_url,
            "scenario": "retrospective", "geometry_assembled": False,
            "county": profile.name, "county_fips": profile.fips,
            "county_zone_ids": zone_ids,
            "zone_capture_scope": "Selected county sections, not the entire multi-county warning",
            "zone_vintage": "Current NWS shapes; historical 2024 equivalence not verified",
            "status_caveat": "IEM event status may reflect later updates; issuance text is retained",
        }, indent=2))
        return 0
    except Exception as error:
        print(json.dumps({
            "directory": str(directory), "status": "failed",
            "error": type(error).__name__,
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
