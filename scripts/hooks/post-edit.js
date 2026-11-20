// Claude Code PostToolUse hook (Edit|Write): after editing sim/headless/tests, run the suite
// and feed failures back to the agent immediately.
import { spawnSync } from 'node:child_process';
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let ev = {};
  try { ev = JSON.parse(input || '{}'); } catch {}
  const file = String(ev.tool_input?.file_path || '').split(String.fromCharCode(92)).join('/');
  if (!/\/(src|tests)\/|game\.contract\.json$/.test(file)) process.exit(0);
  const r = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8', shell: true });
  if (r.status === 0) process.exit(0);
  const fails = (r.stdout + r.stderr).split('\n').filter((l) => /^✖|AssertionError/.test(l)).slice(0, 10).join('\n');
  process.stderr.write(`Edit to ${file} broke tests:\n${fails}\n`);
  process.exit(2);
});
