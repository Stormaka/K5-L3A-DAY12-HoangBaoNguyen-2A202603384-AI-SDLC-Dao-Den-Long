// Phase 4 acceptance tests (Ticket-04 "Bình minh: phát hành v1.0.0", Test Contract v1.3).
// IDs P4-xx map to docs/notes/phase-4.md §3 and docs/proof/phase-4/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addEntry, validateEntry, NAME_RE, isoLocal, MAX_ENTRIES } from '../src/leaderboard.js';
import { createBenchWorld, benchStats, benchCamera, BENCH } from '../src/sim/bench.js';
import { step } from '../src/sim/world.js';

const root = new URL('..', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('game.contract.json', root), 'utf8'));
const entry = (name, score, at = '2026-11-20T10:00:00+07:00', extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 42, ...extra });

// ---------------------------------------------------------------- leaderboard

test('P4-01 leaderboard names: 3-12 of [A-Za-z0-9_] (Vietnamese letters accepted as bonus), everything else rejected', () => {
  for (const ok of ['Mai', 'abc_123', 'ABCDEFGHIJKL', 'Nguyên', 'Đăng_2k5']) assert.ok(NAME_RE.test(ok), ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'abc!', 'tên-dài', '']) assert.ok(!NAME_RE.test(bad), bad);
  assert.equal(validateEntry(entry('Mai', 10)), null);
  assert.match(validateEntry(entry('Mai', 10, '2026-11-20T10:00:00')), /achieved_at/); // no time zone
  assert.match(validateEntry(entry('Mai', 10, undefined, { nights_won: 4 })), /nights_won/);
  assert.match(validateEntry(entry('Mai', -1)), /score/);
  assert.match(isoLocal(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('P4-02 leaderboard order: score desc, equal score -> earlier achieved_at first, top 10 only', () => {
  let b = [];
  b = addEntry(b, entry('Late', 500, '2026-11-20T12:00:00+07:00')).entries;
  b = addEntry(b, entry('Early', 500, '2026-11-20T11:00:00+07:00')).entries;
  b = addEntry(b, entry('Best', 900)).entries;
  // same instant written with another offset: 04:00Z == 11:00+07:00 -> already-stored entry stays ahead
  const r = addEntry(b, entry('SameUtc', 500, '2026-11-20T04:00:00Z'));
  assert.deepEqual(r.entries.map((e) => e.name), ['Best', 'Early', 'SameUtc', 'Late']);
  assert.equal(r.rank, 3);
  for (let i = 0; i < 12; i++) b = addEntry(b, entry(`P${i}x`, 100 + i)).entries;
  assert.equal(b.length, MAX_ENTRIES);
  assert.equal(addEntry(b, entry('Tiny', 1)).rank, null); // did not make the top 10
});

test('P4-03 leaderboard is saved on disk by the game server and exported with <run_cmd> --export-leaderboard', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  process.env.DDL_DATA_DIR = dir;
  const { startServer } = await import('../server.js');
  const server = await startServer(0, false);
  const base = `http://localhost:${server.address().port}/api/leaderboard`;
  try {
    const post = (e) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) });
    assert.equal((await post(entry('Mây', 300))).status, 200);
    assert.equal((await post(entry('Ong_Dang', 700))).status, 200);
    assert.equal((await post(entry('x', 1))).status, 400); // invalid name -> rejected, not stored
    assert.deepEqual((await (await fetch(base)).json()).entries.map((e) => e.name), ['Ong_Dang', 'Mây']);
  } finally {
    server.close();
    delete process.env.DDL_DATA_DIR;
  }
  assert.ok(existsSync(join(dir, 'leaderboard.json')));
  // a new process (game closed and reopened) still sees it; export uses run_cmd from the contract
  const out = join(dir, 'out.json');
  const [cmd, ...pre] = contract.run_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, '--export-leaderboard', out], { cwd: root, encoding: 'utf8', env: { ...process.env, DDL_DATA_DIR: dir } });
  assert.equal(r.status, 0, r.stderr);
  const exp = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exp), ['entries']);
  assert.deepEqual(exp.entries.map((e) => [e.name, e.score, e.nights_won, e.seed]), [['Ong_Dang', 700, 1, 42], ['Mây', 300, 1, 42]]);
  for (const e of exp.entries) assert.deepEqual(Object.keys(e), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
});

// ---------------------------------------------------------------- benchmark scene + metrics

test('P4-04 bench metrics follow the ticket formulas (avg, 1% low over the k slowest frames, p95)', () => {
  // 99 frames of 10 ms + 1 frame of 50 ms: N=100, k=1
  const s = benchStats([...Array(99).fill(10), 50]);
  assert.deepEqual(s, { frames: 100, avg_fps: Math.round((1000 * 100 / 1040) * 10) / 10, p1_low_fps: 20, frame_ms_p95: 10 });
  // N=250 -> k=ceil(2.5)=3: slowest 3 are 40, 30, 20 -> mean 30 ms -> 33.3 fps
  const t = benchStats([...Array(247).fill(5), 20, 30, 40]);
  assert.equal(t.p1_low_fps, 33.3);
  assert.equal(t.frames, 250);
});

test('P4-05 bench scene: Night 1, exactly 200 wandering shades + 100 motes spread over the island, L1-L3 lit at 100; nothing spawns, burns, hurts or ends', () => {
  const w = createBenchWorld(42);
  assert.equal(w.night, 1);
  assert.equal(w.shades.length, BENCH.shades);
  assert.equal(w.motes.length, BENCH.motes);
  assert.ok(w.shades.every((s) => s.state === 'wander'));
  assert.deepEqual(w.lanterns.map((l) => [l.id, l.lit, l.fuel / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual([w.player.x, w.player.y, w.player.z], [0, 0, 0]);
  // spread: all on the island, some in each quadrant
  const q = [0, 0, 0, 0];
  for (const s of w.shades) {
    assert.ok(Math.hypot(s.x, s.z) <= 40);
    q[(s.x >= 0 ? 0 : 1) + (s.z >= 0 ? 0 : 2)]++;
  }
  assert.ok(q.every((n) => n > 30), `quadrants ${q}`);
  const pos0 = w.shades.map((s) => [s.x, s.z]).join();
  for (let i = 0; i < 60 * 300; i++) step(w, { move: [0, 0] }); // 300 s: longer than any night
  assert.equal(w.state, 'playing');
  assert.equal(w.shades.length, 200);
  assert.equal(w.motes.length, 100);
  assert.equal(w.events.filter((e) => ['shade_spawned', 'player_hit', 'mote_picked', 'lantern_out', 'game_over'].includes(e.name)).length, 0);
  assert.ok(w.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === 6000));
  assert.ok(w.shades.every((s) => s.state === 'wander'));
  assert.notEqual(w.shades.map((s) => [s.x, s.z]).join(), pos0); // shades keep moving
  // same seed -> same scene
  assert.equal(JSON.stringify(createBenchWorld(42).shades.map((s) => [s.x, s.z])), JSON.stringify(createBenchWorld(42).shades.map((s) => [s.x, s.z])));
});

test('P4-06 bench camera: radius 30, Y 15, starts at (30,15,0), counter-clockwise, 15 s per lap', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0), [30, 15, 0]));
  assert.ok(near(benchCamera(3.75), [0, 15, 30])); // quarter lap: angle 90° -> +Z (same convention as the maps)
  assert.ok(near(benchCamera(15), [30, 15, 0]));
});

// ---------------------------------------------------------------- soak

test('P4-07 soak_cmd: nights in one process, nights 1-2-3 rotating, seed + i, no crash, JSON shape', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-soak-'));
  const out = join(dir, 'soak.json');
  const [cmd, ...pre] = contract.soak_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, '--seed', '7', '--nights', '4', '--out', out, '--warmup-ticks', '60'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  for (const k of ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']) assert.ok(k in s, k);
  assert.equal(s.nights, 4);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 4);
  assert.deepEqual(s.per_night.map((n) => [n.night, n.seed]), [[1, 8], [2, 9], [3, 10], [1, 11]]);
  for (const n of s.per_night) assert.ok(['won', 'lost'].includes(n.result));
});

test('P4-08 game.contract.json v1.3 declares bench_cmd and soak_cmd; earlier keys unchanged', () => {
  assert.equal(contract.contract_version, '1.3');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof contract[k], 'string', k);
});
