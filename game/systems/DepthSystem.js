// Tracks depth and the active zone, blends the background colour smoothly, and
// announces zone changes (for the HUD banner + boss trigger).
/* global Phaser */
import { yToDepth } from "../config.js";
import { ZONES, zoneForDepth, blendZoneColor } from "../data/zones.js";

export default class DepthSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.depth = 0;
    this.maxDepth = 0;
    this.zone = ZONES[0];
  }

  update() {
    this.depth = yToDepth(this.player.y);
    if (this.depth > this.maxDepth) this.maxDepth = this.depth;

    const zone = zoneForDepth(this.depth);
    if (zone !== this.zone) {
      const prev = this.zone;
      this.zone = zone;
      this.scene.onZoneChanged(zone, prev);
    }

    // Smoothly interpolate the camera background across the boundary.
    const c = blendZoneColor(this.depth, "backgroundColor");
    this.scene.cameras.main.setBackgroundColor(
      Phaser.Display.Color.GetColor(c.r, c.g, c.b)
    );
  }
}
