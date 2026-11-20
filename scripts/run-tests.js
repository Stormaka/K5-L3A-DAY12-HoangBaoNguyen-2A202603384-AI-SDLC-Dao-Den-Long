// Portable test runner: Node < 21 does not expand globs in `node --test "tests/*.test.js"`,
// so list the files ourselves and pass explicit paths (works on Node 18+ and Windows).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('tests').filter((f) => f.endsWith('.test.js')).sort().map((f) => `tests/${f}`);
if (!files.length) {
  console.error('no tests/*.test.js found');
  process.exit(1);
}
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
