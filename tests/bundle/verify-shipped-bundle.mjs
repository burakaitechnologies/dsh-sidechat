// Durable shipped-bundle verification probe for @ahggg/dsh-side-chat.
//
// Loads a BUILT lib/client.js exactly as the DSH module loader would
// (window.__ModuleLoader__.load + a factory require stub) inside jsdom, renders
// the exported SideChatPanel, then dispatches real pointer events to prove
// header-bar dragging, all-edge/corner resizing, per-session geometry
// persistence, click-vs-drag behavior, the header Refresh action, and reset.
//
// The harness (tools/test.mjs) copies this file into the scratch build (so the
// react / react-dom / jsdom dependencies in <scratch>/node_modules resolve) and
// runs it against both .scratch/test-build/lib/client.js and the shipped
// dsh-side-chat/lib/client.js:
//
//   node .scratch/test-build/.dsh/verify-shipped-bundle.mjs \
//     --bundle .scratch/test-build/lib/client.js \
//     --json .scratch/test-build/.dsh/probe-built.json
//
// The script also accepts SIDECHAT_BUNDLE and, with no flag, defaults to
// ../../dsh-side-chat/lib/client.js relative to this file (the repo layout).
//
// Expected: all checks pass, exit 0. The primitives package is stubbed because
// it imports CSS modules that Node cannot resolve; the rendered panel path
// never reaches those components.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { JSDOM, VirtualConsole } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'

const here = path.dirname(fileURLToPath(import.meta.url))

function argument(name) {
  const args = process.argv.slice(2)
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === `--${name}`) return args[index + 1]
    if (args[index].startsWith(`--${name}=`)) return args[index].slice(name.length + 3)
  }
  return undefined
}

if (process.argv.includes('--help')) {
  console.log('usage: node verify-shipped-bundle.mjs [--bundle <lib/client.js>] [--json <report.json>]')
  process.exit(0)
}

const bundlePath = path.resolve(argument('bundle')
  ?? process.env.SIDECHAT_BUNDLE
  ?? path.resolve(here, '..', '..', 'dsh-side-chat', 'lib', 'client.js'))
const jsonPath = argument('json') === undefined ? undefined : path.resolve(argument('json'))
const GEOMETRY_KEY = 'dsh-side-chat.panel.geometry:parent-1'
const LEGACY_GEOMETRY_KEY = 'dsh-side-chat.panel.geometry'

// The real primitives package imports CSS modules, which Node cannot load.
// The rendered panel path does not reach those components, so a component
// proxy is enough to satisfy the bundle's module initialization.
const primitives = new Proxy(function DummyPrimitive() { return null }, {
  get(target, property) {
    if (property === '__esModule') return false
    if (typeof property === 'symbol') return undefined
    if (!(property in target)) target[property] = function DummyPrimitive() { return null }
    return target[property]
  },
})

// jsdom + React 18.3 hit an IE-only input polyfill path on double-click; it is
// a harness artifact, not a panel failure, and must not fail the run.
process.on('uncaughtException', error => {
  if (String(error?.message ?? error).includes('attachEvent')) return
  throw error
})

const bundleSource = fs.readFileSync(bundlePath, 'utf8')
// React's legacy input polyfill touches `attachEvent` in jsdom. It is a
// harness artifact, not a panel failure, so jsdom must not print the noise.
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', error => {
  if (String(error?.message ?? error).includes('attachEvent')) return
  console.error(error)
})
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true, virtualConsole,
})
const { window } = dom
for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent',
  'KeyboardEvent', 'localStorage', 'getSelection', 'DOMParser', 'SVGElement', 'CustomEvent',
]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
}
globalThis.self = window
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let captured
window.__ModuleLoader__ = { load(module) { captured = module } }

vm.runInThisContext(bundleSource, { filename: path.basename(bundlePath) })
if (captured === undefined) throw new Error('bundle did not register through __ModuleLoader__')
if (captured.id !== '@ahggg/dsh-side-chat') throw new Error(`unexpected bundle id: ${captured.id}`)
const moduleExports = captured.factory(request => {
  if (request === 'react') return React
  if (request === 'react/jsx-runtime') return jsxRuntime
  if (request === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected bundle dependency: ${request}`)
})
const { SideChatPanel } = moduleExports
if (typeof SideChatPanel !== 'function') throw new Error('bundle does not export SideChatPanel')

const focusParent = { count: 0 }
const refreshCalls = { count: 0 }
const state = {
  phase: 'draft', parentSessionId: 'parent-1', draft: '', messages: [],
}
const props = {
  state,
  geometryStorageKey: GEOMETRY_KEY,
  onDraftChange: () => {},
  onFirstSend: async () => ({ ok: true, value: undefined }),
  onClose: async () => ({ ok: true, value: undefined }),
  onRetry: async () => ({ ok: true, value: undefined }),
  onFocusParent: () => { focusParent.count += 1 },
  onRefresh: () => { refreshCalls.count += 1 },
  onAddToConversation: () => {},
}
const container = document.getElementById('root')
const root = createRoot(container)
// Simulate the main composer so the default panel placement (right-aligned,
// bottom edge just above the input box) can be asserted.
const composerSeat = window.document.createElement('div')
composerSeat.setAttribute('data-composer-seat', '')
composerSeat.getBoundingClientRect = () => ({
  left: 302, top: 700, right: 1002, bottom: 760, width: 700, height: 60, x: 302, y: 700,
  toJSON: () => ({}),
})
window.document.body.appendChild(composerSeat)

function pointerEvent(type, options) {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, ...options })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event
}
async function tick(fn) {
  await React.act(async () => { await fn() })
  await new Promise(resolve => window.setTimeout(resolve, 0))
}
function panelRect(element, rect) {
  element.getBoundingClientRect = () => ({
    ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height,
  })
}
async function drag(target, from, to, pointerId = 1) {
  await tick(() => target.dispatchEvent(pointerEvent('pointerdown', { ...from, pointerId })))
  await tick(() => window.dispatchEvent(pointerEvent('pointermove', { ...to, pointerId })))
  await tick(() => window.dispatchEvent(pointerEvent('pointerup', { ...to, pointerId })))
}
async function clickHeading(heading, at) {
  await tick(() => heading.dispatchEvent(pointerEvent('pointerdown', { ...at })))
  await tick(() => window.dispatchEvent(pointerEvent('pointerup', { ...at })))
  await tick(() => heading.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ...at })))
}

const results = []
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
}
try {
  await tick(() => root.render(React.createElement(SideChatPanel, props)))
  const panel = container.querySelector('.dsh-side-chat-panel')
  const header = container.querySelector('.dsh-side-chat-header')
  const heading = container.querySelector('.dsh-side-chat-heading')
  const top = container.querySelector('.dsh-side-chat-resize-top')
  const left = container.querySelector('.dsh-side-chat-resize-left')
  const right = container.querySelector('.dsh-side-chat-resize-right')
  const bottom = container.querySelector('.dsh-side-chat-resize-bottom')
  const corner = container.querySelector('.dsh-side-chat-resize-corner')
  const cornerStart = container.querySelector('.dsh-side-chat-resize-corner-start')
  check('panel renders', panel !== null)
  check('all edge + corner handles render', [top, left, right, bottom, corner, cornerStart].every(Boolean))
  check('drag grip was removed', container.querySelector('.dsh-side-chat-drag-grip') === null)
  check('no visible resize marks in bundled CSS',
    !bundleSource.includes('dsh-side-chat-resize-corner::after')
    && !bundleSource.includes('dsh-side-chat-resize-corner-start::after')
    && !bundleSource.includes('dsh-side-chat-resize-top::after')
    && !bundleSource.includes('dsh-side-chat-resize-left::after')
    && !bundleSource.includes('dsh-side-chat-resize-right::after')
    && !bundleSource.includes('dsh-side-chat-resize-bottom::after'))
  check('per-session manager and geometry key are bundled',
    bundleSource.includes('dsh-side-chat.manager')
    && bundleSource.includes('dsh-side-chat.panel.geometry:'))
  check('default panel is compact and sits right-aligned just above the composer', (() => {
    const left = Number.parseFloat(panel.style.left)
    const top = Number.parseFloat(panel.style.top)
    const width = Number.parseFloat(panel.style.width)
    const height = Number.parseFloat(panel.style.height)
    return width === 420 && left + width === 1002 && Math.abs(top + height - 688) < 0.01
  })(), `${panel.style.left} ${panel.style.top} ${panel.style.width} ${panel.style.height}`)
  check('parent conversation title line is not rendered in the header',
    !bundleSource.includes('dsh-side-chat-heading-parent')
    && container.querySelector('.dsh-side-chat-heading-parent') === null)

  const refreshButton = container.querySelector('.dsh-side-chat-refresh')
  const addButton = container.querySelector('.dsh-side-chat-add-to-conversation')
  check('Refresh button renders with icon and label',
    refreshButton !== null && refreshButton.textContent?.trim() === 'Refresh'
    && refreshButton.querySelector('svg') !== null)
  check('Refresh sits left of Add to conversation',
    refreshButton !== null && addButton !== null
    && (refreshButton.compareDocumentPosition(addButton) & 4) !== 0)
  await tick(() => refreshButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
  check('Refresh click invokes the refresh action', refreshCalls.count === 1, String(refreshCalls.count))

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await clickHeading(heading, { clientX: 300, clientY: 170 })
  check('clicking the title still opens the parent view', focusParent.count === 1, String(focusParent.count))

  await drag(header, { clientX: 500, clientY: 160 }, { clientX: 560, clientY: 200 })
  check('header-bar drag moves panel', panel.style.left === '260px' && panel.style.top === '190px',
    `${panel.style.left} ${panel.style.top}`)
  const stored = JSON.parse(window.localStorage.getItem(GEOMETRY_KEY) ?? '{}')
  check('geometry persisted under the per-session key', stored.x === 260
    && window.localStorage.getItem(LEGACY_GEOMETRY_KEY) === null,
    `${JSON.stringify(stored)} legacy=${String(window.localStorage.getItem(LEGACY_GEOMETRY_KEY))}`)

  panelRect(panel, { left: 260, top: 190, width: 500, height: 400 })
  await drag(heading, { clientX: 500, clientY: 230 }, { clientX: 540, clientY: 260 }, 2)
  await tick(() => heading.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true, clientX: 540, clientY: 260,
  })))
  check('title drag moves panel and suppresses the click',
    panel.style.left === '300px' && panel.style.top === '220px' && focusParent.count === 1,
    `${panel.style.left} ${panel.style.top} focus=${focusParent.count}`)

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await drag(right, { clientX: 700, clientY: 350 }, { clientX: 750, clientY: 350 }, 3)
  check('right edge widens panel', panel.style.width === '550px' && panel.style.height === '400px',
    `${panel.style.width} ${panel.style.height}`)

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await drag(top, { clientX: 400, clientY: 150 }, { clientX: 400, clientY: 210 }, 4)
  check('top edge raises the top and shortens height', panel.style.top === '210px' && panel.style.height === '340px',
    `${panel.style.top} ${panel.style.height}`)

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await drag(left, { clientX: 200, clientY: 350 }, { clientX: 260, clientY: 350 }, 5)
  check('left edge moves x and narrows width', panel.style.left === '260px' && panel.style.width === '440px',
    `${panel.style.left} ${panel.style.width}`)

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await drag(cornerStart, { clientX: 200, clientY: 150 }, { clientX: 270, clientY: 200 }, 6)
  check('top-left corner resizes both axes',
    panel.style.left === '270px' && panel.style.top === '200px'
    && panel.style.width === '430px' && panel.style.height === '350px',
    `${panel.style.left} ${panel.style.top} ${panel.style.width} ${panel.style.height}`)

  panelRect(panel, { left: 200, top: 150, width: 500, height: 400 })
  await drag(corner, { clientX: 700, clientY: 550 }, { clientX: 760, clientY: 600 }, 7)
  check('bottom-right corner resizes both axes',
    panel.style.width === '560px' && panel.style.height === '450px',
    `${panel.style.width} ${panel.style.height}`)

  await tick(() => header.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })))
  check('double-click resets to the compact composer-anchored default',
    panel.style.left === '582px' && panel.style.top === '365px'
    && panel.style.width === '420px' && panel.style.height === '323px'
    && window.localStorage.getItem(GEOMETRY_KEY) === null,
    `${panel.style.left} ${panel.style.top} ${panel.style.width} ${panel.style.height}`)
} catch (error) {
  results.push({ name: 'harness', ok: false, detail: error instanceof Error ? error.stack : String(error) })
}
try {
  await tick(() => root.unmount())
} catch { /* jsdom teardown noise must not mask check results. */ }

const failed = results.filter(result => !result.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail === undefined ? '' : `  (${result.detail})`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed  [${bundlePath}]`)
if (jsonPath !== undefined) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, JSON.stringify({
    bundle: bundlePath, total: results.length, passed: results.length - failed.length,
    failed: failed.length, results,
  }, null, 2))
}
process.exitCode = failed.length === 0 ? 0 : 1
