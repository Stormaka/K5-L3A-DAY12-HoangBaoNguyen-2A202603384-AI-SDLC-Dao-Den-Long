// Pure, deterministic game logic. No DOM, no wall-clock time, no Math.random.
// Shared by the headless runner (Node) and the 3D client (browser).
import { TUNING as T, WORLD as W, DT, TICK_RATE } from './config.js';
import { createRng } from './rng.js';
import { FormatError } from './validate.js';

const secToTicks = (s) => Math.round(s * TICK_RATE);
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// "Within radius r" means d <= r; EPS absorbs float noise at exact boundaries.
const EPS = 1e-9;
const inR = (d, r) => d <= r + EPS;
// Snap positions to a 1e-9 grid so repeated += 0.1 does not drift (3.5 stays 3.5).
const q = (v) => Math.round(v * 1e9) / 1e9;
const snapPos = (o) => {
  o.x = q(o.x);
  o.z = q(o.z);
};

export function defaultLanterns() {
  const out = [];
  for (let k = 0; k < T.lantern_count_night1; k++) {
    const a = (2 * Math.PI * k) / T.lantern_count_night1;
    out.push({
      id: `L${k + 1}`,
      x: W.lantern_ring_radius * Math.sin(a),
      z: W.lantern_ring_radius * Math.cos(a),
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

/** Build the initial world. Building never emits events nor awards score. */
export function createWorld(seed, scenario = {}) {
  const rng = createRng(seed);
  const sp = scenario.player || {};
  const pos = sp.pos || [0, 0, 0];
  const w = {
    rng,
    tick: 0,
    state: 'playing',
    result: null,
    score: 0,
    timeStart: scenario.time_left_s ?? T.night1_duration_s,
    player: {
      x: pos[0],
      y: Math.max(0, pos[1]),
      z: pos[2],
      vy: 0,
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: 0,
      pulseCd: 0,
    },
    prev: { jump: false, interact: false, pulse: false, dash: false },
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    motes: [],
    nextMoteId: 1,
    moteTimer: secToTicks(W.mote_respawn_s),
    shades: [],
    nextShadeId: 1,
    shadeTimer: secToTicks(W.shade_spawn_every_s),
    lanterns: defaultLanterns(),
    events: [],
  };

  // Lanterns: update by id.
  for (const l of scenario.lanterns || []) {
    const lan = w.lanterns.find((x) => x.id === l.id);
    if (!lan) throw new FormatError(`scenario.lanterns: unknown lantern id "${l.id}"`);
    if (l.pos) {
      lan.x = l.pos[0];
      lan.z = l.pos[2];
    }
    if (l.deposited !== undefined) lan.deposited = Math.min(l.deposited, T.lantern_cost);
    if (l.lit !== undefined) lan.lit = l.lit;
    if (lan.lit) lan.deposited = T.lantern_cost;
    else if (lan.deposited >= T.lantern_cost) lan.lit = true;
  }

  // Motes.
  if (scenario.motes) for (const m of scenario.motes) addMote(w, m[0], m[2]);
  else if (w.randomMotes) for (let i = 0; i < W.initial_motes; i++) spawnRandomMote(w);

  // Shades.
  if (scenario.shades) {
    const used = new Set(scenario.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of scenario.shades) {
      const id = s.id || nextShadeId(w, used);
      used.add(id);
      w.shades.push({ id, x: s.pos[0], y: s.pos[1], z: s.pos[2], state: 'chase', stun: 0 });
    }
  } else if (w.randomShades) {
    for (let i = 0; i < W.initial_shades; i++) spawnRandomShade(w);
  }
  return w;
}

function addMote(w, x, z) {
  w.motes.push({ id: `M${w.nextMoteId++}`, x, z });
}

function spawnRandomMote(w) {
  const r = (W.island_radius - 2) * Math.sqrt(w.rng());
  const a = 2 * Math.PI * w.rng();
  addMote(w, r * Math.sin(a), r * Math.cos(a));
}

function nextShadeId(w, used) {
  let id;
  do id = `S${w.nextShadeId++}`;
  while (used && used.has(id));
  return id;
}

function spawnRandomShade(w) {
  const used = new Set(w.shades.map((s) => s.id));
  const a = 2 * Math.PI * w.rng();
  const s = {
    id: nextShadeId(w, used),
    x: W.shade_spawn_radius * Math.sin(a),
    y: W.shade_height,
    z: W.shade_spawn_radius * Math.cos(a),
    state: 'chase',
    stun: 0,
  };
  keepShadeOutOfLight(w, s);
  w.shades.push(s);
  return s;
}

function clampToIsland(o) {
  const r = Math.hypot(o.x, o.z);
  if (r > W.island_radius) {
    o.x *= W.island_radius / r;
    o.z *= W.island_radius / r;
  }
}

// Shades cannot be inside safe_radius of a LIT lantern (assumption A6).
// Margin keeps the rule true even after 3-decimal rounding of output coordinates.
const SAFE_MARGIN = 0.002;
function keepShadeOutOfLight(w, s) {
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    const d = dist2d(s.x, s.z, l.x, l.z);
    if (d < T.safe_radius) {
      const nx = d > 1e-9 ? (s.x - l.x) / d : 1;
      const nz = d > 1e-9 ? (s.z - l.z) / d : 0;
      s.x = l.x + nx * (T.safe_radius + SAFE_MARGIN);
      s.z = l.z + nz * (T.safe_radius + SAFE_MARGIN);
    }
  }
}

function emit(w, name, data) {
  w.events.push({ type: 'event', tick: w.tick + 1, name, data });
}

export const timeLeft = (w) => Math.max(0, w.timeStart - w.tick / TICK_RATE);

/**
 * Advance one tick. `input` = {move:[x,z], cam_yaw_deg, jump, interact, pulse, dash}.
 * Events produced are appended to w.events (caller drains them).
 */
export function step(w, input) {
  if (w.state !== 'playing') return;
  const p = w.player;

  // 0. timers
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invuln > 0) p.invuln--;
  for (const s of w.shades) {
    if (s.state === 'stunned' && --s.stun <= 0) {
      s.stun = 0;
      s.state = 'chase';
    }
  }

  // 1. button edges (false -> true)
  const pressed = {};
  for (const b of ['jump', 'interact', 'pulse', 'dash']) {
    pressed[b] = !!input[b] && !w.prev[b];
    w.prev[b] = !!input[b];
  }

  // 2. movement (camera-relative), island edge is a wall (fall_enabled = false)
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.x += wx * T.player_speed * DT;
  p.z += wz * T.player_speed * DT;
  clampToIsland(p);
  snapPos(p);
  if (pressed.jump && p.y === 0 && p.vy === 0) p.vy = W.jump_velocity;
  if (p.y > 0 || p.vy !== 0) {
    p.vy -= W.gravity * DT;
    p.y += p.vy * DT;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
    }
  }

  // 3. auto pickup
  for (let i = 0; i < w.motes.length && p.carried < T.carry_capacity; ) {
    const m = w.motes[i];
    if (inR(dist2d(p.x, p.z, m.x, m.z), T.pickup_radius)) {
      w.motes.splice(i, 1);
      p.carried++;
      w.score += T.score.per_mote;
      emit(w, 'mote_picked', { carried: p.carried });
    } else i++;
  }

  // 4. interact: deposit into nearest unlit lantern in range
  if (pressed.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit) continue;
      const d = dist2d(p.x, p.z, l.x, l.z);
      if (inR(d, T.interact_radius) && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      emit(w, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        w.score += T.score.per_lantern;
        emit(w, 'lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // 5. pulse: costs carried light, stuns + pushes shades in radius
  if (pressed.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const stunned = [];
    for (const s of w.shades) {
      const d = dist2d(p.x, p.z, s.x, s.z);
      if (inR(d, T.pulse_radius)) {
        const nx = d > 1e-9 ? (s.x - p.x) / d : 1;
        const nz = d > 1e-9 ? (s.z - p.z) / d : 0;
        s.x += nx * T.pulse_push_m;
        s.z += nz * T.pulse_push_m;
        clampToIsland(s);
        keepShadeOutOfLight(w, s);
        snapPos(s);
        s.state = 'stunned';
        s.stun = secToTicks(T.pulse_stun_s);
        stunned.push(s.id);
        w.score += T.score.per_stun;
      }
    }
    emit(w, 'pulse', { stunned_ids: stunned });
  }

  // 6. shades: chase (stunned ones are frozen), respect lantern light
  const stepLen = T.shade_speed * DT;
  for (const s of w.shades) {
    if (s.state === 'stunned') continue;
    const d = dist2d(s.x, s.z, p.x, p.z);
    if (d > 1e-9) {
      const k = Math.min(stepLen, d) / d;
      s.x += (p.x - s.x) * k;
      s.z += (p.z - s.z) * k;
    }
    clampToIsland(s);
    keepShadeOutOfLight(w, s);
    snapPos(s);
  }

  // 7. shade contact -> lose a flame (at most one hit per tick, then invulnerable)
  if (p.invuln === 0) {
    const hitter = w.shades.find(
      (s) => s.state !== 'stunned' && inR(dist2d(s.x, s.z, p.x, p.z), T.shade_hit_radius),
    );
    if (hitter) {
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invuln = secToTicks(T.invuln_s);
      emit(w, 'player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  // 8. spawning (only when random generation is enabled)
  if (w.randomShades) {
    if (--w.shadeTimer <= 0) {
      w.shadeTimer = secToTicks(W.shade_spawn_every_s);
      if (w.shades.length < W.max_shades) emit(w, 'shade_spawned', { id: spawnRandomShade(w).id });
    }
  }
  if (w.randomMotes) {
    if (--w.moteTimer <= 0) {
      w.moteTimer = secToTicks(W.mote_respawn_s);
      if (w.motes.length < W.initial_motes) spawnRandomMote(w);
    }
  }

  // 9. advance clock, check end conditions
  const t = w.tick; // events above already used t+1
  w.tick = t + 1;
  const remainingTicks = w.timeStart * TICK_RATE - w.tick;
  if (w.lanterns.every((l) => l.lit)) {
    w.score += Math.floor(timeLeft(w)) * T.score.per_second_left + p.flames * T.score.per_flame_left;
    end(w, 'won', 'all_lit');
  } else if (p.flames <= 0) end(w, 'lost', 'no_flames');
  else if (remainingTicks <= 1e-9) end(w, 'lost', 'dawn');
}

function end(w, result, reason) {
  w.state = result;
  w.events.push({ type: 'event', tick: w.tick, name: 'game_over', data: { result, reason } });
}

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
    sim_tick: w.tick,
    state: w.state,
    time_left_s: r3(timeLeft(w)),
    score: w.score,
    player: { pos: p3(p.x, p.y, p.z), flames: p.flames, carried: p.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: p3(l.x, 0, l.z), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: p3(s.x, s.y, s.z), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: p3(m.x, 0, m.z) })),
  };
}
