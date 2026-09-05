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

// 4. Weekly Schedule & Batch Ordering Lifecycle Test
console.log('▶ Test 4: Weekly Schedule & Mon-Fri Batch Ordering Simulation');
const groupId = 'group_team_weekly';
const today = OrderModule.getTodayDateString();

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

// Step B: Query Specific Day Menu
console.log('  [Step B] Member queries Tuesday menu (週二菜單)');
OrderModule.handleTextMessage({
  replyToken: 'token_tue_menu',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '週二菜單' }
});
assert.strictEqual(lastReply.type, 'flex');
assert.ok(lastReply.altText.includes('週二'));
console.log('  ✔ Day-specific menu flex card verified.');

// Step C: Member Alice places multi-day batch order
console.log('  [Step C] Alice orders across multiple weekdays in one command');
OrderModule.handleTextMessage({
  replyToken: 'token_batch_order',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '週一 排骨飯+1, 週二 日式厚切豬排飯+1, 週三 招牌鍋貼+2' }
});
assert.strictEqual(lastReply.type, 'flex');

const aliceMonOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週一');
assert.strictEqual(aliceMonOrders.length, 1);
assert.strictEqual(aliceMonOrders[0].quantity, 1);

const aliceTueOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週二');
assert.strictEqual(aliceTueOrders.length, 1);
assert.strictEqual(aliceTueOrders[0].itemName, '日式厚切豬排飯');

const aliceWedOrders = SheetModule.getUserOrders('user_alice', groupId, null, '週三');
assert.strictEqual(aliceWedOrders.length, 1);
assert.strictEqual(aliceWedOrders[0].quantity, 2);
console.log('  ✔ Alice multi-day batch order recorded.');

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
console.log('  ✔ Bob Friday order recorded.');

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

// Step F: Alice cancels Tuesday order
console.log('  [Step F] Alice cancels Tuesday order (取消 週二 全部)');
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
console.log('  ✔ Weekly batch summary verified (Grand Total: 5 items, $460).\n');

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

console.log('🎉 ALL EXTENDED TESTS PASSED SUCCESSFULLY! 100% Verified.');
