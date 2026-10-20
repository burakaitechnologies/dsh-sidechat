import { type PointerEvent as ReactPointerEvent } from 'react';
import type { SideChatPhase } from '../../shared/contracts.js';
import type { SideChatMessages } from './messages.js';
export declare function SideChatHeader({ phase, messages, addToConversationDisabled, onAddToConversation, onRefresh, refreshDisabled, onDragStart, onResetPosition, onFocusParent, onClose, }: {
    readonly phase: SideChatPhase;
    readonly messages: SideChatMessages;
    readonly addToConversationDisabled?: boolean;
    readonly onAddToConversation?: () => void;
    readonly onRefresh?: () => void;
    readonly refreshDisabled?: boolean;
    readonly onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onResetPosition?: () => void;
    readonly onFocusParent: () => void;
    readonly onClose: () => void;
}): import("react/jsx-runtime").JSX.Element;
