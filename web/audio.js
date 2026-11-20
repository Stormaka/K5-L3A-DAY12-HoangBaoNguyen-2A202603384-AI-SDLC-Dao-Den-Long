// Synthesised audio (WebAudio, no asset files): night music loop + sound effects.
// Volume comes from settings (0..1). Everything is a no-op until the first user gesture.
let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let volume = 0.7;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(master);
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

function tone({ f = 440, f2 = null, type = 'sine', dur = 0.2, vol = 0.3, at = 0, attack = 0.01, out = master }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.4, vol = 0.2, at = 0, freq = 800, q = 0.7 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  pickup: () => tone({ f: 1320, f2: 1980, type: 'triangle', dur: 0.12, vol: 0.18 }),
  deposit: () => tone({ f: 660, f2: 880, type: 'triangle', dur: 0.15, vol: 0.2 }),
  lantern: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.5, vol: 0.22, at: i * 0.09 })),
  pulse: () => {
    tone({ f: 300, f2: 1200, type: 'sine', dur: 0.35, vol: 0.3 });
    noise({ dur: 0.35, vol: 0.12, freq: 2500 });
  },
  hit: () => {
    tone({ f: 220, f2: 70, type: 'sawtooth', dur: 0.35, vol: 0.25 });
    noise({ dur: 0.25, vol: 0.15, freq: 300 });
  },
  jump: () => tone({ f: 400, f2: 700, type: 'square', dur: 0.1, vol: 0.08 }),
  dash: () => noise({ dur: 0.22, vol: 0.25, freq: 1800, q: 1.5 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.7, vol: 0.2, at: i * 0.14 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sine', dur: 0.6, vol: 0.22, at: i * 0.2 })),
  shade: () => tone({ f: 110, f2: 55, type: 'sawtooth', dur: 0.8, vol: 0.12, attack: 0.2 }),
  tick: () => tone({ f: 1760, type: 'square', dur: 0.06, vol: 0.1 }),
  wind: () => noise({ dur: 2, vol: 0.18, freq: 500, q: 0.4 }),
  steal: () => tone({ f: 900, f2: 300, type: 'triangle', dur: 0.3, vol: 0.2 }),
  charm: () => [880, 1175, 1568].forEach((f, i) => tone({ f, type: 'sine', dur: 0.3, vol: 0.18, at: i * 0.06 })),
  click: () => tone({ f: 800, type: 'triangle', dur: 0.05, vol: 0.1 }),
};

// Night music: soft drone + pentatonic plucks (Vietnamese-ish scale), deterministic pattern.
const SCALE = [220, 247, 294, 330, 392, 440, 494, 587];
export function startMusic() {
  if (!ctx || musicTimer) return;
  let step = 0;
  const drone = () => tone({ f: 110, type: 'sine', dur: 4.2, vol: 0.12, attack: 1.5, out: musicGain });
  drone();
  musicTimer = setInterval(() => {
    if (step % 8 === 0) drone();
    const pat = [0, 2, 4, 3, 5, 4, 2, 1, 0, 3, 4, 6, 5, 3, 2, 0];
    const n = pat[step % pat.length];
    if (step % 2 === 0 || n % 2 === 0) tone({ f: SCALE[n], type: 'triangle', dur: 0.9, vol: 0.09, out: musicGain });
    step++;
  }, 520);
}
export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
