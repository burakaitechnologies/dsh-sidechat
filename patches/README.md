# `patches/` — durable out-of-tree changes

`tools/adapt-package.mjs` regenerates `dsh-side-chat/` from the untouched
`upstream/package/` snapshot on every build, so direct edits inside
`dsh-side-chat/` are **overwritten**. Put any change that must survive a
rebuild here instead, mirroring the package layout:

```text
patches/
  lib/host/read-only-chat-service.js   -> dsh-side-chat/lib/host/read-only-chat-service.js
  lib/client/selection/selection-normalizer.js
  ADAPTED.md                            -> dsh-side-chat/ADAPTED.md
```

The build script copies every top-level entry from this folder over the
generated package (patches win), except `README.md` and dotfiles, which are
tooling documentation and stay out of the package.

## What lives here now

`patches/lib/**` is the output of the project's **source-level feature build**
(`/side` command, latest-context host cut, draggable/resizable panel,
per-conversation side chats with authoritative session identity, the
host-side context/identity hardening, and the rc2.9 command/notice fix). It is
regenerated from `src-overlays/` following `src-overlays/README.md` (or, faster,
`node tools/test.mjs` builds and validates the same sources): copy the vendored
source, overlay `src-overlays/src/**`, build with the upstream toolchain pinned
to `rolldown@1.2.11`, then copy every `lib/**` file that differs from
`upstream/package/lib` into `patches/lib/**` at the same relative path. Because
untouched files rebuild byte-identically, only the genuinely changed files are
listed here — 27 files at rc2.9, including `lib/client.js`,
`lib/client/dsh/side-chat-command.js`,
`lib/client/dsh/SideChatSessionAnchor.js`, `lib/client/dsh/sessions-adapter.js`,
`lib/client/side-chat-manager.js`, the panel/controller overlays, and
`lib/host/read-only-chat-service.js`. `lib/typert.js` is intentionally **not**
patched (the wire contract is unchanged and the file stays byte-identical to
published 1.0.2).

Rules:

- Prefer a source change in `src-overlays/` + regeneration over hand-editing
  built files; use a direct `patches/lib/**` edit only for an emergency hotfix,
  and then mirror it into `src-overlays/` so the next source build keeps it.
- Keep changes minimal and focused on a concrete DSH compatibility fix, bug
  fix, or documented local feature.
- Record what changed and why in `ADAPTED.md` (the generated text lives in
  `tools/adapt-package.mjs`).
- Bump `PKG_VERSION` in `tools/adapt-package.mjs` when a patch changes shipped
  behavior, so the installed bundle version identifies the build.
- Rebuild, reinstall, and verify after every patch; see `AGENTS.md`.
- Do not use this folder for unrelated experiments. `upstream/` is never edited.
