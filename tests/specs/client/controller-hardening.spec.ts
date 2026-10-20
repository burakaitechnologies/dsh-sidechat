import { describe, expect, it, vi } from 'vitest'
import { SideChatController } from '../../src/client/side-chat-controller.js'
import { SessionId, SideChatId, type SideChatWireError } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote, MODEL } from '../fixtures/client-runtime.js'

function fixture() {
  const remote = new FakeRemote()
  const sessions = new FakeClientSessions()
  const controller = new SideChatController(remote, sessions)
  return { remote, sessions, controller }
}

describe('SideChatController conversation binding and expired discussions', () => {
  it('refuses a host discussion created for a different parent conversation', async () => {
    const { controller, remote } = fixture()
    remote.createResult = {
      ok: true,
      value: {
        parentSessionId: SessionId('some-other-session'),
        chatId: SideChatId('side-chat-wrong'),
        boundarySeq: 4,
        modelSelection: MODEL,
      },
    }
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
    const result = await controller.sendFirst('Question')
    expect(result).toMatchObject({ ok: false, error: { code: 'context_unavailable' } })
    expect(result.ok ? '' : result.error.message).toContain('different conversation')
    expect(remote.streamCalls).toHaveLength(0)
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'error', error: { operation: 'create' },
    })
    expect(controller.getSnapshot().chatId).toBeUndefined()
    await controller.dispose()
  })

  it('recovers from an expired host discussion by reopening a fresh draft for the same parent', async () => {
    const { controller, remote, sessions } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
    expect((await controller.sendFirst('First question')).ok).toBe(true)
    const expired: SideChatWireError = {
      code: 'side_chat_not_found', message: 'This temporary Side Chat has expired or closed. Open a new one.',
      recoverable: false,
    }
    remote.streams[0]!.push({ type: 'error', error: expired })
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('draft'))
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'draft', parentSessionId: 'parent-1', messages: [], draft: '',
    })
    expect(controller.getSnapshot().error).toBeUndefined()
    expect(sessions.notifications.some(text => text.includes('expired'))).toBe(true)
    expect(sessions.parentsRetained).toBe(1)

    expect((await controller.sendFirst('Second question')).ok).toBe(true)
    expect(remote.createCalls).toHaveLength(2)
    expect(remote.createCalls[1]).toMatchObject({ parentSessionId: 'parent-1' })
    expect(remote.streamCalls).toHaveLength(2)
    await controller.dispose()
  })
})
