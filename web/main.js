// 3D client. All gameplay comes from src/sim (same code as headless); this file renders,
// reads input, plays audio and runs the 3-night flow (menu -> intro -> play -> result -> dawn).
import * as THREE from 'three';
import { createWorld, step, timeLeft, PULSE_CD, DASH_CD, capacity, winNeed, lightCost } from '/src/sim/world.js';
import { TUNING as T, WORLD as W, DT } from '/src/sim/config.js';
import { NIGHTS } from '/src/sim/maps.js';
import { initAudio, setVolume, sfx, startMusic, stopMusic } from './audio.js';
import { createBenchWorld, benchCamera, benchStats, BENCH } from '/src/sim/bench.js';
import { addEntry, NAME_RE, normalizeName, isoLocal } from '/src/leaderboard.js';

// Standard palette (Ticket-02 Part 3)
const C = {
  night: 0x0e1430, mist: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drift: 0x8fa3b8, danger: 0xff5a5f, ui: 0xf5f1e6,
};
const params = new URLSearchParams(location.search);
const CB = { shadeEdge: 0x00b3ff }; // colour-blind friendly: shade outline + eyes
const shadeEdgeHex = () => (settings.colorblind ? CB.shadeEdge : C.shadeEdge);
const applyPalette = () => document.body.classList.toggle('cb', !!settings.colorblind);

// ---------------------------------------------------------------- settings (persisted)
// Rebindable actions (Ticket-04 §4): [id, label, default key code]
const ACTIONS = [
  ['up', 'Đi tới', 'KeyW'], ['down', 'Đi lùi', 'KeyS'], ['left', 'Sang trái', 'KeyA'], ['right', 'Sang phải', 'KeyD'],
  ['jump', 'Nhảy', 'Space'], ['dash', 'Lướt', 'ShiftLeft'], ['interact', 'Tương tác (thắp / châm dầu)', 'KeyE'],
  ['pulse', 'Tỏa Sáng', 'KeyF'], ['pause', 'Tạm dừng', 'KeyP'], ['camLeft', 'Xoay camera trái', 'KeyQ'], ['camRight', 'Xoay camera phải', 'KeyC'],
];
const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(([id, , k]) => [id, k]));
const settings = { volume: 0.7, sensitivity: 1, colorblind: false, captions: true, reduceMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem('ddl-settings') || '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } });
} catch {}
const keyName = (code) => ({ Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab' }[code] || code.replace(/^Key|^Digit/, ''));
const K = (id) => keyName(settings.keys[id]);
/** action ids grouped by key code, only for codes bound to 2+ actions */
function duplicateKeys() {
  const by = {};
  for (const [id] of ACTIONS) (by[settings.keys[id]] ||= []).push(id);
  return Object.values(by).filter((ids) => ids.length > 1);
}
const applyAccess = () => {
  document.documentElement.classList.toggle('large', !!settings.largeText);
  document.body.classList.toggle('reduce', !!settings.reduceMotion);
};
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch {}
};
setVolume(settings.volume);
if (params.has('cb')) settings.colorblind = true;
if (params.has('large')) settings.largeText = true;
applyPalette();
applyAccess();

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(params.has('bench') ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.night);
scene.fog = new THREE.Fog(C.mist, 30, 110);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
const moon = new THREE.DirectionalLight(0x9fb0ff, 0.45);
moon.position.set(-30, 60, -20);
scene.add(ambient, moon);
const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshLambertMaterial({ color: C.sea }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -8;
scene.add(sea);

const std = (color, emissive = 0, ei = 0) => new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

// ---------------------------------------------------------------- Mây (shirt, red scarf, nón lá, small lantern)
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.45, 1.1, 12), std(C.shirt));
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), std(C.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.05), std(C.scarf));
  tail.position.set(0.15, 0.9, -0.3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), std(0xf1c9a0));
  head.position.y = 1.4;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 20), std(C.sand));
  hat.position.y = 1.78;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), basic(C.lit));
  lamp.position.set(0.55, 1.3, 0.3);
  const light = new THREE.PointLight(C.lit, 5, 10, 1.6);
  light.position.copy(lamp.position);
  g.add(body, scarf, tail, head, hat, lamp, light);
  return g;
}
const playerMesh = makePlayer();
scene.add(playerMesh);

// ---------------------------------------------------------------- level geometry
let level = new THREE.Group();
scene.add(level);
const grassMat = std(C.grass);
const rockMat = std(0x34404a);
const sandMat = std(C.sand);
const woodMat = std(C.wood);

function island(cx, r) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 4, 5, 64), [rockMat, grassMat, rockMat]);
  top.position.set(cx, -2.5, 0);
  const beach = new THREE.Mesh(new THREE.RingGeometry(r - 1.6, r, 64), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(cx, 0.02, 0);
  g.add(top, beach);
  return g;
}

function buildLevel(map) {
  scene.remove(level);
  level = new THREE.Group();
  if (map.night === 1) level.add(island(0, 40));
  if (map.night === 2) {
    level.add(island(0, 28), island(70, 28));
    const b = map.bridge;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 4, 0.3, b.z1 - b.z0), woodMat);
    deck.position.set((b.x0 + b.x1) / 2, -0.15, 0);
    level.add(deck);
    for (let x = b.x0 - 1; x <= b.x1 + 1; x += 1.2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, b.z1 - b.z0), std(0x4e3521));
      plank.position.set(x, 0.03, 0);
      level.add(plank);
    }
  }
  if (map.night === 3) {
    level.add(island(0, 45));
    const sh = new THREE.Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (Math.PI * i) / 40;
      i ? sh.lineTo(24 * Math.cos(a), -24 * Math.sin(a)) : sh.moveTo(24, 0);
    }
    for (let i = 40; i >= 0; i--) {
      const a = (Math.PI * i) / 40;
      sh.lineTo(12 * Math.cos(a), -12 * Math.sin(a));
    }
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }), [grassMat, rockMat]);
    tier1.rotation.x = -Math.PI / 2;
    level.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [rockMat, grassMat, rockMat]);
    tier2.position.y = 3;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), std(0x8a5a3a));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.2, 6), std(0x7a1f1f));
    roof.position.y = 15.1;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), std(C.gold, C.gold, 0.3));
    bell.position.y = 13.4;
    level.add(tier2, tower, roof, bell);
    for (const a of map.ramps) {
      const ar = (a * Math.PI) / 180;
      const g = new THREE.Group();
      g.position.set(27 * Math.cos(ar), 1.5, 27 * Math.sin(ar));
      g.rotation.y = Math.atan2(-Math.cos(ar), -Math.sin(ar));
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, Math.hypot(6, 3)), woodMat);
      slab.rotation.x = -Math.atan2(3, 6);
      g.add(slab);
      level.add(g);
    }
  }
  for (const pd of map.pads) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.2, 24), basic(C.gold));
    pad.position.set(pd.x, pd.y + 0.1, pd.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 32), basic(C.core));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pd.x, pd.y + 0.6, pd.z);
    ring.userData.spin = true;
    level.add(pad, ring);
  }
  scene.add(level);
}

// ---------------------------------------------------------------- entities
let w = null;
let night = 1;
const meshes = { shades: new Map(), motes: new Map(), lanterns: new Map(), drifters: new Map(), charms: new Map() };
const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const moteCoreGeo = new THREE.SphereGeometry(0.11, 8, 6);
const moteHaloGeo = new THREE.SphereGeometry(0.28, 10, 8);
const moteCoreMat = basic(C.moteCore);
const moteHaloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });

// Ticket-04 performance: shades and motes are drawn with InstancedMesh (a handful of draw calls for
// 200 shades + 100 motes in the benchmark instead of ~1300). Pools grow when needed.
function pool(geo, mat, cap) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.count = 0;
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
  return m;
}
const eyeGeo = new THREE.SphereGeometry(0.08, 6, 4);
const inst = {
  cap: 0,
  shadeBody: null, shadeEdge: null, shadeEyes: null, moteCore: null, moteHalo: null,
  beams: new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.shadeEdge, transparent: true, opacity: 0.8 })),
};
inst.beams.frustumCulled = false;
scene.add(inst.beams);
function ensurePools(n) {
  if (n <= inst.cap) return;
  const cap = Math.max(64, 2 ** Math.ceil(Math.log2(n)));
  for (const k of ['shadeBody', 'shadeEdge', 'shadeEyes', 'moteCore', 'moteHalo']) if (inst[k]) scene.remove(inst[k]);
  inst.shadeBody = pool(shadeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x05020a }), cap);
  inst.shadeEdge = pool(shadeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }), cap);
  inst.shadeEyes = pool(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), cap * 2);
  inst.moteCore = pool(moteCoreGeo, moteCoreMat, cap);
  inst.moteHalo = pool(moteHaloGeo, moteHaloMat, cap);
  inst.beams.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 6), 3).setUsage(THREE.DynamicDrawUsage));
  inst.cap = cap;
}
ensurePools(64);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function clearEntities() {
  for (const m of Object.values(meshes)) {
    for (const v of m.values()) scene.remove(v.group || v);
    m.clear();
  }
}

function buildLanterns() {
  for (const l of w.lanterns) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), woodMat);
    post.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 8), std(C.off));
    head.position.y = 3.4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basic(C.off));
    core.position.y = 3.4;
    const light = new THREE.PointLight(C.lit, 0, 26, 1.3);
    light.position.y = 3.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 8), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: 0.25, depthWrite: false }));
    fill.position.y = 2.6;
    fill.scale.set(0.001, 0.001, 1);
    // fuel bar (billboard above the lantern), shown while lit
    const bar = new THREE.Group();
    bar.position.y = 4.6;
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshBasicMaterial({ color: 0x0e1430, transparent: true, opacity: 0.8, depthWrite: false }));
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.14), new THREE.MeshBasicMaterial({ color: C.lit, depthWrite: false }));
    barFill.position.z = 0.01;
    bar.add(barBg, barFill);
    // torn paper marks: shown on unlit lanterns in colour-blind mode (shape cue, not colour)
    const tear = new THREE.Group();
    const tearMat = new THREE.MeshBasicMaterial({ color: C.ui, side: THREE.DoubleSide });
    for (let side = 0; side < 4; side++) {
      const face = new THREE.Group();
      face.rotation.y = (side * Math.PI) / 2;
      for (const [x, y, rz] of [[0.18, 0.12, 0.6], [-0.15, -0.15, -0.5], [0.02, -0.3, 0.25]]) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.4), tearMat);
        t.position.set(x, y, 0.52);
        t.rotation.z = rz;
        face.add(t);
      }
      tear.add(face);
    }
    tear.position.y = 3.4;
    group.add(post, head, core, light, ring, bar, tear);
    group.position.set(l.x, l.y, l.z);
    scene.add(group);
    meshes.lanterns.set(l.id, { group, head, core, light, ring, bar, barFill, tear });
  }
}

function makeDrifter() {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.8) * 0.4, i * 0.12 - 0.7, Math.cos(i * 0.5) * 0.25 - i * 0.05));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6), new THREE.MeshLambertMaterial({ color: C.drift, emissive: C.drift, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }));
  const g = new THREE.Group();
  g.add(tube);
  g.userData = { tube };
  scene.add(g);
  return g;
}

function makeCharm() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.5, 0.75, 0.06);
  const paper = new THREE.Mesh(geo, std(C.scarf, C.scarf, 0.35));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.gold }));
  const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), basic(C.gold));
  glyph.position.z = 0.035;
  g.add(paper, edges, glyph);
  scene.add(g);
  return g;
}

// Compile every material once at night start so the first shade/drifter/beam does not stall a frame.
function warmUpShaders() {
  const tmp = [makeDrifter(), makeCharm()];
  for (const k of ['shadeBody', 'shadeEdge', 'shadeEyes']) {
    inst[k].setColorAt(0, _c.setHex(0xffffff)); // creates instanceColor so the shader variant is compiled now
    inst[k].count = 1;
  }
  renderer.compile(scene, camera);
  for (const g of tmp) scene.remove(g);
}

// ---------------------------------------------------------------- effects
const flash = document.getElementById('flash');
const hurt = document.getElementById('hurt');
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: C.core, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 1;
// wind leaves
const leafGeo = new THREE.PlaneGeometry(0.25, 0.12);
const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ color: 0x9fbf6a, side: THREE.DoubleSide }), 60);
leaves.frustumCulled = false;
scene.add(leaves);
const leafState = Array.from({ length: 60 }, (_, i) => ({ x: 0, y: 0, z: 0, ph: i * 0.37 }));
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);

// ---------------------------------------------------------------- input
const keys = new Set();
let camYaw = 0; // degrees, sent as cam_yaw_deg
let camYawShown = 0;
let capture = null; // action id waiting for a new key (rebinding screen)
addEventListener('keydown', (e) => {
  initAudio();
  if (capture) {
    e.preventDefault();
    settings.keys[capture] = e.code;
    capture = null;
    saveSettings();
    showKeys();
    return;
  }
  if (e.target instanceof HTMLInputElement) {
    if (e.code === 'Enter' && overlayDefault) overlayDefault();
    return; // typing a name: no game keys
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return keys.add(e.code);
  keys.add(e.code);
  const escPauses = e.code === 'Escape' && !Object.values(settings.keys).includes('Escape');
  if ((e.code === settings.keys.pause || escPauses) && (mode === 'playing' || mode === 'paused')) {
    mode === 'playing' ? pauseGame() : resumeGame();
    return;
  }
  if (e.code === 'Enter' && overlayDefault) overlayDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  if (mode === 'playing') pauseGame();
});
let dragging = false;
addEventListener('mousedown', (e) => {
  initAudio();
  if (e.button === 0 && mode === 'playing') dragging = true;
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.25 * settings.sensitivity;
});

function readInput(dtReal) {
  const turn = 110 * settings.sensitivity * dtReal;
  const on = (id) => keys.has(settings.keys[id]);
  if (on('camLeft')) camYaw += turn;
  if (on('camRight')) camYaw -= turn;
  const f = (on('up') ? 1 : 0) - (on('down') ? 1 : 0);
  // screen-right is -x in the contract's camera frame (camera looks along +z at yaw 0)
  const r = (on('left') ? 1 : 0) - (on('right') ? 1 : 0);
  return { move: [r, f], cam_yaw_deg: camYaw, jump: on('jump'), interact: on('interact'), pulse: on('pulse'), dash: on('dash') };
}

// ---------------------------------------------------------------- flow: menu / intro / play / pause / result / dawn
let mode = 'menu';
const newCampaign = () => ({ scores: [0, 0, 0], won: [false, false, false], seed: null, saved: false });
let campaign = newCampaign();
let seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0x7fffffff) >>> 0;
const overlay = document.getElementById('overlay');
const card = document.getElementById('card');
let overlayDefault = null;
let backFromSettings = null;

function show(html, buttons) {
  card.innerHTML = html + `<div class="btns">${buttons.map((b, i) => `<button data-i="${i}">${b[0]}</button>`).join('')}</div>`;
  card.querySelectorAll('button').forEach((el) => el.addEventListener('click', () => {
    initAudio();
    sfx.click();
    buttons[Number(el.dataset.i)][1]();
  }));
  overlayDefault = buttons[0]?.[1] || null;
  overlay.style.display = 'flex';
  card.querySelector('button')?.focus();
}
const hideOverlay = () => {
  overlay.style.display = 'none';
  overlayDefault = null;
};
const total = () => campaign.scores.reduce((a, b) => a + b, 0);

const controls = () => `<table>
  <tr><td><kbd>${K('up')} ${K('left')} ${K('down')} ${K('right')}</kbd></td><td>Di chuyển</td></tr>
  <tr><td><kbd>Chuột kéo</kbd> / <kbd>${K('camLeft')}</kbd> <kbd>${K('camRight')}</kbd></td><td>Xoay camera</td></tr>
  <tr><td><kbd>${K('jump')}</kbd> · <kbd>${K('dash')}</kbd></td><td>Nhảy · Lướt</td></tr>
  <tr><td><kbd>${K('interact')}</kbd></td><td>Thắp (${T.lantern_cost}, thắp lại ${T.relight_cost}) · châm dầu</td></tr>
  <tr><td><kbd>${K('pulse')}</kbd></td><td>Tỏa Sáng (tốn ${T.pulse_cost} đom đóm)</td></tr>
  <tr><td><kbd>${K('pause')}</kbd> / <kbd>Esc</kbd></td><td>Tạm dừng</td></tr></table>`;

function showMenu() {
  mode = 'menu';
  stopMusic();
  campaign = newCampaign();
  show(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Đèn Lồng Lớn cạn dầu dần và Bóng Mực tìm tới hút dầu. Gom đom đóm, thắp và châm dầu, giữ đủ đèn sáng cho tới bình minh.</p>${controls()}`, [
    ['Bắt đầu (Đêm 1)', () => showIntro(1)],
    ['Chơi Đêm 2', () => showIntro(2)],
    ['Chơi Đêm 3', () => showIntro(3)],
    ['Bảng xếp hạng', () => showBoard(showMenu)],
    ['Cài đặt', () => showSettings(showMenu)],
  ]);
}

function showIntro(n) {
  mode = 'intro';
  night = n;
  const m = NIGHTS[n];
  show(`<h2>Đêm ${n}</h2><h1>${m.name}</h1><p class="quote">“${m.intro}”<br>— Ông Đăng</p><p>Giữ ít nhất <b>${Math.ceil(T.win_ratio * m.lanterns.length)}/${m.lanterns.length}</b> Đèn Lồng Lớn sáng lúc bình minh · ${m.duration_s / 60 | 0}:${String(m.duration_s % 60).padStart(2, '0')}</p>`, [
    ['Vào đêm', () => startNight(n)],
    ['Về menu', showMenu],
  ]);
}

function startNight(n, scenario = {}) {
  night = n;
  clearEntities();
  if (campaign.seed === null) campaign.seed = seed;
  w = createWorld(seed++, scenario, n);
  buildLevel(w.map);
  buildLanterns();
  warmUpShaders();
  camYaw = camYawShown = n === 3 ? 0 : 0;
  hideOverlay();
  mode = 'playing';
  lastSec = Infinity;
  startMusic();
  acc = 0;
}

function pauseGame() {
  mode = 'paused';
  keys.clear();
  show(`<h1>Tạm dừng</h1><p>Đêm ${night} · ${w.map.name}</p>`, [
    ['Tiếp tục', resumeGame],
    ['Chơi lại Đêm', () => startNight(night)],
    ['Cài đặt', () => showSettings(pauseGame)],
    ['Về menu', showMenu],
  ]);
}
function resumeGame() {
  hideOverlay();
  mode = 'playing';
  acc = 0;
}

function showSettings(back) {
  const prevMode = mode;
  mode = prevMode === 'playing' ? 'paused' : prevMode;
  backFromSettings = back;
  show(`<h1>Cài đặt</h1>
    <label>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><span id="volv">${Math.round(settings.volume * 100)}%</span></label>
    <label>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"><span id="sensv">${settings.sensitivity.toFixed(1)}</span></label>
    <label>Bảng màu dễ phân biệt <input id="cbx" type="checkbox" ${settings.colorblind ? 'checked' : ''}><span></span></label>
    <label>Phụ đề / chỉ báo hình ảnh <input id="capx" type="checkbox" ${settings.captions ? 'checked' : ''}><span></span></label>
    <label>Giảm chuyển động <input id="redx" type="checkbox" ${settings.reduceMotion ? 'checked' : ''}><span></span></label>
    <label>Chữ lớn (×1.25) <input id="largex" type="checkbox" ${settings.largeText ? 'checked' : ''}><span></span></label>
    <p style="opacity:.75">Cài đặt được lưu lại cho lần mở sau.</p>`, [['Xong', () => backFromSettings()], ['Đổi phím…', () => showKeys()]]);
  for (const [id, key] of [['capx', 'captions'], ['redx', 'reduceMotion'], ['largex', 'largeText']]) {
    card.querySelector('#' + id).addEventListener('change', (e) => {
      settings[key] = e.target.checked;
      applyAccess();
      saveSettings();
    });
  }
  const vol = card.querySelector('#vol'), sens = card.querySelector('#sens');
  vol.addEventListener('input', () => {
    settings.volume = Number(vol.value);
    card.querySelector('#volv').textContent = `${Math.round(settings.volume * 100)}%`;
    setVolume(settings.volume);
    saveSettings();
  });
  vol.addEventListener('change', () => sfx.pickup());
  card.querySelector('#cbx').addEventListener('change', (e) => {
    settings.colorblind = e.target.checked;
    applyPalette();
    saveSettings();
  });
  sens.addEventListener('input', () => {
    settings.sensitivity = Number(sens.value);
    card.querySelector('#sensv').textContent = settings.sensitivity.toFixed(1);
    saveSettings();
  });
}

// ---------------------------------------------------------------- key rebinding (Ticket-04 §4)
function showKeys() {
  const dups = duplicateKeys();
  const dupIds = new Set(dups.flat());
  const label = (id) => ACTIONS.find((a) => a[0] === id)[1];
  const rows = ACTIONS.map(([id, text]) => `<tr class="${dupIds.has(id) ? 'dup' : ''}"><td>${text}</td><td><button data-act="${id}">${capture === id ? 'Nhấn phím…' : keyName(settings.keys[id])}</button></td></tr>`).join('');
  const warn = dups.length ? `<p class="err">Trùng phím: ${dups.map((ids) => `<b>${keyName(settings.keys[ids[0]])}</b> đang dùng cho ${ids.map(label).join(' và ')}`).join('; ')}. Hãy đổi một trong số đó.</p>` : '<p style="opacity:.75">Bấm vào một phím để đổi, rồi nhấn phím mới.</p>';
  show(`<h1>Đổi phím</h1><table class="keys">${rows}</table>${warn}`, [['Xong', () => showSettings(backFromSettings)], ['Khôi phục mặc định', () => {
    settings.keys = { ...DEFAULT_KEYS };
    saveSettings();
    showKeys();
  }]]);
  overlayDefault = null;
  card.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    capture = b.dataset.act;
    b.textContent = 'Nhấn phím…';
    b.blur();
  }));
  document.getElementById('kDash').textContent = K('dash');
  document.getElementById('kPulse').textContent = K('pulse');
}

// ---------------------------------------------------------------- leaderboard (Ticket-04 §3)
// Saved on disk by server.js (data/leaderboard.json); falls back to localStorage on a static host.
async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (r.ok) return (await r.json()).entries;
  } catch {}
  try {
    return JSON.parse(localStorage.getItem('ddl-board') || '{"entries":[]}').entries;
  } catch {
    return [];
  }
}
async function saveScore(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return await r.json();
    if (r.status === 400) throw new Error((await r.json()).error);
  } catch (e) {
    if (e.message && !/fetch|network/i.test(e.message)) throw e;
  }
  const res = addEntry(await loadBoard(), entry); // offline: browser storage
  try {
    localStorage.setItem('ddl-board', JSON.stringify({ entries: res.entries }));
  } catch {}
  return res;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
async function showBoard(back, highlight = null) {
  const entries = await loadBoard();
  const rows = entries.map((e, i) => `<tr class="${highlight === i + 1 ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('');
  show(`<h1>Bảng xếp hạng</h1>${entries.length ? `<table class="board"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Thời điểm</th></tr>${rows}</table>` : '<p>Chưa có ai. Hãy là người đầu tiên!</p>'}`, [['Về menu', back || showMenu]]);
}
/** Name entry shown after the dawn screen or after losing any night. */
function scoreForm(prefixHtml, buttons) {
  const won = campaign.won.filter(Boolean).length;
  const form = campaign.saved
    ? '<p>Đã lưu điểm vào bảng xếp hạng.</p>'
    : `<p>Lưu điểm (${total()} điểm, ${won} Đêm thắng): <input id="pname" type="text" maxlength="12" placeholder="Tên 3–12 ký tự" autocomplete="off"></p><p id="perr" class="err"></p>`;
  const save = async () => {
    const el = card.querySelector('#pname');
    if (!el) return;
    const name = normalizeName(el.value);
    if (!NAME_RE.test(name)) {
      card.querySelector('#perr').textContent = 'Tên cần 3–12 ký tự: chữ (có thể có dấu), số hoặc _.';
      return;
    }
    try {
      const r = await saveScore({ name, score: total(), nights_won: won, achieved_at: isoLocal(), seed: campaign.seed ?? 0 });
      campaign.saved = true;
      showBoard(showMenu, r.rank);
    } catch (e) {
      card.querySelector('#perr').textContent = e.message;
    }
  };
  show(prefixHtml + form, campaign.saved ? buttons : [['Lưu điểm', save], ...buttons]);
  if (!campaign.saved) setTimeout(() => card.querySelector('#pname')?.focus(), 0);
}

function onGameOver({ result, reason }) {
  mode = 'result';
  stopMusic();
  keys.clear();
  if (result === 'won') {
    sfx.win();
    campaign.scores[night - 1] = w.score;
    campaign.won[night - 1] = true;
    if (night === 3) return showDawn();
    show(`<h2>Đêm ${night} · ${w.map.name}</h2><h1>Bình minh tới, đảo vẫn sáng!</h1><p>${w.lanterns.filter((l) => l.lit).length}/${w.lanterns.length} Đèn Lồng Lớn còn cháy lúc trời sáng.</p><p class="score">Điểm đêm: ${w.score}</p><p>Tổng điểm: <b>${total()}</b></p>`, [
      [`Đêm ${night + 1} →`, () => showIntro(night + 1)],
      ['Về menu', showMenu],
    ]);
  } else {
    sfx.lose();
    const why = { dawn: `Bình minh tới nhưng chỉ còn ${w.lanterns.filter((l) => l.lit).length} đèn sáng (cần ${winNeed(w)}).`, no_flames: 'Mây đã hết Ngọn Lửa.' }[reason];
    scoreForm(`<h2>Đêm ${night} · ${w.map.name}</h2><h1>Thua rồi</h1><p>${why}</p><p class="score">Điểm đêm: ${w.score} (không tính)</p>`, [
      ['Chơi lại Đêm', () => startNight(night)],
      ['Về menu', showMenu],
    ]);
  }
}

function showDawn() {
  mode = 'dawn';
  scoreForm(`<h1>Bình Minh</h1><p class="quote">“Ba hòn đảo đã sáng đèn. Cảm ơn cháu, Mây.”<br>— Ông Đăng</p>
    <p>Đêm 1: ${campaign.scores[0]} · Đêm 2: ${campaign.scores[1]} · Đêm 3: ${campaign.scores[2]}</p><p class="score">Tổng điểm: ${total()}</p>`, [['Bảng xếp hạng', () => showBoard(showMenu)], ['Về menu', showMenu]]);
}

// ---------------------------------------------------------------- events -> audio / effects
let lastSec = Infinity;
function handleEvents() {
  for (const e of w.events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_out': sfx.lose(); break;
      case 'refuel': sfx.deposit(); break;
      case 'lantern_lit': sfx.lantern(); flash.style.opacity = 0.8; setTimeout(() => (flash.style.opacity = 0), 200); break;
      case 'pulse':
        sfx.pulse();
        pulseT = 0;
        flash.style.opacity = 1;
        setTimeout(() => (flash.style.opacity = 0), 120);
        break;
      case 'player_hit':
        sfx.hit();
        hurt.style.opacity = 1;
        setTimeout(() => (hurt.style.opacity = 0), 350);
        if (!settings.reduceMotion) shakeT = 0.35;
        break;
      case 'dash': sfx.dash(); break;
      case 'shade_spawned':
        sfx.shade();
        caption('⚠ Bóng Mực xuất hiện', 'shade');
        shadeAlerts.set(e.data.id, performance.now() + 3500);
        break;
      case 'drifter_steal': sfx.steal(); break;
      case 'drifter_drop': sfx.pickup(); break;
      case 'charm_picked': sfx.charm(); break;
      case 'game_over': onGameOver(e.data); break;
    }
  }
  w.events.length = 0;
}

// ---------------------------------------------------------------- sync sim -> scene
const tmpV = new THREE.Vector3();
function sync(time, dtReal) {
  const p = w.player;
  playerMesh.position.set(p.x, p.y, p.z);
  playerMesh.visible = !(p.invuln > 0 && !params.has('god') && Math.floor(time * 12) % 2 === 0) && p.dead === 0;
  playerMesh.rotation.y = Math.atan2(p.fx, p.fz);

  ensurePools(Math.max(w.motes.length, w.shades.length));

  // motes (instanced): bobbing; dropped motes blink in their last 2 s
  let nm = 0;
  for (const m of w.motes) {
    if (m.kind === 'dropped' && m.ttl < 120 && Math.floor(time * 8) % 2 === 0) continue;
    _m.makeTranslation(m.x, m.y + 0.6 + Math.sin(time * 3 + m.x) * 0.15, m.z);
    inst.moteCore.setMatrixAt(nm, _m);
    inst.moteHalo.setMatrixAt(nm, _m);
    nm++;
  }
  inst.moteCore.count = inst.moteHalo.count = nm;
  inst.moteCore.instanceMatrix.needsUpdate = inst.moteHalo.instanceMatrix.needsUpdate = true;

  // shades (instanced): body + outline + eyes facing Mây; drain beams in one LineSegments
  const edgeHex = shadeEdgeHex();
  const beamPos = inst.beams.geometry.attributes.position;
  let ns = 0, nb = 0;
  for (const s of w.shades) {
    const k = s.state === 'spawning' ? Math.max(0.001, 1 - s.t / W.shade_spawning_ticks) : 1;
    _p.set(s.x, s.y + Math.sin(time * 4 + s.x) * 0.1, s.z);
    _q.setFromAxisAngle(UP, Math.atan2(p.x - s.x, p.z - s.z));
    const stun = s.state === 'stunned';
    inst.shadeBody.setMatrixAt(ns, _m.compose(_p, _q, _s.setScalar(k)));
    inst.shadeBody.setColorAt(ns, _c.setHex(stun ? C.shadeStun : C.shadeBody));
    inst.shadeEdge.setMatrixAt(ns, _m.compose(_p, _q, _s.setScalar(k * 1.12)));
    inst.shadeEdge.setColorAt(ns, _c.setHex(stun ? C.shadeStun : edgeHex));
    for (const side of [1, -1]) {
      _e.set(0.22 * side * k, 0.15 * k, 0.62 * k).applyQuaternion(_q).add(_p);
      inst.shadeEyes.setMatrixAt(ns * 2 + (side > 0 ? 0 : 1), _m.compose(_e, _q, _s.setScalar(k)));
      inst.shadeEyes.setColorAt(ns * 2 + (side > 0 ? 0 : 1), _c.setHex(edgeHex));
    }
    ns++;
    if (s.state === 'drain' && s.target) {
      beamPos.setXYZ(nb * 2, s.x, s.y, s.z);
      beamPos.setXYZ(nb * 2 + 1, s.target.x, s.target.y + 3.4, s.target.z);
      nb++;
    }
  }
  inst.shadeBody.count = inst.shadeEdge.count = ns;
  inst.shadeEyes.count = ns * 2;
  for (const k of ['shadeBody', 'shadeEdge', 'shadeEyes']) {
    inst[k].instanceMatrix.needsUpdate = true;
    if (inst[k].instanceColor) inst[k].instanceColor.needsUpdate = true;
  }
  beamPos.needsUpdate = true;
  inst.beams.geometry.setDrawRange(0, nb * 2);
  inst.beams.material.color.setHex(edgeHex);
  inst.beams.material.opacity = 0.5 + 0.4 * Math.sin(time * 12);

  // drifters
  for (const d of w.drifters) {
    let g = meshes.drifters.get(d.id);
    if (!g) {
      g = makeDrifter();
      meshes.drifters.set(d.id, g);
    }
    g.visible = d.state !== 'removed';
    g.position.set(d.x, d.y + Math.sin(time * 5 + d.x) * 0.2, d.z);
    g.rotation.y = time * (d.state === 'chase' ? 6 : 2);
    g.userData.tube.material.opacity = d.state === 'flee' ? 0.45 : 0.85;
  }

  // charms
  for (const c of w.charms) {
    let g = meshes.charms.get(c.id);
    if (!g) {
      g = makeCharm();
      meshes.charms.set(c.id, g);
    }
    g.visible = c.available;
    g.position.set(c.x, c.y + 1 + Math.sin(time * 2) * 0.15, c.z);
    g.rotation.y = time * 1.5;
  }

  // lanterns + ambient progress: intensity = 0.15 + 0.55 * lit / total
  let lit = 0;
  for (const l of w.lanterns) {
    const m = meshes.lanterns.get(l.id);
    const k = l.lit ? 1 : l.deposited / lightCost(l);
    if (l.lit) lit++;
    const fuel = l.fuel / 60;
    // low fuel (< 30): lantern + bar blink slowly at 1 Hz
    const blinkOff = l.lit && fuel < T.low_fuel_threshold && Math.floor(time * 2) % 2 === 1;
    m.light.intensity = l.lit ? (blinkOff ? 12 : 30 + 30 * Math.min(1, fuel / 50)) : k * 8;
    m.bar.visible = l.lit;
    m.bar.quaternion.copy(camera.quaternion);
    m.barFill.scale.x = Math.max(0.001, fuel / 100);
    m.barFill.position.x = -0.75 * (1 - fuel / 100);
    m.barFill.material.color.setHex(fuel < T.low_fuel_threshold ? (settings.colorblind ? 0xffffff : C.danger) : C.lit);
    m.barFill.visible = !blinkOff;
    // colour-blind mode: unlit lanterns are squashed 20% and torn
    const squash = settings.colorblind && !l.lit;
    m.head.scale.set(1, squash ? 0.8 : 1, 1);
    m.tear.visible = squash;
    m.head.material.color.setHex(l.lit ? C.lit : C.off);
    m.head.material.emissive.setHex(l.lit ? C.lit : 0x000000);
    m.head.material.emissiveIntensity = l.lit ? (blinkOff ? 0.15 : 0.7) : 0;
    m.core.material.color.setHex(l.lit ? C.core : k > 0 ? C.lit : C.off);
    m.ring.material.opacity = l.lit && fuel >= T.low_fuel_threshold ? 0.45 + Math.sin(time * 2) * 0.1 : 0; // zone only while fuel >= 30
  }
  const prog = lit / w.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * prog;
  scene.background.setHex(C.night).lerp(new THREE.Color(C.mist), prog);
  if (mode === 'dawn') {
    scene.background.setHex(0xf6b07a);
    ambient.intensity = 1.2;
  }
  document.body.classList.toggle('nohud', mode === 'menu' || mode === 'intro' || mode === 'dawn');

  if (pulseT < 1) {
    pulseT = Math.min(1, pulseT + dtReal * 3);
    pulseRing.position.set(p.x, p.y + 0.1, p.z);
    pulseRing.scale.setScalar(T.pulse_radius * pulseT);
    pulseRing.material.opacity = 1 - pulseT;
  } else pulseRing.material.opacity = 0;

  for (const o of level.children) if (o.userData.spin) o.rotation.z = time;

  // wind leaves (warning 2 s before, then during the gust)
  const windy = w.windEnabled && (w.wind.warn || w.wind.active);
  leaves.visible = windy;
  if (windy) {
    const a = (w.wind.dir_deg * Math.PI) / 180;
    const sp = w.wind.active ? 9 : 4;
    leafState.forEach((L, i) => {
      L.x += Math.cos(a) * sp * dtReal;
      L.z += Math.sin(a) * sp * dtReal;
      if (Math.hypot(L.x - p.x, L.z - p.z) > 16 || L.y === 0) {
        const r = 4 + ((i * 7.3) % 12), b = a + Math.PI + (((i * 2.39) % 2) - 1);
        L.x = p.x + Math.cos(b) * r;
        L.z = p.z + Math.sin(b) * r;
        L.y = p.y + 0.5 + ((i * 1.7) % 4);
      }
      tmpE.set(time * 3 + L.ph, time * 2 + L.ph, 0);
      tmpM.compose(tmpV.set(L.x, L.y + Math.sin(time * 4 + L.ph) * 0.3, L.z), tmpQ.setFromEuler(tmpE), ONE);
      leaves.setMatrixAt(i, tmpM);
    });
    leaves.instanceMatrix.needsUpdate = true;
  }

  // third-person camera behind Mây along the camera yaw
  camYawShown += (camYaw - camYawShown) * Math.min(1, dtReal * 10);
  const th = (camYawShown * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  tmpV.set(p.x - fx * 9, Math.max(p.y, -2) + 5.5, p.z - fz * 9);
  camera.position.lerp(tmpV, Math.min(1, dtReal * 8));
  camera.lookAt(p.x, Math.max(p.y, -2) + 1.3, p.z);
  if (shakeT > 0 && !settings.reduceMotion) {
    shakeT -= dtReal;
    camera.position.x += (Math.random() - 0.5) * 0.5 * shakeT;
    camera.position.y += (Math.random() - 0.5) * 0.5 * shakeT;
  }
}
let shakeT = 0;

// ---------------------------------------------------------------- captions / visual cues (Ticket-04 §4)
const captionsEl = document.getElementById('captions');
function caption(text, kind = '') {
  if (!settings.captions || mode === 'bench') return;
  const d = document.createElement('div');
  d.textContent = text;
  d.className = kind;
  captionsEl.appendChild(d);
  while (captionsEl.children.length > 4) captionsEl.firstChild.remove();
  setTimeout(() => d.remove(), 3500);
}
const shadeAlerts = new Map(); // shade id -> time until which an edge arrow points at it
const shadeArrowEls = [];
const cueState = { warn: false, last10: false, low: new Set() };
function visualCues() {
  if (!w || mode !== 'playing') return;
  if (w.windEnabled && w.wind.warn && !w.wind.active && !cueState.warn) caption('🍃 Gió sắp thổi');
  cueState.warn = w.wind.warn && !w.wind.active;
  const tl = timeLeft(w);
  if (tl <= 10 && !cueState.last10) caption('⏳ 10 giây cuối tới bình minh', 'warn');
  cueState.last10 = tl <= 10;
  for (const l of w.lanterns) {
    const low = l.lit && l.fuel < T.low_fuel_threshold * 60;
    if (low && !cueState.low.has(l.id)) caption(`🏮 Đèn ${l.id} sắp cạn dầu (< ${T.low_fuel_threshold})`, 'warn');
    if (low) cueState.low.add(l.id);
    else cueState.low.delete(l.id);
  }
  // edge arrows towards shades that just appeared
  const now = performance.now();
  let n = 0;
  for (const [id, until] of shadeAlerts) {
    if (now > until) {
      shadeAlerts.delete(id);
      continue;
    }
    const s = w.shades.find((x) => x.id === id);
    if (!s || !settings.captions) continue;
    const el = shadeArrowEls[n] || (shadeArrowEls[n] = Object.assign(document.createElement('div'), { className: 'arrow shade' }));
    if (!el.parentNode) document.getElementById('shadeArrows').appendChild(el);
    placeEdgeArrow(el, s.x, s.y, s.z, true);
    n++;
  }
  for (let i = n; i < shadeArrowEls.length; i++) shadeArrowEls[i].style.display = 'none';
}
/** Point an arrow element at a world position from the screen edge (always=true: even when on screen). */
function placeEdgeArrow(el, x0, y0, z0, always = false) {
  tmpV.set(x0, y0, z0).project(camera);
  const behind = tmpV.z > 1;
  let { x, y } = tmpV;
  if (behind) {
    x = -x;
    y = -y;
  }
  const off = behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.95;
  if (!off && !always) {
    el.style.display = 'none';
    return false;
  }
  const ang = Math.atan2(y, x);
  const k = 0.78 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
  const sx = (Math.cos(ang) * k * 0.5 + 0.5) * innerWidth, sy = (-Math.sin(ang) * k * 0.5 + 0.5) * innerHeight;
  Object.assign(el.style, { display: 'block', position: 'fixed', left: `${sx - 14}px`, top: `${sy - 15}px`, transform: `rotate(${Math.PI / 2 - ang}rad)` });
  return true;
}

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const hud = { flames: $('flames'), timer: $('timer'), tr: $('topright'), bar: $('bar'), dash: $('cdDash'), pulse: $('cdPulse'), prompt: $('prompt'), arrow: $('arrow'), charm: $('charm'), wind: $('windwarn'), fps: $('fps') };
hud.bar.innerHTML = '<i></i>'.repeat(T.capacity_max) + '<b id="capTxt"></b>';
const barCells = [...hud.bar.querySelectorAll('i')];
const capTxt = document.getElementById('capTxt');
const cache = {};
const setHTML = (el, key, html) => {
  if (cache[key] !== html) {
    cache[key] = html;
    el.innerHTML = html;
  }
};
function drawHud() {
  const p = w.player;
  setHTML(hud.flames, 'f', Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">🔥</span>`).join(''));
  const tl = Math.ceil(timeLeft(w) - 1e-9);
  setHTML(hud.timer, 't', `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`);
  hud.timer.classList.toggle('danger', tl <= 30);
  if (settings.colorblind && tl <= 30) setHTML(hud.timer, 't', `⚠ ${hud.timer.textContent.replace('⚠ ', '')}`);
  if (mode === 'playing' && tl <= 10 && tl < lastSec && tl > 0) sfx.tick();
  lastSec = tl;
  const lit = w.lanterns.filter((l) => l.lit).length;
  const need = winNeed(w);
  setHTML(hud.tr, 'tr', `Đèn sáng <b class="${lit < need ? 'short' : ''}">${lit}/${w.lanterns.length}</b> <small>(cần ${need})</small><br>Điểm <b>${w.score}</b>${total() ? `<br><small>Tổng ${total() + 0}</small>` : ''}`);
  const cap = capacity(p);
  barCells.forEach((c, i) => {
    c.classList.toggle('on', i < p.carried);
    c.style.display = i < cap ? '' : 'none';
  });
  capTxt.textContent = `${p.carried}/${cap}`;
  const dp = p.charm > 0 ? 1 : 1 - p.dashCd / DASH_CD;
  hud.dash.style.setProperty('--p', dp);
  hud.dash.classList.toggle('ready', dp >= 1);
  const pp = 1 - p.pulseCd / PULSE_CD;
  hud.pulse.style.setProperty('--p', pp);
  hud.pulse.classList.toggle('ready', pp >= 1 && p.carried >= T.pulse_cost);
  hud.charm.style.display = p.charm > 0 ? 'block' : 'none';
  if (p.charm > 0) setHTML(hud.charm, 'c', `🧧 Bùa Gió ${(p.charm / 60).toFixed(0)}s`);
  hud.wind.style.display = w.windEnabled && w.wind.warn && !w.wind.active ? 'block' : 'none';

  // prompt near an unlit lantern
  const near = w.lanterns.filter((l) => (!l.lit || l.fuel < 6000) && Math.hypot(l.x - p.x, l.z - p.z) <= T.interact_radius).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  hud.prompt.style.display = near ? 'block' : 'none';
  if (near) setHTML(hud.prompt, 'pr', near.lit ? `<kbd>${K('interact')}</kbd> — Châm dầu (${Math.floor(near.fuel / 60)}/100)` : `<kbd>${K('interact')}</kbd> — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${lightCost(near)})`);

  // arrow to the nearest unlit lantern when it is off-screen
  const target = w.lanterns.filter((l) => !l.lit || l.fuel < T.low_fuel_threshold * 60).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  let showArrow = false;
  if (target) {
    tmpV.set(target.x, target.y + 3.4, target.z).project(camera);
    const behind = tmpV.z > 1;
    let { x, y } = tmpV;
    if (behind) {
      x = -x;
      y = -y;
    }
    if (behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.95) {
      showArrow = true;
      const ang = Math.atan2(y, x);
      const k = 0.78 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
      const sx = (Math.cos(ang) * k * 0.5 + 0.5) * innerWidth, sy = (-Math.sin(ang) * k * 0.5 + 0.5) * innerHeight;
      hud.arrow.style.left = `${sx - 14}px`;
      hud.arrow.style.top = `${sy - 15}px`;
      hud.arrow.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    }
  }
  hud.arrow.style.display = showArrow ? 'block' : 'none';
}

// ---------------------------------------------------------------- main loop: fixed 60 Hz sim, render every frame
let last = performance.now();
let acc = 0;
const fpsLog = [];
const bench = [];
function frame(now) {
  const dtRaw = now - last;
  const dtReal = Math.min(0.25, dtRaw / 1000);
  last = now;
  if (mode === 'bench') benchFrame(now, dtRaw);
  if (mode === 'playing') {
    const input = readInput(dtReal);
    if (params.has('demo')) {
      // FPS benchmark: run in a wide circle, camera turning
      camYaw += 25 * dtReal;
      Object.assign(input, { move: [0.35, 1], cam_yaw_deg: camYaw });
    }
    const wasGrounded = w.player.grounded;
    acc += dtReal;
    while (acc >= DT && mode === 'playing') {
      step(w, input);
      if (wasGrounded && !w.player.grounded && w.player.vy > 0 && !w.player.launch) sfx.jump();
      handleEvents();
      acc -= DT;
    }
  }
  if (w) {
    const tA = performance.now();
    sync(now / 1000, dtReal);
    const tB = performance.now();
    if (mode === 'bench') {
      const [cx, cy, cz] = benchCamera((now - benchState.t0) / 1000);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);
    }
    const t1 = performance.now();
    drawHud();
    visualCues();
    benchState.lastParts = { late: Math.round((tA - now) * 10) / 10, sync: Math.round((tB - tA) * 10) / 10, hud: Math.round((performance.now() - t1) * 10) / 10 };
  }
  const t2 = performance.now();
  renderer.render(scene, camera);
  if (benchState.lastParts) benchState.lastParts.render = Math.round((performance.now() - t2) * 10) / 10;
  fpsLog.push(now);
  while (fpsLog.length && fpsLog[0] < now - 2000) fpsLog.shift();
  window.__fps = fpsLog.length / 2;
  if (params.has('fpsreport')) {
    // average FPS between 3 s and 13 s after load, written to the title for headless measurement
    const t = now / 1000;
    if (t > 3 && t <= 13) bench.push(dtReal);
    if (t > 13 && !bench.done) {
      bench.done = true;
      const avg = bench.length / bench.reduce((a, b) => a + b, 0);
      const worst = 1 / Math.max(...bench);
      document.title = `FPS avg ${avg.toFixed(1)} min ${worst.toFixed(1)} slow(<30fps) ${bench.filter((d) => d > 1 / 30).length} frames ${bench.length} ${renderer.getContext().getParameter(renderer.getContext().VERSION)}`;
    }
  }
  if (params.has('fps')) hud.fps.textContent = `${window.__fps.toFixed(0)} FPS`;
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- benchmark scene (Ticket-04 §1)
// ?bench&seed=42&duration=30 : Night 1, 200 wandering shades, 100 motes, L1-L3 lit, no input, camera orbit.
// 3 s warm-up, then every frame time is recorded for duration s; the result is left in window.__benchResult.
const benchState = { t0: 0, acc: 0, dts: [], done: false, firstFrameEpoch: 0 };
function benchFrame(now, dtRaw) {
  if (!benchState.t0) {
    benchState.t0 = now;
    benchState.firstFrameEpoch = performance.timeOrigin + now;
    window.__benchFirstFrame = benchState.firstFrameEpoch;
    return;
  }
  benchState.acc += Math.min(0.25, dtRaw / 1000);
  const ts0 = performance.now();
  let steps = 0;
  while (benchState.acc >= DT) {
    steps++;
    step(w, { move: [0, 0], cam_yaw_deg: 0 });
    w.events.length = 0;
    benchState.acc -= DT;
  }
  const t = (now - benchState.t0) / 1000;
  const duration = Number(params.get('duration') || 30);
  window.__benchPhase = t < BENCH.warmupS ? 'warmup' : t < BENCH.warmupS + duration ? 'measure' : 'done';
  if (window.__benchPhase === 'measure') {
    benchState.dts.push(dtRaw);
    (benchState.prof ||= []).push({ dt: Math.round(dtRaw * 10) / 10, steps, simMs: Math.round((performance.now() - ts0) * 10) / 10, prev: benchState.lastParts });
  }
  if (window.__benchPhase === 'done' && !benchState.done) {
    benchState.done = true;
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = {
      ...benchStats(benchState.dts),
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl: gl.getParameter(gl.VERSION),
      three: THREE.REVISION,
      user_agent: navigator.userAgent,
      viewport: `${innerWidth}x${innerHeight}@${renderer.getPixelRatio()}`,
      shades: w.shades.length,
      motes: w.motes.length,
      lit: w.lanterns.filter((l) => l.lit).map((l) => l.id),
      worst: (benchState.prof || []).sort((a, b) => b.dt - a.dt).slice(0, 12),
    };
    document.title = 'BENCH DONE';
  }
}

// ---------------------------------------------------------------- boot (URL params make screenshots reproducible)
// ?autostart&night=N&seed=S&lit=K&t=TICKS   ·   ?screen=menu|intro|pause|settings|result|dawn
const qNight = Number(params.get('night') || 1);
if (params.has('bench')) {
  w = createBenchWorld(Number(params.get('seed') || 42));
  buildLevel(w.map);
  buildLanterns();
  warmUpShaders();
  mode = 'bench';
  hideOverlay();
} else if (params.has('autostart') || ['pause', 'settings', 'result'].includes(params.get('screen'))) {
  const litN = Number(params.get('lit') || 0);
  const scenario = litN ? { lanterns: NIGHTS[qNight].lanterns.slice(0, litN).map((_, i) => ({ id: `L${i + 1}`, lit: true })) } : {};
  if (params.has('carried') || params.has('pos')) scenario.player = {};
  if (params.has('carried')) scenario.player.carried = Number(params.get('carried'));
  if (params.has('pos')) scenario.player.pos = params.get('pos').split(',').map(Number);
  if (params.has('demo')) scenario.player = { ...scenario.player, flames: 99999, carried: 0 }; // benchmark never ends
  if (params.has('god')) scenario.player = { ...scenario.player, invuln_ticks: 1e6 }; // screenshots only
  startNight(qNight, scenario);
  for (let i = 0, n = Number(params.get('t') || 0); i < n && w.state === 'playing'; i++) {
    step(w, { move: [0, 0], cam_yaw_deg: 0 });
    w.events.length = 0;
  }
  if (params.has('yaw')) camYaw = camYawShown = Number(params.get('yaw'));
  sync(0, 1);
  const scr = params.get('screen');
  if (scr === 'pause') pauseGame();
  if (scr === 'settings') showSettings(pauseGame);
  if (scr === 'result') {
    w.score = 1414;
    campaign.scores[0] = 1414;
    onGameOver({ result: 'won', reason: 'all_lit' });
  }
} else {
  w = createWorld(1, {}, qNight);
  buildLevel(w.map);
  buildLanterns();
  const scr = params.get('screen');
  if (scr === 'intro') showIntro(qNight);
  else if (scr === 'board') showBoard(showMenu);
  else if (scr === 'keys') {
    if (params.has('dup')) settings.keys.jump = settings.keys.interact; // screenshot of the duplicate warning (not saved)
    showKeys();
  } else if (scr === 'save') {
    campaign = { ...newCampaign(), scores: [612, 0, 0], won: [true, false, false], seed: 42 };
    night = 2;
    onGameOver({ result: 'lost', reason: 'no_flames' });
  }
  else if (scr === 'dawn') {
    campaign.scores = [1414, 1414, 1524];
    showDawn();
  } else showMenu();
}
requestAnimationFrame(frame);
