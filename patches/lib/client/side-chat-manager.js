import { ObservableValue } from '../shared/observable.js';
import { SideChatController } from './side-chat-controller.js';
/** State used while a conversation has no Side Chat controller yet. */
export const EMPTY_SIDE_CHAT_STATE = Object.freeze({ phase: 'closed', draft: '', messages: [] });
/**
 * Owns one independent Side Chat controller per parent conversation. Switching
 * the main conversation only changes which controller/panel is visible; each
 * session keeps its own transcript, host discussion, and panel geometry.
 *
 * The active conversation is reported by a tiny session-scope slot component
 * (`SideChatSessionAnchor`), so the plugin never has to guess from
 * `retainedBy.mainView` scans that are ambiguous during a session switch.
 */
export class SideChatManager {
    remote;
    sessions;
    controllers = new Map();
    /** Mounted anchor count per conversation (StrictMode/dual mounts safe). */
    mounted = new Map();
    observable = new ObservableValue(Object.freeze({ revision: 0, activeSessionId: undefined, everActivated: false }), 'dsh-side-chat.manager');
    activeSessionId;
    everActivated = false;
    disposed = false;
    constructor(remote, sessions) {
        this.remote = remote;
        this.sessions = sessions;
    }
    getSnapshot = () => this.observable.getSnapshot();
    subscribe = (listener) => this.observable.subscribe(listener);
    /** Report that a conversation's session-scope anchor mounted. */
    activate(sessionId) {
        if (this.disposed)
            return;
        this.mounted.set(sessionId, (this.mounted.get(sessionId) ?? 0) + 1);
        this.everActivated = true;
        if (this.activeSessionId === sessionId)
            return;
        this.activeSessionId = sessionId;
        this.publish();
    }
    /** Report that one instance of a conversation's anchor unmounted. */
    deactivate(sessionId) {
        if (this.disposed)
            return;
        const count = this.mounted.get(sessionId);
        if (count === undefined)
            return;
        if (count > 1) {
            this.mounted.set(sessionId, count - 1);
            return;
        }
        this.mounted.delete(sessionId);
        if (this.activeSessionId !== sessionId)
            return;
        this.activeSessionId = [...this.mounted.keys()].at(-1);
        this.publish();
    }
    /** The controller for one conversation, if it was ever opened in this client. */
    get(sessionId) {
        return sessionId === undefined ? undefined : this.controllers.get(sessionId);
    }
    /** Create (or return) the controller for one conversation; never touches the Host. */
    ensure(sessionId) {
        let controller = this.controllers.get(sessionId);
        if (controller !== undefined)
            return controller;
        controller = new SideChatController(this.remote, this.sessions);
        this.controllers.set(sessionId, controller);
        this.publish();
        return controller;
    }
    /** Snapshot for a conversation without creating a controller. */
    stateOf(sessionId) {
        return this.get(sessionId)?.getSnapshot() ?? EMPTY_SIDE_CHAT_STATE;
    }
    /**
     * Dispose controllers whose parent conversation no longer exists in the
     * Session catalog (archived/deleted), releasing retained parents and host
     * discussions instead of leaking them for the client lifetime.
     */
    reconcile(knownSessionIds) {
        if (this.disposed)
            return;
        let changed = false;
        for (const sessionId of [...this.controllers.keys()]) {
            if (knownSessionIds.has(sessionId))
                continue;
            const controller = this.controllers.get(sessionId);
            this.controllers.delete(sessionId);
            changed = true;
            if (this.activeSessionId === sessionId) {
                this.mounted.delete(sessionId);
                this.activeSessionId = [...this.mounted.keys()].at(-1);
            }
            if (controller !== undefined) {
                void controller.dispose().catch(error => {
                    console.warn('[dsh-side-chat] Controller dispose failed', error);
                });
            }
        }
        if (changed)
            this.publish();
    }
    /** Close every conversation's host discussion and release retained parents. */
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.mounted.clear();
        this.activeSessionId = undefined;
        const controllers = [...this.controllers.values()];
        this.controllers.clear();
        this.publish();
        await Promise.all(controllers.map(async (controller) => {
            try {
                await controller.dispose();
            }
            catch (error) {
                console.warn('[dsh-side-chat] Controller dispose failed', error);
            }
        }));
        this.observable.dispose();
    }
    publish() {
        this.observable.publish(Object.freeze({
            revision: this.observable.getSnapshot().revision + 1,
            activeSessionId: this.activeSessionId,
            everActivated: this.everActivated,
        }));
    }
}
