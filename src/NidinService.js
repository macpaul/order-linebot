/**
 * NidinService.js - 你訂 (nidin.shop) store/menu scraping and parsing service
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 *
 * Public API:
 *   - parseNidinUrl(url)
 *   - fetchStoreMenu(storeId, options)
 *   - extractMenuItems(storeData)
 *   - parseRawMenuJson(jsonStr)
 *   - importNidinToMenu(url, dayOfWeek, restaurantNameOverride)
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
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse raw price to integer
 */
function _convertPrice(rawPrice) {
  var num = parseFloat(rawPrice);
  if (isNaN(num)) return 0;
  return Math.round(num);
}

/**
 * Mock data for offline testing
 */
function _mockStoreData() {
  return {
    storeInfo: {
      status: 200,
      id: 29638,
      name: '台北松菸店',
      brand_name: '青山',
      address: '台北市信義區忠孝東路四段559巷12號'
    },
    menuData: {
      status: 200,
      menu: {
        category_list_json: {
          schema: { product_id: 0, sort: 1, name: 2, description: 3, is_enable: 4, is_visible: 5, category_list: 6, product_list: 7 },
          data: {
            '101': [101, 1, '青', null, true, true, [], [201, 202]],
            '102': [102, 2, '奶', null, true, true, [], [203]],
            '103': [103, 3, '果', null, true, true, [], [204]]
          }
        },
        product_list_json: {
          schema: { product_id: 0, sort: 1, name: 2, description: 3, price: 4, is_enable: 15, is_visible: 16, combine_list: 23 },
          data: {
            '201': [201, 1, '春青', '招牌原茶', 30, null, null, null, null, null, null, null, null, null, null, true, true, [], [], [], [], [], [], [301]],
            '202': [202, 2, '冬青', '冬片青茶', 55, null, null, null, null, null, null, null, null, null, null, true, true, [], [], [], [], [], [], [302]],
            '203': [203, 1, '天蟬那堤', '經典鮮奶茶', 55, null, null, null, null, null, null, null, null, null, null, true, true, [], [], [], [], [], [], [303]],
            '204': [204, 1, '橘子春青', '現壓橘汁', 0, null, null, null, null, null, null, null, null, null, null, true, true, [], [], [], [], [], [], [304]]
          }
        },
        combine_list_json: {
          schema: { combine_id: 0, name: 1, price: 2, edge_list: 5, common_list: 6 },
          data: {
            '301': [301, '街邊店_冰', null, null, null, {}, [[['春青', 0, 30, 3]], [['冰', 42, 0, 3]]]],
            '302': [302, '街邊店_冰', null, null, null, {}, [[['冬青', 0, 55, 3]], [['冰', 42, 0, 3]]]],
            '303': [303, '街邊店_冰', null, null, null, {}, [[['天蟬那堤', 0, 55, 3]], [['冰', 42, 0, 3]]]],
            '304': [304, '街邊店_冰', null, null, null, {}, [[['橘子春青', 0, 65, 3]], [['冰', 42, 0, 3]]]]
          }
        }
      }
    }
  };
}

/**
 * parseNidinUrl — Extract storeId from 你訂 (nidin.shop) URL
 * Supports:
 *   https://order.nidin.shop/menu/29638
 *   https://nidin.shop/menu/29638
 *   order.nidin.shop/menu/29638
 *   nidin.shop/menu/29638?utm_source=...
 *   https://order.nidin.shop/gb/menu/29638/...
 *   bare store id: 29638
 */
function parseNidinUrl(url) {
  if (!url || typeof url !== 'string') return null;

  var trimmed = url.trim();
  var match = trimmed.match(/(?:(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?nidin\.shop\/(?:(?:gb|order|v1|voucher)\/)?menu\/([0-9]+)|(?:store_id=|^)([0-9]+)$)/i);
  if (match) {
    var storeId = match[1] || match[2];
    if (!storeId) return null;

    var apiBase = 'https://loctw-service-api.nidin.shop/shopper/v2/store/' + encodeURIComponent(storeId);
    return {
      storeId: storeId,
      apiUrl: apiBase + '/onShelfMenu',
      infoUrl: apiBase + '/info'
    };
  }

  return null;
}

/**
 * fetchStoreMenu — Fetch store info and on-shelf menu from Nidin API.
 * Synchronous in Google Apps Script; returns Promise in Node.js.
 */
function fetchStoreMenu(storeId, options) {
  if (!storeId) {
    return _mockStoreData();
  }

  var opts = options || {};
  var apiBase = 'https://loctw-service-api.nidin.shop/shopper/v2/store/' + encodeURIComponent(storeId);
  var menuUrl = opts.apiUrl || (apiBase + '/onShelfMenu');
  var infoUrl = opts.infoUrl || (apiBase + '/info');

  var headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'zh-TW,zh;q=0.9'
  };

  function parseResponses(menuRes, infoRes) {
    if (menuRes && menuRes.statusCode >= 200 && menuRes.statusCode < 300 && menuRes.data) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('✔ [Nidin] 菜單 API 請求成功 (HTTP ' + menuRes.statusCode + ')');
      }
      return {
        menuData: menuRes.data,
        storeInfo: (infoRes && infoRes.data) ? infoRes.data : null
      };
    }

    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('⚠️ [Nidin] API 請求失敗，狀態碼: ' + (menuRes ? menuRes.statusCode : '未知'));
      if (menuRes && menuRes.rawText) {
        Logger.log('⚠️ [Nidin] 回應內文前 200 字: ' + menuRes.rawText.slice(0, 200));
      }
    }
    return null;
  }

  if (_isGasRuntime()) {
    try {
      var menuRes = _httpGetJson(menuUrl, headers);
      var infoRes = null;
      try {
        infoRes = _httpGetJson(infoUrl, headers);
      } catch (ie) {
        // Store info optional fallback
      }
      return parseResponses(menuRes, infoRes);
    } catch (err) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('❌ [Nidin] GAS 網路請求異常: ' + (err ? err.message : err));
      }
      return null;
    }
  }

  // Node.js async flow
  var menuPromise = _httpGetJson(menuUrl, headers);
  var infoPromise = _httpGetJson(infoUrl, headers).catch(function () { return null; });

  return Promise.all([menuPromise, infoPromise])
    .then(function (results) {
      return parseResponses(results[0], results[1]);
    })
    .catch(function (err) {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log('❌ [Nidin] 網路請求異常: ' + (err ? err.message : err));
      }
      return null;
    });
}

/**
 * extractMenuItems — Extract deduplicated menu items from Nidin storeData payload
 */
function extractMenuItems(storeData) {
  if (!storeData) return [];

  var menuRoot = null;
  if (storeData.menuData && storeData.menuData.menu) {
    menuRoot = storeData.menuData.menu;
  } else if (storeData.menu) {
    menuRoot = storeData.menu;
  } else if (storeData.category_list_json && storeData.product_list_json) {
    menuRoot = storeData;
  }

  if (!menuRoot || !menuRoot.category_list_json || !menuRoot.product_list_json) {
    return [];
  }

  var catDataObj = menuRoot.category_list_json.data || {};
  var prodDataObj = menuRoot.product_list_json.data || {};
  var combineDataObj = (menuRoot.combine_list_json && menuRoot.combine_list_json.data) ? menuRoot.combine_list_json.data : {};

  // Sort categories by sort field (index 1)
  var categories = Object.values(catDataObj);
  categories.sort(function (a, b) {
    var sortA = (a && a[1] != null) ? a[1] : 9999;
    var sortB = (b && b[1] != null) ? b[1] : 9999;
    return sortA - sortB;
  });

  var seen = {};
  var items = [];

  for (var c = 0; c < categories.length; c++) {
    var cat = categories[c];
    if (!cat) continue;
    var isCatEnable = cat[4] !== false;
    var isCatVisible = cat[5] !== false;
    if (!isCatEnable || !isCatVisible) continue;

    var categoryTitle = _cleanString(cat[2] || '一般品項');
    // Filter out disclaimer / non-food categories
    if (/^(?:※?注意事項|公告|店家公告|訂購須知|外送須知)$/i.test(categoryTitle)) {
      continue;
    }

    var prodIds = cat[7] || [];
    for (var p = 0; p < prodIds.length; p++) {
      var pid = prodIds[p];
      var prod = prodDataObj[pid];
      if (!prod) continue;

      var isProdEnable = prod[15] !== false;
      var isProdVisible = prod[16] !== false;
      if (!isProdEnable || !isProdVisible) continue;

      var itemName = _cleanString(prod[2] || '');
      if (!itemName) continue;

      var price = _convertPrice(prod[4]);

      // If base price is 0 or null, check combine_list for pricing
      if ((price === 0 || !price) && prod[23] && Array.isArray(prod[23])) {
        for (var k = 0; k < prod[23].length; k++) {
          var cid = prod[23][k];
          var comb = combineDataObj[cid];
          if (comb && comb[6] && Array.isArray(comb[6])) {
            for (var gIdx = 0; gIdx < comb[6].length; gIdx++) {
              var grp = comb[6][gIdx];
              if (Array.isArray(grp)) {
                for (var eIdx = 0; eIdx < grp.length; eIdx++) {
                  var entry = grp[eIdx];
                  if (entry && entry[0] === itemName && entry[2]) {
                    price = _convertPrice(entry[2]);
                    break;
                  }
                }
              }
              if (price > 0) break;
            }
          }
          if (price > 0) break;
        }
      }

      var key = categoryTitle + ':' + itemName;
      if (!seen[key]) {
        seen[key] = true;
        items.push({
          category: categoryTitle,
          itemName: itemName,
          price: price,
          description: _cleanString(prod[3] || ''),
          isAvailable: 'TRUE',
          notes: ''
        });
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
    return extractMenuItems(parsed);
  } catch (e) {
    return [];
  }
}

/**
 * High-level orchestration function to import from 你訂 (Nidin)
 */
function importNidinToMenu(url, dayOfWeek, restaurantNameOverride) {
  var parsed = parseNidinUrl(url);
  var storeId = parsed ? parsed.storeId : '';

  function finishImport(storeData) {
    var storeName = restaurantNameOverride;
    if (!storeName && storeData && storeData.storeInfo) {
      var info = storeData.storeInfo;
      var brand = _cleanString(info.brand_name || info.brand_name_short || '');
      var branch = _cleanString(info.name || info.name_short || '');
      if (brand && branch && brand !== branch) {
        storeName = brand + ' (' + branch + ')';
      } else {
        storeName = brand || branch;
      }
    }
    if (!storeName) {
      storeName = '你訂外送';
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

  var storeDataOrPromise = fetchStoreMenu(storeId, parsed || {});
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

  g.parseNidinUrl = parseNidinUrl;
  g.fetchStoreMenu = fetchStoreMenu;
  g.extractMenuItems = extractMenuItems;
  g.parseRawMenuJson = parseRawMenuJson;
  g.importNidinToMenu = importNidinToMenu;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseNidinUrl: parseNidinUrl,
      fetchStoreMenu: fetchStoreMenu,
      extractMenuItems: extractMenuItems,
      parseRawMenuJson: parseRawMenuJson,
      importNidinToMenu: importNidinToMenu,
      _cleanString: _cleanString,
      _convertPrice: _convertPrice,
      _mockStoreData: _mockStoreData
    };
  }
})();
