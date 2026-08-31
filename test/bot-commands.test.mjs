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

/**
 * Свежий Bot.gs со стабами вместо всего, что живёт вне файла.
 * Имена перечислены явно: подставить их через with/Proxy было бы короче, но тогда
 * опечатка в имени зависимости молча превратилась бы в undefined вместо падения.
 */
const DEPS = ['cfgAllowlist_', 'CacheService', 'loadEverything', 'buildSession',
  'PropertiesService', 'UrlFetchApp', 'Logger', 'cfg_', 'readSettings_', 'writeSetting_',
  'readCards_', 'readPatterns_', 'readGrammarItems_', 'todayStr_',
  'sendMessage_', 'launchKeyboard_'];

function load(env) {
  // Объявляем только то, чего в самом файле нет: объявленное там перекрывается ниже.
  const declaredInFile = ['sendMessage_', 'launchKeyboard_'];
  const prelude = 'var ' + DEPS.filter(n => !declaredInFile.includes(n)).join(', ') + ';\n';
  const epilogue = '\n' + DEPS
    .map(n => n + ' = env.' + n + ' !== undefined ? env.' + n + ' : ' + n + ';').join('\n') +
    '\nreturn { handleBotUpdate_: handleBotUpdate_, dailyPing: dailyPing };';
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


/**
 * Ежедневный пинг: отметка о РЕЗУЛЬТАТЕ, а не о намерении.
 *
 * Раньше last_trigger_run писался первой строкой dailyPing. Приложение читает ту же
 * метку, чтобы предупредить «триггер молчит» — значит пинг, упавший между отметкой и
 * отправкой, выглядел абсолютно живым. Зелёная метка при отсутствующем сообщении —
 * это тот же самый зелёный тест при мёртвом процессе, только в проде.
 */
function pingHarness(over) {
  const written = {};
  const sent = [];
  const env = {
    cfgAllowlist_: () => ['686280935'],
    Logger: { log() {} },
    readSettings_: () => ({ timezone: 'Europe/Moscow', daily_new_target: '10',
      grammar_daily_new_target: '1', ...(over && over.settings) }),
    writeSetting_: (k, v) => { written[k] = v; },
    readCards_: () => (over && over.cards) || [],
    readPatterns_: () => (over && over.patterns) || [],
    readGrammarItems_: () => (over && over.items) || [],
    todayStr_: () => '2026-08-31',
    launchKeyboard_: () => undefined,
    sendMessage_: (id, text) => {
      sent.push({ id, text });
      return over && over.sendFails ? { ok: false, description: 'blocked' } : { ok: true };
    },
    ...(over && over.env)
  };
  return { env, written, sent };
}

const dueCard = { user_id: '686280935', state: 'review', due: '2026-08-01' };

check('пинг отправляется и отмечается как выполненный', () => {
  const { env, written, sent } = pingHarness({ cards: [dueCard] });
  load(env).dailyPing();
  assert(sent.length === 1, 'сообщений отправлено ' + sent.length);
  assert(written.last_trigger_run, 'успешный пинг не отметился — приложение решит, что триггер мёртв');
});

check('НЕ отмечается, когда Telegram отказался принять сообщение', () => {
  const { env, written, sent } = pingHarness({ cards: [dueCard], sendFails: true });
  load(env).dailyPing();
  assert(sent.length === 1, 'попытка отправки должна была быть');
  assert(!written.last_trigger_run,
    'метка поставлена при неотправленном сообщении — ровно тот дефект, ради которого набор написан');
});

check('НЕ отмечается, когда пинг упал по дороге', () => {
  const { env, written } = pingHarness({
    cards: [dueCard],
    env: { readCards_: () => { throw new Error('лист cards недоступен'); } }
  });
  let threw = false;
  try { load(env).dailyPing(); } catch (e) { threw = true; }
  assert(threw, 'падение должно быть видимым, а не проглоченным');
  assert(!written.last_trigger_run, 'упавший пинг отметился как успешный');
});

check('день без долгов — это тоже сообщение, а не молчание', () => {
  const { env, sent, written } = pingHarness({ cards: [] });
  load(env).dailyPing();
  assert(sent.length === 1, 'в пустой день бот промолчал — тишина неотличима от смерти триггера');
  assert(/свободно/i.test(sent[0].text), 'текст не про свободный день: ' + sent[0].text);
  assert(written.last_trigger_run, 'пустой день тоже успешный пинг');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
