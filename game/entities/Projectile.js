// Player attack projectile. Pooled via an Arcade physics group (see GameScene).
/* global Phaser */
import { VIEW_HEIGHT } from "../config.js";

export default class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "proj");
  }

  fire(x, y, vx, vy, damage) {
    this.damage = damage;
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true);
    this.body.setAllowGravity(false);
    this.setVelocity(vx, vy);
    this.setRotation(Math.atan2(vy, vx));
    this.lifespan = 1200;
  }

  deactivate() {
    this.disableBody(true, true);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.lifespan -= delta;
    // Cull when expired or far outside the camera view (perf requirement).
    const cam = this.scene.cameras.main;
    if (
      this.lifespan <= 0 ||
      this.y < cam.scrollY - 60 ||
      this.y > cam.scrollY + VIEW_HEIGHT + 60 ||
      this.x < -40 ||
      this.x > this.scene.physics.world.bounds.width + 40
    ) {
      this.deactivate();
    }
  }
}
