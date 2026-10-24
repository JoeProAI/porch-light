# Published national pack

Frozen audited catalog and per-county sweep snapshots for **hosted GET** on porchlight.earth.

- Source sweep: `20261023T200048Z-78a426ba` (3,235 counties attempted; 2,490 with ranked facilities).
- Rebuild: `python engines/publish_national_static.py` on a machine that has the private sweep filestore.
- Hosted `/api/national` serves this pack without Zetaris keys.
- Live catalog refresh, alert runs, call scripts, and Nemotron POST remain local-origin only (`127.0.0.1:3101`).
- County geometry coordinates are stripped to keep the pack deployable; rankings and audit IDs are unchanged.

Do not invent substitute counties or model text when a snapshot is missing.
