const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen");
const gameScreen = $("#game-screen");
const startButton = $("#start-button");
const backButton = $("#back-to-title");
const questToggle = $("#quest-toggle");
const inventoryToggle = $("#inventory-toggle");
const questPanel = $("#quest-panel");
const inventoryPanel = $("#inventory-panel");
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
  inventoryOpen: false
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
        : "先找到潮痕標記，調查這處測試區留下的線索。";
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
  const nextX = Math.max(minX, Math.min(maxX, state.x + dx));
  if (!collides(nextX, state.y)) state.x = nextX;
  const nextY = Math.max(minY, Math.min(maxY, state.y + dy));
  if (!collides(state.x, nextY)) state.y = nextY;
}

// Return the first positive intersection with an opaque rectangle. If the
// origin is inside a rectangle, use its exit edge so the ray never produces
// Infinity/NaN geometry or a discontinuous polygon.
// Ray/rectangle intersection in world coordinates. Returns the first non-negative
// hit distance, including the exit edge when the ray starts inside a rectangle.
function rayRectDistance(originX, originY, dirX, dirY, rect) {
  let near = -Infinity;
  let far = Infinity;
  const axes = [
    { origin: originX, dir: dirX, min: rect.x, max: rect.x + rect.w },
    { origin: originY, dir: dirY, min: rect.y, max: rect.y + rect.h }
  ];
  for (const axis of axes) {
    if (Math.abs(axis.dir) < 1e-9) {
      if (axis.origin < axis.min || axis.origin > axis.max) return Infinity;
      continue;
    }
    let a = (axis.min - axis.origin) / axis.dir;
    let b = (axis.max - axis.origin) / axis.dir;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return Infinity;
  }
  if (far < 0) return Infinity;
  return near >= 0 ? near : far;
}

function rayBoundsDistance(originX, originY, dirX, dirY, bounds) {
  let distance = Infinity;
  if (dirX > 1e-9) distance = Math.min(distance, (bounds.x + bounds.w - originX) / dirX);
  else if (dirX < -1e-9) distance = Math.min(distance, (bounds.x - originX) / dirX);
  if (dirY > 1e-9) distance = Math.min(distance, (bounds.y + bounds.h - originY) / dirY);
  else if (dirY < -1e-9) distance = Math.min(distance, (bounds.y - originY) / dirY);
  return Number.isFinite(distance) && distance >= 0 ? distance : 0;
}

// One visibility system owns both light reach and wall occlusion. We draw a
// dark overlay, then cut out the visibility polygon. Rays stop at the nearest
// wall, viewport edge, or configured radius; no second wall-shadow pass runs.
function drawVision(cameraX, cameraY) {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  for (const canvas of [visionCanvas, maskCanvas, featherCanvas]) {
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
  }

  const ctx = visionContext;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.clearRect(0, 0, width, height);

  const sourceX = state.x;
  const sourceY = state.y + PLAYER.height - PLAYER.hitHeight / 2;
  const screenX = sourceX - cameraX;
  const brightness = Math.max(0.12, Math.min(1, VISION.brightness));
  const fog = Math.max(0, Math.min(1, VISION.fog));
  const radius = VISION.baseRadius * (0.48 + brightness * 0.52) * (1 - fog * 0.68);
  const darkness = Math.max(0, Math.min(1, VISION.darkness));
  const blockers = obstacles.filter((o) => !(o.gate && state.gateOpen));
  const view = { x: cameraX, y: cameraY, w: width, h: height };

  // Darkness remains consistent; only the polygon of visible space is removed.
  ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
  ctx.fillRect(0, 0, width, height);

  const angles = [];
  const epsilon = 1e-5;
  const addAngle = (x, y) => {
    const angle = Math.atan2(y - sourceY, x - sourceX);
    angles.push(angle - epsilon, angle, angle + epsilon);
  };
  // Rays at regular intervals keep the range edge circular; corner-adjacent
  // rays make the visibility silhouette wrap tightly around each blocker.
  const radialSteps = 128;
  for (let i = 0; i < radialSteps; i++) angles.push((i / radialSteps) * Math.PI * 2);
  addAngle(cameraX, cameraY);
  addAngle(cameraX + width, cameraY);
  addAngle(cameraX + width, cameraY + height);
  addAngle(cameraX, cameraY + height);
  for (const wall of blockers) {
    addAngle(wall.x, wall.y);
    addAngle(wall.x + wall.w, wall.y);
    addAngle(wall.x + wall.w, wall.y + wall.h);
    addAngle(wall.x, wall.y + wall.h);
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
    let distance = Math.min(radius, rayBoundsDistance(sourceX, sourceY, dirX, dirY, view));
    for (const wall of blockers) {
      const hit = rayRectDistance(sourceX, sourceY, dirX, dirY, wall);
      if (hit < distance) distance = hit;
    }
    if (!Number.isFinite(distance) || distance < 0) continue;
    points.push({ x: sourceX + dirX * distance - cameraX, y: sourceY + dirY * distance - cameraY });
  }

  if (points.length >= 3) {
    const mctx = maskCtx;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, width, height);
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) mctx.lineTo(points[i].x, points[i].y);
    mctx.closePath();
    mctx.fill();

    const fctx = featherCtx;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.globalCompositeOperation = "source-over";
    fctx.filter = "none";
    fctx.clearRect(0, 0, width, height);
    fctx.filter = `blur(${Math.max(0, VISION.shadowBlur / 2)}px)`;
    fctx.drawImage(maskCanvas, 0, 0, width, height);
    fctx.filter = "none";

    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(featherCanvas, 0, 0, pixelWidth, pixelHeight, 0, 0, width, height);
  }

  // Restore explicit wall-face occlusion. The visibility polygon alone cannot
  // keep a wall face opaque when the feathered mask crosses its edge.
  const FAR = 4000;
  const addShadow = (o) => {
    const c = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
    const p = c.map(([x, y]) => {
      const dx = x - sourceX, dy = y - sourceY, l = Math.hypot(dx, dy) || 1;
      return [x + dx / l * FAR, y + dy / l * FAR];
    });
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const q = [c[i], c[j], p[j], p[i]];
      let area = 0;
      for (let k = 0; k < 4; k++) {
        const a = q[k], b = q[(k + 1) % 4];
        area += a[0] * b[1] - b[0] * a[1];
      }
      if (area < 0) q.reverse(); // consistent winding so nonzero fill never cancels out
      ctx.moveTo(q[0][0] - cameraX, q[0][1] - cameraY);
      for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0] - cameraX, q[k][1] - cameraY);
      ctx.closePath();
    }
  };
  for (const wall of opaque) {
    const rx = wall.x - cameraX;
    const ry = wall.y - cameraY;
    if (rx > width || ry > height || rx + wall.w < 0 || ry + wall.h < 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, wall.w, wall.h);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.fillRect(rx, ry, wall.w, wall.h);
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    for (const other of opaque) if (other !== wall) addShadow(other);
    ctx.fill();
    ctx.restore();
  }


  // Keep the player readable even at the edge of the visibility mask.
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(screenX, state.y + PLAYER.height / 2 - cameraY, PLAYER.width * 0.62, PLAYER.height * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}
function updateScene() {
  const viewW = viewport.clientWidth;
  const viewH = viewport.clientHeight;
  const maxX = Math.max(0, WORLD.width - viewW);
  const maxY = Math.max(0, WORLD.height - viewH);

  // Player and camera share the same device-pixel grid so the sprite's
  // on-screen offset stays constant while the camera follows (no sub-pixel jitter).
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const snap = (v) => Math.round(v * dpr) / dpr;
  const px = snap(state.x);
  const py = snap(state.y);
  const cameraX = snap(Math.max(0, Math.min(maxX, px - viewW / 2)));
  const cameraY = snap(Math.max(0, Math.min(maxY, py + PLAYER.height / 2 - viewH / 2)));

  world.style.transform = `translate3d(${-cameraX}px, ${-cameraY}px, 0)`;
  playerEl.style.left = `${px - cameraX - PLAYER.width / 2}px`;
  playerEl.style.top = `${py - cameraY}px`;
  drawVision(cameraX, cameraY);
  coordinates.textContent = `X ${Math.round(state.x)} · Y ${Math.round(state.y)}`;
  if (state.gateOpen && !state.gateCrossed && state.x > 775 && state.x < 925 && state.y + PLAYER.height < 600) {
    state.gateCrossed = true;
  }
  updateQuestUI();
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
  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.05) : 0;
  state.lastTime = timestamp;
  if (!state.dialogueOpen) {
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
    openDialogue("潮痕標記", "石面上留著一道不自然的刻痕。這是技術測試用互動物件；不新增正式劇情或世界觀設定。");
    setStatus("已調查潮痕標記。");
  } else if (target.id === "test_secret_tide_echo") {
    if (!state.secretFound) {
      state.secretFound = true;
      target.el.classList.add("is-found");
      openDialogue("發現一次性秘密", "你捕捉到藏在遺跡角落的微弱回聲。秘密 ID：test_secret_tide_echo。本局只會記錄這一次發現。");
      setStatus("已發現一次性秘密：微弱回聲。");
    }
  } else if (target.id === "test_puzzle_measurement_device") {
    if (!state.gateOpen) {
      state.gateOpen = true;
      gate.classList.add("is-open");
      $("#switch").classList.add("is-active");
      statusChip.lastChild.textContent = " 機關已啟動 · 通路開啟";
      openDialogue("機關已啟動", "測量裝置已改變測試區狀態。封閉通路已解除碰撞，可以實際走過去。");
      setStatus("通路已開啟；障礙外觀與碰撞狀態均已更新。");
    } else {
      openDialogue("測量機關", "機關已經啟動，通路保持開啟。");
    }
  }
  updateScene();
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
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ x: state.x, y: state.y, gateOpen: state.gateOpen, secretFound: state.secretFound, markerInspected: state.markerInspected, gateCrossed: state.gateCrossed, questOpen: state.questOpen, inventoryOpen: state.inventoryOpen })); } catch (error) {}
}
function loadProgress() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const data = JSON.parse(raw); if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return null; state.questOpen = data.questOpen !== false; state.inventoryOpen = Boolean(data.inventoryOpen); return data; } catch (error) { return null; }
}