import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("ocean");
const intro = document.getElementById("intro");
const hint = document.getElementById("hint");

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86e6c2);
scene.fog = new THREE.FogExp2(0x73dcb8, 0.0017);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 4200);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

// 잠수자(1인칭 카메라 리그). 자유롭게 헤엄치며 만화 바다를 둘러본다.
const diver = new THREE.Object3D();
const spawnPosition = new THREE.Vector3(60, -150, 150);
const spawnYaw = 0.16;
const spawnPitch = -0.3;
diver.position.copy(spawnPosition);
scene.add(diver);
diver.add(camera);

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const move = { forward: 0, back: 0, left: 0, right: 0, up: 0, down: 0, boost: 0 };
const mobileMove = { forward: 0, back: 0, left: 0, right: 0 };
const seaFloorBase = -360;
const minDiveY = -540;
const maxDiveY = 40;
const modelBase = "./assets/models/";
const marineModelAssets = {
  fish: { file: "fish.glb", scale: 2.8, rotation: [0, Math.PI / 2, 0] },
  shark: { file: "shark.glb", scale: 8.8, rotation: [0, Math.PI / 2, 0] },
  whale: { file: "whale.glb", scale: 14.5, rotation: [0, Math.PI / 2, 0] },
};
const marineModelCache = new Map();
const gltfLoader = new GLTFLoader();

let activeLookButton = null;
let yaw = spawnYaw;
let pitch = spawnPitch;
let zoomFov = camera.fov;
let started = false;

const renderStatus = { frame: 0, centerPixel: [0, 0, 0, 0], sampleLuma: 0, lastSampleAt: -1, webgl: true };
window.__oceanStatus = renderStatus;
document.documentElement.dataset.oceanReady = "1";

// 만화 바다 속 풍경(랜드마크). 목표/계기판이 아니라 "둘러보는 대상".
const sceneryPieces = [
  { build: makeCoralTown, position: new THREE.Vector3(-30, -248, -150), outline: false },
  { build: makeCoralGate, position: new THREE.Vector3(-190, -236, 70) },
  { build: makeKelpForest, position: new THREE.Vector3(150, -208, -40) },
  { build: makeKelpForest, position: new THREE.Vector3(60, -214, 120) },
  { build: makeShipwreck, position: new THREE.Vector3(250, -286, 150) },
  { build: makeVentSpire, position: new THREE.Vector3(-260, -392, -235) },
  { build: makeGlassTrench, position: new THREE.Vector3(-320, -455, 80) },
  { build: makeAbyssArch, position: new THREE.Vector3(70, -420, 300) },
];

const marineLifeGroup = new THREE.Group();
const cartoonWaterGroup = new THREE.Group();
const sceneryGroup = new THREE.Group();
scene.add(marineLifeGroup);
scene.add(cartoonWaterGroup);
scene.add(sceneryGroup);
const swayingParts = [];
const plumeParts = [];

let plankton;
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const motionScale = reducedMotion ? 0.35 : 1;

const toonGradient = makeToonGradient(4);

function makeToonGradient(steps) {
  const gradientCanvas = document.createElement("canvas");
  gradientCanvas.width = steps;
  gradientCanvas.height = 1;
  const context = gradientCanvas.getContext("2d");
  for (let i = 0; i < steps; i += 1) {
    const value = Math.round(96 + (159 * i) / (steps - 1));
    context.fillStyle = `rgb(${value}, ${value}, ${value})`;
    context.fillRect(i, 0, 1, 1);
  }
  const texture = new THREE.CanvasTexture(gradientCanvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function toonMat({ color, emissive = 0x000000, emissiveIntensity = 0 }) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient, emissive, emissiveIntensity });
}

let waterUniforms = null;
let backdropGroup = null;
let lightShaftGroup = null;
let bubbleField = null;
const causticTextures = [];
const ripplePool = [];
const activeRipples = [];
let nextWakeAt = 0;
const shallowBackground = new THREE.Color(0x9ff0cf);
const midBackground = new THREE.Color(0x5fcfa6);
const deepBackground = new THREE.Color(0x2b9b86);
const surfaceRaycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const surfacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -48);
const surfaceHit = new THREE.Vector3();

setupLights();
setupSeascape();
setupScenery();
setupPlankton();
setupMarineLife();
loadMarineLifeModels();
setupControls();
resetView();
animate();

function setupLights() {
  scene.add(new THREE.AmbientLight(0xe6fff0, 0.74));
  scene.add(new THREE.HemisphereLight(0xfcffe4, 0x4fc59a, 1.32));

  const surfaceLight = new THREE.DirectionalLight(0xfff0c2, 2.2);
  surfaceLight.position.set(-120, 220, -120);
  scene.add(surfaceLight);

  const diverLight = new THREE.SpotLight(0xf4fff2, 2.2, 320, Math.PI / 7, 0.85, 1.2);
  diverLight.position.set(0, -1.2, 0);
  diverLight.target.position.set(0, -4, -120);
  diver.add(diverLight, diverLight.target);

  const rimLight = new THREE.PointLight(0xffcf9d, 1.0, 300, 1.4);
  rimLight.position.set(120, -30, 80);
  scene.add(rimLight);
}

function setupSeascape() {
  scene.add(makePaintedBackdrop());
  scene.add(makeSeafloor());
  scene.add(makeWaterSurface());
  scene.add(makeLightShafts());
  scene.add(makeCartoonWaterDetails());
  scene.add(makeDistantHaze());
  scene.add(makeTerrainRocks());
  scene.add(makeBubbleField());
}

function makeBubbleField() {
  const group = new THREE.Group();
  const bubbleTexture = makeBubbleTexture();
  const count = reducedMotion ? 70 : 130;
  const bubbleMaterial = new THREE.SpriteMaterial({
    map: bubbleTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const bubbles = [];
  for (let i = 0; i < count; i += 1) {
    const bubble = new THREE.Sprite(bubbleMaterial.clone());
    const base = {
      x: (Math.random() - 0.5) * 1500,
      z: (Math.random() - 0.5) * 1500,
      y: -480 + Math.random() * 520,
      speed: 8 + Math.random() * 22,
      sway: 6 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      scale: 1.2 + Math.random() * 2.8,
    };
    bubble.position.set(base.x, base.y, base.z);
    bubble.scale.setScalar(base.scale);
    bubble.material.opacity = 0.3 + Math.random() * 0.45;
    bubble.userData.bubble = base;
    bubbles.push(bubble);
    group.add(bubble);
  }

  group.userData.bubbles = bubbles;
  bubbleField = group;
  return group;
}

function makeBubbleTexture() {
  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = 64;
  bubbleCanvas.height = 64;
  const context = bubbleCanvas.getContext("2d");
  context.clearRect(0, 0, 64, 64);
  context.strokeStyle = "rgba(255, 255, 255, 0.85)";
  context.lineWidth = 2.4;
  context.beginPath();
  context.arc(32, 32, 24, 0, Math.PI * 2);
  context.stroke();
  const highlight = context.createRadialGradient(24, 22, 1, 24, 22, 12);
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = highlight;
  context.beginPath();
  context.arc(24, 22, 12, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(bubbleCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function updateBubbles(elapsed, delta) {
  const scaledDelta = delta * motionScale;
  bubbleField.userData.bubbles.forEach((bubble) => {
    const data = bubble.userData.bubble;
    bubble.position.y += data.speed * scaledDelta;
    bubble.position.x = data.x + Math.sin(elapsed * 0.5 + data.phase) * data.sway;
    if (bubble.position.y > 52) {
      bubble.position.y = -480;
      data.x = (Math.random() - 0.5) * 1500;
      bubble.position.z = (Math.random() - 0.5) * 1500;
    }
  });
}

function makePaintedBackdrop() {
  const group = new THREE.Group();

  const gradientCanvas = document.createElement("canvas");
  gradientCanvas.width = 8;
  gradientCanvas.height = 512;
  const context = gradientCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#e2fbef");
  gradient.addColorStop(0.32, "#f4fff4");
  gradient.addColorStop(0.46, "#a8f2d6");
  gradient.addColorStop(0.7, "#57d0ad");
  gradient.addColorStop(1, "#33a888");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 8, 512);
  const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
  gradientTexture.colorSpace = THREE.SRGBColorSpace;

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 1100),
    new THREE.MeshBasicMaterial({
      map: gradientTexture,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );
  panel.position.set(0, 18, -790);
  panel.userData.baseOpacity = 0.94;
  group.add(panel);

  const horizonLine = makeTubeWave({
    width: 1700,
    amplitude: 10,
    segments: 34,
    radius: 1.6,
    color: 0xffffff,
    opacity: 0.5,
  });
  horizonLine.material.fog = false;
  horizonLine.position.set(0, 128, -760);
  horizonLine.userData.baseOpacity = 0.5;
  group.add(horizonLine);

  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Mesh(new THREE.CircleGeometry(44 + Math.random() * 60, 24), cloudMaterial.clone());
    cloud.position.set(-620 + i * 210 + Math.random() * 60, 196 + Math.random() * 110, -755 - Math.random() * 25);
    cloud.scale.set(1.7 + Math.random() * 0.8, 0.48 + Math.random() * 0.25, 1);
    cloud.userData.baseOpacity = cloud.material.opacity;
    group.add(cloud);
  }

  backdropGroup = group;
  return group;
}

function makeSeafloor() {
  const geometry = new THREE.PlaneGeometry(1850, 1850, 156, 156);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const height =
      Math.sin(x * 0.018) * 5.5 +
      Math.cos(y * 0.015) * 7 +
      Math.sin((x + y) * 0.011) * 4.5 -
      Math.abs(Math.sin(x * 0.004) * Math.cos(y * 0.006)) * 54 +
      seaFloorBase;
    positions.setZ(i, height);
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, toonMat({ color: 0xf2dc96, emissive: 0x8c6f33, emissiveIntensity: 0.16 })));

  const layerSpecs = [
    { y: 1.4, opacity: 0.2, repeat: 7, speed: [0.009, 0.006] },
    { y: 2.3, opacity: 0.13, repeat: 5, speed: [-0.007, 0.01] },
  ];
  layerSpecs.forEach((spec) => {
    const texture = makeCausticTexture();
    texture.repeat.setScalar(spec.repeat);
    texture.userData = { speed: spec.speed };
    causticTextures.push(texture);
    const layer = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xaef9e9,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    layer.position.y = spec.y;
    group.add(layer);
  });

  return group;
}

function makeCausticTexture() {
  const causticCanvas = document.createElement("canvas");
  causticCanvas.width = 256;
  causticCanvas.height = 256;
  const context = causticCanvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, 256, 256);
  context.lineCap = "round";
  for (let i = 0; i < 52; i += 1) {
    context.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.45})`;
    context.lineWidth = 1.8 + Math.random() * 2.2;
    const start = Math.random() * Math.PI * 2;
    context.beginPath();
    context.arc(Math.random() * 256, Math.random() * 256, 9 + Math.random() * 26, start, start + 0.8 + Math.random() * 1.6);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(causticCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeWaterSurface() {
  const geometry = new THREE.PlaneGeometry(2400, 2400, 108, 108);
  waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(0xb6f5d8) },
    uMid: { value: new THREE.Color(0x5fdcc0) },
    uDeep: { value: new THREE.Color(0x36b89e) },
    uSky: { value: new THREE.Color(0xeafbe8) },
    uSun: { value: new THREE.Vector3(-0.42, 0.78, 0.34).normalize() },
  };

  const surface = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        varying float vHeight;

        float waveHeight(vec2 p, float t) {
          float h = sin(p.x * 0.014 + t * 0.7) * 2.6;
          h += sin((p.x + p.y) * 0.021 - t * 0.55) * 1.9;
          h += sin(p.y * 0.017 + t * 0.45) * 2.2;
          h += sin((p.x - p.y * 0.6) * 0.06 + t * 1.4) * 0.55;
          return h;
        }

        void main() {
          vec3 pos = position;
          pos.z += waveHeight(position.xy, uTime);
          vHeight = pos.z;
          vec4 world = modelMatrix * vec4(pos, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uMid;
        uniform vec3 uDeep;
        uniform vec3 uSky;
        uniform vec3 uSun;
        varying vec3 vWorld;
        varying float vHeight;

        void main() {
          vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          vec3 view = normalize(cameraPosition - vWorld);
          if (dot(normal, view) < 0.0) normal = -normal;

          float heightT = clamp(vHeight / 7.6 + 0.5, 0.0, 1.0);
          float band = floor(heightT * 3.0) / 3.0;
          vec3 base = mix(uDeep, uMid, smoothstep(0.0, 0.55, band));
          base = mix(base, uShallow, smoothstep(0.55, 1.0, band));

          float stripe = sin(vWorld.x * 0.045 + sin(vWorld.z * 0.05) * 2.0 - uTime * 0.9);
          base += vec3(0.05, 0.085, 0.075) * smoothstep(0.86, 0.96, stripe);

          float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 2.5);
          base = mix(base, uSky, fresnel * 0.55);

          float spec = max(dot(reflect(-uSun, normal), view), 0.0);
          float glint = step(0.965, spec) * 0.85 + smoothstep(0.8, 0.96, spec) * 0.22;
          base += vec3(1.0, 0.97, 0.84) * glint;

          float foamEdge = heightT
            + sin(vWorld.x * 0.12 + uTime * 1.3) * 0.05
            + sin(vWorld.z * 0.1 - uTime * 0.9) * 0.04;
          float foam = smoothstep(0.8, 0.85, foamEdge);
          base = mix(base, vec3(1.0), foam * 0.88);

          float horizonFade = 1.0 - smoothstep(680.0, 1150.0, distance(vWorld.xz, cameraPosition.xz));
          float alpha = (gl_FrontFacing ? 0.88 : 0.58) * horizonFade;
          gl_FragColor = vec4(base, alpha);
        }
      `,
    }),
  );
  surface.position.y = 48;
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 2;
  return surface;
}

function makeRippleMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 42),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function spawnRipple(position, { size = 26, strength = 1, color = 0xffffff, delay = 0 } = {}) {
  if (activeRipples.length > 24) return;
  const ripple = ripplePool.pop() ?? makeRippleMesh();
  ripple.position.copy(position);
  ripple.material.color.set(color);
  ripple.material.opacity = 0;
  ripple.scale.setScalar(0.01);
  ripple.userData.ripple = { age: -delay, life: 1.35, size, strength };
  scene.add(ripple);
  activeRipples.push(ripple);
}

function spawnSurfaceSplash(point, strength = 1) {
  const splashPoint = new THREE.Vector3(point.x, 48.6, point.z);
  spawnRipple(splashPoint, { size: 30 * strength, strength });
  spawnRipple(splashPoint, { size: 18 * strength, strength: strength * 0.8, delay: 0.16 });
}

function updateRipples(delta) {
  for (let i = activeRipples.length - 1; i >= 0; i -= 1) {
    const ripple = activeRipples[i];
    const data = ripple.userData.ripple;
    data.age += delta;
    if (data.age < 0) continue;
    const t = data.age / data.life;
    if (t >= 1) {
      scene.remove(ripple);
      activeRipples.splice(i, 1);
      ripplePool.push(ripple);
      continue;
    }
    const eased = 1 - (1 - t) * (1 - t);
    ripple.scale.setScalar(0.01 + eased * data.size);
    ripple.material.opacity = (1 - t) * 0.8 * data.strength;
  }
}

function makeLightShafts() {
  const group = new THREE.Group();
  // 포뇨풍 빛기둥: 수면에서 살짝 부채꼴로 퍼지며 거의 수직으로 내려오는 따뜻한 광선.
  const shaftColors = [0xfff4cf, 0xfdebbf, 0xffe6ea, 0xeaffd9, 0xfff0d2];
  const ringCount = 22;

  for (let i = 0; i < ringCount; i += 1) {
    const color = shaftColors[i % shaftColors.length];
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(10 + Math.random() * 14, 34 + Math.random() * 30, 900, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.028 + Math.random() * 0.03,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );

    const angle = (i / ringCount) * Math.PI * 2 + Math.random() * 0.3;
    const startRadius = 80 + Math.random() * 540;
    const top = new THREE.Vector3(-120 + Math.cos(angle) * startRadius, 80, -160 + Math.sin(angle) * startRadius * 0.85);
    const floorTarget = top.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, -760, (Math.random() - 0.5) * 120));
    const mid = top.clone().lerp(floorTarget, 0.5);
    shaft.position.copy(mid);
    shaft.lookAt(floorTarget);
    shaft.rotateX(Math.PI / 2);
    shaft.userData.shaft = { phase: Math.random() * Math.PI * 2, baseOpacity: shaft.material.opacity };
    group.add(shaft);
  }

  lightShaftGroup = group;
  return group;
}

function makeCartoonWaterDetails() {
  cartoonWaterGroup.clear();

  const bigWaveSpecs = [
    { width: 1050, amplitude: 22, radius: 3.1, y: 42, z: -470, opacity: 0.7, speed: 0.22, drift: 12 },
    { width: 880, amplitude: 18, radius: 2.5, y: 25, z: -280, opacity: 0.56, speed: 0.28, drift: -9 },
    { width: 720, amplitude: 14, radius: 2.05, y: 8, z: -90, opacity: 0.44, speed: 0.34, drift: 7 },
    { width: 960, amplitude: 20, radius: 2.3, y: 38, z: 180, opacity: 0.5, speed: 0.24, drift: -11 },
  ];
  bigWaveSpecs.forEach((spec, index) => {
    const wave = makeTubeWave({
      width: spec.width,
      amplitude: spec.amplitude,
      segments: 42,
      radius: spec.radius,
      color: 0xfafff8,
      opacity: spec.opacity,
    });
    wave.position.set((index % 2 === 0 ? -1 : 1) * 40, spec.y, spec.z);
    wave.userData.bigWave = { baseX: wave.position.x, baseY: spec.y, phase: index * 1.7, speed: spec.speed, drift: spec.drift };
    cartoonWaterGroup.add(wave);
  });

  const waveMaterial = new THREE.LineBasicMaterial({ color: 0xf3fffb, transparent: true, opacity: 0.46 });
  for (let i = 0; i < 14; i += 1) {
    const points = [];
    const width = 70 + Math.random() * 120;
    const baseX = (Math.random() - 0.5) * 950;
    const baseZ = -460 + Math.random() * 920;
    const baseY = 18 + Math.random() * 28;
    for (let j = 0; j < 18; j += 1) {
      const t = j / 17;
      points.push(
        new THREE.Vector3(
          baseX + (t - 0.5) * width,
          baseY + Math.sin(t * Math.PI * 2) * (1.2 + Math.random() * 0.5),
          baseZ + Math.sin(t * Math.PI) * (6 + Math.random() * 4),
        ),
      );
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), waveMaterial.clone());
    line.userData.wave = { baseY, phase: Math.random() * Math.PI * 2, speed: 0.35 + Math.random() * 0.45, drift: 3 + Math.random() * 7 };
    cartoonWaterGroup.add(line);
  }

  const sparkleMaterial = makeSparkleMaterial();
  for (let i = 0; i < 28; i += 1) {
    const sparkle = new THREE.Sprite(sparkleMaterial.clone());
    sparkle.position.set((Math.random() - 0.5) * 1050, 14 + Math.random() * 38, (Math.random() - 0.5) * 980);
    sparkle.scale.setScalar(2.5 + Math.random() * 5);
    sparkle.material.opacity = 0.26 + Math.random() * 0.38;
    sparkle.userData.sparkle = { phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.1 };
    cartoonWaterGroup.add(sparkle);
  }

  const foamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i += 1) {
    const foam = new THREE.Mesh(new THREE.RingGeometry(2 + Math.random() * 2, 2.3 + Math.random() * 3.5, 18), foamMaterial.clone());
    foam.position.set((Math.random() - 0.5) * 980, -8 + Math.random() * 34, (Math.random() - 0.5) * 940);
    foam.rotation.x = -Math.PI / 2;
    foam.userData.foam = { phase: Math.random() * Math.PI * 2, speed: 0.18 + Math.random() * 0.28 };
    cartoonWaterGroup.add(foam);
  }

  return cartoonWaterGroup;
}

function makeTubeWave({ width, amplitude, segments, radius, color, opacity }) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    points.push(
      new THREE.Vector3(
        (t - 0.5) * width,
        Math.sin(t * Math.PI * 2) * amplitude * 0.52 + Math.sin(t * Math.PI * 4) * amplitude * 0.22,
        Math.cos(t * Math.PI * 2) * amplitude * 0.12,
      ),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments * 2, radius, 8, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

function makeSparkleMaterial() {
  const sparkleCanvas = document.createElement("canvas");
  sparkleCanvas.width = 48;
  sparkleCanvas.height = 48;
  const context = sparkleCanvas.getContext("2d");
  context.clearRect(0, 0, 48, 48);
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(24, 8);
  context.quadraticCurveTo(25, 22, 40, 24);
  context.quadraticCurveTo(25, 26, 24, 40);
  context.quadraticCurveTo(23, 26, 8, 24);
  context.quadraticCurveTo(23, 22, 24, 8);
  context.stroke();
  const texture = new THREE.CanvasTexture(sparkleCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
}

function makeDistantHaze() {
  const geometry = new THREE.BufferGeometry();
  const count = 460;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = ["#c9fff0", "#ffd6ba", "#baf0d5", "#bfeeff", "#fff3bc"];

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const radius = 240 + Math.random() * 820;
    const angle = Math.random() * Math.PI * 2;
    positions[index] = Math.cos(angle) * radius;
    positions[index + 1] = -520 + Math.random() * 610;
    positions[index + 2] = Math.sin(angle) * radius;

    const color = new THREE.Color(palette[i % palette.length]).multiplyScalar(0.34 + Math.random() * 0.35);
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 5.8, vertexColors: true, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
}

function makeTerrainRocks() {
  const group = new THREE.Group();
  const material = toonMat({ color: 0x86b7d6, emissive: 0x2c5d80, emissiveIntensity: 0.14 });

  for (let i = 0; i < 90; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random() * 8, 0), material);
    const x = (Math.random() - 0.5) * 1450;
    const z = (Math.random() - 0.5) * 1450;
    rock.position.set(x, terrainHeight(x, z) + 1.5, z);
    rock.scale.set(1.2 + Math.random() * 2.5, 0.55 + Math.random() * 1.4, 1 + Math.random() * 2);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(rock);
  }

  return group;
}

function setupScenery() {
  sceneryPieces.forEach((piece) => {
    const group = new THREE.Group();
    group.position.copy(piece.position);
    piece.build(group);
    if (piece.outline !== false) addCartoonOutline(group, 1.045, 0x2a7592, 24);
    sceneryGroup.add(group);
  });
}

// 레퍼런스의 산호 마을: 따뜻한 모래색 탑이 층층이 쌓이고 아치형 창이 늘어선 동화풍 건물.
function makeCoralTown(group) {
  const sand = toonMat({ color: 0xf0cd86, emissive: 0x8a6a2e, emissiveIntensity: 0.2 });
  const sandLight = toonMat({ color: 0xfbe2a6, emissive: 0x9a7a3a, emissiveIntensity: 0.2 });
  const windowMat = toonMat({ color: 0x2c6f6a, emissive: 0x0d2f2c, emissiveIntensity: 0.55 });

  const mound = new THREE.Mesh(new THREE.SphereGeometry(64, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2), sand);
  mound.scale.y = 0.5;
  mound.position.y = -22;
  group.add(mound);

  const tiers = [
    { r: 44, h: 26, y: -6 },
    { r: 34, h: 22, y: 18 },
    { r: 25, h: 18, y: 38 },
    { r: 17, h: 15, y: 56 },
  ];
  tiers.forEach((tier, ti) => {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(tier.r, tier.r * 1.07, tier.h, 24), ti % 2 ? sandLight : sand);
    drum.position.y = tier.y;
    group.add(drum);

    const windowCount = Math.max(6, Math.round(tier.r / 4));
    for (let w = 0; w < windowCount; w += 1) {
      const a = (w / windowCount) * Math.PI * 2;
      const win = new THREE.Mesh(new THREE.BoxGeometry(4.2, tier.h * 0.52, 3.4), windowMat);
      win.position.set(Math.cos(a) * tier.r * 1.02, tier.y, Math.sin(a) * tier.r * 1.02);
      win.rotation.y = Math.PI / 2 - a;
      group.add(win);

      const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 10, 1, false, 0, Math.PI), ti % 2 ? sandLight : sand);
      arch.position.set(Math.cos(a) * tier.r * 1.02, tier.y + tier.h * 0.28, Math.sin(a) * tier.r * 1.02);
      arch.rotation.set(Math.PI / 2, 0, Math.PI / 2 - a);
      group.add(arch);
    }
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(17, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), sandLight);
  dome.position.y = 63;
  group.add(dome);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(3.2, 14, 10), toonMat({ color: 0xff8a70, emissive: 0x7c2c20, emissiveIntensity: 0.4 }));
  knob.position.y = 82;
  group.add(knob);

  // 마을을 두른 알록달록한 산호·말미잘.
  const coralColors = [0xff8a70, 0xff6f9c, 0xffd27a, 0x8a7bff, 0x5fd6c0, 0xff9ad8];
  for (let i = 0; i < 46; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * 36;
    const c = coralColors[i % coralColors.length];
    const coral = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 + Math.random() * 2, 5 + Math.random() * 11, 6),
      toonMat({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.22), emissiveIntensity: 0.32 }),
    );
    coral.position.set(Math.cos(a) * r, -18 + Math.random() * 8, Math.sin(a) * r);
    coral.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.45);
    group.add(coral);
  }
}

function makeCoralGate(group) {
  const coralMaterial = toonMat({ color: 0xff8a70, emissive: 0x7c2c20, emissiveIntensity: 0.3 });
  const rockMaterial = toonMat({ color: 0x7a93a3, emissive: 0x2a3c46, emissiveIntensity: 0.12 });
  const left = new THREE.Mesh(new THREE.CylinderGeometry(7, 12, 42, 8), rockMaterial);
  const rightRock = left.clone();
  left.position.set(-18, 2, 0);
  rightRock.position.set(18, 2, 0);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(18, 3.2, 12, 80, Math.PI), rockMaterial);
  cap.position.y = 22;
  cap.rotation.z = Math.PI;
  group.add(left, rightRock, cap);

  for (let i = 0; i < 26; i += 1) {
    const coral = new THREE.Mesh(new THREE.ConeGeometry(1.1 + Math.random() * 1.7, 5 + Math.random() * 8, 7), coralMaterial);
    coral.position.set((Math.random() - 0.5) * 54, -13 + Math.random() * 18, (Math.random() - 0.5) * 24);
    coral.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
    group.add(coral);
  }
}

function makeKelpForest(group) {
  const stalkMaterial = toonMat({ color: 0x3f9a4f, emissive: 0x123a18, emissiveIntensity: 0.35 });
  const leafMaterial = new THREE.MeshBasicMaterial({ color: 0x2f8a3e, transparent: true, opacity: 0.82, side: THREE.DoubleSide });

  for (let i = 0; i < 52; i += 1) {
    const height = 28 + Math.random() * 48;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, height, 8), stalkMaterial);
    stalk.position.set((Math.random() - 0.5) * 86, height / 2 - 18, (Math.random() - 0.5) * 58);
    stalk.rotation.z = (Math.random() - 0.5) * 0.22;
    stalk.userData.wavePhase = Math.random() * Math.PI * 2;
    swayingParts.push(stalk);
    group.add(stalk);

    for (let j = 0; j < 3; j += 1) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4, 12), leafMaterial);
      leaf.position.set(stalk.position.x + (Math.random() - 0.5) * 5, stalk.position.y + height * (0.1 + j * 0.18), stalk.position.z);
      leaf.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.8);
      leaf.userData.wavePhase = stalk.userData.wavePhase + j;
      swayingParts.push(leaf);
      group.add(leaf);
    }
  }
}

function makeShipwreck(group) {
  const hullMaterial = toonMat({ color: 0xa06a40, emissive: 0x33180c, emissiveIntensity: 0.2 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(58, 13, 20), hullMaterial);
  hull.position.y = -7;
  hull.rotation.set(0.04, -0.42, -0.16);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(10, 24, 4), hullMaterial);
  bow.position.set(37, -7, -9);
  bow.rotation.set(0, 0, Math.PI / 2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 42, 10), hullMaterial);
  mast.position.set(-8, 12, 0);
  mast.rotation.z = -0.24;
  group.add(hull, bow, mast);

  for (let i = 0; i < 11; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 1.2), hullMaterial);
    rib.position.set(-26 + i * 5, 0, 10);
    rib.rotation.z = -0.35 + Math.random() * 0.12;
    group.add(rib);
  }
}

function makeVentSpire(group) {
  const rockMaterial = toonMat({ color: 0x3c4a52, emissive: 0x17100a, emissiveIntensity: 0.3 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false });

  for (let i = 0; i < 7; i += 1) {
    const height = 18 + Math.random() * 32;
    const vent = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 4, height, 9), rockMaterial);
    vent.position.set((Math.random() - 0.5) * 38, height / 2 - 18, (Math.random() - 0.5) * 34);
    group.add(vent);

    const plume = new THREE.Mesh(new THREE.CylinderGeometry(6, 2, 58, 18, 1, true), glowMaterial);
    plume.position.set(vent.position.x, vent.position.y + height * 0.55, vent.position.z);
    plumeParts.push(plume);
    group.add(plume);
  }
}

function makeGlassTrench(group) {
  const wallMaterial = toonMat({ color: 0x2a5d73, emissive: 0x0b333d, emissiveIntensity: 0.4 });
  for (let i = 0; i < 18; i += 1) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random() * 16, 38 + Math.random() * 46, 12), wallMaterial);
    const side = i % 2 === 0 ? -1 : 1;
    wall.position.set(side * (24 + Math.random() * 16), -4 + Math.random() * 4, -72 + i * 8);
    wall.rotation.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.2);
    group.add(wall);
  }
}

function makeAbyssArch(group) {
  const material = toonMat({ color: 0x6c6c92, emissive: 0x1c1933, emissiveIntensity: 0.3 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(30, 5, 18, 96), material);
  arch.rotation.y = Math.PI / 2;
  arch.position.y = 8;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(34, 44, 10, 14), material);
  base.position.y = -18;
  group.add(arch, base);
}

function setupPlankton() {
  const geometry = new THREE.BufferGeometry();
  const count = 1300;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorA = new THREE.Color("#aef7d6");
  const colorB = new THREE.Color("#ffe6a8");

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    positions[index] = (Math.random() - 0.5) * 250;
    positions[index + 1] = (Math.random() - 0.5) * 150;
    positions[index + 2] = (Math.random() - 0.5) * 250;
    const color = colorA.clone().lerp(colorB, Math.random() * 0.4);
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  plankton = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  plankton.name = "localPlankton";
  diver.add(plankton);
}

function setupMarineLife() {
  // 니모풍 산호색·청록·남색 물고기 떼. 일부는 산호 마을 주변에 모여 헤엄친다.
  const fishPalette = [0xff8a5c, 0xffb347, 0xff6f61, 0x5fd6c0, 0x4aa3d9, 0x3b6fb0, 0xffd27a, 0xff7fa8];
  const townCenter = sceneryPieces[0].position;
  for (let i = 0; i < 90; i += 1) {
    const fish = makeFish(0.7 + Math.random() * 1.7, fishPalette[Math.floor(Math.random() * fishPalette.length)]);
    fish.userData.modelKind = "fish";
    const nearTown = i % 2 === 0;
    placeSwimmer(fish, {
      center: nearTown
        ? townCenter.clone().add(new THREE.Vector3((Math.random() - 0.5) * 160, 40 + Math.random() * 90, (Math.random() - 0.5) * 160))
        : null,
      radius: nearTown ? 40 + Math.random() * 120 : 120 + Math.random() * 560,
      y: -70 - Math.random() * 310,
      speed: 0.12 + Math.random() * 0.24,
      bob: 3 + Math.random() * 9,
      phase: Math.random() * Math.PI * 2,
    });
    marineLifeGroup.add(fish);
  }

  for (let i = 0; i < 5; i += 1) {
    const shark = makeShark(5.5 + Math.random() * 2.8);
    shark.userData.modelKind = "shark";
    placeSwimmer(shark, { radius: 240 + Math.random() * 520, y: -150 - Math.random() * 260, speed: 0.08 + Math.random() * 0.08, bob: 6 + Math.random() * 12, phase: Math.random() * Math.PI * 2, predator: true });
    marineLifeGroup.add(shark);
  }

  for (let i = 0; i < 6; i += 1) {
    const jelly = makeJellyfish(3.2 + Math.random() * 3);
    jelly.userData.modelKind = "jelly";
    placeSwimmer(jelly, { radius: 60 + Math.random() * 320, y: -110 - Math.random() * 230, speed: 0.04 + Math.random() * 0.05, bob: 18 + Math.random() * 22, phase: Math.random() * Math.PI * 2, jelly: true });
    marineLifeGroup.add(jelly);
  }

  for (let i = 0; i < 2; i += 1) {
    const whale = makeOceanWhale(13 + Math.random() * 5);
    whale.userData.modelKind = "whale";
    placeSwimmer(whale, { radius: 390 + Math.random() * 380, y: -230 - Math.random() * 230, speed: 0.035 + Math.random() * 0.025, bob: 14 + Math.random() * 18, phase: Math.random() * Math.PI * 2, whale: true });
    marineLifeGroup.add(whale);
  }
  document.documentElement.dataset.oceanLife = String(marineLifeGroup.children.length);
}

function loadMarineLifeModels() {
  Object.entries(marineModelAssets).forEach(([kind, asset]) => {
    gltfLoader.load(
      `${modelBase}${asset.file}`,
      (gltf) => {
        const template = normalizeMarineModel(gltf.scene, asset);
        marineModelCache.set(kind, template);
        replaceMarineFallbacks(kind, template);
        document.documentElement.dataset.oceanModelsLoaded = String(marineModelCache.size);
      },
      undefined,
      () => {
        document.documentElement.dataset.oceanModelFallback = "1";
      },
    );
  });
}

function normalizeMarineModel(sceneObject, asset) {
  const model = sceneObject.clone(true);
  model.scale.setScalar(asset.scale);
  model.rotation.set(...asset.rotation);
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    if (child.material) {
      child.material = new THREE.MeshToonMaterial({
        color: child.material.color?.clone() ?? new THREE.Color(0xffffff),
        map: child.material.map ?? null,
        gradientMap: toonGradient,
      });
    }
  });
  addCartoonOutline(model, 1.035, 0x287c91, 36);
  return model;
}

function replaceMarineFallbacks(kind, template) {
  marineLifeGroup.children.forEach((creature) => {
    if (creature.userData.modelKind !== kind || creature.userData.externalModelApplied) return;
    const keep = { swim: creature.userData.swim, modelKind: creature.userData.modelKind };
    creature.clear();
    creature.add(template.clone(true));
    creature.userData.swim = keep.swim;
    creature.userData.modelKind = keep.modelKind;
    creature.userData.externalModelApplied = true;
    creature.userData.tail = null;
    creature.userData.flukes = null;
  });
}

function placeSwimmer(group, data) {
  group.userData.swim = {
    center: data.center ?? new THREE.Vector3((Math.random() - 0.5) * 420, data.y, (Math.random() - 0.5) * 420),
    radius: data.radius,
    speed: data.speed,
    bob: data.bob,
    phase: data.phase,
    predator: data.predator ?? false,
    whale: data.whale ?? false,
    jelly: data.jelly ?? false,
  };
}

function makeFish(size, color) {
  const group = new THREE.Group();
  const bodyMaterial = toonMat({ color, emissive: new THREE.Color(color).multiplyScalar(0.14), emissiveIntensity: 0.25 });
  const finMaterial = new THREE.MeshBasicMaterial({ color: 0xd7fff4, transparent: true, opacity: 0.58, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 10), bodyMaterial);
  body.scale.set(1.8, 0.62, 0.72);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.72, size * 1.8, 3), finMaterial);
  tail.position.x = -size * 2.1;
  tail.rotation.z = Math.PI / 2;
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(size * 0.42, size * 0.95, 3), finMaterial);
  dorsal.position.y = size * 0.66;
  dorsal.rotation.x = Math.PI;
  group.add(body, tail, dorsal);
  group.userData.tail = tail;
  addCartoonOutline(group, 1.08, 0x267890, 1);
  return group;
}

function makeShark(size) {
  const group = new THREE.Group();
  const material = toonMat({ color: 0x9fb9c9, emissive: 0x16262e, emissiveIntensity: 0.26 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 14), material);
  body.scale.set(2.45, 0.54, 0.62);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.48, size * 2.0, 18), material);
  nose.position.x = size * 2.35;
  nose.rotation.z = -Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.68, size * 1.8, 3), material);
  tail.position.x = -size * 2.75;
  tail.rotation.z = Math.PI / 2;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(size * 0.45, size * 1.15, 3), material);
  fin.position.y = size * 0.68;
  fin.rotation.x = Math.PI;
  group.add(body, nose, tail, fin);
  group.userData.tail = tail;
  addCartoonOutline(group, 1.045, 0x276f84, 3);
  return group;
}

function makeJellyfish(size) {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(size, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat({ color: 0xf2a0d8, emissive: 0x8e3a78, emissiveIntensity: 0.45 }),
  );
  dome.scale.y = 0.82;
  const skirt = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.96, size * 0.7, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc4ec, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
  );
  skirt.position.y = -size * 0.3;
  skirt.rotation.x = Math.PI;
  group.add(dome, skirt);

  const tentacleMaterial = new THREE.LineBasicMaterial({ color: 0xffb7e6, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const points = [];
    for (let j = 0; j <= 6; j += 1) {
      const t = j / 6;
      points.push(new THREE.Vector3(Math.cos(angle) * size * 0.5 + Math.sin(t * Math.PI * 2 + i) * 0.5, -t * size * 2.4, Math.sin(angle) * size * 0.5));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), tentacleMaterial.clone()));
  }
  group.userData.dome = dome;
  addCartoonOutline(dome, 1.07, 0x7c2f6b, 1);
  return group;
}

function makeOceanWhale(size) {
  const group = new THREE.Group();
  const material = toonMat({ color: 0x6788a3, emissive: 0x14202e, emissiveIntensity: 0.22 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 18), material);
  body.scale.set(2.75, 0.72, 0.82);
  const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.98, 28, 16), material);
  head.scale.set(1.36, 0.9, 0.88);
  head.position.x = size * 2.08;
  const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.22, size * 0.45, size * 2.2, 12), material);
  tailStem.position.x = -size * 2.85;
  tailStem.rotation.z = Math.PI / 2;
  const flukeA = new THREE.Mesh(new THREE.ConeGeometry(size * 0.72, size * 1.55, 3), material);
  flukeA.position.set(-size * 3.92, size * 0.34, 0);
  flukeA.rotation.set(0, 0, Math.PI / 2.45);
  const flukeB = flukeA.clone();
  flukeB.position.y = -size * 0.34;
  flukeB.rotation.z = Math.PI - Math.PI / 2.45;
  const finA = new THREE.Mesh(new THREE.ConeGeometry(size * 0.36, size * 1.8, 3), material);
  finA.position.set(size * 0.45, -size * 0.38, size * 0.9);
  finA.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  const finB = finA.clone();
  finB.position.z = -size * 0.9;
  finB.rotation.x = -Math.PI / 2;
  group.add(body, head, tailStem, flukeA, flukeB, finA, finB);
  group.userData.tail = tailStem;
  group.userData.flukes = [flukeA, flukeB];
  addCartoonOutline(group, 1.032, 0x2a647e, 4);
  return group;
}

function addCartoonOutline(root, scale = 1.04, color = 0x1d4f66, maxMeshes = 48) {
  const outlineMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false });
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh && !child.userData.outline) meshes.push(child);
  });
  meshes.slice(0, maxMeshes).forEach((mesh) => {
    const outline = new THREE.Mesh(mesh.geometry, outlineMaterial.clone());
    outline.userData.outline = true;
    outline.position.set(0, 0, 0);
    outline.rotation.set(0, 0, 0);
    outline.scale.setScalar(scale);
    outline.renderOrder = -1;
    mesh.add(outline);
  });
}

function setupControls() {
  window.addEventListener("keydown", setKey);
  window.addEventListener("keyup", setKey);

  canvas.addEventListener("pointerdown", (event) => {
    markStarted();
    if (event.button !== 0 && event.button !== 2) return;
    activeLookButton = event.button;
    canvas.setPointerCapture(event.pointerId);

    pointerNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    surfaceRaycaster.setFromCamera(pointerNdc, camera);
    if (surfaceRaycaster.ray.intersectPlane(surfacePlane, surfaceHit) && surfaceHit.distanceTo(diver.position) < 1300) {
      spawnSurfaceSplash(surfaceHit, 1);
    }
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
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0022;
    pitch = THREE.MathUtils.clamp(pitch, -1.1, 1.05);
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoomFov = THREE.MathUtils.clamp(zoomFov + Math.sign(event.deltaY) * 4, 40, 82);
      camera.fov = zoomFov;
      camera.updateProjectionMatrix();
    },
    { passive: false },
  );

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

  // 인트로는 잠시 후 저절로 사라진다.
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
  yaw = spawnYaw;
  pitch = spawnPitch;
  velocity.set(0, 0, 0);
}

function tick(delta, elapsed) {
  updateScenery(elapsed);
  updateWaterStyle(elapsed, delta);
  updateCartoonWater(elapsed, delta);
  updateMarineLife(elapsed, delta);
  updateSwim(delta, elapsed);
  renderer.render(scene, camera);
  sampleRender(elapsed);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  tick(delta, clock.elapsedTime);
}

// 백그라운드 탭(미리보기)에서 rAF가 멈춰도 한 프레임 강제 렌더하기 위한 검증용 훅.
window.__oceanTick = (frames = 1) => {
  for (let i = 0; i < frames; i += 1) tick(0.016, clock.elapsedTime + i * 0.016);
};

// 스크린샷이 불가능한 환경에서 렌더 버퍼를 격자로 샘플링해 구도를 확인하기 위한 검증용 훅.
window.__oceanSample = (cols = 9, rows = 6) => {
  tick(0.016, clock.elapsedTime);
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const pixel = new Uint8Array(4);
  const rowsOut = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let c = 0; c < cols; c += 1) {
      const x = Math.floor((c + 0.5) * (w / cols));
      const y = Math.floor((rows - 1 - r + 0.5) * (h / rows));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      line += `#${[pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, "0")).join("")} `;
    }
    rowsOut.push(line.trim());
  }
  return rowsOut;
};

function updateScenery(elapsed) {
  for (const part of swayingParts) {
    part.rotation.z += Math.sin(elapsed * 1.1 + part.userData.wavePhase) * 0.0011;
  }
  for (const plume of plumeParts) {
    plume.rotation.y += 0.006;
    plume.material.opacity = 0.16 + Math.sin(elapsed * 1.7 + plume.position.x) * 0.05;
  }
  if (plankton) {
    plankton.rotation.y = Math.sin(elapsed * 0.22) * 0.08;
    plankton.rotation.x = Math.cos(elapsed * 0.18) * 0.04;
    plankton.material.opacity = THREE.MathUtils.clamp(0.38 + velocity.length() * 0.02, 0.38, 0.7);
  }
}

function updateWaterStyle(elapsed, delta) {
  if (waterUniforms) waterUniforms.uTime.value = elapsed * motionScale;

  causticTextures.forEach((texture) => {
    texture.offset.x += texture.userData.speed[0] * delta * motionScale * 2.5;
    texture.offset.y += texture.userData.speed[1] * delta * motionScale * 2.5;
  });

  const depthT = THREE.MathUtils.clamp((-diver.position.y - 20) / 460, 0, 1);
  if (depthT < 0.5) {
    scene.background.lerpColors(shallowBackground, midBackground, depthT / 0.5);
  } else {
    scene.background.lerpColors(midBackground, deepBackground, (depthT - 0.5) / 0.5);
  }
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.0015 + depthT * 0.0009;

  if (backdropGroup) {
    const fade = 1 - depthT * 0.72;
    backdropGroup.children.forEach((child) => {
      if (child.userData.baseOpacity !== undefined) child.material.opacity = child.userData.baseOpacity * fade;
    });
  }

  if (lightShaftGroup) {
    lightShaftGroup.children.forEach((shaft) => {
      const data = shaft.userData.shaft;
      shaft.material.opacity = data.baseOpacity * (0.6 + Math.sin(elapsed * 0.6 + data.phase) * 0.4);
    });
  }

  if (bubbleField) updateBubbles(elapsed, delta);

  if (diver.position.y > 14 && velocity.length() > 14 && elapsed > nextWakeAt) {
    nextWakeAt = elapsed + 0.55;
    spawnSurfaceSplash(diver.position, 0.55);
  }

  updateRipples(delta);
}

function updateCartoonWater(elapsed, delta) {
  const scaledDelta = delta * motionScale;
  cartoonWaterGroup.children.forEach((object) => {
    if (object.userData.bigWave) {
      const wave = object.userData.bigWave;
      object.position.x = wave.baseX + Math.sin(elapsed * wave.speed + wave.phase) * wave.drift;
      object.position.y = wave.baseY + Math.sin(elapsed * wave.speed * 0.8 + wave.phase) * 2.2;
      object.material.opacity = THREE.MathUtils.clamp(object.material.opacity + Math.sin(elapsed * 0.5 + wave.phase) * 0.0008, 0.28, 0.7);
    }

    if (object.userData.wave) {
      const wave = object.userData.wave;
      object.position.x = Math.sin(elapsed * wave.speed + wave.phase) * wave.drift;
      object.position.y = Math.sin(elapsed * wave.speed * 0.7 + wave.phase) * 1.6;
      object.material.opacity = 0.34 + Math.sin(elapsed * 0.85 + wave.phase) * 0.08;
    }

    if (object.userData.sparkle) {
      const sparkle = object.userData.sparkle;
      const pulse = 0.65 + Math.sin(elapsed * sparkle.speed + sparkle.phase) * 0.35;
      object.material.opacity = 0.18 + pulse * 0.42;
      object.scale.setScalar((2.5 + pulse * 4.5) * (reducedMotion ? 0.82 : 1));
      object.position.x += Math.sin(elapsed * 0.2 + sparkle.phase) * scaledDelta * 1.8;
    }

    if (object.userData.foam) {
      const foam = object.userData.foam;
      object.rotation.z += scaledDelta * foam.speed;
      object.position.y += Math.sin(elapsed * 0.55 + foam.phase) * scaledDelta * 0.9;
      object.material.opacity = 0.22 + Math.sin(elapsed * 0.72 + foam.phase) * 0.08;
    }
  });
}

function updateMarineLife(elapsed, delta) {
  const lifeElapsed = elapsed * motionScale;
  marineLifeGroup.children.forEach((creature) => {
    const swim = creature.userData.swim;
    if (!swim) return;

    if (swim.jelly) {
      // 해파리는 위아래로 부드럽게 떠다닌다.
      creature.position.set(
        swim.center.x + Math.sin(lifeElapsed * swim.speed + swim.phase) * swim.radius * 0.4,
        swim.center.y + Math.sin(lifeElapsed * 0.5 + swim.phase) * swim.bob,
        swim.center.z + Math.cos(lifeElapsed * swim.speed * 0.8 + swim.phase) * swim.radius * 0.4,
      );
      if (creature.userData.dome) {
        const pulse = 1 + Math.sin(lifeElapsed * 2 + swim.phase) * 0.12;
        creature.userData.dome.scale.set(pulse, 0.82 * (2 - pulse), pulse);
      }
      return;
    }

    const angle = swim.phase + lifeElapsed * swim.speed;
    const wobble = Math.sin(lifeElapsed * (swim.predator ? 0.9 : 1.6) + swim.phase);
    creature.position.set(
      swim.center.x + Math.cos(angle) * swim.radius,
      swim.center.y + Math.sin(lifeElapsed * 0.45 + swim.phase) * swim.bob,
      swim.center.z + Math.sin(angle) * swim.radius * (swim.whale ? 0.42 : 0.68),
    );
    const nextAngle = angle + 0.02;
    const next = new THREE.Vector3(
      swim.center.x + Math.cos(nextAngle) * swim.radius,
      creature.position.y,
      swim.center.z + Math.sin(nextAngle) * swim.radius * (swim.whale ? 0.42 : 0.68),
    );
    const heading = next.sub(creature.position).normalize();
    creature.rotation.y = Math.atan2(heading.x, heading.z) + Math.PI / 2;
    creature.rotation.z = wobble * (swim.whale ? 0.025 : 0.06);

    if (creature.userData.tail) {
      creature.userData.tail.rotation.y = Math.sin(lifeElapsed * (swim.whale ? 1.6 : 5.8) + swim.phase) * (swim.whale ? 0.08 : 0.22);
    }
    creature.userData.flukes?.forEach((fluke, index) => {
      fluke.rotation.y = Math.sin(lifeElapsed * 1.45 + swim.phase + index) * 0.08;
    });
  });
}

function updateSwim(delta, elapsed) {
  diver.rotation.set(pitch, yaw, Math.sin(elapsed * 0.8) * 0.01, "YXZ");
  camera.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(diver.quaternion).normalize();
  up.set(0, 1, 0).applyQuaternion(diver.quaternion).normalize();

  const cruiseSpeed = 46;
  const boost = move.boost ? 1.8 : 1;
  const desired = new THREE.Vector3();
  desired.addScaledVector(forward, move.forward - move.back);
  desired.addScaledVector(right, move.right - move.left);
  desired.addScaledVector(up, move.up - move.down);
  if (desired.lengthSq() > 0) {
    desired.normalize().multiplyScalar(cruiseSpeed * boost);
    velocity.lerp(desired, THREE.MathUtils.clamp(delta * 3.4, 0, 1));
  } else {
    velocity.multiplyScalar(Math.pow(0.1, delta));
  }

  velocity.multiplyScalar(Math.pow(0.74, delta));
  const maxSpeed = 44 * boost;
  if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);
  diver.position.addScaledVector(velocity, delta);
  diver.position.y = THREE.MathUtils.clamp(diver.position.y, minDiveY, maxDiveY);

  const floor = terrainHeight(diver.position.x, diver.position.z) + 5;
  if (diver.position.y < floor) {
    diver.position.y = floor;
    velocity.y = Math.max(0, velocity.y);
  }
}

function sampleRender(elapsed) {
  renderStatus.frame += 1;
  document.documentElement.dataset.oceanFrame = String(renderStatus.frame);
  if (elapsed - renderStatus.lastSampleAt < 0.4) return;
  renderStatus.lastSampleAt = elapsed;

  try {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    renderStatus.centerPixel = Array.from(pixel);
    renderStatus.sampleLuma = pixel[0] + pixel[1] + pixel[2];
    document.documentElement.dataset.oceanPixel = renderStatus.centerPixel.join(",");
    document.documentElement.dataset.oceanCalls = String(renderer.info.render.calls);
  } catch {
    renderStatus.webgl = false;
    document.documentElement.dataset.oceanWebgl = "false";
  }
}

function terrainHeight(x, z) {
  return (
    Math.sin(x * 0.018) * 5.5 +
    Math.cos(z * 0.015) * 7 +
    Math.sin((x + z) * 0.011) * 4.5 -
    Math.abs(Math.sin(x * 0.004) * Math.cos(z * 0.006)) * 54 +
    seaFloorBase
  );
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
