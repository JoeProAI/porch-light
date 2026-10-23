"""Register separate national source relations through the licensed Zetaris connection."""

import argparse
import json

from engines.zetaris_client import audited_query, jdbc_query

DB = "porchlight_postgis"
NS = "porch_light_national"

CMS_SQL = f"""
SELECT capture_id,source_kind,record_key AS ccn,source_file,raw_record::text AS raw_record_json,
COALESCE(raw_record->>'Provider Name',raw_record->>'Facility Name') AS facility_name,
raw_record->>'Telephone Number' AS source_phone,raw_record->>'State' AS state,
raw_record->>'County/Parish' AS county_name,LEFT(raw_record->>'ZIP Code',5) AS zip_code,
COALESCE(raw_record->>'Provider Address',raw_record->>'Address Line 1') AS address,
CASE WHEN COALESCE(raw_record->>'Overall Rating',raw_record->>'Five Star') ~ '^[1-5](\\.0*)?$'
THEN COALESCE(raw_record->>'Overall Rating',raw_record->>'Five Star')::double precision END AS cms_stars,
COALESCE(raw_record->>'Provider Name',raw_record->>'Facility Name') ILIKE 'zz_closed_%' AS source_marked_closed
FROM {NS}.source_row WHERE source_kind IN ('nursing_homes','dialysis')
"""

CENSUS_SQL = f"""
SELECT capture_id,record_key,source_file,raw_record::text AS geography_evidence_json,
split_part(record_key,':',1) AS source_kind,split_part(record_key,':',2) AS ccn,
raw_record->>2 AS match_status,raw_record->>3 AS match_type,
CASE WHEN raw_record->>2='Match' THEN (raw_record->>8)||(raw_record->>9) END AS county_fips,
CASE WHEN raw_record->>2='Match' THEN (raw_record->>8)||(raw_record->>9)||(raw_record->>10) END AS tract_geoid,
CASE WHEN raw_record->>2='Match' AND raw_record->>5 ~ '^-?[0-9]+(\\.[0-9]+)?, *-?[0-9]+(\\.[0-9]+)?$'
THEN split_part(raw_record->>5,',',1)::double precision END AS longitude,
CASE WHEN raw_record->>2='Match' AND raw_record->>5 ~ '^-?[0-9]+(\\.[0-9]+)?, *-?[0-9]+(\\.[0-9]+)?$'
THEN split_part(raw_record->>5,',',2)::double precision END AS latitude
FROM {NS}.source_row WHERE source_kind='census'
"""

EMPOWER_SQL = f"""
SELECT capture_id,record_key,source_file,raw_record->>'FIPS_Code' AS county_fips,
raw_record->>'Zip_Code_Recode' AS zip_code,
CASE WHEN raw_record->>'Power_Dependent_Devices_DME' ~ '^[0-9]+$'
THEN (raw_record->>'Power_Dependent_Devices_DME')::integer END AS dme_count,
CASE WHEN raw_record->>'Medicare_Benes' ~ '^[0-9]+$'
THEN (raw_record->>'Medicare_Benes')::integer END AS medicare_beneficiaries
FROM {NS}.source_row WHERE source_kind='empower'
"""

VIEWS = {
    "pl_nat_capture_v1": f"SELECT * FROM {NS}.capture",
    "pl_nat_county_v1": (
        f"SELECT capture_id,fips,state,name,public.ST_AsGeoJSON(geom,15) AS geometry_geojson,"
        f"public.ST_IsValid(geom) AS geometry_valid,raw_record_count FROM {NS}.county"
    ),
    "pl_nat_county_catalog_v3": f"""
SELECT co.capture_id,co.record_key AS fips,st.raw_record->>'STUSAB' AS state,
co.raw_record->>'BASENAME' AS name,co.raw_record->>'NAME' AS full_name,
public.ST_AsGeoJSON(k.geom,15) AS geometry_geojson,public.ST_IsValid(k.geom) AS geometry_valid,
k.raw_record_count,k.source_name AS geometry_source
FROM {NS}.source_row co JOIN {NS}.source_row st ON co.capture_id=st.capture_id
AND st.source_kind='census-states' AND co.raw_record->>'STATE'=st.record_key
LEFT JOIN {NS}.county k ON co.capture_id=k.capture_id AND co.record_key=k.fips
WHERE co.source_kind='census-counties'
""",
    "pl_nat_county_zone_v1": f"SELECT * FROM {NS}.county_zone",
    "pl_nat_cms_v1": CMS_SQL,
    "pl_nat_census_v1": CENSUS_SQL,
    "pl_nat_spatial_v1": f"""
SELECT g.capture_id,g.record_key,g.source_kind,g.ccn,
CASE WHEN g.match_status='Match' AND g.match_type='Exact' AND g.longitude BETWEEN -180 AND 180
AND g.latitude BETWEEN -90 AND 90 THEN public.ST_Covers(k.geom,
public.ST_SetSRID(public.ST_Point(g.longitude,g.latitude),4326)) END AS county_covers
FROM ({CENSUS_SQL}) g LEFT JOIN {NS}.county k
ON g.capture_id=k.capture_id AND g.county_fips=k.fips
""",
    "pl_nat_spatial_v2": f"""
SELECT g.capture_id,g.record_key,g.source_kind,g.ccn,g.county_fips,
CASE WHEN g.match_status='Match' AND g.match_type='Exact' AND g.longitude BETWEEN -180 AND 180
AND g.latitude BETWEEN -90 AND 90 THEN public.ST_Covers(k.geom,
public.ST_SetSRID(public.ST_Point(g.longitude,g.latitude),4326)) END AS county_covers
FROM ({CENSUS_SQL}) g LEFT JOIN {NS}.county k
ON g.capture_id=k.capture_id AND g.county_fips=k.fips
""",
    "pl_nat_svi_v1": f"""
SELECT capture_id,record_key AS tract_geoid,source_file,
CASE WHEN raw_record->>'RPL_THEMES' ~ '^[0-9]+(\\.[0-9]+)?$'
THEN CASE WHEN (raw_record->>'RPL_THEMES')::numeric BETWEEN 0 AND 1
THEN (raw_record->>'RPL_THEMES')::double precision END END AS svi_pct
FROM {NS}.source_row WHERE source_kind='svi-tract'
""",
    "pl_nat_empower_v1": EMPOWER_SQL,
    "pl_nat_zip_reference_v2": f"""
SELECT capture_id,county_fips,zip_code,dme_count,medicare_beneficiaries,
((RANK() OVER(PARTITION BY capture_id,county_fips ORDER BY ratio)-1)
+(COUNT(*) OVER(PARTITION BY capture_id,county_fips,ratio))/2.0)
/(COUNT(*) OVER(PARTITION BY capture_id,county_fips)) AS density_pct,
COUNT(*) OVER(PARTITION BY capture_id,county_fips) AS reference_rows
FROM (
SELECT capture_id,county_fips,zip_code,MAX(dme_count) AS dme_count,
MAX(medicare_beneficiaries) AS medicare_beneficiaries,
MAX(dme_count)::numeric/NULLIF(MAX(medicare_beneficiaries),0) AS ratio
FROM ({EMPOWER_SQL}) e GROUP BY capture_id,county_fips,zip_code
HAVING COUNT(*)=1 AND (MAX(dme_count)=0 OR MAX(dme_count)>11)
AND MAX(medicare_beneficiaries)>0 AND MAX(dme_count)<=MAX(medicare_beneficiaries)) eligible
""",
    "pl_nat_artifact_v1": f"SELECT * FROM {NS}.artifact",
    "pl_nat_alert_v1": f"""
SELECT capture_id,record_key AS alert_id,source_file,raw_record::text AS feature_json
FROM {NS}.source_row WHERE source_kind='alert'
""",
}


def register() -> list[dict]:
    output = []
    for name, sql in VIEWS.items():
        try:
            jdbc_query(f"SELECT * FROM {DB}.{name} LIMIT 0")
        except RuntimeError:
            result = audited_query(f"CREATE DATASOURCE VIEW {name} FROM {DB} AS {sql.strip()}")
            output.append({"view": name, "query_id": result["audit"]["query_id"]})
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register", action="store_true", required=True)
    parser.parse_args()
    print(json.dumps({"registered": register()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
