# LINE Bot 訂便當/點餐服務 免費部署與設定教學指南

本指南詳細說明如何使用 **100% 免費** 的服務方案，建立並部署結合 **Google Apps Script (GAS)** 與 **Google Sheets (試算表)** 的 LINE 群組訂便當機器人。

---

## 零成本架構說明 (Free Tier)
1. **LINE Official Account (免費方案)**：
   - 每月提供 200 則免費主動推播 (Push Message)。
   - **關鍵優勢**：所有回應使用者的訊息 (`replyMessage` 配合 `replyToken`) 是 **完全免費且無限量** 的！本專案採用 100% 回覆機制，完全不會消耗推播額度，零成本運作。
2. **Google Apps Script & Google Sheets**：
   - 無需承租任何伺服器或雲端主機 (No VPS / No Heroku / No AWS)。
   - 每日免費支援 20,000 次網路呼叫與 90 分鐘觸發時間，完全滿足中小團隊日常點餐需求。

---

## 第一部分：申請與設定 LINE Developers (免費 Messaging API)

### 💡 找不到「Messaging API」標籤頁的快速排查 (UI 更新說明)
如果您在畫面上找不到「Messaging API 標籤頁」或「Channel access token」，通常是以下三種情況之一：
1. **尚未點進 Channel 內部**：剛登入 LINE Developers Console 時是 Provider 列表，您必須先點選左側或中央的 **Provider 名稱**，接著**點擊進入您的 Channel（點擊該圖示或名稱）**，進入後頁面最上方才會出現 `Basic settings`、`Messaging API`、`Roles` 等橫排分頁！
2. **建立錯 Channel 類型**：如果不小心建成了「LINE Login」頻道，上方只會有 LINE Login 分頁而**不會有** Messaging API 分頁。請確認 Channel 類型為 `Messaging API`。
3. **最新改版替代路徑 (最不易出錯)**：LINE 現已支援從 [LINE Official Account Manager](https://manager.line.biz/) 直接啟用，詳見下方 **【路徑 A】**。

---

### 【推薦：路徑 A】從 LINE Official Account Manager 直接啟用（最簡單直覺）
1. 前往 [LINE Official Account Manager](https://manager.line.biz/)，登入您的 LINE 帳號。
2. 建立或點選您的官方帳號。
3. 點擊右上角的 **「設定 (Settings)」**。
4. 點選左側選單中的 **「Messaging API」**。
5. 點擊畫面中央的綠色按鈕 **「啟用 Messaging API」**。
6. 輸入或選擇您的 Provider（提供者名稱，例如您的團隊或專案名稱），點擊確定同意。
7. 啟用後，此頁面會顯示 Channel ID 與 Channel Secret，並會提供一個 **「前往 LINE Developers」** 的按鈕，點擊後會**直接帶您進入該頻道的 Messaging API 設定頁**！

---

### 【路徑 B】從 LINE Developers Console 操作步驟

#### 步驟 1：登入 LINE Developers Console
1. 前往 [LINE Developers Console](https://developers.line.biz/)。
2. 點擊右上角 **Log in**，使用個人 LINE 帳號登入。

#### 步驟 2：進入 Provider 與建立 Channel
1. 點擊左側已存在的 **Provider**（若無則點擊 `Create a new provider` 建立）。
2. 在該 Provider 頁面下，確認點擊的是 **Create a Messaging API channel**（請勿點選 LINE Login）。
3. 填寫頻道名稱、說明、分類、Email，勾選同意條款後按 **Create** 建立。

#### 步驟 3：進入 Channel 取得憑證金鑰 (關鍵位置圖解)
建立完成後，請**務必點進該 Channel 頁面**，此時頁面上方會顯示水平橫排分頁：
1. **取得 Channel Secret**：
   - 點選上方第一個標籤 **`Basic settings`**。
   - 向下滾動找到 **Channel secret** 欄位，複製此 32 位元字串備用。
2. **取得 Channel Access Token**：
   - 點選上方第二個標籤 **`Messaging API`**。
   - 向下滑動到頁面最底部，找到 **Channel access token**（或 `Channel access token (long-lived)`）。
   - 點擊右側的 **「Issue」（發行）** 按鈕。
   - 系統即會生成一串長效存取權杖（Token），點擊旁邊的複製按鈕妥善保存。

#### 步驟 4：設定官方帳號重要功能 (極關鍵！)
在同一個 **`Messaging API`** 分頁中：
1. 找到 **Webhook settings** 區塊：
   - 稍後貼入 Google Apps Script 產生的網址，並將 **Use webhook** 切換為開啟。
2. 找到 **LINE Official Account features** 區塊，點選 **Edit** 開啟後台設定：
   - **回應模式**：選擇 **Bot (聊天機器人)**。
   - **自動回應訊息 (Auto-response)**：務必切換為 **停用 (Disabled)**（避免每次群組成員點餐跳出官方罐頭回覆）。
   - **Webhooks**：切換為 **啟用 (Enabled)**。
   - **加入聊天室 (Chat room and group chats)**：勾選 **允許加入群組與多人聊天室 (Allow)**。

---

## 第二部分：設定 Google 試算表與 Google Apps Script (GAS)

### 步驟 1：建立 Google 試算表與設定時區
1. 打開 [Google Drive](https://drive.google.com/)，新增一個 Google 試算表，命名為 `便當點餐資料庫`。
2. **設定試算表檔案時區（重要）**：
   - 點選上方選單 **「檔案」 ➡️ 「設定」 (Settings)**。
   - 確認「地區設定」為 **台灣**，且「時區」設定為 **`(GMT+08:00) 台北時間`**。
   - 點擊「儲存並載入」。
   > 💡 系統程式碼會**直接動態讀取此試算表設定之時區**（已全面移除 hardcode 寫死的時區），以確保訂餐截止時間、每日換日與點餐紀錄時間戳記 100% 精確對齊！
3. 試算表將由程式首次執行自動初始化產生 5 個工作表（管理員亦可直接編輯）：
   - `Config`：系統全域設定（開單狀態、今日店家、截止時間、收據顯示範圍等）。
   - `WeeklySchedule`：**週一至週五梯次排程表**（星期、當日店家、截止時間、Uber Eats 網址、備註、啟用狀態）。
   - `Menu`：菜單清單（星期、店家名稱、分類、品項名稱、價格、供應狀態、描述）。
    - `Orders`：點餐流水帳（OrderId、Timestamp、Date、DayOfWeek、GroupId、UserId、UserName、UserNickname 當時暱稱、ItemName、Quantity、Price、Subtotal、Status、Paid）。
    - `Summary`：即時與全週梯次統計匯總（各日小計、總金額、成員應付清單）。

#### 💡 `Config` 系統設定參數說明
管理員可隨時於 `Config` 工作表直接調整參數值：

| 參數名稱 (Key) | 預設值 (Value) | 說明與可選值 |
| :--- | :--- | :--- |
| `ORGANIZER_ID` | *(留空)* | **發起開單人 LINE User ID**：設定後，群組中任何成員於週一至週五梯次的加訂或取消餐點，機器人均會自動發送 LINE 即時私訊通知給開單人。<br>• 於群組輸入「`開單 [店家] [時間]`」時會自動記錄發起者 ID；亦可由管理員直接於試算表手動填寫。 |
| `ORGANIZER_NAME` | `小幫手` | 發起開單人姓名或顯示名稱。 |
| `CLOSE_ORDER_SCOPE` | `WEEKLY` | **結單結算範圍模式**：決定輸入「結單」或點擊結單按鈕時結算的訂單範圍。<br>• `WEEKLY`（預設）：結算本週週一至週五梯次訂餐總表與各成員應付金額。<br>• `DAILY`：僅結算今日/當日餐點。 |
| `ORDER_RECEIPT_SCOPE` | `WEEKLY` | **點餐收據顯示範圍**：決定成員在點餐成功後，彈出的「✅ 加購成功」收據所顯示的訂單清單範圍。<br>• `WEEKLY`（預設）：顯示該成員**本週梯次所有已預約餐點**，並依週一至週五分組與小計。<br>• `DAILY`：僅顯示成員**今日（或當日）**點餐明細。 |
| `PAYMENT_LINEPAY_URL` | *(留空)* | **LINE Pay 商家收款/固定轉帳連結**：若有申請 LINE 商家或固定付款連結可填寫，結單卡片將顯示「🟢 前往 LINE Pay 轉帳」按鈕直達付款。若未填寫且設定了個人受款人資訊，將自動啟用個人錢包轉帳模式。 |
| `PAYMENT_LINEPAY_USER_NAME` | *(留空)* | **LINE Pay 個人轉帳受款人好友暱稱**：個人用戶因無固定商業 LINE Pay 網址且個人收款碼具時效性（約 5 分鐘動態刷新），建議填寫受款人之 LINE 好友暱稱（留空則自動帶入 `ORGANIZER_NAME`）。結單卡片將提供「🟢 開啟 LINE 錢包轉帳」按鈕直達 LINE 錢包 (`https://line.me/R/nv/wallet`)，並附帶提示讓成員於轉帳頁面快速搜尋並選定受款好友。 |
| `PAYMENT_LINEPAY_USER_ID` | *(留空)* | **LINE Pay 個人轉帳受款人 LINE ID**（選填）：受款人的 LINE 自訂 ID，供成員核對好友或搜尋加好友轉帳。 |
| `PAYMENT_BANK_CODE` | *(留空)* | **收款銀行代碼**（例如：`822`、`013`、`004`）。 |
| `PAYMENT_BANK_NAME` | *(留空)* | **收款銀行名稱**（例如：`中國信託`、`國泰世華`）。 |
| `PAYMENT_BANK_ACCOUNT` | *(留空)* | **收款銀行帳號**（例如：`123-456789-012`）。 |
| `PAYMENT_BANK_ACCOUNT_NAME` | *(留空)* | **收款帳戶戶名**（例如：`王大明`）。 |
| `PAYMENT_BANK_QR_URL` | *(留空)* | **銀行收款 QR Code 圖片網址**：在卡片中呈現 QR Code 圖片供掃碼轉帳。支援一般圖床或 **Google 雲端硬碟分享連結**（系統會自動轉換為直連圖檔，免擔心破圖）。點擊圖片可放大檢視。 |
| `PAYMENT_LINEPAY_QR_URL` | *(留空)* | **LINE Pay 收款碼/條碼圖片網址**：支援 Google 雲端硬碟分享連結或直接圖片網址。 |
| `IS_ORDERING_OPEN` | `false` | 今日是否開放即時點餐（`true` / `false`）。管理員亦可於群組發送「開單」或「結單」自動切換。 |
| `RESTAURANT_NAME` | `老王便當` | 今日配合店家名稱。 |
| `CUTOFF_TIME` | `11:00` | 今日點餐截止時間。 |

### 步驟 2：開啟 Apps Script 編輯器
1. 在試算表上方工具列，點選 **擴充功能 (Extensions) -> Apps Script**。
2. 將專案重新命名為 `LineMealOrderBot`。

### 步驟 3：貼上專案程式碼與設定專案資訊清單 (appsscript.json)
1. **貼上主程式碼**：
   - 將本專案 [`dist/Code.gs`](dist/Code.gs) 單一檔案內容完整複製貼入 Apps Script 編輯器，取代原本預設的 `myFunction`。
2. **設定專案資訊清單 (`appsscript.json`) 時區**：
   - 點擊 Apps Script 左側齒輪圖示 ⚙️ **專案設定 (Project Settings)**。
   - 勾選 **「在編輯器中顯示 appsscript.json 資訊清單檔案」** (Show "appsscript.json" manifest file in editor)。
   - 回到左側「檔案」列表，點開出現的 **`appsscript.json`**，確認或替換為專案根目錄的 [`appsscript.json`](../appsscript.json) 內容：
     ```json
     {
       "timeZone": "Asia/Taipei",
       "dependencies": {},
       "exceptionLogging": "STACKDRIVER",
       "runtimeVersion": "V8"
     }
     ```
   - 點擊上方磁碟圖示「儲存專案」。
   > 💡 確保 `appsscript.json` 與 Google 試算表時區一致均為 `Asia/Taipei`，以杜絕換日或時間解析的任何偏差。

### 步驟 4：設定指令碼屬性 (安全存放 Token)
為避免將金鑰寫死在程式碼中，請使用 Google 安全屬性庫：
1. 點擊 Apps Script 左側選單的 ⚙️ **專案設定 (Project Settings)**。
2. 滾動至下方 **指令碼屬性 (Script Properties)**，點擊 **新增指令碼屬性**：
   - 屬性名稱：`CHANNEL_ACCESS_TOKEN`，值：貼上剛才在 LINE 取得的長效存取權杖。
   - 屬性名稱：`CHANNEL_SECRET`，值：貼上剛才在 LINE 取得的 Channel Secret。
3. 點擊 **儲存指令碼屬性**。

### 步驟 5：部署為網頁應用程式 (Deploy Web App)
1. 點擊編輯器右上角的藍色按鈕 **部署 (Deploy) -> 新增部署 (New deployment)**。
2. 點擊左上角齒輪圖示，選擇 **網頁應用程式 (Web App)**。
3. 設定如下：
   - **說明 (Description)**：例如 `v1.1.0`
   - **執行身分 (Execute as)**：選擇 **我 (Me - 你的 Google 帳號)**
   - **誰可以存取 (Who has access)**：務必選擇 **所有人 (Anyone)**（LINE 伺服器才能公開呼叫 Webhook）。
4. 點擊 **部署 (Deploy)**。首次部署時，Google 會要求授權存取試算表，點選「進階 (Advanced)」並允許存取。
5. 部署完成後，複製 **網頁應用程式網址 (Web App URL)**（結尾為 `/exec`）。

---

## 第三部分：連接 LINE Webhook 與完成啟用

1. 回到 **LINE Developers Console** -> 您的 Channel -> **Messaging API** 標籤頁。
2. 找到 **Webhook settings**：
   - 將剛複製的 Google Web App URL 貼入 **Webhook URL** 欄位。
   - 點擊 **Update**。
   - 開啟 **Use webhook** 開關。
3. 點擊 **Verify** 按鈕：
   - 若出現綠色 **Success**，代表 LINE 已成功連線至您的 Google Apps Script！

---

## 第四部分：管理員 Google 試算表操作指南

當試算表開啟時，上方功能選單會自動出現 **「🍱 便當訂餐管理」**：
1. **編輯每天店家與菜單**：
   - 管理員可直接在 `WeeklySchedule` 工作表修改週一到週五的配合店家名稱與截止時間，機器人即時自動讀取生效！
   - 可在 `Menu` 工作表直接編輯、新增或刪除各店家的菜色與金額。
2. **從 Uber Eats 網址一鍵匯入**：
   - 點選選單 **「🍔 從 Uber Eats 網址匯入菜單」**。
   - 彈出視窗輸入指定星期（例如：`週一`）與店家網址（例如：`https://www.ubereats.com/tw/store/.../...`）。
   - 系統自動解析並抓取所有菜色分類與價格，自動填入 `Menu` 頁籤，並同步更新排程店家！
3. **報表更新**：
   - 點選 **「📈 重新產生本週梯次統計表」**，立即依各日訂單重算總量、總金額與每位同仁應付金額。

---

## 第五部分：群組使用指令說明

將機器人加入群組後，全體成員即可使用以下指令：

| 指令 | 說明 | 範例 |
| :--- | :--- | :--- |
| `本週菜單` | 顯示週一至週五每日店家與排程卡片 | `本週菜單` |
| `週X菜單` | 查看指定日期的店家專屬菜單 | `週一菜單`、`週三菜單` |
| `週X+1 [餐點]` | 跨日/梯次點餐（可於單則訊息預約整週餐點） | `週一 排骨飯+1, 週二 炸雞腿+1, 週四 燒臘飯+1` |
| `+1 [品項] [數量]` | 快速點餐（預設當日） | `+1 招牌排骨飯` 或 `雞腿飯+2` |
| `我的本週訂單` | 查詢自己本週週一至週五所有梯次預約明細與總額 | `我的本週訂單` |
| `我的訂單` | 查詢個人今日訂購紀錄 | `我的訂單` |
| `取消 [週幾] [品項]` | 取消指定日或今日的餐點 | `取消 週二 全部` 或 `取消 排骨飯` |
| `本週統計` / `梯次統計` | 查看週一至週五全體訂購匯總與每人應付金額清單 | `本週統計` |
| `統計` | 即時查看群組今日點餐匯總明細 | `統計` |
| `結單` / `本週結單` / `今日結單` | 截止訂餐，產出總結算表與收款方式（LINE Pay 與銀行匯款） | `結單`、`本週結單`、`今日結單` |
| `匯入菜單 [週X] [網址]` | 在群組直接透過 Uber Eats 網址匯入菜單 | `匯入菜單 週一 https://www.ubereats.com/...` |
| `幫助` | 顯示所有可用指令教學卡片 | `幫助` |

---

## 第六部分：常見問題與疑難排解 (FAQ & Troubleshooting)

### Q1：我在官方帳號管理後台 (manager.line.biz) 找不到 Channel access token？
- **原因**：LINE 將一般營運與程式開發分成兩個後台：
  1. **LINE Official Account Manager (`manager.line.biz`)**：為一般小編營運後台，只會顯示 `Channel ID`、`Channel secret` 與 Webhook 網址，最下方會標註 *「您可由 LINE Developers Console 進行其他設定」*。**這個頁面本來就沒有 Token**。
  2. **LINE Developers Console (`developers.line.biz`)**：才是供工程師與 API 串接的開發者後台，**Channel access token 唯一存在於此**。
- **解決步驟**：
  1. 取得您的 Channel ID（例如 `2011460997`）。
  2. 直接在瀏覽器開啟直達網址：`https://developers.line.biz/console/channel/{您的ChannelID}/messaging-api`。
  3. 進入頁面後確認上方標籤為 **Messaging API**，向下滑動到頁面最底部。
  4. 找到 **Channel access token**，點擊旁邊的 **「Issue」（發行）** 按鈕即可取得。

---

### Q2：點擊 LINE Developers 後台的 Webhook「Verify」按鈕出現 `302 Found` 錯誤？
- **錯誤訊息**：`The webhook returned an HTTP status code other than 200.(302 Found)`
- **原因與解決步驟**：
  1. **存取權限未設為「所有人」（最常見）**：
     - 在 Apps Script 點擊「部署」->「管理部署」-> 點擊鉛筆 ✏️ 編輯。
     - 檢查 **「誰可以存取 (Who has access)」** 是否為 **「所有人 (Anyone)」**。若選成「僅限自己」或「具有 Google 帳戶的使用者」，Google 會強制回傳 302 重定向到 Google 登入畫面，LINE 伺服器無法登入即會報錯。
  2. **Webhook 網址結尾錯誤**：
     - 正式對外網址結尾必須為 **`/exec`**，若不小心複製到測試版網址（結尾為 `/dev`），因其需要開發者登入授權，Google 一律回應 302。
  3. **修改程式碼後未建立「新版本」部署**：
     - Google Apps Script 在修改代碼後，必須在「管理部署」中將版本下拉選單切換為 **「新版本 (New version)」** 並點擊部署，線上網址才會載入新程式碼。
  4. **Verify 按鈕的轉發誤報特性（實測最準）**：
     - Google Apps Script 伺服器在架構上會使用內部 302 重新導向至 `script.googleusercontent.com`。LINE 後台的 Verify 測試按鈕由於未完整跟隨轉發，時常會出現 302 誤報。
     - **只要將「Use webhook」開關打開，直接在 LINE 聊天室發送訊息（如輸入 `幫助` 或 `菜單`），機器人能正常回應即代表串接完全成功**，無須理會 Verify 按鈕的誤報。

---

### Q3：在 Google 試算表點擊「檢查/初始化試算表結構」出現 `TypeError: getConfigProperty is not a function`？
- **原因**：早期模組變數在單檔打包時，全域宣告發生了變數提升覆蓋（Variable Hoisting Shadowing），導致 `getConfigProperty` 函式被初始化為 `null`。
- **解決步驟**：
  - 本專案已於 `v1.1.1` 加入嚴格的環境保護守衛修復此問題。
  - 請重新複製專案中的最新 [`dist/Code.gs`](dist/Code.gs) 內容，完整覆蓋貼入 Google Apps Script 編輯器，儲存後再次點擊選單初始化即可順利建立 5 大工作表。

---

### Q4：為什麼輸入「我的訂單」能正常回覆，但輸入「幫助」或「本週菜單」完全沒有反應？
- **原因**：
  1. **純文字與 Flex 卡片的機制差異**：輸入「我的訂單」時，若尚無訂餐紀錄，系統回傳的是純文字訊息 (`replyText`)。既然純文字能正常回傳，**代表您的 Webhook、Token、Google 試算表連線全部都是 100% 正常的**！
  2. **LINE Flex Message 的嚴格驗證機制**：「幫助」與「本週菜單」使用的是 LINE Flex Message 圖文互動卡片。若卡片 JSON 帶有非官方標準屬性（例如無效的 `borderStyle`、使用了 `padding` 而非標準的 `paddingAll`、或部分裝置不支援的 `size: 'giga'`），LINE 伺服器會判定格式錯誤並回傳 **`HTTP 400 Bad Request`** 退件拒發！
- **解決步驟**：
  - 本專案已於 `v1.2.0` 重構所有 Flex Message 卡片產生器，嚴格對齊 LINE 官方規範，並全面改用相容性最高的標準尺寸 `size: 'mega'`。
  - 複製最新的 [`dist/Code.gs`](dist/Code.gs) 貼入 Apps Script 編輯器，並至「管理部署」發布為「新版本」即可正常顯示所有彩色卡片。

---

### Q5：如何使用內建的診斷工具進行快速自我檢測？
本專案在 Apps Script 內建了兩大一鍵診斷工具，無須依賴 Cloud Logging：
1. **`testLineConnection`**：
   - 於 Apps Script 工具列選取此函式並按「執行」，直接連線 LINE 官方 API 驗證 Token 是否有效，並印出機器人名稱與 ID。
2. **`testHelpMessage`**：
   - 於 Apps Script 工具列選取此函式並按「執行」，在編輯器內部模擬使用者發送「幫助」訊息，即時驗證整套點餐派發邏輯。
3. **試算表 `Logs` 頁籤**：
   - 系統會將每次收到的 Webhook 訊息與 LINE API 回應狀態碼（如 200 或 400/401）自動記錄於試算表的 `Logs` 工作表，打開試算表即可直接除錯。

---

### Q6：逾期或截止餐點的修改與取消防護機制是如何運作的？
為確保開單人向餐廳叫餐後數量不受隨意更動影響，系統具備雙重鎖定防護：
1. **超過今天日期的梯次（過去日期）**：
   - 若今天為週三，則週一與週二均視為過去梯次。
   - 查詢「`我的本週訂單`」時，過去梯次會標註 `🔒[已過期]`。
   - 成員若嘗試輸入「`取消 週一 全部`」或透過按鈕選單取消，系統會直接拒絕並提示：`⚠️ 【週一】已超過日期，過去梯次的餐點無法修改或取消喔！`。
2. **超過今日截止時間的餐點（當日截止）**：
   - 當前台灣時間若已超過當日排程或 Config 設定之截止時間（或開單人已發送「`結單`」），今日訂餐自動鎖定。
   - 查詢「`我的訂單`」時會標註 `🔒[已截止]` 並顯示截止提醒。
   - 成員若嘗試取消當日餐點，系統會提示：`⚠️ 今日點餐已超過結單時間，無法修改或取消餐點囉！若需異動請洽開單人。`

---

### Q7：如何接收成員加訂與取消餐點的 LINE 即時通知？
1. 於 `Config` 工作表中的 `ORGANIZER_ID` 填入開單人的 LINE User ID（若使用群組指令「`開單 [店家] [時間]`」，系統會自動將發起者的 User ID 寫入）。
2. 設定後，群組中任何成員在週一至週五梯次進行**新增加訂**或**取消餐點**時，機器人都會透過 LINE Push API 即時私訊通知開單人，內容包含：訂餐人姓名、當前暱稱、梯次日期、異動品項、數量、金額與精確時間戳記。

---

### Q8：退訂取消權限、選單隔離與「二次確認警告」機制是如何運作的？
為了保護群組同仁的點餐資料安全，避免誤刪他人或全體訂單，系統設計了嚴格的權限隔離與防呆機制：
1. **取消選單嚴格個人隔離（任何人呼叫選單，清單一律 100% 僅顯示自己的餐點）**：
   - 於聊天室發送「`取消`」或「`取消餐點`」時，不論是一般成員還是開單人，打開的互動退訂選單**一律嚴格僅呈現呼叫者本人的個人進行中訂單，絕對不會顯示其他任何成員的餐點或姓名**，完全杜絕誤看或誤按他人訂單的可能。
   - 若發送者為開單人，卡片下方會額外提供「👑 開單人管理專區」按鈕（`⚠️ 取消全體當日餐點`、`🚨 取消全體未截止預訂`，點選後均會跳出二次確認警告卡）。開單人若欲單獨協助特定成員取消餐點，請使用專屬文字指令（例如 `取消 小鮑伯 招牌排骨飯` 或 `取消 @成員 菜名`）。
2. **手動輸入菜名之 UserName 嚴格核對**：
   - 即使一般成員未加人名、自行手動輸入他人訂購的菜名（例如小鮑伯訂了「脆皮燒肉飯」，愛麗絲手動輸入「`取消 脆皮燒肉飯`」）：
     - 系統會先比對愛麗絲自己的訂單，若愛麗絲未訂購此餐點，系統會進一步檢索群組內該菜名的訂購者。
     - 當確認該餐點屬於其他成員（`UserName` / `UserNickname` 不同），且執行者不是開單人時，系統將**直接拒絕取消並指明原訂購者**：`⚠️ 權限不足：除了開單人，不能取消其他使用者的餐點（「脆皮燒肉飯」訂購人為「小鮑伯」）。您只能取消自己訂購的餐點喔！`。
     - 若兩人恰好訂了相同品項，愛麗絲輸入取消時，系統只會精確取消愛麗絲本人的訂單，小鮑伯的餐點絲毫不受影響。
   - 一般成員若嘗試以指令指定他人名稱（例如 `取消 @小鮑伯 脆皮燒肉飯` 或 `取消 小鮑伯 脆皮燒肉飯`），亦會立即被系統權限阻擋。
3. **開單人管理權限（協助退訂他人餐點）**：
   - 開單人可使用指令 `取消 @成員 菜名`、`取消 [成員暱稱/姓名] [菜名/全部]` 或 `取消 [週幾] [成員暱稱] [菜名]`，由開單人身分協助特定成員退訂特定餐點。
4. **開單人專屬全體取消（嚴格二次確認警告卡片）**：
   - **取消當日所有餐點**（`取消當日所有餐點`、`取消全體今日`）與 **取消所有未截止預約訂單**（`取消所有未截止預約訂單`、`取消 全部`）僅限開單人可以發起。
   - 觸發時，系統**絕不會立即刪除**，而是會發送紅色高對比的 **「🚨 取消確認警告」** Flex 卡片，明確告知即將取消的梯次範圍與筆數，並附帶「⚠️ 警告：此操作將影響全體成員且無法復原！」。開單人必須再次點選「確認取消」按鈕或發送確認指令，系統才會真正執行取消；開單人亦可隨時點擊「放棄取消」完整保留訂單。

---

### Q9：「今日統計」訂餐名單匯總原理與 Apps Script 時區/時間確認方式？

#### 1. 「今日統計 / 統計」之獨立性與精確梯次隔離
- **不受 `ORDER_RECEIPT_SCOPE` 與 `CLOSE_ORDER_SCOPE` 影響**：
  - `ORDER_RECEIPT_SCOPE` 僅控制點餐完成後個人的「加購成功」收據顯示範圍（整週或今日）。
  - `CLOSE_ORDER_SCOPE` 僅控制發送「`結單`」時截止的是全週梯次還是單日。
  - **「`今日統計`」/「`統計`」指令與執行結果 100% 完全獨立**：無論設定為何、無論何時呼叫、無論是在開放點餐中或結單截止後，**「今日統計」一律永遠只會查詢屬於今日（當日梯次）的訂單資料**，絕不會受結單方式或收據模式改變查詢範圍。
- **預約梯次嚴格精確比對 (`_matchOrderTiming`)**：
  - 若成員於今日提早下單週五的餐點，此筆週五預訂在週二執行「今日統計」時**絕對不會被納入**。
  - 系統嚴格核對訂單的 `DayOfWeek` 是否符合當日星期（`todayDay`），僅在訂單未指定星期（無梯次之傳統單日訂單）時才回退比對下單日期 `Date`。
  - 提早於週一預約週二的餐點，在週二時會精確納入週二統計；而下單給其他星期的預訂則確實隔離至該星期。
- **Google Sheets 原生 Date 物件正規化**：
  - Google Sheets 的日期儲存格在 `getValues()` 讀取時為 JavaScript `Date` 物件。系統全面採用 `_formatDateValue` 轉換器，統一標準化為 `yyyy-MM-dd`。
- **完整呈現成員應付名冊與點餐內容**：
  - 今日統計卡片不僅顯示各餐點總量與訂購成員標籤（`👤 [成員1(1), 成員2(2)]`），並於下方清晰列出「`👤 今日成員應付名冊`」，詳列每位同仁姓名、今日點購的所有餐點明細與數量，以及應繳總金額。
- **LINE Flex Message 規範嚴格相容性與無死角送達**：
  - **Schema 嚴格驗證**：排查並修復 LINE Messaging API 不支援之 Box `padding: 'xxs'` 與空字串，全面採用標準 `paddingAll: 'xs'/'sm'/'lg'`、`size: 'mega'` 與安全字串轉型，杜絕 LINE 伺服器回傳 HTTP 400 Bad Request 導致訊息靜默消失。
  - **GroupId 跨來源相容與全域備援**：支援試算表後台手動輸入或一對一私聊下單（`GroupId` 為空或不一致），若指定群組查無訂單時會自動備援查詢全域當日訂單，避免統計結果誤判為無單。
  - **純文字統計備援與專屬指令**：除圖文卡片外，全面支援「`今日文字統計`」、「`今日統計文字`」、「`文字統計`」純文字指令，並在卡片因網路或權限異常時自動透過 Push API 補發純文字訂單明細，確保同仁與開單人 100% 掌握點餐對帳資料。
- **DayOfWeek 欄位動態適配與全自動容錯正規化**：
  - **欄位標題智慧識別**：系統透過動態標題對應器，自動相容 `DayOfWeek`、`day_of_week`、`Day of Week`、`星期`、`星期幾`、`梯次`、`梯次/星期`、`週幾`、`禮拜` 等各種命名方式。若舊版試算表未含星期欄位，系統預設指標為 `-1`，絕不誤讀群組 ID（`GroupId`）；且點選「`📅 檢查/初始化試算表結構`」或接收 Webhook 時，系統會自動在 `Date` 後方插入補齊 `DayOfWeek` 欄位。
  - **星期格式正規化 (`normalizeDayOfWeek`)**：儲存格內容不論是 `週一`、`星期一`、`周一`、`禮拜一`、`Mon`、`Monday` 或數字 `1`，系統均會全自動標準化為 `週一` 進行比對。
  - **短日期格式相容**：無論儲存格日期是 `2026/9/7`、`2026-9-7` 還是原生 Date 物件，一律精確規格化為 `YYYY-MM-DD`，徹底杜絕字串長度不足導致的統計落空。

#### 2. Apps Script 如何確認所在時區與當前系統時間？
Google Apps Script 執行於 Google 雲端無伺服器環境中，為避免時間計算偏差，本系統具備動態時區偵測機制：

1. **直接動態讀取 Google 試算表檔案時區（全面移除 hardcode 寫死）**：
   - 系統透過 [`getSpreadsheetTimeZone()`](../src/SheetService.js) 函式，直接呼叫 `SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()` 動態取得試算表檔案設定的時區。
   - 所有日期格式化、當前星期、訂餐截止時間比對、逾期梯次判斷，以及即時推播時間戳記，均直接依據此時區進行換算，**完全移除程式碼中 hardcode 寫死固定時區**的限制。

2. **Google 試算表本體時區設定（主要來源）**：
   - 於 Google 試算表工具列點選 **「檔案」 ➡️ 「設定」 (Settings)**。
   - 檢查「地區設定」是否為「台灣」，「時區」是否設定為 **`(GMT+08:00) 台北時間`**。
   - 點擊「儲存並載入」。

3. **專案資訊清單 (`appsscript.json`) 時區設定（次要備援）**：
   - 專案根目錄已提供標準 [`appsscript.json`](../appsscript.json)。
   - 於 Apps Script 編輯器左側齒輪「專案設定 (Project Settings)」勾選 **「在編輯器中顯示 appsscript.json 資訊清單檔案」**。
   - 切換至左側 `appsscript.json`，確認內容包含：
     ```json
     {
       "timeZone": "Asia/Taipei",
       "dependencies": {},
       "exceptionLogging": "STACKDRIVER",
       "runtimeVersion": "V8"
     }
     ```
   - 若未設定 `Asia/Taipei`，Apps Script 底層伺服器可能預設為美東時間 (`America/New_York`) 或 UTC，因此強烈建議將兩者保持一致。

4. **一鍵診斷工具（隨時檢視與比對）**：
   - 直接在 Google 試算表上方選單點選：  
     `🍱 便當訂餐管理` ➡️ `🕒 檢查 Apps Script 時區與系統時間`。
   - 系統會彈出即時診斷視窗，清楚列出：
     - **試算表設定時區 (Spreadsheet TimeZone)**：試算表檔案設定
     - **專案腳本時區 (Script TimeZone)**：`appsscript.json` 資訊清單設定
     - **系統運行採用時區 (Effective TimeZone)**：系統動態選定採用之時區
     - **當前時區時間 (Local Time)**：依採用時區轉換之當地時間
     - **當前判定日期與星期**：換日判定（YYYY-MM-DD 與週一～週日）
     - **伺服器原始時間 (Raw Date)** 與 **ISO UTC 時間**
     - **狀態提示**：若試算表與專案時區不一致，會自動跳出 ⚠️ 提醒。
