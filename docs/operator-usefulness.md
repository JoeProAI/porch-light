# Operator usefulness walkthrough

Run: Fri Oct 23 2026, 11:05 PM to 11:25 PM ET, on Joe's laptop. Branch `claude/operator-usefulness` (worktree `pl-operator`, web on 127.0.0.1:3112), measured against the running `devin/web-manatee` app on :3101 and the `claude/national-live` app on :3111 before any change.
Live stack: local Zetaris (JDBC), `porchlight_postgis` national projections, Meterless/Nightshift on 127.0.0.1:8088 routing to the free NVIDIA Nemotron route. Paid OpenRouter fallback disabled. The national model sweep (PID 52756) kept running untouched the whole time.

The seat is a county emergency-management operator holding a call-first sheet. Every number below comes from browser timing APIs, retained job artifacts under `%USERPROFILE%/.porchlight/national/jobs/<run>/`, or Playwright output. Nothing was typed from memory. No facility, score, query ID or model reply was invented.

Screenshots: `D:\Projects\AI_Projects\_claude\operator-usefulness\01-07*.png` (outside the repo).

## 1. Timed walkthrough

| Step | Manatee FL (golden path, :3101 `/operate`) | Denver CO (saved national run, :3111 then :3112) | Kalawao HI (zero-row county) | Gale Warning alert (source gap) | Anchorage AK (fresh run, :3112) |
|---|---|---|---|---|---|
| Warning context shown | PASS. "Retrospective · Hurricane Milton / 2024", "Not a live warning." | PASS. "County source discovery / no warning asserted" | PASS. Same honest label | PASS. "Source gap, no ranking invented." with the alert's own text | PASS |
| Ranked call-first list visible | PASS. 18 rows, load event 304 ms | FAIL before fix: 13.3 s, gated on a 16 s catalog read. PASS after fix: run checkpoint answered in 43 ms, sheet rendered before the catalog | PASS. "No ranked facilities." 0.3 s with warm catalog | PASS. Explicit gap, no rows | PASS. 4 rows visible during the drafts phase, about 17 s after the URL opened |
| Phone on every ranked row | PASS. 0 of 18 missing | PASS. 0 of 28 missing | n/a | n/a | PASS. 0 of 4 missing |
| Open a facility, read why | PASS. Evidence drawer: 5 weighted terms, 7 Zetaris query IDs, source links | PASS. 4 terms, query IDs 24729 to 24735, grounded Nemotron draft and trace ID | n/a | n/a | PASS |
| Model evidence honest | PASS with friction. Rank 1 shows "No approved draft / failure retained" and a raw JSON attempt record | PASS. Grounding passed, model `nvidia/nemotron-3.5-lightning-30b-a3b` | n/a | n/a | PASS. 4 of 4 drafts accepted in 1 batched Meterless request, 33.3 s |
| Record contact status, move to next | PASS. "Reached recorded ... Next uncontacted: rank 2" | PASS | n/a | n/a | not exercised |
| Selection survives refresh | PASS. 1 of 18 recorded, rank 2 selected after reload | PASS. Key is scoped by run and county | n/a | n/a | n/a |
| Live call script | PASS. Grounding passed in 16.2 s; cached re-read 0.2 s, no second provider request | PASS (already retained from an earlier session, 0.5 s) | n/a | n/a | not exercised |
| Export / print | PASS. CSV: 19 lines, contact status and timestamp per row | PASS (same component) | PASS. Both buttons disabled with 0 rows | n/a | PASS (same component) |
| Console clean | PASS on :3101 | FAIL before fix: React error 418 on every page of the national branch. PASS after fix | same | same | PASS |

Fresh-run phase timing for Anchorage, from retained artifacts: URL opened about 03:16:19 UTC, source chain `executed_at` 03:16:35.4 (the page waits for the catalog before starting a county run), model execution 03:16:35.2 to 03:17:08.5, `status.json` written 03:17:08.5. Total about 50 s, of which the catalog read is about 16 s and the drafts 33 s.

## 2. What would stop a real operator in the first five minutes

Fixed in this branch:

1. **Saved run waited on the catalog.** Reopening `/nationwide?run=<id>&county=<fips>` took 10 to 16 s because the page only polled the run after the 894 KB catalog read finished. The run checkpoint is its own request. The page now polls it immediately. Playwright test added: `a saved run reopens from its own checkpoint before the catalog read finishes` (passed in 9.8 s against :3112 with the catalog held for 20 s).
2. **Hydration error on every page.** `LogoMark` rendered a video on the client and an image on the server because the motion preference isn't known during server render. React error 418 appeared in the console on `/operate`, `/nationwide` and `/watch` whenever the operator's browser did not request reduced motion. The existing Playwright tests run with `reducedMotion: "reduce"`, so they never saw it. The logo now stays on the still frame until hydration. Console is clean on :3112.
3. **Alert picker hid the warnings.** 358 captured alerts were listed in feed order, marine statements first, with no sign of which ones map to a county. An alert with zero mapped counties could be submitted and would spend a run to produce a source gap. Mapped alerts and warnings now sort first, each option names its mapped county count, and an unmapped alert disables the run button with a one-sentence reason. Playwright test added: `the alert list leads with mapped warnings and an unmapped alert cannot start a run`.

Filed, not fixed here:

4. **Cold catalog read is about 16 s** on every server start and after the 30 s web cache lapses. `engines.national_jobs --catalog` calls `county_catalog()` twice (once directly, once inside `active_scope()`), each a full 3,235-row Zetaris read, then the weather scope. Engines are Devin's lane. Repro: `python -m engines.national_jobs --catalog` in the repo root, 16.3 s on this machine.
5. **Storm Watch has no handoff into a call sheet.** `/watch` lists 18 alert shapes but no per-alert link to `/nationwide?alert=<id>`. The operator must find the same alert among 358 options by hand. Cursor owns Storm Watch, so this is a request, not a change.
6. **Call-script lock can wedge a facility.** `engines/national_jobs.py::call_script` creates `<hash>.lock` with `open("x")` and removes it in `finally`. If the Python process is killed mid-request the lock stays and every later request for that facility fails with a generic failure message. 0 stale locks exist right now under `~/.porchlight/national/call-scripts`. Repro: create an empty `.lock` beside a retained script and request that facility.
7. **Retained call script is not shown when returning to a row.** `CallScript` state resets on row change. Clicking again returns the cached result in 0.2 s with no provider request, but the operator has no cue that one exists.
8. **Manatee rank 1 model evidence is a raw JSON record.** Honest, but an operator reads a 60-line attempt object to learn "the batch draft failed grounding." A plain-language summary line would help.
9. **Reopening a saved alert run leaves the form on "County discovery"** with no alert selected. The gap result itself is correct.
10. **`operator.spec.ts` "no browser errors" fails off :3101.** On both :3111 (unmodified) and :3112 it reports `requestfailed` for `Link` prefetches (`/nationwide?_rsc=`, `/watch?_rsc=`) about one second in. The same prefetches return 200 in a hand-driven browser, so this looks like prefetches cancelled by the test's own clicks rather than a server fault. The test also pins :3101 as the only allowed origin, so it cannot pass on any other port. Not caused by this branch; not fixed here.
11. **Unreproduced.** On the first load of :3111 `/nationwide?run=...` the page navigated away to `/operate?rank=2` on its own. Six later loads did not repeat it.

## 3. What is not claimed

- No clinical validation. The score is a fixed four-term screen with prototype weights.
- No verified facility operating conditions, power status, census or staffing. The sheet says so on every national run.
- Phone numbers are CMS directory numbers. Emergency-contact reachability is unknown. No call is placed by the app.
- Nemotron drafts select and order source clauses and approved questions. They add no facts and do not affect ranking.
- National weather coverage is not national facility ranking. Per HANDOFF, the model sweep had 1,290 accepted drafts out of a 15,440-row cohort when this walkthrough ran, with paid fallback off. A county without a completed run has no drafts until one is requested.
- A zero-row county means no matching rows in these sources, not that the county has no care facilities.
- Mobile layout was not exercised in this pass.
