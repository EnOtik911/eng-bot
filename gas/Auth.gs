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
    var keys = Object.keys(data).filter(function (k) {
      return k !== 'hash' && k !== 'signature';
    }).sort();
    var checkString = keys.map(function (k) { return k + '=' + data[k]; }).join('\n');
    var secret = hmacBytes_(Utilities.newBlob('WebAppData').getBytes(), token);
    var expected = hmacHex_(secret, checkString);
    out.checks.hash_received_head = data.hash.slice(0, 8);
    out.checks.hash_expected_head = expected.slice(0, 8);
    out.checks.hash_matches = constantTimeEquals_(expected, data.hash);
    out.checks.check_string_fields = keys;
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
    out.hint = 'Токен рабочий, но хеш не сошёлся: приложение открыто из другого бота, ' +
      'чем тот, чей токен в свойствах. Сверь bot_username ниже с ботом, из которого ' +
      'открываешь приложение.';
  } else if (out.checks.user_in_allowlist === false && uid) {
    out.hint = 'Подпись верна, но user_id ' + uid + ' не в ALLOWLIST. Добавь его в свойства.';
  }
  return out;
}
