# Sponsor setup (Open Agent Hackathon 2026, Track 01)

Primary sources (not memory):
- Official rules: https://hackathon.genai.works/event/open-agent-hackathon-2026
- HackOS Participant Setup Guide (21 Oct 2026 PDF text in team notes)
- This repo `metadata.json` sponsor block (status fields below match that block on `devin/web-manatee`)

## Required stack (eligibility)

| Layer | Sponsor tech | Correct setup | Porch Light status (2026-10-24) |
|---|---|---|---|
| DATA | Zetaris local Docker | `docker compose` from zetaris-platform.zip; UI `http://localhost:3000`; JDBC `jdbc:zetaris:lightning@localhost:10000`; REST `http://localhost:8888/api/v1.0` | Working: audited JDBC statements over CMS, Census, SVI, and emPOWER in one read-only PostGIS datasource. National runs query Zetaris directly. Not claimed: a Unified Semantic Layer across multiple live physical systems. |
| BUILD | Cursor + at least one Meterless Engine | Cursor for development. An engine has to power a working feature (Scout Intent, H-MEM, World Model, or Markovian). Copying a prompt alone does not count. | Cursor: used. Merged cloud-agent [PR #22](https://github.com/JoeProAI/porch-light/pull/22) (Storm Watch) and [PR #24](https://github.com/JoeProAI/porch-light/pull/24) (national web). No token count or spend total is in this repository. Meterless engine: Scout Intent is live on the call-script path (`engines/scout_intent.py`). A proceed decision issues a signed execution contract; the draft executor verifies it before any provider call. H-MEM, World Model, and Markovian are not claimed. |
| POWER | Meterless Nightshift + NVIDIA Nemotron | Nightshift at `http://127.0.0.1:8088/v1`. NVIDIA key only in Nightshift Providers. Lanes use the Nemotron model ids below. This is the only runtime model path. | Primary route: hosted `meterless/deep` to `nvidia/nemotron-3.5-super-vl-120b-a12b`, thinking disabled. Stored Super VL drafts explain the top Manatee rows. National call scripts are requested per run through that route after the Scout Intent contract is verified. Nemotron does not rank. Not claimed: local GPU / `meterless/local`, Content Safety, Parse, or finished national model coverage. |

## Correct NVIDIA model ids (setup guide)

- Fast lane: `nvidia/nemotron-3.5-lightning-30b-a3b` (setup-guide id; not a separate evidenced route in this repo)
- Deep lane: `nvidia/nemotron-3.5-super-vl-120b-a12b` (the evidenced lane, via Meterless)
- Do not use deprecated free endpoints flagged after 2026-10-19 for older Super/Nano free APIs.

## Scoring and stackable prizes (official page)

- Rubric /100: Impact 30, Technical 20, Innovation 15, Demo 15, Product & UX 10, **Sponsor tech 10**
- Track 01 cash: 1st $1,600 / 2nd $1,200 / 3rd $900
- In-kind: **Best use of NVIDIA Nemotron** → NVIDIA DGX Spark Founder's Edition ($4,699)
- Wildcard [Tinkerer] is a separate bonus track (not our primary). Bright Data appears in some campus partner posts; it is **not** listed as required on the official event rules page we scraped.

## Honest limits still open

1. **Scout Intent scope:** live on `national_jobs --call-script` only. Batch explanation drafts are not contract-gated. Scoring is Stage 1 lexical only; the local embedding stage is not installed. The signing key is a per-machine integrity secret. See `engines/README.md` (Scout Intent gate).
2. **Cursor evidence:** merged PRs #22 and #24 are the product evidence. This repository does not contain a Cursor usage export, token count, or spend total.
3. **Local Nemotron:** a hosted Super VL receipt through Meterless is not a local GPU run, and it is not a measured tokens/sec DGX Spark demo. Parse and Content Safety are not demonstrated.
4. **National model phase:** source-chain completion is not finished model coverage. See `submission/README.md`. Do not treat the stored Manatee receipt as a national rollup.

## Local env template

See `env.example`. The running app reads the Zetaris env file, the JDBC settings it documents, and the Meterless proxy-token file. It does not read a `SAMPLE_MODE` switch. Keep real tokens out of git and out of Cursor provider settings.
