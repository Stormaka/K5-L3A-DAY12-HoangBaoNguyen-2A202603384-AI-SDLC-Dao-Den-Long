// 3D client. All gameplay comes from src/sim (same code as headless); this file only renders + reads input.
import * as THREE from 'three';
import { createWorld, step, timeLeft } from '/src/sim/world.js';
import { TUNING as T, WORLD as W, DT } from '/src/sim/config.js';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const DARK = new THREE.Color(0x0b0714);
scene.background = DARK.clone();
scene.fog = new THREE.Fog(0x120a1f, 18, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ambient = new THREE.HemisphereLight(0x7a6aaa, 0x2a1838, 0.6);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x8f8fff, 0.25);
moon.position.set(-20, 40, -10);
scene.add(moon);

// island + sea of clouds
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(W.island_radius, W.island_radius - 3, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2c3b2f, roughness: 1 }),
);
island.position.y = -2;
scene.add(island);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: 0x2a2040, roughness: 1 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -5;
scene.add(clouds);

const mat = (color, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.8 });

// Mây: body, head, conical hat (nón lá) with a small hanging lantern
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 12), mat(0x3d4f8f));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xf1c9a0));
  head.position.y = 1.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 20), mat(0xe2c27a));
  hat.position.y = 1.72;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xffc25a, 0xffa030, 2));
  lamp.position.set(0.55, 1.35, 0.3);
  const light = new THREE.PointLight(0xffb050, 6, 9, 1.6);
  light.position.copy(lamp.position);
  g.add(body, head, hat, lamp, light);
  return g;
}
const playerMesh = makePlayer();
scene.add(playerMesh);

// ---------- game state ----------
let w;
const meshes = { shades: new Map(), motes: new Map(), lanterns: new Map() };
let mode = 'title'; // title | playing | over

function clearMeshes() {
  for (const m of [...meshes.shades.values(), ...meshes.motes.values()]) scene.remove(m);
  meshes.shades.clear();
  meshes.motes.clear();
  for (const l of meshes.lanterns.values()) scene.remove(l.group);
  meshes.lanterns.clear();
}

// URL params (for reproducible screenshots): ?autostart&seed=N&lit=K (pre-lights K lanterns via scenario)
const params = new URLSearchParams(location.search);
function newGame() {
  clearMeshes();
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0x7fffffff) >>> 0;
  const litN = Number(params.get('lit') || 0);
  const scenario = litN ? { lanterns: w.lanterns.slice(0, litN).map((l) => ({ id: l.id, lit: true })) } : {};
  w = createWorld(seed, scenario);
  for (const l of w.lanterns) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), mat(0x4a3424));
    post.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), mat(0x2a2030));
    head.position.y = 3.4;
    const light = new THREE.PointLight(0xffa640, 0, 22, 1.4);
    light.position.y = 3.4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(post, head, light, ring);
    group.position.set(l.x, 0, l.z);
    scene.add(group);
    meshes.lanterns.set(l.id, { group, head, light, ring });
  }
  camYaw = 0;
  mode = 'playing';
  overlay.style.display = 'none';
}

// ---------- input ----------
const keys = new Set();
const btn = { jump: false, interact: false, pulse: false };
let camYaw = 0; // degrees, sent as cam_yaw_deg
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if ((mode === 'title' || mode === 'over') && (e.code === 'Enter' || e.code === 'KeyR')) newGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
addEventListener('mousedown', (e) => {
  if (e.button === 0) dragging = true;
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.3;
});

function readInput(dtReal) {
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYaw += 120 * dtReal;
  if (keys.has('ArrowRight') || keys.has('KeyC')) camYaw -= 120 * dtReal;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  // screen-right is -x in the contract's camera frame (camera looks along +z at yaw 0)
  const r = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  btn.jump = keys.has('Space');
  btn.interact = keys.has('KeyE');
  btn.pulse = keys.has('KeyF') || keys.has('ShiftLeft');
  return { move: [r, f], cam_yaw_deg: camYaw, ...btn };
}

// ---------- effects ----------
const flash = document.getElementById('flash');
const hurt = document.getElementById('hurt');
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 1;

function handleEvents() {
  for (const e of w.events) {
    if (e.name === 'pulse') {
      pulseT = 0;
      flash.style.opacity = 1;
      setTimeout(() => (flash.style.opacity = 0), 120);
    } else if (e.name === 'player_hit') {
      hurt.style.opacity = 1;
      setTimeout(() => (hurt.style.opacity = 0), 300);
    } else if (e.name === 'game_over') {
      mode = 'over';
      showOver(e.data);
    }
  }
  w.events.length = 0;
}

// ---------- sync sim -> meshes ----------
const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = mat(0xfff0a0, 0xffd040, 3);

function sync(time) {
  const p = w.player;
  playerMesh.position.set(p.x, p.y, p.z);
  const vis = p.invuln > 0 && Math.floor(time * 12) % 2 === 0;
  playerMesh.visible = !vis;

  for (const m of w.motes) {
    if (!meshes.motes.has(m.id)) {
      const mesh = new THREE.Mesh(moteGeo, moteMat);
      mesh.position.set(m.x, 0.6, m.z);
      scene.add(mesh);
      meshes.motes.set(m.id, mesh);
    }
  }
  const alive = new Set(w.motes.map((m) => m.id));
  for (const [id, mesh] of meshes.motes) {
    if (!alive.has(id)) {
      scene.remove(mesh);
      meshes.motes.delete(id);
    } else mesh.position.y = 0.6 + Math.sin(time * 3 + mesh.position.x) * 0.15;
  }

  for (const s of w.shades) {
    let mesh = meshes.shades.get(s.id);
    if (!mesh) {
      mesh = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0x1a0828, emissive: 0x5a1a8a, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }));
      scene.add(mesh);
      meshes.shades.set(s.id, mesh);
    }
    mesh.position.set(s.x, s.y + Math.sin(time * 4 + s.x) * 0.1, s.z);
    const stunned = s.state === 'stunned';
    mesh.material.opacity = stunned ? 0.35 : 0.9;
    mesh.material.emissive.setHex(stunned ? 0x8a7aa0 : 0x5a1a8a);
  }

  let lit = 0;
  for (const l of w.lanterns) {
    const m = meshes.lanterns.get(l.id);
    const k = l.lit ? 1 : l.deposited / T.lantern_cost;
    if (l.lit) lit++;
    m.light.intensity = l.lit ? 40 : k * 6;
    m.head.material.color.setHex(l.lit ? 0xffb347 : 0x2a2030);
    m.head.material.emissive.setHex(0xff9a30);
    m.head.material.emissiveIntensity = l.lit ? 1.5 : k * 0.6;
    m.ring.material.opacity = l.lit ? 0.35 : 0;
  }
  // island brightens as lanterns are lit
  const t = lit / T.lantern_count_night1;
  ambient.intensity = 0.6 + t * 0.9;
  scene.background.copy(DARK).lerp(new THREE.Color(0x3a2440), t);
  scene.fog.far = 70 + t * 60;

  if (pulseT < 1) {
    pulseT = Math.min(1, pulseT + 0.05);
    pulseRing.position.set(p.x, 0.1, p.z);
    pulseRing.scale.setScalar(T.pulse_radius * pulseT);
    pulseRing.material.opacity = 1 - pulseT;
  } else pulseRing.material.opacity = 0;

  // third-person camera behind the player along cam yaw
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  camera.position.set(p.x - fx * 9, p.y + 6, p.z - fz * 9);
  camera.lookAt(p.x, p.y + 1.2, p.z);
  playerMesh.rotation.y = th;
}

// ---------- HUD ----------
const hud = document.getElementById('hud');
const hint = document.getElementById('hint');
const overlay = document.getElementById('overlay');
const card = document.getElementById('card');
const controls = `<table>
  <tr><td><kbd>W A S D</kbd></td><td>Di chuyển</td></tr>
  <tr><td><kbd>Chuột kéo</kbd> / <kbd>Q</kbd> <kbd>C</kbd></td><td>Xoay camera</td></tr>
  <tr><td><kbd>Space</kbd></td><td>Nhảy</td></tr>
  <tr><td><kbd>E</kbd></td><td>Nạp đom đóm vào đèn</td></tr>
  <tr><td><kbd>F</kbd></td><td>Tỏa sáng xua Bóng Mực (tốn ${T.pulse_cost} đom đóm)</td></tr></table>`;
card.innerHTML = `<h1>Đảo Đèn Lồng</h1><p>Đêm 1 – Đảo Bến. Gom đom đóm, thắp lại ${T.lantern_count_night1} Đèn Lồng Lớn trước bình minh. Né Bóng Mực, chúng sợ ánh đèn.</p>${controls}<p><kbd>Enter</kbd> để bắt đầu</p>`;

function showOver({ result, reason }) {
  const why = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn: 'Bình minh tới mà đảo vẫn còn tối.', no_flames: 'Mây đã hết lửa.' }[reason];
  card.innerHTML = `<h1>${result === 'won' ? 'Chiến thắng!' : 'Thua rồi'}</h1><p>${why}</p><p style="font-size:22px">Điểm: <b>${w.score}</b></p><p><kbd>R</kbd> hoặc <kbd>Enter</kbd> để chơi lại</p>`;
  overlay.style.display = 'flex';
}

function drawHud() {
  const p = w.player;
  const lit = w.lanterns.filter((l) => l.lit).length;
  const tl = Math.ceil(timeLeft(w));
  const mm = String(Math.floor(tl / 60)).padStart(1, '0'), ss = String(tl % 60).padStart(2, '0');
  const pulse = p.pulseCd > 0 ? `${(p.pulseCd / 60).toFixed(1)}s` : p.carried >= T.pulse_cost ? 'sẵn sàng' : 'thiếu sáng';
  hud.innerHTML = `
    <div class="pill">Lửa <b>${'●'.repeat(p.flames)}${'○'.repeat(Math.max(0, T.flames - p.flames))}</b></div>
    <div class="pill">Đom đóm <b>${p.carried}/${T.carry_capacity}</b></div>
    <div class="pill">Đèn <b>${lit}/${T.lantern_count_night1}</b></div>
    <div class="pill">Còn <b>${mm}:${ss}</b></div>
    <div class="pill">Điểm <b>${w.score}</b></div>
    <div class="pill">Tỏa sáng <b>${pulse}</b></div>`;
  const near = w.lanterns.find((l) => !l.lit && Math.hypot(l.x - p.x, l.z - p.z) <= T.interact_radius);
  hint.textContent = near ? (p.carried > 0 ? `E: nạp ánh sáng vào đèn ${near.id} (${near.deposited}/${T.lantern_cost})` : `Đèn ${near.id} cần ${T.lantern_cost - near.deposited} đom đóm`) : '';
}

// ---------- main loop: fixed 60 Hz sim, render every frame ----------
w = createWorld(1);
newGame();
if (!params.has('autostart')) {
  mode = 'title';
  overlay.style.display = 'flex';
}
let last = performance.now(), acc = 0;
function frame(now) {
  const dtReal = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (mode === 'playing') {
    const input = readInput(dtReal);
    acc += dtReal;
    while (acc >= DT && mode === 'playing') {
      step(w, input);
      handleEvents();
      acc -= DT;
    }
  }
  sync(now / 1000);
  drawHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
