// Standard maps for Nights 1-3 (Ticket-02, Part 2). Angles: from +X, counter-clockwise seen
// from above, i.e. angle a -> (r cos a, r sin a) on (x, z).
import { TUNING as T } from './config.js';

const rad = (d) => (d * Math.PI) / 180;
const q9 = (v) => {
  const r = Math.round(v * 1e9) / 1e9;
  return r === 0 ? 0 : r;
};
const ring = (r, n, start, step, y = 0, cx = 0) =>
  Array.from({ length: n }, (_, i) => [q9(cx + r * Math.cos(rad(start + i * step))), y, q9(r * Math.sin(rad(start + i * step)))]);
const NONE = -Infinity;
const EPS = 1e-9;

function pad(x, y, z, vy, speed, dirX, dirZ) {
  const l = Math.hypot(dirX, dirZ);
  return { x, y, z, vy, vx: (speed * dirX) / l, vz: (speed * dirZ) / l };
}

const night1 = {
  night: 1,
  name: 'Đảo Bến',
  intro: 'Đảo Bến chìm trong mực tối. Gom đom đóm, thắp lại năm Đèn Lồng Lớn trước khi trời sáng, cháu nhé.',
  duration_s: T.night1_duration_s,
  shade_speed: T.shade_speed,
  shade_every_ticks: 480,
  shade_max: 6,
  drifters: false,
  wind: false,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)],
  shadePoints: ring(37, 12, 15, 30),
  pads: [],
  charms: [],
  ground: (x, z) => (Math.hypot(x, z) <= 40 + EPS ? 0 : NONE),
  solid: () => false,
};

const onIsland2 = (x, z) => Math.hypot(x, z) <= 28 + EPS || Math.hypot(x - 70, z) <= 28 + EPS;
const night2 = {
  night: 2,
  name: 'Đảo Cau',
  intro: 'Hai hòn Đảo Cau nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng chỉ thèm đom đóm trong giỏ cháu thôi.',
  duration_s: T.night2_duration_s,
  shade_speed: T.shade_speed,
  shade_every_ticks: 420,
  shade_max: 8,
  drifters: true,
  wind: false,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [...ring(10, 4, 0, 90), ...ring(22, 8, 0, 45), ...ring(10, 4, 0, 90, 0, 70), ...ring(22, 8, 0, 45, 0, 70)],
  shadePoints: [...ring(26, 8, 22.5, 45), ...ring(26, 8, 22.5, 45, 0, 70)],
  pads: [pad(20, 0, 18, 14, 24, 70 - 20, 0 - 18), pad(50, 0, -18, 14, 24, 0 - 50, 0 + 18)],
  charms: [[35, 0, 0]],
  bridge: { x0: 26, x1: 44, z0: -2, z1: 2 },
  ground: (x, z) => (onIsland2(x, z) || (x >= 26 - EPS && x <= 44 + EPS && Math.abs(z) <= 2 + EPS) ? 0 : NONE),
  solid: () => false,
};

const RAMPS = [30, 150];
function ground3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45 + EPS) return NONE;
  if (r <= 8 + EPS) return 6;
  if (z > 0 && r >= 12 - EPS && r <= 24 + EPS) return 3;
  for (const a of RAMPS) {
    const ux = Math.cos(rad(a)), uz = Math.sin(rad(a));
    const t = x * ux + z * uz;
    const lat = -x * uz + z * ux;
    if (t >= 24 - EPS && t <= 30 + EPS && Math.abs(lat) <= 1.5 + EPS) return (3 * (30 - t)) / 6;
  }
  return 0;
}
const night3 = {
  night: 3,
  name: 'Đảo Chuông',
  intro: 'Đảo Chuông có ba tầng và gió rất mạnh. Lá bay là gió sắp tới, đứng vững nhé. Thắp đủ bảy ngọn đèn là trời sáng.',
  duration_s: T.night3_duration_s,
  shade_speed: 4.5,
  shade_every_ticks: 360,
  shade_max: 10,
  drifters: true,
  wind: true,
  start: [0, 0, -30], // A2-01: (0,0,0) is inside the bell tower on tier 2

  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(34, 18, 0, 20, 0), ...ring(18, 8, 20, 20, 3), ...ring(5, 4, 45, 90, 6)],
  shadePoints: ring(43, 16, 0, 22.5),
  pads: [pad(0, 3, 13, 12, 8, 0, -1)],
  charms: [[30, 0, 25], [-30, 0, 25]],
  ramps: RAMPS,
  ground: ground3,
  // Bell tower: cylinder r = 2 m on top of tier 2 (Y 6..14), cannot be entered or climbed.
  solid: (x, z, y) => Math.hypot(x, z) < 2 - EPS && y < 14,
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };
export const getNight = (n) => NIGHTS[n];
