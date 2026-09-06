/**
 * LINE Meal Ordering Bot for Google Apps Script (All-In-One Bundle)
 * Automatically generated on: 2026-09-06T09:35:33.321Z
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this entire content into Code.gs
 * 3. Set Project Settings -> Script Properties (CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET)
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */


/* =========================================================
 * File: Config.js
 * ========================================================= */

/**
 * Config.js - Central configuration for LINE Meal Ordering Bot
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 */

var CONFIG = {
  /** LINE Messaging API — Reply to a user's message */
  LINE_REPLY_URL: 'https://api.line.me/v2/bot/message/reply',

  /** LINE Messaging API — Push a message to a user or group */
  LINE_PUSH_URL: 'https://api.line.me/v2/bot/message/push',

  /** LINE Messaging API — Fetch a user's profile (displayName, pictureUrl) */
  LINE_PROFILE_URL: 'https://api.line.me/v2/bot/profile',

  /** LINE Messaging API — Group management (member profile) */
  LINE_GROUP_MEMBER_URL: 'https://api.line.me/v2/bot/group',

  /**
   * Spreadsheet tab names used by the bot's data layer.
   * Each key maps to the literal tab name in the Google Sheet.
   */
  SHEET_NAMES: {
    CONFIG: 'Config',
    WEEKLY_SCHEDULE: 'WeeklySchedule',
    MENU: 'Menu',
    ORDERS: 'Orders',
    SUMMARY: 'Summary'
  },

  /**
   * Mon to Fri days of week in Chinese
   */
  DAYS_OF_WEEK: ['週一', '週二', '週三', '週四', '週五'],

  /**
   * Order lifecycle status values.
   * OPEN   — Accepting new items (before cutoff)
   * CLOSED — No further changes (after cutoff / summary locked)
   */
  ORDER_STATUS: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
  },

  /**
   * Default daily cutoff time (24-hour clock)
   */
  DEFAULT_CUTOFF_HOUR: 11,
  DEFAULT_CUTOFF_MINUTE: 0
};

/**
 * getConfigProperty — Dynamic property lookup with fallback chain:
 * 1. PropertiesService (GAS)
 * 2. process.env (Node.js)
 * 3. defaultValue
 */
function getConfigProperty(key, defaultValue) {
  // 1. Google Apps Script — PropertiesService
  try {
    if (typeof PropertiesService !== 'undefined') {
      var props = PropertiesService.getScriptProperties();
      var val = props.getProperty(key);
      if (val !== '' && val !== null && val !== undefined) {
        return val;
      }
    }
  } catch (e) {
    // Non-GAS runtime
  }

  // 2. Node.js — process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      var envVal = process.env[key];
      if (envVal !== undefined && envVal !== '') {
        return envVal;
      }
    }
  } catch (e) {
    // process global unavailable
  }

  // 3. Fallback
  return defaultValue;
}

// Dual-Environment Export (GAS + Node.js)
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.CONFIG = CONFIG;
  g.getConfigProperty = getConfigProperty;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CONFIG: CONFIG,
      getConfigProperty: getConfigProperty
    };
  }
})();


/* =========================================================
 * File: LineService.js
 * ========================================================= */

/**
 * LineService.js - LINE Messaging API service layer
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 *
 * Public API:
 *   - replyMessages(replyToken, messages)
 *   - replyText(replyToken, text)
 *   - replyFlex(replyToken, altText, flexContents)
 *   - getUserProfile(userId, groupId)
 *   - validateSignature(bodyString, signature, channelSecret)
 */

/* ------------------------------------------------------------------ *
 * Bootstrap — resolve CONFIG and getConfigProperty across
 * runtimes (GAS globals vs. Node.js sibling module).
 * ------------------------------------------------------------------ */
if (typeof CONFIG === 'undefined') {
  var CONFIG = null;
}
if (typeof getConfigProperty === 'undefined') {
  var getConfigProperty = null;
}
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : null;

  // 1. Globals (GAS concatenated bundle, or Node after Config.js loaded).
  if (g) {
    if (g.CONFIG) CONFIG = g.CONFIG;
    if (typeof g.getConfigProperty === 'function') getConfigProperty = g.getConfigProperty;
  }

  // 2. Node.js — load from sibling module.
  if (!CONFIG || !getConfigProperty) {
    try {
      var cfgModule = require('./Config.js');
      if (!CONFIG) CONFIG = cfgModule.CONFIG;
      if (!getConfigProperty) getConfigProperty = cfgModule.getConfigProperty;
    } catch (e) {
      // Neither global nor module available.
    }
  }
})();

/* ------------------------------------------------------------------ *
 * Internal helpers
 * ------------------------------------------------------------------ */

/**
 * _isGasRuntime — Detect whether we're running in Google Apps Script.
 * @returns {boolean}
 */
function _isGasRuntime() {
  try {
    return typeof UrlFetchApp !== 'undefined';
  } catch (e) {
    return false;
  }
}

/**
 * _httpPostJson — POST JSON to url, return { statusCode, data }.
 * GAS: UrlFetchApp.fetch; Node.js: global fetch.
 * @param {string} url
 * @param {Object<string,string>} headers
 * @param {Object} payload
 * @returns {Promise<{statusCode:number, data:Object|null}>}
 */
var _userProfileCache = {};

function _httpPostJson(url, headers, payload) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      contentType: 'application/json',
      muteHttpExceptions: true
    });
    var statusCode = parseInt(response.getResponseCode(), 10);
    var contentText = response.getContentText();
    var data = null;
    try { data = JSON.parse(contentText); } catch (e) { data = null; }

    if (statusCode < 200 || statusCode >= 300) {
      if (typeof console !== 'undefined') {
        console.error('❌ [LINE API Error] HTTP ' + statusCode + ' Response: ' + contentText);
      }
      if (typeof Logger !== 'undefined') {
        Logger.log('❌ [LINE API Error] HTTP ' + statusCode + ' Response: ' + contentText);
      }
      if (typeof logToSheet === 'function') {
        logToSheet('LINE_ERROR', 'HTTP ' + statusCode, contentText);
      }
    } else {
      if (typeof console !== 'undefined') {
        console.log('✅ [LINE API Success] HTTP ' + statusCode);
      }
      if (typeof logToSheet === 'function') {
        logToSheet('LINE_SUCCESS', 'HTTP ' + statusCode, contentText);
      }
    }

    return { statusCode: statusCode, data: data };
  }

  // Node.js
  return fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  }).then(function (nodeResponse) {
    return nodeResponse.json().then(function (nodeData) {
      return { statusCode: nodeResponse.status, data: nodeData };
    }).catch(function () {
      return { statusCode: nodeResponse.status, data: null };
    });
  }).catch(function () {
    return { statusCode: 500, data: null };
  });
}

/**
 * _httpGetJson — GET url, return { statusCode, data }.
 * GAS: UrlFetchApp.fetch (synchronous); Node.js: fetch (Promise).
 * @param {string} url
 * @param {Object<string,string>} headers
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function _httpGetJson(url, headers) {
  if (_isGasRuntime()) {
    try {
      var response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      });
      var statusCode = parseInt(response.getResponseCode(), 10);
      var data = null;
      try { data = JSON.parse(response.getContentText()); } catch (e) { data = null; }
      return { statusCode: statusCode, data: data };
    } catch (e) {
      return { statusCode: 500, data: null };
    }
  }

  // Node.js
  return fetch(url, {
    method: 'GET',
    headers: headers
  }).then(function (nodeResponse) {
    return nodeResponse.json().then(function (nodeData) {
      return { statusCode: nodeResponse.status, data: nodeData };
    }).catch(function () {
      return { statusCode: nodeResponse.status, data: null };
    });
  }).catch(function () {
    return { statusCode: 500, data: null };
  });
}

/**
 * _authHeaders — Build the Authorization header set for LINE API calls.
 * @returns {Object<string,string>}
 */
function _authHeaders() {
  var channelAccessToken = getConfigProperty('CHANNEL_ACCESS_TOKEN', '');
  if (!channelAccessToken) {
    if (typeof console !== 'undefined') {
      console.error('⚠️ [LINE Error] CHANNEL_ACCESS_TOKEN is missing or empty in Script Properties!');
    }
    if (typeof Logger !== 'undefined') {
      Logger.log('⚠️ [LINE Error] CHANNEL_ACCESS_TOKEN is missing or empty in Script Properties!');
    }
  }
  return {
    'Authorization': 'Bearer ' + channelAccessToken,
    'Content-Type': 'application/json'
  };
}

/* ------------------------------------------------------------------ *
 * Public API — Reply messages
 * ------------------------------------------------------------------ */

/**
 * replyMessages — Send a reply message to LINE via the Reply API.
 * @param {string} replyToken - Reply token from the webhook event.
 * @param {Array<Object>} messages - Array of LINE message objects (text/flex/image/...).
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function replyMessages(replyToken, messages) {
  var headers = _authHeaders();
  var payload = {
    replyToken: replyToken,
    messages: messages
  };
  return _httpPostJson(CONFIG.LINE_REPLY_URL, headers, payload);
}

/**
 * replyText — Reply with a plain text message.
 * @param {string} replyToken - Reply token from the webhook event.
 * @param {string} text - Text content to send.
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function replyText(replyToken, text) {
  return replyMessages(replyToken, [{
    type: 'text',
    text: text
  }]);
}

/**
 * replyFlex — Reply with a Flex message.
 * @param {string} replyToken - Reply token from the webhook event.
 * @param {string} altText - Alternative text shown on unsupported clients.
 * @param {Object} flexContents - Flex message contents object (type: bubble/carousel).
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function replyFlex(replyToken, altText, flexContents) {
  return replyMessages(replyToken, [{
    type: 'flex',
    altText: altText,
    contents: flexContents
  }]);
}

/**
 * pushMessages — Send a push message to a user or group.
 * @param {string} to - LINE User ID or Group ID.
 * @param {Array<Object>} messages - Array of LINE message objects.
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function pushMessages(to, messages) {
  if (!to) return null;
  if (typeof globalThis !== 'undefined') {
    globalThis._lastPush = { to: to, messages: messages };
  }
  var headers = _authHeaders();
  var payload = {
    to: to,
    messages: messages
  };
  var pushUrl = (CONFIG && CONFIG.LINE_PUSH_URL) ? CONFIG.LINE_PUSH_URL : 'https://api.line.me/v2/bot/message/push';
  return _httpPostJson(pushUrl, headers, payload);
}

/**
 * pushText — Send a plain text push message to a user or group.
 * @param {string} to - LINE User ID or Group ID.
 * @param {string} text - Text content to send.
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function pushText(to, text) {
  return pushMessages(to, [{
    type: 'text',
    text: text
  }]);
}

/* ------------------------------------------------------------------ *
 * Public API — User profile
 * ------------------------------------------------------------------ */

/**
 * getUserProfile — Fetch a user's LINE profile (displayName, pictureUrl).
 * Supports group member, room member, and 1-on-1 profile endpoints.
 * Synchronous in Google Apps Script; returns Promise in Node.js.
 * @param {string} userId - LINE user ID.
 * @param {string} [groupId] - LINE group ID / room ID.
 * @returns {Object|Promise<{displayName:string, pictureUrl:string, userId:string}>}
 */
function getUserProfile(userId, groupId) {
  if (!userId) {
    return { displayName: '成員', pictureUrl: '', userId: '' };
  }

  var cacheKey = (groupId || 'direct') + ':' + userId;
  if (_userProfileCache[cacheKey]) {
    return _userProfileCache[cacheKey];
  }

  if (typeof globalThis !== 'undefined' && globalThis._mockProfiles && globalThis._mockProfiles[userId]) {
    return globalThis._mockProfiles[userId];
  }

  var headers = _authHeaders();
  var urls = [];
  if (groupId) {
    if (groupId.charAt(0) === 'R') {
      urls.push('https://api.line.me/v2/bot/room/' + groupId + '/member/' + userId);
    } else {
      urls.push(CONFIG.LINE_GROUP_MEMBER_URL + '/' + groupId + '/member/' + userId);
    }
  }
  urls.push(CONFIG.LINE_PROFILE_URL + '/' + userId);

  if (_isGasRuntime()) {
    for (var i = 0; i < urls.length; i++) {
      var result = _httpGetJson(urls[i], headers);
      if (result && result.statusCode >= 200 && result.statusCode < 300 && result.data && result.data.displayName) {
        var profile = {
          displayName: result.data.displayName,
          pictureUrl: result.data.pictureUrl || '',
          userId: userId
        };
        _userProfileCache[cacheKey] = profile;
        if (typeof Logger !== 'undefined') {
          Logger.log('✔ [LINE] 成功取得使用者名稱: ' + profile.displayName + ' (userId: ' + userId + ')');
        }
        return profile;
      }
    }
    if (typeof Logger !== 'undefined') {
      Logger.log('⚠️ [LINE] 無法從 API 取得用戶暱稱，降級使用「成員」');
    }
    return { displayName: '成員', pictureUrl: '', userId: userId };
  }

  // Node.js runtime
  var index = 0;
  function tryNext() {
    if (index >= urls.length) {
      return Promise.resolve({ displayName: '成員', pictureUrl: '', userId: userId });
    }
    var u = urls[index++];
    return _httpGetJson(u, headers).then(function (res) {
      if (res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.displayName) {
        var p = {
          displayName: res.data.displayName,
          pictureUrl: res.data.pictureUrl || '',
          userId: userId
        };
        _userProfileCache[cacheKey] = p;
        return p;
      }
      return tryNext();
    }).catch(function () {
      return tryNext();
    });
  }

  return tryNext();
}

/* ------------------------------------------------------------------ *
 * Public API — Webhook signature validation
 * ------------------------------------------------------------------ */

/**
 * validateSignature — Verify the X-Line-Signature header against the raw body.
 * GAS: Utilities.computeHmacSha256Signature (base64 comparison).
 * Node.js: crypto.createHmac('sha256', channelSecret) (timing-safe base64 comparison).
 * @param {string} bodyString - Raw request body string (exactly as received).
 * @param {string} signature - Signature from the X-Line-Signature header (base64).
 * @param {string} channelSecret - LINE channel secret.
 * @returns {boolean} True when the signature is valid.
 */
function validateSignature(bodyString, signature, channelSecret) {
  if (!channelSecret || !signature) {
    return false;
  }

  // 1. Google Apps Script — Utilities.computeHmacSha256Signature (base64).
  try {
    if (typeof Utilities !== 'undefined' &&
        typeof Utilities.computeHmacSha256Signature === 'function') {
      var gasExpected = Utilities.computeHmacSha256Signature(bodyString, channelSecret, 'UTF-8');
      return gasExpected === signature;
    }
  } catch (e) {
    // Fall through to the Node.js path.
  }

  // 2. Node.js — crypto module (createHmac).
  var nodeCrypto = null;
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.createHmac === 'function') {
      nodeCrypto = crypto;
    }
  } catch (e) {
    nodeCrypto = null;
  }
  if (!nodeCrypto) {
    try {
      nodeCrypto = require('crypto');
    } catch (e) {
      nodeCrypto = null;
    }
  }
  if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
    var nodeExpected = nodeCrypto
      .createHmac('sha256', channelSecret)
      .update(bodyString, 'utf8')
      .digest('base64');
    var sigBuf = Buffer.from(signature, 'utf8');
    var expBuf = Buffer.from(nodeExpected, 'utf8');
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    if (typeof nodeCrypto.timingSafeEqual === 'function') {
      return nodeCrypto.timingSafeEqual(sigBuf, expBuf);
    }
    return nodeExpected === signature;
  }

  // Neither runtime primitive available.
  return false;
}

/* ------------------------------------------------------------------ *
 * Dual-Environment Export (GAS + Node.js)
 * ------------------------------------------------------------------ */
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.replyMessages = replyMessages;
  g.replyText = replyText;
  g.replyFlex = replyFlex;
  g.pushMessages = pushMessages;
  g.pushText = pushText;
  g.getUserProfile = getUserProfile;
  g.validateSignature = validateSignature;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      replyMessages: replyMessages,
      replyText: replyText,
      replyFlex: replyFlex,
      pushMessages: pushMessages,
      pushText: pushText,
      getUserProfile: getUserProfile,
      validateSignature: validateSignature,
      // Internal helpers exposed for Node.js testing.
      _httpPostJson: _httpPostJson,
      _httpGetJson: _httpGetJson,
      _isGasRuntime: _isGasRuntime
    };
  }
})();


/* =========================================================
 * File: SheetService.js
 * ========================================================= */

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
  if (!isGasRuntime()) {
    return _mockStore.Config[key] !== undefined ? _mockStore.Config[key] : defaultValue;
  }
  var ss = getSpreadsheet();
  if (!ss) return defaultValue;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
  if (!sheet) return defaultValue;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      return String(data[i][1]);
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
    if (h === 'orderid') colMap.orderId = c;
    else if (h === 'timestamp') colMap.timestamp = c;
    else if (h === 'date') colMap.date = c;
    else if (h === 'dayofweek') colMap.dayOfWeek = c;
    else if (h === 'groupid') colMap.groupId = c;
    else if (h === 'userid') colMap.userId = c;
    else if (h === 'username') colMap.userName = c;
    else if (h === 'usernickname') colMap.userNickname = c;
    else if (h === 'itemname') colMap.itemName = c;
    else if (h === 'quantity') colMap.quantity = c;
    else if (h === 'price') colMap.price = c;
    else if (h === 'subtotal') colMap.subtotal = c;
    else if (h === 'status') colMap.status = c;
    else if (h === 'paid') colMap.paid = c;
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
 */
function getUserOrders(userId, groupId, date, dayOfWeek) {
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      return o.userId === userId &&
        (!groupId || o.groupId === groupId) &&
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
    var rUserId = String(r[colMap.userId]);
    var rGroupId = String(r[colMap.groupId]);
    var rDate = String(r[colMap.date]);
    var rDayOfWeek = String(r[colMap.dayOfWeek]);

    if (rStatus === 'ACTIVE' && rUserId === userId &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDayOfWeek === dayOfWeek)) {
      orders.push({
        row: i + 1,
        orderId: r[colMap.orderId],
        timestamp: r[colMap.timestamp],
        date: rDate,
        dayOfWeek: rDayOfWeek,
        groupId: rGroupId,
        userId: rUserId,
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
 * Cancel orders for a user
 */
function cancelOrder(userId, groupId, itemName, date, dayOfWeek) {
  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.userId === userId &&
        (!groupId || o.groupId === groupId) &&
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
    var rUserId = String(r[colMap.userId]);
    var rGroupId = String(r[colMap.groupId]);
    var rDate = String(r[colMap.date]);
    var rDayOfWeek = String(r[colMap.dayOfWeek]);
    var rItem = String(r[colMap.itemName]);

    if (rStatus === 'ACTIVE' && rUserId === userId &&
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
  g.getGroupOrders = getGroupOrders;
  g.getOrderSummary = getOrderSummary;
  g.getWeeklyOrderSummary = getWeeklyOrderSummary;
  g.getPaymentConfig = getPaymentConfig;
  g.normalizeImageUrl = normalizeImageUrl;
  g.onOpenSpreadsheet = onOpenSpreadsheet;
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


/* =========================================================
 * File: UberEatsService.js
 * ========================================================= */

/**
 * UberEatsService.js - Uber Eats store/menu scraping and parsing service
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 *
 * Public API:
 *   - parseUberEatsUrl(url)
 *   - fetchStoreMenu(storeUuid)
 *   - extractMenuItems(storeData)
 *   - parseRawMenuJson(jsonStr)
 *   - importUberEatsToMenu(url, dayOfWeek, restaurantNameOverride)
 */

/* ------------------------------------------------------------------ *
 * Bootstrap — resolve CONFIG across runtimes
 * ------------------------------------------------------------------ */
if (typeof CONFIG === 'undefined') {
  var CONFIG = null;
}
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : null;

  if (g && g.CONFIG) {
    CONFIG = g.CONFIG;
  }
  if (!CONFIG) {
    try {
      var cfgModule = require('./Config.js');
      CONFIG = cfgModule.CONFIG;
    } catch (e) {}
  }
})();

/**
 * Detect whether we're running in Google Apps Script.
 */
function _isGasRuntime() {
  try {
    return typeof UrlFetchApp !== 'undefined';
  } catch (e) {
    return false;
  }
}

/**
 * Convert URL-safe Base64 UUID (22 chars) to standard canonical 36-char hyphenated UUID.
 * e.g., 'xDKpVlsqTdmXKiJsQdkf_g' -> 'c432a956-5b2a-4dd9-972a-226c41d91ffe'
 * e.g., 'kRJsM5CqSrCohWhzSS_y-w' -> '91126c33-90aa-4ab0-a885-6873492ff2fb'
 */
function base64ToUuid(b64) {
  if (!b64 || typeof b64 !== 'string') return '';
  b64 = b64.trim();
  // Standard UUID format (36 chars)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b64)) {
    return b64.toLowerCase();
  }
  // Hex UUID without hyphens (32 chars)
  if (/^[0-9a-f]{32}$/i.test(b64)) {
    var h = b64.toLowerCase();
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
  }

  // URL-safe Base64 string
  var base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = [];
  for (var i = 0; i < base64.length; i += 4) {
    var c1 = chars.indexOf(base64.charAt(i));
    var c2 = chars.indexOf(base64.charAt(i + 1));
    var c3 = chars.indexOf(base64.charAt(i + 2));
    var c4 = chars.indexOf(base64.charAt(i + 3));

    if (c1 === -1 || c2 === -1) break;
    var b1 = (c1 << 2) | (c2 >> 4);
    bytes.push(b1);

    if (c3 !== -1 && base64.charAt(i + 2) !== '=') {
      var b2 = ((c2 & 15) << 4) | (c3 >> 2);
      bytes.push(b2);
      if (c4 !== -1 && base64.charAt(i + 3) !== '=') {
        var b3 = ((c3 & 3) << 6) | c4;
        bytes.push(b3);
      }
    }
  }

  if (bytes.length !== 16) {
    return b64;
  }

  var hex = '';
  for (var j = 0; j < bytes.length; j++) {
    var byteHex = bytes[j].toString(16);
    if (byteHex.length < 2) byteHex = '0' + byteHex;
    hex += byteHex;
  }

  return hex.slice(0, 8) + '-' +
         hex.slice(8, 12) + '-' +
         hex.slice(12, 16) + '-' +
         hex.slice(16, 20) + '-' +
         hex.slice(20, 32);
}

/**
 * HTTP POST helper with dual-environment support.
 * Synchronous in Google Apps Script (UrlFetchApp), Promise-based in Node.js.
 */
function _httpPostJson(url, headers, payload) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      contentType: 'application/json',
      muteHttpExceptions: true
    });
    var statusCode = parseInt(response.getResponseCode(), 10);
    var contentText = response.getContentText();
    var data = null;
    try { data = JSON.parse(contentText); } catch (e) { data = null; }
    return { statusCode: statusCode, data: data, rawText: contentText };
  }

  // Node.js
  return fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  }).then(function (nodeResponse) {
    return nodeResponse.text().then(function (nodeText) {
      var nodeData = null;
      try { nodeData = JSON.parse(nodeText); } catch (e) { nodeData = null; }
      return { statusCode: nodeResponse.status, data: nodeData, rawText: nodeText };
    });
  });
}

/**
 * Clean strings
 */
function _cleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert price (TWD in cents -> dollars, or regular dollars)
 */
function _convertPrice(rawPrice, currency) {
  var num = parseFloat(rawPrice);
  if (isNaN(num)) return 0;
  // If price is in cents (e.g. 12000 = NT$120, 3000 = NT$30)
  // Check that currency is TWD/default, value is >= 1000 and is an even multiple of 100
  var isTwd = !currency || currency === 'TWD';
  if (isTwd && num >= 1000 && num % 100 === 0) {
    return Math.round(num / 100);
  }
  return Math.round(num);
}

/**
 * Mock data for offline testing
 */
function _mockStoreData() {
  return {
    store: {
      name: '福山排骨便當專賣',
      uuid: 'mock-uuid-000'
    },
    catalogSectionsMap: {
      'section-1': {
        title: '主食便當',
        items: [
          {
            name: '招牌排骨飯',
            price: 12000,
            description: '厚切香酥排骨附三樣當季配菜',
            isAvailable: true
          },
          {
            name: '酥炸雞腿飯',
            price: 13000,
            description: '黃金酥脆大雞腿',
            isAvailable: true
          }
        ]
      },
      'section-2': {
        title: '冷熱飲品',
        items: [
          {
            name: '古早味冰紅茶',
            price: 3000,
            description: '天然決明子古早味紅茶',
            isAvailable: true
          }
        ]
      }
    },
    currency: 'TWD'
  };
}

/**
 * Decode URL slug to readable store name
 */
function _decodeSlug(slug) {
  if (!slug) return '';
  var decoded = '';
  try {
    decoded = decodeURIComponent(slug);
  } catch (e) {
    decoded = slug;
  }
  // If slug contains hyphens and is ASCII, format with spaces
  if (/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return decoded.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  }
  return decoded.replace(/[-_]+/g, ' ').trim();
}

/**
 * parseUberEatsUrl — Extract store name and UUID
 * Supports:
 *   https://www.ubereats.com/tw/store/store-name/uuid
 *   https://www.ubereats.com/store/store-name/uuid
 *   ubereats.com/tw/store/store-name/uuid?...
 */
function parseUberEatsUrl(url) {
  if (!url) return null;

  var match = url.match(/ubereats\.com\/(?:[a-zA-Z-]+\/)?store\/([^/?#]+)\/([a-zA-Z0-9_-]+)/i);
  if (match) {
    var storeName = _decodeSlug(match[1]);
    var storeUuid = match[2];
    var standardUuid = base64ToUuid(storeUuid);
    return {
      storeName: storeName,
      storeUuid: storeUuid,
      standardUuid: standardUuid,
      rawUuid: storeUuid
    };
  }

  return null;
}

/**
 * fetchStoreMenu — Fetch store menu from Uber Eats internal getStoreV1 API.
 * Supports both standard 36-char UUID and 22-char URL slug Base64 UUID.
 * Synchronous in Google Apps Script; returns Promise in Node.js.
 */
function fetchStoreMenu(storeUuid) {
  if (!storeUuid) {
    return _mockStoreData();
  }

  var standardUuid = base64ToUuid(storeUuid) || storeUuid;
  var apiUrl = 'https://www.ubereats.com/_p/api/getStoreV1';
  var headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': 'x',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  };
  var payload = {
    storeUuid: standardUuid,
    diningMode: 'DELIVERY'
  };

  function parseResult(res) {
    if (res && res.statusCode >= 200 && res.statusCode < 300 && res.data) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('✔ [UberEats] API 請求成功 (HTTP ' + res.statusCode + ')');
        if (res.data.data && res.data.data.title) {
          Logger.log('✔ [UberEats] 店家名稱: ' + res.data.data.title);
        }
      }
      return res.data;
    }
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('⚠️ [UberEats] API 請求失敗，HTTP 狀態碼: ' + (res ? res.statusCode : '未知'));
      if (res && res.rawText) {
        Logger.log('⚠️ [UberEats] 回應內文前 200 字: ' + res.rawText.slice(0, 200));
      }
    }
    return null;
  }

  var resOrPromise = _httpPostJson(apiUrl, headers, payload);
  if (resOrPromise && typeof resOrPromise.then === 'function') {
    return resOrPromise.then(parseResult).catch(function (err) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('❌ [UberEats] 網路請求異常: ' + (err ? err.message : err));
      }
      return null;
    });
  }

  return parseResult(resOrPromise);
}

/**
 * Normalize section structures from Uber Eats API
 */
function _collectSections(storeData) {
  var result = [];
  var root = (storeData && storeData.data) ? storeData.data : storeData;
  if (!root) return result;

  // 1. catalogSectionsMap (may contain array of sections per key)
  if (root.catalogSectionsMap && typeof root.catalogSectionsMap === 'object') {
    var keys = Object.keys(root.catalogSectionsMap);
    for (var i = 0; i < keys.length; i++) {
      var sec = root.catalogSectionsMap[keys[i]];
      if (Array.isArray(sec)) {
        for (var k = 0; k < sec.length; k++) {
          if (sec[k]) result.push(sec[k]);
        }
      } else if (sec) {
        result.push(sec);
      }
    }
  }

  // 2. sectionEntitiesMap
  if (result.length === 0 && root.sectionEntitiesMap && typeof root.sectionEntitiesMap === 'object') {
    var entKeys = Object.keys(root.sectionEntitiesMap);
    for (var j = 0; j < entKeys.length; j++) {
      var ent = root.sectionEntitiesMap[entKeys[j]];
      if (Array.isArray(ent)) {
        for (var ek = 0; ek < ent.length; ek++) {
          if (ent[ek]) result.push(ent[ek]);
        }
      } else if (ent) {
        result.push(ent);
      }
    }
  }

  // 3. sections array
  if (result.length === 0 && Array.isArray(root.sections)) {
    result = root.sections;
  }

  return result;
}

/**
 * extractMenuItems — Extract deduplicated menu items with prices and categories
 */
function extractMenuItems(storeData) {
  if (!storeData) return [];

  var sections = _collectSections(storeData);
  var currency = (storeData.data && (storeData.data.currencyCode || storeData.data.currency)) || storeData.currency || 'TWD';
  var seen = {};
  var items = [];

  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var categoryTitle = '一般餐點';

    // Check payload.standardItemsPayload
    var rawItems = [];
    if (sec.payload && sec.payload.standardItemsPayload) {
      if (sec.payload.standardItemsPayload.title && sec.payload.standardItemsPayload.title.text) {
        categoryTitle = sec.payload.standardItemsPayload.title.text;
      }
      rawItems = sec.payload.standardItemsPayload.catalogItems || [];
    } else {
      categoryTitle = sec.title || sec.name || '一般餐點';
      rawItems = sec.items || sec.products || sec.catalogItems || [];
    }

    categoryTitle = _cleanString(categoryTitle);

    for (var j = 0; j < rawItems.length; j++) {
      var raw = rawItems[j];
      var itemName = _cleanString(raw.title || raw.name || raw.itemName || '');
      if (!itemName) continue;

      var dedupeKey = categoryTitle + '|' + itemName;
      if (seen[dedupeKey]) continue;
      seen[dedupeKey] = true;

      var rawPrice = raw.price !== undefined ? raw.price
                   : raw.amount !== undefined ? raw.amount
                   : 0;
      var convertedPrice = _convertPrice(rawPrice, currency);
      var description = _cleanString(raw.itemDescription || raw.description || raw.desc || '');
      var isAvailable = raw.isAvailable !== undefined ? !!raw.isAvailable
                     : raw.available !== undefined ? !!raw.available
                     : true;

      items.push({
        category: categoryTitle,
        itemName: itemName,
        price: convertedPrice,
        description: description,
        isAvailable: isAvailable
      });
    }
  }

  return items;
}

/**
 * Parse raw JSON string pasted by user/admin
 */
function parseRawMenuJson(jsonStr) {
  if (!jsonStr) return [];
  try {
    var parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return extractMenuItems({ catalogSectionsMap: { sec: { title: '菜單', items: parsed } } });
    }
    return extractMenuItems(parsed);
  } catch (e) {
    return [];
  }
}

/**
 * High-level orchestration function to import from Uber Eats
 */
function importUberEatsToMenu(url, dayOfWeek, restaurantNameOverride) {
  var parsed = parseUberEatsUrl(url);
  var storeUuid = parsed ? (parsed.standardUuid || parsed.storeUuid) : '';
  var storeName = restaurantNameOverride || (parsed ? parsed.storeName : 'UberEats外送');

  function finishImport(storeData) {
    var items = extractMenuItems(storeData);
    return {
      restaurantName: storeName,
      dayOfWeek: dayOfWeek || '週一',
      url: url,
      itemsCount: items.length,
      items: items
    };
  }

  var storeDataOrPromise = fetchStoreMenu(storeUuid);
  if (storeDataOrPromise && typeof storeDataOrPromise.then === 'function') {
    return storeDataOrPromise.then(finishImport);
  }

  return finishImport(storeDataOrPromise);
}

// Dual export
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.base64ToUuid = base64ToUuid;
  g.parseUberEatsUrl = parseUberEatsUrl;
  g.fetchStoreMenu = fetchStoreMenu;
  g.extractMenuItems = extractMenuItems;
  g.parseRawMenuJson = parseRawMenuJson;
  g.importUberEatsToMenu = importUberEatsToMenu;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      base64ToUuid: base64ToUuid,
      parseUberEatsUrl: parseUberEatsUrl,
      fetchStoreMenu: fetchStoreMenu,
      extractMenuItems: extractMenuItems,
      parseRawMenuJson: parseRawMenuJson,
      importUberEatsToMenu: importUberEatsToMenu,
      _cleanString: _cleanString,
      _convertPrice: _convertPrice,
      _decodeSlug: _decodeSlug,
      _mockStoreData: _mockStoreData
    };
  }
})();


/* =========================================================
 * File: FlexMessage.js
 * ========================================================= */

/**
 * FlexMessage.js - LINE Flex Message template builders for Meal Ordering Bot
 * Compatible with Google Apps Script (GAS) and Node.js
 */

var FLEX_COLORS = {
  primary: '#1DB446',
  primaryDark: '#158C36',
  surface: '#FFFFFF',
  background: '#F7F8FA',
  border: '#E2E8F0',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textOnColor: '#FFFFFF',
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#EF4444'
};

/* ------------------------------------------------------------------ *
 * Internal helpers — Flex component builders
 * ------------------------------------------------------------------ */

/**
 * _flexText — Build a LINE Flex text component.
 * @param {string} text - Display text.
 * @param {Object} [opts] - Optional overrides (color, size, weight, align, margin, lineHeight, decoration, wrap).
 * @returns {Object}
 */
function _flexText(text, opts) {
  var o = opts || {};
  var txt = {
    type: 'text',
    text: String(text !== undefined && text !== null ? text : '')
  };
  if (o.color) txt.color = o.color;
  if (o.size) txt.size = o.size;
  if (o.weight) txt.weight = o.weight;
  if (o.align) txt.align = o.align;
  if (o.wrap !== undefined) txt.wrap = o.wrap;
  if (o.margin && o.margin !== 'none') txt.margin = o.margin;
  if (o.flex !== undefined) txt.flex = o.flex;
  return txt;
}

/**
 * _flexBox — Build a LINE Flex box (container) component.
 * Strictly outputs only valid LINE Flex Box properties.
 */
function _flexBox(contents, opts) {
  var o = opts || {};
  var box = {
    type: 'box',
    layout: o.layout || 'vertical',
    contents: contents || []
  };
  if (o.spacing && o.spacing !== 'none') box.spacing = o.spacing;
  if (o.margin && o.margin !== 'none') box.margin = o.margin;
  if (o.paddingAll) box.paddingAll = o.paddingAll;
  else if (o.padding && o.padding !== 'none') box.paddingAll = o.padding;
  if (o.backgroundColor && o.backgroundColor !== 'transparent') box.backgroundColor = o.backgroundColor;
  if (o.cornerRadius && o.cornerRadius !== 'none') box.cornerRadius = o.cornerRadius;
  if (o.borderWidth && o.borderWidth !== '0px' && o.borderWidth !== 'none') box.borderWidth = o.borderWidth;
  if (o.borderColor && o.borderColor !== 'transparent') box.borderColor = o.borderColor;
  if (o.flex !== undefined) box.flex = o.flex;
  if (o.width) box.width = o.width;
  if (o.alignItems) box.alignItems = o.alignItems;
  if (o.justifyContent) box.justifyContent = o.justifyContent;
  return box;
}

/**
 * _flexSeparator — Horizontal divider line.
 * @param {Object} [opts] - Options (color, margin).
 * @returns {Object}
 */
function _flexSeparator(opts) {
  var o = opts || {};
  var sep = { type: 'separator' };
  if (o.color) sep.color = o.color;
  if (o.margin && o.margin !== 'none') sep.margin = o.margin;
  return sep;
}

/**
 * _flexFiller — Elastic spacer that expands to fill remaining space in a horizontal box.
 * @returns {Object}
 */
function _flexFiller() {
  return { type: 'filler' };
}

/**
 * _flexIcon — Small icon image.
 * @param {string} url - Icon image URL.
 * @param {Object} [opts] - Options (size, aspectRatio, align, margin).
 * @returns {Object}
 */
function _flexIcon(url, opts) {
  var o = opts || {};
  return {
    type: 'icon',
    url: url,
    size: o.size || 'xl',
    aspectRatio: o.aspectRatio || '1:1',
    align: o.align || 'start',
    margin: o.margin || 'none'
  };
}

/**
 * _flexButton — Tappable action button.
 * @param {Object} action - LINE action descriptor (postback / message / uri).
 * @param {Object} [opts] - Options (color, style, height, cornerRadius, margin).
 * @returns {Object}
 */
function _flexButton(action, opts) {
  var o = opts || {};
  return {
    type: 'button',
    action: action,
    color: o.color || FLEX_COLORS.primary,
    style: o.style || 'primary',
    height: o.height || 'sm',
    cornerRadius: o.cornerRadius || 'md',
    margin: o.margin || 'none'
  };
}

/**
 * _flexImage — Inline image.
 * @param {string} url - Image URL.
 * @param {Object} [opts] - Options (size, aspectMode, aspectRatio, align, margin, backgroundColor, cornerRadius).
 * @returns {Object}
 */
function _flexImage(url, opts) {
  var o = opts || {};
  return {
    type: 'image',
    url: url,
    size: o.size || 'full',
    aspectMode: o.aspectMode || 'fit',
    aspectRatio: o.aspectRatio || '16:9',
    align: o.align || 'start',
    margin: o.margin || 'none',
    backgroundColor: o.backgroundColor || 'transparent',
    cornerRadius: o.cornerRadius || 'none'
  };
}

/* ------------------------------------------------------------------ *
 * Internal helpers — Data shaping
 * ------------------------------------------------------------------ */

/**
 * _groupMenuByCategory — Partition a flat menu array into an ordered
 * list of { category, items[] } groups, preserving first-seen order.
 * @param {Array<Object>} menuItems - Flat array of menu records.
 * @returns {Array<{category:string, items:Array<Object>}>}
 */
function _groupMenuByCategory(menuItems) {
  var catMap = {};
  var catOrder = [];

  (menuItems || []).forEach(function (item) {
    var cat = item.category || '其他';
    if (!catMap[cat]) {
      catMap[cat] = [];
      catOrder.push(cat);
    }
    catMap[cat].push(item);
  });

  return catOrder.map(function (cat) {
    return { category: cat, items: catMap[cat] };
  });
}

/**
 * _formatPrice — Render a numeric amount as a currency string.
 * @param {number} amount - Numeric price.
 * @returns {string} e.g. "$100" or "$10.50".
 */
function _formatPrice(amount) {
  var n = Number(amount) || 0;
  if (n % 1 === 0) {
    return '$' + n;
  }
  return '$' + n.toFixed(2);
}

/**
 * _calcOrderTotal — Sum subtotals (or qty×price) across an order list.
 * @param {Array<Object>} orders - Array of order records.
 * @returns {number}
 */
function _calcOrderTotal(orders) {
  var total = 0;
  (orders || []).forEach(function (o) {
    if (o.subtotal !== undefined) {
      total += o.subtotal;
    } else {
      total += (o.quantity || 1) * (o.price || 0);
    }
  });
  return total;
}

/* ------------------------------------------------------------------ *
 * Public API — Flex message builders
 * ------------------------------------------------------------------ */

/**
 * createMenuFlex — Build a LINE Flex bubble that displays today's or weekday's menu with order buttons.
 *
 * Layout:
 *   header  – restaurant name + weekday badge + cutoff-time badge
 *   body     – items grouped by category, each item with an interactive '+1 點餐' button
 *   footer   – usage hint
 *
 * @param {string} restaurantName - Display name of the restaurant.
 * @param {string} cutoffTime - Cutoff time string, e.g. "11:00".
 * @param {Array<Object>} menuItems - Flat array of menu records.
 *   Each record shape: { category: string, itemName: string, price: number, isAvailable?: boolean, description?: string }
 * @param {string} [dayOfWeek] - Optional day of week (e.g. "週一", "週二").
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createMenuFlex(restaurantName, cutoffTime, menuItems, dayOfWeek) {
  var groups = _groupMenuByCategory(menuItems);
  var headerTitle = restaurantName || '今日菜單';
  var dayBadge = dayOfWeek ? '【' + dayOfWeek + '】' : '';

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(dayBadge + headerTitle, {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText('⏰ 點餐截止：' + (cutoffTime || '--'), {
      size: 'sm',
      color: FLEX_COLORS.textOnColor,
      align: 'start',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    spacing: 'none',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary,
    cornerRadius: 'lg'
  });

  /* ---- body: category sections ---- */
  var bodyContents = [];
  var totalRendered = 0;
  var MAX_ITEMS_PER_MENU = 35;

  if (groups.length === 0) {
    bodyContents.push(_flexText('（目前此店家尚無菜單項目）', {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'lg'
    }));
  } else {
    groups.forEach(function (group, gi) {
      if (totalRendered >= MAX_ITEMS_PER_MENU) return;

      // Category heading
      bodyContents.push(_flexText('【' + group.category + '】', {
        size: 'md',
        weight: 'bold',
        color: FLEX_COLORS.primaryDark,
        align: 'start',
        margin: gi === 0 ? 'none' : 'md'
      }));

      // Item rows with order buttons
      group.items.forEach(function (item) {
        if (totalRendered >= MAX_ITEMS_PER_MENU) return;
        totalRendered++;

        var name = item.itemName || '';
        var price = _formatPrice(item.price);
        var isAvail = item.isAvailable === undefined || item.isAvailable === true || item.isAvailable === 'TRUE';
        var orderText = (dayOfWeek ? dayOfWeek + ' ' : '') + name + '+1';

        var leftBoxContents = [
          _flexText(name, {
            size: 'sm',
            weight: 'bold',
            color: isAvail ? FLEX_COLORS.textPrimary : FLEX_COLORS.textSecondary,
            wrap: true
          }),
          _flexText(price, {
            size: 'xs',
            color: isAvail ? FLEX_COLORS.primaryDark : FLEX_COLORS.textSecondary,
            weight: 'bold',
            margin: 'xs'
          })
        ];

        if (item.description) {
          leftBoxContents.push(_flexText(item.description, {
            size: 'xxs',
            color: FLEX_COLORS.textSecondary,
            wrap: true,
            margin: 'xs'
          }));
        }

        var actionButton;
        if (isAvail) {
          actionButton = {
            type: 'button',
            action: {
              type: 'message',
              label: '+1 點餐',
              text: orderText
            },
            style: 'primary',
            color: FLEX_COLORS.primary,
            height: 'sm',
            flex: 2
          };
        } else {
          actionButton = {
            type: 'button',
            action: {
              type: 'message',
              label: '已售完',
              text: (dayOfWeek ? dayOfWeek + ' ' : '') + name + ' 已售完'
            },
            style: 'secondary',
            height: 'sm',
            flex: 2
          };
        }

        bodyContents.push(_flexBox([
          _flexBox(leftBoxContents, {
            layout: 'vertical',
            flex: 4,
            justifyContent: 'center'
          }),
          actionButton
        ], {
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          paddingAll: 'sm',
          margin: 'xs',
          backgroundColor: totalRendered % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
          cornerRadius: 'md'
        }));
      });
    });
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText('💡 點擊「+1 點餐」按鈕即可直接加訂！', {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'center'
    }),
    _flexText('亦可輸入「' + (dayOfWeek ? dayOfWeek + ' ' : '') + '菜名+數量」或「取消 菜名」', {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createOrderReceiptFlex — Confirm that an item was added to the user's order.
 *
 * Layout:
 *   header  – success banner ("加購成功")
 *   body     – user's full order list (highlighting the just-added item) + grand total
 *   footer   – cancel hint
 *
 * @param {string} userName - Display name of the ordering user.
 * @param {Object} addedItem - The single order record that was just added.
 *   Shape: { itemName: string, quantity: number, price: number, subtotal?: number }
 * @param {Array<Object>} userOrders - All active orders for this user (including the newly added one).
 *   Each record shape: { itemName: string, quantity: number, price: number, subtotal?: number }
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createOrderReceiptFlex(userName, addedItem, userOrders, options) {
  var orders = userOrders || [];
  var total = _calcOrderTotal(orders);
  var isWeekly = options && options.isWeekly !== undefined ? !!options.isWeekly : true;

  /* ---- header ---- */
  var header = _flexBox([
    _flexText('✅ 加購成功', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    })
  ], {
    layout: 'vertical',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.success,
    cornerRadius: 'lg'
  });

  /* ---- body ---- */
  var bodyContents = [];

  // User label
  var titleSuffix = isWeekly ? ' 的本週訂單' : ' 的今日訂單';
  bodyContents.push(_flexText((userName || '成員') + titleSuffix, {
    size: 'lg',
    weight: 'bold',
    color: FLEX_COLORS.textPrimary,
    align: 'start'
  }));

  // Separator
  bodyContents.push(_flexSeparator({ margin: 'md' }));

  // Order lines
  if (orders.length === 0) {
    bodyContents.push(_flexText('（尚無項目）', {
      size: 'md',
      color: FLEX_COLORS.textSecondary,
      align: 'start'
    }));
  } else if (isWeekly) {
    // Group orders by weekday for clear weekly view
    var dayMap = {};
    var dayKeys = [];
    orders.forEach(function (o) {
      var d = o.dayOfWeek || '今日';
      if (!dayMap[d]) {
        dayMap[d] = [];
        dayKeys.push(d);
      }
      dayMap[d].push(o);
    });

    dayKeys.forEach(function (day, di) {
      bodyContents.push(_flexText('【' + day + '】', {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.primaryDark,
        align: 'start',
        margin: di === 0 ? 'sm' : 'md'
      }));

      dayMap[day].forEach(function (o) {
        var name = o.itemName || '';
        var qty = o.quantity || 1;
        var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);

        // Highlight the just-added item (matching name and weekday if applicable)
        var isAdded = addedItem && o.itemName === addedItem.itemName &&
          (!addedItem.dayOfWeek || !o.dayOfWeek || o.dayOfWeek === addedItem.dayOfWeek);
        var rowBg = isAdded ? FLEX_COLORS.successBg : 'transparent';

        bodyContents.push(_flexBox([
          _flexText(name + (qty > 1 ? ' x' + qty : ''), {
            size: 'md',
            color: FLEX_COLORS.textPrimary,
            align: 'start',
            weight: isAdded ? 'bold' : 'regular'
          }),
          _flexFiller(),
          _flexText(_formatPrice(sub), {
            size: 'md',
            color: isAdded ? FLEX_COLORS.success : FLEX_COLORS.textSecondary,
            align: 'end',
            weight: isAdded ? 'bold' : 'regular'
          })
        ], {
          layout: 'horizontal',
          spacing: 'sm',
          padding: 'xs',
          backgroundColor: rowBg
        }));
      });
    });
  } else {
    // Daily mode: flat list
    orders.forEach(function (o) {
      var name = o.itemName || '';
      var qty = o.quantity || 1;
      var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);

      var isAdded = addedItem && o.itemName === addedItem.itemName;
      var rowBg = isAdded ? FLEX_COLORS.successBg : 'transparent';

      bodyContents.push(_flexBox([
        _flexText(name + (qty > 1 ? ' x' + qty : ''), {
          size: 'md',
          color: FLEX_COLORS.textPrimary,
          align: 'start',
          weight: isAdded ? 'bold' : 'regular'
        }),
        _flexFiller(),
        _flexText(_formatPrice(sub), {
          size: 'md',
          color: isAdded ? FLEX_COLORS.success : FLEX_COLORS.textSecondary,
          align: 'end',
          weight: isAdded ? 'bold' : 'regular'
        })
      ], {
        layout: 'horizontal',
        spacing: 'sm',
        padding: 'xs',
        backgroundColor: rowBg
      }));
    });
  }

  // Separator before total
  bodyContents.push(_flexSeparator({ margin: 'md' }));

  // Grand total
  var totalLabel = isWeekly ? '本週合計' : '合計';
  bodyContents.push(_flexBox([
    _flexText(totalLabel, {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textPrimary,
      align: 'start'
    }),
    _flexFiller(),
    _flexText(_formatPrice(total), {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.primary,
      align: 'end'
    })
  ], {
    layout: 'horizontal',
    spacing: 'sm',
    padding: 'sm'
  }));

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText('💡 回覆「取消」可開啟選單自選退訂特定餐點', {
      size: 'xs',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    padding: 'md',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * Helper to build payment info flex contents (LINE Pay button + Bank Transfer info)
 * @param {Object} paymentInfo
 * @returns {Array<Object>} Flex component array
 */
function _buildPaymentContents(paymentInfo) {
  if (!paymentInfo || !paymentInfo.hasPaymentInfo) {
    return [];
  }

  var contents = [];
  contents.push(_flexSeparator({ margin: 'md' }));
  contents.push(_flexText('💳 付款方式與匯款資訊', {
    weight: 'bold',
    size: 'sm',
    color: FLEX_COLORS.primaryDark,
    margin: 'md'
  }));

  // Bank transfer block
  if (paymentInfo.bankAccount || paymentInfo.bankCode || paymentInfo.bankQrUrl) {
    var bankTitle = (paymentInfo.bankCode ? paymentInfo.bankCode + ' ' : '') + (paymentInfo.bankName || '銀行跨行匯款');
    var bankRows = [
      _flexText('🏦 ' + bankTitle, {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary
      })
    ];

    if (paymentInfo.bankAccount) {
      bankRows.push(_flexText('帳號：' + paymentInfo.bankAccount, {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary,
        margin: 'xs'
      }));
    }

    if (paymentInfo.bankAccountName) {
      bankRows.push(_flexText('戶名：' + paymentInfo.bankAccountName, {
        size: 'xs',
        color: FLEX_COLORS.textSecondary,
        margin: 'xs'
      }));
    }

    // Bank QR Code image
    if (paymentInfo.bankQrUrl) {
      bankRows.push({
        type: 'image',
        url: paymentInfo.bankQrUrl,
        size: 'md',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        margin: 'sm',
        align: 'center',
        action: {
          type: 'uri',
          label: '放大檢視',
          uri: paymentInfo.bankQrUrl
        }
      });
      bankRows.push(_flexText('🔍 點擊 QR Code 可放大檢視或截圖掃碼轉帳', {
        size: 'xxs',
        color: FLEX_COLORS.textSecondary,
        align: 'center',
        margin: 'xs'
      }));
    }

    bankRows.push(_flexText('💡 轉帳完成後請私訊或於群組告知主揪以利對帳', {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      margin: 'xs'
    }));

    contents.push(_flexBox(bankRows, {
      layout: 'vertical',
      paddingAll: 'sm',
      margin: 'sm',
      backgroundColor: FLEX_COLORS.background,
      cornerRadius: 'md'
    }));
  }

  // LINE Pay button & QR
  if (paymentInfo.linePayUrl || paymentInfo.linePayQrUrl || paymentInfo.isPersonalLinePay) {
    if (paymentInfo.linePayUrl) {
      var buttonLabel = paymentInfo.isPersonalLinePay ? '🟢 開啟 LINE 錢包轉帳' : '🟢 前往 LINE Pay 轉帳';
      contents.push({
        type: 'button',
        action: {
          type: 'uri',
          label: buttonLabel,
          uri: paymentInfo.linePayUrl
        },
        style: 'primary',
        color: '#06C755',
        height: 'sm',
        margin: 'sm'
      });

      if (paymentInfo.isPersonalLinePay) {
        var idHint = paymentInfo.linePayUserId ? ' (LINE ID: ' + paymentInfo.linePayUserId + ')' : '';
        contents.push(_flexText('📱 請於錢包點選「轉帳」並搜尋好友：「' + paymentInfo.linePayRecipientName + '」' + idHint, {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          align: 'center',
          margin: 'xs',
          wrap: true
        }));
      }
    }

    if (paymentInfo.linePayQrUrl) {
      contents.push({
        type: 'image',
        url: paymentInfo.linePayQrUrl,
        size: 'md',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        margin: 'sm',
        align: 'center',
        action: {
          type: 'uri',
          label: 'LINE Pay 收款碼',
          uri: paymentInfo.linePayQrUrl
        }
      });
    }
  }

  return contents;
}

/**
 * createSummaryFlex — Daily aggregated order summary for the organizer.
 *
 * Layout:
 *   header  – restaurant name + date + open/closed status badge
 *   body     – per-item totals (name xQty … $Subtotal) + grand total + payment info + action buttons
 *   footer   – status line
 *
 * @param {string} restaurantName - Restaurant display name.
 * @param {Object} summaryData - Aggregated summary (as returned by getOrderSummary()).
 *   Shape: {
 *     date: string,
 *     totalQuantity: number,
 *     totalAmount: number,
 *     items: Array<{ itemName: string, quantity: number, price: number, subtotal: number, buyers: string[] }>
 *   }
 * @param {boolean} isClosed - True when the ordering window has ended.
 * @param {Object} [paymentInfo] - Optional payment configuration (LINE Pay & Bank Transfer).
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createSummaryFlex(restaurantName, summaryData, isClosed, paymentInfo) {
  var data = summaryData || {};
  var items = data.items || [];
  var totalQty = data.totalQuantity || 0;
  var totalAmt = data.totalAmount || 0;
  var dateStr = data.date || '';

  var statusLabel = isClosed ? '已截止' : '開放中';
  var statusColor = isClosed ? FLEX_COLORS.danger : FLEX_COLORS.success;

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(restaurantName || '訂單統計', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexBox([
      _flexText(dateStr || '', {
        size: 'sm',
        color: FLEX_COLORS.textOnColor,
        align: 'start'
      }),
      _flexFiller(),
      _flexBox([
        _flexText(statusLabel, {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.textOnColor,
          align: 'center'
        })
      ], {
        layout: 'vertical',
        padding: 'xxs',
        backgroundColor: statusColor,
        cornerRadius: 'sm'
      })
    ], {
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    spacing: 'none',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.primaryDark,
    cornerRadius: 'lg'
  });

  /* ---- body ---- */
  var bodyContents = [];

  if (items.length === 0) {
    bodyContents.push(_flexText('（今日尚無訂單）', {
      size: 'md',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    }));
  } else {
    items.forEach(function (item) {
      var name = item.itemName || '';
      var qty = item.quantity || 0;
      var sub = _formatPrice(item.subtotal);

      bodyContents.push(_flexBox([
        _flexText(name + ' x' + qty, {
          size: 'md',
          color: FLEX_COLORS.textPrimary,
          align: 'start'
        }),
        _flexFiller(),
        _flexText(sub, {
          size: 'md',
          color: FLEX_COLORS.textSecondary,
          align: 'end'
        })
      ], {
        layout: 'horizontal',
        spacing: 'sm',
        padding: 'xs'
      }));
    });
  }

  // Grand total
  bodyContents.push(_flexSeparator({ margin: 'md' }));
  bodyContents.push(_flexBox([
    _flexText('總計', {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textPrimary,
      align: 'start'
    }),
    _flexFiller(),
    _flexText(totalQty + ' 項 / ' + _formatPrice(totalAmt), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.primary,
      align: 'end'
    })
  ], {
    layout: 'horizontal',
    spacing: 'sm',
    padding: 'sm'
  }));

  // Append payment contents if available
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var payBoxes = _buildPaymentContents(paymentInfo);
    for (var p = 0; p < payBoxes.length; p++) {
      bodyContents.push(payBoxes[p]);
    }
  }

  // Quick close order button if still open
  if (!isClosed) {
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: '🔒 截止今日訂餐（結單）',
        text: '今日結單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'md'
    });
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footerMsg = isClosed
    ? '⏰ 已截止，請各成員儘速完成付款'
    : '🟢 目前開放點餐中';

  var footer = _flexBox([
    _flexText(footerMsg, {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    padding: 'md',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createHelpFlex — Interactive instruction card with tappable command buttons.
 *
 * Layout:
 *   header  – title banner ("便當點餐使用說明")
 *   body     – list of commands, each with a quick-action button
 *   footer   – usage hint
 *
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createHelpFlex() {
  /* ---- header ---- */
  var header = _flexBox([
    _flexText('📖 便當點餐使用說明', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary
  });

  /* ---- body: buttonized command list ---- */
  var commands = [
    { label: '📅 本週菜單', desc: '查看週一至週五排程', cmd: '本週菜單', btnText: '看本週' },
    { label: '🍱 今日菜單', desc: '查看今日菜單並點餐', cmd: '菜單', btnText: '看菜單' },
    { label: '📝 我的訂單', desc: '查詢個人今日點餐紀錄', cmd: '我的訂單', btnText: '查今日' },
    { label: '📦 我的本週訂單', desc: '查詢本週全梯次預訂', cmd: '我的本週訂單', btnText: '查全週' },
    { label: '🗑️ 取消餐點', desc: '自選退訂特定餐點', cmd: '取消餐點', btnText: '去取消' },
    { label: '📊 本週統計', desc: '全週梯次訂購對帳總表', cmd: '本週統計', btnText: '本週統計' },
    { label: '📈 今日統計', desc: '今日即時訂單統計與名冊', cmd: '統計', btnText: '今日統計' },
    { label: '🔒 結單截止', desc: '截止訂餐並顯示收款資訊', cmd: '結單', btnText: '去結單' }
  ];

  var bodyContents = [];
  commands.forEach(function (cmd, i) {
    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(cmd.label, {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary
        }),
        _flexText(cmd.desc, {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          margin: 'xs'
        })
      ], {
        layout: 'vertical',
        spacing: 'none',
        flex: 3,
        justifyContent: 'center'
      }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: cmd.btnText,
          text: cmd.cmd
        },
        style: 'primary',
        color: FLEX_COLORS.primary,
        height: 'sm',
        flex: 2
      }
    ], {
      layout: 'horizontal',
      alignItems: 'center',
      paddingAll: 'sm',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      cornerRadius: 'md',
      margin: 'xs'
    }));
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText('💡 點擊上方任一按鈕，即可直接發送指令！', {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'mega',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createCancelOrderFlex — Interactive cancel order menu with buttons.
 * Grouped by dayOfWeek so the user can see and tap specific items or days to cancel.
 *
 * @param {string} userName - Display name of the user.
 * @param {Array<Object>} activeOrders - Array of active order records.
 * @returns {Object} LINE Flex bubble
 */
function createCancelOrderFlex(userName, activeOrders, lockMap) {
  var orders = activeOrders || [];
  var locks = lockMap || {};

  var dayMap = {};
  var dayOrder = [];
  orders.forEach(function (o) {
    var d = o.dayOfWeek || '今日';
    if (!dayMap[d]) {
      dayMap[d] = [];
      dayOrder.push(d);
    }
    dayMap[d].push(o);
  });

  var header = _flexBox([
    _flexText('🗑️ 取消訂單選單', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText((userName || '成員') + ' 的進行中訂單', {
      size: 'sm',
      color: FLEX_COLORS.textOnColor,
      align: 'start',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.danger
  });

  var bodyContents = [];
  if (dayOrder.length === 0) {
    bodyContents.push(_flexText('（目前沒有任何進行中的訂餐紀錄）', {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'lg'
    }));
  } else {
    var anyDayUnlocked = false;

    dayOrder.forEach(function (day, di) {
      var dayItems = dayMap[day];
      var dayLock = locks[day];
      var isDayLocked = dayLock && dayLock.locked;
      var lockReason = isDayLocked ? (dayLock.reason || '已截止') : '';
      if (!isDayLocked) {
        anyDayUnlocked = true;
      }

      var dayHeaderTitle = '【' + day + ' 預訂項目】' + (isDayLocked ? ' 🔒[' + lockReason + '無法取消]' : '');

      bodyContents.push(_flexText(dayHeaderTitle, {
        size: 'md',
        weight: 'bold',
        color: isDayLocked ? FLEX_COLORS.textSecondary : FLEX_COLORS.primaryDark,
        align: 'start',
        margin: di === 0 ? 'none' : 'md'
      }));

      dayItems.forEach(function (it) {
        var itemText = it.itemName + (it.quantity > 1 ? ' x' + it.quantity : '') + ' ($' + (it.subtotal || (it.price * it.quantity)) + ')';
        var cancelText = '取消 ' + day + ' ' + it.itemName;

        var actionComponent = isDayLocked
          ? _flexBox([
              _flexText('🔒 ' + lockReason, {
                size: 'xs',
                color: FLEX_COLORS.textSecondary,
                align: 'center'
              })
            ], {
              layout: 'vertical',
              flex: 2,
              justifyContent: 'center',
              alignItems: 'center'
            })
          : {
              type: 'button',
              action: {
                type: 'message',
                label: '取消此項',
                text: cancelText
              },
              style: 'primary',
              color: FLEX_COLORS.danger,
              height: 'sm',
              flex: 2
            };

        bodyContents.push(_flexBox([
          _flexBox([
            _flexText(itemText, {
              size: 'sm',
              weight: 'bold',
              color: isDayLocked ? FLEX_COLORS.textSecondary : FLEX_COLORS.textPrimary,
              wrap: true
            })
          ], {
            layout: 'vertical',
            flex: 3,
            justifyContent: 'center'
          }),
          actionComponent
        ], {
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          paddingAll: 'sm',
          margin: 'xs',
          backgroundColor: FLEX_COLORS.background,
          cornerRadius: 'md'
        }));
      });

      // Button to cancel all items for this day (only if unlocked)
      if (!isDayLocked) {
        bodyContents.push({
          type: 'button',
          action: {
            type: 'message',
            label: '取消【' + day + '】所有餐點',
            text: '取消 ' + day + ' 全部'
          },
          style: 'secondary',
          height: 'sm',
          margin: 'xs'
        });
      }
    });

    // Overall button to cancel all orders
    if (anyDayUnlocked && (dayOrder.length > 1 || orders.length > 1)) {
      bodyContents.push(_flexSeparator({ margin: 'md' }));
      bodyContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: '❌ 取消所有未截止預約訂單',
          text: '取消 全部'
        },
        style: 'secondary',
        height: 'sm',
        margin: 'sm'
      });
    } else if (!anyDayUnlocked && dayOrder.length > 0) {
      bodyContents.push(_flexSeparator({ margin: 'md' }));
      bodyContents.push(_flexText('⚠️ 所有訂單均已超過結單時間或日期，無法修改或取消。若有特殊需求請洽開單人。', {
        size: 'xs',
        color: FLEX_COLORS.warning,
        align: 'center',
        wrap: true,
        margin: 'sm'
      }));
    }
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  var footer = _flexBox([
    _flexText('💡 點選按鈕後將立即退訂，或直接輸入「取消 週幾 菜名」', {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createWeeklyScheduleFlex — Build a Flex card displaying the Mon-Fri schedule
 * @param {Array<Object>} schedule - List of { dayOfWeek, restaurantName, cutoffTime, notes, isActive }
 * @returns {Object} LINE Flex bubble
 */
function createWeeklyScheduleFlex(schedule) {
  var rows = [];
  var days = schedule || [];

  for (var i = 0; i < days.length; i++) {
    var s = days[i];
    rows.push(_flexBox([
      _flexBox([
        _flexText(s.dayOfWeek, { weight: 'bold', size: 'sm', color: FLEX_COLORS.textOnColor, align: 'center' })
      ], {
        backgroundColor: FLEX_COLORS.primary,
        cornerRadius: 'sm',
        paddingAll: 'xs',
        width: '45px'
      }),
      _flexBox([
        _flexText(s.restaurantName || '尚未指定店家', { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('⏰ 截止 ' + (s.cutoffTime || '10:30') + (s.notes ? ' · ' + s.notes : ''), { size: 'xs', color: FLEX_COLORS.textSecondary })
      ], { layout: 'vertical', margin: 'md', flex: 1 }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: '看菜單',
          text: s.dayOfWeek + '菜單'
        },
        style: 'secondary',
        height: 'sm',
        flex: 0
      }
    ], {
      layout: 'horizontal',
      margin: 'md',
      alignItems: 'center',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      paddingAll: 'sm',
      cornerRadius: 'md'
    }));
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: _flexBox([
      _flexText('📅 本週訂餐排程表', { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五每日店家 · 支援一梯次預訂', { size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs' })
    ], { backgroundColor: FLEX_COLORS.primaryDark, paddingAll: 'lg' }),
    body: _flexBox(rows, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText('💡 輸入「週一+1 [餐點]」或點選「看菜單」進行預訂', { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
  };
}

/**
 * createWeeklySummaryFlex — Build a Flex card displaying the weekly batch summary
 * @param {Object} weeklySummary - { daySummaries, grandTotalQuantity, grandTotalAmount, users }
 * @param {boolean} [isClosed] - Whether weekly ordering has ended.
 * @param {Object} [paymentInfo] - Optional payment configuration (LINE Pay & Bank Transfer).
 * @returns {Object} LINE Flex bubble
 */
function createWeeklySummaryFlex(weeklySummary, isClosed, paymentInfo) {
  var summary = weeklySummary || { daySummaries: [], users: [] };
  var bodyContents = [];

  for (var i = 0; i < summary.daySummaries.length; i++) {
    var ds = summary.daySummaries[i];
    var dayItemsText = ds.items && ds.items.length > 0
      ? ds.items.map(function (it) { return it.itemName + 'x' + it.quantity; }).join('、')
      : '無訂單';

    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(ds.dayOfWeek + ' ' + (ds.restaurantName || ''), { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('共 ' + ds.totalQuantity + ' 份 · $' + ds.totalAmount + ' 元', { size: 'xs', color: FLEX_COLORS.primary, weight: 'bold' })
      ], { layout: 'horizontal', justifyContent: 'space-between' }),
      _flexText(dayItemsText, { size: 'xs', color: FLEX_COLORS.textSecondary, margin: 'xs' })
    ], {
      layout: 'vertical',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      paddingAll: 'sm',
      cornerRadius: 'sm',
      margin: 'sm'
    }));
  }

  bodyContents.push(_flexSeparator({ margin: 'md' }));
  bodyContents.push(_flexText('👤 成員本週梯次應付明細', { weight: 'bold', size: 'sm', margin: 'md', color: FLEX_COLORS.textPrimary }));

  if (summary.users && summary.users.length > 0) {
    for (var u = 0; u < summary.users.length; u++) {
      var user = summary.users[u];
      bodyContents.push(_flexBox([
        _flexText(user.userName, { size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('$' + user.total + ' 元', { size: 'sm', weight: 'bold', color: FLEX_COLORS.danger })
      ], { layout: 'horizontal', justifyContent: 'space-between', margin: 'xs' }));
    }
  } else {
    bodyContents.push(_flexText('尚無成員訂購紀錄', { size: 'xs', color: FLEX_COLORS.textSecondary, margin: 'xs' }));
  }

  // Append payment contents if provided
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var weeklyPayBoxes = _buildPaymentContents(paymentInfo);
    for (var wp = 0; wp < weeklyPayBoxes.length; wp++) {
      bodyContents.push(weeklyPayBoxes[wp]);
    }
  }

  // Quick close order button if not closed
  if (!isClosed) {
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: '🔒 截止本週預訂（結單）',
        text: '本週結單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'md'
    });
  }

  var titleText = isClosed ? '📊 本週梯次結單總表' : '📊 本週梯次訂餐統計總表';
  var headerBg = isClosed ? FLEX_COLORS.primaryDark : FLEX_COLORS.primary;
  var footerMsg = isClosed ? '⏰ 本週預訂已截止，請各成員依此表金額完成付款' : '📋 請各成員依此表金額完成對帳與付款';

  return {
    type: 'bubble',
    size: 'mega',
    header: _flexBox([
      _flexText(titleText, { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五 總計 ' + (summary.grandTotalQuantity || 0) + ' 份 · 總金額 $' + (summary.grandTotalAmount || 0) + ' 元', {
        size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs'
      })
    ], { backgroundColor: headerBg, paddingAll: 'lg' }),
    body: _flexBox(bodyContents, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText(footerMsg, { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
  };
}

/* ------------------------------------------------------------------ *
 * Dual-Environment Export (GAS + Node.js)
 * ------------------------------------------------------------------ */
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.FLEX_COLORS = FLEX_COLORS;
  g.createMenuFlex = createMenuFlex;
  g.createOrderReceiptFlex = createOrderReceiptFlex;
  g.createSummaryFlex = createSummaryFlex;
  g.createHelpFlex = createHelpFlex;
  g.createCancelOrderFlex = createCancelOrderFlex;
  g.createWeeklyScheduleFlex = createWeeklyScheduleFlex;
  g.createWeeklySummaryFlex = createWeeklySummaryFlex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FLEX_COLORS: FLEX_COLORS,
      createMenuFlex: createMenuFlex,
      createOrderReceiptFlex: createOrderReceiptFlex,
      createSummaryFlex: createSummaryFlex,
      createHelpFlex: createHelpFlex,
      createCancelOrderFlex: createCancelOrderFlex,
      createWeeklyScheduleFlex: createWeeklyScheduleFlex,
      createWeeklySummaryFlex: createWeeklySummaryFlex,
      // Internal helpers exposed for Node.js testing.
      _flexText: _flexText,
      _flexBox: _flexBox,
      _flexSeparator: _flexSeparator,
      _flexFiller: _flexFiller,
      _flexIcon: _flexIcon,
      _flexButton: _flexButton,
      _flexImage: _flexImage,
      _groupMenuByCategory: _groupMenuByCategory,
      _formatPrice: _formatPrice,
      _calcOrderTotal: _calcOrderTotal
    };
  }
})();



/* =========================================================
 * File: OrderService.js
 * ========================================================= */

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


/* =========================================================
 * File: Code.js
 * ========================================================= */

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
  var summary = getOrderSummary('', todayDate);
  var ss = getSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EFEFEF');
      var rest = getConfigValue('RESTAURANT_NAME', '今日便當');
      summary.items.forEach(function (it) {
        sheet.appendRow(['今日', rest, it.itemName, it.quantity, it.price, it.subtotal, it.buyers.join(', ')]);
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
      sheet.appendRow([]);
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

    // Signature verification (if secret is configured)
    if (channelSecret && signature) {
      var isValid = validateSignature(bodyString, signature, channelSecret);
      if (!isValid) {
        return _createResponse(403, { error: 'Invalid signature' });
      }
    }

    var json = JSON.parse(bodyString);
    var events = json.events || [];

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
          logToSheet('MSG_RECV', msgText, srcId);
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
        var helpFlex = createHelpFlex();
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
      doGet: doGet,
      doPost: doPost,
      setup: setup,
      testLineConnection: testLineConnection,
      testHelpMessage: testHelpMessage,
      testUberEatsImport: testUberEatsImport
    };
  }
})();

