import { useEffect } from 'react';
import { SessionId } from '../../shared/contracts.js';
/**
 * Invisible session-scope anchor. DSH mounts one instance for the conversation
 * currently shown in the main view (through the main-only
 * `conversation.session.header.actions` slot), which makes it the authoritative
 * source of the active session identity: its mount/unmount lifecycle mirrors
 * main-view session switches, without retention-counter guessing.
 */
export function SideChatSessionAnchor({ manager, sessionId, }) {
    useEffect(() => {
        const parentSessionId = SessionId(String(sessionId));
        manager.activate(parentSessionId);
        return () => { manager.deactivate(parentSessionId); };
    }, [manager, sessionId]);
    return null;
}
