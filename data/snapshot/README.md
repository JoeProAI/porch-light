# data/snapshot/

The local PostGIS snapshot: the golden path's only data store. Zetaris REST
refetches per query, so we never read live sources at runtime. Adapters under
`data/adapters/us/` fetch raw files here (with provenance sidecars) and load
them into PostGIS; Zetaris reads PostGIS through a registered JDBC datasource.

## Layout (grows as loads land)

- `raw/<source_key>/`: raw cached artifacts + `.provenance.json` sidecars.
- `ddl/`: table DDL (facilities, zones, tracts, warning areas, plan_sections).
- `load/`: per-source load scripts called by the adapters.

EOC snapshot mode: a snapshot directory plus `snapshot_id` and data-as-of
stamps, synced to the offline box. Lands Sat Oct 24.

Live NWS alerts reach the app through this snapshot: the adapter captures the
active-alerts feed into `raw/nws_alerts/` (with sidecars) and loads it into
PostGIS; the app reads only through Zetaris. Plan, unverified until gate G2.
