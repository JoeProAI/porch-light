"""Capture Census geography for a selected real CMS county, without guessed matches."""

import argparse
import json
import math
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.adapters.us.capture_cms import csv_rows
from data.adapters.us.counties import COUNTIES, MANATEE, CountyProfile, county_profile
from data.provenance.sidecar import sha256_of, verify, write_sidecar

ROOT = Path(__file__).resolve().parents[3]
CMS_CAPTURE = ROOT / "data/snapshot/raw/cms/20261022T030046Z-a5ce96ba"
BASE = "https://geocoding.geo.census.gov/geocoder"
BENCHMARK = "Public_AR_Current"
VINTAGE = "Census2020_Current"
LICENSE = "US Census Bureau US government public data; https://www.census.gov/about/policies/quality/guidelines.html"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("Census capture refuses redirects")


def source_records(directory: Path, profile: CountyProfile = MANATEE) -> list[tuple[str, dict[str, str], Path]]:
    selected = []
    for kind in ("nursing_homes", "dialysis"):
        source = directory / f"{kind}.csv"
        if not verify(source):
            raise ValueError("CMS source must have verified provenance")
        _, rows = csv_rows(source.read_bytes())
        for row in rows:
            if (
                row["State"].strip() == profile.state
                and row["County/Parish"].strip().casefold() == profile.name.casefold()
            ):
                selected.append((kind, row, source))
    return selected


def source_name(kind: str, row: dict[str, str]) -> str:
    return row["Provider Name" if kind == "nursing_homes" else "Facility Name"].strip()


def query_url(kind: str, row: dict[str, str]) -> str:
    if kind not in ("nursing_homes", "dialysis"):
        raise ValueError("Unsupported CMS source kind")
    if source_name(kind, row).lower().startswith("zz_closed_"):
        raise ValueError("Source explicitly marks this listing closed")
    parameters = {"benchmark": BENCHMARK, "vintage": VINTAGE, "format": "json"}
    if kind == "nursing_homes":
        lat, lon = float(row["Latitude"]), float(row["Longitude"])
        if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("CMS source coordinate is missing or invalid")
        parameters.update({"x": row["Longitude"], "y": row["Latitude"]})
        route = "coordinates"
    elif kind == "dialysis":
        values = [row["Address Line 1"], row["City/Town"], row["State"], row["ZIP Code"]]
        if any(not value.strip() for value in values):
            raise ValueError("CMS source address is incomplete")
        parameters["address"] = ", ".join(values)
        route = "onelineaddress"
    else:
        raise ValueError("Unsupported CMS source kind")
    return BASE + "/geographies/" + route + "?" + urlencode(parameters)


def preserve(directory: Path, filename: str, url: str, command: str,
             upstream: Path | None = None, ccn: str | None = None) -> dict:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc != "geocoding.geo.census.gov" or not parsed.path.startswith("/geocoder/"):
        raise ValueError("Refused non-Census source")
    request = Request(url, headers={"User-Agent": "PorchLight hackathon, joe@joepro.ai"})
    with build_opener(NoRedirect()).open(request, timeout=45) as response:
        raw = response.read(8 * 1024 * 1024 + 1)
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("Census response exceeds capture limit")
    document = json.loads(raw)
    if not isinstance(document, dict):
        raise ValueError("Census response is not an object")
    fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
    target = directory / filename
    with target.open("xb") as output:
        output.write(raw)
    sidecar = write_sidecar(target, url, LICENSE, command, fetched)
    if upstream is not None:
        metadata = json.loads(sidecar.read_text())
        metadata["request_input_source"] = {
            "artifact": str(upstream.relative_to(ROOT)),
            "sha256": sha256_of(upstream),
            "ccn": ccn,
        }
        sidecar.write_text(json.dumps(metadata, indent=2) + "\n")
    return document


def geography_result(kind: str, document: dict, source: dict[str, str],
                     profile: CountyProfile = MANATEE) -> dict:
    result = document.get("result")
    if not isinstance(result, dict):
        return {"status": "refused_missing_result"}
    supplied = result.get("input", {})
    if not isinstance(supplied, dict):
        return {"status": "refused_missing_request_echo"}
    if (
        supplied.get("benchmark", {}).get("benchmarkName") != BENCHMARK
        or supplied.get("vintage", {}).get("vintageName") != VINTAGE
    ):
        return {"status": "refused_wrong_benchmark_or_vintage"}
    match_quality = None
    if kind == "dialysis":
        original = ", ".join(
            source[field] for field in ("Address Line 1", "City/Town", "State", "ZIP Code")
        )
        echoed = supplied.get("address", {}).get("address")
        if not isinstance(echoed, str) or echoed.strip() != original.strip():
            return {"status": "refused_request_input_mismatch"}
        matches = result.get("addressMatches", [])
        if not isinstance(matches, list) or len(matches) != 1:
            return {
                "status": "refused_no_address_match" if not matches else "refused_ambiguous_address",
                "match_count": len(matches) if isinstance(matches, list) else None,
            }
        matched = matches[0]
        geographies = matched.get("geographies", {})
        point = matched.get("coordinates", {})
        match_quality = matched.get("matchType")
    elif kind == "nursing_homes":
        geographies = result.get("geographies", {})
        point = supplied.get("location", {})
        try:
            bound = (
                float(point["x"]) == float(source["Longitude"])
                and float(point["y"]) == float(source["Latitude"])
            )
        except (KeyError, TypeError, ValueError):
            bound = False
        if not bound:
            return {"status": "refused_request_input_mismatch"}
    else:
        raise ValueError("Unsupported CMS source kind")
    counties = geographies.get("Counties", [])
    tracts = [
        row for name, rows in geographies.items()
        if name in ("Census Tracts", "2020 Census Tracts")
        for row in rows
    ]
    if len(counties) != 1 or len(tracts) != 1:
        return {"status": "refused_missing_or_ambiguous_geography"}
    county, tract = counties[0].get("GEOID"), tracts[0].get("GEOID")
    if not isinstance(county, str) or not re.fullmatch(r"\d{5}", county):
        return {"status": "refused_invalid_county_geoid"}
    if not isinstance(tract, str) or not re.fullmatch(r"\d{11}", tract) or not tract.startswith(county):
        return {"status": "refused_invalid_tract_geoid"}
    if county != profile.fips:
        return {"status": "refused_county_mismatch", "returned_county_geoid": county}
    try:
        lon, lat = float(point["x"]), float(point["y"])
    except (KeyError, TypeError, ValueError):
        return {"status": "refused_missing_coordinate"}
    if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return {"status": "refused_invalid_coordinate"}
    return {
        "status": "census_geography_returned",
        "county_geoid": county,
        "tract_geoid": tract,
        "lat": lat,
        "lon": lon,
        "coordinate_source": "cms_provided" if kind == "nursing_homes" else "census_address_match",
        "address_match_quality": match_quality,
        "address_quality_review_required": kind == "nursing_homes" or match_quality != "Exact",
    }


def replay(directory: Path, profile: CountyProfile = MANATEE) -> list[dict]:
    results = []
    for kind, row, source in source_records(CMS_CAPTURE, profile):
        ccn = row["CMS Certification Number (CCN)"].strip()
        summary = {"ccn": ccn, "kind": kind}
        if source_name(kind, row).lower().startswith("zz_closed_"):
            results.append({**summary, "status": "refused_source_closed_label"})
            continue
        path = directory / f"{kind}-{ccn}.json"
        if not verify(path):
            results.append({**summary, "status": "refused_missing_or_corrupt_capture"})
            continue
        metadata = json.loads(path.with_name(path.name + ".provenance.json").read_text())
        upstream = metadata.get("request_input_source", {})
        if (
            upstream.get("sha256") != sha256_of(source)
            or upstream.get("ccn") != ccn
            or metadata.get("source_url") != query_url(kind, row)
        ):
            results.append({**summary, "status": "refused_input_provenance_mismatch"})
            continue
        results.append({
            **summary, "file": path.name,
            **geography_result(kind, json.loads(path.read_bytes()), row, profile),
        })
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT / "data/snapshot/raw/census")
    parser.add_argument("--replay", type=Path, help="Verify and interpret an existing capture without network calls")
    parser.add_argument("--county", choices=tuple(COUNTIES), default=MANATEE.key)
    args = parser.parse_args()
    profile = county_profile(args.county)
    if args.replay is not None:
        results = replay(args.replay, profile)
        print(json.dumps({"county": profile.name, "results": results, "ranking_ready": False}, indent=2))
        return 0 if all(
            row["status"] in ("census_geography_returned", "refused_source_closed_label")
            for row in results
        ) else 1
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([sys.executable, "-m", "data.adapters.us.capture_census", *sys.argv[1:]])
    results = []
    try:
        benchmarks = preserve(directory, "benchmarks.json", BASE + "/benchmarks?format=json", command)
        vintages = preserve(
            directory, "vintages.json",
            BASE + "/vintages?" + urlencode({"benchmark": BENCHMARK, "format": "json"}),
            command,
        )
        if not any(row.get("benchmarkName") == BENCHMARK for row in benchmarks.get("benchmarks", [])):
            raise ValueError("Required Census benchmark is unavailable")
        if not any(row.get("vintageName") == VINTAGE for row in vintages.get("vintages", [])):
            raise ValueError("Required Census geography vintage is unavailable")
        for kind, row, source in source_records(CMS_CAPTURE, profile):
            ccn = row["CMS Certification Number (CCN)"].strip()
            if not re.fullmatch(r"\d{6}", ccn):
                raise ValueError("Invalid CMS CCN")
            summary = {"ccn": ccn, "kind": kind}
            if source_name(kind, row).lower().startswith("zz_closed_"):
                results.append({**summary, "status": "refused_source_closed_label"})
                continue
            try:
                filename = f"{kind}-{ccn}.json"
                doc = preserve(directory, filename, query_url(kind, row), command, source, ccn)
                results.append({**summary, "file": filename, **geography_result(kind, doc, row, profile)})
            except Exception as error:
                results.append({**summary, "status": "fetch_or_parse_failed", "error": type(error).__name__})
    except Exception as error:
        print(json.dumps({"directory": str(directory), "status": "failed", "error": type(error).__name__}))
        return 1
    print(json.dumps({
        "directory": str(directory), "county": profile.name,
        "county_fips": profile.fips, "results": results,
        "scenario": "Current CMS records with Census2020 geography, not 2024 conditions",
        "runtime_zetaris_query_performed": False, "ranking_ready": False,
    }, indent=2))
    return 0 if all(
        row["status"] in ("census_geography_returned", "refused_source_closed_label")
        for row in results
    ) else 1


if __name__ == "__main__":
    sys.exit(main())
