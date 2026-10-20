import { useEffect } from 'react'
import type { SessionId as DshSessionId } from '@deepseek-ai/dsh-session/types'
import { SessionId } from '../../shared/contracts.js'
import type { SideChatManager } from '../side-chat-manager.js'

/**
 * Invisible session-scope anchor. DSH mounts one instance for the conversation
 * currently shown in the main view (through the main-only
 * `conversation.session.header.actions` slot), which makes it the authoritative
 * source of the active session identity: its mount/unmount lifecycle mirrors
 * main-view session switches, without retention-counter guessing.
 */
export function SideChatSessionAnchor({
  manager,
  sessionId,
}: {
  readonly manager: SideChatManager
  readonly sessionId: DshSessionId
}) {
  useEffect(() => {
    const parentSessionId = SessionId(String(sessionId))
    manager.activate(parentSessionId)
    return () => { manager.deactivate(parentSessionId) }
  }, [manager, sessionId])
  return null
}
