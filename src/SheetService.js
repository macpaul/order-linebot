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
    'PAYMENT_LINEPAY_QR_URL': ''
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
  Summary: []
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
        ['PAYMENT_LINEPAY_QR_URL', '', 'LINE Pay 收款碼/條碼圖片網址 (支援 Google Drive 分享連結或圖床)']
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
      headers: ['OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid']
    },
    {
      name: CONFIG.SHEET_NAMES.SUMMARY,
      headers: ['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']
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
      // Ensure UserNickname column exists in existing Orders sheet
      var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
      var hasNickname = false;
      for (var h = 0; h < headerRow.length; h++) {
        if (String(headerRow[h]).trim().toLowerCase() === 'usernickname') {
          hasNickname = true;
          break;
        }
      }
      if (!hasNickname && headerRow.length >= 13) {
        sheet.insertColumnAfter(7);
        sheet.getRange(1, 8).setValue('UserNickname').setFontWeight('bold').setBackground('#EFEFEF');
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
 * Sanitize cell values against Google Sheets formula injection (=, +, -, @)
 */
function _sanitizeSheetCell(val) {
  if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
    return "'" + val;
  }
  return val;
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
 * Helper to map Orders sheet header columns dynamically
 */
function _getOrderColumnIndexes(headers) {
  var colMap = {
    orderId: 0,
    timestamp: 1,
    date: 2,
    dayOfWeek: 3,
    groupId: 4,
    userId: 5,
    userName: 6,
    userNickname: -1,
    itemName: 7,
    quantity: 8,
    price: 9,
    subtotal: 10,
    status: 11,
    paid: 12
  };
  if (!headers || headers.length === 0) return colMap;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim().toLowerCase();
    if (h === 'orderid' || h === '訂單編號' || h === '訂單id') colMap.orderId = c;
    else if (h === 'timestamp' || h === '時間' || h === '建立時間') colMap.timestamp = c;
    else if (h === 'date' || h === '日期') colMap.date = c;
    else if (h === 'dayofweek' || h === '星期' || h === '梯次') colMap.dayOfWeek = c;
    else if (h === 'groupid' || h === '群組id' || h === '群組') colMap.groupId = c;
    else if (h === 'userid' || h === '使用者id' || h === '用戶id' || h === 'lineid') colMap.userId = c;
    else if (h === 'username' || h === '使用者名稱' || h === '姓名' || h === '訂購人') colMap.userName = c;
    else if (h === 'usernickname' || h === '使用者暱稱' || h === '暱稱') colMap.userNickname = c;
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

  var record = {
    orderId: orderId,
    timestamp: timestamp,
    date: date,
    dayOfWeek: dayOfWeek,
    groupId: orderData.groupId || '',
    userId: orderData.userId || '',
    userName: orderData.userName || '成員',
    userNickname: orderData.userNickname || orderData.userName || '成員',
    itemName: orderData.itemName || '',
    quantity: quantity,
    price: price,
    subtotal: subtotal,
    status: 'ACTIVE',
    paid: 'UNPAID'
  };

  if (!isGasRuntime()) {
    _mockStore.Orders.push(record);
    return record;
  }

  var ss = getSpreadsheet();
  if (!ss) return record;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return record;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0] || [];
  var hasNicknameCol = false;
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).trim().toLowerCase() === 'usernickname') {
      hasNicknameCol = true;
      break;
    }
  }

  if (hasNicknameCol) {
    sheet.appendRow([
      record.orderId,
      record.timestamp,
      record.date,
      record.dayOfWeek,
      record.groupId,
      record.userId,
      _sanitizeSheetCell(record.userName),
      _sanitizeSheetCell(record.userNickname),
      _sanitizeSheetCell(record.itemName),
      record.quantity,
      record.price,
      record.subtotal,
      record.status,
      record.paid
    ]);
  } else {
    sheet.appendRow([
      record.orderId,
      record.timestamp,
      record.date,
      record.dayOfWeek,
      record.groupId,
      record.userId,
      _sanitizeSheetCell(record.userName),
      _sanitizeSheetCell(record.itemName),
      record.quantity,
      record.price,
      record.subtotal,
      record.status,
      record.paid
    ]);
  }

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
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      if (o.status !== 'ACTIVE') return false;
      if (groupId && o.groupId !== groupId) return false;
      if (date && o.date !== date) return false;
      if (dayOfWeek && o.dayOfWeek !== dayOfWeek) return false;

      // Strict user matching:
      // If userName is provided and not fallback '成員', order MUST match userName or userNickname
      if (userName && userName !== '成員') {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return false;
        }
      }

      // If userId is provided and not 'anonymous', order MUST match userId
      if (userId && userId !== 'anonymous') {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId) {
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

    var rDate = String(r[colMap.date]);
    if (date && rDate !== date) continue;

    var rDayOfWeek = String(r[colMap.dayOfWeek]);
    if (dayOfWeek && rDayOfWeek !== dayOfWeek) continue;

    var rUserId = String(r[colMap.userId]);
    var rUserName = String(r[colMap.userName]);
    var rUserNickname = colMap.userNickname !== -1 ? String(r[colMap.userNickname]) : rUserName;

    // Strict user matching:
    if (hasValidUserName) {
      if (rUserName && rUserName !== '成員' && rUserName !== userName && rUserNickname !== userName) {
        continue;
      }
    }

    if (hasValidUserId) {
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId) {
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
function cancelOrder(userId, groupId, itemName, date, dayOfWeek, userName) {
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
      if (date && o.date !== date) return;
      if (dayOfWeek && o.dayOfWeek !== dayOfWeek) return;
      if (itemName && o.itemName.indexOf(itemName) === -1) return;

      // Strict user matching
      if (hasValidUserName) {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return;
        }
      }

      if (hasValidUserId) {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId) {
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

    var rDate = String(r[colMap.date]);
    if (date && rDate !== date) continue;

    var rDayOfWeek = String(r[colMap.dayOfWeek]);
    if (dayOfWeek && rDayOfWeek !== dayOfWeek) continue;

    var rItem = String(r[colMap.itemName]);
    if (itemName && rItem.indexOf(itemName) === -1) continue;

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
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId) {
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
      if ((!groupId || o.groupId === groupId) &&
        (!date || o.date === date) &&
        (!dayOfWeek || o.dayOfWeek === dayOfWeek) &&
        (!itemName || o.itemName.indexOf(itemName) !== -1) &&
        o.status === 'ACTIVE') {
        o.status = 'CANCELLED';
        count++;
      }
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
    var rGroupId = String(r[colMap.groupId]);
    var rDate = String(r[colMap.date]);
    var rDayOfWeek = String(r[colMap.dayOfWeek]);
    var rItem = String(r[colMap.itemName]);

    if (rStatus === 'ACTIVE' &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDayOfWeek === dayOfWeek)) {
      if (!itemName || rItem.indexOf(itemName) !== -1) {
        sheet.getRange(i + 1, colMap.status + 1).setValue('CANCELLED');
        count++;
      }
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
      return (!groupId || o.groupId === groupId) &&
        (!date || o.date === date) &&
        (!dayOfWeek || o.dayOfWeek === dayOfWeek) &&
        o.status === 'ACTIVE';
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
    var rGroupId = String(r[colMap.groupId]);
    var rDate = String(r[colMap.date]);
    var rDay = String(r[colMap.dayOfWeek]);

    if (rStatus === 'ACTIVE' &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDay === dayOfWeek)) {
      orders.push({
        orderId: r[colMap.orderId],
        timestamp: r[colMap.timestamp],
        date: rDate,
        dayOfWeek: rDay,
        groupId: rGroupId,
        userId: r[colMap.userId],
        userName: r[colMap.userName],
        userNickname: colMap.userNickname !== -1 ? r[colMap.userNickname] : (r[colMap.userName] || ''),
        itemName: r[colMap.itemName],
        quantity: Number(r[colMap.quantity]),
        price: Number(r[colMap.price]),
        subtotal: Number(r[colMap.subtotal]),
        status: rStatus,
        paid: r[colMap.paid]
      });
    }
  }
  return orders;
}

/**
 * Calculate single-day summary
 */
function getOrderSummary(groupId, date, dayOfWeek) {
  var orders = getGroupOrders(groupId, date, dayOfWeek);
  var itemMap = {};
  var userMap = {};
  var totalQuantity = 0;
  var totalAmount = 0;

  orders.forEach(function (o) {
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
    itemMap[o.itemName].buyers.push(o.userName + (o.quantity > 1 ? 'x' + o.quantity : ''));

    if (!userMap[o.userName]) {
      userMap[o.userName] = {
        userName: o.userName,
        items: [],
        total: 0
      };
    }
    userMap[o.userName].items.push(o.itemName + 'x' + o.quantity);
    userMap[o.userName].total += o.subtotal;

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
      itemMap[o.itemName].buyers.push(o.userName + (o.quantity > 1 ? 'x' + o.quantity : ''));

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
      userWeeklyMap[o.userName].days[day].push(o.itemName + 'x' + o.quantity);
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
      .addItem('🍔 從 Uber Eats 網址匯入菜單', 'showUberEatsImportDialog')
      .addSeparator()
      .addItem('🔍 診斷測試：Uber Eats 菜單抓取', 'testUberEatsImport')
      .addItem('🔍 診斷測試：LINE 連線狀態', 'testLineConnection')
      .addItem('🔍 診斷測試：幫助卡片訊息', 'testHelpMessage')
      .addToUi();
  } catch (e) {}
}

/**
 * Log diagnostic events directly into a 'Logs' sheet tab in Google Sheets
 */
function logToSheet(type, message, detail) {
  if (!isGasRuntime()) return;
  try {
    var ss = getSpreadsheet();
    if (!ss) return;
    var logSheet = ss.getSheetByName('Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs');
      logSheet.appendRow(['Timestamp', 'Type', 'Message', 'Detail']);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EFEFEF');
    }
    var detailStr = '';
    if (typeof detail === 'object') {
      try { detailStr = JSON.stringify(detail); } catch (e) { detailStr = String(detail); }
    } else if (detail !== undefined && detail !== null) {
      detailStr = String(detail);
    }
    logSheet.appendRow([new Date().toISOString(), type || 'INFO', message || '', detailStr]);
  } catch (e) {}
}

// Dual export
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.isGasRuntime = isGasRuntime;
  g.getSpreadsheet = getSpreadsheet;
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
  g.findUserInGroup = findUserInGroup;
  g.logToSheet = logToSheet;
  g._getOrderColumnIndexes = _getOrderColumnIndexes;
  g._mockStore = _mockStore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isGasRuntime: isGasRuntime,
      getSpreadsheet: getSpreadsheet,
      initSheets: initSheets,
      getConfigValue: getConfigValue,
      setConfigValue: setConfigValue,
      getWeeklySchedule: getWeeklySchedule,
      getScheduleByDay: getScheduleByDay,
      setWeeklyScheduleDay: setWeeklyScheduleDay,
      getMenuItems: getMenuItems,
      saveMenuItems: saveMenuItems,
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
      logToSheet: logToSheet,
      _getOrderColumnIndexes: _getOrderColumnIndexes,
      _mockStore: _mockStore
    };
  }
})();
