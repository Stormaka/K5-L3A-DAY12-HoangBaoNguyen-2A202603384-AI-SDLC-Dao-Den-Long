// Phase 2 acceptance tests (Ticket-02 "Ba hòn đảo", Test Contract v1.1).
// IDs P2-xx map to docs/notes/phase-2.md §3 and docs/proof/phase-2/README.md.
// Expected numbers are computed by hand in the comments, before running.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, iso } from './helpers.js';
import { TUNING as T } from '../src/sim/config.js';
import { NIGHTS } from '../src/sim/maps.js';

const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------- maps / 3 nights

test('P2-01 standard maps: Night 2 and 3 lanterns, durations, start, 20 motes on distinct spawn points', () => {
  const n2 = sim({ night: 2, ticks: 0 }).snap(0);
  assert.equal(n2.night, 2);
  assert.equal(n2.time_left_s, T.night2_duration_s);
  assert.deepEqual(n2.lanterns.map((l) => [l.id, l.pos]), [['L1', [0, 0, 20]], ['L2', [17, 0, -10]], ['L3', [-17, 0, -10]], ['L4', [70, 0, 20]], ['L5', [87, 0, -10]], ['L6', [53, 0, -10]]]);
  assert.deepEqual(n2.charms, [{ id: 'C1', pos: [35, 0, 0], available: true, respawn_s: 0 }]);
  const n3 = sim({ night: 3, ticks: 0 }).snap(0);
  assert.equal(n3.time_left_s, T.night3_duration_s);
  assert.deepEqual(n3.player.pos, [0, 0, -30]); // A2-01
  assert.deepEqual(n3.lanterns.map((l) => l.pos), [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
  assert.deepEqual(n3.charms.map((c) => c.pos), [[30, 0, 25], [-30, 0, 25]]);
  assert.deepEqual([NIGHTS[1].motePoints.length, NIGHTS[2].motePoints.length, NIGHTS[3].motePoints.length], [24, 24, 30]);
  for (const [night, s] of [[1, sim({ ticks: 0 }).snap(0)], [2, n2], [3, n3]]) {
    assert.equal(s.motes.length, 20);
    const keys = new Set(s.motes.map((m) => m.pos.join()));
    assert.equal(keys.size, 20, `night ${night}: motes not on distinct points`);
    for (const m of s.motes) {
      assert.equal(m.kind, 'random');
      assert.ok(NIGHTS[night].motePoints.some((p) => dXZ(p, m.pos) < 1e-3), `night ${night}: ${m.pos} not a spawn point`);
    }
  }
  // Night 3 tiers: motes sit on their tier (r 34 -> Y 0, r 18 -> Y 3, r 5 -> Y 6)
  for (const m of n3.motes) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    assert.equal(m.pos[1], r < 6 ? 6 : r < 20 ? 3 : 0);
  }
});

test('P2-02 mote schedule: +1 at ticks 240, 480, ... on a free point; skip when no free point', () => {
  const r = sim({ seed: 3, scenario: { random_shades: false }, ticks: 1300, every: 10 });
  // Night 1 has 24 points, 20 taken -> 4 spawns, then no free point
  assert.deepEqual([0, 230, 240, 480, 720, 960, 1200].map((t) => r.snap(t).motes_active), [20, 20, 21, 22, 23, 24, 24]);
  assert.equal(new Set(r.snap(1200).motes.map((m) => m.id)).size, 24);
});

// ---------------------------------------------------------------- movement, jump, dash

test('P2-03 jump: v 7 m/s, g 20 -> apex ~1.2 m; only from the ground (no double jump)', () => {
  const one = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, jump: true }] });
  const ys = one.lines.filter((l) => l.type === 'snapshot').map((s) => s.player.pos[1]);
  const apex = Math.max(...ys);
  assert.ok(apex > 1.15 && apex <= 1.225, `apex ${apex}`); // v^2 / 2g = 1.225
  const two = sim({ scenario: iso(), ticks: 60, frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }] });
  assert.deepEqual(two.lines.filter((l) => l.type === 'snapshot').map((s) => s.player.pos[1]), ys);
});

test('P2-04 dash: 14 m/s for 0.2 s (12 ticks) along facing when idle, cooldown 1.5 s from dash start', () => {
  const r = sim({
    scenario: iso(),
    ticks: 120,
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 90, dash: true }, { tick: 91, dash: false }],
  });
  assert.deepEqual(r.events('dash').map((e) => [e.tick, e.data]), [[1, {}], [91, {}]]);
  assert.deepEqual(r.snap(1).player.vel, [0, 0, T.dash_speed]);
  assert.equal(r.snap(1).player.dash_cd_s, T.dash_cooldown_s);
  assert.deepEqual(r.snap(12).player.pos, [0, 0, 2.8]); // 14 * 12 / 60
  assert.deepEqual(r.snap(13).player.pos, [0, 0, 2.8]);
  assert.deepEqual(r.snap(102).player.pos, [0, 0, 5.6]);
});

test('P2-05 dash follows the movement direction; in the air it keeps altitude', () => {
  const mv = sim({ scenario: iso(), ticks: 12, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90, dash: true }] });
  assert.deepEqual(mv.snap(12).player.pos, [2.8, 0, 0]);
  const air = sim({ scenario: iso(), ticks: 30, frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }] });
  const y10 = air.snap(10).player.pos[1];
  for (let t = 11; t <= 22; t++) assert.equal(air.snap(t).player.pos[1], y10, `tick ${t}`);
  assert.notEqual(air.snap(23).player.pos[1], y10);
  assert.equal(air.events('player_hit').length, 0);
});

test('P2-06 pickup needs XZ <= 1.0 m AND height difference <= 1.5 m', () => {
  assert.equal(sim({ scenario: iso({ motes: [[0, 1.5, 0.5]] }), ticks: 1 }).snap(1).player.carried, 1);
  assert.equal(sim({ scenario: iso({ motes: [[0, 1.6, 0.5]] }), ticks: 10 }).snap(10).player.carried, 0);
});

// ---------------------------------------------------------------- lanterns + safe zone

test('P2-07 interact picks the nearest unlit lantern, ties -> lower id', () => {
  const tie = sim({ scenario: iso({ player: { carried: 5 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(tie.events('deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  const nearer = sim({ scenario: iso({ player: { carried: 5 }, lanterns: [{ id: 'L2', pos: [0.9, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.equal(nearer.events('deposit')[0].data.lantern_id, 'L2');
});

test('P2-08 lighting a lantern pushes shades inside to the 6 m edge within 30 ticks, no damage meanwhile', () => {
  const r = sim({
    scenario: iso({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ pos: [0.5, 0, 0] }] }),
    ticks: 300,
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.events('lantern_lit').length, 1);
  assert.equal(r.snap(1).shades[0].pos[0], 0.683); // 0.5 + 5.502 / 30
  assert.ok(r.snap(29).shades[0].pos[0] < 6);
  assert.deepEqual(r.snap(30).shades[0].pos, [6.002, 0, 0]);
  assert.equal(r.events('player_hit').length, 0);
  for (const s of r.lines.filter((l) => l.type === 'snapshot' && l.tick >= 30)) assert.ok(dXZ(s.shades[0].pos, [0, 0, 0]) >= T.safe_radius);
});

// ---------------------------------------------------------------- pulse

test('P2-09 pulse refreshes stun on a stunned shade and still scores +5; push stops at obstacles; overlap pushes +X', () => {
  const r = sim({
    scenario: iso({ player: { carried: 3 }, shades: [{ pos: [3, 0, 0], state: 'stunned', state_ticks_left: 500 }] }),
    ticks: 125,
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(r.snap(1).score, T.score.per_stun);
  assert.equal(r.snap(120).shades[0].state, 'stunned');
  assert.equal(r.snap(121).shades[0].state, 'chase'); // refreshed to 120, not 500
  // push towards the sea: 39 -> 39.267, 39.533, 39.8, then 40.067 is off the island -> stop
  const edge = sim({ scenario: iso({ player: { pos: [37, 0, 0], carried: 3 }, shades: [{ pos: [39, 0, 0] }] }), ticks: 20, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(edge.snap(20).shades[0].pos, [39.8, 0, 0]);
  const same = sim({ scenario: iso({ player: { carried: 3 }, shades: [{ pos: [0, 0, 0] }] }), ticks: 15, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(same.snap(15).shades[0].pos, [4, 0, 0]);
  assert.equal(same.events('player_hit').length, 0);
});

test('P2-10 pulse is 3D from feet + 0.8 m (shade 5.0 m above the centre is hit, 5.1 m is not)', () => {
  const hit = sim({ scenario: iso({ player: { carried: 3 }, shades: [{ pos: [0, 5.8, 0] }] }), ticks: 1, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(hit.events('pulse')[0].data, { stunned_ids: ['S1'] });
  const miss = sim({ scenario: iso({ player: { carried: 3 }, shades: [{ pos: [0, 5.9, 0] }] }), ticks: 1, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(miss.events('pulse')[0].data, { stunned_ids: [] });
});

// ---------------------------------------------------------------- shades

test('P2-11 shade detection 12 m / give up 18 m; Night 3 shades run 4.5 m/s', () => {
  const st = (pos, state) => sim({ scenario: iso({ shades: [{ pos, state }] }), ticks: 1 }).snap(1).shades[0].state;
  assert.equal(st([12, 0, 0], 'wander'), 'chase');
  assert.equal(st([12.5, 0, 0], 'wander'), 'wander');
  assert.equal(st([17.9, 0, 0], 'chase'), 'chase');
  assert.equal(st([18.5, 0, 0], 'chase'), 'wander');
  const n3 = sim({ night: 3, scenario: iso({ shades: [{ pos: [10, 1, -30] }] }), ticks: 60 });
  assert.deepEqual(n3.snap(60).shades[0].pos, [5.5, 1, -30]);
});

test('P2-12 hit: the hitting shade recoils 2 m over 60 ticks; a second shade touching while invulnerable does nothing', () => {
  const r = sim({ scenario: iso({ player: { carried: 5 }, shades: [{ pos: [2, 0, 0] }, { pos: [-2, 0, 0] }] }), ticks: 80 });
  const hits = r.events('player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 15, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.deepEqual(r.snap(15).shades.map((s) => s.state), ['recoil', 'chase']); // S1 hit (lower id)
  assert.deepEqual(r.snap(16).shades[0].pos, [1.033, 0, 0]);
  assert.deepEqual(r.snap(74).shades[0].pos, [2.967, 0, 0]); // 59 recoil steps of 2/60 m
  assert.equal(r.snap(74).shades[0].state, 'recoil');
  assert.equal(r.snap(75).shades[0].state, 'chase');
  assert.equal(hits.length, 1);
  // dropped motes land on the 1.5-2.5 m ring, live 480 ticks
  const dropped = r.snap(15).motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const d = dXZ(m.pos, [0, 0, 0]);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `drop at ${d} m`);
    assert.equal(m.ttl_s, 8);
  }
});

test('P2-13 dropped motes expire after their TTL', () => {
  const r = sim({ scenario: iso({ motes: [{ pos: [5, 0, 0], kind: 'dropped', ttl_ticks: 5 }] }), ticks: 6 });
  assert.deepEqual(r.snap(4).motes.map((m) => [m.kind, m.ttl_s]), [['dropped', 0.017]]);
  assert.equal(r.snap(5).motes_active, 0);
});

// ---------------------------------------------------------------- falling

test('P2-14 falling ignores invulnerability; with the last flame it is game over at once (no respawn)', () => {
  const r = sim({ scenario: iso({ player: { pos: [0, 0, 39.9], flames: 1, carried: 2, invuln_ticks: 1000 } }), ticks: 200, frames: [{ tick: 0, move: [0, 1] }] });
  const hit = r.events('player_hit');
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 0, dropped: 0, lost: 2 });
  assert.deepEqual(r.events('game_over').map((e) => [e.tick, e.data]), [[hit[0].tick, { result: 'lost', reason: 'no_flames' }]]);
});

// ---------------------------------------------------------------- win / lose order

test('P2-15 T3: win/lose order: enough lanterns lit on the dawn tick wins (dawn_survived); losing the last flame on the dawn tick loses (no_flames)', () => {
  // T3: reason all_lit no longer exists; the win is checked at dawn (Ticket-03 §3)
  const lit = ['L1', 'L2'].map((id) => ({ id, lit: true }));
  const win = sim({ scenario: iso({ time_left_s: 1 / 60, player: { carried: 10 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 1] }] }), ticks: 5, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(win.events('game_over').map((e) => e.data), [{ result: 'won', reason: 'dawn_survived' }]);
  // 10 x 5 + 100 (L5) + 3 lit x (50 + floor(fuel)) + 3 flames x 50; L1/L2 burned 1 tick -> floor(99.98) = 99, L5 lit this tick -> 100
  assert.equal(win.end.score, 50 + 100 + (50 + 99) * 2 + (50 + 100) + 150);
  const lose = sim({ scenario: iso({ time_left_s: 0.25, player: { flames: 1 }, shades: [{ pos: [2, 0, 0] }] }), ticks: 30 });
  assert.deepEqual(lose.events('game_over').map((e) => [e.tick, e.data]), [[15, { result: 'lost', reason: 'no_flames' }]]);
});

// ---------------------------------------------------------------- pause

test('P2-16 pause: tick advances but sim_tick, time, cooldowns and movement freeze; paused/resumed events', () => {
  const r = sim({
    scenario: iso({ player: { carried: 3 } }),
    ticks: 30,
    frames: [{ tick: 0, move: [0, 1], pulse: true }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 15, interact: true }, { tick: 20, pause: true }, { tick: 21, pause: false }],
  });
  assert.deepEqual(r.events().filter((e) => e.name === 'paused' || e.name === 'resumed').map((e) => [e.tick, e.name]), [[11, 'paused'], [21, 'resumed']]);
  const p = r.snap(15);
  assert.equal(p.state, 'paused');
  assert.equal(p.sim_tick, 10);
  assert.deepEqual(p.player.pos, [0, 0, 1]);
  assert.equal(p.player.pulse_cd_s, r.snap(11).player.pulse_cd_s);
  assert.equal(p.time_left_s, r.snap(10).time_left_s);
  const after = r.snap(30);
  assert.equal(after.state, 'playing');
  assert.equal(after.sim_tick, 20);
  assert.deepEqual(after.player.pos, [0, 0, 2]);
  assert.equal(after.time_left_s, 239.667); // T3: Night 1 is 240 s
});

// ---------------------------------------------------------------- launch pads + terrain

test('P2-17 Night 2 launch pad flings Mây to island B; move keys cannot steer the flight', () => {
  const free = sim({ night: 2, scenario: iso({ player: { pos: [20, 0, 18] } }), ticks: 100 });
  const steer = sim({ night: 2, scenario: iso({ player: { pos: [20, 0, 18] } }), ticks: 100, frames: [{ tick: 1, move: [-1, 0] }, { tick: 84, move: [0, 0] }] });
  const land = free.snap(100).player;
  assert.equal(land.grounded, true);
  assert.equal(land.pos[1], 0);
  assert.ok(dXZ(land.pos, [70, 0, 0]) <= 28, `landed at ${land.pos}`);
  assert.deepEqual(steer.snap(84).player.pos, free.snap(84).player.pos);
  assert.equal(free.events('player_hit').length, 0);
  const mid = free.snap(42).player;
  assert.ok(mid.pos[1] > 4.5 && !mid.grounded, 'not airborne mid-flight'); // apex = 14^2 / 40 = 4.9 m
});

test('P2-18 Night 3 terrain: tier walls block, ramps climb to tier 1, pad reaches tier 2, tower is solid', () => {
  const wall = sim({ night: 3, scenario: iso(), ticks: 300, frames: [{ tick: 0, move: [0, 1] }] });
  assert.deepEqual(wall.snap(300).player.pos, [0, 0, -8.1]); // tier 2 cliff at r = 8
  const tier1 = sim({ night: 3, scenario: iso({ player: { pos: [0, 0, 30] } }), ticks: 100, frames: [{ tick: 0, move: [0, -1] }] });
  assert.deepEqual(tier1.snap(100).player.pos, [0, 0, 24.1]); // tier 1 cliff at r = 24
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const ramp = sim({ night: 3, scenario: iso({ player: { pos: [32 * c, 0, 32 * s] } }), ticks: 100, frames: [{ tick: 0, move: [-c, -s] }] });
  const mid = ramp.snap(50).player.pos[1];
  assert.ok(mid > 0 && mid < 3, `on ramp y=${mid}`);
  assert.equal(ramp.snap(100).player.pos[1], 3);
  assert.equal(ramp.snap(100).player.grounded, true);
  const pad = sim({ night: 3, scenario: iso({ player: { pos: [0, 3, 13] } }), ticks: 120 });
  const p = pad.snap(120).player;
  assert.equal(p.pos[1], 6);
  assert.ok(Math.hypot(p.pos[0], p.pos[2]) <= 8);
  const tower = sim({ night: 3, scenario: iso({ player: { pos: [0, 6, 5] } }), ticks: 60, frames: [{ tick: 0, move: [0, -1] }] });
  assert.deepEqual(tower.snap(60).player.pos, [0, 6, 2]);
});

test('P2-19 Night 3 wind: every 30 s a 5 s gust pushes Mây 2 m/s; announced 2 s before; off when disabled', () => {
  const r = sim({ night: 3, scenario: iso({ wind_enabled: true }), ticks: 2101, every: 1 });
  assert.equal(r.snap(1799).wind.active, false);
  assert.equal(r.snap(1800).wind.active, true);
  assert.equal(r.snap(2099).wind.active, true);
  assert.equal(r.snap(2100).wind.active, false);
  const dir = r.snap(1680).wind.dir_deg; // chosen at the warning, 2 s before
  assert.equal(r.snap(1800).wind.dir_deg, dir);
  assert.deepEqual(r.snap(1799).player.pos, [0, 0, -30]);
  const a = r.snap(2100).player.pos;
  assert.ok(near(dXZ(a, [0, 0, -30]), 10), `moved ${dXZ(a, [0, 0, -30])}`); // 300 ticks * 2/60
  const ang = (Math.atan2(a[2] + 30, a[0]) * 180) / Math.PI;
  assert.ok(near(((ang % 360) + 360) % 360, dir, 0.05), `push angle ${ang} vs ${dir}`);
  const calm = sim({ night: 3, scenario: iso({ wind_enabled: false }), ticks: 2100, every: 2100 });
  assert.deepEqual(calm.snap(2100).player.pos, [0, 0, -30]);
});

// ---------------------------------------------------------------- Gió Lạc (drifters)

test('P2-20 drifter: idle -> chase when Mây carries >= 5 within 15 m; steals min(3, carried) even when invulnerable, flees 240 ticks then removed', () => {
  const r = sim({ night: 2, scenario: iso({ player: { carried: 6, invuln_ticks: 300 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }), ticks: 330 });
  assert.equal(r.snap(1).drifters[0].state, 'chase');
  // 10 - 1.2 = 8.8 m at 7/60 m per tick -> 76 ticks
  assert.deepEqual(r.events('drifter_steal').map((e) => [e.tick, e.data]), [[76, { drifter_id: 'D1', amount: 3, carried: 3 }]]);
  assert.deepEqual(r.snap(76).drifters[0].state, 'flee');
  assert.equal(r.snap(76).drifters[0].stolen, 3);
  assert.equal(r.snap(315).drifters[0].state, 'flee');
  assert.equal(r.snap(316).drifters[0].state, 'removed');
  assert.equal(r.events('player_hit').length, 0); // drifters never cost a flame
  assert.equal(r.end.state, 'playing');
  const poor = sim({ night: 2, scenario: iso({ player: { carried: 4 }, drifters: [{ pos: [10, 1.5, 0] }] }), ticks: 1 });
  assert.equal(poor.snap(1).drifters[0].state, 'idle');
});

test('P2-21 pulse on a chasing drifter -> flee without stealing; on a fleeing one with loot -> drops it (drifter_drop), gone after 120 ticks', () => {
  const chase = sim({ night: 2, scenario: iso({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }), ticks: 300, frames: [{ tick: 0, pulse: true }] });
  assert.equal(chase.snap(1).drifters[0].state, 'flee');
  assert.equal(chase.events('drifter_steal').length, 0);
  assert.equal(chase.end.state, 'playing');
  const loot = sim({ night: 2, scenario: iso({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }), ticks: 130, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(loot.events('drifter_drop').map((e) => [e.tick, e.data]), [[1, { drifter_id: 'D1', amount: 3 }]]);
  assert.deepEqual(loot.snap(1).motes.map((m) => [m.kind, m.pos]), [['dropped', [3, 0, 0]], ['dropped', [3, 0, 0]], ['dropped', [3, 0, 0]]]);
  assert.equal(loot.snap(1).drifters[0].stolen, 0);
  assert.equal(loot.snap(120).drifters[0].state, 'flee');
  assert.equal(loot.snap(121).drifters[0].state, 'removed');
});

test('P2-22 drifters spawn at ticks 1200, 2400, ... (max 2 alive, ids D1, D2) on Nights 2-3 only', () => {
  const r = sim({ night: 2, seed: 5, scenario: iso({ random_drifters: true }), ticks: 3600, every: 1200 });
  assert.deepEqual([r.snap(0), r.snap(1200), r.snap(2400), r.snap(3600)].map((s) => s.drifters.map((d) => d.id)), [[], ['D1'], ['D1', 'D2'], ['D1', 'D2']]);
  const n1 = sim({ night: 1, seed: 5, scenario: { random_shades: false }, ticks: 1200, every: 1200 });
  assert.deepEqual(n1.snap(1200).drifters, []);
});

// ---------------------------------------------------------------- Bùa Gió (charm)

test('P2-23 charm: pick up -> 600 ticks of 7.2 m/s and dash without cooldown; respawns 2700 ticks later', () => {
  const r = sim({
    night: 2,
    scenario: iso({ player: { pos: [35, 0, 0] }, charms: [{ id: 'C1', pos: [35, 0, 0] }] }),
    ticks: 2701,
    every: 1,
    frames: [{ tick: 1, move: [0, 1], cam_yaw_deg: 90 }, { tick: 61, move: [0, 0] }],
  });
  assert.deepEqual(r.events('charm_picked').map((e) => [e.tick, e.data]), [[1, { charm_id: 'C1', charm_ticks: 600 }]]);
  assert.equal(r.snap(1).player.charm_s, 10);
  assert.deepEqual(r.snap(61).player.pos, [42.2, 0, 0]); // 60 ticks at 7.2 m/s
  assert.equal(r.snap(61).player.charm_s, 9);
  assert.deepEqual(r.snap(1).charms[0], { id: 'C1', pos: [35, 0, 0], available: false, respawn_s: 45 });
  assert.equal(r.snap(2700).charms[0].available, false);
  assert.equal(r.snap(2701).charms[0].available, true);
  const d = sim({
    night: 2,
    scenario: iso({ player: { pos: [35, 0, 0] }, charms: [{ id: 'C1', pos: [35, 0, 0] }] }),
    ticks: 40,
    frames: [{ tick: 1, dash: true }, { tick: 2, dash: false }, { tick: 6, dash: true }, { tick: 7, dash: false }, { tick: 13, dash: true }, { tick: 14, dash: false }],
  });
  // dash at 1 (lasts steps 1-12); press at 6 is ignored (still dashing); 13 works (no cooldown)
  assert.deepEqual(d.events('dash').map((e) => e.tick), [2, 14]);
  assert.equal(d.snap(2).player.dash_cd_s, 0);
});

test('P2-24 charm expires after 600 ticks: speed back to 6 m/s', () => {
  const r = sim({ scenario: iso({ player: { charm_ticks: 1 } }), ticks: 61, frames: [{ tick: 1, move: [0, 1] }] });
  assert.equal(r.snap(1).player.charm_s, 0);
  assert.deepEqual(r.snap(61).player.pos, [0, 0, 6]);
});

// ---------------------------------------------------------------- determinism across nights

test('P2-25 every night is deterministic and ends within its duration', () => {
  for (const night of [1, 2, 3]) {
    const a = sim({ night, seed: 9, ticks: 25000, every: 600 });
    const b = sim({ night, seed: 9, ticks: 25000, every: 600 });
    assert.equal(JSON.stringify(a.lines), JSON.stringify(b.lines));
    assert.notEqual(a.end.state, 'playing');
    assert.ok(a.end.ticks <= NIGHTS[night].duration_s * 60);
  }
});
