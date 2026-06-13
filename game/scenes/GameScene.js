// Main gameplay loop. Owns the player, the entity groups, and every system,
// and exposes the small API the entities/systems call back into
// (fireProjectile, collectItem, onEnemyKilled, onZoneChanged, ...).
/* global Phaser */
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  START_Y,
  MAX_DEPTH,
  BOSS_DEPTH,
} from "../config.js";
import { ZONES } from "../data/zones.js";
import { CREATURES, creatureById } from "../data/creatures.js";
import Player from "../entities/Player.js";
import Projectile from "../entities/Projectile.js";
import Item from "../entities/Item.js";
import DepthSystem from "../systems/DepthSystem.js";
import OxygenSystem from "../systems/OxygenSystem.js";
import CombatSystem from "../systems/CombatSystem.js";
import SpawnSystem from "../systems/SpawnSystem.js";
import LightingSystem from "../systems/LightingSystem.js";
import Hud from "../ui/Hud.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    this.paused = false;
    this.ending = false;
    this.bossTriggered = false;
    this.kills = 0;
    this.itemsCollected = 0;
    this.score = 0;
    this.codex = new Set();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.fadeIn(300, 2, 12, 28);

    this.buildBackdrop();

    // Entity groups.
    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 30,
      runChildUpdate: true,
    });
    this.enemies = this.add.group();
    this.friendlies = this.add.group();
    this.items = this.add.group();

    // Player + camera.
    this.player = new Player(this, WORLD_WIDTH / 2, START_Y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // Systems.
    this.depthSystem = new DepthSystem(this, this.player);
    this.oxygenSystem = new OxygenSystem(this, this.player, this.depthSystem);
    this.lighting = new LightingSystem(this, this.player, this.depthSystem);
    this.combat = new CombatSystem(this);
    this.combat.setup({
      player: this.player,
      projectiles: this.projectiles,
      enemies: this.enemies,
      friendlies: this.friendlies,
      items: this.items,
    });
    this.spawn = new SpawnSystem(this, this.depthSystem, {
      enemies: this.enemies,
      friendlies: this.friendlies,
      items: this.items,
    });

    // HUD (reads this.depthSystem each frame).
    this.hud = new Hud(this, this.player);
    this.hud.showBanner(ZONES[0].name, "#9be7ff");

    this.setupInput();

    // Ambient glow motes for the dark zones.
    this.motes = this.add
      .particles(0, 0, "mote", {
        x: { min: 0, max: VIEW_WIDTH },
        y: { min: 0, max: VIEW_HEIGHT },
        lifespan: 4000,
        speedY: { min: -6, max: 6 },
        speedX: { min: -6, max: 6 },
        scale: { min: 0.4, max: 1 },
        alpha: { start: 0.6, end: 0 },
        frequency: 400,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setScrollFactor(0)
      .setDepth(85);
  }

  // ---------------------------------------------------------------- input
  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,Q,E,F");
    this.input.keyboard.addCapture("SPACE,Q,E,F,TAB");

    this.input.keyboard.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard.on("keydown-TAB", (e) => {
      e.preventDefault();
      this.hud.toggleCodex(this.codexEntryNames());
    });
  }

  gatherInput() {
    const c = this.cursors;
    const k = this.keys;
    const hud = this.hud;

    let x = (c.right.isDown || k.D.isDown ? 1 : 0) - (c.left.isDown || k.A.isDown ? 1 : 0);
    let y = (c.down.isDown || k.S.isDown ? 1 : 0) - (c.up.isDown || k.W.isDown ? 1 : 0);
    x = Phaser.Math.Clamp(x + hud.move.x, -1, 1);
    y = Phaser.Math.Clamp(y + hud.move.y, -1, 1);

    const t = hud.consumeTriggers();
    return {
      x,
      y,
      attack: c.space.isDown || hud.attackHeld,
      dash: Phaser.Input.Keyboard.JustDown(k.Q) || t.dash,
      light: Phaser.Input.Keyboard.JustDown(k.E) || t.light,
      interact: Phaser.Input.Keyboard.JustDown(k.F) || t.interact,
    };
  }

  togglePause() {
    if (this.ending) return;
    this.paused = !this.paused;
    if (this.paused) this.physics.pause();
    else this.physics.resume();
    this.hud.showPause(this.paused);
  }

  // ----------------------------------------------------------- main loop
  update(time, delta) {
    if (this.ending) return;
    if (this.paused) return;

    const input = this.gatherInput();
    this.player.drive(input, delta);

    this.depthSystem.update();
    this.oxygenSystem.update(delta);
    this.lighting.update();

    this.enemies.children.iterate((e) => e && e.active && e.think(this.player, time));
    this.friendlies.children.iterate((f) => f && f.active && f.think(this.player, time));

    this.spawn.update(time);
    this.handleInteraction(input.interact);
    this.updateMotes();
    this.checkBoss();

    this.hud.update();

    if (!this.player.alive) this.endRun("death");
    else if (this.depthSystem.depth >= MAX_DEPTH) this.endRun("depth");
  }

  updateMotes() {
    const deep = this.depthSystem.depth > 800;
    this.motes.emitting = deep;
  }

  // --------------------------------------------------- interaction (F)
  handleInteraction(triggered) {
    const nearest = this.nearestFriendly(70);
    if (nearest && !nearest.interacted) {
      this.hud.setPrompt(`[F] ${nearest.def.name} 와 교감`);
    } else {
      this.hud.setPrompt("");
    }
    if (!triggered || !nearest) return;
    const heal = nearest.interact();
    if (heal) {
      this.player.heal(heal);
      this.registerCreature(nearest.def);
      this.spawnHitSpark(nearest.x, nearest.y, 0x9be7ff);
      const bits = [];
      if (heal.oxygen) bits.push(`산소 +${heal.oxygen}`);
      if (heal.hp) bits.push(`체력 +${heal.hp}`);
      this.hud.showToast(`${nearest.def.name}: ${nearest.def.dialog || "..."}  ${bits.join(" ")}`);
    }
  }

  nearestFriendly(range) {
    let best = null;
    let bestD = range;
    this.friendlies.children.iterate((f) => {
      if (!f || !f.active) return;
      const d = Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    });
    return best;
  }

  // ------------------------------------------------ entity/system callbacks
  fireProjectile(x, y, vx, vy, damage) {
    const p = this.projectiles.get();
    if (!p) return;
    p.fire(x, y, vx, vy, damage);
  }

  triggerLightBurst(x, y, radius, damage) {
    this.lighting.burst();
    // expanding ring visual
    const ring = this.add.circle(x, y, 8, 0xffffff, 0).setStrokeStyle(3, 0xfff7c2, 0.9).setDepth(30);
    this.tweens.add({
      targets: ring,
      radius: radius,
      alpha: 0,
      duration: 380,
      onUpdate: () => ring.setRadius(ring.radius),
      onComplete: () => ring.destroy(),
    });
    // damage nearby enemies
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      if (Phaser.Math.Distance.Between(e.x, e.y, x, y) <= radius) e.hurt(damage);
    });
  }

  spawnDashTrail(x, y) {
    const ghost = this.add
      .image(x, y, "sub")
      .setFlipX(this.player.flipX)
      .setAlpha(0.5)
      .setTint(0x9be7ff)
      .setDepth(19);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  spawnHitSpark(x, y, color = 0xffffff) {
    const s = this.add.image(x, y, "glow").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setScale(0.4);
    this.tweens.add({ targets: s, scale: 1.1, alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }

  onEnemyKilled(enemy) {
    this.kills += 1;
    this.score += enemy.def.score || 0;
    this.registerCreature(enemy.def);
    this.spawnHitSpark(enemy.x, enemy.y, 0xfff2a8);
    // drop a resource sometimes
    if (enemy.def.drop && Math.random() < 0.6) {
      this.items.add(new Item(this, enemy.x, enemy.y, enemy.def.drop).spawn());
    }
  }

  collectItem(item) {
    const def = item.def;
    this.player.heal(def.effect || {});
    this.itemsCollected += 1;
    this.score += def.score || 0;
    this.spawnHitSpark(item.x, item.y, 0xbff0ff);
    this.hud.showToast(`${def.name} 획득`);
    item.destroy();
  }

  onZoneChanged(zone, prev) {
    const goingDeeper = ZONES.indexOf(zone) > ZONES.indexOf(prev);
    this.hud.showBanner(zone.name, goingDeeper ? "#ffd34d" : "#9be7ff");
    if (goingDeeper && zone.id !== "sunlight") {
      this.hud.showToast("더 깊어진다 — 산소 소모가 빨라진다");
    }
  }

  registerCreature(def) {
    if (!def || this.codex.has(def.id)) return;
    this.codex.add(def.id);
  }

  codexEntryNames() {
    return [...this.codex].map((id) => CREATURES[id]?.name).filter(Boolean);
  }

  // --------------------------------------------------------- boss event
  checkBoss() {
    if (this.bossTriggered || this.depthSystem.depth < BOSS_DEPTH) return;
    this.bossTriggered = true;
    const def = creatureById("ancient_creature");
    const cam = this.cameras.main;
    const y = cam.scrollY + VIEW_HEIGHT * 0.55;
    const boss = this.add
      .image(-160, y, def.texture)
      .setDepth(3) // behind creatures; the dark overlay makes it a looming shadow
      .setAlpha(0.92);
    this.registerCreature(def);
    this.score += def.score;
    this.hud.showBanner("거대한 그림자가 다가온다…", "#ff7a7a");
    cam.shake(800, 0.006);
    this.tweens.add({
      targets: boss,
      x: WORLD_WIDTH + 200,
      y: y + 40,
      duration: 9000,
      ease: "Sine.inOut",
      onComplete: () => boss.destroy(),
    });
  }

  // ------------------------------------------------------------- run end
  endRun(reason) {
    if (this.ending) return;
    this.ending = true;
    this.physics.pause();
    this.hud.setPrompt("");
    const friendsMet = [...this.codex].filter((id) => CREATURES[id]?.kind === "friendly").length;
    const stats = {
      reason,
      maxDepth: this.depthSystem.maxDepth,
      kills: this.kills,
      friendsMet,
      itemsCollected: this.itemsCollected,
      codexCount: this.codex.size,
      score: this.score,
    };
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("ResultScene", stats));
  }

  // --------------------------------------------------------- backdrop
  buildBackdrop() {
    // Sun beams near the surface (parallax, sunlight zone only feel).
    for (let i = 0; i < 5; i++) {
      const beam = this.add
        .rectangle(80 + i * 160, 60, 40, 320, 0xffffff, 0.06)
        .setOrigin(0.5, 0)
        .setAngle(8)
        .setScrollFactor(0.4)
        .setDepth(1);
      this.tweens.add({ targets: beam, alpha: 0.12, duration: 2600 + i * 300, yoyo: true, repeat: -1 });
    }

    // Scatter seaweed / coral / rocks down the world for a sense of place.
    const props = ["seaweed", "coral", "rock", "seaweed"];
    for (let y = 260; y < WORLD_HEIGHT - 80; y += Phaser.Math.Between(220, 360)) {
      const onLeft = Math.random() > 0.5;
      const x = onLeft ? Phaser.Math.Between(10, 90) : Phaser.Math.Between(WORLD_WIDTH - 90, WORLD_WIDTH - 10);
      const key = Phaser.Utils.Array.GetRandom(props);
      const depthFactor = y < 4000 ? 1 : 0.55; // fade detail in the deep
      this.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setAlpha(depthFactor)
        .setScrollFactor(1, 0.92)
        .setDepth(2)
        .setFlipX(Math.random() > 0.5);
    }

    // Sea floor cap at the very bottom.
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 10, WORLD_WIDTH, 40, 0x05101f).setDepth(2);
  }
}
