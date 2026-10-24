# Nationwide Source Sweep

Measured 2026-10-24T01:56:56.000218+00:00. Run `20261023T200048Z-78a426ba`.
Source capture `47344192d80249d0c96a69fb2acd0f11a6b32009a8cd0607dca8872609488ac0`.
NWS capture `86e58bc99952e2b8830ea1a5b9ca4188e184e038e4dff556d2a7966d7377f502`, captured 2026-10-23T19:58:17+00:00.

## Results

| Measurement | Result |
|---|---:|
| Counties attempted | 3235 / 3235 |
| Completed audited chains | 3234 |
| Distinct closed county-statement audit IDs | 22638 |
| Audited-chain pass rate | 99.97% |
| Counties returning CMS source records | 2881 |
| Counties returning rankable facilities | 2490 |
| Ranked facilities / source refusals | 15440 / 6460 |
| CMS records without a canonical county join | 2245 |
| Distinct CMS records accounted for, including refusals and county-join gaps | 22177 / 22180 |
| Frozen active-alert counties completed | 639 / 639 |
| Additional seeded random counties | 500 |
| Source time p50, seconds | 18.888 |
| Source time p95, seconds | 63.258 |
| County runs with measured times | 3235 |
| Source phase observed wall time, seconds | 21317.746 |
| Alerts without a supported county mapping | 168 |

## County Outcomes

| Outcome | Counties |
|---|---:|
| complete_no_matching_source_rows | 353 |
| complete_no_rankable_rows | 391 |
| complete_with_ranked_rows | 2490 |
| runtime_error | 1 |

## Source Gaps

| Refusal or gap, most frequent first | Records |
|---|---:|
| census_address_match_not_exact | 3579 |
| census_address_not_matched | 1968 |
| missing_valid_cms_rating | 408 |
| missing_zip_context | 383 |
| ambiguous_or_masked_source_count_11 | 70 |
| source_point_not_covered_by_current_county_geometry | 25 |
| missing_or_suppressed_exact_tract_svi | 24 |
| cms_source_marked_closed | 3 |

## Measured Join Counts

SQL candidate/match counts are totaled separately by statement. They aren't unique facility counts.

| Source-chain step | Candidates | Matched | Unmatched |
|---|---:|---:|---:|
| CMS contacts to exact Census addresses and official county coverage | 21900 | 16326 | 5574 |
| Exact Census tract GEOID to national CDC SVI | 21900 | 19897 | 2003 |
| CMS ZIP and Census county to HHS emPOWER, with fanout counted | 21900 | 19362 | 2538 |
| Join only unique, unmasked county ZIP ratio reference rows | 21900 | 19257 | 2643 |

## Runtime Failures

- RuntimeError: 1 county runs.

## Limits

- This is the source phase only. Nemotron results and their separate attempt cap are reported later.
- The alert scope is frozen at its captured timestamp, not claimed current when the sweep finishes.
- No matching CMS rows doesn't prove a county has no care facilities.
- Ranked rows don't verify operating conditions, emergency contacts or clinical priority.
- Percentiles use linear interpolation over measured per-county source wall times, including failures.
- Canonical county-join gaps can overlap with county refusals assigned from an exact CMS county label.

Raw sources, county checkpoints, exact audit IDs and model receipts remain in the private filestore.

## Retained Failure and Separate Recovery

The original Robertson County, Texas run, FIPS `48395`, failed to open its Zetaris JDBC transport after 26.992 seconds.
That failure remains unchanged and is included in the first-pass results above.
A separate audited retry completed in 18.637 seconds with three source rows, two ranked facilities and one `census_address_match_not_exact` refusal.
Its seven distinct closed statement receipts remain in the private evidence capture.

After that explicitly separate recovery, all 3,235 counties have completed an audited chain at least once.
There are 2,491 counties with ranked rows and 2,882 with CMS rows after recovery.
All 22,180 distinct CMS source records are accounted for across county outputs, refusals and canonical-county join gaps.
The retry adds two ranked rows and one refusal, giving 15,442 ranked rows and 6,461 refusals.
The first-pass failure and original p50/p95 aren't erased or recomputed to hide it.

## Completion-Time Alert Check

A fresh audited check selected at 9:46:22 PM ET used the NWS capture from 9:43:08 PM ET:
`8c479a404396753ebc883884d36aabc86bd548b5e532aedfc79de9000a82446d`.
The immutable national source capture was unchanged.
All 535 mapped active-alert counties in that check have successful first-pass source chains in this full sweep.
There were 196 mapped alerts and 187 alerts without supported source-zone mappings; none received guessed counties.
The catalog, weather and mapping reads have three separate closed audit receipts retained privately.
This check has its own timestamp and doesn't relabel the original frozen 639-county alert scope as current.

The later model phase is running across 1,544 batches covering the original sweep's 15,440 ranked rows.
The two ranked Robertson retry rows aren't silently added to that original model cohort.
