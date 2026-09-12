/**
 * LINE Meal Ordering Bot for Google Apps Script (All-In-One Bundle)
 * Automatically generated on: 2026-09-12T03:41:55.981Z
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this entire content into Code.gs
 * 3. Set Project Settings -> Script Properties (CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET)
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */


/* =========================================================
 * File: Config.js
 * ========================================================= */

/**
 * Config.js - Central configuration for LINE Meal Ordering Bot
 * Supports both Google Apps Script (GAS) and Node.js runtime for testing.
 */

var CONFIG = {
  /** LINE Messaging API — Reply to a user's message */
  LINE_REPLY_URL: 'https://api.line.me/v2/bot/message/reply',

  /** LINE Messaging API — Push a message to a user or group */
  LINE_PUSH_URL: 'https://api.line.me/v2/bot/message/push',

  /** LINE Messaging API — Fetch a user's profile (displayName, pictureUrl) */
  LINE_PROFILE_URL: 'https://api.line.me/v2/bot/profile',

  /** LINE Messaging API — Group management (member profile) */
  LINE_GROUP_MEMBER_URL: 'https://api.line.me/v2/bot/group',

  /**
   * Spreadsheet tab names used by the bot's data layer.
   * Each key maps to the literal tab name in the Google Sheet.
   */
  SHEET_NAMES: {
    CONFIG: 'Config',
    WEEKLY_SCHEDULE: 'WeeklySchedule',
    MENU: 'Menu',
    ORDERS: 'Orders',
    SUMMARY: 'Summary',
    CHILDREN: 'Children',
    USER_PREFERENCES: 'UserPreferences'
  },

  /**
   * Default system locale ('zh-TW', 'en', 'ja', 'ko', 'th', 'id')
   */
  DEFAULT_LOCALE: 'zh-TW',

  /**
   * Allow individual users to customize their preferred language via menu
   * 'true': Users can switch language; help flex shows language button
   * 'false': Fixed to DEFAULT_LOCALE across the entire system
   */
  ENABLE_USER_LOCALE: 'false',

  /**
   * Mon to Fri days of week in Chinese
   */
  DAYS_OF_WEEK: ['週一', '週二', '週三', '週四', '週五'],

  /**
   * Order lifecycle status values.
   * OPEN   — Accepting new items (before cutoff)
   * CLOSED — No further changes (after cutoff / summary locked)
   */
  ORDER_STATUS: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
  },

  /**
   * Default daily cutoff time (24-hour clock)
   */
  DEFAULT_CUTOFF_HOUR: 11,
  DEFAULT_CUTOFF_MINUTE: 0,

  /**
   * Default Open Source Repository URL (AGPL-3.0)
   */
  SOURCE_CODE_URL: 'https://tinyurl.com/4c92wtee',

  /**
   * Allow group members to switch organizer when calling '開單'
   * 'true': Anyone calling '開單' becomes the new organizer
   * 'false': Only the existing ORGANIZER_ID can modify or open order
   */
  ALLOW_SWITCH_ORGANIZER: 'true',

  /**
   * User Identifier Storage Mode
   * 'HASHED_ID': One-way HMAC-SHA256 salted hash (e.g. usr_8f9c21b4a7d3e5f0). Default for privacy.
   * 'USER_ID': Raw LINE User ID (e.g. U12345...).
   * 'NICKNAME': User Display Name / Nickname as index. Zero User ID storage.
   */
  USER_IDENTIFIER_MODE: 'HASHED_ID',

  /**
   * Optional custom salt for HASHED_ID mode.
   * If left blank, falls back to CHANNEL_SECRET or default internal salt.
   */
  HASH_SALT: ''
};

/**
 * getConfigProperty — Dynamic property lookup with fallback chain:
 * 1. PropertiesService (GAS)
 * 2. process.env (Node.js)
 * 3. defaultValue
 */
function getConfigProperty(key, defaultValue) {
  // 1. Google Apps Script — PropertiesService
  try {
    if (typeof PropertiesService !== 'undefined') {
      var props = PropertiesService.getScriptProperties();
      var val = props.getProperty(key);
      if (val !== '' && val !== null && val !== undefined) {
        return val;
      }
    }
  } catch (e) {
    // Non-GAS runtime
  }

  // 2. Node.js — process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      var envVal = process.env[key];
      if (envVal !== undefined && envVal !== '') {
        return envVal;
      }
    }
  } catch (e) {
    // process global unavailable
  }

  // 3. Fallback
  return defaultValue;
}

// Dual-Environment Export (GAS + Node.js)
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.CONFIG = CONFIG;
  g.getConfigProperty = getConfigProperty;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CONFIG: CONFIG,
      getConfigProperty: getConfigProperty
    };
  }
})();


/* =========================================================
 * File: I18n.js
 * ========================================================= */

/**
 * I18n.js - Multi-language Internationalization Service for LINE Meal Ordering Bot
 * Supports: zh-TW (Traditional Chinese), en (English), ja (Japanese), ko (Korean), th (Thai), id (Indonesian)
 * Dual runtime: Google Apps Script (GAS) & Node.js.
 */

var ConfigModule = null;
var SheetModule = null;

(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : null;

  if (g && g.CONFIG && g.getConfigValue) {
    ConfigModule = g;
    SheetModule = g;
  } else {
    try {
      ConfigModule = require('./Config.js');
      SheetModule = require('./SheetService.js');
    } catch (e) {}
  }
})();

var SUPPORTED_LOCALES = {
  'zh-TW': { code: 'zh-TW', name: '繁體中文', icon: '🇹🇼' },
  'en':    { code: 'en',    name: 'English',  icon: '🇺🇸' },
  'ja':    { code: 'ja',    name: '日本語',    icon: '🇯🇵' },
  'ko':    { code: 'ko',    name: '한국어',    icon: '🇰🇷' },
  'th':    { code: 'th',    name: 'ภาษาไทย',  icon: '🇹🇭' },
  'id':    { code: 'id',    name: 'Indonesia',icon: '🇮🇩' }
};

var I18N_MESSAGES = {
  'zh-TW': {
    // Common
    'common.member': '成員',
    'common.organizer': '開單人',
    'common.today': '今日',
    'common.all': '通用',
    'common.all_days': '全部',
    'common.self': '本人',
    'common.other': '其他',
    'common.general': '一般',
    'common.currency_prefix': '$',
    'common.currency_suffix': ' 元',
    'common.unit_serving': ' 份',
    'common.unit_record': ' 筆',
    'common.separator': '、',
    'common.bracket_open': '【',
    'common.bracket_close': '】',
    'common.unknown': '未知',
    'common.anonymous_member': '匿名成員',

    // Weekdays
    'weekday.mon': '週一',
    'weekday.tue': '週二',
    'weekday.wed': '週三',
    'weekday.thu': '週四',
    'weekday.fri': '週五',
    'weekday.sat': '週六',
    'weekday.sun': '週日',

    // Help Flex
    'help.title': '📖 便當點餐使用說明',
    'help.tip_click': '💡 點擊上方任一按鈕，即可直接發送指令！',
    'help.license': '服務授權：AGPL-3.0 原始碼 ',
    'help.alt_text': '便當點餐指令說明',
    'help.cmd_weekly_schedule.title': '📅 本週菜單',
    'help.cmd_weekly_schedule.desc': '查看週一至週五排程',
    'help.cmd_weekly_schedule.btn': '看本週',
    'help.cmd_weekly_schedule.cmd': '本週菜單',
    'help.cmd_today_menu.title': '🍱 今日菜單',
    'help.cmd_today_menu.desc': '查看今日菜單並點餐',
    'help.cmd_today_menu.btn': '看菜單',
    'help.cmd_today_menu.cmd': '菜單',
    'help.cmd_children.title': '👶 設定小孩',
    'help.cmd_children.desc': '小孩名冊與用餐分配設定',
    'help.cmd_children.btn': '設定小孩',
    'help.cmd_children.cmd': '設定小孩',
    'help.cmd_my_today.title': '📝 我的訂單',
    'help.cmd_my_today.desc': '查詢個人今日點餐紀錄',
    'help.cmd_my_today.btn': '查今日',
    'help.cmd_my_today.cmd': '我的訂單',
    'help.cmd_my_weekly.title': '📦 我的本週訂單',
    'help.cmd_my_weekly.desc': '查詢本週全梯次預訂',
    'help.cmd_my_weekly.btn': '查全週',
    'help.cmd_my_weekly.cmd': '我的本週訂單',
    'help.cmd_cancel.title': '🗑️ 取消餐點',
    'help.cmd_cancel.desc': '自選退訂特定餐點',
    'help.cmd_cancel.btn': '去取消',
    'help.cmd_cancel.cmd': '取消餐點',
    'help.cmd_weekly_stats.title': '📊 本週統計',
    'help.cmd_weekly_stats.desc': '全週梯次訂購對帳總表',
    'help.cmd_weekly_stats.btn': '本週統計',
    'help.cmd_weekly_stats.cmd': '本週統計',
    'help.cmd_today_stats.title': '📈 今日統計',
    'help.cmd_today_stats.desc': '今日即時訂單統計與名冊',
    'help.cmd_today_stats.btn': '今日統計',
    'help.cmd_today_stats.cmd': '今日統計',
    'help.cmd_close.title': '🔒 結單截止',
    'help.cmd_close.desc': '截止訂餐並顯示收款資訊',
    'help.cmd_close.btn': '去結單',
    'help.cmd_close.cmd': '結單',
    'help.cmd_language.title': '🌐 設定語言',
    'help.cmd_language.desc': '切換個人顯示與操作語言',
    'help.cmd_language.btn': '切換語言',
    'help.cmd_language.cmd': '設定語言',

    // Language selector
    'lang.title': '🌐 語言設定 (Language Settings)',
    'lang.subtitle': '請選擇您偏好的顯示與操作語言：',
    'lang.current_prefix': '目前語系：',
    'lang.set_success': '✅ 語言已成功切換為「{lang}」！後續個人訊息將以此語言呈現。',
    'lang.disabled': '⚠️ 目前系統管理員已固定系統語言，尚未開放個人切換語言功能。',
    'lang.invalid': '⚠️ 不支援的語系代碼「{lang}」。支援選項：{options}',
    'lang.prompt_select': '🌐 請選擇要切換的語言：',

    // Submenu: Children Management
    'children_menu.title': '👶 小孩與用餐對象管理選單',
    'children_menu.subtitle': '點擊按鈕直接查詢或帶入指令範例',
    'children_menu.item_list_title': '👦 我的小孩 / 小孩名單',
    'children_menu.item_list_desc': '圖文卡片瀏覽名下小孩清單',
    'children_menu.btn_list': '看名單',
    'children_menu.cmd_list': '我的小孩',
    'children_menu.item_batch_title': '👶 設定小孩 大寶, 二寶',
    'children_menu.item_batch_desc': '批次綁定小孩（覆蓋現有名冊）',
    'children_menu.btn_batch': '批次登記',
    'children_menu.cmd_batch': '設定小孩 大寶, 二寶',
    'children_menu.item_add_title': '➕ 新增小孩 小寶 附小一年一班',
    'children_menu.item_add_desc': '新增單一小孩姓名與班級備註',
    'children_menu.btn_add': '新增小孩',
    'children_menu.cmd_add': '新增小孩 小寶 附小一年一班',
    'children_menu.item_del_title': '🗑️ 刪除小孩 小寶',
    'children_menu.item_del_desc': '移除指定小孩名冊紀錄',
    'children_menu.btn_delete': '刪除小孩',
    'children_menu.cmd_delete': '刪除小孩 小寶',
    'children_menu.footer': '💡 點擊「批次登記 / 新增 / 刪除」將送出範例指令，您亦可在對話框自行編輯小孩姓名與班級備註！',
    'children_menu.alt_text': '👶 小孩與用餐對象管理選單',

    // Submenu: Children List Card
    'children_list.title': '👶 我的小孩與用餐對象名冊',
    'children_list.subtitle': '{name} 登記的用餐對象與班級',
    'children_list.empty': '（尚未登記任何小孩或用餐對象）',
    'children_list.btn_setup': '設定小孩',
    'children_list.cmd_setup': '設定小孩',
    'children_list.alt_text': '👶 我的小孩與用餐對象名冊',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 本週訂餐排程表',
    'schedule.subtitle': '週一至週五每日店家 · 支援一梯次預訂',
    'schedule.no_restaurant': '尚未指定店家',
    'schedule.cutoff_prefix': '⏰ 截止 ',
    'schedule.btn_menu': '看菜單',
    'schedule.footer': '💡 輸入「週一+1 [餐點]」或點選「看菜單」進行預訂',
    'schedule.alt_text': '📅 本週訂餐排程表 (週一至週五)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' 菜單',
    'menu.cutoff_prefix': '⏰ 今日截止時間: ',
    'menu.btn_order': '+1 點餐',
    'menu.sold_out': '已售完',
    'menu.footer_hint1': '💡 點擊「+1 點餐」按鈕即可直接加訂！',
    'menu.footer_hint2': '亦可輸入「{day}菜名+數量」或「取消 菜名」',
    'menu.alt_text': '【訂餐開始】{restaurant} 菜單',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ 取消訂單選單',
    'cancel.title_org': '👑 取消訂單選單 (開單人)',
    'cancel.subtitle': '{name} 的個人進行中訂單',
    'cancel.no_orders': '（目前沒有任何進行中的訂餐紀錄）',
    'cancel.day_items': '【{day} 預訂項目】',
    'cancel.locked': '無法取消',
    'cancel.reason_expired': '已過期',
    'cancel.reason_cutoff': '已截止',
    'cancel.btn_cancel_item': '取消此項',
    'cancel.btn_cancel_day': '取消我的【{day}】餐點',
    'cancel.btn_cancel_all': '取消我的全部預訂 (週一至週五)',
    'cancel.org_section': '👑 開單人管理專區',
    'cancel.btn_org_day': '⚠️ 取消全體當日餐點 (需確認)',
    'cancel.btn_org_all': '🚨 取消全體未截止預訂 (需確認)',
    'cancel.all_locked_warning': '⚠️ 所有訂單均已超過結單時間或日期，無法修改或取消。若有特殊需求請洽開單人。',
    'cancel.footer_org': '💡 開單人可協助管理訂單；全體取消操作將跳出警告確認卡，需再次確認。',
    'cancel.footer_member': '💡 您只能退訂自己訂購的餐點；如需退訂他人餐點或取消全體訂單，請洽開單人。',
    'cancel.confirm_header': '🚨 取消確認警告 (開單人專用)',
    'cancel.btn_abort': '放棄取消',
    'cancel.confirm_footer': '⚠️ 警告：此操作將影響全體成員且無法復原！',
    'cancel.alt_text': '🗑️ 請選擇欲取消的餐點',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': '🍱 今日訂餐即時統計',
    'stats.today_title_closed': '🔒 今日訂餐已結單',
    'stats.weekly_title': '📊 本週梯次訂餐統計總表',
    'stats.weekly_title_closed': '📊 本週梯次結單總表',
    'stats.weekly_subtitle_open': '即時統計 · 週一至週五各梯次明細',
    'stats.weekly_subtitle_closed': '全週各梯次統計與收款資訊',
    'stats.today_subtitle_open': '即時統計 · 名冊明細與總計',
    'stats.today_subtitle_closed': '已截止訂餐 · 名冊與收款資訊',
    'stats.member_roster_today': '👤 今日成員應付名冊',
    'stats.member_roster_weekly': '👤 成員本週梯次應付明細',
    'stats.no_member_records': '尚無成員訂購紀錄',
    'stats.status_open': '開放中',
    'stats.status_closed': '已截止',
    'stats.footer_closed': '⏰ 已截止，請各成員儘速完成付款',
    'stats.footer_open': '🟢 目前開放點餐中',
    'stats.footer_weekly_closed': '⏰ 本週預訂已截止，請各成員依此表金額完成付款',
    'stats.footer_weekly_open': '📋 請各成員依此表金額完成對帳與付款',
    'stats.close_btn_today': '🔒 截止今日訂餐（結單）',
    'stats.close_btn_weekly': '🔒 截止本週預訂（結單）',
    'stats.no_orders': '無訂單',
    'stats.total_summary': '共 {qty} 份 · ${amount} 元',
    'stats.alt_text_today': '【今日訂餐統計】{restaurant} ({qty}份 / ${amount})',
    'stats.alt_text_weekly': '📊 本週梯次訂餐統計總表',
    'stats.alt_text_closed_weekly': '【已結單】本週梯次訂餐總表與收費清單',
    'stats.alt_text_closed_today': '【已結單】{restaurant} 訂購名單總計',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 付款方式與匯款資訊',
    'payment.bank_transfer': '銀行跨行匯款',
    'payment.account_number': '帳號：{account}',
    'payment.account_name': '戶名：{name}',
    'payment.zoom_qr': '放大檢視',
    'payment.qr_hint': '🔍 點擊 QR Code 可放大檢視或截圖掃碼轉帳',
    'payment.notify_hint': '💡 轉帳完成後請私訊或於群組告知主揪以利對帳',
    'payment.btn_wallet': '🟢 開啟 LINE 錢包轉帳',
    'payment.btn_linepay': '🟢 前往 LINE Pay 轉帳',
    'payment.linepay_hint': '📱 請於錢包點選「轉帳」並搜尋好友：「{recipient}」{idHint}',
    'payment.linepay_qr': 'LINE Pay 收款碼',
    'payment.info_title': '💳【付款資訊】',
    'payment.bank_transfer_bullet': '• 銀行轉帳：',
    'payment.bank_qr_bullet': '• 銀行轉帳 QR Code：',
    'payment.linepay_bullet': '• LINE Pay 轉帳：',
    'payment.linepay_friend_bullet': '• LINE Pay 好友轉帳：',
    'payment.linepay_qr_bullet': '• LINE Pay 收款碼：',

    // Order Receipt Card
    'receipt.title': '✅ 加購成功',
    'receipt.weekly_user_orders': '{name} 的本週訂單',
    'receipt.daily_user_orders': '{name} 的今日訂單',
    'receipt.no_items': '（尚無項目）',
    'receipt.total_weekly': '本週合計',
    'receipt.total_daily': '合計',
    'receipt.cancel_hint': '💡 回覆「取消」可開啟選單自選退訂特定餐點',
    'receipt.alt_text': '訂單已記錄{suffix}：{day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': '您本週（週一至週五）尚未有任何預訂紀錄喔！',
    'my_orders.no_today_orders': '您今日尚未有訂餐紀錄喔！可以直接輸入「+1 [餐點名稱]」點餐。',
    'my_orders.weekly_title': '🍱【您的本週梯次訂單】',
    'my_orders.today_title': '【您的今日訂單】',
    'my_orders.weekly_total': '本週總計：${amount} 元',
    'my_orders.today_total': '總計：${amount} 元',
    'my_orders.subtotal': ' (小計 ${subtotal})',
    'my_orders.cutoff_notice': '\n⚠️ 今日點餐已超過截止時間，不可修改或取消餐點。'
  },

  'en': {
    // Common
    'common.member': 'Member',
    'common.organizer': 'Organizer',
    'common.today': 'Today',
    'common.all': 'All',
    'common.all_days': 'All Days',
    'common.self': 'Self',
    'common.other': 'Other',
    'common.general': 'General',
    'common.currency_prefix': '$',
    'common.currency_suffix': '',
    'common.unit_serving': ' serving(s)',
    'common.unit_record': ' item(s)',
    'common.separator': ', ',
    'common.bracket_open': '[',
    'common.bracket_close': ']',
    'common.unknown': 'Unknown',
    'common.anonymous_member': 'Anonymous',

    // Weekdays
    'weekday.mon': 'Mon',
    'weekday.tue': 'Tue',
    'weekday.wed': 'Wed',
    'weekday.thu': 'Thu',
    'weekday.fri': 'Fri',
    'weekday.sat': 'Sat',
    'weekday.sun': 'Sun',

    // Help Flex
    'help.title': '📖 Meal Ordering Bot Guide',
    'help.tip_click': '💡 Click any button above to send the command directly!',
    'help.license': 'License: AGPL-3.0 Source Code ',
    'help.alt_text': 'Meal Ordering Bot Guide',
    'help.cmd_weekly_schedule.title': '📅 Weekly Menu',
    'help.cmd_weekly_schedule.desc': 'View schedule for Mon to Fri',
    'help.cmd_weekly_schedule.btn': 'Weekly',
    'help.cmd_weekly_schedule.cmd': 'weekly menu',
    'help.cmd_today_menu.title': '🍱 Today\'s Menu',
    'help.cmd_today_menu.desc': 'View today\'s menu & order',
    'help.cmd_today_menu.btn': 'Menu',
    'help.cmd_today_menu.cmd': 'menu',
    'help.cmd_children.title': '👶 Manage Kids',
    'help.cmd_children.desc': 'Children list & meal allocation',
    'help.cmd_children.btn': 'Kids',
    'help.cmd_children.cmd': 'children',
    'help.cmd_my_today.title': '📝 Today\'s Orders',
    'help.cmd_my_today.desc': 'Check your orders for today',
    'help.cmd_my_today.btn': 'Today',
    'help.cmd_my_today.cmd': 'my order',
    'help.cmd_my_weekly.title': '📦 Weekly Orders',
    'help.cmd_my_weekly.desc': 'Check all your bookings this week',
    'help.cmd_my_weekly.btn': 'All Week',
    'help.cmd_my_weekly.cmd': 'my weekly orders',
    'help.cmd_cancel.title': '🗑️ Cancel Meal',
    'help.cmd_cancel.desc': 'Cancel specific ordered items',
    'help.cmd_cancel.btn': 'Cancel',
    'help.cmd_cancel.cmd': 'cancel',
    'help.cmd_weekly_stats.title': '📊 Weekly Stats',
    'help.cmd_weekly_stats.desc': 'Summary & reconciliation for week',
    'help.cmd_weekly_stats.btn': 'Summary',
    'help.cmd_weekly_stats.cmd': 'weekly stats',
    'help.cmd_today_stats.title': '📈 Today\'s Stats',
    'help.cmd_today_stats.desc': 'Live order totals & buyer roster',
    'help.cmd_today_stats.btn': 'Stats',
    'help.cmd_today_stats.cmd': 'today stats',
    'help.cmd_close.title': '🔒 Close Orders',
    'help.cmd_close.desc': 'Close ordering & show payment info',
    'help.cmd_close.btn': 'Close',
    'help.cmd_close.cmd': 'close orders',
    'help.cmd_language.title': '🌐 Language',
    'help.cmd_language.desc': 'Change personal display language',
    'help.cmd_language.btn': 'Language',
    'help.cmd_language.cmd': 'set language',

    // Language selector
    'lang.title': '🌐 Language Settings',
    'lang.subtitle': 'Please select your preferred language:',
    'lang.current_prefix': 'Current Language: ',
    'lang.set_success': '✅ Language successfully set to "{lang}"! Future messages will be in this language.',
    'lang.disabled': '⚠️ Language switching is currently disabled by the administrator.',
    'lang.invalid': '⚠️ Unsupported language code "{lang}". Supported options: {options}',
    'lang.prompt_select': '🌐 Please select a language to switch to:',

    // Submenu: Children Management
    'children_menu.title': '👶 Manage Kids Menu',
    'children_menu.subtitle': 'Tap buttons to view profiles or send sample commands',
    'children_menu.item_list_title': '👦 My Kids / Kids List',
    'children_menu.item_list_desc': 'View registered children profiles & classes',
    'children_menu.btn_list': 'View List',
    'children_menu.cmd_list': 'my kids',
    'children_menu.item_batch_title': '👶 Set Kids (Batch)',
    'children_menu.item_batch_desc': 'Batch bind children (replaces current roster)',
    'children_menu.btn_batch': 'Batch Set',
    'children_menu.cmd_batch': 'children Tim, Ben',
    'children_menu.item_add_title': '➕ Add Kid',
    'children_menu.item_add_desc': 'Add a child profile with optional class note',
    'children_menu.btn_add': 'Add Kid',
    'children_menu.cmd_add': 'add kid Tim Class 1A',
    'children_menu.item_del_title': '🗑️ Delete Kid',
    'children_menu.item_del_desc': 'Remove a registered child profile',
    'children_menu.btn_delete': 'Delete Kid',
    'children_menu.cmd_delete': 'delete kid Tim',
    'children_menu.footer': '💡 Tap buttons to send sample commands, or edit child name and class note directly in chat!',
    'children_menu.alt_text': '👶 Children Management Menu',

    // Submenu: Children List Card
    'children_list.title': '👶 My Kids & Dining Profiles',
    'children_list.subtitle': 'Registered profiles & classes for {name}',
    'children_list.empty': '(No children registered yet)',
    'children_list.btn_setup': 'Manage Kids',
    'children_list.cmd_setup': 'children',
    'children_list.alt_text': '👶 Children Roster',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 Weekly Ordering Schedule',
    'schedule.subtitle': 'Mon-Fri Daily Restaurants · Pre-orders supported',
    'schedule.no_restaurant': 'Restaurant TBD',
    'schedule.cutoff_prefix': '⏰ Cutoff ',
    'schedule.btn_menu': 'Menu',
    'schedule.footer': '💡 Type "[Day]+1 [item]" or tap "Menu" to pre-order',
    'schedule.alt_text': '📅 Weekly Schedule (Mon-Fri)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' Menu',
    'menu.cutoff_prefix': "⏰ Today's Cutoff: ",
    'menu.btn_order': '+1 Order',
    'menu.sold_out': 'Sold Out',
    'menu.footer_hint1': '💡 Tap "+1 Order" button to place your order!',
    'menu.footer_hint2': 'Or type "{day} [item] + [qty]" or "cancel [item]"',
    'menu.alt_text': '[Ordering Open] {restaurant} Menu',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ Cancel Orders',
    'cancel.title_org': '👑 Cancel Orders (Organizer)',
    'cancel.subtitle': 'Active orders for {name}',
    'cancel.no_orders': '(No active orders found)',
    'cancel.day_items': '【{day} Pre-orders】',
    'cancel.locked': 'Locked',
    'cancel.reason_expired': 'Expired',
    'cancel.reason_cutoff': 'Cutoff Passed',
    'cancel.btn_cancel_item': 'Cancel Item',
    'cancel.btn_cancel_day': 'Cancel my {day} orders',
    'cancel.btn_cancel_all': 'Cancel all my pre-orders (Mon-Fri)',
    'cancel.org_section': '👑 Organizer Actions',
    'cancel.btn_org_day': '⚠️ Cancel All Today Orders (Confirm)',
    'cancel.btn_org_all': '🚨 Cancel All Advance Orders (Confirm)',
    'cancel.all_locked_warning': '⚠️ All orders have passed the cutoff time or date and cannot be modified. Contact organizer for special needs.',
    'cancel.footer_org': '💡 Organizer can manage orders; bulk cancellation requires confirmation.',
    'cancel.footer_member': '💡 You can only cancel your own orders. Contact organizer for other requests.',
    'cancel.confirm_header': '🚨 Cancellation Warning (Organizer)',
    'cancel.btn_abort': 'Keep Orders',
    'cancel.confirm_footer': '⚠️ Once confirmed, orders will be cancelled immediately. This cannot be undone.',
    'cancel.alt_text': '🗑️ Select items to cancel',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': "🍱 Today's Orders Summary",
    'stats.today_title_closed': "🔒 Today's Orders Closed",
    'stats.weekly_title': '📊 Weekly Orders Summary',
    'stats.weekly_title_closed': '🔒 Weekly Orders Closed',
    'stats.weekly_subtitle_open': 'Live stats · Mon-Fri batch breakdown',
    'stats.weekly_subtitle_closed': 'Full week breakdown & payment info',
    'stats.today_subtitle_open': 'Live stats · Member breakdown & totals',
    'stats.today_subtitle_closed': 'Closed · Member list & payment info',
    'stats.member_roster_today': "👤 Today's Member Payable Roster",
    'stats.member_roster_weekly': '👤 Weekly Member Payable Breakdown',
    'stats.no_member_records': 'No member order records yet',
    'stats.status_open': 'Open',
    'stats.status_closed': 'Closed',
    'stats.footer_closed': '⏰ Ordering closed. Please complete payment promptly',
    'stats.footer_open': '🟢 Ordering is currently open',
    'stats.footer_weekly_closed': '⏰ Weekly orders closed. Please pay according to this table',
    'stats.footer_weekly_open': '📋 Please verify your amount and complete payment',
    'stats.close_btn_today': "🔒 Close Today's Orders",
    'stats.close_btn_weekly': '🔒 Close Weekly Orders',
    'stats.no_orders': 'No orders',
    'stats.total_summary': 'Total {qty} serving(s) · ${amount}',
    'stats.alt_text_today': "【Today's Summary】{restaurant} ({qty} servings / ${amount})",
    'stats.alt_text_weekly': '📊 Weekly Orders Summary Table',
    'stats.alt_text_closed_weekly': '【Closed】Weekly Summary & Payment Info',
    'stats.alt_text_closed_today': '【Closed】{restaurant} Final Summary',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 Payment Methods & Transfer Info',
    'payment.bank_transfer': 'Bank Wire Transfer',
    'payment.account_number': 'Account: {account}',
    'payment.account_name': 'Account Name: {name}',
    'payment.zoom_qr': 'Zoom QR',
    'payment.qr_hint': '🔍 Tap QR Code to zoom or screenshot to scan',
    'payment.notify_hint': '💡 After transfer, please notify the organizer in PM or group',
    'payment.btn_wallet': '🟢 Open LINE Wallet Transfer',
    'payment.btn_linepay': '🟢 Pay via LINE Pay',
    'payment.linepay_hint': '📱 In Wallet, tap "Transfer" and search friend: "{recipient}"{idHint}',
    'payment.linepay_qr': 'LINE Pay QR Code',
    'payment.info_title': '💳 [Payment Info]',
    'payment.bank_transfer_bullet': '• Bank Transfer: ',
    'payment.bank_qr_bullet': '• Bank Transfer QR Code: ',
    'payment.linepay_bullet': '• LINE Pay Transfer: ',
    'payment.linepay_friend_bullet': '• LINE Pay Friend Transfer: ',
    'payment.linepay_qr_bullet': '• LINE Pay QR Code: ',

    // Order Receipt Card
    'receipt.title': '✅ Added Successfully',
    'receipt.weekly_user_orders': 'Weekly Orders for {name}',
    'receipt.daily_user_orders': "Today's Orders for {name}",
    'receipt.no_items': '(No items)',
    'receipt.total_weekly': 'Weekly Total',
    'receipt.total_daily': 'Total',
    'receipt.cancel_hint': '💡 Reply "cancel" to open menu and cancel specific items',
    'receipt.alt_text': 'Order recorded{suffix}: {day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': 'You have no pre-order records for this week (Mon-Fri) yet!',
    'my_orders.no_today_orders': 'You have no order records today! Type "+1 [item name]" to order.',
    'my_orders.weekly_title': '🍱 [Your Weekly Orders]',
    'my_orders.today_title': "[Your Today's Orders]",
    'my_orders.weekly_total': 'Weekly Total: ${amount}',
    'my_orders.today_total': 'Total: ${amount}',
    'my_orders.subtotal': ' (Subtotal ${subtotal})',
    'my_orders.cutoff_notice': "\n⚠️ Today's ordering cutoff has passed. Items cannot be changed or cancelled."
  },

  'ja': {
    // Common
    'common.member': 'メンバー',
    'common.organizer': '主催者',
    'common.today': '本日',
    'common.all': '共通',
    'common.all_days': '全日',
    'common.self': '本人',
    'common.other': 'その他',
    'common.general': '一般',
    'common.currency_prefix': '¥',
    'common.currency_suffix': '円',
    'common.unit_serving': '品',
    'common.unit_record': '件',
    'common.separator': '、',
    'common.bracket_open': '【',
    'common.bracket_close': '】',
    'common.unknown': '不明',
    'common.anonymous_member': '匿名メンバー',

    // Weekdays
    'weekday.mon': '月曜',
    'weekday.tue': '火曜',
    'weekday.wed': '水曜',
    'weekday.thu': '木曜',
    'weekday.fri': '金曜',
    'weekday.sat': '土曜',
    'weekday.sun': '日曜',

    // Help Flex
    'help.title': '📖 お弁当注文利用案内',
    'help.tip_click': '💡 ボタンをタップして直接コマンドを送信できます！',
    'help.license': 'ライセンス: AGPL-3.0 ソースコード ',
    'help.alt_text': 'お弁当注文コマンド案内',
    'help.cmd_weekly_schedule.title': '📅 今週のメニュー',
    'help.cmd_weekly_schedule.desc': '月〜金の予定を確認',
    'help.cmd_weekly_schedule.btn': '今週確認',
    'help.cmd_weekly_schedule.cmd': '今週のメニュー',
    'help.cmd_today_menu.title': '🍱 今日のメニュー',
    'help.cmd_today_menu.desc': '本日のメニューを確認して注文',
    'help.cmd_today_menu.btn': 'メニュー',
    'help.cmd_today_menu.cmd': 'メニュー',
    'help.cmd_children.title': '👶 お子様設定',
    'help.cmd_children.desc': 'お子様名簿と配分設定',
    'help.cmd_children.btn': 'お子様設定',
    'help.cmd_children.cmd': '子供設定',
    'help.cmd_my_today.title': '📝 本日の注文',
    'help.cmd_my_today.desc': '本日の注文履歴を確認',
    'help.cmd_my_today.btn': '本日注文',
    'help.cmd_my_today.cmd': '私の注文',
    'help.cmd_my_weekly.title': '📦 今週の注文',
    'help.cmd_my_weekly.desc': '今週の全予約を確認',
    'help.cmd_my_weekly.btn': '全週確認',
    'help.cmd_my_weekly.cmd': '今週の注文',
    'help.cmd_cancel.title': '🗑️ 注文取消',
    'help.cmd_cancel.desc': '特定の注文品を取り消し',
    'help.cmd_cancel.btn': '取消画面',
    'help.cmd_cancel.cmd': 'キャンセル',
    'help.cmd_weekly_stats.title': '📊 今週の集計',
    'help.cmd_weekly_stats.desc': '今週の注文精算総表',
    'help.cmd_weekly_stats.btn': '今週集計',
    'help.cmd_weekly_stats.cmd': '今週の集計',
    'help.cmd_today_stats.title': '📈 本日の集計',
    'help.cmd_today_stats.desc': '本日のリアルタイム注文集計',
    'help.cmd_today_stats.btn': '本日集計',
    'help.cmd_today_stats.cmd': '今日の集計',
    'help.cmd_close.title': '🔒 注文締め切り',
    'help.cmd_close.desc': '注文を締め切り支払情報を表示',
    'help.cmd_close.btn': '締め切る',
    'help.cmd_close.cmd': '締め切り',
    'help.cmd_language.title': '🌐 言語設定',
    'help.cmd_language.desc': '個人の表示言語を変更',
    'help.cmd_language.btn': '言語設定',
    'help.cmd_language.cmd': '言語設定',

    // Language selector
    'lang.title': '🌐 言語設定 (Language Settings)',
    'lang.subtitle': 'ご希望の表示言語を選択してください：',
    'lang.current_prefix': '現在の言語：',
    'lang.set_success': '✅ 言語を「{lang}」に設定しました！次回からこの言語で案内します。',
    'lang.disabled': '⚠️ 現在、管理者により言語切替機能が無効になっています。',
    'lang.invalid': '⚠️ 未対応の言語コード「{lang}」です。対応言語：{options}',
    'lang.prompt_select': '🌐 切り替える言語を選択してください：',

    // Submenu: Children Management
    'children_menu.title': '👶 お子様管理メニュー',
    'children_menu.subtitle': 'ボタンをタップして名簿確認またはコマンド送信',
    'children_menu.item_list_title': '👦 私の子供 / お子様一覧',
    'children_menu.item_list_desc': '登録済みお子様一覧とクラス情報を確認',
    'children_menu.btn_list': '一覧を見る',
    'children_menu.cmd_list': '子供リスト',
    'children_menu.item_batch_title': '👶 子供一括設定',
    'children_menu.item_batch_desc': '複数のお子様を一括登録（既存名簿上書き）',
    'children_menu.btn_batch': '一括登録',
    'children_menu.cmd_batch': '子供設定 タロウ, ジロウ',
    'children_menu.item_add_title': '➕ 子供追加',
    'children_menu.item_add_desc': 'お子様のお名前とクラス備考を追加',
    'children_menu.btn_add': '子供追加',
    'children_menu.cmd_add': '子供追加 タロウ 1年1組',
    'children_menu.item_del_title': '🗑️ 子供削除',
    'children_menu.item_del_desc': '指定したお子様の登録を削除',
    'children_menu.btn_delete': '子供削除',
    'children_menu.cmd_delete': '子供削除 タロウ',
    'children_menu.footer': '💡 ボタンをタップするとサンプルコマンドが送信されます。チャット欄で編集も可能です！',
    'children_menu.alt_text': '👶 お子様管理メニュー',

    // Submenu: Children List Card
    'children_list.title': '👶 お子様・同伴者名簿',
    'children_list.subtitle': '{name} 様が登録されたお子様とクラス',
    'children_list.empty': '（お子様はまだ登録されていません）',
    'children_list.btn_setup': 'お子様設定',
    'children_list.cmd_setup': '子供設定',
    'children_list.alt_text': '👶 お子様名簿',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 今週の注文スケジュール',
    'schedule.subtitle': '月〜金の日替わり店舗 · 事前予約対応',
    'schedule.no_restaurant': '店舗未定',
    'schedule.cutoff_prefix': '⏰ 締切 ',
    'schedule.btn_menu': 'メニュー',
    'schedule.footer': '💡「月曜+1 [メニュー]」と入力するか「メニュー」をタップして予約',
    'schedule.alt_text': '📅 週間スケジュール (月〜金)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' メニュー',
    'menu.cutoff_prefix': '⏰ 本日の締切: ',
    'menu.btn_order': '+1 注文',
    'menu.sold_out': '売り切れ',
    'menu.footer_hint1': '💡「+1 注文」ボタンをタップして直接追加注文できます！',
    'menu.footer_hint2': 'または「{day} [メニュー]+[数量]」や「取消 [メニュー]」と入力',
    'menu.alt_text': '【注文受付中】{restaurant} メニュー',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ 注文取消メニュー',
    'cancel.title_org': '👑 注文取消メニュー (主催者)',
    'cancel.subtitle': '{name} 様の進行中注文',
    'cancel.no_orders': '（現在進行中の注文はありません）',
    'cancel.day_items': '【{day} 予約項目】',
    'cancel.locked': '取消不可',
    'cancel.reason_expired': '期限切れ',
    'cancel.reason_cutoff': '締切済',
    'cancel.btn_cancel_item': '取消する',
    'cancel.btn_cancel_day': '{day}の注文を取消',
    'cancel.btn_cancel_all': '全ての予約を取消 (月〜金)',
    'cancel.org_section': '👑 主催者管理機能',
    'cancel.btn_org_day': '⚠️ 当日全員の注文取消 (要確認)',
    'cancel.btn_org_all': '🚨 全員の未締切予約取消 (要確認)',
    'cancel.all_locked_warning': '⚠️ すべての注文が締切時刻または日付を過ぎているため取消できません。必要な場合は主催者へご連絡ください。',
    'cancel.footer_org': '💡 主催者は注文を管理できます。全員取消は確認カードが表示されます。',
    'cancel.footer_member': '💡 ご自身の注文のみ取消可能です。その他は主催者へお問い合わせください。',
    'cancel.confirm_header': '🚨 取消確認の警告 (主催者専用)',
    'cancel.btn_abort': '取消中止',
    'cancel.confirm_footer': '⚠️ 確認後すぐに注文が取り消され、元に戻すことはできません。',
    'cancel.alt_text': '🗑️ 取消する項目を選択',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': '🍱 本日の注文集計',
    'stats.today_title_closed': '🔒 本日の注文は締切ました',
    'stats.weekly_title': '📊 今週の注文集計表',
    'stats.weekly_title_closed': '🔒 今週の注文締切',
    'stats.weekly_subtitle_open': 'リアルタイム集計 · 月〜金各日の明細',
    'stats.weekly_subtitle_closed': '全日集計と決済情報',
    'stats.today_subtitle_open': 'リアルタイム集計 · メンバー別明細と合計',
    'stats.today_subtitle_closed': '締切済 · 名簿と決済情報',
    'stats.member_roster_today': '👤 本日のメンバー別支払明細',
    'stats.member_roster_weekly': '👤 今週のメンバー別支払明細',
    'stats.no_member_records': 'メンバーの注文履歴はありません',
    'stats.status_open': '受付中',
    'stats.status_closed': '締切済',
    'stats.footer_closed': '⏰ 受付終了。各自速やかにお支払いをお願いします',
    'stats.footer_open': '🟢 現在注文受付中',
    'stats.footer_weekly_closed': '⏰ 今週の注文締切。表の金額をご確認の上お支払いください',
    'stats.footer_weekly_open': '📋 各自金額をご確認の上、お支払いをお願いします',
    'stats.close_btn_today': '🔒 本日の注文を締め切る',
    'stats.close_btn_weekly': '🔒 今週の注文を締め切る',
    'stats.no_orders': '注文なし',
    'stats.total_summary': '計 {qty} 点 · {amount} 円',
    'stats.alt_text_today': '【本日集計】{restaurant} ({qty}点 / {amount}円)',
    'stats.alt_text_weekly': '📊 週間注文集計総表',
    'stats.alt_text_closed_weekly': '【締切】週間集計と決済案内',
    'stats.alt_text_closed_today': '【締切】{restaurant} 最終集計',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 お支払い・振込案内',
    'payment.bank_transfer': '銀行振込',
    'payment.account_number': '口座番号：{account}',
    'payment.account_name': '名義：{name}',
    'payment.zoom_qr': '拡大表示',
    'payment.qr_hint': '🔍 QRコードをタップして拡大またはスクショで送金',
    'payment.notify_hint': '💡 振込完了後は確認のため主催者へ個別またはグループで連絡してください',
    'payment.btn_wallet': '🟢 LINEウォレットで送金',
    'payment.btn_linepay': '🟢 LINE Payで送金',
    'payment.linepay_hint': '📱 ウォレットで「送金」を選び友だち検索：「{recipient}」{idHint}',
    'payment.linepay_qr': 'LINE Pay 受取コード',
    'payment.info_title': '💳【お支払い情報】',
    'payment.bank_transfer_bullet': '• 銀行振込：',
    'payment.bank_qr_bullet': '• 銀行振込QRコード：',
    'payment.linepay_bullet': '• LINE Pay 送金：',
    'payment.linepay_friend_bullet': '• LINE Pay 友だち送金：',
    'payment.linepay_qr_bullet': '• LINE Pay 受取コード：',

    // Order Receipt Card
    'receipt.title': '✅ 追加注文完了',
    'receipt.weekly_user_orders': '{name} 様の今週の注文',
    'receipt.daily_user_orders': '{name} 様の本日の注文',
    'receipt.no_items': '（項目なし）',
    'receipt.total_weekly': '今週合計',
    'receipt.total_daily': '合計',
    'receipt.cancel_hint': '💡「キャンセル」と返信するとメニューが開き特定項目的取消が可能です',
    'receipt.alt_text': '注文を記録しました{suffix}：{day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': '今週（月〜金）の事前注文記録はまだありません！',
    'my_orders.no_today_orders': '本日の注文履歴はありません！「+1 [メニュー名]」と入力して注文できます。',
    'my_orders.weekly_title': '🍱【今週のご注文内容】',
    'my_orders.today_title': '【本日のご注文内容】',
    'my_orders.weekly_total': '今週合計：{amount} 円',
    'my_orders.today_total': '合計：{amount} 円',
    'my_orders.subtotal': ' (小計 {subtotal}円)',
    'my_orders.cutoff_notice': '\n⚠️ 本日の注文締切時刻を過ぎているため、変更や取消はできません。'
  },

  'ko': {
    // Common
    'common.member': '멤버',
    'common.organizer': '주최자',
    'common.today': '오늘',
    'common.all': '공통',
    'common.all_days': '전체',
    'common.self': '본인',
    'common.other': '기타',
    'common.general': '일반',
    'common.currency_prefix': '₩',
    'common.currency_suffix': '원',
    'common.unit_serving': '인분',
    'common.unit_record': '건',
    'common.separator': ', ',
    'common.bracket_open': '[',
    'common.bracket_close': ']',
    'common.unknown': '알 수 없음',
    'common.anonymous_member': '익명 멤버',

    // Weekdays
    'weekday.mon': '월',
    'weekday.tue': '화',
    'weekday.wed': '수',
    'weekday.thu': '목',
    'weekday.fri': '금',
    'weekday.sat': '토',
    'weekday.sun': '일',

    // Help Flex
    'help.title': '📖 도시락 주문 사용 안내',
    'help.tip_click': '💡 위 버튼을 클릭하여 명령어를 바로 전송하세요!',
    'help.license': '라이선스: AGPL-3.0 소스코드 ',
    'help.alt_text': '도시락 주문 명령어 안내',
    'help.cmd_weekly_schedule.title': '📅 이번주 메뉴',
    'help.cmd_weekly_schedule.desc': '월~금 일정 확인',
    'help.cmd_weekly_schedule.btn': '이번주',
    'help.cmd_weekly_schedule.cmd': '이번주 메뉴',
    'help.cmd_today_menu.title': '🍱 오늘 메뉴',
    'help.cmd_today_menu.desc': '오늘의 메뉴 확인 및 주문',
    'help.cmd_today_menu.btn': '메뉴보기',
    'help.cmd_today_menu.cmd': '메뉴',
    'help.cmd_children.title': '👶 자녀 설정',
    'help.cmd_children.desc': '자녀 명단 및 배분 설정',
    'help.cmd_children.btn': '자녀설정',
    'help.cmd_children.cmd': '자녀설정',
    'help.cmd_my_today.title': '📝 내 주문',
    'help.cmd_my_today.desc': '개인 오늘 주문 내역 조회',
    'help.cmd_my_today.btn': '오늘주문',
    'help.cmd_my_today.cmd': '내 주문',
    'help.cmd_my_weekly.title': '📦 내 이번주 주문',
    'help.cmd_my_weekly.desc': '이번주 전체 예약 확인',
    'help.cmd_my_weekly.btn': '전체확인',
    'help.cmd_my_weekly.cmd': '내 이번주 주문',
    'help.cmd_cancel.title': '🗑️ 주문 취소',
    'help.cmd_cancel.desc': '특정 메뉴 취소하기',
    'help.cmd_cancel.btn': '취소하기',
    'help.cmd_cancel.cmd': '주문취소',
    'help.cmd_weekly_stats.title': '📊 이번주 정산',
    'help.cmd_weekly_stats.desc': '이번주 정산 총괄표',
    'help.cmd_weekly_stats.btn': '이번주통계',
    'help.cmd_weekly_stats.cmd': '이번주 통계',
    'help.cmd_today_stats.title': '📈 오늘 통계',
    'help.cmd_today_stats.desc': '오늘 실시간 주문 집계',
    'help.cmd_today_stats.btn': '오늘통계',
    'help.cmd_today_stats.cmd': '오늘 통계',
    'help.cmd_close.title': '🔒 주문 마감',
    'help.cmd_close.desc': '주문 마감 및 결제 정보 안내',
    'help.cmd_close.btn': '마감하기',
    'help.cmd_close.cmd': '마감',
    'help.cmd_language.title': '🌐 언어 설정',
    'help.cmd_language.desc': '개인 표시 언어 변경',
    'help.cmd_language.btn': '언어변경',
    'help.cmd_language.cmd': '언어설정',

    // Language selector
    'lang.title': '🌐 언어 설정 (Language Settings)',
    'lang.subtitle': '사용할 언어를 선택해주세요:',
    'lang.current_prefix': '현재 언어: ',
    'lang.set_success': '✅ 언어가 "{lang}"(으)로 설정되었습니다! 다음 메시지부터 적용됩니다.',
    'lang.disabled': '⚠️ 현재 관리자에 의해 언어 변경 기능이 비활성화되어 있습니다.',
    'lang.invalid': '⚠️ 지원되지 않는 언어 코드 "{lang}". 지원 목록: {options}',
    'lang.prompt_select': '🌐 변경할 언어를 선택해주세요:',

    // Submenu: Children Management
    'children_menu.title': '👶 자녀 관리 메뉴',
    'children_menu.subtitle': '버튼을 눌러 명단을 확인하거나 예시 명령어를 전송하세요',
    'children_menu.item_list_title': '👦 내 아이 / 자녀 목록',
    'children_menu.item_list_desc': '등록된 자녀 명단 및 학급 확인',
    'children_menu.btn_list': '목록보기',
    'children_menu.cmd_list': '자녀목록',
    'children_menu.item_batch_title': '👶 자녀 일괄설정',
    'children_menu.item_batch_desc': '여러 자녀를 한 번에 등록 (기존 명단 대체)',
    'children_menu.btn_batch': '일괄등록',
    'children_menu.cmd_batch': '자녀설정 민우, 지호',
    'children_menu.item_add_title': '➕ 자녀 추가',
    'children_menu.item_add_desc': '자녀 이름 및 학급 메모 추가',
    'children_menu.btn_add': '자녀추가',
    'children_menu.cmd_add': '자녀추가 민우 1학년1반',
    'children_menu.item_del_title': '🗑️ 자녀 삭제',
    'children_menu.item_del_desc': '지정된 자녀 등록 기록 삭제',
    'children_menu.btn_delete': '자녀삭제',
    'children_menu.cmd_delete': '자녀삭제 민우',
    'children_menu.footer': '💡 버튼을 탭하면 예시 명령어가 전송되며, 채팅창에서 직접 수정할 수도 있습니다!',
    'children_menu.alt_text': '👶 자녀 관리 메뉴',

    // Submenu: Children List Card
    'children_list.title': '👶 내 아이 및 식사 명단',
    'children_list.subtitle': '{name} 님의 등록 자녀 및 학급',
    'children_list.empty': '(아직 등록된 자녀가 없습니다)',
    'children_list.btn_setup': '자녀설정',
    'children_list.cmd_setup': '자녀설정',
    'children_list.alt_text': '👶 자녀 명단',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 이번주 주문 일정표',
    'schedule.subtitle': '월~금 일일 식당 · 사전 예약 지원',
    'schedule.no_restaurant': '식당 미정',
    'schedule.cutoff_prefix': '⏰ 마감 ',
    'schedule.btn_menu': '메뉴',
    'schedule.footer': "💡 '[요일]+1 [메뉴]'를 입력하거나 '메뉴'를 눌러 주문하세요",
    'schedule.alt_text': '📅 주간 일정표 (월~금)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' 메뉴',
    'menu.cutoff_prefix': '⏰ 오늘 마감: ',
    'menu.btn_order': '+1 주문',
    'menu.sold_out': '품절',
    'menu.footer_hint1': "💡 '+1 주문' 버튼을 눌러 바로 추가 주문하세요!",
    'menu.footer_hint2': "또는 '{day} [메뉴]+[수량]' 이나 '취소 [메뉴]' 를 입력하세요",
    'menu.alt_text': '[주문 시작] {restaurant} 메뉴',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ 주문 취소 메뉴',
    'cancel.title_org': '👑 주문 취소 메뉴 (주최자)',
    'cancel.subtitle': '{name} 님의 진행 중인 주문',
    'cancel.no_orders': '(현재 진행 중인 주문이 없습니다)',
    'cancel.day_items': '【{day} 예약 항목】',
    'cancel.locked': '취소 불가',
    'cancel.reason_expired': '기한 만료',
    'cancel.reason_cutoff': '마감됨',
    'cancel.btn_cancel_item': '항목 취소',
    'cancel.btn_cancel_day': '내 [{day}] 주문 취소',
    'cancel.btn_cancel_all': '내 모든 예약 취소 (월~금)',
    'cancel.org_section': '👑 주최자 관리 기능',
    'cancel.btn_org_day': '⚠️ 당일 전체 주문 취소 (확인 필요)',
    'cancel.btn_org_all': '🚨 전체 미마감 예약 취소 (확인 필요)',
    'cancel.all_locked_warning': '⚠️ 모든 주문이 마감 시간 또는 날짜를 초과하여 취소할 수 없습니다. 문의사항은 주최자에게 연락하세요.',
    'cancel.footer_org': '💡 주최자는 주문을 관리할 수 있으며, 전체 취소 시 확인 카드가 표시됩니다.',
    'cancel.footer_member': '💡 본인의 주문만 취소할 수 있습니다. 기타 문의는 주최자에게 연락하세요.',
    'cancel.confirm_header': '🚨 취소 확인 경고 (주최자 전용)',
    'cancel.btn_abort': '취소 중단',
    'cancel.confirm_footer': '⚠️ 확인 시 즉시 취소 처리되며 되돌릴 수 없습니다.',
    'cancel.alt_text': '🗑️ 취소할 항목 선택',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': '🍱 오늘의 주문 현황',
    'stats.today_title_closed': '🔒 오늘의 주문 마감',
    'stats.weekly_title': '📊 이번주 주문 종합 현황',
    'stats.weekly_title_closed': '🔒 이번주 주문 마감',
    'stats.weekly_subtitle_open': '실시간 집계 · 월~금 요일별 상세',
    'stats.weekly_subtitle_closed': '전체 요일 집계 및 결제 안내',
    'stats.today_subtitle_open': '실시간 집계 · 멤버별 내역 및 합계',
    'stats.today_subtitle_closed': '마감됨 · 명단 및 결제 안내',
    'stats.member_roster_today': '👤 오늘 멤버별 결제 명단',
    'stats.member_roster_weekly': '👤 이번주 멤버별 결제 내역',
    'stats.no_member_records': '멤버 주문 내역이 없습니다',
    'stats.status_open': '접수중',
    'stats.status_closed': '마감됨',
    'stats.footer_closed': '⏰ 주문이 마감되었습니다. 신속히 결제를 완료해 주세요',
    'stats.footer_open': '🟢 현재 주문 접수 중',
    'stats.footer_weekly_closed': '⏰ 이번주 주문이 마감되었습니다. 금액 확인 후 결제해 주세요',
    'stats.footer_weekly_open': '📋 각 멤버는 내역과 금액을 확인 후 결제해 주세요',
    'stats.close_btn_today': '🔒 오늘 주문 마감',
    'stats.close_btn_weekly': '🔒 이번주 주문 마감',
    'stats.no_orders': '주문 없음',
    'stats.total_summary': '총 {qty}개 · {amount}원',
    'stats.alt_text_today': '【오늘 통계】{restaurant} ({qty}개 / {amount}원)',
    'stats.alt_text_weekly': '📊 주간 주문 통계 총표',
    'stats.alt_text_closed_weekly': '【마감】주간 통계 및 결제 안내',
    'stats.alt_text_closed_today': '【마감】{restaurant} 최종 주문 명단',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 결제 방법 및 입금 안내',
    'payment.bank_transfer': '계좌 이체',
    'payment.account_number': '계좌번호: {account}',
    'payment.account_name': '예금주: {name}',
    'payment.zoom_qr': 'QR 확대',
    'payment.qr_hint': '🔍 QR 코드를 눌러 확대하거나 캡처하여 송금하세요',
    'payment.notify_hint': '💡 입금 완료 후 정산을 위해 주최자에게 개인톡이나 그룹에 알려주세요',
    'payment.btn_wallet': '🟢 LINE 지갑으로 송금',
    'payment.btn_linepay': '🟢 LINE Pay로 송금',
    'payment.linepay_hint': '📱 지갑에서 [송금]을 누르고 친구를 검색하세요: "{recipient}"{idHint}',
    'payment.linepay_qr': 'LINE Pay 결제 QR',
    'payment.info_title': '💳【결제 안내】',
    'payment.bank_transfer_bullet': '• 은행 계좌 이체: ',
    'payment.bank_qr_bullet': '• 계좌 이체 QR 코드: ',
    'payment.linepay_bullet': '• LINE Pay 송금: ',
    'payment.linepay_friend_bullet': '• LINE Pay 친구 송금: ',
    'payment.linepay_qr_bullet': '• LINE Pay 결제 QR: ',

    // Order Receipt Card
    'receipt.title': '✅ 주문 추가 성공',
    'receipt.weekly_user_orders': '{name} 님의 이번주 주문',
    'receipt.daily_user_orders': '{name} 님의 오늘의 주문',
    'receipt.no_items': '(내역 없음)',
    'receipt.total_weekly': '이번주 합계',
    'receipt.total_daily': '합계',
    'receipt.cancel_hint': "💡 '취소'를 입력하면 메뉴가 열려 특정 항목을 취소할 수 있습니다",
    'receipt.alt_text': '주문이 기록되었습니다{suffix}: {day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': '이번주(월~금) 예약 주문 내역이 아직 없습니다!',
    'my_orders.no_today_orders': "오늘 주문 내역이 없습니다! '+1 [메뉴명]'을 입력하여 주문하세요.",
    'my_orders.weekly_title': '🍱【이번주 주문 내역】',
    'my_orders.today_title': '【오늘의 주문 내역】',
    'my_orders.weekly_total': '이번주 총액: {amount} 원',
    'my_orders.today_total': '총액: {amount} 원',
    'my_orders.subtotal': ' (소계 {subtotal}원)',
    'my_orders.cutoff_notice': '\n⚠️ 오늘 주문 마감 시간이 지나 변경 또는 취소가 불가합니다.'
  },

  'th': {
    // Common
    'common.member': 'สมาชิก',
    'common.organizer': 'ผู้จัด',
    'common.today': 'วันนี้',
    'common.all': 'ทั่วไป',
    'common.all_days': 'ทุกวัน',
    'common.self': 'ตัวเอง',
    'common.other': 'อื่นๆ',
    'common.general': 'ทั่วไป',
    'common.currency_prefix': '฿',
    'common.currency_suffix': '',
    'common.unit_serving': ' ที่',
    'common.unit_record': ' รายการ',
    'common.separator': ', ',
    'common.bracket_open': '[',
    'common.bracket_close': ']',
    'common.unknown': 'ไม่ระบุ',
    'common.anonymous_member': 'สมาชิกไม่ระบุชื่อ',

    // Weekdays
    'weekday.mon': 'จันทร์',
    'weekday.tue': 'อังคาร',
    'weekday.wed': 'พุธ',
    'weekday.thu': 'พฤหัส',
    'weekday.fri': 'ศุกร์',
    'weekday.sat': 'เสาร์',
    'weekday.sun': 'อาทิตย์',

    // Help Flex
    'help.title': '📖 คู่มือสั่งอาหารกล่อง',
    'help.tip_click': '💡 แตะปุ่มด้านบนเพื่อส่งคำสั่งได้ทันที!',
    'help.license': 'สัญญาอนุญาต: AGPL-3.0 ซอร์สโค้ด ',
    'help.alt_text': 'คู่มือสั่งอาหารกล่อง',
    'help.cmd_weekly_schedule.title': '📅 เมนูสัปดาห์นี้',
    'help.cmd_weekly_schedule.desc': 'ดูตารางจันทร์ถึงศุกร์',
    'help.cmd_weekly_schedule.btn': 'ดูสัปดาห์นี้',
    'help.cmd_weekly_schedule.cmd': 'เมนูสัปดาห์นี้',
    'help.cmd_today_menu.title': '🍱 เมนูวันนี้',
    'help.cmd_today_menu.desc': 'ดูเมนูและสั่งอาหารวันนี้',
    'help.cmd_today_menu.btn': 'ดูเมนู',
    'help.cmd_today_menu.cmd': 'เมนู',
    'help.cmd_children.title': '👶 ตั้งค่าลูก',
    'help.cmd_children.desc': 'รายชื่อเด็กและการจัดสรรอาหาร',
    'help.cmd_children.btn': 'ตั้งค่าลูก',
    'help.cmd_children.cmd': 'ตั้งค่าลูก',
    'help.cmd_my_today.title': '📝 ออเดอร์วันนี้',
    'help.cmd_my_today.desc': 'ตรวจสอบรายการสั่งวันนี้ของคุณ',
    'help.cmd_my_today.btn': 'เช็ควันนี้',
    'help.cmd_my_today.cmd': 'ออเดอร์ของฉัน',
    'help.cmd_my_weekly.title': '📦 ออเดอร์ทั้งสัปดาห์',
    'help.cmd_my_weekly.desc': 'ตรวจสอบรายการจองทั้งสัปดาห์',
    'help.cmd_my_weekly.btn': 'เช็คทั้งสัปดาห์',
    'help.cmd_my_weekly.cmd': 'ออเดอร์สัปดาห์นี้',
    'help.cmd_cancel.title': '🗑️ ยกเลิกรายการ',
    'help.cmd_cancel.desc': 'เลือกยกเลิกอาหารที่สั่ง',
    'help.cmd_cancel.btn': 'ยกเลิก',
    'help.cmd_cancel.cmd': 'ยกเลิก',
    'help.cmd_weekly_stats.title': '📊 สรุปสัปดาห์นี้',
    'help.cmd_weekly_stats.desc': 'สรุปยอดและบัญชีทั้งสัปดาห์',
    'help.cmd_weekly_stats.btn': 'สรุปสัปดาห์',
    'help.cmd_weekly_stats.cmd': 'สรุปสัปดาห์นี้',
    'help.cmd_today_stats.title': '📈 สรุปวันนี้',
    'help.cmd_today_stats.desc': 'ยอดสั่งซื้อและรายชื่อวันนี้',
    'help.cmd_today_stats.btn': 'สรุปวันนี้',
    'help.cmd_today_stats.cmd': 'สรุปวันนี้',
    'help.cmd_close.title': '🔒 ปิดรับออเดอร์',
    'help.cmd_close.desc': 'ปิดรับและแสดงข้อมูลชำระเงิน',
    'help.cmd_close.btn': 'ปิดรับ',
    'help.cmd_close.cmd': 'ปิดรับ',
    'help.cmd_language.title': '🌐 ตั้งค่าภาษา',
    'help.cmd_language.desc': 'เปลี่ยนภาษาการแสดงผลส่วนบุคคล',
    'help.cmd_language.btn': 'เปลี่ยนภาษา',
    'help.cmd_language.cmd': 'ตั้งค่าภาษา',

    // Language selector
    'lang.title': '🌐 ตั้งค่าภาษา (Language Settings)',
    'lang.subtitle': 'กรุณาเลือกภาษาที่ต้องการใช้งาน:',
    'lang.current_prefix': 'ภาษาปัจจุบัน: ',
    'lang.set_success': '✅ เปลี่ยนภาษาเป็น "{lang}" เรียบร้อยแล้ว! ข้อความถัดไปจะแสดงเป็นภาษานี้',
    'lang.disabled': '⚠️ ขณะนี้ผู้ดูแลระบบได้ปิดใช้งานการเปลี่ยนภาษาส่วนบุคคล',
    'lang.invalid': '⚠️ รหัสภาษา "{lang}" ไม่ถูกต้อง ภาษาที่รองรับ: {options}',
    'lang.prompt_select': '🌐 กรุณาเลือกภาษาที่ต้องการเปลี่ยน:',

    // Submenu: Children Management
    'children_menu.title': '👶 เมนูจัดการเด็ก',
    'children_menu.subtitle': 'แตะปุ่มเพื่อดูรายชื่อหรือส่งตัวอย่างคำสั่ง',
    'children_menu.item_list_title': '👦 ลูกของฉัน / รายชื่อเด็ก',
    'children_menu.item_list_desc': 'ดูรายชื่อเด็กและข้อมูลชั้นเรียนที่ลงทะเบียน',
    'children_menu.btn_list': 'ดูรายชื่อ',
    'children_menu.cmd_list': 'รายชื่อเด็ก',
    'children_menu.item_batch_title': '👶 ตั้งค่าลูกแบบกลุ่ม',
    'children_menu.item_batch_desc': 'ลงทะเบียนเด็กพร้อมกันหลายคน (แทนที่รายชื่อเดิม)',
    'children_menu.btn_batch': 'ลงทะเบียนกลุ่ม',
    'children_menu.cmd_batch': 'ตั้งค่าลูก น้องเอ, น้องบี',
    'children_menu.item_add_title': '➕ เพิ่มลูก',
    'children_menu.item_add_desc': 'เพิ่มชื่อเด็กและหมายเหตุชั้นเรียน',
    'children_menu.btn_add': 'เพิ่มลูก',
    'children_menu.cmd_add': 'เพิ่มลูก น้องเอ ห้อง1/1',
    'children_menu.item_del_title': '🗑️ ลบลูก',
    'children_menu.item_del_desc': 'ลบข้อมูลเด็กที่ระบุออกจากระบบ',
    'children_menu.btn_delete': 'ลบลูก',
    'children_menu.cmd_delete': 'ลบลูก น้องเอ',
    'children_menu.footer': '💡 แตะปุ่มเพื่อส่งตัวอย่างคำสั่ง หรือแก้ไขชื่อเด็กและชั้นเรียนในแชทได้โดยตรง!',
    'children_menu.alt_text': '👶 เมนูจัดการเด็ก',

    // Submenu: Children List Card
    'children_list.title': '👶 รายชื่อเด็กและผู้ร่วมรับประทาน',
    'children_list.subtitle': 'ข้อมูลเด็กและชั้นเรียนของ {name}',
    'children_list.empty': '(ยังไม่มีข้อมูลเด็กที่ลงทะเบียน)',
    'children_list.btn_setup': 'ตั้งค่าลูก',
    'children_list.cmd_setup': 'ตั้งค่าลูก',
    'children_list.alt_text': '👶 รายชื่อเด็ก',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 ตารางสั่งอาหารสัปดาห์นี้',
    'schedule.subtitle': 'ร้านอาหารจันทร์-ศุกร์ · รองรับการสั่งล่วงหน้า',
    'schedule.no_restaurant': 'ยังไม่ได้ระบุร้าน',
    'schedule.cutoff_prefix': '⏰ ปิดรับ ',
    'schedule.btn_menu': 'ดูเมนู',
    'schedule.footer': '💡 พิมพ์ "[วัน]+1 [ชื่ออาหาร]" หรือแตะ "ดูเมนู" เพื่อสั่งล่วงหน้า',
    'schedule.alt_text': '📅 ตารางสัปดาห์นี้ (จันทร์-ศุกร์)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' เมนู',
    'menu.cutoff_prefix': '⏰ ปิดรับวันนี้: ',
    'menu.btn_order': '+1 สั่ง',
    'menu.sold_out': 'หมดแล้ว',
    'menu.footer_hint1': '💡 แตะปุ่ม "+1 สั่ง" เพื่อสั่งอาหารเพิ่มได้ทันที!',
    'menu.footer_hint2': 'หรือพิมพ์ "{day} [ชื่ออาหาร] + [จำนวน]" หรือ "ยกเลิก [ชื่ออาหาร]"',
    'menu.alt_text': '[เปิดรับออเดอร์] เมนู {restaurant}',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ เมนูยกเลิกออเดอร์',
    'cancel.title_org': '👑 เมนูยกเลิกออเดอร์ (ผู้จัด)',
    'cancel.subtitle': 'ออเดอร์ปัจจุบันของ {name}',
    'cancel.no_orders': '(ไม่มีรายการออเดอร์ที่กำลังดำเนินการ)',
    'cancel.day_items': '【รายการที่สั่ง {day}】',
    'cancel.locked': 'ยกเลิกไม่ได้',
    'cancel.reason_expired': 'หมดเวลา',
    'cancel.reason_cutoff': 'ปิดรับแล้ว',
    'cancel.btn_cancel_item': 'ยกเลิกรายการนี้',
    'cancel.btn_cancel_day': 'ยกเลิกออเดอร์【{day}】ของฉัน',
    'cancel.btn_cancel_all': 'ยกเลิกออเดอร์ทั้งหมดของฉัน (จันทร์-ศุกร์)',
    'cancel.org_section': '👑 ฟังก์ชันผู้จัดการ',
    'cancel.btn_org_day': '⚠️ ยกเลิกออเดอร์วันนี้ทั้งหมด (ต้องยืนยัน)',
    'cancel.btn_org_all': '🚨 ยกเลิกออเดอร์ล่วงหน้าทั้งหมด (ต้องยืนยัน)',
    'cancel.all_locked_warning': '⚠️ รายการสั่งทั้งหมดเลยเวลากำหนดหรือเลยวันแล้ว ไม่สามารถแก้ไขได้ โปรดติดต่อผู้จัดหากมีกรณีจำเป็น',
    'cancel.footer_org': '💡 ผู้จัดสามารถจัดการออเดอร์ได้ การยกเลิกทั้งหมดจะต้องยืนยันอีกครั้ง',
    'cancel.footer_member': '💡 คุณสามารถยกเลิกได้เฉพาะออเดอร์ของตนเอง ติดต่อผู้จัดหากต้องการยกเลิกของผู้อื่น',
    'cancel.confirm_header': '🚨 คำเตือนยืนยันการยกเลิก (สำหรับผู้จัด)',
    'cancel.btn_abort': 'ไม่ยกเลิก',
    'cancel.confirm_footer': '⚠️ เมื่อยืนยันแล้วจะยกเลิกทันทีและไม่สามารถย้อนกลับได้',
    'cancel.alt_text': '🗑️ กรุณาเลือกรายการที่ต้องการยกเลิก',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': '🍱 สรุปยอดสั่งอาหารวันนี้',
    'stats.today_title_closed': '🔒 ปิดรับออเดอร์วันนี้แล้ว',
    'stats.weekly_title': '📊 สรุปยอดสั่งอาหารประจำสัปดาห์',
    'stats.weekly_title_closed': '🔒 ปิดรับออเดอร์ประจำสัปดาห์แล้ว',
    'stats.weekly_subtitle_open': 'อัปเดตสด · รายละเอียดจันทร์-ศุกร์',
    'stats.weekly_subtitle_closed': 'สรุปทั้งสัปดาห์และข้อมูลการชำระเงิน',
    'stats.today_subtitle_open': 'อัปเดตสด · รายชื่อและยอดรวม',
    'stats.today_subtitle_closed': 'ปิดรับแล้ว · รายชื่อและข้อมูลการชำระเงิน',
    'stats.member_roster_today': '👤 รายชื่อและยอดชำระเงินวันนี้',
    'stats.member_roster_weekly': '👤 รายชื่อและยอดชำระเงินประจำสัปดาห์',
    'stats.no_member_records': 'ยังไม่มีประวัติการสั่งของสมาชิก',
    'stats.status_open': 'เปิดรับ',
    'stats.status_closed': 'ปิดรับแล้ว',
    'stats.footer_closed': '⏰ ปิดรับออเดอร์แล้ว กรุณาดำเนินการชำระเงินโดยเร็ว',
    'stats.footer_open': '🟢 กำลังเปิดรับออเดอร์',
    'stats.footer_weekly_closed': '⏰ ปิดรับออเดอร์ประจำสัปดาห์แล้ว กรุณาชำระเงินตามยอดในตาราง',
    'stats.footer_weekly_open': '📋 กรุณาตรวจสอบยอดและดำเนินการชำระเงิน',
    'stats.close_btn_today': '🔒 ปิดรับออเดอร์วันนี้',
    'stats.close_btn_weekly': '🔒 ปิดรับออเดอร์ประจำสัปดาห์',
    'stats.no_orders': 'ไม่มีออเดอร์',
    'stats.total_summary': 'รวม {qty} รายการ · {amount} บาท',
    'stats.alt_text_today': '【สรุปวันนี้】{restaurant} ({qty} รายการ / {amount} บาท)',
    'stats.alt_text_weekly': '📊 สรุปยอดสั่งอาหารประจำสัปดาห์',
    'stats.alt_text_closed_weekly': '【ปิดรับแล้ว】สรุปประจำสัปดาห์และการชำระเงิน',
    'stats.alt_text_closed_today': '【ปิดรับแล้ว】สรุปรายการ {restaurant}',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 วิธีการชำระเงินและข้อมูลโอนเงิน',
    'payment.bank_transfer': 'โอนผ่านบัญชีธนาคาร',
    'payment.account_number': 'เลขบัญชี: {account}',
    'payment.account_name': 'ชื่อบัญชี: {name}',
    'payment.zoom_qr': 'ขยาย QR',
    'payment.qr_hint': '🔍 แตะ QR Code เพื่อขยายหรือแคปหน้าจอเพื่อสแกนโอนเงิน',
    'payment.notify_hint': '💡 เมื่อโอนเงินแล้วกรุณาแจ้งผู้จัดทางแชทส่วนตัวหรือในกลุ่มเพื่อตรวจสอบ',
    'payment.btn_wallet': '🟢 เปิด LINE Wallet เพื่อโอนเงิน',
    'payment.btn_linepay': '🟢 ชำระผ่าน LINE Pay',
    'payment.linepay_hint': '📱 ใน Wallet แตะ "โอนเงิน" แล้วค้นหาเพื่อน: "{recipient}"{idHint}',
    'payment.linepay_qr': 'QR รับเงิน LINE Pay',
    'payment.info_title': '💳【ข้อมูลการชำระเงิน】',
    'payment.bank_transfer_bullet': '• โอนผ่านธนาคาร: ',
    'payment.bank_qr_bullet': '• QR Code ธนาคาร: ',
    'payment.linepay_bullet': '• โอน LINE Pay: ',
    'payment.linepay_friend_bullet': '• โอนเพื่อน LINE Pay: ',
    'payment.linepay_qr_bullet': '• QR รับเงิน LINE Pay: ',

    // Order Receipt Card
    'receipt.title': '✅ สั่งซื้อสำเร็จ',
    'receipt.weekly_user_orders': 'รายการสัปดาห์นี้ของ {name}',
    'receipt.daily_user_orders': 'รายการวันนี้ของ {name}',
    'receipt.no_items': '(ไม่มีรายการ)',
    'receipt.total_weekly': 'รวมทั้งสัปดาห์',
    'receipt.total_daily': 'รวมทั้งหมด',
    'receipt.cancel_hint': '💡 พิมพ์ "ยกเลิก" เพื่อเปิดเมนูและเลือกยกเลิกรายการอาหารเฉพาะได้',
    'receipt.alt_text': 'บันทึกคำสั่งซื้อแล้ว{suffix}: {day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': 'คุณยังไม่มีรายการสั่งล่วงหน้าในสัปดาห์นี้ (จันทร์-ศุกร์)!',
    'my_orders.no_today_orders': 'คุณยังไม่มีรายการสั่งวันนี้! พิมพ์ "+1 [ชื่ออาหาร]" เพื่อสั่งได้เลย',
    'my_orders.weekly_title': '🍱【รายการสั่งประจำสัปดาห์ของคุณ】',
    'my_orders.today_title': '【รายการสั่งวันนี้ของคุณ】',
    'my_orders.weekly_total': 'รวมทั้งสัปดาห์: {amount} บาท',
    'my_orders.today_total': 'รวมทั้งหมด: {amount} บาท',
    'my_orders.subtotal': ' (รวม {subtotal} บาท)',
    'my_orders.cutoff_notice': '\n⚠️ เลยเวลาปิดรับออเดอร์วันนี้แล้ว ไม่สามารถแก้ไขหรือยกเลิกรายการได้'
  },

  'id': {
    // Common
    'common.member': 'Anggota',
    'common.organizer': 'Penyelenggara',
    'common.today': 'Hari Ini',
    'common.all': 'Umum',
    'common.all_days': 'Semua Hari',
    'common.self': 'Sendiri',
    'common.other': 'Lainnya',
    'common.general': 'Umum',
    'common.currency_prefix': 'Rp ',
    'common.currency_suffix': '',
    'common.unit_serving': ' porsi',
    'common.unit_record': ' item',
    'common.separator': ', ',
    'common.bracket_open': '[',
    'common.bracket_close': ']',
    'common.unknown': 'Tidak Diketahui',
    'common.anonymous_member': 'Anggota Anonim',

    // Weekdays
    'weekday.mon': 'Senin',
    'weekday.tue': 'Selasa',
    'weekday.wed': 'Rabu',
    'weekday.thu': 'Kamis',
    'weekday.fri': 'Jumat',
    'weekday.sat': 'Sabtu',
    'weekday.sun': 'Minggu',

    // Help Flex
    'help.title': '📖 Panduan Pesan Makan Siang',
    'help.tip_click': '💡 Klik tombol di atas untuk langsung mengirim perintah!',
    'help.license': 'Lisensi: Kode Sumber AGPL-3.0 ',
    'help.alt_text': 'Panduan Pesan Makan Siang',
    'help.cmd_weekly_schedule.title': '📅 Menu Minggu Ini',
    'help.cmd_weekly_schedule.desc': 'Lihat jadwal Senin sampai Jumat',
    'help.cmd_weekly_schedule.btn': 'Minggu Ini',
    'help.cmd_weekly_schedule.cmd': 'menu minggu ini',
    'help.cmd_today_menu.title': '🍱 Menu Hari Ini',
    'help.cmd_today_menu.desc': 'Lihat menu & pesan hari ini',
    'help.cmd_today_menu.btn': 'Lihat Menu',
    'help.cmd_today_menu.cmd': 'menu',
    'help.cmd_children.title': '👶 Atur Anak',
    'help.cmd_children.desc': 'Daftar anak & alokasi makanan',
    'help.cmd_children.btn': 'Atur Anak',
    'help.cmd_children.cmd': 'atur anak',
    'help.cmd_my_today.title': '📝 Pesanan Hari Ini',
    'help.cmd_my_today.desc': 'Cek riwayat pesanan hari ini',
    'help.cmd_my_today.btn': 'Hari Ini',
    'help.cmd_my_today.cmd': 'pesanan saya',
    'help.cmd_my_weekly.title': '📦 Pesanan Mingguan',
    'help.cmd_my_weekly.desc': 'Cek semua pesanan minggu ini',
    'help.cmd_my_weekly.btn': 'Semua Minggu',
    'help.cmd_my_weekly.cmd': 'pesanan mingguan',
    'help.cmd_cancel.title': '🗑️ Batalkan Pesanan',
    'help.cmd_cancel.desc': 'Batalkan item makanan tertentu',
    'help.cmd_cancel.btn': 'Batal',
    'help.cmd_cancel.cmd': 'batal',
    'help.cmd_weekly_stats.title': '📊 Rekap Mingguan',
    'help.cmd_weekly_stats.desc': 'Rekap & rekonsiliasi minggu ini',
    'help.cmd_weekly_stats.btn': 'Rekap Minggu',
    'help.cmd_weekly_stats.cmd': 'rekap minggu ini',
    'help.cmd_today_stats.title': '📈 Rekap Hari Ini',
    'help.cmd_today_stats.desc': 'Total pesanan & daftar pembeli',
    'help.cmd_today_stats.btn': 'Rekap Hari',
    'help.cmd_today_stats.cmd': 'rekap hari ini',
    'help.cmd_close.title': '🔒 Tutup Pesanan',
    'help.cmd_close.desc': 'Tutup pesanan & info pembayaran',
    'help.cmd_close.btn': 'Tutup',
    'help.cmd_close.cmd': 'tutup pesanan',
    'help.cmd_language.title': '🌐 Pengaturan Bahasa',
    'help.cmd_language.desc': 'Ubah bahasa tampilan pribadi',
    'help.cmd_language.btn': 'Ubah Bahasa',
    'help.cmd_language.cmd': 'atur bahasa',

    // Language selector
    'lang.title': '🌐 Pengaturan Bahasa (Language Settings)',
    'lang.subtitle': 'Pilih bahasa yang Anda inginkan:',
    'lang.current_prefix': 'Bahasa saat ini: ',
    'lang.set_success': '✅ Bahasa berhasil diubah ke "{lang}"! Pesan selanjutnya akan menggunakan bahasa ini.',
    'lang.disabled': '⚠️ Pengaturan bahasa pribadi saat ini dinonaktifkan oleh administrator.',
    'lang.invalid': '⚠️ Kode bahasa "{lang}" tidak didukung. Pilihan: {options}',
    'lang.prompt_select': '🌐 Silakan pilih bahasa:',

    // Submenu: Children Management
    'children_menu.title': '👶 Menu Kelola Anak',
    'children_menu.subtitle': 'Ketuk tombol untuk melihat daftar atau mengirim contoh perintah',
    'children_menu.item_list_title': '👦 Anak Saya / Daftar Anak',
    'children_menu.item_list_desc': 'Lihat profil anak terdaftar & info kelas',
    'children_menu.btn_list': 'Lihat Daftar',
    'children_menu.cmd_list': 'daftar anak',
    'children_menu.item_batch_title': '👶 Atur Anak (Sekaligus)',
    'children_menu.item_batch_desc': 'Daftarkan anak sekaligus (menimpa data lama)',
    'children_menu.btn_batch': 'Atur Bersama',
    'children_menu.cmd_batch': 'atur anak Budi, Siti',
    'children_menu.item_add_title': '➕ Tambah Anak',
    'children_menu.item_add_desc': 'Tambah anak dengan catatan kelas',
    'children_menu.btn_add': 'Tambah Anak',
    'children_menu.cmd_add': 'tambah anak Budi Kelas 1A',
    'children_menu.item_del_title': '🗑️ Hapus Anak',
    'children_menu.item_del_desc': 'Hapus data profil anak terdaftar',
    'children_menu.btn_delete': 'Hapus Anak',
    'children_menu.cmd_delete': 'hapus anak Budi',
    'children_menu.footer': '💡 Ketuk tombol untuk mengirim perintah contoh, atau edit nama anak dan catatan kelas langsung di obrolan!',
    'children_menu.alt_text': '👶 Menu Kelola Anak',

    // Submenu: Children List Card
    'children_list.title': '👶 Daftar Anak & Profil Makan',
    'children_list.subtitle': 'Profil & kelas terdaftar untuk {name}',
    'children_list.empty': '(Belum ada anak yang terdaftar)',
    'children_list.btn_setup': 'Atur Anak',
    'children_list.cmd_setup': 'atur anak',
    'children_list.alt_text': '👶 Daftar Anak',

    // Submenu: Weekly Schedule Card
    'schedule.title': '📅 Jadwal Pesanan Mingguan',
    'schedule.subtitle': 'Restoran Senin-Jumat · Mendukung pesanan lebih awal',
    'schedule.no_restaurant': 'Restoran Belum Ditentukan',
    'schedule.cutoff_prefix': '⏰ Batas ',
    'schedule.btn_menu': 'Menu',
    'schedule.footer': '💡 Ketik "[Hari]+1 [menu]" atau ketuk "Menu" untuk pesan',
    'schedule.alt_text': '📅 Jadwal Mingguan (Senin-Jumat)',

    // Submenu: Today Menu Card
    'menu.title_suffix': ' Menu',
    'menu.cutoff_prefix': '⏰ Batas Waktu Hari Ini: ',
    'menu.btn_order': '+1 Pesan',
    'menu.sold_out': 'Habis',
    'menu.footer_hint1': '💡 Ketuk tombol "+1 Pesan" untuk langsung memesan tambahan!',
    'menu.footer_hint2': 'Atau ketik "{day} [menu] + [jumlah]" atau "batal [menu]"',
    'menu.alt_text': '[Pemesanan Dibuka] Menu {restaurant}',

    // Submenu: Cancel Order Card
    'cancel.title': '🗑️ Menu Batalkan Pesanan',
    'cancel.title_org': '👑 Menu Batalkan Pesanan (Penyelenggara)',
    'cancel.subtitle': 'Pesanan aktif untuk {name}',
    'cancel.no_orders': '(Tidak ada pesanan aktif saat ini)',
    'cancel.day_items': '【Item Pesanan {day}】',
    'cancel.locked': 'Terkunci',
    'cancel.reason_expired': 'Kedaluwarsa',
    'cancel.reason_cutoff': 'Sudah Ditutup',
    'cancel.btn_cancel_item': 'Batalkan Item',
    'cancel.btn_cancel_day': 'Batalkan pesanan {day} saya',
    'cancel.btn_cancel_all': 'Batalkan semua pesanan saya (Senin-Jumat)',
    'cancel.org_section': '👑 Fitur Penyelenggara',
    'cancel.btn_org_day': '⚠️ Batalkan Semua Pesanan Hari Ini (Konfirmasi)',
    'cancel.btn_org_all': '🚨 Batalkan Semua Pesanan Belum Ditutup (Konfirmasi)',
    'cancel.all_locked_warning': '⚠️ Semua pesanan telah melewati batas waktu atau tanggal dan tidak dapat dibatalkan. Hubungi penyelenggara untuk bantuan.',
    'cancel.footer_org': '💡 Penyelenggara dapat mengelola pesanan; pembatalan massal memerlukan konfirmasi.',
    'cancel.footer_member': '💡 Anda hanya dapat membatalkan pesanan sendiri. Hubungi penyelenggara untuk permintaan lain.',
    'cancel.confirm_header': '🚨 Peringatan Konfirmasi Pembatalan (Penyelenggara)',
    'cancel.btn_abort': 'Jangan Batalkan',
    'cancel.confirm_footer': '⚠️ Setelah dikonfirmasi, pesanan akan langsung dibatalkan dan tidak dapat dikembalikan.',
    'cancel.alt_text': '🗑️ Pilih item yang ingin dibatalkan',

    // Submenu: Summaries (Today & Weekly)
    'stats.today_title': '🍱 Rekap Pesanan Hari Ini',
    'stats.today_title_closed': '🔒 Pesanan Hari Ini Ditutup',
    'stats.weekly_title': '📊 Rekap Pesanan Mingguan',
    'stats.weekly_title_closed': '🔒 Pesanan Mingguan Ditutup',
    'stats.weekly_subtitle_open': 'Statistik langsung · Rincian Senin-Jumat',
    'stats.weekly_subtitle_closed': 'Rekap lengkap & informasi pembayaran',
    'stats.today_subtitle_open': 'Statistik langsung · Rincian anggota & total',
    'stats.today_subtitle_closed': 'Ditutup · Daftar anggota & info pembayaran',
    'stats.member_roster_today': '👤 Daftar Tagihan Anggota Hari Ini',
    'stats.member_roster_weekly': '👤 Rincian Tagihan Anggota Mingguan',
    'stats.no_member_records': 'Belum ada riwayat pesanan anggota',
    'stats.status_open': 'Dibuka',
    'stats.status_closed': 'Ditutup',
    'stats.footer_closed': '⏰ Pemesanan telah ditutup. Harap segera selesaikan pembayaran',
    'stats.footer_open': '🟢 Pemesanan saat ini sedang dibuka',
    'stats.footer_weekly_closed': '⏰ Pesanan mingguan telah ditutup. Harap bayar sesuai tabel ini',
    'stats.footer_weekly_open': '📋 Harap periksa jumlah dan selesaikan pembayaran',
    'stats.close_btn_today': '🔒 Tutup Pesanan Hari Ini',
    'stats.close_btn_weekly': '🔒 Tutup Pesanan Mingguan',
    'stats.no_orders': 'Tidak ada pesanan',
    'stats.total_summary': 'Total {qty} porsi · Rp {amount}',
    'stats.alt_text_today': '【Rekap Hari Ini】{restaurant} ({qty} porsi / Rp {amount})',
    'stats.alt_text_weekly': '📊 Tabel Rekap Pesanan Mingguan',
    'stats.alt_text_closed_weekly': '【Ditutup】Rekap Mingguan & Info Pembayaran',
    'stats.alt_text_closed_today': '【Ditutup】Rekap Final {restaurant}',

    // Payment Information Card & Bullet Points
    'payment.title': '💳 Metode Pembayaran & Info Transfer',
    'payment.bank_transfer': 'Transfer Bank',
    'payment.account_number': 'No. Rekening: {account}',
    'payment.account_name': 'Nama Pemilik: {name}',
    'payment.zoom_qr': 'Perbesar QR',
    'payment.qr_hint': '🔍 Ketuk QR Code untuk memperbesar atau screenshot untuk transfer',
    'payment.notify_hint': '💡 Setelah transfer, beri tahu penyelenggara via chat pribadi atau grup',
    'payment.btn_wallet': '🟢 Buka LINE Wallet untuk Transfer',
    'payment.btn_linepay': '🟢 Bayar via LINE Pay',
    'payment.linepay_hint': '📱 Di Wallet, ketuk "Transfer" dan cari teman: "{recipient}"{idHint}',
    'payment.linepay_qr': 'QR Terima Uang LINE Pay',
    'payment.info_title': '💳 [Info Pembayaran]',
    'payment.bank_transfer_bullet': '• Transfer Bank: ',
    'payment.bank_qr_bullet': '• QR Code Bank: ',
    'payment.linepay_bullet': '• Transfer LINE Pay: ',
    'payment.linepay_friend_bullet': '• Transfer Teman LINE Pay: ',
    'payment.linepay_qr_bullet': '• QR Terima Uang LINE Pay: ',

    // Order Receipt Card
    'receipt.title': '✅ Berhasil Ditambahkan',
    'receipt.weekly_user_orders': 'Pesanan Mingguan {name}',
    'receipt.daily_user_orders': 'Pesanan Hari Ini {name}',
    'receipt.no_items': '(Belum ada item)',
    'receipt.total_weekly': 'Total Mingguan',
    'receipt.total_daily': 'Total',
    'receipt.cancel_hint': '💡 Balas "batal" untuk membuka menu dan membatalkan pesanan tertentu',
    'receipt.alt_text': 'Pesanan dicatat{suffix}: {day} {item}',

    // My Orders Query Responses
    'my_orders.no_weekly_orders': 'Anda belum memiliki riwayat pra-pesan minggu ini (Senin-Jumat)!',
    'my_orders.no_today_orders': 'Anda belum memiliki pesanan hari ini! Ketik "+1 [nama menu]" untuk memesan.',
    'my_orders.weekly_title': '🍱 [Pesanan Mingguan Anda]',
    'my_orders.today_title': '[Pesanan Hari Ini Anda]',
    'my_orders.weekly_total': 'Total Mingguan: Rp {amount}',
    'my_orders.today_total': 'Total: Rp {amount}',
    'my_orders.subtotal': ' (Subtotal Rp {subtotal})',
    'my_orders.cutoff_notice': '\n⚠️ Batas waktu pemesanan hari ini telah lewat. Pesanan tidak dapat diubah atau dibatalkan.'
  }
};

var I18N_COMMANDS = {
  'zh-TW': {
    'cmd.help':     ['幫助', '說明', '指令', 'help', '/help'],
    'cmd.menu':     ['菜單', 'menu', '/menu'],
    'cmd.weekly':   ['本週菜單', '每週菜單', '本週排程', '排程', '週排程'],
    'cmd.my_order': ['我的訂單', '查詢訂單', '查單'],
    'cmd.my_weekly':['我的本週訂單', '本週訂單'],
    'cmd.cancel':   ['取消餐點', '取消'],
    'cmd.close':    ['結單', '截止', '截止訂餐', '本週結單', '今日結單'],
    'cmd.open':     ['開單', '開始訂餐'],
    'cmd.children': ['設定小孩', '小孩設定', '登記小孩', '小孩選單', '小孩管理', '小孩幫助'],
    'cmd.my_kids':  ['我的小孩', '小孩名單', '小孩名冊', '我的孩子'],
    'cmd.add_kid':  ['新增小孩', '加小孩'],
    'cmd.del_kid':  ['刪除小孩', '移除小孩'],
    'cmd.abort_cancel': ['放棄取消', '取消操作'],
    'cmd.stats_today':  ['今日統計', '本日統計', '統計', '即時統計', '今日訂單', '今日訂餐', '今日訂餐統計', '今日訂單統計', '本日訂單', '本日訂餐', '本日訂單統計'],
    'cmd.stats_weekly': ['本週統計', '梯次統計'],
    'cmd.stats_text':   ['今日文字統計', '今日統計文字', '文字統計', '統計文字', '今日文字'],
    'cmd.import_uber':  ['匯入菜單', '匯入外送', 'ubereats匯入'],
    'cmd.import_custom':['匯入自訂餐廳', '匯入餐廳', '自訂餐廳匯入'],
    'cmd.lang':     ['設定語言', '切換語言', '語言設定', '語言', 'lang', 'language', '/lang']
  },
  'en': {
    'cmd.help':     ['help', 'commands', 'guide', '/help'],
    'cmd.menu':     ['menu', '/menu'],
    'cmd.weekly':   ['weekly menu', 'weekly schedule', 'schedule'],
    'cmd.my_order': ['my order', 'my orders', 'check order'],
    'cmd.my_weekly':['my weekly orders', 'my weekly order'],
    'cmd.cancel':   ['cancel', 'cancel order'],
    'cmd.close':    ['close orders', 'close order', 'close'],
    'cmd.open':     ['open order', 'start ordering'],
    'cmd.children': ['children', 'kids', 'manage kids'],
    'cmd.my_kids':  ['my kids', 'kids list', 'my children'],
    'cmd.add_kid':  ['add kid', 'add child'],
    'cmd.del_kid':  ['delete kid', 'remove kid'],
    'cmd.abort_cancel': ['abort cancel', 'keep orders'],
    'cmd.stats_today':  ['today stats', 'today summary', 'stats'],
    'cmd.stats_weekly': ['weekly stats', 'weekly summary'],
    'cmd.stats_text':   ['text stats', 'today text stats'],
    'cmd.import_uber':  ['import uber', 'ubereats import'],
    'cmd.import_custom':['import custom', 'custom restaurant import'],
    'cmd.lang':     ['set language', 'switch language', 'language', 'lang', '/lang']
  },
  'ja': {
    'cmd.help':     ['ヘルプ', '説明', '使い方', 'help'],
    'cmd.menu':     ['メニュー', 'menu'],
    'cmd.weekly':   ['今週のメニュー', '週間予定', 'スケジュール'],
    'cmd.my_order': ['私の注文', '注文履歴', '注文確認'],
    'cmd.my_weekly':['今週の注文', '週間注文'],
    'cmd.cancel':   ['キャンセル', '取消'],
    'cmd.close':    ['締め切り', '締め切る', '注文締切'],
    'cmd.open':     ['注文開始', '受付開始'],
    'cmd.children': ['子供設定', '子供管理', 'お子様設定'],
    'cmd.my_kids':  ['子供リスト', 'お子様一覧', '私の子供'],
    'cmd.add_kid':  ['子供追加', 'お子様追加'],
    'cmd.del_kid':  ['子供削除', 'お子様削除'],
    'cmd.abort_cancel': ['キャンセル中止', '取り消し中止'],
    'cmd.stats_today':  ['今日の集計', '本日集計', '統計'],
    'cmd.stats_weekly': ['今週の集計', '週間統計'],
    'cmd.stats_text':   ['テキスト集計'],
    'cmd.import_uber':  ['ウーバー導入', 'ubereats導入'],
    'cmd.import_custom':['カスタム導入'],
    'cmd.lang':     ['言語設定', '言語切替', '言語', 'lang']
  },
  'ko': {
    'cmd.help':     ['도움말', '안내', '명령어', 'help'],
    'cmd.menu':     ['메뉴', 'menu'],
    'cmd.weekly':   ['이번주 메뉴', '주간일정', '스케줄'],
    'cmd.my_order': ['내 주문', '주문조회', '주문확인'],
    'cmd.my_weekly':['내 이번주 주문', '주간주문'],
    'cmd.cancel':   ['주문취소', '취소'],
    'cmd.close':    ['마감', '주문마감'],
    'cmd.open':     ['주문시작', '주문열기'],
    'cmd.children': ['자녀설정', '자녀관리', '아이설정'],
    'cmd.my_kids':  ['자녀목록', '아이목록', '내 아이'],
    'cmd.add_kid':  ['자녀추가', '아이추가'],
    'cmd.del_kid':  ['자녀삭제', '아이삭제'],
    'cmd.abort_cancel': ['취소중단', '취소취소'],
    'cmd.stats_today':  ['오늘 통계', '오늘 집계', '통계'],
    'cmd.stats_weekly': ['이번주 통계', '주간통계'],
    'cmd.stats_text':   ['텍스트 통계'],
    'cmd.import_uber':  ['우버이츠 가져오기'],
    'cmd.import_custom':['식당 가져오기'],
    'cmd.lang':     ['언어설정', '언어변경', '언어', 'lang']
  },
  'th': {
    'cmd.help':     ['ช่วยเหลือ', 'คำสั่ง', 'วิธีใช้', 'help'],
    'cmd.menu':     ['เมนู', 'menu'],
    'cmd.weekly':   ['เมนูสัปดาห์นี้', 'ตารางสัปดาห์'],
    'cmd.my_order': ['ออเดอร์ของฉัน', 'ตรวจสอบออเดอร์'],
    'cmd.my_weekly':['ออเดอร์สัปดาห์นี้', 'รายการทั้งสัปดาห์'],
    'cmd.cancel':   ['ยกเลิก', 'ยกเลิกออเดอร์'],
    'cmd.close':    ['ปิดรับ', 'ปิดรับออเดอร์'],
    'cmd.open':     ['เปิดรับ', 'เริ่มสั่ง'],
    'cmd.children': ['ตั้งค่าลูก', 'จัดการลูก'],
    'cmd.my_kids':  ['รายชื่อเด็ก', 'ลูกของฉัน'],
    'cmd.add_kid':  ['เพิ่มลูก'],
    'cmd.del_kid':  ['ลบลูก'],
    'cmd.abort_cancel': ['ยกเลิกการยกเลิก'],
    'cmd.stats_today':  ['สรุปวันนี้', 'ยอดวันนี้'],
    'cmd.stats_weekly': ['สรุปสัปดาห์นี้', 'ยอดสัปดาห์นี้'],
    'cmd.stats_text':   ['สรุปข้อความ'],
    'cmd.import_uber':  ['นำเข้า uber'],
    'cmd.import_custom':['นำเข้าร้านค้า'],
    'cmd.lang':     ['ตั้งค่าภาษา', 'เปลี่ยนภาษา', 'ภาษา', 'lang']
  },
  'id': {
    'cmd.help':     ['bantuan', 'petunjuk', 'panduan', 'help'],
    'cmd.menu':     ['menu', '/menu'],
    'cmd.weekly':   ['menu minggu ini', 'jadwal mingguan'],
    'cmd.my_order': ['pesanan saya', 'cek pesanan'],
    'cmd.my_weekly':['pesanan mingguan', 'pesanan minggu ini'],
    'cmd.cancel':   ['batal', 'batalkan pesanan'],
    'cmd.close':    ['tutup pesanan', 'tutup'],
    'cmd.open':     ['buka pesanan', 'mulai pesan'],
    'cmd.children': ['atur anak', 'kelola anak'],
    'cmd.my_kids':  ['daftar anak', 'anak saya'],
    'cmd.add_kid':  ['tambah anak'],
    'cmd.del_kid':  ['hapus anak'],
    'cmd.abort_cancel': ['batalkan pembatalan'],
    'cmd.stats_today':  ['rekap hari ini', 'total hari ini'],
    'cmd.stats_weekly': ['rekap minggu ini', 'total mingguan'],
    'cmd.stats_text':   ['rekap teks'],
    'cmd.import_uber':  ['impor uber'],
    'cmd.import_custom':['impor restoran'],
    'cmd.lang':     ['atur bahasa', 'ganti bahasa', 'bahasa', 'lang']
  }
};

/**
 * Check if user locale customization is enabled via Config
 * @returns {boolean}
 */
function isUserLocaleEnabled() {
  var val = '';
  try {
    if (typeof SheetModule !== 'undefined' && SheetModule.getConfigValue) {
      val = SheetModule.getConfigValue('ENABLE_USER_LOCALE', '');
    }
  } catch (e) {}
  if (!val && typeof CONFIG !== 'undefined' && CONFIG.ENABLE_USER_LOCALE) {
    val = CONFIG.ENABLE_USER_LOCALE;
  }
  return String(val).toLowerCase() === 'true';
}

/**
 * Get global default locale
 * @returns {string}
 */
function getDefaultLocale() {
  var val = '';
  try {
    if (typeof SheetModule !== 'undefined' && SheetModule.getConfigValue) {
      val = SheetModule.getConfigValue('DEFAULT_LOCALE', '');
    }
  } catch (e) {}
  if (!val && typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_LOCALE) {
    val = CONFIG.DEFAULT_LOCALE;
  }
  val = String(val || '').trim();
  return SUPPORTED_LOCALES[val] ? val : 'zh-TW';
}

/**
 * Resolve effective locale for a user or operation
 * @param {string} [userId]
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {string}
 */
function getEffectiveLocale(userId, userName, userNickname) {
  var defLocale = getDefaultLocale();
  if (!isUserLocaleEnabled() || !userId) {
    return defLocale;
  }
  try {
    if (typeof SheetModule !== 'undefined' && SheetModule.getUserLocalePreference) {
      var userPref = SheetModule.getUserLocalePreference(userId, userName, userNickname);
      if (userPref && SUPPORTED_LOCALES[userPref]) {
        return userPref;
      }
    }
  } catch (e) {}
  return defLocale;
}

/**
 * Translation function
 * @param {string} key - Catalog key
 * @param {Object} [params] - Replacement params
 * @param {string} [localeOverride] - Explicit locale code
 * @returns {string}
 */
function t(key, params, localeOverride) {
  var loc = localeOverride || getDefaultLocale();
  var catalog = I18N_MESSAGES[loc] || I18N_MESSAGES['zh-TW'] || {};
  var text = catalog[key];

  if (text === undefined) {
    // Fallback to zh-TW
    var fallbackCatalog = I18N_MESSAGES['zh-TW'] || {};
    text = fallbackCatalog[key];
  }
  if (text === undefined) {
    return key;
  }

  if (params) {
    for (var p in params) {
      if (params.hasOwnProperty(p)) {
        text = text.replace(new RegExp('\\{' + p + '\\}', 'g'), params[p]);
      }
    }
  }
  return text;
}

/**
 * Display day of week in target locale
 * @param {string} sheetDay - Raw sheet day value (e.g. '週一')
 * @param {string} [locale] - Target locale
 * @returns {string}
 */
function displayDayOfWeek(sheetDay, locale) {
  var map = {
    '週一': 'weekday.mon',
    '週二': 'weekday.tue',
    '週三': 'weekday.wed',
    '週四': 'weekday.thu',
    '週五': 'weekday.fri',
    '週六': 'weekday.sat',
    '週日': 'weekday.sun'
  };
  var k = map[sheetDay];
  return k ? t(k, null, locale) : sheetDay;
}

/**
 * Build a regular expression that matches aliases across all supported languages or specific language
 * @param {string} cmdKey
 * @param {string} [specificLocale]
 * @returns {RegExp}
 */
function buildCommandRegex(cmdKey, specificLocale) {
  var aliasSet = {};
  var localesToScan = specificLocale ? [specificLocale] : Object.keys(I18N_COMMANDS);

  localesToScan.forEach(function (loc) {
    var locCmds = I18N_COMMANDS[loc];
    if (locCmds && locCmds[cmdKey]) {
      locCmds[cmdKey].forEach(function (alias) {
        aliasSet[alias] = true;
      });
    }
  });

  var list = Object.keys(aliasSet);
  if (list.length === 0) {
    return new RegExp('^$');
  }

  // Escape regex special chars and sort by length descending to match longest first
  list.sort(function (a, b) { return b.length - a.length; });
  var escaped = list.map(function (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  return new RegExp('^(?:\\/)?(?:' + escaped.join('|') + ')$', 'i');
}

/**
 * Build a regular expression pattern matching command prefix across all supported languages
 * @param {string} cmdKey
 * @param {string} [specificLocale]
 * @returns {string} Escaped regex pattern string (e.g. "(?:\\/)?(?:alias1|alias2)")
 */
function buildCommandPrefixPattern(cmdKey, specificLocale) {
  var aliasSet = {};
  var localesToScan = specificLocale ? [specificLocale] : Object.keys(I18N_COMMANDS);

  localesToScan.forEach(function (loc) {
    var locCmds = I18N_COMMANDS[loc];
    if (locCmds && locCmds[cmdKey]) {
      locCmds[cmdKey].forEach(function (alias) {
        aliasSet[alias] = true;
      });
    }
  });

  var list = Object.keys(aliasSet);
  if (list.length === 0) {
    return '$^';
  }

  list.sort(function (a, b) { return b.length - a.length; });
  var escaped = list.map(function (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  return '(?:\\/)?(?:' + escaped.join('|') + ')';
}

/**
 * Get command aliases array for a given command key
 * @param {string} cmdKey
 * @param {string} [locale]
 * @returns {Array<string>}
 */
function getCommandAliases(cmdKey, locale) {
  var loc = locale || getDefaultLocale();
  if (I18N_COMMANDS[loc] && I18N_COMMANDS[loc][cmdKey]) {
    return I18N_COMMANDS[loc][cmdKey];
  }
  if (I18N_COMMANDS['zh-TW'] && I18N_COMMANDS['zh-TW'][cmdKey]) {
    return I18N_COMMANDS['zh-TW'][cmdKey];
  }
  return [];
}

// Global export helper
(function (global) {
  var g = (typeof window   !== 'undefined') ? window
        : (typeof globalThis !== 'undefined') ? globalThis
        : (typeof global   !== 'undefined') ? global
        : (typeof self     !== 'undefined') ? self
        : this;

  g.SUPPORTED_LOCALES = SUPPORTED_LOCALES;
  g.I18N_MESSAGES = I18N_MESSAGES;
  g.I18N_COMMANDS = I18N_COMMANDS;
  g.isUserLocaleEnabled = isUserLocaleEnabled;
  g.getDefaultLocale = getDefaultLocale;
  g.getEffectiveLocale = getEffectiveLocale;
  g.t = t;
  g.displayDayOfWeek = displayDayOfWeek;
  g.buildCommandRegex = buildCommandRegex;
  g.buildCommandPrefixPattern = buildCommandPrefixPattern;
  g.getCommandAliases = getCommandAliases;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SUPPORTED_LOCALES: SUPPORTED_LOCALES,
      I18N_MESSAGES: I18N_MESSAGES,
      I18N_COMMANDS: I18N_COMMANDS,
      isUserLocaleEnabled: isUserLocaleEnabled,
      getDefaultLocale: getDefaultLocale,
      getEffectiveLocale: getEffectiveLocale,
      t: t,
      displayDayOfWeek: displayDayOfWeek,
      buildCommandRegex: buildCommandRegex,
      buildCommandPrefixPattern: buildCommandPrefixPattern,
      getCommandAliases: getCommandAliases
    };
  }
})(this);


/* =========================================================
 * File: LineService.js
 * ========================================================= */

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


/* =========================================================
 * File: SheetService.js
 * ========================================================= */

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
    'ORGANIZER_ID': '',
    'ORGANIZER_NAME': '小幫手',
    'ORDER_RECEIPT_SCOPE': 'WEEKLY',
    'CLOSE_ORDER_SCOPE': 'WEEKLY',
    'PAYMENT_LINEPAY_URL': '',
    'PAYMENT_LINEPAY_USER_NAME': '',
    'PAYMENT_LINEPAY_USER_ID': '',
    'PAYMENT_BANK_CODE': '',
    'PAYMENT_BANK_NAME': '',
    'PAYMENT_BANK_ACCOUNT': '',
    'PAYMENT_BANK_ACCOUNT_NAME': '',
    'PAYMENT_BANK_QR_URL': '',
    'PAYMENT_LINEPAY_QR_URL': '',
    'SOURCE_CODE_URL': 'https://tinyurl.com/4c92wtee',
    'ALLOW_SWITCH_ORGANIZER': 'true',
    'USER_IDENTIFIER_MODE': 'HASHED_ID',
    'HASH_SALT': ''
  },
  WeeklySchedule: [
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '招牌排骨', isActive: 'TRUE' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '日式炸豬排/唐揚雞', isActive: 'TRUE' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', cutoffTime: '10:30', uberEatsUrl: '', notes: '水餃/鍋貼/酸辣湯', isActive: 'TRUE' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', cutoffTime: '10:30', uberEatsUrl: '', notes: '三寶飯/叉燒燒肉', isActive: 'TRUE' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', cutoffTime: '10:30', uberEatsUrl: '', notes: '舒肥雞胸/水煮牛', isActive: 'TRUE' }
  ],
  Menu: [
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '招牌排骨飯', price: 100, isAvailable: 'TRUE', description: '附三樣配菜' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '酥炸雞腿飯', price: 110, isAvailable: 'TRUE', description: '酥脆大雞腿' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '古早味控肉飯', price: 95, isAvailable: 'TRUE', description: '經典控肉' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '清蒸魚排飯', price: 105, isAvailable: 'TRUE', description: '鮮嫩無刺魚排' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '便當', itemName: '香煎鯖魚飯', price: 100, isAvailable: 'TRUE', description: '特選鯖魚' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '輕食', itemName: '健康水煮雞胸', price: 100, isAvailable: 'TRUE', description: '低卡高蛋白' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '飲料', itemName: '古早味紅茶', price: 25, isAvailable: 'TRUE', description: '微糖' },
    { dayOfWeek: 'ALL', restaurantName: '今日便當', category: '飲料', itemName: '無糖綠茶', price: 25, isAvailable: 'TRUE', description: '無糖' },
    // Weekly sample items
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', category: '主食', itemName: '招牌排骨飯', price: 100, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週一', restaurantName: '福山排骨便當', category: '主食', itemName: '酥炸雞腿飯', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', category: '日式', itemName: '日式厚切豬排飯', price: 120, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週二', restaurantName: '鹿也日式便當', category: '日式', itemName: '唐揚炸雞飯', price: 115, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', category: '鍋貼水餃', itemName: '招牌鍋貼(10顆)', price: 70, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週三', restaurantName: '八方雲集鍋貼', category: '湯品', itemName: '酸辣湯', price: 35, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', category: '燒臘', itemName: '招牌三寶飯', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週四', restaurantName: '老王燒臘便當', category: '燒臘', itemName: '脆皮燒肉飯', price: 105, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', category: '低GI', itemName: '舒肥嫩雞胸餐盒', price: 110, isAvailable: 'TRUE', description: '' },
    { dayOfWeek: '週五', restaurantName: '健康水煮輕食', category: '低GI', itemName: '薄鹽烤鯖魚餐盒', price: 120, isAvailable: 'TRUE', description: '' }
  ],
  Orders: [],
  Summary: [],
  Children: []
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

var _cachedSpreadsheetTimeZone = null;

/**
 * Get timezone configured directly in the Spreadsheet settings.
 * Directly reads SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() in GAS.
 * Falls back to Session.getScriptTimeZone() if available, and defaults to 'Asia/Taipei'.
 * @returns {string} e.g. 'Asia/Taipei'
 */
function getSpreadsheetTimeZone() {
  if (typeof globalThis !== 'undefined' && globalThis._mockSpreadsheetTimeZone) {
    return globalThis._mockSpreadsheetTimeZone;
  }
  if (_cachedSpreadsheetTimeZone) {
    return _cachedSpreadsheetTimeZone;
  }
  if (isGasRuntime()) {
    try {
      var ss = getSpreadsheet();
      if (ss && typeof ss.getSpreadsheetTimeZone === 'function') {
        var ssTz = ss.getSpreadsheetTimeZone();
        if (ssTz && ssTz.trim() !== '') {
          _cachedSpreadsheetTimeZone = ssTz;
          return _cachedSpreadsheetTimeZone;
        }
      }
    } catch (e) {}
    try {
      if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
        var scriptTz = Session.getScriptTimeZone();
        if (scriptTz && scriptTz.trim() !== '') {
          _cachedSpreadsheetTimeZone = scriptTz;
          return _cachedSpreadsheetTimeZone;
        }
      }
    } catch (e) {}
  }
  return 'Asia/Taipei';
}


/**
 * Initialize sheets, headers, and initial sample menu if needed
 */
function initSheets() {
  var sheetDefs = [
    {
      name: CONFIG.SHEET_NAMES.CONFIG,
      headers: ['Key', 'Value', 'Description'],
      initData: [
        ['IS_ORDERING_OPEN', 'false', '目前是否開放點餐 (true/false)'],
        ['RESTAURANT_NAME', '老王便當', '今日配合訂購店家名稱'],
        ['CUTOFF_TIME', '11:00', '今日點餐截止時間'],
        ['ORGANIZER_ID', '', '發起開單人 LINE User ID (點餐/取消即時推播通知對象)'],
        ['ORGANIZER_NAME', '小幫手', '發起開單人姓名'],
        ['ORDER_RECEIPT_SCOPE', 'WEEKLY', '點餐後收據顯示範圍 (WEEKLY: 本週訂單 / DAILY: 今日訂單)'],
        ['CLOSE_ORDER_SCOPE', 'WEEKLY', '結單結算範圍 (WEEKLY: 本週梯次結單 / DAILY: 今日結單)'],
        ['PAYMENT_LINEPAY_URL', '', 'LINE Pay 收款/轉帳連結或個人收款碼網址'],
        ['PAYMENT_LINEPAY_USER_NAME', '', 'LINE Pay 受款人好友暱稱 (用於提示轉帳對象，留空則預設帶開單人姓名)'],
        ['PAYMENT_LINEPAY_USER_ID', '', 'LINE Pay 受款人 LINE ID 或 User ID (選填，供轉帳搜尋與對照)'],
        ['PAYMENT_BANK_CODE', '', '收款銀行代碼 (例如: 822)'],
        ['PAYMENT_BANK_NAME', '', '收款銀行名稱 (例如: 中國信託)'],
        ['PAYMENT_BANK_ACCOUNT', '', '收款銀行帳號 (例如: 123456789012)'],
        ['PAYMENT_BANK_ACCOUNT_NAME', '', '收款帳戶戶名 (例如: 王大明)'],
        ['PAYMENT_BANK_QR_URL', '', '收款銀行 QR Code 圖片網址 (支援 Google Drive 分享連結或圖床)'],
        ['PAYMENT_LINEPAY_QR_URL', '', 'LINE Pay 收款碼/條碼圖片網址 (支援 Google Drive 分享連結或圖床)'],
        ['SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee', '開源原始碼網址 (AGPL-3.0 規定若修改本程式碼需開源並將此處更新為自己的 public git repo)'],
        ['ALLOW_SWITCH_ORGANIZER', 'true', '是否允許任意群組成員藉由「開單」更換開單人 (true: 允許 / false: 僅限現任開單人)'],
        ['USER_IDENTIFIER_MODE', 'HASHED_ID', '使用者識別索引模式 (HASHED_ID: 單向加鹽雜湊去識別化 / USER_ID: 原始 LINE ID / NICKNAME: 純暱稱代號)'],
        ['HASH_SALT', '', '去識別化雜湊自訂密鑰 Salt (選填，留空自動使用安全預設密鑰)'],
        ['DEFAULT_LOCALE', 'zh-TW', '全域預設語系 (zh-TW: 繁中 / en: 英文 / ja: 日文 / ko: 韓文 / th: 泰文 / id: 印尼文)'],
        ['ENABLE_USER_LOCALE', 'false', '是否允許使用者透過選單自訂語言 (true: 允許並在選單顯示 / false: 統一使用預設語系)']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE,
      headers: ['DayOfWeek', 'RestaurantName', 'CutoffTime', 'UberEatsUrl', 'Notes', 'IsActive'],
      initData: [
        ['週一', '福山排骨便當', '10:30', '', '招牌排骨便當', 'TRUE'],
        ['週二', '鹿也日式便當', '10:30', '', '日式炸豬排/唐揚雞', 'TRUE'],
        ['週三', '八方雲集鍋貼', '10:30', '', '水餃/鍋貼/酸辣湯', 'TRUE'],
        ['週四', '老王燒臘便當', '10:30', '', '三寶飯/叉燒燒肉', 'TRUE'],
        ['週五', '健康水煮輕食', '10:30', '', '舒肥雞胸/低GI', 'TRUE']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.MENU,
      headers: ['DayOfWeek', 'RestaurantName', 'Category', 'ItemName', 'Price', 'IsAvailable', 'Description'],
      initData: [
        ['週一', '福山排骨便當', '主食', '招牌排骨飯', 100, 'TRUE', '附三樣配菜'],
        ['週一', '福山排骨便當', '主食', '酥炸雞腿飯', 110, 'TRUE', '酥脆大雞腿'],
        ['週二', '鹿也日式便當', '日式', '日式厚切豬排飯', 120, 'TRUE', ''],
        ['週二', '鹿也日式便當', '日式', '唐揚炸雞飯', 115, 'TRUE', ''],
        ['週三', '八方雲集鍋貼', '鍋貼水餃', '招牌鍋貼(10顆)', 70, 'TRUE', ''],
        ['週三', '八方雲集鍋貼', '湯品', '酸辣湯', 35, 'TRUE', ''],
        ['週四', '老王燒臘便當', '燒臘', '招牌三寶飯', 110, 'TRUE', ''],
        ['週四', '老王燒臘便當', '燒臘', '脆皮燒肉飯', 105, 'TRUE', ''],
        ['週五', '健康水煮輕食', '低GI', '舒肥嫩雞胸餐盒', 110, 'TRUE', ''],
        ['週五', '健康水煮輕食', '低GI', '薄鹽烤鯖魚餐盒', 120, 'TRUE', ''],
        ['ALL', '通用', '飲料', '古早味紅茶', 25, 'TRUE', '']
      ]
    },
    {
      name: CONFIG.SHEET_NAMES.ORDERS,
      headers: ['OrderId', 'Timestamp', 'Date', 'DayOfWeek', 'GroupId', 'UserId', 'UserName', 'UserNickname', 'ChildName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Status', 'Paid']
    },
    {
      name: CONFIG.SHEET_NAMES.SUMMARY,
      headers: ['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']
    },
    {
      name: CONFIG.SHEET_NAMES.CHILDREN,
      headers: ['UserId', 'UserName', 'UserNickname', 'ChildName', 'Note', 'CreatedAt', 'UpdatedAt'],
      initData: [
        ['U00000000000000000000000000000001', '愛麗絲', '愛麗絲媽咪', '大寶', '附小三年二班', '2026-09-07 08:00:00', '2026-09-07 08:00:00'],
        ['U00000000000000000000000000000001', '愛麗絲', '愛麗絲媽咪', '二寶', '附幼企鵝班', '2026-09-07 08:00:00', '2026-09-07 08:00:00'],
        ['U00000000000000000000000000000002', '小鮑伯', '鮑伯爸爸', '小寶', '附小一年一班 (不吃牛)', '2026-09-07 08:00:00', '2026-09-07 08:00:00']
      ]
    },
    {
      name: (CONFIG.SHEET_NAMES && CONFIG.SHEET_NAMES.USER_PREFERENCES) || 'UserPreferences',
      headers: ['UserId', 'Locale', 'UpdatedAt']
    }
  ];

  if (!isGasRuntime()) {
    // Synchronize _mockStore.Config with all keys defined in sheetDefs
    var configDef = sheetDefs[0];
    if (configDef && configDef.initData) {
      configDef.initData.forEach(function (row) {
        var k = row[0];
        var v = row[1];
        if (_mockStore.Config[k] === undefined) {
          _mockStore.Config[k] = v;
        }
      });
    }
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;

  var addedConfigCount = 0;

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
    } else {
      // If sheet exists but is completely empty (0 rows), populate headers and sample data
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(def.headers);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#EFEFEF');
        if (def.initData && def.initData.length > 0) {
          def.initData.forEach(function (row) {
            sheet.appendRow(row);
          });
        }
      } else {
        // Ensure row 1 has valid headers if blank
        var r1Vals = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        var isR1Empty = r1Vals.every(function (v) { return !String(v).trim(); });
        if (isR1Empty) {
          sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#EFEFEF');
        }
      }

      if (def.name === CONFIG.SHEET_NAMES.CHILDREN) {
        // Ensure Children headers are present in row 1
        var cHeaderVals = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        var firstH = String(cHeaderVals[0] || '').trim().toLowerCase();
        if (!firstH || firstH !== 'userid') {
          sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#EFEFEF');
        }
        // If Children tab has only header row (0 data rows), append sample initData rows
        if (sheet.getLastRow() <= 1 && def.initData && def.initData.length > 0) {
          def.initData.forEach(function (row) {
            sheet.appendRow(row);
          });
        }
      } else if (def.name === CONFIG.SHEET_NAMES.CONFIG && def.initData && def.initData.length > 0) {
      // Backfill missing config keys into existing Config sheet
      var existingData = sheet.getDataRange().getValues();
      var existingKeys = {};
      for (var r = 1; r < existingData.length; r++) {
        var k = String(existingData[r][0]).trim();
        if (k) existingKeys[k] = true;
      }
      def.initData.forEach(function (row) {
        var reqKey = String(row[0]).trim();
        if (!existingKeys[reqKey]) {
          sheet.appendRow(row);
          existingKeys[reqKey] = true;
          addedConfigCount++;
        }
      });
    } else if (def.name === CONFIG.SHEET_NAMES.ORDERS) {
      // Ensure DayOfWeek, UserNickname, and ChildName columns exist in existing Orders sheet
      var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
      var hasDayOfWeek = false;
      var hasNickname = false;
      var hasChildName = false;
      var dateColIndex = -1;
      var userNameColIndex = -1;
      var nicknameColIndex = -1;
      for (var h = 0; h < headerRow.length; h++) {
        var hName = String(headerRow[h]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
        if (hName === 'dayofweek' || hName === '星期' || hName === '星期幾' || hName === '梯次' || hName === 'day' || hName === 'weekday' || hName === '週幾' || hName === '禮拜' || hName === '週' || hName === '周') {
          hasDayOfWeek = true;
        }
        if (hName === 'usernickname' || hName === '使用者暱稱' || hName === '暱稱') {
          hasNickname = true;
          nicknameColIndex = h + 1;
        }
        if (hName === 'childname' || hName === 'child' || hName === '小孩' || hName === '小孩姓名' || hName === '孩子' || hName === '分配對象' || hName === '對象' || hName === '用餐人') {
          hasChildName = true;
        }
        if (hName === 'date' || hName === '日期') {
          dateColIndex = h + 1; // 1-based column
        }
        if (hName === 'username' || hName === '姓名' || hName === '使用者名稱' || hName === '訂購人') {
          userNameColIndex = h + 1; // 1-based column
        }
      }
      if (!hasDayOfWeek) {
        var insertAfterCol = dateColIndex > 0 ? dateColIndex : 3;
        sheet.insertColumnAfter(insertAfterCol);
        sheet.getRange(1, insertAfterCol + 1).setValue('DayOfWeek').setFontWeight('bold').setBackground('#EFEFEF');
        // Refresh header row
        headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
        for (var h2 = 0; h2 < headerRow.length; h2++) {
          var hName2 = String(headerRow[h2]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
          if (hName2 === 'username' || hName2 === '姓名' || hName2 === '使用者名稱' || hName2 === '訂購人') {
            userNameColIndex = h2 + 1;
            break;
          }
        }
      }
      if (!hasNickname) {
        var insertNickAfterCol = userNameColIndex > 0 ? userNameColIndex : 7;
        sheet.insertColumnAfter(insertNickAfterCol);
        sheet.getRange(1, insertNickAfterCol + 1).setValue('UserNickname').setFontWeight('bold').setBackground('#EFEFEF');
        nicknameColIndex = insertNickAfterCol + 1;
      }
      if (!hasChildName) {
        var insertChildAfterCol = nicknameColIndex > 0 ? nicknameColIndex : (userNameColIndex > 0 ? userNameColIndex + 1 : 8);
        sheet.insertColumnAfter(insertChildAfterCol);
        sheet.getRange(1, insertChildAfterCol + 1).setValue('ChildName').setFontWeight('bold').setBackground('#EFEFEF');
      }
    } else if (def.name === CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE && def.initData) {
      // Ensure all Mon-Fri schedule days exist
      var schedData = sheet.getDataRange().getValues();
      var existingDays = {};
      for (var s = 1; s < schedData.length; s++) {
        var day = String(schedData[s][0]).trim();
        if (day) existingDays[day] = true;
      }
      def.initData.forEach(function (row) {
        if (!existingDays[row[0]]) {
          sheet.appendRow(row);
          existingDays[row[0]] = true;
        }
      });
    }
  }
  });

  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
      var toastMsg = addedConfigCount > 0
        ? '試算表結構檢查完成！已自動補齊 ' + addedConfigCount + ' 項新 Config 設定。'
        : '試算表結構與所有 Config 設定檢查完成，全部正常！';
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, '檢查完成', 5);
    }
  } catch (e) {}

  return true;
}

/**
 * Get config value
 */
function getConfigValue(key, defaultValue) {
  var targetKey = String(key).trim().toUpperCase();
  if (!isGasRuntime()) {
    for (var mk in _mockStore.Config) {
      if (mk.toUpperCase() === targetKey) {
        return _mockStore.Config[mk];
      }
    }
    return defaultValue;
  }
  var ss = getSpreadsheet();
  if (!ss) return defaultValue;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
  if (!sheet) return defaultValue;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === targetKey) {
      var val = data[i][1];
      return val != null ? String(val) : '';
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
  sheet.appendRow([key, String(value), '']);
  return true;
}

/**
 * Convert Google Drive sharing URL or any web link to direct image URL
 * @param {string} url
 * @returns {string} Direct image URL
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim();
  if (!trimmed) return '';

  // Google Drive sharing patterns:
  // 1) https://drive.google.com/file/d/{FILE_ID}/view...
  // 2) https://drive.google.com/open?id={FILE_ID}
  // 3) https://drive.google.com/uc?id={FILE_ID}
  var gdMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+))/i);
  if (gdMatch) {
    var fileId = gdMatch[1] || gdMatch[2] || gdMatch[3];
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }
  return trimmed;
}

/**
 * Get payment configuration (LINE Pay & Bank Transfer + QR Codes)
 * @returns {{ linePayUrl: string, linePayQrUrl: string, linePayUserName: string, linePayUserId: string, linePayRecipientName: string, isPersonalLinePay: boolean, bankCode: string, bankName: string, bankAccount: string, bankAccountName: string, bankQrUrl: string, hasPaymentInfo: boolean }}
 */
function getPaymentConfig() {
  var linePayUrl = (getConfigValue('PAYMENT_LINEPAY_URL', '') || '').trim();
  // If linePayUrl is a placeholder (e.g., '無', 'None', '-'), ignore it
  if (linePayUrl && !/^https?:\/\//i.test(linePayUrl)) {
    linePayUrl = '';
  }
  var linePayQrUrl = normalizeImageUrl(getConfigValue('PAYMENT_LINEPAY_QR_URL', '') || '');
  var linePayUserName = (getConfigValue('PAYMENT_LINEPAY_USER_NAME', '') || '').trim();
  var linePayUserId = (getConfigValue('PAYMENT_LINEPAY_USER_ID', '') || '').trim();
  var organizerName = (getConfigValue('ORGANIZER_NAME', '') || '').trim();

  var isPersonalLinePay = false;
  var linePayRecipientName = '';

  // If no explicit commercial LINE Pay URL is configured, but personal user info is provided
  if (!linePayUrl && (linePayUserName || linePayUserId)) {
    isPersonalLinePay = true;
    linePayRecipientName = linePayUserName || organizerName || '開單人';
    linePayUrl = 'https://line.me/R/nv/wallet';
  } else if (linePayUrl) {
    linePayRecipientName = linePayUserName || organizerName || '';
  }

  var bankCode = (getConfigValue('PAYMENT_BANK_CODE', '') || '').trim();
  var bankName = (getConfigValue('PAYMENT_BANK_NAME', '') || '').trim();
  var bankAccount = (getConfigValue('PAYMENT_BANK_ACCOUNT', '') || '').trim();
  var bankAccountName = (getConfigValue('PAYMENT_BANK_ACCOUNT_NAME', '') || '').trim();
  var bankQrUrl = normalizeImageUrl(getConfigValue('PAYMENT_BANK_QR_URL', '') || '');

  var hasPaymentInfo = !!(linePayUrl || linePayQrUrl || linePayUserName || linePayUserId || bankAccount || bankCode || bankQrUrl);

  return {
    linePayUrl: linePayUrl,
    linePayQrUrl: linePayQrUrl,
    linePayUserName: linePayUserName,
    linePayUserId: linePayUserId,
    linePayRecipientName: linePayRecipientName,
    isPersonalLinePay: isPersonalLinePay,
    bankCode: bankCode,
    bankName: bankName,
    bankAccount: bankAccount,
    bankAccountName: bankAccountName,
    bankQrUrl: bankQrUrl,
    hasPaymentInfo: hasPaymentInfo
  };
}

/**
 * Get Weekly Schedule (Mon to Fri)
 */
function getWeeklySchedule() {
  if (!isGasRuntime()) {
    return _mockStore.WeeklySchedule.map(function (s) {
      return {
        dayOfWeek: s.dayOfWeek,
        restaurantName: s.restaurantName,
        cutoffTime: s.cutoffTime,
        uberEatsUrl: s.uberEatsUrl || '',
        notes: s.notes || '',
        isActive: String(s.isActive).toUpperCase() === 'TRUE'
      };
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    list.push({
      dayOfWeek: String(r[0]),
      restaurantName: String(r[1]),
      cutoffTime: String(r[2]),
      uberEatsUrl: String(r[3]),
      notes: String(r[4]),
      isActive: String(r[5]).toUpperCase() === 'TRUE'
    });
  }
  return list;
}

/**
 * Get Schedule for specific day
 */
function getScheduleByDay(dayOfWeek) {
  var schedule = getWeeklySchedule();
  for (var i = 0; i < schedule.length; i++) {
    if (schedule[i].dayOfWeek === dayOfWeek) {
      return schedule[i];
    }
  }
  return null;
}

/**
 * Set Weekly Schedule for a day
 */
function setWeeklyScheduleDay(dayOfWeek, restaurantName, cutoffTime, uberEatsUrl, notes, isActive) {
  if (!isGasRuntime()) {
    for (var i = 0; i < _mockStore.WeeklySchedule.length; i++) {
      if (_mockStore.WeeklySchedule[i].dayOfWeek === dayOfWeek) {
        if (restaurantName) _mockStore.WeeklySchedule[i].restaurantName = restaurantName;
        if (cutoffTime) _mockStore.WeeklySchedule[i].cutoffTime = cutoffTime;
        if (uberEatsUrl !== undefined) _mockStore.WeeklySchedule[i].uberEatsUrl = uberEatsUrl;
        if (notes !== undefined) _mockStore.WeeklySchedule[i].notes = notes;
        if (isActive !== undefined) _mockStore.WeeklySchedule[i].isActive = isActive ? 'TRUE' : 'FALSE';
        return true;
      }
    }
    _mockStore.WeeklySchedule.push({
      dayOfWeek: dayOfWeek,
      restaurantName: restaurantName || '',
      cutoffTime: cutoffTime || '10:30',
      uberEatsUrl: uberEatsUrl || '',
      notes: notes || '',
      isActive: isActive ? 'TRUE' : 'FALSE'
    });
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.WEEKLY_SCHEDULE);
  if (!sheet) return false;

  var rows = sheet.getDataRange().getValues();
  for (var j = 1; j < rows.length; j++) {
    if (String(rows[j][0]) === dayOfWeek) {
      if (restaurantName) sheet.getRange(j + 1, 2).setValue(restaurantName);
      if (cutoffTime) sheet.getRange(j + 1, 3).setValue(cutoffTime);
      if (uberEatsUrl !== undefined) sheet.getRange(j + 1, 4).setValue(uberEatsUrl);
      if (notes !== undefined) sheet.getRange(j + 1, 5).setValue(notes);
      if (isActive !== undefined) sheet.getRange(j + 1, 6).setValue(isActive ? 'TRUE' : 'FALSE');
      return true;
    }
  }
  // Append new day
  sheet.appendRow([dayOfWeek, restaurantName || '', cutoffTime || '10:30', uberEatsUrl || '', notes || '', isActive ? 'TRUE' : 'FALSE']);
  return true;
}

/**
 * Get menu items (optionally filtered by dayOfWeek or restaurantName)
 */
function getMenuItems(dayOfWeek, restaurantName) {
  if (!isGasRuntime()) {
    return _mockStore.Menu.filter(function (m) {
      var isAvail = m.isAvailable !== undefined ? m.isAvailable : m.IsAvailable;
      var dow = m.dayOfWeek !== undefined ? m.dayOfWeek : m.DayOfWeek;
      var rName = m.restaurantName !== undefined ? m.restaurantName : m.RestaurantName;
      var matchDay = (!dayOfWeek || dow === 'ALL' || dow === dayOfWeek);
      var matchRest = restaurantName ? (rName === restaurantName) : true;
      return String(isAvail).toUpperCase() === 'TRUE' && matchDay && matchRest;
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
    var isAvailable = String(row[5]).toUpperCase() === 'TRUE';
    var itemDay = String(row[0]);
    var itemRest = String(row[1]);

    var dayMatches = (!dayOfWeek || itemDay === 'ALL' || itemDay === dayOfWeek);
    var restMatches = restaurantName ? (itemRest === restaurantName) : true;

    if (isAvailable && dayMatches && restMatches) {
      menu.push({
        dayOfWeek: itemDay,
        restaurantName: itemRest,
        category: String(row[2]),
        itemName: String(row[3]),
        price: Number(row[4]) || 0,
        isAvailable: isAvailable,
        description: String(row[6] || '')
      });
    }
  }
  return menu;
}

/**
 * Sanitize cell values against Google Sheets formula injection (=, +, -, @, \t, \r)
 * Neutralizes potential formula injection even if preceded by whitespace.
 */
function _sanitizeSheetCell(val) {
  if (typeof val === 'string') {
    if (/^\s*[=+\-@\t\r]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

/**
 * Compute one-way salted HMAC-SHA256 hash for LINE User ID de-identification.
 * Returns pseudonymous string e.g. 'usr_8f9c21b4a7d3e5f0'
 * @param {string} userId - Raw LINE User ID (e.g. U12345...)
 * @param {string} [customSalt] - Optional secret salt
 * @returns {string} Hashed user identifier
 */
function hashUserId(userId, customSalt) {
  if (!userId) return '';
  var uidStr = String(userId).trim();
  if (!uidStr) return '';
  // If already hashed, return as-is to avoid double-hashing
  if (uidStr.indexOf('usr_') === 0 && uidStr.length >= 20) {
    return uidStr;
  }

  var salt = customSalt ||
             getConfigValue('HASH_SALT', '') ||
             (typeof getConfigProperty === 'function' ? getConfigProperty('CHANNEL_SECRET', '') : '') ||
             'LINE_MEAL_ORDER_SALT_DEFAULT';

  // 1. Google Apps Script
  try {
    if (typeof Utilities !== 'undefined' && typeof Utilities.computeHmacSha256 === 'function') {
      var raw = Utilities.computeHmacSha256(uidStr, salt);
      var hex = raw.map(function (b) {
        var n = (b < 0 ? b + 256 : b).toString(16);
        return n.length === 1 ? '0' + n : n;
      }).join('');
      return 'usr_' + hex.substring(0, 16);
    }
  } catch (e) {}

  // 2. Node.js runtime
  try {
    var crypto = require('crypto');
    var hexNode = crypto.createHmac('sha256', salt).update(uidStr).digest('hex');
    return 'usr_' + hexNode.substring(0, 16);
  } catch (e) {}

  // 3. Fallback simple hash
  var h = 0;
  for (var i = 0; i < uidStr.length; i++) {
    h = ((h << 5) - h) + uidStr.charCodeAt(i);
    h |= 0;
  }
  return 'usr_' + Math.abs(h).toString(16);
}

/**
 * Get effective user identifier according to USER_IDENTIFIER_MODE
 * @param {string} userId
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {string}
 */
function getEffectiveUserId(userId, userName, userNickname) {
  var mode = (getConfigValue('USER_IDENTIFIER_MODE', (CONFIG && CONFIG.USER_IDENTIFIER_MODE) || 'HASHED_ID') || 'HASHED_ID').toUpperCase();

  if (mode === 'NICKNAME') {
    var nick = (userNickname || userName || userId || '').trim();
    return nick || '匿名成員';
  } else if (mode === 'USER_ID') {
    return (userId || '').trim();
  } else {
    // Default: 'HASHED_ID'
    return hashUserId(userId);
  }
}

/**
 * Save / Import menu items for a specific day and restaurant
 */
function saveMenuItems(dayOfWeek, restaurantName, items) {
  if (!items || items.length === 0) return 0;

  if (!isGasRuntime()) {
    // Remove old items for this day & restaurant
    _mockStore.Menu = _mockStore.Menu.filter(function (m) {
      return !(m.dayOfWeek === dayOfWeek && m.restaurantName === restaurantName);
    });
    items.forEach(function (it) {
      _mockStore.Menu.push({
        dayOfWeek: dayOfWeek,
        restaurantName: restaurantName,
        category: it.category || '一般',
        itemName: it.itemName,
        price: it.price || 0,
        isAvailable: it.isAvailable !== false ? 'TRUE' : 'FALSE',
        description: it.description || ''
      });
    });
    return items.length;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.MENU);
  if (!sheet) return 0;

  // Append new items
  items.forEach(function (it) {
    sheet.appendRow([
      dayOfWeek,
      _sanitizeSheetCell(restaurantName),
      _sanitizeSheetCell(it.category || '一般'),
      _sanitizeSheetCell(it.itemName),
      it.price || 0,
      it.isAvailable !== false ? 'TRUE' : 'FALSE',
      _sanitizeSheetCell(it.description || '')
    ]);
  });

  return items.length;
}

/**
 * Reserved system tab names (cannot be treated as custom restaurant menus)
 */
var SYSTEM_TAB_NAMES = [
  'Config',
  'Logs',
  'WeeklySchedule',
  'Menu',
  'Orders',
  'Children',
  'Summary'
];

/**
 * Check if a given sheet/tab name is a reserved system tab
 * @param {string} tabName
 * @returns {boolean}
 */
function isSystemTab(tabName) {
  if (!tabName) return true;
  var clean = String(tabName).trim().toLowerCase();
  for (var i = 0; i < SYSTEM_TAB_NAMES.length; i++) {
    if (SYSTEM_TAB_NAMES[i].toLowerCase() === clean) {
      return true;
    }
  }
  return false;
}

/**
 * Read custom restaurant menu items from a custom sheet
 * Format: RestaurantName, Category, ItemName, Price, IsAvailable, Description
 * @param {string} restaurantName - Exact match sheet name
 * @returns {Array<Object>|null} List of item objects or null if sheet not found / system tab
 */
function readCustomRestaurantMenu(restaurantName) {
  if (!restaurantName) return null;
  var rName = String(restaurantName).trim();
  if (isSystemTab(rName)) {
    return null;
  }

  if (!isGasRuntime()) {
    if (!_mockStore.CustomRestaurants) return null;
    return _mockStore.CustomRestaurants[rName] || null;
  }

  var ss = getSpreadsheet();
  if (!ss) return null;

  var sheet = ss.getSheetByName(rName);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return [];

  var startRow = 0;
  var colMap = {
    restaurantName: -1,
    category: -1,
    itemName: -1,
    price: -1,
    isAvailable: -1,
    description: -1
  };

  var firstRow = data[0] || [];
  var hasHeader = false;
  for (var c = 0; c < firstRow.length; c++) {
    var val = String(firstRow[c]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
    if (val === 'itemname' || val === '餐點' || val === '品項' || val === '品名' || val === '餐點名稱') {
      colMap.itemName = c;
      hasHeader = true;
    } else if (val === 'category' || val === '分類' || val === '類別') {
      colMap.category = c;
      hasHeader = true;
    } else if (val === 'price' || val === '價格' || val === '金額' || val === '單價') {
      colMap.price = c;
      hasHeader = true;
    } else if (val === 'isavailable' || val === '供應' || val === '供應狀態' || val === '是否供應') {
      colMap.isAvailable = c;
      hasHeader = true;
    } else if (val === 'description' || val === '描述' || val === '備註' || val === '說明') {
      colMap.description = c;
      hasHeader = true;
    } else if (val === 'restaurantname' || val === '店家' || val === '餐廳' || val === '店家名稱') {
      colMap.restaurantName = c;
      hasHeader = true;
    }
  }

  if (hasHeader) {
    startRow = 1;
  } else {
    // Default 6 columns: RestaurantName, Category, ItemName, Price, IsAvailable, Description
    colMap = {
      restaurantName: 0,
      category: 1,
      itemName: 2,
      price: 3,
      isAvailable: 4,
      description: 5
    };
  }

  var items = [];
  for (var r = startRow; r < data.length; r++) {
    var row = data[r];
    var rawItemName = colMap.itemName !== -1 ? row[colMap.itemName] : (row[2] !== undefined ? row[2] : row[1]);
    var itName = String(rawItemName || '').trim();
    if (!itName) continue; // skip empty rows

    var cat = colMap.category !== -1 ? String(row[colMap.category] || '').trim() : (row[1] ? String(row[1]).trim() : '一般');
    var priceVal = colMap.price !== -1 ? row[colMap.price] : row[3];
    var price = Number(priceVal) || 0;
    var availVal = colMap.isAvailable !== -1 ? row[colMap.isAvailable] : row[4];
    var isAvailable = (availVal === undefined || availVal === null || String(availVal).trim() === '') ? true : (String(availVal).toUpperCase() !== 'FALSE');
    var desc = colMap.description !== -1 ? String(row[colMap.description] || '').trim() : (row[5] ? String(row[5]).trim() : '');

    items.push({
      category: cat || '一般',
      itemName: itName,
      price: price,
      isAvailable: isAvailable,
      description: desc
    });
  }

  return items;
}

/**
 * Import custom restaurant menu to WeeklySchedule and Menu tabs
 * @param {string} dayOfWeek - e.g. "週一", "週二"
 * @param {string} restaurantName - Tab name of the custom restaurant
 * @returns {Object} { success: boolean, reason?: string, message?: string, count?: number }
 */
function importCustomRestaurantMenu(dayOfWeek, restaurantName) {
  if (!restaurantName || !String(restaurantName).trim()) {
    return { success: false, reason: 'EMPTY_NAME', message: '餐廳名稱不得為空！' };
  }

  var rName = String(restaurantName).trim();
  if (isSystemTab(rName)) {
    return {
      success: false,
      reason: 'SYSTEM_TAB',
      message: '「' + rName + '」為系統專用功能工作表，無法作為自訂餐廳菜單匯入！'
    };
  }

  var normDay = normalizeDayOfWeek ? normalizeDayOfWeek(dayOfWeek) : dayOfWeek;
  if (!normDay || normDay === '今日') {
    normDay = '週一';
  }

  var items = readCustomRestaurantMenu(rName);
  if (items === null) {
    return {
      success: false,
      reason: 'NOT_FOUND',
      message: '查無此自訂餐廳！\n找不到名為「' + rName + '」的工作表，請確認工作表名稱完全一致（包含大小寫與空格）。'
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      reason: 'EMPTY_MENU',
      message: '工作表「' + rName + '」中沒有任何餐點品項！'
    };
  }

  // 1. Update WeeklySchedule
  setWeeklyScheduleDay(normDay, rName, '10:30', '', '從自訂餐廳匯入', true);

  // 2. Update Menu
  saveMenuItems(normDay, rName, items);

  return {
    success: true,
    dayOfWeek: normDay,
    restaurantName: rName,
    count: items.length
  };
}

/**
 * Helper to map Orders sheet header columns dynamically
 */
function _getOrderColumnIndexes(headers) {
  var colMap = {
    orderId: 0,
    timestamp: 1,
    date: 2,
    dayOfWeek: -1,
    groupId: 3,
    userId: 4,
    userName: 5,
    userNickname: -1,
    childName: -1,
    itemName: 6,
    quantity: 7,
    price: 8,
    subtotal: 9,
    status: 10,
    paid: 11
  };
  if (!headers || headers.length === 0) return colMap;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c]).trim().toLowerCase().replace(/[\s_\-/（）()]/g, '');
    if (h === 'orderid' || h === '訂單編號' || h === '訂單id') colMap.orderId = c;
    else if (h === 'timestamp' || h === '時間' || h === '建立時間') colMap.timestamp = c;
    else if (h === 'date' || h === '日期') colMap.date = c;
    else if (h === 'dayofweek' || h === '星期' || h === '星期幾' || h === '梯次' || h === '梯次星期' || h === 'day' || h === 'weekday' || h === '週幾' || h === '禮拜' || h === '週' || h === '周' || h === '梯次別') colMap.dayOfWeek = c;
    else if (h === 'groupid' || h === '群組id' || h === '群組') colMap.groupId = c;
    else if (h === 'userid' || h === '使用者id' || h === '用戶id' || h === 'lineid') colMap.userId = c;
    else if (h === 'username' || h === '使用者名稱' || h === '姓名' || h === '訂購人') colMap.userName = c;
    else if (h === 'usernickname' || h === '使用者暱稱' || h === '暱稱') colMap.userNickname = c;
    else if (h === 'childname' || h === 'child' || h === '小孩' || h === '小孩姓名' || h === '孩子' || h === '分配對象' || h === '對象' || h === '用餐人') colMap.childName = c;
    else if (h === 'itemname' || h === '餐點名稱' || h === '餐點' || h === '品項') colMap.itemName = c;
    else if (h === 'quantity' || h === '數量' || h === '份數') colMap.quantity = c;
    else if (h === 'price' || h === '單價' || h === '價格') colMap.price = c;
    else if (h === 'subtotal' || h === '小計' || h === '金額') colMap.subtotal = c;
    else if (h === 'status' || h === '狀態') colMap.status = c;
    else if (h === 'paid' || h === '付款狀態' || h === '付款') colMap.paid = c;
  }
  return colMap;
}

/**
 * Normalize day-of-week string into standard format ('週一' ~ '週日', 'ALL', '今日')
 * @param {string} day
 * @returns {string}
 */
function normalizeDayOfWeek(day) {
  if (!day) return '';
  var s = String(day).trim();
  if (!s) return '';
  if (s === 'ALL' || s === '通用' || s === '全部') return 'ALL';
  if (s === '今日' || s === '本日' || s === '今天') return '今日';

  var match = s.match(/(?:週|星期|禮拜|周)?([一二三四五六日天1-7])/);
  if (match) {
    var char = match[1];
    var map = {
      '一': '週一', '1': '週一',
      '二': '週二', '2': '週二',
      '三': '週三', '3': '週三',
      '四': '週四', '4': '週四',
      '五': '週五', '5': '週五',
      '六': '週六', '6': '週六',
      '日': '週日', '天': '週日', '7': '週日'
    };
    if (map[char]) return map[char];
  }
  var enMap = {
    'mon': '週一', 'monday': '週一',
    'tue': '週二', 'tuesday': '週二',
    'wed': '週三', 'wednesday': '週三',
    'thu': '週四', 'thursday': '週四',
    'fri': '週五', 'friday': '週五',
    'sat': '週六', 'saturday': '週六',
    'sun': '週日', 'sunday': '週日'
  };
  var lower = s.toLowerCase();
  if (enMap[lower]) return enMap[lower];
  return s;
}

/**
 * Format and normalize date values from Google Sheet cells or Date objects to YYYY-MM-DD
 * @param {*} val
 * @returns {string}
 */
function _formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var tz = getSpreadsheetTimeZone();
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      try {
        return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } catch (e) {}
    }
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(val);
      }
    } catch (e) {}
    var utc = val.getTime() + (val.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    var y = twDate.getFullYear();
    var m = ('0' + (twDate.getMonth() + 1)).slice(-2);
    var d = ('0' + twDate.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  var match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    var y = match[1];
    var m = ('0' + match[2]).slice(-2);
    var d = ('0' + match[3]).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return s;
}

/**
 * Match order timing against query date and dayOfWeek.
 * Ensures orders placed in advance for other weekdays are never mixed into today's query.
 *
 * @param {string} orderDate - e.g. '2026-09-07'
 * @param {string} orderDayOfWeek - e.g. '週一', '週二'
 * @param {string} [queryDate] - e.g. '2026-09-07'
 * @param {string} [queryDayOfWeek] - e.g. '週一'
 * @returns {boolean}
 */
function _matchOrderTiming(orderDate, orderDayOfWeek, queryDate, queryDayOfWeek) {
  var oDay = normalizeDayOfWeek(orderDayOfWeek);
  var qDay = normalizeDayOfWeek(queryDayOfWeek);
  var oDate = (orderDate || '').trim();
  var qDate = (queryDate || '').trim();

  // 1. Both date and dayOfWeek are queried (e.g. daily summary / today orders)
  if (qDate && qDay) {
    if (oDay) {
      return (oDay === qDay || oDay === 'ALL' || oDay === '今日');
    }
    return (oDate === qDate);
  }

  // 2. Only dayOfWeek is queried (e.g. weekly batch schedule query)
  if (qDay) {
    return (oDay === qDay || oDay === 'ALL');
  }

  // 3. Only date is queried
  if (qDate) {
    return (oDate === qDate);
  }

  // 4. Neither is specified (all orders)
  return true;
}

/**
 * Record an order
 */
function addOrder(orderData) {
  var now = new Date();
  var orderId = 'ORD_' + now.getTime() + '_' + Math.floor(Math.random() * 1000);
  var timestamp = now.toISOString();
  var date = orderData.date || now.toISOString().slice(0, 10);
  var dayOfWeek = orderData.dayOfWeek || '週一';
  var quantity = Number(orderData.quantity) || 1;
  var price = Number(orderData.price) || 0;
  var subtotal = quantity * price;

  var rawUserId = orderData.userId || '';
  var effUserId = getEffectiveUserId(rawUserId, orderData.userName, orderData.userNickname);

  var record = {
    orderId: orderId,
    timestamp: timestamp,
    date: date,
    dayOfWeek: dayOfWeek,
    groupId: orderData.groupId || '',
    userId: effUserId,
    userName: orderData.userName || '成員',
    userNickname: orderData.userNickname || orderData.userName || '成員',
    childName: (orderData.childName || '').trim(),
    itemName: orderData.itemName || '',
    quantity: quantity,
    price: price,
    subtotal: subtotal,
    status: 'ACTIVE',
    paid: 'UNPAID'
  };

  if (record.childName && record.childName !== '本人' && record.childName !== '自己') {
    saveChild(effUserId, record.userName, record.userNickname, record.childName);
  }

  if (!isGasRuntime()) {
    _mockStore.Orders.push(record);
    return record;
  }

  var ss = getSpreadsheet();
  if (!ss) return record;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return record;

  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0] || [];
  var colMap = _getOrderColumnIndexes(headers);
  var rowData = new Array(headers.length);
  for (var idx = 0; idx < rowData.length; idx++) rowData[idx] = '';

  if (colMap.orderId !== -1) rowData[colMap.orderId] = record.orderId;
  if (colMap.timestamp !== -1) rowData[colMap.timestamp] = record.timestamp;
  if (colMap.date !== -1) rowData[colMap.date] = record.date;
  if (colMap.dayOfWeek !== -1) rowData[colMap.dayOfWeek] = record.dayOfWeek;
  if (colMap.groupId !== -1) rowData[colMap.groupId] = record.groupId;
  if (colMap.userId !== -1) rowData[colMap.userId] = record.userId;
  if (colMap.userName !== -1) rowData[colMap.userName] = _sanitizeSheetCell(record.userName);
  if (colMap.userNickname !== -1) rowData[colMap.userNickname] = _sanitizeSheetCell(record.userNickname);
  if (colMap.childName !== -1) rowData[colMap.childName] = _sanitizeSheetCell(record.childName);
  if (colMap.itemName !== -1) rowData[colMap.itemName] = _sanitizeSheetCell(record.itemName);
  if (colMap.quantity !== -1) rowData[colMap.quantity] = record.quantity;
  if (colMap.price !== -1) rowData[colMap.price] = record.price;
  if (colMap.subtotal !== -1) rowData[colMap.subtotal] = record.subtotal;
  if (colMap.status !== -1) rowData[colMap.status] = record.status;
  if (colMap.paid !== -1) rowData[colMap.paid] = record.paid;

  sheet.appendRow(rowData);

  return record;
}

/**
 * Get active orders for a user
 * @param {string} userId
 * @param {string} [groupId]
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [userName]
 * @returns {Array} Array of order objects
 */
function getUserOrders(userId, groupId, date, dayOfWeek, userName) {
  var effUserId = userId ? getEffectiveUserId(userId, userName, userName) : '';

  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      if (o.status !== 'ACTIVE') return false;
      if (groupId && o.groupId !== groupId) return false;

      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return false;

      // Strict user matching:
      // If userName is provided and not fallback '成員', order MUST match userName or userNickname
      if (userName && userName !== '成員') {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return false;
        }
      }

      // If userId is provided and not 'anonymous', order MUST match userId or effUserId
      if (userId && userId !== 'anonymous') {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId && o.userId !== effUserId) {
          return false;
        }
      }

      // If neither userId nor userName matches any criteria, return false
      var hasValidUserId = (userId && userId !== 'anonymous');
      var hasValidUserName = (userName && userName !== '成員');
      if (!hasValidUserId && !hasValidUserName) {
        return false;
      }

      return true;
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var colMap = _getOrderColumnIndexes(rows[0]);
  var orders = [];

  var hasValidUserId = (userId && userId !== 'anonymous');
  var hasValidUserName = (userName && userName !== '成員');
  if (!hasValidUserId && !hasValidUserName) {
    return [];
  }

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rUserId = String(r[colMap.userId]);
    var rUserName = String(r[colMap.userName]);
    var rUserNickname = colMap.userNickname !== -1 ? String(r[colMap.userNickname]) : rUserName;
    var rChildName = colMap.childName !== -1 ? String(r[colMap.childName] || '').trim() : '';

    // Strict user matching:
    if (hasValidUserName) {
      if (rUserName && rUserName !== '成員' && rUserName !== userName && rUserNickname !== userName) {
        continue;
      }
    }

    if (hasValidUserId) {
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId && rUserId !== effUserId) {
        continue;
      }
    }

    orders.push({
      row: i + 1,
      orderId: r[colMap.orderId],
      timestamp: r[colMap.timestamp],
      date: rDate,
      dayOfWeek: rDayOfWeek,
      groupId: rGroupId,
      userId: rUserId,
      userName: rUserName,
      userNickname: rUserNickname,
      childName: rChildName,
      itemName: r[colMap.itemName],
      quantity: Number(r[colMap.quantity]),
      price: Number(r[colMap.price]),
      subtotal: Number(r[colMap.subtotal]),
      status: rStatus,
      paid: r[colMap.paid]
    });
  }
  return orders;
}

/**
 * Cancel orders for a specific user
 * @param {string} userId
 * @param {string} groupId
 * @param {string} [itemName]
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [userName]
 * @returns {number} Count of cancelled orders
 */
function cancelOrder(userId, groupId, itemName, date, dayOfWeek, userName, childName) {
  var effUserId = userId ? getEffectiveUserId(userId, userName, userName) : '';

  // If neither userId nor userName is provided, do NOT cancel anything
  var hasValidUserId = (userId && userId !== 'anonymous');
  var hasValidUserName = (userName && userName !== '成員');
  if (!hasValidUserId && !hasValidUserName) {
    return 0;
  }

  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.status !== 'ACTIVE') return;
      if (groupId && o.groupId !== groupId) return;

      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return;
      if (itemName && o.itemName.indexOf(itemName) === -1) return;
      if (childName && childName.trim()) {
        if ((o.childName || '').trim() !== childName.trim()) return;
      }

      // Strict user matching
      if (hasValidUserName) {
        var oName = o.userName || '';
        var oNick = o.userNickname || '';
        if (oName && oName !== '成員' && oName !== userName && oNick !== userName) {
          return;
        }
      }

      if (hasValidUserId) {
        if (o.userId && o.userId !== 'anonymous' && o.userId !== userId && o.userId !== effUserId) {
          return;
        }
      }

      o.status = 'CANCELLED';
      count++;
    });
    return count;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return 0;

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return 0;
  var colMap = _getOrderColumnIndexes(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rItem = String(r[colMap.itemName]);
    if (itemName && rItem.indexOf(itemName) === -1) continue;

    if (childName && childName.trim() && colMap.childName !== -1) {
      var rChildName = String(r[colMap.childName] || '').trim();
      if (rChildName !== childName.trim()) continue;
    }

    var rUserId = String(r[colMap.userId]);
    var rUserName = String(r[colMap.userName]);
    var rUserNickname = colMap.userNickname !== -1 ? String(r[colMap.userNickname]) : rUserName;

    // Strict user matching
    if (hasValidUserName) {
      if (rUserName && rUserName !== '成員' && rUserName !== userName && rUserNickname !== userName) {
        continue;
      }
    }

    if (hasValidUserId) {
      if (rUserId && rUserId !== 'anonymous' && rUserId !== userId && rUserId !== effUserId) {
        continue;
      }
    }

    sheet.getRange(i + 1, colMap.status + 1).setValue('CANCELLED');
    count++;
  }
  return count;
}

/**
 * Cancel group orders across all members (exclusive to organizer bulk cancellations)
 * @param {string} groupId
 * @param {string} [date]
 * @param {string} [dayOfWeek]
 * @param {string} [itemName]
 * @returns {number} Count of cancelled orders
 */
function cancelGroupOrders(groupId, date, dayOfWeek, itemName) {
  var count = 0;
  if (!isGasRuntime()) {
    _mockStore.Orders.forEach(function (o) {
      if (o.status !== 'ACTIVE') return;
      if (groupId && o.groupId !== groupId) return;
      if (!_matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek)) return;
      if (itemName && o.itemName.indexOf(itemName) === -1) return;

      o.status = 'CANCELLED';
      count++;
    });
    return count;
  }

  var ss = getSpreadsheet();
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return 0;

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return 0;
  var colMap = _getOrderColumnIndexes(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId]);
    if (groupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDayOfWeek = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDayOfWeek, date, dayOfWeek)) continue;

    var rItem = String(r[colMap.itemName]);
    if (!itemName || rItem.indexOf(itemName) !== -1) {
      sheet.getRange(i + 1, colMap.status + 1).setValue('CANCELLED');
      count++;
    }
  }
  return count;
}

/**
 * Find user info in a group by matching query to userId, userName, or userNickname
 * @param {string} groupId
 * @param {string} query
 * @returns {{ userId: string, userName: string, userNickname: string } | null}
 */
function findUserInGroup(groupId, query) {
  if (!query) return null;
  var q = String(query).replace(/^@/, '').trim().toLowerCase();
  if (!q) return null;

  var orders = getGroupOrders(groupId, null, null);
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var uid = String(o.userId || '').toLowerCase();
    var uname = String(o.userName || '').toLowerCase();
    var unick = String(o.userNickname || '').toLowerCase();
    if (uid === q || uname === q || unick === q) {
      return {
        userId: o.userId,
        userName: o.userName,
        userNickname: o.userNickname || o.userName
      };
    }
  }
  return null;
}

/**
 * Get all active orders for a group on a date or dayOfWeek
 */
function getGroupOrders(groupId, date, dayOfWeek) {
  if (!isGasRuntime()) {
    return _mockStore.Orders.filter(function (o) {
      var matchGroup = (!groupId || o.groupId === groupId);
      return matchGroup && _matchOrderTiming(o.date, o.dayOfWeek, date, dayOfWeek) && o.status === 'ACTIVE';
    });
  }

  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var colMap = _getOrderColumnIndexes(rows[0]);
  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rStatus = String(r[colMap.status]);
    if (rStatus !== 'ACTIVE') continue;

    var rGroupId = String(r[colMap.groupId] || '').trim();
    if (groupId && rGroupId && rGroupId !== groupId) continue;

    var rDate = _formatDateValue(r[colMap.date]);
    var rDay = colMap.dayOfWeek !== -1 ? String(r[colMap.dayOfWeek] || '').trim() : '';
    var rChildName = colMap.childName !== -1 ? String(r[colMap.childName] || '').trim() : '';

    if (!_matchOrderTiming(rDate, rDay, date, dayOfWeek)) continue;

    orders.push({
      orderId: r[colMap.orderId],
      timestamp: r[colMap.timestamp],
      date: rDate,
      dayOfWeek: rDay,
      groupId: rGroupId,
      userId: r[colMap.userId],
      userName: r[colMap.userName],
      userNickname: colMap.userNickname !== -1 ? r[colMap.userNickname] : (r[colMap.userName] || ''),
      childName: rChildName,
      itemName: r[colMap.itemName],
      quantity: Number(r[colMap.quantity]),
      price: Number(r[colMap.price]),
      subtotal: Number(r[colMap.subtotal]),
      status: rStatus,
      paid: r[colMap.paid]
    });
  }
  return orders;
}

/**
 * Calculate single-day summary
 */
function getOrderSummary(groupId, date, dayOfWeek) {
  var orders = getGroupOrders(groupId, date, dayOfWeek);
  if (orders.length === 0 && groupId) {
    var allOrders = getGroupOrders('', date, dayOfWeek);
    if (allOrders.length > 0) {
      orders = allOrders;
    }
  }
  var itemMap = {};
  var userMap = {};
  var totalQuantity = 0;
  var totalAmount = 0;

  orders.forEach(function (o) {
    var uName = o.userNickname || o.userName || '成員';
    var childTag = o.childName ? '[' + o.childName + ']' : '';
    var buyerEntry = uName + childTag + (o.quantity > 1 ? 'x' + o.quantity : '');

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
    itemMap[o.itemName].buyers.push(buyerEntry);

    if (!userMap[uName]) {
      userMap[uName] = {
        userName: uName,
        items: [],
        total: 0
      };
    }
    var userItemEntry = (o.childName ? o.childName + ': ' : '') + o.itemName + 'x' + o.quantity;
    userMap[uName].items.push(userItemEntry);
    userMap[uName].total += o.subtotal;

    totalQuantity += o.quantity;
    totalAmount += o.subtotal;
  });

  var itemsList = Object.keys(itemMap).map(function (k) { return itemMap[k]; });
  var usersList = Object.keys(userMap).map(function (k) { return userMap[k]; });

  return {
    date: date,
    dayOfWeek: dayOfWeek,
    totalQuantity: totalQuantity,
    totalAmount: totalAmount,
    items: itemsList,
    users: usersList
  };
}

/**
 * Calculate full weekly summary (Mon to Fri batch)
 */
function getWeeklyOrderSummary(groupId) {
  var schedule = getWeeklySchedule();
  var days = ['週一', '週二', '週三', '週四', '週五'];
  var daySummaries = [];
  var grandTotalAmount = 0;
  var grandTotalQuantity = 0;
  var userWeeklyMap = {};

  days.forEach(function (day) {
    var sched = getScheduleByDay(day) || { restaurantName: day + '店家' };
    var dayOrders = getGroupOrders(groupId, null, day);
    if (dayOrders.length === 0 && groupId) {
      var allDayOrders = getGroupOrders('', null, day);
      if (allDayOrders.length > 0) {
        dayOrders = allDayOrders;
      }
    }
    var itemMap = {};
    var dayTotalQty = 0;
    var dayTotalAmt = 0;

    dayOrders.forEach(function (o) {
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
      var childTag = o.childName ? '[' + o.childName + ']' : '';
      itemMap[o.itemName].buyers.push((o.userNickname || o.userName) + childTag + (o.quantity > 1 ? 'x' + o.quantity : ''));

      dayTotalQty += o.quantity;
      dayTotalAmt += o.subtotal;

      // User weekly aggregation
      if (!userWeeklyMap[o.userName]) {
        userWeeklyMap[o.userName] = {
          userName: o.userName,
          days: {},
          total: 0
        };
      }
      if (!userWeeklyMap[o.userName].days[day]) {
        userWeeklyMap[o.userName].days[day] = [];
      }
      var userItemLabel = (o.childName ? o.childName + ': ' : '') + o.itemName + 'x' + o.quantity;
      userWeeklyMap[o.userName].days[day].push(userItemLabel);
      userWeeklyMap[o.userName].total += o.subtotal;
    });

    var items = Object.keys(itemMap).map(function (k) { return itemMap[k]; });

    daySummaries.push({
      dayOfWeek: day,
      restaurantName: sched.restaurantName,
      cutoffTime: sched.cutoffTime,
      totalQuantity: dayTotalQty,
      totalAmount: dayTotalAmt,
      items: items
    });

    grandTotalQuantity += dayTotalQty;
    grandTotalAmount += dayTotalAmt;
  });

  var usersList = Object.keys(userWeeklyMap).map(function (u) {
    return userWeeklyMap[u];
  });

  return {
    daySummaries: daySummaries,
    grandTotalQuantity: grandTotalQuantity,
    grandTotalAmount: grandTotalAmount,
    users: usersList
  };
}

/**
 * One-click migration: Migrate all existing unhashed LINE User IDs across Orders, Children, and Config to HASHED_ID format.
 * Safe, idempotent, batch-updates Google Sheets, and updates USER_IDENTIFIER_MODE to 'HASHED_ID'.
 * @returns {{ success: boolean, ordersMigrated: number, childrenMigrated: number, organizerMigrated: boolean, message: string }}
 */
function migrateToHashedUserIds() {
  var ordersMigrated = 0;
  var childrenMigrated = 0;
  var organizerMigrated = false;

  // 1. Mock / Node.js runtime
  if (!isGasRuntime()) {
    if (_mockStore.Orders && _mockStore.Orders.length > 0) {
      _mockStore.Orders.forEach(function (o) {
        var u = String(o.userId || '').trim();
        if (u && u !== 'anonymous' && u.indexOf('usr_') !== 0) {
          o.userId = hashUserId(u);
          ordersMigrated++;
        }
      });
    }

    if (_mockStore.Children && _mockStore.Children.length > 0) {
      _mockStore.Children.forEach(function (c) {
        var u = String(c.userId || '').trim();
        if (u && u.indexOf('usr_') !== 0) {
          c.userId = hashUserId(u);
          childrenMigrated++;
        }
      });
    }

    if (_mockStore.Config) {
      var orgId = String(_mockStore.Config['ORGANIZER_ID'] || '').trim();
      if (orgId && orgId.indexOf('usr_') !== 0) {
        _mockStore.Config['ORGANIZER_ID'] = hashUserId(orgId);
        organizerMigrated = true;
      }
      _mockStore.Config['USER_IDENTIFIER_MODE'] = 'HASHED_ID';
    }

    var mockMsg = '🔒 歷史資料去識別化遷移完成！\n' +
                  '• 訂單記錄已轉換: ' + ordersMigrated + ' 筆\n' +
                  '• 小孩名冊已轉換: ' + childrenMigrated + ' 筆\n' +
                  '• 開單人 ID: ' + (organizerMigrated ? '已更新為雜湊 ID' : '無須更動') + '\n' +
                  '• USER_IDENTIFIER_MODE 已設定為 HASHED_ID';

    return {
      success: true,
      ordersMigrated: ordersMigrated,
      childrenMigrated: childrenMigrated,
      organizerMigrated: organizerMigrated,
      message: mockMsg
    };
  }

  // 2. Google Apps Script Runtime
  var ss = getSpreadsheet();
  if (!ss) {
    return { success: false, ordersMigrated: 0, childrenMigrated: 0, organizerMigrated: false, message: '找不到試算表！' };
  }

  // A. Migrate Orders sheet
  try {
    var orderSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ORDERS);
    if (orderSheet && orderSheet.getLastRow() > 1) {
      var oRange = orderSheet.getDataRange();
      var oData = oRange.getValues();
      var colMap = _getOrderColumnIndexes(oData[0]);
      if (colMap.userId !== -1) {
        var oModified = false;
        for (var r = 1; r < oData.length; r++) {
          var rUid = String(oData[r][colMap.userId] || '').trim();
          if (rUid && rUid !== 'anonymous' && rUid.indexOf('usr_') !== 0) {
            oData[r][colMap.userId] = hashUserId(rUid);
            ordersMigrated++;
            oModified = true;
          }
        }
        if (oModified) {
          oRange.setValues(oData);
        }
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.error('Error migrating Orders:', e);
  }

  // B. Migrate Children sheet
  try {
    var childSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
    if (childSheet && childSheet.getLastRow() > 1) {
      var cRange = childSheet.getDataRange();
      var cData = cRange.getValues();
      var cModified = false;
      for (var cr = 1; cr < cData.length; cr++) {
        var cUid = String(cData[cr][0] || '').trim();
        if (cUid && cUid.indexOf('usr_') !== 0) {
          cData[cr][0] = hashUserId(cUid);
          childrenMigrated++;
          cModified = true;
        }
      }
      if (cModified) {
        cRange.setValues(cData);
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.error('Error migrating Children:', e);
  }

  // C. Migrate Config sheet
  try {
    var cfgSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONFIG);
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      var cfgRange = cfgSheet.getDataRange();
      var cfgData = cfgRange.getValues();
      var cfgModified = false;
      for (var k = 1; k < cfgData.length; k++) {
        var key = String(cfgData[k][0] || '').trim();
        if (key === 'ORGANIZER_ID') {
          var curOrg = String(cfgData[k][1] || '').trim();
          if (curOrg && curOrg.indexOf('usr_') !== 0) {
            cfgData[k][1] = hashUserId(curOrg);
            organizerMigrated = true;
            cfgModified = true;
          }
        } else if (key === 'USER_IDENTIFIER_MODE') {
          if (String(cfgData[k][1] || '').trim() !== 'HASHED_ID') {
            cfgData[k][1] = 'HASHED_ID';
            cfgModified = true;
          }
        }
      }
      if (cfgModified) {
        cfgRange.setValues(cfgData);
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.error('Error migrating Config:', e);
  }

  var msg = '🔒 歷史資料去識別化遷移完成！\n' +
            '• 訂單記錄已轉換: ' + ordersMigrated + ' 筆\n' +
            '• 小孩名冊已轉換: ' + childrenMigrated + ' 筆\n' +
            '• 開單人 ID: ' + (organizerMigrated ? '已更新為雜湊 ID' : '無須更動') + '\n' +
            '• USER_IDENTIFIER_MODE 已設定為 HASHED_ID';

  try {
    ss.toast('已成功將 ' + ordersMigrated + ' 筆歷史訂單去識別化！', '遷移完成', 5);
    var ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert('🎉 歷史資料去識別化遷移成功', msg, ui.ButtonSet.OK);
    }
  } catch (e) {}

  return {
    success: true,
    ordersMigrated: ordersMigrated,
    childrenMigrated: childrenMigrated,
    organizerMigrated: organizerMigrated,
    message: msg
  };
}

/**
 * Google Sheets UI onOpen menu builder
 */
function onOpenSpreadsheet() {
  if (!isGasRuntime()) return;
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🍱 便當訂餐管理')
      .addItem('📅 檢查/初始化試算表結構', 'initSheets')
      .addItem('🔒 一鍵升級歷史 ID 為去識別化雜湊', 'migrateToHashedUserIds')
      .addItem('📊 重新產生今日統計表', 'refreshDailySummary')
      .addItem('📈 重新產生本週梯次統計表', 'refreshWeeklySummary')
      .addSeparator()
      .addItem('🕒 檢查 Apps Script 時區與系統時間', 'checkTimeZoneAndCurrentTime')
      .addSeparator()
      .addItem('🍔 從 Uber Eats 網址匯入菜單', 'showUberEatsImportDialog')
      .addItem('📑 從自訂餐廳匯入菜單', 'showCustomRestaurantImportDialog')
      .addSeparator()
      .addItem('🔍 診斷測試：Uber Eats 菜單抓取', 'testUberEatsImport')
      .addItem('🔍 診斷測試：LINE 連線狀態', 'testLineConnection')
      .addItem('🔍 診斷測試：幫助卡片訊息', 'testHelpMessage')
      .addToUi();
  } catch (e) {}
}

/**
 * Diagnostic tool to check Google Apps Script project timezone, spreadsheet timezone, and current time
 */
function checkTimeZoneAndCurrentTime() {
  var ssTz = 'N/A';
  if (isGasRuntime()) {
    try {
      var ss = getSpreadsheet();
      if (ss && typeof ss.getSpreadsheetTimeZone === 'function') {
        ssTz = ss.getSpreadsheetTimeZone();
      }
    } catch (e) {}
  } else if (typeof globalThis !== 'undefined' && globalThis._mockSpreadsheetTimeZone) {
    ssTz = globalThis._mockSpreadsheetTimeZone;
  }

  var scriptTz = 'N/A';
  if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
    try {
      scriptTz = Session.getScriptTimeZone();
    } catch (e) {}
  } else if (typeof globalThis !== 'undefined' && globalThis._mockScriptTimeZone) {
    scriptTz = globalThis._mockScriptTimeZone;
  }

  // Determine effective timezone directly from spreadsheet setting, fallback to script timezone
  var effectiveTz = getSpreadsheetTimeZone();

  var now = (typeof globalThis !== 'undefined' && globalThis._mockCurrentDate) || new Date();
  var serverRawTime = now.toString();
  var isoTime = now.toISOString ? now.toISOString() : String(now);
  var localTime = 'N/A';
  var dateStr = 'N/A';
  var dayOfWeekStr = 'N/A';

  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      localTime = Utilities.formatDate(now, effectiveTz, 'yyyy-MM-dd HH:mm:ss');
      dateStr = Utilities.formatDate(now, effectiveTz, 'yyyy-MM-dd');
      var u = parseInt(Utilities.formatDate(now, effectiveTz, 'u'), 10);
      var dayMapU = { 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日' };
      dayOfWeekStr = dayMapU[u] || '週一';
    } catch (e) {}
  } else {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        var dParts = new Intl.DateTimeFormat('en-CA', { timeZone: effectiveTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        var tParts = new Intl.DateTimeFormat('en-GB', { timeZone: effectiveTz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        dateStr = dParts;
        localTime = dParts + ' ' + tParts;
        dayOfWeekStr = new Intl.DateTimeFormat('zh-TW', { timeZone: effectiveTz, weekday: 'short' }).format(now);
      }
    } catch (e) {}
  }

  if (dateStr === 'N/A') {
    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    var twDate = new Date(utc + (3600000 * 8));
    var y = twDate.getFullYear();
    var m = ('0' + (twDate.getMonth() + 1)).slice(-2);
    var d = ('0' + twDate.getDate()).slice(-2);
    var hh = ('0' + twDate.getHours()).slice(-2);
    var mm = ('0' + twDate.getMinutes()).slice(-2);
    var ss = ('0' + twDate.getSeconds()).slice(-2);
    dateStr = y + '-' + m + '-' + d;
    localTime = dateStr + ' ' + hh + ':' + mm + ':' + ss;
    var dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    dayOfWeekStr = dayMap[twDate.getDay()];
  }

  var tzStatusNote = '';
  if (ssTz !== 'N/A' && scriptTz !== 'N/A' && ssTz !== scriptTz) {
    tzStatusNote = '⚠️ 提醒：試算表設定時區 (' + ssTz + ') 與專案資訊清單時區 (' + scriptTz + ') 不一致。系統已優先採用試算表設定時區 (' + effectiveTz + ')，建議前往「檔案 -> 設定」或「appsscript.json」將兩者同步！\n';
  } else if (ssTz !== 'N/A') {
    tzStatusNote = '✅ 系統已成功讀取試算表設定時區 (' + effectiveTz + ')！\n';
  } else {
    tzStatusNote = 'ℹ️ 運行採用時區 (' + effectiveTz + ')。\n';
  }

  var msg = '【系統時區與時間診斷資訊】\n' +
            '----------------------------------------\n' +
            '• 試算表設定時區 (Spreadsheet TimeZone): ' + ssTz + '\n' +
            '• 專案腳本時區 (Script TimeZone): ' + scriptTz + '\n' +
            '• 系統運行採用時區 (Effective TimeZone): ' + effectiveTz + '\n' +
            '• 當前時區時間 (Local Time): ' + localTime + '\n' +
            '• 當前判定日期: ' + dateStr + '\n' +
            '• 當前判定星期: ' + dayOfWeekStr + '\n' +
            '• 伺服器原始時間 (Raw Date): ' + serverRawTime + '\n' +
            '• ISO UTC 時間: ' + isoTime + '\n' +
            '----------------------------------------\n' +
            tzStatusNote;

  if (typeof Logger !== 'undefined') {
    Logger.log(msg);
  }
  if (isGasRuntime()) {
    try {
      SpreadsheetApp.getUi().alert('🕒 時區與時間診斷', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}
  }

  return {
    spreadsheetTimeZone: ssTz,
    scriptTimeZone: scriptTz,
    effectiveTimeZone: effectiveTz,
    localTime: localTime,
    taipeiTime: localTime,
    dateStr: dateStr,
    dayOfWeek: dayOfWeekStr,
    serverRawTime: serverRawTime,
    isoTime: isoTime,
    formattedMessage: msg
  };
}

/**
 * Log diagnostic events directly into a 'Logs' sheet tab in Google Sheets
 */
function logToSheet(type, message, detail) {
  var detailStr = '';
  if (typeof detail === 'object') {
    try { detailStr = JSON.stringify(detail); } catch (e) { detailStr = String(detail); }
  } else if (detail !== undefined && detail !== null) {
    detailStr = String(detail);
  }
  var safeType = _sanitizeSheetCell(type || 'INFO');
  var safeMessage = _sanitizeSheetCell(message || '');
  var safeDetail = _sanitizeSheetCell(detailStr);

  if (!isGasRuntime()) {
    if (!_mockStore.Logs) _mockStore.Logs = [];
    _mockStore.Logs.push([new Date().toISOString(), safeType, safeMessage, safeDetail]);
    return;
  }
  try {
    var ss = getSpreadsheet();
    if (!ss) return;
    var logSheet = ss.getSheetByName('Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs');
      logSheet.appendRow(['Timestamp', 'Type', 'Message', 'Detail']);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EFEFEF');
    }
    logSheet.appendRow([new Date().toISOString(), safeType, safeMessage, safeDetail]);
  } catch (e) {}
}

/**
 * Get children for a specific user
 * @param {string} userId
 * @returns {Array<string>} Array of child names (e.g. ['大寶', '二寶'])
 */
function getChildren(userId, userName, userNickname) {
  if (!userId) return [];
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    var kids = [];
    _mockStore.Children.forEach(function (c) {
      if ((c.userId === userId || c.userId === effUserId) && c.childName && kids.indexOf(c.childName) === -1) {
        kids.push(c.childName);
      }
    });
    return kids;
  }
  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var kids = [];
  for (var i = 1; i < rows.length; i++) {
    var rUid = String(rows[i][0] || '').trim();
    var rChild = String(rows[i][3] || '').trim();
    if ((rUid === userId || rUid === effUserId) && rChild && kids.indexOf(rChild) === -1) {
      kids.push(rChild);
    }
  }
  return kids;
}

/**
 * Get detailed children profiles for a specific user
 * @param {string} userId
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {Array<{ userId: string, userName: string, userNickname: string, childName: string, note: string, createdAt: string, updatedAt: string }>}
 */
function getChildrenProfiles(userId, userName, userNickname) {
  if (!userId) return [];
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    return _mockStore.Children.filter(function (c) { return c.userId === userId || c.userId === effUserId; });
  }
  var ss = getSpreadsheet();
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) return [];
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var rUid = String(rows[i][0] || '').trim();
    if (rUid === userId || rUid === effUserId) {
      list.push({
        userId: rUid,
        userName: String(rows[i][1] || ''),
        userNickname: String(rows[i][2] || ''),
        childName: String(rows[i][3] || ''),
        note: String(rows[i][4] || ''),
        createdAt: String(rows[i][5] || ''),
        updatedAt: String(rows[i][6] || '')
      });
    }
  }
  return list;
}

/**
 * Save or update a child profile
 * @param {string} userId
 * @param {string} userName
 * @param {string} userNickname
 * @param {string} childName
 * @param {string} [note]
 * @returns {boolean}
 */
function saveChild(userId, userName, userNickname, childName, note) {
  if (!userId || !childName) return false;
  var cName = childName.trim();
  if (!cName || cName === '本人' || cName === '自己') return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var nowStr = new Date().toISOString();

  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    var existing = null;
    for (var i = 0; i < _mockStore.Children.length; i++) {
      if ((_mockStore.Children[i].userId === userId || _mockStore.Children[i].userId === effUserId) && _mockStore.Children[i].childName === cName) {
        existing = _mockStore.Children[i];
        break;
      }
    }
    if (existing) {
      if (note !== undefined && note !== null && note !== '') existing.note = _sanitizeSheetCell(note);
      existing.updatedAt = nowStr;
    } else {
      _mockStore.Children.push({
        userId: effUserId,
        userName: _sanitizeSheetCell(userName || ''),
        userNickname: _sanitizeSheetCell(userNickname || userName || ''),
        childName: _sanitizeSheetCell(cName),
        note: _sanitizeSheetCell(note || ''),
        createdAt: nowStr,
        updatedAt: nowStr
      });
    }
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
    if (!sheet) return false;
  }

  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var rUid = String(rows[r][0]).trim();
    if ((rUid === userId || rUid === effUserId) && String(rows[r][3]).trim() === cName) {
      if (note !== undefined && note !== null && note !== '') {
        sheet.getRange(r + 1, 5).setValue(_sanitizeSheetCell(note));
      }
      sheet.getRange(r + 1, 7).setValue(nowStr);
      return true;
    }
  }

  sheet.appendRow([
    effUserId,
    _sanitizeSheetCell(userName || ''),
    _sanitizeSheetCell(userNickname || userName || ''),
    _sanitizeSheetCell(cName),
    _sanitizeSheetCell(note || ''),
    nowStr,
    nowStr
  ]);
  return true;
}

/**
 * Set batch children for a user (replacing current list)
 * @param {string} userId
 * @param {string} userName
 * @param {string} userNickname
 * @param {Array<string>} childNames
 * @returns {boolean}
 */
function setChildren(userId, userName, userNickname, childNames) {
  if (!userId) return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var names = (childNames || []).map(function (n) { return String(n).trim(); }).filter(function (n) { return n && n !== '本人' && n !== '自己'; });

  if (!isGasRuntime()) {
    if (!_mockStore.Children) _mockStore.Children = [];
    _mockStore.Children = _mockStore.Children.filter(function (c) { return c.userId !== userId && c.userId !== effUserId; });
    var nowStr = new Date().toISOString();
    names.forEach(function (n) {
      _mockStore.Children.push({
        userId: effUserId,
        userName: _sanitizeSheetCell(userName || ''),
        userNickname: _sanitizeSheetCell(userNickname || userName || ''),
        childName: _sanitizeSheetCell(n),
        note: '',
        createdAt: nowStr,
        updatedAt: nowStr
      });
    });
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
    if (!sheet) return false;
  }

  var rows = sheet.getDataRange().getValues();
  for (var r = rows.length - 1; r >= 1; r--) {
    var rUid = String(rows[r][0]).trim();
    if (rUid === userId || rUid === effUserId) {
      sheet.deleteRow(r + 1);
    }
  }

  var nowTime = new Date().toISOString();
  names.forEach(function (n) {
    sheet.appendRow([
      effUserId,
      _sanitizeSheetCell(userName || ''),
      _sanitizeSheetCell(userNickname || userName || ''),
      _sanitizeSheetCell(n),
      '',
      nowTime,
      nowTime
    ]);
  });
  return true;
}

/**
 * Delete a specific child profile
 * @param {string} userId
 * @param {string} childName
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {boolean}
 */
function deleteChild(userId, childName, userName, userNickname) {
  if (!userId || !childName) return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var cName = childName.trim();

  if (!isGasRuntime()) {
    if (!_mockStore.Children) return false;
    var lenBefore = _mockStore.Children.length;
    _mockStore.Children = _mockStore.Children.filter(function (c) {
      return !((c.userId === userId || c.userId === effUserId) && c.childName === cName);
    });
    return _mockStore.Children.length < lenBefore;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHILDREN);
  if (!sheet) return false;

  var rows = sheet.getDataRange().getValues();
  var deleted = false;
  for (var r = rows.length - 1; r >= 1; r--) {
    var rUid = String(rows[r][0]).trim();
    if ((rUid === userId || rUid === effUserId) && String(rows[r][3]).trim() === cName) {
      sheet.deleteRow(r + 1);
      deleted = true;
    }
  }
  return deleted;
}

/**
 * Get user locale preference
 * @param {string} userId
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {string|null}
 */
function getUserLocalePreference(userId, userName, userNickname) {
  if (!userId) return null;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);

  if (!isGasRuntime()) {
    if (!_mockStore.UserPreferences) _mockStore.UserPreferences = [];
    for (var i = 0; i < _mockStore.UserPreferences.length; i++) {
      var item = _mockStore.UserPreferences[i];
      if (item.userId === userId || item.userId === effUserId) {
        return item.locale || null;
      }
    }
    return null;
  }

  var ss = getSpreadsheet();
  if (!ss) return null;
  var tabName = (CONFIG && CONFIG.SHEET_NAMES && CONFIG.SHEET_NAMES.USER_PREFERENCES) || 'UserPreferences';
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return null;

  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var rUid = String(rows[r][0] || '').trim();
    if (rUid === userId || rUid === effUserId) {
      var loc = String(rows[r][1] || '').trim();
      return loc || null;
    }
  }
  return null;
}

/**
 * Set user locale preference
 * @param {string} userId
 * @param {string} locale
 * @param {string} [userName]
 * @param {string} [userNickname]
 * @returns {boolean}
 */
function setUserLocalePreference(userId, locale, userName, userNickname) {
  if (!userId || !locale) return false;
  var effUserId = getEffectiveUserId(userId, userName, userNickname);
  var loc = String(locale).trim();
  var nowStr = new Date().toISOString();

  if (!isGasRuntime()) {
    if (!_mockStore.UserPreferences) _mockStore.UserPreferences = [];
    var found = false;
    for (var i = 0; i < _mockStore.UserPreferences.length; i++) {
      if (_mockStore.UserPreferences[i].userId === userId || _mockStore.UserPreferences[i].userId === effUserId) {
        _mockStore.UserPreferences[i].locale = loc;
        _mockStore.UserPreferences[i].updatedAt = nowStr;
        found = true;
        break;
      }
    }
    if (!found) {
      _mockStore.UserPreferences.push({
        userId: effUserId,
        locale: loc,
        updatedAt: nowStr
      });
    }
    return true;
  }

  var ss = getSpreadsheet();
  if (!ss) return false;
  var tabName = (CONFIG && CONFIG.SHEET_NAMES && CONFIG.SHEET_NAMES.USER_PREFERENCES) || 'UserPreferences';
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName(tabName);
    if (!sheet) return false;
  }

  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var rUid = String(rows[r][0] || '').trim();
    if (rUid === userId || rUid === effUserId) {
      sheet.getRange(r + 1, 2).setValue(loc);
      sheet.getRange(r + 1, 3).setValue(nowStr);
      return true;
    }
  }

  sheet.appendRow([effUserId, loc, nowStr]);
  return true;
}

// Global export helper
(function (global) {
  var g = (typeof window   !== 'undefined') ? window
        : (typeof globalThis !== 'undefined') ? globalThis
        : (typeof global   !== 'undefined') ? global
        : (typeof self     !== 'undefined') ? self
        : this;

  g.isGasRuntime = isGasRuntime;
  g.getSpreadsheet = getSpreadsheet;
  g.getSpreadsheetTimeZone = getSpreadsheetTimeZone;
  g.initSheets = initSheets;
  g.getConfigValue = getConfigValue;
  g.setConfigValue = setConfigValue;
  g.getWeeklySchedule = getWeeklySchedule;
  g.getScheduleByDay = getScheduleByDay;
  g.setWeeklyScheduleDay = setWeeklyScheduleDay;
  g.getMenuItems = getMenuItems;
  g.saveMenuItems = saveMenuItems;
  g.addOrder = addOrder;
  g.getUserOrders = getUserOrders;
  g.cancelOrder = cancelOrder;
  g.cancelGroupOrders = cancelGroupOrders;
  g.getGroupOrders = getGroupOrders;
  g.getOrderSummary = getOrderSummary;
  g.getWeeklyOrderSummary = getWeeklyOrderSummary;
  g.getPaymentConfig = getPaymentConfig;
  g.normalizeImageUrl = normalizeImageUrl;
  g.onOpenSpreadsheet = onOpenSpreadsheet;
  g.migrateToHashedUserIds = migrateToHashedUserIds;
  g.checkTimeZoneAndCurrentTime = checkTimeZoneAndCurrentTime;
  g.findUserInGroup = findUserInGroup;
  g.logToSheet = logToSheet;
  g._getOrderColumnIndexes = _getOrderColumnIndexes;
  g._matchOrderTiming = _matchOrderTiming;
  g.normalizeDayOfWeek = normalizeDayOfWeek;
  g.SYSTEM_TAB_NAMES = SYSTEM_TAB_NAMES;
  g.isSystemTab = isSystemTab;
  g.readCustomRestaurantMenu = readCustomRestaurantMenu;
  g.importCustomRestaurantMenu = importCustomRestaurantMenu;
  g.getChildren = getChildren;
  g.getChildrenProfiles = getChildrenProfiles;
  g.saveChild = saveChild;
  g.setChildren = setChildren;
  g.deleteChild = deleteChild;
  g._sanitizeSheetCell = _sanitizeSheetCell;
  g.hashUserId = hashUserId;
  g.getEffectiveUserId = getEffectiveUserId;
  g.getUserLocalePreference = getUserLocalePreference;
  g.setUserLocalePreference = setUserLocalePreference;
  g._mockStore = _mockStore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isGasRuntime: isGasRuntime,
      getSpreadsheet: getSpreadsheet,
      getSpreadsheetTimeZone: getSpreadsheetTimeZone,
      initSheets: initSheets,
      getConfigValue: getConfigValue,
      setConfigValue: setConfigValue,
      getWeeklySchedule: getWeeklySchedule,
      getScheduleByDay: getScheduleByDay,
      setWeeklyScheduleDay: setWeeklyScheduleDay,
      getMenuItems: getMenuItems,
      saveMenuItems: saveMenuItems,
      SYSTEM_TAB_NAMES: SYSTEM_TAB_NAMES,
      isSystemTab: isSystemTab,
      readCustomRestaurantMenu: readCustomRestaurantMenu,
      importCustomRestaurantMenu: importCustomRestaurantMenu,
      addOrder: addOrder,
      getUserOrders: getUserOrders,
      cancelOrder: cancelOrder,
      cancelGroupOrders: cancelGroupOrders,
      findUserInGroup: findUserInGroup,
      getGroupOrders: getGroupOrders,
      getOrderSummary: getOrderSummary,
      getWeeklyOrderSummary: getWeeklyOrderSummary,
      getPaymentConfig: getPaymentConfig,
      normalizeImageUrl: normalizeImageUrl,
      onOpenSpreadsheet: onOpenSpreadsheet,
      migrateToHashedUserIds: migrateToHashedUserIds,
      checkTimeZoneAndCurrentTime: checkTimeZoneAndCurrentTime,
      logToSheet: logToSheet,
      _getOrderColumnIndexes: _getOrderColumnIndexes,
      _matchOrderTiming: _matchOrderTiming,
      normalizeDayOfWeek: normalizeDayOfWeek,
      getChildren: getChildren,
      getChildrenProfiles: getChildrenProfiles,
      saveChild: saveChild,
      setChildren: setChildren,
      deleteChild: deleteChild,
      _sanitizeSheetCell: _sanitizeSheetCell,
      hashUserId: hashUserId,
      getEffectiveUserId: getEffectiveUserId,
      getUserLocalePreference: getUserLocalePreference,
      setUserLocalePreference: setUserLocalePreference,
      _mockStore: _mockStore
    };
  }
})(this);


/* =========================================================
 * File: UberEatsService.js
 * ========================================================= */

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


/* =========================================================
 * File: FlexMessage.js
 * ========================================================= */

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




/* =========================================================
 * File: OrderService.js
 * ========================================================= */

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


/* =========================================================
 * File: Code.js
 * ========================================================= */

/**
 * Code.js - Main Webhook Entrypoint & Admin Spreadsheet UI for Google Apps Script (GAS)
 * Handles LINE Webhook HTTP POST/GET requests and Google Sheets menu triggers.
 */

/**
 * Trigger: On Google Spreadsheet Open
 * Automatically creates custom menu bar for the administrator.
 */
function onOpen(e) {
  if (typeof onOpenSpreadsheet === 'function') {
    onOpenSpreadsheet();
  }
}

/**
 * Admin Action: Refresh Daily Summary
 */
function refreshDailySummary() {
  if (typeof isGasRuntime === 'function' && !isGasRuntime()) return;
  var todayDate = getTodayDateString ? getTodayDateString() : '';
  var todayDay = getTodayDayOfWeek ? getTodayDayOfWeek() : '';
  var summary = getOrderSummary('', todayDate, todayDay);
  var ss = getSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EFEFEF');
      var daySched = getScheduleByDay ? getScheduleByDay(todayDay) : null;
      var rest = (daySched && daySched.restaurantName) ? daySched.restaurantName : getConfigValue('RESTAURANT_NAME', '今日便當');
      summary.items.forEach(function (it) {
        sheet.appendRow([todayDay || '今日', rest, it.itemName, it.quantity, it.price, it.subtotal, it.buyers.join(', ')]);
      });
      sheet.appendRow(['【今日總計】', '', '', summary.totalQuantity, '', summary.totalAmount, '']);
      ss.toast('今日訂單統計表已更新完畢！', '成功', 3);
    }
  }
}

/**
 * Admin Action: Refresh Weekly Batch Summary
 */
function refreshWeeklySummary() {
  if (typeof isGasRuntime === 'function' && !isGasRuntime()) return;
  var weeklySummary = getWeeklyOrderSummary('');
  var ss = getSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(['DayOfWeek', 'RestaurantName', 'ItemName', 'Quantity', 'Price', 'Subtotal', 'Buyers']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EFEFEF');

      weeklySummary.daySummaries.forEach(function (ds) {
        if (ds.items && ds.items.length > 0) {
          ds.items.forEach(function (it) {
            sheet.appendRow([ds.dayOfWeek, ds.restaurantName, it.itemName, it.quantity, it.price, it.subtotal, it.buyers.join(', ')]);
          });
          sheet.appendRow([ds.dayOfWeek + ' 小計', ds.restaurantName, '', ds.totalQuantity, '', ds.totalAmount, '']);
        }
      });

      sheet.appendRow(['═════════', '═════════', '═════════', '═════', '═════', '═════', '═════════']);
      sheet.appendRow(['【本週梯次總計】', '', '', weeklySummary.grandTotalQuantity, '', weeklySummary.grandTotalAmount, '']);

      // Member payment list
      sheet.appendRow(['']);
      sheet.appendRow(['【成員本週應收總額】', '姓名', '應付金額']);
      weeklySummary.users.forEach(function (u) {
        sheet.appendRow(['', u.userName, u.total]);
      });

      ss.toast('本週梯次統計表已更新完畢！', '成功', 3);
    }
  }
}

/**
 * Admin Action: Interactive Dialog to Import Menu from Uber Eats
 */
function showUberEatsImportDialog() {
  if (typeof SpreadsheetApp === 'undefined') return;
  var ui = SpreadsheetApp.getUi();

  var dayPrompt = ui.prompt('匯入 Uber Eats 菜單 (步驟 1/2)', '請輸入要排程的星期（例如：週一、週二、週三、週四、週五 或 ALL）：', ui.ButtonSet.OK_CANCEL);
  if (dayPrompt.getSelectedButton() !== ui.Button.OK) return;
  var dayOfWeek = dayPrompt.getResponseText().trim();
  if (!dayOfWeek) dayOfWeek = '週一';

  var urlPrompt = ui.prompt('匯入 Uber Eats 菜單 (步驟 2/2)', '請貼上 Uber Eats 店家網址：\n(例如：https://www.ubereats.com/tw/store/.../... )', ui.ButtonSet.OK_CANCEL);
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  var url = urlPrompt.getResponseText().trim();
  if (!url) {
    ui.alert('網址不得為空！');
    return;
  }

  try {
    ui.alert('⏳ 正在抓取 Uber Eats 菜單，請稍候約 3~5 秒...');
    var parsed = parseUberEatsUrl(url);
    if (!parsed) {
      ui.alert('❌ 網址解析失敗！請確認網址格式正確。\n例如：https://www.ubereats.com/tw/store/...');
      return;
    }
    var storeUuid = parsed.standardUuid || parsed.storeUuid;
    var storeName = parsed.storeName || 'UberEats外送';

    var storeData = fetchStoreMenu(storeUuid);
    // If returned promise (in async environment)
    if (storeData && typeof storeData.then === 'function') {
      storeData.then(function (data) {
        var items = extractMenuItems(data);
        if (!items || items.length === 0) {
          ui.alert('⚠️ 未能從 Uber Eats 取得任何餐點品項！\n可能原因：店家目前未營業、網址有誤或受到雲端連線限制。\n建議：您可在試算表的「菜單」分頁中手動貼上品項。');
          return;
        }
        saveMenuItems(dayOfWeek, storeName, items);
        setWeeklyScheduleDay(dayOfWeek, storeName, '10:30', url, '從 Uber Eats 匯入');
        ui.alert('✅ 匯入成功！\n店家：' + storeName + '\n已排入：' + dayOfWeek + '\n共抓取 ' + items.length + ' 道餐點！');
      });
    } else {
      var items = extractMenuItems(storeData);
      if (!items || items.length === 0) {
        ui.alert('⚠️ 未能從 Uber Eats 取得任何餐點品項！\n可能原因：店家目前未營業、網址有誤或受到雲端連線限制。\n建議：您可在試算表的「菜單」分頁中手動貼上品項。');
        return;
      }
      saveMenuItems(dayOfWeek, storeName, items);
      setWeeklyScheduleDay(dayOfWeek, storeName, '10:30', url, '從 Uber Eats 匯入');
      ui.alert('✅ 匯入成功！\n店家：' + storeName + '\n已排入：' + dayOfWeek + '\n共抓取 ' + items.length + ' 道餐點！');
    }
  } catch (err) {
    ui.alert('❌ 匯入發生錯誤：' + err.message);
  }
}

/**
 * Admin Action: Interactive Dialog to Import Menu from Custom Restaurant Sheet
 */
function showCustomRestaurantImportDialog() {
  if (typeof SpreadsheetApp === 'undefined') return;
  var ui = SpreadsheetApp.getUi();

  var dayPrompt = ui.prompt(
    '匯入自訂餐廳菜單 (步驟 1/2)',
    '請輸入要排程的星期（例如：週一、週二、週三、週四、週五 或 ALL）：',
    ui.ButtonSet.OK_CANCEL
  );
  if (dayPrompt.getSelectedButton() !== ui.Button.OK) return;
  var rawDay = dayPrompt.getResponseText().trim();
  var dayOfWeek = (typeof normalizeDayOfWeek === 'function' ? normalizeDayOfWeek(rawDay) : rawDay) || '週一';

  var namePrompt = ui.prompt(
    '匯入自訂餐廳菜單 (步驟 2/2)',
    '請輸入自訂餐廳名稱（必須與試算表工作表 Tab 名稱完全一致）：',
    ui.ButtonSet.OK_CANCEL
  );
  if (namePrompt.getSelectedButton() !== ui.Button.OK) return;
  var restaurantName = namePrompt.getResponseText().trim();
  if (!restaurantName) {
    ui.alert('⚠️ 餐廳名稱不得為空！');
    return;
  }

  // Exact match check
  var ss = typeof getSpreadsheet === 'function' ? getSpreadsheet() : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  if (typeof isSystemTab === 'function' && isSystemTab(restaurantName)) {
    ui.alert('⚠️ 匯入失敗\n「' + restaurantName + '」為系統專用功能工作表，不可作為自訂餐廳菜單！\n請選擇自訂餐廳工作表。');
    return;
  }

  var targetSheet = ss.getSheetByName(restaurantName);
  if (!targetSheet) {
    ui.alert('⚠️ 沒找到這間自訂餐廳菜單！\n\n找不到名為「' + restaurantName + '」的工作表，請確認工作表名稱完全一致（包含大小寫與空格）。');
    return;
  }

  try {
    var result = importCustomRestaurantMenu(dayOfWeek, restaurantName);
    if (!result || !result.success) {
      ui.alert('⚠️ 沒找到這間自訂餐廳菜單！\n\n' + ((result && result.message) || '請確認工作表名稱完全一致（包含大小寫與空格）。'));
      return;
    }
    ui.alert('✅ 匯入成功！\n餐廳：' + restaurantName + '\n已排入：' + result.dayOfWeek + '\n共匯入 ' + result.count + ' 道餐點至菜單 (Menu)！');
  } catch (err) {
    ui.alert('❌ 匯入發生錯誤：' + err.message);
  }
}

/**
 * HTTP GET Handler - Service Health Check & Information
 */
function doGet(e) {
  var status = {
    status: 'online',
    service: 'LINE Meal Ordering Bot',
    features: ['daily-ordering', 'weekly-batch-schedule', 'ubereats-menu-importer'],
    timestamp: new Date().toISOString(),
    isGas: typeof SpreadsheetApp !== 'undefined'
  };

  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(status))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return status;
}

/**
 * HTTP POST Handler - LINE Webhook Events
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _createResponse(200, { message: 'No post data' });
    }

    var bodyString = e.postData.contents;
    var signature = (e.parameter && e.parameter['X-Line-Signature']) ||
                    (e.headers && (e.headers['X-Line-Signature'] || e.headers['x-line-signature']));

    var channelSecret = getConfigProperty('CHANNEL_SECRET', '');
    var queryToken = (e.parameter && (e.parameter.token || e.parameter.secret)) || '';

    // 1. Webhook Security Verification
    // Path A: If query token is provided, verify against CHANNEL_SECRET
    if (channelSecret && queryToken) {
      if (queryToken !== channelSecret) {
        return _createResponse(403, { error: 'Invalid secret token' });
      }
    }
    // Path B: If X-Line-Signature is present (e.g. proxy or test environment), verify signature
    if (channelSecret && signature) {
      var isValid = validateSignature(bodyString, signature, channelSecret);
      if (!isValid) {
        return _createResponse(403, { error: 'Invalid signature' });
      }
    }

    var json = JSON.parse(bodyString);
    var events = json.events || [];

    // 2. LINE Developers Console "Verify" Probe Fast-Path
    // When LINE sends an empty event list ({"destination":"...","events":[]}) for webhook verification,
    // respond immediately (< 100ms) with HTTP 200 without running heavy sheet operations,
    // preventing the 1-second timeout in LINE Developers Console.
    if (!events || events.length === 0) {
      return _createResponse(200, { status: 'success', message: 'Webhook verified' });
    }

    // Ensure database sheets exist on first run
    initSheets();

    // Process all events
    for (var i = 0; i < events.length; i++) {
      var event = events[i];

      // 1. Text Message Event
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        var msgText = event.message.text;
        var srcId = (event.source && (event.source.groupId || event.source.roomId || event.source.userId)) || 'unknown';
        if (typeof console !== 'undefined') {
          console.log('📨 [收到 LINE 文字訊息] 來源: ' + srcId + '，內容: ' + msgText);
        }
        if (typeof logToSheet === 'function') {
          var safeSrcId = srcId;
          // If source is a direct 1-on-1 user, de-identify using getEffectiveUserId if available
          if (event.source && event.source.type === 'user' && typeof getEffectiveUserId === 'function') {
            safeSrcId = getEffectiveUserId(srcId);
          }
          logToSheet('MSG_RECV', msgText, safeSrcId);
        }
        var result = handleTextMessage(event);
        if (typeof console !== 'undefined') {
          console.log('📤 [處理結果]: ' + JSON.stringify(result));
        }
      }
      // 2. Postback Event (from Flex Message Buttons)
      else if (event.type === 'postback') {
        if (typeof console !== 'undefined') {
          console.log('🔘 [收到 Postback 點擊] Data: ' + (event.postback && event.postback.data));
        }
        handlePostbackEvent(event);
      }
      // 3. Join Group Event - Say Hello
      else if (event.type === 'join') {
        var joinReplyToken = event.replyToken;
        var sourceCodeUrl = (typeof getConfigValue === 'function')
          ? getConfigValue('SOURCE_CODE_URL', 'https://tinyurl.com/4c92wtee')
          : 'https://tinyurl.com/4c92wtee';
        var helpFlex = createHelpFlex(sourceCodeUrl);
        replyFlex(joinReplyToken, '感謝邀請便當點餐小幫手！', helpFlex);
      }
    }

    return _createResponse(200, { status: 'success' });
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.error('❌ doPost error:', err);
    }
    if (typeof logToSheet === 'function') {
      logToSheet('EXCEPTION', err.message, err.stack);
    }
    return _createResponse(200, { status: 'error', error: err.message });
  }
}

/**
 * Helper to create HTTP response
 */
function _createResponse(statusCode, data) {
  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return { statusCode: statusCode, body: data };
}

/**
 * Diagnostic tool - Test LINE API Token connection directly from Apps Script editor
 */
function testLineConnection() {
  var token = getConfigProperty('CHANNEL_ACCESS_TOKEN', '');
  if (!token) {
    var noTokenMsg = '❌ 錯誤：找不到 CHANNEL_ACCESS_TOKEN！請至 Apps Script 左側「專案設定」->「指令碼屬性」填入。';
    if (typeof Logger !== 'undefined') Logger.log(noTokenMsg);
    if (typeof console !== 'undefined') console.error(noTokenMsg);
    return false;
  }

  var masked = token.length > 10 ? token.substring(0, 10) + '...' : '***';
  if (typeof Logger !== 'undefined') {
    Logger.log('🔍 正在檢測 CHANNEL_ACCESS_TOKEN (長度: ' + token.length + ', 前 10 碼: ' + masked + ')...');
  }

  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (typeof Logger !== 'undefined') {
      Logger.log('LINE API 回應狀態碼: ' + code);
      Logger.log('LINE API 回應內容: ' + body);
    }
    if (code === 200) {
      var info = JSON.parse(body);
      var okMsg = '🎉 驗證成功！LINE 權杖有效，Bot 連線正常！\n機器人名稱: ' + info.displayName + '\n機器人 ID: ' + info.basicId;
      if (typeof Logger !== 'undefined') Logger.log(okMsg);
      return true;
    } else {
      var failMsg = '❌ 憑證無效 (HTTP ' + code + ')！LINE 回傳: ' + body + '\n請重新檢查 Script Properties 中的 CHANNEL_ACCESS_TOKEN 是否包含多餘空格或過期。';
      if (typeof Logger !== 'undefined') Logger.log(failMsg);
      return false;
    }
  } catch (e) {
    if (typeof Logger !== 'undefined') Logger.log('❌ 網路請求例外: ' + e.message);
    return false;
  }
}

/**
 * Diagnostic tool - Simulate incoming message '幫助' directly from editor
 */
function testHelpMessage() {
  if (typeof Logger !== 'undefined') Logger.log('🧪 正在模擬使用者在 LINE 聊天室輸入「幫助」...');
  var fakeEvent = {
    replyToken: 'dummy_test_token',
    message: { type: 'text', text: '幫助' },
    source: { userId: 'test_user_id', groupId: 'test_group_id' }
  };
  try {
    var res = handleTextMessage(fakeEvent);
    if (typeof Logger !== 'undefined') {
      Logger.log('📤 處理結果: ' + JSON.stringify(res));
      Logger.log('🎉 handleTextMessage 執行完全正常！');
    }
    return res;
  } catch (err) {
    if (typeof Logger !== 'undefined') {
      Logger.log('❌ 執行發生錯誤: ' + err.message + '\n' + err.stack);
    }
    return null;
  }
}

/**
 * 診斷工具：在 Google Apps Script 編輯器中直接測試 Uber Eats 菜單抓取
 * 預設測試使用者指定的兩家店：
 * 1. 真好味茶餐廳: ubereats.com/tw/store/真好味茶餐廳/xDKpVlsqTdmXKiJsQdkf_g?sc=SEARCH_SUGGESTION
 * 2. 上海灘茶餐廳: https://www.ubereats.com/tw/store/%E4%B8%8A%E6%B5%B7%E7%81%98%E8%8C%B6%E9%A4%90%E5%BB%B3/kRJsM5CqSrCohWhzSS_y-w?diningMode=DELIVERY
 *
 * 可在 Apps Script 工具列選擇「testUberEatsImport」並點擊「執行」進行偵錯！
 */
function testUberEatsImport(customUrl) {
  if (typeof Logger !== 'undefined') {
    Logger.log('====================================================');
    Logger.log('🔍 開始執行 Uber Eats 菜單抓取診斷測試 (testUberEatsImport)...');
    Logger.log('====================================================');
  }

  var testUrls = [];
  if (customUrl) {
    testUrls.push({ label: '自訂網址', url: customUrl });
  } else {
    testUrls.push({
      label: '店家 1 (真好味茶餐廳)',
      url: 'ubereats.com/tw/store/真好味茶餐廳/xDKpVlsqTdmXKiJsQdkf_g?sc=SEARCH_SUGGESTION'
    });
    testUrls.push({
      label: '店家 2 (上海灘茶餐廳)',
      url: 'https://www.ubereats.com/tw/store/%E4%B8%8A%E6%B5%B7%E7%81%98%E8%8C%B6%E9%A4%90%E5%BB%B3/kRJsM5CqSrCohWhzSS_y-w?diningMode=DELIVERY'
    });
  }

  var results = [];

  for (var i = 0; i < testUrls.length; i++) {
    var t = testUrls[i];
    if (typeof Logger !== 'undefined') {
      Logger.log('\n--- 測試 ' + t.label + ' ---');
      Logger.log('輸入網址: ' + t.url);
    }

    var parsed = parseUberEatsUrl(t.url);
    if (!parsed) {
      if (typeof Logger !== 'undefined') Logger.log('❌ 網址解析失敗！無法辨識 Uber Eats 店家網址格式');
      results.push({ label: t.label, success: false, error: 'URL parse failed' });
      continue;
    }

    if (typeof Logger !== 'undefined') {
      Logger.log('✔ 網址解析成功:');
      Logger.log('   - 店家名稱: ' + parsed.storeName);
      Logger.log('   - Slug UUID: ' + parsed.storeUuid);
      Logger.log('   - 標準 UUID: ' + parsed.standardUuid);
    }

    try {
      var storeData = fetchStoreMenu(parsed.standardUuid || parsed.storeUuid);
      // If Promise (Node.js runtime)
      if (storeData && typeof storeData.then === 'function') {
        if (typeof Logger !== 'undefined') Logger.log('ℹ 非同步 Promise 物件已回傳');
        results.push({ label: t.label, success: true, parsed: parsed, isPromise: true });
        continue;
      }

      if (!storeData) {
        if (typeof Logger !== 'undefined') {
          Logger.log('❌ 抓取失敗: fetchStoreMenu 回傳 null (可能因 Uber Eats 防護限制、網路逾時或店家非營業狀態)');
        }
        results.push({ label: t.label, success: false, error: 'fetchStoreMenu returned null' });
        continue;
      }

      var items = extractMenuItems(storeData);
      if (typeof Logger !== 'undefined') {
        Logger.log('✔ 菜單品項解析成功！共抓取到 ' + items.length + ' 道餐點');
        if (items.length > 0) {
          Logger.log('📋 前 3 道餐點範例:');
          for (var k = 0; k < Math.min(3, items.length); k++) {
            var itm = items[k];
            Logger.log('   [' + (k + 1) + '] 分類: ' + itm.category + ' | 餐點: ' + itm.itemName + ' | 價格: NT$' + itm.price);
          }
        }
      }

      results.push({
        label: t.label,
        storeName: parsed.storeName,
        standardUuid: parsed.standardUuid,
        itemsCount: items.length,
        sampleItems: items.slice(0, 3),
        success: true
      });
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('❌ 抓取發生例外: ' + err.message);
      }
      results.push({ label: t.label, success: false, error: err.message });
    }
  }

  if (typeof Logger !== 'undefined') {
    Logger.log('\n====================================================');
    Logger.log('🎉 診斷測試完成！總共測試 ' + testUrls.length + ' 個店家');
    Logger.log('====================================================');
  }

  return results;
}

/**
 * Manual setup helper - can be run from the Apps Script editor toolbar
 */
function setup() {
  var success = initSheets();
  if (typeof Logger !== 'undefined') {
    Logger.log('Setup finished. Sheets initialized: ' + success);
  }
  return success;
}

// Dual export for testing
(function () {
  var g = (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global   !== 'undefined') ? global
       : (typeof self     !== 'undefined') ? self
       : this;

  g.onOpen = onOpen;
  g.refreshDailySummary = refreshDailySummary;
  g.refreshWeeklySummary = refreshWeeklySummary;
  g.showUberEatsImportDialog = showUberEatsImportDialog;
  g.showCustomRestaurantImportDialog = showCustomRestaurantImportDialog;
  g.doGet = doGet;
  g.doPost = doPost;
  g.setup = setup;
  g.testLineConnection = testLineConnection;
  g.testHelpMessage = testHelpMessage;
  g.testUberEatsImport = testUberEatsImport;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      onOpen: onOpen,
      refreshDailySummary: refreshDailySummary,
      refreshWeeklySummary: refreshWeeklySummary,
      showUberEatsImportDialog: showUberEatsImportDialog,
      showCustomRestaurantImportDialog: showCustomRestaurantImportDialog,
      doGet: doGet,
      doPost: doPost,
      setup: setup,
      testLineConnection: testLineConnection,
      testHelpMessage: testHelpMessage,
      testUberEatsImport: testUberEatsImport
    };
  }
})();

