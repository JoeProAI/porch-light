# Porch Light

Porch Light is a care-facility outreach workbench for dialysis centers and nursing homes. You open a US county and get a ranked call sheet: directory phones, the score terms behind each row, the rows that refused to join, and a grounded Nemotron draft when that snapshot has one.

The live desk is [https://porchlight.earth](https://porchlight.earth). It is `noindex`. Home leads with **Pick any US county**. The hosted site serves a frozen Zetaris audit (sweep `20261023T200048Z-78a426ba`, catalog publication `2026-10-24T16:47:04Z`). It does not start a new model call.

Recording path:

1. [porchlight.earth/nationwide](https://porchlight.earth/nationwide)
2. [Anchorage, AK `02020`](https://porchlight.earth/nationwide?county=02020): 6 CMS rows, 4 ranked, 2 refused, 4 failed drafts kept
3. [Doña Ana, NM `35013`](https://porchlight.earth/nationwide?county=35013): 11 CMS rows, 7 ranked, 4 refused, 7 passed Lightning drafts
4. [Harris, TX `48201`](https://porchlight.earth/nationwide?county=48201): 236 CMS rows, 140 ranked, 96 refused, 140 passed drafts
5. Optional coda, under about 20 seconds: [Hurricane Milton](https://porchlight.earth/operate)

Those county figures were read from `GET /api/national?county=` on 2026-10-25 and match `web/data/national/published/`.

The catalog has 3,235 counties (Zetaris query `833`). The hosted pack has 3,234 snapshots and 2,490 counties with ranked rows. The source report's separate Robertson County retry brings the audited-chain count to 3,235 of 3,235 and the ranked-county count to 2,491. That retry is not in the hosted pack: `GET /api/national?county=48395` returns 503 and does not substitute Manatee. Drafts in the pack: 14,960 passed and 480 failed of 15,440 ranked rows. The formula ranks. Nemotron does not.

Leave unsaid: an offline or local DGX run, H-MEM, World Model, Markovian, drafts for every county, a reach-out that did not happen, and Manatee as the product.

Built for the GenAI.Works Open Agent Hackathon 2026, Track 01 (Solving Fragmented Intelligence), by team Burden of Proof. The repo stays private until submission. License is AGPL-3.0-only (`LICENSE`, `NOTICE`).

## Who built it

Joe Gaither directed the project: decisions, review, and merges.

Devin wrote the contract ([PR #14](https://github.com/JoeProAI/porch-light/pull/14)), the data adapters, the engines, and most of the web application, including the Milton call sheet.

Cursor cloud agents wrote [Storm Watch and the Storm Glass Desk (PR #22)](https://github.com/JoeProAI/porch-light/pull/22) and [the national web wiring (PR #24)](https://github.com/JoeProAI/porch-light/pull/24). Both are merged. Home on main ([PR #47](https://github.com/JoeProAI/porch-light/pull/47)) is the nationwide-first page. What the Cursor evidence includes, and what it does not count, is in `ops/build-log/cursor/README.md`. This repository does not record Cursor token counts or spend.

## What the desk does

1. `/` states the limits and links to the county run. A footer text link, **Hurricane Milton retrospective**, opens `/operate`.
2. `/nationwide` searches the Census catalog by name, state, or FIPS. On the host, **Open published audited call sheet** reads that county's snapshot. On loopback, the same action starts `engines.national_jobs`.
3. `/operate` with no query is the Milton sheet: 18 ranked rows, 2 refusals, formula `manatee-development-v1`. `/operate?county=` redirects to `/nationwide` and does not load Milton for a failed county code. Hosted Manatee `12081` is a different sheet: 14 ranked rows on the national screen.
4. Contact status starts at **Not contacted** and is stored in the browser. CSV and print stay on the device. The app does not place calls or send messages.
5. **Generate live Nemotron call script** is local-origin only. Scout Intent classifies the request and the executor checks a signed contract before the provider call. One retained receipt is CCN `102853` in `engines/reports/scout-intent-live-2026-10-23.json` (`rcpt_req_qsa07grv`, `actual_usd` 0).
6. `/watch` is captured official weather. The hosted county catalog does not refresh live alerts.

If local Zetaris cannot be reached, the national page says so and returns no rows.

## Counts to keep apart

| Count | Value | Source |
| --- | --- | --- |
| Catalog counties | 3,235 | Published catalog, query `833` |
| Hosted snapshots | 3,234 | `web/data/national/published/counties/` |
| Hosted counties with ranked rows | 2,490 | Catalog outcome `complete_with_ranked_rows` |
| Source-audited, including the Robertson retry | 3,235 | `engines/reports/national-sweep-2026-10-23.md` |
| Ranked counties after that retry | 2,491 | Same report. Not in the hosted pack |
| Passed / failed drafts in the hosted pack | 14,960 / 480 | Counted from the committed gzip snapshots, 2026-10-25 |

An earlier private-directory reading at 9:51 AM ET on 2026-10-24 is in `submission/README.md`. This checkout did not re-read that directory. Use the pack counts for the live desk.

## Dependencies

Application audits go through a local Zetaris JDBC connection. Source relations sit in one read-only PostGIS database, registered as `porchlight_postgis`. Spatial predicates stay in PostGIS. The hosted desk serves the published result of that audit.

Nemotron drafts go through Meterless on the Nightshift route (`meterless/deep`), thinking disabled. Reported model ids are `nvidia/nemotron-3.5-lightning-30b-a3b` and `nvidia/nemotron-3.5-super-vl-120b-a12b`. `execution_location` on the published receipts is `nvidia_cloud`. Credentials stay in Nightshift's proxy-token file, outside this repository. Local GPU inference is not a claim.

`engines/openrouter_backup.py` runs only when `OPENROUTER_API_KEY` and `PORCHLIGHT_OPENROUTER_BACKUP` are set. Leave them unset. No OpenRouter spend is claimed. OpenRouter is not a scoring sponsor.

National captures, live weather captures, job artifacts, and local logs stay outside git:

| Path under `%USERPROFILE%\.porchlight` | What it holds |
| --- | --- |
| `national` | Census, CMS, and related national source files, plus job and sweep artifacts |
| `live-weather` | Official NWS alert and NOAA radar captures |
| `runlogs` | Local web and weather-worker logs from `Start-Local.ps1` |

Also required for a new local run: Java 21, the licensed Zetaris JDBC jar (outside git), Python 3, and Node.js. Engine Python dependencies are in `engines/requirements.txt`. Web dependencies are in `web/package.json`.

Set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when those paths differ from the local install. Do not put the PostGIS password in audited SQL. The names the app reads are listed in `env.example`.

The Milton page renders from `web/data/manatee-ranked.json` without live credentials. Hosted county pages render from `web/data/national/published/` without live credentials. A new county job, an alert run, and Storm Watch capture need the local stack.

## Setup

You can skip this for the hosted recording path.

1. Install Java 21, the Zetaris JDBC jar, and the local Zetaris and PostGIS services. Register the read-only database as `porchlight_postgis`.
2. Capture and load national sources into `%USERPROFILE%\.porchlight\national` with `python -m data.adapters.us.capture_national`, then `python -m data.snapshot.national --folder <capture-directory>`. Register the read-only projections with `python -m engines.national_sources --register` and `python -m engines.national_alerts --register`. Details are in `engines/README.md`.
3. From `web/`:

```powershell
npm ci
npm run build
npm run start
```

Open `http://127.0.0.1:3101`.

On Windows, `.\Start-Local.ps1` starts that built app when port 3101 is free, and starts a weather worker when none is running. The default worker makes up to 288 capture attempts, at least five minutes apart. It does not install dependencies, start on boot, or delete retained captures. `-SkipWeather` leaves the weather worker off. Local Zetaris and PostGIS must already be running.

## Smoke script

From the repository root, on a machine with local Zetaris:

```powershell
scripts\smoke-national.ps1
```

```bash
scripts/smoke-national.sh
```

The script reads the county catalog, then runs Manatee (`12081`), Harris (`48201`), Cook (`17031`), Loving (`48301`), and one county mapped from the current audited active alert. It calls `engines.national_run`, so it does not spend the draft budget. A pass from the night of 2026-10-23 is in `docs/smoke-national-results.md`. If Zetaris is unreachable, the script exits with that message and does not substitute another county.

## Sponsor map

| Sponsor | Where it is used | How |
| --- | --- | --- |
| Zetaris | `engines/zetaris_client.py`, `engines/national_run.py`, `web/data/national/published/` | Audited SQL over CMS, Census, SVI, and emPOWER. One read-only PostGIS datasource. The hosted UI shows the published audit, including query ids. A Unified Semantic Layer across multiple live systems is not claimed. |
| Meterless | `engines/runtime_config.py`, `engines/grounded_drafts.py`, `engines/scout_intent.py` | `meterless/deep` through local Nightshift, thinking disabled. Scout Intent gates the live call-script path. Batch explanation drafts are not contract-gated. H-MEM, World Model, and Markovian are not claimed. |
| NVIDIA Nemotron | Published `model_executions`, `engines/reports/scout-intent-live-2026-10-23.json` | Lightning and Super VL on the free route. Nemotron does not rank. 480 hosted facility drafts stay failed. Local GPU and offline DGX are not claimed. |
| Cursor | [PR #22](https://github.com/JoeProAI/porch-light/pull/22), [PR #24](https://github.com/JoeProAI/porch-light/pull/24), `.cursor/rules/`, `ops/build-log/cursor/README.md` | Storm Watch, the shared design, and the national web wiring. No token count or spend total is in the repo. |

Sponsor endpoints and the same limits: [SPONSOR-SETUP.md](SPONSOR-SETUP.md).

## Data credits

Facility evidence keeps source URLs, licenses, and SHA-256 references. Snapshot provenance is in `web/data/` and `engines/snapshots/`. Weather frames stay outside git and are checked by source hash.

External resources, including emPOWER, are public references. They are not partner integrations. emPOWER has its own restricted outreach rules. ZIP counts are not facility patient counts.

## Privacy

Public, facility-level, and aggregate data only. Contact notes stay in browser storage. No personal health records.

## License

AGPL-3.0-only. See `LICENSE` and `NOTICE`. Pre-existing components are listed in `DECLARED_PREEXISTING.md`.

## Docs

Mintlify source is `docs/`. Preview with `npx mint dev` from that directory. There is no public docs URL. Do not publish the docs site from this repo.

## Submission

Written explanation, demo script, and the evidence index are in `submission/`. `metadata.json` has the live desk in `demo_url`. `demo_video` and `slide_deck` stay empty until those files exist. The remaining human step for the Monday, October 26, 2026, 6:00 PM ET submit target is the live recording.
