import { buildWall, rectPoints, createPathGeometry, drawSceneStatic, pathGeometryToCollisionPolygons } from "./scene-render.js";

const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen");
const gameScreen = $("#game-screen");
const startButton = $("#start-button");
const backButton = $("#back-to-title");
const questToggle = $("#quest-toggle");
const inventoryToggle = $("#inventory-toggle");
const questPanel = $("#quest-panel");
const inventoryPanel = $("#inventory-panel");
const inventoryGrid = $("#inventory-grid");
const inventoryWalletBalance = $("#inventory-wallet-balance");
const marketPanel = $("#market-panel");
const marketGrid = $("#market-grid");
const marketBalanceValue = $("#market-balance");
const playerStats = { health: 100, hunger: 100, water: 100, energy: 100, fatigue: 100, oxygen: 100 };
let inventoryCapacity = 20;
let inventoryQuantities = {};
let walletBalance = 100;
let dialogueAction = null;
const formatCurrency = (amount) => String.fromCharCode(36) + amount;
const MAX_INVENTORY_CAPACITY = 40;
const inventoryCatalog = [
  { id: "tide_imprint", category: "important", icon: "◈", name: "潮痕拓印", subtitle: "測量痕跡", description: "石面上的刻痕拓印。排列並非自然侵蝕形成，像是某種測量裝置留下的記號。", source: "調查潮痕標記" },
  { id: "echo_fragment", category: "important", icon: "✧", name: "微弱回聲", subtitle: "隱藏發現", description: "從遺跡角落捕捉到的一段微弱回響。內容尚不完整，暫時無法判讀。", source: "發現隱藏回聲" },
  { id: "device_record", category: "important", icon: "◎", name: "機關記錄", subtitle: "裝置資料", description: "測量裝置啟動時留下的狀態記錄。通路已解除封鎖，這份記錄可供之後查閱。", source: "啟動測量機關" },
  { id: "market_ration", category: "food", icon: "▣", name: "旅行乾糧", subtitle: "市集商品", description: "方便攜帶的乾糧。此商品目前用於測試購買、貨幣扣款與背包堆疊。", source: "向測試商人購買" },
  { id: "market_water", category: "food", icon: "◉", name: "清水", subtitle: "市集商品", description: "裝在小水瓶中的清水。此商品目前用於測試市集交易流程。", source: "向測試商人購買" },
  { id: "market_relic", category: "material", icon: "◆", name: "遺跡礦石", subtitle: "市集商品", description: "帶有微弱光澤的礦石。此商品目前用於測試材料類商品的購買與堆疊。", source: "向測試商人購買" }
];
const marketCatalog = [
  { itemId: "market_ration", price: 15 },
  { itemId: "market_water", price: 10 },
  { itemId: "market_relic", price: 25 }
];
let inventoryFilter = "equipment";
let selectedInventoryItem = null;
const SAVE_KEY = "unwritten-world-exploration-save-v2";
const CHECKPOINT_KEY = "unwritten-world-exploration-checkpoint-v1";
const SAVE_INTERVAL_MS = 1000;
const viewport = $("#scene");
const joystick = $("#mobile-joystick");
const joystickBase = joystick.querySelector(".mobile-joystick-base");
const joystickThumb = $("#mobile-joystick-thumb");
let joystickPointerId = null;
const world = $("#world");
const playerEl = $("#player");
const visionCanvas = $("#vision-canvas");
const visionContext = visionCanvas.getContext("2d");
const statusMessage = $("#status-message");
const statusChip = $("#status-chip");
const checkpointEl = $("#checkpoint");
const deathPanel = $("#death-panel");
const respawnButton = $("#respawn-button");
const deathTitleButton = $("#death-title-button");
const dialoguePanel = $("#dialogue-panel");
const dialogueTitle = $("#dialogue-title");
const dialogueText = $("#dialogue-text");
const coordinates = $("#coordinates");
const oxygenIndicator = $("#oxygen-indicator");
const oxygenBar = $("#oxygen-bar");
const healthHudValue = $("#health-hud-value");
const healthHudBar = $("#health-hud-bar");
const sceneCanvas = $("#scene-canvas");
const sceneContext = sceneCanvas.getContext("2d");
let lastSceneKey = "";

// 離屏 canvas 只建立一次，每幀重複使用（避免每幀配置兩張全解析度 canvas）
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
const featherCanvas = document.createElement("canvas");
const featherCtx = featherCanvas.getContext("2d");
let lastVisionCacheKey = "";
let sceneResizeObserver = null;
const sceneEffects = new Set();

const WORLD = { width: 1600, height: 1000 };
const PLAYER = { width: 30, height: 42, speed: 180, hitWidth: 22, hitHeight: 12 };
// Temporary vision settings: brightness/fog are independent knobs for future systems.
const VISION = { baseRadius: 720, brightness: 1, fog: 0, darkness: 0.94, edgeSoftness: 0.38, shadowBlur: 12, shadowOpacity: 0.82 };
const state = {
  started: false,
  x: 180, y: 180,
  keys: new Set(),
  pointers: new Map(),
  joystick: { x: 0, y: 0 },
  gateOpen: false,
  secretFound: false,
  markerInspected: false,
  gateCrossed: false,
  dialogueOpen: false,
  target: null,
  lastTime: 0,
  lastSaveTime: 0,
  checkpointActive: false,
  frame: 0,
  questOpen: false,
  inventoryOpen: false,
  marketOpen: false,
  diving: false,
  dead: false,
  damageZoneContact: false,
  inventory: []
};

const damageZones = [
  // Deliberate test-only hazard: each fresh contact removes 25 health.
  { id: "test-damage-zone", x: 420, y: 500, w: 120, h: 100, damage: 25, label: "危險區", note: "接觸扣除 25 生命" }
];
// Test-only natural coast slice. Presentation path, traversal semantics and
// collision geometry are stored separately; surface decoration never collides.
const beachPath = createPathGeometry([
  { type: "moveTo", x: 930, y: 680 },
  { type: "bezierCurveTo", cp1x: 1010, cp1y: 650, cp2x: 1090, cp2y: 662, x: 1165, y: 700 },
  { type: "bezierCurveTo", cp1x: 1260, cp1y: 748, cp2x: 1360, cp2y: 690, x: 1450, y: 710 },
  { type: "bezierCurveTo", cp1x: 1490, cp1y: 718, cp2x: 1520, cp2y: 735, x: 1550, y: 760 },
  { type: "bezierCurveTo", cp1x: 1440, cp1y: 770, cp2x: 1360, cp2y: 800, x: 1300, y: 785 },
  { type: "bezierCurveTo", cp1x: 1250, cp1y: 805, cp2x: 1210, cp2y: 800, x: 1160, y: 765 },
  { type: "bezierCurveTo", cp1x: 1100, cp1y: 730, cp2x: 1040, cp2y: 720, x: 980, y: 760 },
  { type: "bezierCurveTo", cp1x: 960, cp1y: 730, cp2x: 945, cp2y: 700, x: 930, y: 680 },
  { type: "closePath" }
]);
const coastWaterPath = createPathGeometry([
  { type: "moveTo", x: 980, y: 760 },
  { type: "bezierCurveTo", cp1x: 1040, cp1y: 720, cp2x: 1100, cp2y: 730, x: 1160, y: 765 },
  { type: "bezierCurveTo", cp1x: 1210, cp1y: 800, cp2x: 1250, cp2y: 805, x: 1300, y: 785 },
  { type: "bezierCurveTo", cp1x: 1360, cp1y: 800, cp2x: 1440, cp2y: 770, x: 1510, y: 820 },
  { type: "lineTo", x: 1570, y: 1000 },
  { type: "lineTo", x: 950, y: 1000 },
  { type: "closePath" }
]);
const terrainRegions = [
  {
    id: "test-natural-sand-beach", regionType: "sand", surface: "sand",
    path: beachPath, collision: "none", traversal: "walkable",
    decorations: [
      { x: 1000, y: 705, rx: 7, ry: 3, rotation: -0.3 },
      { x: 1060, y: 690, rx: 5, ry: 2.5, rotation: 0.4 },
      { x: 1125, y: 715, rx: 8, ry: 3, rotation: 0.2 },
      { x: 1200, y: 755, rx: 6, ry: 2.5, rotation: -0.5 },
      { x: 1370, y: 744, rx: 7, ry: 3, rotation: 0.25 },
      { x: 1450, y: 750, rx: 5, ry: 2, rotation: -0.2 }
    ]
  },
  {
    id: "test-natural-coast-water", regionType: "water", surface: "water",
    path: coastWaterPath, collision: "none", traversal: "water",
    ripples: [
      { x: 1110, y: 840, rx: 42, ry: 9, rotation: -0.12 },
      { x: 1300, y: 900, rx: 58, ry: 11, rotation: 0.08 },
      { x: 1460, y: 875, rx: 36, ry: 8, rotation: -0.16 }
    ]
  }
];
const waterAreas = terrainRegions
  .filter((region) => region.traversal === "water")
  .map((region) => ({ ...region, collisionPolygons: pathGeometryToCollisionPolygons(region.path) }));
// Every wall is a polygon. buildWall() rounds the corners once and the same
// vertices are used by collision, vision casting, shadows and drawing.
const obstacles = [
  buildWall({ points: rectPoints(330, 220, 210, 65), radius: 7 }),
  buildWall({ points: rectPoints(610, 350, 80, 220), radius: 7 }),
  buildWall({ points: rectPoints(930, 170, 240, 75), radius: 7 }),
  buildWall({ points: rectPoints(580, 650, 90, 160), radius: 7 }),
  // Curved C-shaped rock rim; the open mouth faces west into a small cave alcove.
  buildWall({ id: "test-natural-cave-rim", style: "stoneL", path: createPathGeometry([
    { type: "moveTo", x: 1150, y: 400 },
    { type: "bezierCurveTo", cp1x: 1215, cp1y: 340, cp2x: 1335, cp2y: 345, x: 1390, y: 415 },
    { type: "bezierCurveTo", cp1x: 1435, cp1y: 470, cp2x: 1400, cp2y: 530, x: 1340, y: 550 },
    { type: "bezierCurveTo", cp1x: 1285, cp1y: 570, cp2x: 1220, cp2y: 545, x: 1180, y: 510 },
    { type: "lineTo", x: 1140, y: 545 },
    { type: "bezierCurveTo", cp1x: 1200, cp1y: 615, cp2x: 1320, cp2y: 635, x: 1400, y: 585 },
    { type: "bezierCurveTo", cp1x: 1490, cp1y: 530, cp2x: 1505, cp2y: 425, x: 1435, y: 345 },
    { type: "bezierCurveTo", cp1x: 1350, cp1y: 255, cp2x: 1200, cp2y: 270, x: 1100, y: 350 },
    { type: "bezierCurveTo", cp1x: 1045, cp1y: 395, cp2x: 1035, cp2y: 465, x: 1060, y: 520 },
    { type: "lineTo", x: 1105, y: 495 },
    { type: "bezierCurveTo", cp1x: 1085, cp1y: 450, cp2x: 1095, cp2y: 420, x: 1150, y: 400 },
    { type: "closePath" }
  ]) }),
  // Test-only concave L-shaped wall; its inner corner is rounded as well.
  buildWall({ id: "test-l-wall", style: "stoneL", radius: 6,
    points: [[820, 350], [1040, 350], [1040, 410], [880, 410], [880, 570], [820, 570]] }),
  buildWall({ id: "test-gate", gate: true, radius: 5, points: rectPoints(760, 600, 180, 44) })
];
// Static broad-phase index for wall collision. Exact polygon tests remain the
// final authority, and gate state is still checked on every query.
const COLLISION_GRID_CELL_SIZE = 128;
const collisionGrid = new Map();
for (let obstacleIndex = 0; obstacleIndex < obstacles.length; obstacleIndex++) {
  const obstacle = obstacles[obstacleIndex];
  const minCellX = Math.floor(obstacle.x / COLLISION_GRID_CELL_SIZE);
  const maxCellX = Math.floor((obstacle.x + obstacle.w) / COLLISION_GRID_CELL_SIZE);
  const minCellY = Math.floor(obstacle.y / COLLISION_GRID_CELL_SIZE);
  const maxCellY = Math.floor((obstacle.y + obstacle.h) / COLLISION_GRID_CELL_SIZE);
  for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      const key = String(cellX) + "," + String(cellY);
      const bucket = collisionGrid.get(key) || [];
      bucket.push(obstacleIndex);
      collisionGrid.set(key, bucket);
    }
  }
}
function collisionCandidates(rect) {
  const indexes = new Set();
  const minCellX = Math.floor(rect.x / COLLISION_GRID_CELL_SIZE);
  const maxCellX = Math.floor((rect.x + rect.w) / COLLISION_GRID_CELL_SIZE);
  const minCellY = Math.floor(rect.y / COLLISION_GRID_CELL_SIZE);
  const maxCellY = Math.floor((rect.y + rect.h) / COLLISION_GRID_CELL_SIZE);
  for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      const bucket = collisionGrid.get(String(cellX) + "," + String(cellY));
      if (bucket) for (const index of bucket) indexes.add(index);
    }
  }
  return [...indexes].sort((a, b) => a - b).map((index) => obstacles[index]);
}
const objects = [
  { id: "test_interactable_tide_marker", el: $("#marker"), x: 250, y: 460, radius: 80, title: "潮痕標記" },
  { id: "test_secret_tide_echo", el: $("#secret"), x: 1320, y: 460, radius: 80, title: "微弱回聲" },
  { id: "test_puzzle_measurement_device", el: $("#switch"), x: 830, y: 760, radius: 80, title: "測量機關" },
  { id: "test_checkpoint", el: checkpointEl, x: 180, y: 300, radius: 80, title: "存檔點" },
  { id: "test_merchant_market", el: $("#merchant"), x: 430, y: 760, radius: 80, title: "商人" }
];
const keyMap = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right"
};

function setStatus(message) {
  statusMessage.textContent = message;
}

function addInventoryItem(id, quantity = 1) {
  const item = inventoryCatalog.find((entry) => entry.id === id);
  if (!item) return false;
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  const alreadyOwned = state.inventory.includes(id);
  if (!alreadyOwned && state.inventory.length >= inventoryCapacity) {
    setStatus("背包已滿。需要先擴充背包空間，才能收納更多物品。");
    return false;
  }
  if (!alreadyOwned) state.inventory.push(id);
  inventoryQuantities[id] = (inventoryQuantities[id] || 0) + amount;
  renderInventory();
  saveProgress();
  setStatus(`已放入背包：${item.name} ×${inventoryQuantities[id]}。`);
  return true;
}

// Story events can call this when a capacity upgrade is earned.
function expandInventoryCapacity(additionalSlots = 4) {
  const amount = Math.max(1, Math.floor(Number(additionalSlots) || 0));
  const nextCapacity = Math.min(MAX_INVENTORY_CAPACITY, inventoryCapacity + amount);
  if (nextCapacity === inventoryCapacity) return false;
  inventoryCapacity = nextCapacity;
  renderInventory();
  saveProgress();
  return true;
}

function renderPlayerStats() {
  for (const [key, value] of Object.entries(playerStats)) {
    const label = document.querySelector(`#stat-${key}-value`);
    const bar = document.querySelector(`#stat-${key}-bar`);
    if (label) label.textContent = `${value} / 100`;
    if (bar) bar.style.width = `${value}%`;
  }
  if (healthHudValue) healthHudValue.textContent = `${Math.round(playerStats.health)} / 100`;
  if (healthHudBar) healthHudBar.style.width = `${playerStats.health}%`;
  updateOxygenIndicator();
}

function updateOxygenIndicator() {
  const oxygen = playerStats.oxygen;
  const oxygenLabel = document.querySelector("#stat-oxygen-value");
  const oxygenStatBar = document.querySelector("#stat-oxygen-bar");
  if (oxygenLabel) oxygenLabel.textContent = `${oxygen.toFixed(1)} / 100`;
  if (oxygenStatBar) oxygenStatBar.style.width = `${oxygen}%`;
  // Keep the character-side oxygen gauge visible underwater and until
  // the tank has fully recovered on land. Use a compositor transform so
  // fractional per-frame changes are not quantized to whole layout pixels.
  if (oxygenIndicator) oxygenIndicator.hidden = !state.diving && oxygen >= 100;
  if (oxygenBar) {
    oxygenBar.style.height = "100%";
    oxygenBar.style.transformOrigin = "bottom";
    oxygenBar.style.transform = "scaleY(" + (Math.max(0, Math.min(100, oxygen)) / 100) + ")";
  }
}

// Story and exploration events can toggle the diving display. Oxygen drains
// at a steady rate while diving: a full tank lasts exactly 60 seconds.
function setDivingState(isDiving) {
  state.diving = Boolean(isDiving);
  updateOxygenIndicator();
  return state.diving;
}

// Future food, water and sleep interactions can update a parameter through
// this single entry point; no automatic drain or recovery is active yet.
function setPlayerStat(stat, value) {
  if (!Object.prototype.hasOwnProperty.call(playerStats, stat)) return false;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  playerStats[stat] = Math.max(0, Math.min(100, Math.round(numericValue)));
  renderPlayerStats();
  if (stat === "health" && playerStats.health === 0 && state.started) handlePlayerDeath();
  else saveProgress();
  return true;
}

function renderInventory() {
  const owned = inventoryCatalog.filter((item) => state.inventory.includes(item.id));
  const visible = owned.filter((item) => item.category === inventoryFilter);
  inventoryGrid.replaceChildren();

  for (let index = 0; index < inventoryCapacity; index++) {
    const item = visible[index] || null;
    const slot = document.createElement(item ? "button" : "div");
    if (item) {
      slot.type = "button";
      slot.className = "inventory-slot";
      slot.setAttribute("aria-label", `${item.name}。懸停查看物品介紹`);
      slot.dataset.tooltip = `${item.name}｜${item.description} 取得方式：${item.source}`;
      slot.title = `${item.name}\n${item.description}\n取得方式：${item.source}`;
      const icon = document.createElement("span");
      icon.className = "inventory-slot-icon";
      icon.textContent = item.icon;
      const name = document.createElement("span");
      name.className = "inventory-slot-name";
      name.textContent = item.name;
      const quantity = document.createElement("span");
      quantity.className = "inventory-slot-quantity";
      quantity.textContent = `×${inventoryQuantities[item.id] || 1}`;
      slot.append(icon, name, quantity);
    } else {
      slot.className = "inventory-slot is-empty";
      slot.setAttribute("aria-hidden", "true");

    }
    inventoryGrid.append(slot);
  }
}
// Public hooks for future story rewards and survival-system events.
window.expandInventoryCapacity = expandInventoryCapacity;
window.setPlayerStat = setPlayerStat;
window.setDivingState = setDivingState;

function updateQuestUI() {
  const objectives = [
    { id: "quest-marker", done: state.markerInspected },
    { id: "quest-gate", done: state.gateOpen },
    { id: "quest-cross", done: state.gateCrossed }
  ];
  objectives.forEach(({ id, done }) => {
    const item = $(`#${id}`);
    item.classList.toggle("is-complete", done);
    item.classList.toggle("is-active", !done && (
      (id === "quest-marker") ||
      (id === "quest-gate" && state.markerInspected) ||
      (id === "quest-cross" && state.gateOpen)
    ));
  });
  const completed = objectives.filter((objective) => objective.done).length;
  $("#quest-progress").textContent = `${completed} / ${objectives.length} 完成`;
  $("#quest-message").textContent = state.gateCrossed
    ? "探索流程完成！你已穿越通路；返回標題可重新開始本局測試。"
    : state.gateOpen
      ? "通路已開啟，沿著機關旁的通路向上穿越。"
      : state.markerInspected
        ? "線索已記錄。接著找到測量機關，啟動它以打開通路。"
        : "先找到潮痕標記，調查留下的線索。";
  $("#quest-secret").classList.toggle("is-complete", state.secretFound);
  $("#quest-secret-status").textContent = state.secretFound ? "已發現" : "未發現";
}
function updateWalletUI() {
  const balanceText = formatCurrency(walletBalance);
  if (inventoryWalletBalance) inventoryWalletBalance.textContent = balanceText;
  if (marketBalanceValue) marketBalanceValue.textContent = balanceText;
}
function renderMarket() {
  if (!marketGrid) return; updateWalletUI(); marketGrid.replaceChildren();
  marketCatalog.forEach((product) => {
    const item = inventoryCatalog.find((entry) => entry.id === product.itemId); if (!item) return;
    const card = document.createElement('article'); card.className = 'market-item-card';
    const icon = document.createElement('span'); icon.className = 'market-item-icon'; icon.textContent = item.icon;
    const name = document.createElement('h4'); name.textContent = item.name;
    const description = document.createElement('p'); description.textContent = item.description;
    const price = document.createElement('strong'); price.className = 'market-item-price'; price.textContent = formatCurrency(product.price);
    const owned = document.createElement('small'); owned.textContent = '持有：' + (inventoryQuantities[item.id] || 0);
    const buy = document.createElement('button'); buy.type = 'button'; buy.className = 'primary-button market-buy-button'; buy.textContent = '購買';
    buy.disabled = walletBalance < product.price || (!state.inventory.includes(item.id) && state.inventory.length >= inventoryCapacity);
    buy.addEventListener('click', () => purchaseMarketItem(item.id));
    card.append(icon, name, description, price, owned, buy); marketGrid.append(card);
  });
}
function openMarketPanel() {
  if (!state.started || state.dead) return; stopInput();
  overlayPanels.forEach((entry) => { state[entry.stateKey] = false; entry.panel.hidden = true; entry.panel.removeAttribute('aria-modal'); entry.panel.removeAttribute('role'); entry.toggle.setAttribute('aria-expanded', 'false'); });
  state.marketOpen = true; marketPanel.hidden = false;
  marketPanel.setAttribute('role', 'dialog'); marketPanel.setAttribute('aria-modal', 'true');
  renderMarket(); saveProgress();
}
function closeMarketPanel() {
  if (!state.marketOpen) return; state.marketOpen = false; marketPanel.hidden = true;
  marketPanel.removeAttribute('role'); marketPanel.removeAttribute('aria-modal');
  if (state.started) setStatus('已離開市集。'); saveProgress();
}
function purchaseMarketItem(itemId) {
  const product = marketCatalog.find((entry) => entry.itemId === itemId); const item = inventoryCatalog.find((entry) => entry.id === itemId);
  if (!product || !item || !state.marketOpen) return;
  if (walletBalance < product.price) { setStatus('錢幣不足，無法購買這項商品。'); return; }
  if (!addInventoryItem(itemId, 1)) { renderMarket(); return; }
  walletBalance -= product.price;
updateWalletUI(); renderMarket(); saveProgress();
  setStatus('已購買' + item.name + '，支付 ' + formatCurrency(product.price) + '。');
}
function openDialogue(title, message) {
  stopInput();
  state.dialogueOpen = true; dialogueAction = null;
  dialogueTitle.textContent = title; dialogueText.textContent = message;
  dialoguePanel.hidden = false; dialoguePanel.focus();
}
function openMerchantDialogue() {
  openDialogue("商人", "你好，請問今天要買什麼呢？");
  dialogueAction = () => openMarketPanel();
}
function closeDialogue() {
  state.dialogueOpen = false; dialogueAction = null;
  dialoguePanel.hidden = true;
  if (state.started) setStatus(state.target ? `靠近「${state.target.title}」了，按 F 互動。` : "使用方向控制探索；靠近標記、回聲或機關即可互動。");
}
function showTitle() {
  saveProgress();
  stopInput();
  state.started = false;
  state.lastTime = 0;
  if (state.frame) cancelAnimationFrame(state.frame);
  state.frame = 0;
  disposeSceneEffects();
  titleScreen.hidden = false;
  gameScreen.hidden = true;
  gameScreen.classList.remove("immersive-fallback");
  if (document.fullscreenElement === gameScreen && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  dialoguePanel.hidden = true;
  marketPanel.hidden = true;
  deathPanel.hidden = true;
  state.dialogueOpen = false;
  state.marketOpen = false;
  startButton.focus();
}
function startExploration() {
  stopInput();
  const saved = loadProgress();
  state.x = saved ? saved.x : 180; state.y = saved ? saved.y : 180;
  state.diving = false;
  state.dead = Boolean(saved?.dead);
  state.checkpointActive = Boolean(saved?.checkpointActive);
  state.gateOpen = saved ? Boolean(saved.gateOpen) : false;
  state.secretFound = saved ? Boolean(saved.secretFound) : false;
  state.markerInspected = saved ? Boolean(saved.markerInspected) : false;
  state.gateCrossed = saved ? Boolean(saved.gateCrossed) : false;
  state.inventory = saved && Array.isArray(saved.inventory) ? saved.inventory.filter((id, index, list) => inventoryCatalog.some((item) => item.id === id) && list.indexOf(id) === index) : [];
  inventoryCapacity = Math.min(MAX_INVENTORY_CAPACITY, Math.max(20, Number.isInteger(saved?.inventoryCapacity) ? saved.inventoryCapacity : 20, state.inventory.length));
  selectedInventoryItem = state.inventory[0] || null;
  renderInventory();
  renderPlayerStats();
  state.target = null;
  state.started = true;
  state.lastTime = 0;
  lastSceneKey = "";
  $("#secret").classList.toggle("is-found", state.secretFound);
  $("#switch").classList.toggle("is-active", state.gateOpen);
  statusChip.lastChild.textContent = state.gateOpen ? " 機關已啟動 · 通路開啟" : " 機關未啟動";
  checkpointEl.classList.toggle("is-active", state.checkpointActive);
  titleScreen.hidden = true;
  gameScreen.hidden = false;
  dialoguePanel.hidden = true;
  state.dialogueOpen = false;
  questPanel.hidden = !state.questOpen;
  inventoryPanel.hidden = !state.inventoryOpen;
  marketPanel.hidden = true;
  state.marketOpen = false;
  questToggle.setAttribute("aria-expanded", String(state.questOpen));
  inventoryToggle.setAttribute("aria-expanded", String(state.inventoryOpen));
  updateWalletUI();
  setStatus(saved ? "已載入本機進度。WASD／方向鍵移動，靠近物件後按 F 互動。" : "使用 WASD／方向鍵移動，靠近物件後按 F 互動。");
  // Wait until the game viewport has participated in layout before the first
  // camera/vision calculation. A second frame lets CSS geometry settle fully.
  lastVisionCacheKey = "";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!state.started) return;
    updateScene();
    state.lastTime = 0;
    deathPanel.hidden = !state.dead;
    if (state.dead) setStatus("角色已死亡，請從最近啟動的存檔點復活。");
    else state.frame = requestAnimationFrame(tick);
  }));
  startButton.textContent = saved ? "繼續探索 ↗" : "開始探索 ↗";
}
function resetJoystick() {
  state.joystick.x = 0; state.joystick.y = 0; joystickPointerId = null;
  joystickThumb.style.transform = "translate(-50%, -50%)"; joystick.classList.remove("is-active");
}
function stopInput() {
  state.keys.clear(); state.pointers.clear(); resetJoystick();
  document.querySelectorAll(".direction.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
}
function getInput() {
  let x = 0, y = 0;
  const active = new Set([...state.keys, ...state.pointers.values()]);
  if (active.has("left")) x -= 1; if (active.has("right")) x += 1;
  if (active.has("up")) y -= 1; if (active.has("down")) y += 1;
  x += state.joystick.x; y += state.joystick.y;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const obstacleGeometryCache = new WeakMap();
function obstacleCollisionPolygons(obstacle) {
  const cached = obstacleGeometryCache.get(obstacle);
  if (cached) return cached;
  const polygons = Array.isArray(obstacle.collisionPolygons)
    ? obstacle.collisionPolygons
    : obstacle.path
      ? pathGeometryToCollisionPolygons(obstacle.path)
      : [{ points: obstacle.verts || (Array.isArray(obstacle.points)
        ? obstacle.points.map(([x,y])=>({x:obstacle.x+x,y:obstacle.y+y}))
        : [{x:obstacle.x,y:obstacle.y},{x:obstacle.x+obstacle.w,y:obstacle.y},
           {x:obstacle.x+obstacle.w,y:obstacle.y+obstacle.h},{x:obstacle.x,y:obstacle.y+obstacle.h}]),
        closed: true }];
  obstacleGeometryCache.set(obstacle, polygons);
  return polygons;
}
function obstacleVertices(obstacle) {
  return obstacleCollisionPolygons(obstacle)[0]?.points || [];
}
function pointInPolygon(p,poly) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  return inside;
}
function segmentsIntersect(a,b,c,d) {
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const on=(p,q,r)=>q.x>=Math.min(p.x,r.x)-1e-8&&q.x<=Math.max(p.x,r.x)+1e-8&&q.y>=Math.min(p.y,r.y)-1e-8&&q.y<=Math.max(p.y,r.y)+1e-8;
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  if(((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0)))return true;
  return (Math.abs(o1)<1e-8&&on(a,c,b))||(Math.abs(o2)<1e-8&&on(a,d,b))||(Math.abs(o3)<1e-8&&on(c,a,d))||(Math.abs(o4)<1e-8&&on(c,b,d));
}
function polygonIntersectsRect(poly,r) {
  const corners=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
  if(poly.some(p=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h))return true;
  if(corners.some(p=>pointInPolygon(p,poly)))return true;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let j=0;j<4;j++)if(segmentsIntersect(a,b,corners[j],corners[(j+1)%4]))return true;}
  return false;
}
function pointInPolygonSet(point, rings) {
  let inside = false;
  for (const ring of rings) {
    if (pointInPolygon(point, ring.points)) inside = !inside;
  }
  return inside;
}
function polygonSetIntersectsRect(rings, rect) {
  const corners = [{x:rect.x,y:rect.y},{x:rect.x+rect.w,y:rect.y},
    {x:rect.x+rect.w,y:rect.y+rect.h},{x:rect.x,y:rect.y+rect.h}];
  if (corners.some((corner) => pointInPolygonSet(corner, rings))) return true;
  for (const ring of rings) {
    const poly = ring.points;
    if (poly.some(p=>p.x>=rect.x&&p.x<=rect.x+rect.w&&p.y>=rect.y&&p.y<=rect.y+rect.h)) return true;
    for (let i=0;i<poly.length;i++) {
      const a=poly[i], b=poly[(i+1)%poly.length];
      for (let j=0;j<4;j++) if (segmentsIntersect(a,b,corners[j],corners[(j+1)%4])) return true;
    }
  }
  return false;
}

// Parametric PathGeometry collision helpers. These evaluate the source curves
// directly; flattened polygons remain available for rendering and vision only.
function pathCurveSegments(path) {
  const segments=[]; let current=null, start=null;
  const point=(x,y)=>({x,y});
  const add=(type, p0, p1, p2=null, p3=null, extra={})=>segments.push({type,p0,p1,p2,p3,...extra});
  for(const c of path.commands){
    if(c.type==="moveTo"){current=point(c.x,c.y);start=current;continue;}
    if(!current)continue;
    if(c.type==="lineTo"){const end=point(c.x,c.y);add("line",current,end);current=end;}
    else if(c.type==="quadraticCurveTo"){const end=point(c.x,c.y);add("quad",current,point(c.cpx,c.cpy),end);current=end;}
    else if(c.type==="bezierCurveTo"){const end=point(c.x,c.y);add("cubic",current,point(c.cp1x,c.cp1y),point(c.cp2x,c.cp2y),end);current=end;}
    else if(c.type==="arc"||c.type==="ellipse"){
      const rx=c.type==="arc"?c.radius:c.radiusX, ry=c.type==="arc"?c.radius:c.radiusY;
      let sweep=c.endAngle-c.startAngle; const tau=Math.PI*2;
      if(!c.counterclockwise){if(sweep>=tau)sweep=tau;else while(sweep<0)sweep+=tau;}
      else {if(sweep<=-tau)sweep=-tau;else while(sweep>0)sweep-=tau;}
      const rot=c.type==="arc"?0:c.rotation;
      const at=a=>({x:c.x+rx*Math.cos(a)*Math.cos(rot)-ry*Math.sin(a)*Math.sin(rot),
        y:c.y+rx*Math.cos(a)*Math.sin(rot)+ry*Math.sin(a)*Math.cos(rot)});
      const first=at(c.startAngle);
      if(Math.hypot(current.x-first.x,current.y-first.y)>1e-7)add("line",current,first);
      add("ellipse",point(c.x,c.y),null,null,null,{rx,ry,rotation:rot,startAngle:c.startAngle,sweep});
      current=at(c.startAngle+sweep);
    } else if(c.type==="closePath"&&start){add("line",current,start);current=start;}
  }
  return segments;
}
function curvePoint(seg,t){
  const u=1-t;
  if(seg.type==="line")return {x:seg.p0.x+ (seg.p1.x-seg.p0.x)*t,y:seg.p0.y+(seg.p1.y-seg.p0.y)*t};
  if(seg.type==="quad")return {x:u*u*seg.p0.x+2*u*t*seg.p1.x+t*t*seg.p2.x,y:u*u*seg.p0.y+2*u*t*seg.p1.y+t*t*seg.p2.y};
  if(seg.type==="cubic")return {x:u*u*u*seg.p0.x+3*u*u*t*seg.p1.x+3*u*t*t*seg.p2.x+t*t*t*seg.p3.x,y:u*u*u*seg.p0.y+3*u*u*t*seg.p1.y+3*u*t*t*seg.p2.y+t*t*t*seg.p3.y};
  const a=seg.startAngle+seg.sweep*t, cr=Math.cos(seg.rotation),sr=Math.sin(seg.rotation);
  return {x:seg.p0.x+seg.rx*Math.cos(a)*cr-seg.ry*Math.sin(a)*sr,y:seg.p0.y+seg.rx*Math.cos(a)*sr+seg.ry*Math.sin(a)*cr};
}
function curveTangent(seg,t){
  const u=1-t;
  if(seg.type==="line")return {x:seg.p1.x-seg.p0.x,y:seg.p1.y-seg.p0.y};
  if(seg.type==="quad")return {x:2*u*(seg.p1.x-seg.p0.x)+2*t*(seg.p2.x-seg.p1.x),y:2*u*(seg.p1.y-seg.p0.y)+2*t*(seg.p2.y-seg.p1.y)};
  if(seg.type==="cubic")return {x:3*u*u*(seg.p1.x-seg.p0.x)+6*u*t*(seg.p2.x-seg.p1.x)+3*t*t*(seg.p3.x-seg.p2.x),y:3*u*u*(seg.p1.y-seg.p0.y)+6*u*t*(seg.p2.y-seg.p1.y)+3*t*t*(seg.p3.y-seg.p2.y)};
  const a=seg.startAngle+seg.sweep*t, cr=Math.cos(seg.rotation),sr=Math.sin(seg.rotation),k=seg.sweep;
  return {x:k*(-seg.rx*Math.sin(a)*cr-seg.ry*Math.cos(a)*sr),y:k*(-seg.rx*Math.sin(a)*sr+seg.ry*Math.cos(a)*cr)};
}
function curveRoots(seg,axis,value){
  const key=axis==="x"?"x":"y", roots=[], n=96;
  let ta=0, va=curvePoint(seg,0)[key]-value;
  for(let i=1;i<=n;i++){
    const tb=i/n, vb=curvePoint(seg,tb)[key]-value;
    if(Math.abs(va)<1e-8)roots.push(ta);
    if((va<0&&vb>0)||(va>0&&vb<0)){
      let lo=ta,hi=tb,flo=va;
      for(let j=0;j<36;j++){const mid=(lo+hi)/2,f=curvePoint(seg,mid)[key]-value;if((flo<=0&&f>=0)||(flo>=0&&f<=0))hi=mid;else{lo=mid;flo=f;}}
      roots.push((lo+hi)/2);
    }
    ta=tb;va=vb;
  }
  if(Math.abs(va)<1e-8)roots.push(1);
  return roots.filter((t,i,a)=>a.findIndex(v=>Math.abs(v-t)<1e-6)===i);
}
function pointInCurvePath(point,segments){
  let inside=false;
  for(const seg of segments)for(const t of curveRoots(seg,"y",point.y)){
    if(t>=1-1e-8)continue;
    const p=curvePoint(seg,t), tangent=curveTangent(seg,t);
    if(p.x>point.x&&Math.abs(tangent.y)>1e-8)inside=!inside;
  }
  return inside;
}
function curvePathIntersectsRect(segments,r){
  const corners=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
  if(corners.some(p=>pointInCurvePath(p,segments)))return true;
  for(const seg of segments){
    for(let i=0;i<=96;i++){const p=curvePoint(seg,i/96);if(p.x>=r.x-1e-7&&p.x<=r.x+r.w+1e-7&&p.y>=r.y-1e-7&&p.y<=r.y+r.h+1e-7)return true;}
    for(const y of [r.y,r.y+r.h])for(const t of curveRoots(seg,"y",y)){const p=curvePoint(seg,t);if(p.x>=r.x-1e-7&&p.x<=r.x+r.w+1e-7)return true;}
    for(const x of [r.x,r.x+r.w])for(const t of curveRoots(seg,"x",x)){const p=curvePoint(seg,t);if(p.y>=r.y-1e-7&&p.y<=r.y+r.h+1e-7)return true;}
  }
  return false;
}
function closestPointOnCurvePath(segments,point){
  let best=null,bestD=Infinity;
  for(const seg of segments){
    const samples=64;let bestT=0,localD=Infinity;
    for(let i=0;i<=samples;i++){const t=i/samples,p=curvePoint(seg,t),d=(p.x-point.x)**2+(p.y-point.y)**2;if(d<localD){localD=d;bestT=t;}}
    let lo=Math.max(0,bestT-1/samples),hi=Math.min(1,bestT+1/samples);
    const ratio=(Math.sqrt(5)-1)/2;let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo);
    const dist=t=>{const p=curvePoint(seg,t);return (p.x-point.x)**2+(p.y-point.y)**2;};
    for(let i=0;i<28;i++){if(dist(a)<dist(b)){hi=b;b=a;a=hi-ratio*(hi-lo);}else{lo=a;a=b;b=lo+ratio*(hi-lo);}}
    const t=(lo+hi)/2,p=curvePoint(seg,t),d=dist(t);
    if(d<bestD){bestD=d;best={point:p,tangent:curveTangent(seg,t),distanceSquared:d};}
  }
  return best;
}
const curveCollisionCache=new WeakMap();
function obstacleCurveSegments(obstacle){
  if(!obstacle.path)return null;
  let cached=curveCollisionCache.get(obstacle);
  if(!cached){cached=pathCurveSegments(obstacle.path);curveCollisionCache.set(obstacle,cached);}
  return cached;
}

function obstacleIntersectsRect(o,r) {
  if (!rectsOverlap(r,o)) return false;
  if (o.path) return curvePathIntersectsRect(obstacleCurveSegments(o),r);
  if (o.collisionPolygons || Array.isArray(o.points) || o.verts) return polygonSetIntersectsRect(obstacleCollisionPolygons(o),r);
  return true;
}
function playerHitRect(x, y) {
  return {
    x: x - PLAYER.hitWidth / 2,
    y: y + PLAYER.height - PLAYER.hitHeight,
    w: PLAYER.hitWidth,
    h: PLAYER.hitHeight
  };
}
function collides(x,y) {
  const hit = playerHitRect(x, y);
  if(hit.x<0||hit.y<0||hit.x+hit.w>WORLD.width||hit.y+hit.h>WORLD.height)return true;
  return collisionCandidates(hit).some(o=>!(o.gate&&state.gateOpen)&&obstacleIntersectsRect(o,hit));
}
// Find the contact normal from the nearest real polygon edge, not the wall's
// bounding box. This lets movement follow curved and diagonal boundaries.
function collisionNormal(x, y, moveX, moveY) {
  const hit = playerHitRect(x, y);
  const center = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
  let nearest = null, nearestDistanceSquared = Infinity;
  for (const obstacle of collisionCandidates(hit)) {
    if ((obstacle.gate && state.gateOpen) || !obstacleIntersectsRect(obstacle, hit)) continue;
    const segments = obstacleCurveSegments(obstacle);
    if (segments) {
      const centerInside = pointInCurvePath(center, segments);
      const contact = closestPointOnCurvePath(segments, center);
      if (!contact || contact.distanceSquared >= nearestDistanceSquared) continue;
      let nx=center.x-contact.point.x, ny=center.y-contact.point.y;
      if(centerInside){nx=-nx;ny=-ny;}
      let length=Math.hypot(nx,ny);
      if(length<1e-7){length=Math.hypot(contact.tangent.x,contact.tangent.y)||1;nx=contact.tangent.y/length;ny=-contact.tangent.x/length;if(nx*moveX+ny*moveY>0){nx=-nx;ny=-ny;}}
      else {nx/=length;ny/=length;}
      nearest={x:nx,y:ny};nearestDistanceSquared=contact.distanceSquared;
      continue;
    }
    const polygons = obstacleCollisionPolygons(obstacle);
    const centerInside = pointInPolygonSet(center, polygons);
    for (const ring of polygons) {
      const points = ring.points;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const edgeX = b.x - a.x, edgeY = b.y - a.y;
        const lengthSquared = edgeX * edgeX + edgeY * edgeY;
        if (lengthSquared < 1e-10) continue;
        const t = Math.max(0, Math.min(1, ((center.x-a.x)*edgeX+(center.y-a.y)*edgeY)/lengthSquared));
        const pointX=a.x+edgeX*t,pointY=a.y+edgeY*t,offsetX=center.x-pointX,offsetY=center.y-pointY;
        const distanceSquared=offsetX*offsetX+offsetY*offsetY;
        if(distanceSquared>=nearestDistanceSquared)continue;
        let nx=centerInside?-offsetX:offsetX,ny=centerInside?-offsetY:offsetY,length=Math.hypot(nx,ny);
        if(length>1e-7){nx/=length;ny/=length;}else{length=Math.sqrt(lengthSquared);nx=edgeY/length;ny=-edgeX/length;if(nx*moveX+ny*moveY>0){nx=-nx;ny=-ny;}}
        nearest={x:nx,y:ny};nearestDistanceSquared=distanceSquared;
      }
    }
  }
  return nearest;
}
function movePlayer(dx, dy) {
  // Keep the original speed and substep size. Resolve a blocked step along the
  // actual contact tangent so curved walls do not behave like solid rectangles.
  const minX = PLAYER.width / 2;
  const maxX = WORLD.width - PLAYER.width / 2;
  const minY = 0;
  const maxY = WORLD.height - PLAYER.height;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let i = 0; i < steps; i++) {
    let moveX = stepX;
    let moveY = stepY;
    let moved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const nextX = Math.max(minX, Math.min(maxX, state.x + moveX));
      const nextY = Math.max(minY, Math.min(maxY, state.y + moveY));
      if (!collides(nextX, nextY)) {
        state.x = nextX;
        state.y = nextY;
        moved = true;
        break;
      }
      const normal = collisionNormal(nextX, nextY, moveX, moveY);
      if (!normal) break;
      const intoWall = moveX * normal.x + moveY * normal.y;
      if (intoWall >= -1e-7) break;
      const slideX = moveX - intoWall * normal.x;
      const slideY = moveY - intoWall * normal.y;
      if (Math.hypot(slideX, slideY) < 1e-7) break;
      moveX = slideX;
      moveY = slideY;
    }
    if (moved) continue;
    // Preserve the established axis fallback for world edges, flat walls and
    // tight corners when no safe tangent step is available.
    const nextX = Math.max(minX, Math.min(maxX, state.x + stepX));
    if (!collides(nextX, state.y)) state.x = nextX;
    const nextY = Math.max(minY, Math.min(maxY, state.y + stepY));
    if (!collides(state.x, nextY)) state.y = nextY;
  }
}

function rayPolygonDistance(ox,oy,dx,dy,poly){
  let nearest=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ex=b.x-a.x,ey=b.y-a.y,ax=a.x-ox,ay=a.y-oy,den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-9)continue;
    const t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
    if(t>1e-6&&u>=-1e-8&&u<=1+1e-8&&t<nearest)nearest=t;
  }
  return nearest;
}
// Return the first positive intersection with an opaque rectangle. If the
// origin is inside a rectangle, use its exit edge so the ray never produces
// Infinity/NaN geometry or a discontinuous polygon.
function rayRectDistance(originX, originY, dirX, dirY, rect) {
  let near = -Infinity;
  let far = Infinity;
  for (const axis of [
    { origin: originX, dir: dirX, min: rect.x, max: rect.x + rect.w },
    { origin: originY, dir: dirY, min: rect.y, max: rect.y + rect.h }
  ]) {
    if (Math.abs(axis.dir) < 1e-8) {
      if (axis.origin < axis.min || axis.origin > axis.max) return Infinity;
      continue;
    }
    let t1 = (axis.min - axis.origin) / axis.dir;
    let t2 = (axis.max - axis.origin) / axis.dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far + 1e-8) return Infinity;
  }
  if (far <= 1e-6) return Infinity;
  return near > 1e-6 ? near : far;
}
function rayViewportDistance(originX, originY, dirX, dirY, rect) {
  let distance = Infinity;
  if (dirX > 0.000001) distance = Math.min(distance, (rect.x + rect.w - originX) / dirX);
  else if (dirX < -0.000001) distance = Math.min(distance, (rect.x - originX) / dirX);
  if (dirY > 0.000001) distance = Math.min(distance, (rect.y + rect.h - originY) / dirY);
  else if (dirY < -0.000001) distance = Math.min(distance, (rect.y - originY) / dirY);
  return distance > 0 ? distance : 0;
}
function drawVision() {
  const width = WORLD.width;
  const height = WORLD.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (visionCanvas.width !== pixelWidth || visionCanvas.height !== pixelHeight) {
    visionCanvas.width = pixelWidth;
    visionCanvas.height = pixelHeight;
    lastVisionCacheKey = "";
  }
  // The vision mask is world-space. Reuse the exact previous frame when its
  // origin, occluder state and backing resolution have not changed.
  const cacheKey = [state.x, state.y, state.gateOpen, pixelWidth, pixelHeight, VISION.baseRadius, VISION.brightness, VISION.fog].join("|");
  if (cacheKey === lastVisionCacheKey) { if (PERF_ENABLED) perfCounters.visionCacheHits += 1; return; }

  const ctx = visionContext;
  const scaleX = pixelWidth / width;
  const scaleY = pixelHeight / height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  const sourceX = state.x;
  const sourceY = state.y + PLAYER.height - PLAYER.hitHeight / 2;
  const brightness = Math.max(0.12, Math.min(1, VISION.brightness));
  const fog = Math.max(0, Math.min(1, VISION.fog));
  const restricted = brightness < 1 || fog > 0;
  const radius = VISION.baseRadius * (0.48 + brightness * 0.52) * (1 - fog * 0.68);
  const opaque = obstacles.filter((o) => !(o.gate && state.gateOpen));
  const visionGeometry = opaque.map((obstacle) => ({
    obstacle, vertices: obstacleVertices(obstacle), bounds: obstacle
  }));
  const view = { x: 0, y: 0, w: width, h: height };

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const angles = [];
  const epsilon = 1e-5;
  const addCorner = (x, y) => {
    const angle = Math.atan2(y - sourceY, x - sourceX);
    angles.push(angle - epsilon, angle, angle + epsilon);
  };
  addCorner(view.x, view.y);
  addCorner(view.x + view.w, view.y);
  addCorner(view.x + view.w, view.y + view.h);
  addCorner(view.x, view.y + view.h);
  for (const geometry of visionGeometry) {
    for (const point of geometry.vertices) addCorner(point.x, point.y);
  }
  angles.sort((a, b) => a - b);

  const uniqueAngles = [];
  for (const angle of angles) {
    if (!uniqueAngles.length || Math.abs(angle - uniqueAngles[uniqueAngles.length - 1]) > 1e-7) {
      uniqueAngles.push(angle);
    }
  }

  if (PERF_ENABLED) perfCounters.lastRayCount = uniqueAngles.length;

  const points = [];
  for (const angle of uniqueAngles) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let distance = rayViewportDistance(sourceX, sourceY, dirX, dirY, view);
    if (restricted) distance = Math.min(distance, radius);
    for (const geometry of visionGeometry) {
      // AABB rejection is conservative; polygon intersection remains authoritative.
      const bounds = geometry.bounds;
      const originInsideBounds = sourceX >= bounds.x && sourceX <= bounds.x + bounds.w &&
        sourceY >= bounds.y && sourceY <= bounds.y + bounds.h;
      const boundsHit = rayRectDistance(sourceX, sourceY, dirX, dirY, bounds);
      // If the origin is inside a concave polygon's AABB, its first polygon
      // edge can occur before the AABB exit; always keep the exact test.
      if (originInsideBounds || boundsHit < distance) {
        const hit = rayPolygonDistance(sourceX, sourceY, dirX, dirY, geometry.vertices);
        if (hit < distance) distance = hit;
      }
    }
    if (!Number.isFinite(distance) || distance < 0) continue;

    let hitX = sourceX + dirX * distance;
    let hitY = sourceY + dirY * distance;
    let nearestCorner = null;
    let nearestCornerError = 0.75;
    for (const geometry of visionGeometry) {
      for (const corner of geometry.vertices) {
        const error = Math.hypot(hitX - corner.x, hitY - corner.y);
        if (error < nearestCornerError) {
          nearestCorner = corner;
          nearestCornerError = error;
        }
      }
    }
    if (nearestCorner) {
      hitX = nearestCorner.x;
      hitY = nearestCorner.y;
    }
    points.push({ x: hitX, y: hitY });
  }

  if (points.length >= 3) {
    const S = 0.5;
    const mw = Math.max(1, Math.round(width * S));
    const mh = Math.max(1, Math.round(height * S));
    for (const c of [maskCanvas, featherCanvas]) {
      if (c.width !== mw || c.height !== mh) {
        c.width = mw;
        c.height = mh;
      }
    }
    maskCtx.setTransform(S, 0, 0, S, 0, 0);
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.fillStyle = "#fff";
    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) maskCtx.lineTo(points[i].x, points[i].y);
    maskCtx.closePath();
    maskCtx.fill();

    featherCtx.setTransform(1, 0, 0, 1, 0, 0);
    featherCtx.clearRect(0, 0, mw, mh);
    featherCtx.filter = "blur(2.5px)";
    featherCtx.drawImage(maskCanvas, 0, 0);
    featherCtx.filter = "none";

    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(featherCanvas, 0, 0, mw, mh, 0, 0, width, height);
  }

  const FAR = 4000;
  // Projection coordinates are calculated once per obstacle for this frame.
  for (const geometry of visionGeometry) {
    const corners = geometry.vertices.map((point) => [point.x, point.y]);
    const projected = corners.map(([x, y]) => {
      const dx = x - sourceX, dy = y - sourceY;
      const length = Math.hypot(dx, dy) || 1;
      return [x + dx / length * FAR, y + dy / length * FAR];
    });
    geometry.shadowPolygons = [];
    for (let i = 0; i < corners.length; i++) {
      const j = (i + 1) % corners.length;
      const polygon = [corners[i], corners[j], projected[j], projected[i]];
      let area = 0;
      for (let k = 0; k < polygon.length; k++) {
        const p = polygon[k], q = polygon[(k + 1) % polygon.length];
        area += p[0] * q[1] - q[0] * p[1];
      }
      if (area < 0) polygon.reverse();
      geometry.shadowPolygons.push(polygon);
    }
  }

  const padX = 1 / scaleX;
  const padY = 1 / scaleY;
  const snapX = (x) => Math.floor(x * scaleX) / scaleX;
  const snapY = (y) => Math.floor(y * scaleY) / scaleY;
  const ceilX = (x) => Math.ceil(x * scaleX) / scaleX;
  const ceilY = (y) => Math.ceil(y * scaleY) / scaleY;

  for (const geometry of visionGeometry) {
    const wall = geometry.obstacle;
    const vertices = geometry.vertices;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
      ctx.closePath();
    };
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    trace();
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 9;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    trace();
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "destination-out";
    trace();
    ctx.fill();
    ctx.save();
    trace();
    ctx.clip();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    for (const other of visionGeometry) {
      if (other.obstacle === wall) continue;
      for (const polygon of other.shadowPolygons) {
        ctx.moveTo(polygon[0][0], polygon[0][1]);
        for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i][0], polygon[i][1]);
        ctx.closePath();
      }
    }
    ctx.fill();
    ctx.restore();
  }

  // The player is a sibling of #world and remains above this world-space overlay.
  ctx.globalCompositeOperation = "source-over";
  lastVisionCacheKey = cacheKey;
}
// Static world layer (water, hazard, walls, gate) drawn on one canvas. It is
// redrawn only when its backing resolution or the gate state changes, so
// dynamic effects never depend on this cache.
function drawSceneLayer() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const zoom = viewport.clientWidth / 1200 || 1;
  const scale = Math.min(2, dpr * Math.max(1, zoom));
  const pixelWidth = Math.max(1, Math.round(WORLD.width * scale));
  const pixelHeight = Math.max(1, Math.round(WORLD.height * scale));
  const key = `${pixelWidth}|${pixelHeight}|${state.gateOpen}`;
  if (key === lastSceneKey) return;
  if (sceneCanvas.width !== pixelWidth || sceneCanvas.height !== pixelHeight) {
    sceneCanvas.width = pixelWidth;
    sceneCanvas.height = pixelHeight;
  }
  sceneContext.setTransform(pixelWidth / WORLD.width, 0, 0, pixelHeight / WORLD.height, 0, 0);
  drawSceneStatic(sceneContext, {
    width: WORLD.width, height: WORLD.height,
    walls: obstacles, waters: [], terrains: terrainRegions, hazards: damageZones,
    gateOpen: state.gateOpen
  });
  lastSceneKey = key;
}
function updateScene() {
  // Keep the horizontal world-space view fixed while adapting the vertical
  // view to the viewport's actual height. This preserves object proportions
  // and avoids revealing more world just because the display is wider.
  const zoom = viewport.clientWidth / 1200;
  const viewW = 1200;
  const viewH = Math.min(WORLD.height, viewport.clientHeight / zoom);
  const maxX = Math.max(0, WORLD.width - viewW);
  const maxY = Math.max(0, WORLD.height - viewH);
  const px = state.x;
  const py = state.y;
  const cameraX = Math.max(0, Math.min(maxX, px - viewW / 2));
  const cameraY = Math.max(0, Math.min(maxY, py + PLAYER.height / 2 - viewH / 2));

  world.style.transform = `scale(${zoom}) translate3d(${-cameraX}px, ${-cameraY}px, 0)`;
  playerEl.style.left = `${(px - cameraX - PLAYER.width / 2) * zoom}px`;
  playerEl.style.top = `${(py - cameraY) * zoom}px`;
  playerEl.style.transform = `scale(${zoom})`;
  playerEl.style.transformOrigin = "top left";
  const playerCenter = { x: px, y: py + PLAYER.height / 2 };
  const isInWater = waterAreas.some((area) => pointInPolygonSet(playerCenter, area.collisionPolygons));
  if (isInWater !== state.diving) {
    setDivingState(isInWater);
    setStatus(isInWater ? "已進入測試水域，角色現在處於潛水狀態。" : "已離開測試水域，角色結束潛水。");
  }
  if (oxygenIndicator) {
    oxygenIndicator.style.left = `${(px - cameraX + PLAYER.width / 2 + 10) * zoom}px`;
    oxygenIndicator.style.top = `${(py - cameraY + 4) * zoom}px`;
    oxygenIndicator.style.transform = `translateY(-100%) scale(${zoom})`;
    oxygenIndicator.style.transformOrigin = "top left";
    updateOxygenIndicator();
  }
  drawSceneLayer();
  drawVision();
  const playerHitbox = { x: px - PLAYER.hitWidth / 2, y: py + PLAYER.height - PLAYER.hitHeight, w: PLAYER.hitWidth, h: PLAYER.hitHeight };
  const touchingDamageZone = damageZones.some((zone) => rectsOverlap(playerHitbox, zone));
  if (touchingDamageZone && !state.damageZoneContact) {
    state.damageZoneContact = true;
    setPlayerStat("health", Math.max(0, playerStats.health - (damageZones.find((zone) => rectsOverlap(playerHitbox, zone))?.damage || 25)));
    if (!state.dead) setStatus("進入危險區，生命值減少 25。離開後再次進入可重複測試。");
  } else if (!touchingDamageZone) {
    state.damageZoneContact = false;
  }
  const coordText = `X ${Math.round(state.x)} · Y ${Math.round(state.y)}`;
  if (coordText !== updateScene.lastCoord) {
    updateScene.lastCoord = coordText;
    coordinates.textContent = coordText;
  }
  if (state.gateOpen && !state.gateCrossed && state.x > 775 && state.x < 925 && state.y + PLAYER.height < 600) {
    state.gateCrossed = true;
    saveProgress();
  }
  const questKey = `${state.markerInspected}|${state.gateOpen}|${state.gateCrossed}|${state.secretFound}`;
  if (questKey !== updateScene.lastQuest) {
    updateScene.lastQuest = questKey;
    updateQuestUI();
  }
  const previousTargetId = state.target?.id || null;
  let nearest = null;
  let nearestDistance = Infinity;
  const interactionY = state.y + PLAYER.height / 2;
  for (const object of objects) {
    if (object.id === "test_secret_tide_echo" && state.secretFound) continue;
    const distance = Math.hypot(object.x - state.x, object.y - interactionY);
    if (distance <= object.radius && distance < nearestDistance) {
      nearest = object;
      nearestDistance = distance;
    }
  }
  state.target = nearest;
  if (previousTargetId !== nearest?.id) {
    for (const object of objects) {
      if (object.id === previousTargetId || object.id === nearest?.id) {
        object.el.classList.toggle("is-near", object === nearest);
      }
    }
  }
}
function handlePlayerDeath() {
  if (state.dead) return;
  state.dead = true;
  state.diving = false;
  stopInput();
  playerStats.health = 0;
  renderPlayerStats();
  deathPanel.hidden = false;
  setStatus("角色已死亡。請從最近啟動的存檔點復活。");
  saveProgress();
}

// Dynamic scene effects have their own lifecycle and clock. They never depend
// on player movement or the static scene/vision cache being invalidated.
function registerSceneEffect(effect) {
  if (!effect || typeof effect.update !== "function" || typeof effect.render !== "function") {
    throw new TypeError("A scene effect must provide update(dt, context) and render(context).");
  }
  sceneEffects.add(effect);
  if (typeof effect.start === "function") effect.start({ state, viewport, world });
  return () => {
    if (!sceneEffects.delete(effect)) return;
    if (typeof effect.dispose === "function") effect.dispose();
  };
}
function updateSceneEffects(dt, timestamp) {
  if (!sceneEffects.size) return;
  const context = { state, viewport, world, timestamp };
  for (const effect of sceneEffects) effect.update(dt, context);
}
function renderSceneEffects(timestamp) {
  if (!sceneEffects.size) return;
  const context = { state, viewport, world, timestamp };
  for (const effect of sceneEffects) effect.render(context);
}
function disposeSceneEffects() {
  for (const effect of sceneEffects) {
    if (typeof effect.dispose === "function") effect.dispose();
  }
  sceneEffects.clear();
}
function tick(timestamp) {
  if (!state.started || state.dead) return;
  // Allow a slightly larger frame delta; movePlayer subdivides it before
  // collision checks, reducing apparent slowdown after brief frame stalls.
  const elapsedSeconds = state.lastTime ? Math.max(0, (timestamp - state.lastTime) / 1000) : 0;
  const dt = Math.min(elapsedSeconds, 0.1);
  if (PERF_ENABLED) perfRecordFrame(timestamp);
  state.lastTime = timestamp;
  updateSceneEffects(dt, timestamp);
  if (!state.dialogueOpen && !state.inventoryOpen && !state.questOpen && !state.marketOpen) {
    const input = getInput();
    if (input.x || input.y) {
      const previousX = state.x;
      const previousY = state.y;
      movePlayer(input.x * PLAYER.speed * dt, input.y * PLAYER.speed * dt);
      // Scene geometry and interaction state only need refreshing after an actual position change.
      if (state.x !== previousX || state.y !== previousY) updateScene();
    }
  }
  if (state.diving) {
    const previousOxygen = playerStats.oxygen;
    playerStats.oxygen = Math.max(0, playerStats.oxygen - (100 / 60) * elapsedSeconds);
    updateOxygenIndicator();
    if (playerStats.oxygen === 0 && previousOxygen > 0) handlePlayerDeath();
  } else if (playerStats.oxygen < 100) {
    // Recover continuously on land; an empty oxygen tank takes 30 seconds to refill.
    playerStats.oxygen = Math.min(100, playerStats.oxygen + (100 / 30) * elapsedSeconds);
    updateOxygenIndicator();
  }
  if (timestamp - state.lastSaveTime >= SAVE_INTERVAL_MS) {
    saveProgress();
    state.lastSaveTime = timestamp;
  }
  renderSceneEffects(timestamp);
  state.frame = requestAnimationFrame(tick);
  if (PERF_ENABLED) perfRender(timestamp);
}
function interact() {
  if (!state.started) return;
  if (state.dead) return;
  if (state.questOpen || state.inventoryOpen) return;
  if (state.marketOpen) { closeMarketPanel(); return; }
  if (state.dialogueOpen) {
    const action = dialogueAction;
    closeDialogue();
    if (typeof action === "function") action();
    saveProgress();
    return;
  }
  if (!state.target) return;
  const target = state.target;
  if (target.id === "test_interactable_tide_marker") {
    state.markerInspected = true;
    addInventoryItem("tide_imprint");
    openDialogue("潮痕標記", "石面上留著一道不自然的刻痕。這是技術測試用互動物件；不新增正式劇情或世界觀設定。");
    setStatus("已調查潮痕標記。");
  } else if (target.id === "test_secret_tide_echo") {
    if (!state.secretFound) {
      state.secretFound = true;
      addInventoryItem("echo_fragment");
      target.el.classList.add("is-found");
      openDialogue("發現一次性秘密", "你捕捉到藏在遺跡角落的微弱回聲。秘密 ID：test_secret_tide_echo。本局只會記錄這一次發現。");
      setStatus("已發現一次性秘密：微弱回聲。");
    }
  } else if (target.id === "test_puzzle_measurement_device") {
    state.gateOpen = !state.gateOpen;
    $("#switch").classList.toggle("is-active", state.gateOpen);
    statusChip.lastChild.textContent = state.gateOpen ? " 機關已啟動 · 通路開啟" : " 機關已關閉 · 通路封閉";
    if (state.gateOpen) {
      addInventoryItem("device_record");
      openDialogue("通路已開啟", "測量裝置已啟動，封閉通路解除。再次操作即可關閉通路。");
      setStatus("通路已開啟。再次操作測量機關即可關閉。");
    } else {
      openDialogue("通路已關閉", "測量裝置已關閉，通路恢復封閉。");
      setStatus("通路已關閉；障礙碰撞已恢復。");
    }
  } else if (target.id === "test_merchant_market") {
    openMerchantDialogue();
    setStatus("商人正在等候你的選擇。");
  } else if (target.id === "test_checkpoint") {
    state.checkpointActive = true;
    saveCheckpoint();
    checkpointEl.classList.add("is-active");
    openDialogue("存檔點已啟動", "此處已設為最新復活位置。死亡後會從這個存檔點恢復。");
    setStatus("存檔點已啟動；死亡後將從此處復活。");
  }
  updateScene();
  saveProgress();
}

// Optional, local-only performance diagnostics. Enable with ?perf=1.
// Disabled in normal play; no telemetry or network requests are made.
const PERF_ENABLED = new URLSearchParams(window.location.search).get("perf") === "1";
const perfDurations = Object.create(null);
const perfFrameSamples = [];
const perfCounters = { visionCacheHits: 0, lastRayCount: 0 };
let perfPreviousFrame = 0;
let perfLastPaint = 0;
let perfPanel = null;

function perfWrapFunction(name, original) {
  return function (...args) {
    const startedAt = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      const elapsed = performance.now() - startedAt;
      const metric = perfDurations[name] || (perfDurations[name] = { total: 0, max: 0, calls: 0 });
      metric.total += elapsed;
      metric.max = Math.max(metric.max, elapsed);
      metric.calls += 1;
    }
  };
}

function perfRecordFrame(timestamp) {
  if (perfPreviousFrame) {
    perfFrameSamples.push(timestamp - perfPreviousFrame);
    if (perfFrameSamples.length > 180) perfFrameSamples.shift();
  }
  perfPreviousFrame = timestamp;
}

function perfRender(timestamp) {
  if (!perfPanel || timestamp - perfLastPaint < 500) return;
  perfLastPaint = timestamp;
  const sortedFrames = [...perfFrameSamples].sort((a, b) => a - b);
  const averageFrame = perfFrameSamples.length
    ? perfFrameSamples.reduce((sum, value) => sum + value, 0) / perfFrameSamples.length
    : 0;
  const p95Frame = sortedFrames.length
    ? sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * 0.95))]
    : 0;
  const lines = [
    "PERFORMANCE MONITOR",
    "FPS(avg): " + (averageFrame ? (1000 / averageFrame).toFixed(1) : "--"),
    "Frame avg / P95: " + averageFrame.toFixed(2) + " / " + p95Frame.toFixed(2) + " ms"
  ];
  for (const name of ["updateScene", "drawVision", "movePlayer", "collides", "saveProgress"]) {
    const metric = perfDurations[name];
    lines.push(metric
      ? name + ": avg " + (metric.total / metric.calls).toFixed(3) + " / max " + metric.max.toFixed(3) + " ms (" + metric.calls + ")"
      : name + ": --");
    if (metric) {
      metric.total = 0;
      metric.max = 0;
      metric.calls = 0;
    }
  }
  const heap = performance.memory && performance.memory.usedJSHeapSize;
  lines.push("Vision cache hits: " + perfCounters.visionCacheHits);
  lines.push("Vision rays / DPR: " + perfCounters.lastRayCount + " / " + (window.devicePixelRatio || 1));
  lines.push("JS heap: " + (heap ? (heap / 1048576).toFixed(1) + " MB" : "not exposed"));
  perfCounters.visionCacheHits = 0;
  perfPanel.textContent = lines.join("\n");
}

if (PERF_ENABLED) {
  perfPanel = document.createElement("pre");
  perfPanel.id = "game-performance-monitor";
  Object.assign(perfPanel.style, {
    position: "fixed", top: "10px", right: "10px", zIndex: "2147483647",
    width: "min(360px, calc(100vw - 20px))", maxHeight: "45vh", overflow: "hidden",
    margin: "0", padding: "10px 12px", border: "1px solid rgba(180,210,205,.45)",
    borderRadius: "8px", background: "rgba(5,12,18,.88)", color: "#dcebe6",
    font: "11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace",
    whiteSpace: "pre-wrap", pointerEvents: "none", backdropFilter: "blur(8px)"
  });
  document.body.append(perfPanel);
  updateScene = perfWrapFunction("updateScene", updateScene);
  drawVision = perfWrapFunction("drawVision", drawVision);
  movePlayer = perfWrapFunction("movePlayer", movePlayer);
  collides = perfWrapFunction("collides", collides);
  saveProgress = perfWrapFunction("saveProgress", saveProgress);
  window.__gamePerf = {
    enabled: true,
    snapshot: () => ({
      frameIntervalsMs: [...perfFrameSamples],
      counters: { ...perfCounters },
      timings: Object.fromEntries(Object.entries(perfDurations).map(([key, value]) => [key, { ...value }]))
    })
  };
}

document.querySelectorAll("[data-quest-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.questTab;
    document.querySelectorAll("[data-quest-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-quest-category]").forEach((panel) => {
      panel.hidden = panel.dataset.questCategory !== selected;
      panel.classList.toggle("is-selected", !panel.hidden);
    });
  });
});
startButton.addEventListener("click", startExploration);
respawnButton.addEventListener("click", respawnAtCheckpoint);
deathTitleButton.addEventListener("click", showTitle);
backButton.addEventListener("click", showTitle);
let panelStack = 100;
// Register every full-screen page here so opening one automatically closes
// every other page. Add future pages to this list and the same rule applies.
const overlayPanels = [
  { panel: questPanel, toggle: questToggle, stateKey: "questOpen" },
  { panel: inventoryPanel, toggle: inventoryToggle, stateKey: "inventoryOpen" },
];
function toggleOverlayPanel(panel, toggle, stateKey) {
  const shouldOpen = !state[stateKey];

  if (shouldOpen) {
    stopInput();
    if (state.marketOpen) closeMarketPanel();
    overlayPanels.forEach((item) => {
      if (item.stateKey === stateKey) return;
      state[item.stateKey] = false;
      item.panel.hidden = true;
      item.panel.removeAttribute("aria-modal");
      item.panel.removeAttribute("role");
      item.toggle.setAttribute("aria-expanded", "false");
    });
  }

  state[stateKey] = shouldOpen;
  if (stateKey === "inventoryOpen" && !shouldOpen) {
  }
  panel.hidden = !shouldOpen;
  if (shouldOpen) {
    panel.style.setProperty("--panel-z-index", String(++panelStack));
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("role", "dialog");
  } else {
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("role");
  }
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  saveProgress();
}
questToggle.addEventListener("click", () => toggleOverlayPanel(questPanel, questToggle, "questOpen"));
inventoryToggle.addEventListener("click", () => toggleOverlayPanel(inventoryPanel, inventoryToggle, "inventoryOpen"));
document.querySelectorAll("[data-inventory-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    inventoryFilter = button.dataset.inventoryFilter;
    document.querySelectorAll("[data-inventory-filter]").forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle("is-selected", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    renderInventory();
  });
});
document.addEventListener("keydown", (event) => {
  if (!state.started || event.repeat) return;
  if (state.marketOpen) {
    if (event.key === "f" || event.key === "F" || event.key === "Escape") {
      event.preventDefault();
      closeMarketPanel();
    }
    return;
  }
  if (event.key === "t" || event.key === "T") { event.preventDefault(); toggleOverlayPanel(questPanel, questToggle, "questOpen"); return; }
  if (event.key === "e" || event.key === "E") { event.preventDefault(); toggleOverlayPanel(inventoryPanel, inventoryToggle, "inventoryOpen"); return; }
  if (event.key === "f" || event.key === "F") { event.preventDefault(); interact(); return; }
  if (event.key === "Escape" && state.dialogueOpen) { event.preventDefault(); closeDialogue(); saveProgress(); return; }
  if (event.key === "Escape" && state.inventoryOpen) { event.preventDefault(); toggleOverlayPanel(inventoryPanel, inventoryToggle, "inventoryOpen"); return; }
  if (event.key === "Escape" && state.questOpen) { event.preventDefault(); toggleOverlayPanel(questPanel, questToggle, "questOpen"); return; }
  const direction = keyMap[event.key];
  if (direction && state.started && !state.dialogueOpen && !state.marketOpen && !state.questOpen && !state.inventoryOpen) { event.preventDefault(); state.keys.add(direction); }
});
document.addEventListener("keyup", (event) => {
  const direction = keyMap[event.key];
  if (direction) state.keys.delete(direction);
});
function updateJoystick(event) {
  if (event.pointerId !== joystickPointerId) return;
  const rect = joystickBase.getBoundingClientRect();
  const radius = Math.max(1, rect.width / 2 - joystickThumb.offsetWidth / 2 - 8);
  const dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
  const knobX = dx * scale, knobY = dy * scale;
  let x = knobX / radius, y = knobY / radius;
  if (Math.hypot(x, y) < 0.08) { x = 0; y = 0; }
  state.joystick.x = x; state.joystick.y = y;
  joystickThumb.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
}
joystickBase.addEventListener("pointerdown", (event) => {
  if (!state.started || state.dead || state.dialogueOpen || state.marketOpen || state.questOpen || state.inventoryOpen || joystickPointerId !== null) return;
  event.preventDefault(); joystickPointerId = event.pointerId; joystickBase.setPointerCapture(event.pointerId);
  joystick.classList.add("is-active"); updateJoystick(event);
});
joystickBase.addEventListener("pointermove", updateJoystick);
function releaseJoystick(event) { if (event.pointerId === joystickPointerId) resetJoystick(); }
joystickBase.addEventListener("pointerup", releaseJoystick);
joystickBase.addEventListener("pointercancel", releaseJoystick);
joystickBase.addEventListener("lostpointercapture", releaseJoystick);
document.querySelectorAll(".direction").forEach((button) => {
  const direction = button.dataset.direction;
  button.addEventListener("pointerdown", (event) => {
    if (!state.started || state.dialogueOpen) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    state.pointers.set(event.pointerId, direction);
    button.classList.add("is-pressed");
  });
  const release = (event) => {
    state.pointers.delete(event.pointerId);
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});
window.addEventListener("blur", () => { stopInput(); saveProgress(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { stopInput(); saveProgress(); } });
window.addEventListener("pagehide", () => { stopInput(); saveProgress(); });
respawnButton.addEventListener("click", respawnAtCheckpoint);
function refreshSceneViewport() {
  if (!state.started || gameScreen.hidden) return;
  lastVisionCacheKey = "";
  updateScene();
}
window.addEventListener("resize", refreshSceneViewport);
if ("ResizeObserver" in window) {
  sceneResizeObserver = new ResizeObserver(refreshSceneViewport);
  sceneResizeObserver.observe(viewport);
}

function createSaveSnapshot() {
  return {
    version: 2, x: state.x, y: state.y,
    gateOpen: state.gateOpen, secretFound: state.secretFound,
    markerInspected: state.markerInspected, gateCrossed: state.gateCrossed,
    checkpointActive: state.checkpointActive,
    questOpen: state.questOpen, inventoryOpen: state.inventoryOpen,
    inventoryCapacity, inventory: [...state.inventory], inventoryQuantities: { ...inventoryQuantities },
    walletBalance,
    stats: { ...playerStats }, dead: state.dead
  };
}
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(createSaveSnapshot()));
    return true;
  } catch (error) {
    console.warn("Unable to save exploration progress:", error);
    if (statusMessage) statusMessage.textContent = "本機儲存失敗，請確認瀏覽器未限制網站儲存空間。";
    return false;
  }
}
function applySnapshot(data) {
  if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return false;
  state.x = Math.max(PLAYER.width / 2, Math.min(WORLD.width - PLAYER.width / 2, data.x));
  state.y = Math.max(0, Math.min(WORLD.height - PLAYER.height, data.y));
  state.gateOpen = Boolean(data.gateOpen);
  state.secretFound = Boolean(data.secretFound);
  state.markerInspected = Boolean(data.markerInspected);
  state.gateCrossed = Boolean(data.gateCrossed);
  state.inventory = Array.isArray(data.inventory)
    ? data.inventory.filter((id, index, list) => inventoryCatalog.some((item) => item.id === id) && list.indexOf(id) === index)
    : [];
  inventoryQuantities = {};
  for (const id of state.inventory) {
    const savedQuantity = Number(data.inventoryQuantities?.[id]);
    inventoryQuantities[id] = Number.isSafeInteger(savedQuantity) && savedQuantity > 0 ? savedQuantity : 1;
  }
  inventoryCapacity = Math.min(MAX_INVENTORY_CAPACITY, Math.max(20,
    Number.isInteger(data.inventoryCapacity) ? data.inventoryCapacity : 20,
    state.inventory.length));
  walletBalance = Number.isSafeInteger(data.walletBalance) && data.walletBalance >= 0 ? data.walletBalance : 100;
  if (data.stats && typeof data.stats === "object") {
    for (const key of Object.keys(playerStats)) {
      const value = Number(data.stats[key]);
      if (Number.isFinite(value)) playerStats[key] = Math.max(0, Math.min(100, value));
    }
  }
  return true;
}
function saveCheckpoint() {
  try {
    const snapshot = createSaveSnapshot();
    snapshot.dead = false;
    snapshot.checkpointActive = true;
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.warn("Unable to save checkpoint:", error);
    setStatus("存檔點寫入失敗，請確認瀏覽器允許本機儲存。");
    return false;
  }
}
function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (applySnapshot(data)) return data;
    }
  } catch (error) {
    console.warn("Unable to load checkpoint:", error);
  }
  // A new game always has a safe fallback checkpoint at the starting area.
  return { x: 180, y: 180, gateOpen: false, secretFound: false, markerInspected: false,
    gateCrossed: false, inventory: [], inventoryCapacity: 20, stats: { ...playerStats } };
}
function respawnAtCheckpoint() {
  const checkpoint = loadCheckpoint();
  applySnapshot(checkpoint);
  playerStats.health = 100;
  playerStats.oxygen = 100;
  state.dead = false;
  state.diving = false;
  state.dialogueOpen = false;
  state.marketOpen = false;
  marketPanel.hidden = true;
  state.keys.clear();
  state.pointers.clear();
  state.lastTime = 0;
  deathPanel.hidden = true;
  dialoguePanel.hidden = true;
  $("#secret").classList.toggle("is-found", state.secretFound);
  $("#switch").classList.toggle("is-active", state.gateOpen);
  checkpointEl.classList.toggle("is-active", Boolean(checkpoint.checkpointActive));
  statusChip.lastChild.textContent = state.gateOpen ? " 機關已啟動 · 通路開啟" : " 機關未啟動";
  renderInventory();
  renderPlayerStats();
  updateWalletUI();
  updateQuestUI();
  updateScene();
  setStatus("已從最近的存檔點復活。生命與氧氣已恢復。");
  saveProgress();
  state.frame = requestAnimationFrame(tick);
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!applySnapshot(data)) return null;
    // Overlay visibility is session UI state, not saved progress. Always enter gameplay with quests closed.
    state.questOpen = false;
    state.inventoryOpen = Boolean(data.inventoryOpen);
    state.checkpointActive = Boolean(data.checkpointActive);
    return data;
  } catch (error) {
    console.warn("Unable to load exploration progress:", error);
    return null;
  }
}

try {
  if (localStorage.getItem(SAVE_KEY)) startButton.textContent = "繼續探索 ↗";
} catch (error) {
  console.warn("Unable to inspect local save:", error);
}
