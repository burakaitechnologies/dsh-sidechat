import type { SessionId as DshSessionId } from '@deepseek-ai/dsh-session/types';
import type { SideChatManager } from '../side-chat-manager.js';
/**
 * Invisible session-scope anchor. DSH mounts one instance for the conversation
 * currently shown in the main view (through the main-only
 * `conversation.session.header.actions` slot), which makes it the authoritative
 * source of the active session identity: its mount/unmount lifecycle mirrors
 * main-view session switches, without retention-counter guessing.
 */
export declare function SideChatSessionAnchor({ manager, sessionId, }: {
    readonly manager: SideChatManager;
    readonly sessionId: DshSessionId;
}): null;
