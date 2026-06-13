// The player submarine. Owns its stats, smooth water movement, attack, the two
// skills' costs/cooldowns, and damage/invulnerability. Visual/world side-effects
// (lighting burst, hit sparks) are delegated to the scene's systems so the
// systems stay decoupled, as the spec requests.
/* global Phaser */
import { PLAYER, SKILLS } from "../config.js";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "sub");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setDrag(PLAYER.drag, PLAYER.drag);
    this.body.setMaxVelocity(PLAYER.maxSpeed, PLAYER.maxSpeed);
    this.body.setCircle(9, 8, 1);
    this.setCollideWorldBounds(true);
    this.setDepth(20);

    this.hp = PLAYER.maxHp;
    this.oxygen = PLAYER.maxOxygen;
    this.energy = PLAYER.maxEnergy;

    this.facing = 1; // -1 left / 1 right (visual flip)
    this.aim = new Phaser.Math.Vector2(1, 0); // last move direction, for attacks

    this.lastAttack = 0;
    this.cooldowns = { dash: 0, lightBurst: 0 };
    this.invulnUntil = 0;
    this.alive = true;

    // Bubble trail.
    this.bubbles = scene.add.particles(0, 0, "bubble", {
      speedY: { min: -30, max: -10 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 700,
      frequency: 120,
      follow: this,
      followOffset: { x: -10, y: 2 },
    });
    this.bubbles.setDepth(18);
  }

  // input: { x, y, attack, dash, light } from GameScene
  drive(input, dtMs) {
    if (!this.alive) return;
    const accel = PLAYER.accel;
    this.body.setAcceleration(input.x * accel, input.y * accel);

    if (input.x !== 0 || input.y !== 0) {
      this.aim.set(input.x, input.y).normalize();
      if (input.x !== 0) {
        this.facing = input.x < 0 ? -1 : 1;
        this.setFlipX(this.facing < 0);
      }
    }

    // Tilt slightly toward vertical movement for a touch of juice.
    this.setAngle(Phaser.Math.Clamp(this.body.velocity.y * 0.05, -14, 14) * (this.facing < 0 ? -1 : 1));

    if (input.attack) this.tryAttack();
    if (input.dash) this.tryDash();
    if (input.light) this.tryLightBurst();

    // Energy slowly regenerates.
    this.energy = Math.min(PLAYER.maxEnergy, this.energy + 0.012 * dtMs);
  }

  tryAttack() {
    const now = this.scene.time.now;
    if (now < this.lastAttack + PLAYER.attackCooldown) return;
    this.lastAttack = now;
    const dir = this.aim.lengthSq() > 0 ? this.aim.clone() : new Phaser.Math.Vector2(this.facing, 0);
    dir.normalize();
    const speed = 420;
    const muzzleX = this.x + dir.x * 18;
    const muzzleY = this.y + dir.y * 10;
    this.scene.fireProjectile(muzzleX, muzzleY, dir.x * speed, dir.y * speed, 14);
    // Sound hook point: when audio is added, play "sfx_attack" here.
  }

  tryDash() {
    const now = this.scene.time.now;
    const s = SKILLS.dash;
    if (now < this.cooldowns.dash || this.energy < s.energy) return;
    this.energy -= s.energy;
    this.cooldowns.dash = now + s.cooldown;
    const dir = this.aim.lengthSq() > 0 ? this.aim.clone() : new Phaser.Math.Vector2(this.facing, 0);
    dir.normalize();
    this.body.setVelocity(dir.x * s.power, dir.y * s.power);
    // brief i-frames + afterimage flash
    this.invulnUntil = Math.max(this.invulnUntil, now + s.durationMs);
    this.scene.spawnDashTrail(this.x, this.y);
  }

  tryLightBurst() {
    const now = this.scene.time.now;
    const s = SKILLS.lightBurst;
    if (now < this.cooldowns.lightBurst || this.energy < s.energy) return;
    this.energy -= s.energy;
    this.cooldowns.lightBurst = now + s.cooldown;
    this.scene.triggerLightBurst(this.x, this.y, s.radius, s.damage);
  }

  takeDamage(amount, sourceX, sourceY) {
    const now = this.scene.time.now;
    if (!this.alive || now < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = now + PLAYER.invulnMs;

    // knockback away from the source
    if (sourceX !== undefined) {
      const ang = Math.atan2(this.y - sourceY, this.x - sourceX);
      this.body.setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220);
    }

    // blink during i-frames
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.25, to: 1 },
      duration: 130,
      repeat: Math.floor(PLAYER.invulnMs / 260),
      yoyo: true,
      onComplete: () => this.setAlpha(1),
    });
    this.scene.cameras.main.shake(160, 0.008);
    this.scene.spawnHitSpark(this.x, this.y, 0xff5d5d);

    if (this.hp <= 0) this.alive = false;
    return true;
  }

  heal({ hp = 0, oxygen = 0, energy = 0 }) {
    this.hp = Math.min(PLAYER.maxHp, this.hp + hp);
    this.oxygen = Math.min(PLAYER.maxOxygen, this.oxygen + oxygen);
    this.energy = Math.min(PLAYER.maxEnergy, this.energy + energy);
  }

  isInvulnerable() {
    return this.scene.time.now < this.invulnUntil;
  }

  cooldownRatio(skill) {
    const s = SKILLS[skill];
    const remaining = this.cooldowns[skill] - this.scene.time.now;
    return Phaser.Math.Clamp(remaining / s.cooldown, 0, 1);
  }
}
