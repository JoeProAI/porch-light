# HANDOFF
Updated: Wed Oct 21 2026 8:20 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Cursor cloud agent on `contract/initial` |
| G2 Zetaris local on the 5080 | Thu Oct 22, 10 AM ET | open | |
| G3 Local Nemotron via Meterless | Thu Oct 22, noon ET | open | |
| G4 US golden path green | Sat Oct 24, 1 PM ET | open | |
| G5 Global adapter (stretch) | Sat Oct 24, 10 PM ET | open | |

## Merge log
| Window | PRs merged (data, engines, eval, web, docs) | Wringer verdict | Notes |
|---|---|---|---|

## Review notes (open findings)
| Id | From | Severity | Area | Status |
|---|---|---|---|---|

## Decisions
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit, contract follows from Cursor.

## Area: Contract
owner now: Joe in Cursor  (primary Joe in Cursor, backup Devin)
state: not started
next step: see your CREW brief
branch: contract/*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Data
owner now: Devin  (primary Devin, backup Cursor cloud agent (data))
state: scaffold in PR (adapters layout, provenance sidecar helper, snapshot dirs)
next step: Thu Oct 22: load core sources into the PostGIS snapshot with provenance sidecars, capture live Nor'easter alerts + golden Milton alert (FIPS 12081) + zone shapes, geocode dialysis addresses, map NH SSA codes to FIPS. Done check: a Zetaris SQL join returns in-area facilities with tract and SVI.
branch: devin/data-*   open PRs: devin/data-scaffold (scaffold)
how to run: `python3 data/provenance/sidecar.py <file> --source-url <u> --license "<line>" --fetch-command "<cmd>"`; add `--verify` to check a sidecar.
blocked: local Zetaris on the 5080 needs Joe at the keyboard (steps below); contract/initial not pushed yet, so data builds against contract/fixtures/ until it lands.

### Local Zetaris on the 5080, steps for Joe (gate G2, never AWS)
1. Windows side: install Docker Desktop with the WSL2 backend. Cap WSL2 in `%UserProfile%\.wslconfig`: `memory=8GB`, `processors=4`.
2. WSL2 terminal: pull and start the Zetaris build from the hackathon sponsor page (community/local edition), expose its UI port (default 8080). `docker run -d -p 8080:8080 <zetaris-image>`.
3. Same WSL2: start PostGIS: `docker run -d --name porchlight-postgis -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=<password> -e POSTGRES_DB=porchlight postgis/postgis:16-3.4`.
4. Zetaris admin UI: register a JDBC datasource `porchlight_postgis`: `jdbc:postgresql://<wsl2-host>:5432/porchlight`, user `postgres`, password from env, never in code or docs.
5. Verify: run `SELECT 1` through Zetaris SQL against the datasource, then mark G2 in the Gates table.

last update: Wed Oct 21 2026 8:20 PM ET

## Area: Engines
owner now: Claude Code  (primary Claude Code, backup Devin)
state: not started
next step: see your CREW brief
branch: claude/engines-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Eval and CI
owner now: Codex  (primary Codex, backup Claude Code)
state: not started
next step: see your CREW brief
branch: codex/eval-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Web
owner now: Cursor cloud agents  (primary Cursor cloud agents, backup Codex)
state: not started
next step: see your CREW brief
branch: cursor-web/*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Docs
owner now: Hackathon Desk docs seat  (primary Hackathon Desk docs seat, backup Claude Code)
state: not started
next step: see your CREW brief
branch: desk/docs-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Front matter and ops
owner now: Hackathon Desk  (primary Hackathon Desk, backup Devin)
state: not started
next step: see your CREW brief
branch: desk/ops-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Deck, script, explanation
owner now: Hackathon Desk  (primary Hackathon Desk, backup Claude Code)
state: not started
next step: see your CREW brief
branch: desk/ops-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Integration and review
owner now: Devin (Devin Review)  (primary Devin (Devin Review), backup Codex review)
state: not started
next step: see your CREW brief
branch: n/a   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET
