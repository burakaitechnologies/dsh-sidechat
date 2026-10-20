// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SideChatPanel } from '../../src/client/panel/SideChatPanel.js'
import type { SideChatState } from '../../src/shared/contracts.js'

const GEOMETRY_PREFIX = 'dsh-side-chat.panel.geometry:'
const LEGACY_KEY = 'dsh-side-chat.panel.geometry'
const KEY_A = `${GEOMETRY_PREFIX}session-a`
const KEY_B = `${GEOMETRY_PREFIX}session-b`
const DRAFT_STATE: SideChatState = Object.freeze({
  phase: 'draft', parentSessionId: 'session-a', draft: '', messages: [],
}) as SideChatState

function pointerEvent(type: string, options: { clientX?: number; clientY?: number; pointerId?: number } = {}) {
  const event = new window.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: options.clientX ?? 0, clientY: options.clientY ?? 0,
  })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event
}

async function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }, pointerId = 1) {
  await act(async () => {
    target.dispatchEvent(pointerEvent('pointerdown', { clientX: from.x, clientY: from.y, pointerId }))
  })
  await act(async () => {
    window.dispatchEvent(pointerEvent('pointermove', { clientX: to.x, clientY: to.y, pointerId }))
  })
  await act(async () => {
    window.dispatchEvent(pointerEvent('pointerup', { clientX: to.x, clientY: to.y, pointerId }))
  })
}

async function clickHeading(heading: Element, at: { x: number; y: number }) {
  await act(async () => { heading.dispatchEvent(pointerEvent('pointerdown', { clientX: at.x, clientY: at.y })) })
  await act(async () => { window.dispatchEvent(pointerEvent('pointerup', { clientX: at.x, clientY: at.y })) })
  await act(async () => {
    heading.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: at.x, clientY: at.y }))
  })
}

function setRect(element: Element) {
  element.getBoundingClientRect = () => ({
    x: 200, y: 150, left: 200, top: 150, width: 500, height: 400, right: 700, bottom: 550,
    toJSON: () => ({}),
  })
}

function renderPanel(options: { geometryStorageKey?: string | undefined } = {}) {
  const onRefresh = vi.fn()
  const onAddToConversation = vi.fn()
  const onFocusParent = vi.fn()
  const element = (geometryStorageKey: string | undefined) => (
    <SideChatPanel
      state={DRAFT_STATE}
      geometryStorageKey={geometryStorageKey}
      onDraftChange={() => {}}
      onFirstSend={async () => ({ ok: true, value: undefined })}
      onClose={async () => ({ ok: true, value: undefined })}
      onRetry={async () => ({ ok: true, value: undefined })}
      onFocusParent={onFocusParent}
      onRefresh={onRefresh}
      onAddToConversation={onAddToConversation}
    />
  )
  const view = render(element(options.geometryStorageKey))
  const panel = view.container.querySelector('.dsh-side-chat-panel')
  const header = view.container.querySelector('.dsh-side-chat-header')
  const heading = view.container.querySelector('.dsh-side-chat-heading')
  if (!(panel instanceof HTMLElement) || !(header instanceof HTMLElement) || !(heading instanceof HTMLElement)) {
    throw new Error('panel, header or heading did not render')
  }
  setRect(panel)
  const rerenderWith = (geometryStorageKey: string | undefined) => {
    view.rerender(element(geometryStorageKey))
    const nextPanel = view.container.querySelector('.dsh-side-chat-panel')
    if (!(nextPanel instanceof HTMLElement)) throw new Error('panel did not rerender')
    setRect(nextPanel)
    return nextPanel
  }
  return { ...view, panel, header, heading, onRefresh, onAddToConversation, onFocusParent, rerenderWith }
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup() })

describe('Side Chat panel geometry and header actions', () => {
  it('renders the header Refresh action with an icon and label, left of Add to conversation', () => {
    const { container, onRefresh } = renderPanel()
    const refresh = container.querySelector('.dsh-side-chat-refresh')
    const add = container.querySelector('.dsh-side-chat-add-to-conversation')
    expect(refresh).toBeInstanceOf(HTMLButtonElement)
    expect(add).toBeInstanceOf(HTMLButtonElement)
    if (!(refresh instanceof HTMLButtonElement) || !(add instanceof HTMLButtonElement)) return
    expect(refresh.textContent?.trim()).toBe('Refresh')
    expect(refresh.querySelector('svg')).not.toBeNull()
    expect((refresh.compareDocumentPosition(add) & 4) !== 0).toBe(true)
    fireEvent.click(refresh)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('renders all six invisible resize handles', () => {
    const { container } = renderPanel()
    const handles = [
      '.dsh-side-chat-resize-top', '.dsh-side-chat-resize-right', '.dsh-side-chat-resize-bottom',
      '.dsh-side-chat-resize-left', '.dsh-side-chat-resize-corner', '.dsh-side-chat-resize-corner-start',
    ].map(selector => container.querySelector(selector))
    expect(handles.every(handle => handle instanceof HTMLElement)).toBe(true)
    expect(handles.every(handle => handle?.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(container.querySelector('.dsh-side-chat-drag-grip')).toBeNull()
  })

  it('persists a header drag under the supplied per-session key only', async () => {
    const { panel, header } = renderPanel({ geometryStorageKey: KEY_A })
    await drag(header, { x: 500, y: 160 }, { x: 560, y: 200 })
    expect(panel.style.left).toBe('260px')
    expect(panel.style.top).toBe('190px')
    expect(JSON.parse(window.localStorage.getItem(KEY_A) ?? 'null')).toMatchObject({
      x: 260, y: 190, width: 500, height: 400,
    })
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('keeps geometry independent between two conversations', async () => {
    const first = renderPanel({ geometryStorageKey: KEY_A })
    await drag(first.header, { x: 500, y: 160 }, { x: 560, y: 200 })
    expect(JSON.parse(window.localStorage.getItem(KEY_A) ?? 'null')).toMatchObject({ x: 260 })
    first.unmount()

    const second = renderPanel({ geometryStorageKey: KEY_B })
    expect(second.panel.style.left).not.toBe('')
    expect(second.panel.style.left).not.toBe('260px')
    await drag(second.header, { x: 500, y: 160 }, { x: 600, y: 200 })
    expect(JSON.parse(window.localStorage.getItem(KEY_B) ?? 'null')).toMatchObject({ x: 300 })
    expect(JSON.parse(window.localStorage.getItem(KEY_A) ?? 'null')).toMatchObject({ x: 260 })
    second.unmount()

    const reopened = renderPanel({ geometryStorageKey: KEY_A })
    expect(reopened.panel.style.left).toBe('260px')
    expect(reopened.panel.style.top).toBe('190px')
  })

  it('uses the legacy plugin-wide key when no per-session key is provided', async () => {
    const { panel, header } = renderPanel()
    await drag(header, { x: 500, y: 160 }, { x: 560, y: 200 })
    expect(panel.style.left).toBe('260px')
    expect(JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? 'null')).toMatchObject({ x: 260 })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
  })

  it('double-clicking the header clears only the active conversation geometry', () => {
    window.localStorage.setItem(KEY_A, JSON.stringify({ x: 200, y: 150, width: 500, height: 400 }))
    window.localStorage.setItem(KEY_B, JSON.stringify({ x: 40, y: 60, width: 420, height: 320 }))
    const { panel, header } = renderPanel({ geometryStorageKey: KEY_A })
    expect(panel.style.left).toBe('200px')
    fireEvent.doubleClick(header)
    expect(panel.style.left).not.toBe('200px')
    expect(panel.style.left).not.toBe('')
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    expect(window.localStorage.getItem(KEY_B)).not.toBeNull()
  })

  it('resizes from the right edge and persists the new size', async () => {
    const { panel, container } = renderPanel({ geometryStorageKey: KEY_A })
    const right = container.querySelector('.dsh-side-chat-resize-right')
    if (right === null) throw new Error('right resize handle missing')
    setRect(panel)
    await drag(right, { x: 700, y: 350 }, { x: 750, y: 350 }, 3)
    expect(panel.style.width).toBe('550px')
    expect(panel.style.height).toBe('400px')
    expect(JSON.parse(window.localStorage.getItem(KEY_A) ?? 'null')).toMatchObject({
      width: 550, height: 400,
    })
  })

  it('a plain title click keeps the parent-view behavior and does not create geometry', async () => {
    const { panel, heading, header, onFocusParent } = renderPanel({ geometryStorageKey: KEY_A })
    setRect(panel)
    await clickHeading(heading, { x: 300, y: 170 })
    expect(onFocusParent).toHaveBeenCalledOnce()
    expect(panel.style.left).not.toBe('')
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    // A real drag of the header must move the panel instead of opening the parent.
    await drag(header, { x: 500, y: 160 }, { x: 560, y: 200 }, 2)
    expect(panel.style.left).toBe('260px')
    expect(onFocusParent).toHaveBeenCalledOnce()
  })

  it('reloads geometry when the per-conversation storage key changes without remounting', () => {
    const { panel, rerenderWith } = renderPanel({ geometryStorageKey: KEY_A })
    window.localStorage.setItem(KEY_A, JSON.stringify({ x: 200, y: 150, width: 500, height: 400 }))
    window.localStorage.setItem(KEY_B, JSON.stringify({ x: 60, y: 70, width: 420, height: 320 }))
    fireEvent(window, new window.StorageEvent('storage', { key: KEY_A }))
    expect(panel.style.left).toBe('200px')
    const nextPanel = rerenderWith(KEY_B)
    expect(nextPanel.style.left).toBe('60px')
    expect(nextPanel.style.top).toBe('70px')
    expect(nextPanel.style.width).toBe('420px')
    expect(nextPanel.style.height).toBe('320px')
  })

  it('migrates the legacy plugin-wide geometry key once to the per-conversation key', () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ x: 120, y: 140, width: 460, height: 340 }))
    const { panel } = renderPanel({ geometryStorageKey: KEY_A })
    expect(panel.style.left).toBe('120px')
    expect(panel.style.width).toBe('460px')
    expect(JSON.parse(window.localStorage.getItem(KEY_A) ?? 'null')).toMatchObject({
      x: 120, y: 140, width: 460, height: 340,
    })
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('adopts geometry written by another tab through the storage event', () => {
    const { panel } = renderPanel({ geometryStorageKey: KEY_A })
    expect(panel.style.left).not.toBe('')
    expect(panel.style.left).not.toBe('40px')
    window.localStorage.setItem(KEY_A, JSON.stringify({ x: 40, y: 50, width: 480, height: 360 }))
    fireEvent(window, new window.StorageEvent('storage', { key: KEY_A }))
    expect(panel.style.left).toBe('40px')
    expect(panel.style.top).toBe('50px')
    expect(panel.style.width).toBe('480px')
    expect(panel.style.height).toBe('360px')
  })

  it('focuses the draft from a text-entry context but does not steal focus from a button', () => {
    // Coming from the main composer (a text-entry context): the draft is focused.
    const composer = document.createElement('input')
    document.body.append(composer)
    composer.focus()
    expect(document.activeElement).toBe(composer)
    renderPanel({ geometryStorageKey: KEY_A })
    expect(document.activeElement).toBe(document.querySelector('#dsh-side-chat-draft-input'))
    cleanup()
    composer.remove()

    // Coming from a non-text control (e.g. a toolbar button after a session
    // switch): the panel must not steal focus.
    const button = document.createElement('button')
    button.textContent = 'Toolbar action'
    document.body.append(button)
    button.focus()
    expect(document.activeElement).toBe(button)
    renderPanel({ geometryStorageKey: KEY_A })
    expect(document.activeElement).toBe(button)
    cleanup()
    button.remove()
  })
})
