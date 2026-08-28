/**
 * Verifies the Telegram initData scheme in gas/Auth.gs against an independently
 * computed signature, with the Apps Script globals stubbed by node crypto.
 *   node test/auth.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHmac } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const authSrc = readFileSync(join(here, '..', 'gas', 'Auth.gs'), 'utf8');

const BOT_TOKEN = '123456:AAFakeTokenForTestsOnly_do_not_use';
const ALLOWED_ID = '777000';

// --- Apps Script stubs -------------------------------------------------------
const Utilities = {
  newBlob: (s) => ({ getBytes: () => Array.from(Buffer.from(String(s), 'utf8')) }),
  computeHmacSha256Signature: (valueBytes, keyBytes) => {
    const key = Buffer.from(keyBytes.map(b => b < 0 ? b + 256 : b));
    const value = Buffer.from(valueBytes.map(b => b < 0 ? b + 256 : b));
    const out = createHmac('sha256', key).update(value).digest();
    // Apps Script returns signed bytes
    return Array.from(out).map(b => (b > 127 ? b - 256 : b));
  }
};
const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => ({ BOT_TOKEN, SHEET_ID: 'x', ALLOWLIST: ALLOWED_ID }[k] || null)
  })
};
function cfg_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('missing ' + k);
  return v;
}
function cfgAllowlist_() { return cfg_('ALLOWLIST').split(',').map(s => s.trim()); }

const scope = {};
new Function('Utilities', 'PropertiesService', 'cfg_', 'cfgAllowlist_', 'exports',
  authSrc + '\nObject.assign(exports, {verifyInitData, constantTimeEquals_});'
)(Utilities, PropertiesService, cfg_, cfgAllowlist_, scope);
const { verifyInitData, constantTimeEquals_ } = scope;

// --- independent reference signer (not the code under test) ------------------
function signInitData(fields, token) {
  const keys = Object.keys(fields).sort();
  const checkString = keys.map(k => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  const params = keys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(fields[k])}`);
  params.push('hash=' + hash);
  return params.join('&');
}

function makeInitData(overrides = {}, token = BOT_TOKEN) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHtest',
    user: JSON.stringify({ id: Number(ALLOWED_ID), first_name: 'N', language_code: 'ru' }),
    ...overrides
  };
  return signInitData(fields, token);
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Telegram initData validation');

check('a correctly signed payload is accepted', () => {
  const res = verifyInitData(makeInitData());
  assert(res.ok === true, 'expected ok, got ' + JSON.stringify(res));
  assert(res.userId === ALLOWED_ID, 'userId, got ' + res.userId);
});

check('a tampered field is rejected', () => {
  let init = makeInitData();
  init = init.replace('first_name%22%3A%22N', 'first_name%22%3A%22X');
  const res = verifyInitData(init);
  assert(res.ok === false && res.code === 'BAD_INIT_DATA', JSON.stringify(res));
});

check('a payload signed with another token is rejected', () => {
  const res = verifyInitData(makeInitData({}, '999:OtherToken'));
  assert(res.ok === false && res.code === 'BAD_INIT_DATA', JSON.stringify(res));
});

check('a stale auth_date is rejected with its own code', () => {
  const old = String(Math.floor(Date.now() / 1000) - 25 * 3600);
  const res = verifyInitData(makeInitData({ auth_date: old }));
  assert(res.ok === false && res.code === 'STALE_INIT_DATA', JSON.stringify(res));
});

check('auth_date just inside the window is accepted', () => {
  const recent = String(Math.floor(Date.now() / 1000) - 23 * 3600);
  const res = verifyInitData(makeInitData({ auth_date: recent }));
  assert(res.ok === true, JSON.stringify(res));
});

check('a valid signature from a user outside the allowlist is rejected', () => {
  const res = verifyInitData(makeInitData({ user: JSON.stringify({ id: 424242 }) }));
  assert(res.ok === false && res.code === 'NOT_ALLOWED', JSON.stringify(res));
});

check('the signature field is excluded from the check string', () => {
  // Telegram may add `signature`; including it would break every real payload.
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(ALLOWED_ID) })
  };
  const signed = signInitData(fields, BOT_TOKEN) + '&signature=whatever';
  const res = verifyInitData(signed);
  assert(res.ok === true, 'extra signature field must not break validation: ' + JSON.stringify(res));
});

check('missing, empty and malformed input never throws', () => {
  for (const bad of [undefined, null, '', 'garbage', 'hash=abc', '=&=', 42, {}]) {
    const res = verifyInitData(bad);
    assert(res.ok === false, 'must be rejected: ' + String(bad));
  }
});

check('comparison is length-safe and value-correct', () => {
  assert(constantTimeEquals_('abc', 'abc') === true, 'equal');
  assert(constantTimeEquals_('abc', 'abd') === false, 'different');
  assert(constantTimeEquals_('abc', 'abcd') === false, 'different length');
  assert(constantTimeEquals_('abc', null) === false, 'null');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
