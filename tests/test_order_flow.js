/**
 * test_order_flow.js - End-to-end integration and unit test suite
 * Tests full meal ordering lifecycle offline without requiring real LINE or Google API calls.
 */

const assert = require('assert');
const ConfigModule = require('../src/Config.js');
const SheetModule = require('../src/SheetService.js');
const FlexModule = require('../src/FlexMessage.js');
const LineModule = require('../src/LineService.js');
const OrderModule = require('../src/OrderService.js');
const CodeModule = require('../src/Code.js');

console.log('🧪 Starting LINE Meal Ordering Bot Test Suite...\n');

// 1. Text Parsing Tests
console.log('▶ Test 1: Order Text Parsing');
const p1 = OrderModule.parseOrderText('+1 招牌排骨飯');
assert.strictEqual(p1.length, 1);
assert.strictEqual(p1[0].itemName, '招牌排骨飯');
assert.strictEqual(p1[0].quantity, 1);

const p2 = OrderModule.parseOrderText('酥炸雞腿飯 + 2');
assert.strictEqual(p2.length, 1);
assert.strictEqual(p2[0].itemName, '酥炸雞腿飯');
assert.strictEqual(p2[0].quantity, 2);

const p3 = OrderModule.parseOrderText('清蒸魚排飯*3, 古早味紅茶x2');
assert.strictEqual(p3.length, 2);
assert.strictEqual(p3[0].itemName, '清蒸魚排飯');
assert.strictEqual(p3[0].quantity, 3);
assert.strictEqual(p3[1].itemName, '古早味紅茶');
assert.strictEqual(p3[1].quantity, 2);
console.log('  ✔ Text parsing passed.\n');

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

// 3. Full Ordering Lifecycle Test
console.log('▶ Test 3: Full Meal Ordering Lifecycle Simulation');
const groupId = 'group_team_abc';
const today = OrderModule.getTodayDateString();

// Step A: Open order
console.log('  [Step A] Organizer opens order');
OrderModule.handleTextMessage({
  replyToken: 'token_1',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '開單 老王便當 11:30' }
});
assert.strictEqual(SheetModule.getConfigValue('IS_ORDERING_OPEN'), 'true');
assert.strictEqual(SheetModule.getConfigValue('RESTAURANT_NAME'), '老王便當');
assert.strictEqual(SheetModule.getConfigValue('CUTOFF_TIME'), '11:30');
assert.strictEqual(lastReply.type, 'flex');
console.log('  ✔ Order session successfully opened.');

// Step B: Alice orders 排骨飯 + 1
console.log('  [Step B] Alice places an order (+1 招牌排骨飯)');
OrderModule.handleTextMessage({
  replyToken: 'token_2',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '+1 招牌排骨飯' }
});
assert.strictEqual(lastReply.type, 'flex');
const aliceOrders = SheetModule.getUserOrders('user_alice', groupId, today);
assert.strictEqual(aliceOrders.length, 1);
assert.strictEqual(aliceOrders[0].itemName, '招牌排骨飯');
assert.strictEqual(aliceOrders[0].subtotal, 100);
console.log('  ✔ Alice order recorded.');

// Step C: Bob orders 2 chicken legs and 1 black tea
console.log('  [Step C] Bob places multi-item order (酥炸雞腿飯+2, 古早味紅茶+1)');
OrderModule.handleTextMessage({
  replyToken: 'token_3',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '酥炸雞腿飯+2, 古早味紅茶+1' }
});
const bobOrders = SheetModule.getUserOrders('user_bob', groupId, today);
assert.strictEqual(bobOrders.length, 2);
console.log('  ✔ Bob multi-item order recorded.');

// Step D: Bob queries his orders
console.log('  [Step D] Bob queries his order (我的訂單)');
OrderModule.handleTextMessage({
  replyToken: 'token_4',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '我的訂單' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('酥炸雞腿飯 x2'));
assert.ok(lastReply.text.includes('古早味紅茶 x1'));
assert.ok(lastReply.text.includes('245')); // 110*2 + 25 = 245
console.log('  ✔ Order query verified.');

// Step E: Bob cancels black tea
console.log('  [Step E] Bob cancels black tea (取消 古早味紅茶)');
OrderModule.handleTextMessage({
  replyToken: 'token_5',
  source: { groupId: groupId, userId: 'user_bob' },
  message: { type: 'text', text: '取消 古早味紅茶' }
});
assert.ok(lastReply.text.includes('已為您取消'));
const bobOrdersAfterCancel = SheetModule.getUserOrders('user_bob', groupId, today);
assert.strictEqual(bobOrdersAfterCancel.length, 1);
assert.strictEqual(bobOrdersAfterCancel[0].itemName, '酥炸雞腿飯');
console.log('  ✔ Cancellation verified.');

// Step F: View real-time summary
console.log('  [Step F] Team views summary (統計)');
OrderModule.handleTextMessage({
  replyToken: 'token_6',
  source: { groupId: groupId, userId: 'user_alice' },
  message: { type: 'text', text: '統計' }
});
assert.strictEqual(lastReply.type, 'flex');
const summary = SheetModule.getOrderSummary(groupId, today);
// Alice: 1 pork chop (100). Bob: 2 chicken legs (220). Total = 320, 3 items
assert.strictEqual(summary.totalQuantity, 3);
assert.strictEqual(summary.totalAmount, 320);
console.log('  ✔ Summary calculation verified (Total items: 3, Total: $320).');

// Step G: Organizer closes order
console.log('  [Step G] Organizer closes order (結單)');
OrderModule.handleTextMessage({
  replyToken: 'token_7',
  source: { groupId: groupId, userId: 'user_boss' },
  message: { type: 'text', text: '結單' }
});
assert.strictEqual(SheetModule.getConfigValue('IS_ORDERING_OPEN'), 'false');
console.log('  ✔ Session closed.');

// Step H: Late order attempt rejected
console.log('  [Step H] Late order attempt after cutoff');
OrderModule.handleTextMessage({
  replyToken: 'token_8',
  source: { groupId: groupId, userId: 'user_late' },
  message: { type: 'text', text: '+1 招牌排骨飯' }
});
assert.strictEqual(lastReply.type, 'text');
assert.ok(lastReply.text.includes('尚未開放點餐或已經截止'));
console.log('  ✔ Late order properly rejected.\n');

// 4. Webhook Entrypoint Test (doGet & doPost)
console.log('▶ Test 4: Webhook HTTP Endpoints');
const getRes = CodeModule.doGet({});
assert.strictEqual(getRes.status, 'online');

const postRes = CodeModule.doPost({
  postData: {
    contents: JSON.stringify({
      events: [
        {
          type: 'message',
          replyToken: 'token_webhook',
          source: { groupId: 'g1', userId: 'u1' },
          message: { type: 'text', text: '說明' }
        }
      ]
    })
  }
});
assert.strictEqual(postRes.statusCode, 200);
console.log('  ✔ Webhook doPost and doGet passed.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% Verified.');
