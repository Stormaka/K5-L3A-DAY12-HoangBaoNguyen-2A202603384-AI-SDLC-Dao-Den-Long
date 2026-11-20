#!/usr/bin/env node
// Headless runner — Test Contract v1.0.
// node src/headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out f.jsonl [--snapshot-every <int>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, step, snapshot } from './sim/world.js';
import { parseInputs, parseScenario, FormatError } from './sim/validate.js';

export class ArgError extends Error {}

export function parseArgs(argv) {
  const o = { snapshotEvery: 10 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    const need = () => {
      if (v === undefined) throw new ArgError(`missing value for ${k}`);
      i++;
      return v;
    };
    const int = (s, min) => {
      if (!/^-?\d+$/.test(s) || Number(s) < min) throw new ArgError(`${k}: expected integer >= ${min}`);
      return Number(s);
    };
    switch (k) {
      case '--seed': o.seed = int(need(), -2147483648); break;
      case '--night': o.night = int(need(), 1); break;
      case '--scenario': o.scenario = need(); break;
      case '--inputs': o.inputs = need(); break;
      case '--ticks': o.ticks = int(need(), 0); break;
      case '--out': o.out = need(); break;
      case '--snapshot-every': o.snapshotEvery = int(need(), 1); break;
      default: throw new ArgError(`unknown argument ${k}`);
    }
  }
  for (const r of ['seed', 'night', 'ticks', 'out']) if (o[r] === undefined) throw new ArgError(`--${r} is required`);
  if (o.night !== 1) throw new ArgError(`--night ${o.night} is not available (only night 1)`);
  return o;
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`${label}: cannot read ${path} (${e.code || e.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${label}: invalid JSON (${e.message})`);
  }
}

/** Pure run: returns array of output objects (snapshots, events, end). */
export function run({ seed, ticks, snapshotEvery = 10, scenario = {}, frames = new Map() }) {
  const w = createWorld(seed, scenario);
  const lines = [snapshot(w)];
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  for (let k = 0; k < ticks && w.state === 'playing'; k++) {
    const f = frames.get(k);
    if (f) Object.assign(cur, f);
    step(w, cur);
    lines.push(...w.events);
    w.events.length = 0;
    if (w.tick % snapshotEvery === 0) lines.push(snapshot(w));
  }
  lines.push({ type: 'end', ticks: w.tick, state: w.state, score: w.score });
  return lines;
}

export function main(argv) {
  try {
    const o = parseArgs(argv);
    const scenario = o.scenario ? parseScenario(readJson(o.scenario, 'scenario')) : {};
    const frames = o.inputs ? parseInputs(readJson(o.inputs, 'inputs')) : new Map();
    const lines = run({ seed: o.seed, ticks: o.ticks, snapshotEvery: o.snapshotEvery, scenario, frames });
    const out = resolve(o.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return 0;
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    if (e instanceof FormatError) return 2;
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
