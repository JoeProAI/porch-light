# Porch Light demo script

Shoot the live desk. Do not start a new model call, a new sweep, or a deploy for this recording. `demo_video` in `metadata.json` stays empty until the file exists.

Target: Monday, October 26, 2026, 6:00 PM ET. Keep the Milton coda under about 20 seconds.

Allowed claims: every catalog county is source-audited; drafts are in progress on free Nemotron through Meterless; you can open any catalog county on the hosted desk today. The hosted pack has 2,490 counties with ranked rows. The source report's 2,491 includes the Robertson retry, which the host does not serve. Never say offline DGX, H-MEM, World Model, Markovian, drafts for every county, or that Manatee is the product.

## Open

Go to `https://porchlight.earth`. The button is **Pick any US county**. The page is `noindex`. The hero picture is key art, not a live warning.

Say: "Porch Light is a call sheet for dialysis centers and nursing homes. Any county in the Census catalog opens here. The order comes from a fixed formula. Nemotron writes a draft when this snapshot has one. I still verify the facility. The app does not place the call."

## Anchorage, the failure

Open `https://porchlight.earth/nationwide?county=02020`.

You should see Anchorage, Alaska: 6 CMS rows, 4 ranked, 2 refused for a non-exact Census geocode. Rank 1 is Polaris Extended Care, nursing home, CCN `025036`, formula `national-source-screen-v1`. All 4 drafts in this published snapshot failed. Rank 1 keeps the reason `Extra data: line 1 column 2 (char 1)`. The source sentence is still on the row. Do not hide the failure and do not request a new draft.

Say: "This county was source-audited. Four facilities ranked. Two did not, and the reason is on the sheet. The model drafts in this snapshot failed, and they stay failed. The rank did not change."

Point at a Zetaris query id on the row (`9704` is the first of the seven).

## Doña Ana, a passed draft

Open `https://porchlight.earth/nationwide?county=35013`.

11 CMS rows, 7 ranked, 4 refused, same geocode reason. Rank 1 is USRC Las Cruces, dialysis, CCN `322559`. All 7 drafts passed on Lightning through `meterless/deep`. The text cites CMS stars, tract SVI, and ZIP emPOWER counts, and it says those ZIP figures are aggregates.

Say: "Same engine, different county. Seven rows ranked. The draft passed grounding against the source clauses. Grounding is not a clinical validation, and the phone is a directory number."

## Harris, scale

Open `https://porchlight.earth/nationwide?county=48201` only if you have time.

236 CMS rows, 140 ranked, 96 refused (55 non-exact geocodes, 26 unmatched addresses, 10 missing ratings, 5 missing ZIP contexts). 140 drafts in this snapshot passed.

Say: "Harris is the same published audit at county scale. The refusals stay on the sheet."

## Contact and export

On whichever sheet is on screen, show the contact control. It starts at **Not contacted**. Do not save **Reached**.

Say: "If I make the call, I record it here. It stays on this device. I can export or print. Nothing is dialed for me."

## Coverage line

Say: "The catalog is 3,235 counties, all source-audited through Zetaris at least once. This site shows 2,490 of them with ranked rows. 480 drafts in the pack failed. Robertson County, Texas has no published snapshot, and the page does not borrow another county."

If you have five seconds, you can show that `48395` returns no substitute sheet. Skip it if the error state is slow to reach.

## Milton coda, optional, under 20 seconds

Open `https://porchlight.earth/operate` with no county query.

Say: "This is the Hurricane Milton retrospective for Manatee, 18 ranked rows, a different formula. It is not the national product. The national Manatee row is a separate sheet."

Do not walk the evidence drawer. Do not present rank 1 as a passed draft. That row's draft failed. The first passed draft on this file is rank 4.

## Close

Say: "Zetaris audited the joins. Meterless routed Nemotron on the free route. The formula ranked. We are not claiming an offline DGX run, H-MEM, a World Model, finished drafts for every county, or a clinical result."

## Checks before you roll

1. The three county URLs match the table above. If a count on screen differs, stop and say what is on screen.
2. Contact status stays **Not contacted**.
3. Do not press **Generate live Nemotron call script** on the hosted site. Model POST is local only.
4. Do not describe the hosted Anchorage failures as the later local re-run that accepted 4 of 4. That re-run is in `docs/smoke-national-results.md`. The URL shows the failures.
5. Keep tokens, the Nightshift token file, and JDBC passwords out of frame.
6. `demo_video` and `slide_deck` in `metadata.json` stay empty until you have the files.
