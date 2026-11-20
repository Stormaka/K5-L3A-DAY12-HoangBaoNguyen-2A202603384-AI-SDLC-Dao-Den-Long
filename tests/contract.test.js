// Test Contract v1.1 conformance (v1.0 checks kept as regression): declaration file, CLI, exit codes, output format, determinism.
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

test('C-01 game.contract.json v1.2: all fields, tuning mirrors the game and the Ticket-02/03 standard numbers', () => {
  assert.equal(contract.contract_version, '1.2');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof contract[k], 'string', k);
  assert.deepEqual(contract.tuning, TUNING);
  assert.equal(contract.tuning.lantern_count_night1, 5);
  // Ticket-02 Part 1 standard numbers
  assert.deepEqual(contract.tuning, {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, flames: 3,
    invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4,
    shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5,
    low_fuel_threshold: 30, capacity_max: 20,
    // T3: +5 per mote put in, time bonus removed (0); relight 40 / drain stun 15 / dawn lantern 50 live in WORLD
    score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 },
  });
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

test('C-08 v1.1 snapshot fields: night, wind, player vel/grounded/invuln/cooldowns/charm, motes, drifters, charms', () => {
  for (const night of [1, 2, 3]) {
    const out = join(tmp, `n${night}.jsonl`);
    const r = cli(['--seed', '4', '--night', String(night), '--ticks', '2500', '--out', out, '--snapshot-every', '250']);
    assert.equal(r.status, 0, r.stderr);
    const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night } });
    for (const s of lines.filter((l) => l.type === 'snapshot')) {
      assert.equal(s.night, night);
      assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
      for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.ok(k in s.player, `player.${k}`);
      assert.equal(typeof s.player.grounded, 'boolean');
      assert.equal(typeof s.player.invuln, 'boolean');
      for (const m of s.motes) assert.deepEqual(Object.keys(m), ['id', 'pos', 'kind', 'ttl_s']);
      for (const d of s.drifters) {
        assert.deepEqual(Object.keys(d), ['id', 'pos', 'state', 'stolen']);
        assert.ok(['idle', 'chase', 'flee', 'removed'].includes(d.state));
      }
      for (const c of s.charms) for (const k of ['id', 'available', 'respawn_s']) assert.ok(k in c, `charm.${k}`);
      for (const sh of s.shades) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(sh.state), sh.state);
      assert.equal(s.motes_active, s.motes.length);
      assert.equal(typeof s.player.capacity, 'number'); // v1.2
      for (const l of s.lanterns) {
        for (const k of ['fuel', 'ever_lit', 'relit_count']) assert.ok(k in l, `lantern.${k}`);
        if (!l.lit) assert.equal(l.fuel, 0);
        assert.equal(Math.round(l.fuel * 10) / 10, l.fuel); // 1 decimal
      }
    }
  }
});

test('C-09 a full night (21,600 ticks) runs headless in <= 30 s, every night', () => {
  for (const night of ['1', '2', '3']) {
    const t0 = Date.now();
    // invuln + flames keep Mây alive so the run really lasts until dawn
    const sc = tmpFile(`long${night}.json`, { player: { flames: 99999, invuln_ticks: 30000 }, time_left_s: 360 });
    const r = cli(['--seed', '1', '--night', night, '--scenario', sc, '--ticks', '21600', '--out', join(tmp, `long${night}.jsonl`)]);
    const ms = Date.now() - t0;
    assert.equal(r.status, 0, r.stderr);
    assert.ok(ms <= 30000, `night ${night}: ${ms} ms`);
    const end = JSON.parse(readFileSync(join(tmp, `long${night}.jsonl`), 'utf8').trim().split('\n').at(-1));
    assert.equal(end.ticks, 21600);
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
    ['--inputs', tmpFile('bad8.json', { frames: [{ tick: 0, pause: 'yes' }] })],
    ['--scenario', tmpFile('bad9.json', { shades: [{ pos: [1, 0, 1], state: 'angry' }] })],
    ['--scenario', tmpFile('bad10.json', { drifters: [{ pos: [1, 0, 1], state: 'sleep' }] })],
    ['--scenario', tmpFile('bad11.json', { charms: [{ pos: [1, 0] }] })],
    ['--scenario', tmpFile('bad12.json', { player: { dash_cd_ticks: -1 } })],
    ['--scenario', tmpFile('bad13.json', { wind_enabled: 'yes' })],
    ['--scenario', tmpFile('bad14.json', { lanterns: [{ id: 'L1', lit: true, fuel: 120 }] })],
    ['--scenario', tmpFile('bad15.json', { lanterns: [{ id: 'L1', ever_lit: 'yes' }] })],
    ['--scenario', tmpFile('bad16.json', { shades: [{ pos: [1, 0, 1], target_lantern_id: 'L9' }] })],
    ['--scenario', tmpFile('bad17.json', { player: { successful_lights: 1.5 } })],
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
  assert.notEqual(cli(['--seed', '1', '--night', '4', '--ticks', '10', '--out', join(tmp, 'y.jsonl')]).status, 0);
  // lantern L7 exists only on Night 3
  assert.equal(cli(['--seed', '1', '--night', '2', '--ticks', '1', '--out', join(tmp, 'y.jsonl'), '--scenario', tmpFile('l7.json', { lanterns: [{ id: 'L7', lit: true }] })]).status, 2);
  assert.equal(cli(['--seed', '1', '--night', '3', '--ticks', '1', '--out', join(tmp, 'y.jsonl'), '--scenario', tmpFile('l7b.json', { lanterns: [{ id: 'L7', lit: true }] })]).status, 0);
});

test('C-07 no --inputs means the player stands still', () => {
  const r = sim({ seed: 5, scenario: { random_shades: false }, ticks: 300, every: 300 });
  assert.deepEqual(r.snap(300).player.pos, [0, 0, 0]);
});
