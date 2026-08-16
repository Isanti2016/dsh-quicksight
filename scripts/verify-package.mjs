// Sanity checks for the dsh-quicksight package manifest. Run in CI and before
// publishing: verifies the installable surface matches what dsh expects.
import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const problems = []

if (!pkg.dsh?.bundle?.patch) problems.push('dsh.bundle.patch missing')
if (!existsSync(new URL('../cordis.patch.yml', import.meta.url))) problems.push('cordis.patch.yml missing')
if (!existsSync(new URL('../dsh/index.js', import.meta.url))) problems.push('dsh/index.js missing')
if (!existsSync(new URL('../scripts/ocr.py', import.meta.url))) problems.push('scripts/ocr.py missing')
if (pkg.dsh?.client) problems.push('dsh.client must NOT be declared (no client bundle is shipped)')
if (!pkg.files?.includes('dsh')) problems.push('files must include dsh/')
if (!pkg.files?.includes('scripts')) problems.push('files must include scripts/')

if (problems.length) {
  console.error('package manifest problems:\n - ' + problems.join('\n - '))
  process.exit(1)
}
console.log('package manifest OK')
