// Depth-based lighting. A full-screen dark layer is masked by a radial "light"
// texture that follows the player, so deeper zones reveal only the area around
// the submarine. The Light Burst skill briefly widens the visible circle.
/* global Phaser */
import { VIEW_WIDTH, VIEW_HEIGHT } from "../config.js";
import { blendZoneField } from "../data/zones.js";

const BASE_MASK_SIZE = 2200; // big enough to cover screen corners from any spot

export default class LightingSystem {
  constructor(scene, player, depthSystem) {
    this.scene = scene;
    this.player = player;
    this.depthSystem = depthSystem;

    this.dark = scene.add
      .rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x01030a)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0);

    this.maskImg = scene.add
      .image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "light")
      .setScrollFactor(0)
      .setVisible(false);
    this.maskImg.setDisplaySize(BASE_MASK_SIZE, BASE_MASK_SIZE);
    this.maskScale = this.maskImg.scaleX;

    this.dark.setMask(this.maskImg.createBitmapMask());

    // Additive flash used by the Light Burst.
    this.flash = scene.add
      .image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "glow")
      .setScrollFactor(0)
      .setDepth(91)
      .setVisible(false);

    this.currentAlpha = 0;
    this.bursting = false;
  }

  update() {
    const cam = this.scene.cameras.main;
    const sx = this.player.x - cam.scrollX;
    const sy = this.player.y - cam.scrollY;
    this.maskImg.setPosition(sx, sy);

    const target = blendZoneField(this.depthSystem.depth, "darkness");
    if (!this.bursting) {
      this.currentAlpha = Phaser.Math.Linear(this.currentAlpha, target, 0.05);
      this.dark.setAlpha(this.currentAlpha);
      this.maskImg.setScale(this.maskScale);
    }
  }

  // Expand the light circle and lift the darkness for a moment.
  burst(durationMs = 900) {
    this.bursting = true;
    const baseAlpha = this.dark.alpha;
    // widen the hole
    this.scene.tweens.add({
      targets: this.maskImg,
      scaleX: this.maskScale * 1.7,
      scaleY: this.maskScale * 1.7,
      duration: 180,
      yoyo: true,
      hold: durationMs * 0.4,
      ease: "Quad.out",
    });
    // lift the gloom
    this.scene.tweens.add({
      targets: this.dark,
      alpha: Math.max(0, baseAlpha - 0.55),
      duration: 160,
      yoyo: true,
      hold: durationMs * 0.4,
      onComplete: () => {
        this.bursting = false;
      },
    });
    // bright additive pop around the player
    this.flash.setVisible(true).setAlpha(0.0).setDisplaySize(420, 420).setBlendMode(Phaser.BlendModes.ADD);
    this.flash.setPosition(this.maskImg.x, this.maskImg.y);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: { from: 0.5, to: 0 },
      duration: 360,
      onComplete: () => this.flash.setVisible(false),
    });
  }
}
