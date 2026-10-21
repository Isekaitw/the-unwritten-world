# 《零界紀元：THE UNWRITTEN WORLD》JSON 資料標準

> 文件代號：06_JSON_SCHEMA  
> 文件狀態：正式資料契約 v1.0  
> 依據文件：00_PROJECT_MASTER.md、01_WORLD_BIBLE.md、02_STORY_BIBLE.md、04_CHARACTER_BIBLE.md、05_SCENE_CATALOG.md、07_ART_BIBLE.md、08_TECH_SPEC.md  
> 適用範圍：所有 AI 生成資料、遊戲內容檔、資料驗證器與後續程式實作  
> 最後更新：2026-10-21  
> 重要：本文件定義資料格式與第一章示範資料；不代表遊戲程式、資產檔或完整章節已經製作完成。

---

## 0. 目的、範圍與優先順序

本文件是遊戲內容 JSON 的共同資料契約。任何 AI 或協作者新增、修改資料時，必須遵守本文件的欄位、ID、引用與路徑規則。若內容需求無法由目前格式表達，先提出最小幅度的 schema 變更，再同步更新所有受影響資料；不得自行塞入未定義欄位或 JavaScript。

### 0.1 目前採用的檔案集合

正式內容檔建議放在專案根目錄的 data/：

- data/game.json
- data/scenes.json
- data/characters.json
- data/dialogue.json
- data/events.json
- data/items.json
- data/quests.json
- data/assets.json

上述是建議採用的正式路徑。若現有程式另有已驗證的資料目錄，必須先統一技術文件和載入器，不可在不同檔案中各自猜路徑。這八份資料應以 UTF-8 編碼、標準 JSON 語法儲存。

### 0.2 來源文件衝突優先順序

1. 00_PROJECT_MASTER.md：專案硬性限制、平台和技術邊界。
2. 01_WORLD_BIBLE.md：世界規則、年代、地理、歷史與名詞。
3. 02_STORY_BIBLE.md：章節、角色資訊邊界、事件因果、選擇後果與結局。
4. 04_CHARACTER_BIBLE.md：角色 ID、角色身份、資訊邊界與說話風格。
5. 05_SCENE_CATALOG.md：場景 ID、熱點 ID、出口、場景狀態與素材命名。
6. 本文件：資料欄位、型別、引用與驗證規則。
7. 其他執行文件及單次生成內容。

若高優先級文件尚未定案，採用本文件中的保守預設並標記待確認，不可把推測寫成世界既定事實。

### 0.3 JSON 硬性規則

- JSON 只使用雙引號字串、數字、布林值、null、陣列和物件。
- 不得加入註解、尾隨逗號、undefined、NaN、Infinity、函式或模板字串。
- 不得把 JavaScript、HTML、CSS、條件運算式或可執行程式碼放進 JSON。
- 條件必須用本文件定義的資料結構表達；執行邏輯由遊戲程式實作。
- 不使用同一個欄位有時放字串、有時放物件的混合型別。
- 所有 ID 使用小寫英文字母、數字和底線；建議格式為 ^[a-z][a-z0-9_]*$。
- ID 一旦被其他資料或存檔引用，即視為永久識別碼。顯示名稱可以改，ID 不可因改名而更換或重新分配。
- 陣列順序若影響呈現或流程，必須明確記錄並保持穩定；物件鍵的排列順序不得作為遊戲邏輯依據。
- 所有使用者可見文字使用繁體中文，除非專案日後正式新增語言欄位規範。

### 0.4 全域 ID 命名建議

| 類型 | 前綴／格式 | 範例 |
|---|---|---|
| 場景 | chNN_short_name | ch01_tide_mark |
| 角色 | char_short_name | char_hetin |
| 對話 | dlg_short_name | dlg_hetin_shore_warning |
| 事件 | evt_short_name | evt_ch01_tide_measurement |
| 道具／線索 | item_short_name | item_anomaly_fragment |
| 任務 | quest_short_name | quest_ch01_tide_investigation |
| 資產 | asset_short_name | asset_bg_ch01_tide_mark |
| 熱點 | 場景內唯一的小寫 ID | tide_marker |
| 出口 | exit_to_destination | exit_to_grey_bell |

事件 ID、對話 ID、道具 ID、任務 ID 和資產 ID 在各自類型內必須唯一。為避免除錯混淆，建議整個遊戲不重複使用同一 ID 字串，即使位於不同類型也應避免。

---

## 1. 共用條件格式

條件不得使用 JavaScript 表達式。所有條件使用以下簡單、可驗證的格式：

    {
      "all": [
        { "type": "flag", "key": "ch01_tide_marker_checked", "equals": true }
      ]
    }

支援的條件欄位：

| 欄位 | 型別 | 必填 | 用途與限制 |
|---|---|---|---|
| all | array of condition | 否 | 陣列內條件全部成立；不可與 any、not 同時使用 |
| any | array of condition | 否 | 陣列內至少一項成立；不可與 all、not 同時使用 |
| not | condition | 否 | 反轉一項條件；不可與 all、any 同時使用 |
| type | string | 是 | 目前支援 flag、state_value、item_owned、quest_status、scene_visited |
| key | string | 視 type | flag 使用布林旗標 ID；state_value 使用已定義的列舉狀態 ID；item_owned 使用道具 ID；quest_status 使用任務 ID；scene_visited 使用場景 ID |
| equals | boolean/string | 視 type | flag 使用布林值；state_value 使用列舉允許值；quest_status 使用狀態字串 |
| status | string | quest_status 必填 | 任務狀態，使用 equals 或 status 擇一，建議使用 status |

規則：

- 條件物件只能包含 all、any、not 或一組 type/key/value 欄位，不可混搭。
- 空的 all 或 any 不合法；不需要條件時省略整個 conditions 欄位。
- 旗標不存在時一律視為 false；不可依賴不存在的旗標為 true。
- 任務狀態限定為 not_started、active、completed、failed。
- 場景是否拜訪由引擎保存，不必在內容 JSON 另造同義旗標。
- 條件只讀取狀態，不在條件內產生副作用。

不合法示例（JSON 也不合法，且含程式碼）：

    {
      "conditions": "player.level > 3 && hasItem('key')"
    }

合法替代：

    {
      "conditions": {
        "all": [
          { "type": "flag", "key": "ch01_isolation_ready", "equals": true },
          { "type": "item_owned", "key": "item_anomaly_fragment", "equals": true }
        ]
      }
    }

---

## 2. game.json — 遊戲基本設定

### 2.1 用途

提供遊戲名稱、版本、預設語言、起始場景、資料版本和第一章入口。它不存放玩家進度、任務即時狀態或對話內容。

### 2.2 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 本資料契約版本；目前固定為 1.0.0 |
| game_id | string | 是 | 穩定遊戲 ID；全專案固定為 the_unwritten_world |
| title | string | 是 | 遊戲顯示名稱 |
| subtitle | string | 是 | 副標題 |
| language | string | 是 | BCP 47 語言代碼；目前 zh-Hant |
| version | string | 是 | 遊戲內容版本，使用語意版本或明確版本字串 |
| start_scene_id | string | 是 | 必須存在於 scenes.json 的場景 ID |
| initial_quest_ids | array of string | 是 | 新遊戲開始時啟動的任務 ID；每個 ID 必須存在 |
| data_files | object | 是 | 八份資料的相對路徑；路徑需與專案檔案實際位置一致 |
| save_schema_version | integer | 是 | 存檔格式版本；正整數，資料結構重大變更時遞增 |
| features | object | 是 | 第一版啟用功能；值皆為 boolean，不代表未實作功能已完成 |

### 2.3 完整範例

    {
      "schema_version": "1.0.0",
      "game_id": "the_unwritten_world",
      "title": "零界紀元",
      "subtitle": "THE UNWRITTEN WORLD",
      "language": "zh-Hant",
      "version": "0.1.0",
      "start_scene_id": "ch01_tide_mark",
      "initial_quest_ids": ["quest_ch01_tide_investigation"],
      "data_files": {
        "game": "data/game.json",
        "scenes": "data/scenes.json",
        "characters": "data/characters.json",
        "dialogue": "data/dialogue.json",
        "events": "data/events.json",
        "items": "data/items.json",
        "quests": "data/quests.json",
        "assets": "data/assets.json"
      },
      "save_schema_version": 1,
      "features": {
        "clue_log": true,
        "quest_log": true,
        "manual_save": false,
        "ambient_audio": false
      }
    }

### 2.4 常見錯誤

- start_scene_id 指向場景目錄不存在的 ID。
- initial_quest_ids 寫入不存在的任務。
- data_files 寫成 /Users/name/project/data/scenes.json 等本機絕對路徑。
- 把 manual_save 設為 true，卻沒有完成存檔功能。
- 用遊戲顯示名稱當 game_id，導致名稱修改後破壞存檔相容性。

### 2.5 關聯規則

- start_scene_id 必須存在於 scenes.json。
- initial_quest_ids 每一項必須存在於 quests.json。
- data_files 的每個值必須與實際提交到 GitHub 的檔案位置一致。
- schema_version 是資料格式版本，不可與遊戲內容 version 混為一談。

---

## 3. scenes.json — 場景、熱點與出口

### 3.1 用途

定義場景節點、背景資產、互動熱點、角色出現、場景出口和進入條件。場景 ID 與 05_SCENE_CATALOG.md 對齊。第一章正式場景固定為：

- ch01_tide_mark — 潮痕灘
- ch01_grey_bell — 灰鐘台
- ch01_record_room — 下層記錄室

### 3.2 根物件與欄位規格

根物件欄位：

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| scenes | array | 是 | 場景物件陣列；至少一個場景 |
| id | string | 是 | 唯一且穩定的場景 ID |
| title | string | 是 | 顯示名稱 |
| chapter | integer | 是 | 正整數章節編號 |
| region | string | 是 | 區域名稱 |
| summary | string | 是 | 簡短環境描述，不放完整對話 |
| background_asset_id | string | 是 | 必須存在於 assets.json，類型為 image |
| entry_conditions | condition | 否 | 進入場景的條件；省略代表無條件 |
| hotspots | array | 是 | 可互動熱點；沒有熱點時使用空陣列 |
| exits | array | 是 | 出口；目的地必須存在於 scenes.json |
| character_ids | array of string | 是 | 此場景可出現角色；所有 ID 必須存在於 characters.json |
| on_enter_event_ids | array of string | 是 | 進入時事件；無事件用空陣列，所有 ID 必須存在於 events.json |

熱點欄位：

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| id | string | 是 | 同一場景內唯一，建議整個專案也不重複 |
| label | string | 是 | 按鈕或互動標籤 |
| description | string | 是 | 點擊後可顯示的文字；若主要內容由對話承擔，仍需提供短描述或空字串以外的合理提示 |
| type | string | 是 | inspect、talk、interact、exit 四者之一 |
| conditions | condition | 否 | 未達條件時不可執行；介面應提供提示 |
| dialogue_id | string | 否 | 必須存在於 dialogue.json |
| event_ids | array of string | 是 | 點擊後觸發的事件；無事件用空陣列 |
| item_reward_ids | array of string | 是 | 互動直接給予的道具；無獎勵用空陣列 |
| once | boolean | 是 | true 表示事件成功後不重複執行；重訪仍可顯示已讀內容 |
| completed_flag | string | 否 | 成功完成後設定為 true 的旗標 ID |

出口欄位：

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| id | string | 是 | 出口 ID，來源場景內唯一 |
| label | string | 是 | 出口顯示文字 |
| destination_scene_id | string | 是 | 必須存在於 scenes.json |
| conditions | condition | 否 | 未符合時鎖定出口 |
| locked_message | string | 否 | 出口鎖定時的提示；有條件出口建議必填 |
| event_ids | array of string | 是 | 離開或轉場時觸發的事件；必須引用存在事件 |

### 3.3 完整範例：第一章場景

此範例中的所有場景、對話、事件、道具、任務和資產 ID 均與本文件第 10 節測試資料一致。

    {
      "schema_version": "1.0.0",
      "scenes": [
        {
          "id": "ch01_tide_mark",
          "title": "潮痕灘",
          "chapter": 1,
          "region": "靜潮海岸",
          "summary": "低潮剛退，測量牌的讀數與當日潮況有一處無法解釋的差異。",
          "background_asset_id": "asset_bg_ch01_tide_mark",
          "hotspots": [
            {
              "id": "tide_marker",
              "label": "檢查潮位測量牌",
              "description": "讀數與當日潮況不完全吻合。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_tide_marker"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_tide_marker_checked"
            },
            {
              "id": "hetin_talk",
              "label": "與禾汀交談",
              "description": "禾汀提醒你留意灰鐘台附近的安全標記。",
              "type": "talk",
              "dialogue_id": "dlg_hetin_shore_warning",
              "event_ids": ["evt_ch01_hetin_warning"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_hetin_warned"
            },
            {
              "id": "return_lines",
              "label": "查看歸航短線",
              "description": "石面上的短線是當代居民使用的安全記號。",
              "type": "inspect",
              "event_ids": ["evt_ch01_observe_return_lines"],
              "item_reward_ids": [],
              "once": true
            }
          ],
          "exits": [
            {
              "id": "exit_to_grey_bell",
              "label": "前往灰鐘台",
              "destination_scene_id": "ch01_grey_bell",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_tide_marker_checked", "equals": true },
                  { "type": "flag", "key": "ch01_hetin_warned", "equals": true }
                ]
              },
              "locked_message": "先核對測量牌，並聽取禾汀的安全提醒。",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_hetin"],
          "on_enter_event_ids": ["evt_ch01_enter_tide_mark"]
        },
        {
          "id": "ch01_grey_bell",
          "title": "灰鐘台",
          "chapter": 1,
          "region": "靜潮海岸",
          "summary": "風蝕的觀測站仍有局部低功率回應，無指針鐘停在無法辨認的刻度之間。",
          "background_asset_id": "asset_bg_ch01_grey_bell",
          "hotspots": [
            {
              "id": "bell_shell",
              "label": "檢查無指針鐘",
              "description": "外殼與固定結構仍在，但它已不能正常計時。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_bell"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_bell_checked"
            },
            {
              "id": "arc_inscription",
              "label": "查看三道圓弧",
              "description": "三道未封合圓弧在不同構件上反覆出現。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_arcs"],
              "item_reward_ids": ["item_arc_mark_note"],
              "once": true,
              "completed_flag": "ch01_arc_mark_checked"
            },
            {
              "id": "calibration_ring",
              "label": "檢查校準環",
              "description": "校準環只有局部反應，讀數仍有偏差。",
              "type": "inspect",
              "conditions": {
                "any": [
                  { "type": "flag", "key": "ch01_bell_checked", "equals": true },
                  { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_check_calibration_ring"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_ring_checked"
            },
            {
              "id": "isolation_panel",
              "label": "準備隔離程序",
              "description": "依照面板上的步驟將讀取器限制在低功率狀態。",
              "type": "interact",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_ring_checked", "equals": true },
                  { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_prepare_isolation"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_isolation_ready"
            }
          ],
          "exits": [
            {
              "id": "exit_to_tide_mark",
              "label": "返回潮痕灘",
              "destination_scene_id": "ch01_tide_mark",
              "event_ids": []
            },
            {
              "id": "exit_to_record_room",
              "label": "進入下層記錄室",
              "destination_scene_id": "ch01_record_room",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
                ]
              },
              "locked_message": "先檢查校準環與三道圓弧，再完成隔離程序。",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_greybell_echo"],
          "on_enter_event_ids": ["evt_ch01_enter_grey_bell"]
        },
        {
          "id": "ch01_record_room",
          "title": "下層記錄室",
          "chapter": 1,
          "region": "靜潮海岸／灰鐘台下層",
          "summary": "低功率讀取器保存著一段缺欄的殘響，其中的日期與現行年表不一致。",
          "background_asset_id": "asset_bg_ch01_record_room",
          "hotspots": [
            {
              "id": "record_reader",
              "label": "以低功率讀取記錄",
              "description": "讀取器只還原出日期、缺失欄位與中斷的校準提示。",
              "type": "interact",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_read_anomaly_fragment"],
              "item_reward_ids": ["item_anomaly_fragment"],
              "once": true,
              "completed_flag": "ch01_anomaly_record_found"
            },
            {
              "id": "maintenance_label",
              "label": "查看維護標籤",
              "description": "標籤記錄了上次檢查的程序，但無法指出完整故障原因。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_maintenance_label"],
              "item_reward_ids": ["item_maintenance_note"],
              "once": true
            }
          ],
          "exits": [
            {
              "id": "exit_to_grey_bell",
              "label": "返回灰鐘台",
              "destination_scene_id": "ch01_grey_bell",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_greybell_echo", "char_hetin"],
          "on_enter_event_ids": ["evt_ch01_enter_record_room"]
        }
      ]
    }

### 3.4 常見錯誤

- 出口 destination_scene_id 拼錯或目的地沒有登錄。
- dialogue_id、event_ids、item_reward_ids、character_ids 或 background_asset_id 指向不存在的 ID。
- 同一場景內有兩個同名 hotspot ID。
- 把條件寫成字串或 JavaScript。
- 把場景切換動畫當成必要條件，導致關閉動畫或低效能裝置無法通關。
- 將可選委託設為主線出口的唯一解鎖條件，但劇情文件沒有這項要求。

### 3.5 關聯規則

- 所有出口目的地都必須存在於 scenes.json。
- 所有背景資產 ID 必須存在於 assets.json，且 kind 為 image。
- 所有 character_ids 必須存在於 characters.json。
- 所有 dialogue_id 必須存在於 dialogue.json。
- 所有 event_ids 必須存在於 events.json。
- 所有 item_reward_ids 必須存在於 items.json。
- 出口條件使用共用條件格式；沒有條件的回訪出口應省略 conditions。
- 場景 ID 必須與 05_SCENE_CATALOG.md 一致，不可另造同義 ID。

---

## 4. characters.json — 角色資料

### 4.1 用途

記錄角色穩定身份、顯示名稱、類型、簡介和可選肖像資產。不將每句對話或會變動的信任狀態存進角色定義檔。

### 4.2 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| characters | array | 是 | 角色物件陣列 |
| id | string | 是 | 唯一穩定角色 ID，對齊 04_CHARACTER_BIBLE.md |
| name | string | 是 | 遊戲顯示名稱 |
| role_type | string | 是 | player、npc、echo 三者之一 |
| summary | string | 是 | 不超出角色資訊邊界的簡介 |
| portrait_asset_id | string/null | 是 | 有肖像時引用 assets.json；無肖像時為 null |
| first_chapter | integer | 是 | 首次出場章節，正整數 |
| tags | array of string | 是 | 用於分類的短標籤；沒有標籤使用空陣列 |

### 4.3 完整範例

    {
      "schema_version": "1.0.0",
      "characters": [
        {
          "id": "char_player",
          "name": "測錄員",
          "role_type": "player",
          "summary": "受過基本測繪、記錄整理與野外安全訓練的自由測錄員，沒有超自然能力。",
          "portrait_asset_id": null,
          "first_chapter": 1,
          "tags": ["主角", "測繪", "記錄"]
        },
        {
          "id": "char_hetin",
          "name": "禾汀",
          "role_type": "npc",
          "summary": "熟悉靜潮海岸潮況、航路與居民安全記號的沿岸居民。",
          "portrait_asset_id": "asset_portrait_hetin",
          "first_chapter": 1,
          "tags": ["靜潮海岸", "地方知識", "第一章"]
        },
        {
          "id": "char_greybell_echo",
          "name": "灰鐘台維護殘響",
          "role_type": "echo",
          "summary": "保存低完整度感測或操作資料的設備回應，不是完整人格或全知旁白。",
          "portrait_asset_id": "asset_echo_panel",
          "first_chapter": 1,
          "tags": ["界文", "設備資料", "殘響"]
        },
        {
          "id": "char_seran",
          "name": "瑟嵐",
          "role_type": "npc",
          "summary": "校勘院聯絡人，協助記錄來源、讀取條件與不確定性。",
          "portrait_asset_id": null,
          "first_chapter": 1,
          "tags": ["校勘院", "章末聯絡", "後續角色"]
        }
      ]
    }

### 4.4 常見錯誤

- 把殘響設定成可自由交談的完整 AI 人格。
- 角色 ID 與角色聖經不一致。
- portrait_asset_id 指向不存在的資產，或把檔案路徑直接當作資產 ID。
- 角色簡介提前洩漏角色本身不可能知道的隱藏真相。
- 把信任、是否已交談等遊戲進度放進角色靜態定義。

### 4.5 關聯規則

- 角色 ID 必須與 scenes.json 的 character_ids 及 dialogue.json 的 speaker_id 一致。
- portrait_asset_id 為非 null 時必須存在於 assets.json，且 kind 為 image。
- 角色的即時狀態、信任、是否見過玩家與分支選擇應由事件和存檔系統保存，不直接修改 characters.json。

---

## 5. dialogue.json — 對話資料

### 5.1 用途

以資料驅動方式呈現短對話、角色訊息和玩家選項。不得把對話流程寫成程式碼。選項可以觸發已登錄事件，但不可直接執行未定義函式。

### 5.2 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| dialogues | array | 是 | 對話物件陣列 |
| id | string | 是 | 唯一對話 ID |
| speaker_id | string | 是 | 必須存在於 characters.json |
| lines | array | 是 | 一至多句文字；每句都是非空字串 |
| choices | array | 是 | 無選項時使用空陣列 |
| id（choice） | string | 是 | 該對話內唯一選項 ID，建議全專案不重複 |
| text | string | 是 | 玩家看到的選項文字 |
| conditions | condition | 否 | 選項顯示或可選條件 |
| event_ids | array of string | 是 | 選擇後觸發的事件 ID；無事件使用空陣列 |

### 5.3 完整範例

    {
      "schema_version": "1.0.0",
      "dialogues": [
        {
          "id": "dlg_hetin_shore_warning",
          "speaker_id": "char_hetin",
          "lines": [
            "最近幾週，灰鐘台附近偶爾會傳出低低的共鳴。",
            "那裡以前是觀測站。你可以檢查，但別拆掉還在工作的構件。"
          ],
          "choices": [
            {
              "id": "choice_hetin_acknowledge",
              "text": "我會先確認現場狀態。",
              "event_ids": ["evt_ch01_acknowledge_safety"]
            },
            {
              "id": "choice_hetin_ask_local_signs",
              "text": "附近居民有留下什麼安全記號嗎？",
              "event_ids": ["evt_ch01_ask_local_signs"]
            }
          ]
        },
        {
          "id": "dlg_echo_fragment_notice",
          "speaker_id": "char_greybell_echo",
          "lines": [
            "讀取區段：不完整。",
            "日期欄：無法與本地表對齊。",
            "校準狀態：中斷。"
          ],
          "choices": []
        }
      ]
    }

### 5.4 常見錯誤

- speaker_id 指向不存在的角色。
- 對話選項 event_ids 指向不存在的事件。
- 以 choices 的陣列索引作為選項 ID，後續插入選項就改變存檔含義。
- 將 HTML 標籤或 JavaScript 片段混入台詞。
- 把玩家尚未發現的真相放入角色第一章對話。
- 對話內容只提供主線唯一必要線索，玩家跳過對話就無法完成章節。

### 5.5 關聯規則

- speaker_id 必須存在於 characters.json。
- 所有 choice.event_ids 必須存在於 events.json。
- dialogue_id 必須由場景熱點或事件正確引用。
- 條件不成立的選項應隱藏或呈現為不可選狀態，並依遊戲介面規格提供一致回饋。
- 對話只承載文字與選項；狀態變更統一透過事件處理。

---

## 6. events.json — 事件與條件

### 6.1 用途

事件是資料層中唯一描述遊戲狀態變更的機制。事件可以設定旗標、給予道具、更新任務、顯示文字或記錄場景進度。事件動作採白名單，禁止執行任意程式碼。

### 6.2 事件動作白名單

| action.type | 必要欄位 | 效果 |
|---|---|---|
| set_flag | key、value | 設定布林旗標；value 只能是 true 或 false |
| set_enum | key、value | 設定已登錄的字串列舉狀態；第一章僅允許 `record_handling`，值必須是 `sealed`、`summary_shared`、`location_only` 之一 |
| give_item | item_id | 將道具加入玩家持有清單；item_id 必須存在 |
| start_quest | quest_id | 將任務從 not_started 轉為 active；quest_id 必須存在 |
| complete_quest | quest_id | 將任務設為 completed；必須存在 |
| show_text | text | 顯示一段提示文字；不修改遊戲狀態 |
| add_clue | item_id | 將線索記入線索簿；item_id 必須存在且 item 類型允許作線索 |
| set_scene_state | key、value | 設定當前場景的簡單布林狀態；key 必須是穩定旗標風格 ID |
| end_chapter | chapter、completion_flag | 標記章節完成；chapter 為正整數，completion_flag 為布林旗標 ID |

### 6.3 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| events | array | 是 | 事件物件陣列 |
| id | string | 是 | 唯一穩定事件 ID |
| description | string | 是 | 給製作者看的用途說明，不直接顯示給玩家 |
| conditions | condition | 否 | 事件觸發前置條件 |
| actions | array | 是 | 依序執行的動作；至少一項 |
| once | boolean | 是 | true 時成功執行後記錄為已觸發，不重複執行 |

### 6.4 完整範例

    {
      "schema_version": "1.0.0",
      "events": [
        {
          "id": "evt_ch01_check_tide_marker",
          "description": "完成潮位測量牌調查並更新主線任務。",
          "conditions": {
            "all": [
              { "type": "quest_status", "key": "quest_ch01_tide_investigation", "status": "active" }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_tide_marker_checked", "value": true },
            { "type": "show_text", "text": "讀數與當日潮況不完全吻合。你先記下差異，不急著推定原因。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_hetin_warning",
          "description": "記錄禾汀的安全提醒。",
          "actions": [
            { "type": "set_flag", "key": "ch01_hetin_warned", "value": true },
            { "type": "show_text", "text": "禾汀提醒你先檢查設備狀態，不要直接拆卸仍有反應的構件。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_bell",
          "description": "調查無指針鐘。",
          "actions": [
            { "type": "set_flag", "key": "ch01_bell_checked", "value": true },
            { "type": "show_text", "text": "鐘的外殼仍完整，但計時機構已不能正常工作。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_arcs",
          "description": "記錄三道未封合圓弧。",
          "actions": [
            { "type": "set_flag", "key": "ch01_arc_mark_checked", "value": true },
            { "type": "give_item", "item_id": "item_arc_mark_note" },
            { "type": "show_text", "text": "相似的三道圓弧出現在不同構件上，但目前還無法確定它們的完整用途。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_calibration_ring",
          "description": "檢查校準環的局部回應。",
          "conditions": {
            "any": [
              { "type": "flag", "key": "ch01_bell_checked", "equals": true },
              { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_ring_checked", "value": true },
            { "type": "show_text", "text": "校準讀數仍有偏差。設備只能維持局部低功率回應。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_prepare_isolation",
          "description": "完成讀取前的隔離準備。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_ring_checked", "equals": true },
              { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_isolation_ready", "value": true },
            { "type": "show_text", "text": "隔離程序已準備完成。讀取器將限制在低功率狀態。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_read_anomaly_fragment",
          "description": "取得第一章核心異常記錄，啟動章末處理選擇。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
            ]
          },
          "actions": [
            { "type": "give_item", "item_id": "item_anomaly_fragment" },
            { "type": "add_clue", "item_id": "item_anomaly_fragment" },
            { "type": "set_flag", "key": "ch01_anomaly_record_found", "value": true },
            { "type": "show_text", "text": "殘響中出現一個與現行年表不一致的日期。欄位不完整，來源仍需獨立驗證。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_maintenance_label",
          "description": "取得維護標籤的有限資訊。",
          "actions": [
            { "type": "give_item", "item_id": "item_maintenance_note" },
            { "type": "add_clue", "item_id": "item_maintenance_note" },
            { "type": "show_text", "text": "維護標籤留下程序痕跡，卻不足以還原完整故障原因。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_archive",
          "description": "玩家選擇封存原始資料。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": true },
            { "type": "set_flag", "key": "ch01_data_shared", "value": false },
            { "type": "set_enum", "key": "record_handling", "value": "sealed" },
            { "type": "show_text", "text": "原始碎片已封存，來源和讀取條件一併保留。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_share_summary",
          "description": "玩家選擇分享帶有不確定性註記的摘要。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": false },
            { "type": "set_flag", "key": "ch01_data_shared", "value": true },
            { "type": "set_enum", "key": "record_handling", "value": "summary_shared" },
            { "type": "show_text", "text": "摘要已標明資料缺漏與待驗證項目，尚未把推測當成定論。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_location_only",
          "description": "只記錄異常記錄的位置，暫不複製原件。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": false },
            { "type": "set_flag", "key": "ch01_data_shared", "value": false },
            { "type": "set_enum", "key": "record_handling", "value": "location_only" },
            { "type": "show_text", "text": "你只記下位置，保留已觀察到的線索摘要，稍後可再讀取或尋找獨立來源。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_end",
          "description": "完成第一章並開啟後續章節出口。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true },
              { "any": [
                { "type": "state_value", "key": "record_handling", "equals": "sealed" },
                { "type": "state_value", "key": "record_handling", "equals": "summary_shared" },
                { "type": "state_value", "key": "record_handling", "equals": "location_only" }
              ] }
            ]
          },
          "actions": [
            { "type": "complete_quest", "quest_id": "quest_ch01_tide_investigation" },
            { "type": "set_flag", "key": "chapter_01_complete", "value": true },
            { "type": "end_chapter", "chapter": 1, "completion_flag": "chapter_01_complete" }
          ],
          "once": true
        }
      ]
    }

### 6.5 常見錯誤

- 在 action 中寫 function、程式碼字串、eval 或任意方法名稱。
- 事件引用不存在的任務或道具。
- 將同一事件的 once 設為 true，卻又期待它每次進入場景都重複發放道具。
- 用 add_clue 引用一般道具，但沒有把該道具定義為可記錄線索。
- 事件之間形成永遠無法滿足的循環條件。
- 事件動作只完成任務，卻沒有設定劇情文件和出口條件需要的完成旗標。

### 6.6 關聯規則

- event.id 必須唯一。
- 所有 item_id 必須存在於 items.json。
- 所有 quest_id 必須存在於 quests.json。
- 所有被場景、對話或任務引用的 event ID 必須存在於 events.json。
- once=true 的事件需由引擎記錄已執行狀態。
- 動作依陣列順序執行；如果中途失敗，引擎應避免留下半完成的狀態，建議將單一事件視為一組可驗證的交易。
- 事件只可使用本節白名單動作。新增動作必須先更新本文件和引擎，再使用。

---

## 7. items.json — 道具與線索

### 7.1 用途

第一版的 items 同時承載可持有道具、調查筆記和線索簿條目。第一章不需要背包容量、裝備數值、合成或物品消耗系統。

### 7.2 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| items | array | 是 | 道具物件陣列 |
| id | string | 是 | 唯一穩定道具 ID |
| name | string | 是 | 顯示名稱 |
| item_type | string | 是 | clue、note、key_item 三者之一 |
| description | string | 是 | 玩家可閱讀的描述，不得宣稱未證實推論為事實 |
| is_clue | boolean | 是 | 是否可加入線索簿 |
| icon_asset_id | string/null | 是 | 非 null 時引用 assets.json 的 image 類型資產 |
| stackable | boolean | 是 | 第一章所有記錄類道具應為 false |

### 7.3 完整範例

    {
      "schema_version": "1.0.0",
      "items": [
        {
          "id": "item_anomaly_fragment",
          "name": "異常記錄碎片",
          "item_type": "clue",
          "description": "一段不完整的設備記錄。日期與現行年表不一致，但來源、欄位和校準資訊仍有缺漏。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_arc_mark_note",
          "name": "三道圓弧觀察筆記",
          "item_type": "note",
          "description": "相似的三道未封合圓弧出現在灰鐘台的不同構件上。其完整用途尚未確認。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_maintenance_note",
          "name": "維護標籤摘錄",
          "item_type": "note",
          "description": "維護標籤保留了部分檢查程序，但不足以獨立還原故障原因。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_return_line_note",
          "name": "歸航短線觀察",
          "item_type": "note",
          "description": "當代居民用刻線標示安全路線。這些記號屬於地方生活知識，不等同於古代界文。",
          "is_clue": false,
          "icon_asset_id": "asset_icon_note",
          "stackable": false
        }
      ]
    }

### 7.4 常見錯誤

- 同一項線索因重複點擊被加入多次。
- 把尚未確認的推論寫成道具描述中的確定事實。
- icon_asset_id 使用任意檔案路徑而非資產 ID。
- is_clue 為 false 的道具仍由 add_clue 動作加入線索簿。
- 把大型任務狀態或玩家旗標直接塞入道具欄位。

### 7.5 關聯規則

- icon_asset_id 非 null 時必須存在於 assets.json 且 kind 為 image。
- give_item 與 add_clue 動作引用的 item_id 必須存在。
- add_clue 只能引用 is_clue=true 的道具。
- item ID 一旦進入存檔，不可重新分配給不同道具。
- 道具取得狀態由存檔系統維護，不在 items.json 中寫玩家是否已持有。

---

## 8. quests.json — 任務資料

### 8.1 用途

定義任務目標、完成條件和任務顯示文字。任務的即時狀態由引擎存檔管理，quests.json 只存固定規格。

### 8.2 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| quests | array | 是 | 任務物件陣列 |
| id | string | 是 | 唯一穩定任務 ID |
| title | string | 是 | 任務標題 |
| chapter | integer | 是 | 正整數章節 |
| description | string | 是 | 任務摘要 |
| objectives | array | 是 | 至少一個目標 |
| id（objective） | string | 是 | 任務內唯一目標 ID |
| text | string | 是 | 顯示給玩家的目標 |
| completion_conditions | condition | 否 | 若省略，必須由明確的 complete_quest 事件完成 |
| start_event_ids | array of string | 是 | 啟動時事件；可為空陣列 |
| completion_event_ids | array of string | 是 | 完成後事件；可為空陣列 |
| optional | boolean | 是 | 是否為可選任務 |

### 8.3 完整範例

    {
      "schema_version": "1.0.0",
      "quests": [
        {
          "id": "quest_ch01_tide_investigation",
          "title": "核對沿岸測量",
          "chapter": 1,
          "description": "從潮痕灘的異常讀數開始，檢查灰鐘台並取得可供後續驗證的記錄。",
          "objectives": [
            {
              "id": "obj_ch01_measurement",
              "text": "檢查潮位測量牌並記下異常讀數。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_tide_marker_checked", "equals": true }
                ]
              }
            },
            {
              "id": "obj_ch01_safety",
              "text": "聽取禾汀的安全提醒。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_hetin_warned", "equals": true }
                ]
              }
            },
            {
              "id": "obj_ch01_record",
              "text": "在下層記錄室取得異常記錄碎片。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              }
            }
          ],
          "start_event_ids": [],
          "completion_event_ids": [],
          "optional": false
        },
        {
          "id": "quest_ch01_find_shore_note",
          "title": "找回岸標記錄",
          "chapter": 1,
          "description": "可選地整理一份與地方安全路線有關的舊記錄。",
          "objectives": [
            {
              "id": "obj_ch01_shore_note",
              "text": "查看舊岸標並記下地方路線資訊。",
              "completion_conditions": {
                "all": [
                  { "type": "item_owned", "key": "item_return_line_note", "equals": true }
                ]
              }
            }
          ],
          "start_event_ids": [],
          "completion_event_ids": [],
          "optional": true
        }
      ]
    }

### 8.4 常見錯誤

- 任務 objective ID 在同一任務內重複。
- 任務完成條件引用不存在的旗標、道具或任務。
- 可選任務成為主線必經出口條件，卻沒有在劇情文件明確說明。
- 把任務狀態寫回 quests.json 靜態檔案。
- 任務的 completion_event_ids 引用不存在的事件，或事件又無限制地反覆完成任務。

### 8.5 關聯規則

- start_event_ids 和 completion_event_ids 必須存在於 events.json。
- completion_conditions 使用共用條件格式。
- item_owned 條件中的 key 必須存在於 items.json。
- 任務即時狀態由遊戲引擎保存，固定任務定義不隨玩家進度修改。
- 主線任務必須有清楚的章節完成條件；可選任務不得阻止主線通關。

---

## 9. assets.json — 圖片、音訊與資源索引

### 9.1 用途

所有圖片、音訊與其他靜態檔案都透過資產索引 ID 引用。場景、角色、道具不得各自猜路徑。資產路徑必須與實際提交到 GitHub 的檔案和大小寫完全一致。

### 9.2 建議目錄

    assets/
      art/
        backgrounds/
        characters/
        props/
        ui/
        effects/
      audio/
        ambient/
        sfx/

此目錄為建議的正式目錄。若實際專案已有不同目錄，需同步更新本文件和 assets.json，不可只改其中一處。

### 9.3 欄位規格

| 欄位 | 型別 | 必填 | 用途／限制 |
|---|---|---|---|
| schema_version | string | 是 | 固定 1.0.0 |
| assets | array | 是 | 資產物件陣列 |
| id | string | 是 | 唯一穩定資產 ID |
| kind | string | 是 | image、audio、other 三者之一 |
| path | string | 是 | 相對於專案根目錄的路徑；不可使用 URL、本機絕對路徑或 .. |
| format | string | 是 | webp、png、jpg、svg、mp3、ogg、wav 或其他明確副檔名小寫值 |
| alt | string | image 必填 | 圖片的文字替代描述；音訊可省略 |
| usage | string | 是 | 用途說明 |
| required | boolean | 是 | true 表示內容流程需要此資產；缺檔必須被驗收擋下 |
| fallback | string/null | 是 | 可選備援資產 ID；非 null 時必須存在且類型相容 |

### 9.4 完整範例

    {
      "schema_version": "1.0.0",
      "assets": [
        {
          "id": "asset_bg_ch01_tide_mark",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_tide_mark.webp",
          "format": "webp",
          "alt": "靜潮海岸的低潮灘、潮位測量牌與遠方灰鐘台。",
          "usage": "第一章潮痕灘主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_bg_ch01_grey_bell",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_grey_bell.webp",
          "format": "webp",
          "alt": "風蝕的古代觀測站、無指針鐘與局部界文構件。",
          "usage": "第一章灰鐘台主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_bg_ch01_record_room",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_record_room.webp",
          "format": "webp",
          "alt": "灰鐘台下層記錄室中的記錄支架與低功率讀取器。",
          "usage": "第一章下層記錄室主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_portrait_hetin",
          "kind": "image",
          "path": "assets/art/characters/char_hetin_base.webp",
          "format": "webp",
          "alt": "熟悉靜潮海岸潮況與安全路線的沿岸居民禾汀。",
          "usage": "禾汀對話立繪；若尚未生成，characters.json 可暫時將 portrait_asset_id 設為 null。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_echo_panel",
          "kind": "image",
          "path": "assets/art/characters/char_greybell_echo_panel.webp",
          "format": "webp",
          "alt": "古代設備局部面板與不完整的低功率讀取指示。",
          "usage": "殘響訊息或設備特寫，可由場景背景替代。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_icon_clue",
          "kind": "image",
          "path": "assets/art/ui/ui_clue_icon.svg",
          "format": "svg",
          "alt": "線索簿圖示。",
          "usage": "線索條目圖示。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_icon_note",
          "kind": "image",
          "path": "assets/art/ui/ui_note_icon.svg",
          "format": "svg",
          "alt": "觀察筆記圖示。",
          "usage": "一般筆記圖示。",
          "required": false,
          "fallback": "asset_icon_clue"
        },
        {
          "id": "asset_amb_coast",
          "kind": "audio",
          "path": "assets/audio/ambient/amb_coast_loop.ogg",
          "format": "ogg",
          "usage": "海岸環境音，屬可選裝飾，不得作為必要線索。",
          "required": false,
          "fallback": null
        }
      ]
    }

### 9.5 常見錯誤

- path 指向不存在的檔案，或大小寫與實際檔案不同。
- path 使用本機絕對路徑、外部付費網址或以 .. 離開專案目錄。
- format 與路徑副檔名不一致。
- 角色或場景直接寫圖檔路徑，繞過資產 ID。
- required=true 的資產尚未提交，導致場景載入空白。
- 將未獲授權的音樂或圖片納入正式資產。
- 音訊是必要線索唯一載體，導致靜音玩家無法完成。

### 9.6 關聯規則

- 所有 asset ID 唯一。
- 所有引用資產的欄位必須使用 asset ID，而非 path。
- fallback 非 null 時必須指向存在的資產，且 kind 相容。
- 每個 path 必須在倉庫內找到對應檔案，副檔名與 format 相符。
- 第一章可玩性不得依賴 optional 資產；圖片失敗時仍須提供文字互動與出口。
- assets.json 是索引，不代表列出的檔案已經存在。實作驗收必須另外檢查實體檔案。

---

## 10. 第一章互相一致的測試資料

本節是一套跨八份檔案的整合測試資料。它示範 ID 如何互相引用、事件如何修改狀態、線索如何加入、任務如何完成，以及場景出口如何受旗標控制。內容規模刻意維持精簡，方便 AI 直接作為第一個載入器與驗證器的測試輸入。

### 10.1 測試資料使用說明

- 以下八份資料是同一套示範資料，不可將其中的 ID 任意改成另一份文件未使用的值。
- 場景 ID 與 05_SCENE_CATALOG.md 第一章一致。
- 角色 ID 與 04_CHARACTER_BIBLE.md 一致。
- 第一章必要主線是：檢查潮位測量牌、聽取禾汀提醒、調查灰鐘台、準備隔離、讀取異常記錄、選擇資料處理方式、完成任務。
- 可選的歸航短線筆記不得阻止主線完成。
- 第一章測試結尾採用「封存原始資料」或「分享摘要」兩種互斥選擇；兩者均能完成章節。
- 測試資料的圖片和音訊路徑是預期檔名。若實際檔案尚未生成，assets 驗證應報告缺檔，但文字版流程仍可在使用備援背景的測試模式中執行。

### 10.2 game.json

    {
      "schema_version": "1.0.0",
      "game_id": "the_unwritten_world",
      "title": "零界紀元",
      "subtitle": "THE UNWRITTEN WORLD",
      "language": "zh-Hant",
      "version": "0.1.0",
      "start_scene_id": "ch01_tide_mark",
      "initial_quest_ids": ["quest_ch01_tide_investigation"],
      "data_files": {
        "game": "data/game.json",
        "scenes": "data/scenes.json",
        "characters": "data/characters.json",
        "dialogue": "data/dialogue.json",
        "events": "data/events.json",
        "items": "data/items.json",
        "quests": "data/quests.json",
        "assets": "data/assets.json"
      },
      "save_schema_version": 1,
      "features": {
        "clue_log": true,
        "quest_log": true,
        "manual_save": false,
        "ambient_audio": false
      }
    }

### 10.3 characters.json

    {
      "schema_version": "1.0.0",
      "characters": [
        {
          "id": "char_player",
          "name": "測錄員",
          "role_type": "player",
          "summary": "受過基本測繪、記錄整理與野外安全訓練的自由測錄員。",
          "portrait_asset_id": null,
          "first_chapter": 1,
          "tags": ["主角", "測繪"]
        },
        {
          "id": "char_hetin",
          "name": "禾汀",
          "role_type": "npc",
          "summary": "熟悉靜潮海岸潮況、航路與居民安全記號的沿岸居民。",
          "portrait_asset_id": "asset_portrait_hetin",
          "first_chapter": 1,
          "tags": ["地方知識", "第一章"]
        },
        {
          "id": "char_greybell_echo",
          "name": "灰鐘台維護殘響",
          "role_type": "echo",
          "summary": "保存低完整度設備資料的回應，不是完整人格或全知旁白。",
          "portrait_asset_id": "asset_echo_panel",
          "first_chapter": 1,
          "tags": ["設備資料", "殘響"]
        },
        {
          "id": "char_seran",
          "name": "瑟嵐",
          "role_type": "npc",
          "summary": "校勘院聯絡人，協助保存資料來源和不確定性。",
          "portrait_asset_id": null,
          "first_chapter": 1,
          "tags": ["校勘院", "章末聯絡"]
        }
      ]
    }

### 10.4 dialogue.json

    {
      "schema_version": "1.0.0",
      "dialogues": [
        {
          "id": "dlg_hetin_shore_warning",
          "speaker_id": "char_hetin",
          "lines": [
            "最近幾週，灰鐘台附近偶爾會傳出低低的共鳴。",
            "那裡以前是觀測站。你可以檢查，但別拆掉還在工作的構件。"
          ],
          "choices": [
            {
              "id": "choice_hetin_acknowledge",
              "text": "我會先確認現場狀態。",
              "event_ids": ["evt_ch01_acknowledge_safety"]
            },
            {
              "id": "choice_hetin_ask_local_signs",
              "text": "附近居民有留下什麼安全記號嗎？",
              "event_ids": ["evt_ch01_ask_local_signs"]
            }
          ]
        },
        {
          "id": "dlg_echo_fragment_notice",
          "speaker_id": "char_greybell_echo",
          "lines": [
            "讀取區段：不完整。",
            "日期欄：無法與本地表對齊。",
            "校準狀態：中斷。"
          ],
          "choices": []
        },
        {
          "id": "dlg_ch01_data_choice",
          "speaker_id": "char_player",
          "lines": [
            "記錄可以保存，但如何處理會影響誰能檢查它。"
          ],
          "choices": [
            {
              "id": "choice_ch01_archive",
              "text": "封存原始碎片，保留來源與讀取條件。",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_choose_archive", "evt_ch01_end"]
            },
            {
              "id": "choice_ch01_share_summary",
              "text": "分享附有缺漏註記的摘要。",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_choose_share_summary", "evt_ch01_end"]
            },
            {
              "id": "choice_ch01_location_only",
              "text": "只記下位置，暫不複製原件。",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_choose_location_only", "evt_ch01_end"]
            }
          ]
        }
      ]
    }

### 10.5 events.json

    {
      "schema_version": "1.0.0",
      "events": [
        {
          "id": "evt_ch01_enter_tide_mark",
          "description": "首次進入潮痕灘時啟動主線任務。",
          "actions": [
            { "type": "show_text", "text": "目標：核對沿岸測量讀數。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_tide_marker",
          "description": "完成潮位測量牌調查。",
          "actions": [
            { "type": "set_flag", "key": "ch01_tide_marker_checked", "value": true },
            { "type": "show_text", "text": "讀數與當日潮況不完全吻合。先記錄差異，不急著推定原因。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_hetin_warning",
          "description": "記錄禾汀的安全提醒。",
          "actions": [
            { "type": "set_flag", "key": "ch01_hetin_warned", "value": true },
            { "type": "show_text", "text": "禾汀提醒你先檢查設備狀態，不要直接拆卸仍有反應的構件。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_acknowledge_safety",
          "description": "玩家表示會先確認現場狀態。",
          "actions": [
            { "type": "set_flag", "key": "ch01_safety_acknowledged", "value": true }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_ask_local_signs",
          "description": "玩家詢問地方安全記號。",
          "actions": [
            { "type": "show_text", "text": "居民會用歸航短線標記安全路線；這是地方知識，不代表他們知道古代設施的用途。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_observe_return_lines",
          "description": "取得非必要的地方觀察筆記。",
          "actions": [
            { "type": "give_item", "item_id": "item_return_line_note" },
            { "type": "show_text", "text": "你記下了居民使用的安全記號。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_enter_grey_bell",
          "description": "進入灰鐘台時提示調查目標。",
          "actions": [
            { "type": "show_text", "text": "目標：查明灰鐘台的局部回應來源。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_bell",
          "description": "調查無指針鐘。",
          "actions": [
            { "type": "set_flag", "key": "ch01_bell_checked", "value": true },
            { "type": "show_text", "text": "外殼與固定結構仍在，但計時機構已不能正常工作。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_arcs",
          "description": "記錄三道未封合圓弧。",
          "actions": [
            { "type": "set_flag", "key": "ch01_arc_mark_checked", "value": true },
            { "type": "give_item", "item_id": "item_arc_mark_note" },
            { "type": "add_clue", "item_id": "item_arc_mark_note" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_calibration_ring",
          "description": "檢查校準環。",
          "conditions": {
            "any": [
              { "type": "flag", "key": "ch01_bell_checked", "equals": true },
              { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_ring_checked", "value": true },
            { "type": "show_text", "text": "校準讀數仍有偏差，設備只能維持局部低功率回應。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_prepare_isolation",
          "description": "完成讀取前的隔離準備。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_ring_checked", "equals": true },
              { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_isolation_ready", "value": true },
            { "type": "show_text", "text": "隔離程序已準備完成，讀取器將限制在低功率狀態。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_enter_record_room",
          "description": "進入記錄室時提示低功率讀取原則。",
          "actions": [
            { "type": "show_text", "text": "先確認隔離狀態，再讀取設備保存的有限資料。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_read_anomaly_fragment",
          "description": "讀取異常記錄並將其加入線索簿。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
            ]
          },
          "actions": [
            { "type": "give_item", "item_id": "item_anomaly_fragment" },
            { "type": "add_clue", "item_id": "item_anomaly_fragment" },
            { "type": "set_flag", "key": "ch01_anomaly_record_found", "value": true },
            { "type": "show_text", "text": "日期與現行年表不一致。記錄有缺漏，來源仍需獨立驗證。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_check_maintenance_label",
          "description": "記錄維護標籤內容。",
          "actions": [
            { "type": "give_item", "item_id": "item_maintenance_note" },
            { "type": "add_clue", "item_id": "item_maintenance_note" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_archive",
          "description": "封存原始資料。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": true },
            { "type": "set_flag", "key": "ch01_data_shared", "value": false },
            { "type": "set_enum", "key": "record_handling", "value": "sealed" },
            { "type": "show_text", "text": "原始碎片已封存，來源和讀取條件一併保留。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_share_summary",
          "description": "分享附有不確定性註記的摘要。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": false },
            { "type": "set_flag", "key": "ch01_data_shared", "value": true },
            { "type": "set_enum", "key": "record_handling", "value": "summary_shared" },
            { "type": "show_text", "text": "摘要已標明資料缺漏與待驗證項目，尚未把推測當成定論。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_choose_location_only",
          "description": "只記錄異常記錄的位置，暫不複製原件。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
            ]
          },
          "actions": [
            { "type": "set_flag", "key": "ch01_data_archived", "value": false },
            { "type": "set_flag", "key": "ch01_data_shared", "value": false },
            { "type": "set_enum", "key": "record_handling", "value": "location_only" },
            { "type": "show_text", "text": "你只記下位置，保留已觀察到的線索摘要，稍後可再讀取或尋找獨立來源。" }
          ],
          "once": true
        },
        {
          "id": "evt_ch01_end",
          "description": "完成第一章。",
          "conditions": {
            "all": [
              { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true },
              { "any": [
                { "type": "state_value", "key": "record_handling", "equals": "sealed" },
                { "type": "state_value", "key": "record_handling", "equals": "summary_shared" },
                { "type": "state_value", "key": "record_handling", "equals": "location_only" }
              ] }
            ]
          },
          "actions": [
            { "type": "complete_quest", "quest_id": "quest_ch01_tide_investigation" },
            { "type": "set_flag", "key": "chapter_01_complete", "value": true },
            { "type": "end_chapter", "chapter": 1, "completion_flag": "chapter_01_complete" },
            { "type": "show_text", "text": "第一章完成。下一步是尋找獨立來源，比對這份記錄的日期。" }
          ],
          "once": true
        }
      ]
    }

### 10.6 items.json

    {
      "schema_version": "1.0.0",
      "items": [
        {
          "id": "item_anomaly_fragment",
          "name": "異常記錄碎片",
          "item_type": "clue",
          "description": "一段不完整的設備記錄。日期與現行年表不一致，但來源、欄位和校準資訊仍有缺漏。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_arc_mark_note",
          "name": "三道圓弧觀察筆記",
          "item_type": "note",
          "description": "相似的三道未封合圓弧出現在灰鐘台的不同構件上。其完整用途尚未確認。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_maintenance_note",
          "name": "維護標籤摘錄",
          "item_type": "note",
          "description": "維護標籤保留部分檢查程序，卻不足以獨立還原故障原因。",
          "is_clue": true,
          "icon_asset_id": "asset_icon_clue",
          "stackable": false
        },
        {
          "id": "item_return_line_note",
          "name": "歸航短線觀察",
          "item_type": "note",
          "description": "當代居民用刻線標示安全路線。這些記號屬於地方生活知識，不等同於古代界文。",
          "is_clue": false,
          "icon_asset_id": "asset_icon_note",
          "stackable": false
        }
      ]
    }

### 10.7 quests.json

    {
      "schema_version": "1.0.0",
      "quests": [
        {
          "id": "quest_ch01_tide_investigation",
          "title": "核對沿岸測量",
          "chapter": 1,
          "description": "從潮痕灘的異常讀數開始，檢查灰鐘台並取得可供後續驗證的記錄。",
          "objectives": [
            {
              "id": "obj_ch01_measurement",
              "text": "檢查潮位測量牌並記下異常讀數。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_tide_marker_checked", "equals": true }
                ]
              }
            },
            {
              "id": "obj_ch01_safety",
              "text": "聽取禾汀的安全提醒。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_hetin_warned", "equals": true }
                ]
              }
            },
            {
              "id": "obj_ch01_record",
              "text": "在下層記錄室取得異常記錄碎片。",
              "completion_conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              }
            }
          ],
          "start_event_ids": [],
          "completion_event_ids": [],
          "optional": false
        },
        {
          "id": "quest_ch01_find_shore_note",
          "title": "找回岸標記錄",
          "chapter": 1,
          "description": "可選地整理一份與地方安全路線有關的舊記錄。",
          "objectives": [
            {
              "id": "obj_ch01_shore_note",
              "text": "查看歸航短線並記下地方路線資訊。",
              "completion_conditions": {
                "all": [
                  { "type": "item_owned", "key": "item_return_line_note", "equals": true }
                ]
              }
            }
          ],
          "start_event_ids": [],
          "completion_event_ids": [],
          "optional": true
        }
      ]
    }

### 10.8 assets.json

    {
      "schema_version": "1.0.0",
      "assets": [
        {
          "id": "asset_bg_ch01_tide_mark",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_tide_mark.webp",
          "format": "webp",
          "alt": "靜潮海岸的低潮灘、潮位測量牌與遠方灰鐘台。",
          "usage": "第一章潮痕灘主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_bg_ch01_grey_bell",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_grey_bell.webp",
          "format": "webp",
          "alt": "風蝕的古代觀測站、無指針鐘與局部界文構件。",
          "usage": "第一章灰鐘台主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_bg_ch01_record_room",
          "kind": "image",
          "path": "assets/art/backgrounds/bg_ch01_record_room.webp",
          "format": "webp",
          "alt": "灰鐘台下層記錄室中的記錄支架與低功率讀取器。",
          "usage": "第一章下層記錄室主背景。",
          "required": true,
          "fallback": null
        },
        {
          "id": "asset_portrait_hetin",
          "kind": "image",
          "path": "assets/art/characters/char_hetin_base.webp",
          "format": "webp",
          "alt": "熟悉靜潮海岸潮況與安全路線的沿岸居民禾汀。",
          "usage": "禾汀對話立繪。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_echo_panel",
          "kind": "image",
          "path": "assets/art/characters/char_greybell_echo_panel.webp",
          "format": "webp",
          "alt": "古代設備局部面板與不完整的低功率讀取指示。",
          "usage": "殘響訊息或設備特寫。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_icon_clue",
          "kind": "image",
          "path": "assets/art/ui/ui_clue_icon.svg",
          "format": "svg",
          "alt": "線索簿圖示。",
          "usage": "線索條目圖示。",
          "required": false,
          "fallback": null
        },
        {
          "id": "asset_icon_note",
          "kind": "image",
          "path": "assets/art/ui/ui_note_icon.svg",
          "format": "svg",
          "alt": "觀察筆記圖示。",
          "usage": "一般筆記圖示。",
          "required": false,
          "fallback": "asset_icon_clue"
        },
        {
          "id": "asset_amb_coast",
          "kind": "audio",
          "path": "assets/audio/ambient/amb_coast_loop.ogg",
          "format": "ogg",
          "usage": "海岸環境音，屬可選裝飾，不得作為必要線索。",
          "required": false,
          "fallback": null
        }
      ]
    }

### 10.9 scenes.json

    {
      "schema_version": "1.0.0",
      "scenes": [
        {
          "id": "ch01_tide_mark",
          "title": "潮痕灘",
          "chapter": 1,
          "region": "靜潮海岸",
          "summary": "低潮剛退，測量牌的讀數與當日潮況有一處無法解釋的差異。",
          "background_asset_id": "asset_bg_ch01_tide_mark",
          "hotspots": [
            {
              "id": "tide_marker",
              "label": "檢查潮位測量牌",
              "description": "讀數與當日潮況不完全吻合。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_tide_marker"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_tide_marker_checked"
            },
            {
              "id": "hetin_talk",
              "label": "與禾汀交談",
              "description": "禾汀提醒你留意灰鐘台附近的安全標記。",
              "type": "talk",
              "dialogue_id": "dlg_hetin_shore_warning",
              "event_ids": ["evt_ch01_hetin_warning"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_hetin_warned"
            },
            {
              "id": "return_lines",
              "label": "查看歸航短線",
              "description": "居民使用的安全記號。",
              "type": "inspect",
              "event_ids": ["evt_ch01_observe_return_lines"],
              "item_reward_ids": [],
              "once": true
            }
          ],
          "exits": [
            {
              "id": "exit_to_grey_bell",
              "label": "前往灰鐘台",
              "destination_scene_id": "ch01_grey_bell",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_tide_marker_checked", "equals": true },
                  { "type": "flag", "key": "ch01_hetin_warned", "equals": true }
                ]
              },
              "locked_message": "先核對測量牌，並聽取禾汀的安全提醒。",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_hetin"],
          "on_enter_event_ids": ["evt_ch01_enter_tide_mark"]
        },
        {
          "id": "ch01_grey_bell",
          "title": "灰鐘台",
          "chapter": 1,
          "region": "靜潮海岸",
          "summary": "風蝕的觀測站仍有局部低功率回應。",
          "background_asset_id": "asset_bg_ch01_grey_bell",
          "hotspots": [
            {
              "id": "bell_shell",
              "label": "檢查無指針鐘",
              "description": "外殼仍在，但計時機構已不能正常工作。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_bell"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_bell_checked"
            },
            {
              "id": "arc_inscription",
              "label": "查看三道圓弧",
              "description": "三道未封合圓弧在不同構件上反覆出現。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_arcs"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_arc_mark_checked"
            },
            {
              "id": "calibration_ring",
              "label": "檢查校準環",
              "description": "校準環只有局部反應，讀數仍有偏差。",
              "type": "inspect",
              "conditions": {
                "any": [
                  { "type": "flag", "key": "ch01_bell_checked", "equals": true },
                  { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_check_calibration_ring"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_ring_checked"
            },
            {
              "id": "isolation_panel",
              "label": "準備隔離程序",
              "description": "將讀取器限制在低功率狀態。",
              "type": "interact",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_ring_checked", "equals": true },
                  { "type": "flag", "key": "ch01_arc_mark_checked", "equals": true }
                ]
              },
              "event_ids": ["evt_ch01_prepare_isolation"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_isolation_ready"
            }
          ],
          "exits": [
            {
              "id": "exit_to_tide_mark",
              "label": "返回潮痕灘",
              "destination_scene_id": "ch01_tide_mark",
              "event_ids": []
            },
            {
              "id": "exit_to_record_room",
              "label": "進入下層記錄室",
              "destination_scene_id": "ch01_record_room",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
                ]
              },
              "locked_message": "先完成校準檢查與隔離程序。",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_greybell_echo"],
          "on_enter_event_ids": ["evt_ch01_enter_grey_bell"]
        },
        {
          "id": "ch01_record_room",
          "title": "下層記錄室",
          "chapter": 1,
          "region": "靜潮海岸／灰鐘台下層",
          "summary": "記錄器保存一段缺欄殘響，日期與現行年表不一致。",
          "background_asset_id": "asset_bg_ch01_record_room",
          "hotspots": [
            {
              "id": "record_reader",
              "label": "以低功率讀取記錄",
              "description": "讀取器只還原出日期、缺失欄位與中斷的校準提示。",
              "type": "interact",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_isolation_ready", "equals": true }
                ]
              },
              "dialogue_id": "dlg_echo_fragment_notice",
              "event_ids": ["evt_ch01_read_anomaly_fragment"],
              "item_reward_ids": [],
              "once": true,
              "completed_flag": "ch01_anomaly_record_found"
            },
            {
              "id": "maintenance_label",
              "label": "查看維護標籤",
              "description": "標籤保留了部分檢查程序。",
              "type": "inspect",
              "event_ids": ["evt_ch01_check_maintenance_label"],
              "item_reward_ids": [],
              "once": true
            },
            {
              "id": "data_choice",
              "label": "決定如何處理記錄",
              "description": "選擇封存原始資料或分享附有缺漏註記的摘要。",
              "type": "talk",
              "conditions": {
                "all": [
                  { "type": "flag", "key": "ch01_anomaly_record_found", "equals": true }
                ]
              },
              "dialogue_id": "dlg_ch01_data_choice",
              "event_ids": [],
              "item_reward_ids": [],
              "once": false
            }
          ],
          "exits": [
            {
              "id": "exit_to_grey_bell",
              "label": "返回灰鐘台",
              "destination_scene_id": "ch01_grey_bell",
              "event_ids": []
            }
          ],
          "character_ids": ["char_player", "char_greybell_echo", "char_hetin"],
          "on_enter_event_ids": ["evt_ch01_enter_record_room"]
        }
      ]
    }

### 10.10 跨檔案一致性提醒

測試資料是格式與引用的基準範例，不是最終完整劇情。製作人員需留意以下實作約定：

1. 任務由 evt_ch01_enter_tide_mark 啟動。引擎應確保初次進入場景時先載入任務定義，再執行事件。
2. 場景切換時，on_enter_event_ids 只在事件 once 規則允許時執行；返回場景不應重複發放線索。
3. 熱點 item_reward_ids 是直接獎勵；若事件內已使用 give_item，不要再在熱點重複給予同一道具。
4. 對話選項 event_ids 的執行順序是由左至右；封存或分享選擇先執行，然後才執行章節完成事件。
5. 選擇處理方式前必須已取得 item_anomaly_fragment。
6. 第一章的可選觀察不影響出口條件。
7. 如果後續實作要在第一章末加入瑟嵐聯絡訊息，新增對話或事件前先登錄 ID，並確認不會提前揭露空白年的答案。

---

## 11. 驗證規則與常見錯誤總表

每次 AI 產生或修改資料後，至少執行以下檢查：

### 11.1 語法檢查

- 八份檔案都能由標準 JSON parser 解析。
- 不含註解、尾隨逗號、單引號字串、undefined、函式或其他非 JSON 語法。
- 根物件包含正確的 schema_version 和資料陣列／物件。
- 必填欄位存在且型別正確。

### 11.2 ID 與引用檢查

- 每個類型內 ID 不重複。
- game.start_scene_id 存在於 scenes。
- game.initial_quest_ids 存在於 quests。
- scene.background_asset_id 存在於 assets 且為 image。
- scene.character_ids 存在於 characters。
- scene.on_enter_event_ids、hotspot.event_ids、exit.event_ids 存在於 events。
- hotspot.dialogue_id 存在於 dialogues。
- hotspot.item_reward_ids、event 的 give_item/add_clue item_id 存在於 items。
- dialogue.speaker_id 存在於 characters。
- dialogue choice event_ids 存在於 events。
- event 的 quest_id、item_id 存在於相應資料。
- quest 的 start_event_ids、completion_event_ids 存在於 events。
- item.icon_asset_id 與 character.portrait_asset_id 存在於 assets，或依欄位規則為 null。
- assets.fallback 非 null 時，目標資產存在且類型相容。

### 11.3 場景圖檢查

- 每個 destination_scene_id 都存在。
- 第一章主線至少可由 start_scene_id 走到 ch01_record_room。
- 從灰鐘台可返回潮痕灘，從記錄室可返回灰鐘台。
- 未達條件的出口顯示鎖定提示，而不是消失且沒有解釋。
- 不得要求玩家完成可選任務才能完成第一章。
- 所有必要線索都能以文字取得，圖片或音訊失敗不會阻止通關。

### 11.4 事件與任務檢查

- 所有事件動作都在白名單內。
- flag 的 value 必須為 boolean。
- item_owned、quest_status、scene_visited 等條件引用正確資料類型。
- once=true 的事件不會重複給予物品或重複結束章節。
- 每個主線任務都有明確可達成的完成路徑。
- 重大選擇的旗標彼此一致；互斥選擇應明確將另一個旗標設為 false。
- 事件不允許玩家以尚未讀取異常記錄的狀態直接完成第一章。

### 11.5 資源檢查

- 每一個 required=true 資產都必須在倉庫存在。
- path 是相對路徑，沒有 URL、磁碟絕對路徑或 ..。
- path 大小寫與檔名一致。
- format 與副檔名一致。
- optional 資產缺失時使用文字、CSS 或其他低成本備援，不得令遊戲崩潰。

---

## 12. 建議的最小驗證流程

第一階段不需要複雜工具鏈。AI 或協作者應依下列順序檢查：

1. 對八份 JSON 執行標準 JSON 語法解析。
2. 檢查根欄位、必填欄位與型別。
3. 建立各類型 ID 集合，檢查重複 ID。
4. 逐一檢查所有跨檔案引用。
5. 檢查 assets.json 的實體路徑是否存在。
6. 從 ch01_tide_mark 模擬事件與旗標流程，確認能抵達 ch01_record_room。
7. 測試兩種資料處理選項都能完成第一章，且只有對應旗標不同。
8. 測試重訪場景不會重複給予道具。
9. 測試缺圖、靜音、重新整理和窄螢幕時，文字流程仍然可用。

若發現錯誤，應回報「檔名、ID、錯誤欄位、預期值、實際值、受影響引用」；不要只回報「JSON 有問題」。

---

## 13. AI 協作修改規則

每次新增或修改 JSON，AI 必須：

1. 先讀取本文件和相關的世界觀、劇情、角色、場景文件。
2. 先確認 ID 是否已存在，優先重用既有定義，不創造近似重複項目。
3. 只修改必要的檔案，不要為了方便而整批改名。
4. 如果新增 ID，列出新增項目和所有引用它的檔案。
5. 如果移除 ID，先找出所有引用並同步處理；不可留下孤立引用。
6. 若更改場景出口、任務條件、章節旗標或角色資訊，說明對劇情和存檔的影響。
7. 先通過語法與引用檢查，再宣稱資料完成。
8. 若資產尚未生成，標記為缺少的預期資產，不得聲稱檔案已存在。
9. 不把未來章節規劃誤當成已完成內容。
10. 將本文件視為正式契約；任何新增欄位、動作類型或條件運算子都必須先更新 schema 文件。

---

## 14. 本版明確不包含的功能

為維持零預算與第一章可完成性，v1.0.0 不定義以下資料：

- 戰鬥、傷害、技能樹、裝備數值或角色等級。
- 合成、商店經濟、消耗品和背包容量。
- 即時 AI 對話或遊戲運行時外部 API。
- 多人連線、帳號、雲端存檔或伺服器狀態。
- 複雜動畫時間軸、影片播放條件或語音辨識。
- 任意 JavaScript 腳本、可執行公式或動態載入未知程式碼。
- 尚未在劇情文件定案的章節角色、分支與結局資料。

若未來確有需要，應建立新版本並評估向後相容性，不可直接把未定義內容塞進現有欄位。

---

## 15. 第一章資料驗收清單

- [ ] 八份 JSON 均可由標準 JSON parser 解析。
- [ ] 所有 ID 唯一，所有跨檔案引用都能找到目標。
- [ ] game.json 的起始場景為 ch01_tide_mark。
- [ ] 三個第一章場景 ID 與 05_SCENE_CATALOG.md 一致。
- [ ] 場景出口都指向存在的場景。
- [ ] 角色、對話、事件、道具、任務與資產引用有效。
- [ ] 測量牌與禾汀提醒都完成後，才能從潮痕灘前往灰鐘台。
- [ ] 灰鐘台隔離程序完成後，才能進入下層記錄室。
- [ ] 讀取異常記錄後，線索簿出現異常記錄碎片。
- [ ] 封存和分享兩種選擇都能完成第一章。
- [ ] 可選歸航短線觀察不會阻擋主線。
- [ ] 返回場景不會重複給予同一道具或重複結束章節。
- [ ] required 資產存在，optional 資產缺失時有備援。
- [ ] 靜音、缺圖和手機觸控情況下，主線仍可完成。

**版本結論：** 06_JSON_SCHEMA.md v1.0.0 定義八份核心 JSON 的資料契約、跨檔案引用規則、事件條件白名單、常見錯誤和第一章整合測試資料。它可作為後續資料生成與驗證器開發的基準；實際遊戲仍須以程式載入、解析和逐流程測試後才能宣告可玩。

---

## 11. 第一章一致性修訂契約 v1.1（2026-10-22）

本節是第一章選擇、旗標、線索與測試的規範性補充；若本文件較早的示例片段仍有不同名稱，應依本節修正後再建立正式資料檔。下列內容是資料契約，不代表 `data/*.json` 已建立或已通過 JSON 解析。

### 11.1 三種資料處理選擇

`record_handling` 型別為字串列舉，必填於第一章完成狀態，合法值只有 `sealed`、`summary_shared`、`location_only`。

| 選項 ID | 顯示選項 | 寫入值 | 事件 ID | 立即回應與規則 |
|---|---|---|---|---|
| `choice_ch01_archive` | 封存原始碎片，暫不分享 | `sealed` | `evt_ch01_choose_archive` | 說明保留原件與來源可追溯性；保留兩條線索 |
| `choice_ch01_share_summary` | 分享經過標註的摘要 | `summary_shared` | `evt_ch01_choose_share_summary` | 說明摘要有缺漏；禾汀可補充地方背景但不替資料背書 |
| `choice_ch01_location_only` | 只記下位置，暫不複製 | `location_only` | `evt_ch01_choose_location_only` | 說明暫不複製；保留已觀察事實、位置及查證方向 |

每個事件都必須要求 `ch01_anomaly_record_found=true`，設定同一個 `record_handling` 欄位，並只顯示符合說話者知識範圍的回應。三者都保留 CL-05／CL-06，不可清除線索、鎖死主線或阻止章節完成。玩家重複提交相同選擇不得重複發放物品。

### 11.2 第一章唯一旗標表

| 旗標 ID | 型別／意義 | 設定來源 | 讀取位置 | 存檔 | 驗收測試 ID |
|---|---|---|---|---|---|
| `ch01_tide_marker_checked` | boolean；測量牌已調查 | `evt_ch01_check_tide_marker` | `exit_to_grey_bell`、主線任務 | 是 | `QA-CH01-01` |
| `ch01_hetin_warned` | boolean；已聽禾汀安全提醒 | `evt_ch01_hetin_warning` | `exit_to_grey_bell`、主線任務 | 是 | `QA-CH01-01` |
| `ch01_bell_checked` | boolean；無指針鐘已調查 | `evt_ch01_check_bell` | 校準環前置條件 | 是 | `QA-CH01-02` |
| `ch01_arc_mark_checked` | boolean；三道圓弧已調查 | `evt_ch01_check_arcs` | 校準環／隔離前置條件 | 是 | `QA-CH01-02` |
| `ch01_ring_checked` | boolean；校準環已調查 | `evt_ch01_check_calibration_ring` | 隔離面板前置條件 | 是 | `QA-CH01-02` |
| `ch01_isolation_ready` | boolean；已確認隔離 | `evt_ch01_prepare_isolation` | 記錄室出口、讀取事件 | 是 | `QA-CH01-03` |
| `ch01_reader_inspected` | boolean；讀取器已檢查 | `evt_ch01_inspect_reader` | 低功率讀取事件 | 是 | `QA-CH01-04` |
| `ch01_archive_slots_checked` | boolean；封存槽已檢查 | `evt_ch01_check_archive_slots` | 低功率讀取事件 | 是 | `QA-CH01-04` |
| `ch01_maintenance_marks_checked` | boolean；維護刻痕已檢查 | `evt_ch01_check_maintenance_marks` | 低功率讀取事件 | 是 | `QA-CH01-04` |
| `ch01_anomaly_record_found` | boolean；異常記錄已讀取並入簿 | `evt_ch01_read_anomaly_fragment` | 三個選擇事件、任務、`evt_ch01_end` | 是 | `QA-CH01-05` |
| `record_handling` | enum；`sealed`／`summary_shared`／`location_only` | 三個選擇事件之一 | `evt_ch01_end`、章末回應 | 是 | `QA-CH01-06A/B/C` |
| `chapter_01_complete` | boolean；第一章完成 | `evt_ch01_end`，僅在記錄已取得且選擇有效時設定 | 章末 UI、後續章節入口 | 是 | `QA-CH01-07` |

`visitedScenes` 另以場景 ID 集合保存，不以重複布林旗標取代。不得再使用 `ch01_anomaly_read` 表示同一狀態。

### 11.3 必要事件定義清單

下列事件 ID 是第一章正式契約；每一個都必須在 `events.json` 中有唯一定義，且只使用本文件已列出的白名單動作：

- `evt_ch01_check_tide_marker`：設定 `ch01_tide_marker_checked=true`。
- `evt_ch01_hetin_warning`：設定 `ch01_hetin_warned=true`。
- `evt_ch01_check_bell`：設定 `ch01_bell_checked=true`。
- `evt_ch01_check_arcs`：設定 `ch01_arc_mark_checked=true`。
- `evt_ch01_check_calibration_ring`：要求 `ch01_bell_checked` 或 `ch01_arc_mark_checked` 至少一項為 true，然後設定 `ch01_ring_checked=true`。
- `evt_ch01_prepare_isolation`：要求 `ch01_ring_checked=true` 及 `ch01_arc_mark_checked=true`，然後設定 `ch01_isolation_ready=true`。
- `evt_ch01_inspect_reader`：設定 `ch01_reader_inspected=true`。
- `evt_ch01_check_archive_slots`：設定 `ch01_archive_slots_checked=true`。
- `evt_ch01_check_maintenance_marks`：設定 `ch01_maintenance_marks_checked=true`。
- `evt_ch01_read_anomaly_fragment`：必須同時驗證 `ch01_reader_inspected`、`ch01_archive_slots_checked`、`ch01_maintenance_marks_checked`、`ch01_isolation_ready` 全為 true；只發放一次 `item_anomaly_fragment`，解鎖 CL-05 與 CL-06，設定 `ch01_anomaly_record_found=true`。
- `evt_ch01_choose_archive`：驗證記錄已取得，寫入 `record_handling="sealed"`。
- `evt_ch01_choose_share_summary`：驗證記錄已取得，寫入 `record_handling="summary_shared"`。
- `evt_ch01_choose_location_only`：驗證記錄已取得，寫入 `record_handling="location_only"`。
- `evt_ch01_end`：只有在記錄已取得且 `record_handling` 為三個合法值之一時，設定 `chapter_01_complete=true`。

所有一次性事件必須冪等；重複調查或讀取只顯示已記錄回饋，不重複發放道具或線索。

### 11.4 CL-05／CL-06 與 `item_anomaly_fragment` 映射

- `item_anomaly_fragment` 是唯一的第一章記錄碎片／來源項目。
- CL-05「殘響資料不完整」與 CL-06「異常日期」是兩個不同的線索 ID，從同一次成功的 `evt_ch01_read_anomaly_fragment` 解鎖。
- `items.json`／線索簿資料應以穩定 clue ID 儲存 CL-05、CL-06；不可把同一物品重複當作兩份獎勵。
- 存檔必須保存已取得物品與線索 ID；重新載入後兩條線索各出現一次。
- 本契約未確認正式 JSON 檔案存在；實作時需依此契約建立並驗證。

### 11.5 第一章驗收案例

| 測試 ID | 操作 | 通過條件 |
|---|---|---|
| `QA-CH01-01` | 嘗試在缺少任一潮痕灘必要條件時離開 | 出口不開放，缺少條件有提示；兩項完成後出口開放 |
| `QA-CH01-02` | 調查灰鐘台必要構件並準備隔離 | 每項旗標由對應事件設定；錯誤順序不永久鎖死 |
| `QA-CH01-03` | 未啟用隔離便嘗試進入／讀取 | 讀取不執行；提示先完成隔離 |
| `QA-CH01-04` | 逐一漏做讀取器、封存槽、維護刻痕其中一項後嘗試讀取 | 每次都被拒絕；只有四項條件全 true 才可讀取 |
| `QA-CH01-05` | 成功讀取，再重複點擊 | 只取得一個記錄碎片；CL-05、CL-06 各一條；旗標為 true |
| `QA-CH01-06A` | 選擇封存原件 | `record_handling=sealed` 且可完成章節 |
| `QA-CH01-06B` | 選擇分享摘要 | `record_handling=summary_shared` 且可完成章節 |
| `QA-CH01-06C` | 選擇只記位置 | `record_handling=location_only` 且可完成章節 |
| `QA-CH01-07` | 選擇後觸發章末事件 | `chapter_01_complete=true`；顯示第二份獨立年代證據的查證方向 |
| `QA-CH01-08` | 刷新頁面或載入有效存檔 | 場景、旗標、線索、選擇和章節完成狀態恢復一致 |
| `QA-CH01-09` | 存檔損壞／localStorage 寫入失敗／清除存檔 | 不白屏、不默默覆蓋有效資料；寫入失敗有警告；清除前有確認 |

### 11.6 存檔與列舉狀態的儲存

- `record_handling` 是列舉狀態，不是布林旗標，不得放入只接受布林值的 `flags`。
- 存檔物件必須有 `storyValues` 物件，並將選擇保存在 `storyValues.record_handling`；有效值僅為 `sealed`、`summary_shared`、`location_only`。新遊戲或尚未選擇時可省略該值；第一章完成前必須已設定。
- `set_enum` 只允許寫入 schema 已列出的列舉欄位和值；未知欄位或非法值必須拒絕，不可默默轉成其他選項。
- `state_value` 條件只讀取列舉狀態；`evt_ch01_end` 必須同時確認記錄旗標為 true，且 `storyValues.record_handling` 是三個合法值之一。

### 11.7 資產引用規則補充

遊戲資料只填寫 `asset_*` 資產 ID；完整相對路徑只由 `data/assets.json` 的 `path` 欄位提供。規格文件中的檔名可作簡稱，但必須標示為簡稱。索引中的預定資產不代表實體檔案已存在、已獲授權或已完成載入驗收。
