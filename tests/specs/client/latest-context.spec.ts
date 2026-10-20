import { describe, expect, it, vi } from 'vitest'
import { SideChatController } from '../../src/client/side-chat-controller.js'
import { LATEST_AT_SEQ } from '../../src/shared/constants.js'
import { SessionId, type ConversationSelection } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote } from '../fixtures/client-runtime.js'

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

describe('latest-context client cut (the /side path)', () => {
  it('sends the LATEST_AT_SEQ sentinel for a draft opened without a selection', async () => {
    const { controller, remote } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1') }).ok).toBe(true)
    expect((await controller.sendFirst('What was the last thing I said?')).ok).toBe(true)
    expect(remote.createCalls).toHaveLength(1)
    expect(remote.createCalls[0]).toMatchObject({ parentSessionId: 'parent-1', atSeq: LATEST_AT_SEQ })
    expect(remote.createCalls[0]?.selectedText).toBeUndefined()
    expect(LATEST_AT_SEQ).toBe(Number.MAX_SAFE_INTEGER)
    await controller.dispose()
  })

  it('keeps the completed-turn snapshot for a selection draft', async () => {
    const { controller, remote } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1'), selection }).ok).toBe(true)
    expect((await controller.sendFirst('Explain this')).ok).toBe(true)
    expect(remote.createCalls[0]).toMatchObject({
      parentSessionId: 'parent-1', atSeq: 7, selectedText: 'Selected <text>',
    })
    expect(remote.createCalls[0]?.atSeq).not.toBe(LATEST_AT_SEQ)
    await controller.dispose()
  })

  it('uses the sentinel after a selection discussion is renewed by refresh', async () => {
    const { controller, remote } = fixture()
    expect(controller.openDraft({ parentSessionId: SessionId('parent-1'), selection }).ok).toBe(true)
    expect((await controller.sendFirst('Explain this')).ok).toBe(true)
    remote.streams.at(-1)!.finish()
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('ready'))
    expect((await controller.refresh()).ok).toBe(true)
    expect((await controller.sendFirst('What is the latest context?')).ok).toBe(true)
    expect(remote.createCalls[1]).toMatchObject({ parentSessionId: 'parent-1', atSeq: LATEST_AT_SEQ })
    expect(remote.createCalls[1]?.selectedText).toBeUndefined()
    await controller.dispose()
  })
})
