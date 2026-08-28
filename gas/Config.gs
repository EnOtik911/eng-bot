/**
 * Everything secret lives in Script Properties, never in the sheet and never in the repo.
 * Set them once: Project Settings -> Script Properties.
 *   BOT_TOKEN  - from BotFather
 *   SHEET_ID   - the spreadsheet id from its URL
 *   ALLOWLIST  - comma-separated Telegram user ids allowed in
 */

var SHEET_CARDS = 'cards';
var SHEET_SETTINGS = 'settings';
var SHEET_INBOX = 'inbox';
var SHEET_REJECTS = 'rejects';
var SHEET_FLUSH_LOG = 'flush_log';

var CARD_COLUMNS = [
  'card_id', 'item_id', 'direction', 'type', 'en', 'ru', 'example_en', 'example_ru',
  'layer', 'topic', 'note', 'state', 'due', 'stability', 'difficulty', 'reps',
  'lapses', 'last_review', 'created_at', 'user_id', 'source_batch'
];

var IMPORT_COLUMNS = ['type', 'en', 'ru', 'example_en', 'example_ru', 'layer', 'topic', 'note'];
var LOG_COLUMNS = ['card_id', 'ts', 'rating', 'elapsed_days', 'interval_days',
  'stability', 'difficulty', 'batch_id'];

var VALID_TYPES = ['word', 'collocation', 'phrase'];
var VALID_LAYERS = ['core', 'business', 'mobility', 'hospitality', 'tech'];

var DEFAULT_SETTINGS = {
  daily_new_target: '6',
  desired_retention: '0.85',
  session_size_cap: '120',
  leech_threshold: '5',
  unlock_interval_days: '21',
  ping_hour: '8',
  timezone: 'Europe/Moscow',
  ui_lang: 'ru',
  last_trigger_run: '',
  webhook_last_check: ''
};

function cfg_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Script Property is missing: ' + key);
  return v;
}

function cfgAllowlist_() {
  return cfg_('ALLOWLIST').split(',').map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/** Prints whether each property is set, without ever printing its value. */
function selfCheck() {
  ['BOT_TOKEN', 'SHEET_ID', 'ALLOWLIST'].forEach(function (k) {
    var v = PropertiesService.getScriptProperties().getProperty(k);
    Logger.log(k + ': ' + (v ? 'ok (' + v.length + ' chars)' : 'MISSING'));
  });
  try {
    var ss = SpreadsheetApp.openById(cfg_('SHEET_ID'));
    Logger.log('spreadsheet: ok — "' + ss.getName() + '"');
    Logger.log('tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  } catch (e) {
    Logger.log('spreadsheet: FAILED — ' + e.message);
  }
}
