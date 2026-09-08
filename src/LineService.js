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
 * replyQuickReply — Reply with a text message with quick reply buttons.
 * @param {string} replyToken - Reply token from the webhook event.
 * @param {string} text - Text content to send.
 * @param {Array<Object>} quickReplyItems - Quick reply action items.
 * @returns {Object|Promise<{statusCode:number, data:Object|null}>}
 */
function replyQuickReply(replyToken, text, quickReplyItems) {
  return replyMessages(replyToken, [{
    type: 'text',
    text: text,
    quickReply: {
      items: quickReplyItems
    }
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

  // 1. Google Apps Script — Utilities.computeHmacSha256 and base64Encode.
  try {
    if (typeof Utilities !== 'undefined' &&
        typeof Utilities.computeHmacSha256 === 'function') {
      var rawSig = Utilities.computeHmacSha256(bodyString, channelSecret);
      var gasExpected = (typeof Utilities.base64Encode === 'function')
        ? Utilities.base64Encode(rawSig)
        : Utilities.base64EncodeWebSafe(rawSig);
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
  g.replyQuickReply = replyQuickReply;
  g.pushMessages = pushMessages;
  g.pushText = pushText;
  g.getUserProfile = getUserProfile;
  g.validateSignature = validateSignature;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      replyMessages: replyMessages,
      replyText: replyText,
      replyFlex: replyFlex,
      replyQuickReply: replyQuickReply,
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
