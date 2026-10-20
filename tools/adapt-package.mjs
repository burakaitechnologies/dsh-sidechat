// Build an adapted copy of @ahggg/dsh-side-chat 1.0.2 that targets the
// installed DSH 0.2.1-rc.2 runtime. Copies the published npm package, updates
// only compatibility metadata, adds display metadata (locale + icon), and
// packs a local tarball the DSH Plugin Manager can install.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Layout: <sidechat>/tools/adapt-package.mjs  =>  ROOT is <sidechat>/
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'upstream', 'package');
const OUT_DIR = path.join(ROOT, 'dsh-side-chat');
const DIST = path.join(ROOT, 'dist');
const PKG_VERSION = '1.0.2-dsh0.2.1rc2.9';
const DSH_VERSION = '0.2.1-rc.2';

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(path.dirname(OUT_DIR), { recursive: true });
cpSync(SRC, OUT_DIR, { recursive: true });

const pkgPath = path.join(OUT_DIR, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

pkg.version = PKG_VERSION;

// DSH 0.2.1+ prefers an explicit engines.dsh range for third-party plugins.
// When present, the compatibility gate uses it instead of peer ranges.
pkg.engines = { ...(pkg.engines ?? {}), dsh: DSH_VERSION };

// Re-target the exact DSH peer versions to the runtime we build against.
for (const section of ['peerDependencies', 'devDependencies']) {
  const deps = pkg[section];
  if (!deps) continue;
  for (const name of Object.keys(deps)) {
    if (name.startsWith('@deepseek-ai/dsh')) deps[name] = DSH_VERSION;
    else if (name === '@deepseek-ai/cordis') deps[name] = '~4.0.5';
  }
}
if (pkg.peerDependencies?.['@deepseek-ai/cordis']) {
  pkg.peerDependencies['@deepseek-ai/cordis'] = '~4.0.5';
}

// Store / plugin-page compatibility declaration.
pkg.dsh = {
  ...pkg.dsh,
  compatibility: {
    dsh: DSH_VERSION,
    dshReleases: { [DSH_VERSION]: 'compatible' },
  },
};
pkg.dshCompatibility = { testedVersions: [DSH_VERSION] };

// The `/side` client command registers into the Web client's command surface
// (`ctx.commandUi`, supplied by @deepseek-ai/dsh-client-ui-commands). Declaring
// the supplier here keeps the client-module boot order deterministic; the
// plugin still mounts when the service is absent thanks to its lazy injection.
if (Array.isArray(pkg.dsh?.client?.inject)
  && !pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-commands')) {
  pkg.dsh.client.inject.push('@deepseek-ai/dsh-client-ui-commands');
}

// Display metadata for the Plugins page and plugin inventory rows.
pkg.icon = 'icon.svg';
pkg.exports = {
  ...pkg.exports,
  './locale/*.json': './locale/*.json',
  './icon': './icon.svg',
};
pkg.files = [...new Set([...(pkg.files ?? []), 'locale/*.json', 'icon.svg', 'ADAPTED.md'])];

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

mkdirSync(path.join(OUT_DIR, 'locale'), { recursive: true });
writeFileSync(
  path.join(OUT_DIR, 'locale', 'en.json'),
  JSON.stringify(
    {
      meta: {
        title: 'Side Chat',
        description: 'Ask focused follow-ups in a side panel: select text, or run /side to discuss the latest conversation context, without interrupting the main chat.',
      },
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  path.join(OUT_DIR, 'locale', 'zh-CN.json'),
  JSON.stringify(
    {
      meta: {
        title: '侧边对话',
        description: '在侧边面板中追问：选中文字，或输入 /side 基于对话最新内容追问，不打断主对话。',
      },
    },
    null,
    2,
  ) + '\n',
);

// Original minimal artwork: a speech bubble with two chat lines.
writeFileSync(
  path.join(OUT_DIR, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="Side Chat">
  <rect x="3" y="5" width="20" height="16" rx="5" fill="#4C6FFF"/>
  <path d="M8 21v5l6-5" fill="#4C6FFF"/>
  <rect x="8" y="10" width="10" height="2" rx="1" fill="#fff"/>
  <rect x="8" y="14" width="7" height="2" rx="1" fill="#fff"/>
  <rect x="21" y="13" width="8" height="12" rx="4" fill="#B9C6FF"/>
  <path d="M25 25v4l-4-4" fill="#B9C6FF"/>
  <circle cx="25" cy="17" r="1.4" fill="#fff"/>
  <circle cx="25" cy="21" r="1.4" fill="#fff"/>
</svg>
`,
);

writeFileSync(
  path.join(OUT_DIR, 'ADAPTED.md'),
  `# Adapted build

This directory is a local adaptation of \`@ahggg/dsh-side-chat@1.0.2\`
(https://github.com/AHGGG/dsh-side-chat, MIT) for DeepSeek Harness
\`${DSH_VERSION}\`.

## Metadata

- \`version\`: \`${PKG_VERSION}\` (local adaptation marker)
- \`engines.dsh\`: \`${DSH_VERSION}\`
- DSH \`peerDependencies\` retargeted from \`0.2.0-rc.2\` to \`${DSH_VERSION}\`
- \`dsh.compatibility\` / \`dshCompatibility\` declare \`${DSH_VERSION}\`
- \`dsh.client.inject\` additionally names \`@deepseek-ai/dsh-client-ui-commands\`
  (boot-order declaration for the \`/side\` command surface)
- added \`locale/*.json\` and \`icon.svg\` display metadata

## Runtime adaptations

The upstream TypeScript source (v1.0.2, commit \`8d463ea\`) was rebuilt with the
upstream build configuration, and every changed output file is overlaid from
\`patches/lib/**\`. Behavior added on top of 1.0.2:

- \`/side\` client command (DSH \`ctx.commandUi\` action contribution): opens the
  existing Side Chat panel for the current conversation and discusses a
  read-only snapshot cut at the **newest committed parent event**, so the
  latest parent turn and the agent's committed tool activity are included (not
  just the selected completed turn).
- The Side Chat panel can be dragged from anywhere on its header bar (title
  included; the add-to-conversation and close buttons keep their click
  behavior) and resized from all four edges plus the top-left and bottom-right
  corner handles. The resize zones are invisible (cursor feedback only); the
  geometry is remembered in \`localStorage\` and can be reset by
  double-clicking the header.
- A **Refresh** button in the panel header (icon + label, left of Add to
  conversation) closes the current discussion and reopens a fresh draft for the
  same parent conversation. The next question therefore captures the latest
  committed parent context, exactly like closing the panel and running
  \`/side\` again, while the panel geometry is kept.
- **Side Chat is per conversation.** Each main session keeps its own panel,
  transcript, host discussion, and remembered geometry while hidden. The
  active conversation is reported by a main-only DSH session-scope anchor
  (\`conversation.session.header.actions\`), not by a retention-counter scan, and
  a panel can only render the conversation it was opened for; switching main
  conversations shows that session's side chat (or no panel if it has none)
  without closing the other sessions' discussions. The Host admits up to 8
  concurrent side discussions per client (16 total; idle discussions expire
  after 30 minutes) and recycles the client's oldest idle discussion instead of
  dead-ending a new conversation; an expired discussion auto-renews as a fresh
  draft.
- Selection-based \`Ask in side chat\` / \`More details\` keep the original
  completed-turn context semantics, always bound to the explicitly captured
  conversation.
- Hardening: the Host verifies that the frozen context belongs to the requested
  session id (and that the log prefix is contiguous) before admitting a
  discussion; the frozen context records the parent session id and
  \`inheritedEvents\` provenance (fork/branch seeds); a Host discussion bound to
  another conversation is refused instead of answered. The panel header also
  shows the parent conversation title so the bound conversation is visible.
- The panel draft takes focus only when the panel was opened from a text-entry
  context, so switching conversations no longer steals focus from the main
  composer; drag geometry is persisted even if the panel closes mid-drag and can
  sync between browser tabs.

All other runtime files are byte-identical to the published 1.0.2 package:
the source rebuild used the exact \`rolldown@1.2.11\` pinned in upstream's
\`pnpm-lock.yaml\`. Reproducible source overlays and build steps live in the
project's \`src-overlays/\`; the built-file overlays are \`patches/lib/**\`.

Rebuild with \`node tools/adapt-package.mjs\`.
`,
);

// Optional out-of-tree patch overlay. Every file under patches/ is copied over
// the generated package at the same relative path (patches win), so runtime
// hotfixes and adaptation-note edits stay reproducible across rebuilds. The
// overlay README and dotfiles are tooling documentation, not package content.
const PATCHES = path.join(ROOT, 'patches');
if (existsSync(PATCHES)) {
  let applied = 0;
  for (const entry of readdirSync(PATCHES)) {
    if (entry === 'README.md' || entry.startsWith('.')) continue;
    cpSync(path.join(PATCHES, entry), path.join(OUT_DIR, entry), { recursive: true });
    applied += 1;
  }
  console.log(`patches overlay: ${applied} top-level entr${applied === 1 ? 'y' : 'ies'} from`, PATCHES);
}

// Pack with --ignore-scripts so the upstream prepack build step does not run.
// stdout is inherited instead of captured: the sandbox used by agent sessions
// cannot open the pipes that Node's piped child stdio needs.
mkdirSync(DIST, { recursive: true });
const before = new Set(readdirSync(DIST));
execFileSync(
  'npm',
  ['pack', '--ignore-scripts', '--pack-destination', DIST],
  { cwd: OUT_DIR, stdio: 'inherit', shell: true },
);
const tgz = readdirSync(DIST).filter(entry => entry.endsWith('.tgz') && !before.has(entry)).at(-1)
  ?? `ahggg-dsh-side-chat-${pkg.version}.tgz`;
if (!existsSync(path.join(DIST, tgz))) throw new Error(`npm pack did not produce ${tgz} in ${DIST}`);
console.log('packed:', path.join(DIST, tgz));
console.log('files in package:');
for (const f of readdirSync(OUT_DIR)) console.log(' -', f);
