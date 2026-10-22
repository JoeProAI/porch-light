CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS porch_light;

CREATE TABLE IF NOT EXISTS porch_light.source_artifact (
    artifact_path text PRIMARY KEY,
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    source_url text NOT NULL,
    fetched_at timestamptz NOT NULL,
    license text NOT NULL,
    metadata jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS porch_light.ingest_snapshot (
    snapshot_hash text PRIMARY KEY CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
    manifest jsonb NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS porch_light.snapshot_artifact (
    snapshot_hash text REFERENCES porch_light.ingest_snapshot,
    artifact_path text REFERENCES porch_light.source_artifact,
    PRIMARY KEY (snapshot_hash, artifact_path)
);

CREATE TABLE IF NOT EXISTS porch_light.county_profile (
    snapshot_hash text REFERENCES porch_light.ingest_snapshot,
    county_fips text NOT NULL CHECK (county_fips ~ '^[0-9]{5}$'),
    county_name text NOT NULL,
    state_code text NOT NULL,
    plan_artifact_path text REFERENCES porch_light.source_artifact,
    PRIMARY KEY (snapshot_hash, county_fips)
);

CREATE TABLE IF NOT EXISTS porch_light.facility_source (
    snapshot_hash text NOT NULL,
    county_fips text NOT NULL,
    source_kind text NOT NULL CHECK (source_kind IN ('nursing_homes', 'dialysis')),
    ccn text NOT NULL CHECK (ccn ~ '^[0-9]{6}$'),
    source_artifact_path text NOT NULL REFERENCES porch_light.source_artifact,
    raw_record jsonb NOT NULL,
    geography_artifact_path text REFERENCES porch_light.source_artifact,
    geography_observation jsonb NOT NULL,
    geom geometry(Point, 4326),
    PRIMARY KEY (snapshot_hash, source_kind, ccn),
    FOREIGN KEY (snapshot_hash, county_fips) REFERENCES porch_light.county_profile
);

CREATE INDEX IF NOT EXISTS facility_source_geom_idx
    ON porch_light.facility_source USING gist (geom);

CREATE TABLE IF NOT EXISTS porch_light.svi_tract (
    snapshot_hash text REFERENCES porch_light.ingest_snapshot,
    tract_fips text CHECK (tract_fips ~ '^[0-9]{11}$'),
    source_artifact_path text NOT NULL REFERENCES porch_light.source_artifact,
    raw_record jsonb NOT NULL,
    PRIMARY KEY (snapshot_hash, tract_fips)
);

CREATE TABLE IF NOT EXISTS porch_light.empower_zip (
    snapshot_hash text REFERENCES porch_light.ingest_snapshot,
    object_id bigint NOT NULL,
    zip_code text,
    county_fips text,
    source_artifact_path text NOT NULL REFERENCES porch_light.source_artifact,
    raw_record jsonb NOT NULL,
    PRIMARY KEY (snapshot_hash, object_id)
);

CREATE INDEX IF NOT EXISTS empower_zip_join_idx
    ON porch_light.empower_zip (snapshot_hash, zip_code, county_fips);

CREATE TABLE IF NOT EXISTS porch_light.warning_zone (
    snapshot_hash text NOT NULL,
    county_fips text NOT NULL,
    zone_id text NOT NULL,
    source_artifact_path text NOT NULL REFERENCES porch_light.source_artifact,
    raw_record jsonb NOT NULL,
    geom geometry(Geometry, 4326) NOT NULL CHECK (ST_IsValid(geom)),
    PRIMARY KEY (snapshot_hash, county_fips, zone_id),
    FOREIGN KEY (snapshot_hash, county_fips) REFERENCES porch_light.county_profile
);

CREATE INDEX IF NOT EXISTS warning_zone_geom_idx
    ON porch_light.warning_zone USING gist (geom);

CREATE OR REPLACE VIEW porch_light.county_warning_area AS
SELECT snapshot_hash, county_fips, ST_UnaryUnion(ST_Collect(geom)) AS geom,
       'current_NWS_zone_union'::text AS geometry_vintage,
       false AS historical_2024_equivalence_verified
FROM porch_light.warning_zone
GROUP BY snapshot_hash, county_fips;

CREATE OR REPLACE VIEW porch_light.facility_context AS
SELECT f.snapshot_hash, f.county_fips, c.county_name, f.source_kind, f.ccn,
       COALESCE(f.raw_record->>'Provider Name', f.raw_record->>'Facility Name') AS facility_name,
       f.raw_record->>'Telephone Number' AS source_phone,
       f.geography_observation->>'status' AS geography_status,
       f.geography_observation->>'tract_geoid' AS tract_geoid,
       f.geography_observation->>'coordinate_source' AS coordinate_source,
       f.geography_observation->'address_quality_review_required' AS address_quality_review_required,
       f.geom,
       CASE WHEN f.geom IS NOT NULL THEN ST_Covers(a.geom, f.geom) END AS warning_covers,
       CASE WHEN f.geom IS NOT NULL THEN ST_Contains(a.geom, f.geom) END AS warning_interior,
       CASE WHEN (s.raw_record->>'RPL_THEMES') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN CASE WHEN (s.raw_record->>'RPL_THEMES')::numeric BETWEEN 0 AND 1
                      THEN (s.raw_record->>'RPL_THEMES')::numeric END
            END AS national_svi_percentile,
       h.source_row_count AS empower_source_row_count,
       CASE WHEN h.source_row_count = 1 THEN h.raw_record->>'Power_Dependent_Devices_DME'
            END AS reported_zip_dme_count,
       CASE WHEN h.source_row_count = 1 THEN h.raw_record->>'Medicare_Benes'
            END AS reported_zip_medicare_beneficiaries,
       CASE WHEN h.source_row_count = 1
            THEN (h.raw_record->>'Power_Dependent_Devices_DME')::integer = 11
            END AS small_count_caution,
       'ZIP aggregate, not facility patients'::text AS empower_scope,
       c.plan_artifact_path IS NOT NULL AS archived_plan_captured,
       false AS plan_applicability_verified,
       false AS ranking_ready,
       false AS zetaris_query_performed,
       CASE WHEN f.geom IS NOT NULL
            THEN ST_Distance(f.geom::geography, a.geom::geography)
            END AS distance_to_current_zone_m
FROM porch_light.facility_source f
JOIN porch_light.county_profile c USING (snapshot_hash, county_fips)
LEFT JOIN porch_light.county_warning_area a USING (snapshot_hash, county_fips)
LEFT JOIN porch_light.svi_tract s
  ON s.snapshot_hash = f.snapshot_hash
 AND s.tract_fips = f.geography_observation->>'tract_geoid'
LEFT JOIN LATERAL (
    SELECT count(*) AS source_row_count, (jsonb_agg(e.raw_record)->0) AS raw_record
    FROM porch_light.empower_zip e
    WHERE e.snapshot_hash = f.snapshot_hash
      AND e.zip_code = f.raw_record->>'ZIP Code'
      AND e.county_fips = f.geography_observation->>'county_geoid'
) h ON true;

CREATE OR REPLACE VIEW porch_light.facility_export AS
SELECT x.snapshot_hash,x.county_fips,x.county_name,x.source_kind,x.ccn,
       x.facility_name,x.source_phone,x.geography_status,x.tract_geoid,
       x.coordinate_source,
       (f.geography_observation->>'address_quality_review_required')::boolean
           AS address_quality_review_required,
       ST_X(x.geom) AS longitude,ST_Y(x.geom) AS latitude,
       ST_AsGeoJSON(x.geom,15) AS point_geojson,
       x.warning_covers,x.warning_interior,x.distance_to_current_zone_m,
       x.national_svi_percentile,x.empower_source_row_count,
       x.reported_zip_dme_count,x.reported_zip_medicare_beneficiaries,
       x.small_count_caution,x.empower_scope,x.archived_plan_captured,
       x.plan_applicability_verified,x.ranking_ready,x.zetaris_query_performed,
       f.source_artifact_path,f.geography_artifact_path,
       f.raw_record::text AS source_record_json,
       f.geography_observation::text AS geography_evidence_json
FROM porch_light.facility_context x
JOIN porch_light.facility_source f USING (snapshot_hash,source_kind,ccn);

CREATE OR REPLACE VIEW porch_light.warning_area_export AS
SELECT snapshot_hash,county_fips,ST_AsGeoJSON(geom,15) AS geometry_geojson,
       geometry_vintage,historical_2024_equivalence_verified
FROM porch_light.county_warning_area;

CREATE OR REPLACE VIEW porch_light.source_artifact_export AS
SELECT artifact_path,sha256,source_url,fetched_at,license,metadata::text AS metadata_json
FROM porch_light.source_artifact;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porchlight_reader') THEN
        CREATE ROLE porchlight_reader NOLOGIN;
    END IF;
END $$;
GRANT USAGE ON SCHEMA porch_light TO porchlight_reader;
GRANT SELECT ON porch_light.source_artifact, porch_light.ingest_snapshot,
    porch_light.snapshot_artifact, porch_light.county_profile,
    porch_light.facility_source, porch_light.svi_tract, porch_light.empower_zip,
    porch_light.warning_zone, porch_light.county_warning_area,
    porch_light.facility_context,porch_light.facility_export,
    porch_light.warning_area_export,porch_light.source_artifact_export TO porchlight_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA porch_light REVOKE SELECT ON TABLES FROM porchlight_reader;
