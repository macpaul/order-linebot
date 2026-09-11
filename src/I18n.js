/**
 * I18n.js - Multi-language Internationalization Service for LINE Meal Ordering Bot
 * Supports: zh-TW (Traditional Chinese), en (English), ja (Japanese), ko (Korean), th (Thai), id (Indonesian)
 * Dual runtime: Google Apps Script (GAS) & Node.js.
 */

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
    'lang.prompt_select': '🌐 請選擇要切換的語言：'
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
    'lang.prompt_select': '🌐 Please select a language to switch to:'
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
    'lang.prompt_select': '🌐 切り替える言語を選択してください：'
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
    'lang.prompt_select': '🌐 변경할 언어를 선택해주세요:'
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
    'lang.prompt_select': '🌐 กรุณาเลือกภาษาที่ต้องการเปลี่ยน:'
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
    'lang.prompt_select': '🌐 Silakan pilih bahasa:'
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
      getCommandAliases: getCommandAliases
    };
  }
})(this);
