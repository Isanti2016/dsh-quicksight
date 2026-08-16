// dsh-quicksight: two-tier image reading for text-only models.
//
//   Tier-1  fast local OCR (RapidOCR / PP-OCR / ONNX, CPU ~2-3s, offline,
//           accurate for zh/en text). Runs a bundled Python script
//           (scripts/ocr.py) with a Python interpreter that has
//           `rapidocr_onnxruntime` installed.
//   Tier-2  vision model fallback via the modlens CLI (~20s, structured
//           evidence: summary / OCR / layout / semantics / uncertainty).
//           Triggered only when tier-1 yields too little text, errors out,
//           or the OCR runtime is missing.
//
// Everything is configurable (see README): no hardcoded credentials, no
// listening ports, and no private paths are baked into defaults beyond the
// standard ~/.dsh tool layout, which any user can override per-install.
//
// Loaded via cordis.patch.yml row `dsh-quicksight` (package.json
// `dsh.bundle` manifest). Node builtins only — zero runtime dependencies.

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OCR_SCRIPT = fileURLToPath(new URL('../scripts/ocr.py', import.meta.url))
const DEFAULT_TIMEOUT_MS = 120_000

export const name = 'quicksight'
export const inject = ['tools']

const home = homedir()
const isWin = process.platform === 'win32'

// Standard dsh-quicksight tool layout (users can override via plugin config
// or the QUICKSIGHT_* environment variables; see README).
const defaultPython = isWin
  ? join(home, '.dsh', 'tools', 'ocr-venv', 'Scripts', 'python.exe')
  : join(home, '.dsh', 'tools', 'ocr-venv', 'bin', 'python')
const defaultModlens = join(
  home,
  '.dsh',
  'profiles',
  'web',
  'node_modules',
  '@liustack',
  'modlens',
  'dist',
  'main.js',
)

export function apply(ctx, config = {}) {
  const toolName = config.toolName || process.env.QUICKSIGHT_TOOL_NAME || 'quicksight_ocr'
  const minChars = typeof config.minChars === 'number' ? config.minChars : 20
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS
  const ocrPython = config.ocrPython || process.env.QUICKSIGHT_OCR_PYTHON || defaultPython
  const modlensCli = config.modlensCli || process.env.QUICKSIGHT_MODLENS_CLI || defaultModlens
  const modlensEnabled = config.modlensEnabled !== false

  const tool = {
    name: toolName,
    description:
      'Read an image through the dsh-quicksight two-tier bridge: fast local OCR (RapidOCR, offline, ~2-3s, accurate zh/en text) first; if OCR yields too little text, fails, or the request needs visual understanding, it falls back to a vision model via modlens (~20s). Use whenever a message references an image the current model cannot see: pass the local file path, or an http(s) URL (downloaded automatically).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute local path or http(s) URL of the image' },
        prompt: { type: 'string', description: 'Optional extra focus for the tier-2 vision reading (ignored when tier-1 succeeds)' },
      },
      required: ['path'],
    },
    timeoutMs: timeoutMs + 20_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({ card: 'generic', title: toolName, kind: 'read', rawInput: args }),
    async execute(args) {
      if (typeof args?.path !== 'string' || args.path.trim() === '') {
        throw new Error(`${toolName} needs a non-empty string "path".`)
      }
      const source = args.path.trim()
      const local = /^https?:\/\//i.test(source) ? await downloadToTemp(source) : source

      // ---- Tier-1: fast local OCR -------------------------------------
      const tier1 = await runTier1(local, ocrPython)
      if (tier1.ok && tier1.text.length >= minChars) {
        return {
          tier: 1,
          source: 'rapidocr',
          summary: `Fast local OCR (RapidOCR), ${tier1.text.length} chars, offline`,
          text: tier1.text,
        }
      }

      // ---- Tier-2: vision model via modlens ----------------------------
      if (modlensEnabled && existsSync(modlensCli)) {
        const tier2 = await runTier2(local, modlensCli, args.prompt, timeoutMs)
        if (tier2.ok) {
          return {
            tier: 2,
            source: 'modlens',
            summary: tier2.result.summary ?? 'Vision model reading (modlens)',
            text: tier2.result.full_text ?? '',
            uncertainty: tier2.result.uncertainty ?? [],
          }
        }
      }

      if (tier1.ok && tier1.text.length > 0) {
        return {
          tier: 1,
          source: 'rapidocr',
          summary: 'OCR found little text; modlens fallback unavailable or failed',
          text: tier1.text,
        }
      }
      throw new Error(
        'dsh-quicksight: OCR found no text and the vision fallback is unavailable. ' +
          'Install RapidOCR (pip install rapidocr_onnxruntime) for tier-1, and/or install @liustack/modlens with a configured vision engine for tier-2.',
      )
    },
  }

  try {
    ctx.tools.register(tool)
  } catch (error) {
    console.error(`[quicksight] tool registration skipped: ${error}`)
  }
}

// ---------------------------------------------------------------------------

async function runTier1(image, python) {
  if (!existsSync(python)) return { ok: false, text: '' }
  const out = join(tmpdir(), `qs-ocr-${randomId()}.txt`)
  try {
    const { stdout, stderr, code } = await run(python, [OCR_SCRIPT, image, out])
    if (code !== 0 || !existsSync(out)) return { ok: false, text: '' }
    const text = readFileSync(out, 'utf8')
    return { ok: true, text }
  } catch {
    return { ok: false, text: '' }
  } finally {
    try { rmSync(out, { force: true }) } catch {}
  }
}

async function runTier2(image, cli, prompt, timeoutMs) {
  const args = [cli, 'analyze', '-i', image, '--timeout', String(timeoutMs)]
  if (prompt) args.push('--prompt', prompt)
  try {
    const { stdout, stderr, code } = await run(process.execPath, args)
    if (code !== 0) return { ok: false }
    const parsed = JSON.parse(stdout)
    const result = parsed?.result
    if (!result) return { ok: false }
    return {
      ok: true,
      result: {
        summary: typeof result.summary === 'string' ? result.summary : undefined,
        full_text: typeof result.ocr?.full_text === 'string' ? result.ocr.full_text : '',
        uncertainty: Array.isArray(result.uncertainty) ? result.uncertainty : [],
      },
    }
  } catch {
    return { ok: false }
  }
}

async function downloadToTemp(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`dsh-quicksight: failed to download ${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.exec(url)?.[1]?.toLowerCase() ?? 'png'
  const dir = mkdtempSync(join(tmpdir(), 'qs-dl-'))
  const file = join(dir, `img.${ext}`)
  writeFileSync(file, buf)
  return file
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c })
    child.stderr.on('data', (c) => { stderr += c })
    child.on('error', () => resolve({ stdout, stderr, code: -1 }))
    child.on('close', (code) => resolve({ stdout, stderr, code }))
  })
}
