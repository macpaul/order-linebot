/**
 * Code.js - Main Webhook Entrypoint & Admin Spreadsheet UI for Google Apps Script (GAS)
 * Handles LINE Webhook HTTP POST/GET requests and Google Sheets menu triggers.
 */

/**
 * Trigger: On Google Spreadsheet Open
 * Automatically creates custom menu bar for the administrator.
 */
function onOpen(e) {
  if (typeof onOpenSpreadsheet === 'function') {
    onOpenSpreadsheet();
  }
}

/**
 * Admin Action: Refresh Daily Summary
 */
function refreshDailySummary() {
  if (typeof isGasRuntime === 'function' && !isGasRuntime()) return;
  var todayDate = getTodayDateString ? getTodayDateString() : '';
  var todayDay = getTodayDayOfWeek ? getTodayDayOfWeek() : '';
  var summary = getOrderSummary('', todayDate, todayDay);
  var ss = getSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EFEFEF');
      var daySched = getScheduleByDay ? getScheduleByDay(todayDay) : null;
      var rest = (daySched && daySched.restaurantName) ? daySched.restaurantName : getConfigValue('RESTAURANT_NAME', '今日便當');
      summary.items.forEach(function (it) {
        sheet.appendRow([todayDay || '今日', rest, it.itemName, it.quantity, it.price, it.subtotal, it.buyers.join(', ')]);
      });
      sheet.appendRow(['【今日總計】', '', '', summary.totalQuantity, '', summary.totalAmount, '']);
      ss.toast('今日訂單統計表已更新完畢！', '成功', 3);
    }
  }
}

/**
 * Admin Action: Refresh Weekly Batch Summary
 */
function refreshWeeklySummary() {
  if (typeof isGasRuntime === 'function' && !isGasRuntime()) return;
  var weeklySummary = getWeeklyOrderSummary('');
  var ss = getSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EFEFEF');

      weeklySummary.daySummaries.forEach(function (ds) {
        if (ds.items && ds.items.length > 0) {
          ds.items.forEach(function (it) {
            sheet.appendRow([ds.dayOfWeek, ds.restaurantName, it.itemName, it.quantity, it.price, it.subtotal, it.buyers.join(', ')]);
          });
          sheet.appendRow([ds.dayOfWeek + ' 小計', ds.restaurantName, '', ds.totalQuantity, '', ds.totalAmount, '']);
        }
      });

      sheet.appendRow(['═════════', '═════════', '═════════', '═════', '═════', '═════', '═════════']);
      sheet.appendRow(['【本週梯次總計】', '', '', weeklySummary.grandTotalQuantity, '', weeklySummary.grandTotalAmount, '']);

      // Member payment list
      sheet.appendRow(['']);
      sheet.appendRow(['【成員本週應收總額】', '姓名', '應付金額']);
      weeklySummary.users.forEach(function (u) {
        sheet.appendRow(['', u.userName, u.total]);
      });

      ss.toast('本週梯次統計表已更新完畢！', '成功', 3);
    }
  }
}

/**
 * Admin Action: Interactive Dialog to Import Menu from Uber Eats
 */
function showUberEatsImportDialog() {
  if (typeof SpreadsheetApp === 'undefined') return;
  var ui = SpreadsheetApp.getUi();

  var dayPrompt = ui.prompt('匯入 Uber Eats 菜單 (步驟 1/2)', '請輸入要排程的星期（例如：週一、週二、週三、週四、週五 或 ALL）：', ui.ButtonSet.OK_CANCEL);
  if (dayPrompt.getSelectedButton() !== ui.Button.OK) return;
  var dayOfWeek = dayPrompt.getResponseText().trim();
  if (!dayOfWeek) dayOfWeek = '週一';

  var urlPrompt = ui.prompt('匯入 Uber Eats 菜單 (步驟 2/2)', '請貼上 Uber Eats 店家網址：\n(例如：https://www.ubereats.com/tw/store/.../... )', ui.ButtonSet.OK_CANCEL);
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  var url = urlPrompt.getResponseText().trim();
  if (!url) {
    ui.alert('網址不得為空！');
    return;
  }

  try {
    ui.alert('⏳ 正在抓取 Uber Eats 菜單，請稍候約 3~5 秒...');
    var parsed = parseUberEatsUrl(url);
    if (!parsed) {
      ui.alert('❌ 網址解析失敗！請確認網址格式正確。\n例如：https://www.ubereats.com/tw/store/...');
      return;
    }
    var storeUuid = parsed.standardUuid || parsed.storeUuid;
    var storeName = parsed.storeName || 'UberEats外送';

    var storeData = fetchStoreMenu(storeUuid);
    // If returned promise (in async environment)
    if (storeData && typeof storeData.then === 'function') {
      storeData.then(function (data) {
        var items = extractMenuItems(data);
        if (!items || items.length === 0) {
          ui.alert('⚠️ 未能從 Uber Eats 取得任何餐點品項！\n可能原因：店家目前未營業、網址有誤或受到雲端連線限制。\n建議：您可在試算表的「菜單」分頁中手動貼上品項。');
          return;
        }
        saveMenuItems(dayOfWeek, storeName, items);
        setWeeklyScheduleDay(dayOfWeek, storeName, '10:30', url, '從 Uber Eats 匯入');
        ui.alert('✅ 匯入成功！\n店家：' + storeName + '\n已排入：' + dayOfWeek + '\n共抓取 ' + items.length + ' 道餐點！');
      });
    } else {
      var items = extractMenuItems(storeData);
      if (!items || items.length === 0) {
        ui.alert('⚠️ 未能從 Uber Eats 取得任何餐點品項！\n可能原因：店家目前未營業、網址有誤或受到雲端連線限制。\n建議：您可在試算表的「菜單」分頁中手動貼上品項。');
        return;
      }
      saveMenuItems(dayOfWeek, storeName, items);
      setWeeklyScheduleDay(dayOfWeek, storeName, '10:30', url, '從 Uber Eats 匯入');
      ui.alert('✅ 匯入成功！\n店家：' + storeName + '\n已排入：' + dayOfWeek + '\n共抓取 ' + items.length + ' 道餐點！');
    }
  } catch (err) {
    ui.alert('❌ 匯入發生錯誤：' + err.message);
  }
}

/**
 * Admin Action: Interactive Dialog to Import Menu from Custom Restaurant Sheet
 */
function showCustomRestaurantImportDialog() {
  if (typeof SpreadsheetApp === 'undefined') return;
  var ui = SpreadsheetApp.getUi();

  var dayPrompt = ui.prompt(
    '匯入自訂餐廳菜單 (步驟 1/2)',
    '請輸入要排程的星期（例如：週一、週二、週三、週四、週五 或 ALL）：',
    ui.ButtonSet.OK_CANCEL
  );
  if (dayPrompt.getSelectedButton() !== ui.Button.OK) return;
  var rawDay = dayPrompt.getResponseText().trim();
  var dayOfWeek = (typeof normalizeDayOfWeek === 'function' ? normalizeDayOfWeek(rawDay) : rawDay) || '週一';

  var namePrompt = ui.prompt(
    '匯入自訂餐廳菜單 (步驟 2/2)',
    '請輸入自訂餐廳名稱（必須與試算表工作表 Tab 名稱完全一致）：',
    ui.ButtonSet.OK_CANCEL
  );
  if (namePrompt.getSelectedButton() !== ui.Button.OK) return;
  var restaurantName = namePrompt.getResponseText().trim();
  if (!restaurantName) {
    ui.alert('⚠️ 餐廳名稱不得為空！');
    return;
  }

  // Exact match check
  var ss = typeof getSpreadsheet === 'function' ? getSpreadsheet() : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  if (typeof isSystemTab === 'function' && isSystemTab(restaurantName)) {
    ui.alert('⚠️ 匯入失敗\n「' + restaurantName + '」為系統專用功能工作表，不可作為自訂餐廳菜單！\n請選擇自訂餐廳工作表。');
    return;
  }

  var targetSheet = ss.getSheetByName(restaurantName);
  if (!targetSheet) {
    ui.alert('⚠️ 沒找到這間自訂餐廳菜單！\n\n找不到名為「' + restaurantName + '」的工作表，請確認工作表名稱完全一致（包含大小寫與空格）。');
    return;
  }

  try {
    var result = importCustomRestaurantMenu(dayOfWeek, restaurantName);
    if (!result || !result.success) {
      ui.alert('⚠️ 沒找到這間自訂餐廳菜單！\n\n' + ((result && result.message) || '請確認工作表名稱完全一致（包含大小寫與空格）。'));
      return;
    }
    ui.alert('✅ 匯入成功！\n餐廳：' + restaurantName + '\n已排入：' + result.dayOfWeek + '\n共匯入 ' + result.count + ' 道餐點至菜單 (Menu)！');
  } catch (err) {
    ui.alert('❌ 匯入發生錯誤：' + err.message);
  }
}

/**
 * HTTP GET Handler - Service Health Check & Information
 */
function doGet(e) {
  var status = {
    status: 'online',
    service: 'LINE Meal Ordering Bot',
    features: ['daily-ordering', 'weekly-batch-schedule', 'ubereats-menu-importer'],
    timestamp: new Date().toISOString(),
    isGas: typeof SpreadsheetApp !== 'undefined'
  };

  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(status))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return status;
}

/**
 * HTTP POST Handler - LINE Webhook Events
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _createResponse(200, { message: 'No post data' });
    }

    var bodyString = e.postData.contents;
    var signature = (e.parameter && e.parameter['X-Line-Signature']) ||
                    (e.headers && (e.headers['X-Line-Signature'] || e.headers['x-line-signature']));

    var channelSecret = getConfigProperty('CHANNEL_SECRET', '');
    var queryToken = (e.parameter && (e.parameter.token || e.parameter.secret)) || '';

    // 1. Webhook Security Verification
    // Path A: If query token is provided, verify against CHANNEL_SECRET
    if (channelSecret && queryToken) {
      if (queryToken !== channelSecret) {
        return _createResponse(403, { error: 'Invalid secret token' });
      }
    }
    // Path B: If X-Line-Signature is present (e.g. proxy or test environment), verify signature
    if (channelSecret && signature) {
      var isValid = validateSignature(bodyString, signature, channelSecret);
      if (!isValid) {
        return _createResponse(403, { error: 'Invalid signature' });
      }
    }

    var json = JSON.parse(bodyString);
    var events = json.events || [];

    // 2. LINE Developers Console "Verify" Probe Fast-Path
    // When LINE sends an empty event list ({"destination":"...","events":[]}) for webhook verification,
    // respond immediately (< 100ms) with HTTP 200 without running heavy sheet operations,
    // preventing the 1-second timeout in LINE Developers Console.
    if (!events || events.length === 0) {
      return _createResponse(200, { status: 'success', message: 'Webhook verified' });
    }

    // Ensure database sheets exist on first run
    initSheets();

    // Process all events
    for (var i = 0; i < events.length; i++) {
      var event = events[i];

      // 1. Text Message Event
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        var msgText = event.message.text;
        var srcId = (event.source && (event.source.groupId || event.source.roomId || event.source.userId)) || 'unknown';
        if (typeof console !== 'undefined') {
          console.log('📨 [收到 LINE 文字訊息] 來源: ' + srcId + '，內容: ' + msgText);
        }
        if (typeof logToSheet === 'function') {
          var safeSrcId = srcId;
          // If source is a direct 1-on-1 user, de-identify using getEffectiveUserId if available
          if (event.source && event.source.type === 'user' && typeof getEffectiveUserId === 'function') {
            safeSrcId = getEffectiveUserId(srcId);
          }
          logToSheet('MSG_RECV', msgText, safeSrcId);
        }
        var result = handleTextMessage(event);
        if (typeof console !== 'undefined') {
          console.log('📤 [處理結果]: ' + JSON.stringify(result));
        }
      }
      // 2. Postback Event (from Flex Message Buttons)
      else if (event.type === 'postback') {
        if (typeof console !== 'undefined') {
          console.log('🔘 [收到 Postback 點擊] Data: ' + (event.postback && event.postback.data));
        }
        handlePostbackEvent(event);
      }
      // 3. Join Group Event - Say Hello
      else if (event.type === 'join') {
        var joinReplyToken = event.replyToken;
        var sourceCodeUrl = (typeof getConfigValue === 'function')
          ? getConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee')
          : 'https://tinyurl.com/4c92wtee';
        var helpFlex = createHelpFlex(sourceCodeUrl);
        replyFlex(joinReplyToken, '感謝邀請便當點餐小幫手！', helpFlex);
      }
    }

    return _createResponse(200, { status: 'success' });
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.error('❌ doPost error:', err);
    }
    if (typeof logToSheet === 'function') {
      logToSheet('EXCEPTION', err.message, err.stack);
    }
    return _createResponse(200, { status: 'error', error: err.message });
  }
}

/**
 * Helper to create HTTP response
 */
function _createResponse(statusCode, data) {
  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return { statusCode: statusCode, body: data };
}

/**
 * Diagnostic tool - Test LINE API Token connection directly from Apps Script editor
 */
function testLineConnection() {
  var token = getConfigProperty('CHANNEL_ACCESS_TOKEN', '');
  if (!token) {
    var noTokenMsg = '❌ 錯誤：找不到 CHANNEL_ACCESS_TOKEN！請至 Apps Script 左側「專案設定」->「指令碼屬性」填入。';
    if (typeof Logger !== 'undefined') Logger.log(noTokenMsg);
    if (typeof console !== 'undefined') console.error(noTokenMsg);
    return false;
  }

  var masked = token.length > 10 ? token.substring(0, 10) + '...' : '***';
  if (typeof Logger !== 'undefined') {
    Logger.log('🔍 正在檢測 CHANNEL_ACCESS_TOKEN (長度: ' + token.length + ', 前 10 碼: ' + masked + ')...');
  }

  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (typeof Logger !== 'undefined') {
      Logger.log('LINE API 回應狀態碼: ' + code);
      Logger.log('LINE API 回應內容: ' + body);
    }
    if (code === 200) {
      var info = JSON.parse(body);
      var okMsg = '🎉 驗證成功！LINE 權杖有效，Bot 連線正常！\n機器人名稱: ' + info.displayName + '\n機器人 ID: ' + info.basicId;
      if (typeof Logger !== 'undefined') Logger.log(okMsg);
      return true;
    } else {
      var failMsg = '❌ 憑證無效 (HTTP ' + code + ')！LINE 回傳: ' + body + '\n請重新檢查 Script Properties 中的 CHANNEL_ACCESS_TOKEN 是否包含多餘空格或過期。';
      if (typeof Logger !== 'undefined') Logger.log(failMsg);
      return false;
    }
  } catch (e) {
    if (typeof Logger !== 'undefined') Logger.log('❌ 網路請求例外: ' + e.message);
    return false;
  }
}

/**
 * Diagnostic tool - Simulate incoming message '幫助' directly from editor
 */
function testHelpMessage() {
  if (typeof Logger !== 'undefined') Logger.log('🧪 正在模擬使用者在 LINE 聊天室輸入「幫助」...');
  var fakeEvent = {
    replyToken: 'dummy_test_token',
    message: { type: 'text', text: '幫助' },
    source: { userId: 'test_user_id', groupId: 'test_group_id' }
  };
  try {
    var res = handleTextMessage(fakeEvent);
    if (typeof Logger !== 'undefined') {
      Logger.log('📤 處理結果: ' + JSON.stringify(res));
      Logger.log('🎉 handleTextMessage 執行完全正常！');
    }
    return res;
  } catch (err) {
    if (typeof Logger !== 'undefined') {
      Logger.log('❌ 執行發生錯誤: ' + err.message + '\n' + err.stack);
    }
    return null;
  }
}

/**
 * 診斷工具：在 Google Apps Script 編輯器中直接測試 Uber Eats 菜單抓取
 * 預設測試使用者指定的兩家店：
 * 1. 真好味茶餐廳: ubereats.com/tw/store/真好味茶餐廳/xDKpVlsqTdmXKiJsQdkf_g?sc=SEARCH_SUGGESTION
 * 2. 上海灘茶餐廳: https://www.ubereats.com/tw/store/%E4%B8%8A%E6%B5%B7%E7%81%98%E8%8C%B6%E9%A4%90%E5%BB%B3/kRJsM5CqSrCohWhzSS_y-w?diningMode=DELIVERY
 *
 * 可在 Apps Script 工具列選擇「testUberEatsImport」並點擊「執行」進行偵錯！
 */
function testUberEatsImport(customUrl) {
  if (typeof Logger !== 'undefined') {
    Logger.log('====================================================');
    Logger.log('🔍 開始執行 Uber Eats 菜單抓取診斷測試 (testUberEatsImport)...');
    Logger.log('====================================================');
  }

  var testUrls = [];
  if (customUrl) {
    testUrls.push({ label: '自訂網址', url: customUrl });
  } else {
    testUrls.push({
      label: '店家 1 (真好味茶餐廳)',
      url: 'ubereats.com/tw/store/真好味茶餐廳/xDKpVlsqTdmXKiJsQdkf_g?sc=SEARCH_SUGGESTION'
    });
    testUrls.push({
      label: '店家 2 (上海灘茶餐廳)',
      url: 'https://www.ubereats.com/tw/store/%E4%B8%8A%E6%B5%B7%E7%81%98%E8%8C%B6%E9%A4%90%E5%BB%B3/kRJsM5CqSrCohWhzSS_y-w?diningMode=DELIVERY'
    });
  }

  var results = [];

  for (var i = 0; i < testUrls.length; i++) {
    var t = testUrls[i];
    if (typeof Logger !== 'undefined') {
      Logger.log('\n--- 測試 ' + t.label + ' ---');
      Logger.log('輸入網址: ' + t.url);
    }

    var parsed = parseUberEatsUrl(t.url);
    if (!parsed) {
      if (typeof Logger !== 'undefined') Logger.log('❌ 網址解析失敗！無法辨識 Uber Eats 店家網址格式');
      results.push({ label: t.label, success: false, error: 'URL parse failed' });
      continue;
    }

    if (typeof Logger !== 'undefined') {
      Logger.log('✔ 網址解析成功:');
      Logger.log('   - 店家名稱: ' + parsed.storeName);
      Logger.log('   - Slug UUID: ' + parsed.storeUuid);
      Logger.log('   - 標準 UUID: ' + parsed.standardUuid);
    }

    try {
      var storeData = fetchStoreMenu(parsed.standardUuid || parsed.storeUuid);
      // If Promise (Node.js runtime)
      if (storeData && typeof storeData.then === 'function') {
        if (typeof Logger !== 'undefined') Logger.log('ℹ 非同步 Promise 物件已回傳');
        results.push({ label: t.label, success: true, parsed: parsed, isPromise: true });
        continue;
      }

      if (!storeData) {
        if (typeof Logger !== 'undefined') {
          Logger.log('❌ 抓取失敗: fetchStoreMenu 回傳 null (可能因 Uber Eats 防護限制、網路逾時或店家非營業狀態)');
        }
        results.push({ label: t.label, success: false, error: 'fetchStoreMenu returned null' });
        continue;
      }

      var items = extractMenuItems(storeData);
      if (typeof Logger !== 'undefined') {
        Logger.log('✔ 菜單品項解析成功！共抓取到 ' + items.length + ' 道餐點');
        if (items.length > 0) {
          Logger.log('📋 前 3 道餐點範例:');
          for (var k = 0; k < Math.min(3, items.length); k++) {
            var itm = items[k];
            Logger.log('   [' + (k + 1) + '] 分類: ' + itm.category + ' | 餐點: ' + itm.itemName + ' | 價格: NT$' + itm.price);
          }
        }
      }

      results.push({
        label: t.label,
        storeName: parsed.storeName,
        standardUuid: parsed.standardUuid,
        itemsCount: items.length,
        sampleItems: items.slice(0, 3),
        success: true
      });
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('❌ 抓取發生例外: ' + err.message);
      }
      results.push({ label: t.label, success: false, error: err.message });
    }
  }

  if (typeof Logger !== 'undefined') {
    Logger.log('\n====================================================');
    Logger.log('🎉 診斷測試完成！總共測試 ' + testUrls.length + ' 個店家');
    Logger.log('====================================================');
  }

  return results;
}

/**
 * Manual setup helper - can be run from the Apps Script editor toolbar
 */
function setup() {
  var success = initSheets();
  if (typeof Logger !== 'undefined') {
    Logger.log('Setup finished. Sheets initialized: ' + success);
  }
  return success;
}

// Dual export for testing
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.onOpen = onOpen;
  g.refreshDailySummary = refreshDailySummary;
  g.refreshWeeklySummary = refreshWeeklySummary;
  g.showUberEatsImportDialog = showUberEatsImportDialog;
  g.showCustomRestaurantImportDialog = showCustomRestaurantImportDialog;
  g.doGet = doGet;
  g.doPost = doPost;
  g.setup = setup;
  g.testLineConnection = testLineConnection;
  g.testHelpMessage = testHelpMessage;
  g.testUberEatsImport = testUberEatsImport;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      onOpen: onOpen,
      refreshDailySummary: refreshDailySummary,
      refreshWeeklySummary: refreshWeeklySummary,
      showUberEatsImportDialog: showUberEatsImportDialog,
      showCustomRestaurantImportDialog: showCustomRestaurantImportDialog,
      doGet: doGet,
      doPost: doPost,
      setup: setup,
      testLineConnection: testLineConnection,
      testHelpMessage: testHelpMessage,
      testUberEatsImport: testUberEatsImport
    };
  }
})();
