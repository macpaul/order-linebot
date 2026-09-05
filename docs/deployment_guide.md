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

### 步驟 1：建立 Google 試算表
1. 打開 [Google Drive](https://drive.google.com/)，新增一個 Google 試算表，命名為 `便當點餐資料庫`。
2. 試算表將由程式首次執行自動初始化產生 5 個工作表（管理員亦可直接編輯）：
   - `Config`：系統全域設定（開單狀態、今日店家、截止時間）。
   - `WeeklySchedule`：**週一至週五梯次排程表**（星期、當日店家、截止時間、Uber Eats 網址、備註、啟用狀態）。
   - `Menu`：菜單清單（星期、店家名稱、分類、品項名稱、價格、供應狀態、描述）。
   - `Orders`：點餐流水帳（時間戳、日期、星期、群組ID、使用者ID、使用者暱稱、品項、數量、金額、付款狀態）。
   - `Summary`：即時與全週梯次統計匯總（各日小計、總金額、成員應付清單）。

### 步驟 2：開啟 Apps Script 編輯器
1. 在試算表上方工具列，點選 **擴充功能 (Extensions) -> Apps Script**。
2. 將專案重新命名為 `LineMealOrderBot`。

### 步驟 3：貼上專案程式碼
1. 將本專案 [`dist/Code.gs`](dist/Code.gs) 單一檔案內容完整複製貼入 Apps Script 編輯器（完全免安裝任何工具）。

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
| `結單` | 截止今日訂餐，產生最終聯絡店家明細與總金額 | `結單` |
| `匯入菜單 [週X] [網址]` | 在群組直接透過 Uber Eats 網址匯入菜單 | `匯入菜單 週一 https://www.ubereats.com/...` |
| `幫助` | 顯示所有可用指令教學卡片 | `幫助` |
