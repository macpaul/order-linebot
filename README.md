# LINE Bot 訂便當/點餐小幫手 (Meal Ordering LINE Bot)

> 專為 LINE 群組與多人聊天室打造的每日/每週便當訂餐與費用統計機器人。
> 基於 **Google Apps Script (GAS)** 與 **Google Sheets (試算表)**，**100% 零伺服器成本、完全符合 Free Tier 免費配額**。

---

## ✨ 核心特色

- 💰 **100% 永久免費運行**：
  - 善用 LINE Messaging API 的 `replyMessage`（回覆訊息），**完全免費且無數量上限**，徹底避開每月 200 則 Push Message 廣播額度限制。
  - Google Apps Script 雲端無伺服器架構，免自架 VPS、免 Heroku / AWS 費用。
- 📅 **週一至週五店家排程 & 一梯次跨日預定**：
  - 支援週一到週五每天指定不同配合店家與菜單。
  - 全組同仁可一次預約整週餐點（例如：`週一 排骨飯+1, 週二 炸雞腿+1, 週四 燒肉飯+1`）。
  - 自動產出「本週梯次統計表」，各日小計、店家叫餐總量、全週個人應付金額一目了然。
- 🍔 **Uber Eats 店家菜單自動抓取與匯入**：
  - 輸入 Uber Eats 店家網址，自動爬取分類、菜名、價格與描述，一鍵匯入至指定星期菜單！
  - 支援 Google 試算表選單操作與 LINE 群組聊天室指令兩種匯入方式。
- 📊 **Google 試算表即時資料庫 & 管理員自訂介面**：
  - 自動建立與維護 `Config`、`WeeklySchedule`、`Menu`、`Orders`、`Summary` 五大工作表。
  - 管理員可直接在試算表中調整每天店家、菜單與截止時間，即時讀取生效。
  - Google 試算表整合 **「🍱 便當訂餐管理」** 自訂選單，方便一鍵匯入外送菜單與重算統計。
- 🍱 **彈性點餐語法 & 互動 Flex Message**：
  - 支援直覺文字指令：`+1 排骨飯`、`週一+1 雞腿飯`、`排骨飯*1, 珍奶*2`、`取消 週二 全部`。
  - **點餐收據範圍彈性設定**：點餐完成後回傳的「✅ 加購成功」收據預設彙整成員**本週梯次所有預訂**（`ORDER_RECEIPT_SCOPE=WEEKLY`），亦可於 `Config` 設定為僅顯示當日（`DAILY`）。
  - **多元結單模式與支付方式**：支援依設定截止全週或當日訂單（`CLOSE_ORDER_SCOPE`），結單卡片整合 **LINE Pay 一鍵轉帳按鈕** 與 **銀行跨行匯款帳號**。

---

## 🚀 快速開始與部署

詳細圖文步驟請參閱 👉 [完整部署指南 (docs/deployment_guide.md)](docs/deployment_guide.md)

### 3 步極速上線：
1. **申請 LINE Messaging API (免費)**：
   - 在 [LINE Developers](https://developers.line.biz/) 建立 Provider 與 Messaging API Channel。
   - 取得 `Channel Access Token` (長效權杖) 與 `Channel Secret`。
   - 設定官方帳號：**關閉自動回應訊息**、**開啟 Webhook**、**允許加入群組與多人聊天室**。
2. **建立 Google Apps Script (免費)**：
   - 開啟 Google 雲端硬碟建立空白 Google 試算表，點擊 **擴充功能 -> Apps Script**。
   - 將專案中的 [`dist/Code.gs`](dist/Code.gs) 內容完整複製並貼入編輯器。
   - 於「專案設定」->「指令碼屬性」填入 `CHANNEL_ACCESS_TOKEN` 與 `CHANNEL_SECRET`。
   - 點擊「部署」->「新增部署」->「網頁應用程式 (Web App)」-> 存取權限設為「所有人 (Anyone)」，複製 Web App URL。
3. **綁定 LINE Webhook**：
   - 將 Web App URL 貼回 LINE Developers 的 Webhook URL 並點擊 **Verify** 驗證通過即可！

---

## 💬 聊天室指令清單

將機器人邀請至群組後，全體成員即可使用以下指令：

| 指令 | 說明 | 範例 |
| :--- | :--- | :--- |
| `本週菜單` | 顯示週一至週五每日配合店家與排程卡片 | `本週菜單` |
| `週X菜單` | 查看指定星期的店家專屬菜單卡片 | `週一菜單`、`週二菜單` |
| `週X+1 [餐點]` | 跨日/梯次點餐（單則訊息可預約整週多日餐點） | `週一 排骨飯+1, 週二 炸雞腿+1, 週四 控肉飯+1` |
| `+1 [餐點名稱]` | 當日快速點餐（預設 1 份） | `+1 招牌排骨飯` |
| `[餐點]+[數量]` | 指定份數點餐 | `酥炸雞腿飯+2` |
| `[餐點]*[數量]` | 乘號語法點餐 | `古早味控肉飯*1, 綠茶*2` |
| `我的本週訂單` | 查詢自己整週（週一至週五）預約明細與總金額 | `我的本週訂單` |
| `我的訂單` | 查詢個人今日點餐紀錄 | `我的訂單` |
| `取消 [週幾] [餐點]` | 取消已點的餐點（支援指定星期或今日） | `取消 週二 全部` 或 `取消 排骨飯` |
| `本週統計` / `梯次統計` | 查看週一至週五全體訂購總量與每位成員應付金額 | `本週統計` |
| `統計` | 即時查看群組今日點餐匯總明細 | `統計` |
| `結單` / `本週結單` / `今日結單` | 截止訂餐，產出叫餐總表與付款資訊（LINE Pay / 銀行匯款） | `結單`、`本週結單` |
| `開單 [店家名] [時間]` | 發起今日單日自選開單 | `開單 老王便當 11:30` |
| `匯入菜單 [週X] [網址]` | 透過 Uber Eats 店家網址自動匯入菜單 | `匯入菜單 週一 https://www.ubereats.com/...` |
| `幫助` | 顯示所有指令與使用教學卡片 | `幫助` |

---

## 📁 專案檔案結構

```
order-linebot/
├── .gitignore                      # Git 忽略設定
├── package.json                   # 專案腳本與元資料
├── README.md                      # 專案說明與操作指南
├── docs/
│   └── deployment_guide.md        # 完整免費部署與後台管理圖文教學
├── src/
│   ├── Config.js                  # 系統環境變數、常數與週排程定義
│   ├── LineService.js             # LINE Messaging API 通訊封裝與簽名驗證
│   ├── SheetService.js            # Google Sheets 讀寫、週排程、公式注入防護與統計匯總
│   ├── UberEatsService.js         # Uber Eats 店家菜單抓取、價格轉換與正規化模組
│   ├── FlexMessage.js             # LINE Flex Message 互動卡片（排程、菜單、梯次統計）
│   ├── OrderService.js            # 自然語言點餐解析器、週梯次狀態機與指令派發
│   └── Code.js                    # GAS Webhook (doPost/doGet) 與 Google 試算表選單擴充
├── dist/
│   └── Code.gs                    # 自動打包的單檔發行版，可直接貼入 GAS 編輯器
├── scripts/
│   └── bundle.js                  # 自動將 7 個 src/ 模組打包至 dist/Code.gs 的腳本
└── tests/
    └── test_order_flow.js         # 包含週梯次點餐與 Uber Eats 匯入的端到端完整測試套件
```

---

## 🧪 本地測試與構建

本專案支援在完全不聯網或無 GAS 憑證的情況下，在本地進行快速語法檢驗與業務邏輯測試：

```bash
# 執行包含週梯次與 Uber Eats 匯入的端到端測試套件
npm test

# 重新編譯產出 GAS 單一程式碼檔案 (dist/Code.gs)
npm run bundle
```

---

## ❓ 常見問題與除錯 (FAQ)

- **找不到 Channel access token？**
  請注意官方帳號營運後台 (`manager.line.biz`) 僅提供基本資訊，Token 必須至 [LINE Developers Console](https://developers.line.biz/) 的 `Messaging API` 標籤頁最底部點選「Issue」產生。詳細圖解請參閱 [docs/deployment_guide.md#第六部分常見問題與疑難排解-faq--troubleshooting](docs/deployment_guide.md)。
- **LINE 後台按 Verify 提示 302 Found？**
  請檢查 GAS 部署權限是否設為「所有人 (Anyone)」、網址結尾是否為 `/exec`。若已開啟「Use webhook」，通常可直接於群組輸入 `幫助` 測試，機器人正常回覆即代表運作正常。
- **試算表初始化出現 `TypeError: getConfigProperty is not a function`？**
  已於最新版解決變數覆蓋問題，請重新複製最新的 [`dist/Code.gs`](dist/Code.gs) 貼入 Apps Script 編輯器即可。
- **純文字訊息可回覆，但「幫助」或「本週菜單」圖文卡片沒有反應？**
  Flex Message 卡片已全數重構對齊 LINE 官方最新嚴格規範（移除無效 CSS 屬性，改用 `paddingAll` 與標準 `mega` 尺寸），請更新部署最新 [`dist/Code.gs`](dist/Code.gs) 即可。

---

## 📄 開發規範與授權

- 嚴格遵循 Git 原子化提交規範 (1 commit per file, Signed-off-by, detailed commit body)。
- [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE)。
