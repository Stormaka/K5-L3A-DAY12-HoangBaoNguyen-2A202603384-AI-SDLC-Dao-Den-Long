// Single source of truth for gameplay numbers (Ticket-02 standard numbers, Test Contract v1.1).
// game.contract.json "tuning" MUST mirror TUNING (enforced by tests/contract.test.js C-01).

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10, // per mote DEPOSITED into a lantern (Ticket-02)
    per_lantern: 100,
    per_stun: 5, // per shade hit by a pulse (each shade, each pulse)
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Standard numbers from Ticket-02 that are not tuning keys in the contract, plus documented
// assumptions (marked A2-xx, see docs/notes/phase-2.md).
export const WORLD = {
  jump_velocity: 7,
  gravity: 20,
  step_height: 0.35, // A2-03: max climb per tick on ramps; higher ground is a wall
  pickup_height: 1.5,
  fall_y: -10,
  respawn_wait_ticks: 60,
  respawn_invuln_ticks: 90,
  drop_ring_min: 1.5,
  drop_ring_max: 2.5,
  drop_ttl_ticks: 480,
  mote_start: 20,
  mote_cap: 30,
  mote_every_ticks: 240,
  pulse_center_h: 0.8,
  pulse_push_ticks: 15,
  shade_detect: 12,
  shade_giveup: 18,
  shade_hit_height: 1.5,
  shade_spawn_min_dist: 15,
  shade_first_tick: 300,
  shade_first_count: 2,
  shade_spawning_ticks: 60, // A2-05
  shade_wander_speed: 2, // A2-06
  shade_hover: 1, // shade centre is 1 m above ground
  recoil_m: 2,
  recoil_ticks: 60,
  evict_ticks: 30,
  safe_margin: 0.002, // keeps "outside 6 m" true after 3-decimal rounding
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_every_ticks: 1200,
  drifter_chase_carry: 5,
  drifter_detect: 15,
  drifter_hit: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_ticks: 120,
  drifter_hover: 1.5,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  wind_every_ticks: 1800,
  wind_ticks: 300,
  wind_warn_ticks: 120,
  wind_speed: 2,
  pad_radius: 1,
};
