"""Capture bounded public IEM assets, then publish immutable metadata for Zetaris."""

import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import sha256_of, verify, write_sidecar
from data.snapshot.db import psql

ROOT = Path.home() / ".porchlight" / "radar-assets"
CLOCK_URL = "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q"
LICENSE = "Iowa Environmental Mesonet public data; source terms: https://mesonet.agron.iastate.edu/disclaimer.php"
FRAME = re.compile(r"nexrad-n0q-900913(?:-m(?:05|10|15|20|25|30|35|40|45|50)m)?")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("Radar capture refuses redirects")


def source_url(key: str) -> tuple[str, str]:
    if key == "clock":
        return CLOCK_URL, "application/json"
    parts = key.split("/")
    if len(parts) != 4 or not FRAME.fullmatch(parts[0]) or any(not re.fullmatch(r"\d{1,4}", p) for p in parts[1:]):
        raise ValueError("Only bounded IEM radar layers and geographic tile coordinates are permitted")
    z, x, y = map(int, parts[1:])
    if not 0 <= z <= 12 or not 0 <= x < 2 ** z or not 0 <= y < 2 ** z:
        raise ValueError("Radar tile is outside the supported geographic zoom")
    return f"https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/{key}.png", "image/png"


def save(path: Path, raw: bytes, url: str, captured: str) -> None:
    temporary = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    temporary.write_bytes(raw)
    temporary.replace(path)
    write_sidecar(path, url, LICENSE, "python -m engines.radar_assets", captured)
    if not verify(path):
        raise RuntimeError("Radar source checksum or provenance failed")


def capture_one(key: str) -> dict:
    url, content_type = source_url(key)
    folder = ROOT / hashlib.sha256(key.encode()).hexdigest()
    folder.mkdir(parents=True, exist_ok=True)
    pointer = folder / "latest.json"
    if verify(pointer):
        prior = json.loads(pointer.read_text(encoding="utf-8"))
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(prior["captured_at"])).total_seconds()
        if 0 <= age < 300 and prior["source_url"] == url and verify(Path(prior["file_path"])):
            return prior
    request = Request(url, headers={"User-Agent": "PorchLight (joe@joepro.ai)", "Accept": content_type})
    with build_opener(NoRedirect()).open(request, timeout=25) as response:
        if response.geturl() != url:
            raise ValueError("Radar capture refused a changed source location")
        raw = response.read(2 * 1024 * 1024 + 1)
        modified = response.headers.get("Last-Modified")
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError("Radar asset exceeded its bounded byte limit")
    if key == "clock":
        value = json.loads(raw)
        if not isinstance(value, dict) or not isinstance(value.get("scans"), list):
            raise ValueError("IEM clock did not return its scan catalog")
    elif raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("The radar tile isn't a source PNG")
    captured = datetime.now(timezone.utc).isoformat()
    digest = hashlib.sha256(raw).hexdigest()
    identifier = hashlib.sha256((url + digest + captured).encode()).hexdigest()
    path = folder / (identifier + (".json" if key == "clock" else ".png"))
    save(path, raw, url, captured)
    record = {"capture_id": identifier, "source_key": key, "captured_at": captured,
              "source_url": url, "sha256": sha256_of(path), "file_path": str(path),
              "content_type": content_type, "license": LICENSE, "source_last_modified": modified,
              "limits": ["Capture time is not radar observation time.",
                         "Relative IEM frame offsets don't establish an exact per-tile scan time."]}
    save(pointer, json.dumps(record, ensure_ascii=True).encode(), url, captured)
    return record


def capture(keys: list[str]) -> None:
    if not isinstance(keys, list) or not 1 <= len(keys) <= 40 or any(not isinstance(key, str) for key in keys):
        raise ValueError("A radar capture batch needs one to forty source identifiers")
    unique = list(dict.fromkeys(keys))
    for key in unique:
        source_url(key)
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(capture_one, unique))
    rows = []
    for record in records:
        encoded = json.dumps(record, ensure_ascii=True).encode().hex()
        rows.append(f"('{record['capture_id']}','{record['source_key']}','{record['captured_at']}',"
                    f"convert_from(decode('{encoded}','hex'),'UTF8'))")
    psql("BEGIN;CREATE TABLE IF NOT EXISTS porch_light.radar_asset("
         "capture_id text PRIMARY KEY,source_key text NOT NULL,captured_at timestamptz NOT NULL,payload_json text NOT NULL);"
         "CREATE INDEX IF NOT EXISTS porchlight_radar_key_time ON porch_light.radar_asset(source_key,captured_at DESC);"
         "GRANT SELECT ON porch_light.radar_asset TO porchlight_reader;"
         "INSERT INTO porch_light.radar_asset VALUES " + ",".join(rows) +
         " ON CONFLICT(capture_id) DO NOTHING;COMMIT;")
