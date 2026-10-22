# HANDOFF
Updated: Wed Oct 21 2026 10:04 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Devin's [PR #14](https://github.com/JoeProAI/porch-light/pull/14); unmerged, audit findings below |
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
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit. Devin wrote the contract in PR #14. Successful Cursor development still needs evidence.
- 2026-10-21: Joe approved the Devin takeover and verification pass. Devin owns Engines, Eval and CI, and Integration. Web remains Cursor first, Devin backup. No merge, deployment or credit claim is part of this pass.

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
state: not started
next step: see your CREW brief
branch: devin/data-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Engines
owner now: Devin (takeover recorded Wed Oct 21 2026 9:53 PM ET)
state: not implemented on main or the five open PR heads; verified with git ls-tree -r --name-only origin/main and the PR branch diffs.
next step: fixture-only model client first; one Meterless base URL, required headers, 180 s timeout, explicit online/unauthorized/offline states, Nemotron-only routing. No live inference in this audit.
branch: devin/engines-*   open PRs: none
how to run: no engine command exists yet; planned configuration names are METERLESS_BASE_URL and METERLESS_TOKEN_FILE. Never store token values in the repo.
blocked: G3 requires Joe's local runner and Meterless setup. Cloud NIM routing and actual model ids remain unverified by this audit.
last update: Wed Oct 21 2026 9:53 PM ET

## Area: Eval and CI
owner now: Devin (takeover recorded Wed Oct 21 2026 9:53 PM ET)
state: no eval harness or workflow exists on main or the five open PR heads; gh run list --repo JoeProAI/porch-light returns no runs.
next step: CI for contract fixtures, provenance tests, strict types, redacted secret scan, provenance coverage, commit window and branch/path checks. Add negative tests for the audit findings before treating a green validator as proof of scoring correctness.
branch: devin/eval-*   open PRs: none
how to run: on the combined PR tree, python contract/validate_fixtures.py and python -m unittest discover -s data/provenance -p 'test_*.py' -v pass.
blocked: contract and data checks depend on PRs #14 and #1 until Joe merges them. No fresh automated review covers the current five PR heads.
last update: Wed Oct 21 2026 9:53 PM ET

## Area: Web
owner now: Cursor first, Devin backup
state: no web implementation exists on main or the five open PR heads.
next step: Joe in Cursor or a successful Cursor agent builds against the shared contract; retain actual run links and usage evidence. Devin supplies API support without taking over web.
branch: cursor-web/* (Cursor), devin/web-* (Devin backup only)   open PRs: none
how to run: no web command exists yet.
blocked: successful Cursor development evidence is not present in the repo. Rules written by Devin do not establish Cursor development.
last update: Wed Oct 21 2026 9:53 PM ET

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
owner now: Devin (takeover recorded Wed Oct 21 2026 9:53 PM ET)
state: live GitHub state and all five PR heads audited. Main remains ffa61d9. The merge order below combines without conflicts on a local scratch branch only. Nothing was merged on GitHub.
next step: contract repair and fresh reviews, expiring alert capture, CI, model client, then one real-data Manatee call sheet. Keep global adapters gated on G4. Keep Web with Cursor.
branch: devin/ops-takeover (HANDOFF only)   open PRs: [#16](https://github.com/JoeProAI/porch-light/pull/16)
how to run: combined tree passes contract fixture validation, 10 provenance unit tests, strict TypeScript checking, Python compilation, metadata schema validation, git diff --check and gitleaks git . --redact --no-banner.
blocked: private Devin Review and HackOS workspace access require browser login. Devin Cloud CLI is signed out. PR #16 has a hidden review flag that is not cleared. Published reviews of the original batch target older commits. G2 and G3 have no working local service evidence.
last update: Wed Oct 21 2026 10:04 PM ET

### Verified PR batch

| Order | PR | Head audited | Result |
|---|---|---|---|
| 1 | [#14](https://github.com/JoeProAI/porch-light/pull/14) | 58b7d7a | Contract and mock fixtures validate; follow-up findings below |
| 2 | [#1](https://github.com/JoeProAI/porch-light/pull/1) | 7179fd6 | Data scaffold; 10 provenance tests pass |
| 3 | [#12](https://github.com/JoeProAI/porch-light/pull/12) | 7f8f9f8 | Metadata validates; sponsor evidence remains planned |
| 4 | [#13](https://github.com/JoeProAI/porch-light/pull/13) | 49bd63c | Docs skeleton; docs/contract/openapi.yaml is absent |
| 5 | [#15](https://github.com/JoeProAI/porch-light/pull/15) | cec5c61 | Historical review notes, not a current finding disposition |

All are open and GitHub reports MERGEABLE/CLEAN, but all have zero status checks and there are no Actions runs. This is not passing CI. Gitleaks found no leaks in the 34 fetched remote commits. Author and committer timestamps for those commits fall inside the supplied build window. Branch/path diffs stay inside their declared areas plus HANDOFF.md.

### Reproduced findings and direction

- Contract: the query_ids field used by trace_mock.json is absent from TraceStep in the schema and both language types. TraceStep(**query_step) raises TypeError. Add the field and a hydration test.
- Contract: RankedFacility accepts a score without rank. Python RankedFacility also permits construction without score or evidence. Require ranked output fields and test both representations.
- Contract validation: changing a term input to 999 without changing its weighted contribution still prints OK. A Fact.query_id that resolves nowhere also prints OK. Check products, term completeness, fact/query closure and consistency between the row score and evidence score.
- Contract: there is no typed public facility telephone field. Add one with a sourced value and an explicit unavailable state before building a call sheet. The CMS responses include telephone_number.
- Contract: add the missing bearer security scheme and optional emPOWER layer identity before API implementation. The path-owner rules still name the old Engines and Eval branch prefixes; repair them in the separate contract PR.
- Sources: all four supplied NWS ids returned real Coastal Flood Warning JSON with the expected zones and expiry times. NCZ205 returned MultiPolygon geometry. This audit checked availability only; raw captures and provenance sidecars are not committed yet.
- Sources: CMS nursing homes and dialysis endpoints return data. Nursing homes include SSA county codes and coordinates; the inspected dialysis schema has no coordinate fields. SVI and TIGER URLs respond, and the six emPOWER ZIP layer ids and official names are confirmed.
- Sources: the NBER directory and supplied 2024 CSV return HTTP 403 from this environment. The registered bare IEM nwstext URL returns HTTP 404; identify and verify a concrete archived Milton product. The county-plan URL redirects to an HTML landing page, not a PDF.
- Runtime: neither Windows nor WSL listens on the expected Zetaris or Meterless ports; docker ps has no Porch Light Zetaris/PostGIS containers. This does not verify G2 or G3. No model/provider claim was tested with paid inference.
- Scope: fixed ranking with Nemotron explanations is the right separation. Define normalization, missing-data behavior, source age and masking before real scoring. ZIP-level emPOWER burden is not a facility patient count.
- Scope: label Milton as a retrospective scenario and disclose each dataset's actual vintage. Current facilities and vulnerability releases do not prove what was true in October 2024. Keep the demo a decision-support prototype, not a clinically validated priority order.
- Scope: finish one warning, one county, two facility types, sourced phone numbers, deterministic ordering, evidence, print/CSV and one offline replay before optional memory or global work. No successful Cursor development or sponsor-credit claim is established by this audit.

### Issue drafts for Joe's approval, not created

| Draft | Area and branch | Acceptance criteria |
|---|---|---|
| Meterless model client and health probe | Engines, devin/engines-* | Normalize one /v1 suffix; required headers; 180 s timeout; fixture tests for models/auth/offline/malformed replies; Nemotron-only routing; no secret logging or live test spend |
| Batched explanations and TrustLedger | Engines, devin/engines-* | One batched reason request per run; every claim cites existing facts and query ids; reject unsupported claims; reasons cannot change the fixed order; fixture tests for refusals |
| Scout Intent export guard | Engines, devin/engines-* | Reproducible input/request hashes; refuse missing evidence; per-format artifact hashes; scripts remain drafts and are held when required safety checks are unavailable; negative tests |
| Minimal World Model and offline state | Engines, devin/engines-* | Persist snapshot, warning, check-ins and provider state; reload restores state; offline uses the same snapshot/order and explicit age; no source bypass |
| CI foundation | Eval and CI, devin/eval-* | PR checks for tests, fixtures, strict types, secret scan, provenance, commit window and branch/path ownership; deliberate invalid cases fail; no secrets needed |
| Golden-path eval harness | Eval and CI, devin/eval-* | Fixed sourced snapshot; deterministic rank/tie tests; measured join coverage and refusals; evidence closure; online/offline parity; labels and results have provenance |
| Fixture-backed API support for Cursor | API support, area path to settle before implementation | Contract-valid routes for alert/run/facilities/joins/trace/check-ins/export/health; typed empty/error states; mock banner; no live source or model calls; web remains untouched |

### Joe's G2 and G3 checklist

1. G2: obtain the sponsor-supported Zetaris image, edition, ports and license details. The existing placeholder docker command is not a verified install recipe. Do not use AWS or claim credits from this session.
2. G2: on the 5080, run Zetaris and dedicated PostGIS on an internal Docker network. Bind the UI to loopback and keep database credentials in a gitignored env file. Do not reuse or modify the unrelated running database.
3. G2: register PostGIS as a Zetaris JDBC datasource. Prove a read of a known PostGIS table through Zetaris and retain its real query id and audit record. SELECT 1 alone does not prove JDBC access or spatial pushdown.
4. G3: obtain the supported Nightshift/Meterless setup, keep its token in the local token file, and configure a local Nemotron model that fits the GPU. Confirm its exact model id and supported runner; do not assume an Ollama installation proves this.
5. G3: GET /v1/models through Meterless, then one Joe-approved local request with meterless-app: porch-light and meterless-scope: user. Prove the underlying model is Nemotron, then disconnect the upstream route and repeat locally. Never record the token.

### Access verification and delivery roles

Checked locally on Oct 21 at about 10 PM ET. No model requests or new cloud sessions were made.

- HackOS: the public event page and official rules are readable at https://hackathon.genai.works/event/open-agent-hackathon-2026. The controlled browser shows Sign in, and /sign-in shows the login form. Authenticated team dashboard, submission fields and sponsor-credit claims are not accessible yet.
- Official rule 5.1 confirms Zetaris, Meterless and Cursor development are mandatory. Rule 7.1 confirms Impact 30, Technical 20, Innovation 15, Demo 15, Product and UX 10, Sponsor tech 10. The delivery goal is a measured operator workflow, not the largest agent roster.
- Devin Cloud: devin auth status reports Not logged in; devin cloud drs whoami fails for the same reason. The available DeepWiki MCP exposes wiki tools only, not session management. Cloud capability is installed but usable account access is not verified. Joe needs devin auth login before a bounded job can start.
- Claude Code: executable installed; claude auth status reports loggedIn false. Sign in before assigning work. Installation does not establish subscription capacity.
- Hermes: installed. hermes auth status openai-codex reports logged in; Nous reports logged out. Codex CLI separately reports logged in using ChatGPT. No inference test, active Hermes provider or remaining quota is established.
- Grok Build: executable exists, but version/help probes returned no useful output and a failure exit. Remaining usage is unknown. Grok Bots are not on the critical path while Joe reports their quota recovery is two days away.
- Credentials: Joe supplied the location of a private local env file outside the repo. NVIDIA_API_KEY, MODAL_TOKEN_ID and MODAL_TOKEN_SECRET are present and nonempty, with no malformed entries. The file ACL grants access only to Joe's Windows account through inheritance. No values were printed, copied into the repo, uploaded or tested against a paid service. Zetaris and Meterless credentials are pending issuance. Devin Cloud uses separate developer authentication; do not add unrelated Grok or Cursor provider keys.
- Role proposal, not dispatched: Devin owns integration and critical data/API work; Cursor owns the authored web experience; Claude Code handles a bounded contract/security review or isolated engine task once signed in; Hermes handles sourced data research and adversarial evidence checks using an authenticated approved provider; Codex can take isolated eval/CI work when available. Give each worker a separate worktree, area and acceptance test.
- Winning demonstration: real warning to sourced call sheet, inspect a reason down to query/source/failed-join evidence, retain operator check-ins, export, disconnect the network and repeat from the same snapshot. Measure time and correctness against Joe's manual baseline and hand check; report only observed results.

## Status
2026-10-21 10:04 PM ET: Public rules and agent access checked. NVIDIA and Modal variable presence verified privately. Joe is installing Nightshift.
PRs: [#16](https://github.com/JoeProAI/porch-light/pull/16) records the audit; its hidden review flag is not cleared. Original five PRs remain open.
Gates: no gate closed. Capture real warnings, then prove Zetaris JDBC reads and local Nemotron through Meterless.
Blocked: HackOS/review browser login, Devin Cloud and Claude CLI login, Zetaris/Meterless provisioning, G2/G3 and contract findings.
Next: one measured Manatee workflow with inspectable evidence and offline replay; assign isolated worker lanes only after authentication. No cloud session created.
