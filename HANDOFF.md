# HANDOFF
Updated: Wed Oct 21 2026 8:20 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

Work from origin/ branches or your own worktree; do not rely on the shared clone's local branch names.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Delivered by Devin's PR #14 (https://github.com/JoeProAI/porch-light/pull/14) on `contract/initial`; H1 validator fix in commit 83a6afd; Wringer-passed; not yet merged |
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

### Wringer batch 1 (2026-10-21 ~8:30 PM ET)
Verdicts:
- PR #1 (data scaffold, head c03963d): pass. Fix M1 before Thursday loads: both CMS links in sources.yaml return 410.
- PR #14 (contract, head 30057b0): BLOCKED by H1. contract/types/ shadows the Python stdlib types module, so `python3 contract/validate_fixtures.py` crashes on 3.11 to 3.13. Fix: rename contract/types to contract/schema_types, or run as `python3 -m contract.validate_fixtures`.
- PRs #12 and #13 were not in this batch.

| Id | Sev | Problem (short) | Fix (short) | Owner area |
|---|---|---|---|---|
| H1 | High | contract/types/ shadows stdlib types; validator crashes, "exits 0" proof false | Rename folder or move validator; rerun in clean venv | Contract |
| M1 | Med | Both CMS URLs in sources.yaml return 410 Gone | Switch to provider-data datastore API; record URL in sidecar | Data |
| M2 | Med | NBER SSA to FIPS crosswalk URL returns 404 | Find current URL; license in sidecar | Data |
| M3 | Med | emPOWER layer note unsourced, says "etc" | Exact layer names and ids from data dictionary, cited | Data |
| M4 | Med | Zetaris docker run publishes 8080 on all interfaces | Bind 127.0.0.1 or tailnet IP | Data |
| M5 | Med | PostGIS on loopback unreachable from Zetaris at wsl2-host; G2 likely fails (not run) | Shared Docker network, connect by container name | Data |
| M6 | Med | PR #1 body lacks the required HANDOFF block | Use `### HANDOFF` template, placed last | Data |
| M7 | Med | "~1.5h" time claim does not fit an 8:24 PM ET commit | Correct to real in-window time; declare any pre-window work | Contract |
| M8 | Med | Contract credited to Cursor but Devin wrote it | Real Cursor follow-ups with links, or reword 4 places | Contract, Front matter and ops |
| M9 | Med | 6 "Manatee" mock facilities geocode to Sarasota (12115) but carry 12081 | Move points inside Manatee or flag as test rows | Contract |
| M10 | Med | Every mock reason says "upper band", even rank 25 | Rank-dependent mock reasons citing top terms | Contract |
| M11 | Med | Export receipt evidence_ids are first 10 in file order, not top 10 | Use ranks 1 to 10 or document rule | Contract |
| M12 | Med | Evidence trail dead-ends: query, trace and ledger ids do not resolve | Make fixtures referentially closed; validator checks it | Contract |
| L1 | Low | Failed join says 2 dialysis geocode failures; none marked | Mark 2 rows failed or drop, match count | Contract |
| L2 | Low | ccn -> ccn hop uses point-in-polygon | Use ccn -> nws_zone (or tract_geoid) | Contract |
| L3 | Low | Mock CCNs lack Florida prefix 10 | Use 10xxxx pattern | Contract |
| L4 | Low | Model step metrics not labeled mock | Add "detail": "mock values" | Contract |
| L5 | Low | Invented weights; term names differ from PR #1 weights.yaml | PR #1 renames to ScoreTerm enum; keep weights marked mock | Data, Contract |
| L6 | Low | openapi.yaml defines no auth | Add bearer/tailnet note or security scheme | Contract |
| L7 | Low | Validator uses Draft7Validator and deprecated RefResolver | Draft202012Validator with referencing | Contract |
| L8 | Low | Contract section timestamp 8:45 PM is in the future; PRs not linked | Real commit time; link #14 | Contract |
| L9 | Low | No emPOWER layer field in Fact/ScoreTerm | Optional layer (name plus id) on Fact or SourceRef | Contract |
| L10 | Low | Em dashes in three data READMEs | Replace with colons | Data |
| L11 | Low | sidecar.py accepts bad fetched_at, non-UTC offsets, blank fields; no tests | Validate on write, require UTC, strip, add test | Data |
| L12 | Low | Zetaris refetch claim unsourced; live NWS path undocumented | Cite doc; state live alert path | Data |
| L13 | Low | Zetaris edition and port 8080 are assumptions | Exact image and port, or mark unverified | Data |
| L14 | Low | POSTGRES_PASSWORD on command line lands in shell history | Use --env-file with gitignored .env | Data |
| L15 | Low | Data "open PRs" is a branch, not a PR link | Link #1 | Data |
| L16 | Low | Devin Review flag not visible on GitHub | Joe or Devin reads it before merge | Integration and review |
| L17 | Low | Commits authored as Joseph Gaither with no agent trailer | Optional agent trailer from here on | All |

Full review (outside the repo): /workspace/hackathons/open-agent-2026/porch-light/reviews/wringer-batch-1.md on the shared box.

### Wringer batch 1b (2026-10-21 ~8:46 PM ET)
Verdicts (no Highs):
- PR #14 (contract, head 83a6afd): pass. H1 fixed and verified on Python 3.11 to 3.13, including negative runs.
- PR #12 (front matter, head 68cd3c9): pass. Fix M14 and M15 before judge-facing text is built from metadata.json.
- PR #13 (docs, head e931ba4): pass.
- PR #15 (this PR) was not reviewed.

Still open from batch 1: M7 and M9 to M12 (the source also notes L8 is still open).

| Id | Sev | Problem (short) | Fix (short) | Owner area |
|---|---|---|---|---|
| M13 | Med | Validator checks facilities fixture against Facility, not RankedFacility; missing score/evidence passes | Validate against FacilityList or RankedFacility | Contract |
| M14 | Med | metadata.json says contract made in Cursor; Devin wrote it (same as M8) | Reword to real Cursor work, or real Cursor runs linked | Front matter and ops |
| M15 | Med | nemotron-4-340b-reward listed but 404ed in G0 smoke and was dropped | Remove or mark dropped | Front matter and ops |
| M16 | Med | PR #12 and #13 bodies lack the required `### HANDOFF` block (same as M6) | Edit both bodies to the template, placed last | Front matter and ops, Docs |
| L18 | Low | Commit d537834 subject has an em dash; history can't be rewritten | Won't fix (accepted) | Contract |
| L19 | Low | Fix note says shadowing on 3.12+; it also failed on 3.11 | Say "Python 3.11+" | Contract |
| L20 | Low | requirements.txt unpinned; referencing imported but not listed | Pin jsonschema>=4.18, referencing, pyyaml | Contract |
| L21 | Low | Path filter breaks on native Windows backslash paths | Use os.path.dirname/abspath | Contract |
| L22 | Low | Local Nemotron models and nemotron-parse-2.0 unverified | Tag "unverified" until G3 and Parse test pass | Front matter and ops |
| L23 | Low | Zetaris patterns declared Apache 2.0 with no source | Add the repo URL | Front matter and ops |
| L24 | Low | AGPL-3.0-only vs AGPL-3.0 stated inconsistently | Pick one SPDX id everywhere | Front matter and ops |
| L25 | Low | Area "last update" times later than commits; PRs named, not linked (same as L8, L15) | Use commit time; link the PR number | Front matter and ops, Docs |
| L26 | Low | Mintlify app or hosting would publish a public docs URL | Keep docs local until Joe says yes at submission | Docs |

Full batch 1b detail is in the same review file on the shared box.

## Decisions
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit. Devin wrote the contract (PR #14). Cursor is credited for the .cursor/rules/ files and the web and data cloud agents (per .cursor/rules/sponsors.mdc at 362e1c8).

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
state: in progress
next step: api-reference and the contract pages (architecture, zetaris-federation, meterless-and-nemotron, ranking, evidence-trail) are built against contract/initial (PR #14) and get re-pointed once #14 merges to main. Mintlify resolves the openapi path inside docs/, so after #14 merges, either copy or sync contract/openapi.yaml to docs/contract/openapi.yaml or set the docs root to the repo root. Fill the remaining stubs after the merge window; add the ranking weights once data/scoring/weights.yaml lands; leave eval numbers until measured results exist.
branch: desk/docs-stubs   open PRs: #13
how to run: cd docs && npx mint dev   (check: npx mint broken-links)
blocked: the API reference pages render only once the spec is reachable at docs/contract/openapi.yaml (see next step)
last update: Wed Oct 21 2026 8:55 PM ET

## Area: Front matter and ops
owner now: Hackathon Desk  (primary Hackathon Desk, backup Devin)
state: in progress
next step: (1) verify metadata.json field names against the HackOS submission form (behind Joe's login); current keys follow the community draft schema, not an official format. (2) Confirm the NIM model id for Nemotron 3.5 Embed 1B (still marked TODO in metadata.json). (3) Fill the "where" paths in metadata.json and DECLARED_PREEXISTING.md as the build lands. (4) Set demo_url once a demo is hosted (empty string for now).
branch: desk/frontmatter-fixes   open PRs: see PR "Front matter: add built_window/demo_url, Zetaris declaration, handoff update"
how to run: metadata.json validates against metadata.schema.json (demo_url and built_window added to the schema)
note: the contract was written by Devin (PR #14), not Cursor. metadata.json sponsors.cursor how and where are TODO placeholders now. Joe needs to settle real Cursor evidence (run links, usage CSV) and attribution before submission. README.md and metadata.json now credit Cursor per .cursor/rules/sponsors.mdc (362e1c8): .cursor/rules/ files plus the web UI and data backup cloud agents. .cursor/rules/ lands on main with PR #14. Cursor run links, models and the usage CSV are still owed.
blocked: HackOS field names need Joe's login (screenshot of the submission form or Setup Guide)
last update: Wed Oct 21 2026 8:35 PM ET

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
