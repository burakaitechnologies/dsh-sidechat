import type { DshSideChatSessions } from './sessions-adapter.js'
import type { SideChatManager } from '../side-chat-manager.js'
import { SessionId } from '../../shared/contracts.js'

/** Minimal shape of the session the `/side` command runs for. */
export interface SideChatCommandSession {
  readonly sessionId: string
}

/**
 * Bring an already-open Side Chat panel into focus. The command's only
 * alternative would be a composer notice, and DSH renders `info` notices
 * inline permanently — a permanent "already open" banner is worse than a
 * silent focus.
 * @returns true when a panel was found.
 */
export function focusSideChatPanel(): boolean {
  if (typeof document === 'undefined') return false
  const panel = document.querySelector<HTMLElement>('[data-side-chat-panel]')
  if (panel === null) return false
  panel.scrollIntoView?.({ block: 'nearest' })
  const editable = panel.querySelector<HTMLElement>('textarea, [contenteditable="true"]')
  editable?.focus()
  return true
}

/**
 * Run the `/side` command for one conversation: open a draft when this
 * conversation has no Side Chat, otherwise focus the existing panel. Never
 * creates a permanent inline notice for the already-open no-op.
 */
export function runSideChatCommand(
  manager: SideChatManager,
  sessions: DshSideChatSessions,
  session: SideChatCommandSession,
): void {
  const parentSessionId = SessionId(session.sessionId)
  const controller = manager.ensure(parentSessionId)
  if (controller.getSnapshot().phase !== 'closed') {
    focusSideChatPanel()
    return
  }
  const opened = controller.openDraft({ parentSessionId })
  if (!opened.ok) sessions.notify({ kind: 'warning', text: opened.error.message })
}
