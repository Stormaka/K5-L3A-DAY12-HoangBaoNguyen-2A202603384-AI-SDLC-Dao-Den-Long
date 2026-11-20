import { run } from '../src/headless.js';
import { parseInputs, parseScenario } from '../src/sim/validate.js';

/** Run the sim in-process exactly like the CLI does. */
export function sim({ seed = 1, ticks = 60, every = 1, scenario = {}, frames = [] } = {}) {
  const lines = run({
    seed,
    ticks,
    snapshotEvery: every,
    scenario: parseScenario(scenario),
    frames: parseInputs({ frames }),
  });
  return {
    lines,
    events: (name) => lines.filter((l) => l.type === 'event' && (!name || l.name === name)),
    snap: (tick) => lines.find((l) => l.type === 'snapshot' && l.tick === tick),
    end: lines[lines.length - 1],
  };
}

/** Isolated scenario: no random motes/shades unless given. */
export const iso = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
