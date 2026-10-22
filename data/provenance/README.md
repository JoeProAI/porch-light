# Provenance convention

Every cached file under `data/` (alert JSON, CMS CSVs, SVI, emPOWER pulls, the county PDF) is committed next to a sidecar named `<file>.provenance.json`:

```json
{
  "source_url": "<url>",
  "fetched_at_utc": "<ISO 8601 UTC>",
  "sha256": "<hex digest of the file>",
  "license": "<license or terms line>",
  "fetch_command": "<exact command used>"
}
```

Eval labels in `eval/labels/` also record who labeled them, when, and from which snapshot.
