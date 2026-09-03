# LINE Bot 訂便當/點餐小幫手 (Meal Ordering LINE Bot)

> 專為 LINE 群組與多人聊天室打造的每日/每週便當訂餐與費用統計機器人。
> 基於 **Google Apps Script (GAS)** 與 **Google Sheets (試算表)**，**100% 零伺服器成本、完全符合 Free Tier 免費配額**。

---

## ✨ 核心特色

- 💰 **100% 永久免費運行**：
  - 善用 LINE Messaging API 的 `replyMessage`（回覆訊息），**完全免費且無數量上限**，徹底避開每月 200 則 Push Message 廣播額度限制。
  - Google Apps Script 雲端無伺服器架構，免自架 VPS、免 Heroku / AWS 費用。
- 📊 **Google 試算表即時資料庫**：
  - 自動建立與維護 `Config`（設定）、`Menu`（菜單）、`Orders`（點餐明細）、`Summary`（統計匯總）四大工作表。
  - 全組成員可同時在 Google 試算表檢視今日訂單、歷史紀錄與金額明細，透明公開。
- 🍱 **彈性點餐語法 & 互動 Flex Message**：
  - 支援直覺的文字指令：`+1 排骨飯`、`雞腿飯+2`、`排骨飯*1, 珍奶*2`、`取消 排骨飯`。
  - 支援高質感 LINE Flex Message 卡片：圖文菜單、點餐收據卡、即時統計卡與結單明細卡。
- ⏰ **開單與截止管理**：
  - 發起人可隨時指定今日店家與截止時間（例如：`開單 老王便當 11:30`）。
  - 超過截止時間或輸入 `結單` 後自動鎖定，防止逾期送單，並產生直接給店家叫便當的彙總清單。

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
| `開單 [店家名] [截止時間]` | 發起今日訂餐活動，並推送菜單卡片 | `開單 老王便當 11:30` |
| `菜單` | 隨時喚出當前店家菜單卡片 | `菜單` |
| `+1 [餐點名稱]` | 快速點餐（預設 1 份） | `+1 招牌排骨飯` |
| `[餐點]+[數量]` | 指定份數點餐 | `酥炸雞腿飯+2` |
| `[餐點]*[數量]` | 乘號語法點餐 | `古早味控肉飯*1, 綠茶*2` |
| `我的訂單` | 查詢自己今天已點的品項與個人總額 | `我的訂單` |
| `取消 [餐點名稱]` | 取消已點的特定餐點或全部取消 | `取消 排骨飯` 或 `取消全部` |
| `統計` | 查看群組目前的點餐明細與累積金額 | `統計` |
| `結單` | 截止今日訂餐，產出叫餐總表與收錢清單 | `結單` |
| `幫助` | 顯示所有指令與使用教學卡片 | `幫助` |

---

## 📁 專案檔案結構

```
order-linebot/
├── .gitignore                      # Git 忽略設定
├── package.json                   # 專案腳本與元資料
├── README.md                      # 專案說明與指南
├── docs/
│   └── deployment_guide.md        # 完整免費部署圖文教學
├── src/
│   ├── Config.js                  # 系統環境變數、常數與 API 端點配置
│   ├── LineService.js             # LINE Messaging API 通訊封裝與簽名驗證
│   ├── SheetService.js            # Google Sheets 讀寫、初始化與統計計算層
│   ├── FlexMessage.js             # LINE Flex Message 互動卡片 JSON 範本產生器
│   ├── OrderService.js            # 點餐核心狀態機、自然語言語法解析器
│   └── Code.js                    # Google Apps Script Webhook 入口點 (doPost/doGet)
├── dist/
│   └── Code.gs                    # 免建置工具，直接貼上 GAS 編輯器使用的單檔發行版
├── scripts/
│   └── bundle.js                  # 自動將 src/ 打包至 dist/Code.gs 的構建腳本
└── tests/
    └── test_order_flow.js         # 本地端離線端到端完整測試套件
```

---

## 🧪 本地測試與構建

本專案支援在完全不聯網或無 GAS 憑證的情況下，在本地進行快速語法檢驗與業務邏輯測試：

```bash
# 執行端到端點餐生命週期測試
npm test

# 重新編譯產出 GAS 單一程式碼檔案 (dist/Code.gs)
npm run bundle
```

---

## 📄 開發規範與授權

- 嚴格遵循 Git 原子化提交規範 (1 commit per file, Signed-off-by, detailed commit body)。
- [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE)。
