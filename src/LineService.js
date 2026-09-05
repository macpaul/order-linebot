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
