/**
 * OrderService.js - Core business logic and message dispatching for Meal Ordering Bot
 * Compatible with Google Apps Script (GAS) and Node.js testing.
 */

/* ------------------------------------------------------------------ *
 * Dependencies Bootstrap
 * ------------------------------------------------------------------ */
var ConfigModule = null;
var SheetModule = null;
var FlexModule = null;
var LineModule = null;

(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : null;

  if (g && g.CONFIG && g.addOrder && g.createMenuFlex) {
    ConfigModule = g;
    SheetModule = g;
    FlexModule = g;
    LineModule = g;
  } else {
    try {
      ConfigModule = require('./Config.js');
      SheetModule = require('./SheetService.js');
      FlexModule = require('./FlexMessage.js');
      LineModule = require('./LineService.js');
    } catch (e) {
      // Fallback
    }
  }
})();

/**
 * Helper to get today's date in YYYY-MM-DD format (Taiwan time UTC+8)
 */
function getTodayDateString() {
  var d = new Date();
  // Adjust for UTC+8 if needed
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var year = twDate.getFullYear();
  var month = ('0' + (twDate.getMonth() + 1)).slice(-2);
  var day = ('0' + twDate.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * Parse ordering text lines
 * Supports:
 *   "+1 排骨飯" / "+2 雞腿飯"
 *   "排骨飯+1" / "雞腿飯 + 2"
 *   "排骨飯*1" / "排骨飯 * 2"
 *   "點餐 排骨飯 1"
 * Can be separated by commas, semicolons, or newlines
 */
function parseOrderText(text) {
  if (!text) return [];
  var clean = text.replace(/，|；/g, ',');
  var lines = clean.split(/[\n,]+/);
  var parsedItems = [];

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].trim();
    if (!raw) continue;

    var qty = 1;
    var itemName = '';

    // Pattern 1: +1 排骨飯 or +2 雞腿飯
    var match1 = raw.match(/^\+([0-9]+)\s*(.+)$/);
    if (match1) {
      qty = parseInt(match1[1], 10);
      itemName = match1[2].trim();
      parsedItems.push({ itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 2: 排骨飯+1 or 雞腿飯 + 2
    var match2 = raw.match(/^(.+?)\s*\+\s*([0-9]+)$/);
    if (match2) {
      itemName = match2[1].trim();
      qty = parseInt(match2[2], 10);
      parsedItems.push({ itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 3: 排骨飯*1 or 雞腿飯 * 2 or 排骨飯x2
    var match3 = raw.match(/^(.+?)\s*[*xX]\s*([0-9]+)$/);
    if (match3) {
      itemName = match3[1].trim();
      qty = parseInt(match3[2], 10);
      parsedItems.push({ itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 4: 點餐 排骨飯 2 or 點餐 排骨飯
    var match4 = raw.match(/^點餐\s+(.+?)(?:\s+([0-9]+))?$/);
    if (match4) {
      itemName = match4[1].trim();
      qty = match4[2] ? parseInt(match4[2], 10) : 1;
      parsedItems.push({ itemName: itemName, quantity: qty });
      continue;
    }
  }

  return parsedItems;
}

/**
 * Match an ordered item name with the menu items to determine standard name & price
 */
function matchMenuItem(rawItemName, menuList) {
  if (!menuList || menuList.length === 0) {
    return { itemName: rawItemName, price: 0 };
  }

  // 1. Exact match
  for (var i = 0; i < menuList.length; i++) {
    if (menuList[i].itemName === rawItemName) {
      return { itemName: menuList[i].itemName, price: menuList[i].price };
    }
  }

  // 2. Contains match (e.g. "排骨" matches "招牌排骨飯")
  for (var j = 0; j < menuList.length; j++) {
    if (menuList[j].itemName.indexOf(rawItemName) !== -1 || rawItemName.indexOf(menuList[j].itemName) !== -1) {
      return { itemName: menuList[j].itemName, price: menuList[j].price };
    }
  }

  // Fallback if not found on menu
  return { itemName: rawItemName, price: 0 };
}

/**
 * Main Message Dispatcher
 */
function handleTextMessage(event) {
  var replyToken = event.replyToken;
  var text = (event.message && event.message.text ? event.message.text : '').trim();
  var source = event.source || {};
  var userId = source.userId || 'anonymous';
  var groupId = source.groupId || source.roomId || '';
  var today = getTodayDateString();

  if (!text) return null;

  // 1. HELP: 幫助 / 說明 / 指令 / help
  if (/^(幫助|說明|指令|help|\/help)$/i.test(text)) {
    var helpFlex = FlexModule.createHelpFlex();
    return LineModule.replyFlex(replyToken, '便當點餐指令說明', helpFlex);
  }

  // 2. OPEN ORDER: 開單 [店家] [時間] / 開始訂餐
  var openMatch = text.match(/^(?:\/)?(?:開單|開始訂餐)(?:\s+(.+?))?(?:\s+([0-9]{1,2}:[0-9]{2}))?$/);
  if (openMatch) {
    var restaurant = openMatch[1] ? openMatch[1].trim() : '今日便當';
    var cutoff = openMatch[2] ? openMatch[2].trim() : '11:00';

    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');
    SheetModule.setConfigValue('RESTAURANT_NAME', restaurant);
    SheetModule.setConfigValue('CUTOFF_TIME', cutoff);
    SheetModule.setConfigValue('ORGANIZER_ID', userId);

    var menuList = SheetModule.getMenuItems();
    var menuFlex = FlexModule.createMenuFlex(restaurant, cutoff, menuList);
    return LineModule.replyFlex(replyToken, '【訂餐開始】' + restaurant + ' 菜單', menuFlex);
  }

  // 3. MENU: 菜單 / menu
  if (/^(?:\/)?(?:菜單|menu)$/i.test(text)) {
    var curRestaurant = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var curCutoff = SheetModule.getConfigValue('CUTOFF_TIME', '11:00');
    var curMenu = SheetModule.getMenuItems();
    var curMenuFlex = FlexModule.createMenuFlex(curRestaurant, curCutoff, curMenu);
    return LineModule.replyFlex(replyToken, curRestaurant + ' 菜單', curMenuFlex);
  }

  // 4. MY ORDERS: 我的訂單 / 查詢訂單 / 查單
  if (/^(?:\/)?(?:我的訂單|查詢訂單|查單)$/.test(text)) {
    var myOrders = SheetModule.getUserOrders(userId, groupId, today);
    if (!myOrders || myOrders.length === 0) {
      return LineModule.replyText(replyToken, '您今日尚未有訂餐紀錄喔！可以直接輸入「+1 [餐點名稱]」點餐。');
    }
    var total = 0;
    var lines = myOrders.map(function (o) {
      total += o.subtotal;
      return '• ' + o.itemName + ' x' + o.quantity + ' ($' + o.subtotal + ')';
    });
    var msg = '【您的今日訂單】\n' + lines.join('\n') + '\n─────\n總計：$' + total + ' 元';
    return LineModule.replyText(replyToken, msg);
  }

  // 5. CANCEL: 取消全部 / 取消 [品項]
  var cancelMatch = text.match(/^(?:\/)?取消(?:\s*(全部|.+))?$/);
  if (cancelMatch) {
    var isOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    if (!isOpen) {
      return LineModule.replyText(replyToken, '⚠️ 今日訂餐已截止，無法變更或取消訂單。如需修改請直接聯繫開單負責人。');
    }
    var targetItem = cancelMatch[1] ? cancelMatch[1].trim() : '';
    if (targetItem === '全部') targetItem = '';

    var cancelledCount = SheetModule.cancelOrder(userId, groupId, targetItem, today);
    if (cancelledCount > 0) {
      return LineModule.replyText(replyToken, '✅ 已為您取消 ' + (targetItem ? '「' + targetItem + '」' : '全部餐點') + ' 共 ' + cancelledCount + ' 筆紀錄。');
    } else {
      return LineModule.replyText(replyToken, '查無符合「' + (targetItem || '所有餐點') + '」的未取消訂單。');
    }
  }

  // 6. SUMMARY: 統計 / 即時統計
  if (/^(?:\/)?(?:統計|即時統計)$/.test(text)) {
    var restName = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var isOrderOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    var summary = SheetModule.getOrderSummary(groupId, today);
    var sumFlex = FlexModule.createSummaryFlex(restName, summary, !isOrderOpen);
    return LineModule.replyFlex(replyToken, '【訂餐統計】' + restName, sumFlex);
  }

  // 7. CLOSE ORDER: 結單 / 截止 / 截止訂餐
  if (/^(?:\/)?(?:結單|截止|截止訂餐)$/.test(text)) {
    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'false');
    var finalRest = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var finalSummary = SheetModule.getOrderSummary(groupId, today);
    var finalFlex = FlexModule.createSummaryFlex(finalRest, finalSummary, true);
    return LineModule.replyFlex(replyToken, '【已結單】' + finalRest + ' 訂購名單總計', finalFlex);
  }

  // 8. ORDER PLACEMENT: +1 / +2 / 點餐語法解析
  var orderItems = parseOrderText(text);
  if (orderItems.length > 0) {
    var orderOpenStatus = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    if (!orderOpenStatus) {
      return LineModule.replyText(replyToken, '⚠️ 目前尚未開放點餐或已經截止囉！若要開單請傳送「開單 [店家名] [時間]」。');
    }

    var menu = SheetModule.getMenuItems();
    var lastAdded = null;
    var userDisplayName = '成員';

    // Try fetching user name
    try {
      if (LineModule.getUserProfile) {
        var profilePromise = LineModule.getUserProfile(userId, groupId);
        // If async
        if (profilePromise && typeof profilePromise.then === 'function') {
          profilePromise.then(function (prof) {
            if (prof && prof.displayName) userDisplayName = prof.displayName;
          });
        } else if (profilePromise && profilePromise.displayName) {
          userDisplayName = profilePromise.displayName;
        }
      }
    } catch (e) {
      // Ignored
    }

    orderItems.forEach(function (oi) {
      var matched = matchMenuItem(oi.itemName, menu);
      var record = SheetModule.addOrder({
        date: today,
        groupId: groupId,
        userId: userId,
        userName: userDisplayName,
        itemName: matched.itemName,
        quantity: oi.quantity,
        price: matched.price
      });
      lastAdded = record;
    });

    var allMyOrders = SheetModule.getUserOrders(userId, groupId, today);
    var receiptFlex = FlexModule.createOrderReceiptFlex(userDisplayName, lastAdded, allMyOrders);
    return LineModule.replyFlex(replyToken, '訂單已記錄：' + lastAdded.itemName, receiptFlex);
  }

  // Not a bot command, ignore quietly (no replyToken wasted)
  return null;
}

/**
 * Handle Postback Event (Buttons clicked on Flex Messages)
 */
function handlePostbackEvent(event) {
  var replyToken = event.replyToken;
  var dataStr = (event.postback && event.postback.data) || '';
  var params = {};
  dataStr.split('&').forEach(function (pair) {
    var parts = pair.split('=');
    if (parts.length === 2) {
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }
  });

  // Action routing
  if (params.action === 'order' && params.item) {
    var pseudoMessageEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        type: 'text',
        text: '+1 ' + params.item
      }
    };
    return handleTextMessage(pseudoMessageEvent);
  }

  if (params.action === 'cancel' && params.item) {
    var pseudoCancelEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        type: 'text',
        text: '取消 ' + params.item
      }
    };
    return handleTextMessage(pseudoCancelEvent);
  }

  return null;
}

// Dual export
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.parseOrderText = parseOrderText;
  g.matchMenuItem = matchMenuItem;
  g.handleTextMessage = handleTextMessage;
  g.handlePostbackEvent = handlePostbackEvent;
  g.getTodayDateString = getTodayDateString;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseOrderText: parseOrderText,
      matchMenuItem: matchMenuItem,
      handleTextMessage: handleTextMessage,
      handlePostbackEvent: handlePostbackEvent,
      getTodayDateString: getTodayDateString
    };
  }
})();
