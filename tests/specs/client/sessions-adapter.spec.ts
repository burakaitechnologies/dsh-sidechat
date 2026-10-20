// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DshSideChatSessions } from '../../src/client/dsh/sessions-adapter.js'
import { SessionId } from '../../src/shared/contracts.js'

const A = SessionId('session-a')

/**
 * Regression guard for rc2.7: `sessionListSnapshot` is consumed directly as a
 * `useSyncExternalStore` getSnapshot callback. If it is not bound to the
 * adapter instance, React calls it with an undefined `this`, the overlay
 * throws during render, and DSH marks the plugin's shell overlay entry
 * inactive — the panel never appears after `/side`. Keep this method an
 * arrow property (or always call it through a wrapper).
 */
describe('DshSideChatSessions session list snapshot binding', () => {
  it('keeps this bound when the snapshot accessor is detached and called bare', () => {
    const byId = { [String(A)]: { id: String(A) } }
    const ctx = { sessions: { list: { getSnapshot: () => ({ byId }) } } }
    const sessions = new DshSideChatSessions(ctx as never)
    const getSnapshot = sessions.sessionListSnapshot
    expect(getSnapshot()).toBe(byId)
  })
})
