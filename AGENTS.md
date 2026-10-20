# AGENTS.md — Side Chat plugin for DeepSeek Harness

This folder is a **self-contained plugin project**, not a general-purpose coding
workspace. Read this file before changing anything here. Start with
`README.md` for the human overview and `analysis/compat-report.md` for the DSH
API audit.

## What this project is

- `@ahggg/dsh-side-chat` — a Codex-style **Side Chat** plugin for DeepSeek
  Harness: open a focused read-only side discussion in a floating panel while
  the main chat stays untouched.
- Upstream: <https://github.com/AHGGG/dsh-side-chat> (MIT). Upstream release
  `1.0.2` targets DSH `0.2.0-rc.2`; this copy is re-targeted to the installed
  **DSH `0.2.1-rc.2`** Desktop runtime.
- Runtime code under `dsh-side-chat/lib/**` is the published 1.0.2 runtime plus
  local feature overlays from `patches/lib/**` built from `src-overlays/`
  (see below). Every untouched runtime file is byte-identical to published
  1.0.2; `dsh-side-chat/ADAPTED.md` lists the differences.
- Local additions over upstream 1.0.2: the **`/side` client command** (opens
  the panel with the newest committed conversation context), the latest-context
  host cut (`LATEST_AT_SEQ` sentinel), a **draggable/resizable panel** with
  remembered geometry, a header **Refresh** action, and **per-conversation side
  chats** (each main session keeps its own transcript, host discussion, and
  panel geometry while switching).
- The plugin is **already installed and enabled** in the DSH `desktop` profile.
  Nothing has to be installed for reading, auditing, documenting, or testing
  the currently shipped build.

What the feature does, in one paragraph: selecting text in a completed message
offers "Add to chat", "More details" and "Ask in side chat"; typing `/side`
(or picking **Side chat** from the `/` menu) opens the same panel without
needing a selection. The panel receives a frozen, read-only text snapshot of
the parent conversation — up to the selected completed turn for selection
paths, or up to the newest committed event for `/side` — and streams direct
model replies. It does **not** create a DSH Session, run an agent, use tools,
or touch files. The side discussion lives in Host memory only and is discarded
when the panel closes unless the user adds it to the main composer.

## Workspace rules

1. This project folder contains only this plugin's source, packaging, tooling,
   and audit material. Keep unrelated experiments, projects, and scratch files
   out of it.
2. `upstream/` is a read-only vendor snapshot (published tarballs, extracted
   package, GitHub source). Never edit it.
3. `dsh-side-chat/` is **generated build output**. `tools/adapt-package.mjs`
   recreates it from `upstream/package` on every build, so direct edits there
   are not durable. Put durable built-file changes in `patches/` and durable
   source changes in `src-overlays/`.
4. The folder path is load-bearing: the DSH profile depends on the current
   `dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.9.tgz` inside this folder. If
   the folder is renamed or relocated, reinstall from the new path.
5. Preserve the upstream MIT `LICENSE` and attribution. New code added here is
   a derivative of the MIT-licensed upstream project.
6. Do not add build caches, `node_modules/` to `dsh-side-chat/`, or a second
   package manager project at this root. The only nested Node project is
   `tools/asar-reader/` (its own `node_modules` for `@electron/asar`). Build
   scratch (`.scratch/`) is temporary and must not be left behind.

## Layout

| Path | Contents |
| --- | --- |
| `AGENTS.md` | This orientation and working-rules file for agent sessions. |
| `README.md` | Human-facing overview, layout, usage, rebuild and upgrade notes. |
| `dsh-side-chat/` | Generated adapted package DSH installs: `package.json` (re-targeted), `lib/` runtime, `cordis.patch.yml`, `locale/`, `icon.svg`, `ADAPTED.md`. |
| `dist/` | Packed tarball of `dsh-side-chat/`; the file the DSH profile references. Only the current version's tarball should remain. |
| `src-overlays/` | Durable source-level changes as full replacements under `upstream/source/src/**`, plus the reproducible build steps (`src-overlays/README.md`). Building them regenerates `patches/lib/**`. |
| `patches/` | Durable built-file overlays applied last by the build script (27 files at rc2.9). `patches/README.md` explains the convention. |
| `upstream/` | Untouched upstream artifacts: npm tarball `1.0.2`, extracted package, GitHub source tree, source archive. |
| `tests/` | Durable regression suite (`tests/specs/**` + `tests/bundle/verify-shipped-bundle.mjs`) run by `tools/test.mjs`; see `tests/README.md`. |
| `tools/adapt-package.mjs` | The build: copies upstream package, patches metadata/display, overlays `patches/`, repacks `dist/`. |
| `tools/test.mjs` | One-command release gate: stage `upstream/source` + `src-overlays/`, build, run the full vitest suite, probe the built/shipped bundle, compare output with `dsh-side-chat/` (`RESULT: PASS` required). |
| `tools/asar-reader/asar.mjs` | Read-only reader for the installed DSH `app.asar` (list/read/grep/save). Use it because shell/glob/node/grep cannot read inside the Electron archive. |
| `analysis/compat-report.md` | DSH 0.2.1-rc.2 API compatibility audit with evidence and risk notes (including the `/side` feature addendum). |
| `analysis/hardening-plan.md` | Release-hardening audit: workstreams, findings and dispositions, verified invariants, release gates. |
| `analysis/build-validation.md` | Historical evidence that the vendored source rebuilds byte-identically with the locked toolchain (paths refer to the deleted `.scratch` build). |
| `CHANGELOG.md` / `RELEASE.md` | Release history and the publish/verify/rollback checklist. |
| `analysis/npm/extracted/` | Published DSH 0.2.1-rc.2 type declarations used as audit evidence. |
| `analysis/*.mjs`, `analysis/*.ps1` | Historical audit probes; not part of the build. |

## Install state (do not reinvent it)

- DSH runtime: Desktop **0.2.1-rc.2**; profile `desktop` at
  `%USERPROFILE%\.dsh\profiles\desktop`.
- Profile dependency:
  `@ahggg/dsh-side-chat` ->
  `file:C:/Users/ahmet/Desktop/deepseek/plugins/sidechat/dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.9.tgz`
- Bundle selection: `@ahggg/dsh-side-chat` is listed in the profile's
  `dsh.profile.bundles`; the bundle's `cordis.patch.yml` inserts the loader row
  `side-chat` (module `@ahggg/dsh-side-chat`).
- Installed copy: `%USERPROFILE%\.dsh\profiles\desktop\node_modules\@ahggg\dsh-side-chat`
  (a normal installed copy, byte-identical to `dsh-side-chat/` at install time).
- Manage it only through the DSH **Plugin Manager**: the `plugin_manager` tool
  (available in Creator-mode sessions) or the Web **Plugins** page. Never
  hand-edit the profile `package.json`, `cordis.patch.yml`, or `node_modules`,
  and never run pnpm in the profile directory.
- Replacing the installed package requires `remove_bundle` and then
  `install_bundle`; installing over an already-installed package is refused.
- Installed/active version right now: `1.0.2-dsh0.2.1rc2.9`.

## How the plugin works

### Host half (Node)

- `lib/index.js`: `DshSideChatPlugin extends TypertRemoteService`, service key
  `sideChat`, injects `llm`, `sessions`, `sessionQuery`. Methods:
  `create`, `selectModel`, `stream`, `cancel`, `close`; `owner()` keys temporary
  discussions by the invoking remote peer.
- `lib/host/read-only-chat-service.js`: on `create`, calls
  `sessionQuery.observeSession(parentSessionId, {projectionMode:'none'})`,
  picks the context cut, folds the log prefix with
  `foldSurface(prefix, sessions.messageProjections)` + `deriveEventMessage`,
  and stores a JSON text context (no reasoning, image, or attachment bytes).
  The cut is `completedContextBoundary(events, atSeq)` for selection requests
  (first `turn/end` at/after the selected message) and
  `latestCommittedBoundary(observation)` (`observation.cursor`, the newest
  committed seq) when the client sends the `LATEST_AT_SEQ` sentinel — the
  `/side` path. Before folding, `create` asserts the observation header id equals
  the requested session id and that the prefix is contiguous; the frozen context
  also records `parentSessionId` and `inheritedEvents` provenance.
  `stream` calls `llm.prepareCall({provider, model,
  reasoningEffort})` and `prepared.stream({...prepared.config, system,
  tools: [], messages})`; tool call deltas are rejected. Chunks are assembled
  with `BlockAssembler`.
- Lifecycle: in-memory `Map` of discussions, 30-minute idle sweep, max 8
  discussions per client and 16 total (a new discussion recycles the client's
  oldest idle one instead of dead-ending), 2 MB context cap, 64 questions per
  discussion, 256 KB reply cap, 120-second request timeout. Disposal aborts all
  active work.

### Client half (browser)

- `lib/client.js` is a `window.__ModuleLoader__.load({id, factory})` bundle. Its
  only non-React requires are `react`, `react/jsx-runtime`, and
  `@deepseek-ai/dsh-client-ui-primitives` — all three are baseline modules in
  the DSH 0.2.1-rc.2 frozen static module table.
- `lib/client/apply.js` injects the client services `conversation`,
  `inputTriggers`, `modelDirectories`, `remote`, `sessions`, `slots`,
  `uiConversation`, `uiWorkspace`. It registers the selection action bar, the
  side panel overlay under the `shell.overlay` slot (id `dsh-side-chat`,
  order 90), and an invisible **active-session anchor** under the main-only
  session slot `conversation.session.header.actions` (id
  `dsh-side-chat-active-session`, order 100). The anchor reports the
  authoritative main-view session to `SideChatManager.activate/deactivate`;
  the overlay uses that id instead of scanning `retainedBy.mainView` (which is
  order-dependent and can briefly report two sessions during a switch).
- `/side` is a **client-owned command contribution**: `apply.js` registers
  `{name:'side', label/description, available, ui:{kind:'action', run(...)}}`
  through `ctx.inject(['commandUi'], ...)` (DSH `@deepseek-ai/dsh-client-ui-commands`,
  service `ctx.commandUi`). Choosing it consumes the typed token and runs
  `SideChatController.openDraft({parentSessionId: session.sessionId})` without
  submitting a message (logic in `lib/client/dsh/side-chat-command.js`). If that
  conversation already has an open Side Chat, the command focuses the existing
  panel instead; it deliberately emits no composer notice (DSH renders `info`
  notices as permanent inline banners — see Known risks). The injection is lazy
  so the plugin still mounts if the command surface is absent; the package
  declares the supplier in `dsh.client.inject` for boot order. The types are
  mirrored locally in `lib/client/dsh/context.d.ts` because DSH ships no
  plugin-facing commandUi declarations.
- `SideChatController.sendFirst` sends `atSeq = selection?.atSeq ?? LATEST_AT_SEQ`
  (`lib/shared/constants.js`), so selection drafts keep the completed-turn cut
  and selection-less drafts (`/side`) ask the Host for the newest committed
  context.
- `SideChatController.refresh()` renews the discussion: it closes the current
  host chat (aborting a running reply, releasing the retained parent/context)
  and reopens a draft for the same explicit parent session; the next send
  creates a new host discussion with a fresh latest-context cut. It is
  equivalent to close + `/side` but keeps the panel/geometry. The header
  **Refresh** button (icon + label, left of Add to conversation) calls it;
  Refresh never falls back to "whatever session is current" and a double click
  while closing is a no-op. A `side_chat_not_found` stream error auto-renews a
  fresh draft for the same parent with a notice.
- Side chats are **per conversation and bound authoritatively**:
  `SideChatManager` keeps one `SideChatController` per parent session
  (transcript + Host discussion) and tracks the active session from the anchor
  (refcounted, StrictMode safe; retention scan is only a first-frame/blank-session
  fallback). `SideChatSessionsOverlay` renders only the controller of the
  active conversation, passes the authoritative `sessionId` into the overlay,
  refuses to render a controller whose `state.parentSessionId` differs, and
  prunes controllers for sessions that disappear from the catalog. Switching
  conversations hides one panel and shows the other; hidden controllers keep
  their state and any running stream. `/side`, Refresh, and selection actions
  always pass an explicit parent; a Host discussion bound to another
  conversation is refused host-side (observation header id assertion) and
  client-side (create result assertion).
- The panel (`lib/client/panel/SideChatPanel.js` + `SideChatHeader.js`) owns
  plugin UI geometry: dragging anywhere on the header bar moves it (title
  included; only the add-to-conversation and close buttons keep their click
  behavior, and a title drag suppresses the title's parent-view click), every
  edge and the top-left/bottom-right corners resize it (opposite edge anchored,
  resize zones invisible, cursor feedback only), geometry is persisted in
  `localStorage` under `dsh-side-chat.panel.geometry:<sessionId>` (one entry per
  conversation), and double-clicking the
  header clears it. This is client-only state; it never crosses the RPC.
- The bundle binds `window.__ModuleLoader__`-level services through Cordis:
  `ctx.conversation.input.for(scope)` for composer draft/reference edits,
  `ctx.uiConversation.binding(sessionId).activate/target('chat')` for the chat
  snapshot, `ctx.sessions` for retention and titles, `ctx.modelDirectories` for
  the model picker, `ctx.remote.$mount(TYPERT_REMOTE)` for Host RPC.
- Selection handling lives in `lib/client/selection/*` and depends on
  `data-chat-*` DOM anchors and `ChatNode`/`ConversationLocation` internals.

### RPC contract

`lib/typert.js` holds generated Typert descriptors for
`sideChat/create|selectModel|stream|cancel|close` and their strict codecs.
`lib/remote.js` exports the mount contribution (`package`, `descriptors`).
Treat generated typert code as a protocol artifact: change it only alongside
the Host methods and client call sites it describes.

The latest-context feature deliberately adds **no wire change**: `atSeq` stays
a required non-negative integer and `LATEST_AT_SEQ = Number.MAX_SAFE_INTEGER`
is a sentinel the Host special-cases before matching real event sequences
(real seqs can never reach it). `lib/typert.js` is therefore still
byte-identical to published 1.0.2.

## Change workflow

### Metadata, display, or compatibility target

1. Edit `tools/adapt-package.mjs` only (`PKG_VERSION`, `DSH_VERSION`, peer
   retargeting, locales, icon, `ADAPTED.md` text).
2. `node tools/adapt-package.mjs` (from this folder).
3. Reinstall through the Plugin Manager and verify (checklist below).

### Runtime hotfix / behavior fix

1. Put the changed file under `patches/` at the same relative path as in the
   package (for example `patches/lib/client/selection/selection-normalizer.js`
   -> `dsh-side-chat/lib/client/selection/selection-normalizer.js`). The build
   overlays these last; see `patches/README.md`.
2. Bump `PKG_VERSION` (for example `1.0.2-dsh0.2.1rc2.9`) so the installed
   version identifies the build, and describe the change in `ADAPTED.md` (patch
   that file from `patches/` or extend the generated text in the build script).
3. Rebuild, reinstall, verify.
4. Update `analysis/compat-report.md` only when the change is about DSH API
   compatibility.

### Source-level change from the upstream TypeScript

`upstream/source/` is a vendor snapshot; never edit it. Source-level changes
(the current `/side` + latest-context + draggable-panel feature) live in
`src-overlays/` as **full replacements** under the same relative paths. The
exact reproducible procedure is in `src-overlays/README.md`; in short:

1. Edit the overlay file in `src-overlays/src/**`.
2. Copy `upstream/source` to `.scratch/build`, overlay `src-overlays/src/**`,
   install with `npm install --legacy-peer-deps --ignore-scripts`, then
   `npm install --no-save rolldown@1.2.11` (the version locked by upstream's
   `pnpm-lock.yaml`; without the pin 2 bundles change by minifier codegen only).
3. `npm run build`, then copy every output file that differs from
   `upstream/package/lib` into `patches/lib/**`.
4. Bump `PKG_VERSION`, rebuild the adapted package
   (`node tools/adapt-package.mjs`), reinstall, verify.
5. Delete `.scratch/` when done; it holds build-only `node_modules` and is not
   part of the project.

Sanity checks: `node --check dsh-side-chat/lib/client.js` passes; the bundle
still starts with `window.__ModuleLoader__.load({id:`@ahggg/dsh-side-chat`,
factory:...`; `lib/typert.js` must stay byte-identical to published 1.0.2
unless the wire contract intentionally changes. The durable regression suite
lives in `tests/specs/**` (copied into a scratch build by `tools/test.mjs`);
`node tools/test.mjs` is the release gate and runs the vendored upstream tests
plus the local specs and bundle probes. Do not recreate ad-hoc scratch specs in
`.scratch/` — add them under `tests/` and wire them into the harness.

## Build and reinstall

```powershell
# from C:\Users\ahmet\Desktop\deepseek\plugins\sidechat
node tools/test.mjs          # release gate: build + full test suite + bundle probes
node tools/adapt-package.mjs # regenerate dsh-side-chat/ + dist/*.tgz
```

The script recreates `dsh-side-chat/`, applies `patches/`, and writes
`dist/ahggg-dsh-side-chat-<version>.tgz` with `npm pack --ignore-scripts`
(Node/npm must be on PATH; this machine has Node 24 / npm 11). Keep only the
current tarball in `dist/`; the profile references exactly one.

`npm pack` runs with inherited stdio instead of captured output so the script
also works inside DSH's file/process sandbox (piped child stdio is denied
there). Keep that property if you touch the pack step.

Reinstall with the `plugin_manager` tool (DSH Web Plugins page works too):

1. `plugin_manager` action `remove_bundle`, target `@ahggg/dsh-side-chat`
   (`application: "applied"` expected).
2. `plugin_manager` action `install_bundle`, target the absolute path of the
   new `dist/*.tgz` (`application: "applied"`, new version, no warnings).

The Desktop app must be running; the change applies live. No second DSH server
is needed or wanted.

## Verification checklist

After any rebuild/reinstall:

1. **Build** — `node tools/adapt-package.mjs` exits 0; `dist/*.tgz` exists;
   `dsh-side-chat/package.json` shows the expected version and
   `engines.dsh: "0.2.1-rc.2"`.
2. **Install** — install result is `application: "applied"` with empty
   `warnings`; installed copy in the profile `node_modules` is identical to
   `dsh-side-chat/` (hash-compare key files such as `lib/client.js`,
   `lib/host/read-only-chat-service.js`, `package.json`, `cordis.patch.yml`).
3. **Host live** — `cordis_inspect_query`, platform `host`, provider `Config`,
   method `listConfigs`, input `{"name":"@ahggg/dsh-side-chat"}` returns the
   entry `include:side-chat`. `status: "absent"` means "this plugin has no
   Config schema", not "not loaded".
4. **Client live** — `cordis_inspect_query`, platform `client`, provider
   `Slots`, method `listSubTree`, input `{"root":"shell.overlay"}` shows the
   occupant `{registrant:"side-chat-client", id:"dsh-side-chat", order:90}`;
   input `{"root":"conversation.session.header.actions"}` shows the anchor
   `{registrant:"side-chat-client", id:"dsh-side-chat-active-session",
   order:100, active:true}`. The `active` flag of a registration can differ
   while no panel is open; verify the occupants and then smoke-test the UI.
5. **Automated gate** — `node tools/test.mjs` ends with `RESULT: PASS`:
   28 test files / 192 tests (133 vendored upstream + 59 local), 18/18
   built-bundle probe checks, and built output byte-identical to
   `dsh-side-chat/lib/**` (counts at rc2.9; keep them in sync).
6. **Interactive smoke test** (needs the user's authenticated DSH window;
   reload the page after reinstall; agents cannot open the authenticated GUI
   themselves because a fresh browser gets `dsh web authentication required`):
   - **Selection path** — select text inside a completed message, click **Ask in
     side chat**, send a short question, confirm the streaming reply, optionally
     **Add to conversation**, then close with `×`/`Esc`.
   - **`/side` path** — type `/side` in the composer, confirm the menu row and
     that `Enter` opens the panel without sending anything to the main chat,
     ask the panel something only the newest parent turn would know, and
     confirm the answer reflects the latest committed context.
   - **Panel UI** — drag the header bar (title included, not the refresh/add/
     close buttons) to move it; drag the top, right, bottom, and left edges,
     plus the top-left and bottom-right corners, to resize width and height;
     double-click the header to reset, and confirm the geometry survives a page
     reload.
   - **Refresh + per-session lifecycle** — with a side discussion open, click
     **Refresh** (header, left of Add to conversation): the panel should reopen
     as an empty draft for the same conversation, previous messages gone, and a
     new question should answer from the latest parent context. Then open
     another main conversation: no panel (or that conversation's own panel if
     it has one) — the first conversation's chat must not float over it. Open a
     side chat in the second conversation (the panel header shows that
     conversation's title), put it somewhere else, switch back to the first:
     its transcript, panel position, and size must be exactly as left; switch
     again and the second one comes back. Refresh in the second conversation
     and ask "what was the last thing I said?" — the answer must come from the
     second conversation, never the first. The built-bundle jsdom probe
     (`tests/bundle/verify-shipped-bundle.mjs`, 18/18 checks) covers Refresh
     rendering/click, drag/resize, and per-session markers; the durable vitest
     specs in `tests/specs/**` cover the authoritative anchor, controller
     isolation, host identity guard, geometry, and refresh behavior.

If the selection action bar does not appear after a DSH upgrade, start with
`lib/client/selection/*` and compare the `ChatNode` / `ConversationLocation`
shapes against the new DSH declarations; the side panel itself can still be
opened through the same overlay path.

## DSH upgrade procedure

1. Update `DSH_VERSION` in `tools/adapt-package.mjs` to the new runtime version
   and bump `PKG_VERSION`.
2. Rebuild, then re-audit API usage with the new runtime declarations:
   compare against `analysis/compat-report.md` (use
   `node tools/asar-reader/asar.mjs` for the installed `app.asar`, and npm
   `pack` of the new `@deepseek-ai/*` packages for `.d.ts` files).
3. Apply any required source adaptations in `src-overlays/` (and rebuild
   `patches/lib/**` per `src-overlays/README.md`), update `ADAPTED.md` text in
   `tools/adapt-package.mjs`, rebuild, reinstall, and run the full checklist.
   Re-audit `ctx.commandUi` (`dsh-client-ui-commands`) and
   `observeSession().cursor` first: those are the two newest API touchpoints.
4. Do not widen `engines.dsh` to force an install: the declared target is only
   verified for the audited runtime.

## Host/client API touchpoints (upgrade risk map)

- Host imports: `@deepseek-ai/dsh-typert-protocol` (`TypertRemoteService`),
  `@deepseek-ai/dsh-llm` (`BlockAssembler`, `createAssistantMessage`,
  `ReasoningEffortId`), `@deepseek-ai/dsh-session` (`SessionId`, `foldSurface`,
  `foldRequestHeader`, `deriveEventMessage`).
- Host services: `llm.prepareCall`/`PreparedLlmCall.stream`, `sessions`
  (`messageProjections`, `scope`, `binding`, `retain`),
  `sessionQuery.observeSession`, `ctx.invocation.peer`, `ctx.effect`.
- Client module: `window.__ModuleLoader__`, requires `react`,
  `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives` (must stay in
  the frozen static module table; otherwise add `dsh.client.external` or bundle
  it at build time).
- Client services and methods: `conversation.input.for` (+
  `slash/input-insert-text` bail event), `uiConversation.binding().activate()`,
  `.target('chat')`, `sessions.*`, `modelDirectories.directoryFor`,
  `inputTriggers.registerSource`, `slots.inject`/`register`, `remote.$mount`,
  `uiWorkspace.openSession`.
- `/side` adds two risk points: (1) `ctx.inject(['commandUi'], ...)` and the
  client-owned command contribution shape (`name`, `label`, `description`,
  `available`, `ui.kind:'action'`, `run(session)`) — verified against the
  installed `@deepseek-ai/dsh-client-ui-commands@0.2.1-rc.2` code, mirrored as
  local structural types; (2) `observeSession(...).cursor` used as the latest
  committed parent seq (empty log is `-1`). Panel drag/resize uses only standard
  React pointer events and `localStorage`; no DSH API.
- Evidence for all of the above: `analysis/compat-report.md` (per-item verdicts
  with file:line references; see its "/side feature addendum").

## Known risks and limitations

- Product limits (from upstream): read-only text-only discussion, selection
  inside one completed message, 2-minute request timeout, ephemeral in-memory
  discussion, context/reply/question size caps.
- `/side` context ends at the newest **committed** parent event. Assistant text
  that is still streaming is not in the log yet; committed user messages, tool
  calls, and tool results are included. Opening `/side` while the main turn is
  still running therefore may not see the tail of the in-flight reply.
- The `/side` command relies on DSH's client command surface and a
  name-collision-free `side` command; if a future DSH release ships a host
  `/side` command, candidate synthesis fails loudly and the contribution must
  be renamed/decorated. The lazy injection keeps the rest of the plugin working
  without the command surface.
- Panel geometry is browser-local `localStorage`, not a user setting: it does
  not sync between clients and is clamped to the viewport on load/resize.
- Side chats are per browser client and per conversation; the Host keeps at
  most 8 concurrent side discussions per client (16 total) and expires idle
  ones after 30 minutes. Opening another conversation's side chat recycles the
  client's oldest idle discussion rather than failing; a discussion evicted or
  expired while a panel was hidden auto-renews a fresh draft for the same
  parent on the next send (with a notice), and **Refresh** renews it too.
  **Refresh** discards the current discussion (including a running reply's
  partial state) and reopens an empty draft.
- The authoritative active-session signal is the main-only
  `conversation.session.header.actions` slot. If a future DSH release removes or
  moves that slot, the anchor does not mount and the overlay falls back to the
  legacy `retainedBy.mainView` scan; re-audit this first after a DSH upgrade
  (the plugin still works, but the wrong-session protection depends on the
  anchor). Blank sessions start with no header anchor, which is why the scan
  fallback exists.
- The DSH Web GUI requires the authenticated URL printed by `dsh web`; a fresh
  browser shows `dsh web authentication required` (DSH's own guard, not the
  plugin). Agents can only run the jsdom bundle probe; interactive GUI smoke
  tests need the user's authenticated window.
- DSH composer notice semantics: `input.notify('info', …)` renders a **permanent
  inline banner** (no auto-dismiss, cleared only by the composer's own state),
  while `notify('error', …)` becomes a transient toast. Never use the plugin's
  `kind: 'status'` notify for one-off information; use `kind: 'warning'` (toast)
  only for real, actionable failures or transient state changes, and prefer
  in-panel UI/DOM focus for no-ops. This caused the rc2.9
  "This conversation already has an open Side Chat." permanent-text bug.
- `ctx.sessions.retain(id, {source:'sideChat'})` uses a source string outside
  DSH's closed `SessionReferenceSource` type. Runtime accepts it; strict
  type-checking against newer DSH types would need an augmentation or cast.
- The selection path depends on ChatNode / ConversationLocation internals; this
  is the most likely place to need a patch after a DSH upgrade.
- `dsh.client.inject` lists `@deepseek-ai/dsh-client-ui-primitives`; that is
  legal because it is a baseline static module, but it is also an implicit
  dependency on DSH's module table contents. It now also lists
  `@deepseek-ai/dsh-client-ui-commands` for boot order (a shipped core client
  package, but still an implicit environment assumption).

## Quick reference

```powershell
# Release gate: build from src-overlays, full test suite, bundle probes, diff
node tools/test.mjs

# Rebuild adapted package + dist tarball (metadata/patches only)
node tools/adapt-package.mjs

# Source-level rebuild procedure (after editing src-overlays/):
#   see src-overlays/README.md

# Inspect the installed DSH archive (read-only)
node tools/asar-reader/asar.mjs list "dsh/node_modules/@deepseek-ai"
node tools/asar-reader/asar.mjs grep "TypertRemoteService" "dsh/node_modules/@deepseek-ai/dsh-typert-protocol" ".js"

# Show the installed profile dependency (this machine)
node -e "console.log(require('C:/Users/ahmet/.dsh/profiles/desktop/package.json').dependencies['@ahggg/dsh-side-chat'])"
```

Keep this file and `README.md` up to date when the layout, workflow, or
verification steps change.
