import type { SessionId } from '../../shared/contracts.js';
import type { SideChatController } from '../side-chat-controller.js';
import { DshSideChatSessions } from './sessions-adapter.js';
/** Selection toolbar and plugin-owned read-only discussion panel. */
export declare function SideChatOverlay({ controller, sessions, sessionId, geometryStorageKey, }: {
    readonly controller: SideChatController;
    readonly sessions: DshSideChatSessions;
    /** Authoritative conversation identity from the session scope when available. */
    readonly sessionId?: SessionId | undefined;
    readonly geometryStorageKey?: string;
}): import("react/jsx-runtime").JSX.Element;
