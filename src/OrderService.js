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
var I18nModule = null;

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
    I18nModule = g;
  } else {
    try {
      ConfigModule = require('./Config.js');
      SheetModule = require('./SheetService.js');
      FlexModule = require('./FlexMessage.js');
      LineModule = require('./LineService.js');
      UberEatsModule = require('./UberEatsService.js');
      I18nModule = require('./I18n.js');
    } catch (e) {
      // Fallback
    }
  }
})();

var DAY_ORDER = { '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5 };

/**
 * Helper to get the effective timezone from SpreadsheetApp or SheetService
 * @returns {string}
 */
function getAppTimeZone() {
  if (typeof globalThis !== 'undefined' && globalThis._mockSpreadsheetTimeZone) {
    return globalThis._mockSpreadsheetTimeZone;
  }
  if (typeof getSpreadsheetTimeZone === 'function') {
    return getSpreadsheetTimeZone();
  }
  if (typeof SheetModule !== 'undefined' && typeof SheetModule.getSpreadsheetTimeZone === 'function') {
    return SheetModule.getSpreadsheetTimeZone();
  }
  return 'Asia/Taipei';
}

/**
 * Helper to format a Date into formatted string using effective spreadsheet timezone
 * @param {Date} [date]
 * @param {string} [format]
 * @returns {string}
 */
function formatAppDate(date, format) {
  var d = date || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var tz = getAppTimeZone();
  var fmt = format || 'yyyy-MM-dd HH:mm:ss';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      return Utilities.formatDate(d, tz, fmt);
    } catch (e) {}
  }
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      if (fmt === 'yyyy-MM-dd') {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      }
      var dParts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      var tParts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
      return dParts + ' ' + tParts;
    }
  } catch (e) {}
  return d.toISOString();
}

/**
 * Helper to get today's date in YYYY-MM-DD format using effective spreadsheet timezone
 */
function getTodayDateString(refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var tz = getAppTimeZone();
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    } catch (e) {}
  }
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    }
  } catch (e) {}
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
  var tz = getAppTimeZone();
  var dayOfWeekStr = '';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      var u = parseInt(Utilities.formatDate(d, tz, 'u'), 10);
      var dayMapU = { 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日' };
      dayOfWeekStr = dayMapU[u];
    } catch (e) {}
  }
  if (!dayOfWeekStr) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        dayOfWeekStr = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, weekday: 'short' }).format(d);
      }
    } catch (e) {}
  }
  if (!dayOfWeekStr) {
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    dayOfWeekStr = dayMap[twDate.getDay()];
  }
  if (dayOfWeekStr === '週六' || dayOfWeekStr === '週日') return '週一';
  return dayOfWeekStr;
}

/**
 * Check if a weekday has already passed compared to current effective date
 * @param {string} targetDay - e.g. '週一'
 * @param {Date} [refDate] - Optional reference date for testing
 * @returns {boolean}
 */
function isDayPast(targetDay, refDate) {
  var d = refDate || (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var tz = getAppTimeZone();
  var currentDayIndex = -1;
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      var u = parseInt(Utilities.formatDate(d, tz, 'u'), 10);
      currentDayIndex = u === 7 ? 0 : u; // convert Sunday 7 to 0
    } catch (e) {}
  }
  if (currentDayIndex === -1) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        var dayStr = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, weekday: 'short' }).format(d);
        var mapStrToIndex = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 };
        if (typeof mapStrToIndex[dayStr] !== 'undefined') {
          currentDayIndex = mapStrToIndex[dayStr];
        }
      }
    } catch (e) {}
  }
  if (currentDayIndex === -1) {
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    currentDayIndex = twDate.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  }
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
  var tz = getAppTimeZone();
  var currentDayIndex = -1;
  var currentMinutes = -1;
  var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      var u = parseInt(Utilities.formatDate(d, tz, 'u'), 10);
      currentDayIndex = u === 7 ? 0 : u;
      var hh = parseInt(Utilities.formatDate(d, tz, 'HH'), 10);
      var mm = parseInt(Utilities.formatDate(d, tz, 'mm'), 10);
      currentMinutes = hh * 60 + mm;
    } catch (e) {}
  }
  if (currentDayIndex === -1 || currentMinutes === -1) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        var dayStr = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, weekday: 'short' }).format(d);
        var mapStrToIndex = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 };
        if (typeof mapStrToIndex[dayStr] !== 'undefined') {
          currentDayIndex = mapStrToIndex[dayStr];
        }
        var parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
        var hPart = parts.find(function (p) { return p.type === 'hour'; });
        var mPart = parts.find(function (p) { return p.type === 'minute'; });
        if (hPart && mPart) {
          currentMinutes = parseInt(hPart.value, 10) * 60 + parseInt(mPart.value, 10);
        }
      }
    } catch (e) {}
  }
  if (currentDayIndex === -1) {
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    currentDayIndex = twDate.getDay();
    currentMinutes = twDate.getHours() * 60 + twDate.getMinutes();
  }
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

  return currentMinutes >= cutoffMinutes;
}

/**
 * Resolve target LINE User IDs to receive push notification based on comma-separated config
 * Supports:
 * - Specific key mapping: '暱稱:U...', 'usr_hash:U...', 'key=U...'
 * - Auto-hash matching for standalone IDs: 'U111..., U222...' matches against HASHED_ID
 * - Always-notify / broadcast prefix: '*:U...', 'all:U...', '@all:U...'
 * - Standalone fallback broadcast: if no specific match, send to all standalone IDs
 * @param {string} organizerId - Current ORGANIZER_ID from Sheet
 * @param {string} organizerName - Current ORGANIZER_NAME from Sheet
 * @param {string} rawPushSetting - Raw setting string from Script Properties or Config
 * @returns {Array<string>} Array of distinct LINE User IDs to push to
 */
function resolveOrganizerPushTargets(organizerId, organizerName, rawPushSetting) {
  var targets = [];
  var setting = (rawPushSetting || '').trim();
  var orgId = (organizerId || '').trim();
  var orgName = (organizerName || '').trim();

  if (!setting) {
    // Scheme A: If no setting, check if organizerId itself is an unhashed LINE User ID
    if (orgId && orgId.indexOf('usr_') !== 0) {
      targets.push(orgId);
    }
    return targets;
  }

  // Split by comma, semicolon, or newline
  var tokens = setting.split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  if (tokens.length === 0) return targets;

  var specificMatches = [];
  var alwaysNotify = [];
  var standaloneList = [];

  tokens.forEach(function (token) {
    var sepIdx = token.indexOf(':');
    if (sepIdx === -1) {
      sepIdx = token.indexOf('=');
    }

    if (sepIdx !== -1) {
      var key = token.substring(0, sepIdx).trim();
      var val = token.substring(sepIdx + 1).trim();
      if (!val) return;

      // Check for always-notify wildcard: *, all, @all
      var lowerKey = key.toLowerCase();
      if (lowerKey === '*' || lowerKey === 'all' || lowerKey === '@all') {
        alwaysNotify.push(val);
        return;
      }

      // Check if key matches current organizer:
      var isMatch = false;
      if (orgId && key.toLowerCase() === orgId.toLowerCase()) {
        isMatch = true;
      } else if (orgName && key.toLowerCase() === orgName.toLowerCase()) {
        isMatch = true;
      } else if (SheetModule && typeof SheetModule.hashUserId === 'function') {
        var hashedKey = SheetModule.hashUserId(key);
        if (hashedKey && hashedKey === orgId) {
          isMatch = true;
        }
      }

      if (isMatch) {
        specificMatches.push(val);
      }
    } else {
      // Standalone ID without key (e.g. U1234567890abcdef... or mock test ID)
      standaloneList.push(token);
    }
  });

  // Check standalone IDs for match with current organizer
  standaloneList.forEach(function (stdId) {
    if (orgId) {
      if (stdId === orgId) {
        specificMatches.push(stdId);
      } else if (SheetModule && typeof SheetModule.hashUserId === 'function') {
        var hashedStd = SheetModule.hashUserId(stdId);
        if (hashedStd && hashedStd === orgId) {
          specificMatches.push(stdId);
        }
      }
    }
  });

  // Selection decision:
  if (specificMatches.length > 0) {
    // Specific organizer(s) found! Notify matched organizer(s) + any wildcard always-notify
    targets = specificMatches.concat(alwaysNotify);
  } else if (alwaysNotify.length > 0) {
    targets = alwaysNotify;
  } else {
    // No specific organizer identified; broadcast to all standalone IDs
    targets = standaloneList;
  }

  // Deduplicate and filter out hashed IDs (usr_...) or empty strings
  var uniqueTargets = [];
  targets.forEach(function (t) {
    var cleanT = String(t).trim();
    if (cleanT && cleanT.indexOf('usr_') !== 0 && uniqueTargets.indexOf(cleanT) === -1) {
      uniqueTargets.push(cleanT);
    }
  });

  return uniqueTargets;
}

/**
 * Send LINE push notification to the organizer if ORGANIZER_ID or ORGANIZER_PUSH_ID is configured
 * @param {string} notificationText
 */
function notifyOrganizer(notificationText) {
  if (!SheetModule || !LineModule || !LineModule.pushText) return;
  try {
    var organizerId = SheetModule.getConfigValue('ORGANIZER_ID', '');
    var organizerName = SheetModule.getConfigValue('ORGANIZER_NAME', '');
    var rawPushSetting = '';
    if (typeof getConfigProperty === 'function') {
      rawPushSetting = getConfigProperty('ORGANIZER_PUSH_ID', '') || getConfigProperty('ORGANIZER_PUSH_MAP', '');
    }
    if (!rawPushSetting) {
      rawPushSetting = SheetModule.getConfigValue('ORGANIZER_PUSH_ID', '');
    }

    var targets = resolveOrganizerPushTargets(organizerId, organizerName, rawPushSetting);
    for (var i = 0; i < targets.length; i++) {
      LineModule.pushText(targets[i], notificationText);
    }
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.error('Failed to notify organizer:', e);
    }
  }
}

/**
 * Check if the given user is the organizer
 * @param {string} userId
 * @param {string} [userDisplayName]
 * @returns {boolean}
 */
function isUserOrganizer(userId, userDisplayName) {
  if (!userId && !userDisplayName) return false;
  var organizerId = (SheetModule.getConfigValue('ORGANIZER_ID', '') || '').trim();
  if (!organizerId) return false;

  if (userId && organizerId === userId) {
    return true;
  }
  if (SheetModule && typeof SheetModule.getEffectiveUserId === 'function') {
    var effUserId = SheetModule.getEffectiveUserId(userId, userDisplayName, userDisplayName);
    if (effUserId && organizerId === effUserId) {
      return true;
    }
  }
  if (userDisplayName && organizerId === userDisplayName) {
    return true;
  }
  return false;
}

/**
 * Format order summary data as readable plain text (including items, buyers, member breakdown and total)
 * @param {string} restaurantName
 * @param {Object} summaryData - { date, dayOfWeek, totalQuantity, totalAmount, items, users }
 * @param {boolean} isClosed
 * @returns {string}
 */
function formatOrderSummaryText(restaurantName, summaryData, isClosed) {
  var s = summaryData || {};
  var items = s.items || [];
  var users = s.users || [];
  var lines = [];
  var status = isClosed ? '【已截止】' : '【開放中】';
  lines.push('📊 今日訂餐統計 ' + status);
  lines.push('🍱 店家：' + (restaurantName || '今日便當'));
  if (s.date || s.dayOfWeek) {
    lines.push('📅 日期：' + (s.date || '') + (s.dayOfWeek ? ' (' + s.dayOfWeek + ')' : ''));
  }
  lines.push('─────────────────');

  lines.push('📋 餐點統計：');
  if (items.length === 0) {
    lines.push('  （今日尚無訂單）');
  } else {
    items.forEach(function (it) {
      var buyers = (it.buyers && it.buyers.length > 0) ? ' (' + it.buyers.join(', ') + ')' : '';
      lines.push('  • ' + it.itemName + ' x ' + it.quantity + ' ＝ $' + it.subtotal + buyers);
    });
  }
  lines.push('─────────────────');
  lines.push('💰 總計：' + (s.totalQuantity || 0) + ' 份 / $' + (s.totalAmount || 0) + ' 元');

  if (users.length > 0) {
    lines.push('─────────────────');
    lines.push('👤 每人應付明細與點餐內容：');
    users.forEach(function (u) {
      var userItems = (u.items && u.items.length > 0) ? u.items.join('、') : '';
      lines.push('  • ' + (u.userName || '成員') + '：' + userItems + ' ＝ $' + (u.total || 0) + ' 元');
    });
  }
  return lines.join('\n');
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
function _protectBrackets(str) {
  return str.replace(/([(（\[【][^)）\]】]*[)）\]】])/g, function (match) {
    return match.replace(/,/g, '___COMMA___').replace(/，/g, '___COMMA___');
  });
}
function _restoreBrackets(str) {
  return str.replace(/___COMMA___/g, ',');
}

function _pushParsedOrderItem(list, dayOfWeek, rawItem, qty, explicitChild) {
  var childName = explicitChild || '';
  var cleanItem = (rawItem || '').trim();

  // If explicitChild has multiple children separated by comma or 頓號: "大寶, 二寶"
  if (explicitChild) {
    var splitKids = explicitChild.split(/[,、，\s]+/).filter(function (k) { return k && k.trim(); });
    if (splitKids.length > 1) {
      splitKids.forEach(function (kid) {
        list.push({ dayOfWeek: dayOfWeek, itemName: cleanItem, quantity: 1, childName: kid });
      });
      return;
    } else if (splitKids.length === 1) {
      childName = splitKids[0];
    }
  }

  // Check if itemName has brackets or parentheses, e.g. "招牌便當 (大寶)" or "招牌便當（大寶）" or "招牌便當 [大寶]"
  var bracketMatch = cleanItem.match(/^(.+?)\s*[(（\[【]([^)）\]】]+)[)）\]】]\s*$/);
  if (bracketMatch) {
    cleanItem = bracketMatch[1].trim();
    var innerText = bracketMatch[2].trim();
    if (innerText) {
      var multiKids = innerText.split(/[,、，\s]+/).filter(function (k) { return k && k.trim(); });
      if (multiKids.length > 1) {
        multiKids.forEach(function (kid) {
          list.push({ dayOfWeek: dayOfWeek, itemName: cleanItem, quantity: 1, childName: kid });
        });
        return;
      } else if (multiKids.length === 1) {
        childName = multiKids[0];
      }
    }
  }

  list.push({ dayOfWeek: dayOfWeek, itemName: cleanItem, quantity: qty, childName: childName });
}

/**
 * Detect whether a text is an announcement, order reconciliation, or audit notice
 * to prevent accidental order placement.
 */
function isAnnouncementOrReconciliation(text) {
  if (!text) return false;
  var clean = text.trim();
  // 1. Header/intent check: e.g. "目前訂餐記錄（請大家核對）", "訂餐公告", "如果需要修改訂單"
  if (/(?:目前)?(?:訂餐|點餐|訂單|訂購)(?:記錄|紀錄|明細|名單|總表|統計).*(?:核對|確認|注意|如下)/i.test(clean)) return true;
  if (/(?:請大家核對|請各位核對|請同仁核對|請核對訂單|請核對明細|核對訂單|核對名單|核對明細)/i.test(clean)) return true;
  if (/(?:訂餐公告|點餐公告|開單公告|結單公告|訂單公告)/i.test(clean)) return true;
  if (/(?:如果需要修改訂單|若需修改訂單|修改訂單請|如需更動訂單|需修改訂單)/i.test(clean)) return true;
  if (/(?:統計名單如下|訂單明細如下|目前訂餐如下)/i.test(clean)) return true;
  return false;
}

function parseOrderText(text) {
  if (!text || isAnnouncementOrReconciliation(text)) return [];
  var protectedText = _protectBrackets(text);
  var clean = protectedText.replace(/，|；/g, ',');
  var lines = clean.split(/[\n,]+/);
  var parsedItems = [];

  // Helper to test if candidate item string is actually price calculation or math
  var isMathOrPriceStr = function (str) {
    if (!str) return true;
    var s = str.trim();
    // Math operators +, -, *, /, = (e.g. 43+48, 341-313, 20=7)
    if (/[+\-*\/=]/.test(s)) return true;
    // Standalone numbers or trailing price, e.g. "45", "90", "便當 45", "餡餅 90"
    if (/(?:^|[\s$])\$?\d+$/.test(s)) return true;
    // Contains price/fee keywords
    if (/(?:元|塊|買一送一|折價|運費|差價|手續費)/.test(s)) return true;
    return false;
  };

  for (var i = 0; i < lines.length; i++) {
    var raw = _restoreBrackets(lines[i]).trim();
    if (!raw) continue;

    var dayOfWeek = null;
    var dayMatch = raw.match(/^(週[一二三四五]|禮拜[一二三四五]|星期[一二三四五])/);
    if (dayMatch) {
      var d = dayMatch[1];
      dayOfWeek = '週' + d.slice(-1);
      raw = raw.replace(dayMatch[0], '').trim();
    }

    var childPrefix = null;
    var prefixMatch = raw.match(/^([^\s:+*xX0-9@]{1,10})\s*[:：]\s*(.+)$/);
    if (prefixMatch) {
      var pKid = prefixMatch[1].trim();
      var nonKidKeywords = ['點餐', '取消', '訂單', '開單', '說明', '菜單', '注意', '備註', '時間', '預訂', '金額', '費用', '總計', '統計', '記錄', '紀錄', '公告', '地點', '取餐', '店家'];
      if (pKid.indexOf('@') !== 0 && nonKidKeywords.indexOf(pKid) === -1) {
        childPrefix = pKid;
        raw = prefixMatch[2].trim();
      }
    }

    // Check if bracket at the end of line, e.g. "排骨飯+1 (大寶)" or "+2 排骨飯 (大寶, 二寶)"
    var trailingBracket = raw.match(/(.+?)\s*[(（\[【]([^)）\]】]+)[)）\]】]\s*$/);
    if (trailingBracket) {
      if (!childPrefix) {
        childPrefix = trailingBracket[2].trim();
      }
      raw = trailingBracket[1].trim();
    }

    var qty = 1;
    var itemName = '';

    // Pattern 1: +1 排骨飯 or +2 雞腿飯
    var match1 = raw.match(/^\+([0-9]+)\s*(.+)$/);
    if (match1) {
      var cand1 = match1[2].trim();
      if (!isMathOrPriceStr(cand1)) {
        qty = parseInt(match1[1], 10);
        itemName = cand1;
        _pushParsedOrderItem(parsedItems, dayOfWeek, itemName, qty, childPrefix);
        continue;
      }
    }

    // Pattern 2: 排骨飯+1 or 雞腿飯 + 2
    var match2 = raw.match(/^(.+?)\s*\+\s*([0-9]+)$/);
    if (match2) {
      var cand2 = match2[1].trim();
      if (!isMathOrPriceStr(cand2)) {
        itemName = cand2;
        qty = parseInt(match2[2], 10);
        _pushParsedOrderItem(parsedItems, dayOfWeek, itemName, qty, childPrefix);
        continue;
      }
    }

    // Pattern 3: 排骨飯*1 or 雞腿飯 * 2 or 排骨飯x2
    var match3 = raw.match(/^(.+?)\s*[*xX]\s*([0-9]+)$/);
    if (match3) {
      var cand3 = match3[1].trim();
      if (!isMathOrPriceStr(cand3)) {
        itemName = cand3;
        qty = parseInt(match3[2], 10);
        _pushParsedOrderItem(parsedItems, dayOfWeek, itemName, qty, childPrefix);
        continue;
      }
    }

    // Pattern 4: 點餐 排骨飯 2 or 點餐 排骨飯
    var match4 = raw.match(/^點餐\s+(.+?)(?:\s+([0-9]+))?$/);
    if (match4) {
      var cand4 = match4[1].trim();
      if (!isMathOrPriceStr(cand4)) {
        itemName = cand4;
        qty = match4[2] ? parseInt(match4[2], 10) : 1;
        _pushParsedOrderItem(parsedItems, dayOfWeek, itemName, qty, childPrefix);
        continue;
      }
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
    if (itemN) {
      // Menu item contains raw user query (e.g. "招牌排骨飯" contains "排骨飯")
      if (itemN.indexOf(rawItemName) !== -1) {
        return { itemName: itemN, price: itemP || 0 };
      }
      // User query contains menu item, only if query is reasonably short and lacks arithmetic/punctuation
      if (rawItemName.indexOf(itemN) !== -1 && rawItemName.length <= itemN.length + 4 && !/[+\-*\/=0-9]/.test(rawItemName)) {
        return { itemName: itemN, price: itemP || 0 };
      }
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

  // 0. ANNOUNCEMENT / RECONCILIATION FILTER:
  // Avoid misinterpreting group announcements or order verification lists as commands or orders
  if (isAnnouncementOrReconciliation(text)) {
    return null;
  }

  // Resolve user effective locale
  var userLocale = 'zh-TW';
  if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.getEffectiveLocale) {
    userLocale = I18nModule.getEffectiveLocale(userId, userDisplayName);
  } else if (typeof getEffectiveLocale === 'function') {
    userLocale = getEffectiveLocale(userId, userDisplayName);
  }

  var _translateMsg = function (k, p) {
    if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.t) {
      return I18nModule.t(k, p, userLocale);
    }
    if (typeof t === 'function') {
      return t(k, p, userLocale);
    }
    return k;
  };

  var _displayDay = function (sheetDay) {
    if (typeof I18nModule !== 'undefined' && I18nModule && typeof I18nModule.displayDayOfWeek === 'function') {
      return I18nModule.displayDayOfWeek(sheetDay, userLocale);
    }
    if (typeof displayDayOfWeek === 'function') {
      return displayDayOfWeek(sheetDay, userLocale);
    }
    return sheetDay;
  };

  var _getCmdRegex = function (cmdKey, fallbackRegex) {
    if (typeof I18nModule !== 'undefined' && I18nModule && typeof I18nModule.buildCommandRegex === 'function') {
      return I18nModule.buildCommandRegex(cmdKey);
    }
    if (typeof buildCommandRegex === 'function') {
      return buildCommandRegex(cmdKey);
    }
    return fallbackRegex;
  };

  // 1. HELP: 幫助 / 說明 / 指令 / help
  var helpRegex = _getCmdRegex('cmd.help', /^(幫助|說明|指令|help|\/help)$/i);

  if (helpRegex.test(text)) {
    var sourceCodeUrl = SheetModule.getConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee');
    var helpFlex = FlexModule.createHelpFlex(sourceCodeUrl, userLocale);
    var helpAlt = _translateMsg('help.alt_text');
    return LineModule.replyFlex(replyToken, helpAlt || '便當點餐指令說明', helpFlex);
  }

  // 1-1. LANGUAGE SETTINGS: 設定語言 / 切換語言 / lang / language
  var langCmdRegex = _getCmdRegex('cmd.lang', /^(?:\/)?(?:設定語言|切換語言|語言設定|語言|lang|language)$/i);

  var langParamMatch = text.match(/^(?:\/)?(?:設定語言|切換語言|語言設定|語言|lang|language|set language|switch language)\s+([a-zA-Z\-_]+)$/i);
  if (langCmdRegex.test(text) || langParamMatch) {
    var userLocaleEnabled = false;
    if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.isUserLocaleEnabled) {
      userLocaleEnabled = I18nModule.isUserLocaleEnabled();
    } else if (typeof isUserLocaleEnabled === 'function') {
      userLocaleEnabled = isUserLocaleEnabled();
    }

    if (!userLocaleEnabled) {
      return LineModule.replyText(replyToken, _translateMsg('lang.disabled'));
    }

    if (langParamMatch) {
      var targetLang = langParamMatch[1].trim();
      var supported = (typeof SUPPORTED_LOCALES !== 'undefined') ? SUPPORTED_LOCALES : (I18nModule && I18nModule.SUPPORTED_LOCALES) || {};
      // Normalize match (case-insensitive find)
      var matchedCode = null;
      for (var sc in supported) {
        if (sc.toLowerCase() === targetLang.toLowerCase()) {
          matchedCode = sc;
          break;
        }
      }
      if (!matchedCode) {
        return LineModule.replyText(replyToken, _translateMsg('lang.invalid', {
          lang: targetLang,
          options: Object.keys(supported).join(', ')
        }));
      }

      if (typeof SheetModule !== 'undefined' && SheetModule.setUserLocalePreference) {
        SheetModule.setUserLocalePreference(userId, matchedCode, userDisplayName);
      }
      var langName = supported[matchedCode] ? supported[matchedCode].name : matchedCode;
      var successMsg = (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.t)
        ? I18nModule.t('lang.set_success', { lang: langName }, matchedCode)
        : '✅ 語言已成功切換為「' + langName + '」！後續個人訊息將以此語言呈現。';
      return LineModule.replyText(replyToken, successMsg);
    }

    var langFlex = FlexModule.createLanguageSelectFlex(userLocale);
    return LineModule.replyFlex(replyToken, _translateMsg('lang.title') || '語言設定', langFlex);
  }

  // 2. WEEKLY SCHEDULE: 本週菜單 / 每週菜單 / 排程 / 本週排程
  var weeklyRegex = _getCmdRegex('cmd.weekly', /^(?:\/)?(?:本週菜單|每週菜單|本週排程|排程|週排程)$/i);
  if (weeklyRegex.test(text)) {
    var schedule = SheetModule.getWeeklySchedule();
    var scheduleFlex = FlexModule.createWeeklyScheduleFlex(schedule, userLocale);
    var altSchedule = (userLocale === 'zh-TW') ? '📅 本週訂餐排程表 (週一至週五)' : (_translateMsg('schedule.alt_text') || '📅 本週訂餐排程表 (週一至週五)');
    return LineModule.replyFlex(replyToken, altSchedule, scheduleFlex);
  }

  // 3. DAY SPECIFIC MENU: 週一菜單 / 週二菜單 / 週三菜單 ...
  var DAY_MENU_ALIAS_MAP = {
    '週一': '週一', '禮拜一': '週一', '星期一': '週一', 'monday': '週一', 'mon': '週一', '月曜': '週一', '月曜日': '週一', '월요일': '週一', '월': '週一', 'จันทร์': '週一', 'senin': '週一',
    '週二': '週二', '禮拜二': '週二', '星期二': '週二', 'tuesday': '週二', 'tue': '週二', '火曜': '週二', '火曜日': '週二', '화요일': '週二', '화': '週二', 'อังคาร': '週二', 'selasa': '週二',
    '週三': '週三', '禮拜三': '週三', '星期三': '週三', 'wednesday': '週三', 'wed': '週三', '水曜': '週三', '水曜日': '週三', '수요일': '週三', '수': '週三', 'พุธ': '週三', 'rabu': '週三',
    '週四': '週四', '禮拜四': '週四', '星期四': '週四', 'thursday': '週四', 'thu': '週四', '木曜': '週四', '木曜日': '週四', '목요일': '週四', '목': '週四', 'พฤหัส': '週四', 'kamis': '週四',
    '週五': '週五', '禮拜五': '週五', '星期五': '週五', 'friday': '週五', 'fri': '週五', '金曜': '週五', '金曜日': '週五', '금요일': '週五', '금': '週五', 'ศุกร์': '週五', 'jumat': '週五'
  };
  var dayMenuMatch = text.match(/^(?:本週)?([^\s]+)\s*(?:菜單|menu|メニュー|메뉴|เมนู)$/i);
  if (dayMenuMatch && DAY_MENU_ALIAS_MAP[dayMenuMatch[1].toLowerCase()]) {
    var targetDay = DAY_MENU_ALIAS_MAP[dayMenuMatch[1].toLowerCase()];
    var daySchedule = SheetModule.getScheduleByDay(targetDay);
    var restName = daySchedule ? daySchedule.restaurantName : targetDay + '便當';
    var cutoff = daySchedule ? daySchedule.cutoffTime : '10:30';
    var dayMenu = SheetModule.getMenuItems(targetDay, restName);
    var dayMenuFlex = FlexModule.createMenuFlex(restName, cutoff, dayMenu, targetDay, userLocale);
    var dayAltText = (userLocale === 'zh-TW') ? (targetDay + ' ' + restName + ' 菜單') : (_translateMsg('menu.alt_text', { restaurant: restName }) || (targetDay + ' ' + restName + ' 菜單'));
    return LineModule.replyFlex(replyToken, dayAltText, dayMenuFlex);
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

  // 4b. CUSTOM RESTAURANT IMPORT VIA CHAT: 匯入自訂餐廳 [週幾] [餐廳名稱] / 匯入餐廳 [週幾] [餐廳名稱]
  // ⚠️ 暫時關閉聊天室匯入指令，避免一般使用者誤觸；待未來提供管理員與一般使用者權限隔離時再開啟。目前僅保留 Google 試算表選單操作。
  /*
  var customImportMatch = text.match(/^(?:匯入自訂餐廳|匯入餐廳|自訂餐廳匯入)\s+(週[一二三四五]|ALL)\s+(.+)$/i);
  if (customImportMatch) {
    var customDay = customImportMatch[1];
    var customRestName = customImportMatch[2].trim();

    var customResult = SheetModule.importCustomRestaurantMenu(customDay, customRestName);
    if (!customResult || !customResult.success) {
      if (customResult && customResult.reason === 'SYSTEM_TAB') {
        return LineModule.replyText(replyToken, '❌ 匯入失敗：「' + customRestName + '」為系統專用功能工作表，不可作為自訂餐廳。');
      }
      return LineModule.replyText(replyToken, '⚠️ 匯入失敗：找不到工作表名稱為【' + customRestName + '】的自訂餐廳菜單。\n請先確認試算表中已新增同名工作表（完全符合），且包含菜單欄位。');
    }

    var successMsg = '✅ 已成功從自訂餐廳【' + customResult.restaurantName + '】匯入至 ' + customDay + ' 菜單！\n共匯入 ' + (customResult.count || 0) + ' 道餐點。\n可直接傳送「' + customDay + '菜單」查看。';
    return LineModule.replyText(replyToken, successMsg);
  }
  */

  // 5. OPEN ORDER: 開單 [店家] [時間] / 開始訂餐
  var openMatch = text.match(/^(?:\/)?(?:開單|開始訂餐)(?:\s+(.+?))?(?:\s+([0-9]{1,2}:[0-9]{2}))?$/);
  if (openMatch) {
    var currentOrganizerId = (SheetModule.getConfigValue('ORGANIZER_ID', '') || '').trim();
    var allowSwitch = SheetModule.getConfigValue('ALLOW_SWITCH_ORGANIZER', 'true');
    var isSwitchForbidden = (String(allowSwitch).toLowerCase() === 'false' || allowSwitch === '0');

    var isOrganizer = isUserOrganizer(userId, userDisplayName);
    if (isSwitchForbidden && currentOrganizerId && !isOrganizer) {
      return LineModule.replyText(replyToken, '⚠️ 目前系統設定已鎖定開單人，非現任開單人無法重新開單或更換開單人！若需開單請洽現任開單人。');
    }

    var restaurant = openMatch[1] ? openMatch[1].trim() : '今日便當';
    var cutoff = openMatch[2] ? openMatch[2].trim() : '11:00';

    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'true');
    SheetModule.setConfigValue('RESTAURANT_NAME', restaurant);
    SheetModule.setConfigValue('CUTOFF_TIME', cutoff);
    var effOrganizerId = (SheetModule && typeof SheetModule.getEffectiveUserId === 'function')
      ? SheetModule.getEffectiveUserId(userId, userDisplayName, userDisplayName)
      : userId;
    SheetModule.setConfigValue('ORGANIZER_ID', effOrganizerId);

    var menuList = SheetModule.getMenuItems(todayDay, restaurant);
    var menuFlex = FlexModule.createMenuFlex(restaurant, cutoff, menuList, todayDay);
    return LineModule.replyFlex(replyToken, '【訂餐開始】' + restaurant + ' 菜單', menuFlex);
  }

  // 6. TODAY MENU: 菜單 / menu
  var todayMenuRegex = _getCmdRegex('cmd.menu', /^(?:\/)?(?:菜單|menu)$/i);
  if (todayMenuRegex.test(text)) {
    var curRestaurant = SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var curCutoff = SheetModule.getConfigValue('CUTOFF_TIME', '11:00');
    var curMenu = SheetModule.getMenuItems(todayDay, curRestaurant);
    var curMenuFlex = FlexModule.createMenuFlex(curRestaurant, curCutoff, curMenu, todayDay, userLocale);
    var curAltText = (userLocale === 'zh-TW') ? (curRestaurant + ' 菜單') : (_translateMsg('menu.alt_text', { restaurant: curRestaurant }) || (curRestaurant + ' 菜單'));
    return LineModule.replyFlex(replyToken, curAltText, curMenuFlex);
  }

  // Helper to format payment text for personal order queries
  function _formatPaymentText(payInfo, loc) {
    if (!payInfo || !payInfo.hasPaymentInfo) return '';
    var l = loc || userLocale || 'zh-TW';
    if (l === 'zh-TW') {
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

    // Localized version
    var pLines = ['\n' + _translateMsg('payment.info_title')];
    if (payInfo.bankAccount || payInfo.bankCode || payInfo.bankQrUrl) {
      var bankStr = (payInfo.bankCode ? payInfo.bankCode + ' ' : '') + (payInfo.bankName || _translateMsg('payment.bank_transfer'));
      if (payInfo.bankAccount) {
        pLines.push(_translateMsg('payment.bank_transfer_bullet') + bankStr + ' ' + _translateMsg('payment.account_number', { account: payInfo.bankAccount }) + (payInfo.bankAccountName ? ' (' + payInfo.bankAccountName + ')' : ''));
      }
      if (payInfo.bankQrUrl) {
        pLines.push(_translateMsg('payment.bank_qr_bullet') + payInfo.bankQrUrl);
      }
    }
    if (payInfo.linePayUrl) {
      if (payInfo.isPersonalLinePay) {
        var idHint = payInfo.linePayUserId ? ' (LINE ID: ' + payInfo.linePayUserId + ')' : '';
        pLines.push(_translateMsg('payment.linepay_friend_bullet') + payInfo.linePayUrl);
        pLines.push('  (' + _translateMsg('payment.linepay_hint', { recipient: payInfo.linePayRecipientName, idHint: idHint }) + ')');
      } else {
        pLines.push(_translateMsg('payment.linepay_bullet') + payInfo.linePayUrl);
      }
    }
    if (payInfo.linePayQrUrl) {
      pLines.push(_translateMsg('payment.linepay_qr_bullet') + payInfo.linePayQrUrl);
    }
    return pLines.join('\n');
  }

  // 7. MY WEEKLY ORDERS: 我的本週訂單 / 本週訂單
  var myWeeklyRegex = _getCmdRegex('cmd.my_weekly', /^(?:\/)?(?:我的本週訂單|本週訂單)$/i);
  if (myWeeklyRegex.test(text)) {
    var allDays = ['週一', '週二', '週三', '週四', '週五'];
    var lines = [];
    var grandTotal = 0;

    allDays.forEach(function (d) {
      var dOrders = SheetModule.getUserOrders(userId, groupId, null, d, userDisplayName);
      if (dOrders && dOrders.length > 0) {
        var daySub = 0;
        var isPast = isDayPast(d);
        var isCutoff = (d === todayDay) && isTodayCutoffPassed(d);
        var lockTag = '';
        if (isPast) {
          lockTag = (userLocale === 'zh-TW') ? ' 🔒[已過期]' : (' 🔒[' + _translateMsg('cancel.reason_expired') + ']');
        } else if (isCutoff) {
          lockTag = (userLocale === 'zh-TW') ? ' 🔒[已截止]' : (' 🔒[' + _translateMsg('cancel.reason_cutoff') + ']');
        }
        var itemsText = dOrders.map(function (o) {
          daySub += o.subtotal;
          var childTag = o.childName ? ' [' + o.childName + ']' : '';
          return o.itemName + childTag + ' x' + o.quantity + ' ($' + o.subtotal + ')';
        }).join(userLocale === 'zh-TW' ? '、' : ', ');
        grandTotal += daySub;
        var subtotalText = (userLocale === 'zh-TW')
          ? (' (小計 $' + daySub + ')')
          : _translateMsg('my_orders.subtotal', { subtotal: daySub });
        var displayD = (userLocale === 'zh-TW') ? d : (_displayDay(d) || d);
        lines.push('【' + displayD + lockTag + '】' + itemsText + subtotalText);
      }
    });

    if (lines.length === 0) {
      return LineModule.replyText(replyToken, (userLocale === 'zh-TW') ? '您本週（週一至週五）尚未有任何預訂紀錄喔！' : _translateMsg('my_orders.no_weekly_orders'));
    }

    var payInfoWeekly = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var payTextWeekly = _formatPaymentText(payInfoWeekly, userLocale);
    var weeklyMsg;
    if (userLocale === 'zh-TW') {
      weeklyMsg = '🍱【您的本週梯次訂單】\n' + lines.join('\n') + '\n─────\n本週總計：$' + grandTotal + ' 元' + payTextWeekly;
    } else {
      weeklyMsg = _translateMsg('my_orders.weekly_title') + '\n' + lines.join('\n') + '\n─────\n' + _translateMsg('my_orders.weekly_total', { amount: grandTotal }) + payTextWeekly;
    }
    return LineModule.replyText(replyToken, weeklyMsg);
  }

  // 8. MY TODAY ORDERS: 我的訂單 / 查詢訂單 / 查單
  var myOrderRegex = _getCmdRegex('cmd.my_order', /^(?:\/)?(?:我的訂單|查詢訂單|查單)$/i);
  if (myOrderRegex.test(text)) {
    var myOrders = SheetModule.getUserOrders(userId, groupId, null, todayDay, userDisplayName);
    if (!myOrders || myOrders.length === 0) {
      myOrders = SheetModule.getUserOrders(userId, groupId, todayDate, null, userDisplayName);
    }
    if (!myOrders || myOrders.length === 0) {
      return LineModule.replyText(replyToken, (userLocale === 'zh-TW') ? '您今日尚未有訂餐紀錄喔！可以直接輸入「+1 [餐點名稱]」點餐。' : _translateMsg('my_orders.no_today_orders'));
    }
    var isCutoff = isTodayCutoffPassed(todayDay);
    var statusTag = '';
    if (isCutoff) {
      statusTag = (userLocale === 'zh-TW') ? ' 🔒[已截止]' : (' 🔒[' + _translateMsg('cancel.reason_cutoff') + ']');
    }
    var total = 0;
    var myLines = myOrders.map(function (o) {
      total += o.subtotal;
      var childTag = o.childName ? ' [' + o.childName + ']' : '';
      return '• ' + o.itemName + childTag + ' x' + o.quantity + ' ($' + o.subtotal + ')' + statusTag;
    });
    var payInfoToday = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var payTextToday = _formatPaymentText(payInfoToday, userLocale);
    var cutoffNotice = isCutoff
      ? ((userLocale === 'zh-TW') ? '\n⚠️ 今日點餐已超過截止時間，不可修改或取消餐點。' : _translateMsg('my_orders.cutoff_notice'))
      : '';
    var msg;
    if (userLocale === 'zh-TW') {
      msg = '【您的今日訂單】\n' + myLines.join('\n') + '\n─────\n總計：$' + total + ' 元' + cutoffNotice + payTextToday;
    } else {
      msg = _translateMsg('my_orders.today_title') + '\n' + myLines.join('\n') + '\n─────\n' + _translateMsg('my_orders.today_total', { amount: total }) + cutoffNotice + payTextToday;
    }
    return LineModule.replyText(replyToken, msg);
  }

  // 8.5 CHILDREN MANAGEMENT: 我的小孩 / 小孩名冊 / 小孩名單 / 設定小孩 / 新增小孩 / 刪除小孩
  var myKidsRegex = _getCmdRegex('cmd.my_kids', /^(?:\/)?(?:我的小孩|小孩名單|小孩名冊|我的孩子)$/i);
  if (myKidsRegex.test(text.trim())) {
    var kidsProfiles = SheetModule.getChildrenProfiles ? SheetModule.getChildrenProfiles(userId, userDisplayName, userDisplayName) : [];
    if (kidsProfiles.length === 0) {
      var kidNames = SheetModule.getChildren ? SheetModule.getChildren(userId, userDisplayName, userDisplayName) : [];
      kidsProfiles = kidNames.map(function (k) { return { childName: k, note: '' }; });
    }
    var kidsFlex = FlexModule.createChildrenListFlex(userDisplayName, kidsProfiles, userLocale);
    var kidsAltText = (userLocale === 'zh-TW') ? '👶 我的小孩與用餐對象名冊' : (_translateMsg('children_list.alt_text') || '👶 我的小孩與用餐對象名冊');
    return LineModule.replyFlex(replyToken, kidsAltText, kidsFlex);
  }

  // 8.5.1 CHILDREN SUBMENU: 設定小孩 / 小孩設定 / 登記小孩 / 小孩選單 / 小孩管理 (無帶參數時回覆按鈕子選單)
  var childrenSubmenuRegex = _getCmdRegex('cmd.children', /^(?:\/)?(?:設定小孩|小孩設定|登記小孩|小孩選單|小孩管理|小孩幫助)$/i);
  if (childrenSubmenuRegex.test(text.trim())) {
    var childrenSubmenuFlex = FlexModule.createChildrenHelpFlex(userLocale);
    var childrenSubmenuAlt = (userLocale === 'zh-TW') ? '👶 小孩與用餐對象管理選單' : (_translateMsg('children_menu.alt_text') || '👶 小孩與用餐對象管理選單');
    return LineModule.replyFlex(replyToken, childrenSubmenuAlt, childrenSubmenuFlex);
  }

  var setKidsPrefix = (typeof I18nModule !== 'undefined' && I18nModule.buildCommandPrefixPattern) ? I18nModule.buildCommandPrefixPattern('cmd.children') : '(?:\\/)?(?:設定小孩|小孩設定|登記小孩)';
  var setKidsMatch = text.match(new RegExp('^' + setKidsPrefix + '\\s+(.+)$', 'i'));
  if (setKidsMatch) {
    var rawList = setKidsMatch[1].trim();
    var kidList = rawList.split(/[,、\s]+/).map(function (n) { return n.trim(); }).filter(function (n) { return n && n !== '本人' && n !== '自己'; });
    if (kidList.length === 0) {
      return LineModule.replyText(replyToken, '⚠️ 請輸入欲設定的小孩姓名，例如：「設定小孩 大寶, 二寶」');
    }
    if (SheetModule.setChildren) {
      SheetModule.setChildren(userId, userDisplayName, userDisplayName, kidList);
    }
    return LineModule.replyText(replyToken, '✅ 已為您成功設定小孩名冊：' + kidList.join('、') + '！\n💡 下次點餐點擊菜單上的「+1 點餐」按鈕，系統將會自動浮出小孩捷徑讓您一秒直選！');
  }

  var addKidPrefix = (typeof I18nModule !== 'undefined' && I18nModule.buildCommandPrefixPattern) ? I18nModule.buildCommandPrefixPattern('cmd.add_kid') : '(?:\\/)?(?:新增小孩|加小孩)';
  if (new RegExp('^' + addKidPrefix + '$', 'i').test(text.trim())) {
    return LineModule.replyText(replyToken, '⚠️ 請輸入小孩姓名與班級備註，例如：「新增小孩 小寶 附小一年一班」');
  }

  var addKidMatch = text.match(new RegExp('^' + addKidPrefix + '\\s+([^\\s]+)(?:\\s+(.+))?$', 'i'));
  if (addKidMatch) {
    var newKidName = addKidMatch[1].trim();
    var kidNote = (addKidMatch[2] || '').trim();
    if (!newKidName) {
      return LineModule.replyText(replyToken, '⚠️ 請輸入小孩姓名，例如：「新增小孩 小寶 附小一年一班」');
    }
    if (SheetModule.saveChild) {
      SheetModule.saveChild(userId, userDisplayName, userDisplayName, newKidName, kidNote);
    }
    return LineModule.replyText(replyToken, '✅ 已成功新增小孩「' + newKidName + '」' + (kidNote ? '（' + kidNote + '）' : '') + '！');
  }

  var delKidPrefix = (typeof I18nModule !== 'undefined' && I18nModule.buildCommandPrefixPattern) ? I18nModule.buildCommandPrefixPattern('cmd.del_kid') : '(?:\\/)?(?:刪除小孩|移除小孩)';
  if (new RegExp('^' + delKidPrefix + '$', 'i').test(text.trim())) {
    return LineModule.replyText(replyToken, '⚠️ 請輸入欲刪除的小孩姓名，例如：「刪除小孩 小寶」');
  }

  var delKidMatch = text.match(new RegExp('^' + delKidPrefix + '\\s+([^\\s]+)$', 'i'));
  if (delKidMatch) {
    var delKidName = delKidMatch[1].trim();
    var deleted = SheetModule.deleteChild ? SheetModule.deleteChild(userId, delKidName, userDisplayName, userDisplayName) : false;
    if (deleted) {
      return LineModule.replyText(replyToken, '✅ 已成功移除小孩「' + delKidName + '」的名冊紀錄。');
    } else {
      return LineModule.replyText(replyToken, '⚠️ 未找到名為「' + delKidName + '」的小孩紀錄喔！');
    }
  }

  // 9. CANCEL ORDER: 取消 [週幾] [品項] / 取消餐點 / 開單人全體取消與二次確認
  // 9-1. 放棄取消
  var abortCancelRegex = _getCmdRegex('cmd.abort_cancel', /^(?:\/)?(?:放棄取消|取消操作)$/i);
  if (abortCancelRegex.test(text.trim())) {
    return LineModule.replyText(replyToken, '👌 已放棄取消操作，現有訂單均完整保留。');
  }

  // 9-2. 開單人二次確認執行：確認取消全體 [週幾] / 確認取消今日全部
  var confirmDayCancelMatch = text.match(/^(?:\/)?(?:確認取消全體(?:\s*(週[一二三四五]|今日))?|確認取消今日全部)$/);
  if (confirmDayCancelMatch) {
    var isOrgDayConfirm = isUserOrganizer(userId, userDisplayName);
    if (!isOrgDayConfirm) {
      return LineModule.replyText(replyToken, '⚠️ 權限不足：只有開單人可以取消當日所有餐點。');
    }
    var dayArg = confirmDayCancelMatch[1] || todayDay;
    if (dayArg === '今日') dayArg = todayDay;
    if (isDayPast(dayArg)) {
      return LineModule.replyText(replyToken, '⚠️ 【' + dayArg + '】已超過日期，過去梯次的餐點無法修改或取消喔！');
    }
    if (dayArg === todayDay && isTodayCutoffPassed(dayArg)) {
      return LineModule.replyText(replyToken, '⚠️ 今日點餐已超過結單時間，無法取消餐點。');
    }
    var cCount = SheetModule.cancelGroupOrders ? SheetModule.cancelGroupOrders(groupId, null, dayArg) : SheetModule.cancelOrder(null, groupId, null, null, dayArg);
    if (cCount > 0) {
      var nowTw = formatAppDate();
      var notifMsg = '📢【訂餐通知 - 開單人取消當日全體餐點】\n👤 執行開單人：' + userDisplayName + '\n📅 梯次：' + dayArg + '\n🗑️ 已取消該日全體成員訂單共 ' + cCount + ' 筆紀錄。\n⏰ 時間：' + nowTw;
      notifyOrganizer(notifMsg);
      return LineModule.replyText(replyToken, '✅ 已由開單人成功取消【' + dayArg + '】全體成員的所有餐點紀錄，共 ' + cCount + ' 筆。');
    } else {
      return LineModule.replyText(replyToken, '【' + dayArg + '】目前無任何未取消的有效訂單。');
    }
  }

  // 9-3. 開單人二次確認執行：確認取消所有未截止預約訂單
  var confirmAllAdvanceMatch = text.match(/^(?:\/)?(?:確認取消所有未截止(?:預約)?訂單|確認取消全體未截止預約(?:訂單)?)$/);
  if (confirmAllAdvanceMatch) {
    var isOrgAllConfirm = isUserOrganizer(userId, userDisplayName);
    if (!isOrgAllConfirm) {
      return LineModule.replyText(replyToken, '⚠️ 權限不足：只有開單人可以取消所有未截止預約訂單。');
    }
    var allDays = ['週一', '週二', '週三', '週四', '週五'];
    var validDays = allDays.filter(function (d) {
      if (isDayPast(d)) return false;
      if (d === todayDay && isTodayCutoffPassed(d)) return false;
      return true;
    });
    var totalAdvCancelled = 0;
    validDays.forEach(function (d) {
      totalAdvCancelled += SheetModule.cancelGroupOrders ? SheetModule.cancelGroupOrders(groupId, null, d) : SheetModule.cancelOrder(null, groupId, null, null, d);
    });
    if (totalAdvCancelled > 0) {
      var nowTwAdv = formatAppDate();
      var notifAdvMsg = '📢【訂餐通知 - 開單人取消所有未截止預約訂單】\n👤 執行開單人：' + userDisplayName + '\n🗑️ 已取消全體成員未截止預約共 ' + totalAdvCancelled + ' 筆。\n⏰ 時間：' + nowTwAdv;
      notifyOrganizer(notifAdvMsg);
      return LineModule.replyText(replyToken, '✅ 已由開單人成功取消全體成員所有未截止梯次的預約訂單，共 ' + totalAdvCancelled + ' 筆紀錄。');
    } else {
      return LineModule.replyText(replyToken, '本週目前無任何未截止的有效預約訂單。');
    }
  }

  // 9-4. 開單人請求取消當日全體餐點 (跳出二次確認警告卡)
  var reqDayCancelMatch = text.match(/^(?:\/)?(?:取消(?:當日|今日|全體今日)所有餐點|取消全體\s*(週[一二三四五]|今日)?|取消當日全部)$/);
  if (reqDayCancelMatch) {
    var isOrgDayReq = isUserOrganizer(userId, userDisplayName);
    if (!isOrgDayReq) {
      return LineModule.replyText(replyToken, '⚠️ 權限不足：只有開單人可以取消當日所有餐點。您只能取消自己訂購的餐點喔！');
    }
    var targetDayReq = reqDayCancelMatch[1] || todayDay;
    if (targetDayReq === '今日') targetDayReq = todayDay;
    if (isDayPast(targetDayReq)) {
      return LineModule.replyText(replyToken, '⚠️ 【' + targetDayReq + '】已超過日期，過去梯次的餐點無法取消喔！');
    }
    if (targetDayReq === todayDay && isTodayCutoffPassed(targetDayReq)) {
      return LineModule.replyText(replyToken, '⚠️ 今日點餐已超過結單時間，無法取消餐點。');
    }
    var warnFlex = FlexModule.createConfirmCancelFlex(
      '⚠️ 確認取消【' + targetDayReq + '】當日全體餐點？',
      '此操作將會取消【' + targetDayReq + '】所有成員已訂購的餐點紀錄，並清空該梯次訂單。',
      '確認取消全體 ' + targetDayReq,
      '⚠️ 確認取消【' + targetDayReq + '】全體餐點',
      userLocale
    );
    return LineModule.replyFlex(replyToken, '⚠️ 開單人取消當日全體餐點確認', warnFlex);
  }

  // 9-5. 開單人請求取消全體未截止預約訂單 (跳出二次確認警告卡)
  var reqAllAdvanceMatch = text.match(/^(?:\/)?(?:取消所有未截止(?:預約)?訂單|取消全體\s*未截止預約訂單|取消全體預約)$/);
  if (reqAllAdvanceMatch) {
    var isOrgAllReq = isUserOrganizer(userId, userDisplayName);
    if (!isOrgAllReq) {
      return LineModule.replyText(replyToken, '⚠️ 權限不足：只有開單人可以取消所有未截止預約訂單。您只能取消自己訂購的餐點喔！若要取消個人全部預約，請輸入「取消我的 全部」。');
    }
    var warnFlexAll = FlexModule.createConfirmCancelFlex(
      '🚨 確認取消全體所有未截止預約訂單？',
      '此操作將會取消本週所有未截止梯次中【全體成員】的所有預約訂單紀錄。',
      '確認取消所有未截止預約訂單',
      '🚨 確認取消全體未截止預約',
      userLocale
    );
    return LineModule.replyFlex(replyToken, '🚨 開單人取消全體預約訂單確認', warnFlexAll);
  }

  // 9-6. 顯示取消訂單互動選單 (取消 / 取消餐點)
  var cancelMenuRegex = _getCmdRegex('cmd.cancel', /^(?:\/)?(?:取消餐點|取消)(?:\s+餐點)?$/i);
  if (cancelMenuRegex.test(text.trim())) {
    var isOrgMenu = isUserOrganizer(userId, userDisplayName);
    // CRITICAL: The cancellation interactive menu is STRICTLY a personal cancellation menu!
    // It must NEVER show other members' orders, whether called by a regular member or the organizer.
    var activeOrders = SheetModule.getUserOrders(userId, groupId, null, null, userDisplayName);
    if (activeOrders && activeOrders.length > 0) {
      activeOrders = activeOrders.filter(function (o) {
        if (userDisplayName && userDisplayName !== '成員') {
          if (o.userName && o.userName !== '成員' && o.userName !== userDisplayName && o.userNickname !== userDisplayName) {
            return false;
          }
        }
        if (userId && userId !== 'anonymous') {
          var effUserId = SheetModule && SheetModule.getEffectiveUserId ? SheetModule.getEffectiveUserId(userId, userDisplayName, userDisplayName) : userId;
          if (o.userId && o.userId !== 'anonymous' && o.userId !== userId && o.userId !== effUserId) {
            return false;
          }
        }
        return true;
      });
    }

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
    var cancelFlex = FlexModule.createCancelOrderFlex(userDisplayName, activeOrders, lockMap, isOrgMenu, userLocale);
    var cancelAltText = (userLocale === 'zh-TW') ? '🗑️ 請選擇欲取消的餐點' : (_translateMsg('cancel.alt_text') || '🗑️ 請選擇欲取消的餐點');
    return LineModule.replyFlex(replyToken, cancelAltText, cancelFlex);
  }

  // 9-7. 取消 全部 (未加 "我的" 關鍵字)
  if (/^(?:\/)?取消\s*(?:全部|全部訂單|所有訂單)$/.test(text.trim())) {
    var isOrgAllPlain = isUserOrganizer(userId, userDisplayName);
    if (!isOrgAllPlain) {
      return LineModule.replyText(replyToken, '⚠️ 權限不足：只有開單人可以取消全體預約訂單。若要取消您個人的所有預約，請輸入「取消我的 全部」或輸入「取消」開啟個人退訂選單。');
    }
    var warnFlexPlain = FlexModule.createConfirmCancelFlex(
      '🚨 確認取消全體所有未截止預約訂單？',
      '此操作將會取消本週所有未截止梯次中【全體成員】的所有預約訂單紀錄。',
      '確認取消所有未截止預約訂單',
      '🚨 確認取消全體未截止預約',
      userLocale
    );
    return LineModule.replyFlex(replyToken, '🚨 開單人取消全體預約訂單確認', warnFlexPlain);
  }

  // 9-8. 取消指定餐點 / 取消他人餐點 / 取消個人全部餐點
  var cancelGeneralMatch = text.match(/^(?:\/)?(?:取消我的|取消)\s+(.+)$/);
  if (cancelGeneralMatch) {
    var isOrgGen = isUserOrganizer(userId, userDisplayName);
    var remainder = cancelGeneralMatch[1].trim();
    var isExplicitMy = text.indexOf('取消我的') !== -1;

    // Check if remainder is "全部" or "所有預約" -> 取消我的 全部
    if (remainder === '全部' || remainder === '全部訂單' || remainder === '所有預約' || remainder === '所有訂單') {
      var allUserOrders = SheetModule.getUserOrders(userId, groupId, null, null, userDisplayName);
      var cancellableOrders = allUserOrders.filter(function (o) {
        if (isDayPast(o.dayOfWeek)) return false;
        if (o.dayOfWeek === todayDay && isTodayCutoffPassed(o.dayOfWeek)) return false;
        return true;
      });
      if (cancellableOrders.length === 0) {
        return LineModule.replyText(replyToken, '⚠️ 目前所有訂單均已超過截止時間或日期，無法修改或取消囉！若需異動請洽開單人。');
      }
      var totalMyCancelled = 0;
      var myCancelledSummary = [];
      cancellableOrders.forEach(function (co) {
        var c = SheetModule.cancelOrder(userId, groupId, co.itemName, null, co.dayOfWeek, userDisplayName);
        if (c > 0) {
          totalMyCancelled += c;
          myCancelledSummary.push('• 【' + co.dayOfWeek + '】' + co.itemName + ' x' + co.quantity);
        }
      });
      if (totalMyCancelled > 0) {
        var nowTwMy = formatAppDate();
        var pushMsgMy = '📢【訂餐通知 - 取消餐點】\n👤 訂餐人：' + userDisplayName + '\n🗑️ 取消內容：未截止梯次個人全部餐點 (共 ' + totalMyCancelled + ' 筆)\n' + myCancelledSummary.join('\n') + '\n⏰ 時間：' + nowTwMy;
        notifyOrganizer(pushMsgMy);
        return LineModule.replyText(replyToken, '✅ 已為您取消個人所有未截止梯次餐點，共 ' + totalMyCancelled + ' 筆紀錄。已通知開單人！');
      } else {
        return LineModule.replyText(replyToken, '查無符合條件的未取消訂單。');
      }
    }

    var targetUserObj = null;
    var targetUserId = userId;
    var targetDisplayName = userDisplayName;
    var cancelDay = null;
    var targetItem = '';
    var cancelChild = '';

    // Extract day prefix if present (e.g. "週一 招牌三寶飯" or "今日 脆皮燒肉飯")
    var prefixDayMatch = remainder.match(/^(週[一二三四五]|今日)(?:\s+(.*))?$/);
    if (prefixDayMatch) {
      cancelDay = prefixDayMatch[1] === '今日' ? todayDay : prefixDayMatch[1];
      remainder = prefixDayMatch[2] ? prefixDayMatch[2].trim() : '';
    }

    // Check if bracket suffix specifies a child: e.g. "招牌便當 (大寶)" or "(大寶)" or "[大寶]"
    var bracketMatch = remainder.match(/(?:^|\s*)[(（\[【]([^)）\]】]+)[)）\]】]\s*$/);
    if (bracketMatch) {
      cancelChild = bracketMatch[1].trim();
      remainder = remainder.replace(bracketMatch[0], '').trim();
    }

    // Check if remainder starts with a registered child name or child in active orders
    var myChildren = SheetModule.getChildren ? SheetModule.getChildren(userId, userDisplayName, userDisplayName) : [];
    if (!cancelChild && remainder) {
      var childTokens = remainder.split(/\s+/);
      var candidateChild = childTokens[0];
      var isKnownChild = myChildren.indexOf(candidateChild) !== -1;
      if (!isKnownChild) {
        var myExistingOrders = SheetModule.getUserOrders ? SheetModule.getUserOrders(userId, groupId, null, null, userDisplayName) : [];
        isKnownChild = myExistingOrders.some(function (o) { return o.childName === candidateChild; });
      }
      if (isKnownChild) {
        cancelChild = candidateChild;
        remainder = childTokens.slice(1).join(' ').trim();
      }
    }

    // Check if remainder specifies another user: e.g. "@Carol 舒肥嫩雞胸餐盒" or "小鮑伯 舒肥嫩雞胸餐盒" or "小鮑伯 全部"
    if (!isExplicitMy && remainder) {
      var tokens = remainder.split(/\s+/);
      var firstToken = tokens[0];
      if (!/^(?:週[一二三四五]|今日)$/.test(firstToken) && firstToken !== cancelChild) {
        var userInGroup = SheetModule.findUserInGroup ? SheetModule.findUserInGroup(groupId, firstToken) : null;
        var isOtherToken = false;
        if (firstToken.indexOf('@') === 0) {
          var cleanName = firstToken.slice(1);
          if (cleanName !== userDisplayName) isOtherToken = true;
        } else if (userInGroup) {
          var effSelfId = SheetModule && SheetModule.getEffectiveUserId ? SheetModule.getEffectiveUserId(userId, userDisplayName, userDisplayName) : userId;
          var matchSelf = (userInGroup.userId && userId && (userInGroup.userId === userId || userInGroup.userId === effSelfId)) ||
                          (userInGroup.userName && userDisplayName && userInGroup.userName === userDisplayName) ||
                          (userInGroup.userNickname && userDisplayName && userInGroup.userNickname === userDisplayName);
          if (!matchSelf) isOtherToken = true;
        }

        if (isOtherToken) {
          if (!isOrgGen) {
            return LineModule.replyText(replyToken, '⚠️ 權限不足：除了開單人，不能取消其他使用者的餐點。您只能取消自己訂購的餐點喔！');
          }
          if (userInGroup) {
            targetUserObj = userInGroup;
            targetUserId = userInGroup.userId;
            targetDisplayName = userInGroup.userNickname || userInGroup.userName;
          } else {
            targetDisplayName = firstToken.replace(/^@/, '');
            targetUserObj = { userId: '', userName: targetDisplayName, userNickname: targetDisplayName };
          }
          remainder = tokens.slice(1).join(' ').trim();
        }
      }
    }

    // Extract day suffix if cancelDay wasn't set yet (e.g. "小鮑伯 週一 排骨飯")
    if (!cancelDay && remainder) {
      var suffixDayMatch = remainder.match(/^(週[一二三四五]|今日)(?:\s+(.*))?$/);
      if (suffixDayMatch) {
        cancelDay = suffixDayMatch[1] === '今日' ? todayDay : suffixDayMatch[1];
        remainder = suffixDayMatch[2] ? suffixDayMatch[2].trim() : '';
      }
    }

    // Check bracket again in case day was extracted leaving bracket
    if (!cancelChild && remainder) {
      var bracketMatch2 = remainder.match(/(?:^|\s*)[(（\[【]([^)）\]】]+)[)）\]】]\s*$/);
      if (bracketMatch2) {
        cancelChild = bracketMatch2[1].trim();
        remainder = remainder.replace(bracketMatch2[0], '').trim();
      }
    }

    targetItem = remainder;
    if (targetItem === '全部' || targetItem === '全部訂單' || targetItem === '所有訂單' || targetItem === '所有預約') {
      targetItem = '';
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
      if (isTodayCutoffPassed(todayDay)) {
        return LineModule.replyText(replyToken, '⚠️ 今日點餐已超過結單時間，無法修改或取消餐點囉！若需異動請洽開單人。');
      }
    }

    // If not organizer and not explicitly targeting another user, verify that caller actually owns this item
    if (!isOrgGen && !targetUserObj) {
      var myOrders = SheetModule.getUserOrders(userId, groupId, null, cancelDay, userDisplayName);
      var hasMyItem = myOrders && myOrders.some(function (o) {
        var matchItem = !targetItem || o.itemName.indexOf(targetItem) !== -1;
        var matchChild = !cancelChild || (o.childName || '').trim() === cancelChild.trim();
        return matchItem && matchChild;
      });

      if (!hasMyItem) {
        // Check if another member in group has this item
        var groupOrders = SheetModule.getGroupOrders ? SheetModule.getGroupOrders(groupId, null, cancelDay) : [];
        var otherOrders = groupOrders.filter(function (o) {
          return !targetItem || o.itemName.indexOf(targetItem) !== -1;
        });
        if (otherOrders.length > 0) {
          var otherOwners = otherOrders.map(function (o) {
            return o.userNickname || o.userName || '其他成員';
          }).filter(function (v, i, a) {
            return a.indexOf(v) === i;
          });
          var itemLabel = targetItem ? '「' + targetItem + '」' : '該餐點';
          return LineModule.replyText(replyToken, '⚠️ 權限不足：除了開單人，不能取消其他使用者的餐點（' + itemLabel + '訂購人為「' + otherOwners.join('、') + '」）。您只能取消自己訂購的餐點喔！');
        }
      }
    }

    // If organizer is cancelling without specifying a member, and doesn't own the item personally, target group item
    if (isOrgGen && !targetUserObj && targetItem) {
      var orgOrders = SheetModule.getUserOrders(userId, groupId, null, cancelDay, userDisplayName);
      var orgHasItem = orgOrders && orgOrders.some(function (o) {
        var matchItem = o.itemName.indexOf(targetItem) !== -1;
        var matchChild = !cancelChild || (o.childName || '').trim() === cancelChild.trim();
        return matchItem && matchChild;
      });
      if (!orgHasItem) {
        var groupMatches = SheetModule.getGroupOrders ? SheetModule.getGroupOrders(groupId, null, cancelDay).filter(function (o) {
          var matchItem = o.itemName.indexOf(targetItem) !== -1;
          var matchChild = !cancelChild || (o.childName || '').trim() === cancelChild.trim();
          return matchItem && matchChild;
        }) : [];
        if (groupMatches.length > 0) {
          targetUserObj = groupMatches[0];
          targetUserId = targetUserObj.userId;
          targetDisplayName = targetUserObj.userNickname || targetUserObj.userName;
        }
      }
    }

    var targetDate = null;
    if (cancelDay) {
      targetDate = null;
    } else if (targetItem) {
      var userTodayOrders = SheetModule.getUserOrders(targetUserId, groupId, todayDate, null, targetDisplayName);
      var hasTodayOrder = userTodayOrders && userTodayOrders.some(function (o) {
        var matchItem = o.itemName.indexOf(targetItem) !== -1;
        var matchChild = !cancelChild || (o.childName || '').trim() === cancelChild.trim();
        return matchItem && matchChild;
      });
      if (hasTodayOrder) {
        targetDate = todayDate;
      }
    }

    var cancelledCount = SheetModule.cancelOrder(
      targetUserId,
      groupId,
      targetItem,
      targetDate,
      cancelDay,
      targetDisplayName,
      cancelChild
    );

    if (cancelledCount > 0) {
      var dayText = cancelDay ? cancelDay + ' ' : '';
      var childText = cancelChild ? '[' + cancelChild + '] ' : '';
      var itemDesc = targetItem ? '「' + targetItem + '」' : '全部餐點';
      var nowTwCancel = formatAppDate();
      var cancelPushMsg = '📢【訂餐通知 - 取消餐點】\n👤 訂餐人：' + targetDisplayName + '\n📅 梯次：' + (cancelDay || '今日') + (cancelChild ? '\n👶 對象：' + cancelChild : '') + '\n🗑️ 取消內容：' + childText + itemDesc + ' (共 ' + cancelledCount + ' 筆)\n⏰ 時間：' + nowTwCancel;
      notifyOrganizer(cancelPushMsg);

      var replyPrefix = (targetUserObj && (targetUserId !== userId || targetDisplayName !== userDisplayName)) ? '✅ 已由開單人為【' + targetDisplayName + '】取消 ' : '✅ 已為您取消 ';
      return LineModule.replyText(replyToken, replyPrefix + dayText + childText + itemDesc + ' 共 ' + cancelledCount + ' 筆紀錄。已通知開單人！');
    } else {
      return LineModule.replyText(replyToken, '查無符合條件的未取消訂單。');
    }
  }

  // 10. WEEKLY SUMMARY: 本週統計 / 梯次統計
  var statsWeeklyRegex = _getCmdRegex('cmd.stats_weekly', /^(?:\/)?(?:本週統計|梯次統計)$/i);
  if (statsWeeklyRegex.test(text)) {
    var weeklySummary = SheetModule.getWeeklyOrderSummary(groupId);
    var payInfo = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var weeklySumFlex = FlexModule.createWeeklySummaryFlex(weeklySummary, false, payInfo, userLocale);
    var weeklyAlt = (userLocale === 'zh-TW') ? '📊 本週梯次訂餐統計總表' : (_translateMsg('stats.alt_text_weekly') || '📊 本週梯次訂餐統計總表');
    return LineModule.replyFlex(replyToken, weeklyAlt, weeklySumFlex);
  }

  // 10.5 TODAY SUMMARY (TEXT): 今日文字統計 / 今日統計文字 / 文字統計 / 統計文字 / 今日文字
  var statsTextRegex = _getCmdRegex('cmd.stats_text', /^(?:\/)?(?:今日文字統計|今日統計文字|文字統計|統計文字|今日文字)$/i);
  if (statsTextRegex.test(text)) {
    var daySchedText = SheetModule.getScheduleByDay ? SheetModule.getScheduleByDay(todayDay) : null;
    var restNameText = (daySchedText && daySchedText.restaurantName) ? daySchedText.restaurantName : SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var isOrderOpenText = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    var summaryTextData = SheetModule.getOrderSummary(groupId, todayDate, todayDay);
    var textOutput = formatOrderSummaryText(restNameText, summaryTextData, !isOrderOpenText);
    return LineModule.replyText(replyToken, textOutput);
  }

  // 11. TODAY SUMMARY: 今日統計 / 本日統計 / 統計 / 即時統計 / 今日訂單 / 今日訂餐
  var statsTodayRegex = _getCmdRegex('cmd.stats_today', /^(?:\/)?(?:今日統計|本日統計|統計|即時統計|今日訂單|今日訂餐|今日訂餐統計|今日訂單統計|本日訂單|本日訂餐|本日訂單統計)$/i);
  if (statsTodayRegex.test(text)) {
    var daySched = SheetModule.getScheduleByDay ? SheetModule.getScheduleByDay(todayDay) : null;
    var restName = (daySched && daySched.restaurantName) ? daySched.restaurantName : SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
    var isOrderOpen = SheetModule.getConfigValue('IS_ORDERING_OPEN', 'false') === 'true';
    var summary = SheetModule.getOrderSummary(groupId, todayDate, todayDay);
    var payInfoTodaySum = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;
    var sumFlex = FlexModule.createSummaryFlex(restName, summary, !isOrderOpen, payInfoTodaySum, userLocale);
    var altText = (userLocale === 'zh-TW') ? ('【今日訂餐統計】' + restName + ' (' + (summary.totalQuantity || 0) + '份 / $' + (summary.totalAmount || 0) + ')') : (_translateMsg('stats.alt_text_today', { restaurant: restName, qty: summary.totalQuantity || 0, amount: summary.totalAmount || 0 }) || ('【今日訂餐統計】' + restName));
    var replyRes = LineModule.replyFlex(replyToken, altText, sumFlex);
    if (replyRes && replyRes.statusCode && replyRes.statusCode >= 400) {
      // Fallback via push if Flex reply was rejected
      var fallbackText = formatOrderSummaryText(restName, summary, !isOrderOpen);
      if (groupId && LineModule.pushText) {
        LineModule.pushText(groupId, fallbackText);
      } else if (userId && LineModule.pushText) {
        LineModule.pushText(userId, fallbackText);
      }
    }
    return replyRes;
  }

  // 12. CLOSE ORDER: 結單 / 截止 / 截止訂餐 / 本週結單 / 今日結單
  var closeRegex = _getCmdRegex('cmd.close', /^(?:\/)?(?:結單|截止|截止訂餐|本週結單|今日結單)$/i);
  if (closeRegex.test(text)) {
    SheetModule.setConfigValue('IS_ORDERING_OPEN', 'false');
    var closeScope = (SheetModule.getConfigValue('CLOSE_ORDER_SCOPE', 'WEEKLY') || 'WEEKLY').trim().toUpperCase();
    var isWeeklyClose = text.indexOf('本週') !== -1 || (text.indexOf('今日') === -1 && (closeScope !== 'DAILY' && closeScope !== 'TODAY' && closeScope !== '今日'));
    var payInfoClose = SheetModule.getPaymentConfig ? SheetModule.getPaymentConfig() : null;

    if (isWeeklyClose) {
      var weeklySummaryClose = SheetModule.getWeeklyOrderSummary(groupId);
      var weeklyCloseFlex = FlexModule.createWeeklySummaryFlex(weeklySummaryClose, true, payInfoClose, userLocale);
      var weeklyCloseAlt = (userLocale === 'zh-TW') ? '【已結單】本週梯次訂餐總表與收費清單' : (_translateMsg('stats.alt_text_closed_weekly') || '【已結單】本週梯次訂餐總表與收費清單');
      return LineModule.replyFlex(replyToken, weeklyCloseAlt, weeklyCloseFlex);
    } else {
      var daySchedFinal = SheetModule.getScheduleByDay ? SheetModule.getScheduleByDay(todayDay) : null;
      var finalRest = (daySchedFinal && daySchedFinal.restaurantName) ? daySchedFinal.restaurantName : SheetModule.getConfigValue('RESTAURANT_NAME', '今日便當');
      var finalSummary = SheetModule.getOrderSummary(groupId, todayDate, todayDay);
      var finalFlex = FlexModule.createSummaryFlex(finalRest, finalSummary, true, payInfoClose, userLocale);
      var finalAlt = (userLocale === 'zh-TW') ? ('【已結單】' + finalRest + ' 訂購名單總計') : (_translateMsg('stats.alt_text_closed_today', { restaurant: finalRest }) || ('【已結單】' + finalRest + ' 訂購名單總計'));
      return LineModule.replyFlex(replyToken, finalAlt, finalFlex);
    }
  }

  // 13. ORDER PLACEMENT: +1 / +2 / 點餐語法解析 (支援單日與週一至週五梯次點餐)
  var orderItems = parseOrderText(text);
  if (orderItems.length > 0) {
    // Option 2 + Option 1 Hybrid UX:
    // If ordering items have no child assigned and caller has registered children in Children tab,
    // pop up Quick Reply floating buttons for children selection plus openKeyboard note button.
    var allNoChild = orderItems.every(function (oi) { return !oi.childName; });
    var userKids = SheetModule.getChildren ? SheetModule.getChildren(userId, userDisplayName, userDisplayName) : [];

    if (allNoChild && userKids && userKids.length > 0 && orderItems.length === 1) {
      var oiPrompt = orderItems[0];
      var pDay = oiPrompt.dayOfWeek || '';
      var dayPrefix = pDay ? pDay + ' ' : '';
      var pQty = oiPrompt.quantity || 1;
      var quickReplyItems = userKids.map(function (k) {
        return {
          type: 'action',
          action: {
            type: 'message',
            label: '👦 ' + k,
            text: dayPrefix + '+' + pQty + ' ' + oiPrompt.itemName + ' (' + k + ')'
          }
        };
      });
      // Add 本人
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'message',
          label: '👤 本人',
          text: dayPrefix + '+' + pQty + ' ' + oiPrompt.itemName + ' (本人)'
        }
      });
      // Add openKeyboard note button (Option 1 + Option 2 hybrid)
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '✏️ 其他備註',
          data: 'action=prompt_note&item=' + encodeURIComponent(oiPrompt.itemName) + (pDay ? '&day=' + encodeURIComponent(pDay) : '') + '&qty=' + pQty,
          inputOption: 'openKeyboard',
          fillInText: dayPrefix + '+' + pQty + ' ' + oiPrompt.itemName + ' ()'
        }
      });

      var promptMsg = '🍱 請選擇【' + dayPrefix + oiPrompt.itemName + '】要分配給哪位小孩或自己？\n（可點選下方快捷按鈕，或點「✏️ 其他備註」手動輸入）';
      if (LineModule.replyQuickReply) {
        return LineModule.replyQuickReply(replyToken, promptMsg, quickReplyItems);
      } else {
        return LineModule.replyMessages(replyToken, [{
          type: 'text',
          text: promptMsg,
          quickReply: {
            items: quickReplyItems
          }
        }]);
      }
    }

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
        childName: oi.childName || '',
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
      var childTag = r.childName ? ' [' + r.childName + ']' : '';
      return '• 【' + r.dayOfWeek + '】' + r.itemName + childTag + ' x' + r.quantity + ' ($' + r.subtotal + ')';
    });
    var orderTotalAmt = addedRecords.reduce(function (sum, r) { return sum + r.subtotal; }, 0);
    var nowTwOrder = formatAppDate();
    var orderPushMsg = '📢【訂餐通知 - 新增加訂】\n👤 訂餐人：' + userDisplayName + '\n🍱 預訂項目：\n' + orderSummaryLines.join('\n') + '\n💰 總計：$' + orderTotalAmt + ' 元\n⏰ 時間：' + nowTwOrder;
    notifyOrganizer(orderPushMsg);

    var lastAdded = addedRecords[addedRecords.length - 1];
    var receiptScope = (SheetModule.getConfigValue('ORDER_RECEIPT_SCOPE', 'WEEKLY') || 'WEEKLY').trim().toUpperCase();
    var isWeekly = (receiptScope !== 'DAILY' && receiptScope !== 'TODAY' && receiptScope !== '今日');

    var allMyOrders = isWeekly
      ? SheetModule.getUserOrders(userId, groupId, null, null, userDisplayName)
      : SheetModule.getUserOrders(userId, groupId, todayDate, lastAdded.dayOfWeek, userDisplayName);

    var receiptFlex = FlexModule.createOrderReceiptFlex(userDisplayName, lastAdded, allMyOrders, { isWeekly: isWeekly, locale: userLocale });
    var altSuffix = isWeekly ? '（本週）' : '';
    var altText;
    if (userLocale === 'zh-TW') {
      altText = '訂單已記錄' + (altSuffix ? altSuffix + '：' : '：') + lastAdded.dayOfWeek + ' ' + lastAdded.itemName;
    } else {
      var suffixLabel = isWeekly ? ' (' + _translateMsg('stats.weekly_title') + ')' : '';
      var displayD = _displayDay(lastAdded.dayOfWeek) || lastAdded.dayOfWeek;
      altText = _translateMsg('receipt.alt_text', {
        suffix: suffixLabel,
        day: displayD,
        item: lastAdded.itemName
      });
    }
    return LineModule.replyFlex(replyToken, altText, receiptFlex);
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
    var childSuffix = params.child ? ' (' + params.child + ')' : '';
    var orderText = (params.day ? params.day + ' ' : '') + params.item + '+' + (params.qty || '1') + childSuffix;
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
    var childPart = params.child ? ' ' + params.child : '';
    var cancelText = '取消 ' + (params.day ? params.day + ' ' : '') + childPart + (params.item ? ' ' + params.item : ' 全部');
    var pseudoCancelEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        text: cancelText
      }
    };
    return handleTextMessage(pseudoCancelEvent);
  }

  if (action === 'set_lang') {
    var langCode = params.lang;
    var pseudoLangEvent = {
      replyToken: replyToken,
      source: event.source,
      message: {
        text: '設定語言 ' + langCode
      }
    };
    return handleTextMessage(pseudoLangEvent);
  }

  if (action === 'prompt_note') {
    return null;
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
  g.getAppTimeZone = getAppTimeZone;
  g.formatAppDate = formatAppDate;
  g.getTodayDateString = getTodayDateString;
  g.getTodayDayOfWeek = getTodayDayOfWeek;
  g.isDayPast = isDayPast;
  g.isTodayCutoffPassed = isTodayCutoffPassed;
  g.notifyOrganizer = notifyOrganizer;
  g.resolveOrganizerPushTargets = resolveOrganizerPushTargets;
  g.formatOrderSummaryText = formatOrderSummaryText;
  g.isUserOrganizer = isUserOrganizer;
  g.isAnnouncementOrReconciliation = isAnnouncementOrReconciliation;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseOrderText: parseOrderText,
      matchMenuItem: matchMenuItem,
      handleTextMessage: handleTextMessage,
      handlePostbackEvent: handlePostbackEvent,
      getAppTimeZone: getAppTimeZone,
      formatAppDate: formatAppDate,
      getTodayDateString: getTodayDateString,
      getTodayDayOfWeek: getTodayDayOfWeek,
      isDayPast: isDayPast,
      isTodayCutoffPassed: isTodayCutoffPassed,
      notifyOrganizer: notifyOrganizer,
      resolveOrganizerPushTargets: resolveOrganizerPushTargets,
      formatOrderSummaryText: formatOrderSummaryText,
      isUserOrganizer: isUserOrganizer,
      isAnnouncementOrReconciliation: isAnnouncementOrReconciliation
    };
  }
})();
