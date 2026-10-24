# Porch Light

Porch Light is a care-facility outreach workbench. It shows sourced contacts, the ranking terms behind each row, and the facts that are still unknown.

The home page opens on any US county. The Hurricane Milton walkthrough is the saved Manatee County, Florida example: 18 ranked dialysis and nursing-home records and 2 refusals, from a fixed published formula over captured public CMS, Census, SVI, and emPOWER records. Operators can inspect the evidence, record a contact outcome on their own device, export CSV, and print. The app does not place calls or send messages.

`/nationwide` runs the same engine for a Census county or a current National Weather Service alert when local Zetaris is available. Each county run reports that county’s audited rows and source gaps. Storm Watch (`/watch`) shows captured official alerts and NOAA radar for the provider regions that published frames.

Built for the GenAI.Works Open Agent Hackathon 2026, Track 01 (Solving Fragmented Intelligence), by team Burden of Proof.

The ranking formula is a published prototype over captured public records. Operators still verify facility conditions. Nemotron drafts do not change a score.

## Who built it

Joe Gaither directed the project: decisions, review, and merges.

Devin built the data adapters, the engines, and most of the web application, including the Manatee call sheet.

Cursor cloud agents built [Storm Watch v2 and the Storm Glass Desk design (PR #22)](https://github.com/JoeProAI/porch-light/pull/22) and [the national web wiring (PR #24)](https://github.com/JoeProAI/porch-light/pull/24): county search, active-alert runs, source gaps, and the smoke script.

## Dependencies

Application reads go through a local Zetaris JDBC connection. The source relations sit in one read-only PostGIS database, registered in Zetaris as `porchlight_postgis`. Spatial predicates stay in PostGIS.

Nemotron drafts and call scripts go through Meterless on the Nightshift route (`meterless/deep`), with thinking disabled. Credentials stay in Meterless’s private proxy-token file, outside this repository. The model route is that hosted Meterless path.

National captures, live weather captures, job artifacts, and local logs stay outside git:

| Path under `%USERPROFILE%\.porchlight` | What it holds |
|---|---|
| `national` | Census, CMS, and related national source files, plus job and sweep artifacts |
| `live-weather` | Official NWS alert and NOAA radar captures |
| `runlogs` | Local web and weather-worker logs from `Start-Local.ps1` |

Also required for a live run: Java 21, the licensed Zetaris JDBC jar (outside git), Python 3, and Node.js for the web app. Engine Python dependencies are listed in `engines/requirements.txt`. Web dependencies are in `web/package.json`.

Set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when those paths differ from the local install. Do not put the PostGIS password in audited SQL.

The committed Manatee page can render from `web/data/manatee-ranked.json` without live data credentials. County runs, active alerts, and Storm Watch need the local Zetaris and PostGIS stack, and the files under `%USERPROFILE%\.porchlight`.

## Setup

1. Install Java 21, the Zetaris JDBC jar, and the local Zetaris and PostGIS services. Register the read-only database as `porchlight_postgis`.
2. Capture and load national sources into `%USERPROFILE%\.porchlight\national` with `python -m data.adapters.us.capture_national`, then `python -m data.snapshot.national --folder <capture-directory>`. Register the read-only projections with `python -m engines.national_sources --register` and `python -m engines.national_alerts --register`. Details are in `engines/README.md`.
3. From `web/`, install dependencies and build:

```powershell
npm ci
npm run build
npm run start
```

Open `http://127.0.0.1:3101`.

On Windows, `.\Start-Local.ps1` from the repository root starts that built app when port 3101 is free, and starts a weather worker when none is running. The default worker makes up to 288 capture attempts, at least five minutes apart. It does not install dependencies, start on boot, or delete retained captures. `-SkipWeather` leaves the weather worker off. Local Zetaris and PostGIS must already be running.

## Usage

1. `/` explains the project, sponsors, and independent emergency resources. **Pick any US county** opens the national run. **See the Hurricane Milton walkthrough** opens the saved Manatee demonstration.
2. `/operate` is the Manatee sheet. Select a facility and read source facts, score terms, and the audit reference. Record a contact outcome, export CSV, or print.
3. `/nationwide` searches the Census county catalog by name, state, or FIPS, and lists active NWS alerts from the audited feed. A county job or a combined alert job runs through `engines.national_jobs`. The page shows job progress, the ranked sheet, Zetaris query IDs, and per-source gaps. `/operate?county=<FIPS>` opens that nationwide run. A FIPS or alert id that fails validation does not load the Manatee sheet.
4. On a national row, **Generate live Nemotron call script** is classified by Scout Intent first. A proceed decision issues a signed execution contract; the draft executor verifies it before that job id is sent through Meterless. A refusal returns `refused_by_scout` and shows no substitute script. Grounding failures stay visible. `/operate` can request a script for the stored Manatee snapshot.
5. `/watch` shows the captured official weather feed, with source times and stale or offline states.

If Zetaris cannot be reached, the national page says `Zetaris unreachable on this machine` and returns no rows.

## Smoke script

From the repository root, on a machine with local Zetaris:

```powershell
scripts\smoke-national.ps1
```

```bash
scripts/smoke-national.sh
```

The script reads the county catalog, then runs Manatee County, Florida (`12081`), Harris County, Texas (`48201`), Cook County, Illinois (`17031`), Loving County, Texas (`48301`), and one county mapped from the current audited active alert. It prints pass or fail, wall time, engine runtime, source gaps, and Zetaris query IDs.

It calls `engines.national_run`, so it does not spend the Meterless draft budget. The web call sheet still uses `engines.national_jobs`, which requests grounded drafts for ranked rows. If Zetaris is unreachable, the script exits with that message and does not substitute another county.

## Sponsor map

| Sponsor | Where it's used | How |
|---|---|---|
| Zetaris | `engines/zetaris_chain.py`, `engines/zetaris_client.py`, `engines/national_run.py` | Audited SQL joins CMS, Census, SVI, and emPOWER, with measured match counts. Source relations share one read-only PostGIS datasource. The Manatee page can read the audited export. National runs query Zetaris directly. |
| Meterless | `engines/meterless.py`, `engines/scout_intent.py`, `engines/draft_jobs.py` | Nemotron requests use the Nightshift `meterless/deep` route with thinking disabled. Scout Intent gates the live call-script path with a signed execution contract that the draft executor verifies before any provider call (see `engines/README.md`, Scout Intent gate). H-MEM, World Model and Markovian are not claimed. |
| NVIDIA Nemotron | `engines/snapshots/manatee-zetaris.json`, `engines/national_jobs.py` | Stored Super VL drafts explain the top Manatee rows. National call scripts are requested per run through Meterless after the Scout Intent contract is verified. Nemotron does not rank. Local GPU inference is not verified. |
| Cursor | [PR #22](https://github.com/JoeProAI/porch-light/pull/22), [PR #24](https://github.com/JoeProAI/porch-light/pull/24) | Cursor cloud agents wrote Storm Watch v2 and the shared design, and the national web wiring. Devin wrote the data, engines, and most of the web. Joe directed the work. |

## Data credits

Facility evidence keeps source URLs, licenses, and SHA-256 references for the captured CMS and contextual records. Snapshot provenance is in `web/data/` and `engines/snapshots/`. Weather frames stay outside git and are checked by source hash. NASA’s archived Milton image is credited and dated in the interface and the `web/public/weather/` sidecar.

External resources, including emPOWER, are public references. They are not partner integrations. emPOWER has its own restricted outreach rules.

## Privacy

Porch Light uses public, facility-level, and aggregate data. It holds no personal health records.

## License

AGPL-3.0. See LICENSE and NOTICE. Pre-existing components are listed in DECLARED_PREEXISTING.md.
