import type { SessionId, SideChatRemote, SideChatState } from '../shared/contracts.js';
import type { SideChatClientSessions } from './contracts.js';
import { SideChatController } from './side-chat-controller.js';
/** State used while a conversation has no Side Chat controller yet. */
export declare const EMPTY_SIDE_CHAT_STATE: SideChatState;
interface ManagerSnapshot {
    readonly revision: number;
    /**
     * The conversation whose session-scope anchor is mounted, i.e. the one the
     * main view is showing. This is the authoritative identity reported by DSH's
     * session scope, not a scan of retention counters.
     */
    readonly activeSessionId?: SessionId | undefined;
    /** Whether at least one session-scope anchor has reported in this page. */
    readonly everActivated: boolean;
}
/**
 * Owns one independent Side Chat controller per parent conversation. Switching
 * the main conversation only changes which controller/panel is visible; each
 * session keeps its own transcript, host discussion, and panel geometry.
 *
 * The active conversation is reported by a tiny session-scope slot component
 * (`SideChatSessionAnchor`), so the plugin never has to guess from
 * `retainedBy.mainView` scans that are ambiguous during a session switch.
 */
export declare class SideChatManager {
    private readonly remote;
    private readonly sessions;
    private readonly controllers;
    /** Mounted anchor count per conversation (StrictMode/dual mounts safe). */
    private readonly mounted;
    private readonly observable;
    private activeSessionId;
    private everActivated;
    private disposed;
    constructor(remote: SideChatRemote, sessions: SideChatClientSessions);
    getSnapshot: () => ManagerSnapshot;
    subscribe: (listener: () => void) => (() => void);
    /** Report that a conversation's session-scope anchor mounted. */
    activate(sessionId: SessionId): void;
    /** Report that one instance of a conversation's anchor unmounted. */
    deactivate(sessionId: SessionId): void;
    /** The controller for one conversation, if it was ever opened in this client. */
    get(sessionId: SessionId | undefined): SideChatController | undefined;
    /** Create (or return) the controller for one conversation; never touches the Host. */
    ensure(sessionId: SessionId): SideChatController;
    /** Snapshot for a conversation without creating a controller. */
    stateOf(sessionId: SessionId | undefined): SideChatState;
    /**
     * Dispose controllers whose parent conversation no longer exists in the
     * Session catalog (archived/deleted), releasing retained parents and host
     * discussions instead of leaking them for the client lifetime.
     */
    reconcile(knownSessionIds: ReadonlySet<SessionId>): void;
    /** Close every conversation's host discussion and release retained parents. */
    dispose(): Promise<void>;
    private publish;
}
export {};
