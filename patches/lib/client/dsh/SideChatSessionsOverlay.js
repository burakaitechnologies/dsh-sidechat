import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useSyncExternalStore } from 'react';
import { SessionId } from '../../shared/contracts.js';
import { SideChatOverlay } from './SideChatOverlay.js';
const GEOMETRY_STORAGE_PREFIX = 'dsh-side-chat.panel.geometry:';
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
export function SideChatSessionsOverlay({ manager, sessions, }) {
    const managerSnapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
    const fallbackSessionId = useSyncExternalStore(sessions.subscribeList, () => sessions.currentSessionId(), () => sessions.currentSessionId());
    const sessionList = useSyncExternalStore(sessions.subscribeList, () => sessions.sessionListSnapshot(), () => sessions.sessionListSnapshot());
    const activeSessionId = managerSnapshot.activeSessionId ?? fallbackSessionId;
    const controller = manager.get(activeSessionId);
    // A controller may only ever render for the conversation it was opened for.
    const controllerParent = controller?.getSnapshot().parentSessionId;
    const consistent = controllerParent === undefined || controllerParent === activeSessionId;
    // Prune controllers whose conversation no longer exists (archived/deleted).
    useEffect(() => {
        if (Object.keys(sessionList).length === 0)
            return;
        manager.reconcile(new Set(Object.keys(sessionList).map(id => SessionId(id))));
    }, [manager, sessionList]);
    // Lazily create the per-session controller so a fresh conversation can use
    // `/side`, selection actions, and the panel; state is kept when it is hidden.
    useEffect(() => {
        if (activeSessionId !== undefined && controller === undefined)
            manager.ensure(activeSessionId);
    }, [activeSessionId, controller, manager, managerSnapshot.revision]);
    // Defensive: if a wrongly-bound controller is ever observed, close it rather
    // than showing another conversation's side chat.
    useEffect(() => {
        if (activeSessionId === undefined || controller === undefined || consistent)
            return;
        console.error('[dsh-side-chat] refusing a Side Chat bound to another conversation');
        void controller.close();
    }, [activeSessionId, consistent, controller]);
    if (activeSessionId === undefined || controller === undefined || !consistent)
        return null;
    return (_jsx(SideChatOverlay, { controller: controller, sessions: sessions, sessionId: activeSessionId, geometryStorageKey: `${GEOMETRY_STORAGE_PREFIX}${String(activeSessionId)}` }, String(activeSessionId)));
}
