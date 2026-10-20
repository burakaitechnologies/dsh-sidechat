import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import {
  completedContextBoundary,
  latestCommittedBoundary,
  ReadOnlySideChatService,
} from '../../src/host/read-only-chat-service.js'
import { LATEST_AT_SEQ } from '../../src/shared/constants.js'
import { SessionId, type SideChatStreamEvent } from '../../src/shared/contracts.js'
import { deferred } from '../fixtures/client-runtime.js'

const MODEL = { provider: 'test', model: 'model' }
const signal = () => new AbortController().signal

function event(seq: number, type: string, data: unknown, surfaceOp?: unknown): SessionEvent {
  return { seq, time: seq, type, data, ...(surfaceOp === undefined ? {} : { surfaceOp }) } as SessionEvent
}

/** Parent log: one completed turn, then a newer committed user message (seq 5). */
function parentEvents(): SessionEvent[] {
  return [
    event(0, 'request/header', { header: { config: MODEL }, reason: 'initial' }),
    event(1, 'user/message', createUserMessage({ content: [{ type: 'text', text: 'Parent question' }], source: { kind: 'user' } }), 'append'),
    event(2, 'turn/start', { turn: 1 }),
    event(3, 'assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({
      source: MODEL, content: [{ type: 'reasoning', text: 'Private reasoning' }, { type: 'text', text: 'Parent answer' }],
    }) }, 'append'),
    event(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    event(5, 'user/message', createUserMessage({ content: [{ type: 'text', text: 'Later parent question' }], source: { kind: 'user' } }), 'append'),
  ]
}

const services = new Set<ReadOnlySideChatService>()
afterEach(async () => {
  await Promise.all([...services].map(service => service.dispose()))
  services.clear()
})

function fixture(options: { events?: SessionEvent[]; cursor?: number; headerId?: string } = {}) {
  const events = options.events ?? parentEvents()
  const cursor = options.cursor ?? events.at(-1)?.seq ?? -1
  const release = vi.fn()
  const observe = vi.fn(async (_id: unknown, _options: { signal: AbortSignal; projectionMode: 'none' }) => ({
    events, cursor, header: { id: options.headerId ?? 'parent-1' }, inheritedEventCount: 0,
    [Symbol.dispose]: release,
  }))
  let provider: (options: GenerateOptions) => AsyncIterable<StreamChunk> = async function* () {
    yield { type: 'text-delta', index: 0, text: 'Side answer' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
  const stream = vi.fn((streamOptions: GenerateOptions) => provider(streamOptions))
  const prepare = vi.fn(async (config: object) => ({ config, stream }))
  const service = new ReadOnlySideChatService({
    sessions: { messageProjections: [] },
    sessionQuery: { observeSession: observe },
    llm: { prepareCall: prepare },
  } as unknown as Context)
  services.add(service)
  const create = async (request: Record<string, unknown> = {}, owner = 'browser') => service.create({
    parentSessionId: SessionId('parent-1'),
    atSeq: LATEST_AT_SEQ,
    modelSelection: MODEL,
    ...request,
  } as Parameters<ReadOnlySideChatService['create']>[0], owner, signal())
  return {
    service, events, cursor, release, observe, prepare, stream, create,
    setProvider: (next: typeof provider) => { provider = next },
  }
}

async function collect(stream: AsyncIterable<SideChatStreamEvent>): Promise<SideChatStreamEvent[]> {
  const result: SideChatStreamEvent[] = []
  for await (const item of stream) result.push(item)
  return result
}

describe('host latest-committed context cut (LATEST_AT_SEQ)', () => {
  it('latestCommittedBoundary treats the observation cursor as an inclusive cut', () => {
    expect(latestCommittedBoundary({ cursor: -1 })).toBeUndefined()
    expect(latestCommittedBoundary({ cursor: 0 })).toBe(0)
    expect(latestCommittedBoundary({ cursor: 5 })).toBe(5)
  })

  it('captures the newest committed parent event instead of the last completed turn', async () => {
    const f = fixture()
    const chat = await f.create()
    if (!chat.ok) throw new Error(chat.error.message)
    expect(chat.value.boundarySeq).toBe(5)
    expect(chat.value.parentSessionId).toBe('parent-1')
    expect(f.release).toHaveBeenCalledOnce()

    const output = await collect(f.service.stream({ chatId: chat.value.chatId, requestId: 'one', text: 'What was the last thing I said?' }, 'browser', signal()))
    expect(output.at(-1)).toEqual({ type: 'finished', status: 'complete' })
    const request = f.stream.mock.calls[0]![0]
    const context = JSON.stringify(request.messages)
    expect(context).toContain('Later parent question')
    expect(context).toContain('Parent answer')
    expect(context).not.toContain('Private reasoning')
    // The frozen context carries the requested parent identity so a mismatch
    // can never be explained away later.
    const referenceText = (request.messages[0] as { content: Array<{ text: string }> }).content[0]!.text
    const embedded = JSON.parse(referenceText.slice(referenceText.indexOf('\n') + 1)) as {
      parentSessionId: string
      inheritedEvents: number
      parentConversation: Array<{ role: string; content: string }>
    }
    expect(embedded.parentSessionId).toBe('parent-1')
    expect(embedded.inheritedEvents).toBe(0)
    expect(embedded.parentConversation.map(entry => entry.content)).toContain('Later parent question')
    expect(request.tools).toEqual([])
    expect(request.sessionId).toBeUndefined()
  })

  it('keeps completed-turn semantics for selection requests', async () => {
    const f = fixture()
    const chat = await f.create({ atSeq: 3, selectedText: 'Parent answer' })
    if (!chat.ok) throw new Error(chat.error.message)
    expect(chat.value.boundarySeq).toBe(4)

    await collect(f.service.stream({ chatId: chat.value.chatId, requestId: 'one', text: 'Why?' }, 'browser', signal()))
    const context = JSON.stringify(f.stream.mock.calls[0]![0].messages)
    expect(context).toContain('Parent question')
    expect(context).toContain('Parent answer')
    expect(context).not.toContain('Later parent question')
  })

  it('does not leak the newest parent text into a selection discussion opened earlier', async () => {
    const f = fixture()
    const chat = await f.create({ atSeq: 3 })
    if (!chat.ok) throw new Error(chat.error.message)
    f.events.push(event(6, 'user/message', createUserMessage({
      content: [{ type: 'text', text: 'Committed after the selection' }], source: { kind: 'user' },
    }), 'append'))
    await collect(f.service.stream({ chatId: chat.value.chatId, requestId: 'one', text: 'Why?' }, 'browser', signal()))
    expect(JSON.stringify(f.stream.mock.calls[0]![0].messages)).not.toContain('Committed after the selection')
  })

  it('returns context_unavailable and releases the read lease for an empty parent log', async () => {
    const f = fixture({ events: [], cursor: -1 })
    const result = await f.create()
    expect(result).toMatchObject({ ok: false, error: { code: 'context_unavailable' } })
    expect(f.release).toHaveBeenCalledOnce()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('accepts the initial event as the newest committed cut when the log has no messages yet', async () => {
    const f = fixture({ events: [event(0, 'request/header', { header: { config: MODEL }, reason: 'initial' })], cursor: 0 })
    const result = await f.create()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.boundarySeq).toBe(0)
  })

  it('refuses a context whose observed session identity does not match the request', async () => {
    const f = fixture({ headerId: 'some-other-session' })
    const result = await f.create()
    expect(result).toMatchObject({ ok: false, error: { code: 'context_unavailable' } })
    expect(result.ok ? '' : result.error.message).toContain('changed before its context could be read')
    expect(f.release).toHaveBeenCalledOnce()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('refuses a non-contiguous parent log before folding it', async () => {
    const events = parentEvents().filter(event => event.seq !== 2)
    const f = fixture({ events })
    const result = await f.create()
    expect(result).toMatchObject({ ok: false, error: { code: 'context_unavailable' } })
    expect(result.ok ? '' : result.error.message).toContain('not contiguous')
    expect(f.release).toHaveBeenCalledOnce()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('maps a model preparation failure to side_chat_model_failed and releases the lease', async () => {
    const f = fixture()
    f.prepare.mockRejectedValueOnce(new Error('Unsupported model'))
    const result = await f.create()
    expect(result).toMatchObject({
      ok: false, error: { code: 'side_chat_model_failed', recoverable: true },
    })
    expect(result.ok ? '' : result.error.message).toContain('Could not prepare the model')
    expect(f.release).toHaveBeenCalledOnce()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('refuses a seventeenth discussion across owners (16 total cap)', async () => {
    const f = fixture()
    for (let index = 0; index < 8; index += 1) expect((await f.create({}, 'browser')).ok).toBe(true)
    for (let index = 0; index < 8; index += 1) expect((await f.create({}, 'tablet')).ok).toBe(true)
    const seventeenth = await f.create({}, 'third-client')
    expect(seventeenth).toMatchObject({ ok: false, error: { code: 'side_chat_already_open' } })
  })

  it('recycles the oldest idle discussion when one client reaches the cap', async () => {
    const f = fixture()
    const chatIds: string[] = []
    for (let index = 0; index < 8; index += 1) {
      const result = await f.create()
      if (!result.ok) throw new Error(result.error.message)
      chatIds.push(result.value.chatId)
    }
    const oldest = chatIds[0]!
    const newest = chatIds.at(-1)!

    const ninth = await f.create()
    expect(ninth.ok).toBe(true)
    const remaining = await collect(f.service.stream({ chatId: oldest, requestId: 'old', text: 'Still there?' }, 'browser', signal()))
    expect(remaining[0]).toMatchObject({ type: 'error', error: { code: 'side_chat_not_found' } })
    const stillOwned = await collect(f.service.stream({ chatId: newest, requestId: 'new', text: 'Still there?' }, 'browser', signal()))
    expect(stillOwned.at(-1)).toEqual({ type: 'finished', status: 'complete' })
  })

  it('refuses another discussion when every slot for the client is actively streaming', async () => {
    const f = fixture()
    const chats: Array<{ chatId: string }> = []
    for (let index = 0; index < 8; index += 1) {
      const result = await f.create()
      if (!result.ok) throw new Error(result.error.message)
      chats.push(result.value)
    }
    const started = deferred<void>()
    f.setProvider(async function* (request) {
      yield { type: 'text-delta', index: 0, text: 'Partial' }
      started.resolve()
      await new Promise<void>(resolve => {
        request.signal?.addEventListener('abort', () => { resolve() }, { once: true })
      })
      request.signal?.throwIfAborted()
    })
    const outputs = chats.map(chat =>
      collect(f.service.stream({ chatId: chat.chatId, requestId: 'active', text: 'Question' }, 'browser', signal())))
    await started.promise
    // All eight discussions now hold an active turn, so none is eligible for
    // idle eviction and the ninth create must be refused.
    const ninth = await f.create()
    expect(ninth).toMatchObject({ ok: false, error: { code: 'side_chat_already_open' } })
    await Promise.all(chats.map(chat => f.service.cancel({ chatId: chat.chatId }, 'browser')))
    await Promise.all(outputs)
  })

  it('still accepts a plain completed-turn selection without the sentinel', async () => {
    const f = fixture()
    expect(completedContextBoundary(f.events, 3)).toBe(4)
    expect(completedContextBoundary(f.events, LATEST_AT_SEQ)).toBeUndefined()
    expect(latestCommittedBoundary({ cursor: 5 })).toBe(5)
  })
})
