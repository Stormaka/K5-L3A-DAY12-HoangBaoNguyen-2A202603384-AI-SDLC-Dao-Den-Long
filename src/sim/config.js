// Single source of truth for gameplay numbers.
// game.contract.json "tuning" MUST mirror TUNING (enforced by tests/contract.test.js).

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Values not exposed in the contract (internal assumptions, see docs/notes/phase-1.md).
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25,
  initial_motes: 30,
  mote_respawn_s: 4, // one new mote every 4 s while below initial_motes (random_motes only)
  initial_shades: 2,
  shade_spawn_every_s: 30,
  max_shades: 6,
  shade_spawn_radius: 36,
  shade_height: 1,
  jump_velocity: 6,
  gravity: 20,
};
