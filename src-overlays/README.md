# `src-overlays/` — source-level changes on top of the upstream snapshot

`upstream/source/` is a **read-only vendor snapshot** of the upstream
TypeScript project (v1.0.2, commit `8d463ea7410bcb0b4e76a2d11d5b848d04fc0086`).
The files here are full replacements for their counterparts under
`upstream/source/`; they carry the plugin behavior that the adapted package
ships.

| Overlay file | What it changes |
| --- | --- |
| `src/shared/constants.ts` | Adds `LATEST_AT_SEQ` (wire-compatible sentinel for the newest context cut). |
| `src/host/read-only-chat-service.ts` | `create` accepts the sentinel and cuts the parent context at the newest committed event (`observation.cursor`) instead of a completed-turn boundary. Selection requests keep the old behavior. Per-client discussion cap raised from 2 to 8 (`MAX_DISCUSSIONS_PER_OWNER`, total 16 unchanged) with LRU recycling of the oldest idle discussion. Adds a host identity guard (`observation.header.id === request.parentSessionId`, observation lease released in `finally`), a contiguous-prefix guard before folding, model-preparation failures mapped to `side_chat_model_failed`, per-owner pending-create counting, and `parentSessionId`/`inheritedEvents` provenance in the frozen context. |
| `src/client/side-chat-controller.ts` | A draft opened without a selection (the `/side` path) sends `LATEST_AT_SEQ`; adds `refresh()` (close + fresh draft for the same explicit parent, never an implicit current-session fallback); selection parents take precedence from the selection; a Host discussion bound to another conversation is refused; expired (`side_chat_not_found`) discussions auto-renew a fresh draft; `dispose()` bumps the model generation. |
| `src/client/side-chat-manager.ts` | Keeps one independent `SideChatController` per parent conversation, tracks the authoritative active session from the anchor (`activate`/`deactivate`, refcounted), and prunes controllers for vanished sessions (`reconcile`). |
| `src/client/apply.ts` | Registers the `/side` client command through DSH's `ctx.commandUi` action contribution (collision-safe), mounts the session-aware overlay host, registers the active-session anchor in the main-only `conversation.session.header.actions` slot, and disposes all per-session controllers. |
| `src/client/dsh/context.ts` | Local structural types for the `commandUi` client service (DSH ships no plugin-facing type declarations for it). |
| `src/client/dsh/SideChatOverlay.tsx` | Wires the header Refresh action, forwards an optional per-conversation geometry key, uses the authoritative `sessionId` passed by the host (capture/actions), and passes explicit parents for selection actions. |
| `src/client/dsh/SideChatSessionAnchor.tsx` | Invisible session-scope anchor: reports mount/unmount of the main-view conversation to the manager (authoritative identity source). |
| `src/client/dsh/SideChatSessionsOverlay.tsx` | Renders only the active conversation's Side Chat overlay (keyed per session), uses `manager.activeSessionId` over the retention scan, passes the authoritative session id, refuses a controller bound to another conversation, lazily creates controllers, and reconciles the controller set with the session catalog. |
| `src/client/dsh/sessions-adapter.ts` | Adds `sessionListSnapshot()` for controller reconciliation (otherwise the upstream adapter); the accessor is arrow-bound because it is consumed directly by `useSyncExternalStore`. |
| `src/client/dsh/side-chat-command.ts` | The `/side` command body: opens a draft with an explicit parent, or focuses the existing panel when the conversation already has one (no permanent DSH info notice); extracted so it can be unit-tested without the DSH command registry. |
| `src/client/panel/SideChatPanel.tsx` | Draggable/resizable panel geometry with a compact top-right default (420px / two-thirds height when nothing is stored): header-bar drag, four edge handles, top-left/bottom-right corner handles, opposite-edge-anchored resizing, persisted in `localStorage` under a per-conversation key; reloads on storage-key change, migrates the legacy global key once, syncs across tabs, clamps tiny viewports, persists mid-drag unmounts, avoids focus theft, and forwards the Refresh action. |
| `src/client/panel/SideChatHeader.tsx` | Whole-header-bar drag handle (title included; add/close buttons excluded, title click-vs-drag slop), double-click-to-reset, Refresh button (icon + label) left of Add to conversation. The header no longer prints the parent session title. |
| `src/client/panel/messages.ts` | Drag-hint, Refresh copy, and localized live-region announcements (English, Simplified Chinese). |
| `src/client/panel/side-chat.css` | Compact top-right default panel geometry (half-width, two-thirds height), header drag cursor, six invisible resize zones (cursor-only, no visible marks), Refresh button styling, geometry overrides. |

## Rebuilding the adapted package from these overlays

Fast path — the durable harness performs the build, copies the changed outputs
into `patches/lib/**` semantically (build + diff gate), and runs the full
regression suite:

```powershell
node tools/test.mjs
```

The manual reproduction (useful when auditing the harness) is a one-off
maintenance step; the shipped result is committed in `patches/lib/**` and
`dist/*.tgz`. Reproduce it on Windows with Node 24 + npm:

```powershell
# from the project root
cd C:\Users\ahmet\Desktop\deepseek\plugins\sidechat
$cache = (Resolve-Path .).Path + '\.scratch\npm-cache'

# 1. fresh copy of the vendored source
New-Item -ItemType Directory -Force .scratch | Out-Null
Copy-Item -Recurse -Force upstream\source .scratch\build

# 2. overlay the files in this folder
Get-ChildItem src-overlays\src -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path src-overlays).Path.Length + 1)
  $dest = Join-Path .scratch\build $rel
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Copy-Item $_.FullName $dest -Force
}

# 3. install exactly the locked toolchain and build
$env:npm_config_cache = $cache
Set-Location .scratch\build
npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm install --no-save rolldown@1.2.11 --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run build

# 4. copy every output that differs from the published 1.0.2 package to patches/lib
Set-Location ..\..
$built = (Resolve-Path .scratch\build\lib).Path
$published = (Resolve-Path upstream\package\lib).Path
$patchLib = Join-Path (Resolve-Path .).Path 'patches\lib'
# Recreate the overlay set so files that became identical again do not linger.
if (Test-Path $patchLib) { Remove-Item -Recurse -Force $patchLib }
Get-ChildItem $built -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($built.Length + 1)
  $old = Join-Path $published $rel
  $changed = -not (Test-Path $old) -or ((Get-FileHash $_.FullName).Hash -ne (Get-FileHash $old).Hash)
  if ($changed) {
    $dest = Join-Path 'patches\lib' $rel
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    Copy-Item $_.FullName $dest -Force
  }
}

# 5. bump PKG_VERSION in tools/adapt-package.mjs, then regenerate package + tarball
node tools/adapt-package.mjs
```

`rolldown@1.2.11` is the exact version pinned by upstream's `pnpm-lock.yaml`.
With it, rebuilding the untouched source reproduces the published `1.0.2`
`lib/` byte-for-byte, so `patches/lib/**` contains only files that this
feature actually changed. Without the pin, 2 minifier-codegen-only differences
appear (`client.js`, `typert.js`) and would be overlaid needlessly.

Sanity checks after step 4: `dsh-side-chat/lib/client.js` should still start
with `window.__ModuleLoader__.load({id:`@ahggg/dsh-side-chat`,factory:...` and
`node --check dsh-side-chat/lib/client.js` must pass. After step 5, reinstall
the new tarball through the DSH Plugin Manager (see `AGENTS.md`).
