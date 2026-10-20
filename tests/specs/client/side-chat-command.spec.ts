// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SideChatManager } from '../../src/client/side-chat-manager.js'
import { focusSideChatPanel, runSideChatCommand } from '../../src/client/dsh/side-chat-command.js'
import type { DshSideChatSessions } from '../../src/client/dsh/sessions-adapter.js'
import { SessionId } from '../../src/shared/contracts.js'
import { FakeClientSessions, FakeRemote } from '../fixtures/client-runtime.js'

const A = SessionId('session-a')

function setup() {
  const remote = new FakeRemote()
  const clientSessions = new FakeClientSessions()
  const manager = new SideChatManager(remote, clientSessions)
  const notify = vi.fn()
  const sessions = { notify } as unknown as DshSideChatSessions
  return { manager, notify, sessions }
}

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => { vi.restoreAllMocks() })

describe('/side command', () => {
  it('opens a draft with an explicit parent and emits no notice', () => {
    const { manager, notify, sessions } = setup()
    runSideChatCommand(manager, sessions, { sessionId: String(A) })
    const controller = manager.get(A)
    expect(controller).toBeDefined()
    expect(controller?.getSnapshot()).toMatchObject({ phase: 'draft', parentSessionId: A })
    expect(notify).not.toHaveBeenCalled()
  })

  it('focuses the existing panel and never emits the permanent inline notice', () => {
    const { manager, notify, sessions } = setup()
    const controller = manager.ensure(A)
    controller.openDraft({ parentSessionId: A })
    controller.setDraft('keep me')

    document.body.innerHTML = '<aside data-side-chat-panel><textarea></textarea></aside>'
    const textarea = document.querySelector('textarea')
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('textarea missing')

    runSideChatCommand(manager, sessions, { sessionId: String(A) })

    expect(notify).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(textarea)
    expect(controller.getSnapshot()).toMatchObject({ phase: 'draft', draft: 'keep me' })
  })

  it('reports the missing panel without throwing when no panel exists', () => {
    const { manager, notify, sessions } = setup()
    const controller = manager.ensure(A)
    controller.openDraft({ parentSessionId: A })
    expect(focusSideChatPanel()).toBe(false)
    runSideChatCommand(manager, sessions, { sessionId: String(A) })
    expect(notify).not.toHaveBeenCalled()
  })
})
