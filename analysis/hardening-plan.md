# Side Chat fork — release-hardening plan and audit log (runtime `0.2.1-rc.2`)

This document records the end-to-end audit performed for the `1.0.2-dsh0.2.1rc2.10`
release: what was examined, what was found, what was fixed, and which gates a
release must pass. It complements `analysis/build-validation.md` (build evidence),
`analysis/compat-report.md` (DSH API compatibility) and `RELEASE.md` (publish
checklist).

## Objective

Make the plugin release-safe for public distribution:

1. A Side Chat (and its Refresh) must **only** ever read the context of the
   conversation it is bound to. Reported failure: a refreshed side chat in
   session 2 answered from another session.
2. Every feature and lifecycle path is audited: `/side`, Refresh, selection
   actions, per-conversation transcripts, drag/resize geometry, Host caps,
   expiry, error recovery, plugin reload, multiple clients.
3. Durable regression tests and release documentation ship with the project.

## Workstreams

| Workstream | Scope | Result |
| --- | --- | --- |
| Active-session identity | Authoritative main-view session signal; no retention guessing | Session-scope anchor in the main-only `conversation.session.header.actions` slot; controller/panel identity guards |
| Host context audit | Prove/disprove cross-session contamination in `observeSession`/fold/projections/fork seeds | Host path is session-exact by construction; added identity/contiguity assertions and provenance in the frozen context |
| Adversarial QA | Whole plugin implementation, lifecycle, races, caps, geometry, error paths | 2 high / 6 medium / 8 low findings; all high/medium fixed, low-risk polish applied |
| Release engineering | Durable test harness, CHANGELOG, release checklist, packaging gates | `tests/**, tools/test.mjs`, CHANGELOG.md, RELEASE.md; full harness green |

## Findings and dispositions

### High

| ID | Finding | Disposition |
| --- | --- | --- |
| H1 | Active session was derived from an order-dependent `retainedBy.mainView` scan. DSH retains the new main session before releasing the old one, so the scan can transiently (and silently) bind the just-left conversation to a controller/panel; nothing revalidated controller ↔ session before Refresh/send, and the Host faithfully reads whatever parent id it receives. This is the reported symptom's chain. | **Fixed.** Main-only session-scope anchor reports the authoritative session; overlay renders only `manager.get(activeSessionId)`, passes that id to the overlay/selection capture, refuses a controller whose `state.parentSessionId` differs, and `/side`/selection/Refresh all pass an explicit parent. Host asserts `observation.header.id === request.parentSessionId` and the client refuses a Host discussion bound to another conversation. |
| H2 | Per-client Host cap (8 discussions) with unbounded hidden controllers can dead-end the 9th conversation with no visible way to free one. | **Fixed.** The Host recycles the client's oldest *idle* discussion before refusing, and the client auto-renews an expired discussion (`side_chat_not_found`) into a fresh draft with a notice. Absolute 16-total cap still refuses. |

### Medium

| ID | Finding | Disposition |
| --- | --- | --- |
| M1 | Model-preparation failure inside `create` was reported as `context_unavailable`. | Fixed: mapped to `side_chat_model_failed` (recoverable). |
| M2 | Per-owner cap could be bypassed by concurrent creates (pending creates not counted per owner). | Fixed: `ownerDiscussionCount` counts chats + in-flight creates. |
| M3 | Idle-swept hidden discussion left an unusable error panel. | Fixed: `side_chat_not_found` auto-renews a fresh draft for the same parent with a status notice. |
| M4 | Controllers for deleted/archived sessions were never disposed (retained parents + Host discussions leak). | Fixed: `SideChatManager.reconcile` prunes unknown session ids from the catalog snapshot. |
| M5 | Draft `autoFocus` stole focus from the main composer when switching conversations. | Fixed: the draft focuses only when focus came from a text-entry context. |
| M6 | Panel geometry state was bound to mount instead of the storage key; no legacy migration/multi-tab sync. | Fixed: reload on `storageKey` change, one-time legacy-key migration, `storage` event sync, tiny-viewport clamp. |
| M7 | Unguarded duplicate `/side` registration could break plugin mount. | Fixed: registration is try/caught with a warning; the rest of the plugin keeps working. |

### Low / polish

- Localized live-region announcements.
- Drag geometry persists when the panel unmounts mid-drag.
- Refresh double-click during `closing` is a no-op instead of a warning.
- `dispose()` bumps the model generation so a late model selection cannot write
  the client-wide preference after unload.
- Host stores `parentSessionId` on each discussion (diagnostics) and the frozen
  context carries `parentSessionId` + `inheritedEvents` provenance.
- Known limits documented: 30-minute idle expiry + LRU recycle, 8/client and 16
  total discussions, browser-tab-local ephemeral chats, no wire change
  (`lib/typert.js` byte-identical to upstream 1.0.2).

## Post-audit hotfixes (found while validating the release live)

- **rc2.8 — overlay entry disabled.** The new session-list subscription passed
  the adapter's prototype method `sessionListSnapshot` straight to
  `useSyncExternalStore`; the unbound `this` made the root `shell.overlay`
  component throw, so DSH marked the entry inactive and `/side` opened nothing.
  Fixed by binding the accessor and wrapping it in the overlay; regression spec
  `tests/specs/client/sessions-adapter.spec.ts` plus an unbound-method fake in
  the overlay spec. Confirmed live: `shell.overlay` occupant returned to
  `active:true`.
- **rc2.9 — permanent composer notice.** DSH renders `info` composer notices as
  permanent inline banners (only `error` becomes a transient toast). `/side` on
  an already-open conversation used one, so "This conversation already has an
  open Side Chat." never disappeared. The command now focuses the existing
  panel with no notice (`lib/client/dsh/side-chat-command.js`); the
  expired-discussion message uses the transient level. Regression spec
  `tests/specs/client/side-chat-command.spec.ts`.
- **rc2.10 — compact default panel / no session subtitle.** The default
  (no remembered geometry) panel is now half the previous width, two-thirds the
  previous height, anchored at the top-right instead of the bottom-right; the
  parent-session title line under "Side Chat" was removed. User-moved/resized
  geometry is untouched and double-click resets to the new default. The bundled
  probe grew to 20 checks (default CSS tokens + no title line).

## Verified invariants

- **Host read path is session-exact.** `observeSession(id)` is a live `Map` lookup
  or a cold read that asserts `snapshot.header.id === sessionId`; the cold cache
  is keyed by (persistence identity, session id, revision); `foldSurface` and
  `deriveEventMessage` are pure per input prefix with contiguous `seq === index`
  enforcement (now also asserted explicitly); the only registered message
  projection in this runtime is compaction image offload.
- **No cross-session fork surprise in this profile.** All 165 persisted sessions
  scanned: zero `isSeeded:true`; every `parentSession` header is a subagent child.
  A legitimate fork would carry inherited history, so both host and client now
  expose/record `inheritedEvents` provenance.
- **Read-only guarantee holds.** No Session create/append/fork/tool execution;
  context is frozen per discussion; reasoning/image/attachment bytes excluded;
  per-request abort, 120 s timeout, observation lease disposed in `finally`,
  owner cleanup on peer disconnect, idle sweep with unref'd timer.
- **No wire change.** `LATEST_AT_SEQ` is an internal sentinel; generated
  `lib/typert.js` remains byte-identical to published 1.0.2, and strict codecs
  are unchanged.

## Release gates

1. `node tools/test.mjs` (durable harness): source build from `upstream/source` +
   `src-overlays`, full vitest suite (upstream + local regression specs), shipped
   bundle jsdom probe, byte-identical rebuild gate — all green.
2. `node tools/adapt-package.mjs` produces the tarball; installed profile copy
   hash-matches `dsh-side-chat/` and reports the new version.
3. Live checks after reinstall: Host Config entry present, client `shell.overlay`
   occupant active, `conversation.session.header.actions` anchor occupant
   registered; manual smoke test per `AGENTS.md` (selection path, `/side`,
   drag/resize, Refresh, per-conversation switch + geometry restore).
4. `analysis/build-validation.md` records the run; CHANGELOG/README/AGENTS are
   current; only the current tarball remains in `dist/`.

## Verification limitation (environment)

The DSH Web GUI requires the authenticated URL printed by `dsh web`; a fresh
browser gets `dsh web authentication required`, so automated in-page E2E on the
user's running app is not available from this session. The shipped-bundle jsdom
probe exercises the real `lib/client.js` module factory with real React; the
interactive checklist above remains the final manual gate.
