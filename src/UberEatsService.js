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
