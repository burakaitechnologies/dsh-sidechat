// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SideChatManager } from '../../src/client/side-chat-manager.js'
import { SideChatSessionsOverlay } from '../../src/client/dsh/SideChatSessionsOverlay.js'
import type { DshSideChatSessions } from '../../src/client/dsh/sessions-adapter.js'
import { SessionId } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote } from '../fixtures/client-runtime.js'

const A = SessionId('session-a')
const B = SessionId('session-b')
const GEOMETRY_PREFIX = 'dsh-side-chat.panel.geometry:'

/** The subset of DshSideChatSessions the overlay reads while rendering. */
class FakeDshSessions {
  current: SessionId | undefined = A
  private readonly listeners = new Set<() => void>()
  readonly notify = vi.fn()
  readonly reconcile = vi.fn()
  subscribeList = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  currentSessionId = (): SessionId | undefined => this.current
  subscribeConversationInput = (): (() => void) => () => {}
  currentConversationInputSnapshot = (): undefined => undefined
  nextConversationAnnotationNumber = (): number => 1
  sessionList: Record<string, unknown> = {}
  // Deliberately an unbound prototype method: the overlay must not pass it
  // directly as a React getSnapshot callback (rc2.7 regression).
  sessionListSnapshot(): Record<string, unknown> { return this.sessionList }
  modelDirectory = (): undefined => undefined
  title = (): undefined => undefined
  openSession = async (): Promise<void> => {}
  reconcileConversationAnnotationPersistence = (): void => { this.reconcile() }
  setCurrent(next: SessionId | undefined): void {
    this.current = next
    for (const listener of [...this.listeners]) listener()
  }
}

function pointerEvent(type: string, options: { clientX?: number; clientY?: number; pointerId?: number } = {}) {
  const event = new window.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: options.clientX ?? 0, clientY: options.clientY ?? 0,
  })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event
}

async function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }, pointerId = 1) {
  await act(async () => { target.dispatchEvent(pointerEvent('pointerdown', { clientX: from.x, clientY: from.y, pointerId })) })
  await act(async () => { window.dispatchEvent(pointerEvent('pointermove', { clientX: to.x, clientY: to.y, pointerId })) })
  await act(async () => { window.dispatchEvent(pointerEvent('pointerup', { clientX: to.x, clientY: to.y, pointerId })) })
}

function setRect(element: Element) {
  element.getBoundingClientRect = () => ({
    x: 200, y: 150, left: 200, top: 150, width: 500, height: 400, right: 700, bottom: 550,
    toJSON: () => ({}),
  })
}

function setup() {
  const remote = new FakeRemote()
  const clientSessions = new FakeClientSessions()
  const manager = new SideChatManager(remote, clientSessions)
  const sessions = new FakeDshSessions()
  const view = render(
    <SideChatSessionsOverlay
      manager={manager}
      sessions={sessions as unknown as DshSideChatSessions}
    />,
  )
  return { ...view, remote, clientSessions, manager, sessions }
}

async function findPanel(container: HTMLElement): Promise<HTMLElement> {
  await waitFor(() => expect(container.querySelector('.dsh-side-chat-panel')).not.toBeNull())
  const panel = container.querySelector('.dsh-side-chat-panel')
  if (!(panel instanceof HTMLElement)) throw new Error('panel did not render')
  setRect(panel)
  return panel
}

async function openDraft(manager: SideChatManager, sessionId: SessionId) {
  const controller = manager.ensure(sessionId)
  await act(async () => {
    expect(controller.openDraft({ parentSessionId: sessionId }).ok).toBe(true)
  })
  return controller
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('SideChatSessionsOverlay session switching', () => {
  it('renders only the current conversation’s panel and keeps the hidden transcript alive', async () => {
    const ctx = setup()
    expect(ctx.manager.get(A)).toBeDefined()
    const controllerA = await openDraft(ctx.manager, A)
    const textareaA = await findPanel(ctx.container).then(panel => {
      const textarea = panel.querySelector('textarea')
      if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('draft textarea missing')
      return textarea
    })
    await act(async () => { controllerA.setDraft('held draft') })
    expect(textareaA.value).toBe('held draft')

    // Switch the main view: A's panel unmounts, B has no open side chat.
    await act(async () => { ctx.sessions.setCurrent(B) })
    await waitFor(() => expect(ctx.container.querySelector('.dsh-side-chat-panel')).toBeNull())
    expect(ctx.manager.get(A)).toBe(controllerA)
    expect(ctx.manager.get(B)).toBeDefined()
    expect(ctx.manager.get(B)?.getSnapshot().phase).toBe('closed')
    expect(controllerA.getSnapshot()).toMatchObject({ phase: 'draft', parentSessionId: A, draft: 'held draft' })

    // Switch back: the same controller and draft come back.
    await act(async () => { ctx.sessions.setCurrent(A) })
    const panel = await findPanel(ctx.container)
    const textarea = panel.querySelector('textarea')
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)
    expect((textarea as HTMLTextAreaElement).value).toBe('held draft')
    expect(ctx.manager.get(A)).toBe(controllerA)
  })

  it('persists geometry under a per-conversation key and restores it on switch-back', async () => {
    const ctx = setup()
    const controllerA = await openDraft(ctx.manager, A)
    const panelA = await findPanel(ctx.container)
    const headerA = panelA.querySelector('.dsh-side-chat-header')
    if (headerA === null) throw new Error('header missing')
    await drag(headerA, { x: 500, y: 160 }, { x: 560, y: 200 })
    expect(panelA.style.left).toBe('260px')
    expect(JSON.parse(window.localStorage.getItem(`${GEOMETRY_PREFIX}${A}`) ?? 'null')).toMatchObject({ x: 260 })

    await act(async () => {
      ctx.sessions.setCurrent(B)
      ctx.manager.ensure(B).openDraft({ parentSessionId: B })
    })
    const panelB = await findPanel(ctx.container)
    const headerB = panelB.querySelector('.dsh-side-chat-header')
    if (headerB === null) throw new Error('header missing')
    // B has never been moved, so it starts unpositioned instead of reusing A's geometry.
    expect(panelB.style.left).toBe('')
    await drag(headerB, { x: 500, y: 160 }, { x: 620, y: 200 }, 2)
    expect(JSON.parse(window.localStorage.getItem(`${GEOMETRY_PREFIX}${B}`) ?? 'null')).toMatchObject({ x: 320 })
    expect(JSON.parse(window.localStorage.getItem(`${GEOMETRY_PREFIX}${A}`) ?? 'null')).toMatchObject({ x: 260 })

    await act(async () => { ctx.sessions.setCurrent(A) })
    const restored = await findPanel(ctx.container)
    expect(restored.style.left).toBe('260px')
    expect(restored.style.top).toBe('190px')
    expect(controllerA.getSnapshot().parentSessionId).toBe(A)
  })

  it('wires the header Refresh action to the current conversation’s controller', async () => {
    const ctx = setup()
    const controllerA = await openDraft(ctx.manager, A)
    const panel = await findPanel(ctx.container)
    const refreshSpy = vi.spyOn(controllerA, 'refresh')
    const refreshButton = panel.querySelector('.dsh-side-chat-refresh')
    expect(refreshButton).toBeInstanceOf(HTMLButtonElement)
    await act(async () => {
      fireEvent.click(refreshButton as HTMLButtonElement)
    })
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledOnce())
    await waitFor(() => expect(controllerA.getSnapshot()).toMatchObject({
      phase: 'draft', parentSessionId: A, messages: [],
    }))
    expect(ctx.remote.createCalls).toHaveLength(0)
    expect(ctx.remote.closeCalls).toHaveLength(0)
  })
})
