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
var UberEatsModule = null;

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
    UberEatsModule = g;
  } else {
    try {
      ConfigModule = require('./Config.js');
      SheetModule = require('./SheetService.js');
      FlexModule = require('./FlexMessage.js');
      LineModule = require('./LineService.js');
      UberEatsModule = require('./UberEatsService.js');
    } catch (e) {
      // Fallback
    }
  }
})();

var DAY_ORDER = { '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5 };

/**
 * Helper to get today's date in YYYY-MM-DD format (Taiwan time UTC+8)
 */
function getTodayDateString(refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var year = twDate.getFullYear();
  var month = ('0' + (twDate.getMonth() + 1)).slice(-2);
  var day = ('0' + twDate.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * Helper to get today's day of week in Chinese (週一~週五, fallback to 週一 on weekends)
 */
function getTodayDayOfWeek(refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  var day = dayMap[twDate.getDay()];
  if (day === '週六' || day === '週日') return '週一';
  return day;
}

/**
 * Check if a weekday has already passed compared to current Taiwan date
 * @param {string} targetDay - e.g. '週一'
 * @param {Date} [refDate] - Optional reference date for testing
 * @returns {boolean}
 */
function isDayPast(targetDay, refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var currentDayIndex = twDate.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  var targetDayIndex = DAY_ORDER[targetDay];
  if (!targetDayIndex) return false;

  // Saturday (6): whole week Mon-Fri (1-5) has passed
  if (currentDayIndex === 6) {
    return true;
  }
  // Mon-Fri (1-5): any day index strictly less than today is past
  if (currentDayIndex >= 1 && currentDayIndex <= 5) {
    return targetDayIndex < currentDayIndex;
  }
  // Sunday (0): orders apply to the upcoming week, not past
  return false;
}

/**
 * Check if today's order cutoff has passed
 * @param {string} day - Day to check (only checks if day === actualTodayStr)
 * @param {Date} [refDate] - Optional reference date for testing
 * @returns {boolean}
 */
function isTodayCutoffPassed(day, refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var currentDayIndex = twDate.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  var actualTodayStr = dayMap[currentDayIndex];

  // If today is weekend (Sun or Sat), weekdays Mon-Fri are not today
  if (currentDayIndex < 1 || currentDayIndex > 5) {
    return false;
  }

  // Only applies to today's meal
  if (day && day !== actualTodayStr) {
    return false;
  }

  // 1. If ordering is closed by organizer (IS_ORDERING_OPEN === 'false')
  var isOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'true');
  if (isOpen === 'false') {
    return true;
  }

  // 2. Check cutoff time against current Taiwan time
  var cutoffStr = '';
  var daySched = SheetModule.getScheduleByDay ? SheetModule.getScheduleByDay(actualTodayStr) : null;
  if (daySched && daySched.cutoffTime) {
    cutoffStr = daySched.cutoffTime;
  } else {
    cutoffStr = SheetModule.getConfigValue('CUTOFF_TIME', '11:00');
  }

  if (!cutoffStr) return false;

  var parts = cutoffStr.split(':');
  if (parts.length < 2) return false;
  var cutoffMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  var currentMinutes = twDate.getHours() * 60 + twDate.getMinutes();

  return currentMinutes >= cutoffMinutes;
}

/**
 * Send LINE push notification to the organizer if ORGANIZER_ID is configured
 * @param {string} notificationText
 */
function notifyOrganizer(notificationText) {
  if (!SheetModule || !LineModule || !LineModule.pushText) return;
  try {
    var organizerId = SheetModule.getConfigValue('ORGANIZER_ID', '');
    if (organizerId && String(organizerId).trim() !== '') {
      LineModule.pushText(String(organizerId).trim(), notificationText);
    }
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.error('Failed to notify organizer:', e);
    }
  }
}

/**
 * Parse ordering text lines
 * Supports daily and weekly batch ordering syntax:
 *   "+1 排骨飯" / "+2 雞腿飯"
 *   "排骨飯+1" / "雞腿飯 + 2"
 *   "排骨飯*1" / "排骨飯 * 2"
 *   "週一+1 排骨飯" / "週一 排骨飯+1" / "週二 雞腿飯*2"
 *   "週一 排骨飯+1, 週二 雞腿飯+1, 週四 燒肉飯+1"
 */
function parseOrderText(text) {
  if (!text) return [];
  var clean = text.replace(/，|；/g, ',');
  var lines = clean.split(/[\n,]+/);
  var parsedItems = [];

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].trim();
    if (!raw) continue;

    var dayOfWeek = null;
    var dayMatch = raw.match(/^(週[一二三四五]|禮拜[一二三四五]|星期[一二三四五])/);
    if (dayMatch) {
      var d = dayMatch[1];
      dayOfWeek = '週' + d.slice(-1);
      raw = raw.replace(dayMatch[0], '').trim();
    }

    var qty = 1;
    var itemName = '';

    // Pattern 1: +1 排骨飯 or +2 雞腿飯
    var match1 = raw.match(/^\+([0-9]+)\s*(.+)$/);
    if (match1) {
      qty = parseInt(match1[1], 10);
      itemName = match1[2].trim();
      parsedItems.push({ dayOfWeek: dayOfWeek, itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 2: 排骨飯+1 or 雞腿飯 + 2
    var match2 = raw.match(/^(.+?)\s*\+\s*([0-9]+)$/);
    if (match2) {
      itemName = match2[1].trim();
      qty = parseInt(match2[2], 10);
      parsedItems.push({ dayOfWeek: dayOfWeek, itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 3: 排骨飯*1 or 雞腿飯 * 2 or 排骨飯x2
    var match3 = raw.match(/^(.+?)\s*[*xX]\s*([0-9]+)$/);
    if (match3) {
      itemName = match3[1].trim();
      qty = parseInt(match3[2], 10);
      parsedItems.push({ dayOfWeek: dayOfWeek, itemName: itemName, quantity: qty });
      continue;
    }

    // Pattern 4: 點餐 排骨飯 2 or 點餐 排骨飯
    var match4 = raw.match(/^點餐\s+(.+?)(?:\s+([0-9]+))?$/);
    if (match4) {
      itemName = match4[1].trim();
      qty = match4[2] ? parseInt(match4[2], 10) : 1;
      parsedItems.push({ dayOfWeek: dayOfWeek, itemName: itemName, quantity: qty });
      continue;
    }
  }

  return parsedItems;
}

/**
 * Match an ordered item name with the menu items
 */
function matchMenuItem(rawItemName, menuList) {
  if (!menuList || menuList.length === 0) {
    return { itemName: rawItemName, price: 0 };
  }

  // 1. Exact match
  for (var i = 0; i < menuList.length; i++) {
    var name = menuList[i].itemName || menuList[i].ItemName || '';
    var price = menuList[i].price !== undefined ? menuList[i].price : menuList[i].Price;
    if (name && name === rawItemName) {
      return { itemName: name, price: price || 0 };
    }
  }

  // 2. Contains match (e.g. "排骨" matches "招牌排骨飯")
  for (var j = 0; j < menuList.length; j++) {
    var itemN = menuList[j].itemName || menuList[j].ItemName || '';
    var itemP = menuList[j].price !== undefined ? menuList[j].price : menuList[j].Price;
    if (itemN && (itemN.indexOf(rawItemName) !== -1 || rawItemName.indexOf(itemN) !== -1)) {
      return { itemName: itemN, price: itemP || 0 };
    }
  }

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
  var todayDate = getTodayDateString();
  var todayDay = getTodayDayOfWeek();

  if (!text) return null;

  // Resolve user display name (nickname) early
  var userDisplayName = '成員';
  try {
    if (LineModule && LineModule.getUserProfile) {
      var prof = LineModule.getUserProfile(userId, groupId);
      if (prof && typeof prof.then === 'function') {
        prof.then(function (p) {
          if (p && p.displayName) userDisplayName = p.displayName;
        });
      } else if (prof && prof.displayName) {
        userDisplayName = prof.displayName;
      }
    }
  } catch (e) {}

  // 1. HELP: 幫助 / 說明 / 指令 / help
  if (/^(幫助|說明|指令|help|\/help)$/i.test(text)) {
    var helpFlex = FlexModule.createHelpFlex();
    return LineModule.replyFlex(replyToken, '便當點餐指令說明', helpFlex);
  }

  // 2. WEEKLY SCHEDULE: 本週菜單 / 每週菜單 / 排程 / 本週排程
  if (/^(?:\/)?(?:本週菜單|每週菜單|本週排程|排程|週排程)$/.test(text)) {
    var schedule = SheetModule.getWeeklySchedule();
    var scheduleFlex = FlexModule.createWeeklyScheduleFlex(schedule);
    return LineModule.replyFlex(replyToken, '📅 本週訂餐排程表 (週一至週五)', scheduleFlex);
  }

  // 3. DAY SPECIFIC MENU: 週一菜單 / 週二菜單 / 週三菜單 ...
  var dayMenuMatch = text.match(/^(?:本週)?(週[一二三四五]|禮拜[一二三四五]|星期[一二三四五])菜單$/);
  if (dayMenuMatch) {
    var targetDay = '週' + dayMenuMatch[1].slice(-1);
    var daySchedule = SheetModule.getScheduleByDay(targetDay);
    var restName = daySchedule ? daySchedule.restaurantName : targetDay + '便當';
    var cutoff = daySchedule ? daySchedule.cutoffTime : '10:30';
    var dayMenu = SheetModule.getMenuItems(targetDay, restName);
    var dayMenuFlex = FlexModule.createMenuFlex(restName, cutoff, dayMenu, targetDay);
    return LineModule.replyFlex(replyToken, targetDay + ' ' + restName + ' 菜單', dayMenuFlex);
  }

  // 4. UBER EATS IMPORT VIA CHAT: 匯入菜單 [週幾] [網址] / 匯入外送 [週幾] [網址]
  var importMatch = text.match(/^(?:匯入菜單|匯入外送|ubereats匯入)\s+(週[一二三四五]|ALL)\s+(https?:\/\/\S+)(?:\s+(.+))?$/i);
  if (importMatch) {
    var importDay = importMatch[1];
    var importUrl = importMatch[2];
    var customName = importMatch[3] ? importMatch[3].trim() : '';

    var parsedUrl = UberEatsModule.parseUberEatsUrl(importUrl);
    if (!parsedUrl) {
      return LineModule.replyText(replyToken, '❌ 網址解析失敗，請提供正確的 Uber Eats 店家網址格式，例如：\nhttps://www.ubereats.com/tw/store/store-name/uuid');
    }

    var storeName = customName || parsedUrl.storeName;
    var importPromise = UberEatsModule.importUberEatsToMenu(importUrl, importDay, storeName);

    if (importPromise && typeof importPromise.then === 'function') {
      importPromise.then(function (result) {
        SheetModule.saveMenuItems(importDay, result.restaurantName, result.items);
        SheetModule.setWeeklyScheduleDay(importDay, result.restaurantName, '10:30', importUrl, '從 Uber Eats 匯入');
        var msg = '✅ 已成功從 Uber Eats 匯入【' + result.restaurantName + '】至 ' + importDay + ' 菜單！\n共匯入 ' + result.itemsCount + ' 道餐點。\n可直接傳送「' + importDay + '菜單」查看。';
        LineModule.replyText(replyToken, msg);
      });
      return { status: 'importing' };
    }
  }

  // 5. OPEN ORDER: 開單 [店家] [時間] / 開始訂餐
  var openMatch = text.match(/^(?:\/)?(?:開單|開始訂餐)(?:\s+(.+?))?(?:\s+([0-9]{1,2}:[0-9]{2}))?$/);
  if (openMatch) {
    var restaurant = openMatch[1] ? openMatch[1].trim() : '今日便當';
    var cutoff = openMatch[2] ? openMatch[2].trim() : '11:00';

    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');
    SheetModule.setConfigValue('RESTAURANT_NAME', restaurant);
    SheetModule.setConfigValue('CUTOFF_TIME', cutoff);
    SheetModule.setConfigValue('ORGANIZER_ID', userId);

    var menuList = SheetModule.getMenuItems(todayDay, restaurant);
    var menuFlex = FlexModule.createMenuFlex(restaurant, cutoff, menuList, todayDay);
    return LineModule.replyFlex(replyToken, '【訂餐開始】' + restaurant + ' 菜單', menuFlex);
  }

  // 6. TODAY MENU: 菜單 / menu
  if (/^(?:\/)?(?:菜單|menu)$/i.test(text)) {
    var curRestaurant = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var curCutoff = SheetModule.getConfigValue('CUTOFF_TIME', '11:00');
    var curMenu = SheetModule.getMenuItems(todayDay, curRestaurant);
    var curMenuFlex = FlexModule.createMenuFlex(curRestaurant, curCutoff, curMenu, todayDay);
    return LineModule.replyFlex(replyToken, curRestaurant + ' 菜單', curMenuFlex);
  }

  // Helper to format payment text for personal order queries
  function _formatPaymentText(payInfo) {
    if (!payInfo || !payInfo.hasPaymentInfo) return '';
    var pLines = ['\n💳【付款資訊】'];
    if (payInfo.bankAccount || payInfo.bankCode || payInfo.bankQrUrl) {
      var bankStr = (payInfo.bankCode ? payInfo.bankCode + ' ' : '') + (payInfo.bankName || '');
      if (payInfo.bankAccount) {
        pLines.push('• 銀行轉帳：' + bankStr + ' 帳號 ' + payInfo.bankAccount + (payInfo.bankAccountName ? ' (' + payInfo.bankAccountName + ')' : ''));
      }
      if (payInfo.bankQrUrl) {
        pLines.push('• 銀行轉帳 QR Code：' + payInfo.bankQrUrl);
      }
    }
    if (payInfo.linePayUrl) {
      if (payInfo.isPersonalLinePay) {
        var idHint = payInfo.linePayUserId ? ' (LINE ID: ' + payInfo.linePayUserId + ')' : '';
        pLines.push('• LINE Pay 好友轉帳：' + payInfo.linePayUrl);
        pLines.push('  (請於錢包點選「轉帳」搜尋好友「' + payInfo.linePayRecipientName + '」' + idHint + ')');
      } else {
        pLines.push('• LINE Pay 轉帳：' + payInfo.linePayUrl);
      }
    }
    if (payInfo.linePayQrUrl) {
      pLines.push('• LINE Pay 收款碼：' + payInfo.linePayQrUrl);
    }
    return pLines.join('\n');
  }

  // 7. MY WEEKLY ORDERS: 我的本週訂單 / 本週訂單
  if (/^(?:\/)?(?:我的本週訂單|本週訂單)$/.test(text)) {
    var allDays = ['週一', '週二', '週三', '週四', '週五'];
    var lines = [];
    var grandTotal = 0;

    allDays.forEach(function (d) {
      var dOrders = SheetModule.getUserOrders(userId, groupId, null, d);
      if (dOrders && dOrders.length > 0) {
        var daySub = 0;
        var isPast = isDayPast(d);
        var isCutoff = (d === todayDay) && isTodayCutoffPassed(d);
        var lockTag = isPast ? ' 🔒[已過期]' : (isCutoff ? ' 🔒[已截止]' : '');
        var itemsText = dOrders.map(function (o) {
          daySub += o.subtotal;
          return o.itemName + ' x' + o.quantity + ' ($' + o.subtotal + ')';
        }).join('、');
        grandTotal += daySub;
        lines.push('【' + d + lockTag + '】' + itemsText + ' (小計 $' + daySub + ')');
      }
    });

    if (lines.length === 0) {
      return LineModule.replyText(replyToken, '您本週（週一至週五）尚未有任何預訂紀錄喔！');
    }

    var payInfoWeekly = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var payTextWeekly = _formatPaymentText(payInfoWeekly);
    var weeklyMsg = '🍱【您的本週梯次訂單】\n' + lines.join('\n') + '\n─────\n本週總計：$' + grandTotal + ' 元' + payTextWeekly;
    return LineModule.replyText(replyToken, weeklyMsg);
  }

  // 8. MY TODAY ORDERS: 我的訂單 / 查詢訂單 / 查單
  if (/^(?:\/)?(?:我的訂單|查詢訂單|查單)$/.test(text)) {
    var myOrders = SheetModule.getUserOrders(userId, groupId, null, todayDay);
    if (!myOrders || myOrders.length === 0) {
      myOrders = SheetModule.getUserOrders(userId, groupId, todayDate, null);
    }
    if (!myOrders || myOrders.length === 0) {
      return LineModule.replyText(replyToken, '您今日尚未有訂餐紀錄喔！可以直接輸入「+1 [餐點名稱]」點餐。');
    }
    var isCutoff = isTodayCutoffPassed(todayDay);
    var statusTag = isCutoff ? ' 🔒[已截止]' : '';
    var total = 0;
    var myLines = myOrders.map(function (o) {
      total += o.subtotal;
      return '• ' + o.itemName + ' x' + o.quantity + ' ($' + o.subtotal + ')' + statusTag;
    });
    var payInfoToday = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var payTextToday = _formatPaymentText(payInfoToday);
    var cutoffNotice = isCutoff ? '\n⚠️ 今日點餐已超過截止時間，不可修改或取消餐點。' : '';
    var msg = '【您的今日訂單】\n' + myLines.join('\n') + '\n─────\n總計：$' + total + ' 元' + cutoffNotice + payTextToday;
    return LineModule.replyText(replyToken, msg);
  }

  // 9. CANCEL ORDER: 取消 [週幾] [品項] / 取消 [品項] / 取消餐點
  var cancelMatch = text.match(/^(?:\/)?(?:取消餐點|取消)(?:\s+(週[一二三四五]))?(?:\s*(全部|全部訂單|所有訂單|.+))?$/);
  if (cancelMatch) {
    var cancelDay = cancelMatch[1] || null;
    var targetItem = cancelMatch[2] ? cancelMatch[2].trim() : '';
    if (targetItem === '餐點' || targetItem === '全部' || targetItem === '全部訂單' || targetItem === '所有訂單') {
      targetItem = '';
    }

    // If user sent "取消" or "取消餐點" without specifying day or item: show interactive cancel menu
    if (!cancelDay && !targetItem && text.trim().match(/^(?:\/)?(?:取消餐點|取消)(?:\s+餐點)?$/)) {
      var activeOrders = SheetModule.getUserOrders(userId, groupId, null, null);
      if (!activeOrders || activeOrders.length === 0) {
        return LineModule.replyText(replyToken, '您目前沒有任何可取消的進行中訂單喔！');
      }
      var lockMap = {};
      ['週一', '週二', '週三', '週四', '週五'].forEach(function (d) {
        if (isDayPast(d)) {
          lockMap[d] = { locked: true, reason: '已過期' };
        } else if (d === todayDay && isTodayCutoffPassed(d)) {
          lockMap[d] = { locked: true, reason: '已截止' };
        }
      });
      var cancelFlex = FlexModule.createCancelOrderFlex(userDisplayName, activeOrders, lockMap);
      return LineModule.replyFlex(replyToken, '🗑️ 請選擇欲取消的餐點', cancelFlex);
    }

    // Validation checks for past days or cutoff
    if (cancelDay) {
      if (isDayPast(cancelDay)) {
        return LineModule.replyText(replyToken, '⚠️ 【' + cancelDay + '】已超過日期，過去梯次的餐點無法修改或取消喔！');
      }
      if (cancelDay === todayDay && isTodayCutoffPassed(cancelDay)) {
        return LineModule.replyText(replyToken, '⚠️ 今日點餐已超過結單時間，無法修改或取消餐點囉！若需異動請洽開單人。');
      }
    } else if (targetItem) {
      // Default to today if day not specified
      if (isTodayCutoffPassed(todayDay)) {
        return LineModule.replyText(replyToken, '⚠️ 今日點餐已超過結單時間，無法修改或取消餐點囉！若需異動請洽開單人。');
      }
    } else {
      // Cancel 全部 (all orders across all days)
      var allUserOrders = SheetModule.getUserOrders(userId, groupId, null, null);
      var cancellableOrders = allUserOrders.filter(function (o) {
        if (isDayPast(o.dayOfWeek)) return false;
        if (o.dayOfWeek === todayDay && isTodayCutoffPassed(o.dayOfWeek)) return false;
        return true;
      });
      if (cancellableOrders.length === 0) {
        return LineModule.replyText(replyToken, '⚠️ 目前所有訂單均已超過截止時間或日期，無法修改或取消囉！若需異動請洽開單人。');
      }
      var totalCancelled = 0;
      var cancelledItemsSummary = [];
      cancellableOrders.forEach(function (co) {
        var c = SheetModule.cancelOrder(userId, groupId, co.itemName, null, co.dayOfWeek);
        if (c > 0) {
          totalCancelled += c;
          cancelledItemsSummary.push('• 【' + co.dayOfWeek + '】' + co.itemName + ' x' + co.quantity);
        }
      });
      if (totalCancelled > 0) {
        var nowTw = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        var pushMsg = '📢【訂餐通知 - 取消餐點】\n👤 訂餐人：' + userDisplayName + '\n🗑️ 取消內容：未截止梯次全部餐點 (共 ' + totalCancelled + ' 筆)\n' + cancelledItemsSummary.join('\n') + '\n⏰ 時間：' + nowTw;
        notifyOrganizer(pushMsg);

        return LineModule.replyText(replyToken, '✅ 已為您取消所有未截止梯次餐點，共 ' + totalCancelled + ' 筆紀錄。已通知開單人！');
      } else {
        return LineModule.replyText(replyToken, '查無符合條件的未取消訂單。');
      }
    }

    var targetDate = cancelDay ? null : (targetItem ? todayDate : null);
    var cancelledCount = SheetModule.cancelOrder(userId, groupId, targetItem, targetDate, cancelDay);
    if (cancelledCount > 0) {
      var dayText = cancelDay ? cancelDay + ' ' : '';
      var nowTwCancel = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      var cancelPushMsg = '📢【訂餐通知 - 取消餐點】\n👤 訂餐人：' + userDisplayName + '\n📅 梯次：' + (cancelDay || '今日') + '\n🗑️ 取消內容：' + (targetItem ? targetItem : '全部餐點') + ' (共 ' + cancelledCount + ' 筆)\n⏰ 時間：' + nowTwCancel;
      notifyOrganizer(cancelPushMsg);

      return LineModule.replyText(replyToken, '✅ 已為您取消 ' + dayText + (targetItem ? '「' + targetItem + '」' : '全部餐點') + ' 共 ' + cancelledCount + ' 筆紀錄。已通知開單人！');
    } else {
      return LineModule.replyText(replyToken, '查無符合條件的未取消訂單。');
    }
  }

  // 10. WEEKLY SUMMARY: 本週統計 / 梯次統計
  if (/^(?:\/)?(?:本週統計|梯次統計)$/.test(text)) {
    var weeklySummary = SheetModule.getWeeklyOrderSummary(groupId);
    var payInfo = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var weeklySumFlex = FlexModule.createWeeklySummaryFlex(weeklySummary, false, payInfo);
    return LineModule.replyFlex(replyToken, '📊 本週梯次訂餐統計總表', weeklySumFlex);
  }

  // 11. TODAY SUMMARY: 統計 / 即時統計
  if (/^(?:\/)?(?:統計|即時統計)$/.test(text)) {
    var restName = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var isOrderOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    var summary = SheetModule.getOrderSummary(groupId, todayDate);
    var payInfoTodaySum = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var sumFlex = FlexModule.createSummaryFlex(restName, summary, !isOrderOpen, payInfoTodaySum);
    return LineModule.replyFlex(replyToken, '【訂餐統計】' + restName, sumFlex);
  }

  // 12. CLOSE ORDER: 結單 / 截止 / 截止訂餐 / 本週結單 / 今日結單
  if (/^(?:\/)?(?:結單|截止|截止訂餐|本週結單|今日結單)$/.test(text)) {
    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'false');
    var closeScope = (SheetModule.getConfigValue('CLOSE_ORDER_SCOPE', 'WEEKLY') || 'WEEKLY').trim().toUpperCase();
    var isWeeklyClose = text.indexOf('本週') !== -1 || (text.indexOf('今日') === -1 && (closeScope !== 'DAILY' && closeScope !== 'TODAY' && closeScope !== '今日'));
    var payInfoClose = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;

    if (isWeeklyClose) {
      var weeklySummaryClose = SheetModule.getWeeklyOrderSummary(groupId);
      var weeklyCloseFlex = FlexModule.createWeeklySummaryFlex(weeklySummaryClose, true, payInfoClose);
      return LineModule.replyFlex(replyToken, '【已結單】本週梯次訂餐總表與收費清單', weeklyCloseFlex);
    } else {
      var finalRest = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
      var finalSummary = SheetModule.getOrderSummary(groupId, todayDate);
      var finalFlex = FlexModule.createSummaryFlex(finalRest, finalSummary, true, payInfoClose);
      return LineModule.replyFlex(replyToken, '【已結單】' + finalRest + ' 訂購名單總計', finalFlex);
    }
  }

  // 13. ORDER PLACEMENT: +1 / +2 / 點餐語法解析 (支援單日與週一至週五梯次點餐)
  var orderItems = parseOrderText(text);
  if (orderItems.length > 0) {
    var addedRecords = [];
    var isOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';

    orderItems.forEach(function (oi) {
      var day = oi.dayOfWeek || todayDay;
      // If ordering for today without day prefix, check open status
      if (!oi.dayOfWeek && !isOpen) {
        return;
      }
      // Check if day is past
      if (isDayPast(day)) {
        return;
      }
      // Check if today and cutoff passed
      if (day === todayDay && isTodayCutoffPassed(day)) {
        return;
      }

      var daySched = SheetModule.getScheduleByDay(day);
      var dayRest = daySched ? daySched.restaurantName : '';
      var menu = SheetModule.getMenuItems(day, dayRest);
      var matched = matchMenuItem(oi.itemName, menu);

      var record = SheetModule.addOrder({
        date: todayDate,
        dayOfWeek: day,
        groupId: groupId,
        userId: userId,
        userName: userDisplayName,
        userNickname: userDisplayName,
        itemName: matched.itemName,
        quantity: oi.quantity,
        price: matched.price
      });
      addedRecords.push(record);
    });

    if (addedRecords.length === 0) {
      return LineModule.replyText(replyToken, '⚠️ 目前尚未開放點餐或已經截止囉！若要開單請傳送「開單 [店家名] [時間]」或使用「週一+1 [餐點]」預定梯次。');
    }

    // Send push notification to organizer if configured
    var orderSummaryLines = addedRecords.map(function (r) {
      return '• 【' + r.dayOfWeek + '】' + r.itemName + ' x' + r.quantity + ' ($' + r.subtotal + ')';
    });
    var orderTotalAmt = addedRecords.reduce(function (sum, r) { return sum + r.subtotal; }, 0);
    var nowTwOrder = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    var orderPushMsg = '📢【訂餐通知 - 新增加訂】\n👤 訂餐人：' + userDisplayName + '\n🍱 預訂項目：\n' + orderSummaryLines.join('\n') + '\n💰 總計：$' + orderTotalAmt + ' 元\n⏰ 時間：' + nowTwOrder;
    notifyOrganizer(orderPushMsg);

    var lastAdded = addedRecords[addedRecords.length - 1];
    var receiptScope = (SheetModule.getConfigValue('ORDER_RECEIPT_SCOPE', 'WEEKLY') || 'WEEKLY').trim().toUpperCase();
    var isWeekly = (receiptScope !== 'DAILY' && receiptScope !== 'TODAY' && receiptScope !== '今日');

    var allMyOrders = isWeekly
      ? SheetModule.getUserOrders(userId, groupId, null, null)
      : SheetModule.getUserOrders(userId, groupId, todayDate, lastAdded.dayOfWeek);

    var receiptFlex = FlexModule.createOrderReceiptFlex(userDisplayName, lastAdded, allMyOrders, { isWeekly: isWeekly });
    var altSuffix = isWeekly ? '（本週）' : '';
    return LineModule.replyFlex(replyToken, '訂單已記錄' + (altSuffix ? altSuffix + '：' : '：') + lastAdded.dayOfWeek + ' ' + lastAdded.itemName, receiptFlex);
  }

  return null;
}

/**
 * Handle Postback Event
 */
function handlePostbackEvent(event) {
  var replyToken = event.replyToken;
  var dataStr = (event.postback && event.postback.data) || '';

  if (!dataStr) return null;

  var params = {};
  dataStr.split('&').forEach(function (pair) {
    var parts = pair.split('=');
    if (parts.length === 2) {
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }
  });

  var action = params.action;
  if (action === 'order') {
    var orderText = (params.day ? params.day + ' ' : '') + params.item + '+' + (params.qty || '1');
    var pseudoEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        text: orderText
      }
    };
    return handleTextMessage(pseudoEvent);
  }

  if (action === 'cancel') {
    var cancelText = '取消 ' + (params.day ? params.day + ' ' : '') + (params.item || '全部');
    var pseudoCancelEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        text: cancelText
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
  g.getTodayDayOfWeek = getTodayDayOfWeek;
  g.isDayPast = isDayPast;
  g.isTodayCutoffPassed = isTodayCutoffPassed;
  g.notifyOrganizer = notifyOrganizer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseOrderText: parseOrderText,
      matchMenuItem: matchMenuItem,
      handleTextMessage: handleTextMessage,
      handlePostbackEvent: handlePostbackEvent,
      getTodayDateString: getTodayDateString,
      getTodayDayOfWeek: getTodayDayOfWeek,
      isDayPast: isDayPast,
      isTodayCutoffPassed: isTodayCutoffPassed,
      notifyOrganizer: notifyOrganizer
    };
  }
})();
