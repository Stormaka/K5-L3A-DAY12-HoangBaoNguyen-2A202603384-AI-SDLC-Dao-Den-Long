// 3D client. All gameplay comes from src/sim (same code as headless); this file renders,
// reads input, plays audio and runs the 3-night flow (menu -> intro -> play -> result -> dawn).
import * as THREE from 'three';
import { createWorld, step, timeLeft, PULSE_CD, DASH_CD } from '/src/sim/world.js';
import { TUNING as T, WORLD as W, DT } from '/src/sim/config.js';
import { NIGHTS } from '/src/sim/maps.js';
import { initAudio, setVolume, sfx, startMusic, stopMusic } from './audio.js';

// Standard palette (Ticket-02 Part 3)
const C = {
  night: 0x0e1430, mist: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drift: 0x8fa3b8, danger: 0xff5a5f, ui: 0xf5f1e6,
};
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- settings (persisted)
const settings = { volume: 0.7, sensitivity: 1 };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch {}
};
setVolume(settings.volume);

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
    group.add(post, head, core, light, ring);
    group.position.set(l.x, l.y, l.z);
    scene.add(group);
    meshes.lanterns.set(l.id, { group, head, core, light, ring });
  }
}

function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshLambertMaterial({ color: C.shadeBody, emissive: 0x05020a }));
  const edge = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: C.shadeEdge, side: THREE.BackSide }));
  edge.scale.setScalar(1.12);
  const eyeMat = basic(C.danger);
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeMat);
  const e2 = e1.clone();
  e1.position.set(0.22, 0.15, 0.62);
  e2.position.set(-0.22, 0.15, 0.62);
  g.add(body, edge, e1, e2);
  g.userData = { body, edge };
  scene.add(g);
  return g;
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
addEventListener('keydown', (e) => {
  initAudio();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return keys.add(e.code);
  keys.add(e.code);
  if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'playing' || mode === 'paused')) {
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
  if (keys.has('KeyQ') || keys.has('ArrowLeft')) camYaw += turn;
  if (keys.has('KeyC') || keys.has('ArrowRight')) camYaw -= turn;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  // screen-right is -x in the contract's camera frame (camera looks along +z at yaw 0)
  const r = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  return {
    move: [r, f],
    cam_yaw_deg: camYaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

// ---------------------------------------------------------------- flow: menu / intro / play / pause / result / dawn
let mode = 'menu';
let campaign = { scores: [0, 0, 0] };
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

const controls = `<table>
  <tr><td><kbd>W A S D</kbd></td><td>Di chuyển</td></tr>
  <tr><td><kbd>Chuột kéo</kbd> / <kbd>Q</kbd> <kbd>C</kbd></td><td>Xoay camera</td></tr>
  <tr><td><kbd>Space</kbd> · <kbd>Shift</kbd></td><td>Nhảy · Lướt</td></tr>
  <tr><td><kbd>E</kbd></td><td>Nạp đom đóm vào đèn (${T.lantern_cost}/đèn)</td></tr>
  <tr><td><kbd>F</kbd></td><td>Tỏa Sáng: xua Bóng Mực (tốn ${T.pulse_cost} đom đóm)</td></tr>
  <tr><td><kbd>Esc</kbd> / <kbd>P</kbd></td><td>Tạm dừng</td></tr></table>`;

function showMenu() {
  mode = 'menu';
  stopMusic();
  campaign = { scores: [0, 0, 0] };
  show(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Gom đom đóm, thắp lại Đèn Lồng Lớn, xua Bóng Mực cho tới khi trời sáng.</p>${controls}`, [
    ['Bắt đầu (Đêm 1)', () => showIntro(1)],
    ['Chơi Đêm 2', () => showIntro(2)],
    ['Chơi Đêm 3', () => showIntro(3)],
    ['Cài đặt', () => showSettings(showMenu)],
  ]);
}

function showIntro(n) {
  mode = 'intro';
  night = n;
  const m = NIGHTS[n];
  show(`<h2>Đêm ${n}</h2><h1>${m.name}</h1><p class="quote">“${m.intro}”<br>— Ông Đăng</p><p>${m.lanterns.length} Đèn Lồng Lớn · ${m.duration_s / 60 | 0}:${String(m.duration_s % 60).padStart(2, '0')} trước bình minh</p>`, [
    ['Vào đêm', () => startNight(n)],
    ['Về menu', showMenu],
  ]);
}

function startNight(n, scenario = {}) {
  night = n;
  clearEntities();
  w = createWorld(seed++, scenario, n);
  buildLevel(w.map);
  buildLanterns();
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
    <p style="font-size:13px;opacity:.7">Cài đặt được lưu lại cho lần mở sau.</p>`, [['Xong', () => backFromSettings()]]);
  const vol = card.querySelector('#vol'), sens = card.querySelector('#sens');
  vol.addEventListener('input', () => {
    settings.volume = Number(vol.value);
    card.querySelector('#volv').textContent = `${Math.round(settings.volume * 100)}%`;
    setVolume(settings.volume);
    saveSettings();
  });
  vol.addEventListener('change', () => sfx.pickup());
  sens.addEventListener('input', () => {
    settings.sensitivity = Number(sens.value);
    card.querySelector('#sensv').textContent = settings.sensitivity.toFixed(1);
    saveSettings();
  });
}

function onGameOver({ result, reason }) {
  mode = 'result';
  stopMusic();
  keys.clear();
  if (result === 'won') {
    sfx.win();
    campaign.scores[night - 1] = w.score;
    if (night === 3) return showDawn();
    show(`<h2>Đêm ${night} · ${w.map.name}</h2><h1>Đảo đã sáng!</h1><p>Mọi Đèn Lồng Lớn đã được thắp.</p><p class="score">Điểm đêm: ${w.score}</p><p>Tổng điểm: <b>${total()}</b></p>`, [
      [`Đêm ${night + 1} →`, () => showIntro(night + 1)],
      ['Về menu', showMenu],
    ]);
  } else {
    sfx.lose();
    const why = { dawn: 'Bình minh tới mà đảo vẫn còn tối.', no_flames: 'Mây đã hết Ngọn Lửa.' }[reason];
    show(`<h2>Đêm ${night} · ${w.map.name}</h2><h1>Thua rồi</h1><p>${why}</p><p class="score">Điểm đêm: ${w.score} (không tính)</p>`, [
      ['Chơi lại Đêm', () => startNight(night)],
      ['Về menu', showMenu],
    ]);
  }
}

function showDawn() {
  mode = 'dawn';
  show(`<h1>Bình Minh</h1><p class="quote">“Ba hòn đảo đã sáng đèn. Cảm ơn cháu, Mây.”<br>— Ông Đăng</p>
    <p>Đêm 1: ${campaign.scores[0]} · Đêm 2: ${campaign.scores[1]} · Đêm 3: ${campaign.scores[2]}</p><p class="score">Tổng điểm: ${total()}</p>`, [['Về menu', showMenu]]);
}

// ---------------------------------------------------------------- events -> audio / effects
let lastSec = Infinity;
function handleEvents() {
  for (const e of w.events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': sfx.lantern(); flash.style.opacity = 0.8; setTimeout(() => (flash.style.opacity = 0), 200); break;
      case 'pulse':
        sfx.pulse();
        pulseT = 0;
        flash.style.opacity = 1;
        setTimeout(() => (flash.style.opacity = 0), 120);
        break;
      case 'player_hit': sfx.hit(); hurt.style.opacity = 1; setTimeout(() => (hurt.style.opacity = 0), 350); break;
      case 'dash': sfx.dash(); break;
      case 'shade_spawned': sfx.shade(); break;
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
  playerMesh.visible = !(p.invuln > 0 && Math.floor(time * 12) % 2 === 0) && p.dead === 0;
  playerMesh.rotation.y = Math.atan2(p.fx, p.fz);

  // motes
  const alive = new Set();
  for (const m of w.motes) {
    alive.add(m.id);
    let g = meshes.motes.get(m.id);
    if (!g) {
      g = new THREE.Group();
      g.add(new THREE.Mesh(moteCoreGeo, moteCoreMat), new THREE.Mesh(moteHaloGeo, moteHaloMat));
      g.position.set(m.x, m.y + 0.6, m.z);
      scene.add(g);
      meshes.motes.set(m.id, g);
    }
    g.position.y = m.y + 0.6 + Math.sin(time * 3 + m.x) * 0.15;
    g.visible = !(m.kind === 'dropped' && m.ttl < 120 && Math.floor(time * 8) % 2 === 0);
  }
  for (const [id, g] of meshes.motes) if (!alive.has(id)) {
    scene.remove(g);
    meshes.motes.delete(id);
  }

  // shades
  for (const s of w.shades) {
    let g = meshes.shades.get(s.id);
    if (!g) {
      g = makeShade();
      meshes.shades.set(s.id, g);
    }
    g.position.set(s.x, s.y + Math.sin(time * 4 + s.x) * 0.1, s.z);
    g.lookAt(p.x, g.position.y, p.z);
    const stun = s.state === 'stunned';
    g.userData.body.material.color.setHex(stun ? C.shadeStun : C.shadeBody);
    g.userData.edge.material.color.setHex(stun ? C.shadeStun : C.shadeEdge);
    g.scale.setScalar(s.state === 'spawning' ? 1 - s.t / W.shade_spawning_ticks : 1);
  }

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
    const k = l.lit ? 1 : l.deposited / T.lantern_cost;
    if (l.lit) lit++;
    m.light.intensity = l.lit ? 60 : k * 8;
    m.head.material.color.setHex(l.lit ? C.lit : C.off);
    m.head.material.emissive.setHex(l.lit ? C.lit : 0x000000);
    m.head.material.emissiveIntensity = l.lit ? 0.7 : 0;
    m.core.material.color.setHex(l.lit ? C.core : k > 0 ? C.lit : C.off);
    m.ring.material.opacity = l.lit ? 0.45 + Math.sin(time * 2) * 0.1 : 0;
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
}

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const hud = { flames: $('flames'), timer: $('timer'), tr: $('topright'), bar: $('bar'), dash: $('cdDash'), pulse: $('cdPulse'), prompt: $('prompt'), arrow: $('arrow'), charm: $('charm'), wind: $('windwarn'), fps: $('fps') };
hud.bar.innerHTML = '<i></i>'.repeat(T.carry_capacity);
const barCells = [...hud.bar.children];
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
  if (mode === 'playing' && tl <= 10 && tl < lastSec && tl > 0) sfx.tick();
  lastSec = tl;
  const lit = w.lanterns.filter((l) => l.lit).length;
  setHTML(hud.tr, 'tr', `Đèn <b>${lit}/${w.lanterns.length}</b><br>Điểm <b>${w.score}</b>${total() ? `<br><small>Tổng ${total() + 0}</small>` : ''}`);
  barCells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
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
  const near = w.lanterns.filter((l) => !l.lit && Math.hypot(l.x - p.x, l.z - p.z) <= T.interact_radius).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  hud.prompt.style.display = near ? 'block' : 'none';
  if (near) setHTML(hud.prompt, 'pr', `<kbd>E</kbd> — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})`);

  // arrow to the nearest unlit lantern when it is off-screen
  const target = w.lanterns.filter((l) => !l.lit).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
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
  const dtReal = Math.min(0.25, (now - last) / 1000);
  last = now;
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
    sync(now / 1000, dtReal);
    drawHud();
  }
  renderer.render(scene, camera);
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
      document.title = `FPS avg ${avg.toFixed(1)} min ${worst.toFixed(1)} frames ${bench.length} ${renderer.getContext().getParameter(renderer.getContext().VERSION)}`;
    }
  }
  if (params.has('fps')) hud.fps.textContent = `${window.__fps.toFixed(0)} FPS`;
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot (URL params make screenshots reproducible)
// ?autostart&night=N&seed=S&lit=K&t=TICKS   ·   ?screen=menu|intro|pause|settings|result|dawn
const qNight = Number(params.get('night') || 1);
if (params.has('autostart') || ['pause', 'settings', 'result'].includes(params.get('screen'))) {
  const litN = Number(params.get('lit') || 0);
  const scenario = litN ? { lanterns: NIGHTS[qNight].lanterns.slice(0, litN).map((_, i) => ({ id: `L${i + 1}`, lit: true })) } : {};
  if (params.has('carried') || params.has('pos')) scenario.player = {};
  if (params.has('carried')) scenario.player.carried = Number(params.get('carried'));
  if (params.has('pos')) scenario.player.pos = params.get('pos').split(',').map(Number);
  if (params.has('demo')) scenario.player = { ...scenario.player, flames: 99999, carried: 0 }; // benchmark never ends
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
  else if (scr === 'dawn') {
    campaign.scores = [1414, 1414, 1524];
    showDawn();
  } else showMenu();
}
requestAnimationFrame(frame);
