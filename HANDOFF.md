# HANDOFF
Updated: Wed Oct 21 2026 8:20 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Devin's PR #14 is unmerged; real-data-only contract repairs and current review evidence are still required |
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
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit. Devin wrote the contract in PR #14; successful Cursor development evidence remains pending.
- 2026-10-21: Joe requires real data or nothing. Do not implement fixture-backed routes, invent scores/query IDs/model replies, or substitute synthetic records when a source fails. Verification uses captured public records; corrupted copies only test refusal paths. Existing fictional fixtures in unmerged PRs are not operational data and must not be used for the product or demo.

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
state: national CMS, Census geography/geocodes, 2022 SVI, HHS emPOWER and NWS county/forecast-zone assets are captured privately under USERPROFILE/.porchlight. The immutable capture has 22,180 CMS records and returned geocodes, with 20,160 Census matches, not all exact. The canonical Census catalog contains 3,235 counties and county-equivalents. Ten missing current-code county geometries have official Census supplements. Source bytes, hashes, timestamps and licenses remain outside Git.
next step: finish the separately audited county/alert sweep and retain every missing-source, geocode and join gap. No national raw datasets enter the repository. Missing county plans aren't replaced with the Manatee plan or a guessed value.
branch: devin/data-national, stacked on devin/data-nws-capture. The existing Manatee intake remains unchanged. Joe owns every merge.
how to run: `python -m data.adapters.us.capture_national --help`; `python -m data.snapshot.national --folder <verified-local-capture>`. The loader uses national_shapes internally to preserve official polygon rings. capture_radar_assets supplies bounded, allowlisted IEM PNG/clock captures to engines.radar_assets, with original bytes and provenance outside Git. Ingest writes immutable source records to the dedicated PostGIS schema; application data reads remain exclusively through audited Zetaris SQL. Private credentials aren't command arguments.
blocked: source quality varies by county, territories lack some context, and unmatched/non-exact addresses remain unrankable. National policy is an explicit unvalidated four-term screen in canonical weights.yaml; it omits county plans instead of inventing them. Operational status and emergency-contact reachability aren't verified.

emPOWER note: sources.yaml now cites the HHS emPOWER FeatureServer ZIP level layers (1, 5, 9, 13, 17, 21) checked HTTP 200; the geohealth MapServer ids differ and that host timed out from the box. sources.yaml parses as YAML again.

### Local Zetaris on the 5080, steps for Joe (gate G2, never AWS)
1. Docker and the dedicated PostGIS service are running. No Zetaris platform image/bundle is installed. Do not change WSL limits, firewall rules or the unrelated databases/services.
2. Joe approved continuing the local setup and private work. The pinned official PostGIS image is downloaded and porchlight-postgis is healthy with PostGIS 3.5.2. Existing unrelated databases remain untouched.
3. Private admin and JDBC-reader credentials are generated in separate files under the restricted .porchlight folder. Actual TCP password authentication verifies SELECT-only privileges and read-only transactions. No host port is published: the declared loopback mapping was inactive on Docker's internal network and was removed. The supported JDBC path is inside porchlight-private.
4. The [official local guide](https://zetaris.github.io/getting-started/docs/install/updated_zetaris_installation_guide.html) requires zetaris-platform.zip, its matching private .env, registry credentials and a license/evaluation entitlement from Run locally in the account portal. No such archive was found in Downloads. Do not invent a platform image or treat the Apache recipe license as a platform license. No signup, term acceptance or credit claim was performed.
5. Inspect the actual licensed bundle before running it. [Client setup](https://zetaris.github.io/getting-started/docs/connections/client-setup.html) documents direct REST at /api/v1.0, commonly port 8888, and the UI commonly port 3000. This machine already has a listener on 3000, so resolve bindings without disrupting it.
6. Connect the supported Zetaris driver to the dedicated data network and register PostGIS through JDBC using a restricted read role. Retain real query and audit identifiers for a spatial query over actual loaded records. SELECT 1, a listening port or pg_isready does not close G2.

last update: Thu Oct 22 2026 9:42 AM ET

### Two-county SQL proof, Oct 22 at 9:17 AM ET

- County selection is configured in counties.py and county_sources.py. Manatee remains the golden path; Sarasota is the second real pilot. National CMS/SVI inputs and the Florida HHS capture are reused without calling broader geography operational.
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

- Coastal flood warnings: data/snapshot/raw/nws/20261022T022303Z-b4222c27 contains four real alerts and seven source zone shapes. The earlier NWS capture directory is partial and is not used by verification.
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
- Eighteen rows resolve to fifteen distinct Census2020 tracts. They all have national 2022 SVI values, from the actual 84,120-row US release. The source is preserved losslessly as gzip, with compressed and original content hashes. The 778 unavailable national percentile rows are not zero-filled. No Florida-relative release is substituted.
- HHS capture: data/snapshot/raw/empower/20261022T034841Z-6bed0765 retains the official layer-1 identity, Florida count query and all 968 Florida features. All eighteen geocoded rows have ZIP/county context. This is an ingest precheck, not a Zetaris-measured join or facility patient count. Shared ZIP contexts must not be summed per facility, and values of 11 retain suppression caution. Service edit times are not asserted to be a reporting month.
- CEMP capture: the direct County Clerk URL returned 403, retained as a failure, not bypassed. The official City of Bradenton record at data/snapshot/raw/cemp/20261022T033833Z-30a3bbd5/bradenton_adoption_2020.pdf is a real 93-page PDF containing the 2018 Manatee CEMP and the 2020 adoption resolution. Structure/text were inspected with the already installed PDF reader. No new parser dependency or Nemotron Parse call was introduced. Current/2024 applicability remains unverified.
- The source preflight preserves both real refusals, source phone values and review requirements. It emits no ranks, scores or Zetaris query IDs and is explicitly not an application API. No data reader may use it to bypass the runtime Zetaris requirement.
- All work in this pass was local CPU or public-source acquisition. No inference, model download, Modal run, paid actor, signup, pull/start of a database image, merge, push or deployment occurred.

## Area: Engines
owner now: Devin, takeover approved by Joe
state: Nightshift NVIDIA key saved to its daemon keystore through the local Windows control pipe. NVIDIA catalog GET returns 200. Read-only route previews now select Lightning for fast and Super VL 3.5 for deep, matching KICKOFF-PROMPT.md; the older Super 3 route was enabled initially, then corrected without inference. Authenticated Meterless discovery returns 200; unauthenticated discovery returns 401.
next step: Joe approves a suitable local Nemotron download and local smoke test; verify generation, receipts and offline replay before closing G3. Keep application client changes on a separate devin/engines-* branch.
branch: no engine implementation branch or new PR yet; this data branch changes HANDOFF only for the setup receipt.
how to run: use http://127.0.0.1:8088/v1 with METERLESS_TOKEN_FILE pointing to Nightshift's existing proxy-token; meterless-app: porch-light on requests, meterless-scope: user on chat, 180-second timeout.
blocked: no installed local Nemotron lane. The bundled 30B local candidates exceed the laptop's 16 GB VRAM before context overhead. No cloud generation or local model download is approved by this setup pass.
last update: Wed Oct 21 2026 10:35 PM ET

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
owner now: Cursor cloud agents  (primary Cursor cloud agents, backup Codex)
state: not started
next step: see your CREW brief
branch: cursor-web/*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Docs
owner now: Devin for the bounded private documentation pass; Hackathon Desk remains primary
state: twelve MDX pages and navigation are updated in the isolated porch-light-docs worktree. Private commits 6ec5c7b and 207c49b record current implementation and a judge-first walkthrough, sponsor-evidence matrix and map-mode contract. Static source/route checks pass; no rendered build or publication was performed.
next step: integrate the verified data/contract work before publishing runnable application instructions. Reconcile remaining inherited stubs/contract-derived pages, retrieve the original design tokens/assets and run a real Mintlify build when tooling is approved.
branch: desk/docs-private-progress, based on origin/desk/docs-stubs at 49bd63c; existing PR 13 is unchanged and no new PR is open.
how to run: docs source is at D:\Projects\AI_Projects\porch-light-docs\docs. Eighty-three source/Git checks and seven actual SQL checks are documented, not misrepresented as a running API.
blocked: Mintlify CLI is not installed, application/contract integration is incomplete and publication requires Joe's approval. No push, Mintlify connection, deployment or public preview occurred.
last update: Thu Oct 22 2026 10:16 AM ET

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
2026-10-22 10:16 AM ET: Private draft PR 17 contains the real two-county data; local docs commit 207c49b adds the judge/sponsor/map contract.
Coverage: 62 source facilities, 58 geography rows, 57 current-zone covered points and 93 verified primary source artifacts; no forced matches.
Checks: all 90 pass, including seven real SQL checks and two Git-byte regressions; secret scans and known-credential audit pass. No public port or deployment.
Privacy: technical details remain private; approved generic HackOS copy is not posted and Mintlify is not published.
Blocked: actual Zetaris bundle/JDBC audit, normalized policy/contract, local Nemotron, operator quality review and missing/uncertain source coverage.
