// Greedy autopilot that PLAYS the real sim and records its button/stick presses as a
// Test-Contract inputs file. Proves the default Night 1 is winnable end-to-end.
// Usage: node scripts/bot.js <seed> <out-inputs.json>
import { writeFileSync } from 'node:fs';
import { createWorld, step } from '../src/sim/world.js';
import { TUNING as T } from '../src/sim/config.js';

const seed = Number(process.argv[2] ?? 1);
const out = process.argv[3];
const w = createWorld(seed);
const frames = [];
let prev = {};
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (let k = 0; k < T.night1_duration_s * 60 && w.state === 'playing'; k++) {
  const p = w.player;
  const lantern = w.lanterns.filter((l) => !l.lit).sort((a, b) => d(p, a) - d(p, b))[0];
  const need = T.lantern_cost - lantern.deposited;
  const threat = w.shades.find((s) => s.state !== 'stunned' && d(p, s) < 2.5);
  let target = lantern;
  if (p.carried < need && w.motes.length) target = w.motes.slice().sort((a, b) => d(p, a) - d(p, b))[0];
  const dist = d(p, target);
  const move = dist > 0.05 ? [+((target.x - p.x) / dist).toFixed(3), +((target.z - p.z) / dist).toFixed(3)] : [0, 0];
  const f = {
    move,
    interact: target === lantern && dist <= T.interact_radius && !prev.interact,
    pulse: !!threat && p.carried >= T.pulse_cost && p.pulseCd === 0 && !prev.pulse,
  };
  const delta = {};
  for (const key of Object.keys(f)) if (JSON.stringify(f[key]) !== JSON.stringify(prev[key])) delta[key] = f[key];
  if (Object.keys(delta).length) frames.push({ tick: k, ...delta });
  prev = f;
  step(w, { ...f, cam_yaw_deg: 0 });
  w.events.length = 0;
}
writeFileSync(out, JSON.stringify({ frames }));
console.log(`seed ${seed}: bot finished ${w.state} at tick ${w.tick}, score ${w.score}, flames ${w.player.flames}, frames ${frames.length}`);
