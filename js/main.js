const titleScreen = document.querySelector("#title-screen");
const gameScreen = document.querySelector("#game-screen");
const startButton = document.querySelector("#start-button");
const backToTitleButton = document.querySelector("#back-to-title");
const tideHotspot = document.querySelector("#tide-hotspot");
const dialoguePanel = document.querySelector("#dialogue-panel");
const dialogueText = document.querySelector("#dialogue-text");
const closeDialogueButton = document.querySelector("#close-dialogue");
const statusMessage = document.querySelector("#status-message");

const prototypeState = {
  started: false,
  tideMarkerInspected: false
};

function showTitle() {
  titleScreen.hidden = false;
  gameScreen.hidden = true;
  dialoguePanel.hidden = true;
  prototypeState.started = false;
  startButton.focus();
}

function startExploration() {
  prototypeState.started = true;
  titleScreen.hidden = true;
  gameScreen.hidden = false;
  dialoguePanel.hidden = true;
  statusMessage.textContent = "你抵達了潮痕灘。試著調查場景中的標記。";
  tideHotspot.focus();
}

function inspectTideMarker() {
  if (!prototypeState.started) return;

  prototypeState.tideMarkerInspected = true;
  dialogueText.textContent = "石面上留著一道不自然的刻痕。它不像海浪侵蝕的痕跡，更像某種測量裝置留下的記號。這只是原型測試文字，正式劇情將依設計文件整合。";
  dialoguePanel.hidden = false;
  statusMessage.textContent = "已調查潮痕標記。原型互動已成功觸發。";
  closeDialogueButton.focus();
}

function closeDialogue() {
  dialoguePanel.hidden = true;
  statusMessage.textContent = prototypeState.tideMarkerInspected
    ? "你已調查過潮痕標記，可以再次點擊它閱讀描述。"
    : "你抵達了潮痕灘。試著調查場景中的標記。";
  tideHotspot.focus();
}

startButton.addEventListener("click", startExploration);
backToTitleButton.addEventListener("click", showTitle);
tideHotspot.addEventListener("click", inspectTideMarker);
closeDialogueButton.addEventListener("click", closeDialogue);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialoguePanel.hidden) {
    closeDialogue();
  }
});

window.addEventListener("error", (event) => {
  statusMessage.textContent = "原型發生未預期錯誤。請記錄操作步驟，交由 AI 協助檢查。";
  console.error("Prototype error:", event.message);
});
