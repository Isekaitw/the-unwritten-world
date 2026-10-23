const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen");
const gameScreen = $("#game-screen");
const startButton = $("#start-button");
const backButton = $("#back-to-title");
const viewport = $("#scene");
const world = $("#world");
const playerEl = $("#player");
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
const dpr = window.devicePixelRatio || 1;
const snap = (value) => Math.round(value * dpr) / dpr;
const PLAYER = { width: 30, height: 42, speed: 180, hitWidth: 22, hitHeight: 12 };
const state = {
  started: false,
  x: 180, y: 180,
  keys: new Set(),
  pointers: new Map(),
  gateOpen: false,
  secretFound: false,
  markerInspected: false,
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
  // Conventional WASD layout: W=up, A=left, S=down, D=right.
  // Opposing directions cancel; W+A therefore moves diagonally up-left.
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right"
};

function setStatus(message) {
  statusMessage.textContent = message;
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
function updateScene() {
  const viewW = viewport.clientWidth;
  const viewH = viewport.clientHeight;
  const maxX = Math.max(0, WORLD.width - viewW);
  const maxY = Math.max(0, WORLD.height - viewH);
  // Keep fractional CSS-pixel positions. Rounding each frame makes diagonal
  // movement advance in a visible staircase (e.g. up, then left), and can
  // amplify shimmer when the camera and player are transformed separately.
  const cameraX = Math.max(0, Math.min(maxX, state.x - viewW / 2));
  const cameraY = Math.max(0, Math.min(maxY, state.y - viewH / 2));
  const playerX = state.x - PLAYER.width / 2;
  const playerY = state.y;
  playerEl.style.transform = `translate3d(${playerX}px, ${playerY}px, 0)`;
  world.style.transform = `translate3d(${-snap(cameraX)}px, ${-snap(cameraY)}px, 0)`;
  coordinates.textContent = `X ${Math.round(state.x)} · Y ${Math.round(state.y)}`;
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
  button.addEventListener("pointerleave", release);
  button.addEventListener("lostpointercapture", release);
});
window.addEventListener("blur", stopInput);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopInput(); });
window.addEventListener("resize", () => { if (state.started) updateScene(); });
