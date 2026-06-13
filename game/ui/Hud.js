// Heads-up display, drawn in screen space (scrollFactor 0) on top of the world.
// Stats bars + depth, plus on-screen controls that work for mouse AND touch:
//  - a left d-pad feeds a movement vector
//  - right-side buttons feed attack(held) and dash/light/interact(tap) triggers
// GameScene merges these with the keyboard each frame.
/* global Phaser */
import { VIEW_WIDTH, VIEW_HEIGHT, PLAYER } from "../config.js";

const UI_DEPTH = 1000;

export default class Hud {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    this.move = { x: 0, y: 0 };
    this.attackHeld = false;
    this.triggers = { dash: false, light: false, interact: false };
    this._dpad = { left: false, right: false, up: false, down: false };

    this.barGfx = scene.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH);

    this.makeLabels();
    this.makeDepthReadout();
    this.makeActionButtons();
    this.makeDpad();
    this.makeBanners();
    this.makeCodexPanel();
    this.makePauseOverlay();
  }

  // ---------------------------------------------------------------- labels
  txt(x, y, text, size, color, origin = 0) {
    return this.scene.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: `${size}px`, color })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 1)
      .setOrigin(origin, 0);
  }

  makeLabels() {
    this.txt(18, 14, "HP", 11, "#ffb3b3");
    this.txt(18, 34, "O₂", 11, "#9be7ff");
    this.txt(18, 54, "EN", 11, "#ffe14d");
  }

  makeDepthReadout() {
    this.depthText = this.txt(VIEW_WIDTH - 18, 14, "Depth: 0 m", 18, "#ffffff", 1);
    this.zoneText = this.txt(VIEW_WIDTH - 18, 38, "햇빛 바다", 13, "#bcd6ef", 1);
  }

  // ----------------------------------------------------------- bars redraw
  drawBars() {
    const g = this.barGfx;
    g.clear();
    const x = 46;
    const w = 150;
    const h = 12;
    const draw = (y, ratio, color, warn = false) => {
      g.fillStyle(0x05111f, 0.85);
      g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle(0x0d2236, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(color, 1);
      g.fillRect(x, y, w * Phaser.Math.Clamp(ratio, 0, 1), h);
      if (warn) {
        g.lineStyle(2, 0xff5d5d, 0.5 + 0.5 * Math.sin(this.scene.time.now / 120));
        g.strokeRect(x - 2, y - 2, w + 4, h + 4);
      }
    };
    draw(12, this.player.hp / PLAYER.maxHp, 0xff5d5d);
    draw(32, this.player.oxygen / PLAYER.maxOxygen, 0x49c8ff, this.player.oxygen <= 25);
    draw(52, this.player.energy / PLAYER.maxEnergy, 0xffe14d);

    // skill cooldown shading on the Q/E buttons
    this.updateCooldownRing(this.dashBtn, this.player.cooldownRatio("dash"));
    this.updateCooldownRing(this.lightBtn, this.player.cooldownRatio("lightBurst"));
  }

  // -------------------------------------------------------- action buttons
  makeActionButtons() {
    const bx = VIEW_WIDTH - 70;
    const by = VIEW_HEIGHT - 60;
    this.attackBtn = this.makeButton(bx, by, 30, "공격\nSpace", 0xffd34d, {
      onDown: () => (this.attackHeld = true),
      onUp: () => (this.attackHeld = false),
    });
    this.dashBtn = this.makeButton(bx - 64, by + 6, 24, "대시\nQ", 0x66e0c0, {
      onTap: () => (this.triggers.dash = true),
    });
    this.lightBtn = this.makeButton(bx - 16, by - 56, 24, "빛\nE", 0xfff07a, {
      onTap: () => (this.triggers.light = true),
    });
    this.interactBtn = this.makeButton(bx + 4, by - 64, 20, "F", 0x9be7ff, {
      onTap: () => (this.triggers.interact = true),
    });
  }

  makeButton(x, y, r, label, color, { onDown, onUp, onTap } = {}) {
    const ring = this.scene.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH);
    const circle = this.scene.add
      .circle(x, y, r, color, 0.22)
      .setStrokeStyle(2, color, 0.9)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.scene.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: "11px", color: "#eaf6ff", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 1);

    const press = () => circle.setScale(0.9);
    const release = () => circle.setScale(1);
    circle.on("pointerdown", (p, lx, ly, e) => {
      e?.stopPropagation?.();
      press();
      if (onTap) onTap();
      if (onDown) onDown();
    });
    circle.on("pointerup", () => {
      release();
      if (onUp) onUp();
    });
    circle.on("pointerout", () => {
      release();
      if (onUp) onUp();
    });
    return { circle, ring, x, y, r };
  }

  updateCooldownRing(btn, ratio) {
    if (!btn) return;
    btn.ring.clear();
    if (ratio > 0) {
      btn.ring.fillStyle(0x000000, 0.5);
      btn.ring.slice(
        btn.x,
        btn.y,
        btn.r,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * ratio),
        false
      );
      btn.ring.fillPath();
    }
  }

  // ------------------------------------------------------------- d-pad
  makeDpad() {
    const cx = 70;
    const cy = VIEW_HEIGHT - 70;
    const mk = (dx, dy, glyph, dir) => {
      const c = this.scene.add
        .circle(cx + dx, cy + dy, 20, 0xffffff, 0.12)
        .setStrokeStyle(2, 0xffffff, 0.4)
        .setScrollFactor(0)
        .setDepth(UI_DEPTH)
        .setInteractive({ useHandCursor: true });
      this.scene.add
        .text(cx + dx, cy + dy, glyph, { fontFamily: "monospace", fontSize: "16px", color: "#eaf6ff" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(UI_DEPTH + 1);
      const set = (v) => {
        this._dpad[dir] = v;
        c.setScale(v ? 0.9 : 1);
      };
      c.on("pointerdown", (p, lx, ly, e) => {
        e?.stopPropagation?.();
        set(true);
      });
      c.on("pointerup", () => set(false));
      c.on("pointerout", () => set(false));
    };
    mk(0, -34, "▲", "up");
    mk(0, 34, "▼", "down");
    mk(-36, 0, "◀", "left");
    mk(36, 0, "▶", "right");
  }

  // ------------------------------------------------------------- banners
  makeBanners() {
    this.banner = this.txt(VIEW_WIDTH / 2, 80, "", 26, "#ffffff", 0.5).setAlpha(0);
    this.banner.setOrigin(0.5, 0.5);
    this.toast = this.txt(VIEW_WIDTH / 2, VIEW_HEIGHT - 120, "", 14, "#fff2a8", 0.5).setAlpha(0);
    this.toast.setOrigin(0.5, 0.5);
    this.prompt = this.txt(VIEW_WIDTH / 2, 120, "", 14, "#9be7ff", 0.5).setAlpha(0);
    this.prompt.setOrigin(0.5, 0.5);
  }

  showBanner(text, color = "#ffffff") {
    this.banner.setText(text).setColor(color).setAlpha(1).setScale(1);
    this.scene.tweens.add({ targets: this.banner, alpha: 0, scale: 1.2, duration: 1600, ease: "Quad.in", delay: 600 });
  }

  showToast(text) {
    this.toast.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.toast);
    this.scene.tweens.add({ targets: this.toast, alpha: 0, duration: 1400, delay: 500 });
  }

  setPrompt(text) {
    if (text) {
      this.prompt.setText(text).setAlpha(1);
    } else {
      this.prompt.setAlpha(0);
    }
  }

  // -------------------------------------------------------------- codex
  makeCodexPanel() {
    this.codexVisible = false;
    this.codexBg = this.scene.add
      .rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 420, 300, 0x04162c, 0.94)
      .setStrokeStyle(2, 0x9be7ff, 0.8)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 5)
      .setVisible(false);
    this.codexText = this.scene.add
      .text(VIEW_WIDTH / 2 - 190, VIEW_HEIGHT / 2 - 130, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#eaf6ff",
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 6)
      .setVisible(false);
  }

  toggleCodex(entries) {
    this.codexVisible = !this.codexVisible;
    this.codexBg.setVisible(this.codexVisible);
    this.codexText.setVisible(this.codexVisible);
    if (this.codexVisible) {
      const lines = ["── 생물 도감 ──", ""];
      if (entries.length === 0) lines.push("아직 발견한 생물이 없습니다.");
      else entries.forEach((name, i) => lines.push(`${String(i + 1).padStart(2, "0")}. ${name}`));
      lines.push("", "[Tab] 닫기");
      this.codexText.setText(lines.join("\n"));
    }
  }

  // -------------------------------------------------------------- pause
  makePauseOverlay() {
    this.pauseBg = this.scene.add
      .rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x01060f, 0.7)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 8)
      .setVisible(false);
    this.pauseText = this.txt(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 10, "일시정지\n\n[Esc] 계속하기", 24, "#ffffff", 0.5)
      .setVisible(false);
    this.pauseText.setAlign?.("center");
    this.pauseText.setOrigin(0.5, 0.5);
  }

  showPause(visible) {
    this.pauseBg.setVisible(visible);
    this.pauseText.setVisible(visible);
  }

  // --------------------------------------------------------- per-frame I/O
  update() {
    this.drawBars();
    this.depthText.setText(`Depth: ${Math.round(this.scene.depthSystem.depth)} m`);
    this.zoneText.setText(this.scene.depthSystem.zone.name);

    // compose movement vector from d-pad
    this.move.x = (this._dpad.right ? 1 : 0) - (this._dpad.left ? 1 : 0);
    this.move.y = (this._dpad.down ? 1 : 0) - (this._dpad.up ? 1 : 0);
  }

  // Called by the scene to drain one-shot button presses.
  consumeTriggers() {
    const t = { ...this.triggers };
    this.triggers.dash = this.triggers.light = this.triggers.interact = false;
    return t;
  }
}
