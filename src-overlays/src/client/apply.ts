import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import sideChatCss from './panel/side-chat.css'
import { selectionReferenceSource } from './parent-composer/add-to-conversation.js'
import { mountParentConversationAnnotations } from './parent-composer/ParentConversationAnnotations.js'
import { sideChatConversationReferenceSource } from './parent-composer/referenced-conversation.js'
import { SideChatManager } from './side-chat-manager.js'
import { mountSideChatRemote } from './dsh/remote-adapter.js'
import { SideChatSessionAnchor } from './dsh/SideChatSessionAnchor.js'
import { SideChatSessionsOverlay } from './dsh/SideChatSessionsOverlay.js'
import { runSideChatCommand } from './dsh/side-chat-command.js'
import { DshSideChatSessions } from './dsh/sessions-adapter.js'
import type {
  ClientCommandSession, DshClientContext, SideChatCommandContribution, SideChatCommandUi,
} from './dsh/context.js'

export const name = 'side-chat-client'
export const inject = ['conversation', 'inputTriggers', 'modelDirectories', 'remote', 'sessions', 'slots', 'uiConversation', 'uiWorkspace']

/** Local typing for the deferred `ctx.inject` that owns the `/side` command. */
interface ClientCommandScope {
  readonly commandUi: SideChatCommandUi
  effect(factory: () => () => void, label?: string): unknown
}
interface ClientCommandInjection {
  inject(services: readonly string[], callback: (scope: ClientCommandScope) => void): unknown
}

function sideChatLocale(): 'en' | 'zh-CN' {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export async function apply(ctx: Context): Promise<void> {
  const cleanups: Array<() => void | Promise<void>> = []
  let disposed = false
  let cleanupOperation: Promise<void> | undefined
  const cleanup = (): Promise<void> => {
    disposed = true
    cleanupOperation ??= (async () => {
      for (const dispose of cleanups.splice(0).reverse()) {
        try { await dispose() } catch (error) { console.warn('[dsh-side-chat] Cleanup failed', error) }
      }
    })()
    return cleanupOperation
  }
  ctx.effect(() => cleanup, 'dsh-side-chat.clientLifecycle')
  try {
    const stylesheet = document.createElement('style')
    stylesheet.textContent = sideChatCss
    stylesheet.dataset.plugin = 'dsh-side-chat'
    stylesheet.dataset['dshSideChat'] = 'styles'
    document.head.append(stylesheet)
    cleanups.push(() => { stylesheet.remove() })

    const clientCtx = ctx as unknown as DshClientContext
    const mounted = await mountSideChatRemote(clientCtx)
    if (disposed) { await mounted.dispose(); return }
    cleanups.push(mounted.dispose)
    cleanups.push(clientCtx.inputTriggers.registerSource(selectionReferenceSource))
    cleanups.push(clientCtx.inputTriggers.registerSource(sideChatConversationReferenceSource))
    const sessions = new DshSideChatSessions(clientCtx)
    cleanups.push(mountParentConversationAnnotations(clientCtx,
      sessionId => { sessions.removeConversationAnnotations(sessionId) }))
    const manager = new SideChatManager(mounted.remote, sessions)
    cleanups.push(() => manager.dispose())

    // A `/side` command contribution is client-owned: the DSH command surface
    // consumes the typed token and runs this action without sending a message
    // to the parent conversation. It is registered lazily so this plugin still
    // mounts on a client composition without the commands plugin.
    const commandContribution: SideChatCommandContribution = {
      name: 'side',
      label: () => sideChatLocale() === 'zh-CN' ? '侧边对话' : 'Side chat',
      description: () => sideChatLocale() === 'zh-CN'
        ? '基于当前对话的最新内容打开侧边追问'
        : 'Ask about this conversation in a side chat with its latest context',
      available: (_session: ClientCommandSession) => true,
      ui: {
        kind: 'action',
        run: (session: ClientCommandSession) => {
          runSideChatCommand(manager, sessions, session)
        },
      },
    }
    ;(clientCtx as unknown as ClientCommandInjection).inject(['commandUi'], scope => {
      scope.effect(() => {
        try {
          return scope.commandUi.register(commandContribution)
        } catch (error) {
          // Never let a name collision (future DSH/plugin /side) break the rest
          // of the plugin; selection actions and the panel keep working.
          console.warn('[dsh-side-chat] /side command registration failed', error)
          return () => {}
        }
      }, 'dsh-side-chat: /side command')
    })

    // Authoritative active-conversation probe: DSH mounts exactly this
    // main-only session-scope entry for the conversation in the main view, so
    // mount/unmount reports are the truth during session switches (no
    // retention guessing, and no duplicate from the subagent side chat).
    cleanups.push(clientCtx.slots.inject('conversation.session.header.actions', () => clientCtx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'dsh-side-chat-active-session',
      order: 100,
      inject: () => ({ manager }),
    }, SideChatSessionAnchor)))

    cleanups.push(clientCtx.slots.inject('shell.overlay', () => clientCtx.slots.register({
      name: 'shell.overlay', id: 'dsh-side-chat', order: 90,
    }, () => createElement(SideChatSessionsOverlay, { manager, sessions }))))
  } catch (error) {
    await cleanup()
    throw error
  }
}
