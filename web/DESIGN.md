# Porch Light — Storm Glass Desk

Art direction for the home page, the Manatee call sheet (`/operate`), and Storm Watch (`/watch`). Written before the visual pass. This is the brief the interface has to obey.

## Purpose

An emergency operator has a storm warning and a short list of care facilities to call. The interface has to show which facility is next, why that rank exists, what is still unknown, and what the weather actually published. The people using it are operators under time pressure, not a marketing audience. Every number, polygon, phone, and radar frame has to come from a source the page can name. If a source fails, the page says so.

## Constraints

- Next.js 16, React 19, strict TypeScript. Styling stays in the existing token CSS. Tailwind is present and must not become the look.
- No new paid map, weather, model, or font service. No API keys.
- MapLibre GL JS for Storm Watch. Basemap from OpenFreeMap (no key). Radar tiles from the Iowa Environmental Mesonet NEXRAD composite, including the `m05m` through `m50m` offsets.
- Alerts come only from the existing audited weather API. Facility pins come only from the ranked Manatee snapshot. Missing geometry is listed as “no shape from NWS” and is never drawn from a guess.
- Times the operator reads are Eastern Time. Evidence detail keeps UTC.
- Long floats the operator scans are shown to 2 decimals. Evidence detail keeps the source figure.
- The regression suite locks two paint decisions: `--color-bg` is `#081c26`, `--color-accent` is `#efb45e`, the display face computes as Libre Baskerville, and the body face computes as Alegreya Sans. Those are the desk’s printed forms. This generation does not repaint them.
- Stay off `engines/`, data ingest, Zetaris adapters, Meterless calls, and the `types/` contract.
- WebGL is required for the chart and is initialized only on `/watch`. Reduced motion parks the radar loop. The map itself still opens, because it is the task, not decoration.
- Touch targets on the small breakpoint are at least 44 pixels. Three breakpoints: 390, 768, 1440.

## Direction and tone

**Storm Glass Desk.** Generation after the night ledger, not a second copy of it.

The room is a county desk at night. The paper (type, ranks, phones, evidence) sits in a measured column. The glass is the map: a dark vector chart that runs to the edge of the viewport and breaks the column. Brass (`#efb45e`) is the porch lamp. It marks the selected call, the selected frame, and nothing else decorative. Copy is short, sourced, and unwilling. No clinical validation, no exclusivity, no guaranteed outcome, no other country.

The previous generation’s carbon-paper black book is the thing this pass leaves behind. Corners stay sharp on purpose. Softness would turn the desk into a product card.

## Type pairing

- **Display:** Libre Baskerville. Used for the wordmark, the rank, the alert headline, and the bezel’s center numeral. Tight tracking on the large sizes, normal tracking on the wordmark’s brass period.
- **Body:** Alegreya Sans. Used for instructions, reasons, and the alert list. 17px base, 1.45 line height.
- **Mono:** Consolas, then Liberation Mono. Used for phones, clocks, query ids, scores, and coordinates. Clocks and scores are figures, not prose.
- Fallbacks stay in the Baskerville / Optima family so a missing file does not fall through to Inter, Roboto, or Arial.

Typographic contrast is the hierarchy: a large Baskerville rank, a small mono clock, a quiet sans instruction. No icon font. No emoji.

## Palette logic

One night hue, one lamp, three functional accents.

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#081c26` | Night desk, locked |
| `--color-surface` | `#112d3a` | Raised paper on the desk |
| `--color-text` | `#f3eee3` | Ivory ink |
| `--color-muted` | `#abbcc2` | Secondary ink, still body-sized |
| `--color-accent` | `#efb45e` | Porch lamp, locked. Selection, rank, the bezel’s active tick |
| `--color-focus` | `#92c6d1` | Focus ring only |
| `--color-success` | `#b7cdb5` | A recorded contact outcome |
| `--color-warning` | `#efb45e` | Same lamp, used when a capture is stale |
| `--color-danger` | `#e07a5f` | Failed source, extreme alert |
| `--color-severity-extreme` | `#e07a5f` | Alert fill and legend |
| `--color-severity-severe` | `#efb45e` | Alert fill and legend |
| `--color-severity-moderate` | `#e6c98a` | Alert fill and legend |
| `--color-severity-minor` | `#92c6d1` | Alert fill and legend |
| `--color-severity-unknown` | `#abbcc2` | Alert fill and legend |

Severity colors are read from these tokens at map setup so the legend and the polygons cannot drift. Text sits on `--color-bg` or `--color-surface`, not on the severity fills. The light first-call card on the home page stays paper-colored: it is the torn sheet on top of the night photo, not a second theme.

No purple. No white SaaS gradient. No gradient used as a brand.

## Signature element

**The Watch Bezel.** One instrument, three jobs.

It is a ring of real ticks with a center control. On a narrow viewport the same ticks become a horizontal row of 44-pixel targets so the hit size survives. Arrow keys move along the ticks. The active tick is the lamp.

- **Storm Watch.** Each tick is one Iowa Environmental Mesonet radar layer, from 50 minutes before the latest composite through the latest composite. Eleven ticks fit a ring at 768 and wider, with a 44-pixel hit and a gap so the targets do not cover each other. Under 768 the same ticks are a row. The center plays or pauses the loop. The clock beside it shows Eastern Time derived only when the IEM scan time was actually read: scan time minus that layer’s offset, labeled as a derivation. If the clock cannot be read, the page shows the layer offset and says the composite time is unavailable. It does not invent a timestamp.
- **Call sheet and home.** Eighteen ranked rows do not fit a ring without overlapping hits, so the same tick grammar stays a row at every width. On the call sheet, choosing a tick selects that row. The center numeral returns focus to the selected ledger row. On the home page each tick is a link to `/operate?rank=N` for a real ranked row, and the center opens rank 01. The preview does not invent a nineteenth facility.

The bezel is the only ornament, and it is a control. It is not a spinner, a chatbot, or a decorative orbit.

## Motion grammar

One entrance: the existing ledger shutter (opacity and translate, 700ms, ease-out) on the first column of a page. Nothing else introduces itself.

The bezel’s indicator moves to the active tick with a short transform. The radar loop advances one layer at a time only after the operator presses play. Reduced motion removes the shutter, removes the indicator transition, and does not start the loop. Play remains available as an explicit choice; the ticks always step one frame.

Scroll reveals are not used. The map does not animate a camera tour on load. Fit and locate ease only when motion is allowed; otherwise they jump.

## Material and texture

- **Paper grain** sits over the desk as a fixed, pointer-transparent SVG noise at low opacity. It is the same grain on every page. It does not sit on top of dialogs (those are in the browser top layer). Print removes it.
- **Glass** is the MapLibre chart: dark OpenFreeMap vector tiles, counties, cities, and roads, with the radar composite translucent enough that streets stay readable when the operator zooms.
- **Sharp edges.** Radius tokens are 0. Shadows are short and black, used on the paper card and the evidence drawer, not sprayed across the page.
- **Depth** is only desk, sheet, and drawer. The evidence drawer is the sheet pulled forward. The map is not a card inside a card.

## Layout

- **Home.** The archived Milton photograph is the ground. The mission sentence and the paper preview break that ground. The bezel lives on the preview. The workflow stays a numbered chain, not a three-up icon row.
- **Call sheet.** Ledger, warning atlas, contact desk, in that order, at desktop widths. The phone stays in the first viewport on a 390-wide screen. The bezel sits in the atlas strip, not over the phone and not over the facility dots.
- **Storm Watch.** The chart occupies the first viewport at 390, 768, and 1440. The header is one line. On a wide screen the alert panel is a column beside the chart. On a narrow screen the chart comes first and the panel follows. National weather copy never claims a national ranking.

Grid logic is a 12-unit desk. The break is the chart bleeding to the viewport edge while the type keeps its margin.

## Interaction states

Every control uses the shared button rules: default, hover, active, focus-visible (2px `--color-focus`, offset 4px), disabled, and loading (`aria-busy`). Panels add empty and error:

| Panel | Loading | Empty | Error and recovery |
|---|---|---|---|
| Weather alerts | “Checking the national source capture.” | No alerts in the capture, or no search match, with a clear action | Audited feed unavailable. Retry reads the feed again. No sample warning. |
| Alert shape | — | “No shape from NWS” for any alert whose payload has no polygon | Shapes are never inferred. |
| Alert detail | — | “No alert selected.” | Expired alerts stay visible and are marked expired. |
| Facilities inside an alert | — | “Not ranked yet,” with the reason | National weather is not a national ranking. Only ranked Manatee coordinates are tested against the published shape. |
| Base map | “Opening the night chart.” | — | Style failed. Retry rebuilds the map. No substitute imagery. |
| Radar loop | “Reading the IEM composite clock.” | — | Tiles failed. Retry reloads the layer. No drawn echo. |
| Locate | “Asking this browser for a location.” | — | Permission denied or unavailable, with a retry. No guessed point. |
| Facility pins | — | Snapshot withheld, or no coordinates | The call sheet’s own failure page still covers a bad snapshot on `/operate`. |
| Contact desk | “Loading local contact records…” | No ranked rows | Storage and clipboard failures stay explicit. |
| Evidence drawer | — | No model draft when the row has none | UTC clocks and source figures stay in the drawer. |

Offline is announced. A stale capture is announced, with the official NWS link and the local worker command. Silent failures are not used.

## Copy

Operational, specific, and a little dry. Name the source. Name the limit. Do not say “seamless,” “unlock,” “elevate,” or “trusted AI.” Do not claim the IEM tiles are the audited NOAA file. Do not claim the Manatee sheet is the country.

## Extension notes

- New colors go in `:root` in `proof-tokens.css` first. Components read variables. Severity on the map is read from those variables at runtime.
- New controls use `<button>` or `<a>` and the shared button rules. Do not invent a second hover color.
- A new page that needs the signature adds `WatchBezel` with real ticks. Do not draw a fake ring.
- A new time shown to an operator uses `formatDateEt`. A time inside evidence uses `formatDate` (UTC). A scanned float uses two decimals; the evidence cell keeps the source figure.
- Do not point the chart at a keyed tile host. If OpenFreeMap or IEM is replaced, the replacement has to be keyless and attributed in `.map-attribution`.
- Failure copy names the source that failed and the retry. It does not fill the hole.
