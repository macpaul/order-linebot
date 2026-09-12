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
    'menu.page_indicator': '📄 第 {page} / {total} 頁 (共 {total} 頁)',
    'menu.more_pages_hint': '📖 查看更多菜單品項 · 請點選頁數（共 {total} 頁）：',
    'menu.btn_page': '📄 第 {page} 頁',
    'menu.page_footer': '📄 目前為第 {page} / {total} 頁 · 全店共 {items} 道餐點',

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
    'menu.page_indicator': '📄 Page {page} / {total} (Total {total} pages)',
    'menu.more_pages_hint': '📖 View more items · Tap a page number (Total {total} pages):',
    'menu.btn_page': '📄 Page {page}',
    'menu.page_footer': '📄 Currently page {page} / {total} · {items} items in total',

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
    'menu.page_indicator': '📄 {page} / {total} ページ (全 {total} ページ)',
    'menu.more_pages_hint': '📖 他のメニュー項目を表示 · ページ番号を選択（全 {total} ページ）：',
    'menu.btn_page': '📄 {page} ページ',
    'menu.page_footer': '📄 現在 {page} / {total} ページ · 全 {items} 品目',

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
    'menu.page_indicator': '📄 {page} / {total} 페이지 (총 {total} 페이지)',
    'menu.more_pages_hint': '📖 추가 메뉴 보기 · 페이지 번호를 선택하세요 (총 {total} 페이지):',
    'menu.btn_page': '📄 {page} 페이지',
    'menu.page_footer': '📄 현재 {page} / {total} 페이지 · 총 {items}개 메뉴',

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
    'menu.page_indicator': '📄 หน้า {page} / {total} (ทั้งหมด {total} หน้า)',
    'menu.more_pages_hint': '📖 ดูรายการเพิ่มเติม · แตะเลือกหน้า (ทั้งหมด {total} หน้า):',
    'menu.btn_page': '📄 หน้า {page}',
    'menu.page_footer': '📄 ขณะนี้หน้า {page} / {total} · มีทั้งหมด {items} รายการ',

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
    'menu.page_indicator': '📄 Halaman {page} / {total} (Total {total} halaman)',
    'menu.more_pages_hint': '📖 Lihat menu lainnya · Pilih halaman (Total {total} halaman):',
    'menu.btn_page': '📄 Hal {page}',
    'menu.page_footer': '📄 Saat ini halaman {page} / {total} · Total {items} menu',

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
