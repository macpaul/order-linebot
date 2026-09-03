/**
 * LINE Meal Ordering Bot for Google Apps Script (All-In-One Bundle)
 * Automatically generated on: 2026-09-03T09:00:26.152Z
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
    MENU: 'Menu',
    ORDERS: 'Orders',
    SUMMARY: 'Summary'
  },

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
var CONFIG = null;
var getConfigProperty = null;
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
  Menu: [
    { DayOfWeek: 'ALL', Category: '便當', ItemName: '招牌排骨飯', Price: 100, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '便當', ItemName: '酥炸雞腿飯', Price: 110, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '便當', ItemName: '古早味控肉飯', Price: 95, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '便當', ItemName: '清蒸魚排飯', Price: 105, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '便當', ItemName: '香煎鯖魚飯', Price: 100, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '輕食', ItemName: '健康水煮雞胸', Price: 100, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '飲料', ItemName: '古早味紅茶', Price: 25, IsAvailable: 'TRUE' },
    { DayOfWeek: 'ALL', Category: '飲料', ItemName: '無糖綠茶', Price: 25, IsAvailable: 'TRUE' }
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
      name: CONFIG.SHEET_NAMES.MENU,
      headers: ['DayOfWeek', 'Category', 'ItemName', 'Price', 'IsAvailable'],
      initData: [
        ['ALL', '主食', '招牌排骨飯', 100, 'TRUE'],
        ['ALL', '主食', '酥炸雞腿飯', 110, 'TRUE'],
        ['ALL', '主食', '古早味控肉飯', 95, 'TRUE'],
        ['ALL', '主食', '清蒸魚排飯', 105, 'TRUE'],
        ['ALL', '輕食', '健康水煮雞胸', 100, 'TRUE'],
        ['ALL', '飲料', '古早味紅茶', 25, 'TRUE'],
        ['ALL', '飲料', '無糖微冰綠茶', 25, 'TRUE']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.ORDERS,
      headers: ['OrderId', 'Timestamp', 'Date', 'GroupId', 'UserId', 'UserName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid']
    },
    {
      name: CONFIG.SHEET_NAMES.SUMMARY,
      headers: ['ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']
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
  // Not found, append
  sheet.appendRow([key, String(value), '']);
  return true;
}

/**
 * Get menu items
 */
function getMenuItems(dayOfWeek) {
  if (!isGasRuntime()) {
    return _mockStore.Menu.filter(function (m) {
      return String(m.IsAvailable).toUpperCase() === 'TRUE' &&
        (m.DayOfWeek === 'ALL' || !dayOfWeek || m.DayOfWeek === dayOfWeek);
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
    var isAvailable = String(row[4]).toUpperCase() === 'TRUE';
    var itemDay = String(row[0]);
    if (isAvailable && (itemDay === 'ALL' || !dayOfWeek || itemDay === dayOfWeek)) {
      menu.push({
        dayOfWeek: itemDay,
        category: String(row[1]),
        itemName: String(row[2]),
        price: Number(row[3]) || 0,
        isAvailable: isAvailable
      });
    }
  }
  return menu;
}

/**
 * Record an order
 */
function addOrder(orderData) {
  var now = new Date();
  var orderId = 'ORD_' + now.getTime() + '_' + Math.floor(Math.random() * 1000);
  var timestamp = now.toISOString();
  var date = orderData.date || now.toISOString().slice(0, 10);
  var quantity = Number(orderData.quantity) || 1;
  var price = Number(orderData.price) || 0;
  var subtotal = quantity * price;

  var record = {
    orderId: orderId,
    timestamp: timestamp,
    date: date,
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
    record.groupId,
    record.userId,
    record.userName,
    record.itemName,
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
function getUserOrders(userId, groupId, date) {
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      return o.userId === userId &&
        (!groupId || o.groupId === groupId) &&
        (!date || o.date === date) &&
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
    var rStatus = String(r[10]);
    var rUserId = String(r[4]);
    var rGroupId = String(r[3]);
    var rDate = String(r[2]);

    if (rStatus === 'ACTIVE' && rUserId === userId && (!groupId || rGroupId === groupId) && (!date || rDate === date)) {
      orders.push({
        row: i + 1,
        orderId: r[0],
        timestamp: r[1],
        date: rDate,
        groupId: rGroupId,
        userId: rUserId,
        userName: r[5],
        itemName: r[6],
        quantity: Number(r[7]),
        price: Number(r[8]),
        subtotal: Number(r[9]),
        status: rStatus,
        paid: r[11]
      });
    }
  }
  return orders;
}

/**
 * Cancel orders for a user
 */
function cancelOrder(userId, groupId, itemName, date) {
  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.userId === userId &&
        (!groupId || o.groupId === groupId) &&
        (!date || o.date === date) &&
        (!itemName || o.itemName.includes(itemName)) &&
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
    var rStatus = String(r[10]);
    var rUserId = String(r[4]);
    var rGroupId = String(r[3]);
    var rDate = String(r[2]);
    var rItem = String(r[6]);

    if (rStatus === 'ACTIVE' && rUserId === userId && (!groupId || rGroupId === groupId) && (!date || rDate === date)) {
      if (!itemName || rItem.indexOf(itemName) !== -1) {
        sheet.getRange(i + 1, 11).setValue('CANCELLED');
        count++;
      }
    }
  }
  return count;
}

/**
 * Get all active orders for a group on a date
 */
function getGroupOrders(groupId, date) {
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      return (!groupId || o.groupId === groupId) &&
        (!date || o.date === date) &&
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
    var rStatus = String(r[10]);
    var rGroupId = String(r[3]);
    var rDate = String(r[2]);

    if (rStatus === 'ACTIVE' && (!groupId || rGroupId === groupId) && (!date || rDate === date)) {
      orders.push({
        orderId: r[0],
        timestamp: r[1],
        date: rDate,
        groupId: rGroupId,
        userId: r[4],
        userName: r[5],
        itemName: r[6],
        quantity: Number(r[7]),
        price: Number(r[8]),
        subtotal: Number(r[9]),
        status: rStatus,
        paid: r[11]
      });
    }
  }
  return orders;
}

/**
 * Calculate summary and write to Summary sheet
 */
function getOrderSummary(groupId, date) {
  var orders = getGroupOrders(groupId, date);
  var itemMap = {};
  var userMap = {};
  var totalQuantity = 0;
  var totalAmount = 0;

  orders.forEach(function (o) {
    // Aggregate by item
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

    // Aggregate by user
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

  var itemsList = Object.keys(itemMap).map(function (k) {
    return itemMap[k];
  });

  var usersList = Object.keys(userMap).map(function (k) {
    return userMap[k];
  });

  // Write to Summary Sheet if in GAS
  if (isGasRuntime()) {
    var ss = getSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
      if (sheet) {
        sheet.clear();
        sheet.appendRow(['ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
        itemsList.forEach(function (item) {
          sheet.appendRow([
            item.itemName,
            item.quantity,
            item.price,
            item.subtotal,
            item.buyers.join(', ')
          ]);
        });
        sheet.appendRow(['【總計】', totalQuantity, '', totalAmount, '']);
      }
    }
  }

  return {
    date: date,
    totalQuantity: totalQuantity,
    totalAmount: totalAmount,
    items: itemsList,
    users: usersList
  };
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
  g.getMenuItems = getMenuItems;
  g.addOrder = addOrder;
  g.getUserOrders = getUserOrders;
  g.cancelOrder = cancelOrder;
  g.getGroupOrders = getGroupOrders;
  g.getOrderSummary = getOrderSummary;
  g._mockStore = _mockStore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isGasRuntime: isGasRuntime,
      getSpreadsheet: getSpreadsheet,
      initSheets: initSheets,
      getConfigValue: getConfigValue,
      setConfigValue: setConfigValue,
      getMenuItems: getMenuItems,
      addOrder: addOrder,
      getUserOrders: getUserOrders,
      cancelOrder: cancelOrder,
      getGroupOrders: getGroupOrders,
      getOrderSummary: getOrderSummary,
      _mockStore: _mockStore
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FLEX_COLORS: FLEX_COLORS,
      createMenuFlex: createMenuFlex,
      createOrderReceiptFlex: createOrderReceiptFlex,
      createSummaryFlex: createSummaryFlex,
      createHelpFlex: createHelpFlex,
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


/* =========================================================
 * File: Code.js
 * ========================================================= */

/**
 * Code.js - Main Webhook Entrypoint for Google Apps Script (GAS)
 * Handles LINE Webhook HTTP POST and GET requests.
 */

/**
 * HTTP GET Handler - Service Health Check & Information
 */
function doGet(e) {
  var status = {
    status: 'online',
    service: 'LINE Meal Ordering Bot',
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
    // Log error in GAS
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

  g.doGet = doGet;
  g.doPost = doPost;
  g.setup = setup;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      doGet: doGet,
      doPost: doPost,
      setup: setup
    };
  }
})();

