// Read-only probe #4: foldSurface/BlockAssembler shapes, PeerScope, client inject handling, typert discovery.
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
function all(p, needle, before = 200, after = 450, max = 6) {
  const s = getText(p)
  if (s === undefined) { console.log(`[missing] ${p}`); return }
  let i = s.indexOf(needle), n = 0
  console.log(`\n=== ${needle} in ${p.split('/').slice(-4).join('/')} ===`)
  while (i !== -1 && n < max) { console.log(`  @${i}: ...` + s.slice(Math.max(0, i - before), i + needle.length + after).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); n++; i = s.indexOf(needle, i + 1) }
  if (n === 0) console.log('  (none)')
}

console.log('########## foldSurface RETURN SHAPE ##########')
all(`${PKG}/dsh-session/lib/index.js`, 'function foldSurface', 100, 1400, 1)
all(`${PKG}/dsh-session/lib/index.js`, 'projectedMessages', 150, 350, 5)
console.log('\n########## BlockAssembler API ##########')
all(`${PKG}/dsh-llm/lib/index.js`, 'interruptedBlocks', 150, 350, 3)
all(`${PKG}/dsh-llm/lib/index.js`, 'get finish()', 120, 400, 2)
all(`${PKG}/dsh-llm/lib/index.js`, 'class BlockAssembler', 60, 900, 1)
console.log('\n########## PeerScope shape ##########')
for (const p of ['dsh-typert-protocol/lib/index.js', 'dsh-connection/lib/index.js', 'dsh-api-remotes/lib/index.js', 'dsh-client-store/lib/index.js']) {
  all(`${PKG}/${p}`, 'PeerScope', 150, 400, 3)
}
all(`${PKG}/dsh-typert-protocol/lib/index.js`, 'principal', 250, 500, 3)
all(`${PKG}/dsh-typert-protocol/lib/index.js`, 'invocation', 250, 600, 4)

console.log('\n########## CLIENT MODULES browser half: inject/entry handling ##########')
const cmClient = `${PKG}/dsh-client-modules/lib/client.js`
all(cmClient, 'inject', 250, 500, 8)
all(cmClient, 'manifest', 150, 400, 4)
all(cmClient, 'entries', 150, 400, 4)
all(cmClient, 'loadCache', 150, 400, 3)
console.log('\n########## SHELL BOOT KERNEL: inject usage ##########')
const shell = getText('dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js')
for (const n of ['inject', 'manifest.plugins', 'entryState', 'immediately']) {
  let i = shell.indexOf(n), c = 0
  console.log(`\n=== ${n} (shell) ===`)
  while (i !== -1 && c < 4) { console.log('  ...' + shell.slice(Math.max(0, i - 300), i + n.length + 500).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = shell.indexOf(n, i + 1) }
  if (c === 0) console.log('  (none)')
}
console.log('\n########## TYPERT REMOTE ARTIFACT DISCOVERY ##########')
for (const pkg of ['dsh-typert-loader', 'dsh-typert-registry']) {
  const names = entry(`${PKG}/${pkg}/lib`)?.files ? Object.keys(entry(`${PKG}/${pkg}/lib`).files) : undefined
  console.log(`  ${pkg} lib:`, names ? names.join(', ') : '[missing]')
  for (const f of (names || []).filter(n => n.endsWith('.js'))) {
    for (const n of ['./remote', 'TYPERT_REMOTE', 'remoteInfo', 'packageName']) all(`${PKG}/${pkg}/lib/${f}`, n, 200, 400, 2)
  }
}
