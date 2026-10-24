const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen");
const gameScreen = $("#game-screen");
const startButton = $("#start-button");
const backButton = $("#back-to-title");
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
const closeDialogueButton = $("#close-dialogue");
const coordinates = $("#coordinates");
const gate = $("#gate");

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
  frame: 0
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
  closeDialogueButton.focus();
}
function closeDialogue() {
  state.dialogueOpen = false;
  dialoguePanel.hidden = true;
  if (state.started) setStatus(state.target ? `靠近「${state.target.title}」了，按 E／Enter 或「互動」。` : "使用方向控制探索；靠近標記、回聲或機關即可互動。");
}
function showTitle() {
  stopInput();
  state.started = false;
  state.lastTime = 0;
  if (state.frame) cancelAnimationFrame(state.frame);
  state.frame = 0;
  titleScreen.hidden = false;
  gameScreen.hidden = true;
  dialoguePanel.hidden = true;
  state.dialogueOpen = false;
  startButton.focus();
}
function startExploration() {
  stopInput();
  state.x = 180; state.y = 180;
  state.gateOpen = false;
  state.secretFound = false;
  state.markerInspected = false;
  state.gateCrossed = false;
  state.target = null;
  state.started = true;
  state.lastTime = 0;
  gate.classList.remove("is-open");
  $("#secret").classList.remove("is-found");
  $("#switch").classList.remove("is-active");
  statusChip.lastChild.textContent = " 機關未啟動";
  titleScreen.hidden = true;
  gameScreen.hidden = false;
  dialoguePanel.hidden = true;
  state.dialogueOpen = false;
  setStatus("使用 WASD／方向鍵或螢幕方向控制移動。靠近物件後按 E／Enter 或「互動」。");
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
  const nextX = Math.max(PLAYER.width / 2, Math.min(WORLD.width - PLAYER.width / 2, state.x + dx));
  if (!collides(nextX, state.y)) state.x = nextX;
  const nextY = Math.max(0, Math.min(WORLD.height - PLAYER.height, state.y + dy));
  if (!collides(state.x, nextY)) state.y = nextY;
}
function segmentHitsRectBeforeTarget(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let near = 0;
  let far = 1;
  const axes = [
    { start: x1, delta: dx, min: rect.x, max: rect.x + rect.w },
    { start: y1, delta: dy, min: rect.y, max: rect.y + rect.h }
  ];
  for (const axis of axes) {
    if (Math.abs(axis.delta) < 0.0001) {
      if (axis.start < axis.min || axis.start > axis.max) return false;
      continue;
    }
    let a = (axis.min - axis.start) / axis.delta;
    let b = (axis.max - axis.start) / axis.delta;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return false;
  }
  return far > 0.001 && near < 0.999;
}
function wallSampleVisible(worldX, worldY, targetObstacle, playerX, playerY, visibleObstacles) {
  return !visibleObstacles.some((obstacle) => {
    if (obstacle === targetObstacle) return false;
    return segmentHitsRectBeforeTarget(
      playerX, playerY, worldX, worldY, obstacle
    );
  });
}
function drawVision(cameraX, cameraY) {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (visionCanvas.width !== Math.round(width * dpr) || visionCanvas.height !== Math.round(height * dpr)) {
    visionCanvas.width = Math.round(width * dpr);
    visionCanvas.height = Math.round(height * dpr);
  }
  visionContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ctx = visionContext;
  ctx.clearRect(0, 0, width, height);
  const px = state.x - cameraX;
  const py = state.y + PLAYER.height / 2 - cameraY;
  const brightnessFactor = Math.max(0.12, Math.min(1, VISION.brightness));
  const fogFactor = Math.max(0, Math.min(1, VISION.fog));

  // Sight-radius darkness is conditional; obstacle occlusion is always active.
  const sightRestricted = brightnessFactor < 1 || fogFactor > 0;
  const radius = VISION.baseRadius * (0.48 + brightnessFactor * 0.52) * (1 - fogFactor * 0.68);

  if (sightRestricted) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0, 0, 0, ${VISION.darkness})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "destination-out";
    const gradient = ctx.createRadialGradient(px, py, radius * (1 - VISION.edgeSoftness), px, py, radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(0.45, "rgba(0,0,0,0.98)");
    gradient.addColorStop(0.76, "rgba(0,0,0,0.68)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
  }

  // Hard-edged obstacle silhouettes cast shadows away from the player in every state.
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  if (sightRestricted) {
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.clip();
  }
  ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, VISION.shadowOpacity)})`;
  ctx.filter = `blur(${VISION.shadowBlur}px)`;
  const obstaclesToDraw = obstacles.filter((o) => !(o.gate && state.gateOpen));
  const reach = Math.hypot(width, height) * 2 + radius;
  for (const o of obstaclesToDraw) {
    const corners = [
      { x: o.x - cameraX, y: o.y - cameraY },
      { x: o.x + o.w - cameraX, y: o.y - cameraY },
      { x: o.x + o.w - cameraX, y: o.y + o.h - cameraY },
      { x: o.x - cameraX, y: o.y + o.h - cameraY }
    ];
    const far = corners.map((p) => {
      const dx = p.x - px, dy = p.y - py, len = Math.hypot(dx, dy) || 1;
      return { x: p.x + dx / len * reach, y: p.y + dy / len * reach };
    });
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      const midX = (corners[i].x + corners[next].x) / 2;
      const midY = (corners[i].y + corners[next].y) / 2;
      const edgeX = corners[next].x - corners[i].x;
      const edgeY = corners[next].y - corners[i].y;
      // Only the edge facing away from the player casts a shadow.
      // Drawing all four edges makes long projections overlap and can darken the whole view.
      const outwardDot = edgeY * (px - midX) - edgeX * (py - midY);
      if (outwardDot > 0 || (midX - px) ** 2 + (midY - py) ** 2 < 1) continue;
      ctx.beginPath();
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[next].x, corners[next].y);
      ctx.lineTo(far[next].x, far[next].y);
      ctx.lineTo(far[i].x, far[i].y);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.filter = "none";
  ctx.restore();

  // Reveal only wall pixels that have a clear line of sight from the player.
  // If another wall is in the way, its shadow remains over the wall behind it.
  ctx.globalCompositeOperation = "destination-out";
  const sampleSize = 6;
  for (const o of obstaclesToDraw) {
    for (let worldY = o.y; worldY < o.y + o.h; worldY += sampleSize) {
      const tileH = Math.min(sampleSize, o.y + o.h - worldY);
      for (let worldX = o.x; worldX < o.x + o.w; worldX += sampleSize) {
        const tileW = Math.min(sampleSize, o.x + o.w - worldX);
        const sampleX = worldX + tileW / 2;
        const sampleY = worldY + tileH / 2;
        if (!wallSampleVisible(sampleX, sampleY, o, state.x, state.y + PLAYER.height / 2, obstaclesToDraw)) continue;
        ctx.clearRect(worldX - cameraX, worldY - cameraY, tileW, tileH);
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function updateScene() {
  const viewW = viewport.clientWidth;
  const viewH = viewport.clientHeight;
  const maxX = Math.max(0, WORLD.width - viewW);
  const maxY = Math.max(0, WORLD.height - viewH);

  // Follow the player's center. Clamp the camera at world edges so the
  // screen-space player only leaves center when the camera cannot follow.
  const cameraX = Math.max(0, Math.min(maxX, state.x - viewW / 2));
  const playerCenterY = state.y + PLAYER.height / 2;
  const cameraY = Math.max(0, Math.min(maxY, playerCenterY - viewH / 2));

  world.style.transform = `translate3d(${-cameraX}px, ${-cameraY}px, 0)`;
  playerEl.style.left = `${state.x - cameraX - PLAYER.width / 2}px`;
  playerEl.style.top = `${state.y - cameraY}px`;
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
  interactButton.textContent = nearest ? `互動：${nearest.title}` : "互動（E）";
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
  if (!state.started || state.dialogueOpen || !state.target) return;
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
startButton.addEventListener("click", startExploration);
backButton.addEventListener("click", showTitle);
interactButton.addEventListener("click", interact);
objects.forEach((object) => object.el.addEventListener("click", () => {
  if (state.started && state.target && state.target.id === object.id) interact();
  else if (state.started) setStatus("請先移動角色靠近物件，再按互動。");
}));
closeDialogueButton.addEventListener("click", closeDialogue);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialoguePanel.hidden) { closeDialogue(); return; }
  if (event.key === "e" || event.key === "E" || event.key === "Enter") {
    if (state.started && !state.dialogueOpen && state.target) { event.preventDefault(); interact(); }
  }
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
window.addEventListener("blur", stopInput);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopInput(); });
window.addEventListener("resize", () => { if (state.started) updateScene(); });
