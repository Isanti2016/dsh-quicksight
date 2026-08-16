// dsh-quicksight smoke tests (node:test). Tier-1 is exercised only when a
// Python with rapidocr_onnxruntime is reachable; tier-2 is not called (it
// would spend provider quota) — its plumbing is covered by the config test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const home = homedir()
const isWin = process.platform === 'win32'
const defaultPython = isWin
  ? join(home, '.dsh', 'tools', 'ocr-venv', 'Scripts', 'python.exe')
  : join(home, '.dsh', 'tools', 'ocr-venv', 'bin', 'python')

test('package declares dsh.bundle manifest', () => {
  const pkg = JSON.parse(require('node:fs').readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(pkg.dsh?.bundle?.patch, 'dsh.bundle.patch is required')
  assert.ok(existsSync(new URL('../cordis.patch.yml', import.meta.url)), 'cordis.patch.yml must exist')
})

test('plugin registers a tool via ctx.tools.register', async () => {
  const mod = await import('../dsh/index.js')
  let registered = null
  mod.apply({ tools: { register: (t) => { registered = t } } }, {})
  assert.ok(registered, 'tool must be registered')
  assert.equal(registered.name, 'quicksight_ocr')
  assert.equal(registered.parameters.required[0], 'path')
  assert.ok(registered.output?.schema, 'tool must declare output.schema')
  assert.equal(typeof registered.execute, 'function')
})

test('tier-1 OCR runs when RapidOCR is available (skips otherwise)', { skip: !existsSync(defaultPython) }, async () => {
  const mod = await import('../dsh/index.js')
  let tool = null
  mod.apply({ tools: { register: (t) => { tool = t } } }, {})
  // No image here: tier-1 with a nonexistent path must degrade to a clear error,
  // proving the spawn plumbing works without touching the network.
  await assert.rejects(() => tool.execute({ path: '/definitely/not/a/real/image.png' }), /found no text|no text/)
})
