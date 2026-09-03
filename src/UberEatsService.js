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
var CONFIG = null;
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
