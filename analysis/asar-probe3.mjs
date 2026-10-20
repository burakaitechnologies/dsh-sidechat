// Read-only probe #3: compatibility requirements, client module inject/graph, loader API.
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

function all(p, needle, before = 200, after = 400, max = 12) {
  const s = getText(p)
  if (s === undefined) { console.log(`[missing] ${p}`); return }
  let i = s.indexOf(needle), n = 0
  console.log(`\n=== ${needle} in ${p.split('/').slice(-3).join('/')} ===`)
  while (i !== -1 && n < max) {
    console.log(`  @${i}: ...` + s.slice(Math.max(0, i - before), i + needle.length + after).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...')
    n++; i = s.indexOf(needle, i + 1)
  }
  if (n === 0) console.log('  (none)')
}

console.log('########## APP-BOOT COMPATIBILITY ##########')
const boot = `${PKG}/dsh-app-boot/lib/index.js`
all(boot, 'function unmetRequirements', 100, 3000, 1)
all(boot, 'function runtimeVersionOf', 100, 1200, 1)
all(boot, 'evaluatePluginCompatibility(', 300, 500, 6)
all(boot, 'engines', 200, 600, 10)
all(boot, 'dshPeer', 200, 600, 6)
all(boot, 'peerDependencies', 250, 700, 6)
all(boot, 'getDshRuntimeVersion', 100, 600, 3)

console.log('\n########## PLUGIN-MANAGER INSTALL COMPATIBILITY ##########')
const pm = `${PKG}/dsh-plugin-manager/lib/index.js`
for (const n of ['incompatible-version', 'compatibility', 'exemption', 'evaluatePluginCompatibility', 'engines', 'peerDependencies']) all(pm, n, 250, 600, 4)

console.log('\n########## CLIENT MODULES: inject + graph rows ##########')
const cm = `${PKG}/dsh-client-modules/lib/index.js`
for (const n of ['inject', 'rowFor', 'entries', 'bootGraph', 'compose', 'dependencies', 'load(', '.load =', 'factory']) all(cm, n, 200, 500, 6)

console.log('\n########## LOADER FACADE (shell bundle) ##########')
const shellPath = 'dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js'
const shell = getText(shellPath)
for (const n of ['__ModuleLoader__', 'createClientModuleSystem', 'load({id', 'register(', 'staticModules']) {
  let i = shell.indexOf(n), c = 0
  console.log(`\n=== ${n} (shell) ===`)
  while (i !== -1 && c < 3) { console.log('  ...' + shell.slice(Math.max(0, i - 250), i + n.length + 450).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = shell.indexOf(n, i + 1) }
  if (c === 0) console.log('  (none)')
}

console.log('\n########## SIDE-CHAT CLIENT: inject / service calls ##########')
const sc = fs.readFileSync('C:/Users/ahmet/Documents/deepseek-harness/default-workspace/side-chat-pkg/package/lib/client.js', 'utf8')
for (const n of ['slots', 'conversation', 'uiConversation', 'modelDirectories', 'inputTriggers', 'sessions', 'remote', 'uiWorkspace', 'inject(']) {
  let i = sc.indexOf(n), c = 0
  console.log(`\n=== ${n} (side-chat bundle) ===`)
  while (i !== -1 && c < 3) { console.log('  ...' + sc.slice(Math.max(0, i - 150), i + n.length + 300).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = sc.indexOf(n, i + 1) }
  if (c === 0) console.log('  (none)')
}
