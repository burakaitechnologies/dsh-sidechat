import type { DshSideChatSessions } from './sessions-adapter.js';
import type { SideChatManager } from '../side-chat-manager.js';
/** Minimal shape of the session the `/side` command runs for. */
export interface SideChatCommandSession {
    readonly sessionId: string;
}
/**
 * Bring an already-open Side Chat panel into focus. The command's only
 * alternative would be a composer notice, and DSH renders `info` notices
 * inline permanently — a permanent "already open" banner is worse than a
 * silent focus.
 * @returns true when a panel was found.
 */
export declare function focusSideChatPanel(): boolean;
/**
 * Run the `/side` command for one conversation: open a draft when this
 * conversation has no Side Chat, otherwise focus the existing panel. Never
 * creates a permanent inline notice for the already-open no-op.
 */
export declare function runSideChatCommand(manager: SideChatManager, sessions: DshSideChatSessions, session: SideChatCommandSession): void;
