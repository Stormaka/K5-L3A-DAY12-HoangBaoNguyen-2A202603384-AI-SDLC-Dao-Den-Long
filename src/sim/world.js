// Pure, deterministic game logic (Ticket-02 + Ticket-03 / Test Contract v1.2). No DOM, no wall clock, no
// Math.random. Shared by the headless runner (Node) and the 3D client (browser).
import { TUNING as T, WORLD as W, DT, TICK_RATE, FUEL_UNIT, FUEL_MAX_U, LOW_FUEL_U, DECAY_U, DRAIN_U, MOTE_FUEL_U } from './config.js';
import { createRng } from './rng.js';
import { FormatError } from './validate.js';
import { getNight } from './maps.js';

// Tolerance for "within r" checks: far below the 3-decimal output, absorbs drift of the 1e-9 position grid
// (90 steps of 1/30 m drift by ~3e-8, see P3-06).
const EPS = 1e-6;
const inR = (d, r) => d <= r + EPS;
const q = (v) => {
  const r = Math.round(v * 1e9) / 1e9; // 1e-9 grid: no float drift at exact boundaries
  return r === 0 ? 0 : r;
};
const dXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ticks = (s) => Math.round(s * TICK_RATE);
const rad = (d) => (d * Math.PI) / 180;
const idNum = (id) => {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : Infinity;
};
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const PULSE_CD = ticks(T.pulse_cooldown_s);
export const DASH_TICKS = ticks(T.dash_duration_s);
export const DASH_CD = ticks(T.dash_cooldown_s);
export const INVULN = ticks(T.invuln_s);
export const STUN = ticks(T.pulse_stun_s);
export const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

// ---------------------------------------------------------------- build

/** Build the initial world for a night. Building never emits events nor awards score. */
export function createWorld(seed, scenario = {}, night = 1) {
  const map = getNight(night);
  if (!map) throw new FormatError(`night ${night} does not exist`);
  const rng = createRng(seed);
  const sp = scenario.player || {};
  const pos = sp.pos || map.start;
  const w = {
    rng,
    map,
    night,
    tick: 0,
    simTick: 0,
    state: 'playing',
    paused: false,
    score: 0,
    timeStart: scenario.time_left_s ?? map.duration_s,
    player: {
      x: pos[0], y: pos[1], z: pos[2],
      vx: 0, vy: 0, vz: 0, fallV: 0,
      grounded: false,
      fx: 0, fz: 1, // facing +Z
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      pulseCd: sp.pulse_cd_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      dash: 0, dashX: 0, dashZ: 0,
      launch: null,
      dead: 0, // respawn wait after falling
      lights: sp.successful_lights ?? 0, // successful lights this night (capacity grows with it)
    },
    prev: Object.fromEntries(BUTTONS.map((b) => [b, false])),
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: scenario.random_drifters ?? map.drifters,
    windEnabled: scenario.wind_enabled ?? map.wind,
    wind: { active: false, warn: false, dir_deg: 0 },
    motes: [], nextMoteId: 1,
    shades: [], nextShadeId: 1,
    drifters: [], nextDrifterId: 1,
    charms: [],
    lanterns: map.lanterns.map((p, i) => ({ id: `L${i + 1}`, x: p[0], y: p[1], z: p[2], lit: false, deposited: 0, fuel: 0, everLit: false, relit: 0, justLit: false })),
    events: [],
  };
  const p = w.player;
  const g = map.ground(p.x, p.z);
  if (p.y <= g + 1e-6) {
    p.y = g;
    p.grounded = true;
  }

  for (const l of scenario.lanterns || []) {
    const lan = w.lanterns.find((x) => x.id === l.id);
    if (!lan) throw new FormatError(`scenario.lanterns: unknown lantern id "${l.id}" for night ${night}`);
    if (l.pos) [lan.x, lan.y, lan.z] = l.pos;
    if (l.ever_lit !== undefined) lan.everLit = l.ever_lit;
    if (l.lit !== undefined) lan.lit = l.lit;
    if (l.deposited !== undefined) lan.deposited = Math.min(l.deposited, lightCost(lan));
    if (!lan.lit && lan.deposited >= lightCost(lan)) lan.lit = true; // deposited >= cost counts as lit
    if (lan.lit) {
      // A3-02: a lantern placed lit has burned before -> ever_lit; fuel defaults to 100
      lan.deposited = lightCost(lan);
      lan.everLit = l.ever_lit ?? true;
      lan.fuel = l.fuel !== undefined ? Math.max(0, Math.min(FUEL_MAX_U, Math.round(l.fuel * FUEL_UNIT))) : FUEL_MAX_U;
    } else lan.fuel = 0;
  }

  if (scenario.motes) {
    for (const m of scenario.motes) addMote(w, m.pos[0], m.pos[1], m.pos[2], m.kind || 'random', m.kind === 'dropped' ? m.ttl_ticks ?? W.drop_ttl_ticks : null);
  } else if (w.randomMotes) {
    const pts = map.motePoints.slice();
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    for (const pt of pts.slice(0, W.mote_start)) addMote(w, pt[0], map.ground(pt[0], pt[2]), pt[2], 'random', null);
  }

  if (scenario.shades) {
    const used = new Set(scenario.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of scenario.shades) {
      const id = s.id || nextId(w, 'S', 'nextShadeId', used);
      used.add(id);
      const sh = newShade(w, id, s.pos[0], s.pos[1], s.pos[2], s.state || 'chase');
      sh.t = s.state_ticks_left ?? (sh.state === 'stunned' ? STUN : sh.state === 'recoil' ? W.recoil_ticks : sh.state === 'spawning' ? W.shade_spawning_ticks : 0);
      if (sh.state === 'recoil') [sh.rdx, sh.rdz] = awayDir(sh, p);
      if (s.target_lantern_id !== undefined) {
        sh.target = w.lanterns.find((l) => l.id === s.target_lantern_id) || null;
        if (!sh.target) throw new FormatError(`scenario.shades: unknown target_lantern_id "${s.target_lantern_id}" for night ${night}`);
      }
      w.shades.push(sh);
    }
  }

  if (scenario.drifters) {
    const used = new Set(scenario.drifters.filter((d) => d.id).map((d) => d.id));
    for (const d of scenario.drifters) {
      const id = d.id || nextId(w, 'D', 'nextDrifterId', used);
      used.add(id);
      const dr = newDrifter(w, id, d.pos[0], d.pos[2]);
      if (d.pos[1] !== undefined) dr.y = d.pos[1];
      dr.state = d.state || 'idle';
      dr.stolen = d.stolen ?? 0;
      if (dr.state === 'flee') dr.t = d.state_ticks_left ?? W.drifter_flee_ticks;
      w.drifters.push(dr);
    }
  }

  const charmSrc = scenario.charms || map.charms.map((c) => ({ pos: c }));
  charmSrc.forEach((c, i) => {
    w.charms.push({
      id: c.id || `C${i + 1}`,
      x: c.pos[0], y: c.pos[1], z: c.pos[2],
      available: c.available ?? true,
      respawn: c.available === false ? c.respawn_ticks ?? W.charm_respawn_ticks : 0,
    });
  });
  return w;
}

function nextId(w, prefix, key, used) {
  let id;
  do id = `${prefix}${w[key]++}`;
  while (used && used.has(id));
  return id;
}

function addMote(w, x, y, z, kind, ttl) {
  const m = { id: `M${w.nextMoteId++}`, x, y, z, kind, ttl };
  w.motes.push(m);
  return m;
}

function newShade(w, id, x, y, z, state) {
  const g = w.map.ground(x, z);
  return { id, x, y, z, hover: Number.isFinite(g) ? y - g : W.shade_hover, state, t: 0, push: 0, pdx: 0, pdz: 0, rdx: 0, rdz: 0, evict: null, wp: null, target: null, drainTicks: 0 };
}

function newDrifter(w, id, x, z) {
  const g = w.map.ground(x, z);
  return { id, x, y: (Number.isFinite(g) ? Math.max(0, g) : 0) + W.drifter_hover, z, state: 'idle', stolen: 0, t: 0, wp: null };
}

function awayDir(from, origin) {
  const d = dXZ(from, origin);
  return d > 1e-9 ? [(from.x - origin.x) / d, (from.z - origin.z) / d] : [1, 0];
}

function emit(w, name, data) {
  w.events.push({ type: 'event', tick: w.tick + 1, name, data });
}

export const timeLeft = (w) => Math.max(0, w.timeStart - w.simTick / TICK_RATE);

// ---------------------------------------------------------------- movement helpers

function playerCanBe(w, x, z, y) {
  if (w.map.solid(x, z, y)) return false;
  return !(w.map.ground(x, z) > y + W.step_height); // higher ground = cliff wall
}

function shadeCanBe(w, x, z, y) {
  return Number.isFinite(w.map.ground(x, z)) && !w.map.solid(x, z, y);
}

/** Move o by (dx, dz); if blocked, slide along one axis. Returns true if it moved. */
function slide(o, dx, dz, ok) {
  if (dx === 0 && dz === 0) return false;
  if (ok(o.x + dx, o.z + dz)) {
    o.x += dx;
    o.z += dz;
  } else if (dx !== 0 && ok(o.x + dx, o.z)) o.x += dx;
  else if (dz !== 0 && ok(o.x, o.z + dz)) o.z += dz;
  else return false;
  o.x = q(o.x);
  o.z = q(o.z);
  return true;
}

/** Ticket-03: a lit lantern keeps its safe zone only while fuel >= 30 (exactly 30 still counts). */
export const hasZone = (l) => l.lit && l.fuel >= LOW_FUEL_U;
export const lightCost = (l) => (l.everLit ? T.relight_cost : T.lantern_cost);
export const capacity = (p) => Math.min(T.capacity_max, T.carry_capacity + W.capacity_per_light * p.lights);
export const winNeed = (w) => Math.ceil(T.win_ratio * w.lanterns.length - 1e-9);

function clampSafe(w, s) {
  for (const l of w.lanterns) {
    if (!hasZone(l)) continue;
    const d = dXZ(s, l);
    if (d < T.safe_radius) {
      const [nx, nz] = awayDir(s, l);
      s.x = q(l.x + nx * (T.safe_radius + W.safe_margin));
      s.z = q(l.z + nz * (T.safe_radius + W.safe_margin));
    }
  }
}

function followGround(w, s, hover) {
  const g = w.map.ground(s.x, s.z);
  if (Number.isFinite(g)) s.y = q(g + hover);
}

// ---------------------------------------------------------------- step

/**
 * Advance one tick. input = {move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause}.
 * Events go to w.events (caller drains them). Order follows Ticket-02 "Thứ tự xử lý".
 */
export function step(w, input) {
  if (w.state !== 'playing') return;
  const p = w.player;

  // 1. read input (edges false -> true); pause first
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!input[b] && !w.prev[b];
    w.prev[b] = !!input[b];
  }
  if (pressed.pause) {
    w.paused = !w.paused;
    emit(w, w.paused ? 'paused' : 'resumed', {});
  }
  if (w.paused) {
    w.tick++; // tick advances, sim_tick / time / timers / spawns stay frozen
    return;
  }
  const nst = w.simTick + 1;

  // 2. timers
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.invuln > 0) p.invuln--;
  if (p.charm > 0) p.charm--;
  let respawned = false;
  if (p.dead > 0 && --p.dead === 0) {
    respawn(w);
    respawned = true;
  }
  for (const s of w.shades) {
    if ((s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') && --s.t <= 0) {
      s.t = 0;
      s.push = 0;
      s.state = s.state !== 'stunned' && !p.dead && inR(dXZ(s, p), W.shade_detect) ? 'chase' : 'wander'; // T3: stun ends in wander
    }
  }
  // Ticket-03: fuel burns (1/s) and is drained by shades in 'drain' (5/s each); <= 0 -> lantern goes out
  for (const l of w.lanterns) if (l.lit) l.fuel -= DECAY_U;
  for (const s of w.shades) {
    if (s.state !== 'drain' || !s.target || !s.target.lit) continue;
    s.target.fuel -= DRAIN_U;
    if (++s.drainTicks % W.fuel_drain_event_ticks === 0) emit(w, 'fuel_drain', { lantern_id: s.target.id, shade_id: s.id, fuel: fuel1(s.target.fuel) });
  }
  for (const l of [...w.lanterns].sort(byId)) {
    if (!l.lit || l.fuel > 0) continue;
    l.lit = false;
    l.fuel = 0;
    l.deposited = 0;
    emit(w, 'lantern_out', { lantern_id: l.id });
  }
  for (const d of w.drifters) if (d.state === 'flee' && --d.t <= 0) {
    d.t = 0;
    d.state = 'removed';
  }
  w.motes = w.motes.filter((m) => m.kind !== 'dropped' || --m.ttl > 0);
  for (const c of w.charms) if (!c.available && --c.respawn <= 0) {
    c.respawn = 0;
    c.available = true;
  }
  if (w.windEnabled) {
    const ph = nst % W.wind_every_ticks;
    if (ph === W.wind_every_ticks - W.wind_warn_ticks) w.wind.dir_deg = Math.floor(w.rng() * 360);
    w.wind.warn = ph >= W.wind_every_ticks - W.wind_warn_ticks;
    w.wind.active = nst >= W.wind_every_ticks && ph < W.wind_ticks;
  }

  // 3. move Mây (jump, dash, launch pad, wind), then fall check
  if (!p.dead && !respawned) movePlayer(w, input, pressed);
  else p.vx = p.vy = p.vz = 0;

  // 4. pick up motes and charms
  if (!p.dead) {
    for (let i = 0; i < w.motes.length && p.carried < capacity(p); ) {
      const m = w.motes[i];
      if (inR(dXZ(p, m), T.pickup_radius) && Math.abs(p.y - m.y) <= W.pickup_height + EPS) {
        w.motes.splice(i, 1);
        p.carried++;
        emit(w, 'mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of w.charms) {
      if (c.available && inR(dXZ(p, c), T.pickup_radius) && Math.abs(p.y - c.y) <= W.pickup_height + EPS) {
        c.available = false;
        c.respawn = W.charm_respawn_ticks;
        p.charm = W.charm_ticks;
        emit(w, 'charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. interact with the nearest lantern that can take motes (unlit, or lit and not full; tie -> lower id)
  if (pressed.interact && !p.dead && p.carried > 0) {
    const refuelUse = (l) => Math.min(p.carried, Math.ceil((FUEL_MAX_U - l.fuel) / MOTE_FUEL_U));
    let best = null;
    let bestD = Infinity;
    for (const l of [...w.lanterns].sort(byId)) {
      if (l.lit && refuelUse(l) <= 0) continue; // full lantern: not selectable
      const d = dXZ(p, l);
      if (inR(d, T.interact_radius) && d < bestD - EPS) {
        best = l;
        bestD = d;
      }
    }
    if (best && best.lit) {
      // refuel: used = min(carried, ceil((100 - fuel) / 10)), fuel = min(100, fuel + 10 x used)
      const used = refuelUse(best);
      p.carried -= used;
      best.fuel = Math.min(FUEL_MAX_U, best.fuel + used * MOTE_FUEL_U);
      w.score += used * T.score.per_mote;
      emit(w, 'refuel', { lantern_id: best.id, amount: used, fuel: fuel1(best.fuel) });
      if (best.fuel >= LOW_FUEL_U) best.justLit = true; // zone (back) on: push shades inside out
    } else if (best) {
      const cost = lightCost(best);
      const amount = Math.min(p.carried, cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      w.score += amount * T.score.per_mote;
      emit(w, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true;
        best.everLit = true;
        best.fuel = FUEL_MAX_U;
        best.justLit = true;
        if (relight) best.relit++;
        p.lights++;
        w.score += relight ? W.score_relight : T.score.per_lantern;
        emit(w, 'lantern_lit', { lantern_id: best.id, relight });
      }
    }
  }

  // 6. safe zones: shades inside a just-lit lantern are pushed to the edge over <= 30 ticks
  for (const l of w.lanterns) {
    if (!l.justLit) continue;
    l.justLit = false;
    for (const s of w.shades) {
      if (s.evict || dXZ(s, l) >= T.safe_radius) continue;
      if (s.state === 'drain') s.state = 'wander';
      const [nx, nz] = awayDir(s, l);
      const tx = q(l.x + nx * (T.safe_radius + W.safe_margin));
      const tz = q(l.z + nz * (T.safe_radius + W.safe_margin));
      s.evict = { left: W.evict_ticks, tx, tz, dx: (tx - s.x) / W.evict_ticks, dz: (tz - s.z) / W.evict_ticks };
    }
  }
  for (const s of w.shades) {
    if (!s.evict) continue;
    const e = s.evict;
    if (--e.left <= 0) {
      s.x = e.tx;
      s.z = e.tz;
      s.evict = null;
    } else {
      s.x = q(s.x + e.dx);
      s.z = q(s.z + e.dz);
    }
    followGround(w, s, s.hover);
  }

  // 7. pulse (Tỏa Sáng): targets fixed at this tick, 3D distance from feet + 0.8 m
  if (pressed.pulse && !p.dead && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = PULSE_CD;
    const c = { x: p.x, y: p.y + W.pulse_center_h, z: p.z };
    const in3d = (o) => inR(Math.hypot(o.x - c.x, o.y - c.y, o.z - c.z), T.pulse_radius);
    const stunned = [];
    const drops = [];
    for (const s of w.shades) {
      if (!in3d(s)) continue;
      const wasDraining = s.state === 'drain';
      s.state = 'stunned';
      s.t = STUN;
      s.push = W.pulse_push_ticks;
      [s.pdx, s.pdz] = awayDir(s, p);
      stunned.push(s.id);
      w.score += wasDraining ? W.score_stun_drain : T.score.per_stun;
    }
    for (const d of w.drifters) {
      if (!in3d(d)) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.t = W.drifter_flee_ticks;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const g = w.map.ground(d.x, d.z);
        for (let i = 0; i < amount; i++) addMote(w, d.x, Number.isFinite(g) ? g : 0, d.z, 'dropped', W.drop_ttl_ticks);
        d.stolen = 0;
        d.t = W.drifter_drop_ticks;
        drops.push({ drifter_id: d.id, amount });
      }
    }
    emit(w, 'pulse', { stunned_ids: stunned });
    for (const x of drops) emit(w, 'drifter_drop', x);
  }

  // 8. move shades and drifters
  for (const s of w.shades) moveShade(w, s);
  for (const d of w.drifters) moveDrifter(w, d);

  // 9. contact: drifters steal first, then shades hit (ascending id), max 1 flame per tick
  if (!p.dead) {
    for (const d of [...w.drifters].sort(byId)) {
      if ((d.state !== 'idle' && d.state !== 'chase') || p.carried <= 0) continue;
      if (!inR(dXZ(d, p), W.drifter_hit)) continue;
      const amount = Math.min(W.drifter_steal, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.state = 'flee';
      d.t = W.drifter_flee_ticks;
      emit(w, 'drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln === 0) {
      const hitter = [...w.shades].sort(byId).find(
        (s) => (s.state === 'chase' || s.state === 'wander') && !s.evict && inR(dXZ(s, p), T.shade_hit_radius) && Math.abs(s.y - p.y) <= W.shade_hit_height + EPS,
      );
      if (hitter) {
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        dropMotes(w, dropped);
        p.invuln = INVULN;
        hitter.state = 'recoil';
        hitter.t = W.recoil_ticks;
        [hitter.rdx, hitter.rdz] = awayDir(hitter, p);
        emit(w, 'player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }
  }

  // 10. scheduled spawns (new entities interact from the next tick on)
  if (w.randomMotes && nst % W.mote_every_ticks === 0 && w.motes.length < W.mote_cap) {
    const free = w.map.motePoints.filter((pt) => !w.motes.some((m) => Math.abs(m.x - pt[0]) < 0.01 && Math.abs(m.z - pt[2]) < 0.01));
    if (free.length) {
      const pt = free[Math.floor(w.rng() * free.length)];
      addMote(w, pt[0], w.map.ground(pt[0], pt[2]), pt[2], 'random', null);
    }
  }
  if (w.randomShades) {
    const due = nst === W.shade_first_tick ? W.shade_first_count : nst > W.shade_first_tick && (nst - W.shade_first_tick) % w.map.shade_every_ticks === 0 ? 1 : 0;
    for (let i = 0; i < due && w.shades.length < w.map.shade_max; i++) {
      const s = spawnShade(w);
      if (s) emit(w, 'shade_spawned', { id: s.id });
    }
  }
  if (w.randomDrifters && nst % W.drifter_every_ticks === 0 && w.drifters.filter((d) => d.state !== 'removed').length < W.drifter_max) {
    const pts = w.map.shadePoints; // A2-09: "điểm sương" = the night's shade spawn points
    const pt = pts[Math.floor(w.rng() * pts.length)];
    w.drifters.push(newDrifter(w, nextId(w, 'D', 'nextDrifterId', new Set(w.drifters.map((d) => d.id))), pt[0], pt[2]));
  }
  // 11. win / lose (no_flames always loses; all lit wins, even on the dawn tick)
  w.simTick = nst;
  w.tick++;
  // Ticket-03: no early win; at dawn Mây must be alive with >= ceil(0.6 x lanterns) lit
  if (p.flames <= 0) end(w, 'lost', 'no_flames');
  else if (w.timeStart * TICK_RATE - w.simTick <= 1e-6) {
    const lit = w.lanterns.filter((l) => l.lit);
    if (lit.length >= winNeed(w)) {
      for (const l of lit) w.score += W.score_lit_at_dawn + Math.floor(l.fuel / FUEL_UNIT);
      w.score += p.flames * T.score.per_flame_left;
      end(w, 'won', 'dawn_survived');
    } else end(w, 'lost', 'dawn');
  }
}

function movePlayer(w, input, pressed) {
  const p = w.player;
  const map = w.map;
  const ox = p.x, oy = p.y, oz = p.z;

  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = rad(input.cam_yaw_deg || 0);
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const mlen = Math.hypot(wx, wz);
  if (mlen > 1e-9) {
    p.fx = wx / mlen;
    p.fz = wz / mlen;
  }

  if (pressed.jump && p.grounded && !p.dash) {
    p.vy = W.jump_velocity;
    p.grounded = false;
  }
  if (pressed.dash && p.dash === 0 && (p.dashCd === 0 || p.charm > 0)) {
    p.dash = DASH_TICKS;
    p.dashX = mlen > 1e-9 ? wx / mlen : p.fx;
    p.dashZ = mlen > 1e-9 ? wz / mlen : p.fz;
    p.dashCd = p.charm > 0 ? 0 : DASH_CD;
    emit(w, 'dash', {});
  }

  let hx, hz;
  const dashing = p.dash > 0;
  if (dashing) {
    hx = p.dashX * T.dash_speed;
    hz = p.dashZ * T.dash_speed;
    p.dash--;
  } else if (p.launch) {
    hx = p.launch.vx;
    hz = p.launch.vz;
  } else {
    const sp = p.charm > 0 ? W.charm_speed : T.player_speed;
    hx = wx * sp;
    hz = wz * sp;
  }
  if (w.wind.active) {
    hx += Math.cos(rad(w.wind.dir_deg)) * W.wind_speed;
    hz += Math.sin(rad(w.wind.dir_deg)) * W.wind_speed;
  }
  slide(p, hx * DT, hz * DT, (x, z) => playerCanBe(w, x, z, p.y));

  const g = map.ground(p.x, p.z);
  if (p.grounded) {
    if (g >= p.y - W.step_height - EPS) p.y = g; // walk up/down ramps
    else {
      p.grounded = false; // walked off a ledge
      p.vy = 0;
    }
  }
  if (!p.grounded && !dashing) {
    p.vy -= W.gravity * DT;
    p.y = q(p.y + p.vy * DT);
    if (p.y <= g) {
      p.y = g;
      p.vy = 0;
      p.grounded = true;
      p.launch = null;
    }
  }

  // launch pads: feet touch the pad -> fixed launch velocity until landing
  if (p.grounded && !p.launch) {
    for (const pd of map.pads) {
      if (inR(Math.hypot(p.x - pd.x, p.z - pd.z), W.pad_radius) && Math.abs(p.y - pd.y) < 0.01) {
        p.launch = { vx: pd.vx, vz: pd.vz };
        p.vy = pd.vy;
        p.grounded = false;
        break;
      }
    }
  }

  p.vx = q((p.x - ox) / DT);
  p.vz = q((p.z - oz) / DT);
  p.fallV = q((p.y - oy) / DT);

  if (p.y < W.fall_y) {
    // falling off the island: ignores invulnerability, loses a flame and every mote carried
    const lost = p.carried;
    p.carried = 0;
    p.flames = Math.max(0, p.flames - 1);
    emit(w, 'player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    p.dash = 0;
    p.launch = null;
    p.vy = 0;
    if (p.flames > 0) p.dead = W.respawn_wait_ticks;
    else p.dead = -1; // game over this tick, no respawn
  }
}

function respawn(w) {
  const p = w.player;
  [p.x, p.y, p.z] = w.map.start;
  p.vx = p.vy = p.vz = p.fallV = 0;
  p.grounded = true;
  p.dash = 0;
  p.launch = null;
  p.fx = 0;
  p.fz = 1;
  p.invuln = W.respawn_invuln_ticks;
}

function dropMotes(w, n) {
  const p = w.player;
  for (let i = 0; i < n; i++) {
    const a0 = w.rng() * 2 * Math.PI;
    const r = W.drop_ring_min + w.rng() * (W.drop_ring_max - W.drop_ring_min);
    let spot = null;
    let anyLand = null;
    for (let k = 0; k < 8 && !spot; k++) {
      const a = a0 + (k * Math.PI) / 4;
      const x = q(p.x + r * Math.cos(a));
      const z = q(p.z + r * Math.sin(a));
      const g = w.map.ground(x, z);
      if (!Number.isFinite(g) || w.map.solid(x, z, g)) continue;
      if (Math.abs(g - p.y) <= W.pickup_height) spot = [x, g, z];
      else anyLand ||= [x, g, z];
    }
    spot ||= anyLand || [p.x, Number.isFinite(w.map.ground(p.x, p.z)) ? w.map.ground(p.x, p.z) : p.y, p.z];
    addMote(w, spot[0], spot[1], spot[2], 'dropped', W.drop_ttl_ticks);
  }
}

function moveShade(w, s) {
  if (s.evict) return;
  const p = w.player;
  const alive = !p.dead;
  const d = dXZ(s, p);
  if (s.state === 'drain') {
    // Ticket-03 drain exits: Mây within 6 m -> chase; lantern out / refuelled to >= 30 / > 2 m away -> wander
    const l = s.target;
    if (alive && inR(d, W.drain_break)) s.state = 'chase';
    else if (!l || !l.lit || l.fuel >= LOW_FUEL_U || dXZ(s, l) > W.drain_reach + EPS) s.state = 'wander';
  }
  if (s.state === 'wander' && alive && inR(d, W.shade_detect)) s.state = 'chase';
  else if (s.state === 'chase' && (!alive || d > W.shade_giveup + EPS)) s.state = 'wander';
  const ok = (x, z) => shadeCanBe(w, x, z, s.y);
  if (s.state === 'stunned') {
    if (s.push > 0) {
      const k = T.pulse_push_m / W.pulse_push_ticks;
      if (ok(s.x + s.pdx * k, s.z + s.pdz * k)) {
        s.x = q(s.x + s.pdx * k);
        s.z = q(s.z + s.pdz * k);
        s.push--;
      } else s.push = 0; // stop at obstacles
    }
  } else if (s.state === 'recoil') {
    const k = W.recoil_m / W.recoil_ticks;
    if (ok(s.x + s.rdx * k, s.z + s.rdz * k)) {
      s.x = q(s.x + s.rdx * k);
      s.z = q(s.z + s.rdz * k);
    }
  } else if (s.state === 'chase') {
    const stepLen = w.map.shade_speed * DT;
    if (d > 1e-9) {
      const k = Math.min(stepLen, d) / d;
      slide(s, (p.x - s.x) * k, (p.z - s.z) * k, ok);
    }
  } else if (s.state === 'wander') {
    // Ticket-03: head for the nearest weak lantern (lit, fuel < 30), else the nearest unlit lantern (A3-04)
    const weak = nearestLantern(w, s, (l) => l.lit && l.fuel < LOW_FUEL_U);
    const tgt = weak || nearestLantern(w, s, (l) => !l.lit);
    s.target = tgt;
    if (tgt) {
      const dl = dXZ(s, tgt);
      const stopAt = weak ? 0 : 1; // park 1 m from an unlit lantern
      if (dl > stopAt + EPS) {
        const k = Math.min(W.shade_wander_speed * DT, dl - stopAt) / dl;
        if (!slide(s, (tgt.x - s.x) * k, (tgt.z - s.z) * k, ok)) wanderStep(w, s, W.shade_wander_speed, ok);
      }
      if (weak && inR(dXZ(s, weak), W.drain_reach)) {
        s.state = 'drain';
        s.drainTicks = 0;
      }
    } else wanderStep(w, s, W.shade_wander_speed, ok);
  }
  clampSafe(w, s);
  followGround(w, s, s.hover);
}

function nearestLantern(w, s, pred) {
  let best = null;
  let bd = Infinity;
  for (const l of [...w.lanterns].sort(byId)) {
    if (!pred(l)) continue;
    const d = dXZ(s, l);
    if (d < bd - EPS) [best, bd] = [l, d];
  }
  return best;
}

function wanderStep(w, o, speed, ok) {
  const pts = w.map.motePoints;
  if (!o.wp || Math.hypot(o.wp[0] - o.x, o.wp[2] - o.z) < 0.5) o.wp = pts[Math.floor(w.rng() * pts.length)];
  const dx = o.wp[0] - o.x, dz = o.wp[2] - o.z;
  const d = Math.hypot(dx, dz);
  const k = Math.min(speed * DT, d) / d;
  if (!slide(o, dx * k, dz * k, ok)) o.wp = null; // blocked: pick another waypoint next tick
}

function moveDrifter(w, d) {
  const p = w.player;
  if (d.state === 'removed') return;
  const dist = dXZ(d, p);
  const want = !p.dead && p.carried >= W.drifter_chase_carry && inR(dist, W.drifter_detect);
  if (d.state === 'idle' && want) d.state = 'chase';
  else if (d.state === 'chase' && !want) d.state = 'idle';
  const free = () => true; // drifters fly; safe zones do not stop them
  if (d.state === 'idle') wanderStep(w, d, W.drifter_idle_speed, free);
  else if (d.state === 'chase' && dist > 1e-9) {
    const k = Math.min(W.drifter_speed * DT, dist) / dist;
    slide(d, (p.x - d.x) * k, (p.z - d.z) * k, free);
  } else if (d.state === 'flee') {
    const [nx, nz] = awayDir(d, p);
    slide(d, nx * W.drifter_speed * DT, nz * W.drifter_speed * DT, free);
  }
  const g = w.map.ground(d.x, d.z);
  d.y = q((Number.isFinite(g) ? Math.max(0, g) : 0) + W.drifter_hover);
}

function spawnShade(w) {
  const p = w.player;
  const occupied = (pt) => w.shades.some((s) => Math.hypot(s.x - pt[0], s.z - pt[2]) < 1);
  const lit = (pt) => w.lanterns.some((l) => hasZone(l) && Math.hypot(l.x - pt[0], l.z - pt[2]) < T.safe_radius);
  const valid = w.map.shadePoints.filter((pt) => Math.hypot(pt[0] - p.x, pt[2] - p.z) >= W.shade_spawn_min_dist - EPS && !occupied(pt) && !lit(pt));
  if (!valid.length) return null; // no valid point: skip this turn
  const pt = valid[Math.floor(w.rng() * valid.length)];
  const g = w.map.ground(pt[0], pt[2]);
  const s = newShade(w, nextId(w, 'S', 'nextShadeId', new Set(w.shades.map((x) => x.id))), pt[0], g + W.shade_hover, pt[2], 'spawning');
  s.t = W.shade_spawning_ticks;
  w.shades.push(s);
  return s;
}

function end(w, result, reason) {
  w.state = result;
  w.events.push({ type: 'event', tick: w.tick, name: 'game_over', data: { result, reason } });
}

// ---------------------------------------------------------------- output

const fuel1 = (u) => Math.round((u / FUEL_UNIT) * 10) / 10; // fuel out: 1 decimal
const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r; // no "-0"
};
const p3 = (x, y, z) => [r3(x), r3(y), r3(z)];

export function snapshot(w) {
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    state: w.state === 'playing' && w.paused ? 'paused' : w.state,
    night: w.night,
    time_left_s: r3(timeLeft(w)),
    score: w.score,
    wind: { active: w.wind.active, dir_deg: w.wind.dir_deg },
    player: {
      pos: p3(p.x, p.y, p.z),
      vel: p3(p.vx, p.fallV, p.vz),
      grounded: p.grounded,
      invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / TICK_RATE),
      pulse_cd_s: r3(p.pulseCd / TICK_RATE),
      charm_s: r3(p.charm / TICK_RATE),
      flames: p.flames,
      carried: p.carried,
      capacity: capacity(p),
    },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: p3(l.x, l.y, l.z), lit: l.lit, deposited: l.deposited, fuel: l.lit ? fuel1(l.fuel) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: w.shades.map((s) => ({ id: s.id, pos: p3(s.x, s.y, s.z), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: p3(m.x, m.y, m.z), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / TICK_RATE) : null })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: p3(d.x, d.y, d.z), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, pos: p3(c.x, c.y, c.z), available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
  };
}
