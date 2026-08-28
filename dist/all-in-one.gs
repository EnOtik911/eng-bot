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

// ==========================================================================
// Auth.gs
// ==========================================================================

/**
 * Telegram Mini App initData validation.
 *
 * Scheme (core.telegram.org/bots/webapps):
 *   secret = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   check  = HMAC_SHA256(key=secret,       message=data_check_string)
 * data_check_string = all fields except `hash` and `signature`, sorted by key,
 * joined as "key=value" with \n.
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

  var keys = Object.keys(data).filter(function (k) {
    return k !== 'hash' && k !== 'signature';
  }).sort();
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

function todayStr_(tz) {
  return Utilities.formatDate(new Date(), tz || 'Europe/Moscow', 'yyyy-MM-dd');
}

function daysBetween_(fromStr, toStr) {
  if (!fromStr) return 0;
  var a = new Date(String(fromStr).slice(0, 10) + 'T00:00:00Z').getTime();
  var b = new Date(String(toStr).slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.max(Math.round((b - a) / 86400000), 0);
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

  mine.forEach(function (c) {
    var state = String(c.state || '');
    if (state === 'leech') { leeches++; return; }
    if (state === 'suspended') return;
    if (state === 'locked') { locked++; return; }
    if (state === 'new') { fresh.push(c); return; }
    var dueStr = c.due ? String(c.due).slice(0, 10) : '';
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

  // Due cards always come before new ones: debt first, growth second.
  var queue = due.concat(fresh.slice(0, newTarget)).slice(0, cap);

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
    cards: queue.map(function (c) {
      return {
        card_id: c.card_id,
        direction: c.direction,
        type: c.type,
        en: c.en,
        ru: c.ru,
        example_en: c.example_en,
        example_ru: c.example_ru,
        layer: c.layer,
        state: c.state
      };
    }),
    counts: {
      due: due.length,
      new_available: fresh.length,
      new_in_session: Math.min(fresh.length, newTarget),
      total: mine.length,
      leeches: leeches,
      locked: locked
    },
    warnings: warnings
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

    updates[card.card_id] = {
      _row: card._row,
      patch: {
        state: card.state, due: card.due, stability: out.stability,
        difficulty: out.difficulty, reps: out.reps, lapses: out.lapses,
        last_review: today
      }
    };

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
        layer: r.layer, topic: r.topic, note: r.note,
        state: dir === 'recog' ? 'new' : 'locked',
        due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
        last_review: '', created_at: now, user_id: userId, source_batch: batch
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
  writeSetting_('last_trigger_run', new Date().toISOString());

  var allow = cfgAllowlist_();
  var cards = readCards_();
  var today = todayStr_(settings.timezone);

  allow.forEach(function (userId) {
    var mine = cards.filter(function (c) { return String(c.user_id) === String(userId); });
    var due = mine.filter(function (c) {
      var st = String(c.state);
      if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
      return c.due && String(c.due).slice(0, 10) <= today;
    }).length;
    var fresh = mine.filter(function (c) { return String(c.state) === 'new'; }).length;
    var target = Math.min(parseInt(settings.daily_new_target, 10) || 6, fresh);
    var leeches = mine.filter(function (c) { return String(c.state) === 'leech'; }).length;

    if (due === 0 && target === 0) return;   // nothing to do, so say nothing

    var lines = ['<b>На сегодня</b>'];
    if (due) lines.push('К повторению: ' + due);
    if (target) lines.push('Новых: ' + target);
    if (leeches) lines.push('Пиявок ждёт переформулировки: ' + leeches);
    sendMessage_(userId, lines.join('\n'), launchKeyboard_());
  });
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

function handleBotUpdate_(update) {
  if (updateSeen_(update.update_id)) return;   // повторная доставка того же апдейта
  var msg = update.message;
  if (!msg || !msg.text) return;
  var userId = String(msg.from && msg.from.id);
  if (cfgAllowlist_().indexOf(userId) < 0) return;

  var text = String(msg.text).trim();
  if (text === '/start' || text === '/open') {
    sendMessage_(userId, 'Тренажёр готов.', launchKeyboard_());
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
    .addSeparator()
    .addItem('Отправить тестовый пинг', 'menuTestPing')
    .addItem('Проверить webhook', 'menuCheckWebhook')
    .addSeparator()
    .addItem('Первичная настройка листов', 'setupSpreadsheet')
    .addItem('Засеять стартовый батч', 'seedStarterBatch')
    .addItem('Самопроверка конфигурации', 'menuSelfCheck')
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
    if (action !== 'session') return fail_('BAD_REQUEST', 'unknown action: ' + action);

    var auth = verifyInitData(e.parameter.initData);
    if (!auth.ok) return fail_(auth.code);

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

    if (payload.action !== 'flush') return fail_('BAD_REQUEST', 'unknown action');

    var auth = verifyInitData(payload.initData);
    if (!auth.ok) return fail_(auth.code);

    return json_(applyFlush(auth.userId, payload.batch_id, payload.reviews));
  } catch (err) {
    Logger.log('doPost: ' + err.stack);
    if (String(err.message) === 'LOCKED') return fail_('LOCKED', 'another write is in progress');
    return fail_('INTERNAL', String(err.message));
  }
}

