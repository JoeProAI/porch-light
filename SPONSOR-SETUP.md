# Sponsor setup (Open Agent Hackathon 2026, Track 01)

Primary sources (not memory):
- Official rules: https://hackathon.genai.works/event/open-agent-hackathon-2026
- HackOS Participant Setup Guide (21 Oct 2026 PDF text in team notes)
- This repo `metadata.json` sponsor block (honest status fields)

## Required stack (eligibility)

| Layer | Sponsor tech | Correct setup | Porch Light status (2026-10-23 ET) |
|---|---|---|---|
| DATA | Zetaris local Docker | `docker compose` from zetaris-platform.zip; UI `http://localhost:3000`; JDBC `jdbc:zetaris:lightning@localhost:10000`; REST `http://localhost:8888/api/v1.0` | Working: audited JDBC chain + PostGIS datasource. Not claimed: full USL across multiple live physical systems. |
| BUILD | Cursor + >=1 Meterless Engine | Cursor for development; engine must power a working feature (Scout Intent, H-MEM, World Model, or Markovian). Copying a prompt alone does not count. | Cursor: partial (cloud agent PR #22 Storm Watch). Meterless Engines: **none implemented** (`metadata.json` `sponsors.meterless.engines` is `[]`). |
| POWER | Meterless Nightshift + NVIDIA Nemotron | Nightshift at `http://127.0.0.1:8088/v1`; NVIDIA key only in Nightshift Providers; lanes use Nemotron model ids below | Working: one stored `meterless/deep` → `nvidia/nemotron-3.5-super-vl-120b-a12b` receipt. Not claimed: local GPU / `meterless/local`, Content Safety, Parse. |

## Correct NVIDIA model ids (setup guide)

- Fast lane: `nvidia/nemotron-3.5-lightning-30b-a3b`
- Deep lane: `nvidia/nemotron-3.5-super-vl-120b-a12b`
- Do not use deprecated free endpoints flagged after 2026-10-19 for older Super/Nano free APIs.

## Scoring and stackable prizes (official page)

- Rubric /100: Impact 30, Technical 20, Innovation 15, Demo 15, Product & UX 10, **Sponsor tech 10**
- Track 01 cash: 1st $1,600 / 2nd $1,200 / 3rd $900
- In-kind: **Best use of NVIDIA Nemotron** → NVIDIA DGX Spark Founder's Edition ($4,699)
- Wildcard [Tinkerer] is a separate bonus track (not our primary). Bright Data appears in some campus partner posts; it is **not** listed as required on the official event rules page we scraped.

## Honest gaps that still score if closed

1. **Meterless Engine (highest value):** implement Scout Intent (or H-MEM) on a real feature (export / call-script gate) with a conformance note in README. Setup guide marks this required for BUILD.
2. **Cursor evidence pack:** `.cursor/rules`, cloud agent PR links, usage export under `ops/build-log/cursor/`. Rules require Cursor for development; Cursor credits prize is separate in-kind.
3. **DGX Spark beat:** local Nemotron through Nightshift + unplug / EOC snapshot demo with measured tokens/sec. Hosted Super VL alone is weaker for "best use of Nemotron."

## Local env template

See `.env.example`. Keep real tokens out of git and out of Cursor provider settings.
