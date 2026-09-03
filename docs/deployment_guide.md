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

### 步驟 1：登入 LINE Developers Console
1. 前往 [LINE Developers Console](https://developers.line.biz/)。
2. 點擊右上角 **Log in**，使用您現有的個人 LINE 帳號登入。

### 步驟 2：建立 Provider (提供者)
1. 進入主控制台，點擊 **Create a new provider**。
2. 輸入名稱（例如：`MealService` 或您的團隊名稱），點擊 **Create**。

### 步驟 3：建立 Messaging API Channel
1. 在剛剛建立的 Provider 頁面中，點選 **Create a Messaging API channel**。
2. 填寫以下必要欄位：
   - **Channel type**: Messaging API
   - **Channel name**: 例如 `便當點餐小助手`
   - **Channel description**: `群組每日/每週便當訂餐統計機器人`
   - **Category**: 選擇餐飲（Food & Beverage）或生活工具
   - **Subcategory**: 隨選適合項目
   - **Email address**: 填寫您的聯絡信箱
3. 勾選同意服務條款後點擊 **Create**。

### 步驟 4：取得憑證金鑰 (Tokens & Secrets)
1. **Channel Secret**：
   - 切換至 **Basic settings** 標籤頁。
   - 找到 **Channel secret** 欄位，複製此 32 位元字串並妥善保存。
2. **Channel Access Token**：
   - 切換至 **Messaging API** 標籤頁。
   - 滾動到最下方 **Channel access token**。
   - 點選 **Issue** 按鈕，生成長效權杖 (Long-lived Token)，複製此字串並妥善保存。

### 步驟 5：設定 LINE 官方帳號重要功能 (極關鍵！)
在 **Messaging API** 標籤頁中，找到 **LINE Official Account features** 區塊，點選 **Edit** 開啟 LINE Official Account Manager 後台：
1. **回應設定 (Response Settings)**：
   - **回應模式**：選擇 **Bot (聊天機器人)**。
   - **自動回應訊息 (Auto-response)**：務必切換為 **停用 (Disabled)**（若開啟，每次成員打字，LINE 預設罐頭回覆會重複跳出干擾）。
   - **Webhooks**：切換為 **啟用 (Enabled)**。
2. **聊天室設定 (Chat room and group chats)**：
   - 勾選 **允許加入群組與多人聊天室 (Allow)**，這樣才能將機器人邀請進群組中訂餐。

---

## 第二部分：設定 Google 試算表與 Google Apps Script (GAS)

### 步驟 1：建立 Google 試算表
1. 打開 [Google Drive](https://drive.google.com/)，新增一個 Google 試算表，命名為 `便當點餐資料庫`。
2. 試算表內建將由程式自動初始化產生 4 個工作表（若手動建立請參考以下欄位）：
   - `Config`：系統狀態設定（開單狀態、今日店家、截止時間）。
   - `Menu`：菜單清單（星期、分類、品項名稱、價格、供應狀態）。
   - `Orders`：點餐流水帳（時間戳、群組ID、使用者ID、使用者暱稱、品項、數量、金額、付款狀態）。
   - `Summary`：即時統計匯總（品項加總數量、金額、訂購人名單）。

### 步驟 2：開啟 Apps Script 編輯器
1. 在試算表上方工具列，點選 **擴充功能 (Extensions) -> Apps Script**。
2. 將專案重新命名為 `LineMealOrderBot`。

### 步驟 3：貼上專案程式碼
1. 將本專案 `dist/bundled.js` 或 `src/` 中的各模組程式碼貼入 Apps Script 編輯器。

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
   - **說明 (Description)**：例如 `v1.0.0`
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

## 第四部分：群組使用指令說明

將機器人加入群組後，即可開始使用以下指令：

| 指令 | 說明 | 範例 |
| :--- | :--- | :--- |
| `開單 [店家名] [截止時間]` | 發起今日訂餐活動 | `開單 老王便當 11:00` |
| `菜單` | 顯示當前店家菜單 (Flex Message 卡片) | `菜單` |
| `+1 [品項] [數量]` | 快速點餐或加點 | `+1 排骨飯 1` 或 `雞腿飯+2` |
| `我的訂單` | 查詢個人目前已點項目與金額 | `我的訂單` |
| `取消 [品項]` | 取消已點的餐點 | `取消 排骨飯` 或 `取消全部` |
| `統計` | 即時查看群組點餐匯總明細 | `統計` |
| `結單` | 截止訂餐，產生最終聯絡店家明細與總金額 | `結單` |
| `幫助` | 顯示所有可用指令教學 | `幫助` |
