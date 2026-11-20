// Phase 3 acceptance tests (Ticket-03 "Đèn cạn dầu", Test Contract v1.2).
// IDs P3-xx map to docs/notes/phase-3.md §3 and docs/proof/phase-3/README.md.
// Fuel is 1/60 units internally: 100 fuel = 6000 units, decay 1 unit/tick, drain 5 units/tick/shade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, iso } from './helpers.js';
import { TUNING as T } from '../src/sim/config.js';

const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const FAR = [0, 0, -35]; // Mây far from L1 (0,0,25) so shades never notice her
const L = (r, t, id = 'L1') => r.snap(t).lanterns.find((l) => l.id === id);

test('P3-01 fuel: lit = 100, burns 1/s, goes out at exactly 0 (tick 6000) -> lantern_out, deposited 0, ever_lit', () => {
  const r = sim({ scenario: iso({ player: { pos: FAR }, lanterns: [{ id: 'L1', lit: true }] }), ticks: 6001, every: 60 });
  assert.equal(L(r, 0).fuel, 100);
  assert.equal(L(r, 60).fuel, 99);
  assert.equal(L(r, 600).fuel, 90);
  assert.equal(L(r, 5940).fuel, 1);
  assert.deepEqual(r.events('lantern_out').map((e) => [e.tick, e.data]), [[6000, { lantern_id: 'L1' }]]);
  assert.deepEqual(L(r, 6000), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('P3-02 refuel: used = min(carried, ceil((100 - fuel) / 10)), fuel = min(100, fuel + 10 x used), +5 per mote', () => {
  // fuel 55 -> 54.983 after this tick's burn -> ceil(4.5) = 5 motes -> capped at 100
  const a = sim({ scenario: iso({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(a.events('refuel').map((e) => e.data), [{ lantern_id: 'L1', amount: 5, fuel: 100 }]);
  assert.equal(a.snap(1).player.carried, 2);
  assert.equal(a.end.score, 5 * T.score.per_mote);
  // fuel 80 -> 79.983, 1 mote carried -> 89.983 -> shown 90.0
  const b = sim({ scenario: iso({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 80 }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(b.events('refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 90 });
  assert.equal(b.events('deposit').length, 0);
  // the nearest lantern that can take motes wins, lit or not
  const c = sim({ scenario: iso({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, { id: 'L2', pos: [1, 0, 0], lit: true, fuel: 95 }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.equal(c.events('refuel')[0].data.lantern_id, 'L2');
});

test('P3-03 relight: a lantern that has burned before needs 5 motes, +40, relight:true, relit_count+1, fuel back to 100', () => {
  const r = sim({ scenario: iso({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(r.events('deposit')[0].data, { lantern_id: 'L1', amount: T.relight_cost, deposited: 5 });
  assert.deepEqual(r.events('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  const l = L(r, 1);
  assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [true, 100, true, 1]);
  assert.equal(r.end.score, 5 * T.score.per_mote + 40);
  assert.equal(r.snap(1).player.carried, 2);
  // full cycle: burns out, then relit for 5
  const cyc = sim({ scenario: iso({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 0.05 }] }), ticks: 10, frames: [{ tick: 5, interact: true }] });
  assert.deepEqual(cyc.events().filter((e) => e.name !== 'deposit').map((e) => [e.tick, e.name]), [[3, 'lantern_out'], [6, 'lantern_lit']]);
});

test('P3-04 capacity = 10 + 2 x successful lights (lights and relights this night), max 20', () => {
  const cap = (n) => sim({ scenario: iso({ player: { successful_lights: n } }), ticks: 0 }).snap(0).player.capacity;
  assert.deepEqual([0, 1, 3, 5, 6, 9].map(cap), [10, 12, 16, 20, 20, 20]);
  const motes = Array.from({ length: 25 }, () => [0, 0, 0]);
  assert.equal(sim({ scenario: iso({ motes, player: { successful_lights: 6 } }), ticks: 1 }).snap(1).player.carried, 20);
  // lighting raises capacity at once; preset lanterns do not count
  const r = sim({ scenario: iso({ player: { pos: [0, 0, 23], carried: 12 }, lanterns: [{ id: 'L2', lit: true }] }), ticks: 1, frames: [{ tick: 0, interact: true }] });
  assert.equal(r.snap(0).player.capacity, 10);
  assert.equal(r.snap(1).player.capacity, 12);
});

test('P3-05 a lantern below 30 fuel loses its safe zone; exactly 30 still protects', () => {
  // fuel 30 + 1/60 -> exactly 30.0 after this tick's burn -> zone holds, shade clamped to 6.002
  const r = sim({ scenario: iso({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 30 + 1 / 60 }], shades: [{ pos: [6.05, 0, 0] }] }), ticks: 120 }); // 4.9 m at 4 m/s ~ 74 ticks
  assert.equal(L(r, 1).fuel, 30);
  assert.deepEqual(r.snap(1).shades[0].pos, [6.002, 0, 0]);
  // next tick 29.98 < 30: zone gone, the shade walks in and hits
  assert.deepEqual(r.snap(2).shades[0].pos, [5.935, 0, 0]);
  assert.ok(r.events('player_hit').length >= 1);
});

test('P3-06 a wandering shade goes to the nearest weak lantern, drains 5/s (+1/s burn) and reports fuel_drain every 60 ticks', () => {
  const r = sim({ scenario: iso({ player: { pos: FAR }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 20], state: 'wander' }] }), ticks: 300 });
  // 5 m -> 2 m at 2 m/s = 90 ticks
  assert.equal(r.snap(89).shades[0].state, 'wander');
  assert.equal(r.snap(90).shades[0].state, 'drain');
  assert.equal(L(r, 90).fuel, 18.5); // 20 - 90/60
  assert.equal(L(r, 150).fuel, 12.5); // -6/s while draining
  assert.deepEqual(r.events('fuel_drain').map((e) => [e.tick, e.data]), [
    [150, { lantern_id: 'L1', shade_id: 'S1', fuel: 12.5 }],
    [210, { lantern_id: 'L1', shade_id: 'S1', fuel: 6.5 }],
    [270, { lantern_id: 'L1', shade_id: 'S1', fuel: 0.5 }],
  ]);
  // 1110 units / 6 per tick = 185 ticks -> out at tick 275, the shade goes back to wander
  assert.deepEqual(r.events('lantern_out').map((e) => e.tick), [275]);
  assert.equal(r.snap(275).shades[0].state, 'wander');
});

test('P3-07 two shades draining add up (5/s each)', () => {
  const r = sim({ scenario: iso({ player: { pos: FAR }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }, { pos: [1, 1, 25], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 60 });
  assert.equal(L(r, 60).fuel, 9); // 20 - 60 x (1 + 5 + 5) / 60
});

test('P3-08 drain exits: Mây within 6 m -> chase; refuel to >= 30 -> pushed out to 6 m, no damage; pulse on a draining shade = +15', () => {
  const chase = sim({ scenario: iso({ player: { pos: [0, 0, 18.5] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 1 });
  assert.equal(chase.snap(1).shades[0].state, 'chase');
  const ref = sim({ scenario: iso({ player: { pos: [0, 0, 27], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 23], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 60, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(ref.events('refuel')[0].data, { lantern_id: 'L1', amount: 3, fuel: 49.9 }); // 20 - 1/60 burn - 5/60 drain this tick + 30
  assert.notEqual(ref.snap(1).shades[0].state, 'drain');
  assert.ok(dXZ(ref.snap(30).shades[0].pos, [0, 0, 25]) >= T.safe_radius);
  assert.equal(ref.events('player_hit').length, 0);
  const pulse = sim({ scenario: iso({ player: { pos: [0, 0, 21], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 1, frames: [{ tick: 0, pulse: true }] });
  assert.equal(pulse.end.score, 15);
  assert.equal(pulse.snap(1).shades[0].state, 'stunned');
});

test('P3-09 with no weak lantern a wandering shade goes to the nearest unlit lantern; stun ends in wander', () => {
  const r = sim({ scenario: iso({ player: { pos: FAR }, shades: [{ pos: [10, 1, 25], state: 'wander' }] }), ticks: 300, every: 300 });
  assert.deepEqual(r.snap(300).shades[0].pos, [1, 1, 25]); // parks 1 m from L1 after 9 m at 2 m/s
  const st = sim({ scenario: iso({ shades: [{ pos: [12.5, 0, 0], state: 'stunned', state_ticks_left: 1 }] }), ticks: 1 });
  assert.equal(st.snap(1).shades[0].state, 'wander');
});

test('P3-10 dawn: win (dawn_survived) needs >= ceil(0.6 x lanterns) lit at the last tick; bonus 50 + floor(fuel) per lit lantern + 50 per flame', () => {
  const lit = (n, night = 1) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  const won = sim({ scenario: iso({ time_left_s: 1, player: { pos: FAR }, lanterns: lit(3) }), ticks: 100, every: 60 });
  assert.deepEqual(won.events('game_over').map((e) => [e.tick, e.data]), [[60, { result: 'won', reason: 'dawn_survived' }]]);
  assert.equal(won.end.score, 3 * (50 + 99) + 3 * 50); // fuel 99.0 after 1 s
  const lost = sim({ scenario: iso({ time_left_s: 1, player: { pos: FAR }, lanterns: lit(2) }), ticks: 100 });
  assert.deepEqual(lost.events('game_over').map((e) => e.data), [{ result: 'lost', reason: 'dawn' }]);
  assert.equal(lost.end.score, 0); // no dawn bonus when lost
  const at = (night, n) => sim({ night, scenario: iso({ time_left_s: 1, lanterns: lit(n) }), ticks: 60 }).end.state;
  assert.deepEqual([at(2, 4), at(2, 3), at(3, 5), at(3, 4)], ['won', 'lost', 'won', 'lost']);
  // a lantern that burns out before dawn does not count
  const out = sim({ scenario: iso({ time_left_s: 1, player: { pos: FAR }, lanterns: [...lit(2), { id: 'L3', lit: true, fuel: 0.5 }] }), ticks: 60 });
  assert.equal(out.end.state, 'lost');
});

test('P3-11 night durations 240 / 270 / 300 s and no early win when every lantern is lit', () => {
  for (const [night, s] of [[1, 240], [2, 270], [3, 300]]) assert.equal(sim({ night, ticks: 0 }).snap(0).time_left_s, s);
  const all = sim({ scenario: iso({ player: { pos: FAR }, lanterns: [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true })) }), ticks: 600, every: 600 });
  assert.equal(all.end.state, 'playing');
});

test('P3-12 scenario: lit lantern without fuel -> 100; ever_lit:false lit lantern needs 10 again after burning out', () => {
  const r = sim({ scenario: iso({ player: { carried: 9 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 0.02, ever_lit: false }] }), ticks: 5, frames: [{ tick: 2, interact: true }] });
  assert.deepEqual(r.events('deposit')[0].data, { lantern_id: 'L1', amount: 9, deposited: 9 }); // cost 10, not lit yet
  assert.equal(r.events('lantern_lit').length, 0);
});
