// Ticket-04 standard benchmark scene: Night 1, exactly 200 wandering shades and 100 motes spread
// uniformly over the island (seeded), L1-L3 lit with fuel 100, Mây idle at (0,0,0).
// Spawning, damage, pickup, fuel burn and end of night are off (createWorld opts.bench).
import { createWorld } from './world.js';
import { createRng } from './rng.js';

export const BENCH = { shades: 200, motes: 100, lit: ['L1', 'L2', 'L3'], radius: 39, camRadius: 30, camHeight: 15, camPeriodS: 15, warmupS: 3 };

export function benchScenario(seed) {
  const rng = createRng(seed);
  // uniform on the disc: r = R sqrt(u)
  const spot = () => {
    const r = BENCH.radius * Math.sqrt(rng());
    const a = 2 * Math.PI * rng();
    return [Math.round(r * Math.cos(a) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000];
  };
  const shades = Array.from({ length: BENCH.shades }, (_, i) => {
    const [x, z] = spot();
    return { id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' };
  });
  const motes = Array.from({ length: BENCH.motes }, () => {
    const [x, z] = spot();
    return { pos: [x, 0, z] };
  });
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes,
    shades,
    drifters: [],
    charms: [],
    lanterns: BENCH.lit.map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

export const createBenchWorld = (seed) => createWorld(seed, benchScenario(seed), 1, { bench: true });

/** Camera on the benchmark orbit at time t (s): radius 30, Y 15, CCW from above, 15 s per lap, starts at (30, 15, 0). */
export function benchCamera(t) {
  const a = (2 * Math.PI * t) / BENCH.camPeriodS;
  return [BENCH.camRadius * Math.cos(a), BENCH.camHeight, BENCH.camRadius * Math.sin(a)];
}

/** Ticket-04 metrics from per-frame times dt (ms). */
export function benchStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    frames: n,
    avg_fps: r1((1000 * n) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(p95),
  };
}
