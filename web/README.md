# Porch Light Local Web

- Run `npm run build` then `npm run start`. The existing local binding is `127.0.0.1:3101`.
- Windows: run `.\Start-Local.ps1` from the repository root to launch the built web app and a duplicate-checked weather worker. The default 288 attempts span roughly a day plus network time, then stop. This isn't continuous hosting or a Windows boot service. Logs and captures remain outside Git. A page refresh only rereads the latest audited publication; it cannot refresh upstream sources by itself.
- `/` explains the product. `/operate` is the verified retrospective Manatee call sheet. `/watch` reads actual national NWS alerts and the official NOAA observed-radar loop.
- Live weather requires local licensed Zetaris JDBC, `porchlight_postgis`, and the `porchlight_live_weather_v1` plus `porchlight_weather_captures_v1` native source views. Credentials and driver jar stay outside Git. Immutable capture reads prevent a source refresh from mismatching image bytes and timestamps.
- From the repository root, `python -m data.adapters.us.capture_live_weather --interval 300 --max-captures 72` runs a bounded local capture worker for about six hours. National raw data and source sidecars stay in `%USERPROFILE%/.porchlight/live-weather`, not Git.
- Storm Watch reads only through audited Zetaris SQL and serves source-hash-verified cached radar bytes. The page refreshes every minute; captures older than ten minutes are visibly stale. A refresh button doesn't create a new upstream capture.
- The original animated radar loop covers the contiguous US. Night/light maps use unaltered NOAA transparent frames and official legend for available CONUS, Alaska, Hawaii, Caribbean and Guam provider regions. Census boundaries and NWS polygons share EPSG:4326 with the source images. Coverage can have gaps; blank pixels aren't proof of safety.
- Main-page sponsor roles link to actual row/model evidence. Independent resource links open public informational pages, not connected accounts or partner integrations. National weather discovery doesn't establish national care-facility ranking. No public deployment or continuous hosting is configured.
- Geographic controls use Census state/territory names, source-polygon alert fitting, cursor-centered zoom, keyboard pan and an expandable map. Radar can be hidden to read the chart. Geographic zoom doesn't increase the source radar's resolution. No satellite provider or unsourced geographic imagery is loaded.

## Nationwide Operator Workflow

- `/nationwide` searches the audited 3,235-entry county catalog by name, state abbreviation or FIPS. Ambiguous names require an explicit selection. Names with diacritics can be searched without accents.
- County discovery and captured active-alert runs execute the national Zetaris chain. Neither substitutes the Manatee demonstration. Official alert polygons or source zone mappings determine inclusion, not place-name guesses.
- The verified call sheet appears as soon as the source chain finishes, before model processing completes. A model failure doesn't replace the ranking or hide an already verified source result.
- Unmapped alerts return an audited source gap with no facilities invented. Missing joins and excluded source rows remain explicit refusals.
- Ranked facilities can request a grounded live call script. Runtime remains Meterless plus Nemotron on the approved free NVIDIA route, with a shared 2,000-attempt cap including retries. Provider failures and budget omissions are not successful drafts.
- Use `PORCHLIGHT_ENGINE_ROOT` for the engine worktree, or run from the integrated repository with its `engines` module. Jobs and provenance-checked snapshots remain under `%USERPROFILE%/.porchlight/national/jobs`, outside Git.
