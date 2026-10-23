# Porch Light Local Web

- Run `npm run build` then `npm run start`. The existing local binding is `127.0.0.1:3101`.
- `/` explains the product. `/operate` is the verified retrospective Manatee call sheet. `/watch` reads actual national NWS alerts and the official NOAA observed-radar loop.
- Live weather requires the local licensed Zetaris JDBC instance, existing `porchlight_postgis` datasource and `porchlight_live_weather_v1` native source view. Credentials and driver jar stay outside Git.
- From the repository root, `python -m data.adapters.us.capture_live_weather --interval 300 --max-captures 72` runs a bounded local capture worker for about six hours. National raw data and source sidecars stay in `%USERPROFILE%/.porchlight/live-weather`, not Git.
- Storm Watch reads only through audited Zetaris SQL and serves source-hash-verified cached radar bytes. The page refreshes every minute; captures older than ten minutes are visibly stale. A refresh button doesn't create a new upstream capture.
- The radar layer covers the contiguous US, not Alaska, Hawaii or territories. National weather discovery doesn't establish national care-facility ranking. No public deployment or continuous hosting is configured.
