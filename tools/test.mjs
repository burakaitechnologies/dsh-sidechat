#!/usr/bin/env node
// One-command test harness for the @ahggg/dsh-side-chat local feature overlays.
//
//   node tools/test.mjs                # full run: stage, install, build, vitest, bundle probe
//   node tools/test.mjs --vitest-only  # skip the production build and bundle probes
//   node tools/test.mjs --bundle-only  # build (if needed) and run the jsdom probes only
//   node tools/test.mjs --skip-build   # reuse an existing scratch lib/client.js
//   node tools/test.mjs --fresh        # re-copy upstream/source into the scratch build
//   node tools/test.mjs --clean        # delete the scratch build after the run (keeps npm cache)
//
// What it does (all inside .scratch/, so the vendored snapshot stays untouched):
//   1. stage  — copy upstream/source to .scratch/test-build and overlay src-overlays/src/**;
//   2. install— npm install --legacy-peer-deps --ignore-scripts with the workspace cache,
//               then pin rolldown@1.2.11 (the version locked by upstream's pnpm-lock.yaml);
//   3. specs  — copy tests/specs/{client,host}/**.spec.ts(x) into the scratch test tree;
//   4. build  — npm run build (tsc + tsdown) -> scratch lib/client.js;
//   5. test   — run the full vitest suite (upstream tests + durable regression specs);
//   6. probe  — run tests/bundle/verify-shipped-bundle.mjs against the freshly built
//               lib/client.js, and (advisory) against the shipped dsh-side-chat/lib/client.js.
//
// The first run needs network access for the npm install; later runs reuse
// .scratch/test-build/node_modules and .scratch/npm-cache. Exit code 0 = all
// required gates passed, 1 = a required gate failed.
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRATCH = path.join(ROOT, '.scratch')
const BUILD = path.join(SCRATCH, 'test-build')
const NPM_CACHE = path.join(SCRATCH, 'npm-cache')
const STATE = path.join(BUILD, '.dsh')
const UPSTREAM_SOURCE = path.join(ROOT, 'upstream', 'source')
const OVERLAYS_ROOT = path.join(ROOT, 'src-overlays')
const OVERLAY_SOURCE = path.join(OVERLAYS_ROOT, 'src')
const SPEC_SOURCE = path.join(ROOT, 'tests', 'specs')
const PROBE_SOURCE = path.join(ROOT, 'tests', 'bundle', 'verify-shipped-bundle.mjs')
const SHIPPED_DIR = path.join(ROOT, 'dsh-side-chat')
const ROLldownVersion = '1.2.11'
const ROLldownPackage = `rolldown@${ROLldownVersion}`
// `npm install --legacy-peer-deps` intentionally skips peer dependencies. The
// upstream test suite needs two of them at runtime (Testing Library's DOM
// package, and dsh-session's @deepseek-ai/dsh-scope peer). Pin them together
// with rolldown in one --no-save install so the rolldown pin is applied last.
const SUPPLEMENT_PACKAGES = [
  `@testing-library/dom@^10.0.0`,
  '@deepseek-ai/dsh-scope@0.2.0-rc.2',
]

const argv = new Set(process.argv.slice(2))
const options = {
  help: argv.has('--help') || argv.has('-h'),
  fresh: argv.has('--fresh'),
  clean: argv.has('--clean'),
  skipInstall: argv.has('--skip-install'),
  skipBuild: argv.has('--skip-build'),
  vitestOnly: argv.has('--vitest-only'),
  bundleOnly: argv.has('--bundle-only'),
  skipProbe: argv.has('--skip-probe'),
}
if (options.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).join('\n'))
  process.exit(0)
}

const results = []
const startedAt = Date.now()
for (const directory of [SCRATCH, NPM_CACHE, STATE]) await fsp.mkdir(directory, { recursive: true })

// ---------------------------------------------------------------- utilities
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return undefined }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}
function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function versionOf(packageName) {
  const manifest = readJson(path.join(BUILD, 'node_modules', packageName, 'package.json'))
  return typeof manifest?.version === 'string' ? manifest.version : undefined
}
function relativeList(root, files) {
  return files.map(file => path.relative(root, file).split(path.sep).join('/')).sort()
}
async function walkFiles(root) {
  const found = []
  async function visit(current) {
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile()) found.push(full)
    }
  }
  await visit(root)
  return found
}
async function copyFileEnsured(source, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true })
  await fsp.copyFile(source, destination)
}
function resolveNpmCli() {
  const besideNode = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (fs.existsSync(besideNode)) return besideNode
  if (process.env.APPDATA !== undefined) {
    const globalNpm = path.join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (fs.existsSync(globalNpm)) return globalNpm
  }
  return undefined
}
function npmEnvironment() {
  return {
    ...process.env,
    npm_config_cache: NPM_CACHE,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  }
}
function formatDuration(milliseconds) {
  return milliseconds < 1000 ? `${milliseconds}ms` : `${(milliseconds / 1000).toFixed(1)}s`
}
function runProcess(command, args, { cwd = BUILD, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${[command, ...args].map(part => (part.includes(' ') ? `"${part}"` : part)).join(' ')}`)
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('close', code => resolve(code ?? 1))
  })
}
async function runNpm(args) {
  const cli = resolveNpmCli()
  if (cli !== undefined) return await runProcess(process.execPath, [cli, ...args], { env: npmEnvironment() })
  return await runProcess('npm', args, { env: npmEnvironment() })
}
function record(name, status, started, detail) {
  const elapsed = Date.now() - started
  results.push({ name, status, elapsed, detail })
  const tag = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : status === 'WARN' ? 'WARN' : 'SKIP'
  console.log(`[${tag}] ${name} (${formatDuration(elapsed)})${detail === undefined ? '' : ` — ${detail}`}`)
  return status === 'PASS'
}
async function step(name, run) {
  const started = Date.now()
  try {
    const detail = await run()
    return record(name, 'PASS', started, detail)
  } catch (error) {
    record(name, 'FAIL', started, error instanceof Error ? error.message : String(error))
    return false
  }
}
function fail(message) { throw new Error(message) }

// ------------------------------------------------------------- staged source
async function stageSource() {
  const freshCopy = options.fresh || !fs.existsSync(path.join(BUILD, 'package.json'))
  if (freshCopy) {
    await fsp.rm(BUILD, { recursive: true, force: true })
    await fsp.mkdir(SCRATCH, { recursive: true })
    console.log(`Staging ${path.relative(ROOT, UPSTREAM_SOURCE)} -> ${path.relative(ROOT, BUILD)} ...`)
    await fsp.cp(UPSTREAM_SOURCE, BUILD, { recursive: true })
  }
  await fsp.mkdir(STATE, { recursive: true })

  const overlayManifest = path.join(STATE, 'overlays.json')
  const previousOverlays = readJson(overlayManifest)?.files ?? []
  // Keep the repo-relative path (e.g. `src/client/foo.ts`) so the overlay can be
  // written over the vendored `upstream/source/src/**` tree unchanged.
  const overlayFiles = relativeList(OVERLAYS_ROOT, await walkFiles(OVERLAY_SOURCE))
    .filter(relative => relative.startsWith('src/'))
  for (const relative of previousOverlays) {
    if (overlayFiles.includes(relative)) continue
    // A removed overlay reverts to the vendored upstream file.
    const upstreamFile = path.join(UPSTREAM_SOURCE, relative)
    const destination = path.join(BUILD, relative)
    if (fs.existsSync(upstreamFile)) await copyFileEnsured(upstreamFile, destination)
    else await fsp.rm(destination, { force: true })
  }
  for (const relative of overlayFiles) {
    await copyFileEnsured(path.join(OVERLAYS_ROOT, relative), path.join(BUILD, relative))
  }
  writeJson(overlayManifest, { files: overlayFiles })

  const specManifest = path.join(STATE, 'specs.json')
  const previousSpecs = readJson(specManifest)?.files ?? []
  const specFiles = (await walkFiles(SPEC_SOURCE))
    .filter(file => /\.spec\.tsx?$/.test(file))
    .map(file => path.relative(SPEC_SOURCE, file).split(path.sep).join('/'))
    .sort()
  for (const relative of previousSpecs) {
    if (!specFiles.includes(relative)) await fsp.rm(path.join(BUILD, 'test', relative), { force: true })
  }
  for (const relative of specFiles) {
    await copyFileEnsured(path.join(SPEC_SOURCE, relative), path.join(BUILD, 'test', relative))
  }
  writeJson(specManifest, { files: specFiles })

  return `${freshCopy ? 'fresh copy; ' : ''}${String(overlayFiles.length)} overlays, ${String(specFiles.length)} durable specs`
}

async function ensureDependencies() {
  if (options.skipInstall) {
    if (!fs.existsSync(path.join(BUILD, 'node_modules'))) fail('--skip-install was passed but the scratch node_modules is missing')
    return 'skipped (--skip-install)'
  }
  const packageHash = hashFile(path.join(BUILD, 'package.json'))
  const installMarker = path.join(STATE, 'install.json')
  const marker = readJson(installMarker)
  const hasToolchain = fs.existsSync(path.join(BUILD, 'node_modules', 'vitest'))
    && fs.existsSync(path.join(BUILD, 'node_modules', 'react'))
    && fs.existsSync(path.join(BUILD, 'node_modules', 'react-dom'))
    && fs.existsSync(path.join(BUILD, 'node_modules', 'jsdom'))
  if (!hasToolchain || marker?.packageJsonHash !== packageHash) {
    const code = await runNpm(['install', '--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund'])
    if (code !== 0) fail(`npm install failed with exit code ${String(code)}`)
  }
  if (versionOf('rolldown') !== ROLldownVersion
    || !fs.existsSync(path.join(BUILD, 'node_modules', '@testing-library', 'dom'))
    || !fs.existsSync(path.join(BUILD, 'node_modules', '@deepseek-ai', 'dsh-scope'))) {
    const code = await runNpm(['install', '--no-save', ROLldownPackage, ...SUPPLEMENT_PACKAGES,
      '--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund'])
    if (code !== 0) fail(`pinning ${ROLldownPackage} + test peer supplements failed with exit code ${String(code)}`)
  }
  if (versionOf('rolldown') !== ROLldownVersion) fail(`rolldown ${ROLldownVersion} is not installed in the scratch build`)
  for (const supplement of ['@testing-library/dom', '@deepseek-ai/dsh-scope']) {
    if (!fs.existsSync(path.join(BUILD, 'node_modules', supplement))) fail(`test peer supplement missing: ${supplement}`)
  }
  for (const required of ['vitest', 'typescript', 'react', 'react-dom', 'jsdom']) {
    if (!fs.existsSync(path.join(BUILD, 'node_modules', required))) fail(`scratch dependency missing: ${required}`)
  }
  writeJson(installMarker, {
    packageJsonHash: packageHash,
    rolldown: ROLldownVersion,
    installedAt: new Date().toISOString(),
  })
  return `toolchain ready (rolldown ${ROLldownVersion})`
}

async function buildScratch() {
  if (options.skipBuild) {
    if (!fs.existsSync(path.join(BUILD, 'lib', 'client.js'))) fail('--skip-build was passed but the scratch lib/client.js does not exist')
    return 'skipped (--skip-build)'
  }
  const code = await runNpm(['run', 'build'])
  if (code !== 0) fail(`npm run build failed with exit code ${String(code)}`)
  const clientBundle = path.join(BUILD, 'lib', 'client.js')
  if (!fs.existsSync(clientBundle)) fail('build did not produce lib/client.js')
  const source = fs.readFileSync(clientBundle, 'utf8')
  if (!source.startsWith('window.__ModuleLoader__.load({id:')) {
    fail('lib/client.js does not start with window.__ModuleLoader__.load({id:')
  }
  if (!source.includes('"@ahggg/dsh-side-chat"') && !source.includes('`@ahggg/dsh-side-chat`')) {
    fail('lib/client.js does not register the @ahggg/dsh-side-chat bundle id')
  }
  const check = await runProcess(process.execPath, ['--check', clientBundle])
  if (check !== 0) fail('lib/client.js failed node --check')
  return `${(fs.statSync(clientBundle).size / 1024).toFixed(0)} KiB bundle`
}

// ------------------------------------------------------------------- vitest
function readVitestReport(file) {
  const report = readJson(file)
  if (report === undefined) return undefined
  return {
    // numTotalTestSuites counts files plus describe blocks; the JSON reporter's
    // testResults array is the real one-entry-per-test-file list.
    files: (report.testResults ?? []).length,
    tests: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    failures: (report.testResults ?? []).flatMap(result =>
      (result.assertionResults ?? [])
        .filter(assertion => assertion.status === 'failed')
        .map(assertion => `${path.relative(BUILD, result.name ?? '')} :: ${assertion.fullName ?? assertion.title}`)),
  }
}
async function runVitest() {
  const vitestEntry = path.join(BUILD, 'node_modules', 'vitest', 'vitest.mjs')
  if (!fs.existsSync(vitestEntry)) fail('vitest is not installed in the scratch build')
  const reportFile = path.join(STATE, 'vitest-results.json')
  await fsp.rm(reportFile, { force: true })
  const code = await runProcess(process.execPath, [
    vitestEntry, 'run',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${reportFile}`,
  ])
  const report = readVitestReport(reportFile)
  if (report !== undefined && report.failed > 0) {
    console.error(`\nFailed tests:\n${report.failures.map(failure => `  - ${failure}`).join('\n')}`)
  }
  if (code !== 0) fail(`vitest failed with exit code ${String(code)}${report === undefined ? '' : ` (${String(report.failed)} failed)`}`)
  if (report === undefined) return 'vitest passed (JSON report unavailable)'
  return `${String(report.files)} test files, ${String(report.tests)} tests: ${String(report.passed)} passed, ${String(report.failed)} failed, ${String(report.skipped ?? 0)} skipped`
}

// -------------------------------------------------------------- bundle probe
async function probeBundle(label, bundlePath, { advisory = false } = {}) {
  const probeDir = path.join(STATE, 'probe')
  await fsp.mkdir(probeDir, { recursive: true })
  const localProbe = path.join(probeDir, 'verify-shipped-bundle.mjs')
  await fsp.copyFile(PROBE_SOURCE, localProbe)
  const reportFile = path.join(STATE, `probe-${label.replaceAll(/\W+/g, '-')}.json`)
  await fsp.rm(reportFile, { force: true })
  console.log(`\nRunning shipped-bundle probe (${label}) against ${path.relative(ROOT, bundlePath)}`)
  const code = await runProcess(process.execPath, [localProbe, '--bundle', bundlePath, '--json', reportFile])
  const report = readJson(reportFile)
  const summary = report === undefined
    ? `probe exit ${String(code)} (JSON report unavailable)`
    : `${String(report.passed)}/${String(report.total)} checks passed`
  if (code !== 0) {
    if (advisory) throw new Error(`advisory probe failed: ${summary}`)
    fail(`bundle probe failed: ${summary}`)
  }
  return advisory ? `${summary} (advisory)` : summary
}

async function compareBuiltWithShipped() {
  const pairs = ['lib/client.js', 'lib/index.js', 'lib/host/read-only-chat-service.js']
  const differences = []
  for (const relative of pairs) {
    const built = path.join(BUILD, relative)
    const shipped = path.join(SHIPPED_DIR, relative)
    if (!fs.existsSync(shipped)) { differences.push(`${relative}: missing from dsh-side-chat/`); continue }
    if (hashFile(built) !== hashFile(shipped)) differences.push(`${relative}: differs`)
  }
  if (differences.length === 0) return 'built source and shipped package are byte-identical'
  console.warn(`[WARN] Built scratch output differs from the shipped dsh-side-chat/ package:\n  ${differences.join('\n  ')}\n       Run "node tools/adapt-package.mjs" and reinstall the tarball before releasing.`)
  return `differs: ${differences.join(', ')}`
}

// --------------------------------------------------------------------- main
console.log('dsh-side-chat test harness')
console.log(`root:  ${ROOT}`)
console.log(`build: ${path.relative(ROOT, BUILD)}  (scratch; safe to delete)`)

if (!await step('stage scratch build (upstream/source + src-overlays)', stageSource)) process.exitCode = 1
else if (!await step('install scratch toolchain', ensureDependencies)) process.exitCode = 1
else if (!options.vitestOnly && !options.bundleOnly
  && !await step('build the plugin from source overlays', buildScratch)) process.exitCode = 1
else if (options.bundleOnly && !options.skipBuild
  && !await step('build the plugin from source overlays', buildScratch)) process.exitCode = 1
else if (options.bundleOnly && options.skipBuild && !fs.existsSync(path.join(BUILD, 'lib', 'client.js'))) {
  record('build the plugin from source overlays', 'FAIL', Date.now(), '--skip-build was passed but the scratch lib/client.js does not exist')
  process.exitCode = 1
} else {
  if (!options.bundleOnly && !await step('run full vitest suite', runVitest)) process.exitCode = 1
  if (process.exitCode !== 1 && !options.vitestOnly && !options.skipProbe) {
    const builtBundle = path.join(BUILD, 'lib', 'client.js')
    if (!await step('verify built lib/client.js with the jsdom probe', () => probeBundle('built', builtBundle))) process.exitCode = 1
    if (process.exitCode !== 1) {
      const shippedBundle = path.join(SHIPPED_DIR, 'lib', 'client.js')
      if (fs.existsSync(shippedBundle)) {
        const started = Date.now()
        try {
          record('verify shipped dsh-side-chat/lib/client.js (advisory)', 'PASS', started,
            await probeBundle('shipped', shippedBundle, { advisory: true }))
        } catch (error) {
          record('verify shipped dsh-side-chat/lib/client.js (advisory)', 'WARN', started,
            error instanceof Error ? error.message : String(error))
          console.warn('[WARN] the currently shipped bundle differs from the built source; rebuild and reinstall before releasing.')
        }
      } else {
        record('verify shipped dsh-side-chat/lib/client.js (advisory)', 'SKIP', Date.now(), 'shipped lib/client.js missing')
        console.warn('[WARN] dsh-side-chat/lib/client.js is missing; shipped-package probe skipped')
      }
      const started = Date.now()
      try {
        record('compare built output with the shipped package', 'PASS', started, await compareBuiltWithShipped())
      } catch (error) {
        record('compare built output with the shipped package', 'WARN', started,
          error instanceof Error ? error.message : String(error))
      }
    }
  }
}

const elapsed = Date.now() - startedAt
const failed = results.filter(result => result.status === 'FAIL')
console.log('\n=== SUMMARY ===')
for (const result of results) {
  const tag = result.status === 'PASS' ? 'PASS'
    : result.status === 'FAIL' ? 'FAIL'
      : result.status === 'WARN' ? 'WARN' : 'SKIP'
  console.log(`${tag}  ${result.name}  [${formatDuration(result.elapsed)}]${result.detail === undefined ? '' : `\n      ${result.detail}`}`)
}
console.log(`\nTotal time: ${formatDuration(elapsed)}`)
if (options.clean) {
  await fsp.rm(BUILD, { recursive: true, force: true })
  console.log(`Removed ${path.relative(ROOT, BUILD)} (npm cache kept at ${path.relative(ROOT, NPM_CACHE)}).`)
} else {
  console.log(`Scratch build kept for re-runs at ${path.relative(ROOT, BUILD)} (delete ${path.relative(ROOT, SCRATCH)}/test-build to reclaim space).`)
}
if (process.exitCode === 1) {
  console.error(`\nRESULT: FAIL — ${String(failed.length)} required gate(s) failed.`)
} else {
  const probe = results.find(result => result.name.includes('jsdom probe') && !result.name.includes('advisory'))
  const tests = results.find(result => result.name.includes('vitest'))
  console.log(`\nRESULT: PASS — ${tests?.detail ?? 'tests passed'}; ${probe?.detail ?? 'bundle probe skipped'}.`)
}
