// Probe #6: remote $mount namespace registration + sessions.retain source validation.
import fs from 'node:fs'
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
const PKG = 'dsh/node_modules/@deepseek-ai'

function search(p, needle, before = 200, after = 450, max = 4) {
  const s = getText(p)
  if (s === undefined) { console.log(`[missing] ${p}`); return }
  let i = s.indexOf(needle), n = 0
  console.log(`\n=== ${needle} in ${p.split('/').slice(-3).join('/')} (${s.length} bytes) ===`)
  while (i !== -1 && n < max) { console.log(`  @${i}: ...` + s.slice(Math.max(0, i - before), i + needle.length + after).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); n++; i = s.indexOf(needle, i + 1) }
  if (n === 0) console.log('  (none)')
}

console.log('########## api-remotes client: $mount / namespace services ##########')
for (const f of ['lib/client.js', 'lib/index.js']) {
  for (const n of ['$mount', 'remote.', 'createService', 'ctx.set(', 'provide(', 'topological']) search(`${PKG}/dsh-api-remotes/${f}`, n, 250, 700, 3)
}

console.log('\n########## session-controller: retain source validation ##########')
for (const f of ['lib/client.js', 'lib/index.js']) {
  for (const n of ['retain(', 'source:', 'retainedBy', 'SessionReferenceSource']) search(`${PKG}/dsh-api-session-controller/${f}`, n, 250, 600, 3)
}

console.log('\n########## typert gateway: namespace service registration ##########')
for (const n of ['remote.${', 'remote.', 'namespace', 'set(']) search(`${PKG}/dsh-typert-registry/lib/client.browser.js`, n, 200, 400, 4)
