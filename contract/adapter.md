# Country adapter interface

Porch Light's contract knows nothing about the US. Everything country
specific sits behind this interface, implemented under
`data/adapters/<country>/`. The US adapter (`data/adapters/us/`) is the
core. A global open-data adapter (`data/adapters/global/`) is a stretch
goal gated on the US golden path going green.

Two layers, and they must not blur:

1. **Build time** (`fetch`, `load`, `provenance`): adapters download raw
   files into `data/snapshot/raw/<source_key>/`, write `.provenance.json`
   sidecars with `data/provenance/sidecar.py`, and load them into the
   PostGIS snapshot. This matches the skeleton in
   `data/adapters/us/README.md`.
2. **Contract surface** (the methods below): typed answers the USL maps
   into the shared `facility`, `tract`, `zip_area`, `county`,
   `alert_zone`, `alert`, `plan_section` model. At runtime the app reads
   only through Zetaris SQL. No adapter method may call a model or read
   a source directly at runtime.

The typed surface is in `contract/types/adapter.ts` and
`contract/types/adapter.py`.

## Methods

| Method | Returns (contract type) | US adapter | Global adapter (stretch) |
|---|---|---|---|
| `alerts(mode)` (`archived` or `live`) | `Alert[]`, `Zone[]` | NWS API, IEM archive, NWS zones | GDACS events; national met-service CAP feed where one exists |
| `areas(zone)` | `Zone[]` admin areas and small areas inside the warning | county FIPS, Census tracts | OSM admin boundaries, WorldPop grid cells |
| `facilities(area)` | `Facility[]` | CMS dialysis and nursing homes keyed by `ccn` | OSM `amenity=hospital|clinic|doctors`, `healthcare=dialysis|*`, `social_facility=nursing_home|assisted_living` keyed by `osm_id` |
| `vulnerability(area)` | `Fact[]` with source ids | CDC/ATSDR SVI | WorldPop population |
| `dependents(area)` | `Fact[]`, aggregate counts only | HHS emPOWER (ZIP, county) | none in open data; the UI says so plainly |
| `rule_cites(facility_type)` | `RuleCite[]` | CMS Emergency Preparedness rule (42 CFR 483.73, 494.62) | none by default; national cites only if found and sourced |
| `freshness()` | `DataAsOf[]` per source | dataset `modified` stamps | OSM timestamp, WorldPop release year, GDACS event time |

## Keys and the `country` field

Every type carries `country` (lowercase adapter key, `us`, `jm`, `ph`,
...). Keys are typed pairs (`ExternalKey`) so one USL can hold several
countries without collisions:

- US: `ccn` for facilities, `fips` for counties, `tract_geoid`, `zip`,
  `ugc` / `nws_zone`, `ssa_county` (pre-crosswalk).
- Global: `osm_id` for facilities, `worldpop_cell`, `gdacs_event`,
  `cap_id` for alert areas.

`ExternalKeyType` in `contract/openapi.yaml` is the enum to extend when a
new adapter needs a new key type. Adding a value is a contract change and
goes in its own PR.

## Measured joins, never model confidence

Nemotron may propose a join path, but only a Zetaris SQL count gives the
match rate that lands in `JoinProposal.measured_match_rate` and in each
`JoinHop`. Failed joins surface through Zetaris DQ
(`SHOW DQ ALL INVALID TABLE`) as `FailedJoin` rows with the reason.

## What an adapter may not do

- No model calls. Explanations belong to the engines.
- No runtime source calls. The app reads through Zetaris only.
- No personal data. Dependents are aggregate counts, masked by the source.
- No invented values. Missing data is an empty or typed error state, and
  every fixture is marked mock.
