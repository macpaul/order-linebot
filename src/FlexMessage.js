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
  var txt = {
    type: 'text',
    text: String(text !== undefined && text !== null ? text : '')
  };
  if (o.color) txt.color = o.color;
  if (o.size) txt.size = o.size;
  if (o.weight) txt.weight = o.weight;
  if (o.align) txt.align = o.align;
  if (o.wrap !== undefined) txt.wrap = o.wrap;
  if (o.margin && o.margin !== 'none') txt.margin = o.margin;
  if (o.flex !== undefined) txt.flex = o.flex;
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
  if (o.paddingAll) box.paddingAll = o.paddingAll;
  else if (o.padding && o.padding !== 'none') box.paddingAll = o.padding;
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
function createMenuFlex(restaurantName, cutoffTime, menuItems, dayOfWeek) {
  var groups = _groupMenuByCategory(menuItems);
  var headerTitle = restaurantName || '今日菜單';
  var dayBadge = dayOfWeek ? '【' + dayOfWeek + '】' : '';

  /* ---- header ---- */
  var header = _flexBox([
    _flexText(dayBadge + headerTitle, {
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
    paddingAll: 'lg',
    backgroundColor: FLEX_COLORS.primary,
    cornerRadius: 'lg'
  });

  /* ---- body: category sections ---- */
  var bodyContents = [];
  var totalRendered = 0;
  var MAX_ITEMS_PER_MENU = 35;

  if (groups.length === 0) {
    bodyContents.push(_flexText('（目前此店家尚無菜單項目）', {
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
              label: '+1 點餐',
              text: orderText
            },
            style: 'primary',
            color: FLEX_COLORS.primary,
            height: 'sm',
            flex: 2
          };
        } else {
          actionButton = {
            type: 'button',
            action: {
              type: 'message',
              label: '已售完',
              text: (dayOfWeek ? dayOfWeek + ' ' : '') + name + ' 已售完'
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
  var footer = _flexBox([
    _flexText('💡 點擊「+1 點餐」按鈕即可直接加訂！', {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
      align: 'center'
    }),
    _flexText('亦可輸入「' + (dayOfWeek ? dayOfWeek + ' ' : '') + '菜名+數量」或「取消 菜名」', {
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
  var titleSuffix = isWeekly ? ' 的本週訂單' : ' 的今日訂單';
  bodyContents.push(_flexText((userName || '成員') + titleSuffix, {
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
  } else if (isWeekly) {
    // Group orders by weekday for clear weekly view
    var dayMap = {};
    var dayKeys = [];
    orders.forEach(function (o) {
      var d = o.dayOfWeek || '今日';
      if (!dayMap[d]) {
        dayMap[d] = [];
        dayKeys.push(d);
      }
      dayMap[d].push(o);
    });

    dayKeys.forEach(function (day, di) {
      bodyContents.push(_flexText('【' + day + '】', {
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

        // Highlight the just-added item (matching name and weekday if applicable)
        var isAdded = addedItem && o.itemName === addedItem.itemName &&
          (!addedItem.dayOfWeek || !o.dayOfWeek || o.dayOfWeek === addedItem.dayOfWeek);
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
    });
  } else {
    // Daily mode: flat list
    orders.forEach(function (o) {
      var name = o.itemName || '';
      var qty = o.quantity || 1;
      var sub = o.subtotal !== undefined ? o.subtotal : qty * (o.price || 0);

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
  var totalLabel = isWeekly ? '本週合計' : '合計';
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
    _flexText('💡 回覆「取消」可開啟選單自選退訂特定餐點', {
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
function _buildPaymentContents(paymentInfo) {
  if (!paymentInfo || !paymentInfo.hasPaymentInfo) {
    return [];
  }

  var contents = [];
  contents.push(_flexSeparator({ margin: 'md' }));
  contents.push(_flexText('💳 付款方式與匯款資訊', {
    weight: 'bold',
    size: 'sm',
    color: FLEX_COLORS.primaryDark,
    margin: 'md'
  }));

  // Bank transfer block
  if (paymentInfo.bankAccount || paymentInfo.bankCode) {
    var bankTitle = (paymentInfo.bankCode ? paymentInfo.bankCode + ' ' : '') + (paymentInfo.bankName || '銀行跨行匯款');
    var bankRows = [
      _flexText('🏦 ' + bankTitle, {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary
      })
    ];

    if (paymentInfo.bankAccount) {
      bankRows.push(_flexText('帳號：' + paymentInfo.bankAccount, {
        size: 'sm',
        weight: 'bold',
        color: FLEX_COLORS.textPrimary,
        margin: 'xs'
      }));
    }

    if (paymentInfo.bankAccountName) {
      bankRows.push(_flexText('戶名：' + paymentInfo.bankAccountName, {
        size: 'xs',
        color: FLEX_COLORS.textSecondary,
        margin: 'xs'
      }));
    }

    bankRows.push(_flexText('💡 轉帳完成後請私訊或於群組告知主揪以利對帳', {
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

  // LINE Pay button
  if (paymentInfo.linePayUrl) {
    contents.push({
      type: 'button',
      action: {
        type: 'uri',
        label: '🟢 前往 LINE Pay 轉帳',
        uri: paymentInfo.linePayUrl
      },
      style: 'primary',
      color: '#06C755',
      height: 'sm',
      margin: 'sm'
    });
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
function createSummaryFlex(restaurantName, summaryData, isClosed, paymentInfo) {
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

  // Append payment contents if available
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var payBoxes = _buildPaymentContents(paymentInfo);
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
        label: '🔒 截止今日訂餐（結單）',
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
    padding: 'lg',
    backgroundColor: FLEX_COLORS.surface
  });

  /* ---- footer ---- */
  var footerMsg = isClosed
    ? '⏰ 已截止，請各成員儘速完成付款'
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
 * createHelpFlex — Interactive instruction card with tappable command buttons.
 *
 * Layout:
 *   header  – title banner ("便當點餐使用說明")
 *   body     – list of commands, each with a quick-action button
 *   footer   – usage hint
 *
 * @returns {Object} LINE Flex bubble contents object (type: "bubble").
 */
function createHelpFlex() {
  /* ---- header ---- */
  var header = _flexBox([
    _flexText('📖 便當點餐使用說明', {
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
    { label: '📅 本週菜單', desc: '查看週一至週五排程', cmd: '本週菜單', btnText: '看本週' },
    { label: '🍱 今日菜單', desc: '查看今日菜單並點餐', cmd: '菜單', btnText: '看菜單' },
    { label: '📝 我的訂單', desc: '查詢個人今日點餐紀錄', cmd: '我的訂單', btnText: '查今日' },
    { label: '📦 我的本週訂單', desc: '查詢本週全梯次預訂', cmd: '我的本週訂單', btnText: '查全週' },
    { label: '🗑️ 取消餐點', desc: '自選退訂特定餐點', cmd: '取消餐點', btnText: '去取消' },
    { label: '📊 本週統計', desc: '全週梯次訂購對帳總表', cmd: '本週統計', btnText: '本週統計' },
    { label: '📈 今日統計', desc: '今日即時訂單統計與名冊', cmd: '統計', btnText: '今日統計' },
    { label: '🔒 結單截止', desc: '截止訂餐並顯示收款資訊', cmd: '結單', btnText: '去結單' }
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
    _flexText('💡 點擊上方任一按鈕，即可直接發送指令！', {
      size: 'xs',
      weight: 'bold',
      color: FLEX_COLORS.primaryDark,
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
 * createCancelOrderFlex — Interactive cancel order menu with buttons.
 * Grouped by dayOfWeek so the user can see and tap specific items or days to cancel.
 *
 * @param {string} userName - Display name of the user.
 * @param {Array<Object>} activeOrders - Array of active order records.
 * @returns {Object} LINE Flex bubble
 */
function createCancelOrderFlex(userName, activeOrders) {
  var orders = activeOrders || [];

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

  var header = _flexBox([
    _flexText('🗑️ 取消訂單選單', {
      size: 'xl',
      weight: 'bold',
      color: FLEX_COLORS.textOnColor,
      align: 'start'
    }),
    _flexText((userName || '成員') + ' 的進行中訂單', {
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
    bodyContents.push(_flexText('（目前沒有任何進行中的訂餐紀錄）', {
      size: 'sm',
      color: FLEX_COLORS.textSecondary,
      align: 'center',
      margin: 'lg'
    }));
  } else {
    dayOrder.forEach(function (day, di) {
      var dayItems = dayMap[day];

      bodyContents.push(_flexText('【' + day + ' 預訂項目】', {
        size: 'md',
        weight: 'bold',
        color: FLEX_COLORS.primaryDark,
        align: 'start',
        margin: di === 0 ? 'none' : 'md'
      }));

      dayItems.forEach(function (it) {
        var itemText = it.itemName + (it.quantity > 1 ? ' x' + it.quantity : '') + ' ($' + (it.subtotal || (it.price * it.quantity)) + ')';
        var cancelText = '取消 ' + day + ' ' + it.itemName;

        bodyContents.push(_flexBox([
          _flexBox([
            _flexText(itemText, {
              size: 'sm',
              weight: 'bold',
              color: FLEX_COLORS.textPrimary,
              wrap: true
            })
          ], {
            layout: 'vertical',
            flex: 3,
            justifyContent: 'center'
          }),
          {
            type: 'button',
            action: {
              type: 'message',
              label: '取消此項',
              text: cancelText
            },
            style: 'primary',
            color: FLEX_COLORS.danger,
            height: 'sm',
            flex: 2
          }
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

      // Button to cancel all items for this day
      bodyContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: '取消【' + day + '】所有餐點',
          text: '取消 ' + day + ' 全部'
        },
        style: 'secondary',
        height: 'sm',
        margin: 'xs'
      });
    });

    // Overall button to cancel all orders
    if (dayOrder.length > 1 || orders.length > 1) {
      bodyContents.push(_flexSeparator({ margin: 'md' }));
      bodyContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: '❌ 取消全部所有預約訂單',
          text: '取消 全部'
        },
        style: 'secondary',
        height: 'sm',
        margin: 'sm'
      });
    }
  }

  var body = _flexBox(bodyContents, {
    layout: 'vertical',
    paddingAll: 'md',
    backgroundColor: FLEX_COLORS.surface
  });

  var footer = _flexBox([
    _flexText('💡 點選按鈕後將立即退訂，或直接輸入「取消 週幾 菜名」', {
      size: 'xxs',
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
    size: 'giga',
    header: header,
    body: body,
    footer: footer
  };
}

/**
 * createWeeklyScheduleFlex — Build a Flex card displaying the Mon-Fri schedule
 * @param {Array<Object>} schedule - List of { dayOfWeek, restaurantName, cutoffTime, notes, isActive }
 * @returns {Object} LINE Flex bubble
 */
function createWeeklyScheduleFlex(schedule) {
  var rows = [];
  var days = schedule || [];

  for (var i = 0; i < days.length; i++) {
    var s = days[i];
    rows.push(_flexBox([
      _flexBox([
        _flexText(s.dayOfWeek, { weight: 'bold', size: 'sm', color: FLEX_COLORS.textOnColor, align: 'center' })
      ], {
        backgroundColor: FLEX_COLORS.primary,
        cornerRadius: 'sm',
        paddingAll: 'xs',
        width: '45px'
      }),
      _flexBox([
        _flexText(s.restaurantName || '尚未指定店家', { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('⏰ 截止 ' + (s.cutoffTime || '10:30') + (s.notes ? ' · ' + s.notes : ''), { size: 'xs', color: FLEX_COLORS.textSecondary })
      ], { layout: 'vertical', margin: 'md', flex: 1 }),
      {
        type: 'button',
        action: {
          type: 'message',
          label: '看菜單',
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
      _flexText('📅 本週訂餐排程表', { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五每日店家 · 支援一梯次預訂', { size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs' })
    ], { backgroundColor: FLEX_COLORS.primaryDark, paddingAll: 'lg' }),
    body: _flexBox(rows, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText('💡 輸入「週一+1 [餐點]」或點選「看菜單」進行預訂', { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
  };
}

/**
 * createWeeklySummaryFlex — Build a Flex card displaying the weekly batch summary
 * @param {Object} weeklySummary - { daySummaries, grandTotalQuantity, grandTotalAmount, users }
 * @param {boolean} [isClosed] - Whether weekly ordering has ended.
 * @param {Object} [paymentInfo] - Optional payment configuration (LINE Pay & Bank Transfer).
 * @returns {Object} LINE Flex bubble
 */
function createWeeklySummaryFlex(weeklySummary, isClosed, paymentInfo) {
  var summary = weeklySummary || { daySummaries: [], users: [] };
  var bodyContents = [];

  for (var i = 0; i < summary.daySummaries.length; i++) {
    var ds = summary.daySummaries[i];
    var dayItemsText = ds.items && ds.items.length > 0
      ? ds.items.map(function (it) { return it.itemName + 'x' + it.quantity; }).join('、')
      : '無訂單';

    bodyContents.push(_flexBox([
      _flexBox([
        _flexText(ds.dayOfWeek + ' ' + (ds.restaurantName || ''), { weight: 'bold', size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('共 ' + ds.totalQuantity + ' 份 · $' + ds.totalAmount + ' 元', { size: 'xs', color: FLEX_COLORS.primary, weight: 'bold' })
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
  bodyContents.push(_flexText('👤 成員本週梯次應付明細', { weight: 'bold', size: 'sm', margin: 'md', color: FLEX_COLORS.textPrimary }));

  if (summary.users && summary.users.length > 0) {
    for (var u = 0; u < summary.users.length; u++) {
      var user = summary.users[u];
      bodyContents.push(_flexBox([
        _flexText(user.userName, { size: 'sm', color: FLEX_COLORS.textPrimary }),
        _flexText('$' + user.total + ' 元', { size: 'sm', weight: 'bold', color: FLEX_COLORS.danger })
      ], { layout: 'horizontal', justifyContent: 'space-between', margin: 'xs' }));
    }
  } else {
    bodyContents.push(_flexText('尚無成員訂購紀錄', { size: 'xs', color: FLEX_COLORS.textSecondary, margin: 'xs' }));
  }

  // Append payment contents if provided
  if (paymentInfo && paymentInfo.hasPaymentInfo) {
    var weeklyPayBoxes = _buildPaymentContents(paymentInfo);
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
        label: '🔒 截止本週預訂（結單）',
        text: '本週結單'
      },
      style: 'secondary',
      height: 'sm',
      margin: 'md'
    });
  }

  var titleText = isClosed ? '📊 本週梯次結單總表' : '📊 本週梯次訂餐統計總表';
  var headerBg = isClosed ? FLEX_COLORS.primaryDark : FLEX_COLORS.primary;
  var footerMsg = isClosed ? '⏰ 本週預訂已截止，請各成員依此表金額完成付款' : '📋 請各成員依此表金額完成對帳與付款';

  return {
    type: 'bubble',
    size: 'mega',
    header: _flexBox([
      _flexText(titleText, { weight: 'bold', size: 'lg', color: FLEX_COLORS.textOnColor }),
      _flexText('週一至週五 總計 ' + (summary.grandTotalQuantity || 0) + ' 份 · 總金額 $' + (summary.grandTotalAmount || 0) + ' 元', {
        size: 'xs', color: FLEX_COLORS.textOnColor, margin: 'xs'
      })
    ], { backgroundColor: headerBg, paddingAll: 'lg' }),
    body: _flexBox(bodyContents, { layout: 'vertical', paddingAll: 'md' }),
    footer: _flexBox([
      _flexText(footerMsg, { size: 'xs', color: FLEX_COLORS.textSecondary, align: 'center' })
    ], { backgroundColor: FLEX_COLORS.background, paddingAll: 'sm' })
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
  g.createWeeklyScheduleFlex = createWeeklyScheduleFlex;
  g.createWeeklySummaryFlex = createWeeklySummaryFlex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FLEX_COLORS: FLEX_COLORS,
      createMenuFlex: createMenuFlex,
      createOrderReceiptFlex: createOrderReceiptFlex,
      createSummaryFlex: createSummaryFlex,
      createHelpFlex: createHelpFlex,
      createCancelOrderFlex: createCancelOrderFlex,
      createWeeklyScheduleFlex: createWeeklyScheduleFlex,
      createWeeklySummaryFlex: createWeeklySummaryFlex,
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

