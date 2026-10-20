// Detail checks: generated typert artifact vs 0.2.1 protocol; client service declarations.
import fs from 'node:fs'
import path from 'node:path'
const ROOT = 'C:/Users/ahmet/Documents/deepseek-harness/default-workspace/analysis/npm/extracted'

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }
const proto = 'deepseek-ai-dsh-typert-protocol-0.2.1-rc.2/package/lib/types/types.d.ts'
const t = read(proto)

function section(title, needle, before = 0, after = 1400, max = 1) {
  console.log(`\n=== ${title} ===`)
  let i = t.indexOf(needle), n = 0
  while (i !== -1 && n < max) {
    console.log(t.slice(Math.max(0, i - before), i + needle.length + after))
    n++; i = t.indexOf(needle, i + 1)
  }
  if (n === 0) console.log('  (none)')
}
section('TypertCodec', 'TypertCodec', 200, 1200)
section('TypertContribution', 'interface TypertContribution', 100, 1200)
section('TypertManifest', 'interface TypertManifest', 100, 1600)
section('TypertRemoteSpec', 'interface TypertRemoteSpec', 100, 1600)
section('TypertSchema', 'interface TypertSchema', 100, 800)
section('TypertPackageRecord', 'interface TypertPackageRecord', 100, 1000)
section('TypertFace', 'type TypertFace', 100, 400)

console.log('\n\n########## PLUGIN GENERATED ARTIFACT (tail) ##########')
const typertJs = fs.readFileSync('C:/Users/ahmet/Documents/deepseek-harness/default-workspace/side-chat-pkg/package/lib/typert.js', 'utf8')
console.log(typertJs.slice(-5200))

console.log('\n########## ASAR typert-loader: validateTypertManifest ##########')
const ASAR = 'C:/Users/ahmet/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const buf = fs.readFileSync(ASAR)
const JSON_START = buf.indexOf(Buffer.from('{"files"'))
let depth = 0, inStr = false, esc = false, JSON_END = -1
const win = buf.subarray(JSON_START, JSON_START + 12 * 1024 * 1024).toString('utf8')
for (let i = 0; i < win.length; i++) { const c = win.charCodeAt(i); if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false } else if (c === 34) inStr = true; else if (c === 123) depth++; else if (c === 125) { depth--; if (depth === 0) { JSON_END = i + 1; break } } }
const header = JSON.parse(win.slice(0, JSON_END))
function entry(p) { let n = header; for (const s of p.split('/')) { if (!n || !n.files || !n.files[s]) return undefined; n = n.files[s] } return n }
const DATA_START = buf.indexOf(Buffer.from('{\n  "name": "@deepseek-ai/dsh-desktop-runtime"')) - Number(entry('dsh/package.json').offset)
function getText(p) { const e = entry(p); if (!e || e.offset === undefined) return undefined; const o = DATA_START + Number(e.offset); return buf.subarray(o, o + e.size).toString('utf8') }
const tl = getText('dsh/node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js')
for (const needle of ['function validateTypertManifest', 'const validateTypertManifest', 'function assertDescriptor', 'descriptor version', 'descriptorVersion', 'mismatched descriptor']) {
  const i = tl.indexOf(needle)
  console.log(`\n--- ${needle} @${i} ---`)
  if (i !== -1) console.log(tl.slice(Math.max(0, i - 300), i + needle.length + 3500))
}
console.log('\n--- typert-loader: all "version" mentions ---')
{
  let i = tl.indexOf('version'), c = 0
  while (i !== -1 && c < 6) { console.log('  ...' + tl.slice(Math.max(0, i - 150), i + 250).replace(/\n/g, '\\n') + '...'); c++; i = tl.indexOf('version', i + 1) }
}

console.log('\n########## SERVICE DECLARATION SEARCH ##########')
const files = []
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.d\.ts$/.test(e.name)) files.push(p) } }
walk(ROOT)
const needles = ['uiConversation:', 'sessions:', 'conversation:', 'slots:', 'interface UiConversation', 'interface SessionService', 'interface SessionsService', 'interface ConversationService', 'currentSessionId', 'retainParent', 'retain(', 'binding(', 'scope(', 'interface SlotsService', 'interface Slots', 'inject(', 'register(']
const out = new Map(needles.map(n => [n, []]))
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  if (!rel.includes('dsh-client-ui-session') && !rel.includes('dsh-client-ui-conversation') && !rel.includes('dsh-client-ui-slots') && !rel.includes('dsh-api-remotes') && !rel.includes('dsh-api-session-controller') && !rel.includes('dsh-client-ui-workspace')) continue
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    for (const n of needles) {
      if (lines[i].includes(n) && out.get(n).length < 10) out.get(n).push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 180)}`)
    }
  }
}
for (const [n, arr] of out) {
  console.log(`\n### ${n} (${arr.length}) ###`)
  for (const h of arr) console.log('  ' + h)
}
