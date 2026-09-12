/**
 * test_order_flow.js - End-to-end integration and unit test suite
 * Tests full meal ordering lifecycle, Mon-Fri weekly batch scheduling,
 * and Uber Eats scraping offline without requiring external network.
 */

const assert = require('assert');
const ConfigModule = require('../src/Config.js');
const SheetModule = require('../src/SheetService.js');
const FlexModule = require('../src/FlexMessage.js');
const LineModule = require('../src/LineService.js');
const UberEatsModule = require('../src/UberEatsService.js');
const I18nModule = require('../src/I18n.js');
const OrderModule = require('../src/OrderService.js');
const CodeModule = require('../src/Code.js');

console.log('🧪 Starting LINE Meal Ordering Bot Extended Test Suite...\n');

// Mock reply capturing
let lastReply = null;
globalThis.replyFlex = LineModule.replyFlex = function (token, altText, flex) {
  lastReply = { type: 'flex', token: token, altText: altText, flex: flex };
  return { statusCode: 200 };
};
globalThis.replyText = LineModule.replyText = function (token, text) {
  lastReply = { type: 'text', token: token, text: text };
  return { statusCode: 200 };
};
globalThis.replyQuickReply = LineModule.replyQuickReply = function (token, text, quickReplyItems) {
  lastReply = { type: 'quick_reply', token: token, text: text, quickReply: { items: quickReplyItems } };
  return { statusCode: 200 };
};
globalThis.replyMessages = LineModule.replyMessages = function (token, messages) {
  if (messages && messages[0] && messages[0].quickReply) {
    lastReply = { type: 'quick_reply', token: token, text: messages[0].text, quickReply: messages[0].quickReply };
  } else {
    lastReply = { type: 'messages', token: token, messages: messages };
  }
  return { statusCode: 200 };
};
let lastPush = null;
let allPushes = [];
globalThis.pushText = LineModule.pushText = function (to, text) {
  lastPush = { to: to, text: text };
  allPushes.push(lastPush);
  globalThis._lastPush = lastPush;
  return { statusCode: 200 };
};
globalThis.pushMessages = LineModule.pushMessages = function (to, messages) {
  lastPush = { to: to, messages: messages };
  globalThis._lastPush = lastPush;
  return { statusCode: 200 };
};

// 1. Text Parsing Tests (Single-day & Weekly Batch)
console.log('▶ Test 1: Order Text Parsing');
const p1 = OrderModule.parseOrderText('+1 招牌排骨飯');
assert.strictEqual(p1.length, 1);
assert.strictEqual(p1[0].itemName, '招牌排骨飯');
assert.strictEqual(p1[0].quantity, 1);

const p2 = OrderModule.parseOrderText('酥炸雞腿飯 + 2');
assert.strictEqual(p2.length, 1);
assert.strictEqual(p2[0].itemName, '酥炸雞腿飯');
assert.strictEqual(p2[0].quantity, 2);

const p3 = OrderModule.parseOrderText('週一 排骨飯+1, 週二 雞腿飯+2, 週四 水煮雞胸*1');
assert.strictEqual(p3.length, 3);
assert.strictEqual(p3[0].dayOfWeek, '週一');
assert.strictEqual(p3[0].itemName, '排骨飯');
assert.strictEqual(p3[0].quantity, 1);
assert.strictEqual(p3[1].dayOfWeek, '週二');
assert.strictEqual(p3[1].itemName, '雞腿飯');
assert.strictEqual(p3[1].quantity, 2);
assert.strictEqual(p3[2].dayOfWeek, '週四');
assert.strictEqual(p3[2].itemName, '水煮雞胸');
assert.strictEqual(p3[2].quantity, 1);

// Test prevention of announcement / price arithmetic false triggers (e.g. 北平餡餅 announcement)
const announcementText = `9/11 北平餡餅 目前訂餐記錄（請大家核對） 麻煩注意價錢有更動喔！
RaeRae ：高麗菜盒+三星蔥蛋餅  43+48 +7
Ginny：豬肉餡餅（買一送一） 90 +7
Bertha：豬肉餡餅 45 +7
Colin：高麗菜盒+豬肉餡餅 45+43 +7
約中午預訂餐點，16：15前到~~
因為品項湊買一送一，單價有變。（其實就是買二個便宜一點點）
豬肉餡餅買一送一價格是90
高麗菜盒買一送一價格是85
另外UBER目前收較高的額外費用，如果我的系統本身可以折抵差價，在20元內我付，超過20元就以訂餐人數平均。今天9/11 （341-313）/4= 7
如果需要修改訂單，請中午前回訊息給我~~`;

assert.strictEqual(OrderModule.isAnnouncementOrReconciliation(announcementText), true, 'Must detect announcement pattern');
assert.strictEqual(OrderModule.parseOrderText(announcementText).length, 0, 'Full announcement must not parse any orders');

// Test arithmetic price lines individually (without announcement header)
assert.strictEqual(OrderModule.parseOrderText('RaeRae ：高麗菜盒+三星蔥蛋餅  43+48 +7').length, 0);
assert.strictEqual(OrderModule.parseOrderText('Ginny：豬肉餡餅（買一送一） 90 +7').length, 0);
assert.strictEqual(OrderModule.parseOrderText('Bertha：豬肉餡餅 45 +7').length, 0);
assert.strictEqual(OrderModule.parseOrderText('Colin：高麗菜盒+豬肉餡餅 45+43 +7').length, 0);
assert.strictEqual(OrderModule.parseOrderText('便當 50 + 10').length, 0);
assert.strictEqual(OrderModule.parseOrderText('+7 運費').length, 0);

// Verify announcement text sent via handleTextMessage is completely ignored (no order created, returns null)
const annResult = OrderModule.handleTextMessage({
  replyToken: 'token_announcement_test',
  source: { groupId: 'g_ann_test', userId: 'user_mom_test' },
  message: { type: 'text', text: announcementText }
});
assert.strictEqual(annResult, null, 'Announcement message must be ignored by handleTextMessage');

console.log('  ✔ Text parsing (single-day, Mon-Fri batch, announcement & math formula rejection) passed.\n');

// 2. Menu Matching Tests
console.log('▶ Test 2: Menu Matching & Price Lookup');
const menu = SheetModule.getMenuItems();
const m1 = OrderModule.matchMenuItem('排骨', menu);
assert.strictEqual(m1.itemName, '招牌排骨飯');
assert.strictEqual(m1.price, 100);

const m2 = OrderModule.matchMenuItem('古早味紅茶', menu);
assert.strictEqual(m2.itemName, '古早味紅茶');
assert.strictEqual(m2.price, 25);
console.log('  ✔ Menu matching passed.\n');

// 3. Uber Eats Scraper & Importer Tests
console.log('▶ Test 3: Uber Eats URL Parser & Menu Extraction');
// Test URL-safe Base64 UUID conversion
const uuid1 = UberEatsModule.base64ToUuid('xDKpVlsqTdmXKiJsQdkf_g');
assert.strictEqual(uuid1, 'c432a956-5b2a-4dd9-972a-226c41d91ffe');

const uuid2 = UberEatsModule.base64ToUuid('kRJsM5CqSrCohWhzSS_y-w');
assert.strictEqual(uuid2, '91126c33-90aa-4ab0-a885-6873492ff2fb');

// Test parsing user-provided URLs
const userUrl1 = 'ubereats.com/tw/store/真好味茶餐廳/xDKpVlsqTdmXKiJsQdkf_g?sc=SEARCH_SUGGESTION';
const parsedUserUrl1 = UberEatsModule.parseUberEatsUrl(userUrl1);
assert.ok(parsedUserUrl1);
assert.strictEqual(parsedUserUrl1.storeName, '真好味茶餐廳');
assert.strictEqual(parsedUserUrl1.storeUuid, 'xDKpVlsqTdmXKiJsQdkf_g');
assert.strictEqual(parsedUserUrl1.standardUuid, 'c432a956-5b2a-4dd9-972a-226c41d91ffe');

const userUrl2 = 'https://www.ubereats.com/tw/store/%E4%B8%8A%E6%B5%B7%E7%81%98%E8%8C%B6%E9%A4%90%E5%BB%B3/kRJsM5CqSrCohWhzSS_y-w?diningMode=DELIVERY';
const parsedUserUrl2 = UberEatsModule.parseUberEatsUrl(userUrl2);
assert.ok(parsedUserUrl2);
assert.strictEqual(parsedUserUrl2.storeName, '上海灘茶餐廳');
assert.strictEqual(parsedUserUrl2.storeUuid, 'kRJsM5CqSrCohWhzSS_y-w');
assert.strictEqual(parsedUserUrl2.standardUuid, '91126c33-90aa-4ab0-a885-6873492ff2fb');

const testUrl = 'https://www.ubereats.com/tw/store/' + encodeURIComponent('福山排骨便當專賣') + '/aX6-T9T3TEG3dK-7p7Kspw';
const parsedUrl = UberEatsModule.parseUberEatsUrl(testUrl);
assert.ok(parsedUrl);
assert.strictEqual(parsedUrl.storeUuid, 'aX6-T9T3TEG3dK-7p7Kspw');
assert.strictEqual(parsedUrl.storeName, '福山排骨便當專賣');

// Test menu extraction from mock data
const mockData = UberEatsModule._mockStoreData();
const extractedItems = UberEatsModule.extractMenuItems(mockData);
assert.strictEqual(extractedItems.length, 3);
assert.strictEqual(extractedItems[0].itemName, '招牌排骨飯');
assert.strictEqual(extractedItems[0].price, 120); // 12000 cents -> 120 dollars
assert.strictEqual(extractedItems[1].price, 130);
assert.strictEqual(extractedItems[2].price, 30);

// Test saving items to Sheet
SheetModule.saveMenuItems('週一', '福山排骨便當專賣', extractedItems);
const mondayMenu = SheetModule.getMenuItems('週一', '福山排骨便當專賣');
assert.strictEqual(mondayMenu.length, 3);

// Test CodeModule.testUberEatsImport diagnostic function
const diagResults = CodeModule.testUberEatsImport();
assert.ok(Array.isArray(diagResults));
assert.strictEqual(diagResults.length, 2);
console.log('  ✔ Uber Eats URL parser, Base64 UUID converter, and diagnostics passed.\n');

// Mock user profiles for testing real user nicknames
globalThis._mockProfiles = {
  'user_alice': { displayName: '愛麗絲', userId: 'user_alice' },
  'user_bob': { displayName: '小鮑伯', userId: 'user_bob' },
  'user_carol': { displayName: '卡蘿', userId: 'user_carol' },
  'user_boss': { displayName: '老闆', userId: 'user_boss' }
};

// 4. Weekly Schedule & Batch Ordering Lifecycle Test
console.log('▶ Test 4: Weekly Schedule & Mon-Fri Batch Ordering Simulation');
globalThis._mockCurrentDate = new Date('2026-09-07T09:00:00+08:00'); // Monday 9:00 AM (Before cutoff)
SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');
const groupId = 'group_team_weekly';
const today = OrderModule.getTodayDateString();

// Step A-0: View Help Card and verify interactive command buttons
console.log('  [Step A-0] Member queries help (幫助) and verifies command buttons');
OrderModule.handleTextMessage({
  replyToken: 'token_help',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '幫助' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '便當點餐指令說明');
const helpBody = lastReply.flex.body.contents;
const helpButtons = helpBody.filter(c => c.layout === 'horizontal').map(c => c.contents.find(i => i.type === 'button'));
assert.strictEqual(helpButtons.length, 9);
assert.strictEqual(helpButtons[0].action.text, '本週菜單');
assert.strictEqual(helpButtons[1].action.text, '菜單');
assert.strictEqual(helpButtons[2].action.text, '設定小孩');
assert.strictEqual(helpButtons[3].action.text, '我的訂單');
assert.strictEqual(helpButtons[4].action.text, '我的本週訂單');
assert.strictEqual(helpButtons[5].action.text, '取消餐點');
assert.strictEqual(helpButtons[8].action.text, '結單');
console.log('  ✔ Buttonized Help card verified with 9 quick-action buttons.');

// Verify clicking the 設定小孩 button from Help invokes children submenu
OrderModule.handleTextMessage({
  replyToken: 'token_help_kids_button',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: helpButtons[2].action.text }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '👶 小孩與用餐對象管理選單');
const kidsSubmenuBody = lastReply.flex.body.contents;
const kidsSubmenuButtons = kidsSubmenuBody.filter(c => c.layout === 'horizontal').map(c => c.contents.find(i => i.type === 'button'));
assert.strictEqual(kidsSubmenuButtons.length, 4);
assert.strictEqual(kidsSubmenuButtons[0].action.text, '我的小孩');
assert.strictEqual(kidsSubmenuButtons[0].action.label, '看名單');
assert.strictEqual(kidsSubmenuButtons[1].action.text, '設定小孩 大寶, 二寶');
assert.strictEqual(kidsSubmenuButtons[1].action.label, '批次登記');
assert.strictEqual(kidsSubmenuButtons[2].action.text, '新增小孩 小寶 附小一年一班');
assert.strictEqual(kidsSubmenuButtons[2].action.label, '新增小孩');
assert.strictEqual(kidsSubmenuButtons[3].action.text, '刪除小孩 小寶');
assert.strictEqual(kidsSubmenuButtons[3].action.label, '刪除小孩');
console.log('  ✔ Children submenu flex card triggered from 設定小孩 button with 4 interactive actions verified.');

// Step A: View Weekly Schedule
console.log('  [Step A] Member queries weekly schedule (本週菜單)');
OrderModule.handleTextMessage({
  replyToken: 'token_sched',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '本週菜單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '📅 本週訂餐排程表 (週一至週五)');
console.log('  ✔ Weekly schedule flex card verified.');

// Step B: Query Specific Day Menu & Verify Item Order Buttons
console.log('  [Step B] Member queries Tuesday menu (週二菜單) & verifies order buttons');
OrderModule.handleTextMessage({
  replyToken: 'token_tue_menu',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '週二菜單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('週二'));

// Verify that the menu body contains interactive buttons
const menuBody = lastReply.flex.body.contents;
const itemBoxes = menuBody.filter(c => c.layout === 'horizontal' && Array.isArray(c.contents));
assert.ok(itemBoxes.length >= 2, 'Menu should render at least 2 item rows');

// Check first item button
const firstItemRow = itemBoxes[0];
const buttonComponent = firstItemRow.contents.find(c => c.type === 'button');
assert.ok(buttonComponent, 'Each item row must have a button');
assert.strictEqual(buttonComponent.action.type, 'message');
assert.strictEqual(buttonComponent.action.label, '+1 點餐');
assert.strictEqual(buttonComponent.action.text, '週二 日式厚切豬排飯+1');

// Simulate user clicking the button (LINE client automatically sends buttonComponent.action.text)
console.log('  [Step B-2] Member Carol clicks the "+1 點餐" button (simulating automated text message)');
OrderModule.handleTextMessage({
  replyToken: 'token_carol_btn_order',
  source: { groupId: groupId, userId: 'user_carol' },
  message: { type: 'text', text: buttonComponent.action.text }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('日式厚切豬排飯'));

const carolTueOrders = SheetModule.getUserOrders('user_carol', groupId, null, '週二');
assert.strictEqual(carolTueOrders.length, 1);
assert.strictEqual(carolTueOrders[0].itemName, '日式厚切豬排飯');
assert.strictEqual(carolTueOrders[0].userName, '卡蘿');
assert.strictEqual(carolTueOrders[0].quantity, 1);

// Carol cancels her test order
OrderModule.handleTextMessage({
  replyToken: 'token_carol_cancel',
  source: { groupId: groupId, userId: 'user_carol' },
  message: { type: 'text', text: '取消 週二 全部' }
});
assert.ok(lastReply.text.includes('已為您取消 週二'));
console.log('  ✔ Menu item button verification, one-click order and cancel passed.');

// Step C: Member Alice places multi-day batch order
console.log('  [Step C] Alice orders across multiple weekdays in one command');
OrderModule.handleTextMessage({
  replyToken: 'token_batch_order',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '週一 排骨飯+1, 週二 日式厚切豬排飯+1, 週三 招牌鍋貼+2' }
});
assert.strictEqual(lastReply.type, 'flex');
// Verify that default receipt displays weekly orders
const receiptTitle = lastReply.flex.body.contents[0].text;
assert.ok(receiptTitle.includes('愛麗絲 的本週訂單'), 'Receipt title should default to weekly orders');
const receiptTexts = JSON.stringify(lastReply.flex.body.contents);
assert.ok(receiptTexts.includes('【週一】'));
assert.ok(receiptTexts.includes('【週二】'));
assert.ok(receiptTexts.includes('【週三】'));
assert.ok(receiptTexts.includes('本週合計'));

const aliceMonOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週一');
assert.strictEqual(aliceMonOrders.length, 1);
assert.strictEqual(aliceMonOrders[0].quantity, 1);
assert.strictEqual(aliceMonOrders[0].userName, '愛麗絲');
assert.strictEqual(aliceMonOrders[0].userNickname, '愛麗絲');

const aliceTueOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週二');
assert.strictEqual(aliceTueOrders.length, 1);
assert.strictEqual(aliceTueOrders[0].itemName, '日式厚切豬排飯');
assert.strictEqual(aliceTueOrders[0].userName, '愛麗絲');

const aliceWedOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週三');
assert.strictEqual(aliceWedOrders.length, 1);
assert.strictEqual(aliceWedOrders[0].quantity, 2);
assert.strictEqual(aliceWedOrders[0].userName, '愛麗絲');
console.log('  ✔ Alice multi-day batch order recorded with nickname (愛麗絲) and weekly receipt verified.');

// Step C-2: Verify ORDER_RECEIPT_SCOPE config can switch receipt to daily mode
console.log('  [Step C-2] Verify ORDER_RECEIPT_SCOPE config toggles receipt between DAILY and WEEKLY');
SheetModule.setConfigValue('ORDER_RECEIPT_SCOPE', 'DAILY');
assert.strictEqual(SheetModule.getConfigValue('ORDER_RECEIPT_SCOPE'), 'DAILY');
OrderModule.handleTextMessage({
  replyToken: 'token_daily_test',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '週四 招牌三寶飯+1' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.flex.body.contents[0].text.includes('老闆 的今日訂單'), 'Receipt should show daily orders when scope is DAILY');
// Clean up boss test order and restore config
SheetModule.cancelOrder('user_boss', groupId, '招牌三寶飯', null, '週四');
SheetModule.setConfigValue('ORDER_RECEIPT_SCOPE', 'WEEKLY');
assert.strictEqual(SheetModule.getConfigValue('ORDER_RECEIPT_SCOPE'), 'WEEKLY');
console.log('  ✔ ORDER_RECEIPT_SCOPE config toggle verified.');

// Step D: Member Bob orders for Friday
console.log('  [Step D] Bob orders for Friday (週五 舒肥嫩雞胸餐盒+2)');
OrderModule.handleTextMessage({
  replyToken: 'token_bob_fri',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '週五 舒肥嫩雞胸餐盒+2' }
});
const bobFriOrders = SheetModule.getUserOrders('user_bob', groupId, null, '週五');
assert.strictEqual(bobFriOrders.length, 1);
assert.strictEqual(bobFriOrders[0].quantity, 2);
assert.strictEqual(bobFriOrders[0].userName, '小鮑伯');
console.log('  ✔ Bob Friday order recorded with nickname (小鮑伯).');

// Step E: Alice checks her weekly orders
console.log('  [Step E] Alice checks her weekly orders (我的本週訂單)');
OrderModule.handleTextMessage({
  replyToken: 'token_my_weekly',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的本週訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('【週一】'));
assert.ok(lastReply.text.includes('【週二】'));
assert.ok(lastReply.text.includes('【週三】'));
console.log('  ✔ Alice weekly orders verified.');

// Step F-1: Alice requests cancel menu by clicking or typing "取消餐點"
console.log('  [Step F-1] Alice opens interactive cancel menu (取消餐點)');
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_menu',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消餐點' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '🗑️ 請選擇欲取消的餐點');
const cancelBody = lastReply.flex.body.contents;
assert.ok(cancelBody.length > 0);
console.log('  ✔ Interactive cancel menu card verified.');

// Step F-2: Alice cancels Tuesday order
console.log('  [Step F-2] Alice cancels Tuesday order (取消 週二 全部)');
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_tue',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 週二 全部' }
});
assert.ok(lastReply.text.includes('已為您取消 週二'));
const aliceTueAfterCancel = SheetModule.getUserOrders('user_alice', groupId, null, '週二');
assert.strictEqual(aliceTueAfterCancel.length, 0);
console.log('  ✔ Day-targeted cancellation verified.');

// Step G: View Weekly Batch Summary
console.log('  [Step G] Team views weekly batch summary (本週統計)');
OrderModule.handleTextMessage({
  replyToken: 'token_weekly_sum',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '本週統計' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '📊 本週梯次訂餐統計總表');

const weeklySummary = SheetModule.getWeeklyOrderSummary(groupId);
// Alice has: Mon 1x (100) + Wed 2x 鍋貼 (70*2=140) = 240.
// Bob has: Fri 2x 水煮雞胸 (110*2=220) = 220.
// Grand total = 460, 5 items.
assert.strictEqual(weeklySummary.grandTotalQuantity, 5);
assert.strictEqual(weeklySummary.grandTotalAmount, 460);

// Verify that users in summary are accurately identified by their nicknames
const aliceSum = weeklySummary.users.find(u => u.userName === '愛麗絲');
assert.ok(aliceSum, 'Alice should be found in weekly summary with her nickname');
assert.strictEqual(aliceSum.total, 240);

const bobSum = weeklySummary.users.find(u => u.userName === '小鮑伯');
assert.ok(bobSum, 'Bob should be found in weekly summary with his nickname');
assert.strictEqual(bobSum.total, 220);
console.log('  ✔ Weekly batch summary verified with member nicknames (Grand Total: 5 items, $460).');

// Step H: Close Order with Payment Methods (LINE Pay & Bank Transfer)
console.log('  [Step H] Organizer closes order (結單) with LINE Pay & Bank Transfer info');

// H-1: Configure payment information in Config
SheetModule.setConfigValue('PAYMENT_LINEPAY_URL', 'https://line.me/ti/p/linepay_mock');
SheetModule.setConfigValue('PAYMENT_LINEPAY_QR_URL', 'https://example.com/linepay_qr.png');
SheetModule.setConfigValue('PAYMENT_BANK_CODE', '822');
SheetModule.setConfigValue('PAYMENT_BANK_NAME', '中國信託');
SheetModule.setConfigValue('PAYMENT_BANK_ACCOUNT', '123-456789-012');
SheetModule.setConfigValue('PAYMENT_BANK_ACCOUNT_NAME', '王大明');
SheetModule.setConfigValue('PAYMENT_BANK_QR_URL', 'https://drive.google.com/file/d/1XyZ_mockDriveFileId123/view?usp=sharing');
SheetModule.setConfigValue('CLOSE_ORDER_SCOPE', 'WEEKLY');

const payConfig = SheetModule.getPaymentConfig();
assert.strictEqual(payConfig.hasPaymentInfo, true);
assert.strictEqual(payConfig.bankCode, '822');
assert.strictEqual(payConfig.linePayUrl, 'https://line.me/ti/p/linepay_mock');
assert.strictEqual(payConfig.linePayQrUrl, 'https://example.com/linepay_qr.png');
assert.strictEqual(payConfig.bankQrUrl, 'https://lh3.googleusercontent.com/d/1XyZ_mockDriveFileId123');

// H-2: Trigger 結單 (defaults to WEEKLY scope)
OrderModule.handleTextMessage({
  replyToken: 'token_close_weekly',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '結單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '【已結單】本週梯次訂餐總表與收費清單');
const closeFlexJson = JSON.stringify(lastReply.flex);
assert.ok(closeFlexJson.includes('本週梯次結單總表'));
assert.ok(closeFlexJson.includes('822 中國信託'));
assert.ok(closeFlexJson.includes('123-456789-012'));
assert.ok(closeFlexJson.includes('王大明'));
assert.ok(closeFlexJson.includes('https://line.me/ti/p/linepay_mock'));
assert.ok(closeFlexJson.includes('https://lh3.googleusercontent.com/d/1XyZ_mockDriveFileId123'));
assert.ok(closeFlexJson.includes('點擊 QR Code 可放大檢視'));
assert.ok(closeFlexJson.includes('https://example.com/linepay_qr.png'));
assert.strictEqual(SheetModule.getConfigValue('IS_ORDERING_OPEN'), 'false');
console.log('  ✔ Weekly close order (結單) verified with Bank QR code, LINE Pay button and Bank Transfer info.');

// H-3: Member checks personal weekly orders and receives payment instructions
OrderModule.handleTextMessage({
  replyToken: 'token_my_orders_pay',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的本週訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('822 中國信託 帳號 123-456789-012 (王大明)'));
assert.ok(lastReply.text.includes('https://lh3.googleusercontent.com/d/1XyZ_mockDriveFileId123'));
assert.ok(lastReply.text.includes('https://line.me/ti/p/linepay_mock'));
console.log('  ✔ Personal orders view includes payment and QR info.');

// H-4: Test explicit '今日結單' or CLOSE_ORDER_SCOPE = 'DAILY'
console.log('  [Step H-4] Organizer triggers 今日結單');
OrderModule.handleTextMessage({
  replyToken: 'token_close_daily',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '今日結單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('【已結單】'));
const dailyCloseJson = JSON.stringify(lastReply.flex);
assert.ok(dailyCloseJson.includes('822 中國信託'));
assert.ok(dailyCloseJson.includes('https://line.me/ti/p/linepay_mock'));
console.log('  ✔ Daily close order (今日結單) verified with payment methods.');

// H-5: Test personal LINE Pay transfer mode (with wallet scheme & friend display name/ID guidance)
console.log('  [Step H-5] Personal LINE Pay Wallet Transfer Mode');
SheetModule.setConfigValue('PAYMENT_LINEPAY_URL', '');
SheetModule.setConfigValue('PAYMENT_LINEPAY_USER_NAME', '主揪小芳');
SheetModule.setConfigValue('PAYMENT_LINEPAY_USER_ID', 'eva_lin');

const personalPayConfig = SheetModule.getPaymentConfig();
assert.strictEqual(personalPayConfig.hasPaymentInfo, true);
assert.strictEqual(personalPayConfig.isPersonalLinePay, true);
assert.strictEqual(personalPayConfig.linePayUrl, 'https://line.me/R/nv/wallet');
assert.strictEqual(personalPayConfig.linePayRecipientName, '主揪小芳');
assert.strictEqual(personalPayConfig.linePayUserId, 'eva_lin');

OrderModule.handleTextMessage({
  replyToken: 'token_close_personal_pay',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '結單' }
});
assert.strictEqual(lastReply.type, 'flex');
const personalCloseJson = JSON.stringify(lastReply.flex);
assert.ok(personalCloseJson.includes('🟢 開啟 LINE 錢包轉帳'));
assert.ok(personalCloseJson.includes('https://line.me/R/nv/wallet'));
assert.ok(personalCloseJson.includes('請於錢包點選「轉帳」並搜尋好友：「主揪小芳」 (LINE ID: eva_lin)'));

OrderModule.handleTextMessage({
  replyToken: 'token_orders_personal_pay',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的本週訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('LINE Pay 好友轉帳：https://line.me/R/nv/wallet'));
assert.ok(lastReply.text.includes('搜尋好友「主揪小芳」 (LINE ID: eva_lin)'));
console.log('  ✔ Personal LINE Pay Wallet transfer button, URL scheme and recipient guidance verified.\n');

// 5. Google Sheets Admin Editing & Management Methods
console.log('▶ Test 5: Google Sheets Admin Schedule Editing');
SheetModule.setWeeklyScheduleDay('週二', '五星級牛排便當', '11:00', '', '特製黑椒牛排', true);
const updatedTue = SheetModule.getScheduleByDay('週二');
assert.strictEqual(updatedTue.restaurantName, '五星級牛排便當');
assert.strictEqual(updatedTue.cutoffTime, '11:00');
console.log('  ✔ Admin schedule update in Sheet verified.\n');

// 6. Webhook Entrypoint Test
console.log('▶ Test 6: Webhook HTTP Endpoints');
const getRes = CodeModule.doGet({});
assert.strictEqual(getRes.status, 'online');
assert.ok(getRes.features.includes('weekly-batch-schedule'));

const postRes = CodeModule.doPost({
  postData: {
    contents: JSON.stringify({
      events: [
        {
          type: 'message',
          replyToken: 'token_webhook',
          source: { groupId: 'g1', userId: 'u1' },
          message: { type: 'text', text: '本週菜單' }
        }
      ]
    })
  }
});
assert.strictEqual(postRes.statusCode, 200);
console.log('  ✔ Webhook doPost and doGet passed.\n');

// 7. Test Past Day Locks, Today Cutoff Locks, Organizer Notifications & UserNickname
console.log('▶ Test 7: Past Day & Cutoff Locks, Organizer Push, and UserNickname Column');

// 7-1: Simulate Wednesday 10:00 AM (週三, before cutoff)
globalThis._mockCurrentDate = new Date('2026-09-09T10:00:00+08:00');
assert.strictEqual(OrderModule.getTodayDayOfWeek(), '週三');
assert.strictEqual(OrderModule.isDayPast('週一'), true);
assert.strictEqual(OrderModule.isDayPast('週二'), true);
assert.strictEqual(OrderModule.isDayPast('週三'), false);
assert.strictEqual(OrderModule.isDayPast('週四'), false);
assert.strictEqual(OrderModule.isDayPast('週五'), false);

// Alice tries to cancel a past day's order (週一) -> Should be rejected
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_past_day',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 週一 全部' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已超過日期') && lastReply.text.includes('無法修改或取消'));

// Alice checks weekly orders -> 週一 shows locked tag
OrderModule.handleTextMessage({
  replyToken: 'token_my_orders_past',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的本週訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('【週一 🔒[已過期]】'));
console.log('  ✔ Past day cancellation rejected and locked tag displayed.');

// 7-2: Simulate Wednesday 10:45 AM (週三, past cutoff 10:30)
globalThis._mockCurrentDate = new Date('2026-09-09T10:45:00+08:00');
assert.strictEqual(OrderModule.isTodayCutoffPassed('週三'), true);

// Alice tries to cancel today's order after cutoff -> Should be rejected
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_today_cutoff',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 週三 全部' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已超過結單時間') && lastReply.text.includes('無法修改或取消'));

// Alice checks today's orders -> shows cutoff notice
OrderModule.handleTextMessage({
  replyToken: 'token_my_orders_today_cutoff',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('🔒[已截止]'));
assert.ok(lastReply.text.includes('今日點餐已超過截止時間'));

// Interactive cancel menu reflects lock status
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_menu_cutoff',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消餐點' }
});
assert.strictEqual(lastReply.type, 'flex');
const cancelCardJson = JSON.stringify(lastReply.flex);
assert.ok(cancelCardJson.includes('已過期') || cancelCardJson.includes('已截止'));
console.log('  ✔ Today past cutoff cancellation rejected, status tags and lock badges verified.');

// 7-3: Organizer Notification on Add and Cancel
SheetModule.setConfigValue('ORGANIZER_ID', 'organizer_boss_line_id');
globalThis._mockCurrentDate = new Date('2026-09-09T10:00:00+08:00'); // Reset to 10:00 AM
lastPush = null;

// Bob orders for Friday
OrderModule.handleTextMessage({
  replyToken: 'token_bob_order_thu',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '週五 舒肥嫩雞胸餐盒+1' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastPush !== null);
assert.strictEqual(lastPush.to, 'organizer_boss_line_id');
assert.ok(lastPush.text.includes('【訂餐通知 - 新增加訂】'));
assert.ok(lastPush.text.includes('舒肥嫩雞胸餐盒'));
assert.ok(lastPush.text.includes('小鮑伯'));

// Bob cancels Friday order
lastPush = null;
OrderModule.handleTextMessage({
  replyToken: 'token_bob_cancel_thu',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '取消 週五 舒肥嫩雞胸餐盒' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已為您取消'));
assert.ok(lastPush !== null);
assert.strictEqual(lastPush.to, 'organizer_boss_line_id');
assert.ok(lastPush.text.includes('【訂餐通知 - 取消餐點】'));
assert.ok(lastPush.text.includes('舒肥嫩雞胸餐盒'));
assert.ok(lastPush.text.includes('小鮑伯'));
console.log('  ✔ LINE push notification to ORGANIZER_ID on additions and cancellations verified.');

// 7-4: Verify UserNickname Column in Orders Sheet
const colIndices14 = SheetModule._getOrderColumnIndexes([
  'OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'
]);
assert.strictEqual(colIndices14.userNickname, 7);
assert.strictEqual(colIndices14.itemName, 8);
assert.strictEqual(colIndices14.status, 12);
assert.strictEqual(colIndices14.paid, 13);

const colIndices13 = SheetModule._getOrderColumnIndexes([
  'OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'
]);
assert.strictEqual(colIndices13.userNickname, -1);
assert.strictEqual(colIndices13.itemName, 7);
assert.strictEqual(colIndices13.status, 11);

// Verify order record in mock store has userNickname
const effBobId = SheetModule.getEffectiveUserId ? SheetModule.getEffectiveUserId('user_bob') : 'user_bob';
const bobOrdersInStore = SheetModule._mockStore.Orders.filter(function (o) { return o.userId === 'user_bob' || o.userId === effBobId; });
assert.ok(bobOrdersInStore.length > 0);
assert.strictEqual(bobOrdersInStore[0].userNickname, '小鮑伯');
console.log('  ✔ Orders sheet UserNickname column and dynamic header mapping verified.');

// 7-5: Verify initSheets backfills all recently added Config variables
delete SheetModule._mockStore.Config['ORGANIZER_ID'];
delete SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'];
delete SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'];
delete SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'];
delete SheetModule._mockStore.Config['ALLOW_SWITCH_ORGANIZER'];
delete SheetModule._mockStore.Config['USER_IDENTIFIER_MODE'];
delete SheetModule._mockStore.Config['HASH_SALT'];
assert.strictEqual(SheetModule._mockStore.Config['ORGANIZER_ID'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['ALLOW_SWITCH_ORGANIZER'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['USER_IDENTIFIER_MODE'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['HASH_SALT'], undefined);

const initRes = SheetModule.initSheets();
assert.strictEqual(initRes, true);
assert.strictEqual(SheetModule._mockStore.Config['ORGANIZER_ID'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'], '');
assert.strictEqual(SheetModule._mockStore.Config['ALLOW_SWITCH_ORGANIZER'], 'true');
assert.strictEqual(SheetModule._mockStore.Config['USER_IDENTIFIER_MODE'], 'HASHED_ID');
assert.strictEqual(SheetModule._mockStore.Config['HASH_SALT'], '');
assert.strictEqual(SheetModule.getConfigValue('ORGANIZER_NAME'), '小幫手');
assert.strictEqual(SheetModule.getConfigValue('CLOSE_ORDER_SCOPE'), 'WEEKLY');
console.log('  ✔ initSheets automatically backfills all recently added Config variables.\n');

// 8. Test Organizer-Exclusive Cancellation Permissions and Confirmation Warnings
console.log('▶ Test 8: Organizer Cancellation Permissions & Confirmation Warnings');

SheetModule.setConfigValue('ORGANIZER_ID', 'user_boss');
SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');

// Setup: Alice orders for Thursday, Bob orders for Thursday, Carol orders for Friday
SheetModule.addOrder({ userId: 'user_alice', groupId: groupId, itemName: '招牌三寶飯', quantity: 1, price: 110, userName: '愛麗絲', userNickname: '愛麗絲', dayOfWeek: '週四' });
SheetModule.addOrder({ userId: 'user_bob', groupId: groupId, itemName: '脆皮燒肉飯', quantity: 1, price: 105, userName: '小鮑伯', userNickname: '小鮑伯', dayOfWeek: '週四' });
SheetModule.addOrder({ userId: 'user_carol', groupId: groupId, itemName: '舒肥嫩雞胸餐盒', quantity: 1, price: 110, userName: '卡蘿', userNickname: '卡蘿', dayOfWeek: '週五' });

// 8-1: Non-organizer (Alice) tries to cancel Bob's meal -> REJECTED
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_bob',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 小鮑伯 脆皮燒肉飯' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('除了開單人，不能取消其他使用者的餐點'));
var bobOrdersAfter = SheetModule.getUserOrders('user_bob', groupId, null, '週四');
assert.strictEqual(bobOrdersAfter.length, 1);
console.log('  ✔ Non-organizer is blocked from cancelling other users\' meals.');

// 8-2: Organizer (Boss) cancels Bob's meal -> ALLOWED
OrderModule.handleTextMessage({
  replyToken: 'token_boss_cancel_bob',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消 小鮑伯 脆皮燒肉飯' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已由開單人為【小鮑伯】取消'));
bobOrdersAfter = SheetModule.getUserOrders('user_bob', groupId, null, '週四');
assert.strictEqual(bobOrdersAfter.length, 0);
console.log('  ✔ Organizer is permitted to cancel another user\'s meal.');

// 8-3: Non-organizer tries to cancel all meals of the day -> REJECTED
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_all_day',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消當日所有餐點' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('只有開單人可以取消當日所有餐點'));
console.log('  ✔ Non-organizer is blocked from cancelling all meals of the day.');

// 8-4: Organizer requests cancelling all meals for Thursday -> Warning confirmation card returned
OrderModule.handleTextMessage({
  replyToken: 'token_boss_req_day_cancel',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消全體 週四' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('開單人取消當日全體餐點確認'));
var confirmDayFlexJson = JSON.stringify(lastReply.flex);
assert.ok(confirmDayFlexJson.includes('確認取消全體 週四'));
assert.ok(confirmDayFlexJson.includes('⚠️ 警告：此操作將影響全體成員且無法復原！'));

// 8-5: Organizer confirms cancelling all meals for Thursday -> Executed!
OrderModule.handleTextMessage({
  replyToken: 'token_boss_confirm_day_cancel',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '確認取消全體 週四' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已由開單人成功取消【週四】全體成員的所有餐點紀錄'));
var aliceThuOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週四');
assert.strictEqual(aliceThuOrders.length, 0);
console.log('  ✔ Organizer cancelling all meals of the day requires two-step confirmation.');

// 8-6: Non-organizer tries to cancel all advance orders -> REJECTED
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_all_adv',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消所有未截止預約訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('只有開單人可以取消所有未截止預約訂單'));

// Plain "取消 全部" by non-organizer is also blocked
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_all_plain',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 全部' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('只有開單人可以取消全體預約訂單'));
console.log('  ✔ Non-organizer is blocked from cancelling all advance orders.');

// 8-7: Organizer requests cancelling all advance orders -> Warning confirmation card returned
OrderModule.handleTextMessage({
  replyToken: 'token_boss_req_all_adv',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消所有未截止預約訂單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('開單人取消全體預約訂單確認'));
var confirmAllFlexJson = JSON.stringify(lastReply.flex);
assert.ok(confirmAllFlexJson.includes('確認取消所有未截止預約訂單'));

// Test abandon cancellation
OrderModule.handleTextMessage({
  replyToken: 'token_boss_abandon_cancel',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '放棄取消' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已放棄取消操作'));
var carolOrders = SheetModule.getUserOrders('user_carol', groupId, null, '週五');
assert.strictEqual(carolOrders.length, 1);

// Organizer confirms cancelling all un-cutoff advance orders -> Executed!
OrderModule.handleTextMessage({
  replyToken: 'token_boss_confirm_all_adv',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '確認取消所有未截止預約訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已由開單人成功取消全體成員所有未截止梯次的預約訂單'));
carolOrders = SheetModule.getUserOrders('user_carol', groupId, null, '週五');
assert.strictEqual(carolOrders.length, 0);
console.log('  ✔ Organizer cancelling all advance orders requires two-step confirmation.');

// 8-8: Cancel order menu differentiation for regular user vs organizer
SheetModule.addOrder({ userId: 'user_alice', groupId: groupId, itemName: '古早味紅茶', quantity: 1, price: 25, userName: '愛麗絲', userNickname: '愛麗絲', dayOfWeek: '週五' });
OrderModule.handleTextMessage({
  replyToken: 'token_alice_menu',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消餐點' }
});
var aliceMenuJson = JSON.stringify(lastReply.flex);
assert.ok(aliceMenuJson.includes('個人進行中訂單'));
assert.ok(aliceMenuJson.includes('取消我的【週五】餐點'));
assert.ok(!aliceMenuJson.includes('開單人管理專區'));

SheetModule.addOrder({ userId: 'user_boss', groupId: groupId, itemName: '古早味紅茶', quantity: 1, price: 25, userName: '老闆', userNickname: '老闆', dayOfWeek: '週五' });
OrderModule.handleTextMessage({
  replyToken: 'token_boss_menu',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消餐點' }
});
var bossMenuJson = JSON.stringify(lastReply.flex);
assert.ok(bossMenuJson.includes('(開單人)'));
assert.ok(bossMenuJson.includes('個人進行中訂單'));
assert.ok(bossMenuJson.includes('古早味紅茶'));
assert.ok(bossMenuJson.includes('開單人管理專區'));
assert.ok(bossMenuJson.includes('取消當日所有餐點'));
assert.ok(bossMenuJson.includes('取消所有未截止預約訂單'));
console.log('  ✔ Interactive cancel menu correctly differentiated between member and organizer.');

// 8-9: Regular user's cancel menu NEVER contains other users' orders
SheetModule.addOrder({ userId: 'user_bob', groupId: groupId, itemName: '舒肥嫩雞胸餐盒', quantity: 1, price: 110, userName: '小鮑伯', userNickname: '小鮑伯', dayOfWeek: '週五' });
OrderModule.handleTextMessage({
  replyToken: 'token_alice_menu_isolation',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消' }
});
var aliceIsolatedMenuJson = JSON.stringify(lastReply.flex);
assert.ok(aliceIsolatedMenuJson.includes('古早味紅茶'), 'Alice should see her own red tea');
assert.ok(!aliceIsolatedMenuJson.includes('舒肥嫩雞胸餐盒'), 'Alice must NEVER see Bob\'s chicken box in cancel menu');
assert.ok(!aliceIsolatedMenuJson.includes('小鮑伯'), 'Alice cancel menu must not include Bob\'s name');
console.log('  ✔ Regular user cancel menu strictly isolates orders and never shows other people\'s meals.');

// 8-10: Member enters dish name ordered by another member (without prefixing name): rejects based on UserName comparison
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_bobs_dish',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 舒肥嫩雞胸餐盒' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('除了開單人，不能取消其他使用者的餐點'));
assert.ok(lastReply.text.includes('小鮑伯'), 'Error message identifies the actual buyer');
var bobChickenOrders = SheetModule.getUserOrders('user_bob', groupId, null, '週五', '小鮑伯');
assert.strictEqual(bobChickenOrders.length, 1, 'Bob\'s chicken box must remain active and unaffected');
console.log('  ✔ Member attempting to cancel another member\'s dish is rejected via UserName comparison.');

// 8-11: Identical dishes ordered by both member and another member: only member's own dish cancelled
SheetModule.addOrder({ userId: 'user_alice', groupId: groupId, itemName: '舒肥嫩雞胸餐盒', quantity: 1, price: 110, userName: '愛麗絲', userNickname: '愛麗絲', dayOfWeek: '週五' });
OrderModule.handleTextMessage({
  replyToken: 'token_alice_cancel_own_chicken',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 舒肥嫩雞胸餐盒' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已為您取消'));
var aliceChickenAfter = SheetModule.getUserOrders('user_alice', groupId, null, '週五', '愛麗絲').filter(function (o) { return o.itemName === '舒肥嫩雞胸餐盒'; });
assert.strictEqual(aliceChickenAfter.length, 0, 'Alice\'s chicken box cancelled');
bobChickenOrders = SheetModule.getUserOrders('user_bob', groupId, null, '週五', '小鮑伯').filter(function (o) { return o.itemName === '舒肥嫩雞胸餐盒'; });
assert.strictEqual(bobChickenOrders.length, 1, 'Bob\'s chicken box still active');
console.log('  ✔ When cancelling identical dish, only sender\'s own order is cancelled and others are preserved.');

// 8-12: Organizer cancel menu strictly shows personal orders only (never other members' meals in menu list)
OrderModule.handleTextMessage({
  replyToken: 'token_boss_menu_all',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消' }
});
var bossAllMenuJson = JSON.stringify(lastReply.flex);
assert.ok(bossAllMenuJson.includes('古早味紅茶'), 'Organizer menu displays own order');
assert.ok(!bossAllMenuJson.includes('小鮑伯'), 'Organizer cancel menu must NEVER display Bob\'s name in personal menu');
assert.ok(!bossAllMenuJson.includes('舒肥嫩雞胸餐盒'), 'Organizer cancel menu must NEVER display Bob\'s items in personal menu');
assert.ok(bossAllMenuJson.includes('開單人管理專區'), 'Organizer menu displays admin batch buttons at bottom');

// Organizer cancels member's dish via targeted command: "取消 小鮑伯 週五 舒肥嫩雞胸餐盒"
OrderModule.handleTextMessage({
  replyToken: 'token_boss_cancel_member_dish',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '取消 小鮑伯 週五 舒肥嫩雞胸餐盒' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已由開單人為【小鮑伯】取消'));
var bobOrdersFinal = SheetModule.getUserOrders('user_bob', groupId, null, '週五', '小鮑伯');
assert.strictEqual(bobOrdersFinal.length, 0, 'Bob\'s chicken box is now cancelled by organizer targeted command');
console.log('  ✔ Organizer cancel menu strictly isolates personal orders, and organizer uses command to cancel member items.\n');

// 9. Daily Summary (今日統計) & Timezone Diagnostics
console.log('▶ Test 9: Daily Summary (今日統計), Member Order Roster & TimeZone Diagnostics');
globalThis._mockCurrentDate = new Date('2026-09-08T10:00:00+08:00'); // Tuesday 10:00 AM
SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');

// Add orders for Tuesday:
// 1) An advance order placed yesterday (date: '2026-09-07', dayOfWeek: '週二') by Carol
SheetModule.addOrder({
  orderId: 'ORD_ADV_TUE',
  date: '2026-09-07',
  dayOfWeek: '週二',
  groupId: groupId,
  userId: 'user_carol',
  userName: '卡蘿',
  userNickname: '卡蘿',
  itemName: '日式厚切豬排飯',
  quantity: 1,
  price: 120
});

// 2) An order placed today (date: '2026-09-08', dayOfWeek: '週二') by Alice
SheetModule.addOrder({
  orderId: 'ORD_TODAY_TUE',
  date: '2026-09-08',
  dayOfWeek: '週二',
  groupId: groupId,
  userId: 'user_alice',
  userName: '愛麗絲',
  userNickname: '愛麗絲',
  itemName: '日式厚切豬排飯',
  quantity: 2,
  price: 120
});

// Test command: "今日統計"
OrderModule.handleTextMessage({
  replyToken: 'token_today_summary_1',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日統計' }
});
assert.strictEqual(lastReply.type, 'flex', '今日統計 command must reply with a Flex message');
var todaySummaryJson = JSON.stringify(lastReply.flex);
assert.ok(todaySummaryJson.includes('日式厚切豬排飯 x3'), 'Both advance booking and today order must be included (1 + 2 = 3)');
assert.ok(todaySummaryJson.includes('卡蘿') && todaySummaryJson.includes('愛麗絲'), 'Item buyers must be displayed under dish');
assert.ok(todaySummaryJson.includes('今日成員應付名冊'), 'Summary card must include member roster section');
assert.ok(todaySummaryJson.includes('$120 元') && todaySummaryJson.includes('$240 元'), 'Member owed amounts must be displayed');

// Test alias: "本日統計"
OrderModule.handleTextMessage({
  replyToken: 'token_today_summary_2',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '本日統計' }
});
assert.strictEqual(lastReply.type, 'flex', '本日統計 alias must also trigger summary');

// Test alias: "統計"
OrderModule.handleTextMessage({
  replyToken: 'token_today_summary_3',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '統計' }
});
assert.strictEqual(lastReply.type, 'flex', '統計 command must trigger summary');

// Test Independence: 今日統計 must NEVER include advance orders for other days, regardless of CLOSE_ORDER_SCOPE or ORDER_RECEIPT_SCOPE
SheetModule.addOrder({
  date: '2026-09-08',
  dayOfWeek: '週三',
  groupId: groupId,
  userId: 'user_bob',
  userName: '小鮑伯',
  userNickname: '小鮑伯',
  itemName: '招牌鍋貼(10顆)',
  quantity: 2,
  price: 70
});
// Verify with CLOSE_ORDER_SCOPE = WEEKLY & ORDER_RECEIPT_SCOPE = WEEKLY
SheetModule.setConfigValue('CLOSE_ORDER_SCOPE', 'WEEKLY');
SheetModule.setConfigValue('ORDER_RECEIPT_SCOPE', 'WEEKLY');
OrderModule.handleTextMessage({
  replyToken: 'token_today_scope_weekly',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日統計' }
});
var weeklyScopeSumJson = JSON.stringify(lastReply.flex);
assert.ok(!weeklyScopeSumJson.includes('招牌鍋貼'), 'Wednesday advance order must NOT appear in Tuesday summary even when scope is WEEKLY');
assert.ok(weeklyScopeSumJson.includes('日式厚切豬排飯 x3'), 'Tuesday orders must be accurately preserved');

// Verify with CLOSE_ORDER_SCOPE = DAILY & ORDER_RECEIPT_SCOPE = DAILY
SheetModule.setConfigValue('CLOSE_ORDER_SCOPE', 'DAILY');
SheetModule.setConfigValue('ORDER_RECEIPT_SCOPE', 'DAILY');
OrderModule.handleTextMessage({
  replyToken: 'token_today_scope_daily',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日統計' }
});
var dailyScopeSumJson = JSON.stringify(lastReply.flex);
assert.ok(!dailyScopeSumJson.includes('招牌鍋貼'), 'Wednesday advance order must NOT appear in Tuesday summary when scope is DAILY');

// Verify calling 今日統計 when IS_ORDERING_OPEN is false (after 結單)
SheetModule.setConfigValue('IS_ORDERING_OPEN', 'false');
OrderModule.handleTextMessage({
  replyToken: 'token_today_after_closed',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日統計' }
});
var closedSumJson = JSON.stringify(lastReply.flex);
assert.ok(closedSumJson.includes('已截止'), 'Status should reflect closed order');
assert.ok(!closedSumJson.includes('招牌鍋貼'), 'Closed today summary still strictly queries only today data');
assert.ok(closedSumJson.includes('日式厚切豬排飯 x3'), 'Today order count remains exact');

// Verify Help Card command for 今日統計 & footer license
var defaultSourceUrl = SheetModule.getConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee');
assert.strictEqual(defaultSourceUrl, 'https://tinyurl.com/4c92wtee', 'Default SOURCE_CODE_URL in Config must be tinyurl link');

var helpCard = FlexModule.createHelpFlex(defaultSourceUrl);
var helpJson = JSON.stringify(helpCard);
assert.ok(helpJson.includes('"text":"今日統計"'), 'Help card button for 今日統計 must explicitly dispatch 今日統計 command');
assert.ok(helpJson.includes('服務授權：AGPL-3.0 原始碼 https://tinyurl.com/4c92wtee'), 'Help card footer must display AGPL license and source code link');

// Test dynamic SOURCE_CODE_URL update from Config (AGPL-3.0 compliance requirement)
SheetModule.setConfigValue('SOURCE_CODE_URL', 'https://github.com/custom-user/custom-order-linebot');
OrderModule.handleTextMessage({
  replyToken: 'token_help_custom_url',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '幫助' }
});
var customHelpJson = JSON.stringify(lastReply.flex);
assert.ok(customHelpJson.includes('服務授權：AGPL-3.0 原始碼 https://github.com/custom-user/custom-order-linebot'), 'Help card footer must dynamically reflect custom repo URL from Config');
assert.ok(customHelpJson.includes('"uri":"https://github.com/custom-user/custom-order-linebot"'), 'Help card action URI must match custom repo URL');
SheetModule.setConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee'); // Restore default

console.log('  ✔ 今日統計 & 動態 SOURCE_CODE_URL (AGPL-3.0) 授權連結 verified.');

// Test checkTimeZoneAndCurrentTime diagnostic tool
var timeDiag = SheetModule.checkTimeZoneAndCurrentTime();
assert.ok(timeDiag, 'timeDiag must return diagnostic object');
assert.ok(timeDiag.localTime.includes('2026-09-08'), 'Diagnosed local time must match reference date');
assert.strictEqual(timeDiag.dayOfWeek, '週二', 'Diagnosed day of week must be 週二');
assert.ok(timeDiag.formattedMessage.includes('【系統時區與時間診斷資訊】'), 'Diagnostic message formatted properly');

// Test dynamic Spreadsheet TimeZone reading (verify absence of hardcoded timezone)
assert.strictEqual(SheetModule.getSpreadsheetTimeZone(), 'Asia/Taipei', 'Default spreadsheet timezone is Asia/Taipei');
globalThis._mockSpreadsheetTimeZone = 'America/New_York';
assert.strictEqual(SheetModule.getSpreadsheetTimeZone(), 'America/New_York', 'Must read dynamically configured spreadsheet timezone');
assert.strictEqual(OrderModule.getAppTimeZone(), 'America/New_York', 'OrderModule must honor spreadsheet timezone');
var nyDiag = SheetModule.checkTimeZoneAndCurrentTime();
assert.strictEqual(nyDiag.effectiveTimeZone, 'America/New_York');
assert.strictEqual(nyDiag.spreadsheetTimeZone, 'America/New_York');
assert.ok(nyDiag.formattedMessage.includes('• 系統運行採用時區 (Effective TimeZone): America/New_York'));

// Test DayOfWeek normalization, flexible header mapping, and date format robustness
assert.strictEqual(SheetModule.normalizeDayOfWeek('週一'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('星期一'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('周一'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('禮拜一'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('1'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('Mon'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('Monday'), '週一');
assert.strictEqual(SheetModule.normalizeDayOfWeek('週日'), '週日');
assert.strictEqual(SheetModule.normalizeDayOfWeek('星期天'), '週日');
assert.strictEqual(SheetModule.normalizeDayOfWeek('ALL'), 'ALL');
assert.strictEqual(SheetModule.normalizeDayOfWeek('今日'), '今日');

// Test _matchOrderTiming with variations of DayOfWeek and Date
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-07', '星期一', '2026-09-07', '週一'), true, '星期一 must match 週一');
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-07', '周一', '2026-09-07', '週一'), true, '周一 must match 週一');
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-07', '禮拜一', '2026-09-07', '週一'), true, '禮拜一 must match 週一');
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-07', 'Mon', '2026-09-07', '週一'), true, 'Mon must match 週一');
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-07', '', '2026-09-07', '週一'), true, 'Empty day must match today date');
assert.strictEqual(SheetModule._matchOrderTiming('2026-09-06', '', '2026-09-07', '週一'), false, 'Empty day with different date must not match');

// Test _getOrderColumnIndexes with 12-column legacy headers (dayOfWeek must be -1, NOT 3)
var legacy12 = ['OrderId', 'Timestamp', 'Date', 'GroupId', 'UserId', 'UserName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'];
var legacyColMap = SheetModule._getOrderColumnIndexes(legacy12);
assert.strictEqual(legacyColMap.dayOfWeek, -1, 'dayOfWeek must be -1 when column is missing in headers, preventing GroupId collision');
assert.strictEqual(legacyColMap.groupId, 3, 'groupId must be at index 3 in legacy sheet');

// Test _getOrderColumnIndexes with various header naming styles
var variations1 = ['OrderId', 'Timestamp', 'Date', '星期幾', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'];
assert.strictEqual(SheetModule._getOrderColumnIndexes(variations1).dayOfWeek, 3, '星期幾 must be recognized as dayOfWeek');

var variations2 = ['OrderId', 'Timestamp', 'Date', 'Day of Week', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'];
assert.strictEqual(SheetModule._getOrderColumnIndexes(variations2).dayOfWeek, 3, 'Day of Week must be recognized as dayOfWeek');

var variations3 = ['OrderId', 'Timestamp', 'Date', 'day_of_week', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'];
assert.strictEqual(SheetModule._getOrderColumnIndexes(variations3).dayOfWeek, 3, 'day_of_week must be recognized as dayOfWeek');

var variations4 = ['OrderId', 'Timestamp', 'Date', '梯次/星期', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid'];
assert.strictEqual(SheetModule._getOrderColumnIndexes(variations4).dayOfWeek, 3, '梯次/星期 must be recognized as dayOfWeek');

// Test natural language command aliases for 今日統計
OrderModule.handleTextMessage({
  replyToken: 'token_alias_order_today_1',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日訂單' }
});
assert.strictEqual(lastReply.type, 'flex', '今日訂單 alias must trigger summary card');

OrderModule.handleTextMessage({
  replyToken: 'token_alias_order_today_2',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日訂餐統計' }
});
assert.strictEqual(lastReply.type, 'flex', '今日訂餐統計 alias must trigger summary card');

console.log('  ✔ DayOfWeek normalization, header mapping robustness, and date formatting verified.');

// Clean up mock timezone and mock date
globalThis._mockSpreadsheetTimeZone = null;
globalThis._mockCurrentDate = null;
console.log('  ✔ Dynamic spreadsheet timezone reading & diagnostic tool verified.');

// Test 9.2: Verify createSummaryFlex conforms 100% to LINE Flex schema and member details
var sampleSummary = {
  date: '2026-09-07',
  dayOfWeek: '週一',
  totalQuantity: 3,
  totalAmount: 320,
  items: [
    { itemName: '招牌便當', quantity: 2, price: 100, subtotal: 200, buyers: ['愛麗絲', '小鮑伯'] },
    { itemName: '雞腿便當', quantity: 1, price: 120, subtotal: 120, buyers: ['愛麗絲'] }
  ],
  users: [
    { userName: '愛麗絲', items: ['招牌便當x1', '雞腿便當x1'], total: 220 },
    { userName: '小鮑伯', items: ['招牌便當x1'], total: 100 }
  ]
};

var summaryFlex = FlexModule.createSummaryFlex('美味食堂', sampleSummary, false, null);
var summaryFlexJson = JSON.stringify(summaryFlex);
assert.ok(!summaryFlexJson.includes('"paddingAll":"xxs"'), 'Summary flex must never contain paddingAll xxs');
assert.ok(!summaryFlexJson.includes('"padding":"xxs"'), 'Summary flex must never contain padding xxs');
assert.strictEqual(summaryFlex.size, 'mega', 'Summary flex size must be mega');
assert.ok(summaryFlexJson.includes('愛麗絲'), 'Summary flex must include member name');
assert.ok(summaryFlexJson.includes('220'), 'Summary flex must include member owed total');
assert.ok(summaryFlexJson.includes('小鮑伯'), 'Summary flex must include member name');
assert.ok(summaryFlexJson.includes('100'), 'Summary flex must include member owed total');
assert.ok(summaryFlexJson.includes('招牌便當x1、雞腿便當x1'), 'Summary flex must list items per member');

// Test 9.3: formatOrderSummaryText output
var plainTextSummary = OrderModule.formatOrderSummaryText('美味食堂', sampleSummary, false);
assert.ok(plainTextSummary.includes('美味食堂'), 'Plain text summary must contain restaurant name');
assert.ok(plainTextSummary.includes('招牌便當 x 2 ＝ $200 (愛麗絲, 小鮑伯)'), 'Plain text summary must list dish subtotal and buyers');
assert.ok(plainTextSummary.includes('愛麗絲：招牌便當x1、雞腿便當x1 ＝ $220 元'), 'Plain text summary must show member items and amount');
assert.ok(plainTextSummary.includes('小鮑伯：招牌便當x1 ＝ $100 元'), 'Plain text summary must show member items and amount');
assert.ok(plainTextSummary.includes('總計：3 份 / $320 元'), 'Plain text summary must show grand total');

// Test 9.4: Text command 今日文字統計
OrderModule.handleTextMessage({
  replyToken: 'token_text_summary',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '今日文字統計' }
});
assert.strictEqual(lastReply.type, 'text', '今日文字統計 must return plain text');
assert.ok(lastReply.text.includes('今日訂餐統計'), 'Text summary must include title');

console.log('  ✔ createSummaryFlex schema validity, plain-text summary, and member roster verified.\n');

// ==========================================
// TEST 10: Multi-Child Meal Allocation, Children Management & Quick Reply Flow
// ==========================================
console.log('▶ Test 10: Multi-Child Meal Allocation, Children Management & Quick Reply Flow');

// 10-1: Syntax Parsing with child names and multi-kid split
const t10_p1 = OrderModule.parseOrderText('+1 招牌便當 (大寶)');
assert.strictEqual(t10_p1.length, 1);
assert.strictEqual(t10_p1[0].itemName, '招牌便當');
assert.strictEqual(t10_p1[0].quantity, 1);
assert.strictEqual(t10_p1[0].childName, '大寶');

const t10_p2 = OrderModule.parseOrderText('+1 雞腿便當（小寶）');
assert.strictEqual(t10_p2.length, 1);
assert.strictEqual(t10_p2[0].itemName, '雞腿便當');
assert.strictEqual(t10_p2[0].childName, '小寶');

const t10_p3 = OrderModule.parseOrderText('+2 排骨飯 (大寶, 二寶)');
assert.strictEqual(t10_p3.length, 2, 'Multi-child split must produce 2 individual order items');
assert.strictEqual(t10_p3[0].itemName, '排骨飯');
assert.strictEqual(t10_p3[0].quantity, 1);
assert.strictEqual(t10_p3[0].childName, '大寶');
assert.strictEqual(t10_p3[1].itemName, '排骨飯');
assert.strictEqual(t10_p3[1].quantity, 1);
assert.strictEqual(t10_p3[1].childName, '二寶');

const t10_p4 = OrderModule.parseOrderText('大寶: 排骨飯+1');
assert.strictEqual(t10_p4.length, 1);
assert.strictEqual(t10_p4[0].itemName, '排骨飯');
assert.strictEqual(t10_p4[0].quantity, 1);
assert.strictEqual(t10_p4[0].childName, '大寶');

const t10_p5 = OrderModule.parseOrderText('週一 排骨飯+1 (大寶)');
assert.strictEqual(t10_p5.length, 1);
assert.strictEqual(t10_p5[0].dayOfWeek, '週一');
assert.strictEqual(t10_p5[0].itemName, '排骨飯');
assert.strictEqual(t10_p5[0].childName, '大寶');

console.log('  ✔ Multi-child syntax parsing, bracket extraction, and comma split verified.');

// 10-2: Children Tab CRUD API & Commands
SheetModule.setChildren('user_alice', 'Alice', '愛麗絲', ['大寶', '二寶']);
const aliceKids = SheetModule.getChildren('user_alice');
assert.deepStrictEqual(aliceKids, ['大寶', '二寶'], 'Alice should have 大寶 and 二寶 registered');

SheetModule.saveChild('user_alice', 'Alice', '愛麗絲', '小寶', '附小三年二班');
const aliceKids2 = SheetModule.getChildren('user_alice');
assert.deepStrictEqual(aliceKids2, ['大寶', '二寶', '小寶'], 'Alice should now have 3 children');

SheetModule.deleteChild('user_alice', '小寶');
assert.deepStrictEqual(SheetModule.getChildren('user_alice'), ['大寶', '二寶'], '小寶 deleted');

// Test Children management commands via handleTextMessage
OrderModule.handleTextMessage({
  replyToken: 'token_kids_list',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的小孩' }
});
assert.strictEqual(lastReply.type, 'flex', '我的小孩 must reply with children list flex card');
const kidsFlexJson = JSON.stringify(lastReply.flex);
assert.ok(kidsFlexJson.includes('大寶'), 'Kids flex card must include 大寶');
assert.ok(kidsFlexJson.includes('二寶'), 'Kids flex card must include 二寶');

// Test set children command
OrderModule.handleTextMessage({
  replyToken: 'token_kids_set',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '設定小孩 寶一, 寶二' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('成功設定小孩名冊'));
assert.deepStrictEqual(SheetModule.getChildren('user_alice'), ['寶一', '寶二']);

// Reset Alice kids back to 大寶, 二寶
SheetModule.setChildren('user_alice', 'Alice', '愛麗絲', ['大寶', '二寶']);

// Test parameter-less fallback checks and children submenu commands
OrderModule.handleTextMessage({
  replyToken: 'token_kids_menu_cmd',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '小孩選單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, '👶 小孩與用餐對象管理選單');

OrderModule.handleTextMessage({
  replyToken: 'token_add_kid_empty',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '新增小孩' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('請輸入小孩姓名與班級備註'));

OrderModule.handleTextMessage({
  replyToken: 'token_del_kid_empty',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '刪除小孩' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('請輸入欲刪除的小孩姓名'));

console.log('  ✔ Children tab CRUD API, flex card, and management commands verified.');

// 10-3: Quick Reply UX Trigger Test (Option 2 + Option 1)
globalThis._mockCurrentDate = new Date('2026-09-07T02:00:00.000Z'); // Monday 10:00 AM Taipei
SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');

// Alice (has kids) orders without bracket: "+1 招牌三寶飯"
OrderModule.handleTextMessage({
  replyToken: 'token_quick_reply',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '+1 招牌三寶飯' }
});
assert.strictEqual(lastReply.type, 'quick_reply', 'Ordering without child designation for parent must trigger Quick Reply');
assert.ok(lastReply.text.includes('分配給哪位小孩或自己'), 'Prompt text guides user to pick recipient');
const qrItems = lastReply.quickReply.items;
assert.strictEqual(qrItems.length, 4, 'Must have 4 items: 大寶, 二寶, 本人, 其他備註');
assert.strictEqual(qrItems[0].action.label, '👦 大寶');
assert.strictEqual(qrItems[0].action.text, '+1 招牌三寶飯 (大寶)');
assert.strictEqual(qrItems[1].action.label, '👦 二寶');
assert.strictEqual(qrItems[1].action.text, '+1 招牌三寶飯 (二寶)');
assert.strictEqual(qrItems[2].action.label, '👤 本人');
assert.strictEqual(qrItems[2].action.text, '+1 招牌三寶飯 (本人)');
assert.strictEqual(qrItems[3].action.label, '✏️ 其他備註');
assert.strictEqual(qrItems[3].action.inputOption, 'openKeyboard');
assert.strictEqual(qrItems[3].action.fillInText, '+1 招牌三寶飯 ()');

// Non-parent (Bob, who has no children registered) orders without bracket: "+1 脆皮燒肉飯"
OrderModule.handleTextMessage({
  replyToken: 'token_bob_no_kids',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '+1 脆皮燒肉飯' }
});
assert.strictEqual(lastReply.type, 'flex', 'Single member without kids immediately completes order with receipt flex');

console.log('  ✔ Quick Reply floating buttons & openKeyboard option verified.');

// 10-4: Query & Child-Targeted Cancellation Precision
// Alice places orders for her kids
OrderModule.handleTextMessage({
  replyToken: 'token_alice_k1',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '+1 招牌三寶飯 (大寶)' }
});
assert.strictEqual(lastReply.type, 'flex');

OrderModule.handleTextMessage({
  replyToken: 'token_alice_k2',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '+1 脆皮燒肉飯 (二寶)' }
});
assert.strictEqual(lastReply.type, 'flex');

// Verify 我的訂單 displays child allocation tags
OrderModule.handleTextMessage({
  replyToken: 'token_alice_my_orders',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '我的訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('[大寶]'), 'My orders text must show [大寶]');
assert.ok(lastReply.text.includes('[二寶]'), 'My orders text must show [二寶]');

// Verify Interactive Cancel Order menu shows [大寶] and [二寶] with targeted cancel commands
const aliceActiveOrders = SheetModule.getUserOrders('user_alice', groupId, null, null, '愛麗絲');
const cancelFlexAlice = FlexModule.createCancelOrderFlex('愛麗絲', aliceActiveOrders, {}, false);
const cancelFlexAliceJson = JSON.stringify(cancelFlexAlice);
assert.ok(cancelFlexAliceJson.includes('[大寶]'), 'Cancel menu displays [大寶]');
assert.ok(cancelFlexAliceJson.includes('取消 今日 大寶 招牌三寶飯') || cancelFlexAliceJson.includes('取消 週一 大寶 招牌三寶飯'), 'Cancel command targets 大寶');

// Alice cancels only 大寶's dish: "取消 大寶 招牌三寶飯"
OrderModule.handleTextMessage({
  replyToken: 'token_cancel_kid_1',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '取消 大寶 招牌三寶飯' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已為您取消 [大寶] 「招牌三寶飯」'), 'Only 大寶 order cancelled');

// Verify that 二寶's dish is still active!
const aliceRemainingOrders = SheetModule.getUserOrders('user_alice', groupId, null, null, '愛麗絲');
const hasK1 = aliceRemainingOrders.some(function (o) { return o.childName === '大寶'; });
const hasK2 = aliceRemainingOrders.some(function (o) { return o.childName === '二寶'; });
assert.strictEqual(hasK1, false, '大寶 dish must be cancelled');
assert.strictEqual(hasK2, true, '二寶 dish must remain active');

console.log('  ✔ Child-targeted order query, cancel menu, and cancellation precision verified.');

// 10-5: Summary Presentation (Today Summary & Text Summary with Children Allocation)
const todaySummaryWithKids = SheetModule.getOrderSummary(groupId, '2026-09-07', '週一');
const textSummaryWithKids = OrderModule.formatOrderSummaryText('廣東正龍燒臘', todaySummaryWithKids, false);
assert.ok(textSummaryWithKids.includes('愛麗絲[二寶]'), 'Item buyers must show 愛麗絲[二寶]');
assert.ok(textSummaryWithKids.includes('二寶: 脆皮燒肉飯x1'), 'Member breakdown must list 二寶: 脆皮燒肉飯x1');

const flexSummaryWithKids = FlexModule.createSummaryFlex('廣東正龍燒臘', todaySummaryWithKids, false, null);
const flexSummaryJson = JSON.stringify(flexSummaryWithKids);
assert.ok(flexSummaryJson.includes('愛麗絲'), 'Flex summary must contain parent name');
assert.ok(flexSummaryJson.includes('二寶: 脆皮燒肉飯x1'), 'Flex summary member section shows child breakdown');

console.log('  ✔ Today Summary (Flex & Text) multi-child allocation breakdown verified.\n');

// 11. Custom Restaurant Tab Menu Import Tests
console.log('▶ Test 11: Custom Restaurant Tab Menu Import');
// 11-1: System tab detection
assert.strictEqual(SheetModule.isSystemTab('Config'), true);
assert.strictEqual(SheetModule.isSystemTab('Logs'), true);
assert.strictEqual(SheetModule.isSystemTab('WeeklySchedule'), true);
assert.strictEqual(SheetModule.isSystemTab('Menu'), true);
assert.strictEqual(SheetModule.isSystemTab('Orders'), true);
assert.strictEqual(SheetModule.isSystemTab('Children'), true);
assert.strictEqual(SheetModule.isSystemTab('Summary'), true);
assert.strictEqual(SheetModule.isSystemTab('orders'), true, 'Case-insensitive system tab check');
assert.strictEqual(SheetModule.isSystemTab('老王便當'), false, 'Custom tab is not a system tab');
assert.strictEqual(SheetModule.isSystemTab('金仙蝦捲飯'), false);

// 11-2: Validation & Error handling
const errEmpty = SheetModule.importCustomRestaurantMenu('週三', '');
assert.strictEqual(errEmpty.success, false);
assert.strictEqual(errEmpty.reason, 'EMPTY_NAME');

const errSystem = SheetModule.importCustomRestaurantMenu('週三', 'Orders');
assert.strictEqual(errSystem.success, false);
assert.strictEqual(errSystem.reason, 'SYSTEM_TAB');

const errNotFound = SheetModule.importCustomRestaurantMenu('週三', '不存在之餐廳');
assert.strictEqual(errNotFound.success, false);
assert.strictEqual(errNotFound.reason, 'NOT_FOUND');

// 11-3: Successful custom restaurant import
SheetModule._mockStore.CustomRestaurants = {
  '老王便當': [
    { dayOfWeek: '週三', restaurantName: '老王便當', category: '精選便當', itemName: '招牌滷肉飯', price: 65, isAvailable: true, description: '附滷蛋與酸菜' },
    { dayOfWeek: '週三', restaurantName: '老王便當', category: '精選便當', itemName: '酥炸雞排便當', price: 100, isAvailable: true, description: '現炸超大雞排' },
    { dayOfWeek: '週三', restaurantName: '老王便當', category: '湯品飲料', itemName: '冬瓜蛤蜊湯', price: 35, isAvailable: true, description: '' }
  ]
};

const impRes = SheetModule.importCustomRestaurantMenu('週三', '老王便當');
assert.strictEqual(impRes.success, true);
assert.strictEqual(impRes.restaurantName, '老王便當');
assert.strictEqual(impRes.dayOfWeek, '週三');
assert.strictEqual(impRes.count, 3);

// Verify WeeklySchedule was updated
const wedSchedule = SheetModule.getScheduleByDay('週三');
assert.strictEqual(wedSchedule.restaurantName, '老王便當');
assert.strictEqual(wedSchedule.notes, '從自訂餐廳匯入');

// Verify Menu was updated
const wedMenu = SheetModule.getMenuItems('週三', '老王便當');
assert.strictEqual(wedMenu.length, 3);
assert.strictEqual(wedMenu[0].itemName, '招牌滷肉飯');
assert.strictEqual(wedMenu[0].price, 65);
assert.strictEqual(wedMenu[1].itemName, '酥炸雞排便當');
assert.strictEqual(wedMenu[1].price, 100);

// 11-4: Chat command temporary dormancy verification
// Chat commands for custom restaurant import are temporarily disabled to prevent accidental member triggers
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_chat_disabled',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '匯入自訂餐廳 週三 老王便當' }
});
assert.ok(!lastReply || !lastReply.text || !lastReply.text.includes('已成功從自訂餐廳'), 'Chat command must remain dormant');

// 11-5: Dialog function exported
assert.strictEqual(typeof CodeModule.showCustomRestaurantImportDialog, 'function');
console.log('  ✔ Custom restaurant tab menu import verified (chat command dormant).\n');

// 12. Security Hardening Tests
console.log('▶ Test 12: Security Hardening (Privilege Escalation, Formula Injection, Organizer Switching Lock)');

// 12-1: Privilege escalation via LINE display name spoofing
SheetModule.setConfigValue('ORGANIZER_ID', 'user_boss');
SheetModule.setConfigValue('ORGANIZER_NAME', '老闆');

// Legitimate organizer has permission
assert.strictEqual(OrderModule.isUserOrganizer('user_boss', '任意暱稱'), true);
// Impostor with matching display name but different userId is rejected
assert.strictEqual(OrderModule.isUserOrganizer('attacker_eve', '老闆'), false);
assert.strictEqual(OrderModule.isUserOrganizer('attacker_eve', '小幫手'), false);

// Bob has an active order on Friday
SheetModule.addOrder({
  userId: 'user_bob',
  groupId: groupId,
  itemName: '脆皮燒肉飯',
  quantity: 1,
  price: 105,
  userName: '小鮑伯',
  userNickname: '小鮑伯',
  dayOfWeek: '週五'
});

// Attacker Eve with display name "老闆" attempts to cancel Bob's meal -> REJECTED
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_eve_spoof_cancel',
  source: { groupId: groupId, userId: 'attacker_eve' },
  message: { type: 'text', text: '取消 小鮑伯 脆皮燒肉飯' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('除了開單人，不能取消其他使用者的餐點'), 'Eve cannot cancel Bob order despite spoofed display name');
var bobOrderCheck = SheetModule.getUserOrders('user_bob', groupId, null, '週五', '小鮑伯');
assert.strictEqual(bobOrderCheck.length, 1, 'Bob order remains intact');
console.log('  ✔ Display name spoofing neutralized: only unforgeable userId authorized.');

// 12-2: Formula Injection Sanitization
assert.strictEqual(SheetModule._sanitizeSheetCell('=SUM(A1:B2)'), "'=SUM(A1:B2)");
assert.strictEqual(SheetModule._sanitizeSheetCell('+cmd|/C calc!A0'), "'+cmd|/C calc!A0");
assert.strictEqual(SheetModule._sanitizeSheetCell('-123'), "'-123");
assert.strictEqual(SheetModule._sanitizeSheetCell('@SUM(A1)'), "'@SUM(A1)");
assert.strictEqual(SheetModule._sanitizeSheetCell('   =SUM(A1)'), "'   =SUM(A1)");
assert.strictEqual(SheetModule._sanitizeSheetCell('\t=SUM(A1)'), "'\t=SUM(A1)");
assert.strictEqual(SheetModule._sanitizeSheetCell('\r-456'), "'\r-456");
assert.strictEqual(SheetModule._sanitizeSheetCell('一般文字'), '一般文字');
assert.strictEqual(SheetModule._sanitizeSheetCell(123), 123);
assert.strictEqual(SheetModule._sanitizeSheetCell(null), null);
assert.strictEqual(SheetModule._sanitizeSheetCell(undefined), undefined);

// Formula injection sanitization in Children sheet
SheetModule.saveChild('user_alice', '=Alice', '   +Ally', '@LittleAlice', '\t-NoteFormula');
var aliceChildren = SheetModule.getChildrenProfiles('user_alice');
var maliciousChild = aliceChildren.find(function (c) { return c.childName.includes('LittleAlice'); });
assert.ok(maliciousChild, 'Child profile saved');
assert.strictEqual(maliciousChild.childName, "'@LittleAlice");
assert.strictEqual(maliciousChild.note, "'\t-NoteFormula");

// Formula injection sanitization in setChildren
SheetModule.setChildren('user_alice', 'Alice', 'Alice', ['=Kid1', '  +Kid2']);
var aliceChildrenSet = SheetModule.getChildren('user_alice');
assert.ok(aliceChildrenSet.includes("'=Kid1"));
assert.ok(aliceChildrenSet.includes("'+Kid2"));

// Formula injection sanitization in logToSheet
SheetModule.logToSheet('=MALICIOUS_TYPE', '  +MALICIOUS_LOG', '\t@PAYLOAD');
var lastLog = SheetModule._mockStore.Logs[SheetModule._mockStore.Logs.length - 1];
assert.strictEqual(lastLog[1], "'=MALICIOUS_TYPE");
assert.strictEqual(lastLog[2], "'  +MALICIOUS_LOG");
assert.strictEqual(lastLog[3], "'\t@PAYLOAD");
console.log('  ✔ Enhanced formula injection sanitization verified across cells, profiles, and logs.');

// 12-3: Organizer Switch Lock (ALLOW_SWITCH_ORGANIZER)
// Initially ALLOW_SWITCH_ORGANIZER is true
SheetModule.setConfigValue('ALLOW_SWITCH_ORGANIZER', 'true');
SheetModule.setConfigValue('ORGANIZER_ID', 'user_boss');

// When true, anyone calling 開單 can switch organizer
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_alice_open_allowed',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '開單 福山排骨便當 11:30' }
});
assert.strictEqual(lastReply.type, 'flex');
const effAliceId = SheetModule.getEffectiveUserId ? SheetModule.getEffectiveUserId('user_alice') : 'user_alice';
assert.ok(SheetModule.getConfigValue('ORGANIZER_ID') === 'user_alice' || SheetModule.getConfigValue('ORGANIZER_ID') === effAliceId);
assert.ok(OrderModule.isUserOrganizer('user_alice'));
console.log('  ✔ ALLOW_SWITCH_ORGANIZER=true permits new organizer to take over on 開單.');

// When false, non-organizer calling 開單 is rejected
SheetModule.setConfigValue('ALLOW_SWITCH_ORGANIZER', 'false');
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_bob_open_forbidden',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '開單 金仙蝦捲飯 11:30' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已鎖定開單人，非現任開單人無法重新開單或更換開單人'));
assert.ok(SheetModule.getConfigValue('ORGANIZER_ID') === 'user_alice' || SheetModule.getConfigValue('ORGANIZER_ID') === effAliceId, 'Organizer remains Alice');

// Current organizer (Alice) calling 開單 while locked is allowed
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_alice_open_self',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '開單 金仙蝦捲飯 11:45' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(SheetModule.getConfigValue('ORGANIZER_ID') === 'user_alice' || SheetModule.getConfigValue('ORGANIZER_ID') === effAliceId);
assert.ok(OrderModule.isUserOrganizer('user_alice'));
console.log('  ✔ ALLOW_SWITCH_ORGANIZER=false blocks unauthorized takeover but allows existing organizer.');

// Reset ALLOW_SWITCH_ORGANIZER back to true
SheetModule.setConfigValue('ALLOW_SWITCH_ORGANIZER', 'true');

// 12-4: Webhook Security & LINE Verify Probe Fast-Path
// A: Empty events (LINE Developers Verify probe) returns 200 immediately
var verifyRes = CodeModule.doPost({
  postData: { contents: JSON.stringify({ destination: 'xxx', events: [] }) }
});
assert.strictEqual(verifyRes.statusCode, 200);
assert.strictEqual(verifyRes.body.status, 'success');
assert.strictEqual(verifyRes.body.message, 'Webhook verified');

// B: URL token verification
process.env.CHANNEL_SECRET = 'secret_test_key_123';

// Incorrect token when token query parameter is passed
var badTokenRes = CodeModule.doPost({
  parameter: { token: 'wrong_token' },
  postData: { contents: JSON.stringify({ events: [{ type: 'message' }] }) }
});
assert.strictEqual(badTokenRes.statusCode, 403);
assert.strictEqual(badTokenRes.body.error, 'Invalid secret token');

// Matching token succeeds
var goodTokenRes = CodeModule.doPost({
  parameter: { token: 'secret_test_key_123' },
  postData: { contents: JSON.stringify({ events: [] }) }
});
assert.strictEqual(goodTokenRes.statusCode, 200);

// C: Header signature validation
var testPayload = JSON.stringify({ events: [] });
var crypto = require('crypto');
var validSig = crypto.createHmac('sha256', 'secret_test_key_123').update(testPayload, 'utf8').digest('base64');

var goodSigRes = CodeModule.doPost({
  headers: { 'X-Line-Signature': validSig },
  postData: { contents: testPayload }
});
assert.strictEqual(goodSigRes.statusCode, 200);

var badSigRes = CodeModule.doPost({
  headers: { 'X-Line-Signature': 'invalid_signature_xyz' },
  postData: { contents: testPayload }
});
assert.strictEqual(badSigRes.statusCode, 403);
assert.strictEqual(badSigRes.body.error, 'Invalid signature');

// Clean up mock secret
delete process.env.CHANNEL_SECRET;
console.log('  ✔ Webhook security (URL Token, Header Signature, Verify Probe Fast-Path) verified.');
console.log('  ✔ Security hardening test suite completed.\n');

// 13. Test User Identifier Storage Modes & Privacy De-identification (HASHED_ID, USER_ID, NICKNAME)
console.log('▶ Test 13: User Privacy & User Identifier Storage Modes (HASHED_ID, USER_ID, NICKNAME)');

// 13-1: Test hashUserId functionality and idempotency
var testRawId = 'U1234567890abcdef1234567890abcdef';
var hashed1 = SheetModule.hashUserId(testRawId, 'my_test_salt_abc');
assert.ok(hashed1.startsWith('usr_'));
assert.strictEqual(hashed1.length, 20); // 'usr_' (4) + 16 hex chars = 20

// Consistency
var hashed2 = SheetModule.hashUserId(testRawId, 'my_test_salt_abc');
assert.strictEqual(hashed1, hashed2);

// Different salt generates different hash
var hashedDiffSalt = SheetModule.hashUserId(testRawId, 'different_salt_xyz');
assert.notStrictEqual(hashed1, hashedDiffSalt);

// Idempotency: hashing already hashed ID returns it as-is
assert.strictEqual(SheetModule.hashUserId(hashed1), hashed1);

// 13-2: Mode 1 - HASHED_ID (Default & Recommended for Privacy)
SheetModule.setConfigValue('USER_IDENTIFIER_MODE', 'HASHED_ID');
SheetModule.setConfigValue('HASH_SALT', 'privacy_salt_123');
var rawIdDavid = 'U9876543210fedcba9876543210fedcba';
var effDavid = SheetModule.getEffectiveUserId(rawIdDavid, '大衛', '大衛');
assert.ok(effDavid.startsWith('usr_'));
assert.strictEqual(effDavid.length, 20);
assert.notStrictEqual(effDavid, rawIdDavid);

// Place order in HASHED_ID mode
var recHashed = SheetModule.addOrder({
  userId: rawIdDavid,
  groupId: 'grp_privacy_test',
  userName: '大衛',
  userNickname: '小衛',
  itemName: '排骨便當',
  quantity: 1,
  price: 100,
  dayOfWeek: '週一'
});
// Verify stored record in mock store has hashed ID, NEVER the raw LINE User ID
assert.strictEqual(recHashed.userId, effDavid);
var storedOrder = SheetModule._mockStore.Orders.find(function (o) { return o.orderId === recHashed.orderId; });
assert.ok(storedOrder);
assert.strictEqual(storedOrder.userId, effDavid);
assert.strictEqual(storedOrder.userId.indexOf('U9876543210'), -1);

// Query order using raw userId: seamlessly resolves via effUserId
var davidOrders = SheetModule.getUserOrders(rawIdDavid, 'grp_privacy_test', null, '週一');
assert.strictEqual(davidOrders.length, 1);
assert.strictEqual(davidOrders[0].orderId, recHashed.orderId);

// Query order using effUserId directly: also seamlessly resolves
var davidOrdersHashed = SheetModule.getUserOrders(effDavid, 'grp_privacy_test', null, '週一');
assert.strictEqual(davidOrdersHashed.length, 1);

// Backward compatibility: legacy unhashed order stored with raw ID
var legacyRec = {
  orderId: 'ord_legacy_999',
  timestamp: '2026-09-09 10:00:00',
  date: '2026-09-09',
  dayOfWeek: '週一',
  groupId: 'grp_privacy_test',
  userId: rawIdDavid, // raw ID stored previously before upgrading
  userName: '大衛',
  userNickname: '小衛',
  childName: '',
  itemName: '雞腿便當',
  quantity: 1,
  price: 120,
  subtotal: 120,
  status: 'ACTIVE',
  paid: 'UNPAID'
};
SheetModule._mockStore.Orders.push(legacyRec);

// Both hashed and legacy orders are returned
var davidAllOrders = SheetModule.getUserOrders(rawIdDavid, 'grp_privacy_test', null, '週一');
assert.strictEqual(davidAllOrders.length, 2);

// Children profile in HASHED_ID mode stores effDavid
SheetModule.saveChild(rawIdDavid, '大衛', '小衛', '小衛一號', '一年甲班');
var davidKids = SheetModule.getChildren(rawIdDavid, '大衛', '小衛');
assert.ok(davidKids.includes('小衛一號'));
var storedKid = SheetModule._mockStore.Children.find(function (c) { return c.childName === '小衛一號'; });
assert.ok(storedKid);
assert.strictEqual(storedKid.userId, effDavid);

// Cancel order works seamlessly
var cancelCountHashed = SheetModule.cancelOrder(rawIdDavid, 'grp_privacy_test', '排骨便當', null, '週一');
assert.strictEqual(cancelCountHashed, 1);
assert.strictEqual(storedOrder.status, 'CANCELLED');

// Clean up legacy order
SheetModule.cancelOrder(rawIdDavid, 'grp_privacy_test', '雞腿便當', null, '週一');
SheetModule.deleteChild(rawIdDavid, '小衛一號', '大衛', '小衛');

console.log('  ✔ HASHED_ID mode: One-way HMAC-SHA256 salted hash de-identification and dual backward compatibility verified.');

// 13-3: Mode 2 - USER_ID (Legacy mode storing raw LINE User ID)
SheetModule.setConfigValue('USER_IDENTIFIER_MODE', 'USER_ID');
var rawIdEmma = 'Uabcdef1234567890abcdef1234567890';
var effEmma = SheetModule.getEffectiveUserId(rawIdEmma, '艾瑪', '艾瑪');
assert.strictEqual(effEmma, rawIdEmma);

var recRaw = SheetModule.addOrder({
  userId: rawIdEmma,
  groupId: 'grp_privacy_test',
  userName: '艾瑪',
  userNickname: '艾瑪',
  itemName: '魚排便當',
  quantity: 1,
  price: 110,
  dayOfWeek: '週二'
});
assert.strictEqual(recRaw.userId, rawIdEmma);

var emmaOrders = SheetModule.getUserOrders(rawIdEmma, 'grp_privacy_test', null, '週二');
assert.strictEqual(emmaOrders.length, 1);
SheetModule.cancelOrder(rawIdEmma, 'grp_privacy_test', '魚排便當', null, '週二');

console.log('  ✔ USER_ID mode: Raw LINE User ID storage verified.');

// 13-4: Mode 3 - NICKNAME (Zero User ID mode using display name/nickname as index)
SheetModule.setConfigValue('USER_IDENTIFIER_MODE', 'NICKNAME');
var rawIdFrank = 'U55555555555555555555555555555555';
var effFrank = SheetModule.getEffectiveUserId(rawIdFrank, '法蘭克', '小法');
assert.strictEqual(effFrank, '小法');

var recNick = SheetModule.addOrder({
  userId: rawIdFrank,
  groupId: 'grp_privacy_test',
  userName: '法蘭克',
  userNickname: '小法',
  itemName: '叉燒便當',
  quantity: 1,
  price: 95,
  dayOfWeek: '週三'
});
// Verify stored record in mock store has nickname as index, completely eliminating raw LINE User ID
assert.strictEqual(recNick.userId, '小法');
var storedNickOrder = SheetModule._mockStore.Orders.find(function (o) { return o.orderId === recNick.orderId; });
assert.strictEqual(storedNickOrder.userId, '小法');

// Query order using nickname works seamlessly
var frankOrders = SheetModule.getUserOrders(rawIdFrank, 'grp_privacy_test', null, '週三', '小法');
assert.strictEqual(frankOrders.length, 1);
assert.strictEqual(frankOrders[0].itemName, '叉燒便當');

// Children profile in NICKNAME mode
SheetModule.saveChild(rawIdFrank, '法蘭克', '小法', '法寶', '');
var frankKids = SheetModule.getChildren(rawIdFrank, '法蘭克', '小法');
assert.ok(frankKids.includes('法寶'));
var storedFrankKid = SheetModule._mockStore.Children.find(function (c) { return c.childName === '法寶'; });
assert.strictEqual(storedFrankKid.userId, '小法');

// Cancel order works in NICKNAME mode
var cancelNickCount = SheetModule.cancelOrder(rawIdFrank, 'grp_privacy_test', '叉燒便當', null, '週三', '小法');
assert.strictEqual(cancelNickCount, 1);
assert.strictEqual(storedNickOrder.status, 'CANCELLED');
SheetModule.deleteChild(rawIdFrank, '法寶', '法蘭克', '小法');

console.log('  ✔ NICKNAME mode: Zero technical User ID storage and display name indexing verified.');

// Reset config back to default HASHED_ID
SheetModule.setConfigValue('USER_IDENTIFIER_MODE', 'HASHED_ID');
SheetModule.setConfigValue('HASH_SALT', '');
console.log('  ✔ User privacy & storage modes test suite completed.\n');

// 13-5: Test Multi-Organizer Push Notification (Schemes A, B, C via unified comma-separated format)
console.log('▶ Test 13-5: Multi-Organizer Push Target Resolution (Schemes A, B, C)');

// Scheme A: Zero push ID configured
var targetsA1 = OrderModule.resolveOrganizerPushTargets('usr_8f9c21b4a7d3e5f0', '小幫手', '');
assert.deepStrictEqual(targetsA1, []); // No raw ID exposed, gracefully empty

var targetsA2 = OrderModule.resolveOrganizerPushTargets('U1234567890abcdef1234567890abcdef', '小幫手', '');
assert.deepStrictEqual(targetsA2, ['U1234567890abcdef1234567890abcdef']); // Raw ID retained in legacy mode

// Scheme B: Comma-separated Key-Value mapping
var settingB = '小明媽媽:U11111111111111111111111111111111, 小華爸爸:U22222222222222222222222222222222';
var targetsB1 = OrderModule.resolveOrganizerPushTargets('usr_xxxx', '小華爸爸', settingB);
assert.deepStrictEqual(targetsB1, ['U22222222222222222222222222222222']);

var targetsB2 = OrderModule.resolveOrganizerPushTargets('usr_xxxx', '小明媽媽', settingB);
assert.deepStrictEqual(targetsB2, ['U11111111111111111111111111111111']);

// Key can also be hashed ID
var hashedKey1 = SheetModule.hashUserId('U11111111111111111111111111111111');
var settingBHashed = hashedKey1 + ':U11111111111111111111111111111111, usr_other:U22222222222222222222222222222222';
var targetsBHashed = OrderModule.resolveOrganizerPushTargets(hashedKey1, '任一暱稱', settingBHashed);
assert.deepStrictEqual(targetsBHashed, ['U11111111111111111111111111111111']);

// Scheme B: Auto-hash matching with pure comma-separated LINE IDs
var idAlice = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
var idBob = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
var settingPureIds = idAlice + ', ' + idBob;
var hashedAlice = SheetModule.hashUserId(idAlice);
// When Alice is organizer in HASHED_ID mode, system hashes standalone IDs and matches Alice only!
var targetsAutoHash = OrderModule.resolveOrganizerPushTargets(hashedAlice, '愛麗絲', settingPureIds);
assert.deepStrictEqual(targetsAutoHash, [idAlice]);

// Scheme C: Broadcast to all standalone IDs when no specific match found
var targetsBroadcast = OrderModule.resolveOrganizerPushTargets('usr_unmatched_organizer', '路人開單', settingPureIds);
assert.deepStrictEqual(targetsBroadcast, [idAlice, idBob]);

// Wildcard Always-Notify (*:UID or all:UID) combined with specific organizer mapping
var settingWildcard = '小明媽媽:U11111111111111111111111111111111, *:U99999999999999999999999999999999';
var targetsWildcard = OrderModule.resolveOrganizerPushTargets('usr_xxxx', '小明媽媽', settingWildcard);
assert.deepStrictEqual(targetsWildcard, ['U11111111111111111111111111111111', 'U99999999999999999999999999999999']);

// End-to-end notifyOrganizer verification
process.env.ORGANIZER_PUSH_ID = settingWildcard;
SheetModule.setConfigValue('ORGANIZER_NAME', '小明媽媽');
SheetModule.setConfigValue('ORGANIZER_ID', 'usr_mock_ming_mom');
allPushes = [];
OrderModule.notifyOrganizer('測試通知訊息');
assert.strictEqual(allPushes.length, 2);
assert.strictEqual(allPushes[0].to, 'U11111111111111111111111111111111');
assert.strictEqual(allPushes[1].to, 'U99999999999999999999999999999999');
delete process.env.ORGANIZER_PUSH_ID;

console.log('  ✔ Multi-organizer push target resolution (Schemes A, B, C & Wildcard) verified.\n');

// 13-6: Test migrateToHashedUserIds One-Click Migration Tool
console.log('▶ Test 13-6: One-Click Migration Tool (migrateToHashedUserIds)');

var rawUserX = 'U11112222333344445555666677778888';
var rawUserY = 'U99998888777766665555444433332222';
var effUserX = SheetModule.hashUserId(rawUserX);
var effUserY = SheetModule.hashUserId(rawUserY);

SheetModule._mockStore.Orders.push({
  orderId: 'ord_mig_1',
  timestamp: '2026-09-09 10:00:00',
  date: '2026-09-09',
  dayOfWeek: '週一',
  groupId: 'grp_mig',
  userId: rawUserX,
  userName: '老張',
  userNickname: '老張',
  childName: '',
  itemName: '排骨便當',
  quantity: 1,
  price: 100,
  subtotal: 100,
  status: 'ACTIVE',
  paid: 'UNPAID'
});
SheetModule._mockStore.Orders.push({
  orderId: 'ord_mig_2',
  timestamp: '2026-09-09 10:00:00',
  date: '2026-09-09',
  dayOfWeek: '週一',
  groupId: 'grp_mig',
  userId: rawUserY,
  userName: '老李',
  userNickname: '老李',
  childName: '',
  itemName: '雞腿便當',
  quantity: 1,
  price: 120,
  subtotal: 120,
  status: 'ACTIVE',
  paid: 'UNPAID'
});

// Setup mock Children with raw user ID
SheetModule._mockStore.Children.push({
  userId: rawUserX,
  userName: '老張',
  userNickname: '老張',
  childName: '張小弟',
  note: '三年一班',
  createdAt: '2026-09-09 10:00:00',
  updatedAt: '2026-09-09 10:00:00'
});

// Setup mock Config with raw ORGANIZER_ID and USER_ID mode
SheetModule._mockStore.Config['ORGANIZER_ID'] = rawUserX;
SheetModule._mockStore.Config['USER_IDENTIFIER_MODE'] = 'USER_ID';

// Run migration!
var migRes = SheetModule.migrateToHashedUserIds();
assert.strictEqual(migRes.success, true);
assert.ok(migRes.ordersMigrated >= 2);
assert.ok(migRes.childrenMigrated >= 1);
assert.strictEqual(migRes.organizerMigrated, true);

// Verify Orders records have been converted to hashed ID
var migOrder1 = SheetModule._mockStore.Orders.find(function (o) { return o.orderId === 'ord_mig_1'; });
assert.strictEqual(migOrder1.userId, effUserX);
var migOrder2 = SheetModule._mockStore.Orders.find(function (o) { return o.orderId === 'ord_mig_2'; });
assert.strictEqual(migOrder2.userId, effUserY);

// Verify Children record converted to hashed ID
var migKid = SheetModule._mockStore.Children.find(function (c) { return c.childName === '張小弟'; });
assert.strictEqual(migKid.userId, effUserX);

// Verify Config updated
assert.strictEqual(SheetModule._mockStore.Config['ORGANIZER_ID'], effUserX);
assert.strictEqual(SheetModule._mockStore.Config['USER_IDENTIFIER_MODE'], 'HASHED_ID');

// Test Idempotency: running migration again does not re-hash already hashed records
var migRes2 = SheetModule.migrateToHashedUserIds();
assert.strictEqual(migRes2.ordersMigrated, 0);
assert.strictEqual(migRes2.childrenMigrated, 0);
assert.strictEqual(migRes2.organizerMigrated, false);
assert.strictEqual(migOrder1.userId, effUserX);

// Clean up mock records
SheetModule.cancelOrder(effUserX, 'grp_mig', '排骨便當', null, '週一');
SheetModule.cancelOrder(effUserY, 'grp_mig', '雞腿便當', null, '週一');
SheetModule.deleteChild(effUserX, '張小弟');

console.log('  ✔ migrateToHashedUserIds: Batch migration & idempotency verified.\n');

// Clean up mock date
globalThis._mockCurrentDate = null;

// ============================================================================
// Test 14: Internationalization (i18n), Single-Locale & User-Locale Customization
// ============================================================================
console.log('▶ Test 14: Internationalization (i18n), Single-Locale & User-Locale Customization');

// 14.1 Basic i18n translation and fallback
assert.strictEqual(I18nModule.t('common.member', null, 'zh-TW'), '成員');
assert.strictEqual(I18nModule.t('common.member', null, 'en'), 'Member');
assert.strictEqual(I18nModule.t('common.member', null, 'ja'), 'メンバー');
assert.strictEqual(I18nModule.t('common.member', null, 'ko'), '멤버');
assert.strictEqual(I18nModule.t('common.member', null, 'th'), 'สมาชิก');
assert.strictEqual(I18nModule.t('common.member', null, 'id'), 'Anggota');

// Fallback to zh-TW when key is missing in target language
assert.strictEqual(I18nModule.t('non_existent_key_xyz', null, 'en'), 'non_existent_key_xyz');

// Param replacement
assert.strictEqual(
  I18nModule.t('lang.set_success', { lang: 'English' }, 'en'),
  '✅ Language successfully set to "English"! Future messages will be in this language.'
);

// 14.2 Weekday localization
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'zh-TW'), '週一');
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'en'), 'Mon');
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'ja'), '月曜');
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'ko'), '월');
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'th'), 'จันทร์');
assert.strictEqual(I18nModule.displayDayOfWeek('週一', 'id'), 'Senin');

// 14.3 Multi-language command aliases regex builder
var helpRegex = I18nModule.buildCommandRegex('cmd.help');
assert.ok(helpRegex.test('幫助'));
assert.ok(helpRegex.test('/help'));
assert.ok(helpRegex.test('help'));
assert.ok(helpRegex.test('ヘルプ'));
assert.ok(helpRegex.test('도움말'));
assert.ok(helpRegex.test('ช่วยเหลือ'));
assert.ok(helpRegex.test('bantuan'));

// 14.4 Default Config Behavior: ENABLE_USER_LOCALE is 'false' by default
SheetModule._mockStore.Config['ENABLE_USER_LOCALE'] = 'false';
SheetModule._mockStore.Config['DEFAULT_LOCALE'] = 'zh-TW';

// When ENABLE_USER_LOCALE is false, createHelpFlex must have 9 buttons (no language button)
var helpFlexDefault = FlexModule.createHelpFlex();
var helpButtonsDefault = helpFlexDefault.body.contents.map(function (row) {
  return row.contents[1].action.label;
});
assert.strictEqual(helpButtonsDefault.length, 9, 'Default help card must have 9 buttons when user locale disabled');
assert.strictEqual(helpButtonsDefault.includes('切換語言'), false);

// When user triggers language command with ENABLE_USER_LOCALE=false, receives disabled notice
OrderModule.handleTextMessage({
  replyToken: 'tok_lang_1',
  source: { userId: 'usr_locale_1' },
  message: { type: 'text', text: '設定語言' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('尚未開放個人切換語言功能') || lastReply.text.includes('disabled'));

// 14.5 Enable User Locale Customization: ENABLE_USER_LOCALE = 'true'
SheetModule._mockStore.Config['ENABLE_USER_LOCALE'] = 'true';
assert.strictEqual(I18nModule.isUserLocaleEnabled(), true);

// When ENABLE_USER_LOCALE is true, createHelpFlex must show 10 buttons (including language button)
var helpFlexWithLang = FlexModule.createHelpFlex();
var helpButtonsWithLang = helpFlexWithLang.body.contents.map(function (row) {
  return row.contents[1].action.label;
});
assert.strictEqual(helpButtonsWithLang.length, 10, 'Help card must have 10 buttons when user locale is enabled');
assert.strictEqual(helpButtonsWithLang.includes('切換語言'), true);

// User queries '設定語言' -> returns language select Flex card with 6 language options
OrderModule.handleTextMessage({
  replyToken: 'tok_lang_2',
  source: { userId: 'usr_locale_1' },
  message: { type: 'text', text: '設定語言' }
});
assert.strictEqual(lastReply.type, 'flex');
var langFlexBubble = lastReply.flex;
assert.strictEqual(langFlexBubble.body.contents.length, 6, 'Must show 6 supported languages');

// User sets language to English via command
OrderModule.handleTextMessage({
  replyToken: 'tok_lang_3',
  source: { userId: 'usr_locale_1', displayName: 'John' },
  message: { type: 'text', text: '設定語言 en' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('Language successfully set to "English"'));

// Verify UserPreferences stored
var userPrefLoc = SheetModule.getUserLocalePreference('usr_locale_1');
assert.strictEqual(userPrefLoc, 'en');

// Now user usr_locale_1 queries help -> receives English help card
OrderModule.handleTextMessage({
  replyToken: 'tok_lang_4',
  source: { userId: 'usr_locale_1', displayName: 'John' },
  message: { type: 'text', text: 'help' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, 'Meal Ordering Bot Guide');
var engHelpButtons = lastReply.flex.body.contents.map(function (row) {
  return row.contents[1].action.label;
});
assert.strictEqual(engHelpButtons[0], 'Weekly');
assert.strictEqual(engHelpButtons[9], 'Language');

// User sets language to Japanese via Postback
OrderModule.handlePostbackEvent({
  replyToken: 'tok_lang_5',
  source: { userId: 'usr_locale_1', displayName: 'John' },
  postback: { data: 'action=set_lang&lang=ja' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('言語を「日本語」に設定しました'));

// Verify UserPreferences updated to ja
assert.strictEqual(SheetModule.getUserLocalePreference('usr_locale_1'), 'ja');

// Now user usr_locale_1 queries help -> receives Japanese help card
OrderModule.handleTextMessage({
  replyToken: 'tok_lang_6',
  source: { userId: 'usr_locale_1', displayName: 'John' },
  message: { type: 'text', text: 'ヘルプ' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(lastReply.altText, 'お弁当注文コマンド案内');
var jaHelpButtons = lastReply.flex.body.contents.map(function (row) {
  return row.contents[1].action.label;
});
assert.strictEqual(jaHelpButtons[0], '今週確認');
assert.strictEqual(jaHelpButtons[9], '言語設定');

// 14.6 Verify all help menu button commands across all 6 supported locales
// (zh-TW, en, ja, ko, th, id) successfully trigger handlers
var allLocales = ['zh-TW', 'en', 'ja', 'ko', 'th', 'id'];
SheetModule._mockStore.Config['ENABLE_USER_LOCALE'] = 'true';
allLocales.forEach(function (loc) {
  var helpFlex = FlexModule.createHelpFlex('https://tinyurl.com/4c92wtee', loc);
  var rows = helpFlex.body.contents;
  assert.strictEqual(rows.length, 10, 'Each locale must render 10 command buttons in help flex');

  rows.forEach(function (row, btnIdx) {
    var cmdText = row.contents[1].action.text;
    assert.ok(cmdText && cmdText.length > 0, 'Button ' + btnIdx + ' must have valid cmd text');
    lastReply = null;
    OrderModule.handleTextMessage({
      replyToken: 'tok_menu_btn_' + loc + '_' + btnIdx,
      source: { userId: 'usr_btn_test', groupId: groupId },
      message: { type: 'text', text: cmdText }
    });
    assert.ok(lastReply, 'Menu button command "' + cmdText + '" (loc=' + loc + ', idx=' + btnIdx + ') must trigger a response');
    assert.ok(lastReply.type === 'flex' || lastReply.type === 'text', 'Response must be flex or text');
  });
});

// 14.7 Submenus i18n & Parameterized Buttons Verification across 6 locales
allLocales.forEach(function (loc) {
  // A. Children Submenu Flex & Commands
  var kidsHelpFlex = FlexModule.createChildrenHelpFlex(loc);
  assert.ok(kidsHelpFlex && kidsHelpFlex.header && kidsHelpFlex.body, 'Children help flex must have header & body for ' + loc);
  var kidsCmdRows = kidsHelpFlex.body.contents;
  assert.strictEqual(kidsCmdRows.length, 4, 'Children submenu must have 4 command cards for ' + loc);

  // Set user preference to loc for user_kid_tester
  SheetModule.setUserLocalePreference('usr_kid_test', loc);

  // Test Card 0: List kids command
  var listCmd = kidsCmdRows[0].contents[1].action.text;
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_kid_list_' + loc,
    source: { userId: 'usr_kid_test', displayName: 'KidTester' },
    message: { type: 'text', text: listCmd }
  });
  assert.ok(lastReply && lastReply.type === 'flex', 'List kids command (' + listCmd + ') must return flex for ' + loc);

  // Test Card 1: Batch set kids command
  var batchCmd = kidsCmdRows[1].contents[1].action.text;
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_kid_batch_' + loc,
    source: { userId: 'usr_kid_test', displayName: 'KidTester' },
    message: { type: 'text', text: batchCmd }
  });
  assert.ok(lastReply && lastReply.type === 'text', 'Batch set kids command (' + batchCmd + ') must return text response for ' + loc);
  var storedKids = SheetModule.getChildren('usr_kid_test', 'KidTester');
  assert.ok(storedKids && storedKids.length >= 2, 'Batch command must successfully register kids for ' + loc);

  // Test Card 2: Add single kid command
  var addCmd = kidsCmdRows[2].contents[1].action.text;
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_kid_add_' + loc,
    source: { userId: 'usr_kid_test', displayName: 'KidTester' },
    message: { type: 'text', text: addCmd }
  });
  assert.ok(lastReply && lastReply.type === 'text', 'Add single kid command (' + addCmd + ') must return text response for ' + loc);

  // Test Card 3: Delete kid command
  var delCmd = kidsCmdRows[3].contents[1].action.text;
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_kid_del_' + loc,
    source: { userId: 'usr_kid_test', displayName: 'KidTester' },
    message: { type: 'text', text: delCmd }
  });
  assert.ok(lastReply && lastReply.type === 'text', 'Delete kid command (' + delCmd + ') must return text response for ' + loc);

  // B. Weekly Schedule Flex
  var dummySched = [
    { dayOfWeek: '週一', restaurantName: 'Rest 1', cutoffTime: '10:30' },
    { dayOfWeek: '週二', restaurantName: 'Rest 2', cutoffTime: '11:00' }
  ];
  var schedFlex = FlexModule.createWeeklyScheduleFlex(dummySched, loc);
  assert.ok(schedFlex && schedFlex.header && schedFlex.body, 'Schedule flex must be valid for ' + loc);
  var dayBadgeText = schedFlex.body.contents[0].contents[0].contents[0].text;
  assert.strictEqual(dayBadgeText, I18nModule.displayDayOfWeek('週一', loc));

  // C. Cancel Order Flex
  var mockActiveOrders = [
    { dayOfWeek: '週一', itemName: 'Bento', quantity: 1, price: 100, userName: 'KidTester' }
  ];
  var cancelOrderFlex = FlexModule.createCancelOrderFlex('KidTester', mockActiveOrders, {}, true, loc);
  assert.ok(cancelOrderFlex && cancelOrderFlex.header && cancelOrderFlex.body, 'Cancel order flex must be valid for ' + loc);
  var cancelFlexJson = JSON.stringify(cancelOrderFlex);
  assert.ok(cancelFlexJson.includes(I18nModule.t('cancel.btn_cancel_item', null, loc)), 'Cancel flex must contain localized item cancel button for ' + loc);

  // D. Confirm Cancel Flex
  var confirmCancelFlex = FlexModule.createConfirmCancelFlex('Title', 'Desc', 'ActionText', 'BtnLabel', loc);
  assert.ok(confirmCancelFlex && confirmCancelFlex.header && confirmCancelFlex.body, 'Confirm cancel flex must be valid for ' + loc);
  var confirmFlexJson = JSON.stringify(confirmCancelFlex);
  assert.ok(confirmFlexJson.includes(I18nModule.t('cancel.btn_abort', null, loc)), 'Confirm cancel flex must contain localized abort button for ' + loc);

  // E. Summary Flex
  var mockSummaryData = {
    items: [{ itemName: 'Item A', quantity: 2, subtotal: 200, buyers: ['KidTester'] }],
    totalQuantity: 2,
    totalAmount: 200,
    dayOfWeek: '週一'
  };
  var sumCardFlex = FlexModule.createSummaryFlex('Rest A', mockSummaryData, false, null, loc);
  assert.ok(sumCardFlex && sumCardFlex.header && sumCardFlex.body, 'Summary flex must be valid for ' + loc);
  var sumCardJson = JSON.stringify(sumCardFlex);
  assert.ok(sumCardJson.includes(I18nModule.t('stats.total_summary', { qty: 2, amount: 200 }, loc)), 'Summary flex must contain localized total for ' + loc);
});

// 14.8 Payment Information, Order Receipt Flex & Query Responses across all 6 locales
allLocales.forEach(function (loc) {
  // A. Payment Information block in Summary Card
  var dummyPaymentInfo = {
    hasPaymentInfo: true,
    bankCode: '013',
    bankName: 'Cathay',
    bankAccount: '1234567890',
    bankAccountName: 'Organizer',
    bankQrUrl: 'https://example.com/bank_qr.png',
    linePayUrl: 'https://line.me/R/pay/transfer',
    isPersonalLinePay: true,
    linePayRecipientName: 'Organizer LINE',
    linePayUserId: 'org_line_id',
    linePayQrUrl: 'https://example.com/linepay_qr.png'
  };

  var summaryWithPay = FlexModule.createSummaryFlex('Rest Pay', {
    items: [{ itemName: 'Item A', quantity: 1, subtotal: 100 }],
    users: [{ userName: 'Member A', items: ['Item A'], total: 100 }],
    totalQuantity: 1,
    totalAmount: 100
  }, false, dummyPaymentInfo, loc);

  var sumPayJson = JSON.stringify(summaryWithPay);
  assert.ok(sumPayJson.includes(I18nModule.t('payment.title', null, loc)), 'Summary card must include localized payment title for ' + loc);
  assert.ok(sumPayJson.includes(I18nModule.t('payment.qr_hint', null, loc)), 'Summary card must include localized payment QR hint for ' + loc);
  assert.ok(sumPayJson.includes(I18nModule.t('payment.btn_wallet', null, loc)), 'Summary card must include localized wallet transfer button for ' + loc);
  assert.ok(sumPayJson.includes(I18nModule.t('stats.member_roster_today', null, loc)), 'Summary card must include localized member roster title for ' + loc);
  assert.ok(sumPayJson.includes(I18nModule.t('stats.close_btn_today', null, loc)), 'Summary card must include localized close button for ' + loc);
  assert.ok(sumPayJson.includes(I18nModule.t('stats.footer_open', null, loc)), 'Summary card must include localized footer open hint for ' + loc);

  // B. Weekly Summary Card with payment info
  var weeklySummaryWithPay = FlexModule.createWeeklySummaryFlex({
    daySummaries: [{ dayOfWeek: '週一', totalQuantity: 1, totalAmount: 100 }],
    users: [{ userName: 'Member A', total: 100 }],
    grandTotalQuantity: 1,
    grandTotalAmount: 100
  }, false, dummyPaymentInfo, loc);

  var weeklyPayJson = JSON.stringify(weeklySummaryWithPay);
  assert.ok(weeklyPayJson.includes(I18nModule.t('payment.title', null, loc)), 'Weekly summary must include localized payment title for ' + loc);
  assert.ok(weeklyPayJson.includes(I18nModule.t('stats.member_roster_weekly', null, loc)), 'Weekly summary must include localized weekly member roster title for ' + loc);
  assert.ok(weeklyPayJson.includes(I18nModule.t('stats.close_btn_weekly', null, loc)), 'Weekly summary must include localized close button for ' + loc);
  assert.ok(weeklyPayJson.includes(I18nModule.t('stats.footer_weekly_open', null, loc)), 'Weekly summary must include localized footer open hint for ' + loc);

  // C. Menu Flex with sold out & footer hint
  var menuFlex = FlexModule.createMenuFlex('Rest M', '10:30', [
    { itemName: 'Available Item', price: 100, isAvailable: true },
    { itemName: 'Sold Out Item', price: 120, isAvailable: false }
  ], '週一', loc);
  var menuFlexJson = JSON.stringify(menuFlex);
  assert.ok(menuFlexJson.includes(I18nModule.t('menu.sold_out', null, loc)), 'Menu flex must include localized sold out label for ' + loc);
  assert.strictEqual(menuFlex.footer.contents[0].text, I18nModule.t('menu.footer_hint1', null, loc), 'Menu flex must include localized footer hint for ' + loc);

  // D. Order Receipt Flex
  var receiptFlex = FlexModule.createOrderReceiptFlex('Member A', { itemName: 'Item A', dayOfWeek: '週一' }, [
    { itemName: 'Item A', dayOfWeek: '週一', quantity: 1, price: 100, subtotal: 100 }
  ], { isWeekly: true, locale: loc });
  var receiptJson = JSON.stringify(receiptFlex);
  assert.ok(receiptJson.includes(I18nModule.t('receipt.title', null, loc)), 'Receipt flex must include localized title for ' + loc);
  assert.ok(receiptJson.includes(I18nModule.t('receipt.total_weekly', null, loc)), 'Receipt flex must include localized weekly total for ' + loc);
  assert.strictEqual(receiptFlex.footer.contents[0].text, I18nModule.t('receipt.cancel_hint', null, loc), 'Receipt flex must include localized cancel hint for ' + loc);

  // E. Personal Order Query Text Responses
  SheetModule.setUserLocalePreference('usr_pay_tester', loc);
  SheetModule._mockStore.Config['ENABLE_USER_LOCALE'] = 'true';

  // Empty today orders query
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_query_today_' + loc,
    source: { userId: 'usr_pay_tester', displayName: 'Tester' },
    message: { type: 'text', text: (I18N_COMMANDS[loc]['cmd.my_order'] || ['我的訂單'])[0] }
  });
  assert.ok(lastReply && lastReply.type === 'text', 'My order command must reply text for ' + loc);
  assert.ok(lastReply.text.includes(I18nModule.t('my_orders.no_today_orders', null, loc)), 'Empty today orders must match localized text for ' + loc);

  // Empty weekly orders query
  lastReply = null;
  OrderModule.handleTextMessage({
    replyToken: 'tok_query_weekly_' + loc,
    source: { userId: 'usr_pay_tester', displayName: 'Tester' },
    message: { type: 'text', text: (I18N_COMMANDS[loc]['cmd.my_weekly'] || ['本週訂單'])[0] }
  });
  assert.ok(lastReply && lastReply.type === 'text', 'My weekly order command must reply text for ' + loc);
  assert.ok(lastReply.text.includes(I18nModule.t('my_orders.no_weekly_orders', null, loc)), 'Empty weekly orders must match localized text for ' + loc);
});

// Reset Config & clean up test preference
SheetModule._mockStore.Config['ENABLE_USER_LOCALE'] = 'false';
SheetModule._mockStore.Config['DEFAULT_LOCALE'] = 'zh-TW';
if (SheetModule._mockStore.UserPreferences) {
  SheetModule._mockStore.UserPreferences = SheetModule._mockStore.UserPreferences.filter(function (p) {
    return p.userId !== 'usr_locale_1' && p.userId !== 'usr_btn_test' && p.userId !== 'usr_kid_test' && p.userId !== 'usr_pay_tester';
  });
}

console.log('  ✔ i18n core, single-locale, user-locale toggle, 6 languages & aliases verified.\n');

// --------------------------------------------------------------------------
// Test 15: Weekend Ordering & Saturday Pre-ordering Flow
// --------------------------------------------------------------------------
console.log('▶ Test 15: Weekend Ordering & Saturday Pre-ordering Flow');

// 1. Standard mode (ALLOW_WEEKEND_ORDERING = 'false'): Saturday night pre-ordering
SheetModule._mockStore.Config['ALLOW_WEEKEND_ORDERING'] = 'false';
SheetModule._mockStore.Config['IS_ORDERING_OPEN'] = 'true';
SheetModule._mockStore.Orders = [];

// 2026-09-12 is Saturday (20:00:00 Taiwan time)
var satNight = new Date('2026-09-12T12:00:00.000Z'); // UTC 12:00 = 20:00 Taipei
globalThis._mockCurrentDate = satNight;

assert.strictEqual(OrderModule.getTodayDayOfWeek(satNight), '週一', 'When weekend ordering disabled, Saturday defaults todayDay to 週一');
assert.strictEqual(OrderModule.isDayPast('週一', satNight), false, 'Next week Monday must NOT be past on Saturday');
assert.strictEqual(OrderModule.isDayPast('週五', satNight), false, 'Next week Friday must NOT be past on Saturday');
assert.strictEqual(OrderModule.isDayPast('週六', satNight), true, 'Saturday must be considered invalid/past when weekend ordering disabled');
assert.strictEqual(OrderModule.isDayPast('週日', satNight), true, 'Sunday must be considered invalid/past when weekend ordering disabled');

// A. User pre-orders on Saturday night with "+1 招牌排骨飯" (defaults to next Monday)
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_default',
  source: { userId: 'usr_sat_1', displayName: '週六點餐者' },
  message: { type: 'text', text: '+1 招牌排骨飯' }
});
assert.ok(lastReply, 'Ordering on Saturday night with IS_ORDERING_OPEN=true must receive a reply');
assert.strictEqual(lastReply.type, 'flex', 'Should return receipt flex');
assert.strictEqual(SheetModule._mockStore.Orders.length, 1, 'Order record should be saved');
assert.strictEqual(SheetModule._mockStore.Orders[0].dayOfWeek, '週一', 'Order should be placed for next Monday');
assert.strictEqual(SheetModule._mockStore.Orders[0].itemName, '招牌排骨飯');

// B. User pre-orders on Saturday night with "週二+1 酥炸雞腿飯"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_tue',
  source: { userId: 'usr_sat_1', displayName: '週六點餐者' },
  message: { type: 'text', text: '週二+1 酥炸雞腿飯' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.strictEqual(SheetModule._mockStore.Orders.length, 2);
assert.strictEqual(SheetModule._mockStore.Orders[1].dayOfWeek, '週二');

// C. User attempts "週六+1 招牌排骨飯" when ALLOW_WEEKEND_ORDERING = 'false'
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_disabled',
  source: { userId: 'usr_sat_1', displayName: '週六點餐者' },
  message: { type: 'text', text: '週六+1 招牌排骨飯' }
});
assert.ok(lastReply && lastReply.type === 'text', 'Should reject weekend order when disabled');
assert.ok(lastReply.text.includes('尚未開放點餐或已經截止'), 'Rejection text should indicate not open or cutoff');
assert.strictEqual(SheetModule._mockStore.Orders.length, 2, 'No new order should be added for Saturday');

// D. Saturday night when IS_ORDERING_OPEN = 'false'
SheetModule._mockStore.Config['IS_ORDERING_OPEN'] = 'false';
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_closed',
  source: { userId: 'usr_sat_2', displayName: '週六夜間點餐者' },
  message: { type: 'text', text: '+1 招牌排骨飯' }
});
assert.ok(lastReply && lastReply.type === 'text');
assert.ok(lastReply.text.includes('尚未開放點餐或已經截止'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 2, 'No new order when ordering is closed');

// 2. Weekend Enabled mode (ALLOW_WEEKEND_ORDERING = 'true')
SheetModule._mockStore.Config['ALLOW_WEEKEND_ORDERING'] = 'true';
SheetModule._mockStore.Config['IS_ORDERING_OPEN'] = 'true';
SheetModule._mockStore.Orders = [];

// Setup weekend menu & schedule
SheetModule._mockStore.WeeklySchedule.push(
  { dayOfWeek: '週六', restaurantName: '週末早午餐', cutoffTime: '10:30', uberEatsUrl: '', notes: '週末限定', isActive: 'TRUE' },
  { dayOfWeek: '週日', restaurantName: '週末牛肉麵', cutoffTime: '10:30', uberEatsUrl: '', notes: '週末限定', isActive: 'TRUE' }
);
SheetModule._mockStore.Menu.push(
  { dayOfWeek: '週六', restaurantName: '週末早午餐', category: '早午餐', itemName: '班尼迪克蛋', price: 150, isAvailable: 'TRUE', description: '' },
  { dayOfWeek: '週日', restaurantName: '週末牛肉麵', category: '麵食', itemName: '紅燒牛肉麵', price: 160, isAvailable: 'TRUE', description: '' }
);

// Saturday morning before cutoff: 2026-09-12 10:00:00 Taiwan time (UTC 02:00)
var satMorning = new Date('2026-09-12T02:00:00.000Z');
globalThis._mockCurrentDate = satMorning;

assert.strictEqual(OrderModule.isWeekendOrderingEnabled(), true, 'Weekend ordering should be enabled');
assert.strictEqual(OrderModule.getTodayDayOfWeek(satMorning), '週六', 'Saturday should be todayDay when weekend enabled');
var allDays7 = OrderModule.getDaysOfWeek();
assert.strictEqual(allDays7.length, 7, 'getDaysOfWeek() must return 7 days when weekend ordering enabled');
assert.strictEqual(allDays7[5], '週六');
assert.strictEqual(allDays7[6], '週日');

// Saturday before cutoff: none of Sat, Sun, Mon are past
assert.strictEqual(OrderModule.isDayPast('週六', satMorning), false);
assert.strictEqual(OrderModule.isDayPast('週日', satMorning), false);
assert.strictEqual(OrderModule.isDayPast('週一', satMorning), false);
assert.strictEqual(OrderModule.isTodayCutoffPassed('週六', satMorning), false);

// E. Order for Saturday today "+1 班尼迪克蛋"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_today',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '+1 班尼迪克蛋' }
});
assert.strictEqual(lastReply.type, 'flex', 'Saturday today order should succeed');
assert.strictEqual(SheetModule._mockStore.Orders.length, 1);
assert.strictEqual(SheetModule._mockStore.Orders[0].dayOfWeek, '週六');
assert.strictEqual(SheetModule._mockStore.Orders[0].itemName, '班尼迪克蛋');

// F. Order for Sunday tomorrow "週日+1 紅燒牛肉麵"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sun_tomorrow',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '週日+1 紅燒牛肉麵' }
});
assert.strictEqual(lastReply.type, 'flex', 'Sunday order should succeed');
assert.strictEqual(SheetModule._mockStore.Orders.length, 2);
assert.strictEqual(SheetModule._mockStore.Orders[1].dayOfWeek, '週日');
assert.strictEqual(SheetModule._mockStore.Orders[1].itemName, '紅燒牛肉麵');

// G. Order for next week Monday "週一+1 招牌排骨飯"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_mon_next',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '週一+1 招牌排骨飯' }
});
assert.strictEqual(lastReply.type, 'flex', 'Next Monday order should succeed');
assert.strictEqual(SheetModule._mockStore.Orders.length, 3);
assert.strictEqual(SheetModule._mockStore.Orders[2].dayOfWeek, '週一');

// H. Saturday after cutoff: 2026-09-12 11:30:00 Taiwan time (UTC 03:30)
var satAfterCutoff = new Date('2026-09-12T03:30:00.000Z');
globalThis._mockCurrentDate = satAfterCutoff;
assert.strictEqual(OrderModule.isTodayCutoffPassed('週六', satAfterCutoff), true, 'Saturday cutoff should pass at 11:30');

// Trying to order for Saturday today after cutoff should fail
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sat_late',
  source: { userId: 'usr_late', displayName: '遲到者' },
  message: { type: 'text', text: '週六+1 班尼迪克蛋' }
});
assert.ok(lastReply && lastReply.type === 'text', 'Should reject Saturday order after cutoff');
assert.ok(lastReply.text.includes('尚未開放點餐或已經截止'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 3, 'No order should be added after Saturday cutoff');

// But ordering for Sunday or Monday after Saturday cutoff still succeeds!
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_sun_valid',
  source: { userId: 'usr_late', displayName: '遲到者' },
  message: { type: 'text', text: '週日+1 紅燒牛肉麵' }
});
assert.strictEqual(lastReply.type, 'flex', 'Sunday order after Saturday cutoff must succeed');
assert.strictEqual(SheetModule._mockStore.Orders.length, 4);

// I. Day Specific Menus for Saturday & Sunday
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_menu_sat',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '週六菜單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('週末早午餐'));

lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_menu_sun',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: 'sunday menu' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('週末牛肉麵'));

// J. Weekly Order Summary with Weekend
var weeklySummary7 = SheetModule.getWeeklyOrderSummary();
assert.strictEqual(weeklySummary7.daySummaries.length, 7, 'Weekly summary must have 7 days when weekend enabled');
var satSummary = weeklySummary7.daySummaries.find(function (ds) { return ds.dayOfWeek === '週六'; });
var sunSummary = weeklySummary7.daySummaries.find(function (ds) { return ds.dayOfWeek === '週日'; });
assert.ok(satSummary && satSummary.totalQuantity === 1, 'Saturday summary should record 1 item');
assert.ok(sunSummary && sunSummary.totalQuantity === 2, 'Sunday summary should record 2 items');

// K. Personal Weekly Query "本週訂單" includes weekend items
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_my_weekly_7',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '本週訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('【週六 🔒[已截止]】班尼迪克蛋'), 'Saturday order must show with cutoff tag');
assert.ok(lastReply.text.includes('【週日】紅燒牛肉麵'), 'Sunday order must show');
assert.ok(lastReply.text.includes('【週一】招牌排骨飯'), 'Monday order must show');

// L. Cancellation on Weekend
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_cancel_sun',
  source: { userId: 'usr_sat_weekend', displayName: '週末饕客' },
  message: { type: 'text', text: '取消 週日 紅燒牛肉麵' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('已為您取消') && lastReply.text.includes('週日') && lastReply.text.includes('紅燒牛肉麵'));

// Cleanup weekend test state
SheetModule._mockStore.Config['ALLOW_WEEKEND_ORDERING'] = 'false';
SheetModule._mockStore.WeeklySchedule = SheetModule._mockStore.WeeklySchedule.filter(function (s) {
  return s.dayOfWeek !== '週六' && s.dayOfWeek !== '週日';
});
SheetModule._mockStore.Menu = SheetModule._mockStore.Menu.filter(function (m) {
  return m.dayOfWeek !== '週六' && m.dayOfWeek !== '週日';
});
SheetModule._mockStore.Orders = [];
globalThis._mockCurrentDate = null;

console.log('  ✔ Saturday pre-ordering, weekend ordering toggle, cutoff, summary & cancel verified.\n');

// --------------------------------------------------------------------------
// Test 16: Menu Pagination & Order Immunity
// --------------------------------------------------------------------------
console.log('▶ Test 16: Menu Pagination & Order Immunity');

// 1. Direct FlexMessage pagination rendering verification
var bigMenu45 = [];
for (var mi = 1; mi <= 45; mi++) {
  bigMenu45.push({
    category: mi <= 25 ? '飯類' : '麵類',
    itemName: '特餐' + mi,
    price: 80 + mi,
    isAvailable: true,
    description: '特餐說明' + mi
  });
}

// Page 1 of 3 (zh-TW)
var flexP1 = FlexModule.createMenuFlex('大豪吃餐廳', '10:30', bigMenu45, '週一', 'zh-TW', 1, 20);
assert.strictEqual(flexP1.type, 'bubble');
var p1Json = JSON.stringify(flexP1);
assert.ok(p1Json.includes('第 1 / 3 頁 (共 3 頁)'), 'Page 1 header must include page 1 / 3 indicator');
assert.ok(p1Json.includes('全店共 45 道餐點'), 'Page 1 footer must include total items 45');
assert.ok(p1Json.includes('週一菜單 第2頁'), 'Page 1 must have button targeting page 2');
assert.ok(p1Json.includes('週一菜單 第3頁'), 'Page 1 must have button targeting page 3');
assert.ok(!p1Json.includes('週一菜單 第1頁'), 'Page 1 must not have button targeting current page 1');

// Page 2 of 3 (zh-TW)
var flexP2 = FlexModule.createMenuFlex('大豪吃餐廳', '10:30', bigMenu45, '週一', 'zh-TW', 2, 20);
var p2Json = JSON.stringify(flexP2);
assert.ok(p2Json.includes('第 2 / 3 頁 (共 3 頁)'), 'Page 2 header must include page 2 / 3 indicator');
assert.ok(p2Json.includes('週一菜單 第1頁'), 'Page 2 must have button targeting page 1');
assert.ok(p2Json.includes('週一菜單 第3頁'), 'Page 2 must have button targeting page 3');
assert.ok(!p2Json.includes('週一菜單 第2頁'), 'Page 2 must not have button targeting current page 2');

// English locale pagination (en)
var flexP1En = FlexModule.createMenuFlex('Tasty Food', '10:30', bigMenu45, '週一', 'en', 1, 20);
var p1EnJson = JSON.stringify(flexP1En);
assert.ok(p1EnJson.includes('Page 1 / 3 (Total 3 pages)'), 'English header must show Page 1 / 3 (Total 3 pages)');
assert.ok(p1EnJson.includes('Page 2'), 'English button must show Page 2');
assert.ok(p1EnJson.includes('Currently page 1 / 3'), 'English footer must show currently page 1 / 3');

// 2. Unit testing isMenuPageCommand & parseMenuPageNumber
assert.strictEqual(OrderModule.isMenuPageCommand('第2頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('第 2 頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('第二頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('page 2'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('Page 3'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('2頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('菜單 第2頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('週一菜單 第2頁'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('menu page 2'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('menu 2'), true);
assert.strictEqual(OrderModule.isMenuPageCommand('招牌排骨飯'), false);
assert.strictEqual(OrderModule.isMenuPageCommand('排骨飯+1'), false);

assert.strictEqual(OrderModule.parseMenuPageNumber('2'), 2);
assert.strictEqual(OrderModule.parseMenuPageNumber('二'), 2);
assert.strictEqual(OrderModule.parseMenuPageNumber('三'), 3);
assert.strictEqual(OrderModule.parseMenuPageNumber('10'), 10);

// 3. Order Immunity: parseOrderText must never extract page requests as order items!
assert.deepStrictEqual(OrderModule.parseOrderText('第2頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('第 2 頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('菜單 第2頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('週一菜單 第2頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('第2頁+1'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('+1 第2頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('點餐 第2頁'), []);
assert.deepStrictEqual(OrderModule.parseOrderText('page 2'), []);

// 4. End-to-end Chat Command & Immunity
SheetModule._mockStore.Config['IS_ORDERING_OPEN'] = 'true';
SheetModule._mockStore.Config['RESTAURANT_NAME'] = '大豪吃餐廳';
SheetModule._mockStore.Config['CUTOFF_TIME'] = '11:00';
SheetModule.setWeeklyScheduleDay('週一', '大豪吃餐廳', '10:30');
SheetModule._mockStore.Orders = [];
SheetModule._mockStore.Menu = [];

bigMenu45.forEach(function (item) {
  SheetModule._mockStore.Menu.push({
    dayOfWeek: '週一',
    restaurantName: '大豪吃餐廳',
    category: item.category,
    itemName: item.itemName,
    price: item.price,
    isAvailable: 'TRUE',
    description: item.description
  });
});

// A. Send "菜單 第2頁"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_page_2_req',
  source: { userId: 'usr_page_test', displayName: '分頁測試者' },
  message: { type: 'text', text: '菜單 第2頁' }
});
assert.strictEqual(lastReply.type, 'flex', '菜單 第2頁 should reply with flex menu');
assert.ok(lastReply.altText.includes('第2頁'));
assert.ok(JSON.stringify(lastReply.flex).includes('第 2 / 3 頁'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 0, 'No order should be created when viewing page 2!');

// B. Send standalone "第2頁"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_standalone_p2',
  source: { userId: 'usr_page_test', displayName: '分頁測試者' },
  message: { type: 'text', text: '第2頁' }
});
assert.strictEqual(lastReply.type, 'flex', 'Standalone 第2頁 should reply with flex menu');
assert.ok(JSON.stringify(lastReply.flex).includes('第 2 / 3 頁'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 0, 'No order should be created when sending 第2頁!');

// C. Send "週一菜單 第3頁"
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_mon_p3',
  source: { userId: 'usr_page_test', displayName: '分頁測試者' },
  message: { type: 'text', text: '週一菜單 第3頁' }
});
assert.strictEqual(lastReply.type, 'flex', '週一菜單 第3頁 should reply with flex menu');
assert.ok(JSON.stringify(lastReply.flex).includes('第 3 / 3 頁'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 0, 'No order should be created when viewing Monday page 3!');

// D. Postback event action=menu_page
lastReply = null;
OrderModule.handlePostbackEvent({
  replyToken: 'tok_postback_page',
  source: { userId: 'usr_page_test', displayName: '分頁測試者' },
  postback: {
    data: 'action=menu_page&day=週一&page=2'
  }
});
assert.strictEqual(lastReply.type, 'flex', 'Postback menu_page should reply with flex menu');
assert.ok(JSON.stringify(lastReply.flex).includes('第 2 / 3 頁'));
assert.strictEqual(SheetModule._mockStore.Orders.length, 0, 'No order should be created via postback menu_page!');

// E. Verify real food order still works properly
lastReply = null;
OrderModule.handleTextMessage({
  replyToken: 'tok_real_order',
  source: { userId: 'usr_page_test', displayName: '分頁測試者' },
  message: { type: 'text', text: '週一+1 特餐1' }
});
assert.strictEqual(lastReply.type, 'flex', 'Real food order should succeed');
assert.strictEqual(SheetModule._mockStore.Orders.length, 1, 'Exactly 1 order record should be saved');
assert.strictEqual(SheetModule._mockStore.Orders[0].itemName, '特餐1');

// Clean up
SheetModule.setWeeklyScheduleDay('週一', '福山排骨便當', '10:30');
SheetModule._mockStore.Orders = [];
SheetModule._mockStore.Menu = [];

console.log('  ✔ Menu pagination, page navigation buttons, and strict order immunity verified.\n');

console.log('🎉 ALL EXTENDED TESTS PASSED SUCCESSFULLY! 100% Verified.');


