// Hostile / neutral creature with simple AI: patrol, chase, or charge.
// Data-driven from creatures.js so balancing lives in data, not code.
/* global Phaser */
import { yToDepth } from "../config.js";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, def, scale = 1) {
    super(scene, x, y, def.texture);
    this.def = def;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setScale(scale);
    this.setDepth(12);

    this.hp = def.hp;
    this.maxHp = def.hp;
    this.contactDamage = def.damage || 6;
    this.hostile = def.kind === "enemy";
    this.homeX = x;
    this.homeY = y;
    this.state2 = "idle"; // patrol/charge sub-state
    this.chargeUntil = 0;
    this.nextChargeReady = 0;
    this.dir = new Phaser.Math.Vector2(Phaser.Math.RND.sign(), Phaser.Math.FloatBetween(-0.3, 0.3)).normalize();
    this.patrolTurnAt = 0;

    if (def.glow) {
      this.glow = scene.add
        .image(x, y, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(scale * 0.9)
        .setAlpha(0.5)
        .setDepth(11)
        .setTint(0x5fd8ff);
    }
  }

  think(player, time) {
    if (!this.active) return;
    const def = this.def;
    const speed = def.speed;
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const detect = def.detectRange || 0;

    if (def.ai === "patrol" || !this.hostile) {
      this.patrol(time, speed);
    } else if (def.ai === "chase") {
      if (detect && distToPlayer < detect) {
        this.moveToward(player.x, player.y, speed);
      } else if (Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY) > 30) {
        this.moveToward(this.homeX, this.homeY, speed * 0.6);
      } else {
        this.patrol(time, speed * 0.5);
      }
    } else if (def.ai === "charge") {
      this.chargeBehaviour(player, time, speed, distToPlayer, detect);
    }

    // face travel direction
    if (this.body.velocity.x !== 0) this.setFlipX(this.body.velocity.x < 0);
    if (this.glow) this.glow.setPosition(this.x, this.y);
  }

  patrol(time, speed) {
    if (time > this.patrolTurnAt) {
      this.patrolTurnAt = time + Phaser.Math.Between(1200, 2600);
      this.dir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-0.4, 0.4)).normalize();
    }
    // bounce off the horizontal walls of the play area
    if ((this.x < 30 && this.dir.x < 0) || (this.x > this.scene.physics.world.bounds.width - 30 && this.dir.x > 0)) {
      this.dir.x *= -1;
    }
    this.setVelocity(this.dir.x * speed, this.dir.y * speed);
  }

  chargeBehaviour(player, time, speed, dist, detect) {
    if (this.state2 === "charging") {
      if (time > this.chargeUntil) {
        this.state2 = "idle";
        this.nextChargeReady = time + 900;
      }
      return; // keep current velocity while charging
    }
    if (this.state2 === "winding") {
      this.setVelocity(0, 0);
      if (time > this.windUntil) {
        const ang = Math.atan2(player.y - this.y, player.x - this.x);
        const cs = this.def.chargeSpeed || speed * 3;
        this.setVelocity(Math.cos(ang) * cs, Math.sin(ang) * cs);
        this.state2 = "charging";
        this.chargeUntil = time + 520;
      }
      return;
    }
    if (detect && dist < detect && time > this.nextChargeReady) {
      this.state2 = "winding";
      this.windUntil = time + 360;
      this.setVelocity(0, 0);
      return;
    }
    this.patrol(time, speed * 0.6);
  }

  moveToward(tx, ty, speed) {
    const ang = Math.atan2(ty - this.y, tx - this.x);
    this.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
  }

  hurt(amount) {
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.scene.onEnemyKilled(this);
    if (this.glow) this.glow.destroy();
    this.destroy();
  }

  depth() {
    return yToDepth(this.y);
  }
}
