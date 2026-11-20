// Validation of --inputs / --scenario files. Any problem throws FormatError (CLI exits 2).

export class FormatError extends Error {}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (msg) => {
  throw new FormatError(msg);
};

function vec3(v, where) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: expected [x, y, z] numbers`);
  return [v[0], v[1], v[2]];
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];
const intGe0 = (v, where) => {
  if (!isInt(v) || v < 0) fail(`${where}: expected integer >= 0`);
  return v;
};

/** Returns Map<tick, frame> with only the fields present in each frame. */
export function parseInputs(raw) {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail('inputs: expected {"frames": [...]}');
  const frames = new Map();
  let last = -1;
  raw.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: expected object`);
    if (!isInt(f.tick) || f.tick < 0) fail(`${where}.tick: expected integer >= 0`);
    if (f.tick <= last) fail(`${where}.tick: ticks must be strictly increasing`);
    last = f.tick;
    const out = {};
    if ('move' in f) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) fail(`${where}.move: expected [x, z]`);
      out.move = [Math.max(-1, Math.min(1, f.move[0])), Math.max(-1, Math.min(1, f.move[1]))];
    }
    if ('cam_yaw_deg' in f) {
      if (!isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg: expected number`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of BUTTONS) {
      if (b in f) {
        if (typeof f[b] !== 'boolean') fail(`${where}.${b}: expected boolean`);
        out[b] = f[b];
      }
    }
    frames.set(f.tick, out);
  });
  return frames;
}

export function parseScenario(raw) {
  if (!isObj(raw)) fail('scenario: expected object');
  const s = {};
  if ('player' in raw) {
    const p = raw.player;
    if (!isObj(p)) fail('scenario.player: expected object');
    s.player = {};
    if ('pos' in p) s.player.pos = vec3(p.pos, 'scenario.player.pos');
    if ('carried' in p) {
      if (!isInt(p.carried) || p.carried < 0) fail('scenario.player.carried: expected integer >= 0');
      s.player.carried = p.carried;
    }
    if ('flames' in p) {
      if (!isInt(p.flames) || p.flames < 0) fail('scenario.player.flames: expected integer >= 0');
      s.player.flames = p.flames;
    }
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'])
      if (k in p) s.player[k] = intGe0(p[k], `scenario.player.${k}`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (k in raw) {
      if (typeof raw[k] !== 'boolean') fail(`scenario.${k}: expected boolean`);
      s[k] = raw[k];
    }
  }
  if ('motes' in raw) {
    if (!Array.isArray(raw.motes)) fail('scenario.motes: expected array');
    s.motes = raw.motes.map((m, i) => {
      const where = `scenario.motes[${i}]`;
      if (Array.isArray(m)) return { pos: vec3(m, where) };
      if (!isObj(m)) fail(`${where}: expected [x, y, z] or {pos, kind?, ttl_ticks?}`);
      const o = { pos: vec3(m.pos, `${where}.pos`) };
      if ('kind' in m) {
        if (m.kind !== 'random' && m.kind !== 'dropped') fail(`${where}.kind: expected "random" or "dropped"`);
        o.kind = m.kind;
      }
      if ('ttl_ticks' in m) o.ttl_ticks = intGe0(m.ttl_ticks, `${where}.ttl_ticks`);
      return o;
    });
  }
  if ('shades' in raw) {
    if (!Array.isArray(raw.shades)) fail('scenario.shades: expected array');
    const seen = new Set();
    s.shades = raw.shades.map((sh, i) => {
      if (!isObj(sh)) fail(`scenario.shades[${i}]: expected object`);
      const o = { pos: vec3(sh.pos, `scenario.shades[${i}].pos`) };
      if ('id' in sh) {
        if (typeof sh.id !== 'string' || !sh.id) fail(`scenario.shades[${i}].id: expected non-empty string`);
        if (seen.has(sh.id)) fail(`scenario.shades[${i}].id: duplicate id`);
        seen.add(sh.id);
        o.id = sh.id;
      }
      if ('state' in sh) {
        if (!SHADE_STATES.includes(sh.state)) fail(`scenario.shades[${i}].state: expected one of ${SHADE_STATES.join(', ')}`);
        o.state = sh.state;
      }
      if ('state_ticks_left' in sh) o.state_ticks_left = intGe0(sh.state_ticks_left, `scenario.shades[${i}].state_ticks_left`);
      if ('target_lantern_id' in sh) {
        if (typeof sh.target_lantern_id !== 'string') fail(`scenario.shades[${i}].target_lantern_id: expected string`);
        o.target_lantern_id = sh.target_lantern_id;
      }
      return o;
    });
  }
  if ('drifters' in raw) {
    if (!Array.isArray(raw.drifters)) fail('scenario.drifters: expected array');
    const seen = new Set();
    s.drifters = raw.drifters.map((d, i) => {
      const where = `scenario.drifters[${i}]`;
      if (!isObj(d)) fail(`${where}: expected object`);
      const o = { pos: vec3(d.pos, `${where}.pos`) };
      if ('id' in d) {
        if (typeof d.id !== 'string' || !d.id || seen.has(d.id)) fail(`${where}.id: expected unique non-empty string`);
        seen.add(d.id);
        o.id = d.id;
      }
      if ('state' in d) {
        if (!DRIFTER_STATES.includes(d.state)) fail(`${where}.state: expected one of ${DRIFTER_STATES.join(', ')}`);
        o.state = d.state;
      }
      if ('stolen' in d) o.stolen = intGe0(d.stolen, `${where}.stolen`);
      if ('state_ticks_left' in d) o.state_ticks_left = intGe0(d.state_ticks_left, `${where}.state_ticks_left`);
      return o;
    });
  }
  if ('charms' in raw) {
    if (!Array.isArray(raw.charms)) fail('scenario.charms: expected array');
    const seen = new Set();
    s.charms = raw.charms.map((c, i) => {
      const where = `scenario.charms[${i}]`;
      if (!isObj(c)) fail(`${where}: expected object`);
      const o = { pos: vec3(c.pos, `${where}.pos`) };
      if ('id' in c) {
        if (typeof c.id !== 'string' || !c.id || seen.has(c.id)) fail(`${where}.id: expected unique non-empty string`);
        seen.add(c.id);
        o.id = c.id;
      }
      if ('available' in c) {
        if (typeof c.available !== 'boolean') fail(`${where}.available: expected boolean`);
        o.available = c.available;
      }
      if ('respawn_ticks' in c) o.respawn_ticks = intGe0(c.respawn_ticks, `${where}.respawn_ticks`);
      return o;
    });
  }
  if ('lanterns' in raw) {
    if (!Array.isArray(raw.lanterns)) fail('scenario.lanterns: expected array');
    s.lanterns = raw.lanterns.map((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l)) fail(`${where}: expected object`);
      if (typeof l.id !== 'string') fail(`${where}.id: expected string`);
      const o = { id: l.id };
      if ('pos' in l) o.pos = vec3(l.pos, `${where}.pos`);
      if ('lit' in l) {
        if (typeof l.lit !== 'boolean') fail(`${where}.lit: expected boolean`);
        o.lit = l.lit;
      }
      if ('fuel' in l) {
        if (!isNum(l.fuel) || l.fuel < 0 || l.fuel > 100) fail(`${where}.fuel: expected number 0..100`);
        o.fuel = l.fuel;
      }
      if ('ever_lit' in l) {
        if (typeof l.ever_lit !== 'boolean') fail(`${where}.ever_lit: expected boolean`);
        o.ever_lit = l.ever_lit;
      }
      if ('deposited' in l) {
        if (!isInt(l.deposited) || l.deposited < 0) fail(`${where}.deposited: expected integer >= 0`);
        o.deposited = l.deposited;
      }
      return o;
    });
  }
  if ('time_left_s' in raw) {
    if (!isNum(raw.time_left_s) || raw.time_left_s <= 0) fail('scenario.time_left_s: expected number > 0');
    s.time_left_s = raw.time_left_s;
  }
  return s;
}
