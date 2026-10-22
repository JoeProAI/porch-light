Requires Java 21 and the licensed JDBC jar outside Git; set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when bundle paths differ.
Register the private read-only PostGIS connection in Zetaris as `porchlight_postgis`, reachable by the driver on `porchlight-private`; do not put its password in audited SQL.
Run `python -m engines.rank_manatee --register-zetaris-view` to register the source-native bundle view without copying data.
Run `python -m engines.rank_manatee --data-access zetaris --output engines/snapshots/manatee-zetaris.json --reuse-model-snapshot engines/snapshots/manatee-ranked.json`.
Every exported query ID must match a successful vendor audit row; missing JDBC, source registration, audit evidence or changed reusable facts fails closed, with no development fallback.
