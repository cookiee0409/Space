// Streams creatures and items into the world as the player descends, weighted
// by the current zone, and culls anything that drifts far off-screen. Entity
// caps keep the frame budget healthy (perf requirement).
/* global Phaser */
import { VIEW_HEIGHT } from "../config.js";
import Enemy from "../entities/Enemy.js";
import FriendlyCreature from "../entities/FriendlyCreature.js";
import Item from "../entities/Item.js";
import { creatureById } from "../data/creatures.js";

const CAPS = { enemies: 10, friendlies: 6, items: 9 };

export default class SpawnSystem {
  constructor(scene, depthSystem, groups) {
    this.scene = scene;
    this.depthSystem = depthSystem;
    this.groups = groups;
    this.nextSpawnAt = 0;
  }

  update(time) {
    const cam = this.scene.cameras.main;
    const zone = this.depthSystem.zone;

    if (time > this.nextSpawnAt) {
      this.nextSpawnAt = time + zone.spawnInterval;
      this.trySpawn(cam, zone);
    }

    this.cull(cam);
  }

  trySpawn(cam, zone) {
    const bounds = this.scene.physics.world.bounds;
    const x = Phaser.Math.Between(40, bounds.width - 40);
    // Spawn just below the visible area so creatures rise into view as you dive,
    // with an occasional one above for variety.
    const below = Math.random() > 0.25;
    const y = below
      ? cam.scrollY + VIEW_HEIGHT + Phaser.Math.Between(30, 140)
      : cam.scrollY - Phaser.Math.Between(30, 100);
    if (y > bounds.height - 20) return;

    const roll = Math.random();
    const scale = zone.creatureScale;

    if (roll < 0.34 && zone.itemTypes.length && this.groups.items.countActive(true) < CAPS.items) {
      const id = Phaser.Utils.Array.GetRandom(zone.itemTypes);
      this.groups.items.add(new Item(this.scene, x, y, id).spawn());
      return;
    }

    const wantFriendly = roll < 0.62;
    if (wantFriendly && zone.friendlyTypes.length && this.groups.friendlies.countActive(true) < CAPS.friendlies) {
      const def = creatureById(Phaser.Utils.Array.GetRandom(zone.friendlyTypes));
      this.groups.friendlies.add(new FriendlyCreature(this.scene, x, y, def, scale));
      return;
    }

    // hostile or neutral
    const pool = [...zone.enemyTypes, ...zone.neutralTypes];
    if (pool.length && this.groups.enemies.countActive(true) < CAPS.enemies) {
      const def = creatureById(Phaser.Utils.Array.GetRandom(pool));
      this.groups.enemies.add(new Enemy(this.scene, x, y, def, scale));
    }
  }

  cull(cam) {
    const topLimit = cam.scrollY - 260;
    const botLimit = cam.scrollY + VIEW_HEIGHT + 320;
    const sweep = (group) => {
      group.children.iterate((obj) => {
        if (!obj || !obj.active) return;
        if (obj.y < topLimit || obj.y > botLimit) {
          if (obj.glow) obj.glow.destroy();
          group.killAndHide?.(obj);
          obj.destroy();
        }
      });
    };
    sweep(this.groups.enemies);
    sweep(this.groups.friendlies);
    sweep(this.groups.items);
  }
}
