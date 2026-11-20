#!/usr/bin/env node
// Builds the GitHub Release bundle: dist/dao-den-long-v<version>/ + .zip + .tar.gz
// The bundle runs with Node >= 18 only (three.js is vendored, no `npm install`):
//   node server.js   -> http://localhost:5173
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const name = `dao-den-long-v${pkg.version}`;
const out = join('dist', name);
rmSync('dist', { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const p of ['web', 'src', 'scripts', 'tests', 'server.js', 'game.contract.json', 'README.md', 'CHANGELOG.md', 'CREDITS.md', 'LICENSE', 'package.json']) cpSync(p, join(out, p), { recursive: true });
mkdirSync(join(out, 'node_modules/three/build'), { recursive: true });
cpSync('node_modules/three/build/three.module.js', join(out, 'node_modules/three/build/three.module.js'));
cpSync('node_modules/three/LICENSE', join(out, 'node_modules/three/LICENSE'));
cpSync('node_modules/three/package.json', join(out, 'node_modules/three/package.json'));
writeFileSync(join(out, 'CHAY-GAME.txt'), [
  `Đảo Đèn Lồng v${pkg.version}`,
  '',
  'Cần: Node.js >= 18 (https://nodejs.org) và một trình duyệt có WebGL2 (Chrome, Edge, Firefox).',
  'Không cần npm install: three.js đã nằm sẵn trong node_modules/three.',
  '',
  '  node server.js            mở http://localhost:5173 rồi chơi',
  '  node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl',
  '  node scripts/bench.js --seed 42 --duration 30 --out bench.json   (cần Google Chrome/Edge)',
  '  node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json',
  '  node scripts/run-tests.js',
  '',
].join('\n'));

const tar = (args) => spawnSync('tar', args, { cwd: 'dist', stdio: 'inherit' }).status === 0;
const okTgz = tar(['-czf', `${name}.tar.gz`, name]);
// bsdtar (Windows 10+, macOS) writes zip with -a; fall back to `zip` on Linux
const okZip = tar(['-a', '-cf', `${name}.zip`, name]) || spawnSync('zip', ['-qr', `${name}.zip`, name], { cwd: 'dist', stdio: 'inherit' }).status === 0;
console.log(`bundle: dist/${name}/`);
for (const f of [`${name}.tar.gz`, `${name}.zip`]) if (existsSync(join('dist', f))) console.log(`        dist/${f}`);
if (!okTgz && !okZip) process.exitCode = 1;
