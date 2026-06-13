// Entry point. Wires the Phaser game together and registers every scene.
// Phaser is loaded globally (UMD) from the CDN in game.html.
import { VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import BootScene from "./scenes/BootScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import ResultScene from "./scenes/ResultScene.js";

/* global Phaser */

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: "#62c8ff",
  pixelArt: true, // crisp, blocky scaling — the requested dot-pixel look
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 }, // water: no gravity, drift instead
      debug: false,
    },
  },
  input: {
    activePointers: 3, // allow multitouch for the on-screen pads
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
// Exposed for debugging/automation; harmless in production.
window.__game = game;
