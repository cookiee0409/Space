// Collectible resources. `effect` is applied to the player on pickup; every
// item also adds to the run's collection tally shown on the result screen.
export const ITEMS = {
  oxygen_capsule: {
    id: "oxygen_capsule",
    name: "산소 캡슐",
    texture: "item_oxygen",
    effect: { oxygen: 40 },
    score: 6,
  },
  energy_shard: {
    id: "energy_shard",
    name: "에너지 조각",
    texture: "item_energy",
    effect: { energy: 45 },
    score: 8,
  },
  mineral: {
    id: "mineral",
    name: "심해 광물",
    texture: "item_mineral",
    effect: { hp: 8 },
    score: 16,
  },
  specimen: {
    id: "specimen",
    name: "생물 표본",
    texture: "item_specimen",
    effect: {},
    score: 12,
  },
  relic: {
    id: "relic",
    name: "고대 유물 조각",
    texture: "item_relic",
    effect: { hp: 12, energy: 20 },
    score: 30,
  },
};

export function itemById(id) {
  return ITEMS[id];
}
