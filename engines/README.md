Requires Java 21 and the licensed JDBC jar outside Git; set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when bundle paths differ.
Register the private read-only PostGIS connection in Zetaris as `porchlight_postgis`, reachable by the driver on `porchlight-private`; do not put its password in audited SQL.
Run `python -m engines.rank_manatee --register-zetaris-view` to register the source-native bundle view without copying data.
Run `python -m engines.rank_manatee --data-access zetaris --output engines/snapshots/manatee-zetaris.json --reuse-model-snapshot engines/snapshots/manatee-ranked.json`.
Every exported query ID must match a successful vendor audit row; missing JDBC, source registration, audit evidence or changed reusable facts fails closed, with no development fallback.

Cross-source chain: `python -m engines.rank_manatee --register-zetaris-chain`, then `python -m engines.rank_manatee --data-access zetaris_chain --output engines/snapshots/manatee-zetaris-chain.json --reuse-model-snapshot engines/snapshots/manatee-ranked.json`.
Seven separate audited statements select the snapshot, join CMS/Census/spatial results, join tract SVI, join county-qualified emPOWER ZIP aggregates, and read the reference population, warning union and provenance. SQL COUNT/window aggregates measure matches over all 20 source rows, including refusals. Setup query IDs are not attached to rows.
These are separately projected public-source relations in one physical read-only PostGIS datasource, not multiple independently live systems. Spatial predicates remain in PostGIS; relational joins are declared in Zetaris SQL. Cardinality changes, absent provenance or unaudited statements fail closed.
