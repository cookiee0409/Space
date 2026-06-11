import * as THREE from "three";

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

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x031217);
scene.fog = new THREE.FogExp2(0x03202a, 0.0032);

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
renderer.toneMappingExposure = 1.25;

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
scene.add(eventGroup);
scene.add(marineLifeGroup);

let plankton;
let sonarSweep = 0;

setupLights();
setupSeascape();
setupTargets();
setupPlankton();
setupMarineLife();
setupUI();
resetDive();
animate();

function setupLights() {
  scene.add(new THREE.AmbientLight(0x7db9b4, 0.45));
  scene.add(new THREE.HemisphereLight(0x8be6dc, 0x061012, 1.08));

  const surfaceLight = new THREE.DirectionalLight(0xd9fff5, 2.2);
  surfaceLight.position.set(-130, 180, 80);
  scene.add(surfaceLight);

  const subLight = new THREE.SpotLight(0xd9fff2, 5.4, 330, Math.PI / 7.2, 0.72, 1.2);
  subLight.position.set(0, -1.2, 0);
  subLight.target.position.set(0, -4, -120);
  sub.add(subLight, subLight.target);

  const rimLight = new THREE.PointLight(0xff9c78, 0.85, 280, 1.4);
  rimLight.position.set(120, -30, 80);
  scene.add(rimLight);
}

function setupSeascape() {
  scene.add(makeSeafloor());
  scene.add(makeWaterSurface());
  scene.add(makeLightShafts());
  scene.add(makeDistantHaze());
  scene.add(makeTerrainRocks());
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

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x25423b,
      roughness: 0.95,
      metalness: 0.02,
      emissive: 0x031513,
      emissiveIntensity: 0.28,
    }),
  );
}

function makeWaterSurface() {
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x66e0d1,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  surface.position.y = 48;
  surface.rotation.x = -Math.PI / 2;
  return surface;
}

function makeLightShafts() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xa8fff1,
    transparent: true,
    opacity: 0.045,
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

function makeDistantHaze() {
  const geometry = new THREE.BufferGeometry();
  const count = 460;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = ["#5ff2d0", "#ff9c78", "#8fcf7d", "#73d7ff"];

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
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeTerrainRocks() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x34463f,
    roughness: 0.96,
    metalness: 0.01,
    emissive: 0x071615,
    emissiveIntensity: 0.18,
  });

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
  const coralMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8f75,
    roughness: 0.78,
    emissive: 0x5b211d,
    emissiveIntensity: 0.38,
  });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x46534b, roughness: 0.92 });
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
  const stalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f9f64,
    roughness: 0.72,
    emissive: 0x123719,
    emissiveIntensity: 0.45,
  });
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
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a5f3e,
    roughness: 0.88,
    metalness: 0.12,
    emissive: 0x24130c,
    emissiveIntensity: 0.2,
  });
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
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x222c2b,
    roughness: 0.94,
    emissive: 0x130b07,
    emissiveIntensity: 0.3,
  });
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
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x163842,
    roughness: 0.82,
    metalness: 0.05,
    emissive: 0x082a31,
    emissiveIntensity: 0.42,
  });
  for (let i = 0; i < 18; i += 1) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random() * 16, 38 + Math.random() * 46, 12), wallMaterial);
    const side = i % 2 === 0 ? -1 : 1;
    wall.position.set(side * (24 + Math.random() * 16), -4 + Math.random() * 4, -72 + i * 8);
    wall.rotation.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.2);
    group.add(wall);
  }
}

function makeAbyssArch(group) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x4b4b62,
    roughness: 0.9,
    emissive: 0x151323,
    emissiveIntensity: 0.34,
  });
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
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.03,
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
  return group;
}

function makeShark(size) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x8fa6ad,
    roughness: 0.64,
    metalness: 0.02,
    emissive: 0x101d22,
    emissiveIntensity: 0.28,
  });
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
  return group;
}

function makeOceanWhale(size) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x526875,
    roughness: 0.72,
    metalness: 0.01,
    emissive: 0x101923,
    emissiveIntensity: 0.24,
  });
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
  return group;
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
  updateMarineLife(elapsed, delta);
  updateEvents(elapsed, delta);
  updateDive(delta, elapsed);
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

function updateMarineLife(elapsed, delta) {
  marineLifeGroup.children.forEach((creature) => {
    const swim = creature.userData.swim;
    if (!swim) return;

    const angle = swim.phase + elapsed * swim.speed;
    const wobble = Math.sin(elapsed * (swim.predator ? 0.9 : 1.6) + swim.phase);
    creature.position.set(
      swim.center.x + Math.cos(angle) * swim.radius,
      swim.center.y + Math.sin(elapsed * 0.45 + swim.phase) * swim.bob,
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
      creature.userData.tail.rotation.y = Math.sin(elapsed * (swim.whale ? 1.6 : 5.8) + swim.phase) * (swim.whale ? 0.08 : 0.22);
    }
    creature.userData.flukes?.forEach((fluke, index) => {
      fluke.rotation.y = Math.sin(elapsed * 1.45 + swim.phase + index) * 0.08;
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

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
