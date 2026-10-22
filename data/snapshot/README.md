# data/snapshot/

The local PostGIS snapshot is the planned golden-path data store. Adapters under
`data/adapters/us/` fetch raw files here (with provenance sidecars) and load
them into PostGIS. Runtime reads must use Zetaris SQL through a registered JDBC
datasource. The ingest preflight is not an application API or a substitute for
a real Zetaris query/audit record.

## Layout

- `raw/<source_key>/`: raw cached artifacts + `.provenance.json` sidecars.
- `schema.sql`: real source tables, geometry, warning unions and JDBC-safe export views.
- `load_snapshot.py`: transactional, append-only imports of verified pilot inputs.
- `db.py`: administration restricted to the dedicated local container.
- `reader.py`: private read-only credential provisioning and authenticated verification.

EOC snapshot mode: a snapshot directory plus `snapshot_id` and data-as-of
stamps, synced to the offline box. Lands Sat Oct 24.

Live NWS alerts reach the app through this snapshot: the adapter captures the
active-alerts feed into `raw/nws_alerts/` (with sidecars) and loads it into
PostGIS; the app reads only through Zetaris. Plan, unverified until gate G2.

## Isolated Local Database

`compose.yaml` pins the official Linux amd64 PostGIS 16/3.5 image by digest.
The verified image was pushed August 31, 2026, with a reported compressed size
of 217,185,121 bytes. This file does not install or start anything by itself.
Joe approved the local setup. The pinned image is installed and the dedicated
database is running with PostGIS 3.5.2.

The database uses only the dedicated internal `porchlight-private` Docker network
and its own volume. No host port is published. Docker's internal-network mode did
not activate the proposed loopback binding, so that ineffective declaration was
removed rather than advertised as a working endpoint.
It does not reuse the unrelated database on port 5432.
Never delete volumes, truncate existing tables or change unrelated services.

`PORCHLIGHT_POSTGIS_ENV_FILE` must point to a private file outside the repo,
under Joe's restricted `.porchlight` folder. Required variables in that file
are `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD`. Credentials must be
generated/stored privately, not passed in command arguments or printed.

Validate the Compose structure without reading credentials, pulling an image
or starting a service:

```powershell
docker compose -f data/snapshot/compose.yaml config --no-interpolate --no-env-resolution --quiet
```

## Load And Verify Real Inputs

```powershell
python -m data.snapshot.load_snapshot --county manatee --county sarasota
python -m data.snapshot.reader
python -m unittest data.snapshot.test_database -v
```

These commands use the real dedicated database. There is no mocked SQL server
or synthetic seed data. Imports preserve source records, retain immutable source
metadata, and use a hash of the selected inputs and transformation code to identify
the loaded snapshot. Loading the same inputs again does not duplicate records.
An existing source identity with changed content is refused, not overwritten.

The current snapshot contains 20 Manatee source rows and 42 Sarasota source rows.
Actual SQL confirms 18 and 40 geography observations, respectively. Current
published warning-zone unions cover 18 and 39 points. These are not verified
historical 2024 boundaries or clinical priorities.

The private reader credential file is `.porchlight/postgis-read.env` under the
user's home, outside Git. TCP password authentication is tested inside the
container. The role defaults to read-only transactions and cannot insert, update
or delete source tables. Future operator-private tables are not automatically
granted to this role.

Register `porch_light.facility_export`, `porch_light.warning_area_export` and
`porch_light.source_artifact_export` through the licensed Zetaris JDBC connection.
They expose scalar values and JSON text, not JDBC-unsupported raw geometry/jsonb.
The driver must join the private data network and use
`jdbc:postgresql://porchlight-postgis:5432/porchlight` with the restricted role.

A running database, a health check or even these actual PostGIS queries does not
close G2. Zetaris must register
the database through JDBC and execute a real spatial query with retained query
and audit evidence.

## Zetaris Prerequisites

The official local installation guide requires the licensed platform archive,
its matching private `.env`, registry credentials and installation entitlement.
The getting-started recipes are Apache-licensed; the platform images are not
therefore freely licensed for an ongoing service.

Use the sponsor/account portal's supported local bundle. Do not invent a
platform image, silently switch to AWS, accept terms or claim credits.
Current documentation places direct REST at `/api/v1.0`, commonly on port
8888, and the UI commonly on port 3000. Verify the actual bundle and port
bindings before running it; this machine already has an unrelated listener on
3000. No licensed bundle was found in Downloads during this check.
