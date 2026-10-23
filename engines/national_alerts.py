"""Resolve captured live NWS alerts through official geometry, never text geocoding."""

import argparse
import json
import re
from datetime import datetime, timezone

from engines.live_weather import read_live_weather
from engines.national_sources import CENSUS_SQL, DB, NS
from engines.national_run import Chain, county_catalog, literal
from engines.zetaris_client import audited_query, jdbc_query

ALERT_COUNTY_SQL = f"""
SELECT k.capture_id,w.capture_id AS weather_capture_id,a->>'id' AS alert_id,k.fips
FROM {NS}.county k JOIN porch_light.live_weather_capture w ON true
CROSS JOIN LATERAL jsonb_array_elements(w.payload_json::jsonb->'alerts') a
WHERE (
CASE WHEN jsonb_typeof(a->'geometry')='object' AND a->'geometry'->>'type' IN ('Polygon','MultiPolygon')
THEN public.ST_Intersects(k.geom,public.ST_SetSRID(public.ST_GeomFromGeoJSON((a->'geometry')::text),4326))
AND NOT public.ST_Touches(k.geom,public.ST_SetSRID(public.ST_GeomFromGeoJSON((a->'geometry')::text),4326))
ELSE EXISTS(SELECT 1 FROM {NS}.county_zone cz WHERE cz.capture_id=k.capture_id AND cz.fips=k.fips
AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(a->'affectedZones') u
WHERE split_part(u,'/',7)=cz.ugc OR regexp_replace(u,'^.*/','')=cz.ugc))
END)
"""

ALERT_COVERAGE_SQL = f"""
SELECT g.capture_id,g.source_kind,g.ccn,g.county_fips,w.capture_id AS weather_capture_id,
a->>'id' AS alert_id,
CASE WHEN jsonb_typeof(a->'geometry')='object' AND a->'geometry'->>'type' IN ('Polygon','MultiPolygon')
THEN public.ST_Covers(public.ST_SetSRID(public.ST_GeomFromGeoJSON((a->'geometry')::text),4326),
public.ST_SetSRID(public.ST_Point(g.longitude,g.latitude),4326))
WHEN z.covered=true THEN true WHEN jsonb_array_length(a->'affectedZones')>0
AND z.known_count=jsonb_array_length(a->'affectedZones') THEN false
END AS warning_covers,
CASE WHEN jsonb_typeof(a->'geometry')='object' THEN 'official_alert_geometry'
ELSE 'official_affected_zone_geometries' END AS geometry_source,
jsonb_array_length(a->'affectedZones')-COALESCE(z.known_count,0) AS missing_zone_count
FROM ({CENSUS_SQL}) g JOIN porch_light.live_weather_capture w ON true
CROSS JOIN LATERAL jsonb_array_elements(w.payload_json::jsonb->'alerts') a
LEFT JOIN LATERAL (
SELECT COUNT(DISTINCT u) AS known_count,
BOOL_OR(public.ST_Covers(s.geom,public.ST_SetSRID(public.ST_Point(g.longitude,g.latitude),4326))) AS covered
FROM jsonb_array_elements_text(a->'affectedZones') u JOIN {NS}.shape_row s
ON s.capture_id=g.capture_id AND
((s.source_kind='forecast-zones' AND regexp_replace(u,'^.*/','')=
(s.properties->>'STATE')||'Z'||(s.properties->>'ZONE')) OR
(s.source_kind='counties' AND regexp_replace(u,'^.*/','')=
(s.properties->>'STATE')||'C'||RIGHT(s.properties->>'FIPS',3)))
) z ON true
WHERE g.match_status='Match' AND g.match_type='Exact' AND g.longitude BETWEEN -180 AND 180
AND g.latitude BETWEEN -90 AND 90
"""


def register() -> list[dict]:
    output = []
    for name, sql in (("pl_nat_alert_county_v1", ALERT_COUNTY_SQL),
                      ("pl_nat_alert_coverage_v1", ALERT_COVERAGE_SQL)):
        try:
            jdbc_query(f"SELECT * FROM {DB}.{name} LIMIT 0")
        except RuntimeError:
            response = audited_query(f"CREATE DATASOURCE VIEW {name} FROM {DB} AS {sql.strip()}")
            output.append({"view": name, "query_id": response["audit"]["query_id"]})
    return output


def active_scope(weather_capture_id: str | None = None, require_fresh: bool = True) -> dict:
    catalog = county_catalog()
    weather = read_live_weather(weather_capture_id)
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(weather["captured_at"].replace("Z", "+00:00"))).total_seconds()
    if require_fresh and not -60 <= age <= 900:
        raise RuntimeError("Active-alert selection requires a weather capture no older than fifteen minutes")
    chain = Chain()
    capture = catalog["counties"][0]["capture_id"]
    mapped = chain.read("Map official alert geometry or affected zones to source counties", f"""
SELECT alert_id,fips FROM {DB}.pl_nat_alert_county_v1
WHERE capture_id={literal(capture)} AND weather_capture_id={literal(weather["capture_id"])}""")
    universe = {county["fips"] for county in catalog["counties"]}
    mapping = {}
    for row in mapped:
        if row["fips"] in universe:
            mapping.setdefault(row["alert_id"], set()).add(row["fips"])
    now = datetime.now(timezone.utc)
    alerts, excluded = [], []
    for alert in weather["alerts"]:
        expires = alert.get("expires")
        if alert.get("status") != "Actual" or not expires or datetime.fromisoformat(expires.replace("Z", "+00:00")) <= now:
            excluded.append({"alert_id": alert["id"], "reason": "expired_or_non_actual_at_selection"})
            continue
        counties = sorted(mapping.get(alert["id"], set()))
        alerts.append({**alert, "county_fips": counties,
                       "mapping_status": "mapped" if counties else
                       "no_county_intersection" if alert.get("geometry") else "source_zone_mapping_unavailable"})
    return {
        "catalog": catalog, "weather_capture_id": weather["capture_id"], "captured_at": weather["captured_at"],
        "selected_at": now.isoformat(), "age_seconds_at_selection": round(age, 3), "alerts": alerts,
        "excluded": excluded, "active_counties": sorted({fips for alert in alerts for fips in alert["county_fips"]}),
        "mapping_data_access": chain.receipt(), "weather_data_access": weather["data_access"],
        "limits": ["A sweep freezes this alert capture. It does not assert those alerts remain active when the sweep finishes.",
                   "Marine or otherwise unmapped zones remain explicit. No county is guessed from an area-description string."],
    }


def warning_matches(capture: str, weather_capture: str, alert_id: str, fips: str) -> dict:
    if not all(re.fullmatch(r"[a-f0-9]{64}", value) for value in (capture, weather_capture)) or not re.fullmatch(r"\d{5}", fips):
        raise ValueError("Invalid immutable warning/source identifiers")
    if not alert_id.startswith("https://api.weather.gov/alerts/") or len(alert_id) > 500:
        raise ValueError("Only official captured NWS alert identifiers are permitted")
    chain = Chain()
    rows = chain.measured("Source facility points covered by the selected official warning geometry", f"""
SELECT source_kind,ccn,warning_covers,geometry_source,missing_zone_count,COUNT(*) OVER() AS candidate_count,
SUM(CASE WHEN warning_covers=true THEN 1 ELSE 0 END) OVER() AS matched_count
FROM {DB}.pl_nat_alert_coverage_v1 WHERE capture_id={literal(capture)}
AND weather_capture_id={literal(weather_capture)} AND alert_id={literal(alert_id)} AND county_fips='{fips}'""")
    return {"rows": rows, "data_access": chain.receipt()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register", action="store_true")
    args = parser.parse_args()
    print(json.dumps({"registered": register()} if args.register else active_scope(), ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
