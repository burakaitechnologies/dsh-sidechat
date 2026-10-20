// Read-only probe of the installed Electron asar archive.
// Locates the header JSON by searching for the root '{"files"' marker, then derives
// the data-section base from a known file's absolute position. Writes nothing.
import fs from 'node:fs'

const ASAR = 'C:/Users/ahmet/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const buf = fs.readFileSync(ASAR)

function findJsonStart() {
  const marker = Buffer.from('{"files"')
  const s = buf.indexOf(marker)
  if (s < 0) throw new Error('root files marker not found')
  return s
}
function bracketMatch(s) {
  // Read a generous window (header is thousands of entries -> may exceed 1 MiB).
  let pos = s
  let depth = 0, inStr = false, esc = false
  const limit = Math.min(buf.length, s + 32 * 1024 * 1024)
  const decoder = new TextDecoder()
  while (pos < limit) {
    const chunkEnd = Math.min(limit, pos + 65536)
    const chunk = decoder.decode(buf.subarray(pos, chunkEnd))
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i)
      if (inStr) {
        if (esc) esc = false
        else if (c === 92) esc = true
        else if (c === 34) inStr = false
      } else if (c === 34) inStr = true
      else if (c === 123) depth++
      else if (c === 125) { depth--; if (depth === 0) return pos + i + 1 }
    }
    pos = chunkEnd
  }
  throw new Error('header JSON end not found')
}

const JSON_START = findJsonStart()
const JSON_END = bracketMatch(JSON_START)
const header = JSON.parse(buf.subarray(JSON_START, JSON_END).toString('utf8'))

function entry(p) {
  let node = header
  for (const seg of p.split('/')) {
    if (!node || !node.files || !node.files[seg]) return undefined
    node = node.files[seg]
  }
  return node
}
const knownEntry = entry('dsh/package.json')
const knownContent = '{\n  "name": "@deepseek-ai/dsh-desktop-runtime"'
const absKnown = buf.indexOf(Buffer.from(knownContent))
const DATA_START = absKnown - Number(knownEntry.offset)

function getBuffer(p) {
  const e = entry(p)
  if (!e || e.offset === undefined) return undefined
  const off = DATA_START + Number(e.offset)
  return buf.subarray(off, off + e.size)
}
const getText = p => { const b = getBuffer(p); return b === undefined ? undefined : b.toString('utf8') }
const listDir = p => { const e = entry(p); return e && e.files ? Object.keys(e.files) : undefined }

console.log('=== CONTAINER ===')
console.log('JSON_START =', JSON_START, '| JSON_END =', JSON_END, '| json bytes =', JSON_END - JSON_START)
console.log('known dsh/package.json offset =', knownEntry.offset, 'size =', knownEntry.size, 'absKnown =', absKnown)
console.log('DATA_START =', DATA_START, '| archive =', buf.length)
console.log('verify:', getText('dsh/package.json').slice(0, 55).replace(/\n/g, '\\n'))
console.log('header top-level files:', Object.keys(header.files).slice(0, 10).join(', '))

function search(p, needles, opts = {}) {
  const s = getText(p)
  if (s === undefined) { console.log(`  [missing file] ${p}`); return }
  for (const needle of needles) {
    let idx = s.indexOf(needle)
    let count = 0
    const hits = []
    while (idx !== -1 && count < (opts.max || 3)) {
      const a = Math.max(0, idx - (opts.before || 90))
      const b = Math.min(s.length, idx + needle.length + (opts.after || 140))
      hits.push(s.slice(a, b).replace(/\n/g, '\\n').replace(/\s+/g, ' '))
      count++
      idx = s.indexOf(needle, idx + 1)
    }
    console.log(`  [${needle}] hits=${count} in ...${p.split('/').slice(-4).join('/')}`)
    for (const h of hits) console.log('    ...' + h + '...')
  }
}

const PKG = 'dsh/node_modules/@deepseek-ai'
console.log('\n=== @deepseek-ai PACKAGES PRESENT ===')
const pkgs = listDir(PKG) || []
console.log('total:', pkgs.length)
console.log('client-ui*:', pkgs.filter(n => n.startsWith('dsh-client-ui')).join(', '))
for (const probe of ['dsh-client-ui-primitives', 'dsh-client-ui-slots', 'dsh-client-ui-renderer', 'dsh-web', 'dsh-client-web', 'dsh-client-store', 'dsh-api-remotes', 'dsh-api-session-controller']) {
  console.log(`  present ${probe}:`, pkgs.includes(probe))
}

console.log('\n=== SELECTED PACKAGE FILES ===')
for (const pkg of ['dsh-session', 'dsh-llm', 'dsh-typert-protocol', 'dsh-client-modules', 'dsh-plugin-manager', 'dsh-desktop-host', 'dsh-client-ui-chat', 'dsh-client-ui-conversation', 'dsh-client-ui-renderer', 'dsh-client-ui-model-selection', 'dsh-client-ui-input-trigger', 'dsh-client-ui-workspace', 'dsh-client-ui-layout', 'dsh-api-remotes']) {
  for (const sub of ['', 'lib', 'lib/types']) {
    const p = (PKG + '/' + pkg + '/' + sub).replace(/\/$/, '')
    const names = listDir(p)
    if (names) console.log(`  ${pkg}/${sub || '.'}:`, names.slice(0, 30).join(', '), names.length > 30 ? `(+${names.length - 30})` : '')
  }
}

console.log('\n=== WEB FRONTEND assets ===')
const assets = listDir('dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets') || []
console.log('assets:', assets.join(', '))
const shell = assets.find(n => n.startsWith('index-') && n.endsWith('.js'))
const vendor = assets.find(n => n.startsWith('vendor-') && n.endsWith('.js'))

if (shell) {
  console.log('\n--- shell:', shell, '---')
  search(`dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/${shell}`,
    ['@deepseek-ai/dsh-client-ui-primitives', 'PLATFORM_MODULES', '__ModuleLoader__', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-slots'],
    { max: 2, before: 120, after: 260 })
}
if (vendor) {
  console.log('\n--- vendor:', vendor, '---')
  search(`dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/${vendor}`,
    ['@deepseek-ai/dsh-client-ui-primitives', 'PLATFORM_MODULES', 'react/jsx-runtime'],
    { max: 2, before: 100, after: 220 })
}

console.log('\n=== HOST LIB EXPORTS ===')
search(`${PKG}/dsh-llm/lib/index.js`, ['BlockAssembler', 'createAssistantMessage', 'ReasoningEffortId'], { max: 2, before: 60, after: 120 })
search(`${PKG}/dsh-session/lib/index.js`, ['deriveEventMessage', 'foldRequestHeader', 'foldSurface', 'messageProjections'], { max: 3, before: 80, after: 200 })
search(`${PKG}/dsh-typert-protocol/lib/index.js`, ['TypertRemoteService', 'InvocationDescriptor'], { max: 3, before: 80, after: 200 })

console.log('\n=== CLIENT BUNDLE REQUIRE SHAPES ===')
search(`${PKG}/dsh-client-ui-conversation/lib/client.js`, ['@deepseek-ai/dsh-client-ui-primitives', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-renderer'], { max: 2, before: 60, after: 160 })
search(`${PKG}/dsh-client-ui-chat/lib/client.js`, ['@deepseek-ai/dsh-client-ui-primitives', 'react/jsx-runtime'], { max: 2, before: 60, after: 160 })

console.log('\n=== MODULE SYSTEM composition rules ===')
search(`${PKG}/dsh-client-modules/lib/index.js`, ['external', 'PLATFORM_MODULES', 'baseline', 'inject'], { max: 3, before: 140, after: 260 })

console.log('\n=== COMPATIBILITY METADATA READERS ===')
for (const pkg of ['dsh-plugin-manager', 'dsh-desktop-host', 'dsh-plugin-market', 'dsh-app-boot']) {
  const names = listDir(`${PKG}/${pkg}/lib`)
  if (!names) { console.log(`  [missing lib] ${pkg}`); continue }
  console.log(`  -- ${pkg}: ${names.join(', ')}`)
  for (const f of names.filter(n => n.endsWith('.js'))) {
    search(`${PKG}/${pkg}/lib/${f}`, ['dshReleases', 'dshCompatibility', 'manifestVersion', 'engines.dsh'], { max: 1, before: 80, after: 200 })
  }
}

console.log('\n=== SESSION STORE SHAPE ===')
search(`${PKG}/dsh-session/lib/index.js`, ['messageProjections', 'class SessionStore'], { max: 4, before: 120, after: 260 })
