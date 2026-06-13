// Depth zones. Each zone owns its mood (colour, darkness, light radius),
// difficulty knobs, and which creatures/items can appear there. Tuning the
// game is mostly editing this table.

export const ZONES = [
  {
    id: "sunlight",
    name: "햇빛 바다",
    minDepth: 0,
    maxDepth: 300,
    backgroundColor: 0x62c8ff,
    fogColor: 0x9fe0ff,
    darkness: 0.0, // how dark the lighting overlay gets (0 = fully lit)
    lightRadius: 1.0, // multiplier on the visible light circle
    oxygenDrain: 3.2, // oxygen lost per second
    spawnInterval: 1500, // ms between spawn attempts
    creatureScale: 1.0,
    enemyTypes: ["small_predator"],
    neutralTypes: ["jelly"],
    friendlyTypes: ["small_fish", "turtle"],
    itemTypes: ["oxygen_capsule", "energy_shard", "oxygen_capsule", "specimen"],
  },
  {
    id: "midsea",
    name: "중층 바다",
    minDepth: 300,
    maxDepth: 800,
    backgroundColor: 0x1f6fbd,
    fogColor: 0x2f7fc0,
    darkness: 0.22,
    lightRadius: 0.85,
    oxygenDrain: 4.0,
    spawnInterval: 1300,
    creatureScale: 1.15,
    enemyTypes: ["fast_fish", "small_predator"],
    neutralTypes: ["jelly", "ray"],
    friendlyTypes: ["dolphin", "small_fish"],
    itemTypes: ["energy_shard", "oxygen_capsule", "mineral", "specimen"],
  },
  {
    id: "deepsea",
    name: "심해",
    minDepth: 800,
    maxDepth: 1500,
    backgroundColor: 0x071a3a,
    fogColor: 0x0a2148,
    darkness: 0.6,
    lightRadius: 0.6,
    oxygenDrain: 5.0,
    spawnInterval: 1200,
    creatureScale: 1.3,
    enemyTypes: ["angler", "deep_squid", "fast_fish"],
    neutralTypes: ["ray"],
    friendlyTypes: ["glow_whale"],
    itemTypes: ["mineral", "energy_shard", "relic", "specimen"],
  },
  {
    id: "abyss",
    name: "초심해",
    minDepth: 1500,
    maxDepth: 9999,
    backgroundColor: 0x01030a,
    fogColor: 0x03061a,
    darkness: 0.82,
    lightRadius: 0.46,
    oxygenDrain: 6.0,
    spawnInterval: 1500,
    creatureScale: 1.5,
    enemyTypes: ["angler", "deep_squid", "crab"],
    neutralTypes: [],
    friendlyTypes: ["glow_whale"],
    itemTypes: ["relic", "mineral", "specimen"],
  },
];

export function zoneForDepth(depth) {
  for (const zone of ZONES) {
    if (depth >= zone.minDepth && depth < zone.maxDepth) return zone;
  }
  return ZONES[ZONES.length - 1];
}

// Linear-interpolate a numeric field between the current zone and the next, so
// mood transitions feel gradual instead of snapping at the boundary.
export function blendZoneField(depth, field) {
  const zone = zoneForDepth(depth);
  const index = ZONES.indexOf(zone);
  const next = ZONES[Math.min(index + 1, ZONES.length - 1)];
  if (next === zone) return zone[field];
  const span = Math.min(zone.maxDepth, 9999) - zone.minDepth;
  const t = span > 0 ? Phaser.Math.Clamp((depth - zone.minDepth) / span, 0, 1) : 0;
  return Phaser.Math.Linear(zone[field], next[field], t);
}

// Blend two packed RGB colours across the zone boundary.
export function blendZoneColor(depth, field) {
  const zone = zoneForDepth(depth);
  const index = ZONES.indexOf(zone);
  const next = ZONES[Math.min(index + 1, ZONES.length - 1)];
  const from = Phaser.Display.Color.IntegerToColor(zone[field]);
  if (next === zone) return from;
  const to = Phaser.Display.Color.IntegerToColor(next[field]);
  const span = Math.min(zone.maxDepth, 9999) - zone.minDepth;
  const t = span > 0 ? Phaser.Math.Clamp((depth - zone.minDepth) / span, 0, 1) : 0;
  return Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
}

/* global Phaser */
