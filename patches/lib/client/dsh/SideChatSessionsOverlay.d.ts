import type { SideChatManager } from '../side-chat-manager.js';
import type { DshSideChatSessions } from './sessions-adapter.js';
/**
 * Session-aware host for the Side Chat overlay. Each parent conversation gets
 * its own controller (transcript + host discussion) and its own geometry key,
 * and only the conversation currently shown in the main view renders a panel.
 *
 * The active conversation is reported by the session-scope
 * `SideChatSessionAnchor`, which DSH mounts for the main-view conversation
 * only. The legacy retention scan is a fallback for the first frame before any
 * anchor reports and for blank conversations (no session header yet).
 */
export declare function SideChatSessionsOverlay({ manager, sessions, }: {
    readonly manager: SideChatManager;
    readonly sessions: DshSideChatSessions;
}): import("react/jsx-runtime").JSX.Element | null;
