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
const inventoryCapacityLabel = $("#inventory-capacity");
const playerStats = { health: 100, hunger: 100, water: 100, energy: 100 };
let inventoryCapacity = 20;
const MAX_INVENTORY_CAPACITY = 40;
const inventoryCatalog = [
  { id: "tide_imprint", category: "important", icon: "◈", name: "潮痕拓印", subtitle: "測量痕跡", description: "石面上的刻痕拓印。排列並非自然侵蝕形成，像是某種測量裝置留下的記號。", source: "調查潮痕標記" },
  { id: "echo_fragment", category: "important", icon: "✧", name: "微弱回聲", subtitle: "隱藏發現", description: "從遺跡角落捕捉到的一段微弱回響。內容尚不完整，暫時無法判讀。", source: "發現隱藏回聲" },
  { id: "device_record", category: "important", icon: "◎", name: "機關記錄", subtitle: "裝置資料", description: "測量裝置啟動時留下的狀態記錄。通路已解除封鎖，這份記錄可供之後查閱。", source: "啟動測量機關" }
];
let inventoryFilter = "equipment";
let selectedInventoryItem = null;
const SAVE_KEY = "unwritten-world-exploration-save-v1";
const viewport = $("#scene");
const world = $("#world");
const playerEl = $("#player");
const visionCanvas = $("#vision-canvas");
const visionContext = visionCanvas.getContext("2d");
const statusMessage = $("#status-message");
const statusChip = $("#status-chip");
const interactButton = $("#interact-button");
const dialoguePanel = $("#dialogue-panel");
const dialogueTitle = $("#dialogue-title");
const dialogueText = $("#dialogue-text");
const coordinates = $("#coordinates");
const gate = $("#gate");

// 離屏 canvas 只建立一次，每幀重複使用（避免每幀配置兩張全解析度 canvas）
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
const featherCanvas = document.createElement("canvas");
const featherCtx = featherCanvas.getContext("2d");

const WORLD = { width: 1600, height: 1000 };
const PLAYER = { width: 30, height: 42, speed: 180, hitWidth: 22, hitHeight: 12 };
// Temporary vision settings: brightness/fog are independent knobs for future systems.
const VISION = { baseRadius: 720, brightness: 1, fog: 0, darkness: 0.94, edgeSoftness: 0.38, shadowBlur: 12, shadowOpacity: 0.82 };
const state = {
  started: false,
  x: 180, y: 180,
  keys: new Set(),
  pointers: new Map(),
  gateOpen: false,
  secretFound: false,
  markerInspected: false,
  gateCrossed: false,
  dialogueOpen: false,
  target: null,
  lastTime: 0,
  frame: 0,
  questOpen: true,
  inventoryOpen: false,
  inventory: []
};

const obstacles = [
  { x: 330, y: 220, w: 210, h: 65 },
  { x: 610, y: 350, w: 80, h: 220 },
  { x: 930, y: 170, w: 240, h: 75 },
  { x: 1180, y: 560, w: 90, h: 190 },
  { x: 760, y: 600, w: 180, h: 44, gate: true }
];
const objects = [
  { id: "test_interactable_tide_marker", el: $("#marker"), x: 250, y: 460, radius: 72, title: "潮痕標記" },
  { id: "test_secret_tide_echo", el: $("#secret"), x: 1320, y: 300, radius: 76, title: "微弱回聲" },
  { id: "test_puzzle_measurement_device", el: $("#switch"), x: 830, y: 760, radius: 82, title: "測量機關" }
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

function addInventoryItem(id) {
  if (state.inventory.includes(id)) return;
  if (state.inventory.length >= inventoryCapacity) {
    setStatus("背包已滿。需要先擴充背包空間，才能收納更多物品。");
    return;
  }
  state.inventory.push(id);
  renderInventory();
  saveProgress();
  setStatus(`已放入背包：${inventoryCatalog.find((item) => item.id === id)?.name || "新物件"}。`);
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
}

// Future food, water and sleep interactions can update a parameter through
// this single entry point; no automatic drain or recovery is active yet.
function setPlayerStat(stat, value) {
  if (!Object.prototype.hasOwnProperty.call(playerStats, stat)) return false;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  playerStats[stat] = Math.max(0, Math.min(100, Math.round(numericValue)));
  renderPlayerStats();
  saveProgress();
  return true;
}

function renderInventory() {
  const owned = inventoryCatalog.filter((item) => state.inventory.includes(item.id));
  const visible = owned.filter((item) => item.category === inventoryFilter);
  inventoryCapacityLabel.textContent = `${owned.length} / ${inventoryCapacity}`;
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
      slot.append(icon, name);
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
function openDialogue(title, message) {
  state.dialogueOpen = true;
  dialogueTitle.textContent = title;
  dialogueText.textContent = message;
  dialoguePanel.hidden = false;
  dialoguePanel.focus();
}
function closeDialogue() {
  state.dialogueOpen = false;
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
  titleScreen.hidden = false;
  gameScreen.hidden = true;
  gameScreen.classList.remove("immersive-fallback");
  if (document.fullscreenElement === gameScreen && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  dialoguePanel.hidden = true;
  state.dialogueOpen = false;
  startButton.focus();
}
function startExploration() {
  stopInput();
  const saved = loadProgress();
  state.x = saved ? saved.x : 180; state.y = saved ? saved.y : 180;
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
  gate.classList.toggle("is-open", state.gateOpen);
  $("#secret").classList.toggle("is-found", state.secretFound);
  $("#switch").classList.toggle("is-active", state.gateOpen);
  statusChip.lastChild.textContent = state.gateOpen ? " 機關已啟動 · 通路開啟" : " 機關未啟動";
  titleScreen.hidden = true;
  gameScreen.hidden = false;
  dialoguePanel.hidden = true;
  state.dialogueOpen = false;
  questPanel.hidden = !state.questOpen;
  inventoryPanel.hidden = !state.inventoryOpen;
  questToggle.setAttribute("aria-expanded", String(state.questOpen));
  inventoryToggle.setAttribute("aria-expanded", String(state.inventoryOpen));
  setStatus(saved ? "已載入本機儲存的進度。WASD／方向鍵移動，靠近物件後按 F 互動。" : "使用 WASD／方向鍵移動，靠近物件後按 F 互動。");
  updateScene();
  state.frame = requestAnimationFrame(tick);
}
function stopInput() {
  state.keys.clear();
  state.pointers.clear();
  document.querySelectorAll(".direction.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
}
function getInput() {
  let x = 0, y = 0;
  const active = new Set([...state.keys, ...state.pointers.values()]);
  if (active.has("left")) x -= 1;
  if (active.has("right")) x += 1;
  if (active.has("up")) y -= 1;
  if (active.has("down")) y += 1;
  const length = Math.hypot(x, y);
  if (length > 0) { x /= length; y /= length; }
  return { x, y };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function collides(x, y) {
  const hit = { x: x - PLAYER.hitWidth / 2, y: y + PLAYER.height - PLAYER.hitHeight, w: PLAYER.hitWidth, h: PLAYER.hitHeight };
  if (hit.x < 0 || hit.y < 0 || hit.x + hit.w > WORLD.width || hit.y + hit.h > WORLD.height) return true;
  return obstacles.some((obstacle) => {
    if (obstacle.gate && state.gateOpen) return false;
    return rectsOverlap(hit, obstacle);
  });
}
function movePlayer(dx, dy) {
  // Resolve axes independently so diagonal movement remains stable against
  // world boundaries and wall corners; clamp using the sprite's full bounds.
  const minX = PLAYER.width / 2;
  const maxX = WORLD.width - PLAYER.width / 2;
  const minY = 0;
  const maxY = WORLD.height - PLAYER.height;
  // Substep larger frame deltas so collision resolution cannot skip across a
  // thin wall after a dropped frame. This does not change the intended speed.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let i = 0; i < steps; i++) {
    const nextX = Math.max(minX, Math.min(maxX, state.x + stepX));
    if (!collides(nextX, state.y)) state.x = nextX;
    const nextY = Math.max(minY, Math.min(maxY, state.y + stepY));
    if (!collides(state.x, nextY)) state.y = nextY;
  }
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
  }

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
  for (const o of opaque) {
    addCorner(o.x, o.y);
    addCorner(o.x + o.w, o.y);
    addCorner(o.x + o.w, o.y + o.h);
    addCorner(o.x, o.y + o.h);
  }
  angles.sort((a, b) => a - b);

  const uniqueAngles = [];
  for (const angle of angles) {
    if (!uniqueAngles.length || Math.abs(angle - uniqueAngles[uniqueAngles.length - 1]) > 1e-7) {
      uniqueAngles.push(angle);
    }
  }

  const points = [];
  for (const angle of uniqueAngles) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let distance = rayViewportDistance(sourceX, sourceY, dirX, dirY, view);
    if (restricted) distance = Math.min(distance, radius);
    for (const obstacle of opaque) {
      const hit = rayRectDistance(sourceX, sourceY, dirX, dirY, obstacle);
      if (hit < distance) distance = hit;
    }
    if (!Number.isFinite(distance) || distance < 0) continue;

    let hitX = sourceX + dirX * distance;
    let hitY = sourceY + dirY * distance;
    let nearestCorner = null;
    let nearestCornerError = 0.75;
    for (const wall of opaque) {
      for (const corner of [
        { x: wall.x, y: wall.y },
        { x: wall.x + wall.w, y: wall.y },
        { x: wall.x + wall.w, y: wall.y + wall.h },
        { x: wall.x, y: wall.y + wall.h }
      ]) {
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
  const addShadow = (o) => {
    const corners = [
      [o.x, o.y],
      [o.x + o.w, o.y],
      [o.x + o.w, o.y + o.h],
      [o.x, o.y + o.h]
    ];
    const projected = corners.map(([x, y]) => {
      const dx = x - sourceX;
      const dy = y - sourceY;
      const length = Math.hypot(dx, dy) || 1;
      return [x + dx / length * FAR, y + dy / length * FAR];
    });
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const polygon = [corners[i], corners[j], projected[j], projected[i]];
      let area = 0;
      for (let k = 0; k < 4; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % 4];
        area += a[0] * b[1] - b[0] * a[1];
      }
      if (area < 0) polygon.reverse();
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(polygon[k][0], polygon[k][1]);
      ctx.closePath();
    }
  };

  const padX = 1 / scaleX;
  const padY = 1 / scaleY;
  const snapX = (x) => Math.floor(x * scaleX) / scaleX;
  const snapY = (y) => Math.floor(y * scaleY) / scaleY;
  const ceilX = (x) => Math.ceil(x * scaleX) / scaleX;
  const ceilY = (y) => Math.ceil(y * scaleY) / scaleY;

  for (const wall of opaque) {
    const rx = snapX(wall.x) - padX;
    const ry = snapY(wall.y) - padY;
    const rr = ceilX(wall.x + wall.w) + padX;
    const rb = ceilY(wall.y + wall.h) + padY;
    const rw = rr - rx;
    const rh = rb - ry;

    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.fillRect(rx, ry, rw, rh);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 9;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.restore();

    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(rx, ry, rw, rh);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    for (const other of opaque) {
      if (other !== wall) addShadow(other);
    }
    ctx.fill();
    ctx.restore();
  }

  // The player is a sibling of #world and remains above this world-space overlay.
  ctx.globalCompositeOperation = "source-over";
}
function updateScene() {
  const viewW = viewport.clientWidth;
  const viewH = viewport.clientHeight;
  const maxX = Math.max(0, WORLD.width - viewW);
  const maxY = Math.max(0, WORLD.height - viewH);

  // Keep the camera in the same continuous CSS-pixel coordinate space as
  // the world transform and the canvas geometry. Snapping only the camera to
  // the device-pixel grid makes its motion discontinuous while DOM walls and
  // canvas shadow edges are rasterized by different pipelines; at fractional
  // DPR this can show up as a transient wall-face cut during vertical scroll.
  const px = state.x;
  const py = state.y;
  const cameraX = Math.max(0, Math.min(maxX, px - viewW / 2));
  const cameraY = Math.max(0, Math.min(maxY, py + PLAYER.height / 2 - viewH / 2));

  world.style.transform = `translate3d(${-cameraX}px, ${-cameraY}px, 0)`;
  playerEl.style.left = `${px - cameraX - PLAYER.width / 2}px`;
  playerEl.style.top = `${py - cameraY}px`;
  drawVision();
  const coordText = `X ${Math.round(state.x)} · Y ${Math.round(state.y)}`;
  if (coordText !== updateScene.lastCoord) {
    updateScene.lastCoord = coordText;
    coordinates.textContent = coordText;
  }
  if (state.gateOpen && !state.gateCrossed && state.x > 775 && state.x < 925 && state.y + PLAYER.height < 600) {
    state.gateCrossed = true;
  }
  const questKey = `${state.markerInspected}|${state.gateOpen}|${state.gateCrossed}|${state.secretFound}`;
  if (questKey !== updateScene.lastQuest) {
    updateScene.lastQuest = questKey;
    updateQuestUI();
  }
  const nearest = objects.map((object) => ({ ...object, distance: Math.hypot(object.x - state.x, object.y - (state.y + PLAYER.height / 2)) }))
    .filter((object) => object.distance <= object.radius && !(object.id === "test_secret_tide_echo" && state.secretFound))
    .sort((a, b) => a.distance - b.distance)[0] || null;
  state.target = nearest;
  interactButton.disabled = !nearest || state.dialogueOpen;
  interactButton.textContent = nearest ? `互動：${nearest.title}（F）` : "互動（F）";
  objects.forEach((object) => object.el.classList.toggle("is-near", Boolean(nearest && nearest.id === object.id)));
}
function tick(timestamp) {
  if (!state.started) return;
  // Allow a slightly larger frame delta; movePlayer subdivides it before
  // collision checks, reducing apparent slowdown after brief frame stalls.
  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.1) : 0;
  state.lastTime = timestamp;
  if (!state.dialogueOpen && !state.inventoryOpen) {
    const input = getInput();
    if (input.x || input.y) movePlayer(input.x * PLAYER.speed * dt, input.y * PLAYER.speed * dt);
    updateScene();
  }
  state.frame = requestAnimationFrame(tick);
}
function interact() {
  if (!state.started) return;
  if (state.dialogueOpen) { closeDialogue(); saveProgress(); return; }
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
    if (!state.gateOpen) {
      state.gateOpen = true;
      addInventoryItem("device_record");
      gate.classList.add("is-open");
      $("#switch").classList.add("is-active");
      statusChip.lastChild.textContent = " 機關已啟動 · 通路開啟";
      openDialogue("機關已啟動", "測量裝置已啟動，封閉通路隨之開啟。");
      setStatus("通路已開啟；障礙外觀與碰撞狀態均已更新。");
    } else {
      openDialogue("測量機關", "機關已經啟動，通路保持開啟。");
    }
  }
  updateScene();
  saveProgress();
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
backButton.addEventListener("click", showTitle);
let panelStack = 100;
// Register every full-screen page here so opening one automatically closes
// every other page. Add future pages to this list and the same rule applies.
const overlayPanels = [
  { panel: questPanel, toggle: questToggle, stateKey: "questOpen" },
  { panel: inventoryPanel, toggle: inventoryToggle, stateKey: "inventoryOpen" }
];
function toggleOverlayPanel(panel, toggle, stateKey) {
  const shouldOpen = !state[stateKey];

  if (shouldOpen) {
    if (stateKey === "inventoryOpen") stopInput();
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
interactButton.addEventListener("click", interact);
objects.forEach((object) => object.el.addEventListener("click", () => {
  if (state.started && state.target && state.target.id === object.id) interact();
  else if (state.started) setStatus("請先移動角色靠近物件，再按互動。");
}));
document.addEventListener("keydown", (event) => {
  if (!state.started) return;
  if (event.key === "t" || event.key === "T") { event.preventDefault(); toggleOverlayPanel(questPanel, questToggle, "questOpen"); return; }
  if (event.key === "e" || event.key === "E") { event.preventDefault(); toggleOverlayPanel(inventoryPanel, inventoryToggle, "inventoryOpen"); return; }
  if (event.key === "f" || event.key === "F") { event.preventDefault(); interact(); return; }
  if (event.key === "Escape" && state.dialogueOpen) { event.preventDefault(); closeDialogue(); saveProgress(); return; }
  if (event.key === "Escape" && state.inventoryOpen) { event.preventDefault(); toggleOverlayPanel(inventoryPanel, inventoryToggle, "inventoryOpen"); return; }
  const direction = keyMap[event.key];
  if (direction && state.started && !state.dialogueOpen) { event.preventDefault(); state.keys.add(direction); }
});
document.addEventListener("keyup", (event) => {
  const direction = keyMap[event.key];
  if (direction) state.keys.delete(direction);
});
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
document.addEventListener("visibilitychange", () => { if (document.hidden) stopInput(); });
window.addEventListener("resize", () => { if (state.started) updateScene(); });

function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ x: state.x, y: state.y, gateOpen: state.gateOpen, secretFound: state.secretFound, markerInspected: state.markerInspected, gateCrossed: state.gateCrossed, questOpen: state.questOpen, inventoryOpen: state.inventoryOpen, inventoryCapacity, inventory: state.inventory, stats: playerStats })); } catch (error) { console.warn("Unable to save exploration progress:", error); }
}
function loadProgress() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const data = JSON.parse(raw); if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return null; state.questOpen = data.questOpen !== false; state.inventoryOpen = Boolean(data.inventoryOpen); inventoryCapacity = Math.min(MAX_INVENTORY_CAPACITY, Math.max(20, Number.isInteger(data.inventoryCapacity) ? data.inventoryCapacity : 20));
    if (data.stats && typeof data.stats === "object") {
      for (const key of Object.keys(playerStats)) {
        const value = Number(data.stats[key]);
        if (Number.isFinite(value)) playerStats[key] = Math.max(0, Math.min(100, Math.round(value)));
      }
    }
    return data; } catch (error) { return null; }
}