# `tests/` — durable regression tests and the one-command harness

This folder holds the **durable** test assets for the local Side Chat feature
set. They are not part of the published package; they verify the source
overlays that are rebuilt into `patches/lib/**` and `dist/*.tgz`.

The tests run against a scratch build (`.scratch/test-build`) created from the
untouched `upstream/source` snapshot plus `src-overlays/src/**`. That is why the
specs import source modules as `../../src/...` and live under
`tests/specs/client/` and `tests/specs/host/`: the harness copies them into
`<scratch>/test/client/` and `<scratch>/test/host/`, exactly like the upstream
test suite, where the relative imports resolve.

## Quick start

```powershell
cd C:\Users\ahmet\Desktop\deepseek\plugins\sidechat
node tools/test.mjs
```

First run needs network (npm install) and takes a few minutes; later runs reuse
`.scratch/test-build/node_modules` and `.scratch/npm-cache`. Exit code `0`
means every required gate passed; `1` means a failure (details in the printed
`FAIL` lines and the `=== SUMMARY ===` section).

| Command | What it runs |
| --- | --- |
| `node tools/test.mjs` | stage + install + build + full vitest suite + built-bundle jsdom probe (+ advisory shipped-bundle probe) |
| `node tools/test.mjs --vitest-only` | stage + install + full vitest suite (no build/probe) |
| `node tools/test.mjs --bundle-only` | stage + install + build + probe only |
| `node tools/test.mjs --skip-build` | reuse an existing scratch `lib/client.js` |
| `node tools/test.mjs --skip-install` | assume scratch `node_modules` is ready |
| `node tools/test.mjs --fresh` | re-copy `upstream/source` into the scratch build (keeps npm cache) |
| `node tools/test.mjs --clean` | delete the scratch build after the run (keeps npm cache) |
| `node tools/test.mjs --help` | print the option list and exit |

Scratch layout (safe to delete; `.scratch/npm-cache` is the only part worth
keeping for offline-ish re-runs):

```text
.scratch/
  npm-cache/                 npm cache (set via npm_config_cache)
  test-build/                vendored source + overlays + node_modules
    lib/                     build output, probed by the bundle probe
    test/                    upstream tests + copied durable specs
    .dsh/                    install markers, copied probe, JSON reports
```

## Durable specs

Every file below is a real Vitest spec. Keep them behavior-focused and
session-agnostic; they are run together with the upstream suite (so a regression
in either the upstream behavior or the local overlays fails the same command).

| Spec | Covers |
| --- | --- |
| `specs/client/side-chat-manager.spec.ts` | `SideChatManager`: one controller per conversation, stable identity, manager snapshots/revision, `EMPTY_SIDE_CHAT_STATE` without creating controllers, two conversations' transcripts stay independent, a hidden conversation's transcript and host discussion survive the main-view switch, disposal closes every host discussion and releases retained parents, the authoritative active-conversation reports (`activate`/`deactivate`, including duplicate-anchor refcounting and ignore-after-dispose), active-conversation fallback to the last mounted anchor, and `reconcile(knownSessionIds)` pruning/disposal of controllers whose conversation disappeared. |
| `specs/client/refresh.spec.ts` | `SideChatController.refresh()` (header Refresh): closes the host discussion and releases the parent, reopens an empty draft for the same conversation, next send is a latest-context `create`; works while a reply streams (carrier aborted), when the main view moved elsewhere, when the Host close fails (no reopen), refuses to refresh a closed controller instead of guessing the current conversation, and keeps the model preference. |
| `specs/client/latest-context.spec.ts` | Client side of the `/side` cut: a draft opened without a selection sends `LATEST_AT_SEQ` (`Number.MAX_SAFE_INTEGER`) with no `selectedText`; a selection draft keeps its completed-turn `atSeq`; after Refresh the reopened draft goes back to the sentinel. |
| `specs/client/panel-geometry.spec.tsx` | Panel UI in jsdom: Refresh button renders (icon + label) left of *Add to conversation* and invokes its callback; six invisible resize handles; header drag persists geometry only under the supplied per-session key (and the legacy key when no key is given); geometry is independent between conversations and restored on remount; double-click clears only the active conversation; right-edge resize persists size; a plain title click still opens the parent view and a title drag suppresses that click. |
| `specs/client/side-chat-sessions-overlay.spec.tsx` | `SideChatSessionsOverlay` session switching: only the active conversation's panel renders; switching hides it without losing the draft; switching back restores the same controller/transcript; per-conversation geometry keys are applied in the real overlay wiring; header Refresh is wired to the active controller; the session-list accessor is called through a wrapper, so an unbound adapter method cannot throw during render (rc2.8 regression). |
| `specs/client/sessions-adapter.spec.ts` | `DshSideChatSessions.sessionListSnapshot` is bound to the adapter: detaching the accessor and calling it bare still returns `ctx.sessions.list`'s `byId` snapshot. Guards the rc2.7 `/side`-opens-nothing regression where a `useSyncExternalStore` getSnapshot callback lost `this`, the shell overlay entry threw and DSH disabled it. |
| `specs/client/side-chat-command.spec.ts` | `/side` command behavior (`runSideChatCommand`): opens a draft with an explicit parent on a closed conversation; on an already-open conversation it focuses the existing panel and emits **no** notice (DSH renders `info` notices as permanent inline banners); missing panel is a silent no-op, never a throw. |
| `specs/client/controller-hardening.spec.ts` | Conversation-binding safeguards: a Host `create` result bound to another parent conversation is rejected (no model stream, visible `context_unavailable` error); an expired Host discussion (`side_chat_not_found` on the stream) auto-renews into a fresh draft for the same parent, notifies the user, keeps the parent retained, and the next question opens a new Host discussion. |
| `specs/client/session-anchor.spec.tsx` | Authoritative active-conversation identity: `SideChatSessionAnchor` reports `activate` on mount, `deactivate` on unmount and on `sessionId` changes, is StrictMode double-mount safe, makes the overlay render the anchor-reported conversation even when the legacy retention scan still reports another, restores the hidden controller on switch-back, and keeps a captured selection's parent conversation when a draft opens during a session switch. |
| `specs/host/latest-context.spec.ts` | Host side of `LATEST_AT_SEQ`: `latestCommittedBoundary` uses the observation cursor as an inclusive cut; `create` cuts at the newest committed event (newest user message included, selection semantics unchanged, no later parent text leaks into an earlier selection discussion); the frozen context embeds `parentSessionId`/`inheritedEvents`; an observation whose `header.id` differs from the request is refused (identity guard) and releases the read lease exactly once; a non-contiguous parent log is refused before folding; a model-preparation failure maps to `side_chat_model_failed` (recoverable); empty log → `context_unavailable`; initial event → boundary 0; per-client cap behavior (recycle the oldest idle at 8, refuse while all 8 are actively streaming) and the 16-discussion total cap. |

The bundle probe lives at `bundle/verify-shipped-bundle.mjs` and is copied into
the scratch build by the harness so its `react` / `react-dom` / `jsdom` imports
resolve. Run it directly (from the scratch build root, or by copying it there):

```powershell
cd .scratch\test-build
node .dsh\probe\verify-shipped-bundle.mjs --bundle lib/client.js --json .dsh/probe.json
```

It loads a built `lib/client.js` through a stubbed `window.__ModuleLoader__`
inside jsdom, renders the exported `SideChatPanel`, and dispatches real pointer
events to verify the shipped behavior (header drag, title click-vs-drag, all
four edges, both corners, per-session geometry persistence, reset, Refresh
button rendering/order/click, bundled per-session markers). `--bundle` accepts
any built bundle path (the harness probes both the scratch build and the shipped
`dsh-side-chat/lib/client.js`); `--json` writes a machine-readable report.

## Adding a spec

1. Put it under `tests/specs/client/` or `tests/specs/host/` with a
   `*.spec.ts` / `*.spec.tsx` name.
2. Import source modules as `../../src/...` and shared fixtures as
   `../fixtures/...` (the upstream fixtures `client-runtime.ts`, with
   `FakeRemote`/`FakeClientSessions`/`ManualStream`, are available in the
   scratch tree).
3. For DOM specs start the file with `// @vitest-environment jsdom` and import
   `@testing-library/jest-dom/vitest`; the upstream `vitest.config.ts` already
   inlines `@deepseek-ai/dsh-client-ui-primitives`.
4. Run `node tools/test.mjs --vitest-only`; the harness copies every
   `tests/specs/**/*.spec.ts(x)` into the scratch test tree and removes stale
   copies from earlier runs.

Keep tests offline and deterministic: fake the Host RPC (`FakeRemote`), fake the
session services, and never hit the network or the live DSH runtime.

## Requirements and notes

- Windows, Node 24, npm 11 on `PATH` (the harness resolves `node_modules/npm/bin/npm-cli.js`
  beside `node.exe`; it does not rely on a globally installed npm shim).
- First run needs npm registry access. The harness keeps the npm cache inside
  `.scratch/npm-cache` (override with `npm_config_cache` in the environment) and
  pins `rolldown@1.2.11`, the exact version upstream's `pnpm-lock.yaml` locks,
  so the rebuild matches the published `1.0.2` runtime except for intended
  changes.
- `upstream/package.json` is a pnpm project and its install needs
  `--legacy-peer-deps`; that mode skips peer dependencies, so the harness also
  installs the two peers the upstream test suite needs at runtime:
  `@testing-library/dom@^10` (Testing Library) and
  `@deepseek-ai/dsh-scope@0.2.0-rc.2` (`dsh-session`'s peer). They are installed
  `--no-save` together with the `rolldown@1.2.11` pin, in that order, so the
  pin wins over npm's transitive `rolldown` resolution.
- `upstream/**` is read-only. Never edit it; change `src-overlays/**` and
  rebuild `patches/lib/**` with `src-overlays/README.md`.
- The harness compares built output against the currently shipped
  `dsh-side-chat/` package and warns when they differ; that warning is expected
  until `node tools/adapt-package.mjs` regenerates the package and the tarball
  is reinstalled. On a warm scratch build a full run takes roughly 10 seconds;
  the first run takes minutes (npm install dominates).
- Last full verification: **2026-10-20** — the source overlays include the
  post-rc2.6 session-identity/host-hardening work, the rc2.8 overlay-entry
  binding fix (the `sessionListSnapshot` accessor consumed by
  `useSyncExternalStore` must stay bound — a detached prototype method made the
  root overlay component throw and DSH marked it inactive), and the rc2.9
  composer-notice fix (`/side` on an already-open conversation focuses the
  panel instead of emitting a permanent DSH inline info notice; an expired
  discussion uses the transient toast level). `PKG_VERSION` is
  `1.0.2-dsh0.2.1rc2.9`, with `dsh-side-chat/` rebuilt and reinstalled at the
  same version. `node tools/test.mjs` exited 0 with **28 test files / 192 tests
  passed (0 failed, 0 skipped)** — 133 vendored upstream tests plus 59 local
  regression tests in the ten `tests/specs/**` files — the built-bundle probe
  passed **18/18 checks**, and the shipped-bundle probe passed 18/18 as an
  advisory check.
