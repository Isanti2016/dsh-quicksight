# Changelog

All notable changes to dsh-quicksight are documented here.

## [0.1.1] - 2026-08-16

### Fixed

- Removed the empty `dsh.client` declaration from `package.json` — it crashed the dsh web client-modules compose step on startup (verified on Linux/Ubuntu).
- Added the required tool `output { schema, render }` so `quicksight_ocr` registers on every dsh version's tool registry (previously skipped registration).

## [0.1.0] - 2026-08-16

### Added

- Initial release: registers the `quicksight_ocr` tool implementing the two-tier image-reading strategy:
  - Tier-1: fast local OCR via RapidOCR (PP-OCR / ONNX, CPU, ~2-3s, offline, zh/en accurate).
  - Tier-2: vision-model fallback via the modlens CLI (~20s, structured evidence) when OCR is empty, too short, or visual understanding is needed.
- Bundled `scripts/ocr.py`; configurable paths (`ocrPython`, `modlensCli`, env vars); zero runtime dependencies (Node builtins only).
