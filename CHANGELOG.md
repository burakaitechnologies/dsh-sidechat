# Changelog

All notable changes to the local DeepSeek Harness adaptation of
[`@ahggg/dsh-side-chat`](https://github.com/AHGGG/dsh-side-chat) (upstream MIT).
The upstream project starts at `1.0.2`; every local build appends
`-dsh<DSH version>rc<N>` to that base version. The authoritative current version
is `PKG_VERSION` in `tools/adapt-package.mjs`; version labels below follow the
history recorded in `analysis/build-validation.md` and
`analysis/compat-report.md`.

## 1.0.2-dsh0.2.1rc2.9 — permanent composer notice fix

- **"This conversation already has an open Side Chat." no longer sticks.** DSH
  renders `info` composer notices as permanent inline banners (errors become
  auto-dismissing toasts). The `/side` command used such a notice when the
  conversation already had an open panel, so the text stayed in the composer
  until the page reloaded. Now `/side` on an already-open conversation simply
  focuses the existing panel (`lib/client/dsh/side-chat-command.js`); it emits
  no notice at all. The same fix applies to the expired-discussion auto-renewal,
  which now uses the transient toast level (`warning`) instead of `status`.
- New durable spec `tests/specs/client/side-chat-command.spec.ts` covers the
  open/focus/no-notice paths. Counts: 28 test files / 192 tests (133 upstream +
  59 local), 18/18 built-bundle probe. Installed version
  `1.0.2-dsh0.2.1rc2.9`.

## 1.0.2-dsh0.2.1rc2.8 — overlay-entry binding hotfix

- **`/side` showed no panel (rc2.7 regression).** The new session-list
  subscription passed `sessions.sessionListSnapshot` — a prototype method on the
  sessions adapter — directly as a React `useSyncExternalStore` getSnapshot
  callback. In the real runtime the method was invoked with an undefined `this`,
  the root `shell.overlay` component threw during render, DSH disabled that
  entry, and the panel could not appear even though `/side` opened a draft. The
  adapter method is now an arrow-bound property and the overlay calls it through
  explicit closures; a durable regression test asserts the detached accessor
  stays bound (and the overlay fake models the unbound method). Counts after the
  fix: 27 test files / 189 tests (133 upstream + 56 local), 18/18 built-bundle
  probe; installed version `1.0.2-dsh0.2.1rc2.8`.

## 1.0.2-dsh0.2.1rc2.7 — authoritative session identity + host hardening

- **Authoritative active conversation.** The client now learns the main-view
  conversation from a session-scope anchor (`SideChatSessionAnchor`, registered
  into DSH's main-only `conversation.session.header.actions` slot) instead of
  guessing from `retainedBy.mainView` retention scans. `SideChatManager` gains
  `activate`/`deactivate` (refcounted so StrictMode/dual mounts are safe) and
  `reconcile(knownSessionIds)`, which disposes controllers for conversations
  that disappeared from the session catalog. The overlay prefers the
  anchor-reported id and refuses to render a controller bound to another
  conversation.
- **Host conversation-identity hardening.** `create` now verifies that the
  observed session (`observeSession().header.id`) matches the requested parent
  conversation and refuses non-contiguous parent logs; the frozen context JSON
  records `parentSessionId` and `inheritedEvents`; model-resolution failures map
  to `side_chat_model_failed`; the observation read lease is released on every
  path (including the identity-mismatch rejection). At the per-client cap the
  Host recycles the client's oldest idle discussion instead of refusing a new
  one; the 16-discussion total cap still refuses.
- **Controller recovery.** A conversation-bound `create` result is rejected if
  it belongs to another parent; a `side_chat_not_found` stream error (idle/cap
  expiry of a hidden discussion) now renews a fresh draft for the same
  conversation instead of leaving an unusable error panel. `refresh()` on a
  closed controller fails explicitly instead of guessing a conversation.
- **Panel robustness.** Per-conversation geometry is reloaded when the storage
  key changes, the legacy plugin-wide geometry key is migrated once, geometry
  stays in sync across tabs via the `storage` event, drags persist when the
  panel unmounts mid-drag, and the draft is only auto-focused when focus came
  from a text-entry context (no focus theft on session switches).
- Regression coverage for this batch lives in the durable `tests/specs/**`
  suite (see `tests/README.md`): 26 test files / 188 tests with the vendored
  upstream suite, plus the 18-check built-bundle probe.

## 1.0.2-dsh0.2.1rc2.6 — per-conversation side chats

- **Side chats are per conversation.** A new `SideChatManager` keeps one
  independent `SideChatController` per parent session, and the session-aware
  `SideChatSessionsOverlay` renders only the conversation currently shown in the
  main view. Switching main conversations hides one panel and shows the other;
  hidden conversations keep their transcript, Host discussion, running stream,
  model preference, and panel geometry. Normal selection actions, `/side`, and
  the header Refresh button all address the current conversation's controller.
- **Per-conversation geometry.** The panel remembers its position/size in
  `localStorage` under `dsh-side-chat.panel.geometry:<sessionId>` (one entry per
  conversation) instead of one plugin-wide key; double-clicking the header
  clears only the current conversation's geometry.
- **Host discussion cap raised.** `MAX_DISCUSSIONS_PER_OWNER` moved from 2 to 8
  (total 16 and the 30-minute idle sweep are unchanged), so several
  conversations can keep a Host discussion open at once.
- The selection-less `/side` path and the latest-committed-context host cut are
  unchanged by this build; `lib/typert.js` remains byte-identical to published
  upstream 1.0.2 (no wire change).

## 1.0.2-dsh0.2.1rc2.5 — header Refresh + session-switch lifecycle fix

- **Refresh action in the panel header** (icon + label, left of *Add to
  conversation*): closes the current Host discussion, releases the retained
  parent and reopens an empty draft for the same parent conversation. The next
  question creates a fresh discussion that captures the newest committed parent
  context — equivalent to closing the panel and running `/side` again, but it
  keeps the panel and its geometry.
- Fixed the panel lingering over a different main conversation after switching
  sessions (pre per-session-controller behavior); regression coverage added for
  controller refresh, header button rendering/order/click, and session-switch
  behavior.

## 1.0.2-dsh0.2.1rc2.4 — invisible resize zones

- Removed the decorative edge/corner resize indicators entirely. The six resize
  hit zones (four edges, top-left and bottom-right corners) remain functional
  but invisible, with cursor feedback only.

## 1.0.2-dsh0.2.1rc2.3 — header-bar drag + all-edge resizing

- The **whole header bar** is now the drag surface, including the title; only
  the *Add to conversation* and *Close* buttons keep their click behavior, and a
  title drag suppresses the title's parent-view click (click-vs-drag slop).
- The panel can be resized from all four edges plus the **top-left** and
  bottom-right corners; the opposite edge stays anchored.
- Installable-bundle probe extended to cover title click-vs-drag, all four
  edges, both corners, persistence, and reset.

## 1.0.2-dsh0.2.1rc2.2 — move-mode pointer-delta fix

- Fixed the first installed build's drag bug: move mode never added the pointer
  delta to the panel position, so the panel did not actually move while the
  helper code updated its state. The shipped bundle probe now verifies real
  pointer-driven movement, geometry persistence, and reset.

## 1.0.2-dsh0.2.1rc2.1 — initial DSH 0.2.1-rc.2 adaptation

- Re-targeted the published upstream `1.0.2` package from DSH `0.2.0-rc.2` to
  the installed **DSH `0.2.1-rc.2`** runtime: `engines.dsh`, DSH peer versions,
  `dsh.compatibility` / `dshCompatibility`, plus locale and icon display
  metadata.
- Rebuilt the runtime from the vendored TypeScript source with the locked
  toolchain (`rolldown@1.2.11`) so untouched runtime files stay byte-identical
  to published 1.0.2.
- Added the local feature set:
  - **`/side` client command** (DSH `ctx.commandUi` action contribution): opens
    the Side Chat panel for the current conversation without touching the main
    composer.
  - **Latest-committed-context host cut.** A selection-less draft sends
    `LATEST_AT_SEQ = Number.MAX_SAFE_INTEGER`; the Host special-cases it and cuts
    the parent snapshot at `observeSession().cursor` (newest committed event)
    instead of the completed-turn boundary used by selection requests. The wire
    format is unchanged: `atSeq` stays a non-negative integer, and
    `lib/typert.js` is byte-identical to published 1.0.2.
  - **Draggable/resizable panel** with remembered geometry: initially a drag
    grip plus corner resizing, persisted in `localStorage`, reset by
    double-clicking the header.

## Upstream 1.0.2 (base)

- Published upstream release imported as `upstream/package` + `upstream/source`
  (commit `8d463ea7410bcb0b4e76a2d11d5b848d04fc0086`), targeting DSH
  `0.2.0-rc.2`. Unmodified upstream behavior: selection action bar
  (*Add to chat*, *More details*, *Ask in side chat*), frozen read-only
  conversation snapshot, direct model streaming in a floating panel, and
  ephemeral Host-memory discussions with upstream limits (read-only text-only,
  selection inside one completed message, 2-minute request timeout, in-memory
  discussion discarded when closed, context/reply/question size caps).
