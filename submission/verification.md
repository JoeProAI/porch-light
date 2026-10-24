# Submission documentation verification

This file records checks for the October 24, 2026 morning refresh of the submission materials. Product results stay in the linked reports. This pass did not create new county runs, model drafts, receipts, or spend.

## What changed, and what was left

`submission/README.md`, `submission/written-submission.md`, `submission/demo-script.md`, and this file replace the county and model figures from pull request #27.

Withdrawn from the narrative, and not current totals:

- Withdrawn claim: "All 3,235 counties completed an audited chain at least once."
- Withdrawn claim: the reconciliation baseline of 1,290 accepted drafts, 340 exhausted failures, and 1,380 pause batches. Those counts are not a live total and are not a resume baseline.

Replacement figures, cited as an operator snapshot rather than a new measurement in this checkout:

- Source sweep planner `remaining` 0. About 3,153 of 3,235 unique FIPS with runs. 2,491 with facilities. Connecticut and U.S. territories skipped.
- Model sweep `20261023T200048Z-78a426ba`, phase `grounded_drafts`, about 649 of 1,545 `completed_batches` as of about 6:38 AM ET. `known_actual_usd` 0. `paid_fallback_enabled` false.

`SPONSOR-SETUP.md` and `metadata.json` were read against pull requests #33 and #35. They already describe Scout Intent on the call-script path, Cursor evidence limited to pull requests #22 and #24, and no token or spend total. They do not repeat the withdrawn 3,235-complete or 1,290 / 340 / 1,380 figures. They were left unchanged.

The engines commits (#40, #30, #36, #39) were confirmed on `origin/devin/engines-manatee` at `6f54146111ab0db34bd99d7997aad3297d21033d`. That commit is not an ancestor of this web branch. The offline report file is not in this checkout. OpenRouter backup code is not in this checkout. Web ancestry for #24, #38, #34, #31, #37, #33, and #35 was confirmed on `67f8222b777777c8c266abe557be97e2e0c3178d`.

The one call-script receipt cited, `rcpt_req_qsa07grv` for CCN `102853`, is copied from `engines/reports/scout-intent-live-2026-10-23.json`. No receipt id was created for this refresh.

## Documentation checks

Run from the repository root after the four submission files are the only intended change:

| Check | What it must show |
|---|---|
| Relative links in `submission/*.md` | Each `](...)` target that is not an `http` URL exists on disk. |
| Dash punctuation | No U+2013 or U+2014 in the four submission files. |
| Withdrawn claims | The four files do not instruct a reader to treat all 3,235 counties as completed runs, and they do not present 1,290 / 1,380 as current model totals. |
| Required snapshot | The files contain source sweep planner remaining 0, about 3,153 of 3,235, 2,491 with facilities, Connecticut and territories skipped, sweep `20261023T200048Z-78a426ba`, `grounded_drafts`, about 649 of 1,545, `known_actual_usd` 0, `paid_fallback_enabled` false, `blocked_preflight`, and receipt `rcpt_req_qsa07grv`. |
| Boundaries | The files still say grounding is not clinical validation, and they make no exclusivity claim and no prize claim. |
| `git diff --check` | No whitespace errors in the submission diff. |

Recorded on this refresh, from the repository root, before commit. A Python check resolved every non-HTTP relative link in `submission/*.md`, rejected U+2013 and U+2014, required the morning snapshot phrases, and allowed the old 3,235-complete sentence and the 1,290 / 1,380 counts only on lines that also say withdrawn or stale. `git diff --check -- submission/` then passed.

| Check | Result |
|---|---|
| Relative links | Passed. Every relative target exists. |
| Dash punctuation | Passed. No en dash or em dash in the four files. |
| Withdrawn claims | Passed. The old full-catalog sentence and the 1,290 / 340 / 1,380 counts appear only as withdrawn or stale. |
| Required snapshot | Passed. Morning county gap, model fraction, `blocked_preflight`, and receipt `rcpt_req_qsa07grv` are present. |
| Boundaries | Passed. The files say grounding is not clinical validation, and they claim no exclusivity and no prize. |
| `git diff --check` | Passed for `submission/`. |

## What this pass did not do

No live provider test, source sweep, model request, application restart, deployment, or spend. No radar, map, or look CSS edit. No county was added to a fixture to close the 3,235 gap. No screenshot or browser pass of the web app. The #27 packaging note recorded an isolated production build that compiled and then failed generated Next.js route-type checks on existing `Page` and `RootLayout` exports. That build was not re-run here, so the failure is not cleared and is not newly confirmed.

The earlier script report's build result and the #27 unit-test note stay historical. They are not results of this refresh.
