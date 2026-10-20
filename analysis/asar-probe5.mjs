// Read-only probe #5: boot-kernel inject handling, client inject lists, typert discovery, plugin typert artifact.
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

console.log('### 1. ALL INSTALLED PACKAGES dsh.client declarations ###')
const aiRoot = entry(`${PKG}`)
for (const name of Object.keys(aiRoot.files)) {
  const e = entry(`${PKG}/${name}/package.json`)
  if (!e) continue
  try {
    const pkg = JSON.parse(getText(`${PKG}/${name}/package.json`))
    const c = pkg.dsh && pkg.dsh.client
    if (c) console.log(`  ${name}: platform=${c.platform} immediately=${c.immediately} inject=${JSON.stringify(c.inject)} external=${JSON.stringify(c.external)}`)
  } catch { /* ignore */ }
}

console.log('\n### 2. WEB BOOT KERNEL (shell): how rows/inject are booted ###')
const shell = getText('dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js')
for (const n of ['onEntryState', 'function kZ', 'kZ=', 'manifest.plugins', 'row.inject', '.inject', 'loadEntry', 'EntryTree']) {
  let i = shell.indexOf(n), c = 0
  console.log(`\n=== ${n} ===`)
  while (i !== -1 && c < 3) { console.log('  ...' + shell.slice(Math.max(0, i - 220), i + n.length + 700).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = shell.indexOf(n, i + 1) }
  if (c === 0) console.log('  (none)')
}

console.log('\n### 3. HOST client-modules: inject/external composition ###')
const cm = getText(`${PKG}/dsh-client-modules/lib/index.js`)
for (const n of ['inject', 'external', 'orderByModuleGraph', 'entryOf', 'rowsById', 'toBootRow']) {
  let i = cm.indexOf(n), c = 0, count = 0
  while (i !== -1) { count++; i = cm.indexOf(n, i + 1) }
  console.log(`\n=== ${n} (${count} hits) ===`)
  i = cm.indexOf(n)
  while (i !== -1 && c < 4) { console.log(`  @${i}: ...` + cm.slice(Math.max(0, i - 200), i + n.length + 450).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = cm.indexOf(n, i + 1) }
}

console.log('\n### 4. TYPERT LOADER: artifact discovery ###')
const tl = getText(`${PKG}/dsh-typert-loader/lib/index.js`)
for (const n of ['TYPERT_HOST_EXPORT', 'resolveArtifact', 'configured', 'exports']) {
  let i = tl.indexOf(n), c = 0
  console.log(`\n=== ${n} ===`)
  while (i !== -1 && c < 3) { console.log('  ...' + tl.slice(Math.max(0, i - 250), i + n.length + 600).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = tl.indexOf(n, i + 1) }
}

console.log('\n### 5. PLUGIN typert.js / remote.js exports ###')
const base = 'C:/Users/ahmet/Documents/deepseek-harness/default-workspace/side-chat-pkg/package/lib/'
for (const f of ['typert.js', 'remote.js', 'shared/side-chat-wire.js']) {
  const s = fs.readFileSync(base + f, 'utf8')
  console.log(`\n-- ${f} (len ${s.length}) --`)
  console.log('  first 400:', s.slice(0, 400).replace(/\n/g, '\\n'))
  console.log('  last 900:', s.slice(-900).replace(/\n/g, '\\n'))
  for (const n of ['SIDE_CHAT_INVOCATIONS', 'TYPERT_REMOTE', 'export']) {
    const idx = s.indexOf(n)
    console.log(`  [${n}] ${idx === -1 ? 'NOT FOUND' : 'found @' + idx}`)
  }
}
console.log('\n### 6. PLUGIN host index.js effect/invocation usage ###')
console.log(fs.readFileSync(base + 'index.js', 'utf8'))
