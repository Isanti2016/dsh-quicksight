# Contributing

Thanks for considering a contribution to dsh-quicksight!

## Development

- Node.js >= 22.13, npm/pnpm.
- The plugin is a single `dsh/index.js` (ESM, Node builtins only) plus the
  bundled `scripts/ocr.py`. Keep it dependency-free: no runtime `dependencies`.

## Testing

```sh
npm test                 # runs node:test smoke tests (tier-1 skipped when RapidOCR is absent)
node scripts/verify-package.mjs   # package manifest sanity check
```

To exercise tier-1 locally you need a Python interpreter with
`rapidocr_onnxruntime` installed:

```sh
python -m venv ~/.dsh/tools/ocr-venv
~/.dsh/tools/ocr-venv/bin/pip install rapidocr_onnxruntime
```

## Submitting changes

- Open a PR against `main` with a clear description.
- Keep changes minimal and focused; update `CHANGELOG.md` for user-visible
  changes.
