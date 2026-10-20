# Compatibility audit — `@ahggg/dsh-side-chat@1.0.2` on DSH `0.2.1-rc.2` (Desktop/Web)

Date: 2026-10-19 · Auditor: compat-analyst (task-1) · Mode: static/read-only runtime analysis

## Method & evidence base

- Installed runtime `C:\Users\ahmet\AppData\Local\Programs\DeepSeek Harness\resources\app.asar` (dsh `0.2.1-rc.2`) was parsed read-only with a Node asar-container reader (`analysis/asar-probe*.mjs`); shipped JS bundles and the web shell (`dsh-web-frontend/dist/assets/index-CN7NIWNw.js`) were read directly.
- Live Host contracts came from `cordis_inspect_query` (platform=host, provider=Service). **Client inspect timed out** (no page response), so Client contracts were verified from the published `0.2.1-rc.2` type declarations fetched with `npm pack` into `analysis/npm/extracted/` (17 packages), plus the installed static module table.
- Plugin artifact under audit: `side-chat-pkg/package` (built `lib/` of the published tarball, `ahggg-dsh-side-chat-1.0.2.tgz`).

## Verdict table

| # | Checklist item | Verdict | Key evidence |
|---|---|---|---|
| 1 | Host imports from `dsh-typert-protocol`, `dsh-llm`, `dsh-session` | **OK** | `dsh-llm/lib/index.js` export list has `BlockAssembler`, `createAssistantMessage`, `ReasoningEffortId`; `dsh-session/lib/index.js` export list has `deriveEventMessage`, `foldRequestHeader`, `foldSurface`, `SessionId`; `TypertRemoteService` in `dsh-typert-protocol/lib/index.js` export list; `InvocationDescriptor` is **type-only** in the plugin (`lib/typert.d.ts:1`) and still exported by 0.2.1 (`dsh-typert-protocol/lib/types/types.d.ts:299`) |
| 2 | Host service usage in `lib/host/read-only-chat-service.js` | **OK** | see detailed table below |
| 3 | Client bundle module loader requirements | **OK — no rebuild needed** | `window.__ModuleLoader__.load({id, factory})` unchanged (`dsh-client-modules` README / `bootInjections` queue facade in `lib/index.js`); `react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives` are all in the shell's frozen static table (`SZ()` in `index-CN7NIWNw.js`: `{react:sC,"react/jsx-runtime":uC,…,"@deepseek-ai/dsh-client-ui-primitives":zU,"@deepseek-ai/dsh-client-ui-slots":SI,…}`), so `dsh.client.external` is unnecessary |
| 4 | Injected Client services & method usage | **OK** | all 8 services and every method resolved against 0.2.1 declarations; see detailed table below |
| 5 | Manifest / `dsh.client.inject` / display metadata | **CHANGED (metadata) — already retargeted by Lead** | 0.2.1 enforces `engines.dsh` else `dsh-*` peers (`dsh-app-boot/lib/index.js` `unmetRequirements`/`evaluatePluginCompatibility`); 1.0.2 pinned all dsh peers to `0.2.0-rc.2`, so installs are refused as `incompatible-version` until the manifest is retargeted. `dsh.client.inject` shape itself is valid: `platform/inject/external/immediately` are exactly the 0.2.1 fields, and listing the *static* module `@deepseek-ai/dsh-client-ui-primitives` in `inject` is normal in 0.2.1 (e.g. `dsh-client-ui-jobs`, `dsh-client-ui-schedule`, `dsh-client-ui-subagent`). No `locale`/`icon` fields are required (fallback to name/description) |

## 1–2. Host detail (verdict: OK)

| Plugin usage | 0.2.1-rc.2 contract | Evidence |
|---|---|---|
| `llm.prepareCall(config, signal)` (`read-only-chat-service.js:189,309`) | `prepareCall(config: LlmCallConfig, signal?, configure?)` | `dsh-llm/lib/types/index.d.ts:407`; live Host `llm` Service inspect lists it |
| `prepared.config` spread into `prepared.stream({...})` | `PreparedLlmCall { config; stream(options: GenerateOptions) }` | `dsh-llm/lib/types/index.d.ts:93` |
| `new BlockAssembler()` / `.push` / `.interruptedBlocks()` / `.finish` | class + `interruptedBlocks(): ContentBlock[]`, `get finish()` | `dsh-llm/lib/types/assembler.d.ts:57`; runtime `dsh-llm/lib/index.js` (`get finish()`, `interruptedBlocks()`) |
| `createAssistantMessage({content, source})` | exported factory | `dsh-llm/lib/index.js` export list |
| `new BlockAssembler` chunk handling: `tool-call-delta`, `block-end`, `finish` | `StreamChunk` union unchanged | `dsh-llm/lib/types/index.d.ts` `StreamChunk` |
| `ctx.sessionQuery.observeSession(SessionId, {signal, projectionMode:'none'})` | `observeSession(sessionId, options?: SessionObservationOptions)`; `projectionMode?: 'all'\|'none'`; returns `SessionObservation` (Disposable) | live Host `sessionQuery` Service inspect (full contract) |
| `observation.events`, `observation[Symbol.dispose]()` | `SessionObservation.events` + `Disposable` | same live contract |
| `ctx.sessions.messageProjections` (`:82`) | `get messageProjections(): readonly SessionMessageProjection[]` on `SessionStore` (`ctx.sessions`) | `dsh-session/lib/types/index.d.ts:383`; runtime `dsh-session/lib/index.js` `get messageProjections()` |
| `foldSurface(prefix, sessions.messageProjections)` | `foldSurface(events, projections?)` | `dsh-session/lib/types/surface.d.ts:141` |
| `surface.nodes`, `surface.projectedMessages` | `SurfaceFoldResult { nodes, replacements, projectedMessages }` | runtime `dsh-session/lib/index.js` `function foldSurface` returns exactly these three fields |
| `deriveEventMessage(event, surface.projectedMessages)` | `deriveEventMessage(event, projectedMessages?)` exported | `dsh-session/lib/index.js` export list + function signature |
| `foldRequestHeader(prefix)?.config` | `foldRequestHeader(events, from?)` → canonical `EpochHeader` whose `config` is `LlmCallConfig` | `dsh-session/lib/index.js`; `EpochHeader` in 0.2.1 types |
| `ctx.invocation?.peer`, `peer.id`, `peer.ctx.effect(...)` (`lib/index.js:33-44`) | `RemoteInvocation.peer: PeerScope`; `PeerScope { id: PeerId; ctx: Context; principal; signal; dispose() }` | `dsh-typert-protocol/lib/types/types.d.ts:376-429`; `principalOf(invocation)` reads `invocation.peer.principal` |
| `ctx.effect(() => async () => …, label)` | effect accepts async disposer: `Effect = SyncEffect \| AsyncEffect`; `effect(execute: () => Effect, label?)` | `@deepseek-ai/cordis@4.0.5/lib/types/fiber.d.ts:157-159`, `Effect` def. `:43-49` |
| `static inject = ['llm','sessions','sessionQuery']` | all three services exist | live Host inspect: `llm`, `sessions`, `sessionQuery` all present with hard-dependency `inject` entries |

No host JS patch is required for the read-only chat call path.

## 3. Client bundle (verdict: OK — rebuild NOT required)

- Bundle header: `window.__ModuleLoader__.load({id:`@ahggg/dsh-side-chat`,factory:e=>{…let r=e("react"), i=e("react/jsx-runtime"), a=e("@deepseek-ai/dsh-client-ui-primitives")…` (`lib/client.js:1`).
- 0.2.1 static module table from the installed shell bundle (`dsh-web-frontend/dist/assets/index-CN7NIWNw.js`): `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `zod`, `@tanstack/react-virtual`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit`. Every non-relative `require` in the plugin bundle is in that list, so it needs neither inlined primitives nor `dsh.client.external`.
- Primitive symbols used by the bundle (`a.<Symbol>` scan: `DisclosureRow`, `MarkdownText`, `Toast`, `IconThinkOutlineRegular`, `IconCheckOutlineRegular`, `IconChevronDownOutlineRegular`, `IconChevronRightOutlineRegular`, `IconWarningOutlineRegular`) are all exported by `@deepseek-ai/dsh-client-ui-primitives@0.2.1-rc.2`:
  - `lib/types/index.d.ts:7` (DisclosureRow), `:59` (Toast), `:93` (MarkdownText)
  - `lib/types/icons/index.d.ts:38,46,54,114,146` (icons)
  - (also present in the installed shell bundle's primitives export object, e.g. `IconThinkOutlineRegular:xN, MarkdownText:yw, DisclosureRow:ZD, Toast:iR`)

## 4. Client services (verdict: OK)

| Plugin usage (file:line) | 0.2.1-rc.2 Client contract | Evidence |
|---|---|---|
| `ctx.conversation.input.for(scope)` (`sessions-adapter.js:158`) | `IConversation.input: SessionInputResolver`; `for(actx: Context): SessionInput` | `dsh-client-ui-conversation/lib/types/client/service.d.ts:28`; `contract/input.d.ts:204-206` |
| facade fields `state`, `setDraft`, `notify`, `insertReference` (`sessions-adapter.js:164-168`) | `SessionInput { state: SnapshotStore<InputState>; setDraft(text); notify(level,text); insertReference(ref,span) }` | `contract/input.d.ts:171-201` (insertReference `:168`, setDraft `:173`, notify `:194`, state `:201`) |
| `scope.bail(scope,'slash/input-insert-text',{text,span})` (`sessions-adapter.js:168`) | Event declared `'slash/input-insert-text'(request: InsertTextRequest): true \| undefined`; `InsertTextRequest { text: string; span: TokenSpan; continue?: boolean }` | `contract/input.d.ts:154`, `:82-86` |
| `ctx.uiConversation.binding(sessionId)` (`sessions-adapter.js:135`) | `UiConversation.binding(source: SessionBinding \| SessionId): ConversationBinding` | `.../conversation/assembly.d.ts:61`; service key `uiConversation` in `client/index.d.ts:55` |
| `.activate('chat')`, `.target('chat')` (`:136-137`) | `ConversationBinding.activate(target: string): void`; `target<T>(target): ObservableSnapshot<ConversationViewSnapshotMap[T] \| undefined>` | `assembly.d.ts:27,35`; `'chat'` target registered by ui-chat → `ChatSnapshot` (`.../dsh-client-ui-chat/lib/types/client/contract/snapshot.d.ts:103-107`) |
| Wrapped target snapshot: `source.legacy.turnEnds`, `source.nodes`, `chatNodes.get(key)` (`conversation-store.js:15`; `sessions-adapter.js:49,60`) | `ChatSnapshot.legacy: LegacyConversationSlice { nodes, turnEnds: ReadonlyMap<number,number>, … }`; `ChatSnapshot.nodes: ChatNodeStore { get(key): ChatConversationViewNode \| undefined; values() … }` | `.../dsh-client-ui-chat/lib/types/client/contract/snapshot.d.ts:21-43,84-102` — the 0.2.1 node store is not a plain Map but `.get()` is provided, so the adapter works |
| `ctx.sessions.retain(id,{source:'sideChat'})` (`sessions-adapter.js:117`) | `ISessions.retain(target, options: SessionRetainOptions{source, signal?}): SessionReference` | `dsh-api-session-controller/lib/types/client/contract/sessions.d.ts:52` |
| `ctx.sessions.scope(id)` (`:75,109,154`) | `scope(id): AgentContext \| undefined` | same file `:140` |
| `ctx.sessions.binding(id)?.session` (`:129`) | `binding(id): SessionBinding \| undefined`; `SessionBinding.session: SessionFace` | `.../sessions/service.d.ts:79-84`, `:244`; contract `:159` |
| `ctx.sessions.list.getSnapshot().byId`, `.retainedBy.mainView`, `.displayTitle` (`:25,43,141`) | `ISessions.list: ObservableSnapshot<SessionListState>`; summary has `displayTitle` and `retainedBy: Partial<Record<SessionReferenceSource, number>>`; `mainView` source is declared by ui-session's augmentation | contract `:45`, `:40`; `sessions/service.d.ts:22,32`; `dsh-client-ui-session/lib/types/client/index.d.ts:102` |
| `ctx.modelDirectories.directoryFor(id)` (`:144`) | `directoryFor(sessionId: SessionId): ModelDirectory` | `dsh-client-ui-model-selection/lib/types/client/service.d.ts:25` |
| `ctx.inputTriggers.registerSource(src)` (`apply.js:45-46`) | `registerSource(src: InputTriggerSource): () => void` | `dsh-client-ui-input-trigger/lib/types/client/contract.d.ts:17` |
| `ctx.slots.inject(name, cb)` + `ctx.slots.register({name,id,order}, Comp)` (`apply.js:51-53`; `ParentConversationAnnotations.js:140,167`) | Same API is used verbatim by the shipped 0.2.1 template (`skill templates/decoration/client.js:14-18`); `entries(key): readonly StoredEntry[]`, `StoredEntry { component, options:{key?,id?,order?,priority?}, … }` | `dsh-client-ui-slots/lib/types/index.d.ts:623-644, 793-825` |
| `ctx.remote.$mount(TYPERT_REMOTE)` (`dsh/remote-adapter.js:13`) | `$mount(contribution: TypertRemoteContribution): Promise<TypertDisposer>`; contribution `{ package, descriptors }` — plugin `lib/remote.js:2` matches; descriptors match 0.2.1 `InvocationDescriptor` fields (id/service/namespace/method/implementation/invocation/parameters/cancellation/result/sourceLocation) | `dsh-typert-protocol/lib/types/types.d.ts:299-350, 525`; plugin descriptor factory tail `lib/typert.js` |
| `ctx.get('remote.sideChat')` (`remote-adapter.js:14`) | 0.2.1 gateway **still installs traced `remote.<namespace>` services**: "Contributions install traced `remote.<namespace>` services" and mount groups descriptors by `descriptor.namespace` → `installNamespace` | installed `dsh-api-gateway/lib/client.browser.js` (`ClientRemoteService`, `$mount`/`mountContribution`) |
| `ctx.uiWorkspace.openSession(id)` (`sessions-adapter.js:123`) | `UiWorkspace.openSession(target: SessionTarget): void` | `dsh-client-ui-workspace/lib/types/client/navigation.d.ts:21` |
| Service keys exist | `conversation`/`uiConversation` (`dsh-client-ui-conversation` client/index.d.ts:53,55), `sessions` (`dsh-api-session-controller` client/index.d.ts:29), `remote`, `slots`, `inputTriggers`, `modelDirectories`, `uiWorkspace` all shipped by installed 0.2.1 packages | listed files above |
| `dsh.client.inject` list | all 9 packages exist in 0.2.1 except the two static-table modules `dsh-client-ui-primitives` and (implicitly) `dsh-client-ui-slots`; listing primitives in `inject` is legal (first-party precedent) | installed `@deepseek-ai/*` package scan (`analysis/asar-probe5.mjs` output) |
| Lexical input facade | 0.2.1 `SessionInput` is the replacement of the 0.2.0 one; the plugin only uses the four documented members and the bail action, all present | as above |

## Risk list (prioritized)

**High — none.** Every host call and every client service/method used by the plugin exists with a compatible signature in 0.2.1-rc.2, and the Lead's live installation already shows the host bundle applied without warnings and the client `shell.overlay` occupant active.

**Medium**
1. **Selection/annotation feature shape drift (unverified inner shapes).** The plugin's selection logic reads `ChatNode.location` internals (`selection/conversation-dom.js`, `selection-normalizer.js`: `location.kind`, `location.turn.status`, `location.step.status`) and `node.visibility/kind/anchorSeq`. 0.2.1 keeps all top-level fields (`ChatConversationViewNode` in `dsh-client-ui-chat/.../chat-nodes.d.ts:4-8`) and `ChatNodeStore.get()`, but the inner `ConversationLocation` union was not re-verified. Expected symptom if drifted: the selection action bar never appears or "selection not visible" errors (Side Chat still opens from the composer, just not from selected text); patch later by adapting `selection-normalizer.js`/`conversation-dom.js` to the 0.2.1 `ConversationLocation` (`dsh-client-ui-conversation` client contract).
2. **`retain(id,{source:'sideChat'})` is outside the closed `SessionReferenceSource` type.** Runtime is fine (0.2.1 `retainScope(id, source)` accepts any string and just counts `retainedBy[source]`), but a future `tsc` of the source against 0.2.1 types will error; the minimal source fix is an augmentation of `SessionReferenceSourceMap` or a cast.

**Low**
3. `dsh.client.inject` names the static module `@deepseek-ai/dsh-client-ui-primitives`; 0.2.1 ignores/only orders such entries (first-party precedent), and the live page confirms activation.
4. `ConversationBinding.target('chat')` can be `undefined` before ui-chat's view registers; the plugin's `DshParentConversation` already handles `undefined` with `EMPTY`.
5. Metadata/display: package has no `locale/*.json` `meta.title/description` or icon; 0.2.1 falls back to `name`/`description` + default artwork. Cosmetic only; adding them is optional polish, not a compatibility fix.

**Explicitly not verified:** live Client inspect (`Builtin`/`Service`/`Slots`) timed out because no page response reached the Host inspect bridge; client conclusions are from the shipped shell static table + published 0.2.1-rc.2 declarations. The interaction-time path (create → stream → render → Add to conversation) was not executed here; the Lead's live install covers boot/materialization only.

## Recommendation

**(a) Metadata-only compatibility fix is sufficient.** The Lead's retargeted manifest (dropping the `0.2.0-rc.2` dsh peer pin / adding an `engines.dsh` range that admits `0.2.1-rc.2`) addresses the only blocking incompatibility (0.2.1 `evaluatePluginCompatibility`). No client rebuild is needed — all requires resolve against the 0.2.1 static module table including `@deepseek-ai/dsh-client-ui-primitives`, and no `dsh.client.external` entry is required — and **no host JS edits are required**: every exported symbol and every service method the plugin calls exists in 0.2.1-rc.2 with a compatible signature. Follow-up (not blocking install): exercise selection→Side Chat→Add to conversation once in the UI; if the selection action bar misbehaves, patch only the selection location adapter (risk M1). Optionally augment `SessionReferenceSourceMap` for `'sideChat'` (risk M2) for future type-checking.

## Addendum — `/side` command, latest context, per-session side chats (`1.0.2-dsh0.2.1rc2.6`)

Date: 2026-10-20. This build moves past the metadata-only adaptation: the
runtime now carries the `/side` command, the latest-context host cut, and a
draggable/resizable panel (source overlays in `src-overlays/`, built-file
overlays in `patches/lib/**`). New API surface audited below against the
installed DSH `0.2.1-rc.2` code and published declarations.

| New usage | 0.2.1-rc.2 contract | Evidence | Verdict |
|---|---|---|---|
| `ctx.inject(['commandUi'], …)` + `commandUi.register({name,label,description,available,ui:{kind:'action',run(session)}})` | `CommandUiRuntime` (Service `commandUi`, `@deepseek-ai/dsh-client-ui-commands`): `register(contribution)` / `decorate` / `dismiss`; action = "bare invocation consumes the trigger token and runs one client-side callback. It submits nothing" | installed `dsh-client-ui-commands/lib/client.js` (`CommandUiRuntime`, `invoke` action branch, `matchEnter` contribution branch); npm artifact `@deepseek-ai/dsh-client-ui-commands@0.2.1-rc.2` `lib/types/client/contract.d.ts` (`CommandContribution`, `ActionSpec`); first-party precedents `/file` (`dsh-client-ui-conversation/lib/client.js` `ctx.inject(["commandUi"]…)`) and `/feedback` decoration (`dsh-client-ui-message-feedback/lib/client.js`) | **OK** |
| Lazy dependency: plugin mounts even without the command surface | nested `ctx.inject([...], scope => scope.effect(...))` is the documented DSH pattern; `commandUi` row is active in the default web composition | `plugin_manager list_plugins` shows `include:ui-commands` active; `dsh-web-app` composition rows `ui-input-trigger`/`ui-commands`/`ui-skill` | **OK** |
| `dsh.client.inject` gains `@deepseek-ai/dsh-client-ui-commands` | `inject` is the boot-graph ordering declaration (not Cordis injection); package is an installed core client module with a `./client` export | `@deepseek-ai/dsh-client-modules` README ("ordered so dynamic providers load before their consumers") and `parseDshClient` accepting only `platform/inject/external/immediately` | **OK** (implicit environment assumption, same class as the existing `ui-primitives` entry) |
| `observeSession(...).cursor` as the newest committed seq | `SessionObservation { source, header, events, cursor }`; live path snapshots `session.seq`, materializes events up to it, sets `cursor = seq === 0 ? -1 : SessionSeq(seq - 1)`; one-shot immutable cut | installed `dsh-session-query/lib/index.js` (live read branch); published `@deepseek-ai/dsh-session-query@0.2.1-rc.2` `lib/types/observation.d.ts` | **OK** (structural field; re-audit on upgrade) |
| Folding a prefix that may end mid-turn | `foldSurface` requires contiguous seqs, not `turn/end`; `deriveEventMessage` maps surface events only and returns null for turn/step bounds/request headers/tool calls | installed `dsh-session/lib/types/surface.js` (`foldSurface`, `deriveEventMessage`); event shapes in `analysis/npm/extracted/deepseek-ai-dsh-session-0.2.1-rc.2/.../types.d.ts` | **OK** |
| `/side` context includes "work done after the last user message" | committed `user/message`, `tool/call`, `tool/result`, and settled `assistant/message` events are in the log during/after a turn; only the actively streaming assistant text (`agent/assistant-stream` frames) is not | installed `dsh-agent-loop/lib/index.js` (turn/step/user/tool append points; `assistant/message` written at stream settlement) | **OK with documented limit** |
| No Typert/wire change for latest context | `atSeq` stays `z.number().int().nonnegative()`; `LATEST_AT_SEQ = Number.MAX_SAFE_INTEGER` passes the codec and is special-cased on the Host before real event matching (real seqs can never reach it) | `src/shared/side-chat-wire.ts`, host `latestCommittedBoundary`; built `lib/typert.js` remains byte-identical to published 1.0.2 (hash check) | **OK** |
| Client-owned panel geometry | standard React pointer events on the panel header/handles + `localStorage` key `dsh-side-chat.panel.geometry`; no DSH service or DOM anchor involved | `src/client/panel/SideChatPanel.tsx`; shipped the same way as upstream's panel CSS | **OK** (no DSH API risk) |

New risks:

1. **Host `/side` name collision.** A future DSH release that ships a host
   command named `side` makes `CommandUiRuntime.candidates` throw on collision
   (loud, not a silent shadow). Rename the contribution or switch to a
   decoration if that happens.
2. **Command contribution type is a local structural mirror.** DSH ships no
   plugin-facing `.d.ts` for `dsh-client-ui-commands` in the Desktop archive
   (only `lib/client.js`/`lib/index.js`); `src-overlays/src/client/dsh/context.ts`
   mirrors `CommandContribution`/`ActionSpec` from the published npm artifact.
   Re-verify those two shapes on every DSH upgrade.
3. **`observation.cursor` is relied on as "newest seq".** It is exposed by the
   published observation type, but the semantic (one-shot cut, last committed
   seq) is inferred from the implementation; re-check the live path on upgrade.
4. **Interactive verification limits.** `/side` opening and latest-context chat
   were confirmed by the user in the live Desktop window. Browser automation
   could not open the authenticated GUI (`dsh web authentication required` in a
   fresh Chrome), so panel geometry was verified with jsdom tests plus code
   review; the first live retest exposed a missing pointer delta in move mode,
   fixed in `1.0.2-dsh0.2.1rc2.2`. The follow-up user request (drag the whole
   header bar instead of the grip, and resize from the top/left edges and the
   top-left corner) is implemented in `1.0.2-dsh0.2.1rc2.3`; the shipped-bundle
   probe `analysis/verify-shipped-bundle.mjs` now passes 18/18 checks for header
   drag, title click-vs-drag, all four edges, both corners, persistence, reset,
   "no visible resize marks in bundled CSS", the header Refresh button
   (render, icon/label, position left of Add to conversation, click callback),
   and the per-session manager/geometry markers in the shipped bundle
   (`1.0.2-dsh0.2.1rc2.4` removed the decorative edge/corner indicators;
   resize zones remain functional and invisible, with cursor feedback only).
5. **Refresh uses only already-audited APIs.** `1.0.2-dsh0.2.1rc2.5` adds no
   DSH API: Refresh composes the existing `close` RPC + `openDraft` (a new host
   `create` then captures the newest committed context, exactly like `/side`).
   Regression coverage lives in the scratch vitest suite
   `test/client/refresh.spec.tsx`.
6. **Per-conversation side chats use only already-audited APIs.**
   `1.0.2-dsh0.2.1rc2.6` keeps one `SideChatController` per parent session in
   `SideChatManager` and renders the active session's panel from
   `SideChatSessionsOverlay`; it subscribes to the already-used
   `sessions.list` snapshot (`retainedBy.mainView`) and the existing
   `SideChatController` API. No DSH type/API changed. The only host change is a
   plugin-local constant: the per-client discussion cap moved from 2 to 8
   (`MAX_DISCUSSIONS_PER_OWNER`; total 16 and the 30-minute idle sweep are
   unchanged), so several conversations can keep a host discussion open at
   once. Geometry now uses one `localStorage` key per conversation
   (`dsh-side-chat.panel.geometry:<sessionId>`). Regression coverage lives in
   `test/client/multi-session.spec.tsx` (manager isolation, hidden panels
   surviving session switches, per-session geometry); full scratch suite:
   140 tests passed at the time of writing.
7. **Per-session memory / expiry trade-off.** Hidden controllers stay alive in
   the browser while the app runs; their host discussions expire after 30 idle
   minutes, in which case the next send surfaces `side_chat_not_found` and
   **Refresh** starts a fresh discussion. The 8-per-client cap means opening
   side chats in more than 8 conversations without closing any will make the
   next `create` fail with the existing `side_chat_already_open` message (close
   or refresh an old one).

## Reproduction artifacts

- `analysis/asar-probe.mjs` … `analysis/probe7.mjs` — read-only asar/container and static-table probes
- `analysis/types-check.mjs`, `analysis/types-detail2.mjs`, `analysis/final-checks.mjs` — declaration cross-checks
- `analysis/npm/extracted/` — published `@deepseek-ai/*@0.2.1-rc.2` declarations used above

## Addendum — authoritative session identity + host context assertions (rc2.7)

Added while fixing the reported cross-session context bug. The Host read path
was audited and found session-exact; the weak point was client active-session
identity. New/confirmed DSH touchpoints:

| Touchpoint | Evidence / verdict |
| --- | --- |
| `conversation.session.header.actions` session-scope list slot (main-only) | Live client `Slots` inspect confirmed `{kind:"list", scope:"session"}`, registration options `{id (required), order?, label?}`, standard props include `sessionId: SessionId`. Declared/rendered by the main `ConversationHeader`; the subagent right-sidebar tree mounts `conversation.content` instead, so this slot does not duplicate for a child session. Used for the invisible `SideChatSessionAnchor`. |
| Root-ctx `slots.inject(key, () => slots.register(...))` into a session-scope slot | Same first-party pattern as `dsh-client-ui-message-feedback` (`conversation.input.overlay`, `inject: (sessionId) => …`), `dsh-client-ui-commands`, `dsh-client-ui-input-trigger`; verified in installed bundles. The anchor registers from `apply.ts` and receives `sessionId` as a standard prop (plus the injected manager). |
| `retainedBy.mainView` as identity | **Downgraded.** It is a derived client-local ownership projection; `Object.entries(byId).find(...)` is order-dependent, non-sticky during `replaceMain` (new session retained before old released), and cannot express "no conversation". DSH's own sticky projection is private (`uiSession.publishMain`). Plugin now uses the slot-provided session identity; the scan remains a first-frame/blank-session fallback only. |
| `SessionObservation.header.id` / `.inheritedEventCount` | Present in published `@deepseek-ai/dsh-session-query@0.2.1-rc.2` types and returned by both live and cold observations; the Host now asserts `header.id === request.parentSessionId` before folding and records `inheritedEvents` provenance. The observation lease is released via `Symbol.dispose` in `finally` on every path. |
| `ctx.sessions.list.getSnapshot().byId` | Used only to prune controllers for vanished sessions (`SideChatManager.reconcile`); standard list snapshot, no hidden writes. |
| `uiSession.adapter.current` (sticky main binding) | Considered as an alternative identity source; not used because it is renderer-facing and cannot express "conversation visible" (blank/loading panels). The main-only session slot was chosen instead. |

No Typert/wire change was made; `lib/typert.js` remains byte-identical to
published 1.0.2. Upgrade risk to re-check first: the `conversation.session.header.actions`
slot (if DSH relocates/removes it, the anchor stops mounting and the legacy scan
fallback takes over), and `SessionObservation.header`/`inheritedEventCount`
field names.

