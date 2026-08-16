# Architecture

dsh-quicksight is a server-side dsh bundle that registers a single tool,
`quicksight_ocr`, implementing a two-tier image-reading strategy for
text-only models.

```
image path / URL
      │
      ▼
quicksight_ocr (dsh/index.js)
      ├─ Tier-1  scripts/ocr.py via a Python with rapidocr_onnxruntime
      │          └─ text.length >= minChars (default 20) → return ✅
      └─ Tier-2  modlens CLI analyze <image> (uses ~/.modlens/config.json)
                 └─ structured evidence: summary / OCR / layout / uncertainty
```

## Components

| Path | Role |
| :-- | :-- |
| `dsh/index.js` | Bundle entry (`apply(ctx, config)`), registers the tool, implements both tiers, downloads URLs. Zero runtime deps. |
| `scripts/ocr.py` | Tier-1 runner: RapidOCR (PP-OCR detection + recognition on ONNX Runtime), writes UTF-8 text, ASCII-only status line. |
| `cordis.patch.yml` | Mounts the bundle under the `quicksight` service id. |

## Configuration

Plugin config (passed via the profile's `cordis.patch.yml` entry) or the
`QUICKSIGHT_*` environment variables:

- `toolName` — registered tool name (default `quicksight_ocr`)
- `minChars` — tier-1 success threshold in characters (default 20)
- `ocrPython` — Python interpreter with `rapidocr_onnxruntime`
- `modlensCli` — path to the modlens CLI (`dist/main.js`)
- `modlensEnabled` — enable/disable tier-2 (default true)
- `timeoutMs` — per-read timeout (default 120000)

Tier-2 engine configuration lives in `~/.modlens/config.json` (shared with
modlens): any OpenAI-compatible vision endpoint works.

## Privacy

Tier-1 is fully offline. Tier-2 uploads the image to the configured vision
engine. No credentials are stored in this repository.
