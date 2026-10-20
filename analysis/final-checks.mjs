// Final targeted checks: interaction-time host/client API shapes in 0.2.1-rc.2 declarations.
import fs from 'node:fs'
import path from 'node:path'
const ROOT = 'C:/Users/ahmet/Documents/deepseek-harness/default-workspace/analysis/npm/extracted'
const files = []
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.d\.ts$/.test(e.name)) files.push(p) } }
walk(ROOT)

function search(needles, cap = 6, snippet = 190) {
  const out = new Map(needles.map(n => [n, []]))
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/')
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      for (const n of needles) {
        if (lines[i].includes(n) && out.get(n).length < cap) out.get(n).push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, snippet)}`)
      }
    }
  }
  for (const [n, arr] of out) {
    console.log(`\n### ${n} (${arr.length}) ###`)
    for (const h of arr) console.log('  ' + h)
  }
}

console.log('########## HOST ##########')
search(['messageProjections', 'foldSurface(', 'interface PreparedLlmCall', 'prepareCall(', 'interruptedBlocks(', 'interface SessionObservation', 'projectionMode', 'observeSession('])

console.log('\n########## CLIENT: conversation input facade ##########')
search(['interface SessionInputResolver', 'SessionInputResolver', 'setDraft', 'insertReference', 'notify?', 'slash/input-insert-text', 'input-insert-text'])

console.log('\n########## CLIENT: sessions ##########')
search(['interface SessionBinding', 'readonly session:', 'interface SessionListState', 'retainedBy', 'mainView', 'displayTitle', 'SessionReferenceSource', 'retain('])

console.log('\n########## CLIENT: conversation targets/views ##########')
search(['interface ConversationViewSnapshotMap', 'legacy:', 'turnEnds', 'ConversationBinding', 'target<Target'])

console.log('\n########## CLIENT: slots ##########')
search(['shell.overlay', 'conversation.input.dock', 'conversation.chat.node', 'entries(', 'interface SlotsService', 'inject<', 'register<'])

console.log('\n########## CLIENT: service providers/keys ##########')
search(['remote:', 'slots:', 'uiConversation:', 'conversation:', 'sessions:', 'inputTriggers:', 'modelDirectories:', 'uiWorkspace:'])

console.log('\n########## PLUGIN remote-adapter ##########')
console.log(fs.readFileSync('C:/Users/ahmet/Documents/deepseek-harness/default-workspace/side-chat-pkg/package/lib/client/dsh/remote-adapter.js', 'utf8'))
