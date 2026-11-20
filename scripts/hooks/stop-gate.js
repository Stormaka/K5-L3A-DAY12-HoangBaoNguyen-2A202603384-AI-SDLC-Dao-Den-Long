// Claude Code Stop hook: refuse to finish while the test suite is red.
import { spawnSync } from 'node:child_process';
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let ev = {};
  try { ev = JSON.parse(input || '{}'); } catch {}
  if (ev.stop_hook_active) process.exit(0); // avoid infinite loop
  const r = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8', shell: true });
  if (r.status === 0) process.exit(0);
  const fails = (r.stdout + r.stderr).split('\n').filter((l) => /^✖|not ok|AssertionError|Error:/.test(l)).slice(0, 15).join('\n');
  process.stderr.write(`Tests are RED — fix them before finishing (do not weaken tests):\n${fails}\n`);
  process.exit(2);
});
