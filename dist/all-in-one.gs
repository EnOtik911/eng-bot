/**
 * GENERATED — do not edit. Source of truth is gas/*.gs.
 * Regenerate: node test/build-all-in-one.mjs
 *
 * Every gas/*.gs file concatenated in dependency order, for setting the project
 * up in the browser without clasp: create a script, delete the default contents
 * of Code.gs, paste this whole file.
 */

// ==========================================================================
// Config.gs
// ==========================================================================

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
  'first_review',
  // Пословный разбор словосочетания. Тоже в самый конец — по той же причине, что и
  // first_review: вставка в середину сдвинула бы значения во всех живых строках.
  'breakdown'
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

/**
 * `note` отвечает на вопрос «почему говорится именно так», `breakdown` — «что здесь
 * какое слово». Разные вопросы, поэтому разные колонки: смешав их, нельзя показать
 * одно без другого, а на повторении нужен как раз разбор без объяснения.
 */
var IMPORT_COLUMNS = ['type', 'en', 'ru', 'example_en', 'example_ru', 'layer', 'topic',
  'note', 'breakdown'];
var LOG_COLUMNS = ['card_id', 'ts', 'rating', 'elapsed_days', 'interval_days',
  'stability', 'difficulty', 'batch_id'];

var VALID_TYPES = ['word', 'collocation', 'phrase'];
/**
 * ПОРЯДОК ЗНАЧИМ: по нему planировщик решает, какие новые карточки показать первыми
 * (Session.gs, layerRank). Это очередь освоения, а не просто перечисление.
 *
 *   core      бытовое ядро — то, без чего не поговорить ни о чём
 *   social    разговорные связки: согласие, возражение, смягчение, small talk
 *   business  общий офис: встречи, переписка, сроки, договорённости
 *   analysis  ремесло аналитика: требования, трассировка, критерии приёмки
 *   fintech   предметная область: платежи, карты, расчёты, комплаенс
 *   tech      системная часть: интеграции, API, данные, окружения
 *
 * mobility и hospitality оставлены валидными, но последними: карточки с ними уже
 * лежат в таблице и удалять их незачем — они просто уходят в конец очереди новых.
 * Убрать их из списка значило бы сломать и существующие строки, и data/seed-batch-001.tsv.
 */
var VALID_LAYERS = ['core', 'social', 'business', 'analysis', 'fintech', 'tech',
  'mobility', 'hospitality'];

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
  webhook_last_check: '',
  // Список выданных ачивок через запятую. Нужен ровно для одного: объявить новую
  // в чате один раз. Экран прогресса выводит список из метрик и в это поле не смотрит.
  achievements: ''
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

// ==========================================================================
// Fsrs.gs
// ==========================================================================

/**
 * FSRS-6 scheduler. Pure arithmetic — no SpreadsheetApp, no PropertiesService, no dates
 * beyond plain numbers. This file is loaded verbatim by test/fsrs.test.mjs, so the
 * backend and the tests share one source of truth.
 *
 * Reference implementation: open-spaced-repetition/py-fsrs (fsrs/scheduler.py).
 * Sanity identity that pins the constants: at desiredRetention 0.9 the next interval
 * equals stability exactly, because FACTOR is derived so that R(S, S) = 0.9.
 */

// 21 default weights, FSRS-6.
var FSRS_DEFAULT_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
  1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542
];

var FSRS_STABILITY_MIN = 0.001;
var FSRS_DIFFICULTY_MIN = 1.0;
var FSRS_DIFFICULTY_MAX = 10.0;
var FSRS_MAX_INTERVAL_DAYS = 3650; // 10 years is plenty; 36500 is noise at our volume

// Ratings.
var RATING_AGAIN = 1;
var RATING_HARD = 2;
var RATING_GOOD = 3;
var RATING_EASY = 4;

function fsrsDecay_(w) {
  return -w[20];
}

function fsrsFactor_(w) {
  var decay = fsrsDecay_(w);
  return Math.pow(0.9, 1 / decay) - 1;
}

function fsrsClampStability_(s) {
  return Math.max(s, FSRS_STABILITY_MIN);
}

function fsrsClampDifficulty_(d) {
  return Math.min(Math.max(d, FSRS_DIFFICULTY_MIN), FSRS_DIFFICULTY_MAX);
}

/** Probability of recall after elapsedDays with the given stability. */
function fsrsRetrievability(stability, elapsedDays, w) {
  w = w || FSRS_DEFAULT_W;
  if (stability <= 0) return 0;
  var t = Math.max(elapsedDays, 0);
  return Math.pow(1 + fsrsFactor_(w) * t / stability, fsrsDecay_(w));
}

/** Days until retrievability decays to desiredRetention. */
function fsrsInterval(stability, desiredRetention, w) {
  w = w || FSRS_DEFAULT_W;
  var decay = fsrsDecay_(w);
  var raw = (stability / fsrsFactor_(w)) * (Math.pow(desiredRetention, 1 / decay) - 1);
  return Math.min(Math.max(Math.round(raw), 1), FSRS_MAX_INTERVAL_DAYS);
}

function fsrsInitialStability_(rating, w) {
  return fsrsClampStability_(w[rating - 1]);
}

function fsrsInitialDifficulty_(rating, w, clamp) {
  var d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return clamp === false ? d : fsrsClampDifficulty_(d);
}

function fsrsNextDifficulty_(difficulty, rating, w) {
  var deltaD = -(w[6] * (rating - 3));
  var damped = (10.0 - difficulty) * deltaD / 9.0;
  var arg2 = difficulty + damped;
  var arg1 = fsrsInitialDifficulty_(RATING_EASY, w, false);
  var next = w[7] * arg1 + (1 - w[7]) * arg2;   // mean reversion toward "easy" baseline
  return fsrsClampDifficulty_(next);
}

function fsrsRecallStability_(difficulty, stability, retrievability, rating, w) {
  var hardPenalty = rating === RATING_HARD ? w[15] : 1;
  var easyBonus = rating === RATING_EASY ? w[16] : 1;
  return stability * (
    1 + Math.exp(w[8])
      * (11 - difficulty)
      * Math.pow(stability, -w[9])
      * (Math.exp((1 - retrievability) * w[10]) - 1)
      * hardPenalty
      * easyBonus
  );
}

function fsrsForgetStability_(difficulty, stability, retrievability, w) {
  var longTerm = w[11]
    * Math.pow(difficulty, -w[12])
    * (Math.pow(stability + 1, w[13]) - 1)
    * Math.exp((1 - retrievability) * w[14]);
  var shortTerm = stability / Math.exp(w[17] * w[18]);
  return Math.min(longTerm, shortTerm);
}

/** Same-day repeat: elapsed time carries no information, so a separate track is used. */
function fsrsShortTermStability_(stability, rating, w) {
  var inc = Math.exp(w[17] * (rating - 3 + w[18])) * Math.pow(stability, -w[19]);
  if (rating !== RATING_AGAIN) inc = Math.max(inc, 1.0);
  return fsrsClampStability_(stability * inc);
}

/**
 * The only entry point the rest of the backend uses.
 *
 * card: { stability, difficulty, reps, lapses } — stability/difficulty null for a new card
 * rating: 1..4
 * elapsedDays: whole days since last_review; 0 for a same-day repeat
 * opts: { desiredRetention, w, fuzzSeed }
 *
 * returns { stability, difficulty, intervalDays, retrievability, reps, lapses, lapsed }
 */
function fsrsReview(card, rating, elapsedDays, opts) {
  opts = opts || {};
  var w = opts.w || FSRS_DEFAULT_W;
  var retention = opts.desiredRetention || 0.9;

  if (rating < RATING_AGAIN || rating > RATING_EASY) {
    throw new Error('fsrsReview: rating out of range: ' + rating);
  }

  var isNew = card.stability === null || card.stability === undefined || !card.reps;
  var stability, difficulty, retrievability;

  if (isNew) {
    stability = fsrsInitialStability_(rating, w);
    difficulty = fsrsInitialDifficulty_(rating, w);
    retrievability = 1;
  } else {
    retrievability = fsrsRetrievability(card.stability, elapsedDays, w);
    difficulty = fsrsNextDifficulty_(card.difficulty, rating, w);
    if (elapsedDays <= 0) {
      stability = fsrsShortTermStability_(card.stability, rating, w);
    } else if (rating === RATING_AGAIN) {
      stability = fsrsClampStability_(
        fsrsForgetStability_(difficulty, card.stability, retrievability, w));
    } else {
      stability = fsrsClampStability_(
        fsrsRecallStability_(difficulty, card.stability, retrievability, rating, w));
    }
  }

  var interval = fsrsInterval(stability, retention, w);
  interval = fsrsFuzz_(interval, opts.fuzzSeed);

  var lapsed = !isNew && rating === RATING_AGAIN;
  return {
    stability: stability,
    difficulty: difficulty,
    intervalDays: interval,
    retrievability: retrievability,
    reps: (card.reps || 0) + 1,
    lapses: (card.lapses || 0) + (lapsed ? 1 : 0),
    lapsed: lapsed
  };
}

/**
 * +/-5% spread on intervals longer than two days. Without it a batch imported on one day
 * comes back as a single wall on the same future day, forever.
 * Deterministic when fuzzSeed is supplied, so tests stay reproducible.
 */
function fsrsFuzz_(intervalDays, fuzzSeed) {
  if (intervalDays <= 2) return intervalDays;
  var r = fuzzSeed === undefined || fuzzSeed === null ? Math.random() : fuzzSeed;
  var spread = intervalDays * 0.05;
  var delta = (r * 2 - 1) * spread;
  var out = Math.round(intervalDays + delta);
  return Math.min(Math.max(out, 1), FSRS_MAX_INTERVAL_DAYS);
}

// ==========================================================================
// Store.gs
// ==========================================================================

/**
 * The only place that touches Sheets. Rules that everything else relies on:
 *  - read and write whole ranges, never a cell in a loop (two orders of magnitude)
 *  - the write lock is taken immediately before writing, never around a whole function
 *  - the scheduler never reads review_log; card state lives in the card row
 */

function ss_() {
  return SpreadsheetApp.openById(cfg_('SHEET_ID'));
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet tab is missing: ' + name + ' — run setupSpreadsheet()');
  return sh;
}

function logSheetName_() {
  return 'review_log_' + new Date().getFullYear();
}

/** One read of the whole cards tab as objects, plus the row index for writing back. */
function readCards_() {
  var sh = sheet_(SHEET_CARDS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, CARD_COLUMNS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < CARD_COLUMNS.length; c++) o[CARD_COLUMNS[c]] = values[i][c];
    out.push(o);
  }
  return out;
}

function readSettings_() {
  var sh = sheet_(SHEET_SETTINGS);
  var lastRow = sh.getLastRow();
  var out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    values.forEach(function (r) {
      if (r[0]) out[String(r[0]).trim()] = r[1] === null ? '' : String(r[1]).trim();
    });
  }
  return out;
}

function writeSetting_(key, value) {
  var sh = sheet_(SHEET_SETTINGS);
  var lastRow = sh.getLastRow();
  var keys = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sh.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

/**
 * Applies a batch of card updates in one write per contiguous block.
 * updates: [{ _row, patch: {column: value} }]
 */
function writeCardUpdates_(updates) {
  if (!updates.length) return 0;
  var sh = sheet_(SHEET_CARDS);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    // Read-modify-write of only the touched rows, one getValues + one setValues per row block.
    updates.sort(function (a, b) { return a._row - b._row; });
    var written = 0;
    var i = 0;
    while (i < updates.length) {
      var start = i;
      while (i + 1 < updates.length && updates[i + 1]._row === updates[i]._row + 1) i++;
      var firstRow = updates[start]._row;
      var count = updates[i]._row - firstRow + 1;
      var range = sh.getRange(firstRow, 1, count, CARD_COLUMNS.length);
      var block = range.getValues();
      for (var u = start; u <= i; u++) {
        var rowIdx = updates[u]._row - firstRow;
        var patch = updates[u].patch;
        Object.keys(patch).forEach(function (col) {
          var c = CARD_COLUMNS.indexOf(col);
          if (c < 0) throw new Error('Unknown card column: ' + col);
          block[rowIdx][c] = patch[col];
        });
        written++;
      }
      range.setValues(block);
      i++;
    }
    SpreadsheetApp.flush();
    return written;
  } finally {
    lock.releaseLock();
  }
}

function appendCards_(rows) {
  if (!rows.length) return 0;
  var sh = sheet_(SHEET_CARDS);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, CARD_COLUMNS.length).setValues(rows);
    SpreadsheetApp.flush();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function appendReviewLog_(rows) {
  if (!rows.length) return;
  var name = logSheetName_();
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, LOG_COLUMNS.length).setValues([LOG_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_COLUMNS.length).setValues(rows);
}

/** Idempotency: returns true when this batch was already applied. */
function flushSeen_(batchId) {
  var sh = sheet_(SHEET_FLUSH_LOG);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;
  var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(batchId)) return true;
  }
  return false;
}

function flushRecord_(batchId, count) {
  var sh = sheet_(SHEET_FLUSH_LOG);
  sh.appendRow([batchId, new Date().toISOString(), count]);
  var lastRow = sh.getLastRow();
  if (lastRow > 201) sh.deleteRows(2, lastRow - 201);   // keep the newest 200
}

/* ---------------------------------------------------------------------------
 * Grammar. Same two rules as above: whole ranges, lock only around the write.
 * The generic reader is worth the indirection here — patterns and items differ
 * only by their column list, and a second hand-rolled reader would be the third
 * copy of the same loop.
 * ------------------------------------------------------------------------- */

function readRows_(sheetName, columns) {
  var sh = sheet_(sheetName);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, columns.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < columns.length; c++) o[columns[c]] = values[i][c];
    out.push(o);
  }
  return out;
}

function writeRowUpdates_(sheetName, columns, updates) {
  if (!updates.length) return 0;
  var sh = sheet_(sheetName);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    updates.sort(function (a, b) { return a._row - b._row; });
    var written = 0;
    var i = 0;
    while (i < updates.length) {
      var start = i;
      while (i + 1 < updates.length && updates[i + 1]._row === updates[i]._row + 1) i++;
      var firstRow = updates[start]._row;
      var count = updates[i]._row - firstRow + 1;
      var range = sh.getRange(firstRow, 1, count, columns.length);
      var block = range.getValues();
      for (var u = start; u <= i; u++) {
        var rowIdx = updates[u]._row - firstRow;
        var patch = updates[u].patch;
        Object.keys(patch).forEach(function (col) {
          var c = columns.indexOf(col);
          if (c < 0) throw new Error('Unknown column in ' + sheetName + ': ' + col);
          block[rowIdx][c] = patch[col];
        });
        written++;
      }
      range.setValues(block);
      i++;
    }
    SpreadsheetApp.flush();
    return written;
  } finally {
    lock.releaseLock();
  }
}

function appendRows_(sheetName, columns, rows) {
  if (!rows.length) return 0;
  var sh = sheet_(sheetName);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, columns.length).setValues(rows);
    SpreadsheetApp.flush();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function readPatterns_() { return readRows_(SHEET_PATTERNS, PATTERN_COLUMNS); }
function readGrammarItems_() { return readRows_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS); }

function writePatternUpdates_(updates) {
  return writeRowUpdates_(SHEET_PATTERNS, PATTERN_COLUMNS, updates);
}
function writeGrammarItemUpdates_(updates) {
  return writeRowUpdates_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS, updates);
}

function grammarLogSheetName_() {
  return 'grammar_log_' + new Date().getFullYear();
}

function appendGrammarLog_(rows) {
  if (!rows.length) return;
  var name = grammarLogSheetName_();
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, GRAMMAR_LOG_COLUMNS.length)
      .setValues([GRAMMAR_LOG_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, GRAMMAR_LOG_COLUMNS.length).setValues(rows);
}

// ==========================================================================
// Auth.gs
// ==========================================================================

/**
 * Telegram Mini App initData validation.
 *
 * Scheme (core.telegram.org/bots/webapps):
 *   secret = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   check  = HMAC_SHA256(key=secret,       message=data_check_string)
 * data_check_string = all received fields except `hash`, sorted by key, joined as
 * "key=value" with \n, using URL-DECODED values.
 *
 * `signature` IS part of the hash, despite Telegram's own documentation showing an
 * example string of only auth_date, query_id and user. Established by probing four
 * candidate constructions against real initData from Telegram Desktop 9.6 — see
 * `diagInitData` below, which still does that and reports which one matches.
 *
 * The URL of this Web App is public — it is in a public repository on purpose.
 * Without a valid hash produced by our bot token, every request stops here.
 */

function hmacHex_(keyBytes, message) {
  var sig = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(message).getBytes(), keyBytes);
  return sig.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function hmacBytes_(keyBytes, message) {
  return Utilities.computeHmacSha256Signature(
    Utilities.newBlob(message).getBytes(), keyBytes);
}

var AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Returns { ok: true, userId, user } or { ok: false, code }.
 * Never throws on malformed input — a bad request must not look like a server bug.
 */
function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return { ok: false, code: 'BAD_INIT_DATA' };

  var pairs = initData.split('&');
  var data = {};
  for (var i = 0; i < pairs.length; i++) {
    var eq = pairs[i].indexOf('=');
    if (eq < 0) continue;
    var k = decodeURIComponent(pairs[i].slice(0, eq));
    var v = decodeURIComponent(pairs[i].slice(eq + 1));
    data[k] = v;
  }

  var hash = data.hash;
  if (!hash) return { ok: false, code: 'BAD_INIT_DATA' };

  // Only `hash` is excluded. `signature`, when present, participates in the hash.
  var keys = Object.keys(data).filter(function (k) { return k !== 'hash'; }).sort();
  var checkString = keys.map(function (k) { return k + '=' + data[k]; }).join('\n');

  var secret = hmacBytes_(Utilities.newBlob('WebAppData').getBytes(), cfg_('BOT_TOKEN'));
  var expected = hmacHex_(secret, checkString);

  if (!constantTimeEquals_(expected, hash)) return { ok: false, code: 'BAD_INIT_DATA' };

  var authDate = parseInt(data.auth_date, 10);
  if (!authDate) return { ok: false, code: 'BAD_INIT_DATA' };
  var ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > AUTH_MAX_AGE_SECONDS) return { ok: false, code: 'STALE_INIT_DATA' };

  var user;
  try { user = JSON.parse(data.user || '{}'); } catch (e) { user = {}; }
  var userId = String(user.id || '');
  if (!userId) return { ok: false, code: 'BAD_INIT_DATA' };

  if (cfgAllowlist_().indexOf(userId) < 0) return { ok: false, code: 'NOT_ALLOWED' };

  return { ok: true, userId: userId, user: user };
}

/**
 * Comparison that does not leak where the strings diverge.
 * Overkill for a single-user app, and still the right habit: a comparison that
 * returns early is the textbook timing side channel, and it costs nothing to avoid.
 */
function constantTimeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifies the bot-side of the webhook: only our own bot may post updates here. */
function verifyWebhookSecret_(e) {
  var header = e && e.parameter ? e.parameter.secret : null;
  return header === null || header === undefined ? false : header === cfg_('BOT_TOKEN').slice(-16);
}

/**
 * Диагностика валидации без раскрытия секретов.
 *
 * Возвращает: какие поля пришли, возраст auth_date, длины и первые 8 символов
 * ожидаемого и полученного хеша, попадание в allowlist, отпечаток токена.
 * Отпечаток — первые 8 символов SHA-256 от токена: позволяет сравнить «тот ли
 * токен стоит в свойствах», не показывая сам токен.
 */
function diagInitData(initData) {
  var out = { ok: true, checks: {} };

  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  out.checks.bot_token_set = !!token;
  out.checks.bot_token_length = token ? token.length : 0;
  if (token) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
    out.checks.bot_token_fingerprint = digest.slice(0, 4).map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
    out.checks.bot_token_id = token.split(':')[0];   // публичная часть, это id бота
  }

  // Решающая проверка: жив ли токен, который лежит в свойствах, и от какого он бота.
  // Если токен отозвали через /revoke, а в свойствах остался прежний — здесь придёт 401,
  // и это ровно та причина, по которой хеш initData не сходится.
  if (token) {
    try {
      var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe',
        { muteHttpExceptions: true });
      var body = JSON.parse(res.getContentText());
      out.checks.bot_token_valid = !!body.ok;
      if (body.ok) {
        out.checks.bot_username = body.result.username;
        out.checks.bot_id = String(body.result.id);
      } else {
        out.checks.bot_token_error = body.description || ('HTTP ' + res.getResponseCode());
      }
    } catch (e) {
      out.checks.bot_token_valid = 'проверить не удалось: ' + e.message;
    }
  }

  var allow = [];
  try { allow = cfgAllowlist_(); } catch (e) {}
  out.checks.allowlist_size = allow.length;
  out.checks.allowlist_values = allow;              // это твои же user_id, не секрет

  if (!initData) { out.checks.init_data = 'пусто'; return out; }
  out.checks.init_data_length = initData.length;

  var pairs = initData.split('&');
  var data = {};
  pairs.forEach(function (p) {
    var eq = p.indexOf('=');
    if (eq < 0) return;
    data[decodeURIComponent(p.slice(0, eq))] = decodeURIComponent(p.slice(eq + 1));
  });
  out.checks.fields = Object.keys(data).sort();
  out.checks.has_hash = !!data.hash;
  out.checks.hash_length = data.hash ? data.hash.length : 0;

  if (data.auth_date) {
    var age = Math.floor(Date.now() / 1000) - parseInt(data.auth_date, 10);
    out.checks.auth_date_age_seconds = age;
    out.checks.auth_date_within_window = age <= AUTH_MAX_AGE_SECONDS;
  }

  var uid = '';
  try { uid = String(JSON.parse(data.user || '{}').id || ''); } catch (e) {}
  out.checks.user_id_from_init_data = uid;
  out.checks.user_in_allowlist = uid ? allow.indexOf(uid) >= 0 : false;

  if (token && data.hash) {
    // Перебор кандидатов, а не догадка: какая именно строка подписывается.
    // Telegram добавил поле signature, и неясно, входит ли оно в hash; плюс
    // остаётся вопрос, берутся значения декодированными или как пришли.
    var raw = {};
    initData.split('&').forEach(function (p) {
      var eq = p.indexOf('=');
      if (eq >= 0) raw[decodeURIComponent(p.slice(0, eq))] = p.slice(eq + 1);
    });

    var secret = hmacBytes_(Utilities.newBlob('WebAppData').getBytes(), token);
    var variants = [
      { name: 'decoded, без signature', src: data, drop: ['hash', 'signature'] },
      { name: 'decoded, с signature',   src: data, drop: ['hash'] },
      { name: 'raw, без signature',     src: raw,  drop: ['hash', 'signature'] },
      { name: 'raw, с signature',       src: raw,  drop: ['hash'] }
    ];

    out.checks.hash_received_head = data.hash.slice(0, 8);
    out.checks.hash_variants = {};
    var matched = null;
    variants.forEach(function (v) {
      var keys = Object.keys(v.src).filter(function (k) { return v.drop.indexOf(k) < 0; }).sort();
      var cs = keys.map(function (k) { return k + '=' + v.src[k]; }).join('\n');
      var got = hmacHex_(secret, cs);
      var ok = constantTimeEquals_(got, data.hash);
      out.checks.hash_variants[v.name] = { head: got.slice(0, 8), matches: ok, fields: keys };
      if (ok && !matched) matched = v.name;
    });
    out.checks.hash_matching_variant = matched;
    out.checks.hash_matches = !!matched;
  }

  var verdict = verifyInitData(initData);
  out.verdict = verdict.ok ? 'OK' : verdict.code;

  // Что именно сделать, если не сошлось
  if (out.checks.bot_token_valid === false) {
    out.hint = 'Токен в Script Properties недействителен (' +
      (out.checks.bot_token_error || 'getMe отказал') + '). Скорее всего он отозван через ' +
      '/revoke, а новый в свойства не положили. Возьми текущий токен у BotFather ' +
      'и замени BOT_TOKEN.';
  } else if (out.checks.hash_matches === false) {
    out.hint = 'Токен рабочий, но ни один из четырёх вариантов построения строки не сошёлся. ' +
      'Значит дело не в поле signature и не в кодировании значений. Пришли этот вывод целиком.';
  } else if (out.checks.hash_matching_variant &&
             out.checks.hash_matching_variant !== 'decoded, без signature') {
    out.hint = 'Сходится вариант "' + out.checks.hash_matching_variant + '", а код использует ' +
      '"decoded, без signature". Именно это и надо поправить в verifyInitData.';
  } else if (out.checks.user_in_allowlist === false && uid) {
    out.hint = 'Подпись верна, но user_id ' + uid + ' не в ALLOWLIST. Добавь его в свойства.';
  }
  return out;
}

// ==========================================================================
// Session.gs
// ==========================================================================

/**
 * Builds the session queue and applies a flushed batch.
 * One GET per session, one POST per session — see docs/deploy.md for why.
 */

/**
 * Дата из таблицы в вид 'YYYY-MM-DD'.
 *
 * getValues() возвращает СЫРЫЕ значения ячеек, а Google Sheets молча превращает
 * записанную строку '2026-08-28' в дату. Обратно она приходит объектом Date, и
 * String(date).slice(0, 10) даёт 'Sun Aug 28' — строку, которая не равна ни одной
 * дате и при этом БОЛЬШЕ любой '2026-..' при лексикографическом сравнении.
 *
 * Поэтому условие `due <= today` было вечно ложным: карточка, у которой наступил
 * срок, не возвращалась НИКОГДА. По той же причине дневная норма считала, что
 * сегодня не введено ничего, и выдавала полную порцию новых на каждый запуск, а
 * daysBetween_ отдавал NaN — прямо в планировщик, вместе со стабильностью.
 *
 * Юнит-тесты этого не видели четыре месяца, потому что подставляли даты СТРОКАМИ —
 * форму, которой в живой таблице нет.
 */
function dateKey_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, tz || 'Europe/Moscow', 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function todayStr_(tz) {
  return Utilities.formatDate(new Date(), tz || 'Europe/Moscow', 'yyyy-MM-dd');
}

function daysBetween_(from, to) {
  var a = Date.parse(dateKey_(from) + 'T00:00:00Z');
  var b = Date.parse(dateKey_(to) + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(Math.round((b - a) / 86400000), 0);
}

/** Ближайший срок среди зрелых карточек. Пустая строка = впереди ничего нет. */
function nextDue_(cards, today, tz) {
  var dates = [];
  cards.forEach(function (c) {
    var st = String(c.state || '');
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return;
    var k = dateKey_(c.due, tz);
    if (k && k > today) dates.push(k);
  });
  dates.sort();
  return dates.length ? dates[0] : '';
}

function buildSession(userId) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var cap = parseInt(settings.session_size_cap, 10) || 120;
  var newTarget = parseInt(settings.daily_new_target, 10) || 6;
  var leechThreshold = parseInt(settings.leech_threshold, 10) || 5;

  var all = readCards_();
  var mine = all.filter(function (c) { return String(c.user_id) === String(userId); });

  var due = [];
  var fresh = [];
  var leeches = 0;
  var locked = 0;
  var introducedToday = 0;

  mine.forEach(function (c) {
    // Сколько новых уже введено сегодня. Считается по строке карточки, а не по
    // журналу: планировщик журнал не читает, это условие из ADR-02.
    if (c.first_review && dateKey_(c.first_review, tz) === today) introducedToday++;
  });

  mine.forEach(function (c) {
    var state = String(c.state || '');
    if (state === 'leech') { leeches++; return; }
    if (state === 'suspended') return;
    if (state === 'locked') { locked++; return; }
    if (state === 'new') { fresh.push(c); return; }
    var dueStr = dateKey_(c.due, tz);
    if (dueStr && dueStr <= today) due.push(c);
  });

  // Layer order decides which new cards come first; within a layer, import order.
  var layerRank = {};
  VALID_LAYERS.forEach(function (l, i) { layerRank[l] = i; });
  fresh.sort(function (a, b) {
    var la = layerRank[a.layer] === undefined ? 99 : layerRank[a.layer];
    var lb = layerRank[b.layer] === undefined ? 99 : layerRank[b.layer];
    if (la !== lb) return la - lb;
    return String(a.created_at) < String(b.created_at) ? -1 : 1;
  });

  // The daily allowance is per DAY, not per app launch. Serving `newTarget` on every
  // launch is what produced fifteen new cards in one sitting during the first real
  // session, against a target of six — and fifteen cards due the next morning.
  var newAllowance = Math.max(newTarget - introducedToday, 0);

  // Due cards always come before new ones: debt first, growth second.
  var queue = due.concat(fresh.slice(0, newAllowance)).slice(0, cap);

  var warnings = [];
  if (settings.last_trigger_run) {
    var ageHours = (Date.now() - new Date(settings.last_trigger_run).getTime()) / 3600000;
    if (ageHours > 36) warnings.push('trigger_stale');
  } else {
    warnings.push('trigger_never_ran');
  }

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    settings: {
      daily_new_target: newTarget,
      desired_retention: parseFloat(settings.desired_retention) || 0.85,
      session_size_cap: cap,
      leech_threshold: leechThreshold,
      ui_lang: settings.ui_lang || 'ru'
    },
    cards: queue.map(cardPayload_),
    counts: {
      due: due.length,
      new_available: fresh.length,
      new_in_session: Math.min(fresh.length, newAllowance),
      new_introduced_today: introducedToday,
      new_allowance_left: newAllowance,
      total: mine.length,
      leeches: leeches,
      locked: locked,
      // Ближайшая дата, когда снова появится работа. Без неё экран итогов может
      // сказать «на сегодня всё», но не может сказать, что будет завтра — а
      // именно этого владелец и не понимал, закрывая сессию.
      next_due: nextDue_(mine, today, tz)
    },
    warnings: warnings
  };
}

/**
 * Форма карточки, которую видит клиент. Одна на все режимы: свободная практика
 * рендерится тем же кодом, что и сессия, и разойтись эти две формы не должны.
 */
function cardPayload_(c) {
  return {
    card_id: c.card_id,
    direction: c.direction,
    type: c.type,
    en: c.en,
    ru: c.ru,
    example_en: c.example_en,
    example_ru: c.example_ru,
    layer: c.layer,
    state: c.state,
    // Разбор едет вместе с карточкой, а не отдельным запросом: очередь и так уже
    // забирается целиком, а лишний round trip к Apps Script стоит 400-1500 мс.
    note: c.note || '',
    breakdown: c.breakdown || ''
  };
}

/** Fisher-Yates. Порядок расписания в практике не нужен и вреден: он предсказуем. */
function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/**
 * Свободная практика: гонять уже пройденное сколько угодно, НЕ трогая расписание.
 *
 * Почему у этого режима нет и не должно быть flush: FSRS считает интервал от момента
 * фактического повторения. Лишний прогон раньше срока, записанный как настоящий,
 * занижает интервал — алгоритм решает, что материал знают хуже, чем знают, и
 * завтрашняя нагрузка растёт на ровном месте. Поэтому сервер здесь только ОТДАЁТ
 * карточки и не принимает по ним ничего обратно; ответов в этом режиме не существует
 * ни в буфере клиента, ни в журнале.
 *
 * Берутся только те карточки, которые пользователь уже видел. new/locked/suspended
 * он по определению не видел, и подсунуть их здесь значило бы ввести новое слово в
 * обход дневной нормы — ровно то, от чего норма и защищает.
 */
function buildPractice(userId, limit) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var cap = parseInt(limit, 10) || parseInt(settings.practice_size_cap, 10) || 60;

  var mine = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var seen = mine.filter(function (c) {
    var st = String(c.state || '');
    return st !== 'new' && st !== 'locked' && st !== 'suspended';
  });

  shuffle_(seen);

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: todayStr_(tz),
    settings: { ui_lang: settings.ui_lang || 'ru' },
    cards: seen.slice(0, cap).map(cardPayload_),
    counts: {
      available: seen.length,
      in_session: Math.min(seen.length, cap)
    },
    warnings: []
  };
}

/**
 * reviews: [{ card_id, rating, ts }] in the order they happened.
 * Ratings for the same card in one batch are applied in sequence, which is exactly
 * how a card answered Again and then Good later in the session should behave.
 */
function applyFlush(userId, batchId, reviews) {
  if (!batchId) return { ok: false, code: 'BAD_REQUEST', message: 'batch_id is required' };
  if (!reviews || !reviews.length) return { ok: true, applied: 0, skipped_duplicate: false };

  if (flushSeen_(batchId)) {
    return { ok: true, applied: 0, skipped_duplicate: true };
  }

  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var retention = parseFloat(settings.desired_retention) || 0.85;
  var leechThreshold = parseInt(settings.leech_threshold, 10) || 5;
  var unlockAt = parseInt(settings.unlock_interval_days, 10) || 21;

  var all = readCards_();
  var byId = {};
  all.forEach(function (c) { byId[String(c.card_id)] = c; });

  var updates = {};
  var logRows = [];
  var newLeeches = [];
  var unlocked = [];
  var applied = 0;

  reviews.forEach(function (r) {
    var card = byId[String(r.card_id)];
    if (!card) return;
    if (String(card.user_id) !== String(userId)) return;

    var rating = parseInt(r.rating, 10);
    if (!(rating >= 1 && rating <= 4)) return;

    var elapsed = card.last_review ? daysBetween_(card.last_review, today) : 0;
    var out = fsrsReview({
      stability: card.stability === '' ? null : Number(card.stability),
      difficulty: card.difficulty === '' ? null : Number(card.difficulty),
      reps: Number(card.reps) || 0,
      lapses: Number(card.lapses) || 0
    }, rating, elapsed, { desiredRetention: retention });

    var isLeech = out.lapses >= leechThreshold;
    var dueDate = new Date(new Date(today + 'T00:00:00Z').getTime() + out.intervalDays * 86400000);
    var dueStr = Utilities.formatDate(dueDate, 'UTC', 'yyyy-MM-dd');

    card.stability = out.stability;
    card.difficulty = out.difficulty;
    card.reps = out.reps;
    card.lapses = out.lapses;
    card.last_review = today;
    card.state = isLeech ? 'leech' : 'review';
    card.due = isLeech ? '' : dueStr;

    var patch = {
      state: card.state, due: card.due, stability: out.stability,
      difficulty: out.difficulty, reps: out.reps, lapses: out.lapses,
      last_review: today
    };
    // Дата первого в жизни показа. Ставится один раз и больше не меняется —
    // по ней считается дневная норма новых.
    if (!card.first_review) { patch.first_review = today; card.first_review = today; }

    updates[card.card_id] = { _row: card._row, patch: patch };

    if (isLeech && newLeeches.indexOf(card.card_id) < 0) newLeeches.push(card.card_id);

    logRows.push([card.card_id, r.ts || new Date().toISOString(), rating, elapsed,
      out.intervalDays, out.stability, out.difficulty, batchId]);
    applied++;

    // Unlock the production sibling once recognition matured.
    if (card.direction === 'recog' && !isLeech && out.intervalDays >= unlockAt) {
      all.forEach(function (sib) {
        if (String(sib.item_id) !== String(card.item_id)) return;
        if (sib.direction !== 'prod' || String(sib.state) !== 'locked') return;
        updates[sib.card_id] = {
          _row: sib._row,
          patch: { state: 'new', due: '' }
        };
        sib.state = 'new';
        unlocked.push(sib.card_id);
      });
    }
  });

  var updateList = Object.keys(updates).map(function (k) { return updates[k]; });
  writeCardUpdates_(updateList);
  appendReviewLog_(logRows);
  flushRecord_(batchId, applied);

  return {
    ok: true,
    applied: applied,
    skipped_duplicate: false,
    leeches_new: newLeeches,
    unlocked: unlocked
  };
}

// ==========================================================================
// Stats.gs
// ==========================================================================

/**
 * Аналитика: по блокам и по общей динамике.
 *
 * Считается на СЕРВЕРЕ, а не на клиенте, и это то же решение, что лежит в основе
 * всей архитектуры: журнал повторений растёт линейно со временем и уже сейчас
 * измеряется сотнями строк, а телефон получает два запроса на сессию. Отдавать
 * ему сырой журнал ради подсчёта среднего — тот же per-answer round trip, только
 * в профиль.
 *
 * Ачивки живут отдельно (Achievements.gs) и считаются ЧИСТОЙ функцией от того,
 * что вернёт этот файл: тогда их можно проверять без единого обращения к таблице.
 */

var STATS_WINDOW_DAYS = 30;

function dayKey_(ts, tz) {
  if (!ts) return '';
  var d = ts instanceof Date ? ts : new Date(String(ts));
  if (isNaN(d.getTime())) return String(ts).slice(0, 10);
  return Utilities.formatDate(d, tz || 'Europe/Moscow', 'yyyy-MM-dd');
}

/** Список последних N дат включительно по сегодня — ось графиков. */
function lastDays_(today, n) {
  var out = [];
  var base = Date.parse(today + 'T00:00:00Z');
  for (var i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function readReviewLog_() { return readRows_(logSheetName_(), LOG_COLUMNS); }
function readGrammarLog_() { return readRows_(grammarLogSheetName_(), GRAMMAR_LOG_COLUMNS); }

/**
 * Удержание — доля оценок «Помню» и «Легко» от всех повторений.
 *
 * Считается ТОЛЬКО по повторениям зрелых карточек, то есть без первого показа:
 * первый ответ на невиданное слово почти всегда «не помню», и если мешать его в
 * общую долю, метрика будет измерять темп ввода новых слов, а не память.
 */
function retention_(entries) {
  var graded = entries.filter(function (e) { return Number(e.elapsed_days) > 0; });
  if (!graded.length) return null;
  var good = graded.filter(function (e) { return Number(e.rating) >= 3; }).length;
  return +(good / graded.length).toFixed(3);
}

/**
 * Сколько зрелых повторений стоит за долей. Без этого числа само удержание
 * бесполезно: 60% по пяти повторениям это шум, по шестидесяти — диагноз, а на
 * экране обе цифры выглядят одинаково убедительно.
 */
function graded_(entries) {
  return entries.filter(function (e) { return Number(e.elapsed_days) > 0; }).length;
}

function within_(entries, days, today, tz) {
  var edge = Date.parse(today + 'T00:00:00Z') - (days - 1) * 86400000;
  return entries.filter(function (e) {
    var k = dayKey_(e.ts, tz);
    return k && Date.parse(k + 'T00:00:00Z') >= edge;
  });
}

/** Сколько дней подряд, считая назад от сегодня, была хотя бы одна оценка. */
function streak_(daysWithWork, today) {
  var set = {};
  daysWithWork.forEach(function (d) { set[d] = true; });
  var n = 0;
  var t = Date.parse(today + 'T00:00:00Z');
  // Сегодняшний день не обрывает серию, если он ещё не начат: считаем со вчера,
  // иначе утром серия обнулялась бы каждый день до первой карточки.
  if (!set[today]) t -= 86400000;
  while (set[new Date(t).toISOString().slice(0, 10)]) { n++; t -= 86400000; }
  return n;
}

function buildStats(userId) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var axis = lastDays_(today, STATS_WINDOW_DAYS);

  var mine = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var myPatterns = readPatterns_().filter(function (p) { return String(p.user_id) === String(userId); });

  var log = [], glog = [];
  try { log = readReviewLog_(); } catch (e) { log = []; }
  try { glog = readGrammarLog_(); } catch (e) { glog = []; }

  // --- лексика ---
  var byState = {};
  mine.forEach(function (c) {
    var s = String(c.state || 'new');
    byState[s] = (byState[s] || 0) + 1;
  });
  var learned = mine.filter(function (c) { return c.first_review; }).length;
  var stab = mine.filter(function (c) { return Number(c.stability) > 0; })
    .map(function (c) { return Number(c.stability); });

  // --- ряды по дням ---
  var perDay = {}, perDayG = {}, introduced = {};
  log.forEach(function (e) {
    var k = dayKey_(e.ts, tz);
    if (k) perDay[k] = (perDay[k] || 0) + 1;
  });
  glog.forEach(function (e) {
    var k = dayKey_(e.ts, tz);
    if (k) perDayG[k] = (perDayG[k] || 0) + 1;
  });
  mine.forEach(function (c) {
    var k = dayKey_(c.first_review, tz);
    if (k) introduced[k] = (introduced[k] || 0) + 1;
  });

  // Освоено накопительно: сколько единиц было введено ДО начала окна плюс прирост
  // по дням. Без базы график начинался бы с нуля и врал бы про объём словаря.
  var beforeWindow = 0;
  Object.keys(introduced).forEach(function (k) { if (k < axis[0]) beforeWindow += introduced[k]; });
  var cumulative = [], running = beforeWindow;
  axis.forEach(function (d) { running += (introduced[d] || 0); cumulative.push(running); });

  var daysWithWork = Object.keys(perDay).concat(Object.keys(perDayG));

  function block(entries, cards, kind) {
    var w7 = within_(entries, 7, today, tz), w30 = within_(entries, 30, today, tz);
    return {
      kind: kind,
      total: cards.total,
      learned: cards.learned,
      in_progress: cards.in_progress,
      fresh: cards.fresh,
      leeches: cards.leeches || 0,
      reviews_7d: w7.length,
      reviews_30d: w30.length,
      retention_7d: retention_(w7),
      retention_7d_n: graded_(w7),
      retention_30d: retention_(w30),
      retention_30d_n: graded_(w30),
      // Первые показы. Они не участвуют в удержании, но объясняют, почему выборка
      // мала: пока вводится много новых, зрелых повторений почти нет.
      first_exposures_7d: w7.length - graded_(w7),
      avg_stability_days: cards.avgStability
    };
  }

  var vocab = block(log, {
    total: mine.length,
    learned: learned,
    in_progress: (byState.review || 0) + (byState.relearning || 0),
    fresh: byState['new'] || 0,
    leeches: byState.leech || 0,
    avgStability: stab.length ? +(stab.reduce(function (a, b) { return a + b; }, 0) / stab.length).toFixed(1) : null
  }, 'vocab');

  var gstab = myPatterns.filter(function (p) { return Number(p.stability) > 0; })
    .map(function (p) { return Number(p.stability); });
  var grammar = block(glog, {
    total: myPatterns.length,
    learned: myPatterns.filter(function (p) { return p.first_review; }).length,
    in_progress: myPatterns.filter(function (p) {
      var s = String(p.state || 'new'); return s === 'review' || s === 'relearning';
    }).length,
    fresh: myPatterns.filter(function (p) { return String(p.state || 'new') === 'new'; }).length,
    avgStability: gstab.length ? +(gstab.reduce(function (a, b) { return a + b; }, 0) / gstab.length).toFixed(1) : null
  }, 'grammar');

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    window_days: STATS_WINDOW_DAYS,
    blocks: { vocab: vocab, grammar: grammar },
    series: {
      days: axis,
      reviews: axis.map(function (d) { return perDay[d] || 0; }),
      grammar_reviews: axis.map(function (d) { return perDayG[d] || 0; }),
      learned_cumulative: cumulative
    },
    totals: {
      reviews_all_time: log.length + glog.length,
      streak_days: streak_(daysWithWork, today),
      active_days: Object.keys(perDay).concat(Object.keys(perDayG))
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).length
    }
  };
}

/**
 * CSV журнала повторений — чтобы анализировать чем угодно, а не только этим экраном.
 * Разделитель — запятая, значения экранируются: в примерах встречаются и запятые,
 * и кавычки, и перевод строки.
 */
function csvEscape_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportReviewsCsv(userId) {
  var cards = {};
  readCards_().forEach(function (c) {
    if (String(c.user_id) === String(userId)) cards[String(c.card_id)] = c;
  });

  var log = [];
  try { log = readReviewLog_(); } catch (e) { log = []; }

  var head = ['ts', 'block', 'card_id', 'en', 'ru', 'direction', 'layer', 'type',
    'rating', 'elapsed_days', 'interval_days', 'stability', 'difficulty'];
  var rows = [head.join(',')];

  log.forEach(function (e) {
    var c = cards[String(e.card_id)];
    if (!c) return;   // чужие строки и удалённые карточки в выгрузку не идут
    rows.push([e.ts, 'vocab', e.card_id, c.en, c.ru, c.direction, c.layer, c.type,
      e.rating, e.elapsed_days, e.interval_days, e.stability, e.difficulty]
      .map(csvEscape_).join(','));
  });

  var patterns = {};
  readPatterns_().forEach(function (p) {
    if (String(p.user_id) === String(userId)) patterns[String(p.pattern_id)] = p;
  });
  var glog = [];
  try { glog = readGrammarLog_(); } catch (e) { glog = []; }
  glog.forEach(function (e) {
    var p = patterns[String(e.pattern_id)];
    if (!p) return;
    rows.push([e.ts, 'grammar', e.pattern_id, p.label, p.title_ru, '', '', '',
      e.rating, e.elapsed_days, e.interval_days, e.stability, e.difficulty]
      .map(csvEscape_).join(','));
  });

  return { csv: rows.join('\n'), rows: rows.length - 1 };
}

// ==========================================================================
// Achievements.gs
// ==========================================================================

/**
 * Ачивки.
 *
 * ЧИСТАЯ функция от того, что вернул buildStats: ни одного обращения к таблице,
 * ни одного new Date(). Поэтому весь набор проверяется юнит-тестом на выдуманных
 * числах, а не «прокликиванием» вживую — а прокликать тридцатидневную серию
 * вживую нельзя в принципе.
 *
 * Выданные ачивки хранятся в settings отдельно (grantAchievements_), но экран
 * от хранилища не зависит: список каждый раз выводится из метрик заново. Потеря
 * строки в settings стоит одного уведомления в чат, а не самих достижений.
 *
 * Про тон: чёрный юмор — сознательный выбор владельца. Единственная граница,
 * которую я держу сам: ни одной шутки про реальные катастрофы и погибших.
 * Корпоративные скандалы, прокрастинация и самоирония — сколько угодно.
 */

function pct_(cur, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(1, cur / target));
}

function evaluateAchievements(stats) {
  var v = stats.blocks.vocab;
  var g = stats.blocks.grammar;
  var t = stats.totals;

  var defs = [
    { id: 'taxiing', title: 'Руление', hint: 'Первые 10 повторений',
      note: 'Ещё никуда не летим, но двигатели уже жрут.',
      cur: t.reviews_all_time, target: 10 },

    { id: 'first_flight', title: 'Первый взлёт', hint: 'Первая закрытая сессия',
      note: 'Отрыв произошёл. Дальше только набор высоты и турбулентность.',
      cur: Math.min(t.reviews_all_time, 1), target: 1 },

    { id: 'second_engine', title: 'Второй двигатель', hint: 'Первая сессия грамматики',
      note: 'На одном тоже летают. Просто не так далеко.',
      cur: Math.min(g.reviews_30d + (g.learned ? 1 : 0), 1), target: 1 },

    { id: 'gear_up', title: 'Шасси убраны', hint: '3 дня подряд',
      note: 'Три дня — это уже не случайность, это пока ещё не привычка.',
      cur: t.streak_days, target: 3 },

    { id: 'flight_level', title: 'Занял эшелон', hint: '14 дней подряд',
      note: 'Две недели. Организм смирился.',
      cur: t.streak_days, target: 14 },

    { id: 'autopilot', title: 'Автопилот', hint: '30 дней подряд',
      note: 'Решения принимает расписание. Ты просто на борту.',
      cur: t.streak_days, target: 30 },

    { id: 'turbo', title: 'Турбина раскрутилась', hint: '100 повторений',
      note: 'Лаг закончился, началась тяга.',
      cur: t.reviews_all_time, target: 100 },

    { id: 'quattro', title: 'Quattro', hint: '444 повторения',
      note: 'Четыре кольца, четыре сотни. Сцепление с материалом на всех колёсах.',
      cur: t.reviews_all_time, target: 444 },

    { id: 'black_box', title: 'Чёрный ящик', hint: '1000 повторений',
      note: 'Записано всё. В том числе то, что ты предпочёл бы не вспоминать.',
      cur: t.reviews_all_time, target: 1000 },

    { id: 'rs6', title: 'RS6', hint: '500 повторений за 30 дней',
      note: 'Избыточная мощность для поездки за хлебом. И всё равно берут.',
      cur: v.reviews_30d + g.reviews_30d, target: 500 },

    { id: 'overhead_bin', title: 'Багажная полка', hint: '100 освоенных единиц',
      note: 'Ручная кладь набита. Взвешивать никто не станет.',
      cur: v.learned, target: 100 },

    { id: 'cruise', title: 'Крейсерский режим', hint: 'Средняя стабильность 21 день',
      note: 'Материал держится сам. Можно отстегнуть ремни.',
      cur: v.avg_stability_days || 0, target: 21 },

    { id: 's_line', title: 'S line', hint: 'Удержание 90% на 50+ повторениях за неделю',
      note: 'Внешне спортивно, под капотом обычный мотор. Работает же.',
      cur: (v.reviews_7d >= 50 && v.retention_7d !== null) ? Math.round(v.retention_7d * 100) : 0,
      target: 90 },

    { id: 'dieselgate', title: 'Дизельгейт', hint: 'Удержание 95% за месяц',
      note: 'Показатели подозрительно хорошие. Проверять, к счастью, некому.',
      cur: v.retention_30d !== null ? Math.round(v.retention_30d * 100) : 0, target: 95 },

    { id: 'go_around', title: 'Уход на второй круг', hint: '10 пиявок',
      note: 'Десять слов зашли неудачно. Это не про тебя, это про формулировки.',
      cur: v.leeches, target: 10 },

    { id: 'holding', title: 'Зона ожидания', hint: '200 слов в запасе',
      note: 'Двести единиц кружат и ждут разрешения на посадку.',
      cur: v.fresh, target: 200 },

    { id: 'maintenance', title: 'ТО пройдено', hint: '300 повторений и ни одной пиявки',
      note: 'Ни одного узла под замену. Подозрительно.',
      cur: (v.leeches === 0 ? t.reviews_all_time : 0), target: 300 }
  ];

  var unlocked = 0;
  var list = defs.map(function (d) {
    var done = d.cur >= d.target;
    if (done) unlocked++;
    return {
      id: d.id, title: d.title, hint: d.hint, note: d.note,
      unlocked: done,
      current: Math.round(d.cur), target: d.target,
      progress: +pct_(d.cur, d.target).toFixed(3)
    };
  });

  // Анти-ачивка: показывается ТОЛЬКО когда заслужена, иначе это просто упрёк
  // в интерфейсе на пустом месте.
  if (t.streak_days === 0 && t.reviews_all_time > 0) {
    list.push({
      id: 'parking_brake', title: 'Стояночный тормоз', hint: 'Серия прервана',
      note: 'Ты не занимался. Мы оба это знаем.',
      unlocked: true, current: 1, target: 1, progress: 1
    });
    unlocked++;
  }

  return { list: list, unlocked: unlocked, total: list.length };
}

/**
 * Диффует выданное с сохранённым и возвращает ТОЛЬКО новые — чтобы бот объявлял
 * их один раз, а не каждое утро заново.
 */
function grantAchievements_(stats) {
  var settings = readSettings_();
  var known = String(settings.achievements || '').split(',')
    .map(function (s) { return s.trim(); }).filter(Boolean);

  var earned = evaluateAchievements(stats).list
    .filter(function (a) { return a.unlocked; }).map(function (a) { return a.id; });

  var fresh = earned.filter(function (id) { return known.indexOf(id) < 0; });
  if (fresh.length) writeSetting_('achievements', known.concat(fresh).join(','));
  return fresh;
}

// ==========================================================================
// Grammar.gs
// ==========================================================================

/**
 * Grammar block. What makes it different from the vocabulary block, in one line:
 * FSRS state lives on the PATTERN, and every review draws different sentences
 * from that pattern's pool.
 *
 * If the same sentence came back on schedule, the thing that got strengthened
 * would be the sentence. The rule is what has to transfer into speech, so the
 * rule is what gets scheduled — see docs/spec-grammar.md.
 *
 * One GET brings the whole grammar block down, including item pools for every
 * introduced pattern. That is deliberate: picking a pattern by hand must not cost
 * a round trip, and the whole block then works offline for free.
 */

/**
 * Rating is derived from what actually happened, not self-reported.
 *
 * Grammar differs from vocabulary here: "did I know this word" is only knowable
 * by the learner, but "is this sentence correct" is objectively checkable. Asking
 * for a self-rating on top of an objective check would be inventing noise.
 *
 * Revealing a hint caps the round at GOOD. Without that cap, a hinted answer
 * would look identical to a known one and the interval would grow on borrowed
 * knowledge — the scheduler would be lying to itself.
 */
function grammarRating_(errors, hints, total) {
  if (!total) return RATING_GOOD;
  if (errors === 0) return hints > 0 ? RATING_GOOD : RATING_EASY;
  if (errors * 3 <= total) return RATING_HARD;
  return RATING_AGAIN;
}

function grammarSettings_(settings) {
  return {
    tz: settings.timezone || 'Europe/Moscow',
    retention: parseFloat(settings.grammar_desired_retention) || 0.9,
    perRound: parseInt(settings.grammar_items_per_round, 10) || 3,
    sessionCap: parseInt(settings.grammar_session_cap, 10) || 8,
    newTarget: parseInt(settings.grammar_daily_new_target, 10) || 1,
    leechThreshold: parseInt(settings.leech_threshold, 10) || 5
  };
}

/**
 * Pool rotation: least-served first, oldest-served next. Ties broken by item_id
 * so the order is stable rather than accidental — an unstable tie-break would make
 * the same call return different pools and nothing would be reproducible.
 */
function sortPool_(items) {
  return items.slice().sort(function (a, b) {
    var sa = Number(a.serve_count) || 0;
    var sb = Number(b.serve_count) || 0;
    if (sa !== sb) return sa - sb;
    var la = String(a.last_served || '');
    var lb = String(b.last_served || '');
    if (la !== lb) return la < lb ? -1 : 1;
    return String(a.item_id) < String(b.item_id) ? -1 : 1;
  });
}

function publicItem_(it) {
  return {
    item_id: it.item_id,
    pattern_id: it.pattern_id,
    kind: it.kind,
    prompt_ru: it.prompt_ru,
    stem: it.stem,
    answer: it.answer,
    tokens: it.tokens ? String(it.tokens).split('|').map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; }) : [],
    hint_ru: it.hint_ru
  };
}

/**
 * The whole grammar block in one payload:
 *   patterns — every pattern with its due state, for the picker
 *   pools    — items for the patterns that are playable right now
 *   queue    — pattern ids in scheduler order, for the "mixed" mode
 */
function buildGrammarSession(userId) {
  var settings = readSettings_();
  var g = grammarSettings_(settings);
  var today = todayStr_(g.tz);

  var all = readPatterns_();
  var mine = all.filter(function (p) { return String(p.user_id) === String(userId); });

  var items = readGrammarItems_();
  var byPattern = {};
  items.forEach(function (it) {
    var k = String(it.pattern_id);
    if (!byPattern[k]) byPattern[k] = [];
    byPattern[k].push(it);
  });

  var introducedToday = 0;
  mine.forEach(function (p) {
    if (p.first_review && dateKey_(p.first_review, g.tz) === today) introducedToday++;
  });
  var newAllowance = Math.max(g.newTarget - introducedToday, 0);

  mine.sort(function (a, b) {
    var oa = Number(a.order_index) || 0;
    var ob = Number(b.order_index) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.pattern_id) < String(b.pattern_id) ? -1 : 1;
  });

  var due = [];
  var fresh = [];
  var later = [];
  mine.forEach(function (p) {
    var state = String(p.state || 'new');
    if (state === 'suspended') return;
    var pool = byPattern[String(p.pattern_id)] || [];
    if (!pool.length) return;                       // a pattern with no sentences is not playable
    if (state === 'new') { fresh.push(p); return; }
    var dueStr = dateKey_(p.due, g.tz);
    if (dueStr && dueStr <= today) due.push(p); else later.push(p);
  });

  // Debt before growth, exactly as in the vocabulary block.
  var queue = due.concat(fresh.slice(0, newAllowance)).slice(0, g.sessionCap);

  // Pools are sent for everything playable, not only for the queue: choosing a
  // pattern by hand is a first-class mode and must not need another round trip.
  var pools = {};
  var poolDepth = g.perRound * 2;
  due.concat(fresh, later).forEach(function (p) {
    var key = String(p.pattern_id);
    if (pools[key]) return;
    pools[key] = sortPool_(byPattern[key]).slice(0, poolDepth).map(publicItem_);
  });

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    settings: {
      items_per_round: g.perRound,
      desired_retention: g.retention,
      daily_new_target: g.newTarget,
      session_cap: g.sessionCap
    },
    patterns: mine.map(function (p) {
      var pool = byPattern[String(p.pattern_id)] || [];
      var dueStr = dateKey_(p.due, g.tz);
      return {
        pattern_id: p.pattern_id,
        order_index: Number(p.order_index) || 0,
        label: p.label,
        title_ru: p.title_ru,
        notes_slug: p.notes_slug,
        state: String(p.state || 'new'),
        due: dueStr,
        is_due: String(p.state) !== 'new' && !!dueStr && dueStr <= today,
        reps: Number(p.reps) || 0,
        lapses: Number(p.lapses) || 0,
        pool_size: pool.length
      };
    }),
    pools: pools,
    queue: queue.map(function (p) { return String(p.pattern_id); }),
    counts: {
      total: mine.length,
      due: due.length,
      new_available: fresh.length,
      new_in_session: Math.min(fresh.length, newAllowance),
      new_introduced_today: introducedToday,
      new_allowance_left: newAllowance,
      scheduled: later.length
    }
  };
}

/**
 * rounds: [{ pattern_id, results: [{ item_id, correct, hint_used }], ts }]
 *
 * The client sends what happened, never a rating: the derivation lives here so
 * there is exactly one copy of it. Answer checking stays on the client because
 * that is where the immediate feedback has to be rendered anyway, and this is a
 * single-user system — the deliberate trust boundary is written down in
 * docs/spec-grammar.md rather than left implicit.
 */
function applyGrammarFlush(userId, batchId, rounds) {
  if (!batchId) return { ok: false, code: 'BAD_REQUEST', message: 'batch_id is required' };
  if (!rounds || !rounds.length) return { ok: true, applied: 0, skipped_duplicate: false };

  if (flushSeen_(batchId)) return { ok: true, applied: 0, skipped_duplicate: true };

  var settings = readSettings_();
  var g = grammarSettings_(settings);
  var today = todayStr_(g.tz);

  var patterns = readPatterns_();
  var byId = {};
  patterns.forEach(function (p) { byId[String(p.pattern_id)] = p; });

  var items = readGrammarItems_();
  var itemById = {};
  items.forEach(function (it) { itemById[String(it.item_id)] = it; });

  var patternUpdates = {};
  var itemUpdates = {};
  var logRows = [];
  var outcomes = [];
  var applied = 0;

  rounds.forEach(function (round) {
    var p = byId[String(round.pattern_id)];
    if (!p) return;
    if (String(p.user_id) !== String(userId)) return;
    var results = round.results || [];
    if (!results.length) return;

    var errors = 0;
    var hints = 0;
    results.forEach(function (r) {
      if (!r.correct) errors++;
      if (r.hint_used) hints++;
      var it = itemById[String(r.item_id)];
      if (!it) return;
      // Serve counters drive pool rotation. Bumped on flush rather than on build,
      // so an abandoned session does not burn through the pool.
      itemUpdates[String(r.item_id)] = {
        _row: it._row,
        patch: {
          serve_count: (Number(it.serve_count) || 0) + 1,
          last_served: today
        }
      };
    });

    var rating = grammarRating_(errors, hints, results.length);
    var elapsed = p.last_review ? daysBetween_(p.last_review, today) : 0;
    var out = fsrsReview({
      stability: p.stability === '' ? null : Number(p.stability),
      difficulty: p.difficulty === '' ? null : Number(p.difficulty),
      reps: Number(p.reps) || 0,
      lapses: Number(p.lapses) || 0
    }, rating, elapsed, { desiredRetention: g.retention });

    var dueDate = new Date(new Date(today + 'T00:00:00Z').getTime() + out.intervalDays * 86400000);
    var dueStr = Utilities.formatDate(dueDate, 'UTC', 'yyyy-MM-dd');

    var patch = {
      state: 'review', due: dueStr,
      stability: out.stability, difficulty: out.difficulty,
      reps: out.reps, lapses: out.lapses, last_review: today
    };
    if (!p.first_review) { patch.first_review = today; p.first_review = today; }

    // A pattern reviewed twice in one session must chain, not overwrite: the
    // second round has to start from the state the first one left behind.
    p.stability = out.stability;
    p.difficulty = out.difficulty;
    p.reps = out.reps;
    p.lapses = out.lapses;
    p.last_review = today;
    p.state = 'review';
    p.due = dueStr;

    patternUpdates[String(p.pattern_id)] = { _row: p._row, patch: patch };

    logRows.push([p.pattern_id, round.ts || new Date().toISOString(), rating,
      errors, hints, results.length, elapsed, out.intervalDays,
      out.stability, out.difficulty, batchId]);

    outcomes.push({
      pattern_id: p.pattern_id,
      label: p.label,
      rating: rating,
      errors: errors,
      hints: hints,
      items: results.length,
      interval_days: out.intervalDays,
      due: dueStr
    });
    applied++;
  });

  writePatternUpdates_(Object.keys(patternUpdates).map(function (k) { return patternUpdates[k]; }));
  writeGrammarItemUpdates_(Object.keys(itemUpdates).map(function (k) { return itemUpdates[k]; }));
  appendGrammarLog_(logRows);
  flushRecord_(batchId, applied);

  return { ok: true, applied: applied, skipped_duplicate: false, outcomes: outcomes };
}

// ==========================================================================
// Import.gs
// ==========================================================================

/**
 * inbox -> cards. Nothing happens silently: every rejected row lands in `rejects`
 * with a reason, and a duplicate is skipped rather than overwriting your data.
 */

function normalizeEn_(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Does the example actually use this unit?
 *
 * Literal substring matching cannot work for real collocations, and both failure
 * modes showed up in the very first batch:
 *   - determiners vary:  "roll out a feature"  ->  "we roll out the feature"
 *   - verbs inflect:     "take ownership of"   ->  "she took ownership of"
 *
 * So the check is token overlap, not containment: at least 60% of the unit's tokens
 * must appear in the example (a token counts if any example word contains it, which
 * covers plurals like vehicle/vehicles). That still catches the failure worth catching
 * — a generator that paired the wrong sentence — and stops rejecting correct English.
 */
function matchTokens_(s) {
  return normalizeEn_(s)
    .replace(/[.,;:!?()"'\-]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .split(/\s+/)
    .filter(function (t) { return t.length > 1; });
}

function exampleUsesUnit_(en, example) {
  var unit = matchTokens_(en);
  if (!unit.length) return true;
  var words = matchTokens_(example);
  var hit = 0;
  unit.forEach(function (t) {
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(t) >= 0 || t.indexOf(words[i]) >= 0) { hit++; return; }
    }
  });
  return hit / unit.length >= 0.6;
}

function makeId_(prefix) {
  return prefix + '_' + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 4);
}

function validateImportRow_(row, lineNo) {
  var r = {};
  IMPORT_COLUMNS.forEach(function (c, i) { r[c] = String(row[i] === null || row[i] === undefined ? '' : row[i]).trim(); });

  if (!r.en) return { error: 'en is empty' };
  if (!r.ru) return { error: 'ru is empty' };
  if (r.en.length > 80) return { error: 'en longer than 80 chars (' + r.en.length + ')' };
  if (VALID_TYPES.indexOf(r.type) < 0) {
    return { error: 'type must be one of ' + VALID_TYPES.join('|') + ', got "' + r.type + '"' };
  }
  if (VALID_LAYERS.indexOf(r.layer) < 0) {
    return { error: 'layer must be one of ' + VALID_LAYERS.join('|') + ', got "' + r.layer + '"' };
  }
  if (r.type !== 'word' && !r.example_en) {
    return { error: 'example_en is required for type ' + r.type };
  }
  if (r.example_en && !exampleUsesUnit_(r.en, r.example_en)) {
    return { error: 'example_en does not use en (token overlap below 60%)' };
  }
  return { row: r };
}

/**
 * Reads the inbox tab, validates, appends accepted rows as two cards each.
 * Returns a report object; the caller decides how to show it.
 */
function importInbox(userId) {
  var sh = sheet_(SHEET_INBOX);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { accepted: 0, rejected: 0, duplicates: 0, message: 'inbox is empty' };

  var raw = sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).getValues();
  var existing = {};
  readCards_().forEach(function (c) {
    if (String(c.direction) === 'recog') existing[normalizeEn_(c.en)] = true;
  });

  var batch = makeId_('imp');
  var now = new Date().toISOString();
  var cardRows = [];
  var rejects = [];
  var duplicates = 0;
  var seenInBatch = {};

  for (var i = 0; i < raw.length; i++) {
    var lineNo = i + 2;
    if (!String(raw[i][1] || '').trim() && !String(raw[i][0] || '').trim()) continue; // blank line

    var v = validateImportRow_(raw[i], lineNo);
    if (v.error) {
      rejects.push([lineNo, v.error, now].concat(raw[i]));
      continue;
    }
    var key = normalizeEn_(v.row.en);
    if (existing[key] || seenInBatch[key]) {
      duplicates++;
      rejects.push([lineNo, 'duplicate of an existing card', now].concat(raw[i]));
      continue;
    }
    seenInBatch[key] = true;

    var itemId = makeId_('i');
    var r = v.row;
    ['recog', 'prod'].forEach(function (dir) {
      var row = [];
      var values = {
        card_id: makeId_('c'), item_id: itemId, direction: dir, type: r.type,
        en: r.en, ru: r.ru, example_en: r.example_en, example_ru: r.example_ru,
        layer: r.layer, topic: r.topic, note: r.note, breakdown: r.breakdown,
        state: dir === 'recog' ? 'new' : 'locked',
        due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
        last_review: '', created_at: now, user_id: userId, source_batch: batch,
        first_review: ''
      };
      CARD_COLUMNS.forEach(function (c) { row.push(values[c]); });
      cardRows.push(row);
    });
  }

  if (cardRows.length) appendCards_(cardRows);

  if (rejects.length) {
    var rj = sheet_(SHEET_REJECTS);
    var width = 3 + IMPORT_COLUMNS.length;
    var padded = rejects.map(function (r) {
      while (r.length < width) r.push('');
      return r.slice(0, width);
    });
    rj.getRange(rj.getLastRow() + 1, 1, padded.length, width).setValues(padded);
  }

  // Clear the inbox only after everything above succeeded.
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).clearContent();

  return {
    accepted: cardRows.length / 2,
    cards_created: cardRows.length,
    rejected: rejects.length - duplicates,
    duplicates: duplicates,
    batch: batch
  };
}

/** Removes every card from one import batch. The escape hatch for a bad load. */
function rollbackBatch(batchId) {
  var sh = sheet_(SHEET_CARDS);
  var cards = readCards_();
  var rows = cards.filter(function (c) { return String(c.source_batch) === String(batchId); })
    .map(function (c) { return c._row; })
    .sort(function (a, b) { return b - a; });   // delete bottom-up so indices hold
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    rows.forEach(function (r) { sh.deleteRow(r); });
  } finally {
    lock.releaseLock();
  }
  return rows.length;
}

// ==========================================================================
// GrammarImport.gs
// ==========================================================================

/**
 * grammar_inbox -> patterns + grammar_items.
 *
 * The inbox is deliberately flat and denormalised: pattern metadata repeats on
 * every row. That is what makes a generated TSV pasteable in one go, and the
 * pattern row is created here on first sight rather than by hand.
 *
 * Structural validation only. Whether a typed answer counts as correct is decided
 * on the client (app/answer.js) — see docs/spec-grammar.md for why the boundary
 * sits there.
 */

var GRAMMAR_GAP = '___';

function collapse_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Structural comparison for the tokens/answer cross-check: case and punctuation off. */
function bareText_(s) {
  return collapse_(s).toLowerCase().replace(/[.,;:!?"()]/g, '').replace(/\s+/g, ' ').trim();
}

/** Identity of an exercise: pattern, kind, prompt shown, answer expected. */
function grammarItemKey_(it) {
  return [String(it.pattern_id), String(it.kind),
    bareText_(it.stem), bareText_(it.tokens), bareText_(String(it.answer).split('||')[0])].join('|');
}

function firstAlternative_(answer) {
  return collapse_(String(answer).split('||')[0]);
}

function validateGrammarRow_(row) {
  var r = {};
  GRAMMAR_IMPORT_COLUMNS.forEach(function (c, i) { r[c] = collapse_(row[i]); });

  if (!r.pattern_id) return { error: 'pattern_id is empty' };
  if (!/^[a-z0-9_]+$/.test(r.pattern_id)) {
    return { error: 'pattern_id must be lower_snake_case, got "' + r.pattern_id + '"' };
  }
  if (!r.label) return { error: 'label is empty — it is the chip shown on every screen' };
  if (!r.title_ru) return { error: 'title_ru is empty' };
  var order = parseInt(r.order_index, 10);
  if (isNaN(order) || order < 0) return { error: 'order_index must be a non-negative number' };
  r.order_index = order;
  if (!r.notes_slug) r.notes_slug = r.pattern_id;

  if (VALID_KINDS.indexOf(r.kind) < 0) {
    return { error: 'kind must be one of ' + VALID_KINDS.join('|') + ', got "' + r.kind + '"' };
  }
  if (!r.answer) return { error: 'answer is empty' };
  // A hint that does not exist cannot explain anything, and an unexplained
  // correction teaches the answer instead of the rule.
  if (!r.hint_ru) return { error: 'hint_ru is empty — every item must be able to explain itself' };
  if (r.answer.indexOf(GRAMMAR_GAP) >= 0) return { error: 'answer must not contain ' + GRAMMAR_GAP };

  if (r.kind === 'scramble') {
    if (!r.tokens) return { error: 'tokens are required for kind scramble' };
    var toks = r.tokens.split('|').map(collapse_).filter(function (t) { return t.length > 0; });
    if (toks.length < 3) {
      return { error: 'scramble needs at least 3 tokens, got ' + toks.length };
    }
    // The cross-check that catches the mistake actually worth catching: tokens that
    // do not assemble into the answer make the exercise unsolvable.
    if (bareText_(toks.join(' ')) !== bareText_(firstAlternative_(r.answer))) {
      return {
        error: 'tokens do not assemble into answer: "' + toks.join(' ') +
          '" vs "' + firstAlternative_(r.answer) + '"'
      };
    }
    if (!r.prompt_ru) {
      return { error: 'prompt_ru is required for scramble — without the meaning it is a word puzzle' };
    }
    r.tokens = toks.join('|');
  } else {
    if (!r.stem) return { error: 'stem is required for kind ' + r.kind };
    if (r.tokens) return { error: 'tokens only apply to kind scramble' };
  }

  if (r.kind === 'gapfill') {
    if (r.stem.indexOf(GRAMMAR_GAP) < 0) {
      return { error: 'gapfill stem must contain the gap marker ' + GRAMMAR_GAP };
    }
  }
  if (r.kind === 'transform' || r.kind === 'fix') {
    if (bareText_(r.stem) === bareText_(firstAlternative_(r.answer))) {
      return { error: 'stem and answer are identical — nothing to ' + r.kind };
    }
    if (r.kind === 'transform' && !r.prompt_ru) {
      return { error: 'prompt_ru is required for transform — it names the target form' };
    }
  }

  return { row: r };
}

function importGrammarInbox(userId) {
  var sh = sheet_(SHEET_GRAMMAR_INBOX);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return { accepted: 0, rejected: 0, duplicates: 0, patterns_created: 0, message: 'grammar_inbox is empty' };
  }

  var raw = sh.getRange(2, 1, lastRow - 1, GRAMMAR_IMPORT_COLUMNS.length).getValues();

  var patterns = readPatterns_();
  var patternById = {};
  patterns.forEach(function (p) { patternById[String(p.pattern_id)] = p; });

  // The dedupe key has to include the stem, not only the answer: two different
  // gap-fills inside one pattern legitimately share a one-word answer like "the",
  // and keying on the answer alone threw the second one away as a duplicate.
  var existing = {};
  readGrammarItems_().forEach(function (it) { existing[grammarItemKey_(it)] = true; });

  var batch = makeId_('gimp');
  var now = new Date().toISOString();
  var itemRows = [];
  var patternRows = [];
  var newPatterns = {};
  var rejects = [];
  var duplicates = 0;
  var seenInBatch = {};

  for (var i = 0; i < raw.length; i++) {
    var lineNo = i + 2;
    if (!collapse_(raw[i][0]) && !collapse_(raw[i][8])) continue;      // blank line

    var v = validateGrammarRow_(raw[i]);
    if (v.error) {
      rejects.push([lineNo, v.error, now].concat(raw[i]));
      continue;
    }
    var r = v.row;
    var key = grammarItemKey_(r);
    if (existing[key] || seenInBatch[key]) {
      duplicates++;
      rejects.push([lineNo, 'duplicate of an existing item', now].concat(raw[i]));
      continue;
    }
    seenInBatch[key] = true;

    if (!patternById[r.pattern_id] && !newPatterns[r.pattern_id]) {
      var pvalues = {
        pattern_id: r.pattern_id, order_index: r.order_index, label: r.label,
        title_ru: r.title_ru, notes_slug: r.notes_slug,
        state: 'new', due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
        last_review: '', first_review: '', created_at: now,
        user_id: userId, source_batch: batch
      };
      var prow = [];
      PATTERN_COLUMNS.forEach(function (c) { prow.push(pvalues[c]); });
      patternRows.push(prow);
      newPatterns[r.pattern_id] = true;
    }

    var ivalues = {
      item_id: makeId_('gi'), pattern_id: r.pattern_id, kind: r.kind,
      prompt_ru: r.prompt_ru, stem: r.stem, answer: r.answer, tokens: r.tokens,
      hint_ru: r.hint_ru, serve_count: 0, last_served: '',
      created_at: now, source_batch: batch
    };
    var irow = [];
    GRAMMAR_ITEM_COLUMNS.forEach(function (c) { irow.push(ivalues[c]); });
    itemRows.push(irow);
  }

  if (patternRows.length) appendRows_(SHEET_PATTERNS, PATTERN_COLUMNS, patternRows);
  if (itemRows.length) appendRows_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS, itemRows);

  if (rejects.length) {
    var rj = sheet_(SHEET_GRAMMAR_REJECTS);
    var width = 3 + GRAMMAR_IMPORT_COLUMNS.length;
    var padded = rejects.map(function (x) {
      while (x.length < width) x.push('');
      return x.slice(0, width);
    });
    rj.getRange(rj.getLastRow() + 1, 1, padded.length, width).setValues(padded);
  }

  sh.getRange(2, 1, lastRow - 1, GRAMMAR_IMPORT_COLUMNS.length).clearContent();

  return {
    accepted: itemRows.length,
    patterns_created: patternRows.length,
    rejected: rejects.length - duplicates,
    duplicates: duplicates,
    batch: batch
  };
}

/** Removes every pattern and item from one grammar import batch. */
function rollbackGrammarBatch(batchId) {
  var removed = { items: 0, patterns: 0 };
  [[SHEET_GRAMMAR_ITEMS, readGrammarItems_(), 'items'],
   [SHEET_PATTERNS, readPatterns_(), 'patterns']].forEach(function (spec) {
    var sh = sheet_(spec[0]);
    var rows = spec[1].filter(function (x) { return String(x.source_batch) === String(batchId); })
      .map(function (x) { return x._row; })
      .sort(function (a, b) { return b - a; });
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('LOCKED');
    try {
      rows.forEach(function (r) { sh.deleteRow(r); });
    } finally {
      lock.releaseLock();
    }
    removed[spec[2]] = rows.length;
  });
  return removed;
}

// ==========================================================================
// GrammarSeed.gs
// ==========================================================================

/**
 * The first grammar corpus: eight patterns, twelve items each, four exercise kinds.
 *
 * Which eight, and why these: not the textbook order. Russian has three tenses and
 * two aspects against twelve English forms, so the forms that cost a Russian speaker
 * the most are the perfect, the progressive, the copula `to be` (absent in the Russian
 * present), do-support in questions, and articles. Present Simple in the third person
 * is here for one reason only — the `-s` that keeps disappearing.
 *
 * Sentences come from kicksharing, hotel PMS and analyst work on purpose: grammar
 * drilled on sentences you would actually say at work pays twice.
 *
 * Columns: pattern_id, order_index, label, title_ru, notes_slug,
 *          kind, prompt_ru, stem, answer, tokens, hint_ru
 */
function grammarSeedRows_() {
  var P1 = ['to_be_present', 10, 'Present Simple · to be', 'Глагол «быть» в настоящем', 'to-be-present'];
  var P2 = ['present_simple_3sg', 20, 'Present Simple', 'Третье лицо: окончание -s', 'present-simple-3sg'];
  var P3 = ['present_vs_continuous', 30, 'Present Simple / Continuous', 'Вообще или прямо сейчас', 'present-vs-continuous'];
  var P4 = ['present_perfect_since_for', 40, 'Present Perfect', 'since / for: началось в прошлом, длится сейчас', 'present-perfect-since-for'];
  var P5 = ['present_perfect_vs_past', 50, 'Present Perfect / Past Simple', 'Результат сейчас или факт в прошлом', 'present-perfect-vs-past'];
  var P6 = ['questions_do_support', 60, 'Questions', 'Порядок слов и вспомогательный глагол', 'questions-do-support'];
  var P7 = ['past_simple_vs_continuous', 70, 'Past Simple / Past Continuous', 'Фон и то, что его прервало', 'past-simple-vs-continuous'];
  var P8 = ['articles_basic', 80, 'Articles', 'a / an / the и когда артикля нет', 'articles-basic'];

  var data = [
    /* --- to be в настоящем: русский обходится без связки, английский нет --- */
    [P1, 'scramble', 'Я продакт-маркетинг лид.', '', 'I am a product marketing lead.', 'I|am|a|product|marketing|lead', 'В русском «Я — лид» глагола нет вообще. В английском `am` обязателен: без него предложение не существует.'],
    [P1, 'scramble', 'Утилизация парка сегодня низкая.', '', 'Fleet utilization is low today.', 'Fleet|utilization|is|low|today', 'Подлежащее в третьем лице единственного числа берёт `is`.'],
    [P1, 'scramble', 'Мы не готовы к запуску в Бразилии.', '', 'We are not ready for the Brazil launch.', 'We|are|not|ready|for|the|Brazil|launch', 'Отрицание строится вставкой `not` после формы `to be`. Вспомогательный `do` здесь не нужен.'],
    [P1, 'gapfill', '', 'The rate plan ___ different on weekends.', 'is', '', '`The rate plan` — третье лицо единственного числа, значит `is`.'],
    [P1, 'gapfill', '', 'I ___ a business analyst at Libra Hospitality.', 'am', '', 'С `I` всегда `am`. Ни `is`, ни `are`.'],
    [P1, 'gapfill', '', 'The scooters ___ not available in this zone.', 'are', '', '`Scooters` — множественное число, значит `are`. Отрицание: `are not`.'],
    [P1, 'transform', '→ отрицание', 'The integration is ready.', "The integration is not ready.||The integration isn't ready.", '', 'Форма `to be` отрицается сама: `is not`. Добавлять `does not` — типичный перенос с обычных глаголов.'],
    [P1, 'transform', '→ вопрос', 'The report is correct.', 'Is the report correct?', '', 'Вопрос с `to be` — простая инверсия: форма глагола встаёт перед подлежащим, ничего не добавляется.'],
    [P1, 'transform', '→ подлежащее во множественном числе', 'The vehicle is idle.', 'The vehicles are idle.', '', 'Форма `to be` согласуется с подлежащим: `vehicle is` → `vehicles are`.'],
    [P1, 'fix', '', 'I product marketing lead at JET Sharing.', 'I am a product marketing lead at JET Sharing.', '', 'Пропущен `am` — калька с русского «Я лид». Плюс перед профессией нужен артикль `a`.'],
    [P1, 'fix', '', 'The guest folio are empty.', 'The guest folio is empty.', '', '`Folio` — единственное число, значит `is`, а не `are`.'],
    [P1, 'fix', '', 'She not in the office today.', "She is not in the office today.||She isn't in the office today.", '', 'Отрицание без формы `to be` невозможно: нужно `is not`.'],

    /* --- третье лицо и его -s --- */
    [P2, 'scramble', 'Система синхронизирует номерной фонд каждый час.', '', 'The system syncs room inventory every hour.', 'The|system|syncs|room|inventory|every|hour', '`The system` — третье лицо единственного числа, значит `syncs` с окончанием `-s`.'],
    [P2, 'scramble', 'Тарифный план меняется на выходных.', '', 'The rate plan changes on weekends.', 'The|rate|plan|changes|on|weekends', 'Регулярное действие идёт в Present Simple. Третье лицо → `changes`.'],
    [P2, 'scramble', 'Я собираю требования у трёх групп стейкхолдеров.', '', 'I gather requirements from three stakeholder groups.', 'I|gather|requirements|from|three|stakeholder|groups', 'С `I` окончания нет: `gather`, а не `gathers`.'],
    [P2, 'gapfill', '', 'The nightly job ___ (run) at three in the morning.', 'runs', '', 'Третье лицо единственного числа в Present Simple получает `-s`.'],
    [P2, 'gapfill', '', 'Our users ___ (open) the app twice a day on average.', 'open', '', '`Users` — множественное число, окончания нет.'],
    [P2, 'gapfill', '', 'The channel manager ___ (push) rates to every OTA.', 'pushes', '', 'После `-ch`, `-sh`, `-s`, `-x` добавляется `-es`: `push` → `pushes`.'],
    [P2, 'transform', '→ подлежащее `the analyst`', 'I document every business rule.', 'The analyst documents every business rule.', '', 'Смена подлежащего на третье лицо единственного числа требует `-s` у глагола.'],
    [P2, 'transform', '→ отрицание', 'The scooter reports its battery level.', "The scooter does not report its battery level.||The scooter doesn't report its battery level.", '', 'В отрицании `-s` уходит к вспомогательному: `does not report`, а не `does not reports`.'],
    [P2, 'transform', '→ вопрос', 'The integration sends data to the PMS.', 'Does the integration send data to the PMS?', '', 'В вопросе `-s` переезжает в `does`, а смысловой глагол остаётся в базовой форме.'],
    [P2, 'fix', '', 'The dashboard show fleet utilization by city.', 'The dashboard shows fleet utilization by city.', '', '`The dashboard` — третье лицо единственного числа, нужно `shows`.'],
    [P2, 'fix', '', "He doesn't knows the attribution window.", "He doesn't know the attribution window.", '', 'После `doesn’t` идёт базовая форма. Двух `-s` в одном отрицании не бывает.'],
    [P2, 'fix', '', 'Do the system support multiple currencies?', 'Does the system support multiple currencies?', '', '`The system` — третье лицо единственного числа, значит вопрос начинается с `Does`.'],

    /* --- Simple против Continuous: русский вид не подсказывает --- */
    [P3, 'scramble', 'Мы прямо сейчас выкатываем новый тариф.', '', 'We are rolling out a new rate plan right now.', 'We|are|rolling|out|a|new|rate|plan|right|now', '`right now` — действие в моменте, значит Continuous: `are rolling out`.'],
    [P3, 'scramble', 'Обычно мы выкатываем изменения по вторникам.', '', 'We usually roll out changes on Tuesdays.', 'We|usually|roll|out|changes|on|Tuesdays', '`usually` — регулярность, значит Present Simple без `-ing`.'],
    [P3, 'scramble', 'Утилизация падает уже третью неделю.', '', 'Utilization is falling for the third week.', 'Utilization|is|falling|for|the|third|week', 'Процесс в развитии → Continuous. В русском вид спрятан в слове «падает», в английском его несёт форма `is falling`.'],
    [P3, 'gapfill', '', 'I ___ (work) on the Brazil launch this month.', 'am working', '', '`this month` — ограниченный текущий период, значит Continuous.'],
    [P3, 'gapfill', '', 'The PMS ___ (store) every guest folio.', 'stores', '', 'Постоянное свойство системы идёт в Present Simple, не в Continuous.'],
    [P3, 'gapfill', '', 'Look at the map — three scooters ___ (move) toward the same zone.', 'are moving', '', '`Look at` указывает на момент наблюдения, значит Continuous.'],
    [P3, 'transform', '→ Present Continuous', 'I review the requirements.', "I am reviewing the requirements.||I'm reviewing the requirements.", '', 'Continuous — это форма `to be` плюс `-ing`. С `I` получается `am reviewing`.'],
    [P3, 'transform', '→ Present Simple', 'We are checking utilization every morning.', 'We check utilization every morning.', '', '`every morning` — регулярность, а регулярность идёт в Simple, даже если само действие длительное.'],
    [P3, 'transform', '→ вопрос', 'She is preparing the release notes.', 'Is she preparing the release notes?', '', 'В Continuous вопрос делается инверсией формы `to be`, `-ing` не трогаем.'],
    [P3, 'fix', '', 'I am knowing this integration well.', 'I know this integration well.', '', 'Глаголы состояния — `know`, `understand`, `want` — в Continuous не ставятся.'],
    [P3, 'fix', '', 'Right now we discuss the scope.', "Right now we are discussing the scope.||Right now we're discussing the scope.", '', '`Right now` требует Continuous. В русском форма одна, в английском выбор обязателен.'],
    [P3, 'fix', '', 'Our users are opening the app twice a day.', 'Our users open the app twice a day.', '', '`twice a day` — привычка, а привычки идут в Simple.'],

    /* --- Present Perfect с since/for: русское настоящее время сбивает --- */
    [P4, 'scramble', 'Я работаю в JET Sharing с 2023 года.', '', 'I have worked at JET Sharing since 2023.', 'I|have|worked|at|JET|Sharing|since|2023', 'Началось в прошлом и длится сейчас → Present Perfect. В русском здесь настоящее время, и это главная ловушка.'],
    [P4, 'scramble', 'Мы используем это окно атрибуции уже два года.', '', 'We have used this attribution window for two years.', 'We|have|used|this|attribution|window|for|two|years', '`for two years` — длительность до настоящего момента, значит `have used`, а не `use`.'],
    [P4, 'scramble', 'Она отвечает за миграцию с апреля.', '', 'She has owned the migration since April.', 'She|has|owned|the|migration|since|April', 'Третье лицо единственного числа в Present Perfect берёт `has`, а не `have`.'],
    [P4, 'gapfill', '', 'I ___ (be) a business analyst since 2021.', 'have been', '', '`since 2021` требует Present Perfect. Третья форма от `be` — `been`.'],
    [P4, 'gapfill', '', 'The channel manager ___ (work) without errors for three months.', 'has worked', '', '`The channel manager` — третье лицо единственного числа, значит `has`.'],
    [P4, 'gapfill', '', 'We ___ (not / see) this edge case since the last release.', "have not seen||haven't seen", '', 'В Present Perfect `not` встаёт между `have` и третьей формой.'],
    [P4, 'transform', '→ Present Perfect с since', 'I started working here in 2023.', "I have worked here since 2023.||I've worked here since 2023.", '', 'Past Simple сообщает только момент начала. Present Perfect с `since` добавляет, что это длится и сейчас.'],
    [P4, 'transform', '→ вопрос', 'You have used this rate plan for a year.', 'Have you used this rate plan for a year?', '', 'Вопрос — инверсия `have` и подлежащего, третья форма остаётся на месте.'],
    [P4, 'transform', '→ подлежащее `the team`', 'I have owned this integration since March.', 'The team has owned this integration since March.', '', '`The team` — третье лицо единственного числа, значит `has owned`.'],
    [P4, 'fix', '', 'I work at JET Sharing since 2023.', "I have worked at JET Sharing since 2023.||I've worked at JET Sharing since 2023.", '', 'Present Simple с `since` невозможен. Русское «работаю с 2023» переводится Present Perfect.'],
    [P4, 'fix', '', 'We have used this window since two years.', 'We have used this window for two years.', '', '`since` — точка отсчёта (2023, April), `for` — длительность (two years).'],
    [P4, 'fix', '', 'She have owned the migration since April.', 'She has owned the migration since April.', '', 'С `she` идёт `has`, а не `have`.'],

    /* --- Present Perfect против Past Simple: та самая ошибка --- */
    [P5, 'scramble', 'Мы уже выкатили эту функциональность.', '', 'We have already rolled out this feature.', 'We|have|already|rolled|out|this|feature', '`already` без указания когда — важен результат сейчас, значит Present Perfect.'],
    [P5, 'scramble', 'Мы выкатили её на прошлой неделе.', '', 'We rolled it out last week.', 'We|rolled|it|out|last|week', '`last week` — законченный момент в прошлом, значит Past Simple. С `last week` Present Perfect невозможен.'],
    [P5, 'scramble', 'Я ещё не видел этот отчёт.', '', "I have not seen this report yet.||I haven't seen this report yet.", 'I|have|not|seen|this|report|yet', '`yet` говорит о текущем положении дел, значит Present Perfect.'],
    [P5, 'gapfill', '', '___ (you / read) the spec yet?', 'Have you read', '', '`yet` требует Present Perfect: спрашивают про состояние на сейчас, а не про момент в прошлом.'],
    [P5, 'gapfill', '', 'I ___ (send) the requirements yesterday.', 'sent', '', '`yesterday` — конкретный момент в прошлом, значит Past Simple.'],
    [P5, 'gapfill', '', 'Utilization ___ (drop) three times this month.', 'has dropped', '', '`this month` — период ещё не закончился, значит Present Perfect.'],
    [P5, 'transform', '→ Past Simple, добавь `in April`', 'We have changed the rate plan.', 'We changed the rate plan in April.', '', 'Появилось указание момента — Present Perfect больше нельзя, фраза уходит в Past Simple.'],
    [P5, 'transform', '→ Present Perfect', 'I finished the analysis.', "I have finished the analysis.||I've finished the analysis.", '', 'Убираем привязку к моменту — остаётся результат, который важен сейчас.'],
    [P5, 'transform', '→ отрицание', 'She has approved the scope.', "She has not approved the scope.||She hasn't approved the scope.", '', '`not` встаёт после `has`, третья форма не меняется.'],
    [P5, 'fix', '', 'I have sent the report yesterday.', 'I sent the report yesterday.', '', '`yesterday` и Present Perfect несовместимы: конкретный момент требует Past Simple.'],
    [P5, 'fix', '', 'Did you read the spec yet?', 'Have you read the spec yet?', '', '`yet` — про сейчас, значит Present Perfect, а не Past Simple.'],
    [P5, 'fix', '', 'We already rolled out the fix, so the bug is gone.', "We have already rolled out the fix, so the bug is gone.||We've already rolled out the fix, so the bug is gone.", '', 'Результат действует сейчас — `the bug is gone` — значит Present Perfect.'],

    /* --- вопросы: в русском нет do-support, поэтому его забывают --- */
    [P6, 'scramble', 'Как часто система синхронизирует тарифы?', '', 'How often does the system sync rates?', 'How|often|does|the|system|sync|rates', 'После вопросительного слова идёт вспомогательный `does`, затем подлежащее, затем глагол в базовой форме.'],
    [P6, 'scramble', 'Почему упала утилизация парка?', '', 'Why did fleet utilization drop?', 'Why|did|fleet|utilization|drop', 'Прошедшее время в вопросе берёт `did`, а смысловой глагол остаётся базовым: `drop`, не `dropped`.'],
    [P6, 'scramble', 'Кто отвечает за эту интеграцию?', '', 'Who owns this integration?', 'Who|owns|this|integration', 'Когда вопрос задан к подлежащему, `do/does` не нужен и порядок слов остаётся прямым.'],
    [P6, 'gapfill', '', '___ the guest folio include the city tax?', 'Does', '', '`The guest folio` — третье лицо единственного числа в настоящем, значит `Does`.'],
    [P6, 'gapfill', '', 'Where ___ you gather these requirements?', 'did', '', 'Прошедшее время требует `did`, глагол дальше идёт в базовой форме.'],
    [P6, 'gapfill', '', '___ the scooters need a firmware update?', 'Do', '', '`Scooters` — множественное число, значит `Do`.'],
    [P6, 'transform', '→ вопрос', 'The analyst documents every business rule.', 'Does the analyst document every business rule?', '', '`-s` переезжает в `does`, и смысловой глагол теряет окончание.'],
    [P6, 'transform', '→ вопрос', 'They launched in Baku last spring.', 'Did they launch in Baku last spring?', '', 'Прошедшее время уходит в `did`, а `launched` становится `launch`.'],
    [P6, 'transform', '→ вопрос со `what` к дополнению', 'She reviewed the migration plan.', 'What did she review?', '', 'Вопрос к дополнению требует `did` и базовой формы: `did she review`.'],
    [P6, 'fix', '', 'Why the utilization dropped last week?', 'Why did the utilization drop last week?', '', 'В английском вопросе нельзя обойтись интонацией: нужен `did` и базовая форма глагола.'],
    [P6, 'fix', '', 'Does the system supports two currencies?', 'Does the system support two currencies?', '', 'После `does` глагол всегда базовый, без `-s`.'],
    [P6, 'fix', '', 'What you think about this scope?', 'What do you think about this scope?', '', 'Пропущен вспомогательный `do`. Русское «Что ты думаешь» строится без него, английское — нет.'],

    /* --- прошедшее: фон и событие --- */
    [P7, 'scramble', 'Когда упал сервер, я готовил отчёт.', '', 'I was preparing the report when the server went down.', 'I|was|preparing|the|report|when|the|server|went|down', 'Длинный фон идёт в Past Continuous — `was preparing`, а короткое событие внутри него в Past Simple — `went down`.'],
    [P7, 'scramble', 'Пока мы согласовывали объём, срок сдвинулся.', '', 'While we were aligning on scope, the deadline moved.', 'While|we|were|aligning|on|scope|the|deadline|moved', '`While` вводит фон, значит Past Continuous. Событие в главной части — Past Simple.'],
    [P7, 'scramble', 'Я проверил счёт гостя и нашёл ошибку.', '', 'I checked the guest folio and found an error.', 'I|checked|the|guest|folio|and|found|an|error', 'Два законченных действия друг за другом — оба в Past Simple, Continuous здесь не нужен.'],
    [P7, 'gapfill', '', 'I ___ (prepare) the report when the server went down.', 'was preparing', '', 'Фон, который уже шёл к моменту события, идёт в Past Continuous.'],
    [P7, 'gapfill', '', 'While the job ___ (run), we watched the logs.', 'was running', '', '`While` вводит длящийся фон, значит Past Continuous.'],
    [P7, 'gapfill', '', 'The deadline ___ (move) twice last quarter.', 'moved', '', 'Законченный факт с указанием периода идёт в Past Simple.'],
    [P7, 'transform', '→ Past Continuous', 'I reviewed the spec at nine.', 'I was reviewing the spec at nine.', '', 'Past Continuous говорит, что в девять процесс уже шёл, а не начался и закончился.'],
    [P7, 'transform', '→ Past Simple', 'She was writing the release notes.', 'She wrote the release notes.', '', 'Past Simple подаёт действие как законченный факт, без взгляда изнутри процесса.'],
    [P7, 'transform', '→ вопрос', 'They were rebalancing idle vehicles.', 'Were they rebalancing idle vehicles?', '', 'Вопрос в Continuous — инверсия `was/were` и подлежащего.'],
    [P7, 'fix', '', 'I was checking the folio and was finding an error.', 'I checked the folio and found an error.', '', 'Два коротких завершённых действия идут в Past Simple. Continuous растягивает то, что мгновенно.'],
    [P7, 'fix', '', 'While we were align on scope, the deadline moved.', 'While we were aligning on scope, the deadline moved.', '', 'После `were` нужна форма на `-ing`: `were aligning`.'],
    [P7, 'fix', '', 'They was testing the integration all morning.', 'They were testing the integration all morning.', '', '`They` — множественное число, значит `were`, а не `was`.'],

    /* --- артикли: в русском их нет вообще --- */
    [P8, 'scramble', 'Я продакт-менеджер в кикшеринговой компании.', '', 'I am a product manager at a kicksharing company.', 'I|am|a|product|manager|at|a|kicksharing|company', 'И профессия, и неопределённая компания требуют `a`: называем один экземпляр из класса, а не конкретный.'],
    [P8, 'scramble', 'Отчёт, который я отправил вчера, был неверный.', '', 'The report I sent yesterday was wrong.', 'The|report|I|sent|yesterday|was|wrong', 'Отчёт конкретный и уже определён контекстом, значит `the`.'],
    [P8, 'scramble', 'Утилизация парка важнее выручки.', '', 'Fleet utilization matters more than revenue.', 'Fleet|utilization|matters|more|than|revenue', 'Неисчисляемые понятия в общем смысле идут без артикля вообще.'],
    [P8, 'gapfill', '', 'We found ___ edge case that breaks the nightly job.', 'an', '', 'Первое упоминание, один из многих — неопределённый артикль. Перед гласным звуком `an`.'],
    [P8, 'gapfill', '', '___ channel manager pushes rates to every OTA.', 'The', '', 'Речь о конкретной, уже известной системе, значит `the`.'],
    [P8, 'gapfill', '', 'The bug appeared after ___ last release.', 'the', '', '`last release` — единственный конкретный релиз, значит `the`.'],
    [P8, 'transform', '→ первое упоминание аналитика', 'The analyst joined the team.', 'An analyst joined the team.', '', 'Если аналитик упомянут впервые и не важно кто именно — `an`. Команда при этом остаётся конкретной.'],
    [P8, 'transform', '→ множественное число, общий смысл', 'A scooter needs a daily check.', 'Scooters need a daily check.', '', 'Общее утверждение о классе во множественном числе идёт без артикля.'],
    [P8, 'transform', '→ речь о конкретном плане', 'We reviewed a rate plan.', 'We reviewed the rate plan.', '', '`the` показывает, что план один и обеим сторонам известно какой.'],
    [P8, 'fix', '', 'I am product manager at JET Sharing.', 'I am a product manager at JET Sharing.', '', 'Перед профессией в единственном числе нужен `a`. Русский обходится без артикля, английский — нет.'],
    [P8, 'fix', '', 'The fleet utilization is a key metric for the kicksharing.', 'Fleet utilization is a key metric for kicksharing.', '', 'Абстрактные понятия в общем смысле идут без артикля: ни `the fleet utilization`, ни `the kicksharing`.'],
    [P8, 'fix', '', 'We found a edge case in the import.', 'We found an edge case in the import.', '', 'Перед гласным звуком идёт `an`, а не `a`.']
  ];

  return data.map(function (d) {
    var p = d[0];
    // pattern_id, order_index, label, title_ru, notes_slug, kind, prompt_ru, stem, answer, tokens, hint_ru
    return [p[0], p[1], p[2], p[3], p[4], d[1], d[2], d[3], d[4], d[5], d[6]];
  });
}

/**
 * Writes the corpus into grammar_inbox. Deliberately not written straight into
 * grammar_items: routing it through the inbox means the seed is validated by the
 * same importer as any generated batch, so a broken item here fails loudly instead
 * of quietly becoming an unsolvable exercise.
 */
function seedGrammarBatch() {
  var rows = grammarSeedRows_();
  var sh = sheet_(SHEET_GRAMMAR_INBOX);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, GRAMMAR_IMPORT_COLUMNS.length).setValues(rows);
  Logger.log('grammar_inbox: залито строк — ' + rows.length);
  Logger.log('Теперь запусти runImportGrammar (или пункт меню «Импортировать грамматику»).');
  return rows.length;
}

// ==========================================================================
// Bot.gs
// ==========================================================================

/** Telegram bot: a daily ping and a launch button. Nothing else lives here. */

function tgApi_(method, payload) {
  var url = 'https://api.telegram.org/bot' + cfg_('BOT_TOKEN') + '/' + method;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var body = res.getContentText();
  var parsed;
  try { parsed = JSON.parse(body); } catch (e) { parsed = { ok: false, raw: body }; }
  if (!parsed.ok) Logger.log('Telegram ' + method + ' failed: ' + body);
  return parsed;
}

/**
 * Файл в чат. Именно документом, а не текстом: CSV на несколько тысяч строк не
 * влезет в 4096 символов сообщения, а обрезанная выгрузка хуже её отсутствия.
 * multipart собирается вручную — UrlFetchApp сам делает это для payload с Blob.
 */
function sendDocument_(chatId, name, content, caption) {
  var url = 'https://api.telegram.org/bot' + cfg_('BOT_TOKEN') + '/sendDocument';
  var blob = Utilities.newBlob(content, 'text/csv', name);
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { chat_id: String(chatId), caption: caption || '', document: blob },
    muteHttpExceptions: true
  });
  var parsed;
  try { parsed = JSON.parse(res.getContentText()); } catch (e) { parsed = { ok: false }; }
  if (!parsed.ok) Logger.log('sendDocument failed: ' + res.getContentText());
  return parsed;
}

function sendMessage_(chatId, text, replyMarkup) {
  return tgApi_('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup || undefined
  });
}

function launchKeyboard_() {
  var url = PropertiesService.getScriptProperties().getProperty('MINI_APP_URL');
  if (!url) return undefined;
  return { inline_keyboard: [[{ text: 'Открыть тренажёр', web_app: { url: url } }]] };
}

/** Called by the daily trigger. */
function dailyPing() {
  var settings = readSettings_();
  var allow = cfgAllowlist_();
  var delivered = true;
  var cards = readCards_();
  var today = todayStr_(settings.timezone);
  var patterns = [];
  var grammarItems = [];
  try {
    patterns = readPatterns_();
    grammarItems = readGrammarItems_();
  } catch (e) {
    // Листы грамматики могут ещё не существовать — это не повод молчать про лексику.
  }
  var poolSize = {};
  grammarItems.forEach(function (it) {
    poolSize[String(it.pattern_id)] = (poolSize[String(it.pattern_id)] || 0) + 1;
  });

  allow.forEach(function (userId) {
    var mine = cards.filter(function (c) { return String(c.user_id) === String(userId); });
    var due = mine.filter(function (c) {
      var st = String(c.state);
      if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
      return c.due && dateKey_(c.due, settings.timezone) <= today;
    }).length;
    var fresh = mine.filter(function (c) { return String(c.state) === 'new'; }).length;
    var target = Math.min(parseInt(settings.daily_new_target, 10) || 6, fresh);
    var leeches = mine.filter(function (c) { return String(c.state) === 'leech'; }).length;

    // Грамматика считается тем же способом и тем же условием, что и планировщик:
    // шаблон без заданий не играбелен, поэтому в счёт не идёт.
    var myPatterns = patterns.filter(function (p) {
      return String(p.user_id) === String(userId) && poolSize[String(p.pattern_id)];
    });
    var gDue = myPatterns.filter(function (p) {
      var st = String(p.state || 'new');
      if (st === 'new' || st === 'suspended') return false;
      return p.due && dateKey_(p.due, settings.timezone) <= today;
    }).length;
    var gFresh = myPatterns.filter(function (p) { return String(p.state || 'new') === 'new'; }).length;
    var gTarget = Math.min(parseInt(settings.grammar_daily_new_target, 10) || 1, gFresh);

    var nothing = (due + target + gDue + gTarget) === 0;

    var lines;
    if (nothing) {
      // Раньше здесь стоял ранний возврат, и «сегодня нечего делать» было неотличимо
      // от «триггер умер». Два дня тишины ровно так и выглядели.
      var next = nextDueDate_(mine, myPatterns);
      lines = ['<b>Сегодня свободно</b>',
        'Всё повторено, новых на сегодня нет.',
        next ? 'Следующее повторение: ' + next : 'Новых карточек в запасе не осталось — залей батч.'];
      if (!ok_(sendMessage_(userId, lines.join('\n')))) delivered = false;
      return;
    }

    lines = ['<b>На сегодня</b>'];
    if (due || target) {
      lines.push('Лексика — к повторению: ' + due + ', новых: ' + target);
    }
    if (gDue || gTarget) {
      lines.push('Грамматика — шаблонов к повторению: ' + gDue + ', новых: ' + gTarget);
    }
    if (leeches) lines.push('Пиявок ждёт переформулировки: ' + leeches);
    if (!ok_(sendMessage_(userId, lines.join('\n'), launchKeyboard_()))) delivered = false;
  });

  // Новые ачивки объявляются здесь, а не на экране: смысл ачивки в том, что она
  // ПРИЛЕТАЕТ, а не в том, что её однажды находят в списке.
  try {
    allow.forEach(function (userId) {
      var fresh = grantAchievements_(buildStats(userId));
      if (!fresh.length) return;
      var all = evaluateAchievements(buildStats(userId)).list;
      var lines = ['<b>Разблокировано</b>'];
      fresh.forEach(function (id) {
        var a = all.filter(function (x) { return x.id === id; })[0];
        if (a) lines.push('&#127894; <b>' + a.title + '</b>\n<i>' + a.note + '</i>');
      });
      sendMessage_(userId, lines.join('\n'));
    });
  } catch (e) {
    // Ачивки — украшение. Уронить из-за них ежедневный пинг было бы смешно.
    Logger.log('achievements: ' + e.message);
  }

  // Отметка ставится ПОСЛЕ фактической отправки, а не в начале функции.
  // Раньше она стояла первой строкой, и упавший между отметкой и отправкой пинг
  // выглядел совершенно живым: приложение читает эту же метку, чтобы предупредить
  // «триггер молчит». Метка о намерении вместо метки о результате — это тот самый
  // зелёный тест при мёртвом процессе, только в проде.
  if (delivered) writeSetting_('last_trigger_run', new Date().toISOString());
}

/** Ответ Telegram — единственное доказательство, что сообщение ушло. */
function ok_(res) {
  return !!(res && res.ok);
}

/** Ближайшая дата, когда снова появится работа. Нужна, чтобы тишина была объяснимой. */
function nextDueDate_(cards, patterns) {
  var dates = [];
  cards.forEach(function (c) {
    var st = String(c.state);
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return;
    if (c.due) dates.push(dateKey_(c.due));
  });
  patterns.forEach(function (p) {
    if (String(p.state || 'new') === 'new' || String(p.state) === 'suspended') return;
    if (p.due) dates.push(dateKey_(p.due));
  });
  dates.sort();
  return dates.length ? dates[0] : '';
}


/** Weekly: is the webhook alive? A lost webhook is silent otherwise. */
function checkWebhook() {
  var info = tgApi_('getWebhookInfo', {});
  writeSetting_('webhook_last_check', new Date().toISOString());
  if (!info.ok || !info.result) return;
  var r = info.result;
  var problem = !r.url || (r.pending_update_count || 0) > 20 || r.last_error_message;
  if (problem) {
    cfgAllowlist_().forEach(function (id) {
      sendMessage_(id, '<b>Webhook требует внимания</b>\nurl: ' + (r.url || 'пусто') +
        '\npending: ' + (r.pending_update_count || 0) +
        (r.last_error_message ? '\nошибка: ' + r.last_error_message : ''));
    });
  }
}

/** Run once by hand after deploying the Web App. */
function setWebhook() {
  var url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (!url) throw new Error('Set WEB_APP_URL in Script Properties first');
  var res = tgApi_('setWebhook', {
    url: url + '?secret=' + cfg_('BOT_TOKEN').slice(-16),
    allowed_updates: ['message']
  });
  Logger.log(JSON.stringify(res));
}

/**
 * Дедуп апдейтов Telegram.
 *
 * Apps Script на POST отвечает редиректом 302, и Telegram считает это неуспехом,
 * поэтому повторяет доставку того же update_id — один /start превращается в пять
 * одинаковых ответов. Идемпотентность по update_id решает это тем же приёмом,
 * что и batch_id для отправки оценок.
 */
function updateSeen_(updateId) {
  if (!updateId) return false;
  var cache = CacheService.getScriptCache();
  var key = 'upd_' + updateId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 3600);   // час с запасом: повторы приходят в течение минут
  return false;
}

/** Отчёт уходит в <pre>, поэтому угловые скобки из сообщений об ошибках надо обезвредить. */
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** У Telegram потолок 4096 символов на сообщение, а отчёт растёт вместе с числом батчей. */
function clip_(s, max) {
  return s.length <= max ? s : s.slice(0, max) + '\n… отчёт обрезан';
}

function handleBotUpdate_(update) {
  if (updateSeen_(update.update_id)) return;   // повторная доставка того же апдейта
  var msg = update.message;
  if (!msg || !msg.text) return;
  var userId = String(msg.from && msg.from.id);
  if (cfgAllowlist_().indexOf(userId) < 0) return;

  var text = String(msg.text).trim();
  if (text === '/start' || text === '/open') {
    sendMessage_(userId, 'Тренажёр готов.', launchKeyboard_());
  } else if (text === '/load') {
    // Единственный пульт для заливки банка. Пункт меню в таблице требует рук в таблице,
    // а `clasp run` требует GCP-проекта, которого у этого проекта намеренно нет.
    // Дедуп по update_id стоит ВЫШЕ по функции, поэтому повтор доставки не зальёт дважды.
    sendMessage_(userId, 'Заливаю банк из репозитория. Это занимает минуту-две.');
    var report;
    try {
      report = loadEverything();
    } catch (e) {
      // Молча в Logger такая ошибка ушла бы навсегда: логи Apps Script никто не открывает.
      sendMessage_(userId, '<b>Заливка упала</b>\n<pre>' + escapeHtml_(String(e.message)) + '</pre>');
      return;
    }
    sendMessage_(userId, '<pre>' + escapeHtml_(clip_(String(report), 3500)) + '</pre>',
      launchKeyboard_());
  } else if (text === '/gloss') {
    try {
      sendMessage_(userId, escapeHtml_(backfillGloss()));
    } catch (e) {
      sendMessage_(userId, '<b>Заливка разбора упала</b>\n<pre>' +
        escapeHtml_(String(e.message)) + '</pre>');
    }
  } else if (text === '/export') {
    var dump = exportReviewsCsv(userId);
    if (!dump.rows) { sendMessage_(userId, 'Выгружать пока нечего — журнал пуст.'); return; }
    var stamp = Utilities.formatDate(new Date(), readSettings_().timezone || 'Europe/Moscow',
      'yyyy-MM-dd');
    sendDocument_(userId, 'eng-bot-reviews-' + stamp + '.csv', dump.csv,
      'Журнал повторений: строк ' + dump.rows);
  } else if (text === '/stats') {
    var s = buildSession(userId);
    sendMessage_(userId, [
      '<b>Состояние базы</b>',
      'Всего карточек: ' + s.counts.total,
      'К повторению сейчас: ' + s.counts.due,
      'Новых в запасе: ' + s.counts.new_available,
      'Заблокировано до созревания: ' + s.counts.locked,
      'Пиявок: ' + s.counts.leeches
    ].join('\n'), launchKeyboard_());
  }
}

// ==========================================================================
// Triggers.gs
// ==========================================================================

/**
 * Run installTriggers() once by hand. Then set, in the trigger UI (clock icon),
 * "Failure notification settings" to "Notify me immediately" for each one —
 * that switch cannot be set from code, and without it a dead trigger is silent
 * until the daily summary email, which is easy to miss.
 */

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  var settings = readSettings_();
  var hour = parseInt(settings.ping_hour, 10);
  if (isNaN(hour)) hour = 8;

  ScriptApp.newTrigger('dailyPing').timeBased().atHour(hour).everyDays(1).create();
  ScriptApp.newTrigger('checkWebhook').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9).create();

  // A standalone script never runs a simple onOpen(), so the spreadsheet menu has to
  // be attached with an installable trigger bound to that specific document.
  ScriptApp.newTrigger('onOpenMenu')
    .forSpreadsheet(SpreadsheetApp.openById(cfg_('SHEET_ID')))
    .onOpen()
    .create();

  Logger.log('installed: dailyPing at ~' + hour + ':00, checkWebhook Mondays ~09:00, '
    + 'onOpenMenu on the spreadsheet');
  Logger.log('now set Failure notification to "Notify me immediately" for the two time-based ones');
}

function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    Logger.log(t.getHandlerFunction() + ' — ' + t.getEventType());
  });
}

// ==========================================================================
// Diagnose.gs
// ==========================================================================

/**
 * Одна команда, отвечающая на вопрос «почему ничего не происходит».
 *
 * Она существует потому, что двухдневная тишина имеет минимум пять разных причин —
 * триггер не установлен, триггер падает, токен отозван, очередь действительно пуста,
 * листы не созданы — и различить их снаружи нельзя. Раньше на это уходил обмен
 * сообщениями из пяти шагов.
 *
 * Запускать из редактора: выбрать runDiagnostics, Выполнить, читать журнал.
 */
function runDiagnostics() {
  var out = [];
  function say(s) { out.push(s); Logger.log(s); }
  function head(s) { say(''); say('=== ' + s); }

  head('СЕКРЕТЫ');
  ['BOT_TOKEN', 'SHEET_ID', 'ALLOWLIST'].forEach(function (k) {
    var v = PropertiesService.getScriptProperties().getProperty(k);
    say('  ' + k + ': ' + (v ? 'задан (' + v.length + ' символов)' : 'ОТСУТСТВУЕТ'));
  });

  head('ТРИГГЕРЫ');
  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    say('  НИ ОДНОГО ТРИГГЕРА. Это и есть причина тишины.');
    say('  Лечится так: выполнить installTriggers() и потом в интерфейсе триггеров');
    say('  поставить уведомления о сбоях на «Notify me immediately».');
  } else {
    triggers.forEach(function (t) {
      say('  ' + t.getHandlerFunction() + ' — ' + t.getEventType());
    });
    ['dailyPing', 'checkWebhook', 'onOpenMenu'].forEach(function (fn) {
      var found = triggers.some(function (t) { return t.getHandlerFunction() === fn; });
      if (!found) say('  ОТСУТСТВУЕТ триггер для ' + fn + ' — выполни installTriggers()');
    });
  }

  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  head('ПОСЛЕДНИЙ ЗАПУСК ТРИГГЕРА');
  if (!settings.last_trigger_run) {
    say('  НИ РАЗУ. Триггер либо не установлен, либо падает при каждом запуске.');
    say('  Проверь: Выполнения (Executions) в левом меню редактора — там видно ошибки.');
  } else {
    var ageH = (Date.now() - new Date(settings.last_trigger_run).getTime()) / 3600000;
    say('  ' + settings.last_trigger_run + '  (' + ageH.toFixed(1) + ' часов назад)');
    if (ageH > 36) say('  СТАРШЕ 36 ЧАСОВ — триггер не отработал, смотри Выполнения.');
  }

  head('БОТ');
  try {
    var me = tgApi_('getMe', {});
    say('  getMe: ' + (me && me.ok ? 'ok, @' + me.result.username : 'ОШИБКА ' + JSON.stringify(me)));
  } catch (e) { say('  getMe: ИСКЛЮЧЕНИЕ — ' + e.message); }
  try {
    var wh = tgApi_('getWebhookInfo', {});
    var r = wh && wh.result ? wh.result : {};
    say('  webhook url: ' + (r.url || 'НЕ УСТАНОВЛЕН'));
    if (r.last_error_message) {
      say('  ПОСЛЕДНЯЯ ОШИБКА WEBHOOK: ' + r.last_error_message + ' (' + r.last_error_date + ')');
    }
    if (r.pending_update_count) say('  необработанных обновлений: ' + r.pending_update_count);
  } catch (e) { say('  getWebhookInfo: ИСКЛЮЧЕНИЕ — ' + e.message); }

  var userId = cfgAllowlist_()[0];
  head('ЛЕКСИКА (пользователь ' + userId + ')');
  var cards = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var byState = {};
  cards.forEach(function (c) {
    var st = String(c.state || 'пусто');
    byState[st] = (byState[st] || 0) + 1;
  });
  say('  всего карточек: ' + cards.length);
  Object.keys(byState).sort().forEach(function (k) { say('    ' + k + ': ' + byState[k]); });
  var due = cards.filter(function (c) {
    var st = String(c.state);
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
    return c.due && dateKey_(c.due) <= today;
  });
  var introduced = cards.filter(function (c) {
    return c.first_review && dateKey_(c.first_review) === today;
  });
  var noFirst = cards.filter(function (c) { return c.last_review && !c.first_review; });
  say('  к повторению сегодня (' + today + '): ' + due.length);
  say('  введено сегодня: ' + introduced.length +
    ' из нормы ' + (settings.daily_new_target || '?'));
  if (noFirst.length) {
    say('  ВНИМАНИЕ: ' + noFirst.length + ' карточек показывались, но без first_review —');
    say('  дневная норма считается неверно. Выполни backfillFirstReview() один раз.');
  }
  var futureDue = cards.map(function (c) { return dateKey_(c.due); })
    .filter(function (d) { return d && d > today; }).sort();
  say('  ближайшее будущее повторение: ' + (futureDue[0] || 'нет'));

  head('ГРАММАТИКА');
  try {
    var pats = readPatterns_().filter(function (p) { return String(p.user_id) === String(userId); });
    var items = readGrammarItems_();
    say('  шаблонов: ' + pats.length + ', заданий: ' + items.length);
    if (!pats.length) {
      say('  ПУСТО. Выполни по порядку: setupSpreadsheet, seedGrammarBatch, runImportGrammar.');
    } else {
      var gState = {};
      pats.forEach(function (p) {
        var st = String(p.state || 'new');
        gState[st] = (gState[st] || 0) + 1;
      });
      Object.keys(gState).sort().forEach(function (k) { say('    ' + k + ': ' + gState[k]); });
      var gDue = pats.filter(function (p) {
        var st = String(p.state || 'new');
        if (st === 'new' || st === 'suspended') return false;
        return p.due && dateKey_(p.due) <= today;
      }).length;
      say('  к повторению сегодня: ' + gDue);
      var gFuture = pats.map(function (p) { return dateKey_(p.due); })
        .filter(function (d) { return d && d > today; }).sort();
      say('  ближайшее будущее повторение: ' + (gFuture[0] || 'нет'));
    }
  } catch (e) {
    say('  листы грамматики недоступны: ' + e.message);
    say('  Выполни setupSpreadsheet, затем seedGrammarBatch, затем runImportGrammar.');
  }

  head('ВЫВОД');
  if (!triggers.length) {
    say('  Уведомлений нет, потому что триггеры не установлены. installTriggers().');
  } else if (!settings.last_trigger_run) {
    say('  Триггеры есть, но ни один не отработал. Смотри Выполнения — там будет ошибка.');
  } else if (!due.length) {
    say('  Уведомлений нет, потому что работы действительно нет: ближайшее повторение ' +
      (futureDue[0] || '— карточки кончились'));
    say('  Если хочется учиться чаще — подними daily_new_target или залей новый батч.');
  } else {
    say('  Работа есть (' + due.length + ' к повторению), а уведомления не приходят —');
    say('  значит падает отправка. Смотри строку про getMe и webhook выше.');
  }
  say('');
  return out.join('\n');
}

// ==========================================================================
// Setup.gs
// ==========================================================================

/**
 * Creates every tab with headers and seeds settings. Idempotent: running it twice
 * changes nothing. This is what makes the deploy reproducible from an empty sheet.
 */

function setupSpreadsheet() {
  var ss = ss_();

  ensureTab_(ss, SHEET_CARDS, CARD_COLUMNS);
  ensureTab_(ss, SHEET_SETTINGS, ['key', 'value']);
  ensureTab_(ss, SHEET_INBOX, IMPORT_COLUMNS);
  ensureTab_(ss, SHEET_REJECTS, ['inbox_line', 'reason', 'ts'].concat(IMPORT_COLUMNS));
  ensureTab_(ss, SHEET_FLUSH_LOG, ['batch_id', 'received_at', 'count']);
  ensureTab_(ss, logSheetName_(), LOG_COLUMNS);

  ensureTab_(ss, SHEET_PATTERNS, PATTERN_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_INBOX, GRAMMAR_IMPORT_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_REJECTS,
    ['inbox_line', 'reason', 'ts'].concat(GRAMMAR_IMPORT_COLUMNS));
  ensureTab_(ss, grammarLogSheetName_(), GRAMMAR_LOG_COLUMNS);

  var existing = readSettings_();
  var seeded = 0;
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    var sh = ss.getSheetByName(SHEET_SETTINGS);
    var lastRow = sh.getLastRow();
    var keys = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 1).getValues()
      .map(function (r) { return String(r[0]).trim(); }) : [];
    if (keys.indexOf(k) < 0) { sh.appendRow([k, DEFAULT_SETTINGS[k]]); seeded++; }
  });

  // Data validation on the inbox so a wrong type is caught before import even runs.
  var inbox = ss.getSheetByName(SHEET_INBOX);
  inbox.getRange(2, 1, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_TYPES, true).build());
  inbox.getRange(2, 6, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_LAYERS, true).build());

  var ginbox = ss.getSheetByName(SHEET_GRAMMAR_INBOX);
  ginbox.getRange(2, GRAMMAR_IMPORT_COLUMNS.indexOf('kind') + 1, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_KINDS, true).build());

  Logger.log('setup done. settings seeded: ' + seeded);
  Logger.log('tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var current = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var same = current.length === headers.length && current.every(function (v, i) {
    return String(v) === headers[i];
  });
  if (!same) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Twenty hand-made cards so the vertical slice has something to show before the
 * first real batch exists. Safe to run once; duplicates are skipped by importInbox.
 */
function seedStarterBatch() {
  var rows = [
    ['collocation', 'roll out a feature', 'выкатывать функциональность', 'We roll out the feature to ten percent of users first.', 'Сначала мы выкатываем функциональность на десять процентов пользователей.', 'business', 'release', ''],
    ['collocation', 'push back on a deadline', 'оспаривать срок', 'I had to push back on the deadline because scope grew.', 'Мне пришлось оспорить срок, потому что объём вырос.', 'business', 'negotiation', ''],
    ['collocation', 'take ownership of', 'брать ответственность за', 'She took ownership of the migration end to end.', 'Она взяла ответственность за миграцию от начала до конца.', 'business', 'ownership', ''],
    ['collocation', 'align on scope', 'согласовать объём работ', 'Let us align on scope before we estimate.', 'Давайте согласуем объём работ до оценки.', 'business', 'planning', ''],
    ['collocation', 'raise a concern', 'озвучить опасение', 'I want to raise a concern about the rollout plan.', 'Хочу озвучить опасение по плану выкатки.', 'business', 'meetings', ''],
    ['phrase', 'let me walk you through it', 'давай я проведу тебя по этому', 'Let me walk you through it step by step.', 'Давай я проведу тебя по этому шаг за шагом.', 'business', 'meetings', ''],
    ['phrase', 'correct me if I am wrong', 'поправь меня, если я не прав', 'Correct me if I am wrong, but the sync is nightly.', 'Поправь меня, если я не прав, но синхронизация ночная.', 'business', 'meetings', ''],
    ['phrase', 'that is out of scope for now', 'сейчас это вне объёма работ', 'That is out of scope for now, let us park it.', 'Сейчас это вне объёма работ, давайте отложим.', 'business', 'meetings', ''],
    ['collocation', 'fleet utilization', 'утилизация парка', 'Fleet utilization dropped after the price change.', 'Утилизация парка упала после изменения цены.', 'mobility', 'metrics', ''],
    ['collocation', 'unit economics', 'юнит-экономика', 'The unit economics break even at four rides per day.', 'Юнит-экономика выходит в ноль на четырёх поездках в день.', 'mobility', 'metrics', ''],
    ['collocation', 'idle vehicle', 'простаивающий транспорт', 'We rebalance idle vehicles every morning.', 'Мы перераспределяем простаивающий транспорт каждое утро.', 'mobility', 'ops', ''],
    ['collocation', 'ride completion rate', 'доля завершённых поездок', 'Ride completion rate fell in the rainy week.', 'Доля завершённых поездок упала в дождливую неделю.', 'mobility', 'metrics', ''],
    ['collocation', 'promo redemption', 'использование промокода', 'Promo redemption spiked on the first weekend.', 'Использование промокода подскочило в первые выходные.', 'mobility', 'growth', ''],
    ['collocation', 'attribution window', 'окно атрибуции', 'We use a seven day attribution window.', 'Мы используем семидневное окно атрибуции.', 'mobility', 'growth', ''],
    ['collocation', 'rate plan', 'тарифный план', 'The rate plan changes on weekends.', 'Тарифный план меняется на выходных.', 'hospitality', 'pms', ''],
    ['collocation', 'guest folio', 'счёт гостя', 'Charges post to the guest folio automatically.', 'Начисления попадают на счёт гостя автоматически.', 'hospitality', 'pms', ''],
    ['collocation', 'room inventory', 'номерной фонд', 'Room inventory syncs with the channel manager.', 'Номерной фонд синхронизируется с channel manager.', 'hospitality', 'pms', ''],
    ['collocation', 'no-show policy', 'политика незаезда', 'The no-show policy charges the first night.', 'Политика незаезда списывает первую ночь.', 'hospitality', 'pms', ''],
    ['collocation', 'gather requirements', 'собирать требования', 'I gather requirements from three stakeholder groups.', 'Я собираю требования у трёх групп стейкхолдеров.', 'business', 'analysis', ''],
    ['collocation', 'edge case', 'краевой случай', 'This edge case breaks the nightly job.', 'Этот краевой случай ломает ночную задачу.', 'business', 'analysis', '']
  ];
  var sh = sheet_(SHEET_INBOX);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, IMPORT_COLUMNS.length).setValues(rows);
  Logger.log('seeded ' + rows.length + ' rows into inbox — now run "Импортировать батч" from the menu');
}

/**
 * Заполняет first_review для карточек, созданных до появления этой колонки.
 * Идемпотентна: уже заполненные не трогает. Запустить один раз после обновления кода.
 */
function backfillFirstReview() {
  var cards = readCards_();
  var updates = [];
  cards.forEach(function (c) {
    if (c.first_review) return;
    if (!c.last_review) return;                 // ещё ни разу не показывалась
    updates.push({
      _row: c._row,
      patch: { first_review: dateKey_(c.last_review) }
    });
  });
  var written = writeCardUpdates_(updates);
  Logger.log('first_review заполнен у ' + written + ' карточек из ' + cards.length);
  Logger.log('Внимание: для уже показанных карточек в качестве даты первого показа взята '
    + 'дата последнего — точнее взять негде, и это влияет только на подсчёт дневной нормы.');
  return written;
}

// ==========================================================================
// BankLoad.gs
// ==========================================================================

/**
 * Заливка банка слов прямо из репозитория.
 *
 * Почему не встроенный в код массив, как в GrammarSeed.gs: батчи уже лежат в data/,
 * где их проверяет настоящий валидатор на каждом прогоне тестов. Копия в .gs была бы
 * вторым источником правды и разошлась бы с первой же правкой. Репозиторий публичный,
 * поэтому UrlFetch обходится без авторизации.
 *
 * Один вход в редакторе: loadEverything(). Он ставит норму, заливает все батчи по
 * порядку слоёв и печатает отчёт.
 */

var BANK_REPO_RAW = 'https://raw.githubusercontent.com/EnOtik911/eng-bot/main/data/';

/**
 * ПОРЯДОК ЗНАЧИМ — он совпадает с порядком слоёв в VALID_LAYERS, то есть с очередью
 * освоения. Заливать вразнобой можно, но тогда планировщик выдаст сначала то, что
 * попало в таблицу раньше.
 */
var BANK_FILES = [
  'bank-002-core.tsv',
  'bank-003-social.tsv',
  'bank-004-business.tsv',
  'bank-005-analysis.tsv',
  'bank-006-fintech.tsv',
  'bank-007-tech.tsv'
];

function fetchTsv_(fileName) {
  var res = UrlFetchApp.fetch(BANK_REPO_RAW + fileName, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('не удалось скачать ' + fileName + ': HTTP ' + code);
  }
  var lines = res.getContentText().split('\n').filter(function (l) { return l.trim().length; });
  if (!lines.length) throw new Error(fileName + ' пуст');

  var header = lines[0].split('\t');
  // Заголовок сверяется со схемой, а не принимается на веру: файл в репозитории мог
  // уехать вперёд относительно кода, и тогда колонки молча встанут не туда.
  if (header.join('\t') !== IMPORT_COLUMNS.join('\t')) {
    throw new Error(fileName + ': заголовок не совпадает со схемой.\n  получено: ' +
      header.join(', ') + '\n  ожидалось: ' + IMPORT_COLUMNS.join(', '));
  }

  return lines.slice(1).map(function (l) {
    var cells = l.split('\t');
    while (cells.length < IMPORT_COLUMNS.length) cells.push('');
    return cells.slice(0, IMPORT_COLUMNS.length);
  });
}

/** Один батч: скачать, положить в inbox, импортировать, вернуть отчёт. */
function loadBankFile(fileName) {
  var rows = fetchTsv_(fileName);
  var sh = sheet_(SHEET_INBOX);

  // Inbox должен быть пуст: чужие недоимпортированные строки уехали бы в этот батч.
  // Заголовок переписывается каждый раз: схема выросла на колонку, и лист,
  // созданный до этого, молча разъехался бы со значениями.
  sh.getRange(1, 1, 1, IMPORT_COLUMNS.length).setValues([IMPORT_COLUMNS]).setFontWeight('bold');
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).clearContent();

  sh.getRange(2, 1, rows.length, IMPORT_COLUMNS.length).setValues(rows);
  SpreadsheetApp.flush();

  var report = importInbox(cfgAllowlist_()[0]);
  report.file = fileName;
  report.rows_in_file = rows.length;
  return report;
}

/**
 * Дописать разбор и объяснение в УЖЕ импортированные карточки.
 *
 * Обычный импорт для этого не годится: он отклоняет дубликаты, а все эти единицы
 * в таблице уже есть. Сопоставление идёт по `en` — в банке это ключ уникальности,
 * по нему же импортёр ловит дубликаты. Обновляются обе карточки единицы (recog и
 * prod): разбор принадлежит словосочетанию, а не направлению.
 */
function backfillGloss() {
  var text = {};
  var files = ['seed-batch-001.tsv'].concat(BANK_FILES);
  var scanned = 0;
  files.forEach(function (f) {
    var rows;
    try { rows = fetchTsv_(f); } catch (e) { Logger.log(f + ': ' + e.message); return; }
    rows.forEach(function (cells) {
      var en = String(cells[1] || '').trim();
      var note = String(cells[7] || '').trim();
      var breakdown = String(cells[8] || '').trim();
      scanned++;
      if (en && (note || breakdown)) text[en] = { note: note, breakdown: breakdown };
    });
  });

  var updates = [];
  readCards_().forEach(function (c) {
    var t = text[String(c.en).trim()];
    if (!t) return;
    // Пустым значением ничего не затираем: файл мог отстать от таблицы.
    var patch = {};
    if (t.note && String(c.note || '') !== t.note) patch.note = t.note;
    if (t.breakdown && String(c.breakdown || '') !== t.breakdown) patch.breakdown = t.breakdown;
    if (Object.keys(patch).length) updates.push({ _row: c._row, patch: patch });
  });

  var written = writeCardUpdates_(updates);
  var report = 'разбор: в файлах ' + Object.keys(text).length + ' единиц из ' + scanned +
    ', обновлено карточек ' + written;
  Logger.log(report);
  return report;
}

/** Дневная норма новых. Меняется без переустановки триггеров. */
function tuneDailyTarget(newTarget) {
  var before = readSettings_().daily_new_target;
  writeSetting_('daily_new_target', String(newTarget));
  Logger.log('daily_new_target: ' + before + ' -> ' + newTarget);
  return { before: before, after: newTarget };
}

/**
 * Всё за один запуск: норма, листы, грамматика, весь банк слов.
 * Безопасно запускать повторно — дубликаты отклоняются импортёром, а не пишутся вторым
 * экземпляром.
 */
function loadEverything() {
  var log = [];
  function say(s) { log.push(s); Logger.log(s); }

  say('=== ДНЕВНАЯ НОРМА');
  var t = tuneDailyTarget(10);
  say('  было ' + t.before + ', стало ' + t.after +
    '  (по модели нагрузки: ~95 повторений и ~13 минут в день)');

  say('');
  say('=== ЛИСТЫ');
  setupSpreadsheet();
  say('  проверены и созданы недостающие');

  say('');
  say('=== ГРАММАТИКА');
  try {
    var pats = readPatterns_();
    if (pats.length) {
      say('  уже залита: шаблонов ' + pats.length + ', заданий ' + readGrammarItems_().length);
    } else {
      seedGrammarBatch();
      var g = importGrammarInbox(cfgAllowlist_()[0]);
      say('  шаблонов создано: ' + (g.patterns_created || 0) +
        ', заданий принято: ' + (g.accepted || 0) +
        ', отклонено: ' + (g.rejected || 0) + ', дубликатов: ' + (g.duplicates || 0));
    }
  } catch (e) {
    say('  ОШИБКА: ' + e.message);
  }

  say('');
  say('=== БАНК СЛОВ');
  var totalAccepted = 0;
  var totalRejected = 0;
  var totalDup = 0;
  BANK_FILES.forEach(function (f) {
    try {
      var r = loadBankFile(f);
      totalAccepted += r.accepted || 0;
      totalRejected += r.rejected || 0;
      totalDup += r.duplicates || 0;
      say('  ' + f + ': в файле ' + r.rows_in_file +
        ', принято ' + (r.accepted || 0) +
        ', карточек ' + (r.cards_created || 0) +
        ', отклонено ' + (r.rejected || 0) +
        ', дубликатов ' + (r.duplicates || 0));
    } catch (e) {
      say('  ' + f + ': ОШИБКА — ' + e.message);
    }
  });
  say('  ИТОГО принято единиц: ' + totalAccepted +
    ', отклонено: ' + totalRejected + ', дубликатов: ' + totalDup);
  if (totalRejected) {
    say('  Причины отклонений построчно — на листе "' + SHEET_REJECTS + '"');
  }

  say('');
  say('=== ЧТО ПОЛУЧИЛОСЬ');
  var s = buildSession(cfgAllowlist_()[0]);
  say('  карточек всего: ' + s.counts.total);
  say('  к повторению сейчас: ' + s.counts.due);
  say('  новых в запасе: ' + s.counts.new_available);
  say('  выдаётся сегодня новых: ' + s.counts.new_in_session);
  var gs = buildGrammarSession(cfgAllowlist_()[0]);
  say('  шаблонов грамматики: ' + gs.counts.total + ', в очереди сегодня: ' + gs.queue.length);
  say('');
  say('Открывай приложение.');

  return log.join('\n');
}

// ==========================================================================
// Menu.gs
// ==========================================================================

/**
 * Меню таблицы.
 *
 * ВАЖНО: этот проект standalone (ADR-02), а простой `onOpen()` вызывается только
 * у скриптов, привязанных к документу. Поэтому меню ставится УСТАНАВЛИВАЕМЫМ
 * триггером на конкретную таблицу — см. installTriggers() в Triggers.gs.
 * Без этого триггера меню не появится, и это не поломка настроек, а следствие
 * выбора standalone.
 *
 * Каждая операция продублирована функцией без префикса `menu`, которую можно
 * запустить прямо из редактора Apps Script: результат уходит в журнал выполнения,
 * а не в диалог. Так всё доступно даже до установки триггера.
 */

function onOpenMenu(e) {
  var ss = e && e.source ? e.source : ss_();
  SpreadsheetApp.getUi()
    .createMenu('Eng_bot')
    .addItem('Импортировать батч из inbox', 'menuImport')
    .addItem('Импортировать грамматику из grammar_inbox', 'menuImportGrammar')
    .addSeparator()
    .addItem('Отправить тестовый пинг', 'menuTestPing')
    .addItem('Проверить webhook', 'menuCheckWebhook')
    .addSeparator()
    .addItem('Первичная настройка листов', 'setupSpreadsheet')
    .addItem('Засеять стартовый батч', 'seedStarterBatch')
    .addItem('Засеять грамматику', 'seedGrammarBatch')
    .addItem('Залить весь банк слов из репозитория', 'menuLoadEverything')
    .addItem('Самопроверка конфигурации', 'menuSelfCheck')
    .addItem('Полная диагностика', 'menuDiagnostics')
    .addToUi();
}

/** Совместимость: если проект однажды сделают привязанным, меню появится и так. */
function onOpen(e) {
  onOpenMenu(e);
}

// ---------------------------------------------------------------------------
// Запускается из редактора: без UI, отчёт в журнал выполнения
// ---------------------------------------------------------------------------

/** Импорт из inbox. Запускай из редактора, результат в журнале (Ctrl+Enter). */
function runImport() {
  var report = importInbox(cfgAllowlist_()[0]);
  Logger.log('Принято единиц: ' + (report.accepted || 0));
  Logger.log('Создано карточек: ' + (report.cards_created || 0));
  Logger.log('Отклонено: ' + (report.rejected || 0));
  Logger.log('Дубликатов: ' + (report.duplicates || 0));
  if (report.batch) Logger.log('Батч: ' + report.batch);
  if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
    Logger.log('Причины построчно — на листе "' + SHEET_REJECTS + '"');
  }
  if (report.message) Logger.log(report.message);
  return report;
}

/** Импорт грамматики из grammar_inbox. Запускай из редактора. */
function runImportGrammar() {
  var report = importGrammarInbox(cfgAllowlist_()[0]);
  Logger.log('Принято заданий: ' + (report.accepted || 0));
  Logger.log('Создано шаблонов: ' + (report.patterns_created || 0));
  Logger.log('Отклонено: ' + (report.rejected || 0));
  Logger.log('Дубликатов: ' + (report.duplicates || 0));
  if (report.batch) Logger.log('Батч: ' + report.batch);
  if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
    Logger.log('Причины построчно — на листе "' + SHEET_GRAMMAR_REJECTS + '"');
  }
  if (report.message) Logger.log(report.message);
  return report;
}

/** Состояние грамматики по данным. Запускай из редактора. */
function runGrammarStats() {
  var s = buildGrammarSession(cfgAllowlist_()[0]);
  Logger.log('Шаблонов всего: ' + s.counts.total);
  Logger.log('К повторению сейчас: ' + s.counts.due);
  Logger.log('Новых в запасе: ' + s.counts.new_available);
  Logger.log('Введено сегодня: ' + s.counts.new_introduced_today);
  Logger.log('В очереди на сегодня: ' + s.queue.length);
  s.patterns.forEach(function (p) {
    Logger.log('  ' + p.label + ' · ' + p.title_ru + ' — ' + p.state +
      (p.due ? ', до ' + p.due : '') + ', заданий в пуле: ' + p.pool_size);
  });
  return s.counts;
}

/** Тестовый пинг в Telegram. Запускай из редактора. */
function runTestPing() {
  dailyPing();
  Logger.log('dailyPing выполнен. Если сообщения нет — проверь BOT_TOKEN и ALLOWLIST.');
}

/** Состояние webhook. Запускай из редактора. */
function runCheckWebhook() {
  var info = tgApi_('getWebhookInfo', {});
  Logger.log(JSON.stringify(info.result || info, null, 2));
  return info;
}

/** Состояние очереди по данным, а не по ощущениям. Запускай из редактора. */
function runStats() {
  var s = buildSession(cfgAllowlist_()[0]);
  Logger.log('Всего карточек: ' + s.counts.total);
  Logger.log('К повторению сейчас: ' + s.counts.due);
  Logger.log('Новых в запасе: ' + s.counts.new_available);
  Logger.log('Заблокировано до созревания: ' + s.counts.locked);
  Logger.log('Пиявок: ' + s.counts.leeches);
  if (s.warnings.length) Logger.log('Предупреждения: ' + s.warnings.join(', '));
  return s.counts;
}

// ---------------------------------------------------------------------------
// Обработчики пунктов меню: те же операции, но с диалогами
// ---------------------------------------------------------------------------

function menuImport() {
  var ui = SpreadsheetApp.getUi();
  try {
    var report = runImport();
    var lines = [
      'Принято единиц: ' + (report.accepted || 0),
      'Создано карточек: ' + (report.cards_created || 0),
      'Отклонено: ' + (report.rejected || 0),
      'Дубликатов: ' + (report.duplicates || 0)
    ];
    if (report.batch) lines.push('', 'Батч: ' + report.batch);
    if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
      lines.push('Причины построчно — на листе "' + SHEET_REJECTS + '".');
    }
    ui.alert('Импорт', lines.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Импорт не выполнен', String(e.message), ui.ButtonSet.OK);
  }
}

function menuTestPing() {
  var ui = SpreadsheetApp.getUi();
  try { runTestPing(); ui.alert('Пинг отправлен'); }
  catch (e) { ui.alert('Не отправлен', String(e.message), ui.ButtonSet.OK); }
}

function menuCheckWebhook() {
  var ui = SpreadsheetApp.getUi();
  var info = runCheckWebhook();
  ui.alert('getWebhookInfo', JSON.stringify(info.result || info, null, 2), ui.ButtonSet.OK);
}

function menuSelfCheck() {
  selfCheck();
  var ui = SpreadsheetApp.getUi();
  ui.alert('Готово', 'Результат в журнале выполнения (Ctrl+Enter).', ui.ButtonSet.OK);
}

function menuImportGrammar() {
  var ui = SpreadsheetApp.getUi();
  try {
    var report = runImportGrammar();
    var lines = [
      'Принято заданий: ' + (report.accepted || 0),
      'Создано шаблонов: ' + (report.patterns_created || 0),
      'Отклонено: ' + (report.rejected || 0),
      'Дубликатов: ' + (report.duplicates || 0)
    ];
    if (report.batch) lines.push('', 'Батч: ' + report.batch);
    if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
      lines.push('Причины построчно — на листе "' + SHEET_GRAMMAR_REJECTS + '".');
    }
    ui.alert('Импорт грамматики', lines.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Импорт грамматики не выполнен', String(e.message), ui.ButtonSet.OK);
  }
}

function menuDiagnostics() {
  var ui = SpreadsheetApp.getUi();
  var report = runDiagnostics();
  // Диалог обрезает длинный текст, поэтому полная версия остаётся в журнале.
  ui.alert('Диагностика', report.slice(0, 1400) +
    (report.length > 1400 ? '\n\n… полностью — в журнале выполнения' : ''), ui.ButtonSet.OK);
}

function menuLoadEverything() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert('Залить весь банк',
    'Будет выставлена дневная норма 10 и залиты все батчи из репозитория.\n' +
    'Повторный запуск безопасен: дубликаты отклоняются, а не дублируются.\n\nПродолжить?',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  try {
    var report = loadEverything();
    ui.alert('Готово', report.slice(0, 1400) +
      (report.length > 1400 ? '\n\n… полностью — в журнале выполнения' : ''), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Не выполнено', String(e.message), ui.ButtonSet.OK);
  }
}

// ==========================================================================
// Main.gs
// ==========================================================================

/**
 * Router. One deployment serves both the Mini App and the Telegram webhook —
 * they are told apart by the shape of the payload, not by the URL.
 *
 * Transport rule that must never be broken on the client side:
 * only "simple" requests. Apps Script does not answer OPTIONS at all, so any
 * preflight kills the call and no server-side header can fix it.
 */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  return json_({ ok: false, code: code, message: message || code });
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    if (action === 'ping') return json_({ ok: true, pong: new Date().toISOString() });
    if (action === 'diag') return json_(diagInitData(e.parameter.initData));
    if (action !== 'session' && action !== 'grammar' && action !== 'practice' &&
        action !== 'stats') {
      return fail_('BAD_REQUEST', 'unknown action: ' + action);
    }

    var auth = verifyInitData(e.parameter.initData);
    if (!auth.ok) return fail_(auth.code);

    if (action === 'grammar') return json_(buildGrammarSession(auth.userId));
    if (action === 'practice') return json_(buildPractice(auth.userId));
    if (action === 'stats') {
      var stats = buildStats(auth.userId);
      stats.achievements = evaluateAchievements(stats);
      return json_(stats);
    }
    return json_(buildSession(auth.userId));
  } catch (err) {
    Logger.log('doGet: ' + err.stack);
    return fail_('INTERNAL', String(err.message));
  }
}

function doPost(e) {
  try {
    var body = e && e.postData ? e.postData.contents : '';
    var payload;
    try { payload = JSON.parse(body || '{}'); } catch (parseErr) {
      return fail_('BAD_REQUEST', 'body is not JSON');
    }

    // Telegram webhook update: has update_id, never has `action`.
    if (payload.update_id !== undefined) {
      if (!verifyWebhookSecret_(e)) return json_({ ok: true });  // stay quiet to strangers
      handleBotUpdate_(payload);
      return json_({ ok: true });
    }

    if (payload.action !== 'flush' && payload.action !== 'grammar_flush') {
      return fail_('BAD_REQUEST', 'unknown action');
    }

    var auth = verifyInitData(payload.initData);
    if (!auth.ok) return fail_(auth.code);

    if (payload.action === 'grammar_flush') {
      return json_(applyGrammarFlush(auth.userId, payload.batch_id, payload.rounds));
    }
    return json_(applyFlush(auth.userId, payload.batch_id, payload.reviews));
  } catch (err) {
    Logger.log('doPost: ' + err.stack);
    if (String(err.message) === 'LOCKED') return fail_('LOCKED', 'another write is in progress');
    return fail_('INTERNAL', String(err.message));
  }
}

