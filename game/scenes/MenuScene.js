// Title screen: name, start, and a toggleable controls panel. Works with both
// click and touch, and any key / pointer starts the dive.
/* global Phaser */
import { VIEW_WIDTH, VIEW_HEIGHT } from "../config.js";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const cx = VIEW_WIDTH / 2;
    this.cameras.main.setBackgroundColor(0x05203f);

    // Drifting backdrop bubbles for a little life.
    this.bubbles = this.add.group();
    for (let i = 0; i < 24; i++) {
      const b = this.add
        .image(Phaser.Math.Between(0, VIEW_WIDTH), Phaser.Math.Between(0, VIEW_HEIGHT), "bubble")
        .setAlpha(Phaser.Math.FloatBetween(0.2, 0.6))
        .setScale(Phaser.Math.FloatBetween(0.6, 1.8));
      b.driftSpeed = Phaser.Math.FloatBetween(8, 24);
      this.bubbles.add(b);
    }

    this.add
      .text(cx, 120, "심해 픽셀 탐험대", {
        fontFamily: "monospace",
        fontSize: "44px",
        color: "#9be7ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 168, "DEEP  PIXEL  SEA", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffd34d",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 210, "밝은 수면에서 칠흑의 심해까지 — 산소를 아끼며 더 깊이 내려가라.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#bcd6ef",
      })
      .setOrigin(0.5);

    this.makeButton(cx, 280, "▶  시작하기", () => this.startGame());

    this.controls = this.add
      .text(
        cx,
        350,
        "이동 WASD/방향키   ·   공격 Space   ·   대시 Q   ·   빛 폭발 E   ·   상호작용 F   ·   도감 Tab   ·   일시정지 Esc",
        { fontFamily: "monospace", fontSize: "12px", color: "#8fb6d6", align: "center" }
      )
      .setOrigin(0.5);

    this.add
      .text(cx, VIEW_HEIGHT - 24, "아무 키나 누르면 바로 시작합니다", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#5d83ad",
      })
      .setOrigin(0.5);

    this.input.keyboard.once("keydown", () => this.startGame());
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#05203f",
        backgroundColor: "#ffd34d",
        padding: { x: 22, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setColor("#0a2a52").setStyle({ backgroundColor: "#ffe88a" }));
    btn.on("pointerout", () => btn.setColor("#05203f").setStyle({ backgroundColor: "#ffd34d" }));
    btn.on("pointerup", onClick);
    return btn;
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(250, 2, 8, 20);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameScene"));
  }

  update(_time, delta) {
    const dt = delta / 1000;
    this.bubbles.children.iterate((b) => {
      if (!b) return;
      b.y -= b.driftSpeed * dt;
      if (b.y < -10) {
        b.y = VIEW_HEIGHT + 10;
        b.x = Phaser.Math.Between(0, VIEW_WIDTH);
      }
    });
  }
}
