/**
 * FoodpandaService.js - foodpanda store/menu scraping and parsing service
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 *
 * Public API:
 *   - parseFoodpandaUrl(url)
 *   - fetchStoreMenu(vendorCode, options)
 *   - extractMenuItems(storeData)
 *   - parseRawMenuJson(jsonStr)
 *   - importFoodpandaToMenu(url, dayOfWeek, restaurantNameOverride)
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
 * Generate lightweight tracking ID for Perseus headers
 */
function _generatePerseusId() {
  var ts = Date.now();
  var rand = Math.floor(Math.random() * 1000000000);
  return ts + '.' + rand + '.linebot';
}

/**
 * HTTP GET helper with dual-environment support.
 * Synchronous in Google Apps Script (UrlFetchApp), Promise-based in Node.js.
 */
function _httpGetJson(url, headers) {
  if (_isGasRuntime()) {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
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
    method: 'GET',
    headers: headers
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
 * Convert price (regular dollars, or TWD in cents -> dollars)
 */
function _convertPrice(rawPrice, currency) {
  var num = parseFloat(rawPrice);
  if (isNaN(num)) return 0;
  var isTwd = !currency || currency === 'TWD';
  if (isTwd && num >= 1000 && num % 100 === 0) {
    return Math.round(num / 100);
  }
  return Math.round(num);
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
  if (/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return decoded.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  }
  return decoded.replace(/[-_]+/g, ' ').trim();
}

/**
 * Mock data for offline testing
 */
function _mockStoreData() {
  return {
    status_code: 200,
    data: {
      id: 68995,
      code: 'm6hr',
      name: '洪記豆漿大王 (台北長春店)',
      address: '台北市中山區長春路352號',
      currency: 'TWD',
      menus: [
        {
          id: 1,
          name: '全日菜單',
          menu_categories: [
            {
              id: 101,
              name: '飲料類',
              products: [
                {
                  id: 201,
                  name: '鹹豆漿',
                  description: '內容物有蘿蔔乾、蔥花、蝦米。',
                  is_sold_out: false,
                  product_variations: [
                    { id: 301, price: 47, price_before_discount: 55 }
                  ]
                },
                {
                  id: 202,
                  name: '熱豆漿',
                  description: '純手工磨煮香濃豆漿',
                  is_sold_out: false,
                  product_variations: [
                    { id: 302, price: 34, price_before_discount: 40 }
                  ]
                }
              ]
            },
            {
              id: 102,
              name: '蛋餅',
              products: [
                {
                  id: 203,
                  name: '原味蛋餅',
                  description: '手工現煎蛋餅皮',
                  is_sold_out: false,
                  product_variations: [
                    { id: 303, price: 37, price_before_discount: 45 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

/**
 * parseFoodpandaUrl — Extract vendorCode, storeName, and country from foodpanda URL
 * Supports:
 *   https://www.foodpanda.com.tw/restaurant/m6hr/hong-ji-dou-jiang-da-wang-tai-bei-chang-chun-dian
 *   https://foodpanda.com.tw/restaurant/m6hr
 *   foodpanda.com.tw/restaurant/m6hr/slug?...
 *   https://tw.fd-api.com/api/v5/vendors/m6hr
 *   international domains: .sg, .my, .ph, .hk, .th, .pk, .com
 */
function parseFoodpandaUrl(url) {
  if (!url || typeof url !== 'string') return null;

  var match = url.match(/(?:foodpanda\.(?:com\.tw|com|sg|my|ph|hk|tw|th|pk)|([a-z]{2})\.fd-api\.com|fd-api\.com)\/(?:restaurant\/|api\/v5\/vendors\/)([a-zA-Z0-9_-]+)(?:\/([^/?#]+))?/i);
  if (match) {
    var vendorCode = match[2];
    var rawSlug = match[3] || '';
    var storeName = _decodeSlug(rawSlug);

    var country = 'tw';
    if (url.indexOf('.sg') !== -1) country = 'sg';
    else if (url.indexOf('.my') !== -1) country = 'my';
    else if (url.indexOf('.ph') !== -1) country = 'ph';
    else if (url.indexOf('.hk') !== -1) country = 'hk';
    else if (url.indexOf('.th') !== -1) country = 'th';
    else if (url.indexOf('.pk') !== -1) country = 'pk';

    var apiHost = country + '.fd-api.com';

    return {
      vendorCode: vendorCode,
      rawSlug: rawSlug,
      storeName: storeName,
      country: country,
      apiHost: apiHost
    };
  }

  return null;
}

/**
 * fetchStoreMenu — Fetch store menu from foodpanda API (fd-api.com).
 * Synchronous in Google Apps Script; returns Promise in Node.js.
 */
function fetchStoreMenu(vendorCode, options) {
  if (!vendorCode) {
    return _mockStoreData();
  }

  var opts = options || {};
  var apiHost = opts.apiHost || 'tw.fd-api.com';
  var apiUrl = 'https://' + apiHost + '/api/v5/vendors/' + encodeURIComponent(vendorCode) + '?include=menus';

  var headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Accept': 'application/json',
    'Accept-Language': 'zh-TW,zh-Hant;q=0.9',
    'perseus-client-id': _generatePerseusId(),
    'perseus-session-id': _generatePerseusId()
  };

  function parseResult(res) {
    if (res && res.statusCode >= 200 && res.statusCode < 300 && res.data) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('✔ [foodpanda] API 請求成功 (HTTP ' + res.statusCode + ')');
        var sName = (res.data.data && res.data.data.name) ? res.data.data.name : '';
        if (sName) {
          Logger.log('✔ [foodpanda] 店家名稱: ' + sName);
        }
      }
      return res.data;
    }
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('⚠️ [foodpanda] API 請求失敗，HTTP 狀態碼: ' + (res ? res.statusCode : '未知'));
      if (res && res.rawText) {
        Logger.log('⚠️ [foodpanda] 回應內文前 200 字: ' + res.rawText.slice(0, 200));
      }
    }
    return null;
  }

  var resOrPromise = _httpGetJson(apiUrl, headers);
  if (resOrPromise && typeof resOrPromise.then === 'function') {
    return resOrPromise.then(parseResult).catch(function (err) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('❌ [foodpanda] 網路請求異常: ' + (err ? err.message : err));
      }
      return null;
    });
  }

  return parseResult(resOrPromise);
}

/**
 * extractMenuItems — Extract deduplicated menu items with prices, categories, and availability
 */
function extractMenuItems(storeData) {
  if (!storeData) return [];

  var root = (storeData.data && typeof storeData.data === 'object') ? storeData.data : storeData;
  if (!root) return [];

  var menus = [];
  if (Array.isArray(root.menus)) {
    menus = root.menus;
  } else if (root.menu && Array.isArray(root.menu)) {
    menus = root.menu;
  } else if (Array.isArray(root)) {
    menus = [{ menu_categories: root }];
  }

  var currency = root.currency || (storeData.data && storeData.data.currency) || 'TWD';
  var seen = {};
  var items = [];

  for (var m = 0; m < menus.length; m++) {
    var menuObj = menus[m];
    var categories = menuObj.menu_categories || menuObj.categories || [];
    for (var c = 0; c < categories.length; c++) {
      var cat = categories[c];
      var categoryTitle = _cleanString(cat.name || cat.title || '一般餐點');

      // Filter out non-food announcement / disclaimer categories
      if (/^(?:※?注意事項|公告|店家公告|訂購須知|外送須知)$/i.test(categoryTitle)) {
        continue;
      }

      var products = cat.products || cat.items || [];
      for (var p = 0; p < products.length; p++) {
        var prod = products[p];
        var baseName = _cleanString(prod.name || prod.title || '');
        if (!baseName) continue;

        // Skip non-product instruction/warning entries
        if (prod.master_category_id === 13 && /^(?:注意事項|服務說明|發票|警語)/i.test(baseName)) {
          continue;
        }

        var description = _cleanString(prod.description || prod.desc || '');
        var isSoldOut = prod.is_sold_out !== undefined ? !!prod.is_sold_out : false;
        var isAvailable = !isSoldOut;

        var variations = prod.product_variations || prod.variations || [];
        if (variations.length > 1) {
          for (var v = 0; v < variations.length; v++) {
            var variation = variations[v];
            var varName = _cleanString(variation.name || '');
            var itemName = varName ? (baseName + ' (' + varName + ')') : baseName;
            var dedupeKey = categoryTitle + '|' + itemName;
            if (seen[dedupeKey]) continue;
            seen[dedupeKey] = true;

            var rawPrice = (variation.price !== undefined && variation.price !== null)
              ? variation.price
              : variation.price_before_discount;
            var convertedPrice = _convertPrice(rawPrice, currency);

            items.push({
              category: categoryTitle,
              itemName: itemName,
              price: convertedPrice,
              description: description,
              isAvailable: isAvailable
            });
          }
        } else {
          var dedupeKeySingle = categoryTitle + '|' + baseName;
          if (seen[dedupeKeySingle]) continue;
          seen[dedupeKeySingle] = true;

          var singleVar = variations[0] || {};
          var rawPriceSingle = (singleVar.price !== undefined && singleVar.price !== null)
            ? singleVar.price
            : ((singleVar.price_before_discount !== undefined) ? singleVar.price_before_discount : (prod.price || 0));
          var convertedPriceSingle = _convertPrice(rawPriceSingle, currency);

          items.push({
            category: categoryTitle,
            itemName: baseName,
            price: convertedPriceSingle,
            description: description,
            isAvailable: isAvailable
          });
        }
      }
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
      return extractMenuItems({ data: { menus: [{ menu_categories: [{ name: '菜單', products: parsed }] }] } });
    }
    return extractMenuItems(parsed);
  } catch (e) {
    return [];
  }
}

/**
 * High-level orchestration function to import from foodpanda
 */
function importFoodpandaToMenu(url, dayOfWeek, restaurantNameOverride) {
  var parsed = parseFoodpandaUrl(url);
  var vendorCode = parsed ? parsed.vendorCode : '';
  var fallbackStoreName = restaurantNameOverride || (parsed ? parsed.storeName : 'foodpanda外送');

  function finishImport(storeData) {
    var storeName = restaurantNameOverride;
    if (!storeName && storeData) {
      if (storeData.data && storeData.data.name) {
        storeName = storeData.data.name;
      } else if (storeData.name) {
        storeName = storeData.name;
      }
    }
    if (!storeName) {
      storeName = fallbackStoreName || 'foodpanda外送';
    }

    var items = extractMenuItems(storeData);
    return {
      restaurantName: storeName,
      dayOfWeek: dayOfWeek || '週一',
      url: url,
      itemsCount: items.length,
      items: items
    };
  }

  var storeDataOrPromise = fetchStoreMenu(vendorCode, parsed ? { apiHost: parsed.apiHost } : {});
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

  g.parseFoodpandaUrl = parseFoodpandaUrl;
  g.fetchStoreMenu = fetchStoreMenu;
  g.extractMenuItems = extractMenuItems;
  g.parseRawMenuJson = parseRawMenuJson;
  g.importFoodpandaToMenu = importFoodpandaToMenu;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseFoodpandaUrl: parseFoodpandaUrl,
      fetchStoreMenu: fetchStoreMenu,
      extractMenuItems: extractMenuItems,
      parseRawMenuJson: parseRawMenuJson,
      importFoodpandaToMenu: importFoodpandaToMenu,
      _cleanString: _cleanString,
      _convertPrice: _convertPrice,
      _decodeSlug: _decodeSlug,
      _mockStoreData: _mockStoreData
    };
  }
})();
