/**
 * SheetService.js - Google Sheets abstraction layer for Meal Ordering Bot
 * Supports both Google Apps Script runtime and in-memory mock for Node.js testing.
 */

// In-memory mock store for Node.js / offline execution
var _mockStore = {
  Config: {
    'IS_ORDERING_OPEN': 'false',
    'RESTAURANT_NAME': '老王便當',
    'CUTOFF_TIME': '11:00',
    'ORGANIZER_ID': '',
    'ORGANIZER_NAME': '小幫手',
    'ORDER_RECEIPT_SCOPE': 'WEEKLY',
    'CLOSE_ORDER_SCOPE': 'WEEKLY',
    'PAYMENT_LINEPAY_URL': '',
    'PAYMENT_LINEPAY_USER_NAME': '',
    'PAYMENT_LINEPAY_USER_ID': '',
    'PAYMENT_BANK_CODE': '',
    'PAYMENT_BANK_NAME': '',
    'PAYMENT_BANK_ACCOUNT': '',
    'PAYMENT_BANK_ACCOUNT_NAME': '',
    'PAYMENT_BANK_QR_URL': '',
    'PAYMENT_LINEPAY_QR_URL': '',
    'SOURCE_CODE_URL': 'https://tinyurl.com/4c92wtee',
    'ALLOW_SWITCH_ORGANIZER': 'true',
    'USER_IDENTIFIER_MODE': 'HASHED_ID',
    'HASH_SALT': ''
  },
  WeeklySchedule: [
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '招牌排骨', isActive: 'TRUE' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '日式炸豬排/唐揚雞', isActive: 'TRUE' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', cutoffTime: '10:30', uberEatsUrl: '', notes: '水餃/鍋貼/酸辣湯', isActive: 'TRUE' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '三寶飯/叉燒燒肉', isActive: 'TRUE' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', cutoffTime: '10:30', uberEatsUrl: '', notes: '舒肥雞胸/水煮牛', isActive: 'TRUE' }
  ],
  Menu: [
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '招牌排骨飯', price: 100, isAvailable: 'TRUE', description: '附三樣配菜' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '酥炸雞腿飯', price: 110, isAvailable: 'TRUE', description: '酥脆大雞腿' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '古早味控肉飯', price: 95, isAvailable: 'TRUE', description: '經典控肉' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '清蒸魚排飯', price: 105, isAvailable: 'TRUE', description: '鮮嫩無刺魚排' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '香煎鯖魚飯', price: 100, isAvailable: 'TRUE', description: '特選鯖魚' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '輕食', itemName: '健康水煮雞胸', price: 100, isAvailable: 'TRUE', description: '低卡高蛋白' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '飲料', itemName: '古早味紅茶', price: 25, isAvailable: 'TRUE', description: '微糖' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '飲料', itemName: '無糖綠茶', price: 25, isAvailable: 'TRUE', description: '無糖' },
    // Weekly sample items
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', category: '主食', itemName: '招牌排骨飯', price: 100, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', category: '主食', itemName: '酥炸雞腿飯', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', category: '日式', itemName: '日式厚切豬排飯', price: 120, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', category: '日式', itemName: '唐揚炸雞飯', price: 115, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', category: '鍋貼水餃', itemName: '招牌鍋貼(10顆)', price: 70, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', category: '湯品', itemName: '酸辣湯', price: 35, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', category: '燒臘', itemName: '招牌三寶飯', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', category: '燒臘', itemName: '脆皮燒肉飯', price: 105, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', category: '低GI', itemName: '舒肥嫩雞胸餐盒', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', category: '低GI', itemName: '薄鹽烤鯖魚餐盒', price: 120, isAvailable: 'TRUE', description: '' }
  ],
  Orders: [],
  Summary: [],
  Children: []
};

/**
 * Check if running inside Google Apps Script
 */
function isGasRuntime() {
  try {
    return typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.getActiveSpreadsheet === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * Get the target Spreadsheet instance
 */
function getSpreadsheet() {
  if (!isGasRuntime()) {
    return null;
  }
  var ssId = getConfigProperty('SPREADSHEET_ID', '');
  if (ssId && ssId.trim() !== '') {
    return SpreadsheetApp.openById(ssId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

var _cachedSpreadsheetTimeZone = null;

/**
 * Get timezone configured directly in the Spreadsheet settings.
 * Directly reads SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() in GAS.
 * Falls back to Session.getScriptTimeZone() if available, and defaults to 'Asia/Taipei'.
 * @returns {string} e.g. 'Asia/Taipei'
 */
function getSpreadsheetTimeZone() {
  if (typeof globalThis !== 'undefined' && globalThis._mockSpreadsheetTimeZone) {
    return globalThis._mockSpreadsheetTimeZone;
  }
  if (_cachedSpreadsheetTimeZone) {
    return _cachedSpreadsheetTimeZone;
  }
  if (isGasRuntime()) {
    try {
      var ss = getSpreadsheet();
      if (ss && typeof ss.getSpreadsheetTimeZone === 'function') {
        var ssTz = ss.getSpreadsheetTimeZone();
        if (ssTz && ssTz.trim() !== '') {
          _cachedSpreadsheetTimeZone = ssTz;
          return _cachedSpreadsheetTimeZone;
        }
      }
    } catch (e) {}
    try {
      if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
        var scriptTz = Session.getScriptTimeZone();
        if (scriptTz && scriptTz.trim() !== '') {
          _cachedSpreadsheetTimeZone = scriptTz;
          return _cachedSpreadsheetTimeZone;
        }
      }
    } catch (e) {}
  }
  return 'Asia/Taipei';
}


/**
 * Initialize sheets, headers, and initial sample menu if needed
 */
function initSheets() {
  var sheetDefs = [
    {
      name: CONFIG.SHEET_NAMES.CONFIG,
      headers: ['Key', 'Value', 'Description'],
      initData: [
        ['IS_ORDERING_OPEN', 'false', '目前是否開放點餐 (true/false)'],
        ['RESTAURANT_NAME', '老王便當', '今日配合訂購店家名稱'],
        ['CUTOFF_TIME', '11:00', '今日點餐截止時間'],
        ['ORGANIZER_ID', '', '發起開單人 LINE User ID (點餐/取消即時推播通知對象)'],
        ['ORGANIZER_NAME', '小幫手', '發起開單人姓名'],
        ['ORDER_RECEIPT_SCOPE', 'WEEKLY', '點餐後收據顯示範圍 (WEEKLY: 本週訂單 / DAILY: 今日訂單)'],
        ['CLOSE_ORDER_SCOPE', 'WEEKLY', '結單結算範圍 (WEEKLY: 本週梯次結單 / DAILY: 今日結單)'],
        ['PAYMENT_LINEPAY_URL', '', 'LINE Pay 收款/轉帳連結或個人收款碼網址'],
        ['PAYMENT_LINEPAY_USER_NAME', '', 'LINE Pay 受款人好友暱稱 (用於提示轉帳對象，留空則預設帶開單人姓名)'],
        ['PAYMENT_LINEPAY_USER_ID', '', 'LINE Pay 受款人 LINE ID 或 User ID (選填，供轉帳搜尋與對照)'],
        ['PAYMENT_BANK_CODE', '', '收款銀行代碼 (例如: 822)'],
        ['PAYMENT_BANK_NAME', '', '收款銀行名稱 (例如: 中國信託)'],
        ['PAYMENT_BANK_ACCOUNT', '', '收款銀行帳號 (例如: 123456789012)'],
        ['PAYMENT_BANK_ACCOUNT_NAME', '', '收款帳戶戶名 (例如: 王大明)'],
        ['PAYMENT_BANK_QR_URL', '', '收款銀行 QR Code 圖片網址 (支援 Google Drive 分享連結或圖床)'],
        ['PAYMENT_LINEPAY_QR_URL', '', 'LINE Pay 收款碼/條碼圖片網址 (支援 Google Drive 分享連結或圖床)'],
        ['SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee', '開源原始碼網址 (AGPL-3.0 規定若修改本程式碼需開源並將此處更新為自己的 public git repo)'],
        ['ALLOW_SWITCH_ORGANIZER', 'true', '是否允許任意群組成員藉由「開單」更換開單人 (true: 允許 / false: 僅限現任開單人)'],
        ['USER_IDENTIFIER_MODE', 'HASHED_ID', '使用者識別索引模式 (HASHED_ID: 單向加鹽雜湊去識別化 / USER_ID: 原始 LINE ID / NICKNAME: 純暱稱代號)'],
        ['HASH_SALT', '', '去識別化雜湊自訂密鑰 Salt (選填，留空自動使用安全預設密鑰)']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE,
      headers: ['DayOfWeek', 'RestaurantName', 'CutoffTime', 'UberEatsUrl', 'Notes', 'IsActive'],
      initData: [
        ['週一', '福山排骨便當', '10:30', '', '招牌排骨便當', 'TRUE'],
        ['週二', '鹿也日式便當', '10:30', '', '日式炸豬排/唐揚雞', 'TRUE'],
        ['週三', '八方雲集鍋貼', '10:30', '', '水餃/鍋貼/酸辣湯', 'TRUE'],
        ['週四', '老王燒臘便當', '10:30', '', '三寶飯/叉燒燒肉', 'TRUE'],
        ['週五', '健康水煮輕食', '10:30', '', '舒肥雞胸/低GI', 'TRUE']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.MENU,
      headers: ['DayOfWeek', 'RestaurantName', 'Category', 'ItemName', 'Price', 'IsAvailable', 'Description'],
      initData: [
        ['週一', '福山排骨便當', '主食', '招牌排骨飯', 100, 'TRUE', '附三樣配菜'],
        ['週一', '福山排骨便當', '主食', '酥炸雞腿飯', 110, 'TRUE', '酥脆大雞腿'],
        ['週二', '鹿也日式便當', '日式', '日式厚切豬排飯', 120, 'TRUE', ''],
        ['週二', '鹿也日式便當', '日式', '唐揚炸雞飯', 115, 'TRUE', ''],
        ['週三', '八方雲集鍋貼', '鍋貼水餃', '招牌鍋貼(10顆)', 70, 'TRUE', ''],
        ['週三', '八方雲集鍋貼', '湯品', '酸辣湯', 35, 'TRUE', ''],
        ['週四', '老王燒臘便當', '燒臘', '招牌三寶飯', 110, 'TRUE', ''],
        ['週四', '老王燒臘便當', '燒臘', '脆皮燒肉飯', 105, 'TRUE', ''],
        ['週五', '健康水煮輕食', '低GI', '舒肥嫩雞胸餐盒', 110, 'TRUE', ''],
        ['週五', '健康水煮輕食', '低GI', '薄鹽烤鯖魚餐盒', 120, 'TRUE', ''],
        ['ALL', '通用', '飲料', '古早味紅茶', 25, 'TRUE', '']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.ORDERS,
      headers: ['OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ChildName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid']
    },
    {
      name: CONFIG.SHEET_NAMES.SUMMARY,
      headers: ['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']
    },
    {
      name: CONFIG.SHEET_NAMES.CHILDREN,
      headers: ['UserId', 'UserName', 'UserNickname', 'ChildName', 'Note', 'CreatedAt', 'UpdatedAt'],
      initData: [
        ['U00000000000000000000000000000001', '愛麗絲', '愛麗絲媽咪', '大寶', '附小三年二班', '2026-09-07 08:00:00', '2026-09-07 08:00:00'],
        ['U00000000000000000000000000000001', '愛麗絲', '愛麗絲媽咪', '二寶', '附幼企鵝班', '2026-09-07 08:00:00', '2026-09-07 08:00:00'],
        ['U00000000000000000000000000000002', '小鮑伯', '鮑伯爸爸', '小寶', '附小一年一班 (不吃牛)', '2026-09-07 08:00:00', '2026-09-07 08:00:00']
      ]
    }
  ];

  if (!isGasRuntime()) {
    // Synchronize _mockStore.Config with all keys defined in sheetDefs
    var configDef = sheetDefs[0];
    if (configDef && configDef.initData) {
      configDef.initData.forEach(function (row) {
        var k = row[0];
        var v = row[1];
        if (_mockStore.Config[k] === undefined) {
          _mockStore.Config[k] = v;
        }
      });
    }
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;

  var addedConfigCount = 0;

  sheetDefs.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      sheet.appendRow(def.headers);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#EFEFEF');
      if (def.initData && def.initData.length > 0) {
        def.initData.forEach(function (row) {
          sheet.appendRow(row);
        });
      }
    } else {
      // If sheet exists but is completely empty (0 rows), populate headers and sample data
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(def.headers);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#EFEFEF');
        if (def.initData && def.initData.length > 0) {
          def.initData.forEach(function (row) {
            sheet.appendRow(row);
          });
        }
      } else {
        // Ensure row 1 has valid headers if blank
        var r1Vals = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        var isR1Empty = r1Vals.every(function (v) { return !String(v).trim(); });
        if (isR1Empty) {
          sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#EFEFEF');
        }
      }

      if (def.name === CONFIG.SHEET_NAMES.CHILDREN) {
        // Ensure Children headers are present in row 1
        var cHeaderVals = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        var firstH = String(cHeaderVals[0] || '').trim().toLowerCase();
        if (!firstH || firstH !== 'userid') {
          sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#EFEFEF');
        }
        // If Children tab has only header row (0 data rows), append sample initData rows
        if (sheet.getLastRow() <= 1 && def.initData && def.initData.length > 0) {
          def.initData.forEach(function (row) {
            sheet.appendRow(row);
          });
        }
      } else if (def.name === CONFIG.SHEET_NAMES.CONFIG && def.initData && def.initData.length > 0) {
      // Backfill missing config keys into existing Config sheet
      var existingData = sheet.getDataRange().getValues();
      var existingKeys = {};
      for (var r = 1; r < existingData.length; r++) {
        var k = String(existingData[r][0]).trim();
        if (k) existingKeys[k] = true;
      }
      def.initData.forEach(function (row) {
        var reqKey = String(row[0]).trim();
        if (!existingKeys[reqKey]) {
          sheet.appendRow(row);
          existingKeys[reqKey] = true;
          addedConfigCount++;
        }
      });
    } else if (def.name === CONFIG.SHEET_NAMES.ORDERS) {
      // Ensure DayOfWeek, UserNickname, and ChildName columns exist in existing Orders sheet
      var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
      var hasDayOfWeek = false;
      var hasNickname = false;
      var hasChildName = false;
      var dateColIndex = -1;
      var userNameColIndex = -1;
      var nicknameColIndex = -1;
      for (var h = 0; h < headerRow.length; h++) {
        var hName = String(headerRow[h]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
        if (hName === 'dayofweek' || hName === '星期' || hName === '星期幾' || hName === '梯次' || hName === 'day' || hName === 'weekday' || hName === '週幾' || hName === '禮拜' || hName === '週' || hName === '周') {
          hasDayOfWeek = true;
        }
        if (hName === 'usernickname' || hName === '使用者暱稱' || hName === '暱稱') {
          hasNickname = true;
          nicknameColIndex = h + 1;
        }
        if (hName === 'childname' || hName === 'child' || hName === '小孩' || hName === '小孩姓名' || hName === '孩子' || hName === '分配對象' || hName === '對象' || hName === '用餐人') {
          hasChildName = true;
        }
        if (hName === 'date' || hName === '日期') {
          dateColIndex = h + 1; // 1-based column
        }
        if (hName === 'username' || hName === '姓名' || hName === '使用者名稱' || hName === '訂購人') {
          userNameColIndex = h + 1; // 1-based column
        }
      }
      if (!hasDayOfWeek) {
        var insertAfterCol = dateColIndex > 0 ? dateColIndex : 3;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('DayOfWeek').setFontWeight('bold').setBackground('#EFEFEF');
        // Refresh header row
        headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        for (var h2 = 0; h2 < headerRow.length; h2++) {
          var hName2 = String(headerRow[h2]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
          if (hName2 === 'username' || hName2 === '姓名' || hName2 === '使用者名稱' || hName2 === '訂購人') {
            userNameColIndex = h2 + 1;
            break;
          }
        }
      }
      if (!hasNickname) {
        var insertNickAfterCol = userNameColIndex > 0 ? userNameColIndex : 7;
        sheet.insertColumnAfter(insertNickAfterCol);
        sheet.getRange(1, insertNickAfterCol + 1).setValue('UserNickname').setFontWeight('bold').setBackground('#EFEFEF');
        nicknameColIndex = insertNickAfterCol + 1;
      }
      if (!hasChildName) {
        var insertChildAfterCol = nicknameColIndex > 0 ? nicknameColIndex : (userNameColIndex > 0 ? userNameColIndex + 1 : 8);
        sheet.insertColumnAfter(insertChildAfterCol);
        sheet.getRange(1, insertChildAfterCol + 1).setValue('ChildName').setFontWeight('bold').setBackground('#EFEFEF');
      }
    } else if (def.name === CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE && def.initData) {
      // Ensure all Mon-Fri schedule days exist
      var schedData = sheet.getDataRange().getValues();
      var existingDays = {};
      for (var s = 1; s < schedData.length; s++) {
        var day = String(schedData[s][0]).trim();
        if (day) existingDays[day] = true;
      }
      def.initData.forEach(function (row) {
        if (!existingDays[row[0]]) {
          sheet.appendRow(row);
          existingDays[row[0]] = true;
        }
      });
    }
  }
  });

  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
      var toastMsg = addedConfigCount > 0
        ? '試算表結構檢查完成！已自動補齊 ' + addedConfigCount + ' 項新 Config 設定。'
        : '試算表結構與所有 Config 設定檢查完成，全部正常！';
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, '檢查完成', 5);
    }
  } catch (e) {}

  return true;
}

/**
 * Get config value
 */
function getConfigValue(key, defaultValue) {
  var targetKey = String(key).trim().toUpperCase();
  if (!isGasRuntime()) {
    for (var mk in _mockStore.Config) {
      if (mk.toUpperCase() === targetKey) {
        return _mockStore.Config[mk];
      }
    }
    return defaultValue;
  }
  var ss = getSpreadsheet();
  if (!ss) return defaultValue;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
  if (!sheet) return defaultValue;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === targetKey) {
      var val = data[i][1];
      return val != null ? String(val) : '';
    }
  }
  return defaultValue;
}

/**
 * Set config value
 */
function setConfigValue(key, value) {
  if (!isGasRuntime()) {
    _mockStore.Config[key] = String(value);
    return true;
  }
  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
  if (!sheet) return false;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(String(value));
      return true;
    }
  }
  sheet.appendRow([key, String(value), '']);
  return true;
}

/**
 * Convert Google Drive sharing URL or any web link to direct image URL
 * @param {string} url
 * @returns {string} Direct image URL
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim();
  if (!trimmed) return '';

  // Google Drive sharing patterns:
  // 1) https://drive.google.com/file/d/{FILE_ID}/view...
  // 2) https://drive.google.com/open?id={FILE_ID}
  // 3) https://drive.google.com/uc?id={FILE_ID}
  var gdMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+))/i);
  if (gdMatch) {
    var fileId = gdMatch[1] || gdMatch[2] || gdMatch[3];
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }
  return trimmed;
}

/**
 * Get payment configuration (LINE Pay & Bank Transfer + QR Codes)
 * @returns {{ linePayUrl: string, linePayQrUrl: string, linePayUserName: string, linePayUserId: string, linePayRecipientName: string, isPersonalLinePay: boolean, bankCode: string, bankName: string, bankAccount: string, bankAccountName: string, bankQrUrl: string, hasPaymentInfo: boolean }}
 */
function getPaymentConfig() {
  var linePayUrl = (getConfigValue('PAYMENT_LINEPAY_URL', '') || '').trim();
  // If linePayUrl is a placeholder (e.g., '無', 'None', '-'), ignore it
  if (linePayUrl && !/^https?:\/\//i.test(linePayUrl)) {
    linePayUrl = '';
  }
  var linePayQrUrl = normalizeImageUrl(getConfigValue('PAYMENT_LINEPAY_QR_URL', '') || '');
  var linePayUserName = (getConfigValue('PAYMENT_LINEPAY_USER_NAME', '') || '').trim();
  var linePayUserId = (getConfigValue('PAYMENT_LINEPAY_USER_ID', '') || '').trim();
  var organizerName = (getConfigValue('ORGANIZER_NAME', '') || '').trim();

  var isPersonalLinePay = false;
  var linePayRecipientName = '';

  // If no explicit commercial LINE Pay URL is configured, but personal user info is provided
  if (!linePayUrl && (linePayUserName || linePayUserId)) {
    isPersonalLinePay = true;
    linePayRecipientName = linePayUserName || organizerName || '開單人';
    linePayUrl = 'https://line.me/R/nv/wallet';
  } else if (linePayUrl) {
    linePayRecipientName = linePayUserName || organizerName || '';
  }

  var bankCode = (getConfigValue('PAYMENT_BANK_CODE', '') || '').trim();
  var bankName = (getConfigValue('PAYMENT_BANK_NAME', '') || '').trim();
  var bankAccount = (getConfigValue('PAYMENT_BANK_ACCOUNT', '') || '').trim();
  var bankAccountName = (getConfigValue('PAYMENT_BANK_ACCOUNT_NAME', '') || '').trim();
  var bankQrUrl = normalizeImageUrl(getConfigValue('PAYMENT_BANK_QR_URL', '') || '');

  var hasPaymentInfo = !!(linePayUrl || linePayQrUrl || linePayUserName || linePayUserId || bankAccount || bankCode || bankQrUrl);

  return {
    linePayUrl: linePayUrl,
    linePayQrUrl: linePayQrUrl,
    linePayUserName: linePayUserName,
    linePayUserId: linePayUserId,
    linePayRecipientName: linePayRecipientName,
    isPersonalLinePay: isPersonalLinePay,
    bankCode: bankCode,
    bankName: bankName,
    bankAccount: bankAccount,
    bankAccountName: bankAccountName,
    bankQrUrl: bankQrUrl,
    hasPaymentInfo: hasPaymentInfo
  };
}

/**
 * Get Weekly Schedule (Mon to Fri)
 */
function getWeeklySchedule() {
  if (!isGasRuntime()) {
    return _mockStore.WeeklySchedule.map(function (s) {
      return {
        dayOfWeek: s.dayOfWeek,
        restaurantName: s.restaurantName,
        cutoffTime: s.cutoffTime,
        uberEatsUrl: s.uberEatsUrl || '',
        notes: s.notes || '',
        isActive: String(s.isActive).toUpperCase() === 'TRUE'
      };
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    list.push({
      dayOfWeek: String(r[0]),
      restaurantName: String(r[1]),
      cutoffTime: String(r[2]),
      uberEatsUrl: String(r[3]),
      notes: String(r[4]),
      isActive: String(r[5]).toUpperCase() === 'TRUE'
    });
  }
  return list;
}

/**
 * Get Schedule for specific day
 */
function getScheduleByDay(dayOfWeek) {
  var schedule = getWeeklySchedule();
  for (var i = 0; i < schedule.length; i++) {
    if (schedule[i].dayOfWeek === dayOfWeek) {
      return schedule[i];
    }
  }
  return null;
}

/**
 * Set Weekly Schedule for a day
 */
function setWeeklyScheduleDay(dayOfWeek, restaurantName, cutoffTime, uberEatsUrl, notes, isActive) {
  if (!isGasRuntime()) {
    for (var i = 0; i < _mockStore.WeeklySchedule.length; i++) {
      if (_mockStore.WeeklySchedule[i].dayOfWeek === dayOfWeek) {
        if (restaurantName) _mockStore.WeeklySchedule[i].restaurantName = restaurantName;
        if (cutoffTime) _mockStore.WeeklySchedule[i].cutoffTime = cutoffTime;
        if (uberEatsUrl !== undefined) _mockStore.WeeklySchedule[i].uberEatsUrl = uberEatsUrl;
        if (notes !== undefined) _mockStore.WeeklySchedule[i].notes = notes;
        if (isActive !== undefined) _mockStore.WeeklySchedule[i].isActive = isActive ? 'TRUE' : 'FALSE';
        return true;
      }
    }
    _mockStore.WeeklySchedule.push({
      dayOfWeek: dayOfWeek,
      restaurantName: restaurantName || '',
      cutoffTime: cutoffTime || '10:30',
      uberEatsUrl: uberEatsUrl || '',
      notes: notes || '',
      isActive: isActive ? 'TRUE' : 'FALSE'
    });
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE);
  if (!sheet) return false;

  var rows = sheet.getDataRange().getValues();
  for (var j = 1; j < rows.length; j++) {
    if (String(rows[j][0]) === dayOfWeek) {
      if (restaurantName) sheet.getRange(j + 1, 2).setValue(restaurantName);
      if (cutoffTime) sheet.getRange(j + 1, 3).setValue(cutoffTime);
      if (uberEatsUrl !== undefined) sheet.getRange(j + 1, 4).setValue(uberEatsUrl);
      if (notes !== undefined) sheet.getRange(j + 1, 5).setValue(notes);
      if (isActive !== undefined) sheet.getRange(j + 1, 6).setValue(isActive ? 'TRUE' : 'FALSE');
      return true;
    }
  }
  // Append new day
  sheet.appendRow([dayOfWeek, restaurantName || '', cutoffTime || '10:30', uberEatsUrl || '', notes || '', isActive ? 'TRUE' : 'FALSE']);
  return true;
}

/**
 * Get menu items (optionally filtered by dayOfWeek or restaurantName)
 */
function getMenuItems(dayOfWeek, restaurantName) {
  if (!isGasRuntime()) {
    return _mockStore.Menu.filter(function (m) {
      var isAvail = m.isAvailable !== undefined ? m.isAvailable : m.IsAvailable;
      var dow = m.dayOfWeek !== undefined ? m.dayOfWeek : m.DayOfWeek;
      var rName = m.restaurantName !== undefined ? m.restaurantName : m.RestaurantName;
      var matchDay = (!dayOfWeek || dow === 'ALL' || dow === dayOfWeek);
      var matchRest = restaurantName ? (rName === restaurantName) : true;
      return String(isAvail).toUpperCase() === 'TRUE' && matchDay && matchRest;
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.MENU);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var menu = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var isAvailable = String(row[5]).toUpperCase() === 'TRUE';
    var itemDay = String(row[0]);
    var itemRest = String(row[1]);

    var dayMatches = (!dayOfWeek || itemDay === 'ALL' || itemDay === dayOfWeek);
    var restMatches = restaurantName ? (itemRest === restaurantName) : true;

    if (isAvailable && dayMatches && restMatches) {
      menu.push({
        dayOfWeek: itemDay,
        restaurantName: itemRest,
        category: String(row[2]),
        itemName: String(row[3]),
        price: Number(row[4]) || 0,
        isAvailable: isAvailable,
        description: String(row[6] || '')
      });
    }
  }
  return menu;
}

/**
 * Sanitize cell values against Google Sheets formula injection (=, +, -, @, \t, \r)
 * Neutralizes potential formula injection even if preceded by whitespace.
 */
function _sanitizeSheetCell(val) {
  if (typeof val === 'string') {
    if (/^\s*[=+\-@\t\r]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

/**
 * Compute one-way salted HMAC-SHA256 hash for LINE User ID de-identification.
 * Returns pseudonymous string e.g. 'usr_8f9c21b4a7d3e5f0'
 * @param {string} userId - Raw LINE User ID (e.g. U12345...)
 * @param {string} [customSalt] - Optional secret salt
 * @returns {string} Hashed user identifier
 */
function hashUserId(userId, customSalt) {
  if (!userId) return '';
  var uidStr = String(userId).trim();
  if (!uidStr) return '';
  // If already hashed, return as-is to avoid double-hashing
  if (uidStr.indexOf('usr_') === 0 && uidStr.length >= 20) {
    return uidStr;
  }

  var salt = customSalt ||
             getConfigValue('HASH_SALT', '') ||
             (typeof getConfigProperty === 'function' ? getConfigProperty('CHANNEL_SECRET', '') : '') ||
             'LINE_MEAL_ORDER_SALT_DEFAULT';

  // 1. Google Apps Script
  try {
    if (typeof Utilities !== 'undefined' && typeof Utilities.computeHmacSha256 === 'function') {
      var raw = Utilities.computeHmacSha256(uidStr, salt);
      var hex = raw.map(function (b) {
        var n = (b < 0 ? b + 256 : b).toString(16);
        return n.length === 1 ? '0' + n : n;
      }).join('');
      return 'usr_' + hex.substring(0, 16);
    }
  } catch (e) {}

  // 2. Node.js runtime
  try {
    var crypto = require('crypto');
    var hexNode = crypto.createHmac('sha256', salt).update(uidStr).digest('hex');
    return 'usr_' + hexNode.substring(0, 16);
  } catch (e) {}

  // 3. Fallback simple hash
  var h = 0;
  for (var i = 0; i < uidStr.length; i++) {
    h = ((h << 5) - h) + uidStr.charCodeAt(i);
    h |= 0;
  }
  return 'usr_' + Math.abs(h).toString(16);
}

/**
 * Get effective user identifier according to USER_IDENTIFIER_MODE
 * @param {string} userId
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {string}
 */
function getEffectiveUserId(userId, userName, userNickname) {
  var mode = (getConfigValue('USER_IDENTIFIER_MODE', (CONFIG && CONFIG.USER_IDENTIFIER_MODE) || 'HASHED_ID') || 'HASHED_ID').toUpperCase();

  if (mode === 'NICKNAME') {
    var nick = (userNickname || userName || userId || '').trim();
    return nick || '匿名成員';
  } else if (mode === 'USER_ID') {
    return (userId || '').trim();
  } else {
    // Default: 'HASHED_ID'
    return hashUserId(userId);
  }
}

/**
 * Save / Import menu items for a specific day and restaurant
 */
function saveMenuItems(dayOfWeek, restaurantName, items) {
  if (!items || items.length === 0) return 0;

  if (!isGasRuntime()) {
    // Remove old items for this day & restaurant
    _mockStore.Menu = _mockStore.Menu.filter(function (m) {
      return !(m.dayOfWeek === dayOfWeek && m.restaurantName === restaurantName);
    });
    items.forEach(function (it) {
      _mockStore.Menu.push({
        dayOfWeek: dayOfWeek,
        restaurantName: restaurantName,
        category: it.category || '一般',
        itemName: it.itemName,
        price: it.price || 0,
        isAvailable: it.isAvailable !== false ? 'TRUE' : 'FALSE',
        description: it.description || ''
      });
    });
    return items.length;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.MENU);
  if (!sheet) return 0;

  // Append new items
  items.forEach(function (it) {
    sheet.appendRow([
      dayOfWeek,
      _sanitizeSheetCell(restaurantName),
      _sanitizeSheetCell(it.category || '一般'),
      _sanitizeSheetCell(it.itemName),
      it.price || 0,
      it.isAvailable !== false ? 'TRUE' : 'FALSE',
      _sanitizeSheetCell(it.description || '')
    ]);
  });

  return items.length;
}

/**
 * Reserved system tab names (cannot be treated as custom restaurant menus)
 */
var SYSTEM_TAB_NAMES = [
  'Config',
  'Logs',
  'WeeklySchedule',
  'Menu',
  'Orders',
  'Children',
  'Summary'
];

/**
 * Check if a given sheet/tab name is a reserved system tab
 * @param {string} tabName
 * @returns {boolean}
 */
function isSystemTab(tabName) {
  if (!tabName) return true;
  var clean = String(tabName).trim().toLowerCase();
  for (var i = 0; i < SYSTEM_TAB_NAMES.length; i++) {
    if (SYSTEM_TAB_NAMES[i].toLowerCase() === clean) {
      return true;
    }
  }
  return false;
}

/**
 * Read custom restaurant menu items from a custom sheet
 * Format: RestaurantName, Category, ItemName, Price, IsAvailable, Description
 * @param {string} restaurantName - Exact match sheet name
 * @returns {Array<Object>|null} List of item objects or null if sheet not found / system tab
 */
function readCustomRestaurantMenu(restaurantName) {
  if (!restaurantName) return null;
  var rName = String(restaurantName).trim();
  if (isSystemTab(rName)) {
    return null;
  }

  if (!isGasRuntime()) {
    if (!_mockStore.CustomRestaurants) return null;
    return _mockStore.CustomRestaurants[rName] || null;
  }

  var ss = getSpreadsheet();
  if (!ss) return null;

  var sheet = ss.getSheetByName(rName);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return [];

  var startRow = 0;
  var colMap = {
    restaurantName: -1,
    category: -1,
    itemName: -1,
    price: -1,
    isAvailable: -1,
    description: -1
  };

  var firstRow = data[0] || [];
  var hasHeader = false;
  for (var c = 0; c < firstRow.length; c++) {
    var val = String(firstRow[c]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
    if (val === 'itemname' || val === '餐點' || val === '品項' || val === '品名' || val === '餐點名稱') {
      colMap.itemName = c;
      hasHeader = true;
    } else if (val === 'category' || val === '分類' || val === '類別') {
      colMap.category = c;
      hasHeader = true;
    } else if (val === 'price' || val === '價格' || val === '金額' || val === '單價') {
      colMap.price = c;
      hasHeader = true;
    } else if (val === 'isavailable' || val === '供應' || val === '供應狀態' || val === '是否供應') {
      colMap.isAvailable = c;
      hasHeader = true;
    } else if (val === 'description' || val === '描述' || val === '備註' || val === '說明') {
      colMap.description = c;
      hasHeader = true;
    } else if (val === 'restaurantname' || val === '店家' || val === '餐廳' || val === '店家名稱') {
      colMap.restaurantName = c;
      hasHeader = true;
    }
  }

  if (hasHeader) {
    startRow = 1;
  } else {
    // Default 6 columns: RestaurantName, Category, ItemName, Price, IsAvailable, Description
    colMap = {
      restaurantName: 0,
      category: 1,
      itemName: 2,
      price: 3,
      isAvailable: 4,
      description: 5
    };
  }

  var items = [];
  for (var r = startRow; r < data.length; r++) {
    var row = data[r];
    var rawItemName = colMap.itemName !== -1 ? row[colMap.itemName] : (row[2] !== undefined ? row[2] : row[1]);
    var itName = String(rawItemName || '').trim();
    if (!itName) continue; // skip empty rows

    var cat = colMap.category !== -1 ? String(row[colMap.category] || '').trim() : (row[1] ? String(row[1]).trim() : '一般');
    var priceVal = colMap.price !== -1 ? row[colMap.price] : row[3];
    var price = Number(priceVal) || 0;
    var availVal = colMap.isAvailable !== -1 ? row[colMap.isAvailable] : row[4];
    var isAvailable = (availVal === undefined || availVal === null || String(availVal).trim() === '') ? true : (String(availVal).toUpperCase() !== 'FALSE');
    var desc = colMap.description !== -1 ? String(row[colMap.description] || '').trim() : (row[5] ? String(row[5]).trim() : '');

    items.push({
      category: cat || '一般',
      itemName: itName,
      price: price,
      isAvailable: isAvailable,
      description: desc
    });
  }

  return items;
}

/**
 * Import custom restaurant menu to WeeklySchedule and Menu tabs
 * @param {string} dayOfWeek - e.g. "週一", "週二"
 * @param {string} restaurantName - Tab name of the custom restaurant
 * @returns {Object} { success: boolean, reason?: string, message?: string, count?: number }
 */
function importCustomRestaurantMenu(dayOfWeek, restaurantName) {
  if (!restaurantName || !String(restaurantName).trim()) {
    return { success: false, reason: 'EMPTY_NAME', message: '餐廳名稱不得為空！' };
  }

  var rName = String(restaurantName).trim();
  if (isSystemTab(rName)) {
    return {
      success: false,
      reason: 'SYSTEM_TAB',
      message: '「' + rName + '」為系統專用功能工作表，無法作為自訂餐廳菜單匯入！'
    };
  }

  var normDay = normalizeDayOfWeek ? normalizeDayOfWeek(dayOfWeek) : dayOfWeek;
  if (!normDay || normDay === '今日') {
    normDay = '週一';
  }

  var items = readCustomRestaurantMenu(rName);
  if (items === null) {
    return {
      success: false,
      reason: 'NOT_FOUND',
      message: '查無此自訂餐廳！\n找不到名為「' + rName + '」的工作表，請確認工作表名稱完全一致（包含大小寫與空格）。'
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      reason: 'EMPTY_MENU',
      message: '工作表「' + rName + '」中沒有任何餐點品項！'
    };
  }

  // 1. Update WeeklySchedule
  setWeeklyScheduleDay(normDay, rName, '10:30', '', '從自訂餐廳匯入', true);

  // 2. Update Menu
  saveMenuItems(normDay, rName, items);

  return {
    success: true,
    dayOfWeek: normDay,
    restaurantName: rName,
    count: items.length
  };
}

/**
 * Helper to map Orders sheet header columns dynamically
 */
function _getOrderColumnIndexes(headers) {
  var colMap = {
    orderId: 0,
    timestamp: 1,
    date: 2,
    dayOfWeek: -1,
    groupId: 3,
    userId: 4,
    userName: 5,
    userNickname: -1,
    childName: -1,
    itemName: 6,
    quantity: 7,
    price: 8,
    subtotal: 9,
    status: 10,
    paid: 11
  };
  if (!headers || headers.length === 0) return colMap;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
    if (h === 'orderid' || h === '訂單編號' || h === '訂單id') colMap.orderId = c;
    else if (h === 'timestamp' || h === '時間' || h === '建立時間') colMap.timestamp = c;
    else if (h === 'date' || h === '日期') colMap.date = c;
    else if (h === 'dayofweek' || h === '星期' || h === '星期幾' || h === '梯次' || h === '梯次星期' || h === 'day' || h === 'weekday' || h === '週幾' || h === '禮拜' || h === '週' || h === '周' || h === '梯次別') colMap.dayOfWeek = c;
    else if (h === 'groupid' || h === '群組id' || h === '群組') colMap.groupId = c;
    else if (h === 'userid' || h === '使用者id' || h === '用戶id' || h === 'lineid') colMap.userId = c;
    else if (h === 'username' || h === '使用者名稱' || h === '姓名' || h === '訂購人') colMap.userName = c;
    else if (h === 'usernickname' || h === '使用者暱稱' || h === '暱稱') colMap.userNickname = c;
    else if (h === 'childname' || h === 'child' || h === '小孩' || h === '小孩姓名' || h === '孩子' || h === '分配對象' || h === '對象' || h === '用餐人') colMap.childName = c;
    else if (h === 'itemname' || h === '餐點名稱' || h === '餐點' || h === '品項') colMap.itemName = c;
    else if (h === 'quantity' || h === '數量' || h === '份數') colMap.quantity = c;
    else if (h === 'price' || h === '單價' || h === '價格') colMap.price = c;
    else if (h === 'subtotal' || h === '小計' || h === '金額') colMap.subtotal = c;
    else if (h === 'status' || h === '狀態') colMap.status = c;
    else if (h === 'paid' || h === '付款狀態' || h === '付款') colMap.paid = c;
  }
  return colMap;
}

/**
 * Normalize day-of-week string into standard format ('週一' ~ '週日', 'ALL', '今日')
 * @param {string} day
 * @returns {string}
 */
function normalizeDayOfWeek(day) {
  if (!day) return '';
  var s = String(day).trim();
  if (!s) return '';
  if (s === 'ALL' || s === '通用' || s === '全部') return 'ALL';
  if (s === '今日' || s === '本日' || s === '今天') return '今日';

  var match = s.match(/(?:週|星期|禮拜|周)?([一二三四五六日天1-7])/);
  if (match) {
    var char = match[1];
    var map = {
      '一': '週一', '1': '週一',
      '二': '週二', '2': '週二',
      '三': '週三', '3': '週三',
      '四': '週四', '4': '週四',
      '五': '週五', '5': '週五',
      '六': '週六', '6': '週六',
      '日': '週日', '天': '週日', '7': '週日'
    };
    if (map[char]) return map[char];
  }
  var enMap = {
    'mon': '週一', 'monday': '週一',
    'tue': '週二', 'tuesday': '週二',
    'wed': '週三', 'wednesday': '週三',
    'thu': '週四', 'thursday': '週四',
    'fri': '週五', 'friday': '週五',
    'sat': '週六', 'saturday': '週六',
    'sun': '週日', 'sunday': '週日'
  };
  var lower = s.toLowerCase();
  if (enMap[lower]) return enMap[lower];
  return s;
}

/**
 * Format and normalize date values from Google Sheet cells or Date objects to YYYY-MM-DD
 * @param {*} val
 * @returns {string}
 */
function _formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var tz = getSpreadsheetTimeZone();
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      try {
        return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } catch (e) {}
    }
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(val);
      }
    } catch (e) {}
    var utc = val.getTime() + (val.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    var y = twDate.getFullYear();
    var m = ('0' + (twDate.getMonth() + 1)).slice(-2);
    var d = ('0' + twDate.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  var match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    var y = match[1];
    var m = ('0' + match[2]).slice(-2);
    var d = ('0' + match[3]).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return s;
}

/**
 * Match order timing against query date and dayOfWeek.
 * Ensures orders placed in advance for other weekdays are never mixed into today's query.
 *
 * @param {string} orderDate - e.g. '2026-09-07'
 * @param {string} orderDayOfWeek - e.g. '週一', '週二'
 * @param {string} [queryDate] - e.g. '2026-09-07'
 * @param {string} [queryDayOfWeek] - e.g. '週一'
 * @returns {boolean}
 */
function _matchOrderTiming(orderDate, orderDayOfWeek, queryDate, queryDayOfWeek) {
  var oDay = normalizeDayOfWeek(orderDayOfWeek);
  var qDay = normalizeDayOfWeek(queryDayOfWeek);
  var oDate = (orderDate || '').trim();
  var qDate = (queryDate || '').trim();

  // 1. Both date and dayOfWeek are queried (e.g. daily summary / today orders)
  if (qDate && qDay) {
    if (oDay) {
      return (oDay === qDay || oDay === 'ALL' || oDay === '今日');
    }
    return (oDate === qDate);
  }

  // 2. Only dayOfWeek is queried (e.g. weekly batch schedule query)
  if (qDay) {
    return (oDay === qDay || oDay === 'ALL');
  }

  // 3. Only date is queried
  if (qDate) {
    return (oDate === qDate);
  }

  // 4. Neither is specified (all orders)
  return true;
}

/**
 * Record an order
 */
function addOrder(orderData) {
  var now = new Date();
  var orderId = 'ORD_' + now.getTime() + '_' + Math.floor(Math.random() * 1000);
  var timestamp = now.toISOString();
  var date = orderData.date || now.toISOString().slice(0, 10);
  var dayOfWeek = orderData.dayOfWeek || '週一';
  var quantity = Number(orderData.quantity) || 1;
  var price = Number(orderData.price) || 0;
  var subtotal = quantity * price;

  var rawUserId = orderData.userId || '';
  var effUserId = getEffectiveUserId(rawUserId, orderData.userName, orderData.userNickname);

  var record = {
    orderId: orderId,
    timestamp: timestamp,
    date: date,
    dayOfWeek: dayOfWeek,
    groupId: orderData.groupId || '',
    userId: effUserId,
    userName: orderData.userName || '成員',
    userNickname: orderData.userNickname || orderData.userName || '成員',
    childName: (orderData.childName || '').trim(),
    itemName: orderData.itemName || '',
    quantity: quantity,
    price: price,
    subtotal: subtotal,
    status: 'ACTIVE',
    paid: 'UNPAID'
  };

  if (record.childName && record.childName !== '本人' && record.childName !== '自己') {
    saveChild(effUserId, record.userName, record.userNickname, record.childName);
  }

  if (!isGasRuntime()) {
    _mockStore.Orders.push(record);
    return record;
  }

  var ss = getSpreadsheet();
  if (!ss) return record;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return record;

  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
  var colMap = _getOrderColumnIndexes(headers);
  var rowData = new Array(headers.length);
  for (var idx = 0; idx < rowData.length; idx++) rowData[idx] = '';

  if (colMap.orderId !== -1) rowData[colMap.orderId] = record.orderId;
  if (colMap.timestamp !== -1) rowData[colMap.timestamp] = record.timestamp;
  if (colMap.date !== -1) rowData[colMap.date] = record.date;
  if (colMap.dayOfWeek !== -1) rowData[colMap.dayOfWeek] = record.dayOfWeek;
  if (colMap.groupId !== -1) rowData[colMap.groupId] = record.groupId;
  if (colMap.userId !== -1) rowData[colMap.userId] = record.userId;
  if (colMap.userName !== -1) rowData[colMap.userName] = _sanitizeSheetCell(record.userName);
  if (colMap.userNickname !== -1) rowData[colMap.userNickname] = _sanitizeSheetCell(record.userNickname);
  if (colMap.childName !== -1) rowData[colMap.childName] = _sanitizeSheetCell(record.childName);
  if (colMap.itemName !== -1) rowData[colMap.itemName] = _sanitizeSheetCell(record.itemName);
  if (colMap.quantity !== -1) rowData[colMap.quantity] = record.quantity;
  if (colMap.price !== -1) rowData[colMap.price] = record.price;
  if (colMap.subtotal !== -1) rowData[colMap.subtotal] = record.subtotal;
  if (colMap.status !== -1) rowData[colMap.status] = record.status;
  if (colMap.paid !== -1) rowData[colMap.paid] = record.paid;

  sheet.appendRow(rowData);

  return record;
}

/**
 * Get active orders for a user
 * @param {string} userId
 * @param {string} [groupId]
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [userName]
 * @returns {Array} Array of order objects
 */
function getUserOrders(userId, groupId, date, dayOfWeek, userName) {
  var effUserId = userId ? getEffectiveUserId(userId, userName, userName) : '';

  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      if (o.status !== 'ACTIVE') return false;
      if (groupId && o.groupId !== groupId) return false;

      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return false;

      // Strict user matching:
      // If userName is provided and not fallback '成員', order MUST match userName or userNickname
      if (userName && userName !== '成員') {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return false;
        }
      }

      // If userId is provided and not 'anonymous', order MUST match userId or effUserId
      if (userId && userId !== 'anonymous') {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId && o.userId !== effUserId) {
          return false;
        }
      }

      // If neither userId nor userName matches any criteria, return false
      var hasValidUserId = (userId && userId !== 'anonymous');
      var hasValidUserName = (userName && userName !== '成員');
      if (!hasValidUserId && !hasValidUserName) {
        return false;
      }

      return true;
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var colMap = _getOrderColumnIndexes(rows[0]);
  var orders = [];

  var hasValidUserId = (userId && userId !== 'anonymous');
  var hasValidUserName = (userName && userName !== '成員');
  if (!hasValidUserId && !hasValidUserName) {
    return [];
  }

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rUserId = String(r[colMap.userId]);
    var rUserName = String(r[colMap.userName]);
    var rUserNickname = colMap.userNickname !== -1 ? String(r[colMap.userNickname]) : rUserName;
    var rChildName = colMap.childName !== -1 ? String(r[colMap.childName] || '').trim() : '';

    // Strict user matching:
    if (hasValidUserName) {
      if (rUserName && rUserName !== '成員' && rUserName !== userName && rUserNickname !== userName) {
        continue;
      }
    }

    if (hasValidUserId) {
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId && rUserId !== effUserId) {
        continue;
      }
    }

    orders.push({
      row: i + 1,
      orderId: r[colMap.orderId],
      timestamp: r[colMap.timestamp],
      date: rDate,
      dayOfWeek: rDayOfWeek,
      groupId: rGroupId,
      userId: rUserId,
      userName: rUserName,
      userNickname: rUserNickname,
      childName: rChildName,
      itemName: r[colMap.itemName],
      quantity: Number(r[colMap.quantity]),
      price: Number(r[colMap.price]),
      subtotal: Number(r[colMap.subtotal]),
      status: rStatus,
      paid: r[colMap.paid]
    });
  }
  return orders;
}

/**
 * Cancel orders for a specific user
 * @param {string} userId
 * @param {string} groupId
 * @param {string} [itemName]
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [userName]
 * @returns {number} Count of cancelled orders
 */
function cancelOrder(userId, groupId, itemName, date, dayOfWeek, userName, childName) {
  var effUserId = userId ? getEffectiveUserId(userId, userName, userName) : '';

  // If neither userId nor userName is provided, do NOT cancel anything
  var hasValidUserId = (userId && userId !== 'anonymous');
  var hasValidUserName = (userName && userName !== '成員');
  if (!hasValidUserId && !hasValidUserName) {
    return 0;
  }

  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.status !== 'ACTIVE') return;
      if (groupId && o.groupId !== groupId) return;

      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return;
      if (itemName && o.itemName.indexOf(itemName) === -1) return;
      if (childName && childName.trim()) {
        if ((o.childName || '').trim() !== childName.trim()) return;
      }

      // Strict user matching
      if (hasValidUserName) {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return;
        }
      }

      if (hasValidUserId) {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId && o.userId !== effUserId) {
          return;
        }
      }

      o.status = 'CANCELLED';
      count++;
    });
    return count;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return 0;

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return 0;
  var colMap = _getOrderColumnIndexes(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rItem = String(r[colMap.itemName]);
    if (itemName && rItem.indexOf(itemName) === -1) continue;

    if (childName && childName.trim() && colMap.childName !== -1) {
      var rChildName = String(r[colMap.childName] || '').trim();
      if (rChildName !== childName.trim()) continue;
    }

    var rUserId = String(r[colMap.userId]);
    var rUserName = String(r[colMap.userName]);
    var rUserNickname = colMap.userNickname !== -1 ? String(r[colMap.userNickname]) : rUserName;

    // Strict user matching
    if (hasValidUserName) {
      if (rUserName && rUserName !== '成員' && rUserName !== userName && rUserNickname !== userName) {
        continue;
      }
    }

    if (hasValidUserId) {
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId && rUserId !== effUserId) {
        continue;
      }
    }

    sheet.getRange(i + 1, colMap.status + 1).setValue('CANCELLED');
    count++;
  }
  return count;
}

/**
 * Cancel group orders across all members (exclusive to organizer bulk cancellations)
 * @param {string} groupId
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [itemName]
 * @returns {number} Count of cancelled orders
 */
function cancelGroupOrders(groupId, date, dayOfWeek, itemName) {
  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.status !== 'ACTIVE') return;
      if (groupId && o.groupId !== groupId) return;
      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return;
      if (itemName && o.itemName.indexOf(itemName) === -1) return;

      o.status = 'CANCELLED';
      count++;
    });
    return count;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return 0;

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return 0;
  var colMap = _getOrderColumnIndexes(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rItem = String(r[colMap.itemName]);
    if (!itemName || rItem.indexOf(itemName) !== -1) {
      sheet.getRange(i + 1, colMap.status + 1).setValue('CANCELLED');
      count++;
    }
  }
  return count;
}

/**
 * Find user info in a group by matching query to userId, userName, or userNickname
 * @param {string} groupId
 * @param {string} query
 * @returns {{ userId: string, userName: string, userNickname: string } | null}
 */
function findUserInGroup(groupId, query) {
  if (!query) return null;
  var q = String(query).replace(/^@/, '').trim().toLowerCase();
  if (!q) return null;

  var orders = getGroupOrders(groupId, null, null);
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var uid = String(o.userId || '').toLowerCase();
    var uname = String(o.userName || '').toLowerCase();
    var unick = String(o.userNickname || '').toLowerCase();
    if (uid === q || uname === q || unick === q) {
      return {
        userId: o.userId,
        userName: o.userName,
        userNickname: o.userNickname || o.userName
      };
    }
  }
  return null;
}

/**
 * Get all active orders for a group on a date or dayOfWeek
 */
function getGroupOrders(groupId, date, dayOfWeek) {
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      var matchGroup = (!groupId || o.groupId === groupId);
      return matchGroup && _matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek) && o.status === 'ACTIVE';
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var colMap = _getOrderColumnIndexes(rows[0]);
  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId] || '').trim();
    if (groupId && rGroupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDay = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';
    var rChildName = colMap.childName !== -1 ? String(r[colMap.childName] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDay, date, dayOfWeek)) continue;

    orders.push({
      orderId: r[colMap.orderId],
      timestamp: r[colMap.timestamp],
      date: rDate,
      dayOfWeek: rDay,
      groupId: rGroupId,
      userId: r[colMap.userId],
      userName: r[colMap.userName],
      userNickname: colMap.userNickname !== -1 ? r[colMap.userNickname] : (r[colMap.userName] || ''),
      childName: rChildName,
      itemName: r[colMap.itemName],
      quantity: Number(r[colMap.quantity]),
      price: Number(r[colMap.price]),
      subtotal: Number(r[colMap.subtotal]),
      status: rStatus,
      paid: r[colMap.paid]
    });
  }
  return orders;
}

/**
 * Calculate single-day summary
 */
function getOrderSummary(groupId, date, dayOfWeek) {
  var orders = getGroupOrders(groupId, date, dayOfWeek);
  if (orders.length === 0 && groupId) {
    var allOrders = getGroupOrders('', date, dayOfWeek);
    if (allOrders.length > 0) {
      orders = allOrders;
    }
  }
  var itemMap = {};
  var userMap = {};
  var totalQuantity = 0;
  var totalAmount = 0;

  orders.forEach(function (o) {
    var uName = o.userNickname || o.userName || '成員';
    var childTag = o.childName ? '[' + o.childName + ']' : '';
    var buyerEntry = uName + childTag + (o.quantity > 1 ? 'x' + o.quantity : '');

    if (!itemMap[o.itemName]) {
      itemMap[o.itemName] = {
        itemName: o.itemName,
        quantity: 0,
        price: o.price,
        subtotal: 0,
        buyers: []
      };
    }
    itemMap[o.itemName].quantity += o.quantity;
    itemMap[o.itemName].subtotal += o.subtotal;
    itemMap[o.itemName].buyers.push(buyerEntry);

    if (!userMap[uName]) {
      userMap[uName] = {
        userName: uName,
        items: [],
        total: 0
      };
    }
    var userItemEntry = (o.childName ? o.childName + ': ' : '') + o.itemName + 'x' + o.quantity;
    userMap[uName].items.push(userItemEntry);
    userMap[uName].total += o.subtotal;

    totalQuantity += o.quantity;
    totalAmount += o.subtotal;
  });

  var itemsList = Object.keys(itemMap).map(function (k) { return itemMap[k]; });
  var usersList = Object.keys(userMap).map(function (k) { return userMap[k]; });

  return {
    date: date,
    dayOfWeek: dayOfWeek,
    totalQuantity: totalQuantity,
    totalAmount: totalAmount,
    items: itemsList,
    users: usersList
  };
}

/**
 * Calculate full weekly summary (Mon to Fri batch)
 */
function getWeeklyOrderSummary(groupId) {
  var schedule = getWeeklySchedule();
  var days = ['週一', '週二', '週三', '週四', '週五'];
  var daySummaries = [];
  var grandTotalAmount = 0;
  var grandTotalQuantity = 0;
  var userWeeklyMap = {};

  days.forEach(function (day) {
    var sched = getScheduleByDay(day) || { restaurantName: day + '店家' };
    var dayOrders = getGroupOrders(groupId, null, day);
    if (dayOrders.length === 0 && groupId) {
      var allDayOrders = getGroupOrders('', null, day);
      if (allDayOrders.length > 0) {
        dayOrders = allDayOrders;
      }
    }
    var itemMap = {};
    var dayTotalQty = 0;
    var dayTotalAmt = 0;

    dayOrders.forEach(function (o) {
      if (!itemMap[o.itemName]) {
        itemMap[o.itemName] = {
          itemName: o.itemName,
          quantity: 0,
          price: o.price,
          subtotal: 0,
          buyers: []
        };
      }
      itemMap[o.itemName].quantity += o.quantity;
      itemMap[o.itemName].subtotal += o.subtotal;
      var childTag = o.childName ? '[' + o.childName + ']' : '';
      itemMap[o.itemName].buyers.push((o.userNickname || o.userName) + childTag + (o.quantity > 1 ? 'x' + o.quantity : ''));

      dayTotalQty += o.quantity;
      dayTotalAmt += o.subtotal;

      // User weekly aggregation
      if (!userWeeklyMap[o.userName]) {
        userWeeklyMap[o.userName] = {
          userName: o.userName,
          days: {},
          total: 0
        };
      }
      if (!userWeeklyMap[o.userName].days[day]) {
        userWeeklyMap[o.userName].days[day] = [];
      }
      var userItemLabel = (o.childName ? o.childName + ': ' : '') + o.itemName + 'x' + o.quantity;
      userWeeklyMap[o.userName].days[day].push(userItemLabel);
      userWeeklyMap[o.userName].total += o.subtotal;
    });

    var items = Object.keys(itemMap).map(function (k) { return itemMap[k]; });

    daySummaries.push({
      dayOfWeek: day,
      restaurantName: sched.restaurantName,
      cutoffTime: sched.cutoffTime,
      totalQuantity: dayTotalQty,
      totalAmount: dayTotalAmt,
      items: items
    });

    grandTotalQuantity += dayTotalQty;
    grandTotalAmount += dayTotalAmt;
  });

  var usersList = Object.keys(userWeeklyMap).map(function (u) {
    return userWeeklyMap[u];
  });

  return {
    daySummaries: daySummaries,
    grandTotalQuantity: grandTotalQuantity,
    grandTotalAmount: grandTotalAmount,
    users: usersList
  };
}

/**
 * Google Sheets UI onOpen menu builder
 */
function onOpenSpreadsheet() {
  if (!isGasRuntime()) return;
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🍱 便當訂餐管理')
      .addItem('📅 檢查/初始化試算表結構', 'initSheets')
      .addItem('📊 重新產生今日統計表', 'refreshDailySummary')
      .addItem('📈 重新產生本週梯次統計表', 'refreshWeeklySummary')
      .addSeparator()
      .addItem('🕒 檢查 Apps Script 時區與系統時間', 'checkTimeZoneAndCurrentTime')
      .addSeparator()
      .addItem('🍔 從 Uber Eats 網址匯入菜單', 'showUberEatsImportDialog')
      .addItem('📑 從自訂餐廳匯入菜單', 'showCustomRestaurantImportDialog')
      .addSeparator()
      .addItem('🔍 診斷測試：Uber Eats 菜單抓取', 'testUberEatsImport')
      .addItem('🔍 診斷測試：LINE 連線狀態', 'testLineConnection')
      .addItem('🔍 診斷測試：幫助卡片訊息', 'testHelpMessage')
      .addToUi();
  } catch (e) {}
}

/**
 * Diagnostic tool to check Google Apps Script project timezone, spreadsheet timezone, and current time
 */
function checkTimeZoneAndCurrentTime() {
  var ssTz = 'N/A';
  if (isGasRuntime()) {
    try {
      var ss = getSpreadsheet();
      if (ss && typeof ss.getSpreadsheetTimeZone === 'function') {
        ssTz = ss.getSpreadsheetTimeZone();
      }
    } catch (e) {}
  } else if (typeof globalThis !== 'undefined' && globalThis._mockSpreadsheetTimeZone) {
    ssTz = globalThis._mockSpreadsheetTimeZone;
  }

  var scriptTz = 'N/A';
  if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
    try {
      scriptTz = Session.getScriptTimeZone();
    } catch (e) {}
  } else if (typeof globalThis !== 'undefined' && globalThis._mockScriptTimeZone) {
    scriptTz = globalThis._mockScriptTimeZone;
  }

  // Determine effective timezone directly from spreadsheet setting, fallback to script timezone
  var effectiveTz = getSpreadsheetTimeZone();

  var now = (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var serverRawTime = now.toString();
  var isoTime = now.toISOString ? now.toISOString() : String(now);
  var localTime = 'N/A';
  var dateStr = 'N/A';
  var dayOfWeekStr = 'N/A';

  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      localTime = Utilities.formatDate(now, effectiveTz, 'yyyy-MM-dd HH:mm:ss');
      dateStr = Utilities.formatDate(now, effectiveTz, 'yyyy-MM-dd');
      var u = parseInt(Utilities.formatDate(now, effectiveTz, 'u'), 10);
      var dayMapU = { 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日' };
      dayOfWeekStr = dayMapU[u] || '週一';
    } catch (e) {}
  } else {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        var dParts = new Intl.DateTimeFormat('en-CA', { timeZone: effectiveTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        var tParts = new Intl.DateTimeFormat('en-GB', { timeZone: effectiveTz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        dateStr = dParts;
        localTime = dParts + ' ' + tParts;
        dayOfWeekStr = new Intl.DateTimeFormat('zh-TW', { timeZone: effectiveTz, weekday: 'short' }).format(now);
      }
    } catch (e) {}
  }

  if (dateStr === 'N/A') {
    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    var y = twDate.getFullYear();
    var m = ('0' + (twDate.getMonth() + 1)).slice(-2);
    var d = ('0' + twDate.getDate()).slice(-2);
    var hh = ('0' + twDate.getHours()).slice(-2);
    var mm = ('0' + twDate.getMinutes()).slice(-2);
    var ss = ('0' + twDate.getSeconds()).slice(-2);
    dateStr = y + '-' + m + '-' + d;
    localTime = dateStr + ' ' + hh + ':' + mm + ':' + ss;
    var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    dayOfWeekStr = dayMap[twDate.getDay()];
  }

  var tzStatusNote = '';
  if (ssTz !== 'N/A' && scriptTz !== 'N/A' && ssTz !== scriptTz) {
    tzStatusNote = '⚠️ 提醒：試算表設定時區 (' + ssTz + ') 與專案資訊清單時區 (' + scriptTz + ') 不一致。系統已優先採用試算表設定時區 (' + effectiveTz + ')，建議前往「檔案 -> 設定」或「appsscript.json」將兩者同步！\n';
  } else if (ssTz !== 'N/A') {
    tzStatusNote = '✅ 系統已成功讀取試算表設定時區 (' + effectiveTz + ')！\n';
  } else {
    tzStatusNote = 'ℹ️ 運行採用時區 (' + effectiveTz + ')。\n';
  }

  var msg = '【系統時區與時間診斷資訊】\n' +
            '----------------------------------------\n' +
            '• 試算表設定時區 (Spreadsheet TimeZone): ' + ssTz + '\n' +
            '• 專案腳本時區 (Script TimeZone): ' + scriptTz + '\n' +
            '• 系統運行採用時區 (Effective TimeZone): ' + effectiveTz + '\n' +
            '• 當前時區時間 (Local Time): ' + localTime + '\n' +
            '• 當前判定日期: ' + dateStr + '\n' +
            '• 當前判定星期: ' + dayOfWeekStr + '\n' +
            '• 伺服器原始時間 (Raw Date): ' + serverRawTime + '\n' +
            '• ISO UTC 時間: ' + isoTime + '\n' +
            '----------------------------------------\n' +
            tzStatusNote;

  if (typeof Logger !== 'undefined') {
    Logger.log(msg);
  }
  if (isGasRuntime()) {
    try {
      SpreadsheetApp.getUi().alert('🕒 時區與時間診斷', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}
  }

  return {
    spreadsheetTimeZone: ssTz,
    scriptTimeZone: scriptTz,
    effectiveTimeZone: effectiveTz,
    localTime: localTime,
    taipeiTime: localTime,
    dateStr: dateStr,
    dayOfWeek: dayOfWeekStr,
    serverRawTime: serverRawTime,
    isoTime: isoTime,
    formattedMessage: msg
  };
}

/**
 * Log diagnostic events directly into a 'Logs' sheet tab in Google Sheets
 */
function logToSheet(type, message, detail) {
  var detailStr = '';
  if (typeof detail === 'object') {
    try { detailStr = JSON.stringify(detail); } catch (e) { detailStr = String(detail); }
  } else if (detail !== undefined && detail !== null) {
    detailStr = String(detail);
  }
  var safeType = _sanitizeSheetCell(type || 'INFO');
  var safeMessage = _sanitizeSheetCell(message || '');
  var safeDetail = _sanitizeSheetCell(detailStr);

  if (!isGasRuntime()) {
    if (!_mockStore.Logs) _mockStore.Logs = [];
    _mockStore.Logs.push([new Date().toISOString(), safeType, safeMessage, safeDetail]);
    return;
  }
  try {
    var ss = getSpreadsheet();
    if (!ss) return;
    var logSheet = ss.getSheetByName('Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs');
      logSheet.appendRow(['Timestamp', 'Type', 'Message', 'Detail']);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EFEFEF');
    }
    logSheet.appendRow([new Date().toISOString(), safeType, safeMessage, safeDetail]);
  } catch (e) {}
}

/**
 * Get children for a specific user
 * @param {string} userId
 * @returns {Array<string>} Array of child names (e.g. ['大寶', '二寶'])
 */
function getChildren(userId, userName, userNickname) {
  if (!userId) return [];
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    var kids = [];
    _mockStore.Children.forEach(function (c) {
      if ((c.userId === userId || c.userId === effUserId) && c.childName && kids.indexOf(c.childName) === -1) {
        kids.push(c.childName);
      }
    });
    return kids;
  }
  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var kids = [];
  for (var i = 1; i < rows.length; i++) {
    var rUid = String(rows[i][0] || '').trim();
    var rChild = String(rows[i][3] || '').trim();
    if ((rUid === userId || rUid === effUserId) && rChild && kids.indexOf(rChild) === -1) {
      kids.push(rChild);
    }
  }
  return kids;
}

/**
 * Get detailed children profiles for a specific user
 * @param {string} userId
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {Array<{ userId: string, userName: string, userNickname: string, childName: string, note: string, createdAt: string, updatedAt: string }>}
 */
function getChildrenProfiles(userId, userName, userNickname) {
  if (!userId) return [];
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    return _mockStore.Children.filter(function (c) { return c.userId === userId || c.userId === effUserId; });
  }
  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var rUid = String(rows[i][0] || '').trim();
    if (rUid === userId || rUid === effUserId) {
      list.push({
        userId: rUid,
        userName: String(rows[i][1] || ''),
        userNickname: String(rows[i][2] || ''),
        childName: String(rows[i][3] || ''),
        note: String(rows[i][4] || ''),
        createdAt: String(rows[i][5] || ''),
        updatedAt: String(rows[i][6] || '')
      });
    }
  }
  return list;
}

/**
 * Save or update a child profile
 * @param {string} userId
 * @param {string} userName
 * @param {string} userNickname
 * @param {string} childName
 * @param {string} [note]
 * @returns {boolean}
 */
function saveChild(userId, userName, userNickname, childName, note) {
  if (!userId || !childName) return false;
  var cName = childName.trim();
  if (!cName || cName === '本人' || cName === '自己') return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var nowStr = new Date().toISOString();

  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    var existing = null;
    for (var i = 0; i < _mockStore.Children.length; i++) {
      if ((_mockStore.Children[i].userId === userId || _mockStore.Children[i].userId === effUserId) && _mockStore.Children[i].childName === cName) {
        existing = _mockStore.Children[i];
        break;
      }
    }
    if (existing) {
      if (note !== undefined && note !== null && note !== '') existing.note = _sanitizeSheetCell(note);
      existing.updatedAt = nowStr;
    } else {
      _mockStore.Children.push({
        userId: effUserId,
        userName: _sanitizeSheetCell(userName || ''),
        userNickname: _sanitizeSheetCell(userNickname || userName || ''),
        childName: _sanitizeSheetCell(cName),
        note: _sanitizeSheetCell(note || ''),
        createdAt: nowStr,
        updatedAt: nowStr
      });
    }
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
    if (!sheet) return false;
  }

  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var rUid = String(rows[r][0]).trim();
    if ((rUid === userId || rUid === effUserId) && String(rows[r][3]).trim() === cName) {
      if (note !== undefined && note !== null && note !== '') {
        sheet.getRange(r + 1, 5).setValue(_sanitizeSheetCell(note));
      }
      sheet.getRange(r + 1, 7).setValue(nowStr);
      return true;
    }
  }

  sheet.appendRow([
    effUserId,
    _sanitizeSheetCell(userName || ''),
    _sanitizeSheetCell(userNickname || userName || ''),
    _sanitizeSheetCell(cName),
    _sanitizeSheetCell(note || ''),
    nowStr,
    nowStr
  ]);
  return true;
}

/**
 * Set batch children for a user (replacing current list)
 * @param {string} userId
 * @param {string} userName
 * @param {string} userNickname
 * @param {Array<string>} childNames
 * @returns {boolean}
 */
function setChildren(userId, userName, userNickname, childNames) {
  if (!userId) return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var names = (childNames || []).map(function (n) { return String(n).trim(); }).filter(function (n) { return n && n !== '本人' && n !== '自己'; });

  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    _mockStore.Children = _mockStore.Children.filter(function (c) { return c.userId !== userId && c.userId !== effUserId; });
    var nowStr = new Date().toISOString();
    names.forEach(function (n) {
      _mockStore.Children.push({
        userId: effUserId,
        userName: _sanitizeSheetCell(userName || ''),
        userNickname: _sanitizeSheetCell(userNickname || userName || ''),
        childName: _sanitizeSheetCell(n),
        note: '',
        createdAt: nowStr,
        updatedAt: nowStr
      });
    });
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
    if (!sheet) return false;
  }

  var rows = sheet.getDataRange().getValues();
  for (var r = rows.length - 1; r >= 1; r--) {
    var rUid = String(rows[r][0]).trim();
    if (rUid === userId || rUid === effUserId) {
      sheet.deleteRow(r + 1);
    }
  }

  var nowTime = new Date().toISOString();
  names.forEach(function (n) {
    sheet.appendRow([
      effUserId,
      _sanitizeSheetCell(userName || ''),
      _sanitizeSheetCell(userNickname || userName || ''),
      _sanitizeSheetCell(n),
      '',
      nowTime,
      nowTime
    ]);
  });
  return true;
}

/**
 * Delete a specific child profile
 * @param {string} userId
 * @param {string} childName
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {boolean}
 */
function deleteChild(userId, childName, userName, userNickname) {
  if (!userId || !childName) return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var cName = childName.trim();

  if (!isGasRuntime()) {
    if (!_mockStore.Children) return false;
    var lenBefore = _mockStore.Children.length;
    _mockStore.Children = _mockStore.Children.filter(function (c) {
      return !((c.userId === userId || c.userId === effUserId) && c.childName === cName);
    });
    return _mockStore.Children.length < lenBefore;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return false;

  var rows = sheet.getDataRange().getValues();
  var deleted = false;
  for (var r = rows.length - 1; r >= 1; r--) {
    var rUid = String(rows[r][0]).trim();
    if ((rUid === userId || rUid === effUserId) && String(rows[r][3]).trim() === cName) {
      sheet.deleteRow(r + 1);
      deleted = true;
    }
  }
  return deleted;
}

// Global export helper
(function (global) {
  var g = (typeof window   !== 'undefined') ? window
        : (typeof globalThis !== 'undefined') ? globalThis
        : (typeof global   !== 'undefined') ? global
        : (typeof self     !== 'undefined') ? self
        : this;

  g.isGasRuntime = isGasRuntime;
  g.getSpreadsheet = getSpreadsheet;
  g.getSpreadsheetTimeZone = getSpreadsheetTimeZone;
  g.initSheets = initSheets;
  g.getConfigValue = getConfigValue;
  g.setConfigValue = setConfigValue;
  g.getWeeklySchedule = getWeeklySchedule;
  g.getScheduleByDay = getScheduleByDay;
  g.setWeeklyScheduleDay = setWeeklyScheduleDay;
  g.getMenuItems = getMenuItems;
  g.saveMenuItems = saveMenuItems;
  g.addOrder = addOrder;
  g.getUserOrders = getUserOrders;
  g.cancelOrder = cancelOrder;
  g.cancelGroupOrders = cancelGroupOrders;
  g.getGroupOrders = getGroupOrders;
  g.getOrderSummary = getOrderSummary;
  g.getWeeklyOrderSummary = getWeeklyOrderSummary;
  g.getPaymentConfig = getPaymentConfig;
  g.normalizeImageUrl = normalizeImageUrl;
  g.onOpenSpreadsheet = onOpenSpreadsheet;
  g.checkTimeZoneAndCurrentTime = checkTimeZoneAndCurrentTime;
  g.findUserInGroup = findUserInGroup;
  g.logToSheet = logToSheet;
  g._getOrderColumnIndexes = _getOrderColumnIndexes;
  g._matchOrderTiming = _matchOrderTiming;
  g.normalizeDayOfWeek = normalizeDayOfWeek;
  g.SYSTEM_TAB_NAMES = SYSTEM_TAB_NAMES;
  g.isSystemTab = isSystemTab;
  g.readCustomRestaurantMenu = readCustomRestaurantMenu;
  g.importCustomRestaurantMenu = importCustomRestaurantMenu;
  g.getChildren = getChildren;
  g.getChildrenProfiles = getChildrenProfiles;
  g.saveChild = saveChild;
  g.setChildren = setChildren;
  g.deleteChild = deleteChild;
  g._sanitizeSheetCell = _sanitizeSheetCell;
  g.hashUserId = hashUserId;
  g.getEffectiveUserId = getEffectiveUserId;
  g._mockStore = _mockStore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isGasRuntime: isGasRuntime,
      getSpreadsheet: getSpreadsheet,
      getSpreadsheetTimeZone: getSpreadsheetTimeZone,
      initSheets: initSheets,
      getConfigValue: getConfigValue,
      setConfigValue: setConfigValue,
      getWeeklySchedule: getWeeklySchedule,
      getScheduleByDay: getScheduleByDay,
      setWeeklyScheduleDay: setWeeklyScheduleDay,
      getMenuItems: getMenuItems,
      saveMenuItems: saveMenuItems,
      SYSTEM_TAB_NAMES: SYSTEM_TAB_NAMES,
      isSystemTab: isSystemTab,
      readCustomRestaurantMenu: readCustomRestaurantMenu,
      importCustomRestaurantMenu: importCustomRestaurantMenu,
      addOrder: addOrder,
      getUserOrders: getUserOrders,
      cancelOrder: cancelOrder,
      cancelGroupOrders: cancelGroupOrders,
      findUserInGroup: findUserInGroup,
      getGroupOrders: getGroupOrders,
      getOrderSummary: getOrderSummary,
      getWeeklyOrderSummary: getWeeklyOrderSummary,
      getPaymentConfig: getPaymentConfig,
      normalizeImageUrl: normalizeImageUrl,
      onOpenSpreadsheet: onOpenSpreadsheet,
      checkTimeZoneAndCurrentTime: checkTimeZoneAndCurrentTime,
      logToSheet: logToSheet,
      _getOrderColumnIndexes: _getOrderColumnIndexes,
      _matchOrderTiming: _matchOrderTiming,
      normalizeDayOfWeek: normalizeDayOfWeek,
      getChildren: getChildren,
      getChildrenProfiles: getChildrenProfiles,
      saveChild: saveChild,
      setChildren: setChildren,
      deleteChild: deleteChild,
      _sanitizeSheetCell: _sanitizeSheetCell,
      hashUserId: hashUserId,
      getEffectiveUserId: getEffectiveUserId,
      _mockStore: _mockStore
    };
  }
})(this);
