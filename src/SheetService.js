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
    { dayOfWeek: 'ALL', category: '便當', itemName: '招牌排骨飯', price: 100, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '便當', itemName: '酥炸雞腿飯', price: 110, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '便當', itemName: '古早味控肉飯', price: 95, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '便當', itemName: '清蒸魚排飯', price: 105, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '便當', itemName: '香煎鯖魚飯', price: 100, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '輕食', itemName: '健康水煮雞胸', price: 100, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '飲料', itemName: '古早味紅茶', price: 25, isAvailable: 'TRUE' },
    { dayOfWeek: 'ALL', category: '飲料', itemName: '無糖綠茶', price: 25, isAvailable: 'TRUE' }
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
      var isAvail = m.isAvailable !== undefined ? m.isAvailable : m.IsAvailable;
      var dow = m.dayOfWeek !== undefined ? m.dayOfWeek : m.DayOfWeek;
      return String(isAvail).toUpperCase() === 'TRUE' &&
        (dow === 'ALL' || !dayOfWeek || dow === dayOfWeek);
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
