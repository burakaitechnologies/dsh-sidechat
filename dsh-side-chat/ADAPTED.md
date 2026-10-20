# Adapted build

This directory is a local adaptation of `@ahggg/dsh-side-chat@1.0.2`
(https://github.com/AHGGG/dsh-side-chat, MIT) for DeepSeek Harness
`0.2.1-rc.2`.

## Metadata

- `version`: `1.0.2-dsh0.2.1rc2.11` (local adaptation marker)
- `engines.dsh`: `0.2.1-rc.2`
- DSH `peerDependencies` retargeted from `0.2.0-rc.2` to `0.2.1-rc.2`
- `dsh.compatibility` / `dshCompatibility` declare `0.2.1-rc.2`
- `dsh.client.inject` additionally names `@deepseek-ai/dsh-client-ui-commands`
  (boot-order declaration for the `/side` command surface)
- added `locale/*.json` and `icon.svg` display metadata

## Runtime adaptations

The upstream TypeScript source (v1.0.2, commit `8d463ea`) was rebuilt with the
upstream build configuration, and every changed output file is overlaid from
`patches/lib/**`. Behavior added on top of 1.0.2:

- `/side` client command (DSH `ctx.commandUi` action contribution): opens the
  existing Side Chat panel for the current conversation and discusses a
  read-only snapshot cut at the **newest committed parent event**, so the
  latest parent turn and the agent's committed tool activity are included (not
  just the selected completed turn).
- The Side Chat panel can be dragged from anywhere on its header bar (title
  included; the add-to-conversation and close buttons keep their click
  behavior) and resized from all four edges plus the top-left and bottom-right
  corner handles. The resize zones are invisible (cursor feedback only); the
  geometry is remembered in `localStorage` and can be reset by
  double-clicking the header.
- A **Refresh** button in the panel header (icon + label, left of Add to
  conversation) closes the current discussion and reopens a fresh draft for the
  same parent conversation. The next question therefore captures the latest
  committed parent context, exactly like closing the panel and running
  `/side` again, while the panel geometry is kept.
- **Side Chat is per conversation.** Each main session keeps its own panel,
  transcript, host discussion, and remembered geometry while hidden. The
  active conversation is reported by a main-only DSH session-scope anchor
  (`conversation.session.header.actions`), not by a retention-counter scan, and
  a panel can only render the conversation it was opened for; switching main
  conversations shows that session's side chat (or no panel if it has none)
  without closing the other sessions' discussions. The Host admits up to 8
  concurrent side discussions per client (16 total; idle discussions expire
  after 30 minutes) and recycles the client's oldest idle discussion instead of
  dead-ending a new conversation; an expired discussion auto-renews as a fresh
  draft.
- Selection-based `Ask in side chat` / `More details` keep the original
  completed-turn context semantics, always bound to the explicitly captured
  conversation.
- Hardening: the Host verifies that the frozen context belongs to the requested
  session id (and that the log prefix is contiguous) before admitting a
  discussion; the frozen context records the parent session id and
  `inheritedEvents` provenance (fork/branch seeds); a Host discussion bound to
  another conversation is refused instead of answered.
- The panel opens by default as a compact panel **just above the main composer
  input box, right-aligned with that input box** (half the previous width,
  two-thirds the previous height), re-measured while the composer/window
  resizes, while remembering any user-moved or resized geometry per
  conversation. The header no longer prints the parent session title (the panel
  always belongs to the conversation in view).
- The panel draft takes focus only when the panel was opened from a text-entry
  context, so switching conversations no longer steals focus from the main
  composer; drag geometry is persisted even if the panel closes mid-drag and can
  sync between browser tabs.

All other runtime files are byte-identical to the published 1.0.2 package:
the source rebuild used the exact `rolldown@1.2.11` pinned in upstream's
`pnpm-lock.yaml`. Reproducible source overlays and build steps live in the
project's `src-overlays/`; the built-file overlays are `patches/lib/**`.

Rebuild with `node tools/adapt-package.mjs`.
