// Acceptance tests for PRD-0 / Test Contract v1.0. IDs (AC-xx) map to docs/proof/phase-1/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, iso } from './helpers.js';
import { TUNING as T } from '../src/sim/config.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

test('AC-01 tick 0 snapshot: player at origin, 5 lanterns, full time, playing', () => {
  const r = sim({ ticks: 0 });
  const s = r.snap(0);
  assert.deepEqual(s.player, { pos: [0, 0, 0], flames: T.flames, carried: 0 });
  assert.equal(s.lanterns.length, 5);
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.state, 'playing');
  assert.equal(s.motes_active, 30);
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('AC-02 movement: 60 ticks of move [0,1] = player_speed metres along +Z', () => {
  const r = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [0, 1] }] });
  assert.deepEqual(r.snap(60).player.pos, [0, 0, T.player_speed]);
});

test('AC-03 movement is camera-relative (cam_yaw_deg 90 -> +X) and normalised', () => {
  const a = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] });
  assert.deepEqual(a.snap(60).player.pos, [T.player_speed, 0, 0]);
  const b = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [1, 1] }] });
  const p = b.snap(60).player.pos;
  assert.ok(Math.abs(Math.hypot(p[0], p[2]) - T.player_speed) < 1e-3, `diagonal not normalised: ${p}`);
});

test('AC-04 island edge is a wall (fall_enabled=false): no fall, stays on island', () => {
  const r = sim({ scenario: iso(), ticks: 600, frames: [{ tick: 0, move: [0, 1] }] });
  assert.equal(r.snap(600).player.pos[2], 40);
  assert.equal(r.events('player_hit').length, 0);
});

test('AC-05 jump: leaves the ground then lands', () => {
  const r = sim({ scenario: iso(), ticks: 120, frames: [{ tick: 0, jump: true }] });
  assert.ok(r.snap(10).player.pos[1] > 0.5);
  assert.equal(r.snap(120).player.pos[1], 0);
});

test('AC-06 pickup within pickup_radius (boundary inclusive), +per_mote score', () => {
  const r = sim({ scenario: iso({ motes: [[0, 0, 5]] }), ticks: 60, frames: [{ tick: 0, move: [0, 1] }] });
  const ev = r.events('mote_picked');
  assert.equal(ev.length, 1);
  // z after n ticks = 0.1n; 5 - 0.1n <= 1.5  ->  n = 35
  assert.equal(ev[0].tick, 35);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(r.snap(35).score, T.score.per_mote);
  assert.equal(r.snap(35).motes_active, 0);
});

test('AC-07 carry_capacity caps pickup', () => {
  const motes = Array.from({ length: 12 }, () => [0, 0, 0]);
  const r = sim({ scenario: iso({ motes }), ticks: 1 });
  assert.equal(r.snap(1).player.carried, T.carry_capacity);
  assert.equal(r.snap(1).motes_active, 2);
});

test('AC-08 deposit lights a lantern at lantern_cost; edge-triggered interact', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 23], carried: 7 } }),
    ticks: 30,
    frames: [{ tick: 0, interact: true }], // held for 30 ticks: must deposit once only
  });
  const dep = r.events('deposit');
  assert.equal(dep.length, 1);
  assert.deepEqual(dep[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(r.events('lantern_lit').map((e) => e.data), [{ lantern_id: 'L1' }]);
  assert.equal(r.snap(1).player.carried, 2);
  assert.equal(r.snap(1).score, T.score.per_lantern);
});

test('AC-09 partial deposits accumulate', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25], carried: 3 }, lanterns: [{ id: 'L1', deposited: 1 }] }),
    ticks: 5,
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.events('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 4 });
  assert.equal(r.events('lantern_lit').length, 0);
});

test('AC-10 interact out of interact_radius does nothing', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25 - T.interact_radius - 0.1], carried: 5 } }),
    ticks: 5,
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.events('deposit').length, 0);
});

test('AC-11 win: lighting the last lantern -> game_over won/all_lit, score bonus, run stops', () => {
  const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 1] }] }),
    ticks: 100,
    frames: [{ tick: 0, interact: true }],
  });
  const go = r.events('game_over');
  assert.deepEqual(go.map((e) => [e.tick, e.data]), [[1, { result: 'won', reason: 'all_lit' }]]);
  // preset lit lanterns give no score; only L5 + bonuses
  const expected = T.score.per_lantern + Math.floor(300 - 1 / 60) * T.score.per_second_left + 3 * T.score.per_flame_left;
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: expected });
});

test('AC-12 shade chases at shade_speed', () => {
  const r = sim({ scenario: iso({ shades: [{ pos: [10, 0, 0] }] }), ticks: 60 });
  const s = r.snap(60).shades[0];
  assert.equal(s.id, 'S1');
  assert.equal(s.state, 'chase');
  assert.ok(Math.abs(s.pos[0] - (10 - T.shade_speed)) < 1e-3, `x=${s.pos[0]}`);
});

test('AC-13 shade contact: -1 flame, drops hit_drop_ratio of carried, then invuln_s', () => {
  const r = sim({ scenario: iso({ player: { carried: 4 }, shades: [{ id: 'X', pos: [2, 0, 0] }] }), ticks: 400 });
  const hits = r.events('player_hit');
  // 1 m to cover at 3.5/60 m per tick -> tick 18; then every invuln_s * 60 = 90 ticks
  assert.deepEqual(hits.map((h) => h.tick), [18, 108, 198]);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.deepEqual(r.events('game_over').map((e) => e.data), [{ result: 'lost', reason: 'no_flames' }]);
  assert.deepEqual(r.end, { type: 'end', ticks: 198, state: 'lost', score: 0 });
});

test('AC-14 pulse: costs pulse_cost, stuns + pushes shades in pulse_radius, +per_stun', () => {
  const r = sim({
    scenario: iso({ player: { carried: 2 }, shades: [{ pos: [3, 0, 0] }, { pos: [-T.pulse_radius - 0.5, 0, 0] }] }),
    ticks: 121,
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(r.events('pulse').map((e) => [e.tick, e.data]), [[1, { stunned_ids: ['S1'] }]]);
  const s1 = r.snap(1);
  assert.equal(s1.player.carried, 1);
  assert.equal(s1.score, T.score.per_stun);
  assert.deepEqual(s1.shades[0], { id: 'S1', pos: [3 + T.pulse_push_m, 0, 0], state: 'stunned' });
  // frozen for pulse_stun_s (120 ticks), chasing again afterwards
  assert.deepEqual(r.snap(120).shades[0].pos, [7, 0, 0]);
  assert.equal(r.snap(120).shades[0].state, 'stunned');
  assert.equal(r.snap(121).shades[0].state, 'chase');
});

test('AC-15 pulse needs light and respects pulse_cooldown_s', () => {
  const none = sim({ scenario: iso(), ticks: 5, frames: [{ tick: 0, pulse: true }] });
  assert.equal(none.events('pulse').length, 0);
  const cd = sim({
    scenario: iso({ player: { carried: 5 } }),
    ticks: 100,
    frames: [
      { tick: 0, pulse: true }, { tick: 1, pulse: false },
      { tick: 30, pulse: true }, { tick: 31, pulse: false }, // during cooldown: ignored
      { tick: 60, pulse: true }, { tick: 61, pulse: false }, // exactly 1 s later: ok
    ],
  });
  assert.deepEqual(cd.events('pulse').map((e) => e.tick), [1, 61]);
  assert.equal(cd.snap(100).player.carried, 3);
});

test('AC-16 shades never enter safe_radius of a lit lantern; player is safe there', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 0, 35] }, { pos: [3, 0, 20] }] }),
    ticks: 900,
  });
  for (const l of r.lines.filter((x) => x.type === 'snapshot'))
    for (const s of l.shades) assert.ok(dist(s.pos, [0, 0, 25]) >= T.safe_radius, `tick ${l.tick} ${s.id} ${s.pos}`);
  assert.equal(r.events('player_hit').length, 0);
});

test('AC-17 dawn: time runs out -> lost/dawn', () => {
  const r = sim({ scenario: iso({ time_left_s: 1 }), ticks: 1000, every: 10 });
  assert.deepEqual(r.events('game_over').map((e) => [e.tick, e.data]), [[60, { result: 'lost', reason: 'dawn' }]]);
  assert.equal(r.end.ticks, 60);
  assert.equal(r.snap(60).time_left_s, 0);
});

test('AC-18 random shades spawn over time with shade_spawned events and unique ids', () => {
  const r = sim({ seed: 7, scenario: { random_motes: false, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }] }, ticks: 3700, every: 600 });
  const sp = r.events('shade_spawned');
  assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[1800, 'S3'], [3600, 'S4']]);
});

test('AC-19 building a scenario emits no events and gives no score', () => {
  const r = sim({ scenario: iso({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', deposited: 9 }] }), ticks: 0 });
  assert.equal(r.events().length, 0);
  assert.equal(r.end.score, 0);
  assert.deepEqual(r.snap(0).lanterns.slice(0, 2).map((l) => [l.lit, l.deposited]), [[true, 5], [true, 5]]);
});
