# HANDOFF
Updated: Wed Oct 21 2026 8:20 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

Work from origin/ branches or your own worktree; do not rely on the shared clone's local branch names.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Delivered by Devin's PR #14 (https://github.com/JoeProAI/porch-light/pull/14) on `contract/initial`; H1 validator fix in commit 83a6afd; Wringer-passed; that commit is now on main and on this branch. Real-data-only contract repairs and current review evidence are still required |
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
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit. Devin wrote the contract (PR #14). Cursor is credited for the .cursor/rules/ files and the web and data cloud agents (per .cursor/rules/sponsors.mdc at 362e1c8). Cursor cloud-agent evidence later landed in merged PRs #22 and #24. No token count or spend is recorded.
- 2026-10-21: Joe requires real data or nothing. Do not implement fixture-backed routes, invent scores/query IDs/model replies, or substitute synthetic records when a source fails. Verification uses captured public records; corrupted copies only test refusal paths. Existing fictional fixtures in unmerged PRs are not operational data and must not be used for the product or demo.

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
state: checked-in submission profile is Manatee only (FIPS 12081). CMS, Census, HHS emPOWER, Milton warning sections, the Bradenton CEMP PDF, and 93 Manatee SVI tract rows are in the tree with provenance sidecars. Private PostGIS load and read-only JDBC export views are implemented. No scoring engine, model replies, or Zetaris query ids are invented in that checked-in profile. The scaffold landed as PR #1. Sarasota captures and the national SVI gzip are not in this branch after the Manatee freeze. Separately, national CMS, Census geography and geocodes, 2022 SVI, HHS emPOWER, and NWS county and forecast-zone assets are captured privately under USERPROFILE/.porchlight. The immutable capture has 22,180 CMS records and returned geocodes, with 20,160 Census matches, not all exact. The canonical Census catalog contains 3,235 counties and county-equivalents. Ten missing current-code county geometries have official Census supplements. Those national source bytes, hashes, timestamps, and licenses remain outside Git.
next step: finish the separately audited county and alert sweep and retain every missing-source, geocode, and join gap. No national raw datasets enter the repository. Missing county plans are not replaced with the Manatee plan or a guessed value. Obtain the licensed Zetaris bundle and register the read-only JDBC exports. No direct PostGIS application read substitutes for Zetaris.
branch: devin/web-manatee now carries the Manatee intake from PR #17 and the private national capture workflow. The checked-in Manatee intake remains the submission profile. Joe owns every merge. Existing review flags are not claimed cleared.
how to run: `python -m data.adapters.us.capture_national --help`; `python -m data.snapshot.national --folder <verified-local-capture>`. The loader uses national_shapes internally to preserve official polygon rings. capture_radar_assets supplies bounded, allowlisted IEM PNG and clock captures to engines.radar_assets, with original bytes and provenance outside Git. Ingest writes immutable source records to the dedicated PostGIS schema; application data reads remain exclusively through audited Zetaris SQL. Manatee checks: `python -m data.adapters.us.preflight_county --county manatee`; `python -m data.snapshot.load_snapshot --county manatee`; `python -m data.snapshot.reader`; `python -m unittest data.snapshot.test_database -v`; `python3 data/provenance/sidecar.py <file> --source-url <u> --license "<line>" --fetch-command "<cmd>"` and add `--verify` to check a sidecar. Private credentials stay outside Git and are not command arguments.
blocked: source quality varies by county, territories lack some context, and unmatched or non-exact addresses remain unrankable. National policy is an explicit unvalidated four-term screen in canonical weights.yaml; it omits county plans instead of inventing them. Operational status and emergency-contact reachability are not verified. Licensed Zetaris platform bundle, registry entitlement, and actual JDBC audit proof remain open, along with source refusals, operator review, historical applicability, and policy repairs.

emPOWER note: sources.yaml now cites the HHS emPOWER FeatureServer ZIP level layers (1, 5, 9, 13, 17, 21) checked HTTP 200; the geohealth MapServer ids differ and that host timed out from the box. sources.yaml parses as YAML again.

### Local Zetaris on the 5080, steps for Joe (gate G2, never AWS)
Earlier scaffold commands are not the current procedure. They used a shared network named `porchlight`, a gitignored `data/.env.postgis` with `POSTGRES_PASSWORD` and `POSTGRES_DB` placeholders only, an unpublished PostGIS port, and a loopback bind of 8080 for an unverified Zetaris image (L13). That image was never confirmed. Do not invent one. Current credentials live in the restricted `.porchlight` folder, outside Git, and the network in use is `porchlight-private`.

1. Docker and the dedicated PostGIS service are running. No Zetaris platform image/bundle is installed. Do not change WSL limits, firewall rules or the unrelated databases/services.
2. Joe approved continuing the local setup and private work. The pinned official PostGIS image is downloaded and porchlight-postgis is healthy with PostGIS 3.5.2. Existing unrelated databases remain untouched.
3. Private admin and JDBC-reader credentials are generated in separate files under the restricted .porchlight folder. Actual TCP password authentication verifies SELECT-only privileges and read-only transactions. No host port is published: the declared loopback mapping was inactive on Docker's internal network and was removed. The supported JDBC path is inside porchlight-private.
4. The [official local guide](https://zetaris.github.io/getting-started/docs/install/updated_zetaris_installation_guide.html) requires zetaris-platform.zip, its matching private .env, registry credentials and a license/evaluation entitlement from Run locally in the account portal. No such archive was found in Downloads. Do not invent a platform image or treat the Apache recipe license as a platform license. No signup, term acceptance or credit claim was performed.
5. Inspect the actual licensed bundle before running it. [Client setup](https://zetaris.github.io/getting-started/docs/connections/client-setup.html) documents direct REST at /api/v1.0, commonly port 8888, and the UI commonly port 3000. This machine already has a listener on 3000, so resolve bindings without disrupting it.
6. Connect the supported Zetaris driver to the dedicated data network and register PostGIS through JDBC using a restricted read role. Retain real query and audit identifiers for a spatial query over actual loaded records. SELECT 1, a listening port or pg_isready does not close G2.

last update: Thu Oct 22 2026 9:42 AM ET

### Two-county SQL proof, Oct 22 at 9:17 AM ET

Record of that pass, at commit 07f7ca5. Ninety-three primary source artifacts verified then. The private database contained 62 source facilities; SQL found 58 geography rows and 57 points covered by current published zones. All 90 checks passed then. Sarasota capture directories named below were removed in the later Manatee freeze and are not files in this branch.

- County selection was configured in counties.py and county_sources.py. Manatee was the golden path; Sarasota was the second real pilot. National CMS/SVI inputs and the Florida HHS capture were reused without calling broader geography operational.
- Sarasota's original CMS releases contain 30 nursing-home and 12 dialysis rows. Its new Census capture is census/20261022T122355Z-be9e3a8d and its actual Milton sections/current zone shapes are iem/20261022T123021Z-0919e9fc, FLZ160/FLZ260.
- Forty Sarasota rows return geography. CCN 105452 disagrees with the requested source county and CCN 682802 has no address match. Neither receives invented coordinates. The county-plan capture is unavailable; Manatee's plan is not borrowed.
- Real SQL results: Manatee 20 source rows, 18 geography, 18 current-zone covered, 18 SVI and 18 HHS context; Sarasota 42 source rows, 40 geography, 39 current-zone covered, 40 SVI and 39 HHS context.
- CCN 682716 is outside the published current zone union by a measured 18.66110511 meters. No buffer is applied to manufacture inclusion. CCN 105774 has no matching HHS ZIP/county row. These require review, not correction by guess.
- schema.sql, load_snapshot.py and real integration tests preserve original CMS rows, immutable source lineage and idempotent reloads. No persistent source tables are dropped, truncated or overwritten; transaction-owned scratch tables expire normally.
- JDBC export views provide scalar fields and JSON text. The restricted role authenticates over actual local TCP, defaults to read-only transactions and cannot insert/update/delete. Future private operator tables are not automatically granted. Credentials were not printed, committed or used as process arguments.
- This is real PostGIS evidence, not a Zetaris query/audit claim. Ranking, model execution, historical geometry equivalence and clinical validation remain unverified. No public service or docs deployment occurred.
- Secret scanning uses Gitleaks 8.30.1. Archive-depth scanning misclassified the .gz.provenance.json suffix; the directory is also scanned without archive traversal and the exact decompressed national SVI payload is scanned separately. No finding is treated as cleared by merely hiding the scanner error.
- Git staging exposed Windows line-ending conversion and whitespace checks on original publisher data. .gitattributes now preserves all raw artifacts/sidecars exactly and classifies them as vendored source data. Indexed-blob checks verify every retained file against its original working bytes. No source payload was edited to satisfy style checks, and no normalized copy was published.

### Real source intake proof

- Coastal flood warnings: data/snapshot/raw/nws/20261022T022303Z-b4222c27 contained four real alerts and seven source zone shapes at the time of this note. That directory was removed in the Manatee freeze and is not a current verification input. An earlier partial NWS capture was already unused.
- CMS: data/snapshot/raw/cms/20261022T030046Z-a5ce96ba contains official nursing-home and dialysis CSVs plus release metadata. Counts from those exact files are 14,690 nursing-home rows and 7,490 dialysis rows nationally; CMS county labels identify 12 nursing homes and eight dialysis listings for Manatee.
- CMS phones are present on those 20 source rows. Dialysis CCN 102538 is explicitly named zz_closed_BRADENTON ARTIFICIAL KIDNEY CENTER by the source and is flagged for refusal/review. No operating status or phone reachability has been independently confirmed. A nursing home with Sarasota city text remains labeled Manatee by CMS; city names are not county geocodes.
- CMS metadata modified dates are 2026-09-30 for nursing homes and 2026-06-16 for dialysis. These releases do not establish October 2024 conditions.
- Milton: data/snapshot/raw/iem/20261022T030817Z-ad065921 contains the real 202410072107-KTBW-WTUS82-TCVTBW issuance, IEM event history for HU.W.1014, and current NWS shapes for the actual FLZ155/FLZ255 sections. This is only the Manatee subset of a multi-county warning, not an assembled full warning polygon.
- IEM event metadata retains later cancellation status rather than pretending it is a live warning. Current shapes are not asserted to match 2024 boundaries. Original bytes, source URLs and actual fetch times remain in sidecars.
- Zero coefficient placeholders are replaced with Joe's approved formula coefficients. No scoring engine, normalized term values, rankings, explanations or Zetaris query IDs are fabricated. Missing or unverified inputs block ranked output.
- The aborted contract worktree had no edits and was removed after Joe rejected fixture-backed development. Original PR contents and reviewed history remain unchanged. All current implementation work stays in the canonical checkout.

### Cross-source wins, Oct 22 at 12:10 AM ET

- Census capture: data/snapshot/raw/census/20261022T033241Z-b99bf8af contains the actual benchmark/vintage metadata and nineteen responses, all with verified sidecars. CMS source hashes, CCNs, request URLs and request echoes bind each observation to the correct source row.
- All twelve CMS nursing-home points return Manatee County and Census tract geography. Six dialysis addresses return one match; the API supplies no Exact match rating, so no such rating is invented. DaVita CCN 102646 has no Census address match. CCN 102538 remains refused because its source name marks it closed.
- Eighteen rows resolve to fifteen distinct Census2020 tracts. They all had national 2022 SVI values, from the 84,120-row US release used in that pass. That pass stored the source as gzip, with compressed and original content hashes. The 778 unavailable national percentile rows were not zero-filled. No Florida-relative release was substituted. The gzip bytes were later removed; the checked-in file is the 93-row Manatee subset described in the freeze note.
- HHS capture: data/snapshot/raw/empower/20261022T034841Z-6bed0765 retains the official layer-1 identity, Florida count query and all 968 Florida features. All eighteen geocoded rows have ZIP/county context. This is an ingest precheck, not a Zetaris-measured join or facility patient count. Shared ZIP contexts must not be summed per facility, and values of 11 retain suppression caution. Service edit times are not asserted to be a reporting month.
- CEMP capture: the direct County Clerk URL returned 403, retained as a failure, not bypassed. The official City of Bradenton record at data/snapshot/raw/cemp/20261022T033833Z-30a3bbd5/bradenton_adoption_2020.pdf is a real 93-page PDF containing the 2018 Manatee CEMP and the 2020 adoption resolution. Structure/text were inspected with the already installed PDF reader. No new parser dependency or Nemotron Parse call was introduced. Current/2024 applicability remains unverified.
- The source preflight preserves both real refusals, source phone values and review requirements. It emits no ranks, scores or Zetaris query IDs and is explicitly not an application API. No data reader may use it to bypass the runtime Zetaris requirement.
- All work in this pass was local CPU or public-source acquisition. No inference, model download, Modal run, paid actor, signup, pull/start of a database image, merge, push or deployment occurred.

### Manatee freeze

Later commits on the data branch restricted the checked-in profile to Manatee (FIPS 12081). Sarasota census, warning, and per-facility response files were removed. `counties.py` registers Manatee only. The national SVI gzip bytes were removed. The checked-in SVI artifact is `data/snapshot/raw/svi/manatee-2022/SVI_2022_12081.csv`: 93 tract rows, all STCNTY 12081, with a provenance sidecar. The sidecar records the national source URL, the original content hash, `input_source_bytes` 61102059, and that percentiles were not recalculated. A sidecar for the removed gzip remains at `data/snapshot/raw/svi/20261022T034709Z-8417dfb9/SVI_2022_US.csv.gz.provenance.json`. Manatee CMS, Census, HHS, Milton IEM, and CEMP captures named above remain. `data/snapshot/test_database.py` asserts the Manatee load only: 20 source rows, 18 geography, 18 current-zone covered, 18 SVI, 18 HHS context. No ranking JSON or Zetaris query id was added by that freeze.

## Area: Engines
owner now: Devin, takeover approved by Joe
state: Manatee retains 18 deterministic ranks and two refusals with seven distinct audited statements. Every ranked facility has a grounding result: 15 accepted drafts, three retained failures that exhausted their sole retry. National county discovery and official-alert point coverage are implemented against separately projected CMS, Census, SVI and emPOWER relations, with individual audit IDs and SQL match counts. The Oct 21 Nightshift setup receipt is the subsection below: daemon 1.2.1, Lightning for fast, Super VL 3.5 for deep, discovery 200 when authenticated, and zero generation counters at that moment. Later work on this branch did run the free NVIDIA route. That later work does not rewrite the setup receipt.
branch: devin/engines-manatee, PR18; Joe merges. This web branch carries that engine work.
how to run: engines/README.md; national_jobs supplies asynchronous county and alert jobs and source-verified live call scripts. radar_assets captures bounded IEM PNGs and clock metadata, then reads them through Zetaris before serving verified bytes locally. The JDBC bridge preserves UTF-8 and caches compiled bytecode outside Git. Original bundle mode remains explicit, with no fallback. Nightshift calls use http://127.0.0.1:8088/v1 with METERLESS_TOKEN_FILE pointing to Nightshift's existing proxy-token; meterless-app: porch-light on requests, meterless-scope: user on chat, 180-second timeout.
next step: finish reporting the county and model sweep, including retained failures. Preserve per-county timings, source refusals, unmapped alerts, and every failed draft. Local Nemotron download and offline replay remain a separate approval. See the Status section for the later sweep record.
blocked: local GPU inference and clinical validation remain unverified; all source relations currently share one physical PostGIS datasource. Joe approved up to 2,000 total Meterless request attempts, including retries, on the free NVIDIA Nemotron route. Each failed draft gets at most one linked retry. Provider or cost violations block further calls. OpenRouter backup stays disabled because no enforceable paid fallback was enabled. No Modal or paid execution. The laptop's 16 GB VRAM does not fit the bundled 30B local candidates. No local model download is approved by the setup pass.
last update: Fri Oct 23 2026 for the national engine path. Nightshift setup receipt: Wed Oct 21 2026 10:35 PM ET.

### Nightshift setup and operator use

- Verified daemon version: 1.2.1. The wizard's displayed Meterless version is not the daemon version.
- Hosted sources enabled: nvidia/nemotron-3.5-lightning-30b-a3b and nvidia/nemotron-3.5-super-vl-120b-a12b. The current catalog's other 165 entries are disabled, including the older Super 3 route and oversize local Lightning candidates. Recheck policy after a Nightshift update or adding any model.
- Read-only route previews for porch-light select Lightning for fast, Super VL 3.5 for deep, and no candidate for local. A preview calls no model. Discovery alone does not prove model readiness.
- Race width and parallelism are one. Post-answer model budget is zero. Cross-checks and idle method mining are off. Do not start background jobs or test prompts without an approved inference budget.
- API hotspot is off. The model API remains on loopback. Port 8089 serves the phone companion, not the management API: /admin/status there returns static HTML, not an admin document. A wrong pairing code receives an error. Administration used the per-user Windows named pipe, not a LAN admin endpoint. No firewall settings changed.
- In the wizard, NVIDIA should now appear connected. Continue to inspect the next setup screen. Do not choose Qwen, enable other provider keys, activate a mixed fleet, or start a sample job.
- Porch Light calls Meterless from application code. Use fast for short grounded explanations, deep for join proposals and more involved explanations, and local only after the actual Nemotron lane is ready. Rank remains deterministic code. Zetaris remains the runtime data path.
- Nightshift does not supply missing facility facts, make phone calls or validate clinical priorities. Send only the public, sourced evidence needed for each explanation.
- The catalog's 18.9 GB Lightning Q4_0 and 23.2 GB MXFP4 weights are not full-GPU fits on this laptop. A smaller candidate is bartowski/nvidia_NVIDIA-Nemotron-Nano-9B-v2-GGUF at revision b2daccafb3d123ea94653720a0db1f5db9c698ff, file nvidia_NVIDIA-Nemotron-Nano-9B-v2-Q4_K_M.gguf, 6525629280 bytes. This is a candidate, not a verified lane; download, runtime compatibility and offline output are still pending.
- Runtime counters after setup: zero generation requests, races and tokens. Provider catalog lookup did not generate tokens. No Modal run, cloud worker, push, merge or deployment occurred.

## Area: Eval and CI
owner now: Codex  (primary Codex, backup Claude Code)
state: not started
next step: see your CREW brief
branch: codex/eval-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Web
owner now: Cursor cloud agent (web). Devin integrates the national workflow; Cursor authored PR22's MapLibre map and this Storm Watch hosted-feed fix.
state: Production `/api/weather` and `/api/weather/radar-assets` returned 503 because those routes exec `engines.live_weather` and `engines.radar_assets`. Vercel has no Python, no Zetaris JDBC, and no `~/.porchlight` filestore. A live probe at 23:54 UTC on Oct 25 confirmed the 503 body and `Audited radar source unavailable`. The hosted fallback now fetches the public NWS active-alert feed and IEM USCOMP N0Q tiles, labeled `public_nws` and `public_iem`, with SHA-256 and source URL, and with an empty Zetaris query list. No query id is invented. The local engine path still wins when it succeeds. Manatee pins on Storm Watch no longer use the 44px glowing porch square: at national zoom they are one small county chip, and close zoom shows 18px rank dots. The map attribution control starts collapsed so that chip is not covered. The OpenStreetMap and Iowa Environmental Mesonet credit stays in the line under the map. No offline DGX, H-MEM, World Model, or all-counties-drafted claim. The published national catalog weather blob stays `status: unavailable` (frozen sweep, checksummed). Nationwide alert runs stay local-origin.
next step: Joe reviews the Storm Watch PR. Do not merge and do not deploy from this branch. After merge, a normal Vercel production deploy picks up the fallback. No new env var or secret is required. Optional `PORCHLIGHT_WEATHER_SOURCE=zetaris` forces the old fail-closed path. Optional `PORCHLIGHT_WEATHER_SOURCE=public` skips the engine.
branch: cursor/storm-watch-weather-badges-af8b off main.
how to run: from `web`, `npm run typecheck`, `npm run test:unit`, then `npm run dev` and open `/watch`. `GET /api/weather` should be 200 with `data_access_mode` `zetaris` when the engine is up, otherwise `public_nws`. A radar tile is `GET /api/weather/radar-assets/nexrad-n0q-900913/4/3/6.png`. Playwright: `PLAYWRIGHT_CHROME` set to the local Chrome binary, then `npx playwright test tests/weather.spec.ts`. Start-Local.ps1 remains the audited worker on the 5080.
blocked: continuous hosting, shared multi-operator coordination, verified facility conditions, clinical validation and measured operator usefulness aren't established. Basemap cartography is external reference, not cited hazard or facility evidence. This pass does not deploy and does not spend. The NOAA CONUS GIF is about 6 MB and is not proxied on the hosted path (serverless response limit). The map uses IEM tiles.
last update: Sun Oct 25 2026, after the 23:54 UTC production weather probe.

## Area: Docs
owner now: Hackathon Desk docs seat (primary Hackathon Desk docs seat, backup Claude Code)
state: docs/*.mdx are filled from the hosted nationwide desk and the committed published pack. No page is a Coming soon stub. docs/contract/openapi.yaml points at contract/openapi.yaml so Mintlify can read the contract spec. The API introduction says those generated pages are the contract, not the routes porchlight.earth serves. No public docs URL.
next step: Joe shoots the video from docs/quickstart.mdx and submission/demo-script.md. Do not publish Mintlify until Joe says yes. Do not merge this docs PR from the agent seat.
branch: cursor/docs-submission-front-matter-fe66 off main. Earlier stubs were PR #13.
how to run: cd docs && npx mint dev. Product desk: https://porchlight.earth/nationwide
blocked: Mintlify publication still needs Joe's yes. No separate docs deployment exists.
last update: Sun Oct 25 2026, after a live GET of /api/national at 23:08 UTC.

## Area: Front matter and ops
owner now: Hackathon Desk  (primary Hackathon Desk, backup Devin)
state: README, metadata.json, DECLARED_PREEXISTING.md, and SPONSOR-SETUP.md match the hosted pack. demo_url is https://porchlight.earth. demo_video and slide_deck stay empty. Pre-existing where paths point at files that exist (web/design/proof-contract.json, web/public/art/, docs/images/). design/art/manifest.json is not in the checkout and is not cited as if it were. Nemotron 3.5 Embed stays off metadata.json. Cursor models list stays empty.
next step: Joe records the video and pastes that URL into demo_video. HackOS form field names still need Joe's login if the community schema differs from the form. Do not merge from the agent seat.
branch: cursor/docs-submission-front-matter-fe66 off main.
how to run: metadata.json validates against metadata.schema.json.
note: the contract was written by Devin (PR #14), not Cursor. Cursor evidence is merged PRs #22, #24, and #47. No token count or spend is in the repo.
blocked: HackOS field names still need Joe's login. The video is unshot.
last update: Sun Oct 25 2026.

## Area: Deck, script, explanation
owner now: Hackathon Desk  (primary Hackathon Desk, backup Claude Code)
state: submission/written-submission.md, submission/demo-script.md, submission/README.md, and submission/verification.md are updated to the hosted desk and the published-pack counts. The video file and the slide deck are not in the repo.
next step: shoot https://porchlight.earth/nationwide using submission/demo-script.md. Anchorage, Doña Ana, then Harris. Do not press Generate on the public host. Leave contact status on Not contacted. Paste the video URL into metadata.json demo_video after the file exists.
branch: cursor/docs-submission-front-matter-fe66 off main. Narrative files under ops/narrative/ were not added.
how to run: open the three county URLs in submission/demo-script.md.
blocked: the recording itself. No deploy and no model spend from this pass.
last update: Sun Oct 25 2026.

## Area: Integration and review
owner now: Devin, takeover approved by Joe
state: reviewed the Porch Light history in MadMax Mode and Hackathon Desk, including their existing coordination messages. Recovered the omitted Storm Watch, global, Android and design decisions. This is context recovery, not a fresh PR review.
next step: finish the real Manatee workflow and local Nemotron verification before conditional features. Preserve current contract findings and review blockers.
branch: HANDOFF-only integration notes on devin/data-nws-capture; no new PR.
how to run: source links and recovered decisions below; no bot messages or jobs were started.
blocked: original planning files remain on the Grok computer, not in this checkout. Existing contract/review, Zetaris and local Nemotron gates remain open.
last update: Wed Oct 21 2026 10:49 PM ET

### Scope checks, Oct 21 at 10:35 PM ET

- Intended domain in the local takeover pack: porchlight.earth. DNS resolves to Cloudflare. The live HTTPS check returned Cloudflare 525, so serving status and noindex are not verified. Vercel MCP domain lookup returned 403. No DNS, domain or deployment setting changed.
- Global direction is explicit in contract/adapter.md and GitHub issue 11: GDACS, national CAP feeds, OSM/Overpass and WorldPop, gated on the real US golden path. Global open data has no assumed emPOWER equivalent. Do not claim global operating coverage yet.
- Joe identifies the Grok bot sessions for Madmax and Hackathon Desk as the place to recover the full project history, including Storm Watch. After Joe signed in, the relevant history and coordination messages were read; recovered decisions are below. The former sign-in blocker is cleared.
- Local takeover documents state a Modal ceiling of $500 total with a mandatory stop at $450, big tests only, never the demo path, and a per-run ledger. No ops/modal-ledger.csv was found in the fetched branch history, so the remaining allowance is not verified. No Modal request has run here.
- Source expansion candidates are NOAA/NHC, NOAA archives and tide observations, plus lawful targeted public-facility enrichment. These are candidates, not integrated feeds. Apify credentials belong in ingestion tooling, not Nightshift; any paid actor needs approval.
- Shared recall returned no relevant project specification. One invocation unexpectedly downloaded an approximately 79 MB Chroma embedding model through its default fallback; no paid inference or Nemotron download occurred. Do not rerun that fallback without checking its download behavior.

### Recovered Grok context, Oct 21 at 10:49 PM ET

Sources: [MadMax Mode](https://grok.com/bot/e32e1803-b3c9-48af-999c-9cf426cb5c99) and [Hackathon Desk](https://grok.com/bot/9f93b8d9-281d-47cf-a00b-a187864f0440), including the existing MadMax/Desk and review coordination messages. No prompts, bot work, claims or purchases were initiated during this read. Summaries below distinguish decisions from implementation proof; private transcripts and contact details are not copied here.

- Storm Watch is a public spectator side page, not the emergency-manager call sheet or an agent monitor. Joe proposed a PG version of hiddentrack.fm with storm-relevant music and visuals. The plan uses the existing warning feed for a live warning map, curated music and severity-responsive visuals, plus links to the local NWS office and ready.gov.
- Storm Watch safety: Hidden Track has no reliable content-rating field, so songs require Joe's individual approval. If the viewer is within an active warning, the planned behavior is to pause music and show official instructions first. Do not expose patients or facility contact/check-in details on the public page.
- Joe explicitly asked to keep Storm Watch moving without sacrificing the main product. It remains conditional on the core being solid and the Saturday Oct 24, 10 PM ET freeze. The quoted seven-hour estimate is a bot estimate, not measured work. No Storm Watch implementation exists here.
- The session records porchlight.earth as purchased through Vercel, with Cloudflare free-plan DNS and custom nameservers corey.ns.cloudflare.com and maya.ns.cloudflare.com. This explains the Cloudflare DNS seen locally. It is historical purchase evidence, not a new account-ownership check; the observed HTTPS 525 remains unresolved. Keep the domain parked/noindex until Joe's specific reveal approval.
- Global scope was requested by Joe and accepted as country adapters plus one international proof after the US golden path. GDACS, national CAP feeds, OSM/Overpass and WorldPop are the planned global sources. Missing US-specific emPOWER/SVI/CMS equivalents remain unavailable, not invented. This is not a claim of current global coverage.
- Joe's original Modal instruction is a maximum of $500 for major tests, such as model tests, eval sweeps and load checks. Porch Light's allowance is separate from Hidden Track and other projects. The later takeover guardrail stops at $450 with a per-run ledger and approval before a bounded run. No balance is inferred from historical bot status cards.
- Lawful Apify work was explicitly requested, limited to public data within the source site's terms. It is not permission for paid actors, login bypasses or scraping personal health data. Other development agents are tooling, not extra product model providers.
- Android is an agreed late-stage direction: a Capacitor 7 wrapper, with a signed APK/internal-test delivery first and an offline snapshot. The session contains a historical $25 Play developer fee approval, not evidence that enrollment, payment, identity checks or publication completed. Verify current Play requirements and obtain specific approval before any new irreversible action.
- The agreed visual direction is Night Ledger from Proof Desk: dark storm tones, restrained amber on the next call target, and the emphasis moves when that target is marked called. Reuse verified design tokens and declared assets rather than inventing a new generic dashboard. The bot's design score is not an independent quality metric.
- The competition pass proposed an emPOWER aggregate-versus-facility counter, a warning-time clock and an offline-verifiable export receipt/QR; masking sensitivity and county-plan gaps were later extras. These are proposals, not implemented capabilities or medical deadlines. Never call an artifact tamper-proof or quote competitive/time-saving claims without proof.
- Hackathon Desk's early suggestion that Nemotron decides rank is superseded by the later fixed formula and Joe's current handoff. Its reported PR approvals are historical, not clearance of current hidden findings. Real Cursor authorship evidence, actual source/query closure and measured local/cloud/offline results remain required.
- The build pack and planning artifacts referenced in the sessions are under /workspace/hackathons/open-agent-2026/porch-light/ on the Grok computer, including STORM-WATCH.md, ANDROID.md, COMPETITION.md and CREW briefs. The top-level BRIEF.md and REVIEW.md are also referenced. Their file contents have not been transferred or independently checked here; do not copy internal planning wholesale into the product repository.

### Visual review, Oct 21 at 11:23 PM ET

Joe explicitly requires exceptional visual quality, not merely a functional dashboard. Reviewed MadMax's design message and all four existing static assets at full size in the Grok image viewer: the flooded-street porch, aerial brass-link plate, four-porch call-first plate, and 1200x630 share card. This review did not generate art, send bot messages, assess the video loops or verify a running Porch Light UI.

- Keep: the flooded-street composition has useful negative space and one clear human-scale focal point. The share card establishes a strong editorial wordmark, warm ivory type, storm-dark material and restrained amber. These are concrete references, not reliance on the bot's self-assigned design score.
- Primary gap: the artwork is not the application. No web implementation or original Proof Desk token/asset bundle exists in this checkout. Do not claim finished visual quality, accessibility, mobile behavior or performance from these images.
- Truth constraint: generated storm scenes are illustration, not Milton photographs, live radar, facility locations or measured joins. The aerial plate's brass routes cannot be used as an operational map or an evidence graph. No decorative pins, invented counters or unsupported confidence gauges.
- Operator direction: build a call-first ledger, not a wall of rounded cards. Strong type hierarchy, fine structural rules, readable tabular values and a secondary real warning map. The selected facility and its source evidence must be obvious without color alone.
- Signature interaction: the restrained amber focus advances to the next uncontacted facility after an operator records contact status. The real map and evidence selection follow that facility when verified geometry exists. This does not recompute or change the fixed ranking.
- Route coherence: marketing gets the dramatic artwork and editorial type; the operator workspace gets quiet, precise information design; Storm Watch gets the more immersive map/player treatment. Do not repeat the same flooded-house hero on every route or animate weather behind dense operational text.
- Typography must come from the original token contract when retrieved. Preserve the share card's editorial contrast, but keep critical UI copy as accessible HTML, not baked into images. Do not replace the system with a default font stack or guessed one-off styling.
- Motion must explain state changes and evidence expansion. Respect reduced motion, avoid constant pulse/glow effects and reserve the GPU for local inference rather than unnecessary 3D decoration.
- Acceptance requires complete loading/error/empty/offline states, clear retrospective/source-vintage labeling, keyboard use, visible focus, readable contrast, touch targets, small-screen verification and a usable print export. An unavailable service must look intentional without pretending data exists.
- The existing share card has the required 1200x630 dimensions, but OG/Twitter metadata and image delivery are not wired or verified. Ship those with the real frontend, using actual product imagery when available.
- Cursor remains the primary web author. This is a visual quality brief for that lane, not evidence that Cursor has built it. Original assets, token export and generation/provenance manifest still need retrieval and declaration before shipping; screenshots taken for review are not production assets.

### Documentation and public progress, Oct 22 at 5:50 AM ET

- Joe requires detailed private tracking plus restrained public momentum. Full technical source, evidence, limits and blockers belong in the private repo/Mintlify source draft. HackOS copy must stay generic until an explicitly approved reveal.
- Never publish the product name, domain, emergency/healthcare use case, geography, facility names, source identifiers, screenshots, architecture or distinctive features in a teaser. Do not present clinical outcomes, accuracy, working integration or sponsor completion that has not been verified.
- Mintlify source work is isolated on desk/docs-private-progress. The broken/unreachable generated OpenAPI navigation is replaced with a truthful API-status page. No fictional response example or operational endpoint claim is added. Remaining inherited pages are not declared publication-ready.
- The controlled HackOS browser was rechecked at 6:08 AM ET and still shows the existing-account sign-in form. Grok authentication is separate. Task-board access and visibility have not been verified. Do not try another identity or create a duplicate account.
- Joe approved the redacted update with "Yes go ahead." No public card was created, marked complete or edited and no update was posted because authentication is still blocked. After login, verify the actual project board and target before using that approval.
- Approved public copy, not posted: "Real-source checks are passing. We're testing the failure paths before end-to-end integration. Keeping the details private until the demo is ready."
- Approval covers this generic update on the existing project board, not a detailed reveal, Mintlify publication, signup, new account, outreach, credit claim or paid action. Existing reveal/deploy controls remain in force.

### Judge entry, sponsor proof and map modes, Oct 22 at 10:16 AM ET

- The private docs now start with a judge route, followed directly by sponsor evidence. The required final sequence is warning, call-first list, source/query/model inspection, operator status/export, then the same snapshot offline. It is separate from the currently runnable source/SQL review route.
- The guide maps all six official criteria and their weights to required evidence, without assigning the project a score. No application demo URL or completed workflow is invented.
- Zetaris, Meterless, NVIDIA and Cursor are acknowledged with current verified state and missing proof. Editor rules do not prove Cursor development, routing is not generation, and PostGIS is not a Zetaris audit. No sponsor credit/award/endorsement claim is made.
- Two map views are intended: an operator map paired with the call list and a public Storm Watch view. Live mode means actual warning updates with source times, not live patient tracking, current power knowledge or generated forecasts. Retrospective Milton and aged offline snapshots must be clearly labeled.
- The map UI and scheduled refresh are not yet built. Source geometry and actual SQL coverage are prepared. Public viewing must not expose operator notes or patient information; unknown coordinates get no pin and points are not buffered to manufacture coverage.
- This is private documentation source at 207c49b, not a deployed map or published sponsor announcement. Mintlify rendering and the actual application still require verification.

## Status
2026-10-22 10:16 AM ET record: private draft PR 17 then held the two-county data, and local docs commit 207c49b adds the judge/sponsor/map contract. That pass reported 62 source facilities, 58 geography rows, 57 current-zone covered points, 93 verified primary source artifacts, and 90 passing checks. No forced matches.
Checked-in profile after the Manatee freeze: Manatee CMS, Census, HHS, Milton IEM, CEMP, and 93 SVI tract rows (FIPS 12081) with provenance. Sarasota captures and the national SVI gzip bytes are not in the branch. `data/snapshot/test_database.py` asserts 20 Manatee source rows, 18 geography rows, and 18 current-zone covered points. No ranking JSON and no Zetaris query id.
Privacy: technical details remain private. Approved generic HackOS copy is not posted and Mintlify is not published.
Blocked: actual Zetaris bundle and JDBC audit, normalized policy and contract, local Nemotron, operator quality review, and missing or uncertain source coverage.

### Nationwide App Milestone, Oct 23 at 6:22 PM ET

- `/nationwide` now supports county-name, state-abbreviation and FIPS search across the actual audited 3,235-entry source catalog. Diacritics are normalized for search; ambiguous county names require an explicit source selection.
- Verified real Baldwin County, Alabama runs from name search, with 12 CMS rows, eight ranked facilities and four honest refusals. Verified captured active NWS warning selection in the same app on desktop and mobile, with no Manatee substitute.
- Alert results retain separate catalog, weather-read, county-mapping, source-join and facility-warning audit receipts. Actual unmapped marine alerts produce an audited source gap instead of invented counties or facilities.
- Source results are published before Nemotron processing completes. Model failures don't discard an already verified ranking. Meterless plus Nemotron remains exclusive, with the free NVIDIA route and a shared 2,000-attempt limit including retries.
- Verification: production build and strict TypeScript pass; 12 nationwide browser checks and two real unmapped-alert checks pass across desktop/mobile; seven engine source/grounding/budget tests pass. No map, radar or styling implementation was changed for this milestone.
- The full county sweep is still running. Intermediate results are not final pass rates. A separate provenance-checked source-summary observer can report the source phase without waiting for the later model phase. Raw national sources and run checkpoints stay outside Git.
- Remaining gates: finish and commit the full measured sweep summary, verify arbitrary national top-row call scripts with retained attempt reasons, publish exact request/failure accounting, then obtain operator-usefulness evidence. No deployment, clinical validation or verified facility conditions are claimed.

### Live National Scripts, Oct 23 at 6:44 PM ET

- Forty desktop/mobile checks pass against the production build, including the actual top-three script requests in Baldwin, Alabama and Providence, Rhode Island. These are four app runs, six distinct facilities and 12 script outcomes, not nationwide model coverage.
- Ten scripts passed grounding on the first request. Two Providence scripts failed both permitted attempts and remain failed. Four failed attempts record `Extra data: line 1 column 2 (char 1)`. Nothing was repaired, hidden, retried a third time or replaced with prose.
- Fourteen script requests have matching Meterless free NVIDIA Nemotron receipts, with actual cost $0. The shared approval ledger separately showed 61 completed reservations and no unresolved reservations at the observation time.
- The call-script UI exposes retained request IDs, failure reasons, linked retries and available route/cost receipts. Cached re-requests preserve the same event IDs. Source/model polling preserves the selected facility rather than rehydrating operator state on every new row-array reference.
- The call-script worker timeout now accommodates both bounded provider attempts. The prompt describes verified directory/area context rather than mislabeling national live workflows as a retrospective example.
- The detailed aggregate check is `engines/reports/national-script-verification-2026-10-23.md`. Exact artifacts and failed provider content stay outside Git. The full source/model sweep is still running and must be reported independently.

### Source Gate and Single-Phase Scripts, Oct 23 at 10:40 PM ET

- The source summary was committed and pushed before 10 PM ET: all 3,235 counties attempted, 3,234 first-pass audited chains, one retained Robertson, Texas JDBC failure. A separate real retry recovered that county without overwriting the original failure. Original p50 18.888s and p95 63.258s include the failure.
- After recovery, 2,491 counties return ranked rows and 2,882 return CMS rows. All 22,180 distinct CMS records are accounted for, including refusals and 2,245 canonical-county join gaps. The separate completion-time alert check covers all 535 mapped active-alert counties at its timestamp. Aggregate evidence is `engines/reports/national-sweep-2026-10-23.md`.
- Meterless's planner was rewriting the national structured-output task into numbered plans. JSON-object response format plus the supported single-phase header fixes new requests. Exhausted failures remain cached and failed. Never parse planning prose into a substitute draft or give exhausted drafts a third attempt.
- A real Denver top-three check passes on desktop and mobile after the fix: six grounded scripts, six free NVIDIA Nemotron receipts, no retry and $0 actual cost. Together with the earlier checks, there are 16 accepted scripts and two retained failures across 18 outcomes and 20 script requests. This is scoped verification, not national completion.
- The Windows exclusive-file audit lock can return `PermissionError` during contention. The bounded retry now handles that case, still fails closed on persistent denial and never removes another worker's lock. Occupied budget tickets are skipped without weakening the 2,000-attempt cap.
- The full model sweep is still running against 15,440 ranked rows in 1,544 batches. Its final provider counts, grounding rate, retries, failure reasons and cap omissions remain pending. Raw checkpoints and exact audit receipts stay private. No map, radar, styling or deployment changes are part of these milestones.

### Claim Lock and True Numbers, Oct 24 at 9:51 AM ET

- Allowed claims only: every catalog county source-audited through Zetaris at least once; grounded drafts in progress on free Nemotron routes; an operator can open any county with ranked facilities today when local Zetaris is reachable. Never claim offline DGX, H-MEM, World Model, or that all counties are drafted.
- County coverage reconciled against the private sweep directory for `20261023T200048Z-78a426ba`: 3,234 first-pass county checkpoints, the retained Robertson, Texas failure, and its separate retry, so 3,235 of 3,235 source-audited and 2,491 with ranked rows. Connecticut planning regions and territories are present (200 checkpoints). The earlier Oct 24 pack's "about 3,153, Connecticut and territories skipped" is withdrawn; its origin was not found.
- Draft phase snapshot at 9:51 AM ET, directory still writing: `progress.json` 1,282 of 1,545 batches, 1,621 of 2,000 attempts reserved, `known_actual_usd` 0, paid fallback off. Batch files: 1,386 executions, 1,242 grounding passed, 144 failed, 12,418 accepted and 3,020 unresolved of 15,438 rows, 256 batches still carrying a retained policy-block reason over 2,570 rows. Reported models: 1,110 Lightning, 250 Super VL, 28 unreported.
- `metadata.json` now lists both Nemotron ids and a national project summary. `SPONSOR-SETUP.md`, `docs/sponsors.mdx`, `docs/local-run.mdx`, `docs/limits.mdx` and the four `submission/` files carry the same numbers and the same as-of time. Recheck the sweep before recording and move every figure together.

### Hosted desk and docs, Oct 25 at 7:08 PM ET

- The 9:51 AM ET block above is an earlier private-directory snapshot. It is not the figure set for the hosted desk. This pass did not re-read that directory.
- Live `GET https://porchlight.earth/api/national` at 23:08 UTC matches `web/data/national/published/`: sweep `20261023T200048Z-78a426ba`, generated `2026-10-24T16:47:04Z`, 3,235 catalog counties, 3,234 snapshots, 2,490 ranked counties, 15,440 ranked rows. Recount of the gz files: 14,960 passed drafts at actual cost 0, 480 failed. Robertson County, Texas (`48395`) returns HTTP 503 and no substitute county.
- The sweep report's post-retry total remains 2,491 ranked counties. That retry is not in the published pack. Quote 2,490 for the desk.
- `POST /api/national` on the public host returns 403. New model calls stay local. Docs pages are filled in `docs/`. No public docs URL. `metadata.json` `demo_url` is https://porchlight.earth. Video and slide deck fields stay empty.
- Allowed claims for the recording: every catalog county source-audited (the sweep report); stored free-route drafts in the published pack, failures included; an operator can open the 2,490 published counties that have ranked facilities on the hosted desk today. Offline DGX, H-MEM, World Model, Markovian, and accepted drafts for every county stay unclaimed. Milton stays a retrospective.
