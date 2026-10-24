"""Preserve source-rendered transparent NOAA radar and Census state geometry."""

import json
import xml.etree.ElementTree as ElementTree
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from data.provenance.sidecar import sha256_of, verify, write_sidecar

WMS = "https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows"
CAPABILITIES = WMS + "?service=WMS&request=GetCapabilities"
STATES = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?"
    + urlencode({"where": "1=1", "outFields": "NAME,STUSAB", "outSR": 4326,
                 "maxAllowableOffset": 0.03, "f": "geojson"})
)
REGIONS = {
    "conus": ("Contiguous US", "conus_base_reflectivity_mosaic"),
    "alaska": ("Alaska", "alaska_base_reflectivity_mosaic"),
    "hawaii": ("Hawaii", "hawaii_base_reflectivity_mosaic"),
    "caribbean": ("Caribbean", "caribbean_base_reflectivity_mosaic"),
    "guam": ("Guam", "guam_base_reflectivity_mosaic"),
}
NS = {"w": "http://www.opengis.net/wms"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("Cartographic source capture refuses redirects")


def preserve(url: str, target: Path, license_line: str) -> bytes:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in (
        "nowcoast.noaa.gov", "tigerweb.geo.census.gov"
    ):
        raise ValueError("Unexpected radar-map source")
    with build_opener(NoRedirect()).open(Request(url, headers={
        "User-Agent": "PorchLight (joe@joepro.ai)"
    }), timeout=40) as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("Radar-map source exceeds capture limit")
    target.write_bytes(raw)
    write_sidecar(target, url, license_line, "python -m data.adapters.us.capture_live_weather",
                  datetime.now(timezone.utc).isoformat(timespec="seconds"))
    if not verify(target):
        raise ValueError("Radar-map source provenance failed")
    return raw


def capture_maps(folder: Path) -> dict:
    noaa_license = "US NOAA public data; https://www.noaa.gov/disclaimer"
    census_license = "US Census Bureau public data; https://www.census.gov/about/policies.html"
    capabilities_file = folder / "noaa-radar-capabilities.xml"
    capabilities = preserve(CAPABILITIES, capabilities_file, noaa_license)
    document = ElementTree.fromstring(capabilities)
    layers = {
        layer.findtext("w:Name", namespaces=NS): layer
        for layer in document.findall(".//w:Layer", NS)
        if layer.findtext("w:Name", namespaces=NS)
    }
    state_file = folder.parent / "census-state-boundaries.geojson"
    if not state_file.exists() or not verify(state_file):
        preserve(STATES, state_file, census_license)
    states = json.loads(state_file.read_bytes())
    if states.get("type") != "FeatureCollection" or not states.get("features"):
        raise ValueError("Census state source returned no actual features")
    legend_url = WMS + "?" + urlencode({
        "service": "WMS", "request": "GetLegendGraphic", "version": "1.1.1",
        "format": "image/png", "layer": "conus_base_reflectivity_mosaic",
        "style": "weather_radar_base_reflectivity",
    })
    legend_file = folder / "noaa-radar-legend.png"
    legend = preserve(legend_url, legend_file, noaa_license)
    if not legend.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Official radar legend is not a PNG")
    regions = {}
    for key, (name, layer_name) in REGIONS.items():
        try:
            layer = layers[layer_name]
            box = layer.find("w:EX_GeographicBoundingBox", NS)
            if box is None:
                raise ValueError("Provider layer has no declared geographic bounds")
            bbox = [
                float(box.findtext("w:westBoundLongitude", namespaces=NS)),
                float(box.findtext("w:southBoundLatitude", namespaces=NS)),
                float(box.findtext("w:eastBoundLongitude", namespaces=NS)),
                float(box.findtext("w:northBoundLatitude", namespaces=NS)),
            ]
            dimension = next(
                item for item in layer.findall("w:Dimension", NS)
                if item.attrib.get("name") == "time"
            )
            frame_time = dimension.attrib["default"]
            advertised = {
                datetime.fromisoformat(item.strip().replace("Z", "+00:00"))
                for item in (dimension.text or "").split(",") if item.strip()
            }
            if not frame_time or datetime.fromisoformat(frame_time.replace("Z", "+00:00")) not in advertised:
                raise ValueError("Provider latest frame is absent from its published time dimension")
            url = WMS + "?" + urlencode({
                "service": "WMS", "version": "1.1.1", "request": "GetMap",
                "layers": layer_name, "styles": "weather_radar_base_reflectivity",
                "srs": "EPSG:4326", "bbox": ",".join(map(str, bbox)),
                "width": 1200, "height": 700, "format": "image/png",
                "transparent": "true", "time": frame_time,
            })
            image_file = folder / f"noaa-radar-{key}.png"
            image = preserve(url, image_file, noaa_license)
            if not image.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Provider frame is not a PNG")
            regions[key] = {
                "available": True, "name": name, "layer": layer_name,
                "frame_time": frame_time, "bbox": bbox, "crs": "EPSG:4326",
                "width": 1200, "height": 700, "sha256": sha256_of(image_file),
                "file_path": str(image_file), "source_url": url,
                "legend_sha256": sha256_of(legend_file), "legend_file_path": str(legend_file),
                "legend_source_url": legend_url,
            }
        except Exception as error:
            regions[key] = {
                "available": False, "name": name, "error_type": type(error).__name__,
                "detail": "No verified provider frame. No replacement radar is drawn.",
            }
    return {
        "available": any(region["available"] for region in regions.values()),
        "regions": regions, "states": states,
        "state_source": {
            "source_url": STATES, "sha256": sha256_of(state_file),
            "fetched_at": json.loads(state_file.with_name(state_file.name + ".provenance.json").read_text())["fetched_at_utc"],
        },
        "capabilities_source": {"source_url": CAPABILITIES, "sha256": sha256_of(capabilities_file)},
        "limits": [
            "Night and chart themes change the basemap only. NOAA radar pixels and legend are not recolored.",
            "Latest observed source frame, not a forecast, storm-track prediction or facility-status report.",
            "Radar coverage within each provider region can have gaps. A blank pixel does not prove safe conditions.",
            "Warning polygons are the actual NWS shapes. Alerts without a polygon remain in the source list.",
        ],
    }
