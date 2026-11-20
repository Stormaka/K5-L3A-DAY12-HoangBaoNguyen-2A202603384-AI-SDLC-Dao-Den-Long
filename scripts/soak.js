#!/usr/bin/env node
// Soak test (Ticket-04 §2): N nights back to back in ONE process (Night 1 -> 2 -> 3 -> 1 ...), night i
// (1-based) uses seed + i. Random inputs from the seed: new move direction every 30 ticks; per tick
// 5% jump, 3% dash, 2% pulse, 10% interact. Each night runs until it ends or its standard duration.
// Usage: node scripts/soak.js --seed 7 --nights 10 --out soak.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createWorld, step } from '../src/sim/world.js';
import { createRng } from '../src/sim/rng.js';
import { NIGHTS } from '../src/sim/maps.js';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const seed = Number(arg('--seed', 7));
const nights = Number(arg('--nights', 10));
const out = arg('--out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  console.error('usage: node scripts/soak.js --seed <int> --nights <int> --out <file.json>');
  process.exit(1);
}

const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = () => globalThis.gc?.();
// A settled RSS reading: full GC, give V8's memory reducer a moment to hand pages back, GC again.
// Used the same way for mem_start and mem_end (A4-04).
const settledRss = () => {
  gc();
  const until = Date.now() + 300;
  while (Date.now() < until); // the soak runs no timers, so a short busy wait is fine and keeps the loop simple
  gc();
  return rssMb();
};
const t0 = process.hrtime.bigint();
// JIT warm-up (A4-03, not one of the measured nights): 3000 ticks of each night with seed 0 so V8's
// one-time code compilation and heap sizing are not mistaken for growth between mem_start and mem_end.
// Without it RSS still plateaus (60-night run: +5 MB total) but the one-time growth lands inside the window.
const warmTicks = Number(arg('--warmup-ticks', 3000));
for (const n of [1, 2, 3]) {
  const w = createWorld(0, {}, n);
  for (let k = 0; k < warmTicks && w.state === 'playing'; k++) {
    step(w, { move: [Math.cos(k / 30), Math.sin(k / 30)], jump: k % 20 === 0, pulse: k % 50 === 0, interact: k % 10 === 0, dash: k % 33 === 0 });
    w.events.length = 0;
  }
}
const results = [];
const perNight = [];
let crashes = 0;
let memStart = null;

for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  const s = seed + i;
  let w = null;
  try {
    w = createWorld(s, {}, night);
    if (i === 1) {
      memStart = settledRss(); // RSS after loading the first night
    }
    const rng = createRng(s ^ 0x5eed); // input stream, independent from the world's own rng
    const input = { move: [0, 0], cam_yaw_deg: 0 };
    const maxTicks = NIGHTS[night].duration_s * 60;
    while (w.state === 'playing' && w.tick < maxTicks) {
      if (w.tick % 30 === 0) {
        const a = rng() * 2 * Math.PI;
        input.move = [Math.cos(a), Math.sin(a)];
      }
      input.jump = rng() < 0.05;
      input.dash = rng() < 0.03;
      input.pulse = rng() < 0.02;
      input.interact = rng() < 0.1;
      step(w, input);
      w.events.length = 0; // nothing is kept between ticks
    }
    results.push(w.state === 'playing' ? 'timeout' : w.state);
    perNight.push({ night, seed: s, result: results.at(-1), ticks: w.tick, score: w.score, rss_mb_after: rssMb() });
  } catch (e) {
    crashes++;
    results.push('crash');
    perNight.push({ night, seed: s, result: 'crash', error: String(e?.stack || e).split('\n')[0] });
  }
  w = null; // reset: drop every reference to the finished night
}
const memEnd = settledRss(); // RSS after resetting the last night
const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e7) / 100,
  seed,
  per_night: perNight,
  node: process.version,
  pass: crashes === 0 && memEnd <= 1.2 * memStart,
};
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`soak: ${nights} nights, crashes ${crashes}, mem ${memStart} -> ${memEnd} MB, ${report.duration_s} s, results ${results.join(',')}`);
