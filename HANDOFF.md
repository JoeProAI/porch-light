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
owner now: Devin  (primary Joe in Cursor, backup Devin; Devin took over as backup while Joe was on other gates)
state: contract/openapi.yaml (11 endpoints incl. GET checkins and export artifact download, 15 schemas incl. Ledger and LedgerEntry plus typed errors and empty states; Devin Review findings addressed in d537834), contract/adapter.md, contract/types (TypeScript and Python dataclasses), contract/fixtures (mock alert, 25 mock facilities with Evidence and ScoreBreakdown, joins with failed joins, trace, export receipt, ledger), .cursor/rules (house, paths, sponsors), and contract/validate_fixtures.py all landed on contract/initial. Fixtures validate.
next step: Joe reviews and merges the PR to main; every other agent codes against contract/types and the adapter interface. PR #1 (devin/data-scaffold) already renamed data/scoring/weights.yaml terms to the contract ScoreTerm names (af68a70). Wringer findings M8 to M12 and L1 to L4 fixed on contract/initial. Still open and out of area: the README "Sponsor map" Cursor row and the HANDOFF Decisions line both still say the contract was "made in Cursor" and belong to the Front matter seat.
branch: contract/initial   open PRs: #14 contract (contract/initial)
how to run: python3 contract/validate_fixtures.py (pip install -r contract/requirements.txt: pyyaml, jsonschema, referencing)
fix note: Wringer pass two. sponsors.mdc now credits Devin with the contract and describes Cursor's real role (rules plus web and data cloud agents). All 25 facility points now sit inside Manatee County: 10 rows that the Census geocoder placed in Sarasota (12115) were moved to mainland Bradenton, Palmetto, Ellenton and Parrish points, and all 25 were checked with the Census coordinates to county lookup (25 of 25 return 12081). Every reason text now names its rank band and cites the row's two largest weighted terms. The export receipt evidence_ids are the top 10 rows by rank. Fixtures are referentially closed: a zetaris_queries trace step lists every query id, all 25 reason trace_ids are trace steps, a new ledger_mock.json resolves every ledger id, and each nursing home row's ssa_to_fips hop query id is in its own zetaris_query_ids. Two dialysis rows are marked failed geocodes to match the joins count, the ccn to ccn polygon hop now targets tract_geoid, every mock CCN follows the Florida 10xxxx pattern, and model trace steps carry detail "mock values". validate_fixtures.py also fails on bad rank order or totals, score sums off by more than 1e-6, wrong receipt evidence_ids, dangling query, trace or ledger ids, and county_key 12081 rows outside a conservative Manatee box (lat 27.38 to 27.65, lon -82.75 to -82.05). Cross-fixture checks are skipped with a clear message when the schema pass already failed, so a missing field no longer crashes the validator. Earlier: it removes its own directory from sys.path so contract/types cannot shadow the stdlib types module, and uses Draft202012Validator with a referencing registry to match OpenAPI 3.1.
blocked: none
last update: Wed Oct 21 2026 9:02 PM ET

## Area: Data
owner now: Devin  (primary Devin, backup Cursor cloud agent (data))
state: scaffold in PR (adapters layout, provenance sidecar helper, snapshot dirs)
next step: Thu Oct 22: load core sources into the PostGIS snapshot with provenance sidecars, capture live Nor'easter alerts + golden Milton alert (FIPS 12081) + zone shapes, geocode dialysis addresses, map NH SSA codes to FIPS. Done check: a Zetaris SQL join returns in-area facilities with tract and SVI.
branch: devin/data-*   open PRs: #1 data scaffold (devin/data-scaffold)
how to run: `python3 data/provenance/sidecar.py <file> --source-url <u> --license "<line>" --fetch-command "<cmd>"`; add `--verify` to check a sidecar.
blocked: local Zetaris on the 5080 needs Joe at the keyboard (steps below); contract/initial is up as PR #14, so data builds against it once it lands.

emPOWER note: sources.yaml now cites the HHS emPOWER FeatureServer ZIP level layers (1, 5, 9, 13, 17, 21) checked HTTP 200; the geohealth MapServer ids differ and that host timed out from the box. sources.yaml parses as YAML again.

### Local Zetaris on the 5080, steps for Joe (gate G2, never AWS)
1. Windows side: install Docker Desktop with the WSL2 backend. Cap WSL2 in `%UserProfile%\.wslconfig`: `memory=8GB`, `processors=4`.
2. WSL2 terminal: create the shared network `docker network create porchlight`, then pull and start the Zetaris build from the hackathon sponsor page (unverified: community/local edition and the default 8080 UI port are not confirmed from the sponsor page yet, L13), exposing its UI port on loopback only. `docker run -d --name porchlight-zetaris --network porchlight -p 127.0.0.1:8080:8080 <zetaris-image>`.
3. Same WSL2: start PostGIS on the same network with no published port, credentials via env file: `docker run -d --name porchlight-postgis --network porchlight --env-file data/.env.postgis postgis/postgis:16-3.4`. Publish `127.0.0.1:5432:5432` only if local psql access is needed. `data/.env.postgis` is gitignored (root `.gitignore` covers `.env.*`); shape is placeholders only:

   ```
   POSTGRES_PASSWORD=<password>
   POSTGRES_DB=porchlight
   ```
4. Zetaris admin UI: register a JDBC datasource `porchlight_postgis`: `jdbc:postgresql://porchlight-postgis:5432/porchlight`, user `postgres`, password from env, never in code or docs.
5. Verify: run `SELECT 1` through Zetaris SQL against the datasource, then mark G2 in the Gates table.

last update: Wed Oct 21 2026 9:04 PM ET

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
