# Sponsor setup (Open Agent Hackathon 2026, Track 01)

Primary sources (not memory):
- Official rules: https://hackathon.genai.works/event/open-agent-hackathon-2026
- HackOS Participant Setup Guide (21 Oct 2026 PDF text in team notes)
- This repo `metadata.json` sponsor block (status fields below match that block on `devin/web-manatee`)

## Required stack (eligibility)

| Layer | Sponsor tech | Correct setup | Porch Light status (2026-10-25) |
|---|---|---|---|
| DATA | Zetaris local Docker | `docker compose` from zetaris-platform.zip; UI `http://localhost:3000`; JDBC `jdbc:zetaris:lightning@localhost:10000`; REST `http://localhost:8888/api/v1.0` | Working: audited JDBC statements over CMS, Census, SVI, and emPOWER in one read-only PostGIS datasource. National runs query Zetaris directly. Not claimed: a Unified Semantic Layer across multiple live physical systems. |
| BUILD | Cursor + at least one Meterless Engine | Cursor for development. An engine has to power a working feature (Scout Intent, H-MEM, World Model, or Markovian). Copying a prompt alone does not count. | Cursor: used. Merged cloud-agent [PR #22](https://github.com/JoeProAI/porch-light/pull/22) (Storm Watch), [PR #24](https://github.com/JoeProAI/porch-light/pull/24) (national web), and [PR #47](https://github.com/JoeProAI/porch-light/pull/47) (nationwide-first home). No token count or spend total is in this repository. Meterless engine: Scout Intent is live on the local call-script path (`engines/scout_intent.py`). A proceed decision issues a signed execution contract; the draft executor verifies it before any provider call. H-MEM, World Model, and Markovian are not claimed. |
| POWER | Meterless Nightshift + NVIDIA Nemotron | Nightshift at `http://127.0.0.1:8088/v1`. NVIDIA key only in Nightshift Providers. Lanes use the Nemotron model ids below. This is the only runtime model path. | Route: `meterless/deep` through Nightshift, thinking disabled, free NVIDIA routes. The published pack reports both `nvidia/nemotron-3.5-lightning-30b-a3b` (3,229 executions, plus the Scout Intent receipt) and `nvidia/nemotron-3.5-super-vl-120b-a12b` (773 executions, plus stored Milton drafts). 14,960 ranked rows passed at actual cost 0. 480 failed and stayed failed. The public host does not start a new model call. Nemotron does not rank. Not claimed: local GPU / `meterless/local`, offline DGX Spark, Content Safety, Parse, or accepted drafts for every county. |

## Correct NVIDIA model ids (setup guide)

- Fast lane: `nvidia/nemotron-3.5-lightning-30b-a3b` (evidenced: the Scout Intent receipt, and 3,229 reported-model executions in the published county pack)
- Deep lane: `nvidia/nemotron-3.5-super-vl-120b-a12b` (evidenced: stored Milton drafts in `engines/snapshots/manatee-zetaris.json`, and 773 reported-model executions in that same pack)
- Do not use deprecated free endpoints flagged after 2026-10-19 for older Super/Nano free APIs.

## Scoring and stackable prizes (official page)

- Rubric /100: Impact 30, Technical 20, Innovation 15, Demo 15, Product & UX 10, **Sponsor tech 10**
- Track 01 cash: 1st $1,600 / 2nd $1,200 / 3rd $900
- In-kind: **Best use of NVIDIA Nemotron** → NVIDIA DGX Spark Founder's Edition ($4,699)
- Wildcard [Tinkerer] is a separate bonus track (not our primary). Bright Data appears in some campus partner posts; it is **not** listed as required on the official event rules page we scraped.

## Honest limits still open

1. **Scout Intent scope:** live on `national_jobs --call-script` only. Batch explanation drafts are not contract-gated. Scoring is Stage 1 lexical only; the local embedding stage is not installed. The signing key is a per-machine integrity secret. See `engines/README.md` (Scout Intent gate).
2. **Cursor evidence:** merged PRs #22 and #24 are the product evidence. This repository does not contain a Cursor usage export, token count, or spend total.
3. **Local Nemotron:** hosted Lightning and Super VL receipts through Meterless are not a local GPU run, and they are not a measured tokens/sec DGX Spark demo. The offline Nightshift probe on the engines branch ended at `blocked_preflight` with no generation. Parse and Content Safety are not demonstrated.
4. **National model phase:** every catalog county is source-audited (3,235 of 3,235 in `engines/reports/national-sweep-2026-10-23.md`, including the separate Robertson County, Texas retry). The hosted pack generated 2026-10-24T16:47:04Z publishes 3,234 snapshots and 2,490 ranked counties. Of 15,440 ranked rows, 14,960 drafts passed at actual cost 0 and 480 stayed failed. Robertson has no published file. Do not say all counties are drafted. The 9:51 AM ET progress.json cut is an earlier private snapshot and is not the desk.
5. **Other Meterless engines:** H-MEM, World Model, and Markovian are not implemented. The contract spec mentions an H-MEM field that the hosted drawer does not use. They are not claimed as engines.

## Local env template

See `env.example`. The running app reads the Zetaris env file, the JDBC settings it documents, and the Meterless proxy-token file. It does not read a `SAMPLE_MODE` switch. Keep real tokens out of git and out of Cursor provider settings.
