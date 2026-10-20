import type { Context } from '@deepseek-ai/cordis';
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { UiConversation } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { ParentConversationService, SelectionReferenceSource } from '../parent-composer/add-to-conversation.js';
/**
 * Structural mirror of the DSH 0.2.x client command surface
 * (`@deepseek-ai/dsh-client-ui-commands`, service `ctx.commandUi`). The
 * package does not ship type declarations to plugins, so the browser half
 * against the installed runtime with a local structural contract instead of
 * importing its private types.
 */
export interface ClientCommandSession {
    readonly sessionId: string;
}
export interface SideChatCommandContribution {
    readonly name: string;
    label?(): string;
    description?(): string;
    available(session: ClientCommandSession): boolean;
    readonly ui: {
        readonly kind: 'action';
        run(session: ClientCommandSession): void;
    };
}
export interface SideChatCommandUi {
    register(contribution: SideChatCommandContribution): () => void;
}
/** Browser-only Cordis view for a package that also compiles the Host half. */
export type DshClientContext = Omit<Context, 'commandUi' | 'conversation' | 'inputTriggers' | 'modelDirectories' | 'remote' | 'sessions' | 'slots' | 'uiConversation' | 'uiWorkspace'> & {
    readonly commandUi: SideChatCommandUi;
    readonly conversation: ParentConversationService;
    readonly inputTriggers: {
        registerSource(source: SelectionReferenceSource): () => void;
    };
    readonly modelDirectories: ModelDirectoryResolver;
    readonly remote: ClientRemote;
    readonly sessions: ISessions;
    readonly slots: SlotRegistry;
    readonly uiWorkspace: UiWorkspace;
    readonly uiConversation: Pick<UiConversation, 'binding'>;
};
