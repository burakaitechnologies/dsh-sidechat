import { describe, expect, it, vi } from 'vitest'
import { EMPTY_SIDE_CHAT_STATE, SideChatManager } from '../../src/client/side-chat-manager.js'
import { SideChatController } from '../../src/client/side-chat-controller.js'
import { SessionId } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote } from '../fixtures/client-runtime.js'

const A = SessionId('session-a')
const B = SessionId('session-b')

function fixture() {
  const remote = new FakeRemote()
  const sessions = new FakeClientSessions()
  const manager = new SideChatManager(remote, sessions)
  return { remote, sessions, manager }
}

/** Open a draft for `sessionId` and complete one question/reply pair. */
async function ask(manager: SideChatManager, remote: FakeRemote, sessionId: SessionId, question: string) {
  const controller = manager.ensure(sessionId)
  expect(controller.openDraft({ parentSessionId: sessionId }).ok).toBe(true)
  expect((await controller.sendFirst(question)).ok).toBe(true)
  const stream = remote.streams.at(-1)!
  stream.push({ type: 'content', text: `answer to ${question}`, reasoning: '' })
  stream.finish()
  await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('ready'))
  return controller
}

describe('SideChatManager per-conversation controllers', () => {
  it('returns the same controller for a conversation and a different one per conversation', () => {
    const { manager } = fixture()
    const first = manager.ensure(A)
    expect(manager.ensure(A)).toBe(first)
    expect(first).toBeInstanceOf(SideChatController)
    const second = manager.ensure(B)
    expect(second).not.toBe(first)
    expect(manager.get(A)).toBe(first)
    expect(manager.get(B)).toBe(second)
    expect(manager.get(undefined)).toBeUndefined()
    expect(manager.get(SessionId('never-opened'))).toBeUndefined()
  })

  it('publishes manager snapshots when a conversation controller is created', () => {
    const { manager } = fixture()
    expect(manager.getSnapshot().revision).toBe(0)
    const listener = vi.fn()
    const unsubscribe = manager.subscribe(listener)
    manager.ensure(A)
    manager.ensure(A)
    manager.ensure(B)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(manager.getSnapshot().revision).toBe(2)
    unsubscribe()
    manager.ensure(SessionId('session-c'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('reports EMPTY_SIDE_CHAT_STATE for a conversation without a controller and does not create one', () => {
    const { manager } = fixture()
    const revision = manager.getSnapshot().revision
    expect(manager.stateOf(A)).toBe(EMPTY_SIDE_CHAT_STATE)
    expect(manager.stateOf(undefined)).toBe(EMPTY_SIDE_CHAT_STATE)
    expect(manager.get(A)).toBeUndefined()
    expect(manager.getSnapshot().revision).toBe(revision)
    expect(EMPTY_SIDE_CHAT_STATE).toMatchObject({ phase: 'closed', draft: '', messages: [] })
    expect(Object.isFrozen(EMPTY_SIDE_CHAT_STATE)).toBe(true)
  })

  it('keeps two conversations’ transcripts independent while both are open', async () => {
    const { manager, remote } = fixture()
    const controllerA = await ask(manager, remote, A, 'question for A')
    const controllerB = await ask(manager, remote, B, 'question for B')

    expect(controllerA.getSnapshot()).toMatchObject({ parentSessionId: A, phase: 'ready' })
    expect(controllerB.getSnapshot()).toMatchObject({ parentSessionId: B, phase: 'ready' })
    expect(controllerA.getSnapshot().chatId).not.toBe(controllerB.getSnapshot().chatId)
    expect(controllerA.getSnapshot().messages.map(message => message.text))
      .toContain('question for A')
    expect(controllerB.getSnapshot().messages.map(message => message.text))
      .toContain('question for B')
    expect(controllerA.getSnapshot().messages.map(message => message.text))
      .not.toContain('question for B')
    expect(remote.createCalls).toHaveLength(2)
    expect(remote.createCalls[0]?.parentSessionId).toBe(A)
    expect(remote.createCalls[1]?.parentSessionId).toBe(B)
    await manager.dispose()
  })

  it('keeps a hidden conversation’s side chat alive while the main view switches away', async () => {
    const { manager, sessions, remote } = fixture()
    sessions.current = A
    const controllerA = await ask(manager, remote, A, 'first A question')
    const historyBefore = controllerA.getSnapshot()

    // The main view switches to B: A's controller stays in the manager with its
    // transcript, and a follow-up still goes to A's host discussion.
    sessions.current = B
    expect(manager.get(A)).toBe(controllerA)
    expect(manager.stateOf(A)).toBe(historyBefore)
    expect((await controllerA.send('hidden follow-up for A')).ok).toBe(true)
    remote.streams.at(-1)!.finish()
    await vi.waitFor(() => expect(controllerA.getSnapshot().phase).toBe('ready'))
    expect(controllerA.getSnapshot().messages.map(message => message.text))
      .toContain('hidden follow-up for A')
    expect(remote.createCalls).toHaveLength(1)
    expect(remote.streamCalls).toHaveLength(2)

    // Opening B's side chat never touches A's transcript or host discussion.
    const controllerB = await ask(manager, remote, B, 'question for B')
    expect(controllerB.getSnapshot().messages.map(message => message.text))
      .not.toContain('first A question')
    expect(controllerA.getSnapshot().messages).toHaveLength(4)
    expect(manager.get(A)).toBe(controllerA)
    await manager.dispose()
  })

  it('disposes every conversation’s host discussion and retained parent', async () => {
    const { manager, sessions, remote } = fixture()
    await ask(manager, remote, A, 'A question')
    await ask(manager, remote, B, 'B question')
    expect(sessions.parentsRetained).toBe(2)

    await manager.dispose()
    expect(remote.closeCalls.map(call => call.chatId).sort())
      .toEqual(['side-chat-1', 'side-chat-2'])
    expect(sessions.parentsRetained).toBe(0)
    expect(manager.get(A)).toBeUndefined()
    expect(manager.get(B)).toBeUndefined()
    expect(manager.stateOf(A)).toBe(EMPTY_SIDE_CHAT_STATE)
    await expect(manager.dispose()).resolves.toBeUndefined()
  })

  it('reports the session-scope active conversation and is safe under duplicate anchor mounts', () => {
    const { manager } = fixture()
    const listener = vi.fn()
    const unsubscribe = manager.subscribe(listener)
    expect(manager.getSnapshot()).toMatchObject({ revision: 0, activeSessionId: undefined, everActivated: false })
    manager.activate(A)
    expect(manager.getSnapshot()).toMatchObject({ revision: 1, activeSessionId: A, everActivated: true })
    expect(listener).toHaveBeenCalledTimes(1)
    // Two mounted anchor instances (React StrictMode / overlapping mounts) keep
    // the conversation active until both unmount.
    manager.activate(A)
    expect(manager.getSnapshot().revision).toBe(1)
    manager.activate(B)
    expect(manager.getSnapshot()).toMatchObject({ revision: 2, activeSessionId: B })
    expect(listener).toHaveBeenCalledTimes(2)
    manager.deactivate(B)
    expect(manager.getSnapshot()).toMatchObject({ revision: 3, activeSessionId: A })
    expect(listener).toHaveBeenCalledTimes(3)
    manager.deactivate(SessionId('never-activated'))
    expect(manager.getSnapshot().revision).toBe(3)
    manager.deactivate(A)
    expect(manager.getSnapshot()).toMatchObject({ revision: 3, activeSessionId: A })
    manager.deactivate(A)
    expect(manager.getSnapshot().activeSessionId).toBeUndefined()
    expect(manager.getSnapshot().everActivated).toBe(true)
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    manager.activate(A)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('keeps the reported active conversation across controller creation and ignores reports after dispose', async () => {
    const { manager } = fixture()
    manager.activate(A)
    manager.ensure(A)
    expect(manager.getSnapshot()).toMatchObject({ activeSessionId: A, everActivated: true })
    manager.deactivate(A)
    manager.activate(B)
    await manager.dispose()
    manager.activate(A)
    manager.deactivate(B)
    expect(manager.getSnapshot()).toMatchObject({ activeSessionId: undefined, everActivated: true })
    expect(manager.get(A)).toBeUndefined()
  })

  it('prunes controllers for conversations that no longer exist', async () => {
    const { manager, remote, sessions } = fixture()
    const controllerA = await ask(manager, remote, A, 'A question')
    const controllerB = await ask(manager, remote, B, 'B question')
    manager.activate(A)
    manager.activate(B)
    expect(manager.getSnapshot().activeSessionId).toBe(B)
    const listener = vi.fn()
    manager.subscribe(listener)

    manager.reconcile(new Set([A]))
    expect(manager.get(B)).toBeUndefined()
    expect(manager.get(A)).toBe(controllerA)
    expect(manager.getSnapshot().activeSessionId).toBe(A)
    expect(listener).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(remote.closeCalls.map(call => call.chatId)).toContain('side-chat-2'))
    await vi.waitFor(() => expect(sessions.parentsRetained).toBe(1))

    manager.reconcile(new Set([A]))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(controllerA.getSnapshot().phase).toBe('ready')
    await manager.dispose()
  })
})
