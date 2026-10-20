// Read-only probe #2: exports, service shapes, compatibility logic, primitives symbols.
import fs from 'node:fs'

const ASAR = 'C:/Users/ahmet/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const buf = fs.readFileSync(ASAR)
const marker = Buffer.from('{"files"')
const JSON_START = buf.indexOf(marker)
let depth = 0, inStr = false, esc = false, JSON_END = -1
const win = buf.subarray(JSON_START, JSON_START + 12 * 1024 * 1024).toString('utf8')
for (let i = 0; i < win.length; i++) {
  const c = win.charCodeAt(i)
  if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false }
  else if (c === 34) inStr = true
  else if (c === 123) depth++
  else if (c === 125) { depth--; if (depth === 0) { JSON_END = i + 1; break } }
}
const header = JSON.parse(win.slice(0, JSON_END))
const knownContent = '{\n  "name": "@deepseek-ai/dsh-desktop-runtime"'
function entry(p) { let n = header; for (const s of p.split('/')) { if (!n || !n.files || !n.files[s]) return undefined; n = n.files[s] } return n }
const DATA_START = buf.indexOf(Buffer.from(knownContent)) - Number(entry('dsh/package.json').offset)
function getText(p) { const e = entry(p); if (!e || e.offset === undefined) return undefined; const o = DATA_START + Number(e.offset); return buf.subarray(o, o + e.size).toString('utf8') }
const PKG = 'dsh/node_modules/@deepseek-ai'

function around(p, needle, before = 200, after = 500, max = 2) {
  const s = getText(p)
  if (s === undefined) return console.log(`  [missing] ${p}`)
  let i = s.indexOf(needle), n = 0
  console.log(`\n-- ${needle} in ${p.split('/').slice(-3).join('/')} --`)
  while (i !== -1 && n < max) {
    console.log('  ...' + s.slice(Math.max(0, i - before), i + needle.length + after).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...')
    n++; i = s.indexOf(needle, i + 1)
  }
  if (n === 0) console.log('  (none)')
}
function exportTail(p) {
  const s = getText(p)
  if (s === undefined) return console.log(`  [missing] ${p}`)
  const i = s.lastIndexOf('export {')
  console.log(`\n=== export tail ${p.split('/').slice(-3).join('/')} (len ${s.length}) ===`)
  console.log(s.slice(i, i + 3500).replace(/\n/g, ' '))
}
function collect(p, pattern) {
  const s = getText(p)
  if (s === undefined) return console.log(`  [missing] ${p}`)
  const set = new Set()
  for (const m of s.matchAll(pattern)) set.add(m[1])
  console.log(`\n=== symbols ${pattern} in ${p.split('/').slice(-4).join('/')} ===`)
  console.log([...set].sort().join(', '))
}

console.log('### HOST EXPORT TAILS')
for (const pkg of ['dsh-llm', 'dsh-session', 'dsh-typert-protocol']) exportTail(`${PKG}/${pkg}/lib/index.js`)

console.log('\n### sessions.messageProjections OWNER')
around(`${PKG}/dsh-session/lib/index.js`, 'get messageProjections()', 2500, 300, 1)
around(`${PKG}/dsh-session/lib/index.js`, 'class SessionStore', 1200, 800, 1)
around(`${PKG}/dsh-session/lib/index.js`, 'class Sessions', 200, 600, 2)
around(`${PKG}/dsh-session/lib/index.js`, 'messageProjections', 300, 300, 6)

console.log('\n### ctx.invocation / peer shape (typert-protocol)')
around(`${PKG}/dsh-typert-protocol/lib/index.js`, 'invocation', 300, 500, 6)
around(`${PKG}/dsh-typert-protocol/lib/index.js`, 'peer', 300, 500, 6)

console.log('\n### COMPATIBILITY EVALUATION (app-boot)')
around(`${PKG}/dsh-app-boot/lib/index.js`, 'plugin-compatibility', 100, 100, 2)
around(`${PKG}/dsh-app-boot/lib/index.js`, 'function evaluatePluginCompatibility', 200, 6000, 1)
around(`${PKG}/dsh-app-boot/lib/index.js`, 'incompatible-version', 600, 400, 2)

console.log('\n### CLIENT MODULES inject composition')
for (const needle of ['inject', 'missing supplier', 'dependsOn', 'graph()', 'rows', 'external']) {
  around(`${PKG}/dsh-client-modules/lib/index.js`, needle, 250, 700, 2)
}

console.log('\n### SHELL: primitives module + icon exports')
const shellPath = 'dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js'
const shell = getText(shellPath)
for (const name of ['IconThinkOutlineRegular', 'DisclosureRow', 'MarkdownText', 'IconCheckOutlineRegular', 'IconChevronDownOutlineRegular', 'IconChevronRightOutlineRegular', 'IconWarningOutlineRegular', 'Toast']) {
  const i = shell.indexOf(name)
  console.log(`  [${name}] ${i === -1 ? 'NOT FOUND' : 'found'}`)
  if (i !== -1) console.log('     ...' + shell.slice(Math.max(0, i - 160), i + name.length + 240).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...')
}
const primIdx = shell.indexOf('@deepseek-ai/dsh-client-ui-primitives')
console.log('primitives static-table context:', shell.slice(Math.max(0, primIdx - 400), primIdx + 200).replace(/\n/g, '\\n'))
// module export object for primitives
for (const needle of ['IconThinkOutlineRegular:', 'MarkdownText:', 'DisclosureRow:', 'Toast:']) {
  const i = shell.indexOf(needle)
  console.log(`  [export-key ${needle}] ${i === -1 ? 'NOT FOUND' : 'found at ' + i}`)
  if (i !== -1) console.log('     ...' + shell.slice(Math.max(0, i - 200), i + 200).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...')
}

console.log('\n### PLUGIN CLIENT: primitives symbol reads')
const pluginClient = fs.readFileSync('C:/Users/ahmet/Documents/deepseek-harness/default-workspace/side-chat-pkg/package/lib/client.js', 'utf8')
const sym = new Set()
for (const m of pluginClient.matchAll(/\ba\.([A-Z][A-Za-z0-9_]*)/g)) sym.add(m[1])
console.log('a.<Upper> reads:', [...sym].sort().join(', '))
for (const m of pluginClient.matchAll(/(?:Toast|MarkdownText|DisclosureRow|Icon[A-Za-z]+OutlineRegular)/g)) { /* count */ }
const counts = {}
for (const m of pluginClient.matchAll(/(Toast|MarkdownText|DisclosureRow|Icon[A-Za-z]+OutlineRegular)/g)) counts[m[1]] = (counts[m[1]] || 0) + 1
console.log('primitives symbol occurrences in plugin client:', JSON.stringify(counts))
