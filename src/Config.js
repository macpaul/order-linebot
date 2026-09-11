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
