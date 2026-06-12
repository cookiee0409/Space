import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("ocean");
const sonarCanvas = document.getElementById("sonar");
const sonarContext = sonarCanvas.getContext("2d");
const speedReadout = document.getElementById("speedReadout");
const depthReadout = document.getElementById("depthReadout");
const nearestReadout = document.getElementById("nearestReadout");
const sonarTargetReadout = document.getElementById("sonarTargetReadout");
const sonarRangeReadout = document.getElementById("sonarRangeReadout");
const sonarDistanceReadout = document.getElementById("sonarDistanceReadout");
const targetSelect = document.getElementById("targetSelect");
const diveButton = document.getElementById("diveButton");
const circleButton = document.getElementById("circleButton");
const stopButton = document.getElementById("stopButton");
const resetButton = document.getElementById("resetButton");
const thrustSlider = document.getElementById("thrustSlider");
const thrustReadout = document.getElementById("thrustReadout");
const labelsToggle = document.getElementById("labelsToggle");
const beaconsToggle = document.getElementById("beaconsToggle");
const planktonToggle = document.getElementById("planktonToggle");
const eventsToggle = document.getElementById("eventsToggle");
const targetType = document.getElementById("targetType");
const targetName = document.getElementById("targetName");
const targetInfo = document.getElementById("targetInfo");
const eventType = document.getElementById("eventType");
const eventName = document.getElementById("eventName");
const eventInfo = document.getElementById("eventInfo");
const gameButton = document.getElementById("gameButton");
const gameScoreReadout = document.getElementById("gameScore");
const gameTimeReadout = document.getElementById("gameTime");
const gamePearlsReadout = document.getElementById("gamePearls");
const gameBestReadout = document.getElementById("gameBest");
const gameMessage = document.getElementById("gameMessage");
const stingFlash = document.getElementById("stingFlash");

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fd6f5);
scene.fog = new THREE.FogExp2(0x70d2ef, 0.0019);

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
renderer.toneMappingExposure = 1.52;

const sub = new THREE.Object3D();
sub.position.set(-170, -28, 150);
sub.rotation.set(-0.02, -0.78, 0, "YXZ");
scene.add(sub);
sub.add(camera);

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const move = { forward: 0, back: 0, left: 0, right: 0, up: 0, down: 0, boost: 0 };
const mobileMove = { forward: 0, back: 0, left: 0, right: 0 };
const seaFloorBase = -360;
const minDiveY = -560;
const maxDiveY = 42;
const modelBase = "./assets/models/";
const marineModelAssets = {
  fish: { file: "fish.glb", scale: 2.8, rotation: [0, Math.PI / 2, 0] },
  shark: { file: "shark.glb", scale: 8.8, rotation: [0, Math.PI / 2, 0] },
  whale: { file: "whale.glb", scale: 14.5, rotation: [0, Math.PI / 2, 0] },
};
const marineModelCache = new Map();
const gltfLoader = new GLTFLoader();

let selectedTarget = "coralGate";
let autoPilot = null;
let activeLookButton = null;
let yaw = sub.rotation.y;
let pitch = sub.rotation.x;
let thrust = 0.42;
let lastNearest = null;
let eventsEnabled = true;
let nextEventAt = 7;
let activeEvent = null;
let zoomFov = camera.fov;

const renderStatus = {
  frame: 0,
  centerPixel: [0, 0, 0, 0],
  sampleLuma: 0,
  lastSampleAt: -1,
  webgl: true,
};
window.__abyssDriftStatus = renderStatus;
document.documentElement.dataset.oceanReady = "1";

const targets = [
  {
    id: "coralGate",
    ko: "산호문",
    type: "산호 지형",
    position: new THREE.Vector3(-40, -238, -80),
    color: "#ff9c78",
    info: "따뜻한 해류가 지나며 산호와 암반이 아치처럼 이어진 지점입니다.",
  },
  {
    id: "kelpCathedral",
    ko: "켈프 성당",
    type: "해조 숲",
    position: new THREE.Vector3(145, -184, -170),
    color: "#8fcf7d",
    info: "높은 줄기들이 물결을 따라 흔들리며 좁은 수로를 만듭니다.",
  },
  {
    id: "shipwreck",
    ko: "침몰선",
    type: "난파 지점",
    position: new THREE.Vector3(230, -286, 80),
    color: "#d8a15f",
    info: "녹슨 선체 틈 사이로 탐조등이 닿으면 잔해의 윤곽이 떠오릅니다.",
  },
  {
    id: "ventSpire",
    ko: "열수 첨탑",
    type: "지열 지형",
    position: new THREE.Vector3(-225, -392, -235),
    color: "#ffd36b",
    info: "검은 연기처럼 보이는 뜨거운 물기둥이 해저에서 천천히 솟습니다.",
  },
  {
    id: "glassTrench",
    ko: "유리 해구",
    type: "심해 협곡",
    position: new THREE.Vector3(-310, -455, 65),
    color: "#73d7ff",
    info: "가파른 암반과 청록색 반사가 겹쳐 깊이를 가늠하기 어려운 해구입니다.",
  },
  {
    id: "abyssArch",
    ko: "심연 아치",
    type: "암반 구조",
    position: new THREE.Vector3(40, -420, 285),
    color: "#b8a4ff",
    info: "바닥 가까이에 누운 커다란 암석 고리가 먼 항로의 기준점처럼 서 있습니다.",
  },
];

const targetMap = new Map();
const labelSprites = [];
const beaconObjects = [];
const eventGroup = new THREE.Group();
const marineLifeGroup = new THREE.Group();
const cartoonWaterGroup = new THREE.Group();
scene.add(eventGroup);
scene.add(marineLifeGroup);
scene.add(cartoonWaterGroup);

let plankton;
let sonarSweep = 0;
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
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient,
    emissive,
    emissiveIntensity,
  });
}

let waterUniforms = null;
let backdropGroup = null;
const causticTextures = [];
const ripplePool = [];
const activeRipples = [];
let nextWakeAt = 0;
const shallowBackground = new THREE.Color(0x7fdcf5);
const deepBackground = new THREE.Color(0x1d6f9c);
const surfaceRaycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const surfacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -48);
const surfaceHit = new THREE.Vector3();

const gameGroup = new THREE.Group();
scene.add(gameGroup);
const game = {
  state: "idle",
  score: 0,
  best: Number(localStorage.getItem("pearlRushBest") ?? 0) || 0,
  timeLeft: 0,
  combo: 0,
  lastCollectAt: -99,
  stingCooldown: 0,
  pearls: [],
  jellies: [],
};

setupLights();
setupSeascape();
setupTargets();
setupPlankton();
setupMarineLife();
loadMarineLifeModels();
setupUI();
setupGameUI();
resetDive();
animate();

function setupLights() {
  scene.add(new THREE.AmbientLight(0xd9fff5, 0.68));
  scene.add(new THREE.HemisphereLight(0xeafff9, 0x5db9b5, 1.24));

  const surfaceLight = new THREE.DirectionalLight(0xfff1bf, 2.65);
  surfaceLight.position.set(-130, 180, 80);
  scene.add(surfaceLight);

  const subLight = new THREE.SpotLight(0xf4fff2, 3.4, 300, Math.PI / 7.5, 0.82, 1.2);
  subLight.position.set(0, -1.2, 0);
  subLight.target.position.set(0, -4, -120);
  sub.add(subLight, subLight.target);

  const rimLight = new THREE.PointLight(0xffcf9d, 1.1, 300, 1.4);
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
}

function makePaintedBackdrop() {
  const group = new THREE.Group();

  const gradientCanvas = document.createElement("canvas");
  gradientCanvas.width = 8;
  gradientCanvas.height = 512;
  const context = gradientCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#d8f6ff");
  gradient.addColorStop(0.34, "#f2fdff");
  gradient.addColorStop(0.46, "#9bebee");
  gradient.addColorStop(0.7, "#4cc4e2");
  gradient.addColorStop(1, "#2f93c4");
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
  group.add(
    new THREE.Mesh(geometry, toonMat({ color: 0xf2dc96, emissive: 0x8c6f33, emissiveIntensity: 0.16 })),
  );

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
    context.arc(
      Math.random() * 256,
      Math.random() * 256,
      9 + Math.random() * 26,
      start,
      start + 0.8 + Math.random() * 1.6,
    );
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
    uShallow: { value: new THREE.Color(0x8df2e4) },
    uMid: { value: new THREE.Color(0x3ecbd8) },
    uDeep: { value: new THREE.Color(0x2496c9) },
    uSky: { value: new THREE.Color(0xcdf2ff) },
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
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff6cf,
    transparent: true,
    opacity: 0.062,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 18; i += 1) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(18, 86, 680, 18, 1, true), material);
    shaft.position.set((Math.random() - 0.5) * 1200, -190, (Math.random() - 0.5) * 1200);
    shaft.rotation.z = (Math.random() - 0.5) * 0.28;
    shaft.rotation.x = (Math.random() - 0.5) * 0.18;
    group.add(shaft);
  }

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
    wave.userData.bigWave = {
      baseX: wave.position.x,
      baseY: spec.y,
      phase: index * 1.7,
      speed: spec.speed,
      drift: spec.drift,
    };
    cartoonWaterGroup.add(wave);
  });

  const waveMaterial = new THREE.LineBasicMaterial({
    color: 0xf3fffb,
    transparent: true,
    opacity: 0.46,
  });
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
    line.userData.wave = {
      baseY,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.45,
      drift: 3 + Math.random() * 7,
    };
    cartoonWaterGroup.add(line);
  }

  const sparkleMaterial = makeSparkleMaterial();
  for (let i = 0; i < 28; i += 1) {
    const sparkle = new THREE.Sprite(sparkleMaterial.clone());
    sparkle.position.set((Math.random() - 0.5) * 1050, 14 + Math.random() * 38, (Math.random() - 0.5) * 980);
    sparkle.scale.setScalar(2.5 + Math.random() * 5);
    sparkle.material.opacity = 0.26 + Math.random() * 0.38;
    sparkle.userData.sparkle = {
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.1,
    };
    cartoonWaterGroup.add(sparkle);
  }

  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 14; i += 1) {
    const foam = new THREE.Mesh(new THREE.RingGeometry(2 + Math.random() * 2, 2.3 + Math.random() * 3.5, 18), foamMaterial.clone());
    foam.position.set((Math.random() - 0.5) * 980, -8 + Math.random() * 34, (Math.random() - 0.5) * 940);
    foam.rotation.x = -Math.PI / 2;
    foam.userData.foam = {
      phase: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.28,
    };
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
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
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
  return new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
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
    new THREE.PointsMaterial({
      size: 5.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
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

function setupTargets() {
  targets.forEach((target) => {
    const group = new THREE.Group();
    group.position.copy(target.position);
    scene.add(group);

    if (target.id === "coralGate") makeCoralGate(group);
    if (target.id === "kelpCathedral") makeKelpCathedral(group);
    if (target.id === "shipwreck") makeShipwreck(group);
    if (target.id === "ventSpire") makeVentSpire(group);
    if (target.id === "glassTrench") makeGlassTrench(group);
    if (target.id === "abyssArch") makeAbyssArch(group);
    addCartoonOutline(group, 1.045, 0x2a7592, 24);

    const beacon = makeBeacon(target.color);
    beacon.position.y = 15;
    group.add(beacon);
    beaconObjects.push(beacon);

    const label = makeLabel(target.ko);
    label.position.y = 26;
    group.add(label);
    labelSprites.push(label);

    targetMap.set(target.id, { ...target, group, beacon, label });
  });
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

function makeKelpCathedral(group) {
  const stalkMaterial = toonMat({ color: 0x59b964, emissive: 0x17471f, emissiveIntensity: 0.35 });
  const leafMaterial = new THREE.MeshBasicMaterial({
    color: 0x9ad681,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 46; i += 1) {
    const height = 24 + Math.random() * 36;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, height, 8), stalkMaterial);
    stalk.position.set((Math.random() - 0.5) * 78, height / 2 - 18, (Math.random() - 0.5) * 52);
    stalk.rotation.z = (Math.random() - 0.5) * 0.22;
    stalk.userData.wavePhase = Math.random() * Math.PI * 2;
    group.add(stalk);

    for (let j = 0; j < 2; j += 1) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 10), leafMaterial);
      leaf.position.set(stalk.position.x + (Math.random() - 0.5) * 4, stalk.position.y + height * 0.18, stalk.position.z);
      leaf.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.8);
      leaf.userData.wavePhase = stalk.userData.wavePhase + j;
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
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd36b,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < 7; i += 1) {
    const height = 18 + Math.random() * 32;
    const vent = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 4, height, 9), rockMaterial);
    vent.position.set((Math.random() - 0.5) * 38, height / 2 - 18, (Math.random() - 0.5) * 34);
    group.add(vent);

    const plume = new THREE.Mesh(new THREE.CylinderGeometry(6, 2, 58, 18, 1, true), glowMaterial);
    plume.position.set(vent.position.x, vent.position.y + height * 0.55, vent.position.z);
    plume.userData.plume = true;
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
  const colorA = new THREE.Color("#5ff2d0");
  const colorB = new THREE.Color("#ff9c78");

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    positions[index] = (Math.random() - 0.5) * 250;
    positions[index + 1] = (Math.random() - 0.5) * 150;
    positions[index + 2] = (Math.random() - 0.5) * 250;
    const color = colorA.clone().lerp(colorB, Math.random() * 0.35);
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  plankton = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.44,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  plankton.name = "localPlankton";
  sub.add(plankton);
}

function setupMarineLife() {
  for (let i = 0; i < 42; i += 1) {
    const fish = makeFish(0.8 + Math.random() * 1.7, i % 5 === 0 ? 0xff9c78 : 0x77d7c8);
    fish.userData.modelKind = "fish";
    placeSwimmer(fish, {
      radius: 120 + Math.random() * 560,
      y: -70 - Math.random() * 310,
      speed: 0.12 + Math.random() * 0.22,
      bob: 3 + Math.random() * 9,
      phase: Math.random() * Math.PI * 2,
    });
    marineLifeGroup.add(fish);
  }

  for (let i = 0; i < 5; i += 1) {
    const shark = makeShark(5.5 + Math.random() * 2.8);
    shark.userData.modelKind = "shark";
    placeSwimmer(shark, {
      radius: 240 + Math.random() * 520,
      y: -150 - Math.random() * 260,
      speed: 0.08 + Math.random() * 0.08,
      bob: 6 + Math.random() * 12,
      phase: Math.random() * Math.PI * 2,
      predator: true,
    });
    marineLifeGroup.add(shark);
  }

  for (let i = 0; i < 2; i += 1) {
    const whale = makeOceanWhale(13 + Math.random() * 5);
    whale.userData.modelKind = "whale";
    placeSwimmer(whale, {
      radius: 390 + Math.random() * 380,
      y: -230 - Math.random() * 230,
      speed: 0.035 + Math.random() * 0.025,
      bob: 14 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      whale: true,
    });
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
    const keep = {
      swim: creature.userData.swim,
      modelKind: creature.userData.modelKind,
    };
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
    center: new THREE.Vector3((Math.random() - 0.5) * 420, data.y, (Math.random() - 0.5) * 420),
    radius: data.radius,
    speed: data.speed,
    bob: data.bob,
    phase: data.phase,
    predator: data.predator ?? false,
    whale: data.whale ?? false,
  };
}

function makeFish(size, color) {
  const group = new THREE.Group();
  const bodyMaterial = toonMat({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.14),
    emissiveIntensity: 0.25,
  });
  const finMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7fff4,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
  });
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
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
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

function makeBeacon(color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 24, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    }),
  );
  orb.position.y = 17;
  group.add(beam, orb);
  group.userData.orb = orb;
  return group;
}

function makeLabel(text) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 72;
  const context = labelCanvas.getContext("2d");
  context.font = "700 30px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(2, 13, 18, 0.62)";
  context.roundRect(18, 12, 220, 48, 10);
  context.fill();
  context.strokeStyle = "rgba(95, 242, 208, 0.36)";
  context.stroke();
  context.fillStyle = "#eefcff";
  context.fillText(text, 128, 38);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  sprite.scale.set(22, 6.2, 1);
  return sprite;
}

function setupUI() {
  targets.forEach((target) => {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = target.ko;
    targetSelect.appendChild(option);
  });
  targetSelect.value = selectedTarget;
  updateTargetCard();

  targetSelect.addEventListener("change", () => {
    selectedTarget = targetSelect.value;
    autoPilot = null;
    updateTargetCard();
  });

  diveButton.addEventListener("click", () => {
    autoPilot = { mode: "dive", target: selectedTarget };
  });

  circleButton.addEventListener("click", () => {
    autoPilot = { mode: "circle", target: selectedTarget, angle: 0 };
  });

  stopButton.addEventListener("click", stopDive);
  resetButton.addEventListener("click", resetDive);

  thrustSlider.addEventListener("input", () => {
    thrust = Number(thrustSlider.value) / 100;
    thrustReadout.textContent = `${Math.round(thrust * 100)}%`;
  });

  labelsToggle.addEventListener("change", () => {
    labelSprites.forEach((label) => {
      label.visible = labelsToggle.checked;
    });
  });

  beaconsToggle.addEventListener("change", () => {
    beaconObjects.forEach((beacon) => {
      beacon.visible = beaconsToggle.checked;
    });
  });

  planktonToggle.addEventListener("change", () => {
    plankton.visible = planktonToggle.checked;
  });

  eventsToggle.addEventListener("change", () => {
    eventsEnabled = eventsToggle.checked;
    if (eventsEnabled) {
      scheduleNextEvent(clock.elapsedTime, 3);
      setEventCard("해류 안정", "정상 잠항", "수온약층과 발광 입자가 다시 흐르기 시작했습니다.");
    } else {
      clearActiveEvent();
      setEventCard("이벤트 중지", "잔잔한 항로", "갑작스러운 해류와 발광 구름이 발생하지 않습니다.");
    }
  });

  window.addEventListener("keydown", setKey);
  window.addEventListener("keyup", setKey);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    activeLookButton = event.button;
    canvas.setPointerCapture(event.pointerId);

    pointerNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    surfaceRaycaster.setFromCamera(pointerNdc, camera);
    if (
      surfaceRaycaster.ray.intersectPlane(surfacePlane, surfaceHit) &&
      surfaceHit.distanceTo(sub.position) < 1300
    ) {
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
    autoPilot = null;
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
    };
    button.addEventListener("pointerdown", () => set(1));
    button.addEventListener("pointerup", () => set(0));
    button.addEventListener("pointercancel", () => set(0));
    button.addEventListener("pointerleave", () => set(0));
  });
}

function setKey(event) {
  const value = event.type === "keydown" ? 1 : 0;
  const key = event.key.toLowerCase();
  if (event.type === "keydown" && event.code === "Space") {
    event.preventDefault();
    stopDive();
    return;
  }
  if (key === "e") move.forward = value;
  if (key === "q") move.back = value;
  if (key === "a") move.left = value;
  if (key === "d") move.right = value;
  if (key === "s") move.down = value;
  if (key === "w") move.up = value;
  if (key === "shift") move.boost = value;
  if (["w", "a", "s", "d", "q", "e", "shift"].includes(key)) {
    autoPilot = null;
  }
}

function stopDive() {
  autoPilot = null;
  velocity.set(0, 0, 0);
}

function resetDive() {
  sub.position.set(-170, -28, 150);
  yaw = -0.78;
  pitch = -0.02;
  velocity.set(0, 0, 0);
  autoPilot = null;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateTargets(elapsed);
  updateWaterStyle(elapsed, delta);
  updateCartoonWater(elapsed, delta);
  updateMarineLife(elapsed, delta);
  updateEvents(elapsed, delta);
  updateDive(delta, elapsed);
  updateGame(elapsed, delta);
  updateHUD();
  updateSonar(delta);
  renderer.render(scene, camera);
  sampleRender(elapsed);
}

function updateTargets(elapsed) {
  targetMap.forEach((target) => {
    target.beacon.rotation.y = elapsed * 0.9;
    const orb = target.beacon.userData.orb;
    if (orb) orb.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.12);
    target.label.quaternion.copy(camera.quaternion);
    target.group.traverse((child) => {
      if (child.userData.wavePhase !== undefined) {
        child.rotation.z += Math.sin(elapsed * 1.1 + child.userData.wavePhase) * 0.0009;
      }
      if (child.userData.plume) {
        child.rotation.y += 0.006;
        child.material.opacity = 0.16 + Math.sin(elapsed * 1.7 + child.position.x) * 0.05;
      }
    });
  });

  if (plankton) {
    plankton.rotation.y = Math.sin(elapsed * 0.22) * 0.08;
    plankton.rotation.x = Math.cos(elapsed * 0.18) * 0.04;
    plankton.material.opacity = THREE.MathUtils.clamp(0.38 + velocity.length() * 0.025, 0.38, 0.78);
  }
}

function updateWaterStyle(elapsed, delta) {
  if (waterUniforms) waterUniforms.uTime.value = elapsed * motionScale;

  causticTextures.forEach((texture) => {
    texture.offset.x += texture.userData.speed[0] * delta * motionScale * 2.5;
    texture.offset.y += texture.userData.speed[1] * delta * motionScale * 2.5;
  });

  const depthT = THREE.MathUtils.clamp((-sub.position.y - 20) / 460, 0, 1);
  scene.background.lerpColors(shallowBackground, deepBackground, depthT);
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.0017 + depthT * 0.0011;

  if (backdropGroup) {
    const fade = 1 - depthT * 0.88;
    backdropGroup.children.forEach((child) => {
      if (child.userData.baseOpacity !== undefined) {
        child.material.opacity = child.userData.baseOpacity * fade;
      }
    });
  }

  if (sub.position.y > 14 && velocity.length() > 14 && elapsed > nextWakeAt) {
    nextWakeAt = elapsed + 0.55;
    spawnSurfaceSplash(sub.position, 0.55);
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
      object.material.opacity = THREE.MathUtils.clamp(object.material.opacity + Math.sin(elapsed * 0.5 + wave.phase) * 0.0008, 0.28, 0.64);
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

function updateDive(delta, elapsed) {
  sub.rotation.set(pitch, yaw, Math.sin(elapsed * 0.8) * 0.01, "YXZ");
  camera.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(sub.quaternion).normalize();
  up.set(0, 1, 0).applyQuaternion(sub.quaternion).normalize();

  if (autoPilot) {
    runAutopilot(delta);
  } else {
    const cruiseSpeed = 18 + thrust * 72;
    const boost = move.boost ? 1.65 : 1;
    const desired = new THREE.Vector3();
    desired.addScaledVector(forward, move.forward - move.back);
    desired.addScaledVector(right, move.right - move.left);
    desired.addScaledVector(up, move.up - move.down);
    if (desired.lengthSq() > 0) {
      desired.normalize().multiplyScalar(cruiseSpeed * boost);
      velocity.lerp(desired, THREE.MathUtils.clamp(delta * 4.2, 0, 1));
    } else {
      velocity.multiplyScalar(Math.pow(0.12, delta));
    }
  }

  velocity.multiplyScalar(Math.pow(autoPilot ? 0.86 : 0.72, delta));
  const maxSpeed = autoPilot ? 118 : 34 + thrust * 92;
  if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);
  sub.position.addScaledVector(velocity, delta);
  sub.position.y = THREE.MathUtils.clamp(sub.position.y, minDiveY, maxDiveY);

  const floor = terrainHeight(sub.position.x, sub.position.z) + 5;
  if (sub.position.y < floor) {
    sub.position.y = floor;
    velocity.y = Math.max(0, velocity.y);
  }
}

function runAutopilot(delta) {
  const target = targetMap.get(autoPilot.target);
  const position = target.position;
  const offsetDistance = autoPilot.mode === "circle" ? 56 : 34;
  const toTarget = new THREE.Vector3().subVectors(position, sub.position);
  const distance = toTarget.length();

  if (autoPilot.mode === "circle") {
    autoPilot.angle = (autoPilot.angle ?? 0) + delta * 0.48;
    const orbitPosition = position
      .clone()
      .add(new THREE.Vector3(Math.cos(autoPilot.angle) * offsetDistance, 18, Math.sin(autoPilot.angle) * offsetDistance));
    steerToward(orbitPosition, delta, 0.95);
    lookToward(position, delta, 0.035);
    return;
  }

  if (distance < offsetDistance) {
    autoPilot = {
      mode: "circle",
      target: autoPilot.target,
      angle: Math.atan2(sub.position.z - position.z, sub.position.x - position.x),
    };
    velocity.multiplyScalar(0.32);
    return;
  }

  steerToward(position.clone().add(new THREE.Vector3(0, 14, 0)), delta, 1.22);
  lookToward(position, delta, 0.03);
}

function steerToward(destination, delta, force) {
  const desired = new THREE.Vector3().subVectors(destination, sub.position);
  const distance = desired.length();
  if (distance < 0.001) return;
  desired.normalize().multiplyScalar(Math.min(118, 28 + distance * 0.34));
  velocity.lerp(desired, THREE.MathUtils.clamp(delta * force, 0, 1));
}

function lookToward(destination, delta, force) {
  const direction = new THREE.Vector3().subVectors(destination, sub.position).normalize();
  const targetYaw = Math.atan2(-direction.x, -direction.z);
  const targetPitch = Math.asin(direction.y);
  yaw = lerpAngle(yaw, targetYaw, THREE.MathUtils.clamp(delta / force, 0, 1));
  pitch = THREE.MathUtils.lerp(pitch, targetPitch, THREE.MathUtils.clamp(delta / force, 0, 1));
}

function updateEvents(elapsed, delta) {
  if (!eventsEnabled) return;

  if (!activeEvent && elapsed >= nextEventAt) {
    if (Math.random() > 0.48) {
      spawnCurrentSurge(elapsed);
    } else {
      spawnGlowBloom(elapsed);
    }
  }

  if (!activeEvent) return;

  if (activeEvent.type === "current") {
    velocity.addScaledVector(activeEvent.direction, delta * activeEvent.force);
    activeEvent.group.children.forEach((ribbon, index) => {
      ribbon.position.addScaledVector(activeEvent.direction, delta * (12 + index));
      ribbon.material.opacity = 0.08 + Math.sin(elapsed * 2 + index) * 0.03;
    });
  }

  if (activeEvent.type === "bloom") {
    activeEvent.group.rotation.y += delta * 0.28;
    activeEvent.group.children.forEach((point, index) => {
      point.position.y += Math.sin(elapsed * 1.4 + index) * delta * 0.8;
    });
  }

  if (elapsed > activeEvent.expiresAt) {
    clearActiveEvent();
    scheduleNextEvent(elapsed);
    setEventCard("해류 안정", "정상 잠항", "주변 흐름이 다시 안정되었습니다.");
  }
}

function spawnCurrentSurge(elapsed) {
  clearActiveEvent();
  camera.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(sub.quaternion).normalize();
  const direction = right.clone().multiplyScalar(Math.random() > 0.5 ? 1 : -1).addScaledVector(forward, -0.25).normalize();
  const group = new THREE.Group();
  group.position.copy(sub.position).addScaledVector(forward, 90);

  const material = new THREE.MeshBasicMaterial({
    color: 0x5ff2d0,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 10; i += 1) {
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(150, 5), material.clone());
    ribbon.position.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 56, (Math.random() - 0.5) * 120);
    ribbon.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(ribbon);
  }

  eventGroup.add(group);
  activeEvent = { type: "current", group, direction, force: 16, expiresAt: elapsed + 12 };
  setEventCard("해류 변화", "측면 해류", "강한 흐름이 선체를 옆으로 밀고 있습니다. 추진 방향을 조절해 항로를 유지하세요.");
}

function spawnGlowBloom(elapsed) {
  clearActiveEvent();
  camera.getWorldDirection(forward);
  const group = new THREE.Group();
  const origin = sub.position.clone().addScaledVector(forward, 120);
  group.position.copy(origin);
  const colors = [0x5ff2d0, 0xff9c78, 0xb8a4ff, 0x8fcf7d];

  for (let i = 0; i < 150; i += 1) {
    const point = new THREE.Mesh(
      new THREE.SphereGeometry(0.45 + Math.random() * 1.1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
      }),
    );
    point.position.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 120);
    group.add(point);
  }

  eventGroup.add(group);
  activeEvent = { type: "bloom", group, expiresAt: elapsed + 16 };
  setEventCard("발광 구름", "플랑크톤 밀집", "작은 빛들이 항로 주변으로 번지고 있습니다. 소나에는 잡음처럼 넓게 퍼집니다.");
}

function clearActiveEvent() {
  if (!activeEvent) return;
  eventGroup.remove(activeEvent.group);
  activeEvent.group.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose?.());
    } else {
      object.material?.dispose?.();
    }
  });
  activeEvent = null;
}

function scheduleNextEvent(elapsed, minimumDelay = 9) {
  nextEventAt = elapsed + minimumDelay + Math.random() * 14;
}

function updateHUD() {
  const nearest = findNearestTarget();
  const speed = velocity.length() * 0.34;
  const depth = Math.max(0, Math.round(50 - sub.position.y));

  if (nearest.id !== lastNearest) {
    lastNearest = nearest.id;
    if (!autoPilot && nearest.distance < 55) {
      selectedTarget = nearest.id;
      targetSelect.value = selectedTarget;
      updateTargetCard();
    }
  }

  speedReadout.textContent = `${speed.toFixed(1)} kn`;
  depthReadout.textContent = `${depth.toLocaleString("ko-KR")} m`;
  nearestReadout.textContent = nearest.ko;
}

function updateTargetCard() {
  const target = targets.find((item) => item.id === selectedTarget);
  if (!target) return;
  targetType.textContent = target.type;
  targetName.textContent = target.ko;
  targetInfo.textContent = target.info;
}

function updateSonar(delta) {
  sonarSweep = (sonarSweep + delta * 1.55) % (Math.PI * 2);
  const width = sonarCanvas.width;
  const height = sonarCanvas.height;
  const center = width / 2;
  const range = 480;
  const selected = targetMap.get(selectedTarget);

  sonarContext.clearRect(0, 0, width, height);
  const gradient = sonarContext.createRadialGradient(center, center, 10, center, center, center);
  gradient.addColorStop(0, "rgba(95, 242, 208, 0.08)");
  gradient.addColorStop(1, "rgba(0, 7, 10, 0.92)");
  sonarContext.fillStyle = gradient;
  sonarContext.fillRect(0, 0, width, height);

  sonarContext.strokeStyle = "rgba(148, 235, 224, 0.24)";
  sonarContext.lineWidth = 1;
  for (let r = 0.25; r <= 1; r += 0.25) {
    sonarContext.beginPath();
    sonarContext.arc(center, center, center * r - 6, 0, Math.PI * 2);
    sonarContext.stroke();
  }

  sonarContext.strokeStyle = "rgba(148, 235, 224, 0.18)";
  sonarContext.beginPath();
  sonarContext.moveTo(center, 8);
  sonarContext.lineTo(center, height - 8);
  sonarContext.moveTo(8, center);
  sonarContext.lineTo(width - 8, center);
  sonarContext.stroke();

  const sweepGradient = sonarContext.createRadialGradient(center, center, 0, center, center, center);
  sweepGradient.addColorStop(0, "rgba(95, 242, 208, 0.22)");
  sweepGradient.addColorStop(1, "rgba(95, 242, 208, 0)");
  sonarContext.fillStyle = sweepGradient;
  sonarContext.beginPath();
  sonarContext.moveTo(center, center);
  sonarContext.arc(center, center, center - 7, sonarSweep - 0.18, sonarSweep + 0.18);
  sonarContext.closePath();
  sonarContext.fill();

  targets.forEach((target) => {
    const dx = target.position.x - sub.position.x;
    const dz = target.position.z - sub.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > range) return;
    const x = center + (dx / range) * (center - 12);
    const y = center + (dz / range) * (center - 12);
    const isSelected = target.id === selectedTarget;
    sonarContext.fillStyle = isSelected ? target.color : "rgba(238, 252, 255, 0.58)";
    sonarContext.beginPath();
    sonarContext.arc(x, y, isSelected ? 4.4 : 2.6, 0, Math.PI * 2);
    sonarContext.fill();
  });

  if (game.state === "playing") {
    game.pearls.forEach((pearl) => {
      const dx = pearl.position.x - sub.position.x;
      const dz = pearl.position.z - sub.position.z;
      if (Math.hypot(dx, dz) > range) return;
      sonarContext.fillStyle = "#ffe27a";
      sonarContext.beginPath();
      sonarContext.arc(center + (dx / range) * (center - 12), center + (dz / range) * (center - 12), 3.2, 0, Math.PI * 2);
      sonarContext.fill();
    });
    game.jellies.forEach((jelly) => {
      const dx = jelly.position.x - sub.position.x;
      const dz = jelly.position.z - sub.position.z;
      if (Math.hypot(dx, dz) > range) return;
      sonarContext.fillStyle = "rgba(255, 150, 220, 0.85)";
      sonarContext.beginPath();
      sonarContext.arc(center + (dx / range) * (center - 12), center + (dz / range) * (center - 12), 2.4, 0, Math.PI * 2);
      sonarContext.fill();
    });
  }

  sonarContext.fillStyle = "#eefcff";
  sonarContext.beginPath();
  sonarContext.arc(center, center, 3.5, 0, Math.PI * 2);
  sonarContext.fill();

  const selectedDistance = selected ? selected.position.distanceTo(sub.position) : 0;
  sonarTargetReadout.textContent = selected?.ko ?? "-";
  sonarRangeReadout.textContent = `${range} m`;
  sonarDistanceReadout.textContent = `${Math.round(selectedDistance).toLocaleString("ko-KR")} m`;
}

function sampleRender(elapsed) {
  renderStatus.frame += 1;
  document.documentElement.dataset.oceanFrame = String(renderStatus.frame);
  if (elapsed - renderStatus.lastSampleAt < 0.4) return;
  renderStatus.lastSampleAt = elapsed;

  try {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const points = [
      [0.5, 0.5],
      [0.32, 0.42],
      [0.68, 0.42],
      [0.28, 0.62],
      [0.72, 0.62],
      [0.5, 0.3],
      [0.5, 0.74],
    ];
    let luma = 0;

    for (const [x, y] of points) {
      gl.readPixels(
        Math.floor(gl.drawingBufferWidth * x),
        Math.floor(gl.drawingBufferHeight * y),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      luma += pixel[0] + pixel[1] + pixel[2];
    }

    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    renderStatus.centerPixel = Array.from(pixel);
    renderStatus.sampleLuma = luma;
    document.documentElement.dataset.oceanPixel = renderStatus.centerPixel.join(",");
    document.documentElement.dataset.oceanLuma = String(renderStatus.sampleLuma);
    document.documentElement.dataset.oceanCalls = String(renderer.info.render.calls);
  } catch {
    renderStatus.webgl = false;
    document.documentElement.dataset.oceanWebgl = "false";
  }
}

function findNearestTarget() {
  let nearest = null;
  targetMap.forEach((target) => {
    const distance = target.position.distanceTo(sub.position);
    if (!nearest || distance < nearest.distance) nearest = { ...target, distance };
  });
  return nearest;
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

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function setEventCard(type, name, info) {
  eventType.textContent = type;
  eventName.textContent = name;
  eventInfo.textContent = info;
}

// ===== Pearl Rush 미니게임 =====
const GAME_DURATION = 90;
const PEARL_COUNT = 12;
const JELLY_COUNT = 7;
const PEARL_COLLECT_RANGE = 18;
const JELLY_STING_RANGE = 14;

function setupGameUI() {
  gameBestReadout.textContent = `최고 ${game.best.toLocaleString("ko-KR")}점`;
  gameButton.addEventListener("click", () => {
    if (game.state === "playing") {
      endGame("중단");
    } else {
      startGame();
    }
  });
}

function startGame() {
  clearGameObjects();
  game.state = "playing";
  game.score = 0;
  game.combo = 0;
  game.lastCollectAt = -99;
  game.timeLeft = GAME_DURATION;
  game.stingCooldown = 0;

  for (let i = 0; i < PEARL_COUNT; i += 1) {
    const pearl = makePearl();
    const x = (Math.random() - 0.5) * 760;
    const z = (Math.random() - 0.5) * 760;
    const floor = terrainHeight(x, z);
    const y = floor + 24 + Math.random() * Math.max(30, -90 - floor - 24);
    pearl.position.set(x, Math.min(y, -70), z);
    pearl.userData.pearl = { phase: Math.random() * Math.PI * 2, popping: 0 };
    gameGroup.add(pearl);
    game.pearls.push(pearl);
  }

  for (let i = 0; i < JELLY_COUNT; i += 1) {
    const jelly = makeJellyfish(3.4 + Math.random() * 2.4);
    jelly.position.set((Math.random() - 0.5) * 640, -90 - Math.random() * 280, (Math.random() - 0.5) * 640);
    jelly.userData.jelly = {
      baseY: jelly.position.y,
      phase: Math.random() * Math.PI * 2,
      drift: 10 + Math.random() * 22,
      speed: 0.4 + Math.random() * 0.5,
    };
    gameGroup.add(jelly);
    game.jellies.push(jelly);
  }

  gameButton.textContent = "포기";
  gameMessage.textContent = "빛나는 진주를 모으세요! 해파리에 닿으면 시간이 줄어듭니다.";
  updateGameHUD();
}

function endGame(reason) {
  const collected = PEARL_COUNT - game.pearls.length;
  if (reason === "완주") {
    game.score += Math.round(game.timeLeft) * 10;
  }
  game.state = "over";
  game.timeLeft = Math.max(0, game.timeLeft);

  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem("pearlRushBest", String(game.best));
    gameBestReadout.textContent = `최고 ${game.best.toLocaleString("ko-KR")}점`;
    gameMessage.textContent = `신기록! ${game.score.toLocaleString("ko-KR")}점 (진주 ${collected}/${PEARL_COUNT})`;
  } else if (reason === "완주") {
    gameMessage.textContent = `진주를 전부 모았습니다! ${game.score.toLocaleString("ko-KR")}점`;
  } else if (reason === "시간 종료") {
    gameMessage.textContent = `시간 종료! ${game.score.toLocaleString("ko-KR")}점 (진주 ${collected}/${PEARL_COUNT})`;
  } else {
    gameMessage.textContent = `게임 중단. ${game.score.toLocaleString("ko-KR")}점`;
  }

  gameButton.textContent = "다시 시작";
  clearGameObjects();
  updateGameHUD();
}

function clearGameObjects() {
  [...game.pearls, ...game.jellies].forEach((object) => {
    gameGroup.remove(object);
    object.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
      else child.material?.dispose?.();
    });
  });
  game.pearls = [];
  game.jellies = [];
}

function makePearl() {
  const group = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 20, 14),
    toonMat({ color: 0xfff3d0, emissive: 0xc9a23f, emissiveIntensity: 0.55 }),
  );
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(4.6, 6, 26),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a3,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const sparkle = new THREE.Sprite(makeSparkleMaterial());
  sparkle.scale.setScalar(7);
  sparkle.position.y = 4.5;
  group.add(orb, halo, sparkle);
  group.userData.halo = halo;
  group.userData.sparkle = sparkle;
  addCartoonOutline(orb, 1.1, 0x8a6a23, 1);
  return group;
}

function makeJellyfish(size) {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(size, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat({ color: 0xf2a0d8, emissive: 0x8e3a78, emissiveIntensity: 0.45 }),
  );
  dome.scale.y = 0.78;
  const skirt = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.96, size * 0.7, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc4ec,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
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
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * size * 0.5 + Math.sin(t * Math.PI * 2 + i) * 0.5,
          -t * size * 2.4,
          Math.sin(angle) * size * 0.5,
        ),
      );
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), tentacleMaterial.clone()));
  }
  group.userData.dome = dome;
  addCartoonOutline(dome, 1.07, 0x7c2f6b, 1);
  return group;
}

function updateGame(elapsed, delta) {
  if (game.state !== "playing") return;

  game.timeLeft -= delta;
  game.stingCooldown = Math.max(0, game.stingCooldown - delta);
  if (game.timeLeft <= 0) {
    endGame("시간 종료");
    return;
  }

  for (let i = game.pearls.length - 1; i >= 0; i -= 1) {
    const pearl = game.pearls[i];
    const data = pearl.userData.pearl;

    if (data.popping > 0) {
      data.popping -= delta;
      pearl.scale.setScalar(Math.max(0.01, data.popping / 0.3) * 1.4);
      if (data.popping <= 0) {
        gameGroup.remove(pearl);
        game.pearls.splice(i, 1);
        if (game.pearls.length === 0) {
          endGame("완주");
          return;
        }
      }
      continue;
    }

    pearl.rotation.y = elapsed * 0.8 + data.phase;
    pearl.position.y += Math.sin(elapsed * 1.3 + data.phase) * delta * 1.6;
    pearl.userData.halo.rotation.z = elapsed * 0.9 + data.phase;
    pearl.userData.halo.quaternion.copy(camera.quaternion);
    pearl.userData.sparkle.material.opacity = 0.45 + Math.sin(elapsed * 3 + data.phase) * 0.35;

    if (pearl.position.distanceTo(sub.position) < PEARL_COLLECT_RANGE) {
      const comboAlive = elapsed - game.lastCollectAt < 6;
      game.combo = comboAlive ? game.combo + 1 : 1;
      game.lastCollectAt = elapsed;
      game.score += 100 * game.combo;
      game.timeLeft = Math.min(GAME_DURATION, game.timeLeft + 3);
      data.popping = 0.3;
      spawnRipple(pearl.position, { size: 14, strength: 0.9, color: 0xffe27a });
      spawnRipple(pearl.position, { size: 9, strength: 0.7, color: 0xffffff, delay: 0.12 });
      gameMessage.textContent =
        game.combo > 1
          ? `콤보 x${game.combo}! +${(100 * game.combo).toLocaleString("ko-KR")}점 (+3초)`
          : "진주 획득! +100점 (+3초)";
    }
  }

  game.jellies.forEach((jelly) => {
    const data = jelly.userData.jelly;
    jelly.position.y = data.baseY + Math.sin(elapsed * data.speed + data.phase) * data.drift;
    const pulse = 1 + Math.sin(elapsed * 2.2 + data.phase) * 0.1;
    jelly.userData.dome.scale.set(pulse, 0.78 * (2 - pulse), pulse);

    if (game.stingCooldown <= 0 && jelly.position.distanceTo(sub.position) < JELLY_STING_RANGE) {
      game.timeLeft -= 8;
      game.combo = 0;
      game.stingCooldown = 1.6;
      const away = sub.position.clone().sub(jelly.position).normalize();
      velocity.addScaledVector(away, 55);
      spawnRipple(jelly.position, { size: 16, strength: 0.9, color: 0xff9ad8 });
      stingFlash.classList.remove("active");
      void stingFlash.offsetWidth;
      stingFlash.classList.add("active");
      gameMessage.textContent = "해파리에 쏘였습니다! -8초";
    }
  });

  updateGameHUD();
}

function updateGameHUD() {
  gameScoreReadout.textContent = game.score.toLocaleString("ko-KR");
  gameTimeReadout.textContent = `${Math.max(0, Math.ceil(game.timeLeft))}s`;
  gamePearlsReadout.textContent =
    game.state === "playing" ? `${PEARL_COUNT - game.pearls.length}/${PEARL_COUNT}` : "-";
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
