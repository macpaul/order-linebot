/**
 * FlexMessage.js - LINE Flex Message template builders for Meal Ordering Bot
 * Compatible with Google Apps Script (GAS) and Node.js
 */

var I18nModule = null;
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : null;

  if (g && g.t) {
    I18nModule = g;
  } else {
    try {
      I18nModule = require('./I18n.js');
    } catch (e) {}
  }
})();

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

function _resolveLocale(locale) {
  if (locale) return locale;
  if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.getDefaultLocale) {
    return I18nModule.getDefaultLocale();
  }
  if (typeof getDefaultLocale === 'function') {
    return getDefaultLocale();
  }
  return 'zh-TW';
}

function _translateHelper(key, params, locale) {
  var loc = _resolveLocale(locale);
  if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.t) {
    return I18nModule.t(key, params, loc);
  }
  if (typeof t === 'function') {
    return t(key, params, loc);
  }
  return key;
}

function _displayDayHelper(sheetDay, locale) {
  var loc = _resolveLocale(locale);
  if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.displayDayOfWeek) {
    return I18nModule.displayDayOfWeek(sheetDay, loc);
  }
  if (typeof displayDayOfWeek === 'function') {
    return displayDayOfWeek(sheetDay, loc);
  }
  return sheetDay;
}

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
  var rawStr = (text !== undefined && text !== null) ? String(text) : '';
  var txt = {
    type: 'text',
    text: rawStr || ' '
  };
  if (o.color) txt.color = o.color;
  if (o.size) txt.size = o.size;
  if (o.weight) txt.weight = o.weight;
  if (o.align) txt.align = o.align;
  if (o.wrap !== undefined) txt.wrap = o.wrap;
  if (o.margin && o.margin !== 'none') txt.margin = o.margin;
  if (o.flex !== undefined) txt.flex = o.flex;
  if (o.action) txt.action = o.action;
  return txt;
}

/**
 * _flexBox — Build a LINE Flex box (container) component.
 * Strictly outputs only valid LINE Flex Box properties.
 */
function _flexBox(contents, opts) {
  var o = opts || {};
  var box = {
    type: 'box',
    layout: o.layout || 'vertical',
    contents: contents || []
  };
  if (o.spacing && o.spacing !== 'none') box.spacing = o.spacing;
  if (o.margin && o.margin !== 'none') box.margin = o.margin;
  var p = o.paddingAll || o.padding;
  if (p === 'xxs') p = 'xs';
  if (p && p !== 'none') box.paddingAll = p;
  if (o.backgroundColor && o.backgroundColor !== 'transparent') box.backgroundColor = o.backgroundColor;
  if (o.cornerRadius && o.cornerRadius !== 'none') box.cornerRadius = o.cornerRadius;
  if (o.borderWidth && o.borderWidth !== '0px' && o.borderWidth !== 'none') box.borderWidth = o.borderWidth;
  if (o.borderColor && o.borderColor !== 'transparent') box.borderColor = o.borderColor;
  if (o.flex !== undefined) box.flex = o.flex;
  if (o.width) box.width = o.width;
  if (o.alignItems) box.alignItems = o.alignItems;
  if (o.justifyContent) box.justifyContent = o.justifyContent;
  return box;
}

/**
 * _flexSeparator — Horizontal divider line.
 * @param {Object} [opts] - Options (color, margin).
 * @returns {Object}
 */
function _flexSeparator(opts) {
  var o = opts || {};
  var sep = { type: 'separator' };
  if (o.color) sep.color = o.color;
  if (o.margin && o.margin !== 'none') sep.margin = o.margin;
  return sep;
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
 * createMenuFlex — Build a LINE Flex bubble that displays today's or weekday's menu with order buttons.
 *
 * Layout:
 *   header  – restaurant name + weekday badge + cutoff-time badge
 *   body     – items grouped by category, each item with an interactive '+1 點餐' button
 *   footer   – usage hint
 *
 * @param {string} restaurantName - Display name of the restaurant.
 * @param {string} cutoffTime - Cutoff time string, e.g. "11:00".
 * @param {Array<Object>} menuItems - Flat array of menu records.
 *   Each record shape: { category: string, itemName: string, price: number, isAvailable?: boolean, description?: string }
 * @param {string} [dayOfWeek] - Optional day of week (e.g. "週一", "週二").
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createMenuFlex(restaurantName, cutoffTime, menuItems, dayOfWeek, locale) {
  var loc = _resolveLocale(locale);
  var groups = _groupMenuByCategory(menuItems);
  var displayDay = dayOfWeek ? _displayDayHelper(dayOfWeek, loc) : '';
  var dayBadge = displayDay ? '【' + displayDay + '】' : '';
  var titleSuffix = _translateHelper('menu.title_suffix', {}, loc);
  var headerTitle = restaurantName ? (restaurantName + titleSuffix) : _translateHelper('stats.today_title', {}, loc);

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(dayBadge + headerTitle, {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText(_translateHelper('menu.cutoff_prefix', {}, loc) + (cutoffTime || '--'), {
      size: 'sm',
      color: FLEX_COLORS.textOnColor,
      align: 'start',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    spacing: 'none',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary,
    cornerRadius: 'lg'
  });

  /* ---- body: category sections ---- */
  var bodyContents = [];
  var totalRendered = 0;
  var MAX_ITEMS_PER_MENU = 35;

  if (groups.length === 0) {
    bodyContents.push(_flexText('（' + _translateHelper('stats.no_orders', {}, loc) + '）', {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'lg'
    }));
  } else {
    groups.forEach(function (group, gi) {
      if (totalRendered >= MAX_ITEMS_PER_MENU) return;

      // Category heading
      bodyContents.push(_flexText('【' + group.category + '】', {
        size: 'md',
        weight: 'bold',
        color: FLEX_COLORS.primaryDark,
        align: 'start',
        margin: gi === 0 ? 'none' : 'md'
      }));

      // Item rows with order buttons
      group.items.forEach(function (item) {
        if (totalRendered >= MAX_ITEMS_PER_MENU) return;
        totalRendered++;

        var name = item.itemName || '';
        var price = _formatPrice(item.price);
        var isAvail = item.isAvailable === undefined || item.isAvailable === true || item.isAvailable === 'TRUE';
        var orderText = (dayOfWeek ? dayOfWeek + ' ' : '') + name + '+1';

        var leftBoxContents = [
          _flexText(name, {
            size: 'sm',
            weight: 'bold',
            color: isAvail ? FLEX_COLORS.textPrimary : FLEX_COLORS.textSecondary,
            wrap: true
          }),
          _flexText(price, {
            size: 'xs',
            color: isAvail ? FLEX_COLORS.primaryDark : FLEX_COLORS.textSecondary,
            weight: 'bold',
            margin: 'xs'
          })
        ];

        if (item.description) {
          leftBoxContents.push(_flexText(item.description, {
            size: 'xxs',
            color: FLEX_COLORS.textSecondary,
            wrap: true,
            margin: 'xs'
          }));
        }

        var actionButton;
        if (isAvail) {
          actionButton = {
            type: 'button',
            action: {
              type: 'message',
              label: _translateHelper('menu.btn_order', {}, loc),
              text: orderText
            },
            style: 'primary',
            color: FLEX_COLORS.primary,
            height: 'sm',
            flex: 2
          };
        } else {
          var soldOutLabel = _translateHelper('menu.sold_out', {}, loc);
          actionButton = {
            type: 'button',
            action: {
              type: 'message',
              label: soldOutLabel,
              text: (dayOfWeek ? dayOfWeek + ' ' : '') + name + ' ' + soldOutLabel
            },
            style: 'secondary',
            height: 'sm',
            flex: 2
          };
        }

        bodyContents.push(_flexBox([
          _flexBox(leftBoxContents, {
            layout: 'vertical',
            flex: 4,
            justifyContent: 'center'
          }),
          actionButton
        ], {
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          paddingAll: 'sm',
          margin: 'xs',
          backgroundColor: totalRendered % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
          cornerRadius: 'md'
        }));
      });
    });
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footerText1 = _translateHelper('menu.footer_hint1', {}, loc);
  var footerText2 = _translateHelper('menu.footer_hint2', { day: displayDay ? displayDay + ' ' : '' }, loc);

  var footer = _flexBox([
    _flexText(footerText1, {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'center'
    }),
    _flexText(footerText2, {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
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
function createOrderReceiptFlex(userName, addedItem, userOrders, options) {
  var orders = userOrders || [];
  var total = _calcOrderTotal(orders);
  var isWeekly = options && options.isWeekly !== undefined ? !!options.isWeekly : true;
  var loc = _resolveLocale(options && options.locale ? options.locale : null);

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(_translateHelper('receipt.title', {}, loc), {
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
  var memberName = userName || _translateHelper('common.member', {}, loc);
  var userTitle = isWeekly
    ? _translateHelper('receipt.weekly_user_orders', { name: memberName }, loc)
    : _translateHelper('receipt.daily_user_orders', { name: memberName }, loc);
  bodyContents.push(_flexText(userTitle, {
    size: 'lg',
    weight: 'bold',
    color: FLEX_COLORS.textPrimary,
    align: 'start'
  }));

  // Separator
  bodyContents.push(_flexSeparator({ margin: 'md' }));

  // Order lines
  if (orders.length === 0) {
    bodyContents.push(_flexText(_translateHelper('receipt.no_items', {}, loc), {
      size: 'md',
      color: FLEX_COLORS.textSecondary,
      align: 'start'
    }));
  } else if (isWeekly) {
    // Group orders by weekday for clear weekly view
    var dayMap = {};
    var dayKeys = [];
    orders.forEach(function (o) {
      var d = o.dayOfWeek || _translateHelper('common.today', {}, loc);
      if (!dayMap[d]) {
        dayMap[d] = [];
        dayKeys.push(d);
      }
      dayMap[d].push(o);
    });

    dayKeys.forEach(function (day, di) {
      var displayDay = _displayDayHelper(day, loc);
      bodyContents.push(_flexText(_translateHelper('common.bracket_open', {}, loc) + displayDay + _translateHelper('common.bracket_close', {}, loc), {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.primaryDark,
        align: 'start',
        margin: di === 0 ? 'sm' : 'md'
      }));

      dayMap[day].forEach(function (o) {
        var name = o.itemName || '';
        var qty = o.quantity || 1;
        var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);
        var childTag = o.childName ? ' [' + o.childName + ']' : '';

        // Highlight the just-added item (matching name and weekday if applicable)
        var isAdded = addedItem && o.itemName === addedItem.itemName &&
          (!addedItem.dayOfWeek || !o.dayOfWeek || o.dayOfWeek === addedItem.dayOfWeek);
        var rowBg = isAdded ? FLEX_COLORS.successBg : 'transparent';

        bodyContents.push(_flexBox([
          _flexText(name + childTag + (qty > 1 ? ' x' + qty : ''), {
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
    });
  } else {
    // Daily mode: flat list
    orders.forEach(function (o) {
      var name = o.itemName || '';
      var qty = o.quantity || 1;
      var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);
      var childTag = o.childName ? ' [' + o.childName + ']' : '';

      var isAdded = addedItem && o.itemName === addedItem.itemName;
      var rowBg = isAdded ? FLEX_COLORS.successBg : 'transparent';

      bodyContents.push(_flexBox([
        _flexText(name + childTag + (qty > 1 ? ' x' + qty : ''), {
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
  var totalLabel = isWeekly ? _translateHelper('receipt.total_weekly', {}, loc) : _translateHelper('receipt.total_daily', {}, loc);
  bodyContents.push(_flexBox([
    _flexText(totalLabel, {
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
    _flexText(_translateHelper('receipt.cancel_hint', {}, loc), {
      size: 'xs',
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
 * Helper to build payment info flex contents (LINE Pay button + Bank Transfer info)
 * @param {Object} paymentInfo
 * @returns {Array<Object>} Flex component array
 */
function _buildPaymentContents(paymentInfo, locale) {
  if (!paymentInfo || !paymentInfo.hasPaymentInfo) {
    return [];
  }

  var loc = _resolveLocale(locale);
  var contents = [];
  contents.push(_flexSeparator({ margin: 'md' }));
  contents.push(_flexText(_translateHelper('payment.title', {}, loc), {
    weight: 'bold',
    size: 'sm',
    color: FLEX_COLORS.primaryDark,
    margin: 'md'
  }));

  // Bank transfer block
  if (paymentInfo.bankAccount || paymentInfo.bankCode || paymentInfo.bankQrUrl) {
    var defaultBankName = _translateHelper('payment.bank_transfer', {}, loc);
    var bankTitle = (paymentInfo.bankCode ? paymentInfo.bankCode + ' ' : '') + (paymentInfo.bankName || defaultBankName);
    var bankRows = [
      _flexText('🏦 ' + bankTitle, {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary
      })
    ];

    if (paymentInfo.bankAccount) {
      bankRows.push(_flexText(_translateHelper('payment.account_number', { account: paymentInfo.bankAccount }, loc), {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary,
        margin: 'xs'
      }));
    }

    if (paymentInfo.bankAccountName) {
      bankRows.push(_flexText(_translateHelper('payment.account_name', { name: paymentInfo.bankAccountName }, loc), {
        size: 'xs',
        color: FLEX_COLORS.textSecondary,
        margin: 'xs'
      }));
    }

    // Bank QR Code image
    if (paymentInfo.bankQrUrl && /^https:\/\//i.test(paymentInfo.bankQrUrl)) {
      bankRows.push({
        type: 'image',
        url: paymentInfo.bankQrUrl,
        size: 'md',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        margin: 'sm',
        align: 'center',
        action: {
          type: 'uri',
          label: _translateHelper('payment.zoom_qr', {}, loc),
          uri: paymentInfo.bankQrUrl
        }
      });
      bankRows.push(_flexText(_translateHelper('payment.qr_hint', {}, loc), {
        size: 'xxs',
        color: FLEX_COLORS.textSecondary,
        align: 'center',
        margin: 'xs'
      }));
    }

    bankRows.push(_flexText(_translateHelper('payment.notify_hint', {}, loc), {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      margin: 'xs'
    }));

    contents.push(_flexBox(bankRows, {
      layout: 'vertical',
      paddingAll: 'sm',
      margin: 'sm',
      backgroundColor: FLEX_COLORS.background,
      cornerRadius: 'md'
    }));
  }

  // LINE Pay button & QR
  if (paymentInfo.linePayUrl || paymentInfo.linePayQrUrl || paymentInfo.isPersonalLinePay) {
    if (paymentInfo.linePayUrl && /^(?:https|line):\/\//i.test(paymentInfo.linePayUrl)) {
      var buttonLabel = paymentInfo.isPersonalLinePay ? _translateHelper('payment.btn_wallet', {}, loc) : _translateHelper('payment.btn_linepay', {}, loc);
      contents.push({
        type: 'button',
        action: {
          type: 'uri',
          label: buttonLabel,
          uri: paymentInfo.linePayUrl
        },
        style: 'primary',
        color: '#06C755',
        height: 'sm',
        margin: 'sm'
      });

      if (paymentInfo.isPersonalLinePay) {
        var idHint = paymentInfo.linePayUserId ? ' (LINE ID: ' + paymentInfo.linePayUserId + ')' : '';
        contents.push(_flexText(_translateHelper('payment.linepay_hint', { recipient: paymentInfo.linePayRecipientName, idHint: idHint }, loc), {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          align: 'center',
          margin: 'xs',
          wrap: true
        }));
      }
    }

    if (paymentInfo.linePayQrUrl && /^https:\/\//i.test(paymentInfo.linePayQrUrl)) {
      contents.push({
        type: 'image',
        url: paymentInfo.linePayQrUrl,
        size: 'md',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        margin: 'sm',
        align: 'center',
        action: {
          type: 'uri',
          label: _translateHelper('payment.linepay_qr', {}, loc),
          uri: paymentInfo.linePayQrUrl
        }
      });
    }
  }

  return contents;
}

/**
 * createSummaryFlex — Daily aggregated order summary for the organizer.
 *
 * Layout:
 *   header  – restaurant name + date + open/closed status badge
 *   body     – per-item totals (name xQty … $Subtotal) + grand total + payment info + action buttons
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
 * @param {Object} [paymentInfo] - Optional payment configuration (LINE Pay & Bank Transfer).
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createSummaryFlex(restaurantName, summaryData, isClosed, paymentInfo, locale) {
  var loc = _resolveLocale(locale);
  var data = summaryData || {};
  var items = data.items || [];
  var totalQty = data.totalQuantity || 0;
  var totalAmt = data.totalAmount || 0;
  var dateStr = data.date || '';

  var statusLabel = isClosed ? (loc === 'zh-TW' ? '已截止' : 'Closed') : (loc === 'zh-TW' ? '開放中' : 'Open');
  var statusColor = isClosed ? FLEX_COLORS.danger : FLEX_COLORS.success;

  /* ---- header ---- */
  var dayName = data.dayOfWeek ? _displayDayHelper(data.dayOfWeek, loc) : '';
  var headerDateText = (dateStr ? dateStr : (loc === 'zh-TW' ? '今日' : 'Today')) + (dayName ? ' (' + dayName + ')' : '');
  var defaultTitle = isClosed ? _translateHelper('stats.today_title_closed', {}, loc) : _translateHelper('stats.today_title', {}, loc);
  var header = _flexBox([
    _flexText(restaurantName || defaultTitle, {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexBox([
      _flexText(headerDateText, {
        size: 'sm',
        color: FLEX_COLORS.textOnColor,
        align: 'start'
      }),
      _flexFiller(),
      _flexBox([
        _flexText(statusLabel, {
          size: 'xs',
          weight: 'bold',
          color: FLEX_COLORS.textOnColor,
          align: 'center'
        })
      ], {
        layout: 'vertical',
        paddingAll: 'xs',
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
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primaryDark
  });

  /* ---- body ---- */
  var bodyContents = [];

  if (items.length === 0) {
    bodyContents.push(_flexText('（' + _translateHelper('stats.no_orders', {}, loc) + '）', {
      size: 'md',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    }));
  } else {
    items.forEach(function (item) {
      var name = item.itemName || '';
      var qty = item.quantity || 0;
      var sub = _formatPrice(item.subtotal);
      var buyersText = (item.buyers && item.buyers.length > 0)
        ? '👤 ' + item.buyers.join('、')
        : '';

      var itemBoxChildren = [
        _flexBox([
          _flexText(name + ' x' + qty, {
            size: 'md',
            weight: 'bold',
            color: FLEX_COLORS.textPrimary,
            align: 'start',
            flex: 3
          }),
          _flexText(sub, {
            size: 'md',
            weight: 'bold',
            color: FLEX_COLORS.primaryDark,
            align: 'end',
            flex: 1
          })
        ], {
          layout: 'horizontal',
          justifyContent: 'space-between',
          spacing: 'sm'
        })
      ];

      if (buyersText) {
        itemBoxChildren.push(_flexText(buyersText, {
          size: 'xs',
          color: FLEX_COLORS.textSecondary,
          margin: 'xs',
          wrap: true
        }));
      }

      bodyContents.push(_flexBox(itemBoxChildren, {
        layout: 'vertical',
        spacing: 'none',
        paddingAll: 'sm',
        margin: 'xs',
        backgroundColor: FLEX_COLORS.background,
        cornerRadius: 'sm'
      }));
    });
  }

  // Grand total
  bodyContents.push(_flexSeparator({ margin: 'md' }));
  bodyContents.push(_flexBox([
    _flexText((loc === 'zh-TW' ? '總計' : 'Total'), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textPrimary,
      align: 'start',
      flex: 1
    }),
    _flexText(_translateHelper('stats.total_summary', { qty: totalQty, amount: totalAmt }, loc), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.primary,
      align: 'end',
      flex: 2
    })
  ], {
    layout: 'horizontal',
    justifyContent: 'space-between',
    spacing: 'sm',
    padding: 'sm'
  }));

  // Member billing & order roster (今日成員應付明細與點餐名冊)
  if (data.users && data.users.length > 0) {
    bodyContents.push(_flexSeparator({ margin: 'md' }));
    bodyContents.push(_flexText(_translateHelper('stats.member_roster_today', {}, loc), {
      weight: 'bold',
      size: 'sm',
      color: FLEX_COLORS.textPrimary,
      margin: 'md'
    }));

    data.users.forEach(function (u) {
      var userItemsStr = (u.items && u.items.length > 0) ? u.items.join('、') : '';
      var userColChildren = [
        _flexText(u.userName || _translateHelper('common.member', {}, loc), {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary
        })
      ];
      if (userItemsStr) {
        userColChildren.push(_flexText(userItemsStr, {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          margin: 'xxs',
          wrap: true
        }));
      }

      bodyContents.push(_flexBox([
        _flexBox(userColChildren, {
          layout: 'vertical',
          flex: 3
        }),
        _flexText('$' + u.total + (loc === 'zh-TW' ? ' 元' : ''), {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.danger,
          align: 'end',
          flex: 1
        })
      ], {
        layout: 'horizontal',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: 'xs',
        paddingAll: 'sm',
        backgroundColor: FLEX_COLORS.background,
        cornerRadius: 'sm'
      }));
    });
  }

  // Append payment contents if available
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var payBoxes = _buildPaymentContents(paymentInfo, loc);
    for (var p = 0; p < payBoxes.length; p++) {
      bodyContents.push(payBoxes[p]);
    }
  }

  // Quick close order button if still open
  if (!isClosed) {
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: _translateHelper('stats.close_btn_today', {}, loc),
        text: '今日結單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'md'
    });
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    spacing: 'none',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footerMsg = isClosed
    ? _translateHelper('stats.footer_closed', {}, loc)
    : _translateHelper('stats.footer_open', {}, loc);

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
    size: 'mega',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createHelpFlex — Interactive instruction card with tappable command buttons.
 *
 * Layout:
 *   header  – title banner ("便當點餐使用說明")
 *   body     – list of commands, each with a quick-action button
 *   footer   – usage hint
 * @param {string} [sourceCodeUrl] - Open source repo URL (defaults to Config SOURCE_CODE_URL)
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createHelpFlex(sourceCodeUrl, locale) {
  var loc = locale;
  if (!loc) {
    if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.getDefaultLocale) {
      loc = I18nModule.getDefaultLocale();
    } else if (typeof getDefaultLocale === 'function') {
      loc = getDefaultLocale();
    } else {
      loc = 'zh-TW';
    }
  }

  var srcUrl = sourceCodeUrl;
  if (!srcUrl) {
    if (typeof getConfigValue === 'function') {
      srcUrl = getConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee');
    } else {
      srcUrl = 'https://tinyurl.com/4c92wtee';
    }
  }
  srcUrl = String(srcUrl || 'https://tinyurl.com/4c92wtee').trim();

  var _translate = function (k, p) {
    if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.t) {
      return I18nModule.t(k, p, loc);
    }
    if (typeof t === 'function') {
      return t(k, p, loc);
    }
    return k;
  };

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(_translate('help.title'), {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary
  });

  /* ---- body: buttonized command list ---- */
  var commands = [
    { label: _translate('help.cmd_weekly_schedule.title'), desc: _translate('help.cmd_weekly_schedule.desc'), cmd: _translate('help.cmd_weekly_schedule.cmd'), btnText: _translate('help.cmd_weekly_schedule.btn') },
    { label: _translate('help.cmd_today_menu.title'), desc: _translate('help.cmd_today_menu.desc'), cmd: _translate('help.cmd_today_menu.cmd'), btnText: _translate('help.cmd_today_menu.btn') },
    { label: _translate('help.cmd_children.title'), desc: _translate('help.cmd_children.desc'), cmd: _translate('help.cmd_children.cmd'), btnText: _translate('help.cmd_children.btn') },
    { label: _translate('help.cmd_my_today.title'), desc: _translate('help.cmd_my_today.desc'), cmd: _translate('help.cmd_my_today.cmd'), btnText: _translate('help.cmd_my_today.btn') },
    { label: _translate('help.cmd_my_weekly.title'), desc: _translate('help.cmd_my_weekly.desc'), cmd: _translate('help.cmd_my_weekly.cmd'), btnText: _translate('help.cmd_my_weekly.btn') },
    { label: _translate('help.cmd_cancel.title'), desc: _translate('help.cmd_cancel.desc'), cmd: _translate('help.cmd_cancel.cmd'), btnText: _translate('help.cmd_cancel.btn') },
    { label: _translate('help.cmd_weekly_stats.title'), desc: _translate('help.cmd_weekly_stats.desc'), cmd: _translate('help.cmd_weekly_stats.cmd'), btnText: _translate('help.cmd_weekly_stats.btn') },
    { label: _translate('help.cmd_today_stats.title'), desc: _translate('help.cmd_today_stats.desc'), cmd: _translate('help.cmd_today_stats.cmd'), btnText: _translate('help.cmd_today_stats.btn') },
    { label: _translate('help.cmd_close.title'), desc: _translate('help.cmd_close.desc'), cmd: _translate('help.cmd_close.cmd'), btnText: _translate('help.cmd_close.btn') }
  ];

  var userLocaleActive = false;
  if (typeof I18nModule !== 'undefined' && I18nModule && I18nModule.isUserLocaleEnabled) {
    userLocaleActive = I18nModule.isUserLocaleEnabled();
  } else if (typeof isUserLocaleEnabled === 'function') {
    userLocaleActive = isUserLocaleEnabled();
  }
  if (userLocaleActive) {
    commands.push({
      label: _translate('help.cmd_language.title'),
      desc: _translate('help.cmd_language.desc'),
      cmd: _translate('help.cmd_language.cmd'),
      btnText: _translate('help.cmd_language.btn')
    });
  }

  var bodyContents = [];
  commands.forEach(function (cmd, i) {
    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(cmd.label, {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary
        }),
        _flexText(cmd.desc, {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          margin: 'xs'
        })
      ], {
        layout: 'vertical',
        spacing: 'none',
        flex: 3,
        justifyContent: 'center'
      }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: cmd.btnText,
          text: cmd.cmd
        },
        style: 'primary',
        color: FLEX_COLORS.primary,
        height: 'sm',
        flex: 2
      }
    ], {
      layout: 'horizontal',
      alignItems: 'center',
      paddingAll: 'sm',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      cornerRadius: 'md',
      margin: 'xs'
    }));
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText(_translate('help.tip_click'), {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'center'
    }),
    _flexText(_translate('help.license') + srcUrl, {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'xs',
      wrap: true,
      action: {
        type: 'uri',
        uri: srcUrl
      }
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'mega',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createCancelOrderFlex — Build interactive cancellation menu for a member's active orders
 * Regular users can only cancel their own orders; organizers also get bulk cancel options.
 *
 * @param {string} userName
 * @param {Array} activeOrders
 * @param {Object} lockMap - { '週一': { locked: true, reason: '已過期' }, ... }
 * @param {boolean} [isOrganizer] - Whether the requester is the organizer
 * @returns {Object} LINE Flex bubble
 */
function createCancelOrderFlex(userName, activeOrders, lockMap, isOrganizer, locale) {
  var loc = _resolveLocale(locale);
  var orders = activeOrders || [];
  var locks = lockMap || {};

  // STRICTLY GUARANTEE no other user's orders can ever appear in the personal cancel menu!
  if (userName && userName !== '成員') {
    orders = orders.filter(function (o) {
      if (o.userName && o.userName !== '成員' && o.userName !== userName && o.userNickname !== userName) {
        return false;
      }
      return true;
    });
  }

  var dayMap = {};
  var dayOrder = [];
  orders.forEach(function (o) {
    var d = o.dayOfWeek || '今日';
    if (!dayMap[d]) {
      dayMap[d] = [];
      dayOrder.push(d);
    }
    dayMap[d].push(o);
  });

  var headerTitle = isOrganizer
    ? _translateHelper('cancel.title_org', {}, loc)
    : _translateHelper('cancel.title', {}, loc);
  var memberDisplayName = userName || (loc === 'zh-TW' ? '成員' : 'Member');
  var headerSub = _translateHelper('cancel.subtitle', { name: memberDisplayName }, loc);

  var header = _flexBox([
    _flexText(headerTitle, {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText(headerSub, {
      size: 'sm',
      color: FLEX_COLORS.textOnColor,
      align: 'start',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.danger
  });

  var bodyContents = [];
  if (dayOrder.length === 0) {
    bodyContents.push(_flexText(_translateHelper('cancel.no_orders', {}, loc), {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'lg'
    }));
  } else {
    var anyDayUnlocked = false;

    dayOrder.forEach(function (day, di) {
      var displayDay = _displayDayHelper(day, loc);
      var dayItems = dayMap[day];
      var dayLock = locks[day];
      var isDayLocked = dayLock && dayLock.locked;
      var rawReason = dayLock ? dayLock.reason : '';
      var lockReason = '';
      if (isDayLocked) {
        if (rawReason === '已過期') {
          lockReason = _translateHelper('cancel.reason_expired', {}, loc);
        } else if (rawReason === '已截止') {
          lockReason = _translateHelper('cancel.reason_cutoff', {}, loc);
        } else {
          lockReason = rawReason || _translateHelper('cancel.locked', {}, loc);
        }
      }
      if (!isDayLocked) {
        anyDayUnlocked = true;
      }

      var dayHeaderTitle = _translateHelper('cancel.day_items', { day: displayDay }, loc) + (isDayLocked ? ' 🔒[' + lockReason + ' ' + _translateHelper('cancel.locked', {}, loc) + ']' : '');

      bodyContents.push(_flexText(dayHeaderTitle, {
        size: 'md',
        weight: 'bold',
        color: isDayLocked ? FLEX_COLORS.textSecondary : FLEX_COLORS.primaryDark,
        align: 'start',
        margin: di === 0 ? 'none' : 'md'
      }));

      dayItems.forEach(function (it) {
        var childTag = it.childName ? ' [' + it.childName + ']' : '';
        var cancelCmd = '取消 ' + day + ' ' + (it.childName ? it.childName + ' ' : '') + it.itemName;
        var itemText = it.itemName + childTag + (it.quantity > 1 ? ' x' + it.quantity : '') + ' ($' + (it.subtotal || (it.price * it.quantity)) + ')';

        var actionComponent = isDayLocked
          ? _flexBox([
              _flexText('🔒 ' + lockReason, {
                size: 'xs',
                color: FLEX_COLORS.textSecondary,
                align: 'center'
              })
            ], {
              layout: 'vertical',
              flex: 2,
              justifyContent: 'center',
              alignItems: 'center'
            })
          : {
              type: 'button',
              action: {
                type: 'message',
                label: _translateHelper('cancel.btn_cancel_item', {}, loc),
                text: cancelCmd
              },
              style: 'primary',
              color: FLEX_COLORS.danger,
              height: 'sm',
              flex: 2
            };

        bodyContents.push(_flexBox([
          _flexBox([
            _flexText(itemText, {
              size: 'sm',
              weight: 'bold',
              color: isDayLocked ? FLEX_COLORS.textSecondary : FLEX_COLORS.textPrimary,
              wrap: true
            })
          ], {
            layout: 'vertical',
            flex: 3,
            justifyContent: 'center'
          }),
          actionComponent
        ], {
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          paddingAll: 'sm',
          margin: 'xs',
          backgroundColor: FLEX_COLORS.background,
          cornerRadius: 'md'
        }));
      });

      // Button to cancel user's own items for this day (only if unlocked)
      if (!isDayLocked) {
        bodyContents.push({
          type: 'button',
          action: {
            type: 'message',
            label: _translateHelper('cancel.btn_cancel_day', { day: displayDay }, loc),
            text: '取消我的 ' + day + ' 全部'
          },
          style: 'secondary',
          height: 'sm',
          margin: 'xs'
        });
      }
    });

    // Overall button to cancel user's own orders
    if (anyDayUnlocked && (dayOrder.length > 1 || orders.length > 1)) {
      bodyContents.push(_flexSeparator({ margin: 'md' }));
      bodyContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: '❌ ' + _translateHelper('cancel.btn_cancel_all', {}, loc),
          text: '取消我的 全部'
        },
        style: 'secondary',
        height: 'sm',
        margin: 'sm'
      });
    } else if (!anyDayUnlocked && dayOrder.length > 0) {
      bodyContents.push(_flexSeparator({ margin: 'md' }));
      bodyContents.push(_flexText(_translateHelper('cancel.all_locked_warning', {}, loc), {
        size: 'xs',
        color: FLEX_COLORS.warning,
        align: 'center',
        wrap: true,
        margin: 'sm'
      }));
    }
  }

  // If user is organizer, provide full group management buttons with warning prompt
  if (isOrganizer) {
    bodyContents.push(_flexSeparator({ margin: 'lg' }));
    bodyContents.push(_flexText((loc === 'zh-TW') ? '👑 開單人管理專區' : _translateHelper('cancel.org_section', {}, loc), {
      size: 'sm',
      weight: 'bold',
      color: FLEX_COLORS.danger,
      margin: 'sm'
    }));
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: _translateHelper('cancel.btn_org_day', {}, loc),
        text: '取消當日所有餐點'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'xs'
    });
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: _translateHelper('cancel.btn_org_all', {}, loc),
        text: '取消所有未截止預約訂單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'xs'
    });
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  var footerText = isOrganizer
    ? _translateHelper('cancel.footer_org', {}, loc)
    : _translateHelper('cancel.footer_member', {}, loc);

  var footer = _flexBox([
    _flexText(footerText, {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      wrap: true
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createConfirmCancelFlex — Warning confirmation card for organizer bulk cancel operations
 * @param {string} title
 * @param {string} warningDesc
 * @param {string} targetActionText
 * @param {string} targetButtonLabel
 * @param {string} [locale]
 * @returns {Object} LINE Flex bubble
 */
function createConfirmCancelFlex(title, warningDesc, targetActionText, targetButtonLabel, locale) {
  var loc = _resolveLocale(locale);
  var header = _flexBox([
    _flexText(_translateHelper('cancel.confirm_header', {}, loc), {
      size: 'md',
      weight: 'bold',
      color: '#FFFFFF'
    })
  ], {
    layout: 'vertical',
    backgroundColor: FLEX_COLORS.danger,
    paddingAll: 'md'
  });

  var abortCmd = (loc === 'zh-TW') ? '放棄取消' : ((typeof I18nModule !== 'undefined' && I18nModule.I18N_COMMANDS && I18nModule.I18N_COMMANDS[loc] && I18nModule.I18N_COMMANDS[loc]['cmd.abort_cancel']) ? I18nModule.I18N_COMMANDS[loc]['cmd.abort_cancel'][0] : '放棄取消');

  var body = _flexBox([
    _flexText(title, {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.danger,
      wrap: true
    }),
    _flexSeparator({ margin: 'md' }),
    _flexText(warningDesc, {
      size: 'sm',
      color: FLEX_COLORS.textPrimary,
      margin: 'md',
      wrap: true
    }),
    _flexBox([
      _flexText((loc === 'zh-TW') ? '⚠️ 警告：此操作將影響全體成員且無法復原！' : _translateHelper('cancel.confirm_footer', {}, loc), {
        size: 'xs',
        color: FLEX_COLORS.danger,
        weight: 'bold',
        wrap: true
      })
    ], {
      layout: 'vertical',
      backgroundColor: '#FCE8E6',
      paddingAll: 'sm',
      cornerRadius: 'sm',
      margin: 'md'
    }),
    _flexBox([
      {
        type: 'button',
        action: {
          type: 'message',
          label: targetButtonLabel,
          text: targetActionText
        },
        style: 'primary',
        color: FLEX_COLORS.danger,
        height: 'sm'
      },
      {
        type: 'button',
        action: {
          type: 'message',
          label: _translateHelper('cancel.btn_abort', {}, loc),
          text: abortCmd
        },
        style: 'secondary',
        height: 'sm',
        margin: 'sm'
      }
    ], {
      layout: 'vertical',
      margin: 'lg'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg'
  });

  return {
    type: 'bubble',
    header: header,
    body: body
  };
}

/**
 * createWeeklyScheduleFlex — Build a Flex card displaying the Mon-Fri schedule
 * @param {Array<Object>} schedule - List of { dayOfWeek, restaurantName, cutoffTime, notes, isActive }
 * @returns {Object} LINE Flex bubble
 */
function createWeeklyScheduleFlex(schedule, locale) {
  var loc = _resolveLocale(locale);
  var rows = [];
  var days = schedule || [];

  for (var i = 0; i < days.length; i++) {
    var s = days[i];
    var displayDay = _displayDayHelper(s.dayOfWeek, loc);
    rows.push(_flexBox([
      _flexBox([
        _flexText(displayDay, { weight: 'bold', size: 'sm', color: FLEX_COLORS.textOnColor, align: 'center' })
      ], {
        backgroundColor: FLEX_COLORS.primary,
        cornerRadius: 'sm',
        paddingAll: 'xs',
        width: '45px'
      }),
      _flexBox([
        _flexText(s.restaurantName || _translateHelper('schedule.no_restaurant', {}, loc), { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText(_translateHelper('schedule.cutoff_prefix', {}, loc) + (s.cutoffTime || '10:30') + (s.notes ? ' · ' + s.notes : ''), { size: 'xs', color: FLEX_COLORS.textSecondary })
      ], { layout: 'vertical', margin: 'md', flex: 1 }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: _translateHelper('schedule.btn_menu', {}, loc),
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
      paddingAll: 'sm',
      cornerRadius: 'md'
    }));
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: _flexBox([
      _flexText(_translateHelper('schedule.title', {}, loc), { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText(_translateHelper('schedule.subtitle', {}, loc), { size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs' })
    ], { backgroundColor: FLEX_COLORS.primaryDark, paddingAll: 'lg' }),
    body: _flexBox(rows, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText(_translateHelper('schedule.footer', {}, loc), { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
  };
}

/**
 * createWeeklySummaryFlex — Build a Flex card displaying the weekly batch summary
 * @param {Object} weeklySummary - { daySummaries, grandTotalQuantity, grandTotalAmount, users }
 * @param {boolean} [isClosed] - Whether weekly ordering has ended.
 * @param {Object} [paymentInfo] - Optional payment configuration (LINE Pay & Bank Transfer).
 * @param {string} [locale]
 * @returns {Object} LINE Flex bubble
 */
function createWeeklySummaryFlex(weeklySummary, isClosed, paymentInfo, locale) {
  var loc = _resolveLocale(locale);
  var summary = weeklySummary || { daySummaries: [], users: [] };
  var bodyContents = [];

  for (var i = 0; i < summary.daySummaries.length; i++) {
    var ds = summary.daySummaries[i];
    var displayDay = _displayDayHelper(ds.dayOfWeek, loc);
    var dayItemsText = ds.items && ds.items.length > 0
      ? ds.items.map(function (it) { return it.itemName + 'x' + it.quantity; }).join('、')
      : _translateHelper('stats.no_orders', {}, loc);

    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(displayDay + ' ' + (ds.restaurantName || ''), { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText(_translateHelper('stats.total_summary', { qty: ds.totalQuantity, amount: ds.totalAmount }, loc), { size: 'xs', color: FLEX_COLORS.primary, weight: 'bold' })
      ], { layout: 'horizontal', justifyContent: 'space-between' }),
      _flexText(dayItemsText, { size: 'xs', color: FLEX_COLORS.textSecondary, margin: 'xs' })
    ], {
      layout: 'vertical',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      paddingAll: 'sm',
      cornerRadius: 'sm',
      margin: 'sm'
    }));
  }

  bodyContents.push(_flexSeparator({ margin: 'md' }));
  bodyContents.push(_flexText(_translateHelper('stats.member_roster_weekly', {}, loc), { weight: 'bold', size: 'sm', margin: 'md', color: FLEX_COLORS.textPrimary }));

  if (summary.users && summary.users.length > 0) {
    for (var u = 0; u < summary.users.length; u++) {
      var user = summary.users[u];
      bodyContents.push(_flexBox([
        _flexText(user.userName || _translateHelper('common.member', {}, loc), { size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('$' + user.total + (loc === 'zh-TW' ? ' 元' : ''), { size: 'sm', weight: 'bold', color: FLEX_COLORS.danger })
      ], { layout: 'horizontal', justifyContent: 'space-between', margin: 'xs' }));
    }
  } else {
    bodyContents.push(_flexText(_translateHelper('stats.no_member_records', {}, loc), { size: 'xs', color: FLEX_COLORS.textSecondary, margin: 'xs' }));
  }

  // Append payment contents if provided
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var weeklyPayBoxes = _buildPaymentContents(paymentInfo, loc);
    for (var wp = 0; wp < weeklyPayBoxes.length; wp++) {
      bodyContents.push(weeklyPayBoxes[wp]);
    }
  }

  // Quick close order button if not closed
  if (!isClosed) {
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: _translateHelper('stats.close_btn_weekly', {}, loc),
        text: '本週結單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'md'
    });
  }

  var titleText = (loc === 'zh-TW')
    ? (isClosed ? '📊 本週梯次結單總表' : '📊 本週梯次訂餐統計總表')
    : (isClosed ? _translateHelper('stats.weekly_title_closed', {}, loc) : _translateHelper('stats.weekly_title', {}, loc));
  var headerSub = (loc === 'zh-TW')
    ? ('週一至週五 總計 ' + (summary.grandTotalQuantity || 0) + ' 份 · 總金額 $' + (summary.grandTotalAmount || 0) + ' 元')
    : _translateHelper('stats.total_summary', { qty: summary.grandTotalQuantity || 0, amount: summary.grandTotalAmount || 0 }, loc);
  var headerBg = isClosed ? FLEX_COLORS.primaryDark : FLEX_COLORS.primary;
  var footerMsg = isClosed
    ? _translateHelper('stats.footer_weekly_closed', {}, loc)
    : _translateHelper('stats.footer_weekly_open', {}, loc);

  return {
    type: 'bubble',
    size: 'mega',
    header: _flexBox([
      _flexText(titleText, { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText(headerSub, {
        size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs'
      })
    ], { backgroundColor: headerBg, paddingAll: 'lg' }),
    body: _flexBox(bodyContents, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText(footerMsg, { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
  };
}

/**
 * createChildrenListFlex — Display registered children/recipients card
 * @param {string} userName
 * @param {Array<string|Object>} children
 * @returns {Object} LINE Flex bubble
 */
function createChildrenListFlex(userName, children, locale) {
  var loc = _resolveLocale(locale);
  var kids = children || [];
  var memberName = userName || (loc === 'zh-TW' ? '成員' : 'Member');
  var header = _flexBox([
    _flexText(_translateHelper('children_list.title', {}, loc), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor
    }),
    _flexText(_translateHelper('children_list.subtitle', { name: memberName }, loc), {
      size: 'xs',
      color: FLEX_COLORS.textOnColor,
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary
  });

  var bodyContents = [];
  if (kids.length === 0) {
    bodyContents.push(_flexText(_translateHelper('children_list.empty', {}, loc), {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'md'
    }));
    bodyContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: _translateHelper('children_list.btn_setup', {}, loc),
        text: _translateHelper('children_list.cmd_setup', {}, loc)
      },
      style: 'primary',
      color: FLEX_COLORS.primary,
      height: 'sm',
      margin: 'md'
    });
  } else {
    bodyContents.push(_flexText(loc === 'zh-TW' ? '已登記的對象名冊（點餐時可一鍵指定）：' : _translateHelper('children_list.title', {}, loc), {
      size: 'xs',
      color: FLEX_COLORS.textSecondary,
      margin: 'xs'
    }));

    kids.forEach(function (k, i) {
      var name = typeof k === 'string' ? k : (k.childName || '');
      var note = (typeof k === 'object' && k.note) ? ' (' + k.note + ')' : '';
      bodyContents.push(_flexBox([
        _flexText('👦 ' + name + note, {
          size: 'md',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary,
          flex: 3
        })
      ], {
        layout: 'horizontal',
        alignItems: 'center',
        paddingAll: 'sm',
        margin: 'xs',
        backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
        cornerRadius: 'md'
      }));
    });

    bodyContents.push(_flexSeparator({ margin: 'md' }));
    bodyContents.push(_flexText(loc === 'zh-TW' ? '💡 點餐方式：\n1. 點擊菜單上的「+1 點餐」按鈕，系統會自動彈出小孩捷徑按鈕供您挑選。\n2. 或直接輸入「+1 招牌便當 (大寶)」即可指定！' : '💡 ' + _translateHelper('children_menu.footer', {}, loc), {
      size: 'xs',
      color: FLEX_COLORS.primaryDark,
      wrap: true,
      margin: 'sm'
    }));
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  return {
    type: 'bubble',
    size: 'mega',
    header: header,
    body: body
  };
}

/**
 * createChildrenHelpFlex — Interactive submenu for children & dining profile management
 * @param {string} [locale]
 * @returns {Object} LINE Flex bubble
 */
function createChildrenHelpFlex(locale) {
  var loc = _resolveLocale(locale);
  /* ---- header ---- */
  var header = _flexBox([
    _flexText(_translateHelper('children_menu.title', {}, loc), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText(_translateHelper('children_menu.subtitle', {}, loc), {
      size: 'xs',
      color: FLEX_COLORS.textOnColor,
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary
  });

  /* ---- body: buttonized command list ---- */
  var commands = [
    {
      label: _translateHelper('children_menu.item_list_title', {}, loc),
      desc: _translateHelper('children_menu.item_list_desc', {}, loc),
      cmd: _translateHelper('children_menu.cmd_list', {}, loc),
      btnText: _translateHelper('children_menu.btn_list', {}, loc)
    },
    {
      label: _translateHelper('children_menu.item_batch_title', {}, loc),
      desc: _translateHelper('children_menu.item_batch_desc', {}, loc),
      cmd: _translateHelper('children_menu.cmd_batch', {}, loc),
      btnText: _translateHelper('children_menu.btn_batch', {}, loc)
    },
    {
      label: _translateHelper('children_menu.item_add_title', {}, loc),
      desc: _translateHelper('children_menu.item_add_desc', {}, loc),
      cmd: _translateHelper('children_menu.cmd_add', {}, loc),
      btnText: _translateHelper('children_menu.btn_add', {}, loc)
    },
    {
      label: _translateHelper('children_menu.item_del_title', {}, loc),
      desc: _translateHelper('children_menu.item_del_desc', {}, loc),
      cmd: _translateHelper('children_menu.cmd_delete', {}, loc),
      btnText: _translateHelper('children_menu.btn_delete', {}, loc)
    }
  ];

  var bodyContents = [];
  commands.forEach(function (cmd, i) {
    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(cmd.label, {
          size: 'sm',
          weight: 'bold',
          color: FLEX_COLORS.textPrimary
        }),
        _flexText(cmd.desc, {
          size: 'xxs',
          color: FLEX_COLORS.textSecondary,
          margin: 'xs'
        })
      ], {
        layout: 'vertical',
        spacing: 'none',
        flex: 3,
        justifyContent: 'center'
      }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: cmd.btnText,
          text: cmd.cmd
        },
        style: 'primary',
        color: FLEX_COLORS.primary,
        height: 'sm',
        flex: 2
      }
    ], {
      layout: 'horizontal',
      alignItems: 'center',
      paddingAll: 'sm',
      backgroundColor: i % 2 === 0 ? FLEX_COLORS.background : FLEX_COLORS.surface,
      cornerRadius: 'md',
      margin: 'xs'
    }));
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footer = _flexBox([
    _flexText(_translateHelper('children_menu.footer', {}, loc), {
      size: 'xxs',
      color: FLEX_COLORS.textSecondary,
      wrap: true,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'mega',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * Create language selector Flex card
 * @param {string} currentLocale
 * @returns {Object}
 */
function createLanguageSelectFlex(currentLocale) {
  var loc = currentLocale || (typeof getDefaultLocale === 'function' ? getDefaultLocale() : 'zh-TW');
  var _translate = function (k, p) {
    return (typeof t === 'function') ? t(k, p, loc) : k;
  };

  var header = _flexBox([
    _flexText(_translate('lang.title'), {
      size: 'lg',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText(_translate('lang.subtitle'), {
      size: 'xs',
      color: '#E0F2FE',
      margin: 'xs'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary
  });

  var locales = (typeof SUPPORTED_LOCALES !== 'undefined') ? SUPPORTED_LOCALES : {
    'zh-TW': { code: 'zh-TW', name: '繁體中文', icon: '🇹🇼' },
    'en':    { code: 'en',    name: 'English',  icon: '🇺🇸' },
    'ja':    { code: 'ja',    name: '日本語',    icon: '🇯🇵' },
    'ko':    { code: 'ko',    name: '한국어',    icon: '🇰🇷' },
    'th':    { code: 'th',    name: 'ภาษาไทย',  icon: '🇹🇭' },
    'id':    { code: 'id',    name: 'Indonesia',icon: '🇮🇩' }
  };

  var bodyContents = [];
  var locKeys = Object.keys(locales);
  locKeys.forEach(function (code, i) {
    var info = locales[code];
    var isCurrent = code === loc;
    var btnLabel = info.icon + ' ' + info.name + (isCurrent ? ' ✓' : '');

    bodyContents.push(_flexBox([
      {
        type: 'button',
        action: {
          type: 'postback',
          label: btnLabel,
          data: 'action=set_lang&lang=' + code,
          displayText: '設定語言 ' + code
        },
        style: isCurrent ? 'primary' : 'secondary',
        color: isCurrent ? FLEX_COLORS.primary : undefined,
        height: 'sm'
      }
    ], {
      layout: 'vertical',
      margin: i === 0 ? 'none' : 'sm'
    }));
  });

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  var footer = _flexBox([
    _flexText(_translate('lang.current_prefix') + (locales[loc] ? locales[loc].icon + ' ' + locales[loc].name : loc), {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.textSecondary,
      align: 'center'
    })
  ], {
    layout: 'vertical',
    paddingAll: 'sm',
    backgroundColor: FLEX_COLORS.background
  });

  return {
    type: 'bubble',
    size: 'mega',
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
  g.createCancelOrderFlex = createCancelOrderFlex;
  g.createConfirmCancelFlex = createConfirmCancelFlex;
  g.createWeeklyScheduleFlex = createWeeklyScheduleFlex;
  g.createWeeklySummaryFlex = createWeeklySummaryFlex;
  g.createChildrenListFlex = createChildrenListFlex;
  g.createChildrenHelpFlex = createChildrenHelpFlex;
  g.createLanguageSelectFlex = createLanguageSelectFlex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FLEX_COLORS: FLEX_COLORS,
      createMenuFlex: createMenuFlex,
      createOrderReceiptFlex: createOrderReceiptFlex,
      createSummaryFlex: createSummaryFlex,
      createHelpFlex: createHelpFlex,
      createCancelOrderFlex: createCancelOrderFlex,
      createConfirmCancelFlex: createConfirmCancelFlex,
      createWeeklyScheduleFlex: createWeeklyScheduleFlex,
      createWeeklySummaryFlex: createWeeklySummaryFlex,
      createChildrenListFlex: createChildrenListFlex,
      createChildrenHelpFlex: createChildrenHelpFlex,
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


