/**
 * LINE Meal Ordering Bot for Google Apps Script (All-In-One Bundle)
 * Automatically generated on: 2026-09-05T11:39:36.393Z
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
async function _httpPostJson(url, headers, payload) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      contentType: 'application/json',
      muteHttpExceptions: true
    });
    var statusCode = parseInt(response.getResponseCode(), 10);
    var data = null;
    try { data = JSON.parse(response.getContentText()); } catch (e) { data = null; }
    return { statusCode: statusCode, data: data };
  }

  // Node.js
  var nodeResponse = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  var nodeData = null;
  try { nodeData = await nodeResponse.json(); } catch (e) { nodeData = null; }
  return { statusCode: nodeResponse.status, data: nodeData };
}

/**
 * _httpGetJson — GET url, return { statusCode, data }.
 * GAS: UrlFetchApp.fetch; Node.js: global fetch.
 * @param {string} url
 * @param {Object<string,string>} headers
 * @returns {Promise<{statusCode:number, data:Object|null}>}
 */
async function _httpGetJson(url, headers) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true
    });
    var statusCode = parseInt(response.getResponseCode(), 10);
    var data = null;
    try { data = JSON.parse(response.getContentText()); } catch (e) { data = null; }
    return { statusCode: statusCode, data: data };
  }

  // Node.js
  var nodeResponse = await fetch(url, {
    method: 'GET',
    headers: headers
  });
  var nodeData = null;
  try { nodeData = await nodeResponse.json(); } catch (e) { nodeData = null; }
  return { statusCode: nodeResponse.status, data: nodeData };
}

/**
 * _authHeaders — Build the Authorization header set for LINE API calls.
 * @returns {Object<string,string>}
 */
function _authHeaders() {
  var channelAccessToken = getConfigProperty('CHANNEL_ACCESS_TOKEN', '');
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
 * @returns {Promise<{statusCode:number, data:Object|null}>}
 */
async function replyMessages(replyToken, messages) {
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
 * @returns {Promise<{statusCode:number, data:Object|null}>}
 */
async function replyText(replyToken, text) {
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
 * @returns {Promise<{statusCode:number, data:Object|null}>}
 */
async function replyFlex(replyToken, altText, flexContents) {
  return replyMessages(replyToken, [{
    type: 'flex',
    altText: altText,
    contents: flexContents
  }]);
}

/* ------------------------------------------------------------------ *
 * Public API — User profile
 * ------------------------------------------------------------------ */

/**
 * getUserProfile — Fetch a user's LINE profile (displayName, pictureUrl).
 * If groupId is provided, first try the group-member endpoint, then fall
 * back to the standard profile endpoint.
 * @param {string} userId - LINE user ID.
 * @param {string} [groupId] - LINE group ID (optional; enables group-member lookup).
 * @returns {Promise<{displayName:string, pictureUrl:string, userId:string}>}
 */
async function getUserProfile(userId, groupId) {
  var headers = _authHeaders();

  // Build candidate URLs: group-member first (when in a group), then standard profile.
  var urls = [];
  if (groupId) {
    urls.push(CONFIG.LINE_GROUP_MEMBER_URL + '/' + groupId + '/member/' + userId);
  }
  urls.push(CONFIG.LINE_PROFILE_URL + '/' + userId);

  var data = null;
  for (var i = 0; i < urls.length; i++) {
    var result = await _httpGetJson(urls[i], headers);
    if (result.statusCode >= 200 && result.statusCode < 300 && result.data) {
      data = result.data;
      break;
    }
  }

  if (data && data.displayName) {
    return {
      displayName: data.displayName,
      pictureUrl: data.pictureUrl || '',
      userId: userId
    };
  }

  // Fallback object when the profile cannot be resolved.
  return {
    displayName: '成員',
    pictureUrl: '',
    userId: userId
  };
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
  g.getUserProfile = getUserProfile;
  g.validateSignature = validateSignature;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      replyMessages: replyMessages,
      replyText: replyText,
      replyFlex: replyFlex,
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
    'ORGANIZER_NAME': '小幫手'
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
  if (!isGasRuntime()) {
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;

  var sheetDefs = [
    {
      name: CONFIG.SHEET_NAMES.CONFIG,
      headers: ['Key', 'Value', 'Description'],
      initData: [
        ['IS_ORDERING_OPEN', 'false', '目前是否開放點餐 (true/false)'],
        ['RESTAURANT_NAME', '老王便當', '今日配合訂購店家名稱'],
        ['CUTOFF_TIME', '11:00', '今日點餐截止時間'],
        ['ORGANIZER_ID', '', '發起開單人 LINE User ID'],
        ['ORGANIZER_NAME', '', '發起開單人姓名']
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
      headers: ['OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid']
    },
    {
      name: CONFIG.SHEET_NAMES.SUMMARY,
      headers: ['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']
    }
  ];

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
    }
  });

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
  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[11]);
    var rUserId = String(r[5]);
    var rGroupId = String(r[4]);
    var rDate = String(r[2]);
    var rDayOfWeek = String(r[3]);

    if (rStatus === 'ACTIVE' && rUserId === userId &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDayOfWeek === dayOfWeek)) {
      orders.push({
        row: i + 1,
        orderId: r[0],
        timestamp: r[1],
        date: rDate,
        dayOfWeek: rDayOfWeek,
        groupId: rGroupId,
        userId: rUserId,
        userName: r[6],
        itemName: r[7],
        quantity: Number(r[8]),
        price: Number(r[9]),
        subtotal: Number(r[10]),
        status: rStatus,
        paid: r[12]
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
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[11]);
    var rUserId = String(r[5]);
    var rGroupId = String(r[4]);
    var rDate = String(r[2]);
    var rDayOfWeek = String(r[3]);
    var rItem = String(r[7]);

    if (rStatus === 'ACTIVE' && rUserId === userId &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDayOfWeek === dayOfWeek)) {
      if (!itemName || rItem.indexOf(itemName) !== -1) {
        sheet.getRange(i + 1, 12).setValue('CANCELLED');
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
  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[11]);
    var rGroupId = String(r[4]);
    var rDate = String(r[2]);
    var rDay = String(r[3]);

    if (rStatus === 'ACTIVE' &&
        (!groupId || rGroupId === groupId) &&
        (!date || rDate === date) &&
        (!dayOfWeek || rDay === dayOfWeek)) {
      orders.push({
        orderId: r[0],
        timestamp: r[1],
        date: rDate,
        dayOfWeek: rDay,
        groupId: rGroupId,
        userId: r[5],
        userName: r[6],
        itemName: r[7],
        quantity: Number(r[8]),
        price: Number(r[9]),
        subtotal: Number(r[10]),
        status: rStatus,
        paid: r[12]
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
      .addToUi();
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
  g.onOpenSpreadsheet = onOpenSpreadsheet;
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
      onOpenSpreadsheet: onOpenSpreadsheet,
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
 * HTTP POST helper with dual-environment support
 */
async function _httpPostJson(url, headers, payload) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      contentType: 'application/json',
      muteHttpExceptions: true
    });
    var statusCode = parseInt(response.getResponseCode(), 10);
    var data = null;
    try { data = JSON.parse(response.getContentText()); } catch (e) { data = null; }
    return { statusCode: statusCode, data: data };
  }

  // Node.js
  var nodeResponse = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  var nodeData = null;
  try { nodeData = await nodeResponse.json(); } catch (e) { nodeData = null; }
  return { statusCode: nodeResponse.status, data: nodeData };
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
 */
function parseUberEatsUrl(url) {
  if (!url) return null;

  var match = url.match(/ubereats\.com\/(?:[a-zA-Z-]+\/)?store\/([^/?#]+)\/([a-zA-Z0-9_-]+)/i);
  if (match) {
    var storeName = _decodeSlug(match[1]);
    var storeUuid = match[2];
    return { storeName: storeName, storeUuid: storeUuid };
  }

  return null;
}

/**
 * fetchStoreMenu — Fetch store menu from Uber Eats internal getStoreV1 API
 */
async function fetchStoreMenu(storeUuid) {
  if (!storeUuid) {
    return _mockStoreData();
  }

  var apiUrl = 'https://www.ubereats.com/_p/api/getStoreV1';
  var headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': 'x',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  var payload = {
    storeUuid: storeUuid,
    diningMode: 'DELIVERY'
  };

  try {
    var result = await _httpPostJson(apiUrl, headers, payload);
    if (result.statusCode >= 200 && result.statusCode < 300 && result.data) {
      return result.data;
    }
  } catch (e) {}

  return _mockStoreData();
}

/**
 * Normalize section structures from Uber Eats API
 */
function _collectSections(storeData) {
  var result = [];
  var root = (storeData && storeData.data) ? storeData.data : storeData;
  if (!root) return result;

  // 1. catalogSectionsMap
  if (root.catalogSectionsMap && typeof root.catalogSectionsMap === 'object') {
    var keys = Object.keys(root.catalogSectionsMap);
    for (var i = 0; i < keys.length; i++) {
      var sec = root.catalogSectionsMap[keys[i]];
      if (sec) result.push(sec);
    }
  }

  // 2. sectionEntitiesMap
  if (result.length === 0 && root.sectionEntitiesMap && typeof root.sectionEntitiesMap === 'object') {
    var entKeys = Object.keys(root.sectionEntitiesMap);
    for (var j = 0; j < entKeys.length; j++) {
      var ent = root.sectionEntitiesMap[entKeys[j]];
      if (ent) result.push(ent);
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
  var currency = (storeData.data && storeData.data.currency) || storeData.currency || 'TWD';
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
async function importUberEatsToMenu(url, dayOfWeek, restaurantNameOverride) {
  var parsed = parseUberEatsUrl(url);
  var storeUuid = parsed ? parsed.storeUuid : '';
  var storeName = restaurantNameOverride || (parsed ? parsed.storeName : 'UberEats外送');

  var storeData = await fetchStoreMenu(storeUuid);
  var items = extractMenuItems(storeData);

  return {
    restaurantName: storeName,
    dayOfWeek: dayOfWeek || '週一',
    url: url,
    itemsCount: items.length,
    items: items
  };
}

// Dual export
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.parseUberEatsUrl = parseUberEatsUrl;
  g.fetchStoreMenu = fetchStoreMenu;
  g.extractMenuItems = extractMenuItems;
  g.parseRawMenuJson = parseRawMenuJson;
  g.importUberEatsToMenu = importUberEatsToMenu;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
  return {
    type: 'text',
    text: String(text),
    color: o.color || FLEX_COLORS.textPrimary,
    size: o.size || 'md',
    weight: o.weight || 'regular',
    align: o.align || 'start',
    wrap: o.wrap !== undefined ? o.wrap : true,
    lineHeight: o.lineHeight || '1.4',
    decoration: o.decoration || 'none',
    margin: o.margin || 'none'
  };
}

/**
 * _flexBox — Build a LINE Flex box (container) component.
 * @param {Array<Object>} contents - Child components.
 * @param {Object} [opts] - Layout/style options (layout, spacing, margin, padding, backgroundColor, cornerRadius, borderWidth, borderColor, borderStyle).
 * @returns {Object}
 */
function _flexBox(contents, opts) {
  var o = opts || {};
  return {
    type: 'box',
    layout: o.layout || 'vertical',
    spacing: o.spacing || 'none',
    margin: o.margin || 'none',
    padding: o.padding || 'none',
    backgroundColor: o.backgroundColor || 'transparent',
    cornerRadius: o.cornerRadius || 'none',
    borderWidth: o.borderWidth || '0px',
    borderColor: o.borderColor || 'transparent',
    borderStyle: o.borderStyle || 'solid',
    contents: contents || []
  };
}

/**
 * _flexSeparator — Horizontal divider line.
 * @param {Object} [opts] - Options (color, margin, size).
 * @returns {Object}
 */
function _flexSeparator(opts) {
  var o = opts || {};
  return {
    type: 'separator',
    color: o.color || FLEX_COLORS.border,
    margin: o.margin || 'md',
    size: o.size || 'sm'
  };
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
 * createMenuFlex — Build a LINE Flex bubble that displays today's menu.
 *
 * Layout:
 *   header  – restaurant name + cutoff-time badge
 *   body     – items grouped by category (name … price)
 *   footer   – usage hint ("reply with an item name to order")
 *
 * @param {string} restaurantName - Display name of the restaurant.
 * @param {string} cutoffTime - Cutoff time string, e.g. "11:00".
 * @param {Array<Object>} menuItems - Flat array of menu records.
 *   Each record shape: { category: string, itemName: string, price: number, isAvailable?: boolean }
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createMenuFlex(restaurantName, cutoffTime, menuItems) {
  var groups = _groupMenuByCategory(menuItems);

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(restaurantName || '今日菜單', {
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
    padding: 'lg',
    backgroundColor: FLEX_COLORS.primary,
    cornerRadius: 'lg'
  });

  /* ---- body: category sections ---- */
  var bodyContents = [];

  groups.forEach(function (group, gi) {
    // Category heading
    bodyContents.push(_flexText('【' + group.category + '】', {
      size: 'md',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'start',
      margin: gi === 0 ? 'none' : 'lg'
    }));

    // Item rows
    group.items.forEach(function (item) {
      var name = item.itemName || '';
      var price = _formatPrice(item.price);

      bodyContents.push(_flexBox([
        _flexText(name, {
          size: 'md',
          color: FLEX_COLORS.textPrimary,
          align: 'start'
        }),
        _flexFiller(),
        _flexText(price, {
          size: 'md',
          color: FLEX_COLORS.textSecondary,
          align: 'end'
        })
      ], {
        layout: 'horizontal',
        spacing: 'sm',
        padding: 'xs',
        backgroundColor: 'transparent'
      }));
    });
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText('💡 回覆菜名即可加購', {
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
function createOrderReceiptFlex(userName, addedItem, userOrders) {
  var orders = userOrders || [];
  var total = _calcOrderTotal(orders);

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
  bodyContents.push(_flexText((userName || '成員') + ' 的訂單', {
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
  } else {
    orders.forEach(function (o) {
      var name = o.itemName || '';
      var qty = o.quantity || 1;
      var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);

      // Highlight the just-added item
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
  bodyContents.push(_flexBox([
    _flexText('合計', {
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
    _flexText('回覆「取消 菜名」可移除項目', {
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
 * createSummaryFlex — Daily aggregated order summary for the organizer.
 *
 * Layout:
 *   header  – restaurant name + date + open/closed status badge
 *   body     – per-item totals (name xQty … $Subtotal) + grand total
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
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createSummaryFlex(restaurantName, summaryData, isClosed) {
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

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footerMsg = isClosed
    ? '⏰ 已截止，不再接受新訂單'
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
 * createHelpFlex — Static instruction card listing all supported bot commands.
 *
 * Layout:
 *   header  – title banner ("使用說明")
 *   body     – numbered command list (command + description)
 *   footer   – contact hint
 *
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createHelpFlex() {
  /* ---- header ---- */
  var header = _flexBox([
    _flexText('📖 使用說明', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    })
  ], {
    layout: 'vertical',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.primary,
    cornerRadius: 'lg'
  });

  /* ---- body: command list ---- */
  var commands = [
    { num: '1', label: '選單',       desc: '查看今日菜單與價格' },
    { num: '2', label: '菜名',       desc: '直接回覆菜名即可加購' },
    { num: '3', label: '我的訂單',   desc: '查看目前已點的所有項目' },
    { num: '4', label: '取消 菜名',  desc: '移除指定項目（如：取消 排骨飯）' },
    { num: '5', label: '說明',       desc: '重新顯示本頁說明' }
  ];

  var bodyContents = [];
  commands.forEach(function (cmd, i) {
    bodyContents.push(_flexBox([
      // Number badge
      _flexBox([
        _flexText(cmd.num, {
          size: 'md',
          weight: 'bold',
          color: FLEX_COLORS.textOnColor,
          align: 'center'
        })
      ], {
        layout: 'vertical',
        padding: 'xxs',
        backgroundColor: FLEX_COLORS.primary,
        cornerRadius: 'sm'
      }),
      // Label + description
      _flexBox([
        _flexText(cmd.label, {
          size: 'md',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary,
          align: 'start'
        }),
        _flexText(cmd.desc, {
          size: 'sm',
          color: FLEX_COLORS.textSecondary,
          align: 'start',
          margin: 'xxs'
        })
      ], {
        layout: 'vertical',
        spacing: 'none',
        margin: 'xs'
      })
    ], {
      layout: 'horizontal',
      spacing: 'sm',
      padding: 'sm',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      cornerRadius: 'md'
    }));
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'sm',
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText('問題請聯繫管理員 🙋', {
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
        padding: 'xs',
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
      padding: 'sm',
      cornerRadius: 'md'
    }));
  }

  return {
    type: 'bubble',
    size: 'giga',
    header: _flexBox([
      _flexText('📅 本週訂餐排程表', { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五每日店家 · 支援一梯次預訂', { size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs' })
    ], { backgroundColor: FLEX_COLORS.primaryDark, padding: 'lg' }),
    body: _flexBox(rows, { layout: 'vertical', padding: 'md' }),
    footer: _flexBox([
      _flexText('💡 輸入「週一+1 [餐點]」或點選「看菜單」進行預訂', { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, padding: 'sm' })
  };
}

/**
 * createWeeklySummaryFlex — Build a Flex card displaying the weekly batch summary
 * @param {Object} weeklySummary - { daySummaries, grandTotalQuantity, grandTotalAmount, users }
 * @returns {Object} LINE Flex bubble
 */
function createWeeklySummaryFlex(weeklySummary) {
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
      padding: 'sm',
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

  return {
    type: 'bubble',
    size: 'giga',
    header: _flexBox([
      _flexText('📊 本週梯次訂餐統計總表', { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五 總計 ' + (summary.grandTotalQuantity || 0) + ' 份 · 總金額 $' + (summary.grandTotalAmount || 0) + ' 元', {
        size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs'
      })
    ], { backgroundColor: FLEX_COLORS.primary, padding: 'lg' }),
    body: _flexBox(bodyContents, { layout: 'vertical', padding: 'md' }),
    footer: _flexBox([
      _flexText('📋 請各成員依此表金額完成對帳與付款', { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, padding: 'sm' })
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
  g.createWeeklyScheduleFlex = createWeeklyScheduleFlex;
  g.createWeeklySummaryFlex = createWeeklySummaryFlex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FLEX_COLORS: FLEX_COLORS,
      createMenuFlex: createMenuFlex,
      createOrderReceiptFlex: createOrderReceiptFlex,
      createSummaryFlex: createSummaryFlex,
      createHelpFlex: createHelpFlex,
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

/**
 * Helper to get today's date in YYYY-MM-DD format (Taiwan time UTC+8)
 */
function getTodayDateString() {
  var d = new Date();
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
function getTodayDayOfWeek() {
  var d = new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var twDate = new Date(utc + (3600000 * 8));
  var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  var day = dayMap[twDate.getDay()];
  if (day === '週六' || day === '週日') return '週一';
  return day;
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
    var dayMenuFlex = FlexModule.createMenuFlex(restName, cutoff, dayMenu);
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
    var menuFlex = FlexModule.createMenuFlex(restaurant, cutoff, menuList);
    return LineModule.replyFlex(replyToken, '【訂餐開始】' + restaurant + ' 菜單', menuFlex);
  }

  // 6. TODAY MENU: 菜單 / menu
  if (/^(?:\/)?(?:菜單|menu)$/i.test(text)) {
    var curRestaurant = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var curCutoff = SheetModule.getConfigValue('CUTOFF_TIME', '11:00');
    var curMenu = SheetModule.getMenuItems(todayDay, curRestaurant);
    var curMenuFlex = FlexModule.createMenuFlex(curRestaurant, curCutoff, curMenu);
    return LineModule.replyFlex(replyToken, curRestaurant + ' 菜單', curMenuFlex);
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
        var itemsText = dOrders.map(function (o) {
          daySub += o.subtotal;
          return o.itemName + ' x' + o.quantity + ' ($' + o.subtotal + ')';
        }).join('、');
        grandTotal += daySub;
        lines.push('【' + d + '】' + itemsText + ' (小計 $' + daySub + ')');
      }
    });

    if (lines.length === 0) {
      return LineModule.replyText(replyToken, '您本週（週一至週五）尚未有任何預訂紀錄喔！');
    }

    var weeklyMsg = '🍱【您的本週梯次訂單】\n' + lines.join('\n') + '\n─────\n本週總計：$' + grandTotal + ' 元';
    return LineModule.replyText(replyToken, weeklyMsg);
  }

  // 8. MY TODAY ORDERS: 我的訂單 / 查詢訂單 / 查單
  if (/^(?:\/)?(?:我的訂單|查詢訂單|查單)$/.test(text)) {
    var myOrders = SheetModule.getUserOrders(userId, groupId, todayDate);
    if (!myOrders || myOrders.length === 0) {
      return LineModule.replyText(replyToken, '您今日尚未有訂餐紀錄喔！可以直接輸入「+1 [餐點名稱]」點餐。');
    }
    var total = 0;
    var myLines = myOrders.map(function (o) {
      total += o.subtotal;
      return '• ' + o.itemName + ' x' + o.quantity + ' ($' + o.subtotal + ')';
    });
    var msg = '【您的今日訂單】\n' + myLines.join('\n') + '\n─────\n總計：$' + total + ' 元';
    return LineModule.replyText(replyToken, msg);
  }

  // 9. CANCEL ORDER: 取消 [週幾] [品項] / 取消 [品項]
  var cancelMatch = text.match(/^(?:\/)?取消(?:\s+(週[一二三四五]))?(?:\s*(全部|.+))?$/);
  if (cancelMatch) {
    var cancelDay = cancelMatch[1] || null;
    var targetItem = cancelMatch[2] ? cancelMatch[2].trim() : '';
    if (targetItem === '全部') targetItem = '';

    var cancelledCount = SheetModule.cancelOrder(userId, groupId, targetItem, cancelDay ? null : todayDate, cancelDay);
    if (cancelledCount > 0) {
      var dayText = cancelDay ? cancelDay + ' ' : '';
      return LineModule.replyText(replyToken, '✅ 已為您取消 ' + dayText + (targetItem ? '「' + targetItem + '」' : '全部餐點') + ' 共 ' + cancelledCount + ' 筆紀錄。');
    } else {
      return LineModule.replyText(replyToken, '查無符合條件的未取消訂單。');
    }
  }

  // 10. WEEKLY SUMMARY: 本週統計 / 梯次統計
  if (/^(?:\/)?(?:本週統計|梯次統計)$/.test(text)) {
    var weeklySummary = SheetModule.getWeeklyOrderSummary(groupId);
    var weeklySumFlex = FlexModule.createWeeklySummaryFlex(weeklySummary);
    return LineModule.replyFlex(replyToken, '📊 本週梯次訂餐統計總表', weeklySumFlex);
  }

  // 11. TODAY SUMMARY: 統計 / 即時統計
  if (/^(?:\/)?(?:統計|即時統計)$/.test(text)) {
    var restName = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var isOrderOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    var summary = SheetModule.getOrderSummary(groupId, todayDate);
    var sumFlex = FlexModule.createSummaryFlex(restName, summary, !isOrderOpen);
    return LineModule.replyFlex(replyToken, '【訂餐統計】' + restName, sumFlex);
  }

  // 12. CLOSE ORDER: 結單 / 截止 / 截止訂餐
  if (/^(?:\/)?(?:結單|截止|截止訂餐)$/.test(text)) {
    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'false');
    var finalRest = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var finalSummary = SheetModule.getOrderSummary(groupId, todayDate);
    var finalFlex = FlexModule.createSummaryFlex(finalRest, finalSummary, true);
    return LineModule.replyFlex(replyToken, '【已結單】' + finalRest + ' 訂購名單總計', finalFlex);
  }

  // 13. ORDER PLACEMENT: +1 / +2 / 點餐語法解析 (支援單日與週一至週五梯次點餐)
  var orderItems = parseOrderText(text);
  if (orderItems.length > 0) {
    var userDisplayName = '成員';
    try {
      if (LineModule.getUserProfile) {
        var profilePromise = LineModule.getUserProfile(userId, groupId);
        if (profilePromise && typeof profilePromise.then === 'function') {
          profilePromise.then(function (prof) {
            if (prof && prof.displayName) userDisplayName = prof.displayName;
          });
        } else if (profilePromise && profilePromise.displayName) {
          userDisplayName = profilePromise.displayName;
        }
      }
    } catch (e) {}

    var addedRecords = [];
    var isOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';

    orderItems.forEach(function (oi) {
      var day = oi.dayOfWeek || todayDay;
      // If ordering for today without day prefix, check open status
      if (!oi.dayOfWeek && !isOpen) {
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
        itemName: matched.itemName,
        quantity: oi.quantity,
        price: matched.price
      });
      addedRecords.push(record);
    });

    if (addedRecords.length === 0) {
      return LineModule.replyText(replyToken, '⚠️ 目前尚未開放點餐或已經截止囉！若要開單請傳送「開單 [店家名] [時間]」或使用「週一+1 [餐點]」預定梯次。');
    }

    var lastAdded = addedRecords[addedRecords.length - 1];
    var allMyOrders = SheetModule.getUserOrders(userId, groupId, todayDate, lastAdded.dayOfWeek);
    var receiptFlex = FlexModule.createOrderReceiptFlex(userDisplayName, lastAdded, allMyOrders);
    return LineModule.replyFlex(replyToken, '訂單已記錄：' + lastAdded.dayOfWeek + ' ' + lastAdded.itemName, receiptFlex);
  }

  return null;
}

/**
 * Handle Postback Event
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

  if (params.action === 'order' && params.item) {
    var dayPrefix = params.day ? params.day + ' ' : '';
    var pseudoMessageEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        type: 'text',
        text: dayPrefix + '+1 ' + params.item
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
  g.getTodayDayOfWeek = getTodayDayOfWeek;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseOrderText: parseOrderText,
      matchMenuItem: matchMenuItem,
      handleTextMessage: handleTextMessage,
      handlePostbackEvent: handlePostbackEvent,
      getTodayDateString: getTodayDateString,
      getTodayDayOfWeek: getTodayDayOfWeek
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
    var storeUuid = parsed ? parsed.storeUuid : '';
    var storeName = parsed ? parsed.storeName : 'UberEats外送';

    var storeData = fetchStoreMenu(storeUuid);
    // If returned promise (in async environment)
    if (storeData && typeof storeData.then === 'function') {
      storeData.then(function (data) {
        var items = extractMenuItems(data);
        saveMenuItems(dayOfWeek, storeName, items);
        setWeeklyScheduleDay(dayOfWeek, storeName, '10:30', url, '從 Uber Eats 匯入');
        ui.alert('✅ 匯入成功！\n店家：' + storeName + '\n已排入：' + dayOfWeek + '\n共抓取 ' + items.length + ' 道餐點！');
      });
    } else {
      var items = extractMenuItems(storeData);
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
        handleTextMessage(event);
      }
      // 2. Postback Event (from Flex Message Buttons)
      else if (event.type === 'postback') {
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
      console.error('doPost error:', err);
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      onOpen: onOpen,
      refreshDailySummary: refreshDailySummary,
      refreshWeeklySummary: refreshWeeklySummary,
      showUberEatsImportDialog: showUberEatsImportDialog,
      doGet: doGet,
      doPost: doPost,
      setup: setup
    };
  }
})();

