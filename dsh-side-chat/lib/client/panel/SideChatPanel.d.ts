import { type ReactNode } from 'react';
import type { SideChatState } from '../../shared/contracts.js';
import type { SideChatActionResult } from '../contracts.js';
export interface SideChatPanelProps {
    readonly state: SideChatState;
    readonly locale?: 'en' | 'zh-CN';
    /** Per-conversation geometry key; defaults to the plugin-wide legacy key. */
    readonly geometryStorageKey?: string | undefined;
    readonly embeddedConversation?: ReactNode;
    readonly modelControl?: ReactNode;
    /** Parent conversation title, when known; makes the bound session visible. */
    readonly parentTitle?: string | undefined;
    readonly onDraftChange: (draft: string) => void;
    readonly onFirstSend: (question: string) => Promise<SideChatActionResult<void>>;
    readonly onClose: () => Promise<SideChatActionResult<void>>;
    readonly onRetry: () => Promise<SideChatActionResult<unknown>>;
    readonly onFocusParent: () => void;
    readonly onRefresh?: () => void;
    readonly onAddToConversation?: () => void;
    readonly addToConversationDisabled?: boolean;
    readonly onRemoveSelection?: () => void;
}
export declare function SideChatPanel({ state, locale, geometryStorageKey, embeddedConversation, modelControl, parentTitle, onDraftChange, onFirstSend, onClose, onRetry, onFocusParent, onRefresh, onAddToConversation, addToConversationDisabled, onRemoveSelection, }: SideChatPanelProps): import("react/jsx-runtime").JSX.Element;
