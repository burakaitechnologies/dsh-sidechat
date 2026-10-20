import type { Context } from '@deepseek-ai/cordis';
import { type SessionEvent } from '@deepseek-ai/dsh-session';
import { type ChatRequest, type CreateSideChatRequest, type CreateSideChatValue, type SelectSideChatModelRequest, type SelectSideChatModelValue, type SendSideChatRequest, type SideChatResult, type SideChatStreamEvent } from '../shared/contracts.js';
export declare function completedContextBoundary(events: readonly SessionEvent[], atSeq: number): number | undefined;
/**
 * Inclusive cut for the newest committed parent event. `observeSession`
 * snapshots the log up to its current sequence (`cursor`, `-1` for an empty
 * log), so folding this prefix includes the latest user message and every
 * committed tool call/result of a running turn. Assistant text that is still
 * streaming is not logged yet; it becomes available once the turn settles.
 */
export declare function latestCommittedBoundary(observation: {
    readonly cursor: number;
}): number | undefined;
/** Ephemeral text discussions. This class never creates, appends, forks, or archives a Session. */
export declare class ReadOnlySideChatService {
    private readonly ctx;
    private readonly chats;
    private readonly lifetime;
    private readonly pendingCreates;
    private creating;
    private disposed;
    private readonly sweep;
    constructor(ctx: Context);
    create(request: CreateSideChatRequest, owner: string, signal: AbortSignal): Promise<SideChatResult<CreateSideChatValue>>;
    private createDiscussion;
    /** Chats plus in-flight creates attributable to one client, for cap checks. */
    private ownerDiscussionCount;
    /** Recycle the least-recently-used idle discussion of one client. */
    private evictOldestIdleDiscussion;
    selectModel(request: SelectSideChatModelRequest, owner: string, signal: AbortSignal): Promise<SideChatResult<SelectSideChatModelValue>>;
    stream(request: SendSideChatRequest, owner: string, signal: AbortSignal): AsyncGenerator<SideChatStreamEvent>;
    cancel(request: ChatRequest, owner: string): Promise<SideChatResult<{
        cancelled: true;
    }>>;
    close(request: ChatRequest, owner: string): Promise<SideChatResult<{
        closed: true;
    }>>;
    closeOwner(owner: string): void;
    dispose(): Promise<void>;
    private owned;
    private missing;
    private resolveModel;
}
