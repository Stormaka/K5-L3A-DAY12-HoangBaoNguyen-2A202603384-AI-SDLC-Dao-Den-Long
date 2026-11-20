// Runs headless scenarios through the REAL CLI (headless_cmd from game.contract.json),
// checks expectations, checks determinism (2 runs, byte-identical), times them, and writes
// evidence to docs/proof/<phase>/.   Usage: node scripts/proof.js [phase-3]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';

const phase = process.argv[2] || 'phase-4';
const dir = `docs/proof/${phase}`;
mkdirSync(`${dir}/runs`, { recursive: true });
const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const [cmd, ...pre] = contract.headless_cmd.split(' ');
const S = 'tests/scenarios';
const sc = (name) => ['--scenario', `${S}/${name}.scenario.json`];
const inp = (name) => ['--inputs', `${S}/${name}.inputs.json`];
const ev = (L, n) => L.filter((l) => l.type === 'event' && l.name === n);
const snap = (L, t) => L.find((l) => l.type === 'snapshot' && l.tick === t);
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const lan = (s, id) => s.lanterns.find((l) => l.id === id);
const goIs = (L, reason) => (L.find((l) => l.name === 'game_over')?.data.reason === reason ? [] : [`game_over not ${reason}`]);

// Each case: id, requirement, night, args, expected end fields, required events, extra check (returns problems[])
const cases = [
  // ---- Phase 1 regression (re-run with Ticket-02 standard numbers)
  { id: 'P1-win-n1', req: 'Night 1 playable to WIN: survive to dawn with >= 3/5 lit (bot-recorded inputs)', night: 1, args: ['--seed', '1', ...inp('win-n1-seed1'), '--ticks', '21600', '--snapshot-every', '600'], expect: { state: 'won', ticks: 14400 }, events: ['mote_picked', 'deposit', 'lantern_lit', 'game_over'], check: (L) => goIs(L, 'dawn_survived') },
  { id: 'P1-idle-lose', req: 'T3: idle Mây lights nothing -> LOSE at dawn (shades now gather at unlit lanterns, out of her 12 m detection)', night: 1, args: ['--seed', '1', '--ticks', '21600', '--snapshot-every', '600'], expect: { state: 'lost', ticks: 14400 }, events: ['shade_spawned', 'game_over'],
    check: (L) => [...goIs(L, 'dawn'), ...(snap(L, 3000).shades.every((x) => x.state === 'wander' || x.state === 'spawning') ? [] : ['shades not wandering'])] },
  { id: 'P1-dawn', req: 'LOSE at dawn when too few lanterns are lit', night: 1, args: ['--seed', '1', ...sc('dawn'), '--ticks', '21600', '--snapshot-every', '60'], expect: { state: 'lost', ticks: 300 }, events: ['game_over'] },
  { id: 'P1-lantern', req: 'Pick 10 motes along +Z, deposit at L1 (cost 10), lantern lights; +5/mote put in +100', night: 1, args: ['--seed', '1', ...sc('lantern-run'), ...inp('lantern-run'), '--ticks', '240', '--snapshot-every', '30'], expect: { state: 'playing', score: 10 * contract.tuning.score.per_mote + contract.tuning.score.per_lantern }, events: ['mote_picked', 'deposit', 'lantern_lit'] },
  { id: 'P1-contract-example', req: 'Example scenario + inputs from the Test Contract run cleanly', night: 1, args: ['--seed', '1', ...sc('contract-example'), ...inp('contract-example'), '--ticks', '300'], expect: { state: 'playing' }, events: ['mote_picked'] },
  // ---- Phase 2: three nights
  { id: 'P2-win-n2', req: 'Night 2 (Đảo Cau, 2 islands) playable to WIN: >= 4/6 lit at dawn', night: 2, args: ['--seed', '1', ...inp('win-n2-seed1'), '--ticks', '21600', '--snapshot-every', '600'], expect: { state: 'won', ticks: 16200 }, events: ['lantern_lit', 'game_over'],
    check: (L) => goIs(L, 'dawn_survived') },
  { id: 'P2-win-n3', req: 'Night 3 (Đảo Chuông, 3 tiers, wind) playable to WIN: >= 5/7 lit at dawn', night: 3, args: ['--seed', '2', ...inp('win-n3-seed2'), '--ticks', '21600', '--snapshot-every', '600'], expect: { state: 'won', ticks: 18000 }, events: ['lantern_lit', 'game_over'],
    check: (L) => [...goIs(L, 'dawn_survived'), ...(L.some((l) => l.type === 'snapshot' && l.wind.active) ? [] : ['no wind'])] },
  { id: 'P2-idle-n2', req: 'Night 2 defaults: shades every 7 s (max 8), Gió Lạc spawn at 1200', night: 2, args: ['--seed', '2', '--ticks', '21600', '--snapshot-every', '300'], expect: {}, events: ['shade_spawned'],
    check: (L) => {
      const p = [];
      const t = ev(L, 'shade_spawned').map((e) => e.tick);
      if (t[0] !== 300 || t[1] !== 300 || (t[2] && t[2] !== 720)) p.push(`spawn ticks ${t.slice(0, 3)}`);
      if (Math.max(...L.filter((l) => l.type === 'snapshot').map((s) => s.shades.length)) > 8) p.push('more than 8 shades');
      const s = snap(L, 1200);
      if (s && !s.drifters.some((d) => d.id === 'D1')) p.push('no D1 at 1200');
      return p;
    } },
  // ---- Phase 2: Part 1 mechanics
  { id: 'P2-dash', req: 'Dash 14 m/s x 0.2 s, cooldown 1.5 s from start (press at 30 ignored)', night: 1, args: ['--seed', '1', ...sc('p2-dash'), ...inp('p2-dash'), '--ticks', '120', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['dash'],
    check: (L) => (JSON.stringify(ev(L, 'dash').map((e) => e.tick)) === '[1,91]' && snap(L, 12).player.pos[2] === 2.8 ? [] : ['dash timing/distance']) },
  { id: 'P2-fall', req: 'Walk off the island: Y < -10 -> -1 flame, lose all motes, respawn at start after 60 ticks, invuln', night: 1, args: ['--seed', '1', ...sc('p2-fall'), ...inp('p2-fall'), '--ticks', '600', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['player_hit'],
    check: (L) => {
      const h = ev(L, 'player_hit')[0];
      const r = snap(L, h.tick + 60);
      return h.data.by === 'fall' && h.data.lost === 4 && r.player.pos.join() === '0,0,0' && r.player.invuln ? [] : [`fall ${JSON.stringify(h)}`];
    } },
  { id: 'P2-pulse', req: 'Pulse: 3 motes, r 5 m in 3D from feet+0.8, stun 120, push 4 m over 15 ticks, cooldown 3 s, +5 per shade', night: 1, args: ['--seed', '1', ...sc('p2-pulse'), ...inp('p2-pulse'), '--ticks', '200', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['pulse'],
    check: (L) => {
      const p = ev(L, 'pulse');
      return p.length === 2 && p[0].tick === 1 && p[1].tick === 181 && p[0].data.stunned_ids.join() === 'S1,S2' && snap(L, 15).shades[0].pos[0] === 7 ? [] : [`pulses ${JSON.stringify(p)}`];
    } },
  // ---- Phase 3: Ticket-03 "Đèn cạn dầu"
  { id: 'P3-fuel-out', req: 'Lit lantern starts at 100 fuel, burns 1/s, goes out at 0 (tick 6000): lantern_out, deposited 0, ever_lit', night: 1, args: ['--seed', '1', ...sc('p3-fuel-out'), '--ticks', '6001', '--snapshot-every', '600'], expect: { state: 'playing' }, events: ['lantern_out'],
    check: (L) => (ev(L, 'lantern_out')[0].tick === 6000 && lan(snap(L, 3000), 'L1').fuel === 50 && lan(snap(L, 6000), 'L1').ever_lit && lan(snap(L, 6000), 'L1').fuel === 0 ? [] : ['fuel timeline']) },
  { id: 'P3-refuel', req: 'Refuel a lit lantern: used = min(carried, ceil((100-fuel)/10)), capped at 100, +5 per mote', night: 1, args: ['--seed', '1', ...sc('p3-refuel'), ...inp('p3-refuel'), '--ticks', '10', '--snapshot-every', '1'], expect: { state: 'playing', score: 25 }, events: ['refuel'],
    check: (L) => (JSON.stringify(ev(L, 'refuel')[0].data) === '{"lantern_id":"L1","amount":5,"fuel":100}' ? [] : ['refuel data']) },
  { id: 'P3-relight', req: 'Burned-out lantern relights for 5 motes: lantern_lit relight:true, +40, relit_count 1', night: 1, args: ['--seed', '1', ...sc('p3-relight'), ...inp('p3-relight'), '--ticks', '10', '--snapshot-every', '1'], expect: { state: 'playing', score: 5 * 5 + 40 }, events: ['lantern_out', 'lantern_lit'],
    check: (L) => (ev(L, 'lantern_lit')[0].data.relight === true && lan(snap(L, 6), 'L1').relit_count === 1 && lan(snap(L, 6), 'L1').fuel === 100 ? [] : ['relight']) },
  { id: 'P3-drain', req: 'Wandering shade walks to the weak lantern (< 30), state drain, -5/s, fuel_drain every 60 ticks, lantern goes out', night: 1, args: ['--seed', '1', ...sc('p3-drain'), '--ticks', '300', '--snapshot-every', '10'], expect: { state: 'playing' }, events: ['fuel_drain', 'lantern_out'],
    check: (L) => (snap(L, 90).shades[0].state === 'drain' && ev(L, 'fuel_drain').length === 3 && ev(L, 'lantern_out')[0].tick === 275 ? [] : ['drain timeline']) },
  { id: 'P3-drain-refuel', req: 'Refuelling a drained lantern to >= 30 pushes the shade out to 6 m in <= 30 ticks, no damage', night: 1, args: ['--seed', '1', ...sc('p3-drain-refuel'), ...inp('p3-drain-refuel'), '--ticks', '60', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['refuel'],
    check: (L) => (ev(L, 'player_hit').length === 0 && dXZ(snap(L, 30).shades[0].pos, [0, 0, 25]) >= 6 && snap(L, 1).shades[0].state !== 'drain' ? [] : ['evict']) },
  { id: 'P3-lowfuel', req: 'Safe zone holds at exactly 30 fuel and disappears below 30 (shade gets in and hits)', night: 1, args: ['--seed', '1', ...sc('p3-lowfuel'), '--ticks', '120', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['player_hit'],
    check: (L) => (snap(L, 1).shades[0].pos[0] === 6.002 && snap(L, 2).shades[0].pos[0] < 6 ? [] : ['zone boundary']) },
  { id: 'P3-dawn-win', req: 'Dawn with 3/5 lit -> won dawn_survived, bonus 50 + floor(fuel) per lit lantern + 50 per flame', night: 1, args: ['--seed', '1', ...sc('p3-dawn-win'), '--ticks', '100', '--snapshot-every', '10'], expect: { state: 'won', ticks: 60, score: 3 * (50 + 99) + 150 }, events: ['game_over'], check: (L) => goIs(L, 'dawn_survived') },
  { id: 'P3-dawn-lose', req: 'Dawn with 2/5 lit -> lost dawn, no bonus', night: 1, args: ['--seed', '1', ...sc('p3-dawn-lose'), '--ticks', '100', '--snapshot-every', '10'], expect: { state: 'lost', ticks: 60, score: 0 }, events: ['game_over'], check: (L) => goIs(L, 'dawn') },
  { id: 'P3-capacity', req: 'Capacity grows 10 -> 12 after a successful light; pickup fills to the new capacity', night: 1, args: ['--seed', '1', ...sc('p3-capacity'), ...inp('p3-capacity'), '--ticks', '5', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['lantern_lit', 'mote_picked'],
    check: (L) => (snap(L, 2).player.capacity === 12 && snap(L, 2).player.carried === 12 && snap(L, 2).motes_active === 4 ? [] : [`cap ${JSON.stringify(snap(L, 2).player)}`]) },
  { id: 'P2-safezone', req: 'Lighting a lantern pushes shades inside to the 6 m edge in <= 30 ticks, no damage', night: 1, args: ['--seed', '1', ...sc('p2-safezone'), ...inp('p2-safezone'), '--ticks', '300', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['lantern_lit'],
    check: (L) => (ev(L, 'player_hit').length === 0 && snap(L, 30).shades[0].pos[0] === 6.002 ? [] : ['evict']) },
  { id: 'P2-pause', req: 'Pause/resume: tick runs, sim_tick/time/cooldowns freeze, state "paused"', night: 1, args: ['--seed', '1', ...sc('p2-pause'), ...inp('p2-pause'), '--ticks', '30', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['paused', 'resumed'],
    check: (L) => (snap(L, 15).state === 'paused' && snap(L, 15).sim_tick === 10 && snap(L, 30).sim_tick === 20 ? [] : ['pause']) },
  { id: 'P2-pad-n2', req: 'Night 2 launch pad flings Mây from island A to island B', night: 2, args: ['--seed', '1', ...sc('p2-pad-n2'), ...inp('p2-pad-n2'), '--ticks', '200', '--snapshot-every', '10'], expect: { state: 'playing' }, events: [],
    check: (L) => (dXZ(snap(L, 200).player.pos, [70, 0, 0]) <= 28 && snap(L, 200).player.grounded ? [] : ['did not land on B']) },
  { id: 'P2-terrain-n3', req: 'Night 3: walk up the 30° ramp to tier 1 (Y 3), then walk off the edge back down', night: 3, args: ['--seed', '1', ...sc('p2-terrain-n3'), ...inp('p2-terrain-n3'), '--ticks', '400', '--snapshot-every', '10'], expect: { state: 'playing' }, events: [],
    check: (L) => (snap(L, 160).player.pos[1] === 3 && ev(L, 'player_hit').length === 0 ? [] : [`tier ${snap(L, 160).player.pos}`]) },
  { id: 'P2-wind-n3', req: 'Night 3 wind: 5 s gust every 30 s pushes 2 m/s; dir chosen 2 s before', night: 3, args: ['--seed', '1', ...sc('p2-wind-n3'), '--ticks', '2101', '--snapshot-every', '1'], expect: { state: 'playing' }, events: [],
    check: (L) => (!snap(L, 1799).wind.active && snap(L, 1800).wind.active && !snap(L, 2100).wind.active && Math.abs(dXZ(snap(L, 2100).player.pos, [0, 0, -30]) - 10) < 1e-3 ? [] : ['wind']) },
  // ---- Phase 2: Part 3 features
  { id: 'P2-drifter-steal', req: 'Gió Lạc: idle -> chase (carried >= 5, <= 15 m) -> steals 3 (even when invulnerable) -> flee 240 ticks -> removed', night: 2, args: ['--seed', '1', ...sc('p2-drifter-steal-n2'), '--ticks', '330', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['drifter_steal'],
    check: (L) => {
      const e = ev(L, 'drifter_steal')[0];
      return e.tick === 76 && e.data.amount === 3 && snap(L, 316).drifters[0].state === 'removed' ? [] : [`steal ${JSON.stringify(e)}`];
    } },
  { id: 'P2-drifter-pulse', req: 'Pulse on a fleeing Gió Lạc with loot: drops it as motes (drifter_drop), Mây picks them back', night: 2, args: ['--seed', '1', ...sc('p2-drifter-pulse-n2'), ...inp('p2-drifter-pulse-n2'), '--ticks', '130', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['drifter_drop', 'mote_picked'],
    check: (L) => (snap(L, 121).drifters[0].state === 'removed' && ev(L, 'mote_picked').length === 3 ? [] : ['drop/pick']) },
  { id: 'P2-charm', req: 'Bùa Gió: picked -> 7.2 m/s + dash without cooldown for 600 ticks', night: 2, args: ['--seed', '1', ...sc('p2-charm-n2'), ...inp('p2-charm-n2'), '--ticks', '200', '--snapshot-every', '1'], expect: { state: 'playing' }, events: ['charm_picked', 'dash'],
    check: (L) => (ev(L, 'dash').length === 2 && ev(L, 'dash')[1].tick === 44 ? [] : [`dash ${ev(L, 'dash').map((e) => e.tick)}`]) },
];

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const rows = [];
let failed = 0;
for (const c of cases) {
  const out = `${dir}/runs/${c.id}.jsonl`;
  const args = [...pre, ...c.args, '--night', String(c.night), '--out', out];
  const t0 = process.hrtime.bigint();
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const text = r.status === 0 ? readFileSync(out, 'utf8') : '';
  const out2 = `${os.tmpdir()}/ddl-${c.id}.jsonl`;
  spawnSync(cmd, [...pre, ...c.args, '--night', String(c.night), '--out', out2], { encoding: 'utf8' });
  const text2 = r.status === 0 ? readFileSync(out2, 'utf8') : 'x';
  const lines = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const end = lines.at(-1) || {};
  const names = new Set(lines.filter((l) => l.type === 'event').map((l) => l.name));
  const go = lines.find((l) => l.name === 'game_over');
  const problems = [];
  if (r.status !== 0) problems.push(`exit ${r.status}: ${r.stderr.trim()}`);
  for (const [k, v] of Object.entries(c.expect)) if (end[k] !== v) problems.push(`end.${k}=${end[k]} (want ${v})`);
  for (const e of c.events) if (!names.has(e)) problems.push(`missing event ${e}`);
  if (!problems.length && c.check) {
    try {
      problems.push(...c.check(lines));
    } catch (e) {
      problems.push(`check threw: ${e.message}`);
    }
  }
  if (text !== text2) problems.push('NOT deterministic');
  if (ms > 30000) problems.push(`too slow: ${ms.toFixed(0)} ms`);
  if (problems.length) failed++;
  rows.push({ ...c, ok: !problems.length, problems, end, go: go ? `${go.data.result}/${go.data.reason} @${go.tick}` : '-', det: text === text2, hash: sha(text), ms, cmd: [cmd, ...args].join(' ') });
}

const md = [
  `# Headless evidence — ${phase}`,
  '',
  `Generated by \`npm run proof -- ${phase}\` (scripts/proof.js). Commit: \`${spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'uncommitted'}\`. Machine: ${os.cpus()[0]?.model.trim()} · ${os.platform()} ${os.release()} · Node ${process.version}.`,
  '',
  'Each run uses the real `headless_cmd` from game.contract.json and is executed **twice**; outputs must be byte-identical (determinism). Runs must finish in ≤ 30 s.',
  '',
  '| ID | Night | Requirement | Result | End line | game_over | Deterministic | sha256[0:16] | Time |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.night} | ${r.req} | ${r.ok ? 'PASS' : 'FAIL: ' + r.problems.join('; ')} | \`${JSON.stringify(r.end)}\` | ${r.go} | ${r.det ? 'yes' : 'NO'} | \`${r.hash}\` | ${r.ms.toFixed(0)} ms |`),
  '',
  '## Commands',
  '',
  ...rows.map((r) => `- **${r.id}**: \`${r.cmd}\` → [runs/${r.id}.jsonl](runs/${r.id}.jsonl)`),
  '',
].join('\n');
writeFileSync(`${dir}/headless-evidence.md`, md);
console.log(rows.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.problems.join('; ')}`).join('\n'));
console.log(failed ? `${failed} FAILED` : `all ${rows.length} PASS`);
process.exitCode = failed ? 1 : 0;
