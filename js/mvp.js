const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen");
const gameScreen = $("#game-screen");
const startButton = $("#start-button");
const backButton = $("#back-to-title");
const fullscreenButton = $("#fullscreen-button");
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
// Segment/rectangle test using the slab method. A hit counts only when it
// occurs strictly before the sample point; touching the endpoint is not an occlusion.
function segmentHitsRectBeforeTarget(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let near = 0;
  let far = 1;
  for (const axis of [
    { start: x1, delta: dx, min: rect.x, max: rect.x + rect.w },
    { start: y1, delta: dy, min: rect.y, max: rect.y + rect.h }
  ]) {
    if (Math.abs(axis.delta) < 1e-8) {
      if (axis.start < axis.min || axis.start > axis.max) return false;
      continue;
    }
    let t1 = (axis.min - axis.start) / axis.delta;
    let t2 = (axis.max - axis.start) / axis.delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near >= far - 1e-8) return false;
  }
  return far > 1e-6 && near < 1 - 1e-6;
}

// A wall's own rectangle is the surface being inspected, not an occluder.
// Every other closed wall must be clear between the player and that sample.
function wallSampleVisible(worldX, worldY, targetObstacle, playerX, playerY, visibleObstacles) {
  for (const obstacle of visibleObstacles) {
    if (obstacle === targetObstacle) continue;
    if (segmentHitsRectBeforeTarget(playerX, playerY, worldX, worldY, obstacle)) return false;
  }
  return true;
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
function drawVision(cameraX, cameraY) {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (visionCanvas.width !== pixelWidth || visionCanvas.height !== pixelHeight) {
    visionCanvas.width = pixelWidth;
    visionCanvas.height = pixelHeight;
  }

  const ctx = visionContext;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  // All occlusion decisions use one world-space source: the player's foot /
  // collision anchor. Camera coordinates are used only when drawing to canvas.
  const sourceX = state.x;
  const sourceY = state.y + PLAYER.height - PLAYER.hitHeight / 2;
  const screenX = sourceX - cameraX;
  const screenY = sourceY - cameraY;
  const brightness = Math.max(0.12, Math.min(1, VISION.brightness));
  const fog = Math.max(0, Math.min(1, VISION.fog));
  const restricted = brightness < 1 || fog > 0;
  const radius = VISION.baseRadius * (0.48 + brightness * 0.52) * (1 - fog * 0.68);
  const opaque = obstacles.filter((o) => !(o.gate && state.gateOpen));
  const view = { x: cameraX, y: cameraY, w: width, h: height };

  // The overlay is fully opaque. Only space reachable by a ray before its
  // first wall (or vision radius) is removed from the overlay.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const angles = [];
  const epsilon = 1e-5;
  const addCorner = (x, y) => {
    const angle = Math.atan2(y - sourceY, x - sourceX);
    angles.push(angle - epsilon, angle, angle + epsilon);
  };
  addCorner(cameraX, cameraY);
  addCorner(cameraX + width, cameraY);
  addCorner(cameraX + width, cameraY + height);
  addCorner(cameraX, cameraY + height);
  for (const o of opaque) {
    addCorner(o.x, o.y);
    addCorner(o.x + o.w, o.y);
    addCorner(o.x + o.w, o.y + o.h);
    addCorner(o.x, o.y + o.h);
  }
  angles.sort((a, b) => a - b);

  // Deduplicate near-identical angles to avoid zero-area spikes at corners.
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

    // Snap ray endpoints to exact obstacle corners when the first hit lands
    // numerically on one. This prevents tiny floating-point offsets from
    // drawing a dark seam that appears detached from the wall corner.
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
    points.push({ x: hitX - cameraX, y: hitY - cameraY });
  }

  ctx.globalCompositeOperation = "destination-out";
  if (points.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // Show the visible faces/areas of wall sprites without revealing anything
  // hidden behind a different wall. Small tiles avoid coarse holes; each test
  // uses the same world-space line segment and active-wall list as ray casting.
  const sampleSize = 2;
  for (const wall of opaque) {
    const minX = Math.max(wall.x, cameraX);
    const maxX = Math.min(wall.x + wall.w, cameraX + width);
    const minY = Math.max(wall.y, cameraY);
    const maxY = Math.min(wall.y + wall.h, cameraY + height);
    if (minX >= maxX || minY >= maxY) continue;
    for (let worldY = minY; worldY < maxY; worldY += sampleSize) {
      const tileH = Math.min(sampleSize, maxY - worldY);
      let runStart = null;
      let runEnd = null;
      for (let worldX = minX; worldX < maxX; worldX += sampleSize) {
        const tileW = Math.min(sampleSize, maxX - worldX);
        const visible = wallSampleVisible(
          worldX + tileW / 2, worldY + tileH / 2, wall,
          sourceX, sourceY, opaque
        );
        if (visible) {
          if (runStart === null) runStart = worldX;
          runEnd = worldX + tileW;
        } else if (runStart !== null) {
          ctx.clearRect(runStart - cameraX, worldY - cameraY, runEnd - runStart, tileH);
          runStart = null;
          runEnd = null;
        }
      }
      if (runStart !== null) {
        ctx.clearRect(runStart - cameraX, worldY - cameraY, runEnd - runStart, tileH);
      }
    }
  }

  // The player sprite is UI-visible regardless of wall-edge rasterization.
  ctx.clearRect(
    screenX - PLAYER.width / 2 - 2,
    state.y - cameraY - 2,
    PLAYER.width + 4,
    PLAYER.height + 4
  );
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
fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === gameScreen) {
      await document.exitFullscreen();
    } else if (gameScreen.requestFullscreen) {
      await gameScreen.requestFullscreen();
    } else {
      setStatus("此瀏覽器不支援網頁全螢幕，請使用瀏覽器的全螢幕功能。");
      return;
    }
  } catch (error) {
    setStatus("無法切換全螢幕；請確認瀏覽器允許此操作。");
  }
});
document.addEventListener("fullscreenchange", () => {
  const active = document.fullscreenElement === gameScreen;
  fullscreenButton.setAttribute("aria-pressed", String(active));
  fullscreenButton.textContent = active ? "⛶ 離開全螢幕" : "⛶ 全螢幕";
  requestAnimationFrame(() => { if (state.started) updateScene(); });
});
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
