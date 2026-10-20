import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
/** Pointer travel below this is a click on the heading, not a header drag. */
const HEADING_CLICK_SLOP = 3;
function AddToConversationIcon() {
    return (_jsxs("svg", { className: "dsh-side-chat-add-to-conversation-icon", viewBox: "0 0 20 20", "aria-hidden": "true", children: [_jsx("path", { d: "M4.25 4.5h11.5v8.25H9l-3.5 2.75v-2.75H4.25z" }), _jsx("path", { d: "M10 6.5v4M8 8.5h4" })] }));
}
function RefreshIcon() {
    return (_jsxs("svg", { className: "dsh-side-chat-refresh-icon", viewBox: "0 0 20 20", "aria-hidden": "true", children: [_jsx("path", { d: "M15.5 7.2A6 6 0 1 0 16 10" }), _jsx("path", { d: "M15.5 3.8v3.6h-3.6" })] }));
}
/** The whole header bar drags except the two real action buttons. */
function isHeaderActionButton(target) {
    return target instanceof Element && target.closest('button:not(.dsh-side-chat-heading)') !== null;
}
export function SideChatHeader({ phase, messages, parentTitle, addToConversationDisabled = false, onAddToConversation, onRefresh, refreshDisabled = false, onDragStart, onResetPosition, onFocusParent, onClose, }) {
    const pointerStart = useRef(null);
    return (_jsxs("header", { className: "dsh-side-chat-header", ...onDragStart === undefined ? {} : { 'data-dsh-side-chat-drag-handle': '', title: messages.dragHint }, onPointerDown: (event) => {
            if (onDragStart === undefined || isHeaderActionButton(event.target))
                return;
            pointerStart.current = { x: event.clientX, y: event.clientY };
            onDragStart(event);
        }, onDoubleClick: (event) => {
            if (onResetPosition === undefined || isHeaderActionButton(event.target))
                return;
            onResetPosition();
        }, children: [_jsxs("button", { type: "button", className: "dsh-side-chat-heading", onClick: (event) => {
                    const start = pointerStart.current;
                    pointerStart.current = null;
                    // A header drag that starts on the title must not also open the parent view.
                    if (start !== null
                        && (Math.abs(event.clientX - start.x) > HEADING_CLICK_SLOP
                            || Math.abs(event.clientY - start.y) > HEADING_CLICK_SLOP))
                        return;
                    onFocusParent();
                }, children: [_jsx("strong", { children: messages.title }), parentTitle !== undefined && parentTitle.length > 0 && (_jsx("span", { className: "dsh-side-chat-heading-parent", title: parentTitle, children: parentTitle }))] }), _jsxs("div", { className: "dsh-side-chat-header-actions", children: [onRefresh !== undefined && (_jsxs("button", { type: "button", className: "dsh-side-chat-refresh", disabled: refreshDisabled, onClick: onRefresh, children: [_jsx(RefreshIcon, {}), _jsx("span", { children: messages.refresh })] })), onAddToConversation !== undefined && (_jsxs("button", { type: "button", className: "dsh-side-chat-add-to-conversation", disabled: addToConversationDisabled, onClick: onAddToConversation, children: [_jsx(AddToConversationIcon, {}), _jsx("span", { children: messages.addToConversation })] })), _jsx("button", { type: "button", className: "dsh-side-chat-close", "aria-label": messages.close, disabled: phase === 'closing', onClick: onClose, children: "\u00D7" })] })] }));
}
