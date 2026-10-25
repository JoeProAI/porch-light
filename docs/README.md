# Porch Light docs (Mintlify)

Source for a local preview. There is no Porch Light docs deployment, and this folder does not set a public docs URL.

```bash
cd docs
npx mint dev
```

Check:

```bash
npx mint validate
```

The live product is https://porchlight.earth (`noindex`). Do not publish this docs site, and do not change the app's `noindex` setting from here.

`api-reference/introduction.mdx` documents `GET /api/national`. The OpenAPI contract stays at `contract/openapi.yaml` in the repo root. It is not copied into this folder.
