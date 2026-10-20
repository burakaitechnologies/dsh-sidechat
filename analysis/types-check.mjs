// Search the extracted @deepseek-ai 0.2.1-rc.2 type declarations for the exact APIs the plugin uses.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'C:/Users/ahmet/Documents/deepseek-harness/default-workspace/analysis/npm/extracted'
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.d\.(ts|cts|mts)$/.test(e.name)) files.push(p)
  }
}
walk(ROOT)
console.log('d.ts files:', files.length)

const needles = [
  'interface PeerScope', 'class PeerScope', 'PeerScope',
  'interface InvocationDescriptor', 'InvocationDescriptor',
  'interface RemoteInvocation', 'RemoteInvocation',
  'TypertRemoteInfo', 'TYPERT_REMOTE',
  'effect(', 'effect<',
  'Toast', 'MarkdownText', 'DisclosureRow', 'IconThinkOutlineRegular', 'IconCheckOutlineRegular',
  'IconChevronDownOutlineRegular', 'IconChevronRightOutlineRegular', 'IconWarningOutlineRegular',
  'uiConversation', 'modelDirectories', 'inputTriggers', 'uiWorkspace', 'directoryFor', 'registerSource',
  '$mount', 'retainParent', 'currentSessionId', 'uiConversation', 'openSession',
  'interface ConversationService', 'interface SessionsService', 'interface SlotsService',
]
const seen = new Map()
for (const f of files) {
  const rel = path.relative(path.join(ROOT), f).replace(/\\/g, '/')
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  for (const n of needles) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(n)) continue
      const key = n
      if (!seen.has(key)) seen.set(key, [])
      const arr = seen.get(key)
      if (arr.length >= 8) continue
      arr.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`)
    }
  }
}
for (const n of needles) {
  const hits = seen.get(n) || []
  console.log(`\n### ${n} (${hits.length}) ###`)
  for (const h of hits) console.log('  ' + h)
}
