// Phase 1 acceptance tests (PRD-0), re-based on Ticket-02 standard numbers (Phase 2 regression).
// IDs map to docs/proof/phase-1/README.md. Tests changed by Ticket-02 say "T2:" and why
// (see docs/notes/phase-2.md §4). Tests changed by Ticket-03 say "T3:" (docs/notes/phase-3.md §4). Expected numbers are computed by hand in the comments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, iso } from './helpers.js';
import { TUNING as T } from '../src/sim/config.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const PLAYER0 = { pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0, flames: 3, carried: 0, capacity: 10 }; // T3: + capacity

test('AC-01 tick 0 snapshot: player at origin, standard Night 1 map, full time, playing', () => {
  const r = sim({ ticks: 0 });
  const s = r.snap(0);
  assert.deepEqual(s.player, PLAYER0);
  // T2: standard lantern positions (Part 2)
  assert.deepEqual(s.lanterns.map((l) => [l.id, l.pos]), [['L1', [0, 0, 25]], ['L2', [23.8, 0, 7.7]], ['L3', [14.7, 0, -20.2]], ['L4', [-14.7, 0, -20.2]], ['L5', [-23.8, 0, 7.7]]]);
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.state, 'playing');
  assert.equal(s.night, 1);
  assert.equal(s.motes_active, 20); // T2: 20 motes at start (was 30)
  assert.equal(s.shades.length, 0); // T2: first shades come at tick 300
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('AC-02 movement: 60 ticks of move [0,1] = player_speed metres along +Z', () => {
  const r = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [0, 1] }] });
  assert.deepEqual(r.snap(60).player.pos, [0, 0, T.player_speed]);
  assert.deepEqual(r.snap(60).player.vel, [0, 0, T.player_speed]);
});

test('AC-03 movement is camera-relative (cam_yaw_deg 90 -> +X) and normalised', () => {
  const a = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] });
  assert.deepEqual(a.snap(60).player.pos, [T.player_speed, 0, 0]);
  const b = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, move: [1, 1] }] });
  const p = b.snap(60).player.pos;
  assert.ok(Math.abs(Math.hypot(p[0], p[2]) - T.player_speed) < 1e-3, `diagonal not normalised: ${p}`);
});

test('AC-04 T2: walking off the island falls (Y < -10): -1 flame, lose motes, respawn after 60 ticks', () => {
  // T2: fall_enabled is now true. z = 0.1 n -> off the 40 m disc at n = 401 (state 401).
  // Free fall from state 401: y(m) = -m(m+1)/2 / 180 < -10  <=>  m = 60  ->  tick 460.
  const r = sim({ scenario: iso({ player: { carried: 4 } }), ticks: 600, frames: [{ tick: 0, move: [0, 1] }] });
  const hits = r.events('player_hit');
  assert.deepEqual(hits.map((h) => [h.tick, h.data]), [[460, { by: 'fall', flames: 2, dropped: 0, lost: 4 }]]);
  assert.equal(r.snap(460).player.carried, 0);
  // waits 60 ticks (459 -> 519), respawns at the start point, velocity 0, invulnerable 90 ticks
  assert.ok(r.snap(519).player.pos[1] < -10);
  assert.deepEqual(r.snap(520).player.pos, [0, 0, 0]);
  assert.deepEqual(r.snap(520).player.vel, [0, 0, 0]);
  assert.equal(r.snap(520).player.invuln, true);
  assert.equal(r.snap(521).player.pos[2], 0.1); // control resumes
});

test('AC-05 jump: leaves the ground then lands', () => {
  const r = sim({ scenario: iso(), ticks: 120, frames: [{ tick: 0, jump: true }] });
  assert.ok(r.snap(10).player.pos[1] > 0.5);
  assert.equal(r.snap(10).player.grounded, false);
  assert.equal(r.snap(120).player.pos[1], 0);
  assert.equal(r.snap(120).player.grounded, true);
});

test('AC-06 pickup within pickup_radius (boundary inclusive); T2: no score on pickup', () => {
  const r = sim({ scenario: iso({ motes: [[0, 0, 5]] }), ticks: 60, frames: [{ tick: 0, move: [0, 1] }] });
  const ev = r.events('mote_picked');
  assert.equal(ev.length, 1);
  // z after n ticks = 0.1n; 5 - 0.1n <= 1.0  ->  n = 40
  assert.equal(ev[0].tick, 40);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(r.snap(39).player.carried, 0);
  assert.equal(r.snap(40).score, 0); // T2: +10 per mote DEPOSITED, not picked
  assert.equal(r.snap(40).motes_active, 0);
});

test('AC-07 carry_capacity caps pickup', () => {
  const motes = Array.from({ length: 12 }, () => [0, 0, 0]);
  const r = sim({ scenario: iso({ motes }), ticks: 1 });
  assert.equal(r.snap(1).player.carried, T.carry_capacity);
  assert.equal(r.snap(1).motes_active, 2);
});

test('AC-08 deposit at exactly interact_radius lights a lantern; edge-triggered interact', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 23], carried: 12 } }), // exactly 2.0 m from L1
    ticks: 30,
    frames: [{ tick: 0, interact: true }], // held for 30 ticks: must deposit once only
  });
  const dep = r.events('deposit');
  assert.equal(dep.length, 1);
  assert.deepEqual(dep[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.equal(r.snap(1).player.carried, 2);
  assert.equal(r.snap(1).score, 10 * T.score.per_mote + T.score.per_lantern); // T3: 10 x 5 + 100 = 150
  assert.deepEqual(r.events('lantern_lit')[0].data, { lantern_id: 'L1', relight: false }); // T3: + relight
});

test('AC-09 partial deposits accumulate (lantern remembers progress)', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25], carried: 3 }, lanterns: [{ id: 'L1', deposited: 1 }] }),
    ticks: 5,
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.events('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 4 });
  assert.equal(r.events('lantern_lit').length, 0);
  assert.equal(r.end.score, 15); // T3: +5 per mote
});

test('AC-10 interact out of interact_radius does nothing', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25 - T.interact_radius - 0.1], carried: 5 } }),
    ticks: 5,
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.events('deposit').length, 0);
});

test('AC-11 T3: lighting the last lantern no longer ends the night (no early win); preset lanterns give no score', () => {
  // T3: Ticket-03 replaces "win as soon as all lanterns are lit" with "survive until dawn" (see P3-08)
  const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 1] }] }),
    ticks: 100,
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.events('lantern_lit').length, 1);
  assert.equal(r.snap(1).lanterns.filter((l) => l.lit).length, 5);
  assert.equal(r.events('game_over').length, 0);
  assert.deepEqual(r.end, { type: 'end', ticks: 100, state: 'playing', score: 10 * T.score.per_mote + T.score.per_lantern });
});

test('AC-12 shade chases at shade_speed', () => {
  const r = sim({ scenario: iso({ shades: [{ pos: [10, 0, 0] }] }), ticks: 60 });
  const s = r.snap(60).shades[0];
  assert.equal(s.id, 'S1');
  assert.equal(s.state, 'chase');
  assert.ok(Math.abs(s.pos[0] - (10 - T.shade_speed)) < 1e-3, `x=${s.pos[0]}`);
});

test('AC-13 shade contact: -1 flame, drops floor(carried/2), invuln_s; no flames -> lost', () => {
  const r = sim({ scenario: iso({ player: { carried: 4 }, shades: [{ id: 'X', pos: [2, 0, 0] }] }), ticks: 1000 });
  const hits = r.events('player_hit');
  // 1 m to cover at 4/60 m per tick -> tick 15
  assert.equal(hits[0].tick, 15);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(hits.length, 3);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].tick - hits[i - 1].tick >= 90, 'hits closer than invuln_s');
  assert.deepEqual(r.events('game_over').map((e) => [e.tick, e.data]), [[hits[2].tick, { result: 'lost', reason: 'no_flames' }]]);
  assert.deepEqual(r.end, { type: 'end', ticks: hits[2].tick, state: 'lost', score: 0 });
});

test('AC-14 pulse: costs pulse_cost, stuns + pushes shades in pulse_radius (3D), +per_stun', () => {
  const r = sim({
    // S1 at 3.1 m from the pulse centre (0, 0.8, 0); S2 at 5.56 m: out of range
    scenario: iso({ player: { carried: 3 }, shades: [{ pos: [3, 0, 0] }, { pos: [-5.5, 0, 0] }] }),
    ticks: 121,
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(r.events('pulse').map((e) => [e.tick, e.data]), [[1, { stunned_ids: ['S1'] }]]);
  const s1 = r.snap(1);
  assert.equal(s1.player.carried, 0);
  assert.equal(s1.score, T.score.per_stun);
  assert.equal(s1.shades[0].state, 'stunned');
  // T2: pushed back 4 m over the first 15 ticks (was instant)
  assert.deepEqual(r.snap(1).shades[0].pos, [3.267, 0, 0]);
  assert.deepEqual(r.snap(15).shades[0].pos, [3 + T.pulse_push_m, 0, 0]);
  // stunned 120 ticks, then chasing again
  assert.deepEqual(r.snap(120).shades[0].pos, [7, 0, 0]);
  assert.equal(r.snap(120).shades[0].state, 'stunned');
  assert.equal(r.snap(121).shades[0].state, 'chase');
});

test('AC-15 pulse needs pulse_cost light and respects pulse_cooldown_s', () => {
  const none = sim({ scenario: iso({ player: { carried: 2 } }), ticks: 5, frames: [{ tick: 0, pulse: true }] });
  assert.equal(none.events('pulse').length, 0);
  const cd = sim({
    scenario: iso({ player: { carried: 9 } }),
    ticks: 200,
    frames: [
      { tick: 0, pulse: true }, { tick: 1, pulse: false },
      { tick: 90, pulse: true }, { tick: 91, pulse: false }, // during cooldown: ignored
      { tick: 180, pulse: true }, { tick: 181, pulse: false }, // exactly 3 s later: ok
    ],
  });
  assert.deepEqual(cd.events('pulse').map((e) => e.tick), [1, 181]);
  assert.equal(cd.snap(200).player.carried, 3);
});

test('AC-16 shades never enter safe_radius of a lit lantern; player is safe there', () => {
  const r = sim({
    scenario: iso({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 0, 35] }, { pos: [3, 0, 18] }] }),
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

test('AC-18 T2: shade schedule: 2 at tick 300, then 1 every 8 s (480 ticks), max 6, >= 15 m from Mây', () => {
  // Mây hides in L1's light so no shade can reach her.
  const r = sim({ seed: 7, scenario: { random_motes: false, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }] }, ticks: 3300, every: 10 });
  const sp = r.events('shade_spawned');
  assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
  for (const e of sp) {
    const s = r.snap(e.tick).shades.find((x) => x.id === e.data.id);
    assert.equal(s.state, 'spawning');
    assert.ok(dist(s.pos, [0, 0, 25]) >= 15, `${s.id} spawned ${dist(s.pos, [0, 0, 25])} m from Mây`);
    assert.ok(Math.abs(Math.hypot(s.pos[0], s.pos[2]) - 37) < 1e-3, 'not on the 37 m spawn ring');
  }
});

test('AC-19 building a scenario emits no gameplay events and gives no score', () => {
  const r = sim({ scenario: iso({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', deposited: 9 }] }), ticks: 0 });
  assert.equal(r.events().length, 0); // only night_start (tick 0) is written
  assert.equal(r.end.score, 0);
  assert.deepEqual(r.snap(0).lanterns.slice(0, 2).map((l) => [l.lit, l.deposited, l.fuel, l.ever_lit]), [[true, 10, 100, true], [false, 9, 0, false]]); // T3: + fuel, ever_lit
});
