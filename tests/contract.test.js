// Test Contract v1.0 conformance: declaration file, CLI, exit codes, output format, determinism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TUNING } from '../src/sim/config.js';
import { sim } from './helpers.js';

const root = new URL('..', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('game.contract.json', root), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'ddl-'));

function cli(args) {
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  return spawnSync(cmd, [...pre, ...args], { cwd: root, encoding: 'utf8' });
}
const tmpFile = (name, data) => {
  const p = join(tmp, name);
  writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data));
  return p;
};

test('C-01 game.contract.json has all fields and tuning mirrors the game', () => {
  assert.equal(contract.contract_version, '1.0');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof contract[k], 'string', k);
  assert.deepEqual(contract.tuning, TUNING);
  assert.equal(contract.tuning.lantern_count_night1, 5);
});

test('C-02 CLI run: exit 0, JSONL, snapshot every N from tick 0, end line last', () => {
  const out = join(tmp, 'run.jsonl');
  const r = cli(['--seed', '3', '--night', '1', '--ticks', '95', '--out', out, '--snapshot-every', '20']);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 20, 40, 60, 80]);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 95, state: 'playing', score: lines.at(-1).score });
  for (const s of lines.filter((l) => l.type === 'snapshot')) {
    assert.equal(s.sim_tick, s.tick);
    for (const k of ['state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s, k);
  }
});

test('C-03 coordinates rounded to 3 decimals', () => {
  const r = sim({ seed: 11, ticks: 200, every: 50, frames: [{ tick: 0, move: [0.3, 0.7], cam_yaw_deg: 33 }] });
  const nums = [];
  for (const s of r.lines.filter((l) => l.type === 'snapshot'))
    nums.push(...s.player.pos, ...s.shades.flatMap((x) => x.pos), ...s.lanterns.flatMap((x) => x.pos));
  for (const n of nums) assert.equal(Math.round(n * 1000) / 1000, n);
});

test('C-04 determinism: same seed + inputs -> byte-identical output; other seed differs', () => {
  const inputs = tmpFile('det.json', { frames: [{ tick: 0, move: [0.5, 1] }, { tick: 90, cam_yaw_deg: 120, pulse: true }, { tick: 91, pulse: false }, { tick: 400, move: [-1, 0.2], jump: true }] });
  const a = join(tmp, 'a.jsonl'), b = join(tmp, 'b.jsonl'), c = join(tmp, 'c.jsonl');
  for (const [seed, out] of [['42', a], ['42', b], ['43', c]])
    assert.equal(cli(['--seed', seed, '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', out]).status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
  assert.notEqual(readFileSync(a, 'utf8'), readFileSync(c, 'utf8'));
});

test('C-05 malformed inputs / scenario -> exit 2 with stderr message', () => {
  const bad = [
    ['--inputs', tmpFile('bad1.json', '{ not json')],
    ['--inputs', tmpFile('bad2.json', { frames: [{ tick: 5 }, { tick: 5 }] })],
    ['--inputs', tmpFile('bad3.json', { frames: [{ tick: 0, move: 'up' }] })],
    ['--inputs', tmpFile('bad4.json', { frames: [{ tick: 0, pulse: 1 }] })],
    ['--scenario', tmpFile('bad5.json', { player: { pos: [0, 0] } })],
    ['--scenario', tmpFile('bad6.json', { lanterns: [{ id: 'L9', lit: true }] })],
    ['--scenario', join(tmp, 'missing.json')],
  ];
  for (const extra of bad) {
    const r = cli(['--seed', '1', '--night', '1', '--ticks', '10', '--out', join(tmp, 'x.jsonl'), ...extra]);
    assert.equal(r.status, 2, `${extra.join(' ')} -> ${r.status}`);
    assert.match(r.stderr, /error:/);
  }
});

test('C-06 bad CLI arguments -> non-zero exit', () => {
  assert.notEqual(cli(['--seed', '1', '--night', '1', '--ticks', '10']).status, 0); // no --out
  assert.notEqual(cli(['--seed', 'x', '--night', '1', '--ticks', '10', '--out', join(tmp, 'y.jsonl')]).status, 0);
});

test('C-07 no --inputs means the player stands still', () => {
  const r = sim({ seed: 5, scenario: { random_shades: false }, ticks: 300, every: 300 });
  assert.deepEqual(r.snap(300).player.pos, [0, 0, 0]);
});
