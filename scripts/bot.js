// Autopilot that PLAYS the real sim (any night) and records its stick/button presses as a
// Test-Contract inputs file. Proves each standard night is winnable end-to-end.
// Navigation: Dijkstra on a 1 m grid of the night's ground (cliffs, ramps, bridge, launch pads).
// Usage: node scripts/bot.js <night> <seed> <out-inputs.json>
import { writeFileSync } from 'node:fs';
import { createWorld, step } from '../src/sim/world.js';
import { TUNING as T, WORLD as W } from '../src/sim/config.js';

const night = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 1);
const out = process.argv[4];
const w = createWorld(seed, {}, night);
const map = w.map;

// ---------------------------------------------------------------- nav grid
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let x = -100; x <= 140; x++) for (let z = -60; z <= 60; z++) if (Number.isFinite(map.ground(x, z))) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
}
const NX = maxX - minX + 1, NZ = maxZ - minZ + 1;
const idx = (x, z) => (x - minX) * NZ + (z - minZ);
const cx = (i) => Math.floor(i / NZ) + minX, cz = (i) => (i % NZ) + minZ;
const H = new Float64Array(NX * NZ).fill(NaN);
for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
  const g = map.ground(x, z);
  // keep 0.6 m away from cliffs/tower so the walker does not scrape walls
  if (!Number.isFinite(g) || map.solid(x, z, g)) continue;
  let ok = true;
  for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
    const g2 = map.ground(x + dx, z + dz);
    if (!Number.isFinite(g2) || g2 > g + 0.3 || map.solid(x + dx, z + dz, g)) ok = false;
  }
  if (ok) H[idx(x, z)] = g;
}
// pad edges: simulate a launch from each pad to find where it lands
const padEdges = new Map();
for (const pd of map.pads) {
  const t = createWorld(1, { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, shades: [], motes: [], drifters: [], charms: [], player: { pos: [pd.x, pd.y, pd.z] } }, night);
  for (let k = 0; k < 400 && !(k > 5 && t.player.grounded); k++) step(t, { move: [0, 0] });
  padEdges.set(idx(Math.round(pd.x), Math.round(pd.z)), { to: idx(Math.round(t.player.x), Math.round(t.player.z)), pad: pd });
}

function dijkstra(from, danger) {
  const dist = new Float64Array(NX * NZ).fill(Infinity);
  const prev = new Int32Array(NX * NZ).fill(-1);
  const heap = [[0, from]];
  dist[from] = 0;
  while (heap.length) {
    // small binary heap
    let [d, i] = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        let m = k, l = 2 * k + 1, r = l + 1;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m], heap[k]];
        k = m;
      }
    }
    if (d > dist[i]) continue;
    const x = cx(i), z = cz(i), h = H[i];
    const push = (j, c) => {
      if (d + c < dist[j]) {
        dist[j] = d + c;
        prev[j] = i;
        heap.push([d + c, j]);
        for (let k = heap.length - 1; k > 0; ) {
          const p = (k - 1) >> 1;
          if (heap[p][0] <= heap[k][0]) break;
          [heap[p], heap[k]] = [heap[k], heap[p]];
          k = p;
        }
      }
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const j = idx(nx, nz);
      if (Number.isNaN(H[j]) || H[j] > h + 0.6) continue; // can't climb cliffs (drops are fine)
      if (dx && dz && (Number.isNaN(H[idx(nx, z)]) || Number.isNaN(H[idx(x, nz)]))) continue;
      push(j, Math.hypot(dx, dz) + (H[j] < h - 0.6 ? 2 : 0) + (danger[j] || 0));
    }
    const pe = padEdges.get(i);
    if (pe) push(pe.to, 30);
  }
  return { dist, prev };
}

function nearestCell(x, z, y) {
  let best = -1, bd = Infinity;
  for (let ax = Math.floor(x) - 2; ax <= Math.ceil(x) + 2; ax++) for (let az = Math.floor(z) - 2; az <= Math.ceil(z) + 2; az++) {
    if (ax < minX || ax > maxX || az < minZ || az > maxZ) continue;
    const j = idx(ax, az);
    if (Number.isNaN(H[j]) || Math.abs(H[j] - y) > 1.6) continue;
    const d = Math.hypot(ax - x, az - z);
    if (d < bd) [best, bd] = [j, d];
  }
  return best;
}

// ---------------------------------------------------------------- play
const frames = [];
let prev = {};
let plan = null; // { cells: [...], target }
let replanAt = 0;
let stuck = 0, lastPos = null;
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (let k = 0; k < 25000 && w.state === 'playing'; k++) {
  const p = w.player;
  const f = { move: [0, 0], interact: false, pulse: false, dash: false, jump: false };
  if (!p.dead && (p.grounded || !p.launch)) {
    if (k >= replanAt || !plan) {
      const from = nearestCell(p.x, p.z, p.y);
      if (from >= 0) {
        // danger map: cells near active shades are expensive
        const danger = new Float64Array(NX * NZ);
        for (const s of w.shades) {
          if (s.state === 'stunned' || s.state === 'recoil') continue;
          const R = 6;
          for (let ax = Math.floor(s.x - R); ax <= Math.ceil(s.x + R); ax++) for (let az = Math.floor(s.z - R); az <= Math.ceil(s.z + R); az++) {
            if (ax < minX || ax > maxX || az < minZ || az > maxZ) continue;
            const dd = Math.hypot(ax - s.x, az - s.z);
            if (dd < R) danger[idx(ax, az)] += (R - dd) * 8;
          }
        }
        const { dist, prev: pv } = dijkstra(from, danger);
        const cellOf = (o) => nearestCell(o.x, o.z, o.y);
        const lanterns = w.lanterns.filter((l) => !l.lit);
        const nearL = lanterns.map((l) => ({ o: l, c: cellOf(l) })).filter((t) => t.c >= 0).sort((a, b) => dist[a.c] - dist[b.c])[0];
        const need = nearL ? T.lantern_cost - nearL.o.deposited : 0;
        let target = nearL;
        if (p.carried < Math.min(need, T.carry_capacity) || p.carried === 0) {
          const motes = w.motes.map((m) => ({ o: m, c: cellOf(m) })).filter((t) => t.c >= 0 && Number.isFinite(dist[t.c]));
          // prefer motes near the route to the lantern
          const via = (m) => dist[m.c] + (nearL ? 0.7 * Math.hypot(m.o.x - nearL.o.x, m.o.z - nearL.o.z) : 0);
          motes.sort((a, b) => via(a) - via(b));
          if (motes.length) target = motes[0];
        }
        // Bùa Gió nearby: grab it (7.2 m/s + dash without cooldown)
        const charm = w.charms.filter((c) => c.available).map((c) => ({ o: c, c: cellOf(c) })).filter((t) => t.c >= 0 && dist[t.c] < 25).sort((a, b) => dist[a.c] - dist[b.c])[0];
        if (charm && p.charm < 120) target = charm;
        if (target && Number.isFinite(dist[target.c])) {
          const cells = [];
          for (let c = target.c; c !== -1 && c !== from; c = pv[c]) cells.push(c);
          cells.reverse();
          plan = { cells, target };
        } else plan = null;
      }
      replanAt = k + 8;
    }
    if (plan) {
      const tgt = plan.target.o;
      // next waypoint: skip cells already reached
      while (plan.cells.length > 1 && Math.hypot(cx(plan.cells[0]) - p.x, cz(plan.cells[0]) - p.z) < 0.7 && Math.abs(H[plan.cells[0]] - p.y) < 1.6) plan.cells.shift();
      let gx, gz;
      const final = plan.cells.length <= 1;
      if (final) [gx, gz] = [tgt.x, tgt.z];
      else [gx, gz] = [cx(plan.cells[0]), cz(plan.cells[0])];
      const pe = padEdges.get(plan.cells[0]);
      if (pe) [gx, gz] = [pe.pad.x, pe.pad.z];
      const dd = Math.hypot(gx - p.x, gz - p.z);
      if (dd > 0.05) f.move = [+((gx - p.x) / dd).toFixed(3), +((gz - p.z) / dd).toFixed(3)];
      const isLantern = w.lanterns.includes(tgt);
      if (isLantern && d2(p, tgt) <= T.interact_radius - 0.05) {
        f.move = [0, 0];
        f.interact = !prev.interact;
        replanAt = k + 1;
      }
      if (!isLantern && d2(p, tgt) < 0.3) replanAt = k;
      // on the way: top up any unlit lantern in reach
      if (!f.interact && p.carried > 0 && w.lanterns.some((l) => !l.lit && d2(p, l) <= T.interact_radius - 0.05)) f.interact = !prev.interact;
      // travel dash: long straight safe stretch ahead on the same level
      if (p.grounded && p.dash === 0 && (p.dashCd === 0 || p.charm > 0) && d2(p, tgt) > 4 && (f.move[0] || f.move[1])) {
        let safe = true;
        for (let t = 0.5; t <= 3.5 && safe; t += 0.5) {
          const x = p.x + f.move[0] * t, z = p.z + f.move[1] * t;
          const g = map.ground(x, z);
          if (!Number.isFinite(g) || Math.abs(g - p.y) > 0.3 || map.solid(x, z, p.y)) safe = false;
          for (const l of [-0.6, 0.6]) if (!Number.isFinite(map.ground(x - f.move[1] * l, z + f.move[0] * l))) safe = false;
        }
        if (safe && !w.shades.some((s) => s.state !== 'stunned' && Math.hypot(s.x - (p.x + f.move[0] * 2.8), s.z - (p.z + f.move[1] * 2.8)) < 3)) f.dash = !prev.dash;
      }
    }
    // threats: pulse a shade about to touch us, or a drifter chasing us
    const threat = w.shades.some((s) => (s.state === 'chase' || s.state === 'wander') && d2(p, s) < 2.2 && Math.abs(s.y - p.y) < 1.6)
      || w.drifters.some((d) => d.state === 'chase' && d2(p, d) < 3);
    const canDash = p.dash === 0 && (p.dashCd === 0 || p.charm > 0);
    const shadeThreat = w.shades.some((s) => (s.state === 'chase' || s.state === 'wander') && d2(p, s) < 1.6 && Math.abs(s.y - p.y) < 1.6);
    if (threat && !(canDash && !shadeThreat) && p.invuln === 0 && p.pulseCd === 0 && p.carried >= T.pulse_cost && (shadeThreat || !canDash)) f.pulse = !prev.pulse;
    else {
      // dash away from the closest active shade when it is about to touch us
      const close = w.shades.filter((s) => (s.state === 'chase' || s.state === 'wander') && d2(p, s) < 1.9 && Math.abs(s.y - p.y) < 1.6).sort((a, b) => d2(p, a) - d2(p, b))[0];
      if (close && p.invuln === 0 && p.dash === 0 && (p.dashCd === 0 || p.charm > 0)) {
        const dd = d2(p, close) || 1;
        let ax = (p.x - close.x) / dd, az = (p.z - close.z) / dd;
        // prefer escaping along the planned direction if it points away
        if (f.move[0] * ax + f.move[1] * az > 0) [ax, az] = f.move;
        const nx = p.x + ax * 3, nz = p.z + az * 3;
        const g = map.ground(nx, nz);
        if (Number.isFinite(g) && g <= p.y + 0.3 && !map.solid(nx, nz, p.y)) {
          f.move = [+ax.toFixed(3), +az.toFixed(3)];
          f.dash = !prev.dash;
        }
      }
    }
    // unstick
    if (lastPos && Math.hypot(lastPos[0] - p.x, lastPos[1] - p.z) < 0.01 && (f.move[0] || f.move[1])) stuck++;
    else stuck = 0;
    if (stuck > 30) {
      plan = null;
      replanAt = k;
      stuck = 0;
    }
    lastPos = [p.x, p.z];
  }
  const delta = {};
  for (const key of Object.keys(f)) if (JSON.stringify(f[key]) !== JSON.stringify(prev[key] ?? (key === 'move' ? [0, 0] : false))) delta[key] = f[key];
  if (Object.keys(delta).length) frames.push({ tick: k, ...delta });
  prev = f;
  step(w, { ...f, cam_yaw_deg: 0 });
  w.events.length = 0;
}
if (out) writeFileSync(out, JSON.stringify({ frames }));
const lit = w.lanterns.filter((l) => l.lit).length;
console.log(`night ${night} seed ${seed}: ${w.state} at tick ${w.tick}, lanterns ${lit}/${w.lanterns.length}, score ${w.score}, flames ${w.player.flames}, frames ${frames.length}`);
process.exitCode = w.state === 'won' ? 0 : 1;
void W;
