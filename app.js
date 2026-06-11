import * as THREE from "three";

const canvas = document.getElementById("space");
const speedReadout = document.getElementById("speedReadout");
const nearestReadout = document.getElementById("nearestReadout");
const distanceReadout = document.getElementById("distanceReadout");
const targetSelect = document.getElementById("targetSelect");
const warpButton = document.getElementById("warpButton");
const orbitButton = document.getElementById("orbitButton");
const stopButton = document.getElementById("stopButton");
const resetButton = document.getElementById("resetButton");
const throttleSlider = document.getElementById("throttleSlider");
const throttleReadout = document.getElementById("throttleReadout");
const labelsToggle = document.getElementById("labelsToggle");
const trailsToggle = document.getElementById("trailsToggle");
const moonsToggle = document.getElementById("moonsToggle");
const eventsToggle = document.getElementById("eventsToggle");
const targetType = document.getElementById("targetType");
const targetName = document.getElementById("targetName");
const targetInfo = document.getElementById("targetInfo");
const eventType = document.getElementById("eventType");
const eventName = document.getElementById("eventName");
const eventInfo = document.getElementById("eventInfo");

const AU = 95;
const systemScale = 0.000001;
const textureBase = "./assets/textures/";
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06111c, 0.00042);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 15000);
camera.position.set(-115, 32, 158);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

const ship = new THREE.Object3D();
ship.position.copy(camera.position);
ship.rotation.set(-0.08, -0.58, 0);
scene.add(ship);
ship.add(camera);
camera.position.set(0, 0, 0);

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const move = { forward: 0, back: 0, left: 0, right: 0, up: 0, down: 0, boost: 0 };
const mobileMove = { forward: 0, back: 0, left: 0, right: 0 };

let selectedTarget = "Earth";
let autoPilot = null;
let activeLookButton = null;
let yaw = ship.rotation.y;
let pitch = ship.rotation.x;
let throttle = 0.35;
let lastNearest = null;
let eventsEnabled = true;
let nextEventAt = 8;
let zoomFov = camera.fov;
let activeEvent = null;
const renderStatus = {
  frame: 0,
  centerPixel: [0, 0, 0, 0],
  sampleLuma: 0,
  lastSampleAt: -1,
  texturesLoaded: 0,
  textureErrors: 0,
  webgl: true,
};
window.__solarDriftStatus = renderStatus;
document.documentElement.dataset.solarReady = "1";

const bodies = [
  {
    name: "Sun",
    ko: "태양",
    type: "항성",
    radius: 16,
    orbit: 0,
    speed: 0,
    color: "#ffd26b",
    emissive: "#ff8a35",
    texture: "2k_sun.jpg",
    info: "모든 항로의 기준점입니다. 가까이 접근하면 화면 전체가 밝게 달아오릅니다.",
  },
  {
    name: "Mercury",
    ko: "수성",
    type: "암석 행성",
    radius: 2.2,
    orbit: 0.39 * AU,
    speed: 1.62,
    color: "#9b8b78",
    texture: "2k_mercury.jpg",
    info: "태양에 가장 가까운 작은 행성입니다. 표면은 회색빛 암석으로 표현했습니다.",
  },
  {
    name: "Venus",
    ko: "금성",
    type: "구름 행성",
    radius: 4.1,
    orbit: 0.72 * AU,
    speed: 1.18,
    color: "#d8b879",
    texture: "2k_venus_atmosphere.jpg",
    info: "두꺼운 대기와 황금빛 구름층을 가진 행성입니다.",
  },
  {
    name: "Earth",
    ko: "지구",
    type: "해양 행성",
    radius: 4.35,
    orbit: 1 * AU,
    speed: 1,
    color: "#4e9fff",
    texture: "2k_earth_daymap.jpg",
    clouds: "2k_earth_clouds.jpg",
    info: "푸른 바다와 흰 구름이 보이는 기준 행성입니다. 시작 위치가 이 근처입니다.",
    moons: [{ name: "Moon", radius: 1.25, distance: 18, speed: 1.15, color: "#c9c4b7", texture: "2k_moon.jpg" }],
  },
  {
    name: "Mars",
    ko: "화성",
    type: "사막 행성",
    radius: 3.2,
    orbit: 1.52 * AU,
    speed: 0.8,
    color: "#d46a43",
    texture: "2k_mars.jpg",
    info: "붉은 산화철 지표가 돋보이는 행성입니다.",
    moons: [
      { name: "Phobos", radius: 0.55, distance: 11, speed: 1.7, color: "#b99a84" },
      { name: "Deimos", radius: 0.42, distance: 15, speed: 1.15, color: "#9f8774" },
    ],
  },
  {
    name: "Jupiter",
    ko: "목성",
    type: "거대 가스 행성",
    radius: 11.6,
    orbit: 2.92 * AU,
    speed: 0.43,
    color: "#d2a16c",
    texture: "2k_jupiter.jpg",
    info: "태양계에서 가장 큰 행성입니다. 띠무늬 대기와 거대한 중력을 암시합니다.",
    moons: [
      { name: "Io", radius: 0.9, distance: 20, speed: 1.3, color: "#e5c36b" },
      { name: "Europa", radius: 0.78, distance: 25, speed: 1.05, color: "#d8e1df" },
      { name: "Ganymede", radius: 1.05, distance: 31, speed: 0.82, color: "#ad9a83" },
      { name: "Callisto", radius: 0.96, distance: 38, speed: 0.62, color: "#7f746b" },
    ],
  },
  {
    name: "Saturn",
    ko: "토성",
    type: "고리 행성",
    radius: 10,
    orbit: 4.1 * AU,
    speed: 0.32,
    color: "#d9c27d",
    texture: "2k_saturn.jpg",
    ringTexture: "2k_saturn_ring_alpha.png",
    info: "넓은 고리가 특징인 행성입니다. 가까이 가면 얇은 얼음 고리가 펼쳐집니다.",
    rings: true,
    moons: [
      { name: "Titan", radius: 1.2, distance: 23, speed: 0.9, color: "#d7a35e" },
      { name: "Rhea", radius: 0.72, distance: 28, speed: 0.72, color: "#c6c5bd" },
      { name: "Iapetus", radius: 0.65, distance: 34, speed: 0.52, color: "#9c958c" },
      { name: "Enceladus", radius: 0.55, distance: 40, speed: 1.12, color: "#edf5ff" },
    ],
  },
  {
    name: "Uranus",
    ko: "천왕성",
    type: "얼음 거대 행성",
    radius: 7.2,
    orbit: 5.35 * AU,
    speed: 0.23,
    color: "#7bd6d0",
    texture: "2k_uranus.jpg",
    info: "청록색 메탄 대기가 은은하게 빛나는 얼음 거대 행성입니다.",
    moons: [
      { name: "Titania", radius: 0.78, distance: 18, speed: 0.78, color: "#b7d3d0" },
      { name: "Oberon", radius: 0.72, distance: 23, speed: 0.62, color: "#97aaa8" },
      { name: "Miranda", radius: 0.48, distance: 28, speed: 1.18, color: "#d4e6e3" },
    ],
  },
  {
    name: "Neptune",
    ko: "해왕성",
    type: "바람 행성",
    radius: 7,
    orbit: 6.35 * AU,
    speed: 0.18,
    color: "#477cff",
    texture: "2k_neptune.jpg",
    info: "깊은 파란색 대기와 강한 폭풍을 가진 먼 행성입니다.",
    moons: [
      { name: "Triton", radius: 0.95, distance: 18, speed: 0.86, color: "#d8eef1" },
      { name: "Nereid", radius: 0.46, distance: 27, speed: 0.44, color: "#a9b8c5" },
    ],
  },
];

const bodyMap = new Map();
const labelSprites = [];
const orbitLines = [];
const moonGroups = [];
const eventGroup = new THREE.Group();
scene.add(eventGroup);

setupLights();
setupStarfields();
setupDust();
setupSolarSystem();
setupUI();
resetFlight();
animate();

function setupLights() {
  scene.add(new THREE.AmbientLight(0xbfdfff, 0.44));
  scene.add(new THREE.HemisphereLight(0xcdeaff, 0x26334f, 0.52));
  const sunLight = new THREE.PointLight(0xffdf9f, 6.8, 2800, 1.05);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x8fc8ff, 1.1);
  fillLight.position.set(-260, 190, 320);
  scene.add(fillLight);
}

function setupStarfields() {
  scene.add(makeStars(2600, 2100, 0.7, 0xffffff));
  scene.add(makeStars(1100, 4800, 1.25, 0xbddcff));
  scene.add(makeNebula());
}

function makeStars(count, radius, size, color) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);

  for (let i = 0; i < count; i += 1) {
    const r = radius * (0.35 + Math.random() * 0.65);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const index = i * 3;
    positions[index] = r * Math.sin(phi) * Math.cos(theta);
    positions[index + 1] = r * Math.cos(phi);
    positions[index + 2] = r * Math.sin(phi) * Math.sin(theta);

    const starColor = base.clone().lerp(new THREE.Color("#ffdfba"), Math.random() * 0.28);
    colors[index] = starColor.r;
    colors[index + 1] = starColor.g;
    colors[index + 2] = starColor.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function makeNebula() {
  const geometry = new THREE.BufferGeometry();
  const count = 360;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = ["#2d7d9f", "#b3697a", "#6fd2a7", "#dcb06b"];

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const band = (Math.random() - 0.5) * 180;
    const angle = Math.random() * Math.PI * 2;
    const radius = 1100 + Math.random() * 2400;
    positions[index] = Math.cos(angle) * radius;
    positions[index + 1] = band + Math.sin(angle * 3) * 120;
    positions[index + 2] = Math.sin(angle) * radius;
    const color = new THREE.Color(palette[i % palette.length]).multiplyScalar(0.45 + Math.random() * 0.4);
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 9,
      vertexColors: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function setupDust() {
  const geometry = new THREE.BufferGeometry();
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    positions[index] = (Math.random() - 0.5) * 260;
    positions[index + 1] = (Math.random() - 0.5) * 150;
    positions[index + 2] = (Math.random() - 0.5) * 260;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.22,
    color: 0xcff8ff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const dust = new THREE.Points(geometry, material);
  dust.name = "localDust";
  ship.add(dust);
}

function setupSolarSystem() {
  bodies.forEach((body) => {
    const pivot = new THREE.Object3D();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    scene.add(pivot);

    const group = new THREE.Group();
    group.position.x = body.orbit;
    pivot.add(group);

    const mesh = new THREE.Mesh(makePlanetGeometry(body.radius), makePlanetMaterial(body));
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

    if (body.name === "Sun") {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.radius * 1.38, 48, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffb95c,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      group.add(glow);
    }

    if (body.rings) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xf2dcc1,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      });
      applyTextureToMaterial(ringMaterial, body.ringTexture, { alpha: true });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.radius * 1.45, body.radius * 2.42, 128),
        ringMaterial,
      );
      ring.rotation.x = Math.PI / 2.16;
      group.add(ring);
    }

    if (body.clouds) {
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
        roughness: 0.9,
        depthWrite: false,
      });
      applyTextureToMaterial(cloudMaterial, body.clouds, { alpha: true });
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.015, 64, 36), cloudMaterial);
      clouds.userData.cloudLayer = true;
      group.add(clouds);
    }

    const moons = makeMoonSystem(body);
    if (moons.length > 0) {
      moons.forEach((moonPivot) => group.add(moonPivot));
      body.moonPivots = moons;
    }

    const label = makeLabel(body.ko);
    label.position.set(0, body.radius + 6, 0);
    group.add(label);
    labelSprites.push(label);

    if (body.orbit > 0) {
      const orbit = makeOrbit(body.orbit);
      scene.add(orbit);
      orbitLines.push(orbit);
    }

    bodyMap.set(body.name, { ...body, pivot, group, mesh, label, moonPivots: moons });
  });
}

function makeMoonSystem(body) {
  if (!body.moons?.length) return [];

  return body.moons.map((moonSpec, index) => {
    const moonPivot = new THREE.Object3D();
    moonPivot.rotation.y = (Math.PI * 2 * index) / body.moons.length;
    moonPivot.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.12;
    moonPivot.userData.orbitSpeed = moonSpec.speed;

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(moonSpec.radius, 28, 16),
      makePlanetMaterial({ color: moonSpec.color, radius: moonSpec.radius, texture: moonSpec.texture }),
    );
    moon.position.x = body.radius + moonSpec.distance;
    moonPivot.add(moon);

    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(makeCirclePoints(body.radius + moonSpec.distance, 96)),
      new THREE.LineBasicMaterial({
        color: 0xbfe9ff,
        transparent: true,
        opacity: 0.2,
      }),
    );
    orbit.rotation.x = Math.PI / 2;
    moonPivot.add(orbit);
    moonGroups.push(moonPivot);
    return moonPivot;
  });
}

function makePlanetGeometry(radius) {
  return new THREE.SphereGeometry(radius, 64, 36);
}

function makePlanetMaterial(body) {
  if (body.name === "Sun") {
    const material = new THREE.MeshBasicMaterial({
      map: makeTexture(["#fff1a8", "#ffc45e", "#ff7d38", "#9a2e23"], 512, true),
    });
    applyTextureToMaterial(material, body.texture);
    return material;
  }

  const palettes = {
    Earth: ["#2456a3", "#2d8f67", "#e9f8ff", "#163d75"],
    Jupiter: ["#b98452", "#f2d2a1", "#8f5438", "#d7b486"],
    Saturn: ["#d6b774", "#f5dda2", "#a9834d", "#ead79b"],
    Mars: ["#8d3425", "#d66c46", "#f0a06a", "#5b2018"],
    Venus: ["#a7773f", "#e7c681", "#fff0b8", "#8e5e32"],
    Uranus: ["#5bc8c3", "#b9fff7", "#4aa3ac", "#d5fffb"],
    Neptune: ["#2447bb", "#477cff", "#94b7ff", "#17236e"],
    Mercury: ["#5f5a55", "#a19687", "#ddd1bd", "#3a3735"],
  };

  const material = new THREE.MeshStandardMaterial({
    map: makeTexture(palettes[body.name] ?? [body.color, "#ffffff"], 512),
    color: new THREE.Color(body.color).multiplyScalar(1.18),
    roughness: 0.74,
    metalness: 0.02,
    emissive: new THREE.Color(body.emissive ?? body.color ?? "#000000"),
    emissiveIntensity: body.emissive ? 0.9 : 0.12,
  });
  applyTextureToMaterial(material, body.texture);
  return material;
}

function applyTextureToMaterial(material, fileName, options = {}) {
  if (!fileName) return;

  textureLoader.load(
    `${textureBase}${fileName}`,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      material.map = texture;
      if (options.alpha) material.alphaMap = texture;
      material.needsUpdate = true;
      renderStatus.texturesLoaded += 1;
      document.documentElement.dataset.solarTexturesLoaded = String(renderStatus.texturesLoaded);
    },
    undefined,
    () => {
      renderStatus.textureErrors += 1;
      document.documentElement.dataset.solarTextureErrors = String(renderStatus.textureErrors);
      material.needsUpdate = true;
    },
  );
}

function makeTexture(colors, size, solar = false) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size / 2;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, textureCanvas.height);
  colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * textureCanvas.width;
    const y = Math.random() * textureCanvas.height;
    const w = solar ? 3 + Math.random() * 28 : 1 + Math.random() * 18;
    const h = solar ? 2 + Math.random() * 10 : 1 + Math.random() * 6;
    context.globalAlpha = solar ? 0.08 + Math.random() * 0.18 : 0.05 + Math.random() * 0.13;
    context.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    context.beginPath();
    context.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeLabel(text) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 72;
  const context = labelCanvas.getContext("2d");
  context.font = "700 30px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(5, 12, 20, 0.58)";
  context.roundRect(18, 12, 220, 48, 10);
  context.fill();
  context.fillStyle = "#eef7ff";
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

function makeOrbit(radius) {
  const geometry = new THREE.BufferGeometry().setFromPoints(makeCirclePoints(radius, 256));
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x6ee7ff,
      transparent: true,
      opacity: 0.18,
    }),
  );
}

function makeCirclePoints(radius, segments) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return points;
}

function setupUI() {
  bodies
    .filter((body) => body.name !== "Sun")
    .forEach((body) => {
      const option = document.createElement("option");
      option.value = body.name;
      option.textContent = body.ko;
      targetSelect.appendChild(option);
    });
  targetSelect.value = selectedTarget;
  updateTargetCard();

  targetSelect.addEventListener("change", () => {
    selectedTarget = targetSelect.value;
    autoPilot = null;
    updateTargetCard();
  });

  warpButton.addEventListener("click", () => {
    autoPilot = { mode: "warp", target: selectedTarget };
  });

  orbitButton.addEventListener("click", () => {
    autoPilot = { mode: "orbit", target: selectedTarget, angle: 0 };
  });

  stopButton.addEventListener("click", stopFlight);
  resetButton.addEventListener("click", resetFlight);

  throttleSlider.addEventListener("input", () => {
    throttle = Number(throttleSlider.value) / 100;
    throttleReadout.textContent = `${Math.round(throttle * 100)}%`;
  });

  labelsToggle.addEventListener("change", () => {
    labelSprites.forEach((label) => {
      label.visible = labelsToggle.checked;
    });
  });

  trailsToggle.addEventListener("change", () => {
    orbitLines.forEach((line) => {
      line.visible = trailsToggle.checked;
    });
  });

  moonsToggle.addEventListener("change", () => {
    moonGroups.forEach((group) => {
      group.visible = moonsToggle.checked;
    });
  });

  eventsToggle.addEventListener("change", () => {
    eventsEnabled = eventsToggle.checked;
    if (eventsEnabled) {
      scheduleNextEvent(clock.elapsedTime, 3);
      setEventCard("이벤트 대기", "정상 항행", "랜덤 이벤트가 켜져 있습니다. 주변 우주를 계속 스캔합니다.");
    } else {
      clearActiveEvent();
      setEventCard("이벤트 꺼짐", "안정 항로", "랜덤 이벤트가 비활성화되어 소행성군과 블랙홀이 생성되지 않습니다.");
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
    if (activeLookButton === 0) yaw -= event.movementX * 0.0022;
    if (activeLookButton === 2) pitch -= event.movementY * 0.0022;
    pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
    autoPilot = null;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoomFov = THREE.MathUtils.clamp(zoomFov + Math.sign(event.deltaY) * 4, 38, 82);
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
    stopFlight();
    return;
  }
  if (key === "w") move.forward = value;
  if (key === "s") move.back = value;
  if (key === "a") move.left = value;
  if (key === "d") move.right = value;
  if (key === "q") move.down = value;
  if (key === "e") move.up = value;
  if (key === "shift") move.boost = value;
  if (["w", "a", "s", "d", "q", "e", "shift"].includes(key)) {
    autoPilot = null;
  }
}

function stopFlight() {
  autoPilot = null;
  velocity.set(0, 0, 0);
}

function resetFlight() {
  const earth = bodyMap.get("Earth");
  const earthPosition = getWorldPosition(earth);
  ship.position.copy(earthPosition).add(new THREE.Vector3(-28, 11, 36));
  yaw = -0.62;
  pitch = -0.1;
  velocity.set(0, 0, 0);
  autoPilot = null;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateSystem(elapsed, delta);
  updateEvents(elapsed, delta);
  updateFlight(delta, elapsed);
  updateHUD();
  renderer.render(scene, camera);
  sampleRender(elapsed);
}

function sampleRender(elapsed) {
  renderStatus.frame += 1;
  document.documentElement.dataset.solarFrame = String(renderStatus.frame);
  if (elapsed - renderStatus.lastSampleAt < 0.4) return;
  renderStatus.lastSampleAt = elapsed;

  try {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const points = [
      [0.5, 0.5],
      [0.33, 0.42],
      [0.67, 0.42],
      [0.28, 0.62],
      [0.72, 0.62],
      [0.5, 0.32],
      [0.5, 0.72],
      [0.2, 0.5],
      [0.8, 0.5],
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
    document.documentElement.dataset.solarPixel = renderStatus.centerPixel.join(",");
    document.documentElement.dataset.solarLuma = String(renderStatus.sampleLuma);
    document.documentElement.dataset.solarCalls = String(renderer.info.render.calls);
  } catch {
    renderStatus.webgl = false;
    document.documentElement.dataset.solarWebgl = "false";
  }
}

function updateSystem(elapsed, delta) {
  bodyMap.forEach((body) => {
    body.pivot.rotation.y += body.speed * delta * 0.12;
    body.mesh.rotation.y += delta * (body.name === "Sun" ? 0.08 : 0.28);
    body.group.children.forEach((child) => {
      if (child.userData.cloudLayer) child.rotation.y += delta * 0.18;
    });
    body.moonPivots?.forEach((moonPivot) => {
      moonPivot.rotation.y += delta * moonPivot.userData.orbitSpeed;
    });
  });

  const dust = ship.getObjectByName("localDust");
  if (dust) {
    dust.rotation.y = Math.sin(elapsed * 0.25) * 0.04;
    dust.material.opacity = THREE.MathUtils.clamp(0.18 + velocity.length() * 0.032, 0.18, 0.8);
  }
}

function updateEvents(elapsed, delta) {
  if (!eventsEnabled) return;

  if (!activeEvent && elapsed >= nextEventAt) {
    if (Math.random() > 0.45) {
      spawnAsteroidField(elapsed);
    } else {
      spawnBlackHole(elapsed);
    }
  }

  if (!activeEvent) return;

  if (activeEvent.type === "asteroids") {
    activeEvent.objects.forEach((asteroid) => {
      asteroid.position.addScaledVector(asteroid.userData.velocity, delta);
      asteroid.rotation.x += delta * asteroid.userData.spin.x;
      asteroid.rotation.y += delta * asteroid.userData.spin.y;
    });
  }

  if (activeEvent.type === "blackHole") {
    activeEvent.ring.rotation.z += delta * 0.55;
    activeEvent.ring.rotation.x += delta * 0.08;
    const pull = new THREE.Vector3().subVectors(activeEvent.core.getWorldPosition(new THREE.Vector3()), ship.position);
    const distance = pull.length();
    if (distance < 220) {
      velocity.addScaledVector(pull.normalize(), delta * THREE.MathUtils.clamp((220 - distance) * 0.018, 0, 2.1));
    }
  }

  if (elapsed > activeEvent.expiresAt) {
    clearActiveEvent();
    scheduleNextEvent(elapsed);
    setEventCard("이벤트 대기", "정상 항행", "다음 우주 현상을 스캔하고 있습니다.");
  }
}

function spawnAsteroidField(elapsed) {
  clearActiveEvent();
  const group = new THREE.Group();
  const eventPosition = getForwardEventPosition(180, 80);
  group.position.copy(eventPosition);

  const material = new THREE.MeshStandardMaterial({
    color: 0x9b8d80,
    roughness: 0.95,
    metalness: 0.04,
    emissive: 0x4a3e36,
    emissiveIntensity: 0.18,
  });
  const objects = [];
  const drift = forward.clone().multiplyScalar(-18).add(right.clone().multiplyScalar(10 - Math.random() * 20));

  for (let i = 0; i < 54; i += 1) {
    const radius = 0.55 + Math.random() * 2.5;
    const asteroid = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), material);
    asteroid.position.set((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 85, (Math.random() - 0.5) * 95);
    asteroid.scale.setScalar(0.7 + Math.random() * 1.4);
    asteroid.userData.velocity = drift
      .clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12));
    asteroid.userData.spin = new THREE.Vector3(0.3 + Math.random() * 1.8, 0.3 + Math.random() * 1.8, 0);
    group.add(asteroid);
    objects.push(asteroid);
  }

  eventGroup.add(group);
  activeEvent = { type: "asteroids", group, objects, expiresAt: elapsed + 18 };
  setEventCard("랜덤 이벤트", "소행성군 접근", "작은 소행성들이 항로를 가로지릅니다. 속도를 낮추거나 방향을 살짝 틀어 통과하세요.");
}

function spawnBlackHole(elapsed) {
  clearActiveEvent();
  const group = new THREE.Group();
  group.position.copy(getForwardEventPosition(230, 120));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(18, 2.2, 18, 120),
    new THREE.MeshBasicMaterial({
      color: 0xffc36b,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
    }),
  );
  ring.rotation.x = Math.PI / 2.7;
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(27, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0x826dff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const light = new THREE.PointLight(0xffbb77, 1.8, 210, 1.2);

  group.add(halo, ring, core, light);
  eventGroup.add(group);
  activeEvent = { type: "blackHole", group, core, ring, expiresAt: elapsed + 22 };
  setEventCard("랜덤 이벤트", "미니 블랙홀 조우", "주변 공간이 휘어집니다. 가까워지면 약한 중력 끌림이 생기니 정지나 워프로 벗어나세요.");
}

function getForwardEventPosition(distance, spread) {
  ship.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(ship.quaternion).normalize();
  up.set(0, 1, 0).applyQuaternion(ship.quaternion).normalize();
  return ship.position
    .clone()
    .addScaledVector(forward, distance)
    .addScaledVector(right, (Math.random() - 0.5) * spread)
    .addScaledVector(up, (Math.random() - 0.5) * spread * 0.5);
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

function scheduleNextEvent(elapsed, minimumDelay = 10) {
  nextEventAt = elapsed + minimumDelay + Math.random() * 16;
}

function setEventCard(type, name, info) {
  eventType.textContent = type;
  eventName.textContent = name;
  eventInfo.textContent = info;
}

function updateFlight(delta, elapsed) {
  ship.rotation.set(pitch, yaw, Math.sin(elapsed * 0.6) * 0.006);
  ship.getWorldDirection(forward);
  right.set(1, 0, 0).applyQuaternion(ship.quaternion).normalize();
  up.set(0, 1, 0).applyQuaternion(ship.quaternion).normalize();

  if (autoPilot) {
    runAutopilot(delta);
  } else {
    const cruiseSpeed = 28 + throttle * 150;
    const boost = move.boost ? 1.85 : 1;
    const desired = new THREE.Vector3();
    desired.addScaledVector(forward, move.forward - move.back);
    desired.addScaledVector(right, move.right - move.left);
    desired.addScaledVector(up, move.up - move.down);
    if (desired.lengthSq() > 0) {
      desired.normalize().multiplyScalar(cruiseSpeed * boost);
      velocity.lerp(desired, THREE.MathUtils.clamp(delta * 4.8, 0, 1));
    } else {
      velocity.multiplyScalar(Math.pow(0.1, delta));
    }
  }

  velocity.multiplyScalar(Math.pow(autoPilot ? 0.84 : 0.72, delta));
  const maxSpeed = autoPilot ? 260 : 70 + throttle * 180;
  if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);
  ship.position.addScaledVector(velocity, delta);
}

function runAutopilot(delta) {
  const target = bodyMap.get(autoPilot.target);
  const position = getWorldPosition(target);
  const offsetDistance = target.radius * (autoPilot.mode === "orbit" ? 6 : 4.4) + 22;
  const toTarget = new THREE.Vector3().subVectors(position, ship.position);
  const distance = toTarget.length();

  if (autoPilot.mode === "orbit") {
    autoPilot.angle = (autoPilot.angle ?? 0) + delta * 0.38;
    const orbitPosition = position
      .clone()
      .add(new THREE.Vector3(Math.cos(autoPilot.angle) * offsetDistance, target.radius * 1.25, Math.sin(autoPilot.angle) * offsetDistance));
    steerToward(orbitPosition, delta, 0.92);
    lookToward(position, delta, 0.035);
    return;
  }

  const arrival = Math.max(offsetDistance, target.radius * 4.2);
  if (distance < arrival) {
    autoPilot = { mode: "orbit", target: autoPilot.target, angle: Math.atan2(ship.position.z - position.z, ship.position.x - position.x) };
    velocity.multiplyScalar(0.28);
    return;
  }

  steerToward(position, delta, 1.35);
  lookToward(position, delta, 0.025);
}

function steerToward(destination, delta, force) {
  const desired = new THREE.Vector3().subVectors(destination, ship.position);
  const distance = desired.length();
  if (distance < 0.001) return;
  desired.normalize().multiplyScalar(Math.min(260, 52 + distance * 0.42));
  velocity.lerp(desired, THREE.MathUtils.clamp(delta * force, 0, 1));
}

function lookToward(destination, delta, force) {
  const direction = new THREE.Vector3().subVectors(destination, ship.position).normalize();
  const targetYaw = Math.atan2(-direction.x, -direction.z);
  const targetPitch = Math.asin(direction.y);
  yaw = lerpAngle(yaw, targetYaw, THREE.MathUtils.clamp(delta / force, 0, 1));
  pitch = THREE.MathUtils.lerp(pitch, targetPitch, THREE.MathUtils.clamp(delta / force, 0, 1));
}

function lerpAngle(a, b, t) {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function updateHUD() {
  const nearest = findNearestBody();
  const speed = velocity.length() * 4.2;

  if (nearest.name !== lastNearest) {
    lastNearest = nearest.name;
    if (!autoPilot) {
      const body = bodyMap.get(nearest.name);
      if (body && nearest.distance < body.radius * 22) {
        selectedTarget = body.name === "Sun" ? selectedTarget : body.name;
        targetSelect.value = selectedTarget;
        updateTargetCard();
      }
    }
  }

  speedReadout.textContent = `${Math.round(speed).toLocaleString("ko-KR")} km/s`;
  nearestReadout.textContent = nearest.ko;
  distanceReadout.textContent = formatDistance(nearest.distance);
}

function updateTargetCard() {
  const body = bodies.find((item) => item.name === selectedTarget);
  if (!body) return;
  targetType.textContent = body.type;
  targetName.textContent = body.ko;
  targetInfo.textContent = body.info;
}

function findNearestBody() {
  let nearest = null;
  bodyMap.forEach((body) => {
    const distance = getWorldPosition(body).distanceTo(ship.position) - body.radius;
    if (!nearest || distance < nearest.distance) nearest = { ...body, distance: Math.max(0, distance) };
  });
  return nearest;
}

function getWorldPosition(body) {
  const position = new THREE.Vector3();
  body.group.getWorldPosition(position);
  return position;
}

function formatDistance(distance) {
  const kilometers = Math.max(1, distance / systemScale);
  if (kilometers > 1000000) return `${(kilometers / 1000000).toFixed(2)}백만 km`;
  if (kilometers > 1000) return `${Math.round(kilometers / 1000).toLocaleString("ko-KR")}천 km`;
  return `${Math.round(kilometers).toLocaleString("ko-KR")} km`;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
