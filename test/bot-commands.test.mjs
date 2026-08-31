/**
 * Диспетчер команд бота исполняется по-настоящему: node test/bot-commands.test.mjs
 *
 * Статическая проверка «в файле есть строка /load» прошла бы и при опечатке в имени
 * вызываемой функции. Поэтому handleBotUpdate_ здесь именно ВЫЗЫВАЕТСЯ с подставными
 * зависимостями, и проверяется, что именно он позвал и что отправил.
 *
 * Зачем вообще команда в боте: залить банк можно только нажав пункт меню в таблице,
 * а `clasp run` тут невозможен — нет GCP-проекта. Чат остаётся единственным пультом.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'gas', 'Bot.gs'), 'utf8');

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

/** Свежий Bot.gs со стабами вместо всего, что живёт вне файла. */
function load(env) {
  const prelude = 'var cfgAllowlist_, CacheService, loadEverything, buildSession, ' +
    'PropertiesService, UrlFetchApp, Logger, cfg_;\n';
  const epilogue = '\n' + ['cfgAllowlist_', 'CacheService', 'loadEverything', 'buildSession',
    'PropertiesService', 'UrlFetchApp', 'Logger', 'cfg_', 'sendMessage_', 'launchKeyboard_']
    .map(n => n + ' = env.' + n + ' !== undefined ? env.' + n + ' : ' + n + ';').join('\n') +
    '\nreturn { handleBotUpdate_: handleBotUpdate_ };';
  return new Function('env', prelude + src + epilogue)(env);
}

function harness(extra) {
  const sent = [];
  const store = {};
  const env = {
    cfgAllowlist_: () => ['686280935'],
    CacheService: { getScriptCache: () => ({ get: k => store[k], put: (k, v) => { store[k] = v; } }) },
    Logger: { log() {} },
    sendMessage_: (id, text) => { sent.push({ id, text }); return { ok: true }; },
    launchKeyboard_: () => undefined,
    ...extra
  };
  return { env, sent };
}

const msg = (text, id) => ({
  update_id: id || Math.floor(Math.random() * 1e9),
  message: { text, from: { id: 686280935 } }
});

console.log('Команды бота: реальный вызов диспетчера');

check('/start отвечает', () => {
  const { env, sent } = harness();
  load(env).handleBotUpdate_(msg('/start'));
  assert(sent.length === 1, 'ответа нет');
});

check('/load вызывает loadEverything и присылает его отчёт', () => {
  let called = 0;
  const { env, sent } = harness({ loadEverything: () => { called++; return 'ИТОГО принято единиц: 303'; } });
  load(env).handleBotUpdate_(msg('/load'));
  assert(called === 1, 'loadEverything вызван ' + called + ' раз(а), ожидался 1');
  assert(sent.length >= 1, 'бот ничего не ответил на /load');
  assert(sent.some(m => m.text.includes('303')),
    'отчёт загрузчика не доехал до чата: ' + JSON.stringify(sent.map(m => m.text)));
});

check('падение загрузчика доезжает до чата, а не тонет в логе', () => {
  const { env, sent } = harness({ loadEverything: () => { throw new Error('нет сети'); } });
  load(env).handleBotUpdate_(msg('/load'));
  assert(sent.some(m => m.text.includes('нет сети')),
    'ошибка не отправлена пользователю: ' + JSON.stringify(sent.map(m => m.text)));
});

check('повторная доставка того же update_id не заливает банк дважды', () => {
  let called = 0;
  const { env } = harness({ loadEverything: () => { called++; return 'ok'; } });
  const bot = load(env);
  const one = msg('/load', 777);
  bot.handleBotUpdate_(one);
  bot.handleBotUpdate_(one);
  assert(called === 1, 'loadEverything вызван ' + called + ' раз(а) — дедуп не сработал');
});

check('чужой пользователь не может запустить заливку', () => {
  let called = 0;
  const { env, sent } = harness({ loadEverything: () => { called++; return 'ok'; } });
  load(env).handleBotUpdate_({ update_id: 5, message: { text: '/load', from: { id: 111 } } });
  assert(called === 0, 'заливку запустил не владелец');
  assert(sent.length === 0, 'чужому вообще не отвечаем');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
