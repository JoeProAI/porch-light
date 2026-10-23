# Porch Light Local Web

- Run `npm run build` then `npm run start`. The existing local binding is `127.0.0.1:3101`.
- `/` explains the product. `/operate` is the verified retrospective Manatee call sheet. `/watch` reads actual national NWS alerts and the official NOAA observed-radar loop.
- Live weather requires local licensed Zetaris JDBC, `porchlight_postgis`, and the `porchlight_live_weather_v1` plus `porchlight_weather_captures_v1` native source views. Credentials and driver jar stay outside Git. Immutable capture reads prevent a source refresh from mismatching image bytes and timestamps.
- From the repository root, `python -m data.adapters.us.capture_live_weather --interval 300 --max-captures 72` runs a bounded local capture worker for about six hours. National raw data and source sidecars stay in `%USERPROFILE%/.porchlight/live-weather`, not Git.
- Storm Watch reads only through audited Zetaris SQL and serves source-hash-verified cached radar bytes. The page refreshes every minute; captures older than ten minutes are visibly stale. A refresh button doesn't create a new upstream capture.
- The original animated radar loop covers the contiguous US. Night/light maps use unaltered NOAA transparent frames and official legend for available CONUS, Alaska, Hawaii, Caribbean and Guam provider regions. Census boundaries and NWS polygons share EPSG:4326 with the source images. Coverage can have gaps; blank pixels aren't proof of safety.
- Main-page sponsor roles link to actual row/model evidence. Independent resource links open public informational pages, not connected accounts or partner integrations. National weather discovery doesn't establish national care-facility ranking. No public deployment or continuous hosting is configured.
