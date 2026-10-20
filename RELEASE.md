# Release checklist — `@ahggg/dsh-side-chat` (DSH adaptation)

This project ships a **single tarball** that DeepSeek Harness installs through
its Plugin Manager: `dist/ahggg-dsh-side-chat-<PKG_VERSION>.tgz`, built from
`upstream/package` plus the local source/build overlays. This file is the
release runbook: quality gates → rebuild → reinstall → verification → GitHub
release.

Project root: `C:\Users\ahmet\Desktop\deepseek\plugins\sidechat` (the DSH profile
references the tarball by absolute path here; never move or rename the folder
without reinstalling).

---

## 0. Versioning

The package version is `<upstream-base>-dsh<DSH-version>rc<N>`, e.g.
`1.0.2-dsh0.2.1rc2.6`:

| Part | Meaning |
| --- | --- |
| `1.0.2` | upstream `@ahggg/dsh-side-chat` release the local build is based on |
| `dsh0.2.1rc2` | DeepSeek Harness runtime the build is re-targeted to (`0.2.1-rc.2`) |
| `.6` | local adaptation revision; increment for every rebuild that ships |

To cut a release:

1. Bump `PKG_VERSION` in `tools/adapt-package.mjs` (only the Lead/release owner
   edits this file). Do not change the upstream base or DSH version unless the
   DSH upgrade procedure in `AGENTS.md` is being followed.
2. Update `CHANGELOG.md` with what changed in this build.
3. Run the full gate in §1, rebuild in §2, reinstall in §3, verify in §4.
4. Confirm `dist/` contains **exactly one** tarball with the new version name;
   delete older tarballs (the profile references one file).
5. Publish the GitHub release in §5.

## 1. Quality gates (must pass before packaging)

Node 24 / npm 11 on Windows, project root. First run needs network for the npm
install; later runs reuse the `.scratch` cache. Expect a few minutes on the
first run and well under two minutes after.

```powershell
cd C:\Users\ahmet\Desktop\deepseek\plugins\sidechat
node tools/test.mjs
```

Required result: **exit code 0** and a `RESULT: PASS` summary. Current baseline
(after the session-identity/host-hardening overlays, the rc2.8 overlay-entry
binding fix, and the rc2.9 composer-notice fix) is **28 test files / 192 tests
passed (0 failed, 0 skipped)** — 133 upstream tests plus 59 local regression
tests — and **18/18** built-bundle probe checks. The harness also
warns that the built output differs from the currently shipped
`dsh-side-chat/` package until the new version (`PKG_VERSION` in
`tools/adapt-package.mjs`) is rebuilt and reinstalled. The harness:

- stages `upstream/source` + `src-overlays/src/**` into `.scratch/test-build`;
- installs the locked toolchain (`npm install --legacy-peer-deps
  --ignore-scripts`) and pins `rolldown@1.2.11` plus the two test peer
  supplements the upstream suite needs (`@testing-library/dom@^10`,
  `@deepseek-ai/dsh-scope@0.2.0-rc.2`);
- copies the durable regression specs from `tests/specs/**` into the scratch
  test tree and runs the **full vitest suite** (upstream tests + local specs);
- builds the plugin (`npm run build`) and runs the jsdom shipped-bundle probe
  (`tests/bundle/verify-shipped-bundle.mjs`) against the freshly built
  `lib/client.js`;
- additionally probes the currently shipped `dsh-side-chat/lib/client.js`
  (advisory) and warns when built output differs from the shipped package.

Useful variants: `--vitest-only`, `--bundle-only`, `--skip-build`,
`--fresh`, `--clean` (see `tests/README.md`). If the build-vs-shipped compare
warns, the package still needs a rebuild (§2) and reinstall (§3) — expected
while preparing a release.

Optional source sanity checks (already covered by the harness, cheap to rerun):

```powershell
node --check .scratch\test-build\lib\client.js
node --check dsh-side-chat\lib\client.js
```

## 2. Rebuild the adapted package + tarball

1. If any source overlays changed, rebuild `patches/lib/**` first using the
   reproducible recipe in `src-overlays/README.md` (`.scratch` build with
   `rolldown@1.2.11`, diff `lib/` against `upstream/package/lib`). Do not edit
   `dsh-side-chat/` or `patches/` by hand.
2. Recreate the adapted package and tarball:

```powershell
node tools/adapt-package.mjs
```

Expected: exit 0. The script recreates `dsh-side-chat/` from `upstream/package`,
applies `patches/lib/**`, retargets metadata to the installed DSH version,
writes `dsh-side-chat/ADAPTED.md`, and packs
`dist/ahggg-dsh-side-chat-<PKG_VERSION>.tgz` with `npm pack --ignore-scripts`.

3. Confirm:

```powershell
Get-ChildItem dist                                  # exactly one tarball, current version
Get-Content dsh-side-chat\package.json | Select-String 'version|engines'  # version + engines.dsh
```

`lib/typert.js` must stay byte-identical to published upstream 1.0.2 unless the
wire contract intentionally changed.

## 3. Install through the DSH Plugin Manager (remove, then install)

The DSH Desktop app must be running; the change applies live. Manage the plugin
only through the **Plugin Manager** (the `plugin_manager` tool in Creator-mode
sessions, or the Web **Plugins** page). Never hand-edit the profile
`package.json`, `cordis.patch.yml`, or `node_modules`, and never run pnpm in the
profile directory (`%USERPROFILE%\.dsh\profiles\desktop`).

1. `plugin_manager` action **`remove_bundle`**, target `@ahggg/dsh-side-chat`.
   Expected result: `application: "applied"`.
2. `plugin_manager` action **`install_bundle`**, target the absolute path of the
   new tarball, e.g.
   `C:\Users\ahmet\Desktop\deepseek\plugins\sidechat\dist\ahggg-dsh-side-chat-<PKG_VERSION>.tgz`.
   Installing over an already-installed package is refused — always remove
   first. Expected result: `application: "applied"`, the new version, and no
   warnings.

The profile dependency must point at the new tarball:

```powershell
node -e "console.log(require('C:/Users/ahmet/.dsh/profiles/desktop/package.json').dependencies['@ahggg/dsh-side-chat'])"
```

## 4. Verification checklist

### 4.1 Static / install

- [ ] `node tools/test.mjs` ended `RESULT: PASS` (vitest 0 failed, bundle probe
      all checks passed).
- [ ] `dist/ahggg-dsh-side-chat-<PKG_VERSION>.tgz` exists and only that tarball
      is in `dist/`.
- [ ] `dsh-side-chat/package.json` has the expected `version` and
      `engines.dsh: "0.2.1-rc.2"`.
- [ ] Installed copy in `%USERPROFILE%\.dsh\profiles\desktop\node_modules\@ahggg\dsh-side-chat`
      hash-matches the package for key files (`lib/client.js`,
      `lib/host/read-only-chat-service.js`, `package.json`,
      `cordis.patch.yml`, `ADAPTED.md`). Example:
      `(Get-FileHash <a>,<b>).Hash` for each pair.
- [ ] Install result was `application: "applied"` with empty `warnings`.

### 4.2 Host live (via `cordis_inspect_query`)

- [ ] platform `host`, provider `Config`, method `listConfigs`, input
      `{"name":"@ahggg/dsh-side-chat"}` returns the entry `include:side-chat`.
      (`status: "absent"` means "no Config schema", not "not loaded".)

### 4.3 Client live (via `cordis_inspect_query`)

- [ ] platform `client`, provider `Slots`, method `listSubTree`, input
      `{"root":"shell.overlay"}` lists the occupant
      `{registrant:"side-chat-client", id:"dsh-side-chat", order:90, active:true}`.

Reload the DSH window after reinstalling before the interactive tests.

### 4.4 Interactive smoke test (needs the user's authenticated DSH window)

A fresh browser gets `dsh web authentication required`, so agents cannot drive
the authenticated GUI; ask the user to perform/confirm these:

- [ ] **Selection path** — select text inside a completed message, click
      **Ask in side chat**, send a short question, confirm streaming, optionally
      **Add to conversation**, close with `×`/`Esc`.
- [ ] **`/side` path** — type `/side`, confirm the menu row, press `Enter`: the
      panel opens and nothing is sent to the main chat. Ask something only the
      newest parent turn would know (e.g. "what was the last thing I said?");
      the answer must reflect the latest committed parent context.
- [ ] **Refresh** — with a discussion open, click **Refresh** (header, left of
      *Add to conversation*): the panel reopens as an empty draft for the same
      conversation, previous messages are gone, and a new question answers from
      the latest parent context.
- [ ] **Panel UI** — drag the header bar (title included; not the Refresh/Add/
      Close buttons) to move; resize from top/right/bottom/left edges and the
      top-left/bottom-right corners; double-click the header to reset; geometry
      survives a page reload.
- [ ] **Per-conversation lifecycle** — open side chats in two main
      conversations with different positions/sizes. Switch away: the hidden
      conversation's panel must not float over the new one. Open a side chat in
      the second conversation, switch back: the first transcript, position, and
      size must be exactly as left; switching again restores the second.

### 4.5 Regression evidence

Record the exact `node tools/test.mjs` summary (vitest counts + probe check
count) and today's date in `tests/README.md`'s "Last verified" line when
cutting the release, and append any new verification evidence to
`analysis/build-validation.md`.

## 5. GitHub release

Repository: <https://github.com/AHGGG/dsh-side-chat> (upstream). The local
adaptation is published from this workspace; keep the release notes clear about
what is upstream and what is local.

1. Commit the release state (`CHANGELOG.md`, `RELEASE.md`, `tests/**`,
   `tools/test.mjs`, `src-overlays/**`, `patches/**`, `tools/adapt-package.mjs`,
   regenerated `dsh-side-chat/**` and `dist/*.tgz`) once the gates pass. This
   workspace is not a git checkout by itself; if no repository/remote exists
   yet, initialize it (or apply these files to the release repository) before
   tagging so the tag points at the verified tree.
2. Create an annotated tag `v<PKG_VERSION>` (for example
   `v1.0.2-dsh0.2.1rc2.6`) on the release commit and push it.
3. Create the GitHub release for that tag; attach
   `dist/ahggg-dsh-side-chat-<PKG_VERSION>.tgz` as the release asset.
4. Release notes: copy the matching `CHANGELOG.md` section, state the DSH
   runtime version the build targets (`0.2.1-rc.2`) and the required install
   path (DSH Plugin Manager; remove then install), and link:
   - upstream project/release: <https://github.com/AHGGG/dsh-side-chat>
     (base release `1.0.2`);
   - the upstream MIT license (see §6).
5. Verify the asset downloads and its SHA-256 matches the local tarball
   (`Get-FileHash dist/*.tgz -Algorithm SHA256`).

## 6. License and attribution

- The upstream project is **MIT licensed**; its `LICENSE` file is preserved
  unchanged in the adapted package (`dsh-side-chat/LICENSE`, packed into the
  tarball) and in the vendored snapshot.
- Local changes are a derivative work of that MIT-licensed project. Keep the
  upstream copyright notice intact; new local code is distributed under the same
  MIT terms. Every `ADAPTED.md` states the upstream source
  (`https://github.com/AHGGG/dsh-side-chat`, MIT) and the base version.
- The GitHub release notes and `README.md` must keep the upstream link and MIT
  attribution.

## 7. Known limits (document, do not “fix” by hiding)

- Read-only, text-only discussion; no tools, filesystem access, or child
  Session. Selection must live inside one completed message.
- `/side` context ends at the newest **committed** parent event; assistant text
  that is still streaming is not in the log yet. Opening `/side` mid-turn can
  therefore miss the tail of the in-flight reply.
- The `/side` command relies on DSH's `commandUi` surface and a collision-free
  `side` command name. A future DSH host `/side` command would make candidacy
  fail loudly; rename/decorate the contribution then.
- Panel geometry is browser-local `localStorage` (per conversation), not a user
  setting; it does not sync between clients and is clamped to the viewport.
- Host keeps at most 8 concurrent side discussions per client (16 total);
  idle discussions expire after 30 minutes. Hidden conversations keep client
  controllers alive, so a hidden discussion whose Host copy expired reports
  `side_chat_not_found` on the next send — **Refresh** renews it.
- Refresh discards the current discussion (including a running reply's partial
  state) and reopens an empty draft; it keeps the panel/geometry.
- `ctx.sessions.retain(id, {source:'sideChat'})` uses a source string outside
  DSH's closed `SessionReferenceSource` type (runtime accepts it; strict
  type-checking against newer DSH types would need an augmentation/cast).
- The selection path depends on DSH `ChatNode`/`ConversationLocation`
  internals — the most likely breakage point after a DSH upgrade.
- Upstream product limits still apply: 2-minute request timeout, 2 MB context
  cap, 256 KB reply cap, 64 questions per discussion, 64 KB question cap.

## 8. Rollback / troubleshooting

- **Bad release**: remove the bundle, install the previous tarball from `dist/`
  (keep the previous version tarball until the new one is verified), and state
  the rollback in the release notes.
- **Install refused**: install only after `remove_bundle`; confirm the tarball
  path is absolute and the file exists.
- **Selection bar missing after a DSH upgrade**: start with
  `lib/client/selection/*` and compare `ChatNode`/`ConversationLocation` shapes
  against the new DSH declarations; the panel itself can still open through the
  overlay path.
- **`/side` missing**: check `ctx.commandUi` availability and
  `dsh.client.inject` ordering; the plugin keeps mounting lazily without the
  command surface.
- **Harness failures**: rerun with `node tools/test.mjs --fresh`; if npm
  resolution is the problem, delete `.scratch/test-build/node_modules` and rerun
  (needs network). The npm cache stays in `.scratch/npm-cache`.
