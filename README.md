# Porch Light

Porch Light is a care-facility outreach workbench for dialysis centers and nursing homes. You open a US county and get a ranked call sheet: directory phones, the formula terms behind each row, the records that did not join, and a stored Nemotron draft when the national sweep wrote one.

The live desk is [https://porchlight.earth](https://porchlight.earth). Home is nationwide-first. **Pick any US county** opens `/nationwide`. The Hurricane Milton sheet is a footer link, **Hurricane Milton retrospective**. It is a saved Manatee example. It is not the product.

The ranking formula is published. Operators still verify facility conditions. Nemotron writes the draft. The formula sets the order. The app does not place calls or send messages.

Built for the GenAI.Works Open Agent Hackathon 2026, Track 01 (Solving Fragmented Intelligence), by team Burden of Proof.

**Demo video:** [Porch Light — Open Agent Hackathon 2026](https://youtu.be/g8oD89YI1MI)  
**Slide deck:** [Gamma deck](https://gamma.app/docs/13lszmdvl0o1cv5)

## What you can say

Checked `GET https://porchlight.earth/api/national` on 2026-10-25 at 23:08 UTC. The body matches `web/data/national/published/` in this repo. Sweep `20261023T200048Z-78a426ba`, generated `2026-10-24T16:47:04Z`.

1. Every county in the 3,235-row Census catalog has been source-audited through Zetaris at least once. The write-up is `engines/reports/national-sweep-2026-10-23.md`, including a separate retry for Robertson County, Texas.
2. You can open any of the 2,490 published counties that have ranked facilities, on the hosted desk, today. The pack has 3,234 county snapshots and 15,440 ranked rows.
3. Stored drafts on those rows are from free Nemotron routes through Meterless, thinking disabled. 14,960 passed with `actual_usd` 0. 480 failed and stayed failed. 89 ranked counties have only failed drafts.

The hosted catalog lists Robertson County, Texas (`48395`) as `runtime_error`. There is no published file. `GET /api/national?county=48395` returns HTTP 503 and does not substitute another county. The report's post-retry total is 2,491 ranked counties. That retry is not the file the desk serves. Use 2,490 for the desk and 2,491 only for the report.

## What this submission does not say

Offline or local DGX inference, H-MEM, World Model, and Markovian are not claimed. Not every county has an accepted draft. Contact status defaults to **Not contacted**. A **Reached** row exists only after an operator records a real call on that device. The Milton sheet (18 ranked, 2 refused, formula `manatee-development-v1`) is not the national Manatee snapshot (14 ranked, 6 refused, formula `national-source-screen-v1`).

`POST /api/national` on the public host returns HTTP 403, `Same-origin local access is required for model operations.` New model calls stay on the operator machine.

These docs under `docs/` are repo source. There is no public docs URL.

## Video path

Open `/nationwide`, then:

| County | URL | Ranked / refused / source | What rank 1 shows |
| --- | --- | --- | --- |
| Anchorage, Alaska | `?county=02020` | 4 / 2 / 6 | Polaris Extended Care, CCN `025036`. Stored draft failed |
| Doña Ana, New Mexico | `?county=35013` | 7 / 4 / 11 | USRC Las Cruces, CCN `322559`. Lightning draft passed, cost 0 |
| Harris County, Texas | `?county=48201` | 140 / 96 / 236 | DaVita North Houston Dialysis Center, CCN `452678`. Super VL draft passed, cost 0 |

Narration and the claim boundary are in `submission/demo-script.md` and `docs/quickstart.mdx`. Demo video and slide deck are set in `metadata.json` (`https://youtu.be/g8oD89YI1MI`, `https://gamma.app/docs/13lszmdvl0o1cv5`).

## Who built it

Joe Gaither directed the project: decisions, review, and merges.

Devin wrote the contract (PR #14), the data adapters, the engines, and most of the web application, including the Milton call sheet.

Cursor cloud agents wrote [Storm Watch and the Storm Glass Desk (PR #22)](https://github.com/JoeProAI/porch-light/pull/22), [the national web wiring (PR #24)](https://github.com/JoeProAI/porch-light/pull/24), and the [nationwide-first home (PR #47)](https://github.com/JoeProAI/porch-light/pull/47). Cursor also supplies `.cursor/rules/`. This repository does not record Cursor token counts or spend. The build log is `ops/build-log/cursor/README.md`.

## Two ways to read a county

**Hosted.** [porchlight.earth/nationwide](https://porchlight.earth/nationwide) serves the published snapshots. No Zetaris process and no API key are required. Weather refresh and model POST stay local.

**Local.** A fresh chain needs Java 21, the licensed Zetaris JDBC jar (outside git), local Zetaris and PostGIS, Python 3, and Node.js. Engine dependencies are `engines/requirements.txt`. Web dependencies are `web/package.json`.

| Path under `%USERPROFILE%\.porchlight` | What it holds |
| --- | --- |
| `national` | Census, CMS, and related national source files, plus job and sweep artifacts |
| `live-weather` | Official NWS alert and NOAA radar captures |
| `runlogs` | Local web and weather-worker logs from `Start-Local.ps1` |

Set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when those paths differ from the local install. Do not put the PostGIS password in audited SQL.

The Milton page renders from `web/data/manatee-ranked.json` without live credentials.

## Setup

1. Install Java 21, the Zetaris JDBC jar, and the local Zetaris and PostGIS services. Register the read-only database as `porchlight_postgis`.
2. Capture and load national sources into `%USERPROFILE%\.porchlight\national` with `python -m data.adapters.us.capture_national`, then `python -m data.snapshot.national --folder <capture-directory>`. Register the read-only projections with `python -m engines.national_sources --register` and `python -m engines.national_alerts --register`. Details are in `engines/README.md`.
3. From `web/`:

```powershell
npm ci
npm run build
npm run start
```

Open `http://127.0.0.1:3101`.

On Windows, `.\Start-Local.ps1` from the repository root starts that built app when port 3101 is free, and starts a weather worker when none is running. The default worker makes up to 288 capture attempts, at least five minutes apart. It does not install dependencies, start on boot, or delete retained captures. `-SkipWeather` leaves the weather worker off. Local Zetaris and PostGIS must already be running.

Nemotron requests use Nightshift at `http://127.0.0.1:8088/v1` (`meterless/deep`, thinking disabled). The proxy token stays in Nightshift's token file.

## Usage

1. On the hosted home, **Pick any US county** opens `/nationwide`. Search by name, state, or FIPS. **Open published audited call sheet** reads that county's snapshot.
2. `/operate` with no query is the Milton sheet. A `county` or `alert` query redirects to `/nationwide` so a bad id does not fall through to Manatee.
3. On a local origin, `/nationwide` can start `engines.national_jobs` for a catalog county or a captured alert. If Zetaris cannot be reached, the page says so and returns no rows.
4. **Generate live Nemotron call script** is a local-origin POST. Scout Intent signs the call-script path. The draft executor checks the contract before that request. A refusal stays a refusal. The public host returns 403.
5. `/watch` shows the captured official weather feed on a machine that has one, with source times and stale or offline states.

## Smoke script

From the repository root, on a machine with local Zetaris:

```powershell
scripts\smoke-national.ps1
```

```bash
scripts/smoke-national.sh
```

The script reads the county catalog, then runs Manatee (`12081`), Harris (`48201`), Cook (`17031`), Loving (`48301`), and one county mapped from the current audited active alert. It calls `engines.national_run`, so it does not spend the draft budget. If Zetaris is unreachable, it exits with that message and does not substitute another county.

## Sponsor map

| Sponsor | Where it is used | How |
| --- | --- | --- |
| Zetaris | `engines/zetaris_chain.py`, `engines/national_run.py`, published snapshots | Audited SQL over CMS, Census, SVI, and emPOWER in one read-only PostGIS datasource. The hosted desk shows the query ids from sweep `20261023T200048Z-78a426ba`. Catalog query `833`. |
| Meterless | `engines/meterless.py`, `engines/scout_intent.py`, `engines/draft_jobs.py` | `meterless/deep` through Nightshift, thinking disabled. Scout Intent gates the local call-script path. H-MEM, World Model, and Markovian are not claimed. |
| NVIDIA Nemotron | Published county `model_explanation` rows, `engines/reports/scout-intent-live-2026-10-23.json` | Lightning and Super VL, both free routes. 14,960 passed drafts in the pack at actual cost 0. 480 failed. Nemotron does not rank. Local GPU inference is not claimed. |
| Cursor | [PR #22](https://github.com/JoeProAI/porch-light/pull/22), [PR #24](https://github.com/JoeProAI/porch-light/pull/24), [PR #47](https://github.com/JoeProAI/porch-light/pull/47), `.cursor/rules/` | Storm Watch, national web wiring, nationwide-first home, and the rules files. No token or spend total is recorded. |

An optional OpenRouter retry for `call_script` exists in `engines/openrouter_backup.py` and stays off unless `PORCHLIGHT_OPENROUTER_BACKUP` and `OPENROUTER_API_KEY` are set. Every explanation execution in the published pack has `paid_fallback_enabled` false. Do not enable it for the demo.

## Data credits

Facility evidence keeps source URLs, licenses, and SHA-256 references. Published provenance sidecars are next to `web/data/national/published/`. The Milton snapshot is `web/data/manatee-ranked.json`. Weather frames for a local Storm Watch stay outside git. NASA's archived Milton image is credited in the interface and the `web/public/weather/` sidecar.

External resources, including emPOWER, are public references. They are not partner integrations.

## Privacy

Porch Light uses public, facility-level, and aggregate data. It holds no personal health records. Contact status stays in the browser.

## License

AGPL-3.0. See LICENSE and NOTICE. Pre-existing components are listed in DECLARED_PREEXISTING.md.

## Docs and sponsor setup

Docs source, not a published site: `docs/`. Sponsor endpoints and model ids: [SPONSOR-SETUP.md](SPONSOR-SETUP.md). Local placeholders: [env.example](env.example).
