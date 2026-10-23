"""Capture complete official national inputs outside Git, with immutable provenance."""

import argparse
import csv
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

from data.adapters.us.capture_cms import capture_dataset
from data.adapters.us.capture_empower import BASE, LICENSE as EMPOWER_LICENSE, validate_identity
from data.adapters.us.national_shapes import read_shapes
from data.provenance.sidecar import sha256_of, verify, write_sidecar

ROOT = Path.home() / ".porchlight" / "national"
HOSTS = {"svi.cdc.gov", "www.weather.gov", "api.weather.gov", "services2.arcgis.com",
         "geocoding.geo.census.gov", "tigerweb.geo.census.gov"}
COMMAND = "python -m data.adapters.us.capture_national"


def preserve(folder: Path, name: str, url: str, license_line: str, data: bytes | None = None,
             content_type: str | None = None, timeout: int = 120) -> bytes:
    if urlsplit(url).scheme != "https" or urlsplit(url).hostname not in HOSTS:
        raise ValueError("Unexpected national source URL")
    target = folder / name
    if target.exists():
        metadata = json.loads(Path(str(target) + ".provenance.json").read_text())
        if not verify(target) or metadata["source_url"] != url:
            raise ValueError("Existing capture has a mismatched source or checksum")
        return target.read_bytes()
    headers = {"User-Agent": "PorchLight (joe@joepro.ai)"}
    if content_type:
        headers["Content-Type"] = content_type
    with urlopen(Request(url, data=data, headers=headers), timeout=timeout) as response:
        if urlsplit(response.geturl()).hostname not in HOSTS:
            raise ValueError("Unexpected source redirect")
        raw = response.read(256 * 1024 * 1024 + 1)
    if len(raw) > 256 * 1024 * 1024:
        raise ValueError("National source exceeds the bounded file limit")
    with target.open("xb") as output:
        output.write(raw)
    write_sidecar(target, url, license_line, COMMAND)
    return raw


def capture_geographies(folder: Path, filename: str, page: str, prefix: str) -> str:
    html = preserve(folder, filename + "-index.html", page, "US NWS public data").decode()
    links = list(dict.fromkeys(urljoin(page, value) for value in re.findall(
        r'href=["\']([^"\']+\.zip)["\']', html, re.I)
        if Path(value).name.lower().startswith(prefix)))
    if not links:
        raise ValueError("Official NWS index has no matching source archive")
    # The published index may retain older releases. Choose the newest published asset.
    versions = []
    for link in links:
        with urlopen(Request(link, method="HEAD", headers={"User-Agent": "PorchLight (joe@joepro.ai)"}), timeout=60) as response:
            modified = parsedate_to_datetime(response.headers["Last-Modified"])
            versions.append((modified, link))
    url = max(versions)[1]
    preserve(folder, filename + ".zip", url, "US NWS public data; https://www.weather.gov/disclaimer")
    return url


def geocode(folder: Path) -> dict:
    rows = []
    for kind in ("nursing_homes", "dialysis"):
        with (folder / f"{kind}.csv").open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                ccn = row["CMS Certification Number (CCN)"].strip()
                if not re.fullmatch(r"[0-9A-Z]{6}", ccn):
                    raise ValueError("National CMS source has an invalid CCN")
                rows.append([f"{kind}:{ccn}",
                             row.get("Provider Address", row.get("Address Line 1", "")),
                             row.get("City/Town", row.get("City", "")), row["State"], row["ZIP Code"]])
    endpoint = "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch"
    results = []
    for index, start in enumerate(range(0, len(rows), 10000)):
        text = io.StringIO(newline="")
        csv.writer(text).writerows(rows[start:start + 10000])
        source = text.getvalue().encode()
        request_file = folder / f"census-input-{index:02}.csv"
        request_file.write_bytes(source)
        write_sidecar(request_file, endpoint, "Derived from public CMS addresses", COMMAND)
        boundary = "PorchLight" + uuid4().hex
        parts = []
        for key, value in (("benchmark", "Public_AR_Current"), ("vintage", "Current_Current")):
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode())
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"addressFile\"; filename=\"addresses.csv\"\r\nContent-Type: text/csv\r\n\r\n".encode() + source + b"\r\n")
        body = b"".join(parts) + f"--{boundary}--\r\n".encode()
        raw = preserve(folder, f"census-output-{index:02}.csv", endpoint,
                       "US Census Bureau public geocoder results", body,
                       f"multipart/form-data; boundary={boundary}", timeout=1200)
        parsed = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
        if {row[0] for row in parsed} != {row[0] for row in rows[start:start + 10000]} or len(parsed) != len(rows[start:start + 10000]):
            raise ValueError("Census batch changed or omitted source identities")
        results.extend(parsed)
        print(json.dumps({"stage": "census_batch", "batch": index, "returned": len(parsed)}), flush=True)
    return {"requested": len(rows), "returned": len(results),
            "matched": sum(len(row) >= 11 and row[2] == "Match" for row in results),
            "benchmark": "Public_AR_Current", "vintage": "Current_Current"}


def capture_catalog(folder: Path) -> dict:
    base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/"
    counts = {}
    for layer, name, fields in (
        (0, "census-states", "GEOID,STATE,NAME,STUSAB"),
        (1, "census-counties", "GEOID,STATE,COUNTY,BASENAME,NAME"),
    ):
        count_url = base + str(layer) + "/query?" + urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
        count = json.loads(preserve(folder, name + "-count.json", count_url, "US Census Bureau public data"))["count"]
        url = base + str(layer) + "/query?" + urlencode({
            "where": "1=1", "returnGeometry": "false", "outFields": fields, "orderByFields": "GEOID", "f": "json",
        })
        source = json.loads(preserve(folder, name + ".json", url, "US Census Bureau public county/state catalog"))
        rows = source.get("features", [])
        if source.get("error") or source.get("exceededTransferLimit") or len(rows) != count:
            raise ValueError("Canonical Census catalog capture is incomplete")
        counts[name] = len(rows)
    official = json.loads((folder / "census-counties.json").read_bytes())["features"]
    known = {row["properties"]["FIPS"] for row in read_shapes(folder / "nws-counties.zip")}
    missing = [row["attributes"]["GEOID"] for row in official if row["attributes"]["GEOID"] not in known]
    if missing:
        where = "GEOID IN (" + ",".join("'" + value + "'" for value in missing) + ")"
        url = base + "1/query?" + urlencode({
            "where": where, "returnGeometry": "true", "outFields": "GEOID,STATE,COUNTY,BASENAME,NAME",
            "outSR": "4326", "f": "geojson",
        })
        geometry = json.loads(preserve(folder, "census-missing-county-boundaries.geojson", url,
                                       "US Census Bureau current official county geometry, WGS84"))
        returned = {row["properties"]["GEOID"] for row in geometry.get("features", [])}
        if returned != set(missing):
            raise ValueError("Census supplemental county geometry is incomplete")
        counts["official_geometry_supplements"] = len(returned)
    return counts


def capture(resume: Path | None = None) -> Path:
    ROOT.mkdir(parents=True, exist_ok=True)
    folder = resume.resolve() if resume else ROOT / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8])
    if not folder.is_relative_to(ROOT.resolve()):
        raise ValueError("National sources must remain under the private national filestore")
    folder.mkdir(exist_ok=resume is not None)
    manifest = {"captured_at": datetime.now(timezone.utc).isoformat(), "sources": {}}
    for name in ("nursing_homes", "dialysis"):
        path = folder / f"{name}.csv"
        if path.exists():
            if not verify(path) or not verify(folder / f"{name}.metadata.json"):
                raise ValueError("CMS capture provenance does not verify")
            with path.open(encoding="utf-8-sig", newline="") as stream:
                manifest["sources"][name] = {"source_rows": sum(1 for _ in csv.DictReader(stream))}
        else:
            manifest["sources"][name] = capture_dataset(name, folder, COMMAND)
        print(json.dumps({"stage": name, "rows": manifest["sources"][name]["source_rows"]}), flush=True)
    for name, url in (
        ("svi-tract.csv", "https://svi.cdc.gov/Documents/Data/2022/csv/states/SVI_2022_US.csv"),
        ("svi-county.csv", "https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/SVI_2022_US_county.csv"),
    ):
        preserve(folder, name, url, "CDC/ATSDR SVI 2022 national public release; cite CDC/ATSDR")
        print(json.dumps({"stage": name, "sha256": sha256_of(folder / name)}), flush=True)
    manifest["sources"]["nws_counties"] = capture_geographies(
        folder, "nws-counties", "https://www.weather.gov/gis/Counties", "c_")
    manifest["sources"]["nws_forecast_zones"] = capture_geographies(
        folder, "nws-forecast-zones", "https://www.weather.gov/gis/PublicZones", "z_")
    metadata = json.loads(preserve(folder, "empower-layer.json", BASE + "?f=json", EMPOWER_LICENSE))
    validate_identity(metadata)
    count_url = BASE + "/query?" + urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
    count = json.loads(preserve(folder, "empower-count.json", count_url, EMPOWER_LICENSE)).get("count")
    if not isinstance(count, int) or not 0 < count < 200000:
        raise ValueError("Unexpected national emPOWER count")
    def page(offset: int) -> list[dict]:
        url = BASE + "/query?" + urlencode({
            "where": "1=1", "outFields": "*", "returnGeometry": "false",
            "orderByFields": "OBJECTID", "resultOffset": offset, "resultRecordCount": 1000, "f": "json",
        })
        data = json.loads(preserve(folder, f"empower-{offset:06}.json", url, EMPOWER_LICENSE))
        if data.get("error") or not isinstance(data.get("features"), list):
            raise ValueError("National emPOWER page is not source data")
        return [feature["attributes"] for feature in data["features"]]
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [row for group in pool.map(page, range(0, count, 1000)) for row in group]
    if len(rows) != count or len({row["OBJECTID"] for row in rows}) != count:
        raise ValueError("National emPOWER pagination is incomplete or duplicated")
    manifest["sources"]["empower"] = {"rows": count, "layer": metadata["name"]}
    preserve(folder, "active-alerts.geojson", "https://api.weather.gov/alerts/active", "US NWS public data")
    manifest["files"] = {path.name: sha256_of(path) for path in folder.iterdir()
                         if path.is_file() and not path.name.endswith(".provenance.json") and verify(path)}
    path = folder / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    write_sidecar(path, "https://api.weather.gov/alerts/active", "Derived source manifest; original terms retained", COMMAND)
    print(json.dumps({"stage": "national_sources_captured", "folder": str(folder), "empower_rows": count}), flush=True)
    return folder


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geocode-folder", type=Path)
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--catalog-folder", type=Path)
    args = parser.parse_args()
    if args.catalog_folder:
        print(json.dumps(capture_catalog(args.catalog_folder)))
    elif args.geocode_folder:
        result = geocode(args.geocode_folder)
        print(json.dumps({"stage": "geocoding_completed", **result}), flush=True)
    else:
        capture(args.resume)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
