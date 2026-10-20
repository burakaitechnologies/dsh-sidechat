# Side Chat plugin for DeepSeek Harness

A **fork/adaptation** of [`@ahggg/dsh-side-chat`](https://github.com/AHGGG/dsh-side-chat)
(MIT), re-targeted to DeepSeek Harness **0.2.1-rc.2** and extended with the
`/side` command, latest-committed-context snapshots, a draggable/resizable
panel, header Refresh, and per-conversation side chats with authoritative
session binding and host-side context hardening.

This repository is self-contained: runtime source overlays
(`src-overlays/`), the built package (`dsh-side-chat/`), durable tests
(`tests/`), the release tarball (`dist/`), and the reproducible build/audit
tooling. The `desktop` profile on the author's machine has the current tarball
installed; the public install steps below are for any other machine.

## Install (DSH `0.2.1-rc.2`)

The package declares `engines.dsh: "0.2.1-rc.2"` and is intentionally refused
on other DSH versions (its host/client API use is audited only against that
runtime).

1. Install/update **DeepSeek Harness Desktop** to `0.2.1-rc.2`.
2. Download `dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.10.tgz` from the GitHub
   Release (or build it locally, see below).
3. Open DSH → **Plugins**: if an older `@ahggg/dsh-side-chat` is installed,
   remove it first, then install the tarball as a local bundle.
4. Reload the DSH window once and check the Plugins page shows
   `1.0.2-dsh0.2.1rc2.10`.
5. Open a conversation with at least one completed turn and type `/side` (or
   select text and use **Ask in side chat**).

Release notes: [CHANGELOG.md](CHANGELOG.md). Maintainer release steps and known
limits: [RELEASE.md](RELEASE.md). The rest of this README describes the
repository itself and the local development workflow.

## What Side Chat does

Open a focused, read-only side discussion in a floating panel without touching
the main conversation. It makes **direct model calls** — no new Session, no
agent, no tools, no file access — and "Add to conversation" copies the
discussion into the main composer as a reference.

Two ways to open it:

- **Selection** — select text inside one completed message and use **Ask in
  side chat** / **More details**. The panel gets a snapshot of the parent
  conversation up to that completed turn.
- **`/side` command** — type `/side` in the composer and press `Enter` (or pick
  **Side chat** from the `/` menu). The panel opens with a snapshot of the
  **newest committed parent context**, including the latest user message and
  the tool activity the agent performed after it. No message is sent to the
  main conversation.

The panel is **draggable from anywhere on its header bar** (title included; the
refresh, add-to-conversation, and close buttons keep their click behavior) and
**resizable from every edge** (top, right, bottom, left) plus both corner
handles (top-left and bottom-right). Its position/size are remembered **per
conversation** in the browser (`localStorage`); double-click the header to
reset. A conversation without remembered geometry opens the panel as a compact
**top-right** panel (half the previous width and two-thirds the previous height).

The header's **Refresh** button discards the current side discussion and
reopens a fresh draft for the same conversation — the next question gets a new
snapshot of the latest committed context (equivalent to closing the panel and
running `/side` again, but keeping the panel geometry). Refresh always renews
the conversation the panel is bound to; it never falls back to another session.

**Side chats are per conversation and bound authoritatively.** Open one in
session A, chat with it, then switch to session B and open another — each
session keeps its own transcript, host discussion, panel position/size, and
model preference. The panel is rendered only for the conversation the main view
is actually showing (reported by DSH's session scope, not by retention-counter
guessing), and a side chat bound to a different conversation is refused.
Switching back to session A shows exactly that side chat as you left it, still
running if a reply was streaming. A session with no side chat shows no panel;
`/side` starts one.

## Folder layout

| Path | Contents |
| --- | --- |
| `AGENTS.md` | Orientation and working rules for AI agent sessions that use this folder as their workspace. |
| `dsh-side-chat/` | The adapted plugin package (what DSH installs). `lib/` is the built runtime; `package.json` is re-targeted for DSH 0.2.1-rc.2 with `engines.dsh`; `locale/` + `icon.svg` add Plugins-page display metadata. See `dsh-side-chat/ADAPTED.md`. |
| `dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.10.tgz` | Packed tarball of `dsh-side-chat/`. This is the file the DSH profile references; keep it in sync with `dsh-side-chat/` (rebuild with the script below). |
| `upstream/` | Unmodified upstream artifacts: published npm tarball `1.0.2`, its extracted package, the GitHub source tree, and the source archive. Never edit. |
| `src-overlays/` | Durable source-level changes on top of the upstream TypeScript snapshot (the `/side` command, latest-context cut, drag/resize panel, per-conversation identity and host hardening). Full replacements, plus the reproducible build steps. |
| `patches/` | Built-file overlays applied to the package generated from `upstream/package` (applied last, so they win). See `patches/README.md`. |
| `tests/` | Durable regression suite: 8 local spec files plus a jsdom probe of the shipped bundle. See `tests/README.md`. |
| `tools/adapt-package.mjs` | Rebuild script: copies `upstream/package`, re-targets compatibility/display metadata, overlays `patches/`, and repacks `dist/` (`npm pack --ignore-scripts`). |
| `tools/test.mjs` | One-command release gate: stage + build from `src-overlays/`, run the full vitest suite (vendored + local), probe the built/shipped bundle, compare build output with the shipped package. |
| `tools/asar-reader/` | Read-only helper that inspects the installed DSH `app.asar` (Electron archive): `node tools/asar-reader/asar.mjs list\|read\|grep\|save ...`. |
| `analysis/compat-report.md` | Static audit of every DSH API the plugin uses against DSH 0.2.1-rc.2, with file:line evidence and risk notes. |
| `analysis/hardening-plan.md` | Release-hardening audit: workstreams, findings/dispositions, verified invariants, release gates. |
| `CHANGELOG.md` / `RELEASE.md` | Release history and the publish/verify/rollback checklist. |
| `analysis/npm/extracted/` | Published DSH 0.2.1-rc.2 type declarations used as audit evidence. |

## Why the plugin needed adapting

The published 1.0.2 package pins every DSH peer to `0.2.0-rc.2`. DSH's
compatibility gate rejects a plugin whose declared DSH requirement does not
match the running runtime, so a straight install on DSH 0.2.1-rc.2 was
refused. The audit (`analysis/compat-report.md`) showed every host and client
API the plugin uses still exists in 0.2.1-rc.2. This copy therefore changes:

- metadata — `version` → `1.0.2-dsh0.2.1rc2.10`, `engines.dsh` →
  `0.2.1-rc.2`, DSH peer/dev versions, `dsh.compatibility` /
  `dshCompatibility`, added `locale/*.json` + `icon.svg`, and added
  `@deepseek-ai/dsh-client-ui-commands` to `dsh.client.inject` (boot order for
  the `/side` command surface);
- runtime — the features above, built from `upstream/source` with the
  upstream build config and overlaid from `patches/lib/**`.

Every other runtime file is byte-identical to published 1.0.2 (the rebuild
pins the `rolldown@1.2.11` version locked by upstream). See
`dsh-side-chat/ADAPTED.md`.

## Rebuild and reinstall

Metadata-only rebuild (fast, uses `upstream/package` + `patches/`):

```powershell
node tools/adapt-package.mjs
```

Source-level rebuild (after changing `src-overlays/`): follow
`src-overlays/README.md` — it installs the vendored toolchain, rebuilds
`lib/`, and refreshes `patches/lib/**`.

Before packaging a release, run the durable gate:

```powershell
node tools/test.mjs
```

It stages `upstream/source` + `src-overlays/`, builds with the locked
`rolldown@1.2.11`, runs the full vitest suite (vendored upstream tests + the
local regression specs in `tests/specs/`), probes the built `lib/client.js` in
jsdom, and compares the build output with `dsh-side-chat/`. A release requires
`RESULT: PASS` (at the time of writing: 28 test files / 192 tests, 20/20 probe
checks).

Then reinstall the bundle through DSH's Plugin Manager (Web: sidebar **Plugins**
→ remove/reinstall, or ask the agent to run `plugin_manager` with the new
`dist/*.tgz` path). Installing over an installed package is refused, so remove
first, then install the new tarball.

The installed profile dependency is:

```text
@ahggg/dsh-side-chat -> file:C:/Users/ahmet/Desktop/deepseek/plugins/sidechat/dist/ahggg-dsh-side-chat-1.0.2-dsh0.2.1rc2.10.tgz
```

Moving or renaming this folder would break that path; either keep it here or
reinstall from the new location.

## Use it

1. Complete at least one turn in a conversation (required for both paths).
2. Either select text inside one completed user/assistant message and use
   **Add to chat**, **More details**, or **Ask in side chat**, or type `/side`
   in the composer and press `Enter`. If that conversation already has an open
   Side Chat, `/side` brings the existing panel into focus instead of opening a
   duplicate or leaving a notice behind.
3. Type a follow-up and press `Enter` (Shift+Enter = newline).
4. Use the model control next to Send to pick model + reasoning effort; changes
   apply to later replies in this side chat only.
5. Drag anywhere on the header bar (title included, but not the refresh/add/
   close buttons) to move the panel; drag any edge or the top-left/bottom-right
   corner to resize (the resize zones are invisible — the cursor changes when
   you are on one); double-click the header to reset. Geometry is remembered
   per conversation.
6. Switch main conversations freely: each one keeps its own side chat and
   geometry while hidden.
7. **Refresh** (header, left of Add to conversation) closes the current side
   discussion and opens a fresh draft for the same conversation, so a later
   question sees the newest parent context. Anything unsaved is discarded, just
   like closing and reopening.
8. **Add to conversation** copies the side discussion into the main composer;
   `×` or `Esc` closes the panel.

Limits: text-only, read-only, one message per selection, 2-minute request
timeout, discussion is discarded when the panel closes (unless added to the
conversation). The Host keeps up to 8 concurrent side discussions per browser
client (16 total) and expires idle ones after 30 minutes. Opening a new
conversation's side chat recycles the client's oldest idle discussion instead of
failing; if a hidden panel's discussion expires, its next send automatically
renews a fresh draft (with a notice) and **Refresh** also renews it. `/side`
context ends at the newest **committed** parent event: assistant text that is
still streaming becomes visible only after that turn settles.

The DSH Web GUI itself requires the authenticated URL printed by `dsh web`
(a fresh browser shows `dsh web authentication required`); that page is DSH's
own guard, not part of this plugin. Use the app window or the authenticated URL
for interactive testing.

## Upgrading DSH later

`engines.dsh` is pinned to `0.2.1-rc.2`. After a DSH upgrade the plugin will be
skipped until re-targeted: update `DSH_VERSION` in `tools/adapt-package.mjs`,
re-audit `ctx.commandUi` / `sessionQuery` usage in `analysis/compat-report.md`,
rebuild (metadata and, if the source overlays still compile, source-level),
and reinstall the new tarball.
