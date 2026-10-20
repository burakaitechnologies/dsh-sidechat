import { describe, expect, it, vi } from 'vitest'
import { SideChatController } from '../../src/client/side-chat-controller.js'
import { LATEST_AT_SEQ } from '../../src/shared/constants.js'
import { SessionId, type ConversationSelection } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote, MODEL } from '../fixtures/client-runtime.js'

const selection: ConversationSelection = {
  parentSessionId: SessionId('parent-1'), text: 'Selected <text>', atSeq: 7, fragments: [],
  rect: { x: 0, y: 0, width: 10, height: 10, viewportWidth: 800, viewportHeight: 600 },
}

function fixture() {
  const remote = new FakeRemote()
  const sessions = new FakeClientSessions()
  const controller = new SideChatController(remote, sessions)
  return { remote, sessions, controller }
}

async function openAndAsk(controller: SideChatController, remote: FakeRemote, question = 'First question') {
  expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
  expect((await controller.sendFirst(question)).ok).toBe(true)
  remote.streams.at(-1)!.push({ type: 'content', text: 'First answer', reasoning: '' })
  remote.streams.at(-1)!.finish()
  await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('ready'))
}

describe('SideChatController.refresh (header Refresh action)', () => {
  it('closes the host discussion and reopens an empty draft for the same parent', async () => {
    const { controller, remote, sessions } = fixture()
    await openAndAsk(controller, remote)
    const chatId = controller.getSnapshot().chatId
    expect(chatId).toBeDefined()

    const result = await controller.refresh()
    expect(result.ok).toBe(true)
    expect(remote.closeCalls).toEqual([{ chatId }])
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'draft', parentSessionId: 'parent-1', draft: '', messages: [],
    })
    expect(controller.getSnapshot().chatId).toBeUndefined()
    expect(sessions.parentsRetained).toBe(1)
    await controller.dispose()
  })

  it('is equivalent to close + /side: the next send captures the newest committed context', async () => {
    const { controller, remote } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1'), selection }).ok).toBe(true)
    expect((await controller.sendFirst('Selected question')).ok).toBe(true)
    remote.streams.at(-1)!.push({ type: 'content', text: 'First answer', reasoning: '' })
    remote.streams.at(-1)!.finish()
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('ready'))
    expect(remote.createCalls[0]).toMatchObject({
      parentSessionId: 'parent-1', atSeq: 7, selectedText: 'Selected <text>',
    })

    expect((await controller.refresh()).ok).toBe(true)
    expect((await controller.sendFirst('After refresh')).ok).toBe(true)
    expect(remote.createCalls).toHaveLength(2)
    expect(remote.createCalls[1]).toMatchObject({ parentSessionId: 'parent-1', atSeq: LATEST_AT_SEQ })
    expect(remote.createCalls[1]?.selectedText).toBeUndefined()
    expect(remote.createCalls[1]?.atSeq).toBe(Number.MAX_SAFE_INTEGER)
    await controller.dispose()
  })

  it('aborts a running reply, releases its carrier, and reopens a clean draft', async () => {
    const { controller, remote } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
    expect((await controller.sendFirst('Slow question')).ok).toBe(true)
    const stream = remote.streams[0]!
    stream.push({ type: 'content', text: 'Partial reply', reasoning: '' })
    await vi.waitFor(() => expect(controller.getSnapshot().messages[1]?.text).toBe('Partial reply'))
    const chatId = controller.getSnapshot().chatId

    expect((await controller.refresh()).ok).toBe(true)
    expect(stream.disposed).toBe(true)
    expect(remote.closeCalls).toEqual([{ chatId }])
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'draft', parentSessionId: 'parent-1', messages: [], draft: '',
    })
    await controller.dispose()
  })

  it('refuses to refresh a closed controller instead of guessing the current conversation', async () => {
    const { controller, remote, sessions } = fixture()
    expect(controller.getSnapshot().phase).toBe('closed')
    sessions.current = SessionId('parent-2')
    const result = await controller.refresh()
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_request' } })
    expect(result.ok ? '' : result.error.message).toContain('Open a Side Chat first')
    expect(controller.getSnapshot().phase).toBe('closed')
    expect(remote.closeCalls).toHaveLength(0)
    expect(sessions.parentsRetained).toBe(0)
    await controller.dispose()
  })

  it('keeps the controller’s own parent conversation when the main view moved elsewhere', async () => {
    const { controller, sessions } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
    sessions.current = SessionId('another-session')
    expect((await controller.refresh()).ok).toBe(true)
    expect(controller.getSnapshot().parentSessionId).toBe('parent-1')
    await controller.dispose()
  })

  it('fails without reopening when the Host close call fails', async () => {
    const { controller, remote } = fixture()
    await openAndAsk(controller, remote)
    remote.closeResults.push({
      ok: false, error: { code: 'transport_error', message: 'offline', recoverable: true },
    })
    const result = await controller.refresh()
    expect(result.ok).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'error', chatId: 'side-chat-1', error: { operation: 'close' },
    })
    expect(remote.createCalls).toHaveLength(1)
    await controller.dispose()
  })

  it('keeps the chosen model preference across a refresh', async () => {
    const { controller, remote, sessions } = fixture()
    await openAndAsk(controller, remote)
    const chosen = { ...MODEL, reasoningEffort: 'high' }
    expect((await controller.selectModel(chosen)).ok).toBe(true)
    expect((await controller.refresh()).ok).toBe(true)
    expect(controller.getSnapshot().modelSelection).toEqual(chosen)
    expect(sessions.modelPreference).toEqual(chosen)
    await controller.dispose()
  })
})
