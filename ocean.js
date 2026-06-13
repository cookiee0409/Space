import * as THREE from "three";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/postprocessing/ShaderPass.js";

// =============================================================================
// 2.5D 손그림 애니메이션 수중 배경.
// 3D 바다를 만들고 만화 필터를 씌우는 방식이 아니라, 손으로 그린 듯한 평면
// 컷아웃(스프라이트)을 전경/중경/원경 레이어로 쌓아 시차로 움직이는 애니메이션
// 배경 공간을 만든다. 물·파도·거품·생물은 물리 시뮬이 아니라 프레임 사이클과
// 주기 모션으로 움직이는 손그림 루프 애니메이션이다.
// =============================================================================

const canvas = document.getElementById("ocean");
const intro = document.getElementById("intro");
const hint = document.getElementById("hint");

const PALETTE = {
  skyTop: "#cdeede",
  surface: "#eafbe8",
  shallow: "#8fe4cb",
  mid: "#4cc1ab",
  deep: "#1f7d76",
  abyss: "#13565c",
  ink: "#123a36",
  kelp: ["#2f7d4a", "#236b3c", "#3f9456", "#1f5f3a"],
  fish: ["#ff8a5c", "#ffd27a", "#ff6f87", "#4aa3d9", "#2f5d8c", "#7ee0a6"],
  jelly: ["#f3a6d6", "#ffc0e6", "#c8a6ff"],
  ray: "#fff3c8",
};

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.mid);
scene.fog = new THREE.FogExp2(new THREE.Color(PALETTE.mid).getHex(), 0.0014);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const EXPOSURE = 1.16;

// 잠수자 리그 — 장면을 천천히 통과하며 둘러본다(자유비행 아님).
const diver = new THREE.Object3D();
const spawnPosition = new THREE.Vector3(0, -54, 0);
diver.position.copy(spawnPosition);
scene.add(diver);
diver.add(camera);

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const upVec = new THREE.Vector3();
const move = { forward: 0, back: 0, left: 0, right: 0, up: 0, down: 0, boost: 0 };
const mobileMove = { forward: 0, back: 0, left: 0, right: 0 };

let activeLookButton = null;
let yaw = 0;
let pitch = -0.05;
let started = false;
let composer = null;
let crayonUniforms = null;
const camBob = new THREE.Vector3();
let rollCurrent = 0;

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const motionScale = reducedMotion ? 0.4 : 1;

// 레이어 깊이 밴드(카메라 앞쪽 거리). 전경이 가장 가깝고 빠르게 스쳐 지나간다.
const BANDS = {
  foreground: { depthMin: 60, depthMax: 150, spreadX: 320, spreadY: 220, yMid: -40 },
  mid: { depthMin: 220, depthMax: 460, spreadX: 560, spreadY: 280, yMid: -50 },
  back: { depthMin: 560, depthMax: 960, spreadX: 1100, spreadY: 420, yMid: -60 },
};
const RECYCLE_BEHIND = 40;

const elements = [];
const layerGroup = new THREE.Group();
scene.add(layerGroup);
const renderStatus = { frame: 0, centerPixel: [0, 0, 0, 0], lastSampleAt: -1, webgl: true };
window.__oceanStatus = renderStatus;
document.documentElement.dataset.oceanReady = "1";

// 손그림 텍스처 풀(생성 시 한 번 그려두고 여러 스프라이트가 공유).
const TEX = {};

buildTextures();
setupBackdrop();
setupLayers();
setupControls();
document.documentElement.dataset.oceanElements = String(elements.length);

// ---------------------------------------------------------------------------
// 손그림 텍스처 (캔버스로 직접 그린 컷아웃)
// ---------------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 살짝 떨리는 손그림 곡선을 따라 면을 채운다.
function wobblyShape(ctx, pts, jitter = 1.6) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const jx = (Math.random() - 0.5) * jitter;
    const jy = (Math.random() - 0.5) * jitter;
    if (i === 0) ctx.moveTo(p[0] + jx, p[1] + jy);
    else {
      const prev = pts[i - 1];
      const mx = (prev[0] + p[0]) / 2 + (Math.random() - 0.5) * jitter;
      const my = (prev[1] + p[1]) / 2 + (Math.random() - 0.5) * jitter;
      ctx.quadraticCurveTo(mx, my, p[0] + jx, p[1] + jy);
    }
  }
}

function inkFill(ctx, fill, ink, lineWidth = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function buildTextures() {
  TEX.kelp = [];
  for (let i = 0; i < 4; i += 1) TEX.kelp.push(toTexture(paintKelp(PALETTE.kelp[i % PALETTE.kelp.length])));

  TEX.bubble = toTexture(paintBubble());
  TEX.bubbleSmall = toTexture(paintBubble(0.6));

  // 물고기 떼 — 꼬리 위상이 다른 3장을 손그림 루프 프레임으로.
  TEX.schools = [];
  for (let v = 0; v < 3; v += 1) {
    const frames = [];
    for (let f = 0; f < 3; f += 1) frames.push(toTexture(paintSchool(f / 3)));
    TEX.schools.push(frames);
  }

  // 해파리 — 종(bell) 수축이 다른 3장.
  TEX.jelly = [];
  for (let v = 0; v < 2; v += 1) {
    const frames = [];
    for (let f = 0; f < 3; f += 1) frames.push(toTexture(paintJelly(PALETTE.jelly[v], f / 3)));
    TEX.jelly.push(frames);
  }

  TEX.wave = [];
  for (let i = 0; i < 3; i += 1) TEX.wave.push(toTexture(paintWaveLine()));

  TEX.ray = toTexture(paintGodRay());
  TEX.smallFish = toTexture(paintSmallFish());

  TEX.silhouette = [];
  for (let i = 0; i < 3; i += 1) TEX.silhouette.push(toTexture(paintSilhouette()));
}

// 손그림 해초 한 다발: 굵은 잎이 바닥에서 휘며 올라간다.
function paintKelp(color) {
  const w = 256;
  const h = 512;
  const { c, ctx } = makeCanvas(w, h);
  const blades = 3 + Math.floor(Math.random() * 3);
  for (let b = 0; b < blades; b += 1) {
    const baseX = 60 + Math.random() * (w - 120);
    const sway = (Math.random() - 0.5) * 90;
    const top = 30 + Math.random() * 80;
    const width = 16 + Math.random() * 16;
    const left = [];
    const rightEdge = [];
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const y = h - 10 - t * (h - top);
      const cx = baseX + Math.sin(t * Math.PI) * sway * t;
      const wHere = width * (1 - t * 0.7);
      left.push([cx - wHere, y]);
      rightEdge.push([cx + wHere, y]);
    }
    wobblyShape(ctx, left.concat(rightEdge.reverse()), 2.2);
    ctx.closePath();
    inkFill(ctx, color, PALETTE.ink, 4);
    // 잎맥 한 줄.
    ctx.beginPath();
    ctx.moveTo(baseX, h - 10);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const y = h - 10 - t * (h - top);
      ctx.lineTo(baseX + Math.sin(t * Math.PI) * sway * t, y);
    }
    ctx.strokeStyle = "rgba(15,45,40,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return c;
}

function paintBubble(scale = 1) {
  const s = 128;
  const { c, ctx } = makeCanvas(s, s);
  const r = s * 0.4 * scale;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(220,255,248,0.16)";
  ctx.fill();
  // 하이라이트 호.
  ctx.beginPath();
  ctx.arc(s / 2 - r * 0.32, s / 2 - r * 0.32, r * 0.42, Math.PI * 1.0, Math.PI * 1.6);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.stroke();
  return c;
}

// 한 장에 여러 마리를 그린 "물고기 떼" 컷아웃. tail로 꼬리 위상을 바꿔 프레임화.
function paintSchool(tail) {
  const w = 384;
  const h = 256;
  const { c, ctx } = makeCanvas(w, h);
  const n = 7 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i += 1) {
    const x = 40 + Math.random() * (w - 80);
    const y = 30 + Math.random() * (h - 60);
    const s = 16 + Math.random() * 16;
    const color = PALETTE.fish[Math.floor(Math.random() * PALETTE.fish.length)];
    paintOneFish(ctx, x, y, s, color, tail);
  }
  return c;
}

function paintOneFish(ctx, x, y, s, color, tail) {
  // 몸통 — 둥근 타원.
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
  inkFill(ctx, color, PALETTE.ink, 2.5);
  // 꼬리 — 위상에 따라 흔들리는 삼각형.
  const swing = Math.sin(tail * Math.PI * 2) * s * 0.4;
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, 0);
  ctx.lineTo(-s * 1.7, -s * 0.5 + swing);
  ctx.lineTo(-s * 1.7, s * 0.5 + swing);
  ctx.closePath();
  inkFill(ctx, color, PALETTE.ink, 2.5);
  // 눈.
  ctx.beginPath();
  ctx.arc(s * 0.5, -s * 0.1, s * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  ctx.restore();
}

function paintSmallFish() {
  const { c, ctx } = makeCanvas(128, 96);
  paintOneFish(ctx, 70, 48, 26, PALETTE.fish[Math.floor(Math.random() * PALETTE.fish.length)], 0.25);
  return c;
}

// 해파리 — 반원 종 + 물결치는 촉수. squash로 수축 프레임을 만든다.
function paintJelly(color, squash) {
  const w = 220;
  const h = 300;
  const { c, ctx } = makeCanvas(w, h);
  const cx = w / 2;
  const bellY = 90;
  const bw = 78;
  const bh = 60 - squash * 18;
  ctx.beginPath();
  ctx.ellipse(cx, bellY, bw, bh, 0, Math.PI, 0);
  ctx.lineTo(cx + bw, bellY + 8);
  ctx.quadraticCurveTo(cx, bellY + 24, cx - bw, bellY + 8);
  ctx.closePath();
  inkFill(ctx, color, "rgba(142,58,120,0.9)", 3);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();
  // 촉수 — 물결치는 곡선들.
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i += 1) {
    const tx = cx - bw * 0.7 + (i / 5) * bw * 1.4;
    ctx.beginPath();
    ctx.moveTo(tx, bellY + 16);
    for (let j = 1; j <= 5; j += 1) {
      const ty = bellY + 16 + j * 34;
      const wob = Math.sin(j * 1.3 + i + squash * 6) * 14;
      ctx.lineTo(tx + wob, ty);
    }
    ctx.stroke();
  }
  return c;
}

// 손그림 물결선 — 길게 일렁이는 이중 곡선.
function paintWaveLine() {
  const w = 512;
  const h = 64;
  const { c, ctx } = makeCanvas(w, h);
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.beginPath();
    for (let x = 6; x < w - 6; x += 8) {
      const y = h / 2 + Math.sin(x * 0.03 + pass * 1.4) * 10 + (Math.random() - 0.5) * 2;
      if (x === 6) ctx.moveTo(x, y);
      else ctx.lineTo(x, y + pass * 6);
    }
    ctx.strokeStyle = pass === 0 ? "rgba(255,255,255,0.8)" : "rgba(213,255,245,0.5)";
    ctx.lineWidth = pass === 0 ? 3.5 : 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  return c;
}

// 부드러운 빛기둥.
function paintGodRay() {
  const w = 128;
  const h = 512;
  const { c, ctx } = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,243,200,0.55)");
  g.addColorStop(0.5, "rgba(255,243,200,0.18)");
  g.addColorStop(1, "rgba(255,243,200,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, 0);
  ctx.lineTo(w * 0.68, 0);
  ctx.lineTo(w * 0.92, h);
  ctx.lineTo(w * 0.08, h);
  ctx.closePath();
  ctx.fill();
  return c;
}

// 멀리 있는 깊은 바다 실루엣(바위/수중 구조물의 그림자).
function paintSilhouette() {
  const w = 720;
  const h = 360;
  const { c, ctx } = makeCanvas(w, h);
  const pts = [[0, h]];
  let x = 0;
  while (x < w) {
    const peak = h - 40 - Math.random() * (h - 120);
    pts.push([x, peak]);
    x += 60 + Math.random() * 120;
    pts.push([x, peak + Math.random() * 40]);
  }
  pts.push([w, h]);
  wobblyShape(ctx, pts, 3);
  ctx.closePath();
  ctx.fillStyle = "rgba(16,70,68,0.85)";
  ctx.fill();
  return c;
}

// ---------------------------------------------------------------------------
// 배경(원경) — 손그림 그라디언트 + 수면빛
// ---------------------------------------------------------------------------
function setupBackdrop() {
  const w = 1024;
  const h = 1024;
  const { c, ctx } = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.surface);
  g.addColorStop(0.18, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.shallow);
  g.addColorStop(0.72, PALETTE.mid);
  g.addColorStop(1, PALETTE.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 수면 일렁임 — 위쪽에 손그림 빛 줄.
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineCap = "round";
  for (let i = 0; i < 26; i += 1) {
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath();
    const y = 30 + Math.random() * 150;
    let x = Math.random() * 80;
    ctx.moveTo(x, y);
    while (x < w) {
      x += 30 + Math.random() * 50;
      ctx.lineTo(x, y + (Math.random() - 0.5) * 16);
    }
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = toTexture(c);
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(3600, 3600),
    new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false }),
  );
  backdrop.position.z = -1500;
  backdrop.renderOrder = -10;
  camera.add(backdrop); // 카메라에 붙여 항상 뒤를 채운다.
}

// ---------------------------------------------------------------------------
// 레이어 구성
// ---------------------------------------------------------------------------
function spriteFrom(texture, { blending = THREE.NormalBlending, opacity = 1, bottomAnchor = false } = {}) {
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending, opacity });
  const sprite = new THREE.Sprite(mat);
  if (bottomAnchor) sprite.center.set(0.5, 0);
  layerGroup.add(sprite);
  return sprite;
}

function randIn(min, max) {
  return min + Math.random() * (max - min);
}

function placeInBand(el, band) {
  const u = el.userData;
  u.base.z = diver.position.z - randIn(band.depthMin, band.depthMax);
  u.base.x = diver.position.x + (Math.random() - 0.5) * band.spreadX;
  u.base.y = band.yMid + (Math.random() - 0.5) * band.spreadY;
  u.phase = Math.random() * Math.PI * 2;
  u.frameOff = Math.random() * 3;
}

function addElement(sprite, kind, band, scale, aspect, anim = {}) {
  sprite.userData = {
    kind,
    band,
    base: new THREE.Vector3(),
    scale,
    aspect,
    phase: Math.random() * Math.PI * 2,
    frameOff: Math.random() * 3,
    curFrame: -1,
    ...anim,
  };
  placeInBand(sprite, band);
  sprite.scale.set(scale * aspect, scale, 1);
  elements.push(sprite);
  return sprite;
}

function setupLayers() {
  // ---- 원경(back): 깊은 바다 실루엣, 빛기둥, 멀리 떠다니는 큰 물결 ----
  for (let i = 0; i < 7; i += 1) {
    const s = spriteFrom(TEX.silhouette[i % TEX.silhouette.length], { opacity: 0.9 });
    addElement(s, "silhouette", BANDS.back, randIn(260, 420), 2, { driftX: randIn(-2, 2) });
  }
  for (let i = 0; i < 9; i += 1) {
    const s = spriteFrom(TEX.ray, { blending: THREE.AdditiveBlending, opacity: 0.5 });
    s.material.fog = false;
    addElement(s, "ray", BANDS.back, randIn(380, 620), 0.32, { pulse: randIn(0.2, 0.5), sway: randIn(0.1, 0.3), baseOpacity: 0.5 });
  }

  // ---- 중경(mid): 둥근 물고기 떼, 해파리, 부유 물방울, 부드러운 물결선 ----
  for (let i = 0; i < 10; i += 1) {
    const frames = TEX.schools[i % TEX.schools.length];
    const s = spriteFrom(frames[0]);
    addElement(s, "school", BANDS.mid, randIn(70, 130), 1.5, {
      frames,
      fps: reducedMotion ? 3 : 6,
      driftX: randIn(8, 20) * (Math.random() < 0.5 ? -1 : 1),
      bob: randIn(0.4, 0.8),
      bobAmp: randIn(3, 7),
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const frames = TEX.jelly[i % TEX.jelly.length];
    const s = spriteFrom(frames[0], { opacity: 0.92 });
    addElement(s, "jelly", BANDS.mid, randIn(46, 78), 0.73, {
      frames,
      fps: reducedMotion ? 2 : 4,
      bob: randIn(0.4, 0.7),
      bobAmp: randIn(10, 20),
      sway: randIn(0.2, 0.4),
    });
  }
  for (let i = 0; i < 22; i += 1) {
    const s = spriteFrom(TEX.bubble, { blending: THREE.AdditiveBlending, opacity: 0.7 });
    s.material.fog = false;
    addElement(s, "bubble", BANDS.mid, randIn(4, 12), 1, { rise: randIn(8, 18), sway: randIn(0.4, 0.9), swayAmp: randIn(3, 8) });
  }
  for (let i = 0; i < 10; i += 1) {
    const s = spriteFrom(TEX.wave[i % TEX.wave.length], { blending: THREE.AdditiveBlending, opacity: 0.4 });
    s.material.fog = false;
    addElement(s, "wave", BANDS.mid, randIn(90, 160), 0.13, { driftX: randIn(6, 14) * (Math.random() < 0.5 ? -1 : 1), bob: randIn(0.3, 0.6), bobAmp: randIn(2, 5), baseOpacity: 0.4 });
  }

  // ---- 전경(foreground): 큰 흐릿한 해초 실루엣, 큰 물방울, 가까이 스치는 작은 생물 ----
  for (let i = 0; i < 7; i += 1) {
    const s = spriteFrom(TEX.kelp[i % TEX.kelp.length], { opacity: 0.92, bottomAnchor: true });
    addElement(s, "kelp", BANDS.foreground, randIn(150, 260), 0.5, { sway: randIn(0.5, 0.9), swayAmp: randIn(0.06, 0.12) });
  }
  for (let i = 0; i < 14; i += 1) {
    const s = spriteFrom(TEX.bubble, { blending: THREE.AdditiveBlending, opacity: 0.8 });
    s.material.fog = false;
    addElement(s, "bubble", BANDS.foreground, randIn(14, 30), 1, { rise: randIn(14, 26), sway: randIn(0.5, 1.0), swayAmp: randIn(5, 12) });
  }
  for (let i = 0; i < 6; i += 1) {
    const s = spriteFrom(TEX.smallFish, { opacity: 0.9 });
    addElement(s, "creature", BANDS.foreground, randIn(20, 40), 1.33, { driftX: randIn(22, 40) * (Math.random() < 0.5 ? -1 : 1), bob: randIn(0.6, 1.1), bobAmp: randIn(4, 10) });
  }
}

// ---------------------------------------------------------------------------
// 컨트롤 — 자유비행이 아니라 천천히 헤엄쳐 통과하는 느낌
// ---------------------------------------------------------------------------
function setupControls() {
  window.addEventListener("keydown", setKey);
  window.addEventListener("keyup", setKey);

  canvas.addEventListener("pointerdown", (event) => {
    markStarted();
    if (event.button !== 0 && event.button !== 2) return;
    activeLookButton = event.button;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (activeLookButton === event.button) activeLookButton = null;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    activeLookButton = null;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (activeLookButton === null) return;
    yaw -= event.movementX * 0.0016;
    pitch -= event.movementY * 0.0016;
    yaw = THREE.MathUtils.clamp(yaw, -0.85, 0.85);
    pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.45);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  document.querySelectorAll("[data-fly]").forEach((button) => {
    const direction = button.dataset.fly;
    const set = (value) => {
      mobileMove[direction] = value;
      move[direction] = value;
      if (value) markStarted();
    };
    button.addEventListener("pointerdown", () => set(1));
    button.addEventListener("pointerup", () => set(0));
    button.addEventListener("pointercancel", () => set(0));
    button.addEventListener("pointerleave", () => set(0));
  });

  setTimeout(() => markStarted(), 6500);
}

function markStarted() {
  if (started) return;
  started = true;
  intro?.classList.add("hidden");
  hint?.classList.add("dim");
}

function setKey(event) {
  const value = event.type === "keydown" ? 1 : 0;
  const key = event.key.toLowerCase();
  if (value) markStarted();
  if (event.code === "Space") {
    event.preventDefault();
    move.up = value;
    return;
  }
  if (key === "w") move.forward = value;
  if (key === "s") move.back = value;
  if (key === "a") move.left = value;
  if (key === "d") move.right = value;
  if (key === "c") move.down = value;
  if (key === "shift") move.boost = value;
  if (key === "r" && value) resetView();
}

function resetView() {
  diver.position.copy(spawnPosition);
  yaw = 0;
  pitch = -0.05;
  velocity.set(0, 0, 0);
}

// ---------------------------------------------------------------------------
// 후처리 — 손그림 종이 결을 옅게 덧입힌다(필터가 핵심이 아니라 보조).
// ---------------------------------------------------------------------------
const CrayonShader = {
  uniforms: {
    tDiffuse: { value: null },
    tPaper: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uExposure: { value: EXPOSURE },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPaper;
    uniform vec2 uResolution;
    uniform float uExposure;
    uniform float uAspect;
    varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    vec3 toSRGB(vec3 c){ return pow(clamp(c,0.0,1.0), vec3(0.4545)); }
    void main(){
      vec3 paper = texture2D(tPaper, vUv * vec2(uAspect,1.0) * 2.4).rgb;
      vec2 uv = vUv + (paper.rg-0.5)/uResolution*2.0;
      vec3 col = aces(texture2D(tDiffuse, uv).rgb * uExposure);
      float levels = 7.0;
      col = floor(col*levels + 0.5)/levels;
      float tooth = mix(0.82, 1.06, paper.r);
      col *= tooth;
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }
  `,
};

function makePaperTexture() {
  const { c, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = "#efe7d2";
  ctx.fillRect(0, 0, 512, 512);
  const image = ctx.getImageData(0, 0, 512, 512);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 34;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise * 0.8;
  }
  ctx.putImageData(image, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function setupPostFX() {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const crayonPass = new ShaderPass(CrayonShader);
  crayonPass.uniforms.tPaper.value = makePaperTexture();
  crayonPass.uniforms.uResolution.value.set(size.x * pr, size.y * pr);
  crayonPass.uniforms.uAspect.value = size.x / size.y;
  composer.addPass(crayonPass);
  crayonUniforms = crayonPass.uniforms;
}

// 후처리 셰이더/리소스 정의가 끝난 뒤 초기화하고, 첫 프레임은 rAF로 미뤄
// 모듈 평가가 완료된(모든 const 초기화된) 뒤 tick이 돌게 한다.
setupPostFX();
requestAnimationFrame(animate);

// ---------------------------------------------------------------------------
// 루프
// ---------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  tick(Math.min(clock.getDelta(), 0.05), clock.elapsedTime);
}

function tick(delta, elapsed) {
  updateSwim(delta, elapsed);
  updateElements(delta, elapsed);
  if (composer) composer.render();
  else renderer.render(scene, camera);
  sampleRender(elapsed);
}

window.__oceanTick = (frames = 1) => {
  for (let i = 0; i < frames; i += 1) tick(0.016, clock.elapsedTime + i * 0.016);
};
window.__oceanSample = (cols = 9, rows = 6) => {
  tick(0.016, clock.elapsedTime);
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(4);
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let col = 0; col < cols; col += 1) {
      gl.readPixels(Math.floor((col + 0.5) * (w / cols)), Math.floor((rows - 1 - r + 0.5) * (h / rows)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      line += `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("")} `;
    }
    out.push(line.trim());
  }
  return out;
};

function updateSwim(delta, elapsed) {
  const speedT = THREE.MathUtils.clamp(velocity.length() / 26, 0, 1);

  // 몸을 좌우 이동 방향으로 살짝 기울이고 늘 미세하게 출렁인다.
  const rollTarget = -(move.right - move.left) * 0.04 + Math.sin(elapsed * 0.6) * 0.01;
  rollCurrent += (rollTarget - rollCurrent) * THREE.MathUtils.clamp(delta * 2.2, 0, 1);
  diver.rotation.set(pitch + Math.sin(elapsed * 0.5) * 0.004, yaw, rollCurrent, "YXZ");

  camera.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(diver.quaternion).normalize();
  upVec.set(0, 1, 0).applyQuaternion(diver.quaternion).normalize();

  // 머리 흔들림.
  const bob = 0.3 + speedT * 1.1;
  camBob.lerp(
    new THREE.Vector3(Math.sin(elapsed * 1.3) * (0.25 + speedT * 0.5), Math.sin(elapsed * 2.0) * bob * 0.5 + Math.sin(elapsed * 0.6) * 0.3, 0),
    THREE.MathUtils.clamp(delta * 2.4, 0, 1),
  );
  camera.position.copy(camBob);

  const cruise = 24; // 느린 헤엄
  const boost = move.boost ? 1.7 : 1;
  const desired = new THREE.Vector3();
  desired.addScaledVector(forward, move.forward - move.back);
  desired.addScaledVector(right, move.right - move.left);
  desired.addScaledVector(upVec, move.up - move.down);
  if (desired.lengthSq() > 0) {
    desired.normalize().multiplyScalar(cruise * boost);
    if (desired.y > 0) desired.y *= 1.15;
    velocity.lerp(desired, THREE.MathUtils.clamp(delta * 2.0, 0, 1));
  } else {
    velocity.multiplyScalar(Math.pow(0.5, delta));
    velocity.y += Math.sin(elapsed * 0.5) * delta * 0.8; // 중성 부력 출렁임
  }
  velocity.multiplyScalar(Math.pow(0.84, delta));
  const maxSpeed = 26 * boost;
  if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);
  diver.position.addScaledVector(velocity, delta);
  diver.position.y = THREE.MathUtils.clamp(diver.position.y, -210, 30);
}

function updateElements(delta, elapsed) {
  const scaledDelta = delta * motionScale;
  const t = elapsed * motionScale;
  for (const el of elements) {
    const u = el.userData;
    let ox = 0;
    let oy = 0;

    switch (u.kind) {
      case "kelp":
        // 바닥을 축으로 천천히 휘는 손그림 사이클.
        el.material.rotation = Math.sin(t * u.sway + u.phase) * u.swayAmp;
        break;
      case "bubble":
        u.base.y += u.rise * scaledDelta;
        ox = Math.sin(t * u.sway + u.phase) * u.swayAmp;
        if (u.base.y > diver.position.y + 160) u.base.y = diver.position.y - 160;
        break;
      case "school":
      case "creature":
        u.base.x += u.driftX * scaledDelta;
        oy = Math.sin(t * u.bob + u.phase) * u.bobAmp;
        if (u.driftX > 0 && u.base.x - diver.position.x > u.band.spreadX * 0.6) u.base.x -= u.band.spreadX * 1.2;
        else if (u.driftX < 0 && u.base.x - diver.position.x < -u.band.spreadX * 0.6) u.base.x += u.band.spreadX * 1.2;
        if (el.scale.x > 0 !== u.driftX < 0) el.scale.x = Math.abs(el.scale.x) * (u.driftX < 0 ? 1 : -1);
        break;
      case "jelly":
        oy = Math.sin(t * u.bob + u.phase) * u.bobAmp;
        el.material.rotation = Math.sin(t * u.sway + u.phase) * 0.06;
        break;
      case "wave":
        u.base.x += u.driftX * scaledDelta;
        oy = Math.sin(t * u.bob + u.phase) * u.bobAmp;
        el.material.opacity = u.baseOpacity * (0.6 + 0.4 * Math.sin(t * 0.7 + u.phase));
        if (Math.abs(u.base.x - diver.position.x) > u.band.spreadX * 0.6) u.base.x = diver.position.x - Math.sign(u.driftX) * u.band.spreadX * 0.6;
        break;
      case "ray":
        el.material.opacity = u.baseOpacity * (0.5 + 0.5 * Math.sin(t * u.pulse + u.phase));
        el.material.rotation = Math.sin(t * u.sway + u.phase) * 0.05;
        break;
      case "silhouette":
        u.base.x += u.driftX * scaledDelta;
        break;
      default:
        break;
    }

    // 손그림 프레임 사이클(꼬리 흔들림·해파리 수축).
    if (u.frames) {
      const idx = Math.floor((elapsed * u.fps + u.frameOff)) % u.frames.length;
      if (idx !== u.curFrame) {
        u.curFrame = idx;
        el.material.map = u.frames[idx];
        el.material.needsUpdate = true;
      }
    }

    el.position.set(u.base.x + ox, u.base.y + oy, u.base.z);

    // 카메라 뒤로 지나가면 다시 앞쪽으로 재배치 → 앞으로 헤엄칠수록 새 레이어가 나타난다.
    if (u.base.z - diver.position.z > RECYCLE_BEHIND) {
      placeInBand(el, u.band);
      el.position.copy(u.base);
    } else if (diver.position.z - u.base.z > u.band.depthMax + 300) {
      placeInBand(el, u.band);
    }
  }
}

function sampleRender(elapsed) {
  renderStatus.frame += 1;
  document.documentElement.dataset.oceanFrame = String(renderStatus.frame);
  if (elapsed - renderStatus.lastSampleAt < 0.4) return;
  renderStatus.lastSampleAt = elapsed;
  try {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    renderStatus.centerPixel = Array.from(px);
    document.documentElement.dataset.oceanPixel = renderStatus.centerPixel.join(",");
    document.documentElement.dataset.oceanCalls = String(renderer.info.render.calls);
  } catch {
    renderStatus.webgl = false;
    document.documentElement.dataset.oceanWebgl = "false";
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    const pr = renderer.getPixelRatio();
    composer.setSize(window.innerWidth, window.innerHeight);
    crayonUniforms.uResolution.value.set(window.innerWidth * pr, window.innerHeight * pr);
    crayonUniforms.uAspect.value = window.innerWidth / window.innerHeight;
  }
});
