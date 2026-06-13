// Friendly creature: never attacks. Drifts (patrol) or shyly flees the player,
// and can be interacted with (F) to heal, register in the codex, and say a line.
/* global Phaser */
import { yToDepth } from "../config.js";

export default class FriendlyCreature extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, def, scale = 1) {
    super(scene, x, y, def.texture);
    this.def = def;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setScale(scale);
    this.setDepth(12);

    this.dir = new Phaser.Math.Vector2(Phaser.Math.RND.sign(), Phaser.Math.FloatBetween(-0.2, 0.2)).normalize();
    this.turnAt = 0;
    this.interacted = false;

    if (def.glow) {
      this.glow = scene.add
        .image(x, y, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(scale * 1.1)
        .setAlpha(0.5)
        .setDepth(11)
        .setTint(0x9be7ff);
    }
  }

  think(player, time) {
    if (!this.active) return;
    const def = this.def;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (def.ai === "flee" && dist < 90) {
      const ang = Math.atan2(this.y - player.y, this.x - player.x);
      this.setVelocity(Math.cos(ang) * def.speed, Math.sin(ang) * def.speed);
    } else {
      if (time > this.turnAt) {
        this.turnAt = time + Phaser.Math.Between(1400, 3000);
        this.dir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-0.3, 0.3)).normalize();
      }
      if ((this.x < 30 && this.dir.x < 0) || (this.x > this.scene.physics.world.bounds.width - 30 && this.dir.x > 0)) {
        this.dir.x *= -1;
      }
      this.setVelocity(this.dir.x * def.speed, this.dir.y * def.speed);
    }

    if (this.body.velocity.x !== 0) this.setFlipX(this.body.velocity.x < 0);
    if (this.glow) this.glow.setPosition(this.x, this.y);
  }

  // Returns the heal payload the first time, null afterwards.
  interact() {
    if (this.interacted) return null;
    this.interacted = true;
    this.scene.tweens.add({ targets: this, scaleX: this.scaleX * 1.2, scaleY: this.scaleY * 1.2, yoyo: true, duration: 180 });
    return this.def.heal || {};
  }

  depth() {
    return yToDepth(this.y);
  }
}
