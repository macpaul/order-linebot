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
let lastPush = null;
globalThis.pushText = LineModule.pushText = function (to, text) {
  lastPush = { to: to, text: text };
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
console.log('  ✔ Text parsing (single-day and Mon-Fri batch) passed.\n');

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
assert.strictEqual(helpButtons.length, 8);
assert.strictEqual(helpButtons[0].action.text, '本週菜單');
assert.strictEqual(helpButtons[1].action.text, '菜單');
assert.strictEqual(helpButtons[2].action.text, '我的訂單');
assert.strictEqual(helpButtons[3].action.text, '我的本週訂單');
assert.strictEqual(helpButtons[4].action.text, '取消餐點');
assert.strictEqual(helpButtons[7].action.text, '結單');
console.log('  ✔ Buttonized Help card verified with 8 quick-action buttons.');

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
const bobOrdersInStore = SheetModule._mockStore.Orders.filter(function (o) { return o.userId === 'user_bob'; });
assert.ok(bobOrdersInStore.length > 0);
assert.strictEqual(bobOrdersInStore[0].userNickname, '小鮑伯');
console.log('  ✔ Orders sheet UserNickname column and dynamic header mapping verified.');

// 7-5: Verify initSheets backfills all recently added Config variables
delete SheetModule._mockStore.Config['ORGANIZER_ID'];
delete SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'];
delete SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'];
delete SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'];
assert.strictEqual(SheetModule._mockStore.Config['ORGANIZER_ID'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'], undefined);
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'], undefined);

const initRes = SheetModule.initSheets();
assert.strictEqual(initRes, true);
assert.strictEqual(SheetModule._mockStore.Config['ORGANIZER_ID'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_BANK_QR_URL'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_NAME'], '');
assert.strictEqual(SheetModule._mockStore.Config['PAYMENT_LINEPAY_USER_ID'], '');
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

// Verify Help Card command for 今日統計
var helpCard = FlexModule.createHelpFlex();
var helpJson = JSON.stringify(helpCard);
assert.ok(helpJson.includes('"text":"今日統計"'), 'Help card button for 今日統計 must explicitly dispatch 今日統計 command');

console.log('  ✔ 今日統計 is completely independent of CLOSE_ORDER_SCOPE / ORDER_RECEIPT_SCOPE and strictly isolates today\'s data.');

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
console.log('  ✔ Dynamic spreadsheet timezone reading & diagnostic tool verified.\n');

console.log('🎉 ALL EXTENDED TESTS PASSED SUCCESSFULLY! 100% Verified.');
