import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { SideChatPhase } from '../../shared/contracts.js'
import type { SideChatMessages } from './messages.js'

/** Pointer travel below this is a click on the heading, not a header drag. */
const HEADING_CLICK_SLOP = 3

function AddToConversationIcon() {
  return (
    <svg
      className="dsh-side-chat-add-to-conversation-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M4.25 4.5h11.5v8.25H9l-3.5 2.75v-2.75H4.25z" />
      <path d="M10 6.5v4M8 8.5h4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="dsh-side-chat-refresh-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.5 7.2A6 6 0 1 0 16 10" />
      <path d="M15.5 3.8v3.6h-3.6" />
    </svg>
  )
}

/** The whole header bar drags except the two real action buttons. */
function isHeaderActionButton(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button:not(.dsh-side-chat-heading)') !== null
}

export function SideChatHeader({
  phase,
  messages,
  parentTitle,
  addToConversationDisabled = false,
  onAddToConversation,
  onRefresh,
  refreshDisabled = false,
  onDragStart,
  onResetPosition,
  onFocusParent,
  onClose,
}: {
  readonly phase: SideChatPhase
  readonly messages: SideChatMessages
  /** Parent conversation title, when known; makes the bound session visible. */
  readonly parentTitle?: string | undefined
  readonly addToConversationDisabled?: boolean
  readonly onAddToConversation?: () => void
  readonly onRefresh?: () => void
  readonly refreshDisabled?: boolean
  readonly onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onResetPosition?: () => void
  readonly onFocusParent: () => void
  readonly onClose: () => void
}) {
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | null>(null)
  return (
    <header
      className="dsh-side-chat-header"
      {...onDragStart === undefined ? {} : { 'data-dsh-side-chat-drag-handle': '', title: messages.dragHint }}
      onPointerDown={(event) => {
        if (onDragStart === undefined || isHeaderActionButton(event.target)) return
        pointerStart.current = { x: event.clientX, y: event.clientY }
        onDragStart(event)
      }}
      onDoubleClick={(event) => {
        if (onResetPosition === undefined || isHeaderActionButton(event.target)) return
        onResetPosition()
      }}
    >
      <button
        type="button"
        className="dsh-side-chat-heading"
        onClick={(event) => {
          const start = pointerStart.current
          pointerStart.current = null
          // A header drag that starts on the title must not also open the parent view.
          if (start !== null
            && (Math.abs(event.clientX - start.x) > HEADING_CLICK_SLOP
              || Math.abs(event.clientY - start.y) > HEADING_CLICK_SLOP)) return
          onFocusParent()
        }}
      >
        <strong>{messages.title}</strong>
        {parentTitle !== undefined && parentTitle.length > 0 && (
          <span className="dsh-side-chat-heading-parent" title={parentTitle}>{parentTitle}</span>
        )}
      </button>
      <div className="dsh-side-chat-header-actions">
        {onRefresh !== undefined && (
          <button
            type="button"
            className="dsh-side-chat-refresh"
            disabled={refreshDisabled}
            onClick={onRefresh}
          >
            <RefreshIcon />
            <span>{messages.refresh}</span>
          </button>
        )}
        {onAddToConversation !== undefined && (
          <button
            type="button"
            className="dsh-side-chat-add-to-conversation"
            disabled={addToConversationDisabled}
            onClick={onAddToConversation}
          >
            <AddToConversationIcon />
            <span>{messages.addToConversation}</span>
          </button>
        )}
        <button
          type="button"
          className="dsh-side-chat-close"
          aria-label={messages.close}
          disabled={phase === 'closing'}
          onClick={onClose}
        >×</button>
      </div>
    </header>
  )
}
