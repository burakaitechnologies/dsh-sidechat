// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SideChatController } from '../../src/client/side-chat-controller.js'
import { SideChatManager } from '../../src/client/side-chat-manager.js'
import { SideChatSessionAnchor } from '../../src/client/dsh/SideChatSessionAnchor.js'
import { SideChatSessionsOverlay } from '../../src/client/dsh/SideChatSessionsOverlay.js'
import type { DshSideChatSessions } from '../../src/client/dsh/sessions-adapter.js'
import { SessionId, type ConversationSelection } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote } from '../fixtures/client-runtime.js'

const A = SessionId('session-a')
const B = SessionId('session-b')

/** The subset of DshSideChatSessions the overlay reads while rendering. */
class FakeDshSessions {
  current: SessionId | undefined = A
  private readonly listeners = new Set<() => void>()
  readonly notify = vi.fn()
  sessionList: Record<string, unknown> = { [A]: {}, [B]: {} }
  subscribeList = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  currentSessionId = (): SessionId | undefined => this.current
  sessionListSnapshot = (): Record<string, unknown> => this.sessionList
  subscribeConversationInput = (): (() => void) => () => {}
  currentConversationInputSnapshot = (): undefined => undefined
  nextConversationAnnotationNumber = (): number => 1
  modelDirectory = (): undefined => undefined
  title = (): undefined => undefined
  reconcileConversationAnnotationPersistence = (): void => {}
  setCurrent(next: SessionId | undefined): void {
    this.current = next
    for (const listener of [...this.listeners]) listener()
  }
}

function managerFixture() {
  return new SideChatManager(new FakeRemote(), new FakeClientSessions())
}

/** The anchor prop is typed as the DSH SessionId; at runtime it is a string. */
function anchor(manager: SideChatManager, sessionId: SessionId) {
  return <SideChatSessionAnchor manager={manager} sessionId={sessionId as never} />
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('SideChatSessionAnchor authoritative active conversation', () => {
  it('reports activate on mount and deactivate on unmount, following sessionId changes', async () => {
    const manager = managerFixture()
    const view = render(anchor(manager, A))
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(A))
    expect(manager.getSnapshot().everActivated).toBe(true)

    view.rerender(anchor(manager, B))
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(B))

    view.unmount()
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBeUndefined())
    expect(manager.getSnapshot().everActivated).toBe(true)
  })

  it('refcounts duplicate anchor instances so one unmount does not deactivate the session', async () => {
    const manager = managerFixture()
    const view = render(
      <>
        {anchor(manager, A)}
        {anchor(manager, A)}
      </>,
    )
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(A))
    // Drop one of the two instances: the conversation must stay active.
    view.rerender(anchor(manager, A))
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(A))
    view.unmount()
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBeUndefined())
  })

  it('survives React StrictMode’s double mount/unmount cycle', async () => {
    const manager = managerFixture()
    const view = render(<StrictMode>{anchor(manager, A)}</StrictMode>)
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(A))
    view.unmount()
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBeUndefined())
  })

  it('keeps a selection’s parent conversation when opening a draft during a session switch', async () => {
    const clientSessions = new FakeClientSessions()
    const controller = new SideChatController(new FakeRemote(), clientSessions)
    const selection: ConversationSelection = {
      parentSessionId: A, text: 'Selected text', atSeq: 7, fragments: [],
      rect: { x: 0, y: 0, width: 10, height: 10, viewportWidth: 800, viewportHeight: 600 },
    }
    // The retention scan has already moved on to B while the captured
    // selection still belongs to A: the selection wins.
    clientSessions.current = B
    expect(controller.openDraft({ selection }).ok).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ phase: 'draft', parentSessionId: A })
    await controller.dispose()
  })

  it('renders the anchor-reported conversation even when the retention scan still says another', async () => {
    const manager = managerFixture()
    const sessions = new FakeDshSessions()
    const view = render(
      <>
        {anchor(manager, A)}
        <SideChatSessionsOverlay manager={manager} sessions={sessions as unknown as DshSideChatSessions} />
      </>,
    )
    await waitFor(() => expect(manager.get(A)).toBeDefined())
    const controllerA = manager.get(A)!
    await act(async () => {
      expect(controllerA.openDraft({ parentSessionId: A }).ok).toBe(true)
      controllerA.setDraft('A draft')
    })
    await waitFor(() => expect(view.container.querySelector('.dsh-side-chat-panel')).not.toBeNull())

    // Switch the authoritative anchor to B while the legacy retention scan is
    // deliberately left pointing at A: the anchor must win.
    view.rerender(
      <>
        {anchor(manager, B)}
        <SideChatSessionsOverlay manager={manager} sessions={sessions as unknown as DshSideChatSessions} />
      </>,
    )
    await waitFor(() => expect(manager.getSnapshot().activeSessionId).toBe(B))
    await waitFor(() => expect(view.container.querySelector('.dsh-side-chat-panel')).toBeNull())
    expect(sessions.current).toBe(A)
    expect(manager.get(A)).toBe(controllerA)
    expect(controllerA.getSnapshot()).toMatchObject({ phase: 'draft', draft: 'A draft' })

    // Switch back: the same controller (and its hidden state) is rendered again.
    view.rerender(
      <>
        {anchor(manager, A)}
        <SideChatSessionsOverlay manager={manager} sessions={sessions as unknown as DshSideChatSessions} />
      </>,
    )
    await waitFor(() => expect(view.container.querySelector('.dsh-side-chat-panel')).not.toBeNull())
    const textarea = view.container.querySelector('.dsh-side-chat-panel textarea')
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)
    expect((textarea as HTMLTextAreaElement).value).toBe('A draft')
    expect(manager.get(A)).toBe(controllerA)
  })

  it('refuses and closes a controller bound to a different conversation', async () => {
    const manager = managerFixture()
    const sessions = new FakeDshSessions()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SideChatSessionsOverlay manager={manager} sessions={sessions as unknown as DshSideChatSessions} />)
    await waitFor(() => expect(manager.get(A)).toBeDefined())
    const controllerA = manager.get(A)!
    // Simulate a wrongly-bound controller: A's controller is open for B while
    // the overlay's active conversation is A. The guard runs on the next
    // overlay render (a manager snapshot change here).
    await act(async () => {
      expect(controllerA.openDraft({ parentSessionId: B }).ok).toBe(true)
      manager.activate(A)
    })
    await waitFor(() => expect(errorSpy).toHaveBeenCalled())
    await waitFor(() => expect(controllerA.getSnapshot().phase).toBe('closed'))
    expect(manager.get(A)).toBe(controllerA)
  })
})
