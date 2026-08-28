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
var SHEET_PATTERNS = 'patterns';
var SHEET_GRAMMAR_ITEMS = 'grammar_items';
var SHEET_GRAMMAR_INBOX = 'grammar_inbox';
var SHEET_GRAMMAR_REJECTS = 'grammar_rejects';

var CARD_COLUMNS = [
  'card_id', 'item_id', 'direction', 'type', 'en', 'ru', 'example_en', 'example_ru',
  'layer', 'topic', 'note', 'state', 'due', 'stability', 'difficulty', 'reps',
  'lapses', 'last_review', 'created_at', 'user_id', 'source_batch',
  // Добавлена после первой живой сессии. Только в конце: вставка в середину сдвинула
  // бы значения во всех существующих строках.
  'first_review'
];

/**
 * A grammar PATTERN carries the FSRS state — not the individual sentence.
 * Every review of a pattern draws a different item from its pool, so what gets
 * strengthened is the rule and not one memorised sentence. That is the single
 * decision the whole grammar block rests on; see docs/spec-grammar.md.
 */
var PATTERN_COLUMNS = [
  'pattern_id', 'order_index', 'label', 'title_ru', 'notes_slug',
  'state', 'due', 'stability', 'difficulty', 'reps', 'lapses',
  'last_review', 'first_review', 'created_at', 'user_id', 'source_batch'
];

var GRAMMAR_ITEM_COLUMNS = [
  'item_id', 'pattern_id', 'kind', 'prompt_ru', 'stem', 'answer', 'tokens',
  'hint_ru', 'serve_count', 'last_served', 'created_at', 'source_batch'
];

var GRAMMAR_IMPORT_COLUMNS = [
  'pattern_id', 'order_index', 'label', 'title_ru', 'notes_slug',
  'kind', 'prompt_ru', 'stem', 'answer', 'tokens', 'hint_ru'
];

var GRAMMAR_LOG_COLUMNS = ['pattern_id', 'ts', 'rating', 'errors', 'hints', 'items',
  'elapsed_days', 'interval_days', 'stability', 'difficulty', 'batch_id'];

var VALID_KINDS = ['scramble', 'gapfill', 'transform', 'fix'];

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
  // Grammar has its own knobs: patterns are few and each one carries a pool of
  // sentences, so a higher retention costs almost nothing here while a rule that
  // is 85% remembered is still unusable in speech.
  grammar_daily_new_target: '1',
  grammar_desired_retention: '0.9',
  grammar_items_per_round: '3',
  grammar_session_cap: '8',
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
