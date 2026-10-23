# Porch Light

Care-facility outreach with sourced contacts, inspectable reasons and visible unknowns.

Porch Light demonstrates a retrospective Manatee County, Florida call sheet for dialysis centers and nursing homes. A fixed development formula ranks 18 sourced records; two records remain refused. Operators can inspect evidence, record contact outcomes on their device, export CSV and print. This is not a clinically validated urgency model or current facility-status feed.

Built for the GenAI.Works Open Agent Hackathon 2026, Track 01 (Solving Fragmented Intelligence), by team Burden of Proof.

Separate Storm Watch weather context uses captured national NWS alerts and source-faithful NOAA radar for available provider regions. Weather coverage does not establish national facility coverage.

## Run Locally

From `web/`, with the repository's dependencies already installed:

```powershell
npm run build
npm run start
```

On Windows, `.\Start-Local.ps1` from the repository root starts the built app if port 3101 is free and starts a weather worker if none is running. By default the worker makes up to 288 capture attempts, with at least five minutes between attempts, roughly a day plus fetch time. It does not install dependencies, auto-start on Windows boot or delete retained source captures. Logs stay outside Git under `%USERPROFILE%\.porchlight\runlogs`. Use `-SkipWeather` for snapshot-only operation. Local Zetaris/PostGIS must already be running.

Open `http://127.0.0.1:3101`.

1. `/` explains the project, sponsors and independent emergency resources.
2. `/operate` opens the real, retrospective Manatee snapshot.
3. Select a facility and inspect source facts, score terms and the shared audit reference.
4. Record a manual contact outcome, export CSV or print. No calls or messages are sent.
5. `/watch` shows captured official weather, with source times and stale/offline states.

The call sheet renders from committed real-source snapshots without live data credentials. Retaining an already loaded page is not a verified cold-offline application or local GPU inference. Storm Watch needs the licensed local Zetaris runtime, registered read-only source and private weather cache. See `web/README.md` for the bounded capture-worker command. No public deployment is configured.

## Sponsor map

| Sponsor | Where it's used | How |
|---|---|---|
| Zetaris | `engines/data_access.py`, `engines/zetaris_client.py` | Licensed JDBC read of a pre-joined PostGIS bundle. Actual audit ID `80` is shared by the ranked rows, not 18 independent queries. Cross-source joins inside Zetaris are not demonstrated. |
| Meterless | `engines/meterless.py`, snapshot `model_executions` | One stored `meterless/deep` execution routed a genuine Nemotron response with thinking disabled. No Scout Intent, H-MEM or World Model implementation is claimed. |
| NVIDIA Nemotron | `engines/snapshots/manatee-zetaris.json` | One stored Super VL execution produced three explanation drafts. The audited snapshot reused them after input equality checks. Other rows have computed reasons. Nemotron does not rank, and local GPU inference is not verified. |
| Cursor | Build evidence missing from this checkout | This web implementation was authored by Devin. Rules on a separate contract branch are not evidence of a Cursor build. Eligibility evidence must be produced through genuine Cursor work. |

## Feature to engine

The ranking code and evidence are in `engines/`; the operator interface, source map and weather interface are in `web/`. `web/data/manatee-ranked.json` contains the UI's actual Zetaris-audited exported snapshot, copied from `engines/snapshots/manatee-zetaris.json`. The UI does not issue facility queries when a row is selected.

## Data credits

Facility evidence retains source URLs, licenses and SHA-256 references for the captured CMS and contextual records. Snapshot provenance is retained with `web/data/` and `engines/snapshots/`. Weather frames remain outside Git with source-hash verification. NASA's archived Milton image is credited and dated in the interface and `web/public/weather/` sidecar.

External resources, including emPOWER, are complementary systems, not partners or integrations. emPOWER also has restricted outreach capabilities; it is not merely a counting tool.

## Submission Gaps

The video, slide deck and written submission explanation are not packaged here. Cursor build evidence, actual cross-source Zetaris joins, a measured operator baseline and release/deployment review remain outstanding. National and international facility ranking, shared multi-operator coordination and live facility conditions are not implemented.

## Privacy

Porch Light uses only public, facility-level and aggregate data. It holds no personal health records.

## License

AGPL-3.0. See LICENSE and NOTICE. Pre-existing components are listed in DECLARED_PREEXISTING.md.
