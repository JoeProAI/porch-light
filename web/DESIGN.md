# Porch Light — One light on

Art direction for `/`, `/operate`, and `/watch`. Joe rejected the teal night (`#081c26`, sage greys, the NASA hero, the radar dial over the chart). This file replaces that look.

## Purpose

An operator has a storm and a short list of care facilities to call. The page shows which facility is next, why that rank exists, what is unknown, and what the weather source actually published. Every phone, polygon, and radar frame comes from a named source. If a source fails, the page says so and draws nothing in its place.

## Direction

Night is a storm blue-black, `#05070b` to `#0b0f16`, with cold slate text. The only warm colour is porch-light amber, `#f2a93b`, with a bloom toward `#ffb547`. Amber means “call this one”: the unworked next row, the home first-call card, the top unworked pin, and that call’s bezel tick. It is not hover, not focus, not the wordmark, and not a radar frame.

Focus is ice, `#8fd3ff`, so a keyboard ring never looks like the call. Green appears only as the small “Reached” chip. Severity is a word plus a colour that is not the porch: extreme `#ff5a36`, severe `#ef7a5f`, moderate paper, minor ice, unknown slate.

The home page is the hero film: `hero-loop-web-1280.mp4` on the key art poster. Reduced motion keeps the still. The headline is Libre Baskerville, large, on a solid dark plate. The first-call card sits on the right, where the porch is in the picture, and glows like that light. Section plates 01–03 sit in the workflow. The logo loop sits in the masthead and becomes the still mark when motion is reduced.

Rank numerals go large, up to 14rem on the call sheet index. Operational sentences stay 16–18px in Atkinson Hyperlegible. Clocks, scores, and ids use IBM Plex Mono. Print is black on white. Rank 1 prints with a heavy bar and the word FIRST.

Rain and grain sit on the hero and the masthead chrome. They do not sit behind the ledger or the alert text.

## Storm Watch

The chart is MapLibre on the OpenFreeMap dark style, restyled to the same blue-black so land and water are not green. Radar is the IEM NEXRAD composite, including the five-minute offsets back to fifty minutes.

The loop starts paused on the latest frame at 45% opacity. One Play/Pause button, a frame-time readout, a frame menu, an opacity slider, and a Radar on/off toggle sit in a solid bar under the chart. Nothing plays on load. Reduced motion leaves the loop parked until Play.

Alert fills, a dark halo, a crisp severity stroke, and haloed labels draw above the radar. Facility pins are HTML markers above the canvas. The unworked first call is a pulsing amber porch light. The other pins are dim lamps that brighten on hover. Reduced motion leaves that light steady.

The alert list and the selected-alert panel use a solid `#05070b` / `#0b0f16` plate. Text never sits on moving radar. A lightning shutter runs once when a new Severe or Extreme alert arrives after the first load, and never when reduced motion is on.

## Nationwide

`/nationwide` uses the same night plates, type, and ice focus. Amber still means the next unworked call, which appears only after a real snapshot opens the call sheet. The county and alert form, the run logic, and the page markup stay as the national workbench left them. This pass changes CSS and tokens only.

Shapeless alerts stay in the list as “no shape from NWS”. National weather is not a national ranking. Times the operator reads are Eastern. Evidence keeps UTC. Scanned figures show two decimals. The evidence drawer keeps the source figure.

## Tokens

Locked by `web/design/project-direction.json` and the operator paint test:

| Token | Value |
| --- | --- |
| Background | `#05070b` |
| Surface | `#0b0f16` |
| Text | `#ebe4cf` |
| Muted | `#b7c0cc` |
| Accent (the call) | `#f2a93b` |
| Focus | `#8fd3ff` |
| Display | Libre Baskerville |
| Body | Atkinson Hyperlegible |
| Mono | IBM Plex Mono |

## Failure

Basemap failure, radar-tile failure, and a missing audited feed each say what failed and draw no substitute imagery, alerts, or pins. Retry is explicit.

## Skill checklist

- Signature is the moving porch light on the list, the map, and the bezel. It is the next unworked call.
- Tokens above. No teal, sage, or olive surface.
- Contrast stays on the dark plates. Focus is visible. Targets are at least 44px.
- Hover, focus, pressed, and disabled are separate from the porch fill.
- Empty, loading, stale, offline, and source-failure states stay written.
- The story is one storm, one first call, evidence you can open.
- 390, 768, and 1440. The map is the chart. The controls are a bar, not a dial on the echo.
- `/nationwide` is the same night system, painted in CSS only. Its form and run logic are unchanged.
- No Inter, no purple cards, no chatbot, no default Tailwind chrome, no invented alerts.
