// Read-only inspection helpers for the installed DSH app.asar archive.
// Usage (from any directory; @electron/asar resolves from this folder):
//   node tools/asar-reader/asar.mjs list <prefix>
//   node tools/asar-reader/asar.mjs read <path>
//   node tools/asar-reader/asar.mjs grep <regex> <prefix> [extensions]
//   node tools/asar-reader/asar.mjs save <path> <dest>
import asar from '@electron/asar';
import { writeFileSync } from 'node:fs';

const ARCHIVE =
  'C:/Users/ahmet/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';

const toDisplay = (p) => p.replaceAll('\\', '/').replace(/^\/+/, '');
const toAsar = (p) => toDisplay(p).replaceAll('/', '\\');

export function list(prefix = '') {
  const want = toDisplay(prefix);
  return asar
    .listPackage(ARCHIVE)
    .filter((p) => toDisplay(p).startsWith(want));
}

export function readFile(name) {
  return asar.extractFile(ARCHIVE, toAsar(name)).toString('utf8');
}

const cmd = process.argv[2];

if (cmd === 'list') {
  const rows = list(process.argv[3] ?? '');
  console.log(rows.map(toDisplay).slice(0, 500).join('\n'));
  console.error(`\n[${rows.length} paths]`);
} else if (cmd === 'read') {
  process.stdout.write(readFile(process.argv[3]));
} else if (cmd === 'grep') {
  const re = new RegExp(process.argv[3], 'm');
  const prefix = process.argv[4] ?? '';
  const exts = (process.argv[5] ?? '.js,.mjs,.json,.ts,.md').split(',');
  let hits = 0;
  for (const p of list(prefix)) {
    if (!exts.some((e) => p.endsWith(e))) continue;
    let text;
    try {
      text = readFile(p);
    } catch {
      continue;
    }
    if (!re.test(text)) continue;
    hits += 1;
    console.log('=== ' + toDisplay(p));
    text.split(/\r?\n/).forEach((line, i) => {
      if (re.test(line)) console.log(`  ${i + 1}: ${line.slice(0, 500)}`);
    });
    if (hits >= 40) break;
  }
  console.error(`\n[${hits} files matched]`);
} else if (cmd === 'save') {
  const data = asar.extractFile(ARCHIVE, toAsar(process.argv[3]));
  writeFileSync(process.argv[4], data);
  console.log('saved', process.argv[4], data.length);
} else {
  console.error('usage: node asar.mjs list|read|grep|save ...');
  process.exit(2);
}
