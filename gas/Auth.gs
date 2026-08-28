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
