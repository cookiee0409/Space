// Generates every texture procedurally so the MVP ships with no binary assets.
// Each creature/item/prop is a small blocky drawing -> generateTexture(key).
// To use real PNG sprites later, load them in preload() and keep the same keys.
/* global Phaser */

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    this.makeProps();
    this.makePlayerAndProjectiles();
    this.makeCreatures();
    this.makeItems();
    this.makeLightAndParticles();
    this.scene.start("MenuScene");
  }

  // Draw with a throwaway Graphics, bake to a texture, clear, repeat.
  draw(key, width, height, paint) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    paint(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  rect(g, color, x, y, w, h, alpha = 1) {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, w, h);
  }

  // ---------------------------------------------------------------- props
  makeProps() {
    // Seaweed blade.
    this.draw("seaweed", 16, 64, (g) => {
      for (let i = 0; i < 8; i++) {
        const y = 56 - i * 7;
        const x = 5 + Math.sin(i * 0.9) * 3;
        this.rect(g, 0x2faa6a, x, y, 6, 8);
        this.rect(g, 0x46c884, x + 1, y, 2, 8, 0.8);
      }
    });
    // Coral clump.
    this.draw("coral", 40, 34, (g) => {
      this.rect(g, 0xff7a9c, 6, 14, 8, 20);
      this.rect(g, 0xff9db4, 8, 8, 5, 26);
      this.rect(g, 0xffb86b, 18, 18, 8, 16);
      this.rect(g, 0xff7a9c, 28, 12, 7, 22);
      this.rect(g, 0xffd0dd, 30, 8, 3, 26, 0.9);
    });
    // Rock / sea floor lump.
    this.draw("rock", 64, 30, (g) => {
      this.rect(g, 0x2b3a55, 0, 12, 64, 18);
      this.rect(g, 0x37496b, 6, 6, 30, 12);
      this.rect(g, 0x223049, 40, 9, 20, 10);
    });
    // Glow particle clump for the abyss.
    this.draw("mote", 6, 6, (g) => {
      this.rect(g, 0x8ff0ff, 1, 1, 4, 4, 0.9);
      this.rect(g, 0xffffff, 2, 2, 2, 2);
    });
  }

  // -------------------------------------------------- player & projectiles
  makePlayerAndProjectiles() {
    // Small submarine, facing right. flipX gives the left-facing pose.
    this.draw("sub", 34, 20, (g) => {
      this.rect(g, 0xffd34d, 4, 6, 22, 10); // hull
      this.rect(g, 0xffe88a, 4, 6, 22, 3); // highlight
      this.rect(g, 0xd99a1f, 4, 13, 22, 3); // shade
      this.rect(g, 0x2b3a55, 0, 9, 5, 5); // tail fin
      this.rect(g, 0x9be7ff, 17, 8, 6, 6); // window
      this.rect(g, 0xffffff, 18, 9, 2, 2); // window glint
      this.rect(g, 0xff7a4d, 26, 9, 5, 3); // nose light
    });

    // Bubble.
    this.draw("bubble", 8, 8, (g) => {
      g.fillStyle(0xbfefff, 0.85);
      g.fillCircle(4, 4, 3);
      this.rect(g, 0xffffff, 3, 2, 2, 2, 0.9);
    });

    // Harpoon / energy bolt.
    this.draw("proj", 12, 6, (g) => {
      this.rect(g, 0xfff2a8, 0, 2, 12, 2);
      this.rect(g, 0xffffff, 8, 1, 4, 4);
      this.rect(g, 0xffb84d, 0, 2, 4, 2);
    });
  }

  // ---------------------------------------------------------- creatures
  makeCreatures() {
    // Cute small fish.
    this.draw("small_fish", 18, 12, (g) => {
      this.rect(g, 0x68d6ff, 2, 3, 11, 6);
      this.rect(g, 0xa6ecff, 3, 3, 9, 2, 0.8);
      this.rect(g, 0x3aa6e0, 12, 1, 5, 10); // tail
      this.rect(g, 0x07304a, 4, 5, 2, 2); // eye
    });

    // Turtle.
    this.draw("turtle", 22, 16, (g) => {
      this.rect(g, 0x3f8d5a, 4, 4, 14, 9); // shell
      this.rect(g, 0x57b074, 6, 4, 10, 3, 0.8);
      this.rect(g, 0x2c6b41, 6, 9, 12, 2);
      this.rect(g, 0x8fd6a0, 0, 7, 5, 4); // head
      this.rect(g, 0x07304a, 1, 8, 2, 2);
      this.rect(g, 0x2c6b41, 4, 12, 4, 3); // flipper
      this.rect(g, 0x2c6b41, 14, 12, 4, 3);
    });

    // Jellyfish.
    this.draw("jelly", 18, 22, (g) => {
      g.fillStyle(0xff9de0, 0.85);
      g.fillEllipse(9, 7, 16, 12);
      this.rect(g, 0xffd3f2, 5, 3, 8, 3, 0.8);
      for (let i = 0; i < 4; i++) {
        this.rect(g, 0xff9de0, 3 + i * 4, 12, 2, 8, 0.7);
      }
    });

    // Ray.
    this.draw("ray", 26, 14, (g) => {
      g.fillStyle(0x6b73a8, 1);
      g.fillTriangle(2, 7, 24, 1, 24, 13);
      this.rect(g, 0x9aa2d6, 6, 6, 10, 2, 0.7);
      this.rect(g, 0x07304a, 20, 6, 2, 2);
      this.rect(g, 0x4a5288, 24, 6, 2, 2); // tail base
    });

    // Dolphin.
    this.draw("dolphin", 30, 14, (g) => {
      this.rect(g, 0x7fa8d6, 4, 4, 18, 6);
      this.rect(g, 0xbcd6ef, 4, 4, 18, 2, 0.8);
      this.rect(g, 0xe7f2ff, 6, 9, 14, 2); // belly
      this.rect(g, 0x5d83ad, 21, 1, 7, 12); // tail
      this.rect(g, 0x5d83ad, 10, 0, 4, 4); // dorsal
      this.rect(g, 0x07304a, 7, 6, 2, 2);
    });

    // Glowing whale (friendly, big).
    this.draw("glow_whale", 72, 32, (g) => {
      this.rect(g, 0x2a5e8f, 6, 8, 52, 18);
      this.rect(g, 0x4d92cf, 8, 8, 50, 4, 0.8);
      this.rect(g, 0xbfe9ff, 10, 22, 46, 3, 0.7); // glowing belly line
      this.rect(g, 0x1c4368, 56, 4, 14, 26); // tail
      this.rect(g, 0x9be7ff, 18, 14, 3, 3, 0.9); // glow spots
      this.rect(g, 0x9be7ff, 30, 18, 3, 3, 0.9);
      this.rect(g, 0x9be7ff, 42, 13, 3, 3, 0.9);
      this.rect(g, 0x07304a, 14, 13, 3, 3); // eye
    });

    // Anglerfish.
    this.draw("angler", 26, 20, (g) => {
      this.rect(g, 0x3a2747, 4, 5, 16, 11); // body
      this.rect(g, 0x553a66, 5, 5, 14, 3, 0.7);
      this.rect(g, 0xe7d24a, 2, 9, 3, 4); // teeth area
      this.rect(g, 0xfff2a8, 3, 10, 2, 2);
      // lure
      this.rect(g, 0x6a4a3a, 12, 1, 2, 5);
      g.fillStyle(0xfff7c2, 0.95);
      g.fillCircle(13, 1, 3);
      this.rect(g, 0xff5d5d, 8, 9, 3, 3); // glowing eye
    });

    // Deep squid.
    this.draw("deep_squid", 20, 26, (g) => {
      this.rect(g, 0x7a2f55, 5, 2, 10, 12); // mantle
      this.rect(g, 0xa8466f, 6, 2, 8, 3, 0.8);
      this.rect(g, 0xffd0e6, 7, 6, 2, 2); // eye
      this.rect(g, 0xffd0e6, 11, 6, 2, 2);
      for (let i = 0; i < 5; i++) {
        this.rect(g, 0x933a63, 4 + i * 3, 14, 2, 10, 0.85);
      }
    });

    // Armoured crab.
    this.draw("crab", 24, 18, (g) => {
      this.rect(g, 0xc24b3a, 4, 7, 16, 8); // shell
      this.rect(g, 0xe06b57, 5, 7, 14, 3, 0.8);
      this.rect(g, 0x07304a, 8, 9, 2, 2);
      this.rect(g, 0x07304a, 14, 9, 2, 2);
      this.rect(g, 0x9e3527, 0, 4, 5, 4); // claw L
      this.rect(g, 0x9e3527, 19, 4, 5, 4); // claw R
      for (let i = 0; i < 3; i++) {
        this.rect(g, 0x9e3527, 5 + i * 5, 15, 2, 3); // legs
      }
    });

    // Ancient giant (boss silhouette).
    this.draw("ancient", 240, 120, (g) => {
      g.fillStyle(0x0a1d3a, 1);
      g.fillEllipse(120, 60, 220, 70); // huge body
      g.fillStyle(0x12305c, 1);
      g.fillTriangle(210, 60, 240, 30, 240, 90); // tail
      g.fillStyle(0x0a1d3a, 1);
      g.fillTriangle(90, 30, 130, 30, 110, 0); // dorsal
      // bioluminescent spots
      g.fillStyle(0x5fd8ff, 0.9);
      for (let i = 0; i < 9; i++) {
        g.fillCircle(40 + i * 20, 50 + Math.sin(i) * 14, 3);
      }
      g.fillStyle(0xff5d5d, 0.95);
      g.fillCircle(40, 50, 5); // eye
    });
  }

  // -------------------------------------------------------------- items
  makeItems() {
    this.draw("item_oxygen", 12, 12, (g) => {
      this.rect(g, 0x3fc9ff, 3, 1, 6, 10);
      this.rect(g, 0xbff0ff, 4, 2, 2, 8, 0.9);
      this.rect(g, 0xd0d0d0, 4, 0, 4, 2);
    });
    this.draw("item_energy", 12, 12, (g) => {
      g.fillStyle(0xffe14d, 1);
      g.fillTriangle(6, 0, 11, 7, 1, 7);
      g.fillTriangle(1, 5, 11, 5, 6, 12);
      this.rect(g, 0xfff7c2, 5, 3, 2, 4, 0.9);
    });
    this.draw("item_mineral", 12, 12, (g) => {
      g.fillStyle(0x7ad6ff, 1);
      g.fillTriangle(6, 0, 11, 6, 1, 6);
      this.rect(g, 0x4aa6e0, 1, 6, 10, 5);
      this.rect(g, 0xdcf4ff, 4, 2, 2, 6, 0.9);
    });
    this.draw("item_specimen", 12, 12, (g) => {
      g.fillStyle(0xbfeaff, 0.5);
      g.fillCircle(6, 6, 5); // jar
      this.rect(g, 0xff9de0, 4, 4, 4, 4);
      this.rect(g, 0xcfcfcf, 4, 0, 4, 2);
    });
    this.draw("item_relic", 12, 12, (g) => {
      this.rect(g, 0xc9a24a, 1, 1, 10, 10);
      this.rect(g, 0xe7c97a, 2, 2, 8, 2, 0.9);
      this.rect(g, 0x6a4a1f, 4, 4, 4, 4);
      this.rect(g, 0xfff2a8, 5, 5, 2, 2);
    });
  }

  // -------------------------------------------- lighting + spark particles
  makeLightAndParticles() {
    // Radial gradient: transparent centre -> dark edges. Tinted/scaled per
    // depth by LightingSystem to create the "only around the player" effect.
    const size = 512;
    const canvasTex = this.textures.createCanvas("light", size, size);
    const ctx = canvasTex.getContext();
    // Used as a bitmap mask over a full-screen dark layer: a small transparent
    // hole at the centre (around the player) ramping to fully opaque well
    // before the edge, so the opaque ring still covers the whole screen.
    const grd = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grd.addColorStop(0.0, "rgba(0,0,0,0)");
    grd.addColorStop(0.1, "rgba(0,0,0,0)");
    grd.addColorStop(0.24, "rgba(0,0,0,0.72)");
    grd.addColorStop(0.34, "rgba(0,0,0,1)");
    grd.addColorStop(1.0, "rgba(0,0,0,1)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    canvasTex.refresh();

    // Soft round spark for hits.
    this.draw("spark", 10, 10, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(5, 5, 4);
    });

    // Soft white glow (bright centre -> transparent edge) for additive light:
    // creature bioluminescence and the Light Burst flash.
    const gsize = 128;
    const glowTex = this.textures.createCanvas("glow", gsize, gsize);
    const gctx = glowTex.getContext();
    const gg = gctx.createRadialGradient(gsize / 2, gsize / 2, 2, gsize / 2, gsize / 2, gsize / 2);
    gg.addColorStop(0.0, "rgba(255,255,255,1)");
    gg.addColorStop(0.4, "rgba(255,255,255,0.45)");
    gg.addColorStop(1.0, "rgba(255,255,255,0)");
    gctx.fillStyle = gg;
    gctx.fillRect(0, 0, gsize, gsize);
    glowTex.refresh();
  }
}
