// Shared constants for the deep-sea game. Keeping these in one place makes it
// easy to retune the world without hunting through scenes/systems.

export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 450;

// Vertical map. Depth (meters) is derived from the player's y position so the
// rest of the game can reason in meters while physics stays in pixels.
export const PIXELS_PER_METER = 5;
export const START_Y = 120; // player spawn; depth 0m maps here
export const WORLD_WIDTH = VIEW_WIDTH;
export const MAX_DEPTH = 1850; // meters
export const WORLD_HEIGHT = START_Y + MAX_DEPTH * PIXELS_PER_METER + 200;

// Depth (m) <-> world y (px) helpers.
export const depthToY = (depth) => START_Y + depth * PIXELS_PER_METER;
export const yToDepth = (y) => Math.max(0, (y - START_Y) / PIXELS_PER_METER);

// Notable depth events.
export const BOSS_DEPTH = 1780; // giant-creature encounter

// Player base tuning.
export const PLAYER = {
  maxHp: 100,
  maxOxygen: 100,
  maxEnergy: 100,
  accel: 1100,
  drag: 900,
  maxSpeed: 150,
  attackCooldown: 320, // ms
  invulnMs: 900,
};

export const SKILLS = {
  dash: { key: "Q", energy: 28, cooldown: 1400, power: 470, durationMs: 220 },
  lightBurst: { key: "E", energy: 42, cooldown: 4200, radius: 150, damage: 34 },
};
