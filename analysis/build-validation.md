# Source-build validation — @ahggg/dsh-side-chat 1.0.2

Date: 2026-10-20 · Machine: Windows, Node v24.16.0, npm 11.13.0 (pnpm NOT used/installed)
Scratch workspace: `.scratch/build` (full copy of `upstream/source`, no `.git` present)
Sandbox note: all npm state kept in-workspace via `npm_config_cache=.scratch/npm-cache`
(default `%LocalAppData%\npm-cache` is write-denied under the file sandbox).

## Verdict

**Source build works.** `npm install --legacy-peer-deps --ignore-scripts` + `npm run build`
succeeds and produces a working bundle. With the toolchain version pinned by upstream's
`pnpm-lock.yaml` (rolldown 1.2.11) the rebuild is **byte-identical to the published
`upstream/package/lib` (87/87 files)**. With npm's default resolution (rolldown 1.2.14)
only 2 of 87 files differ, purely by minifier codegen (see below).

## Exact commands

```powershell
Set-Location C:\Users\ahmet\Desktop\deepseek\plugins\sidechat
New-Item -ItemType Directory -Force .scratch | Out-Null
Copy-Item -Recurse -Force upstream\source .scratch\build

$env:npm_config_cache = 'C:\Users\ahmet\Desktop\deepseek\plugins\sidechat\.scratch\npm-cache'
Set-Location .scratch\build

# plain npm install FAILS (ERESOLVE) — use the fallback:
npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund   # 316 pkgs, 25.7 s, exit 0
npm run build                                                          # exit 0
```

Reproduce the published bytes exactly (optional, proven):

```powershell
# in .scratch\build, after the install above
npm install --no-save rolldown@1.2.11 --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run build     # -> 0/87 files differ from upstream/package/lib
# restore canonical state:
npm install --no-save rolldown@1.2.14 --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run build
```

## Install

- Plain `npm install --ignore-scripts --no-audit --no-fund` → **exit 1, npm error ERESOLVE**
  (68.5 s). Conflict: `@deepseek-ai/cordis-plugin-include@1.0.10` (pulled in as
  peerOptional of `@deepseek-ai/cordis@4.0.4`) requires peer
  `@deepseek-ai/cordis@~4.0.5`, but the root projects pins `@deepseek-ai/cordis@4.0.4`
  (also required by `@deepseek-ai/dsh-agent@0.2.0-rc.2`). Full log: `.scratch/install-1.log`.
- Fallback `--legacy-peer-deps` → **exit 0**, "added 316 packages in 25s"
  (`.scratch/install-2.log`). Only warnings: two deprecations of transitive native
  bindings: `@yuku-codegen/binding-win32-x64@0.8.7`, `@yuku-parser/binding-win32-x64@0.8.7`
  (pure-JS since 0.14; harmless, `--ignore-scripts` used per instructions).
- npm created `package-lock.json` in the build copy (expected; upstream uses pnpm).
  Installed: typescript 6.0.3, tsdown 0.22.14, rolldown 1.2.14, react 18.3.1, zod 4.4.3,
  all `@deepseek-ai/*` at 0.2.0-rc.2.

## Build

`npm run build` = `node scripts/clean.mjs && tsc -p tsconfig.build.json && tsdown --config tsdown.config.ts`

- **exit 0**, no tsc or tsdown warnings.
- Wall time: 3.8 s first run (cold), 2.3 s final run. tsdown phase: typert 46–50 ms,
  client 58–59 ms.
- Output: `.scratch\build\lib` — 87 files, 481.9 KB
  (tsc: 85 files incl. `.d.ts`; tsdown overwrites `lib/client.js`, `lib/typert.js`).
- tsdown reported: client.js 183.62 kB (gzip 47.49 kB), typert.js 74.72 kB (gzip 19.24 kB).

Build is deterministic for a fixed toolchain: two separate `npm run build` runs with
rolldown 1.2.14 produced identical SHA-256 for both bundles.

## Fresh build vs published `upstream/package/lib`

File sets identical (87 vs 87, no missing/extra). **85/87 byte-identical**, including
every tsc-emitted JS and `.d.ts`, `host/read-only-chat-service.js`,
`lib/index.js`, `lib/remote.js`, and all `lib/client/**`, `lib/host/**`, `lib/shared/**` files.
Reference `upstream/source/lib` shipped in the snapshot is also byte-identical to
`upstream/package/lib` (0 diffs), i.e. the snapshot includes the published output.

| File | Published | Fresh (npm default, rolldown 1.2.14) | Delta |
|---|---|---|---|
| `lib/client.js` | 183,715 B · SHA256 C2F7E5C4…1B9C | 183,623 B · SHA256 70E6A6FA…0976 | −92 B |
| `lib/typert.js` | 74,719 B · SHA256 EA280AB5…27C0 | 74,718 B · SHA256 294F87FA…BAC5 | −1 B |
| `lib/host/read-only-chat-service.js` | 16,423 B · SHA256 C0E19246…B8B3 | identical | 0 |
| `lib/index.js` | 1,765 B · SHA256 21251E41…9ACB | identical | 0 |
| `lib/remote.js` | 271 B · SHA256 601DC7F7…4FA9 | identical | 0 |

### Nature of the 2 differing files (minifier codegen only)

Character diff (installed `diff` package):

- `client.js`: 31 changed segments, +120/−212 chars. Examples:
  published `if(i!==void 0){r.push(i.reference),t=i.message;continue}break`
  vs fresh `if(i!==void 0)r.push(i.reference),t=i.message;else break` (same semantics).
  Fresh also adds/removes `/* @__NO_SIDE_EFFECTS__ */` and `/* @__PURE__ */`
  annotations and reorders `? :` / `||` / `&&` short-circuit codegen.
- `typert.js`: 9 changed segments, +71/−72 chars, same annotation/control-flow class.

**No semantic/API/protocol changes**; all differences are from the newer rolldown
minifier (1.2.14) vs the version upstream locked (1.2.11). Proof: pinning
`rolldown@1.2.11` (the exact `rolldown@1.2.11` pin at `pnpm-lock.yaml` line 2146, used by
tsdown per line 4568) and rebuilding produced **0/87 differing files — byte-identical**
to the published package. Canonical `.scratch\build` was restored to rolldown 1.2.14
and rebuilt (2 differing files), as prescribed by the task sequence.

### Bundle wrapper (client.js)

- Starts with the expected module-loader wrapper, minified:
  `window.__ModuleLoader__.load({id:`@ahggg/dsh-side-chat`,factory:e=>{var t={exports:{}},n=t.exports;…`
  (first 46,342 chars identical to published; header/footer identical).
- Ends with the expected factory/footer close, minified:
  `…n.utf8ByteLength=we,t.exports}});` — the configured footer
  `return module.exports; } });` was fused by the minifier into the final
  `return <exports assignments>, t.exports } });` sequence; the factory still returns
  `module.exports` (verified by execution, below). Byte-identical to published.
- `typert.js` remains ESM (`export{…}`) and is identical apart from minifier codegen.

## Syntax / load checks on generated files

- `node --check lib/client.js` → **exit 0** (nearest `package.json` has `"type":"module"`,
  so Node parses it as ESM; the `window.__ModuleLoader__.load(...)` wrapper is a valid
  expression statement — `--check` parses only, it does not execute).
- `node --check` on a `.cjs` copy → **exit 0** (CommonJS parse also valid).
- `node --check lib/typert.js` → **exit 0**.
- Execution smoke test with a stubbed loader (`.scratch/final-loader-probe.cjs`):
  captured `id = @ahggg/dsh-side-chat`, `factory` is a function; invoking it with a
  proxy `require` returns the module.exports object with 16 keys including
  `inject` and `name: "side-chat-client"`. The wrapper is functional, not just parseable.

## Sizes / artifacts (all left in place)

- `.scratch\build`: **172.0 MB, 14,212 files** (node_modules 170.5 MB / 14,030 files;
  lib 481.9 KB / 87 files; src 233.5 KB / 45 files; package-lock.json 219.4 KB).
- Built lib path: `C:\Users\ahmet\Desktop\deepseek\plugins\sidechat\.scratch\build\lib`.
- `.scratch\lib-rolldown-1.2.11\` — byte-identical copy of published lib (best source
  for patches if exact parity is wanted).
- `.scratch\lib-rolldown-1.2.14\` — first canonical build output.
- Logs: `.scratch\install-1.log` (ERESOLVE), `.scratch\install-2.log`,
  `.scratch\build.log`, `.scratch\build-final.log`, `.scratch\build-rolldown1211.log`.
- No files outside `.scratch\` were modified by this validation; the copy's `src/` and
  config files hash-identical to `upstream/source` (only `lib/` rebuilt and
  `node_modules/` + `package-lock.json` added).
- The existing `.scratch\types\` directory belongs to a different teammate's audit; untouched.

---

> Historical note: this validation was produced in a temporary `.scratch/`
> build tree (deleted after the feature build). Paths ending in `.scratch`
> refer to that session. The maintained reproducer is
> `src-overlays/README.md`; current shipped artifacts are `patches/lib/**`
> and `dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.6.tgz`.

## Shipped-bundle geometry verification (2026-10-20, build 1.0.2-dsh0.2.1rc2.2)

The first installed build had a move-mode bug (the drag handler never added the
pointer delta to x/y), reported by the user in the live GUI. After the fix, the
**shipped** dsh-side-chat/lib/client.js bundle was loaded through a stubbed
`window.__ModuleLoader__` into jsdom and its exported `SideChatPanel` was
driven with pointer events:

``text
PASS panel renders
PASS drag grip renders
PASS resize corner renders
PASS resize edge handles render
PASS grip drag moves panel          (260px 190px after +60/+40)
PASS geometry persisted             (localStorage)
PASS corner resize changes width/height (600px 450px after +100/+50)
PASS double-click resets geometry
8/8 checks passed (exit 0)
``

Reproducer: `analysis/verify-shipped-bundle.mjs` (header documents the
temporary harness setup). The equivalent source-level tests used during the
build were `test/client/panel-geometry.spec.tsx` and
`test/host/latest-context.spec.ts` in the deleted `.scratch` build.

## Update — header-bar drag + all-edge resizing (2026-10-20, build 1.0.2-dsh0.2.1rc2.3)

The user asked for the whole header bar to be the drag surface (instead of the
small grip) and for top/left edge plus top-left corner resizing. After the
source rebuild and reinstall, the shipped `lib/client.js` bundle was verified
again with the same harness (no drag grip; header/title drag; title click
suppressed after a drag; top/right/bottom/left edges; both corners; reset):

```text
PASS panel renders
PASS all edge + corner handles render
PASS drag grip was removed
PASS clicking the title still opens the parent view  (1)
PASS header-bar drag moves panel                     (260px 190px)
PASS geometry persisted                              (localStorage)
PASS title drag moves panel and suppresses the click (300px 220px focus=1)
PASS right edge widens panel                         (550px 400px)
PASS top edge raises the top and shortens height     (210px 340px)
PASS left edge moves x and narrows width             (260px 440px)
PASS top-left corner resizes both axes               (270px 200px 430px 350px)
PASS bottom-right corner resizes both axes           (560px 450px)
PASS double-click resets geometry
13/13 checks passed (exit 0)
```

The 8/8 section above is kept as historical evidence for the earlier build.
Both builds were produced from `src-overlays/` with `rolldown@1.2.11` and had
`lib/typert.js` byte-identical to published 1.0.2.

## Update — invisible resize zones (2026-10-20, build 1.0.2-dsh0.2.1rc2.4)

The user asked that the decorative edge/corner marks never be visible (neither
the always-on corner L-marks nor the hover edge lines). The CSS pseudo-element
indicators were deleted; the six resize hit zones and their resize cursors
remain. Rebuilt and reinstalled, then verified against the shipped bundle:

```text
PASS panel renders
PASS all edge + corner handles render
PASS drag grip was removed
PASS no visible resize marks in bundled CSS
PASS clicking the title still opens the parent view  (1)
PASS header-bar drag moves panel                     (260px 190px)
PASS geometry persisted                              (localStorage)
PASS title drag moves panel and suppresses the click (300px 220px focus=1)
PASS right edge widens panel                         (550px 400px)
PASS top edge raises the top and shortens height     (210px 340px)
PASS left edge moves x and narrows width             (260px 440px)
PASS top-left corner resizes both axes               (270px 200px 430px 350px)
PASS bottom-right corner resizes both axes           (560px 450px)
PASS double-click resets geometry
14/14 checks passed (exit 0)
```

`lib/typert.js` is still byte-identical to published 1.0.2 and the resize
functionality is unchanged; only the visual indicators were removed.

## Update — header Refresh + session-switch lifecycle (2026-10-20, build 1.0.2-dsh0.2.1rc2.5)

Added the header **Refresh** action (close the current discussion and reopen a
fresh latest-context draft for the same parent session, equivalent to close +
`/side`) and fixed the panel lingering after switching the main conversation
(it now closes, so the previous session's side chat never floats over the new
one). No DSH API or wire change: Refresh composes the existing `close` RPC and
a new `create` on the next send; the session switch reads the existing
`sessions.list` main-view retention snapshot.

Source-level regression suite (scratch `.scratch/build`, `npx vitest run` with
the upstream tests plus two new scratch specs):

```text
Test Files  20 passed (20)
     Tests  140 passed (140)
```

New cases: Refresh button renders with icon/label, sits left of Add to
conversation and invokes its callback, is disabled while closing; controller
`refresh()` closes the host chat and reopens a draft (including while a reply
is streaming), and the next send creates a fresh latest-context discussion;
switching the reported session closes the panel while an unchanged session
keeps it open.

Shipped-bundle probe `analysis/verify-shipped-bundle.mjs` (actual built
`lib/client.js`, stubbed `__ModuleLoader__`, jsdom):

```text
PASS panel renders
PASS all edge + corner handles render
PASS drag grip was removed
PASS no visible resize marks in bundled CSS
PASS Refresh button renders with icon and label
PASS Refresh sits left of Add to conversation
PASS Refresh click invokes the refresh action
PASS clicking the title still opens the parent view
PASS header-bar drag moves panel
PASS geometry persisted
PASS title drag moves panel and suppresses the click
PASS right edge widens panel
PASS top edge raises the top and shortens height
PASS left edge moves x and narrows width
PASS top-left corner resizes both axes
PASS bottom-right corner resizes both axes
PASS double-click resets geometry
17/17 checks passed (exit 0)
```

`lib/typert.js` remains byte-identical to published 1.0.2 and the install was
`application: "applied"` with no warnings.

## Update — per-conversation side chats (2026-10-20, build 1.0.2-dsh0.2.1rc2.6)

Each main conversation now keeps its own Side Chat: transcript, host
discussion, panel geometry, and model preference are preserved while switching.
Implementation: new `SideChatManager` (one `SideChatController` per parent
session) + `SideChatSessionsOverlay` (renders only the active conversation's
overlay, keyed by session), per-conversation geometry keys, and a plugin-local
host cap increase (`MAX_DISCUSSIONS_PER_OWNER` 2 → 8; total 16 and the
30-minute idle sweep unchanged). No DSH API or Typert wire change.

Source-level regression suite (scratch `.scratch/build`, upstream tests + new
scratch specs `test/client/refresh.spec.tsx` and
`test/client/multi-session.spec.tsx`):

```text
Test Files  20 passed (20)
     Tests  140 passed (140)
```

New cases: two sessions get distinct controllers with independent transcripts;
switching the main conversation keeps the hidden side chat alive and restores
the active one; geometry is stored/restored per conversation key; Refresh
header button and controller refresh semantics; plus all previous
drag/resize/refresh checks.

Shipped-bundle probe `analysis/verify-shipped-bundle.mjs`:

```text
PASS panel renders
PASS all edge + corner handles render
PASS drag grip was removed
PASS no visible resize marks in bundled CSS
PASS per-session manager and geometry key are bundled
PASS Refresh button renders with icon and label
PASS Refresh sits left of Add to conversation
PASS Refresh click invokes the refresh action
PASS clicking the title still opens the parent view
PASS header-bar drag moves panel
PASS geometry persisted
PASS title drag moves panel and suppresses the click
PASS right edge widens panel
PASS top edge raises the top and shortens height
PASS left edge moves x and narrows width
PASS top-left corner resizes both axes
PASS bottom-right corner resizes both axes
PASS double-click resets geometry
18/18 checks passed (exit 0)
```

`lib/typert.js` is byte-identical to published 1.0.2; the install was
`application: "applied"` with no warnings and the installed files hash-match the
package.

## Update — authoritative session identity + host hardening (2026-10-20, build 1.0.2-dsh0.2.1rc2.7)

Release-hardening pass after the reported cross-session context bug. The Host
read path was proven session-exact (`observeSession` live/cold identity checks,
pure `foldSurface`, no global seq-keyed projection); the weak point was client
active-session identity. Fixes:

- Main-only DSH session-scope anchor (`SideChatSessionAnchor` in
  `conversation.session.header.actions`) reports the active conversation to
  `SideChatManager.activate/deactivate` (refcounted); the overlay no longer
  depends on the order-dependent `retainedBy.mainView` scan, passes the
  authoritative `sessionId` into the panel, and refuses a controller bound to
  another conversation. Controllers are pruned when their session disappears.
- Host `create` asserts `observation.header.id === request.parentSessionId`
  (releasing the observation lease on every path), requires a contiguous log
  prefix, maps model-preparation errors to `side_chat_model_failed`, recycles
  the oldest idle discussion at the per-client cap, and records
  `parentSessionId` + `inheritedEvents` provenance in the frozen context.
- Controller/panel hardening: explicit parents for every draft/action path,
  `side_chat_not_found` auto-renewal, per-conversation geometry reload/migration/
  cross-tab sync, no focus theft on conversation switches, mid-drag unmount
  persistence, README/AGENTS/ADAPTED parity.

Durable release gate (`node tools/test.mjs`, warm run ~8 s, exit 0):

```text
26 test files / 188 tests: 188 passed, 0 failed, 0 skipped
built-bundle jsdom probe: 18/18 checks passed
shipped-bundle probe: 18/18 checks passed (advisory)
built source and shipped package are byte-identical
RESULT: PASS
```

The suite is 133 vendored upstream tests + 55 local regression tests
(`tests/specs/**`) covering: anchor activate/deactivate/refcount and
anchor-over-retention switching; controller wrong-parent rejection and expired
discussion auto-renewal; refresh close/reopen and closed-refusal; host identity
guard + lease release, contiguous-prefix guard, model-error mapping, 16-total
cap, all-active refusal and oldest-idle LRU recycle; per-session geometry keys,
legacy migration, storage-event sync and focus behavior; plus all previous
drag/resize/refresh/bundle checks.

Packaging/install verification for rc2.7:

```text
dsh-side-chat/package.json version: 1.0.2-dsh0.2.1rc2.7
engines.dsh: 0.2.1-rc.2
dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.7.tgz  (147,246 bytes, 102 files)
installed profile copy: 1.0.2-dsh0.2.1rc2.7, hash-identical to dsh-side-chat/
lib/typert.js: byte-identical to published 1.0.2 (no wire change)
plugin_manager install: application "applied", warnings []
host Config inspect: include:side-chat (status absent = no Config schema)
client Slots: shell.overlay occupant dsh-side-chat; the rc2.7 anchor is
  registered in conversation.session.header.actions (active:true)
```

Live GUI smoke tests remain a manual gate: the DSH Web GUI requires the
authenticated URL (`dsh web authentication required` on a fresh browser), which
an agent session cannot obtain without the user's token. The jsdom probe
executes the real shipped `lib/client.js` factory against real React, and the
interactive checklist in `AGENTS.md` / `RELEASE.md` covers the remaining
UI-only behavior (selection toolbar, streaming reply, drag/resize feel,
per-conversation Refresh).

## Hotfix — overlay-entry binding (2026-10-20, build 1.0.2-dsh0.2.1rc2.8)

User report after installing rc2.7: typing `/side` no longer showed the panel.
Live client `Slots` inspect showed the rc2.7 `shell.overlay` occupant
`dsh-side-chat` as `active:false` while the new session anchor was active —
i.e. the root overlay component was failing to render. Root cause: the rc2.7
reconciliation code subscribed to the sessions catalog with
`useSyncExternalStore(..., sessions.sessionListSnapshot, ...)`, passing an
unbound prototype method; React called it with an undefined `this`, the render
threw, and DSH disabled the slot entry. `/side` still created a controller, but
nothing could render it.

Fix: the adapter accessor is now an arrow-bound property
(`sessions-adapter.ts`) and `SideChatSessionsOverlay` calls it through explicit
closures; a new regression spec (`tests/specs/client/sessions-adapter.spec.ts`)
asserts the detached accessor stays bound, and the overlay-test fake now uses an
unbound prototype method so the same mistake fails the suite.

Verification after the fix:

```text
node tools/test.mjs → exit 0, RESULT: PASS
27 test files / 189 tests: 189 passed, 0 failed, 0 skipped
built-bundle jsdom probe: 18/18 checks passed
built source and shipped package are byte-identical
dsh-side-chat/ version: 1.0.2-dsh0.2.1rc2.8
dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.8.tgz  (147,349 bytes)
installed profile copy: 1.0.2-dsh0.2.1rc2.8, hash-identical to dsh-side-chat/
live client Slots: shell.overlay occupant dsh-side-chat now active:true
lib/typert.js: byte-identical to published 1.0.2 (no wire change)
```

Lesson recorded in `tests/README.md`: any function passed directly as a
`useSyncExternalStore` getSnapshot/subscribe callback must be bound (arrow
property or closure).

## Hotfix — permanent composer notice (2026-10-20, build 1.0.2-dsh0.2.1rc2.9)

User report: after `/side` was invoked on a conversation that already had an
open Side Chat, the text "This conversation already has an open Side Chat."
stayed in the composer permanently.

Root cause is DSH notice semantics, not a missing dismiss call: the composer
renders `info` notices as a permanent inline banner (`notices` store is only
replaced, never auto-cleared) and only `error`-level notices become transient
toasts. The plugin's `notify()` maps `status → info` and `warning → error`, and
the `/side` already-open path used `status`.

Fix: command logic moved to `lib/client/dsh/side-chat-command.js`;
`/side` on an already-open conversation now focuses the existing panel via
`focusSideChatPanel()` and emits no notice. The expired-discussion auto-renewal
message in the controller switched from `status` to `warning` (transient toast).
A durable spec (`tests/specs/client/side-chat-command.spec.ts`) covers
open-draft, focus-existing/no-notice, and no-panel paths.

Verification:

```text
node tools/test.mjs → exit 0, RESULT: PASS
28 test files / 192 tests: 192 passed, 0 failed, 0 skipped
built-bundle jsdom probe: 18/18 checks passed
built source and shipped package are byte-identical
dsh-side-chat/ version: 1.0.2-dsh0.2.1rc2.9
dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.9.tgz  (148,093 bytes)
installed profile copy: 1.0.2-dsh0.2.1rc2.9, hash-identical to dsh-side-chat/
live client Slots: shell.overlay occupant dsh-side-chat active:true
lib/typert.js: byte-identical to published 1.0.2 (no wire change)
```

A notice already stuck in a running page belongs to DSH's in-memory composer
state; reload the page once after installing rc2.9 to clear it. The plugin no
longer creates that notice.

