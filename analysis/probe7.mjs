import fs from 'node:fs'
const ASAR = 'C:/Users/ahmet/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const buf = fs.readFileSync(ASAR)
const JS = buf.indexOf(Buffer.from('{"files"'))
let depth = 0, inStr = false, esc = false, END = -1
const win = buf.subarray(JS, JS + 12 * 1024 * 1024).toString('utf8')
for (let i = 0; i < win.length; i++) { const c = win.charCodeAt(i); if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false } else if (c === 34) inStr = true; else if (c === 123) depth++; else if (c === 125) { depth--; if (depth === 0) { END = i + 1; break } } }
const header = JSON.parse(win.slice(0, END))
const ent = p => { let n = header; for (const s of p.split('/')) { if (!n || !n.files || !n.files[s]) return undefined; n = n.files[s] } return n }
const DS = buf.indexOf(Buffer.from('{\n  "name": "@deepseek-ai/dsh-desktop-runtime"')) - Number(ent('dsh/package.json').offset)
const txt = p => { const e = ent(p); if (!e || e.offset === undefined) return undefined; const o = DS + Number(e.offset); return buf.subarray(o, o + e.size).toString('utf8') }
const list = p => { const e = ent(p); return e && e.files ? Object.keys(e.files) : undefined }
console.log('api-gateway lib files:', list('dsh/node_modules/@deepseek-ai/dsh-api-gateway/lib'))
for (const f of list('dsh/node_modules/@deepseek-ai/dsh-api-gateway/lib') || []) {
  if (!f.endsWith('.js')) continue
  const s = txt(`dsh/node_modules/@deepseek-ai/dsh-api-gateway/lib/${f}`)
  if (!s) continue
  for (const needle of ['$mount', 'remote.', 'reflect.provide', 'provide("remote', 'namespace']) {
    let i = s.indexOf(needle), c = 0
    while (i !== -1 && c < 3) { console.log(`\n[${f}][${needle}] ...` + s.slice(Math.max(0, i - 260), i + needle.length + 520).replace(/\n/g, '\\n').replace(/\s+/g, ' ') + '...'); c++; i = s.indexOf(needle, i + 1) }
  }
}
