# Porch Light docs (Mintlify)

Night storm and amber (`#05070b` / `#f2a93b`). Published docs: [https://joeproai.mintlify.app](https://joeproai.mintlify.app). The product desk is [https://porchlight.earth/nationwide](https://porchlight.earth/nationwide).

`docs/contract/openapi.yaml` is a full copy of `contract/openapi.yaml`. Keep it a regular file. A symlink at that path is a 27-byte pointer, and Mintlify cannot follow it.

Preview locally:

```bash
cd docs
npx mint dev
```

Validate:

```bash
npx mint validate
```
