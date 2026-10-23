# AI 協作入口（必讀）

本專案是《零界紀元：THE UNWRITTEN WORLD》，手機／平板優先、靜態瀏覽器執行的原創 2.5D 探索冒險遊戲。本文是跨 AI／工具的入口，不取代詳細規格。

## 開始工作前
1. 先讀 `docs/12_SPEC_AUTHORITY_AND_STATUS.md`，掌握現行決策、文件權責、開發階段及尚未定案項目。
2. 再讀 `docs/00_PROJECT_MASTER.md`、`docs/11_CURRENT_GAMEPLAY_DECISIONS.md`、`docs/09_CONTENT_ROADMAP.md`。
3. 依任務讀取對應文件：玩法 `03_GAMEPLAY_SPEC.md`、劇情／世界／角色 `01_WORLD_BIBLE.md`、`02_STORY_BIBLE.md`、`04_CHARACTER_BIBLE.md`、場景 `05_SCENE_CATALOG.md`、資料 `06_JSON_SCHEMA.md`、美術 `07_ART_BIBLE.md`、技術 `08_TECH_SPEC.md`、交接規則 `10_AI_HANDOFF.md`，以及實作起始規格 `docs/13_IMPLEMENTATION_START_HERE.md`，並檢查實際程式、資料與測試。
4. 先確認目前分支、commit、實際存在的檔案和可重用程式；不得把文件規格當成已實作功能。

## 權責與衝突規則
- 專案範圍、硬性限制、階段定義：`docs/12_SPEC_AUTHORITY_AND_STATUS.md` 與 `docs/00_PROJECT_MASTER.md`。
- 世界客觀規則：`docs/01_WORLD_BIBLE.md`；主線、揭露順序、選擇：`docs/02_STORY_BIBLE.md`；角色身分與知識邊界：`docs/04_CHARACTER_BIBLE.md`。不得為了實作方便自行改寫正史。
- 玩家可觀察到的玩法行為：`docs/03_GAMEPLAY_SPEC.md`；場景配置：`docs/05_SCENE_CATALOG.md`；資料欄位與正式 ID：`docs/06_JSON_SCHEMA.md`；美術方向：`docs/07_ART_BIBLE.md`；技術實作：`docs/08_TECH_SPEC.md`；工作順序：`docs/09_CONTENT_ROADMAP.md`；交接流程：`docs/10_AI_HANDOFF.md`；靜態盤點與現行決策：`docs/11_CURRENT_GAMEPLAY_DECISIONS.md`。
- 本文件／現行決策索引中的「已確認」優先於舊版快照；專題聖經對其專屬內容有最終權威。若兩項正式規格衝突，先報告衝突，不要自行猜測或默默改正。
- `docs/` 中標明「歷史版本存檔」的內容只供追溯，不是當前工作指令。除非本任務明確要求整理歷史，不要刪除歷史記錄。

## 固定限制與交付規則
- HTML、CSS、原生 JavaScript、JSON；GitHub Pages 靜態部署；零預算；不依賴付費 API、執行時 AI API、帳號或持續連線後端。
- MVP 先用佔位素材驗證小型區域的移動、碰撞、鏡頭／邊界、互動、秘密及世界狀態謎題；不要先製作大量正式美術或擴大地圖。
- 技術 MVP 的臨時實作預設以 `docs/13_IMPLEMENTATION_START_HERE.md` 為準；不得把原型預設誤寫成正式美術或全章永久決策。後續戰鬥及第一章存檔格式仍不得提前擴張。
- 不宣稱未執行的測試已通過。分開回報文件／靜態檢查、JSON 檢查、桌面瀏覽器、手機／平板、GitHub Pages 實測。
- 每次交付列出變更檔案、行為差異、測試及原始結果、未測項目、風險、回退方式與下一個具體步驟。


## 立即開工的唯一入口
- 開始寫程式前，必須先讀 `docs/13_IMPLEMENTATION_START_HERE.md`。它把 MVP 所需的投影、座標、渲染、輸入、碰撞、鏡頭、互動物件和驗收條件收斂成臨時實作契約，避免 AI 反覆詢問已可先採用的技術預設。
- 若實際程式與文件描述不同，以實際檔案為準並保留可重用功能；完成一個垂直切片，不要先建立空殼式的大型模組或整章內容。
