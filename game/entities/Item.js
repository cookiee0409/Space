// Collectible resource. Bobs gently in place until the player overlaps it.
/* global Phaser */
import { itemById } from "../data/items.js";

export default class Item extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, itemId) {
    const def = itemById(itemId);
    super(scene, x, y, def.texture);
    this.itemId = itemId;
    this.def = def; // note: never assign to `this.data` — that's Phaser's DataManager
    this.baseY = y;
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  spawn() {
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.scene.tweens.add({
      targets: this,
      angle: { from: -8, to: 8 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return this;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    // Gentle vertical bob.
    this.y = this.baseY + Math.sin((time / 600) + this.bobOffset) * 4;
  }
}
