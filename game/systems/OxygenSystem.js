// Oxygen ticks down over time, faster the deeper you are. At zero, it starts
// eating into HP — the core "don't linger" tension.
export default class OxygenSystem {
  constructor(scene, player, depthSystem) {
    this.scene = scene;
    this.player = player;
    this.depthSystem = depthSystem;
    this.suffocateAccum = 0;
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    const drain = this.depthSystem.zone.oxygenDrain;
    this.player.oxygen = Math.max(0, this.player.oxygen - drain * dt);

    if (this.player.oxygen <= 0) {
      // ~6 HP/sec while suffocating.
      this.player.hp = Math.max(0, this.player.hp - 6 * dt);
      if (this.player.hp <= 0) this.player.alive = false;
    }
  }

  get low() {
    return this.player.oxygen <= 25;
  }
}
