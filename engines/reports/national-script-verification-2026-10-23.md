# National Call-Script Verification

Measured October 23, 2026 at 6:44 PM ET against the actual local application.
This is a bounded live verification in two counties, not the nationwide model-sweep result.

## Scope

- Baldwin County, Alabama and Providence County, Rhode Island.
- Four fresh audited app runs, one per county on desktop and mobile.
- Top three ranked rows per run: 12 script outcomes covering six distinct source facilities.
- Source facts came from the national Zetaris chain. No Manatee fallback or client-supplied facts.
- Meterless plus NVIDIA Nemotron only. All 14 script requests have matching free NVIDIA route/cost receipts.

## Results

| Measurement | Result |
|---|---:|
| Scripts attempted | 12 |
| Accepted grounded scripts | 10 |
| First-pass accepted scripts | 10 |
| Unresolved scripts, retained as failed | 2 |
| Script acceptance rate | 83.33% |
| Provider request attempts, including retries | 14 |
| Sole retry requests | 2 |
| Retry recoveries | 0 |
| Successful request attempts | 10 / 14 |
| Scripts omitted by the request cap in this check | 0 |
| Actual script-request cost, with all receipts present | $0 |

Both unresolved scripts returned invalid JSON on the initial request and their sole retry.
All four failed attempts retain the exact validation reason:
`Extra data: line 1 column 2 (char 1)`.
No parser repair, third attempt or replacement prose was used.

## Verified Behavior

- Successful scripts cite source facts through closed Zetaris query references and identify their actual Nemotron response/model.
- Failed scripts show their failure reasons, original event IDs, response IDs and linked sole retry.
- Cached repeated requests return the same retained attempt IDs without another model call.
- Source/model polling doesn't reset the operator's selected call.
- Grounding checks exact source-clause identity and approved verification questions. It isn't clinical validation.
- No phone call, message, patient-data request or inferred facility condition is produced.
- Strict TypeScript and production build pass. Forty desktop/mobile browser checks pass, including actual top-row requests, retained failures, contact/export behavior and offline/error handling.

## Separate Accounting

The shared approval ledger had 61 completed reservations, no unresolved reservations and a 2,000-attempt limit at this observation.
That ledger includes other app explanation and verification requests; it isn't the 14-request script subset.
Paid fallback remains disabled.

The full 3,235-county source/model sweep is still running and must be reported separately.
Exact run artifacts, source snapshots, failed content, route/cost receipts and checksum sidecars remain in the private national filestore.
