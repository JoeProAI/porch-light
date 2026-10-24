# Submission documentation verification

This file records checks for the submission materials. Product verification results remain in the linked engine reports and are not new results from this documentation pass.

## Evidence review

Read the full national source and script reports, including the separate Robertson recovery and the later Denver verification. Read the private October 23 model reconciliation and the updated local handoff. The final model `report.json` was absent at the reconciled sweep path during preparation.

The reconcile file predates the approved resume. This package uses its counts only as the baseline at resume and describes the resume as running, consistent with the current task and handoff.

## Documentation checks

All relative file links in the four submission Markdown files resolve. No en dash or em dash punctuation is present. Manual review kept source coverage, scoped script outcomes and the model baseline separate, with no clinical validation, exclusivity or outcome guarantee.

`git diff --cached --check` passed. Staged scope was verified as exactly four Markdown files under `submission/`. The repository-wide `git diff --check` reports whitespace in the pre-existing, unstaged `HANDOFF.md` edits. That file is outside this documentation change and is left untouched.

## Project checks

| Command | Result |
|---|---|
| `python -m unittest engines.test_grounded_drafts engines.test_sweep_report -v` | 9 tests passed on rerun. Initial sandbox attempt had 6 passes and 3 Windows temporary-directory permission errors. The rerun outside the sandbox passed all 9 without application changes. |
| `npm run typecheck` from `web/` | Passed in the existing worktree. |
| `npm test -- operator.spec.ts --grep "actual bytes, deterministic terms, projection and local record validation"` | 2 tests passed in an isolated copy using the existing dependencies. Initial sandbox attempt failed with `spawn EPERM`; rerun outside the sandbox passed. This selected test does not launch a browser or request a model, even though it runs under both configured project names. |
| `npm run build -- --webpack` | Failed in a fresh isolated copy on the project drive after successful compilation. Generated Next.js route types reject the existing named `RootLayout` export in `web/src/app/layout.tsx` and named `Page` exports in the home, nationwide, operate and watch page modules. No code repair was attempted. |
| Project lint | No lint script is configured in `web/package.json`. No linter was installed or claimed to pass. |

The first isolated build attempt hit sandbox `spawn EPERM`. A rerun outside the sandbox in the C: temporary copy failed cross-drive dependency-junction resolution. The final D: isolated copy avoided that path failure and reached the route-type errors described above. No build overwrote the running application's `.next` directory.

The earlier script report's successful build is historical evidence; it does not override this fresh build failure. The existing worktree typecheck passing is also distinct from a clean build's generated route checks.

No live provider tests, source sweep, model requests, application restart or deployment were performed. No screenshots or fresh visual verification were produced. The video and rendered deck remain unfinished. This package contains documentation only; no PR was opened or merged.

Both isolated verification copies and the failed tests' temporary directories were removed after the checks. Shared dependencies and the running application were left in place.

## Commit status

The four submission Markdown files are staged on `codex/submission-evidence-2026-10-23`. Automatic approval review rejected the requested local documentation commit, citing the house rule requiring a fresh explicit go before committing. No commit, push or merge was performed in this pass.
