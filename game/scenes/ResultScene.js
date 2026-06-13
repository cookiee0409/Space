// Run summary. Receives stats from GameScene via scene.start data.
/* global Phaser */
import { VIEW_WIDTH, VIEW_HEIGHT } from "../config.js";

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(data) {
    const stats = data || {};
    const cx = VIEW_WIDTH / 2;
    this.cameras.main.setBackgroundColor(0x01030a);

    const survived = stats.reason === "depth";
    this.add
      .text(cx, 60, survived ? "심연에 도달했다!" : "탐험 종료", {
        fontFamily: "monospace",
        fontSize: "38px",
        color: survived ? "#9be7ff" : "#ff7a7a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const rows = [
      ["최대 도달 깊이", `${Math.round(stats.maxDepth || 0)} m`],
      ["처치한 적", `${stats.kills || 0} 마리`],
      ["발견한 우호 생물", `${stats.friendsMet || 0} 종`],
      ["수집한 자원", `${stats.itemsCollected || 0} 개`],
      ["도감 등록", `${stats.codexCount || 0} 종`],
      ["탐험 점수", `${stats.score || 0} 점`],
    ];

    rows.forEach(([label, value], i) => {
      const y = 130 + i * 34;
      this.add.text(cx - 180, y, label, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#bcd6ef",
      });
      this.add
        .text(cx + 180, y, value, {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ffd34d",
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
    });

    this.makeButton(cx, VIEW_HEIGHT - 60, "다시 도전", () => {
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameScene"));
    });

    this.input.keyboard.once("keydown-ENTER", () => this.scene.start("GameScene"));
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#01030a",
        backgroundColor: "#9be7ff",
        padding: { x: 20, y: 9 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#c7f2ff" }));
    btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#9be7ff" }));
    btn.on("pointerup", onClick);
    return btn;
  }
}
