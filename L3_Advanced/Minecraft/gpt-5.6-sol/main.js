const THREE = await loadThree();

async function loadThree() {
  try {
    return await import("./vendor/three.module.js");
  } catch (localError) {
    console.warn("Local Three.js unavailable, using the pinned CDN module.", localError);
    return import("https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js");
  }
}

const dom = {
  viewport: document.querySelector("#viewport"),
  loading: document.querySelector("#loading-screen"),
  loadingState: document.querySelector("#loading-state"),
  loadingProgress: document.querySelector("#loading-progress"),
  entry: document.querySelector("#entry-screen"),
  enterWorld: document.querySelector("#enter-world"),
  seedLabel: document.querySelector("#world-seed-label"),
  biome: document.querySelector("#biome-name"),
  coordinates: document.querySelector("#coordinates"),
  dayLabel: document.querySelector("#day-label"),
  timeLabel: document.querySelector("#time-label"),
  timeIcon: document.querySelector("#time-icon"),
  health: document.querySelector("#health-fill"),
  stamina: document.querySelector("#stamina-fill"),
  targetLabel: document.querySelector("#target-label"),
  hotbar: document.querySelector("#hotbar"),
  inventoryButton: document.querySelector("#inventory-button"),
  saveButton: document.querySelector("#save-button"),
  inventoryPanel: document.querySelector("#inventory-panel"),
  closeInventory: document.querySelector("#close-inventory"),
  inventoryGrid: document.querySelector("#inventory-grid"),
  itemsTab: document.querySelector("#items-tab"),
  craftingTab: document.querySelector("#crafting-tab"),
  settingsTab: document.querySelector("#settings-tab"),
  recipeList: document.querySelector("#recipe-list"),
  eternalDayToggle: document.querySelector("#eternal-day-toggle"),
  creativeModeToggle: document.querySelector("#creative-mode-toggle"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  toast: document.querySelector("#toast"),
  damageFlash: document.querySelector("#damage-flash"),
  movePad: document.querySelector("#move-pad"),
  moveStick: document.querySelector("#move-stick"),
  touchBreak: document.querySelector("#touch-break"),
  touchPlace: document.querySelector("#touch-place"),
  touchInventory: document.querySelector("#touch-inventory"),
  touchJump: document.querySelector("#touch-jump"),
  touchDescend: document.querySelector("#touch-descend"),
  fatal: document.querySelector("#fatal-error"),
  fatalMessage: document.querySelector("#fatal-message"),
};

const WORLD_SEED = 560713;
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 34;
const WATER_LEVEL = 8;
const verificationMode = new URLSearchParams(location.search).get("verify") === "1";
const RENDER_DISTANCE = verificationMode ? 1 : matchMedia("(max-width: 760px)").matches ? 2 : 3;
const MAX_PIXEL_RATIO = verificationMode ? 1 : 1.5;
const DAY_DURATION = 720;
const ETERNAL_DAY_TIME = DAY_DURATION * 0.5;
const SAVE_KEY = "fangjie-world-v1";
const touchMode = matchMedia("(pointer: coarse)").matches;

document.body.dataset.verificationMode = String(verificationMode);

const Block = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  PLANKS: 6,
  LEAVES: 7,
  WATER: 8,
  GLASS: 9,
  BRICKS: 10,
  COAL_ORE: 11,
  IRON_ORE: 12,
  SNOW: 13,
  COBBLE: 14,
  CRAFTING: 15,
});

const blockDefinitions = [
  { id: Block.AIR, key: "air", name: "空气", solid: false },
  { id: Block.GRASS, key: "grass", name: "草方块", solid: true, top: "grassTop", side: "grassSide", bottom: "dirt", color: 0x6f9e48 },
  { id: Block.DIRT, key: "dirt", name: "泥土", solid: true, texture: "dirt", color: 0x79533a },
  { id: Block.STONE, key: "stone", name: "岩石", solid: true, texture: "stone", color: 0x777d7c },
  { id: Block.SAND, key: "sand", name: "沙子", solid: true, texture: "sand", color: 0xd9c77e },
  { id: Block.LOG, key: "log", name: "原木", solid: true, top: "planks", side: "log", bottom: "planks", color: 0x8a5b35 },
  { id: Block.PLANKS, key: "planks", name: "木板", solid: true, texture: "planks", color: 0xb07b45 },
  { id: Block.LEAVES, key: "leaves", name: "树叶", solid: true, texture: "leaves", color: 0x3f7d45 },
  { id: Block.WATER, key: "water", name: "水", solid: false, texture: "water", color: 0x4d9cc8, liquid: true },
  { id: Block.GLASS, key: "glass", name: "玻璃", solid: true, texture: "glass", color: 0x9bd2d2, transparent: true },
  { id: Block.BRICKS, key: "bricks", name: "红砖", solid: true, texture: "bricks", color: 0xa95e4d },
  { id: Block.COAL_ORE, key: "coalOre", name: "煤矿石", solid: true, texture: "coalOre", color: 0x4b4f50 },
  { id: Block.IRON_ORE, key: "ironOre", name: "铁矿石", solid: true, texture: "ironOre", color: 0xa97a61 },
  { id: Block.SNOW, key: "snow", name: "雪块", solid: true, texture: "snow", color: 0xe7efec },
  { id: Block.COBBLE, key: "cobble", name: "圆石", solid: true, texture: "cobble", color: 0x696f6e },
  { id: Block.CRAFTING, key: "crafting", name: "工作台", solid: true, top: "crafting", side: "planks", bottom: "planks", color: 0x9a6137 },
];

const blockById = new Map(blockDefinitions.map((definition) => [definition.id, definition]));
const placeableBlocks = blockDefinitions.filter((definition) => definition.id > 0 && definition.id !== Block.WATER);

const textureOrder = [
  "grassTop",
  "grassSide",
  "dirt",
  "stone",
  "sand",
  "log",
  "planks",
  "leaves",
  "water",
  "glass",
  "bricks",
  "coalOre",
  "ironOre",
  "snow",
  "cobble",
  "crafting",
];
const textureIndex = new Map(textureOrder.map((key, index) => [key, index]));

const faces = [
  { name: "east", dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { name: "west", dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { name: "top", dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { name: "bottom", dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { name: "south", dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { name: "north", dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const uvTriangles = [
  [0, 0], [0, 1], [1, 1],
  [0, 0], [1, 1], [1, 0],
];
const cornerTriangles = [0, 1, 2, 0, 2, 3];

let renderer;
let scene;
let camera;
let skyLight;
let sunLight;
let sunMesh;
let blockMaterials = [];
let textureCanvases = new Map();
let texturePreviews = new Map();
let waterTexture;
let selector;
let worldClock = DAY_DURATION * (8 / 24);
let dayCount = 1;
let toastTimer = 0;
let lastFrame = performance.now();
let hudAccumulator = 0;
let chunkAccumulator = 0;
let saveAccumulator = 0;
let active = false;
let inventoryOpen = false;
let currentTarget = null;
let lookTouchId = null;
let lookTouchPosition = null;
let moveTouchId = null;
let moveInput = { x: 0, y: 0 };
let touchAscend = false;
let touchDescend = false;
let lastCenterChunk = "";

const chunks = new Map();
const chunkQueue = [];
const queuedChunks = new Set();
const edits = new Map();
const particles = [];
const keys = new Set();
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const clockColor = new THREE.Color();
const daySky = new THREE.Color(0x83cae0);
const duskSky = new THREE.Color(0xd47b5c);
const nightSky = new THREE.Color(0x111a2a);
const fogColor = new THREE.Color();
const terrainHeightCache = new Map();
const biomeCache = new Map();
const treeRootCache = new Map();

const gameOptions = {
  eternalDay: false,
  creativeMode: false,
};

const inventory = new Map([
  [Block.GRASS, 24],
  [Block.DIRT, 32],
  [Block.STONE, 24],
  [Block.SAND, 12],
  [Block.LOG, 10],
  [Block.PLANKS, 20],
  [Block.LEAVES, 8],
  [Block.GLASS, 8],
  [Block.BRICKS, 8],
  [Block.COAL_ORE, 0],
  [Block.IRON_ORE, 0],
  [Block.SNOW, 6],
  [Block.COBBLE, 18],
  [Block.CRAFTING, 1],
]);

const hotbar = [
  Block.GRASS,
  Block.DIRT,
  Block.STONE,
  Block.PLANKS,
  Block.LOG,
  Block.GLASS,
  Block.BRICKS,
  Block.COBBLE,
  Block.CRAFTING,
];
let selectedSlot = 0;

const recipes = [
  { result: Block.PLANKS, amount: 4, cost: [[Block.LOG, 1]] },
  { result: Block.CRAFTING, amount: 1, cost: [[Block.PLANKS, 4]] },
  { result: Block.GLASS, amount: 2, cost: [[Block.SAND, 3]] },
  { result: Block.BRICKS, amount: 2, cost: [[Block.COBBLE, 4], [Block.DIRT, 2]] },
];

const player = {
  position: new THREE.Vector3(0.5, 18, 0.5),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.08,
  radius: 0.32,
  height: 1.75,
  eyeHeight: 1.6,
  grounded: false,
  health: 100,
  stamina: 100,
  jumpQueued: false,
};

const clouds = [];

async function init() {
  dom.seedLabel.textContent = `世界种子 ${WORLD_SEED}`;
  loadSave();
  setLoading(0.08, "绘制方块纹理");
  await createTextureSet();
  setLoading(0.18, "建立光照与天空");
  setupRenderer();
  setupScene();
  setupInterface();

  if (!Number.isFinite(player.position.y) || player.position.y < 1) {
    setSpawn();
  }

  const spawnChunkX = floorDiv(player.position.x, CHUNK_SIZE);
  const spawnChunkZ = floorDiv(player.position.z, CHUNK_SIZE);
  const initialChunks = [];
  for (let radius = 0; radius <= 1; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        initialChunks.push([spawnChunkX + dx, spawnChunkZ + dz]);
      }
    }
  }

  for (let index = 0; index < initialChunks.length; index += 1) {
    const [cx, cz] = initialChunks[index];
    buildChunk(cx, cz);
    setLoading(0.2 + ((index + 1) / initialChunks.length) * 0.68, `生成区块 ${index + 1} / ${initialChunks.length}`);
    await nextFrame();
  }

  ensureChunks();
  updateCamera();
  updateHotbar();
  updateInventory();
  updateCrafting();
  applyGameOptions();
  updateHud(0);
  runSelfChecks();
  setLoading(1, "世界就绪");
  await wait(180);
  dom.loading.classList.add("is-hidden");
  dom.entry.classList.remove("is-hidden");
  document.body.dataset.gameReady = "true";
  animate(performance.now());
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.domElement.tabIndex = 0;
  dom.viewport.appendChild(renderer.domElement);
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = daySky.clone();
  scene.fog = new THREE.Fog(daySky.clone(), 20, CHUNK_SIZE * (RENDER_DISTANCE + 1.25));

  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 150);
  camera.rotation.order = "YXZ";

  skyLight = new THREE.HemisphereLight(0xcbe8f0, 0x5f5b48, 1.35);
  scene.add(skyLight);

  sunLight = new THREE.DirectionalLight(0xfff1c3, 1.8);
  sunLight.position.set(28, 50, 18);
  scene.add(sunLight);

  const sunGeometry = new THREE.SphereGeometry(2.3, 12, 8);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd74, fog: false });
  sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sunMesh);

  selector = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012)),
    new THREE.LineBasicMaterial({ color: 0xfff3b4, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  selector.renderOrder = 9;
  selector.visible = false;
  scene.add(selector);

  createClouds();
  addResizeHandler();
}

function setupInterface() {
  dom.enterWorld.addEventListener("click", enterWorld);
  dom.inventoryButton.addEventListener("click", openInventory);
  dom.saveButton.addEventListener("click", () => {
    saveWorld();
    showToast("世界已保存");
  });
  dom.closeInventory.addEventListener("click", () => closeInventory(true));

  dom.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchInventoryTab(button.dataset.tab));
  });
  dom.eternalDayToggle.addEventListener("change", () => {
    setGameOption("eternalDay", dom.eternalDayToggle.checked);
  });
  dom.creativeModeToggle.addEventListener("change", () => {
    setGameOption("creativeMode", dom.creativeModeToggle.checked);
  });

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", (event) => keys.delete(event.code));
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("pointerlockchange", onPointerLockChange);

  renderer.domElement.addEventListener("pointerdown", onLookPointerDown);
  renderer.domElement.addEventListener("pointermove", onLookPointerMove);
  renderer.domElement.addEventListener("pointerup", onLookPointerUp);
  renderer.domElement.addEventListener("pointercancel", onLookPointerUp);

  dom.movePad.addEventListener("pointerdown", onMovePointerDown);
  dom.movePad.addEventListener("pointermove", onMovePointerMove);
  dom.movePad.addEventListener("pointerup", onMovePointerUp);
  dom.movePad.addEventListener("pointercancel", onMovePointerUp);

  dom.touchBreak.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    breakTargetBlock();
  });
  dom.touchPlace.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    placeTargetBlock();
  });
  dom.touchInventory.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    openInventory();
  });
  dom.touchJump.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (gameOptions.creativeMode) {
      touchAscend = true;
      dom.touchJump.setPointerCapture(event.pointerId);
    } else {
      player.jumpQueued = true;
    }
  });
  dom.touchJump.addEventListener("pointerup", () => {
    touchAscend = false;
  });
  dom.touchJump.addEventListener("pointercancel", () => {
    touchAscend = false;
  });
  dom.touchDescend.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!gameOptions.creativeMode) return;
    touchDescend = true;
    dom.touchDescend.setPointerCapture(event.pointerId);
  });
  dom.touchDescend.addEventListener("pointerup", () => {
    touchDescend = false;
  });
  dom.touchDescend.addEventListener("pointercancel", () => {
    touchDescend = false;
  });

  addEventListener("beforeunload", saveWorld);
  addEventListener("blur", () => {
    keys.clear();
    touchAscend = false;
    touchDescend = false;
  });
}

async function createTextureSet() {
  let atlas = null;
  try {
    const configUrl = new URL("./assets/texture-config.json", window.location.href);
    const response = await fetch(configUrl, { cache: "no-store" });
    const config = response.ok ? await response.json() : {};
    if (config.cctqAtlas) {
      atlas = await loadImage(new URL(config.cctqAtlas, configUrl));
      document.body.dataset.textureSource = "cctq-image";
    } else {
      document.body.dataset.textureSource = "procedural-fallback";
    }
  } catch {
    document.body.dataset.textureSource = "procedural-fallback";
  }

  textureOrder.forEach((key, index) => {
    const canvas = atlas ? cropAtlasTile(atlas, index) : drawProceduralTexture(key);
    textureCanvases.set(key, canvas);
    texturePreviews.set(key, canvas.toDataURL("image/png"));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.wrapS = key === "water" ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = key === "water" ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (key === "water") waterTexture = texture;

    const transparent = key === "water" || key === "glass";
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent,
      opacity: key === "water" ? 0.72 : key === "glass" ? 0.42 : 1,
      depthWrite: !transparent,
      alphaTest: key === "glass" ? 0.05 : 0,
      side: THREE.FrontSide,
    });
    blockMaterials.push(material);
  });
}

async function loadImage(source) {
  const imageUrl = new URL(source, window.location.href);
  imageUrl.searchParams.set("v", "2");
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Image unavailable: ${response.status}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function cropAtlasTile(image, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const cellWidth = image.naturalWidth / 4;
  const cellHeight = image.naturalHeight / 4;
  const column = index % 4;
  const row = Math.floor(index / 4);
  context.drawImage(image, column * cellWidth, row * cellHeight, cellWidth, cellHeight, 0, 0, 32, 32);
  return canvas;
}

function drawProceduralTexture(key) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const random = seededRandom(hashString(key) ^ WORLD_SEED);

  const fill = (color) => {
    context.fillStyle = color;
    context.fillRect(0, 0, 32, 32);
  };
  const pixel = (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(Math.floor(x), Math.floor(y), width, height);
  };
  const noise = (count, colors, minSize = 1, maxSize = 3) => {
    for (let index = 0; index < count; index += 1) {
      const size = minSize + Math.floor(random() * (maxSize - minSize + 1));
      pixel(random() * 32, random() * 32, size, size, colors[Math.floor(random() * colors.length)]);
    }
  };

  switch (key) {
    case "grassTop":
      fill("#69a846");
      noise(72, ["#82bd55", "#4e8d3e", "#91c35b", "#3f7737"], 1, 2);
      break;
    case "grassSide":
      fill("#80583b");
      noise(42, ["#6e4934", "#936746", "#593e30"], 1, 2);
      pixel(0, 0, 32, 8, "#68a548");
      for (let x = 0; x < 32; x += 2) {
        pixel(x, 7, 2, 1 + Math.floor(random() * 5), random() > 0.4 ? "#5b963f" : "#7db453");
      }
      noise(18, ["#8cc15b", "#4d8639"], 1, 2);
      break;
    case "dirt":
      fill("#80583b");
      noise(68, ["#6b4934", "#956848", "#5a3d2f", "#a0704d"], 1, 3);
      break;
    case "stone":
      fill("#777c7b");
      noise(64, ["#646968", "#8b908e", "#555b5c", "#9ba09d"], 1, 3);
      break;
    case "sand":
      fill("#d8c57d");
      noise(58, ["#ead995", "#c6b46f", "#bba866", "#f0dfa0"], 1, 2);
      break;
    case "log":
      fill("#805530");
      for (let x = 2; x < 32; x += 6) {
        pixel(x, 0, 2, 32, x % 12 ? "#9a6838" : "#684324");
      }
      noise(30, ["#a7743f", "#5d3a23"], 1, 3);
      break;
    case "planks":
      fill("#ad7842");
      for (let y = 0; y < 32; y += 8) {
        pixel(0, y, 32, 1, "#734b2d");
        const offset = y % 16 ? 12 : 22;
        pixel(offset, y, 1, 8, "#7c5030");
      }
      noise(26, ["#c58b4e", "#8d5e37"], 1, 3);
      break;
    case "leaves":
      fill("#397743");
      noise(86, ["#2b6639", "#4c8e4d", "#65a657", "#275633"], 1, 3);
      pixel(4, 4, 3, 3, "#82b867");
      pixel(23, 12, 2, 4, "#22512f");
      break;
    case "water":
      fill("#4698c5");
      for (let y = 3; y < 32; y += 7) {
        pixel(2 + (y % 5), y, 17, 2, "#65b5d7");
        pixel(19, y + 3, 10, 1, "#2f7fad");
      }
      noise(16, ["#78c7df", "#347eae"], 1, 2);
      break;
    case "glass":
      fill("#a5d5d2");
      pixel(2, 2, 3, 22, "#e9ffff");
      pixel(5, 2, 15, 2, "#e9ffff");
      pixel(25, 10, 2, 18, "#689fa3");
      pixel(14, 21, 12, 2, "#78b6b7");
      noise(12, ["#d9f2ed", "#70aeb1"], 1, 2);
      break;
    case "bricks":
      fill("#a65d4d");
      for (let y = 0; y < 32; y += 8) {
        pixel(0, y, 32, 2, "#d1a087");
        const offset = y % 16 ? 8 : 20;
        pixel(offset, y, 2, 8, "#d1a087");
      }
      noise(26, ["#8d493f", "#bf715d"], 1, 2);
      break;
    case "coalOre":
      fill("#737979");
      noise(52, ["#858a88", "#5f6565"], 1, 2);
      noise(18, ["#272c2d", "#34393a", "#171b1c"], 2, 4);
      break;
    case "ironOre":
      fill("#757a78");
      noise(50, ["#8c908d", "#5f6463"], 1, 2);
      noise(17, ["#b27658", "#8d5b49", "#c48b68"], 2, 4);
      break;
    case "snow":
      fill("#e9f0ec");
      noise(48, ["#d2dfdf", "#f8fbf4", "#b9cfd2"], 1, 2);
      pixel(0, 27, 32, 5, "#c3d7db");
      break;
    case "cobble":
      fill("#666c6b");
      for (let y = 1; y < 32; y += 8) {
        pixel(0, y, 32, 2, "#4e5555");
      }
      for (let x = 4; x < 32; x += 9) {
        pixel(x, 0, 2, 32, "#555b5a");
      }
      noise(38, ["#7b8280", "#8b918e", "#4d5353"], 1, 3);
      break;
    case "crafting":
      fill("#986139");
      pixel(2, 2, 28, 28, "#bd8449");
      pixel(4, 4, 24, 3, "#6b4328");
      pixel(4, 15, 24, 2, "#6b4328");
      pixel(15, 4, 2, 24, "#6b4328");
      pixel(6, 20, 7, 6, "#82502e");
      pixel(19, 20, 7, 6, "#82502e");
      break;
    default:
      fill("#ff00ff");
  }

  return canvas;
}

function buildChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  const existing = chunks.get(key);
  if (existing) {
    scene.remove(existing.mesh);
    existing.geometry.dispose();
  }

  const buckets = textureOrder.map(() => ({ positions: [], normals: [], uvs: [] }));
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;

  for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const x = startX + localX;
      const z = startZ + localZ;
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        const block = getBlock(x, y, z);
        if (block === Block.AIR) continue;
        for (const face of faces) {
          const neighbor = getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          if (!shouldRenderFace(block, neighbor)) continue;
          const textureKey = textureForFace(block, face.name);
          appendFace(buckets[textureIndex.get(textureKey)], x, y, z, face);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  let groupStart = 0;

  buckets.forEach((bucket, materialIndex) => {
    if (!bucket.positions.length) return;
    positions.push(...bucket.positions);
    normals.push(...bucket.normals);
    uvs.push(...bucket.uvs);
    geometry.addGroup(groupStart, bucket.positions.length / 3, materialIndex);
    groupStart += bucket.positions.length / 3;
  });

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, blockMaterials);
  mesh.userData.worldChunk = key;
  scene.add(mesh);
  chunks.set(key, { cx, cz, mesh, geometry });
  queuedChunks.delete(key);
}

function appendFace(bucket, x, y, z, face) {
  for (let index = 0; index < cornerTriangles.length; index += 1) {
    const corner = face.corners[cornerTriangles[index]];
    bucket.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    bucket.normals.push(face.dir[0], face.dir[1], face.dir[2]);
    bucket.uvs.push(uvTriangles[index][0], uvTriangles[index][1]);
  }
}

function shouldRenderFace(block, neighbor) {
  if (neighbor === Block.AIR) return true;
  if (block === Block.WATER) return neighbor !== Block.WATER;
  if (neighbor === Block.WATER) return true;
  const current = blockById.get(block);
  const adjacent = blockById.get(neighbor);
  if (adjacent?.transparent) return block !== neighbor || !current?.transparent;
  return false;
}

function textureForFace(block, faceName) {
  const definition = blockById.get(block);
  if (faceName === "top" && definition.top) return definition.top;
  if (faceName === "bottom" && definition.bottom) return definition.bottom;
  return definition.side || definition.texture || definition.top;
}

function ensureChunks() {
  const centerX = floorDiv(player.position.x, CHUNK_SIZE);
  const centerZ = floorDiv(player.position.z, CHUNK_SIZE);
  const centerKey = chunkKey(centerX, centerZ);
  if (centerKey === lastCenterChunk && chunkQueue.length) return;
  lastCenterChunk = centerKey;

  const desired = [];
  const keep = new Set();
  for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz += 1) {
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx += 1) {
      if (dx * dx + dz * dz > (RENDER_DISTANCE + 0.65) ** 2) continue;
      const cx = centerX + dx;
      const cz = centerZ + dz;
      const key = chunkKey(cx, cz);
      keep.add(key);
      if (!chunks.has(key) && !queuedChunks.has(key)) {
        desired.push({ cx, cz, distance: dx * dx + dz * dz });
      }
    }
  }

  desired.sort((a, b) => a.distance - b.distance);
  desired.forEach(({ cx, cz }) => {
    const key = chunkKey(cx, cz);
    queuedChunks.add(key);
    chunkQueue.push([cx, cz]);
  });

  for (const [key, chunk] of chunks) {
    const dx = chunk.cx - centerX;
    const dz = chunk.cz - centerZ;
    if (!keep.has(key) && Math.max(Math.abs(dx), Math.abs(dz)) > RENDER_DISTANCE + 1) {
      scene.remove(chunk.mesh);
      chunk.geometry.dispose();
      chunks.delete(key);
    }
  }
}

function processChunkQueue() {
  if (!chunkQueue.length) return;
  const [cx, cz] = chunkQueue.shift();
  const key = chunkKey(cx, cz);
  if (!queuedChunks.has(key)) return;
  buildChunk(cx, cz);
}

function rebuildAround(x, z) {
  const cx = floorDiv(x, CHUNK_SIZE);
  const cz = floorDiv(z, CHUNK_SIZE);
  const affected = [[cx, cz]];
  if (mod(x, CHUNK_SIZE) === 0) affected.push([cx - 1, cz]);
  if (mod(x, CHUNK_SIZE) === CHUNK_SIZE - 1) affected.push([cx + 1, cz]);
  if (mod(z, CHUNK_SIZE) === 0) affected.push([cx, cz - 1]);
  if (mod(z, CHUNK_SIZE) === CHUNK_SIZE - 1) affected.push([cx, cz + 1]);
  affected.forEach(([chunkX, chunkZ]) => {
    if (chunks.has(chunkKey(chunkX, chunkZ))) buildChunk(chunkX, chunkZ);
  });
}

function getBlock(x, y, z) {
  if (y < 0 || y >= WORLD_HEIGHT) return Block.AIR;
  const editKey = blockKey(x, y, z);
  if (edits.has(editKey)) return edits.get(editKey);
  return generatedBlockAt(x, y, z);
}

function setBlock(x, y, z, block) {
  const key = blockKey(x, y, z);
  const generated = generatedBlockAt(x, y, z);
  if (generated === block) edits.delete(key);
  else edits.set(key, block);
  rebuildAround(x, z);
  saveWorld();
}

function generatedBlockAt(x, y, z) {
  const height = terrainHeight(x, z);
  const biome = biomeAt(x, z);

  if (y <= height) {
    if (y === 0) return Block.COBBLE;
    if (y === height) {
      if (biome.id === "desert" || height <= WATER_LEVEL) return Block.SAND;
      if (biome.id === "tundra" || height >= 18) return Block.SNOW;
      return Block.GRASS;
    }
    if (y >= height - 3) {
      if (biome.id === "desert" || height <= WATER_LEVEL) return Block.SAND;
      return Block.DIRT;
    }
    const ore = hash3(x, y, z, WORLD_SEED + 81);
    if (y < 14 && ore > 0.972) return Block.COAL_ORE;
    if (y < 10 && ore < 0.025) return Block.IRON_ORE;
    return Block.STONE;
  }

  const treeBlock = generatedTreeBlock(x, y, z);
  if (treeBlock !== Block.AIR) return treeBlock;
  if (y <= WATER_LEVEL) return Block.WATER;
  return Block.AIR;
}

function generatedTreeBlock(x, y, z) {
  for (let rootZ = z - 2; rootZ <= z + 2; rootZ += 1) {
    for (let rootX = x - 2; rootX <= x + 2; rootX += 1) {
      if (!isTreeRoot(rootX, rootZ)) continue;
      const rootY = terrainHeight(rootX, rootZ);
      const dy = y - rootY;
      const dx = Math.abs(x - rootX);
      const dz = Math.abs(z - rootZ);
      if (dx === 0 && dz === 0 && dy >= 1 && dy <= 4) return Block.LOG;
      if (dy >= 3 && dy <= 6) {
        const crown = dx + dz + Math.abs(dy - 4.5) * 0.55;
        if (dx <= 2 && dz <= 2 && crown <= 3.65) return Block.LEAVES;
      }
    }
  }
  return Block.AIR;
}

function isTreeRoot(x, z) {
  const key = `${x},${z}`;
  if (treeRootCache.has(key)) return treeRootCache.get(key);
  const biome = biomeAt(x, z);
  if (biome.id === "desert" || biome.id === "tundra") {
    treeRootCache.set(key, false);
    return false;
  }
  const height = terrainHeight(x, z);
  if (height <= WATER_LEVEL + 1 || height >= WORLD_HEIGHT - 7) {
    treeRootCache.set(key, false);
    return false;
  }
  const chance = biome.id === "forest" ? 0.075 : 0.022;
  if (hash2(x, z, WORLD_SEED + 310) >= chance) {
    treeRootCache.set(key, false);
    return false;
  }
  const spacingHash = hash2(Math.floor(x / 3), Math.floor(z / 3), WORLD_SEED + 911);
  const result = spacingHash > 0.42;
  treeRootCache.set(key, result);
  return result;
}

function terrainHeight(x, z) {
  const key = `${x},${z}`;
  if (terrainHeightCache.has(key)) return terrainHeightCache.get(key);
  const broad = fbm(x * 0.018, z * 0.018, 4);
  const detail = fbm((x + 640) * 0.046, (z - 370) * 0.046, 3);
  const ridges = 1 - Math.abs(fbm((x - 1200) * 0.012, (z + 400) * 0.012, 3) * 2 - 1);
  const biome = biomeAt(x, z);
  let height = 7 + broad * 8 + detail * 3;
  if (biome.id === "highland") height += ridges * 6;
  if (biome.id === "desert") height -= 1.2;
  height = clamp(Math.floor(height), 4, WORLD_HEIGHT - 8);
  terrainHeightCache.set(key, height);
  return height;
}

function biomeAt(x, z) {
  const key = `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  if (biomeCache.has(key)) return biomeCache.get(key);
  const temperature = fbm((x + 1700) * 0.006, (z - 800) * 0.006, 3);
  const moisture = fbm((x - 900) * 0.007, (z + 1200) * 0.007, 3);
  const altitude = fbm((x + 300) * 0.01, (z - 500) * 0.01, 2);
  let biome;
  if (temperature > 0.68 && moisture < 0.45) biome = { id: "desert", name: "赤沙荒原" };
  else if (temperature < 0.3) biome = { id: "tundra", name: "霜白苔原" };
  else if (altitude > 0.72) biome = { id: "highland", name: "风石高地" };
  else if (moisture > 0.58) biome = { id: "forest", name: "苍翠林地" };
  else biome = { id: "meadow", name: "青原" };
  biomeCache.set(key, biome);
  return biome;
}

function fbm(x, z, octaves) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, z * frequency, WORLD_SEED + octave * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function updatePlayer(delta) {
  if (!active || inventoryOpen) {
    player.velocity.x *= Math.max(0, 1 - delta * 10);
    player.velocity.z *= Math.max(0, 1 - delta * 10);
    updateCamera();
    return;
  }

  const keyboardX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const keyboardZ = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const inputX = clamp(keyboardX + moveInput.x, -1, 1);
  const inputZ = clamp(keyboardZ + moveInput.y, -1, 1);
  const inputLength = Math.hypot(inputX, inputZ) || 1;
  const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const sprinting = !gameOptions.creativeMode && shiftHeld && inputZ < -0.1 && player.stamina > 2;
  const speed = gameOptions.creativeMode ? 7.8 : sprinting ? 6.8 : 4.6;
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const desiredX = ((rightX * inputX) + (forwardX * -inputZ)) / inputLength * speed;
  const desiredZ = ((rightZ * inputX) + (forwardZ * -inputZ)) / inputLength * speed;
  const acceleration = gameOptions.creativeMode ? 14 : player.grounded ? 18 : 6;

  player.velocity.x = damp(player.velocity.x, desiredX, acceleration, delta);
  player.velocity.z = damp(player.velocity.z, desiredZ, acceleration, delta);
  if (gameOptions.creativeMode) {
    player.health = 100;
    player.stamina = 100;
    player.grounded = false;
    const verticalInput =
      ((keys.has("Space") || touchAscend || player.jumpQueued) ? 1 : 0) -
      ((shiftHeld || touchDescend) ? 1 : 0);
    player.velocity.y = damp(player.velocity.y, verticalInput * 6.2, 14, delta);
    player.jumpQueued = false;
  } else {
    player.stamina = clamp(player.stamina + (sprinting ? -18 : 11) * delta, 0, 100);
    player.grounded = collidesAt(player.position.clone().add(new THREE.Vector3(0, -0.06, 0)));
    if ((keys.has("Space") || player.jumpQueued) && player.grounded) {
      player.velocity.y = 7.2;
      player.grounded = false;
    }
    player.jumpQueued = false;
    player.velocity.y -= 20 * delta;
    player.velocity.y = Math.max(player.velocity.y, -24);
  }

  moveHorizontal("x", player.velocity.x * delta);
  moveHorizontal("z", player.velocity.z * delta);
  moveVertical(player.velocity.y * delta);

  if (player.position.y < -8) respawn(true);
  updateCamera();
}

function moveHorizontal(axis, amount) {
  if (!amount) return;
  const previous = player.position[axis];
  player.position[axis] += amount;
  if (!collidesAt(player.position)) return;

  player.position[axis] = previous;
  if (!player.grounded) {
    player.velocity[axis] = 0;
    return;
  }

  const oldY = player.position.y;
  player.position.y += 1.02;
  player.position[axis] += amount;
  if (collidesAt(player.position)) {
    player.position[axis] = previous;
    player.position.y = oldY;
    player.velocity[axis] = 0;
  }
}

function moveVertical(amount) {
  if (!amount) return;
  const previous = player.position.y;
  const impactSpeed = -player.velocity.y;
  player.position.y += amount;
  if (!collidesAt(player.position)) {
    player.grounded = false;
    return;
  }
  player.position.y = previous;
  if (amount < 0) {
    player.grounded = true;
    if (impactSpeed > 12) damagePlayer(Math.round((impactSpeed - 11) * 5));
  }
  player.velocity.y = 0;
}

function collidesAt(position) {
  const minX = Math.floor(position.x - player.radius);
  const maxX = Math.floor(position.x + player.radius);
  const minY = Math.floor(position.y + 0.001);
  const maxY = Math.floor(position.y + player.height - 0.001);
  const minZ = Math.floor(position.z - player.radius);
  const maxZ = Math.floor(position.z + player.radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const definition = blockById.get(getBlock(x, y, z));
        if (definition?.solid) return true;
      }
    }
  }
  return false;
}

function updateCamera() {
  if (!camera) return;
  camera.position.set(player.position.x, player.position.y + player.eyeHeight, player.position.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function updateTarget() {
  raycaster.far = 6;
  raycaster.setFromCamera(screenCenter, camera);
  const meshes = [...chunks.values()].map((chunk) => chunk.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  const hit = hits.find((entry) => entry.face && entry.distance <= 6);
  if (!hit) {
    currentTarget = null;
    selector.visible = false;
    dom.targetLabel.classList.add("is-hidden");
    return;
  }

  const normal = hit.face.normal.clone();
  const inside = hit.point.clone().addScaledVector(normal, -0.01);
  const outside = hit.point.clone().addScaledVector(normal, 0.01);
  const blockPosition = {
    x: Math.floor(inside.x),
    y: Math.floor(inside.y),
    z: Math.floor(inside.z),
  };
  const placePosition = {
    x: Math.floor(outside.x),
    y: Math.floor(outside.y),
    z: Math.floor(outside.z),
  };
  const block = getBlock(blockPosition.x, blockPosition.y, blockPosition.z);
  if (block === Block.AIR || block === Block.WATER) {
    currentTarget = null;
    selector.visible = false;
    dom.targetLabel.classList.add("is-hidden");
    return;
  }

  currentTarget = { blockPosition, placePosition, block };
  selector.position.set(blockPosition.x + 0.5, blockPosition.y + 0.5, blockPosition.z + 0.5);
  selector.visible = true;
  dom.targetLabel.textContent = blockById.get(block)?.name || "方块";
  dom.targetLabel.classList.remove("is-hidden");
}

function breakTargetBlock() {
  if (!active || inventoryOpen || !currentTarget) return;
  const { x, y, z } = currentTarget.blockPosition;
  if (y === 0) {
    showToast("基岩层无法破坏");
    return;
  }
  const block = getBlock(x, y, z);
  if (block === Block.AIR || block === Block.WATER) return;
  setBlock(x, y, z, Block.AIR);
  if (!gameOptions.creativeMode) {
    inventory.set(block, (inventory.get(block) || 0) + 1);
  }
  spawnBlockParticles(x, y, z, block);
  updateHotbar();
  updateInventory();
  updateCrafting();
  currentTarget = null;
}

function placeTargetBlock() {
  if (!active || inventoryOpen || !currentTarget) return;
  const block = hotbar[selectedSlot];
  const count = inventory.get(block) || 0;
  if (!gameOptions.creativeMode && count <= 0) {
    showToast(`${blockById.get(block).name}不足`);
    return;
  }

  const { x, y, z } = currentTarget.placePosition;
  const existing = getBlock(x, y, z);
  if (existing !== Block.AIR && existing !== Block.WATER) return;
  if (blockIntersectsPlayer(x, y, z)) {
    showToast("这里被占用了");
    return;
  }

  setBlock(x, y, z, block);
  if (!gameOptions.creativeMode) {
    inventory.set(block, count - 1);
  }
  spawnBlockParticles(x, y, z, block, true);
  updateHotbar();
  updateInventory();
  updateCrafting();
}

function blockIntersectsPlayer(x, y, z) {
  return (
    x + 1 > player.position.x - player.radius &&
    x < player.position.x + player.radius &&
    y + 1 > player.position.y &&
    y < player.position.y + player.height &&
    z + 1 > player.position.z - player.radius &&
    z < player.position.z + player.radius
  );
}

function spawnBlockParticles(x, y, z, block, inward = false) {
  const color = blockById.get(block)?.color || 0xffffff;
  const geometry = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const material = new THREE.MeshLambertMaterial({ color });
  for (let index = 0; index < 8; index += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    const direction = inward ? -1 : 1;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.4 * direction,
      (1.4 + Math.random() * 1.8) * direction,
      (Math.random() - 0.5) * 2.4 * direction,
    );
    scene.add(mesh);
    particles.push({ mesh, velocity, life: inward ? 0.28 : 0.55, geometry, material });
  }
}

function updateParticles(delta) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= delta;
    particle.velocity.y -= 7 * delta;
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.mesh.rotation.x += delta * 6;
    particle.mesh.rotation.z += delta * 5;
    particle.mesh.scale.setScalar(clamp(particle.life * 2, 0.05, 1));
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particles.splice(index, 1);
      particle.geometry.dispose();
      particle.material.dispose();
    }
  }
}

function updateDayNight(delta) {
  if (gameOptions.eternalDay) {
    worldClock = ETERNAL_DAY_TIME;
  } else {
    worldClock += delta;
    if (worldClock >= DAY_DURATION) {
      worldClock -= DAY_DURATION;
      dayCount += 1;
    }
  }
  const phase = worldClock / DAY_DURATION;
  const angle = phase * Math.PI * 2 - Math.PI / 2;
  const daylight = clamp(Math.sin(angle) * 0.9 + 0.28, 0.04, 1);
  const dusk = clamp(1 - Math.abs(Math.sin(angle)) * 3.3, 0, 1) * (daylight > 0.08 ? 1 : 0.3);

  clockColor.copy(nightSky).lerp(daySky, daylight);
  if (dusk > 0.05) clockColor.lerp(duskSky, dusk * 0.55);
  scene.background.copy(clockColor);
  fogColor.copy(clockColor);
  scene.fog.color.copy(fogColor);
  skyLight.intensity = 0.28 + daylight * 1.15;
  sunLight.intensity = daylight * 1.9;
  sunLight.color.set(daylight < 0.35 ? 0xffa76d : 0xfff1c3);
  sunLight.position.set(Math.cos(angle) * 45, Math.sin(angle) * 52, Math.sin(angle * 0.7) * 30);
  sunMesh.position.set(
    player.position.x + Math.cos(angle) * 70,
    player.position.y + Math.sin(angle) * 64,
    player.position.z + Math.sin(angle * 0.7) * 48,
  );
  sunMesh.visible = Math.sin(angle) > -0.08;
  if (waterTexture) {
    waterTexture.offset.x = (worldClock * 0.004) % 1;
    waterTexture.offset.y = Math.sin(worldClock * 0.18) * 0.02;
  }
}

function createClouds() {
  const material = new THREE.MeshLambertMaterial({ color: 0xf3f4e9, transparent: true, opacity: 0.82 });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (let index = 0; index < 12; index += 1) {
    const group = new THREE.Group();
    const pieces = 3 + (index % 4);
    for (let piece = 0; piece < pieces; piece += 1) {
      const cube = new THREE.Mesh(geometry, material);
      cube.scale.set(3 + (piece % 2) * 2, 0.7 + (piece % 3) * 0.25, 1.8);
      cube.position.set(piece * 2.5 - pieces, Math.sin(piece) * 0.35, (piece % 2) * 0.8);
      group.add(cube);
    }
    group.position.set((index - 6) * 18, 25 + (index % 3) * 3, ((index * 29) % 80) - 40);
    scene.add(group);
    clouds.push(group);
  }
}

function updateClouds(delta) {
  const wrapDistance = CHUNK_SIZE * (RENDER_DISTANCE + 2);
  clouds.forEach((cloud, index) => {
    cloud.position.x += delta * (0.45 + (index % 3) * 0.08);
    if (cloud.position.x > player.position.x + wrapDistance) cloud.position.x -= wrapDistance * 2;
    if (cloud.position.z > player.position.z + wrapDistance) cloud.position.z -= wrapDistance * 2;
    if (cloud.position.z < player.position.z - wrapDistance) cloud.position.z += wrapDistance * 2;
  });
}

function itemCountLabel(block) {
  return gameOptions.creativeMode ? "∞" : String(inventory.get(block) || 0);
}

function updateHotbar() {
  dom.hotbar.replaceChildren();
  hotbar.forEach((block, index) => {
    const definition = blockById.get(block);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `hotbar-slot${index === selectedSlot ? " is-selected" : ""}`;
    button.title = definition.name;
    button.innerHTML = `
      <span class="slot-number">${index + 1}</span>
      <span class="texture-icon" style="background-image:url('${previewForBlock(block)}')"></span>
      <span class="item-count">${itemCountLabel(block)}</span>
    `;
    button.addEventListener("click", () => {
      selectedSlot = index;
      updateHotbar();
    });
    dom.hotbar.append(button);
  });
}

function updateInventory() {
  dom.inventoryGrid.replaceChildren();
  placeableBlocks.forEach((definition) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `inventory-item${hotbar.includes(definition.id) ? " is-hotbar" : ""}`;
    item.innerHTML = `
      <span class="texture-icon" style="background-image:url('${previewForBlock(definition.id)}')"></span>
      <strong>${definition.name}</strong>
      <span class="item-count">${itemCountLabel(definition.id)}</span>
    `;
    item.addEventListener("click", () => assignToHotbar(definition.id));
    dom.inventoryGrid.append(item);
  });
}

function updateCrafting() {
  dom.recipeList.replaceChildren();
  recipes.forEach((recipe) => {
    const result = blockById.get(recipe.result);
    const canCraft =
      gameOptions.creativeMode ||
      recipe.cost.every(([block, amount]) => (inventory.get(block) || 0) >= amount);
    const row = document.createElement("div");
    row.className = "recipe";
    const costText = recipe.cost
      .map(([block, amount]) => `${blockById.get(block).name} ×${amount}`)
      .join(" + ");
    row.innerHTML = `
      <div class="recipe-result">
        <span class="texture-icon" style="background-image:url('${previewForBlock(recipe.result)}')"></span>
        <strong>${result.name} ×${recipe.amount}</strong>
      </div>
      <div class="recipe-cost"><span>${costText}</span></div>
      <button class="craft-button" type="button" ${canCraft ? "" : "disabled"}>${gameOptions.creativeMode ? "取用" : "合成"}</button>
    `;
    row.querySelector(".craft-button").addEventListener("click", () => craft(recipe));
    dom.recipeList.append(row);
  });
}

function assignToHotbar(block) {
  const existing = hotbar.indexOf(block);
  if (existing >= 0) selectedSlot = existing;
  else hotbar[selectedSlot] = block;
  updateHotbar();
  updateInventory();
}

function craft(recipe) {
  const canCraft =
    gameOptions.creativeMode ||
    recipe.cost.every(([block, amount]) => (inventory.get(block) || 0) >= amount);
  if (!canCraft) return;
  if (gameOptions.creativeMode) {
    assignToHotbar(recipe.result);
  } else {
    recipe.cost.forEach(([block, amount]) => inventory.set(block, (inventory.get(block) || 0) - amount));
    inventory.set(recipe.result, (inventory.get(recipe.result) || 0) + recipe.amount);
  }
  updateHotbar();
  updateInventory();
  updateCrafting();
  saveWorld();
  showToast(
    gameOptions.creativeMode
      ? `已取用 ${blockById.get(recipe.result).name}`
      : `合成 ${blockById.get(recipe.result).name} ×${recipe.amount}`,
  );
}

function previewForBlock(block) {
  const textureKey = textureForFace(block, "top");
  return texturePreviews.get(textureKey);
}

function switchInventoryTab(tab) {
  dom.tabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
  dom.itemsTab.classList.toggle("is-hidden", tab !== "items");
  dom.craftingTab.classList.toggle("is-hidden", tab !== "crafting");
  dom.settingsTab.classList.toggle("is-hidden", tab !== "settings");
}

function applyGameOptions() {
  if (gameOptions.eternalDay) {
    worldClock = ETERNAL_DAY_TIME;
  }
  if (gameOptions.creativeMode) {
    player.health = 100;
    player.stamina = 100;
  } else {
    touchAscend = false;
    touchDescend = false;
  }

  dom.eternalDayToggle.checked = gameOptions.eternalDay;
  dom.creativeModeToggle.checked = gameOptions.creativeMode;
  document.body.classList.toggle("creative-mode", gameOptions.creativeMode);
  document.body.dataset.eternalDay = String(gameOptions.eternalDay);
  document.body.dataset.creativeMode = String(gameOptions.creativeMode);
  updateDayNight(0);
}

function setGameOption(option, enabled) {
  gameOptions[option] = Boolean(enabled);
  applyGameOptions();
  updateHotbar();
  updateInventory();
  updateCrafting();
  updateHud(0);
  saveWorld();

  const label = option === "eternalDay" ? "永为白日" : "创造模式";
  showToast(`${label}已${enabled ? "开启" : "关闭"}`);
}

function openInventory() {
  inventoryOpen = true;
  active = false;
  if (document.pointerLockElement) document.exitPointerLock();
  dom.inventoryPanel.classList.remove("is-hidden");
  dom.entry.classList.add("is-hidden");
  updateInventory();
  updateCrafting();
  applyGameOptions();
}

function closeInventory(resume) {
  inventoryOpen = false;
  dom.inventoryPanel.classList.add("is-hidden");
  if (resume) enterWorld();
}

function enterWorld() {
  dom.entry.classList.add("is-hidden");
  if (touchMode || verificationMode) {
    active = true;
    return;
  }
  renderer.domElement.requestPointerLock();
}

function onPointerLockChange() {
  if (touchMode || verificationMode) return;
  active = document.pointerLockElement === renderer.domElement;
  if (active) {
    dom.entry.classList.add("is-hidden");
  } else if (!inventoryOpen) {
    dom.entry.classList.remove("is-hidden");
  }
}

function onKeyDown(event) {
  if (event.code === "KeyE") {
    event.preventDefault();
    if (inventoryOpen) closeInventory(true);
    else openInventory();
    return;
  }
  if (event.code.startsWith("Digit")) {
    const index = Number(event.code.slice(5)) - 1;
    if (index >= 0 && index < hotbar.length) {
      selectedSlot = index;
      updateHotbar();
    }
  }
  if (!inventoryOpen) keys.add(event.code);
}

function onMouseMove(event) {
  if (!active || touchMode || inventoryOpen) return;
  player.yaw -= event.movementX * 0.0022;
  player.pitch = clamp(player.pitch - event.movementY * 0.0022, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
}

function onMouseDown(event) {
  if (!active || touchMode || inventoryOpen) return;
  if (event.button === 0) breakTargetBlock();
  if (event.button === 2) placeTargetBlock();
}

function onWheel(event) {
  if (inventoryOpen) return;
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  selectedSlot = mod(selectedSlot + direction, hotbar.length);
  updateHotbar();
}

function onLookPointerDown(event) {
  if (!touchMode || !active || inventoryOpen || event.clientX < innerWidth * 0.34) return;
  lookTouchId = event.pointerId;
  lookTouchPosition = { x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
}

function onLookPointerMove(event) {
  if (event.pointerId !== lookTouchId || !lookTouchPosition) return;
  const dx = event.clientX - lookTouchPosition.x;
  const dy = event.clientY - lookTouchPosition.y;
  lookTouchPosition = { x: event.clientX, y: event.clientY };
  player.yaw -= dx * 0.006;
  player.pitch = clamp(player.pitch - dy * 0.006, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
}

function onLookPointerUp(event) {
  if (event.pointerId !== lookTouchId) return;
  lookTouchId = null;
  lookTouchPosition = null;
}

function onMovePointerDown(event) {
  if (!active || inventoryOpen) return;
  event.preventDefault();
  moveTouchId = event.pointerId;
  dom.movePad.setPointerCapture(event.pointerId);
  updateMovePad(event);
}

function onMovePointerMove(event) {
  if (event.pointerId !== moveTouchId) return;
  updateMovePad(event);
}

function onMovePointerUp(event) {
  if (event.pointerId !== moveTouchId) return;
  moveTouchId = null;
  moveInput = { x: 0, y: 0 };
  dom.moveStick.style.transform = "translate(-50%, -50%)";
}

function updateMovePad(event) {
  const rect = dom.movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDistance = rect.width * 0.31;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > maxDistance) {
    dx = dx / distance * maxDistance;
    dy = dy / distance * maxDistance;
  }
  moveInput = { x: dx / maxDistance, y: dy / maxDistance };
  dom.moveStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function updateHud(delta) {
  hudAccumulator += delta;
  if (hudAccumulator < 0.12 && delta !== 0) return;
  hudAccumulator = 0;
  const x = Math.floor(player.position.x);
  const y = Math.floor(player.position.y);
  const z = Math.floor(player.position.z);
  dom.coordinates.textContent = `${x} / ${y} / ${z}`;
  dom.biome.textContent = biomeAt(x, z).name;
  dom.health.style.width = `${player.health}%`;
  dom.stamina.style.width = `${player.stamina}%`;
  dom.dayLabel.textContent = gameOptions.eternalDay ? `永昼 · 第 ${dayCount} 天` : `第 ${dayCount} 天`;

  const hourFloat = (worldClock / DAY_DURATION) * 24;
  const hour = Math.floor(hourFloat);
  const minute = Math.floor((hourFloat - hour) * 60);
  dom.timeLabel.textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  dom.timeIcon.classList.toggle("is-moon", hour < 6 || hour >= 19);
}

function damagePlayer(amount) {
  if (gameOptions.creativeMode) {
    player.health = 100;
    return;
  }
  player.health = clamp(player.health - amount, 0, 100);
  dom.damageFlash.classList.add("is-active");
  setTimeout(() => dom.damageFlash.classList.remove("is-active"), 80);
  if (player.health <= 0) respawn(true);
}

function respawn(showMessage) {
  player.health = 100;
  player.velocity.set(0, 0, 0);
  setSpawn();
  ensureChunks();
  if (showMessage) showToast("已返回世界出生点");
}

function setSpawn() {
  const candidates = [[0, 0], [3, 2], [-4, 5], [6, -3]];
  const spot = candidates.find(([x, z]) => terrainHeight(x, z) > WATER_LEVEL) || [0, 0];
  player.position.set(spot[0] + 0.5, terrainHeight(spot[0], spot[1]) + 1.04, spot[1] + 0.5);
}

function saveWorld() {
  try {
    const payload = {
      version: 1,
      edits: Object.fromEntries(edits),
      inventory: Object.fromEntries(inventory),
      hotbar,
      selectedSlot,
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
        pitch: player.pitch,
        health: player.health,
      },
      worldClock,
      dayCount,
      options: { ...gameOptions },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    document.body.dataset.lastSave = String(Date.now());
  } catch (error) {
    console.warn("Unable to save world.", error);
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      setSpawn();
      return;
    }
    const payload = JSON.parse(raw);
    if (payload.version !== 1) return;
    Object.entries(payload.edits || {}).forEach(([key, block]) => edits.set(key, Number(block)));
    Object.entries(payload.inventory || {}).forEach(([block, count]) => inventory.set(Number(block), Number(count)));
    if (Array.isArray(payload.hotbar) && payload.hotbar.length === 9) {
      payload.hotbar.forEach((block, index) => {
        if (blockById.has(Number(block))) hotbar[index] = Number(block);
      });
    }
    selectedSlot = clamp(Number(payload.selectedSlot) || 0, 0, 8);
    if (payload.player) {
      player.position.set(Number(payload.player.x), Number(payload.player.y), Number(payload.player.z));
      player.yaw = Number(payload.player.yaw) || 0;
      player.pitch = Number(payload.player.pitch) || 0;
      player.health = clamp(Number(payload.player.health) || 100, 1, 100);
    }
    worldClock = Number(payload.worldClock) || worldClock;
    dayCount = Math.max(1, Number(payload.dayCount) || 1);
    gameOptions.eternalDay = Boolean(payload.options?.eternalDay);
    gameOptions.creativeMode = Boolean(payload.options?.creativeMode);
  } catch (error) {
    console.warn("Ignoring invalid save data.", error);
    localStorage.removeItem(SAVE_KEY);
    setSpawn();
  }
}

function runSelfChecks() {
  const testKey = blockKey(999999, 1, 999999);
  const old = edits.get(testKey);
  edits.set(testKey, Block.BRICKS);
  const persisted = getBlock(999999, 1, 999999) === Block.BRICKS;
  if (old === undefined) edits.delete(testKey);
  else edits.set(testKey, old);
  document.body.dataset.chunkPersistenceTest = persisted ? "pass" : "fail";
  document.body.dataset.hotbarSlots = String(hotbar.length);
  document.body.dataset.recipeCount = String(recipes.length);
  document.body.dataset.dayDuration = String(DAY_DURATION);
  document.body.dataset.textureWrap = "clamp-non-water";
  document.body.dataset.optionCount = "2";
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 1600);
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  updatePlayer(delta);
  updateTarget();
  updateParticles(delta);
  updateDayNight(delta);
  updateClouds(delta);
  updateHud(delta);

  chunkAccumulator += delta;
  saveAccumulator += delta;
  if (chunkAccumulator >= 0.32) {
    chunkAccumulator = 0;
    ensureChunks();
  }
  processChunkQueue();
  if (saveAccumulator >= 12) {
    saveAccumulator = 0;
    saveWorld();
  }

  renderer.render(scene, camera);
}

function addResizeHandler() {
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(innerWidth, innerHeight);
  });
}

function setLoading(progress, state) {
  dom.loadingProgress.style.width = `${clamp(progress, 0, 1) * 100}%`;
  dom.loadingState.textContent = state;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hash2(x, z, seed = WORLD_SEED) {
  let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function hash3(x, y, z, seed = WORLD_SEED) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 1442695041) ^ Math.imul(z, 668265263) ^ seed;
  value = Math.imul(value ^ (value >>> 15), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967295;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function damp(current, target, smoothing, delta) {
  return lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

init().catch((error) => {
  console.error(error);
  dom.loading.classList.add("is-hidden");
  dom.entry.classList.add("is-hidden");
  dom.fatalMessage.textContent = error?.message || String(error);
  dom.fatal.classList.remove("is-hidden");
  document.body.dataset.gameReady = "error";
});
