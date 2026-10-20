import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, } from 'react';
import { SIDE_CHAT_MESSAGES } from './messages.js';
import { SelectionQuote } from './SelectionQuote.js';
import { SendIcon } from './SendIcon.js';
import { SideChatBody } from './SideChatBody.js';
import { SideChatErrorState } from './SideChatErrorState.js';
import { SideChatHeader } from './SideChatHeader.js';
import { useAutoGrowingTextarea } from './use-auto-growing-textarea.js';
const GEOMETRY_STORAGE_KEY = 'dsh-side-chat.panel.geometry';
const MIN_PANEL_WIDTH = 360;
const MIN_PANEL_HEIGHT = 280;
const VIEWPORT_MARGIN = 8;
/** Keep the panel inside the viewport and above the usable minimum size. */
function clampGeometry(geometry) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = Math.max(1, viewportWidth - VIEWPORT_MARGIN * 2);
    const availableHeight = Math.max(1, viewportHeight - VIEWPORT_MARGIN * 2);
    const width = Math.min(Math.max(geometry.width, Math.min(MIN_PANEL_WIDTH, availableWidth)), availableWidth);
    const height = Math.min(Math.max(geometry.height, Math.min(MIN_PANEL_HEIGHT, availableHeight)), availableHeight);
    const x = Math.min(Math.max(geometry.x, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN));
    const y = Math.min(Math.max(geometry.y, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN));
    return { x, y, width, height };
}
function readPanelGeometry(storageKey) {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw === null)
            return undefined;
        const stored = JSON.parse(raw);
        if (stored === null || ![stored.x, stored.y, stored.width, stored.height]
            .every(value => typeof value === 'number' && Number.isFinite(value)))
            return undefined;
        return clampGeometry(stored);
    }
    catch {
        return undefined;
    }
}
function loadPanelGeometry(storageKey) {
    const stored = readPanelGeometry(storageKey);
    if (stored !== undefined)
        return stored;
    if (storageKey === GEOMETRY_STORAGE_KEY)
        return undefined;
    // One-time upgrade from the pre-per-conversation single geometry key.
    const legacy = readPanelGeometry(GEOMETRY_STORAGE_KEY);
    if (legacy === undefined)
        return undefined;
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(legacy));
        window.localStorage.removeItem(GEOMETRY_STORAGE_KEY);
    }
    catch { /* Geometry persistence is best-effort. */ }
    return legacy;
}
function persistPanelGeometry(storageKey, geometry) {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(geometry));
    }
    catch { /* Geometry persistence is best-effort; the panel still works without storage. */ }
}
function clearPanelGeometry(storageKey) {
    try {
        window.localStorage.removeItem(storageKey);
    }
    catch { /* Geometry persistence is best-effort; the panel still works without storage. */ }
}
/**
 * Geometry for one resize edge or corner. The opposite edge(s) stay anchored:
 * dragging the left edge moves `x` while keeping the right edge fixed, and so on.
 */
function resizedGeometry(current, deltaX, deltaY) {
    const right = current.x + current.width;
    const bottom = current.y + current.height;
    const horizontal = current.edge === 'left' || current.edge === 'right'
        || current.edge === 'corner' || current.edge === 'corner-top-left';
    const vertical = current.edge === 'top' || current.edge === 'bottom'
        || current.edge === 'corner' || current.edge === 'corner-top-left';
    const fromLeft = current.edge === 'left' || current.edge === 'corner-top-left';
    const fromTop = current.edge === 'top' || current.edge === 'corner-top-left';
    let x = current.x;
    let y = current.y;
    let width = current.width;
    let height = current.height;
    if (horizontal) {
        if (fromLeft) {
            const nextX = Math.min(Math.max(current.x + deltaX, VIEWPORT_MARGIN), right - MIN_PANEL_WIDTH);
            x = nextX;
            width = right - nextX;
        }
        else {
            width = Math.min(Math.max(current.width + deltaX, MIN_PANEL_WIDTH), Math.max(MIN_PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN - current.x));
        }
    }
    if (vertical) {
        if (fromTop) {
            const nextY = Math.min(Math.max(current.y + deltaY, VIEWPORT_MARGIN), bottom - MIN_PANEL_HEIGHT);
            y = nextY;
            height = bottom - nextY;
        }
        else {
            height = Math.min(Math.max(current.height + deltaY, MIN_PANEL_HEIGHT), Math.max(MIN_PANEL_HEIGHT, window.innerHeight - VIEWPORT_MARGIN - current.y));
        }
    }
    return clampGeometry({ x, y, width, height });
}
export function SideChatPanel({ state, locale = 'en', geometryStorageKey, embeddedConversation, modelControl, parentTitle, onDraftChange, onFirstSend, onClose, onRetry, onFocusParent, onRefresh, onAddToConversation, addToConversationDisabled, onRemoveSelection, }) {
    const messages = SIDE_CHAT_MESSAGES[locale];
    const storageKey = geometryStorageKey ?? GEOMETRY_STORAGE_KEY;
    const [submitting, setSubmitting] = useState(false);
    const [geometry, setGeometry] = useState(() => loadPanelGeometry(storageKey));
    const draftRef = useAutoGrowingTextarea(state.draft);
    const panelRef = useRef(null);
    const interactionRef = useRef(null);
    const endInteractionRef = useRef(null);
    const latestGeometryRef = useRef(undefined);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            endInteractionRef.current?.();
        };
    }, []);
    useEffect(() => {
        const onWindowResize = () => {
            setGeometry(current => current === undefined ? current : clampGeometry(current));
        };
        window.addEventListener('resize', onWindowResize);
        return () => window.removeEventListener('resize', onWindowResize);
    }, []);
    // Adopt this conversation's geometry whenever the storage key changes (the
    // overlay normally remounts per conversation, this also covers reused hosts).
    useEffect(() => {
        setGeometry(loadPanelGeometry(storageKey));
    }, [storageKey]);
    // Another tab editing the same conversation's geometry should be reflected.
    useEffect(() => {
        const onStorage = (event) => {
            if (event.key !== storageKey)
                return;
            setGeometry(loadPanelGeometry(storageKey));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storageKey]);
    // Focus the draft only when the user opened it from a text-entry context;
    // switching conversations must not steal focus from the main composer.
    useEffect(() => {
        const textarea = draftRef.current;
        if (textarea === null)
            return;
        const active = document.activeElement;
        const fromTextEntry = active === null || active === document.body
            || (active instanceof HTMLElement && active.matches('input, textarea, [contenteditable="true"]'));
        if (fromTextEntry)
            textarea.focus();
    }, []);
    /** Start a header drag or an edge resize; moves are applied until pointer up. */
    const beginInteraction = (mode, event, edge) => {
        const panel = panelRef.current;
        if (panel === null || event.button !== 0)
            return;
        const rect = panel.getBoundingClientRect();
        const pointerId = event.pointerId;
        const captureTarget = event.currentTarget;
        event.preventDefault();
        event.stopPropagation();
        endInteractionRef.current?.();
        try {
            captureTarget.setPointerCapture(pointerId);
        }
        catch { /* Synthetic or already-released pointers cannot be captured. */ }
        interactionRef.current = {
            mode, ...(edge === undefined ? {} : { edge }),
            pointerX: event.clientX, pointerY: event.clientY,
            x: rect.left, y: rect.top, width: rect.width, height: rect.height,
        };
        document.documentElement.dataset['dshSideChatInteracting'] = mode;
        let moved = false;
        const onMove = (moveEvent) => {
            const current = interactionRef.current;
            if (current === null || (moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId))
                return;
            const deltaX = moveEvent.clientX - current.pointerX;
            const deltaY = moveEvent.clientY - current.pointerY;
            if (current.mode === 'move') {
                // A click on the header bar must not create/move geometry; only a real drag does.
                if (!moved && Math.abs(deltaX) <= 2 && Math.abs(deltaY) <= 2)
                    return;
                moved = true;
                const next = clampGeometry({ x: current.x + deltaX, y: current.y + deltaY,
                    width: current.width, height: current.height });
                latestGeometryRef.current = next;
                setGeometry(next);
                return;
            }
            const next = resizedGeometry(current, deltaX, deltaY);
            latestGeometryRef.current = next;
            setGeometry(next);
        };
        const onEnd = () => {
            try {
                captureTarget.releasePointerCapture(pointerId);
            }
            catch { /* The capture may already be gone. */ }
            interactionRef.current = null;
            delete document.documentElement.dataset['dshSideChatInteracting'];
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
            window.removeEventListener('blur', onEnd);
            endInteractionRef.current = null;
            const latest = latestGeometryRef.current;
            latestGeometryRef.current = undefined;
            if (mountedRef.current) {
                setGeometry(current => {
                    const target = current ?? latest;
                    if (target !== undefined)
                        persistPanelGeometry(storageKey, target);
                    return current;
                });
            }
            else if (latest !== undefined) {
                // Persist even when the panel was unmounted mid-drag (session switch).
                persistPanelGeometry(storageKey, latest);
            }
        };
        endInteractionRef.current = onEnd;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
        window.addEventListener('blur', onEnd);
    };
    const resetPosition = () => {
        latestGeometryRef.current = undefined;
        clearPanelGeometry(storageKey);
        setGeometry(undefined);
    };
    const style = geometry === undefined ? undefined : {
        left: `${String(geometry.x)}px`,
        top: `${String(geometry.y)}px`,
        right: 'auto',
        bottom: 'auto',
        width: `${String(geometry.width)}px`,
        height: `${String(geometry.height)}px`,
    };
    const submit = async (event) => {
        event.preventDefault();
        if (submitting || ['creating', 'running', 'closing'].includes(state.phase))
            return;
        setSubmitting(true);
        try {
            await onFirstSend(state.draft);
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsxs("aside", { ref: panelRef, className: "dsh-side-chat-panel", "data-side-chat-panel": "", "data-dsh-side-chat-geometry": geometry === undefined ? undefined : '', "aria-label": messages.title, "aria-busy": ['creating', 'closing'].includes(state.phase) || undefined, style: style, onKeyDown: (event) => {
            if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.stopPropagation();
                void onClose();
            }
        }, children: [_jsx(SideChatHeader, { phase: state.phase, messages: messages, ...parentTitle === undefined ? {} : { parentTitle }, ...onAddToConversation === undefined ? {} : { onAddToConversation }, ...addToConversationDisabled === undefined ? {} : { addToConversationDisabled }, ...onRefresh === undefined ? {} : { onRefresh }, refreshDisabled: state.phase === 'closing', onDragStart: (event) => { beginInteraction('move', event); }, onResetPosition: resetPosition, onFocusParent: onFocusParent, onClose: () => { void onClose(); } }), state.error !== undefined && (_jsx(SideChatErrorState, { error: state.error, messages: messages, onRetry: () => { void onRetry(); } })), state.messages.length > 0 && embeddedConversation !== undefined
                ? _jsx(SideChatBody, { children: embeddedConversation })
                : (_jsxs("form", { className: "dsh-side-chat-draft", "data-composer-card": "", onSubmit: (event) => { void submit(event); }, children: [state.selection !== undefined && (_jsx(SelectionQuote, { selections: [state.selection], messages: messages, ...onRemoveSelection === undefined ? {} : { onRemove: onRemoveSelection } })), _jsx("label", { htmlFor: "dsh-side-chat-draft-input", children: messages.placeholder }), _jsx("textarea", { id: "dsh-side-chat-draft-input", ref: draftRef, rows: 1, value: state.draft, disabled: ['creating', 'running', 'closing'].includes(state.phase), placeholder: messages.placeholder, onChange: (event) => { onDraftChange(event.target.value); }, onKeyDown: (event) => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
                                    && event.keyCode !== 229) {
                                    event.preventDefault();
                                    event.currentTarget.form?.requestSubmit();
                                }
                            } }), _jsxs("div", { className: "dsh-side-chat-draft-actions", children: [modelControl, _jsx("button", { type: "submit", className: "dsh-side-chat-send-button", "aria-label": messages.send, disabled: submitting || ['creating', 'running', 'closing'].includes(state.phase) || state.draft.trim().length === 0, children: _jsx(SendIcon, {}) })] })] })), _jsxs("footer", { className: "dsh-side-chat-footer", children: [_jsx("span", { children: messages.temporary }), _jsx("span", { children: messages.referenceOnly }), _jsx("span", { children: messages.cannotReopen }), _jsx("span", { children: messages.readOnly })] }), _jsx("div", { className: "dsh-side-chat-announcer", "aria-live": "polite", children: messages.announcer(state.phase) }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-top", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'top'); } }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-left", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'left'); } }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-right", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'right'); } }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-bottom", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'bottom'); } }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-corner", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'corner'); } }), _jsx("div", { className: "dsh-side-chat-resize-handle dsh-side-chat-resize-corner-start", "aria-hidden": "true", onPointerDown: (event) => { beginInteraction('resize', event, 'corner-top-left'); } })] }));
}
