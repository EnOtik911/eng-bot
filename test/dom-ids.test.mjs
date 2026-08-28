/**
 * Разметка и код должны говорить об одних и тех же элементах:
 *   node test/dom-ids.test.mjs
 *
 * Опечатка в id обходит и синтаксическую проверку, и все остальные наборы: файл
 * разбирается, тесты логики не трогают DOM, а в приложении `el('typo')` вернёт null
 * и первое же обращение к свойству обнулит экран без сообщения. Единственный дешёвый
 * способ это поймать — сверить два списка.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', 'app');
const html = readFileSync(join(app, 'index.html'), 'utf8');

const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

const sources = readdirSync(app).filter(f => f.endsWith('.js'));
const referenced = new Map();          // id -> [файлы]
for (const f of sources) {
  const src = readFileSync(join(app, f), 'utf8');
  for (const m of src.matchAll(/(?:\bel|getElementById)\(\s*'([^']+)'\s*\)/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], []);
    if (!referenced.get(m[1]).includes(f)) referenced.get(m[1]).push(f);
  }
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('DOM: разметка и код об одном и том же');

check('каждый id из кода есть в разметке', () => {
  const missing = [...referenced.entries()]
    .filter(([id]) => !declared.has(id))
    .map(([id, files]) => id + ' (из ' + files.join(', ') + ')');
  assert(missing.length === 0, 'в index.html нет элементов:\n         ' + missing.join('\n         '));
  console.log('         сверено id: ' + referenced.size + ' из ' + declared.size + ' объявленных');
});

check('каждый экран из списка SCREENS существует как section', () => {
  const ui = readFileSync(join(app, 'ui.js'), 'utf8');
  const m = ui.match(/var SCREENS = \[([\s\S]*?)\];/);
  assert(m, 'не найден список SCREENS в ui.js');
  const screens = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert(screens.length >= 8, 'экранов в списке: ' + screens.length);
  const bad = screens.filter(s => !new RegExp('<section id="' + s + '"').test(html));
  assert(bad.length === 0, 'экраны без разметки: ' + bad.join(', '));
});

check('каждый section-экран перечислен в SCREENS — иначе он не спрячется', () => {
  const ui = readFileSync(join(app, 'ui.js'), 'utf8');
  const screens = [...ui.match(/var SCREENS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)]
    .map(x => x[1]);
  const sections = [...html.matchAll(/<section id="(screen-[^"]+)"/g)].map(m => m[1]);
  const orphans = sections.filter(s => !screens.includes(s));
  assert(orphans.length === 0,
    'экран есть в разметке, но show() его не выключит: ' + orphans.join(', '));
});

check('порядок подключения скриптов уважает зависимости', () => {
  const order = [...html.matchAll(/<script src="([^"]+\.js)"><\/script>/g)].map(m => m[1]);
  const at = (f) => order.indexOf(f);
  assert(at('answer.js') >= 0 && at('grammar.js') >= 0, 'скрипты не подключены: ' + order.join(', '));
  assert(at('answer.js') < at('grammar.js'), 'grammar.js использует window.Answer');
  assert(at('answer.js') < at('grammar-ui.js'), 'grammar-ui.js использует window.Answer');
  assert(at('grammar.js') < at('grammar-ui.js'), 'grammar-ui.js создаёт GrammarBlock');
  assert(at('ui.js') < at('grammar-ui.js'), 'grammar-ui.js читает window.App, который создаёт ui.js');
  assert(at('i18n.js') < at('ui.js'), 'ui.js читает window.I18N на загрузке');
  assert(at('store.js') < at('ui.js'), 'ui.js читает window.Store');
});

check('каждый ключ строк, который читает код, есть в i18n', () => {
  const i18n = readFileSync(join(app, 'i18n.js'), 'utf8');
  const ruBlock = i18n.slice(i18n.indexOf('ru: {'));
  const keys = new Set([...ruBlock.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1]));
  const used = new Set();
  for (const f of sources) {
    const src = readFileSync(join(app, f), 'utf8');
    for (const m of src.matchAll(/\bT\.(\w+)/g)) used.add(m[1]);
  }
  const missing = [...used].filter(k => !keys.has(k));
  assert(missing.length === 0, 'нет в i18n.ru: ' + missing.join(', '));
  console.log('         сверено ключей: ' + used.size + ' из ' + keys.size + ' объявленных');
});

check('сырые английские имена типов заданий не выводятся в интерфейс', () => {
  // `item.kind` — это scramble/gapfill/transform/fix, значение схемы. Русская
  // инструкция для каждого типа уже есть в i18n; вывод самого значения показывал
  // рядом два обозначения одного и того же, одно из них на чужом языке.
  const ui = readFileSync(join(app, 'grammar-ui.js'), 'utf8');
  const leaks = [...ui.matchAll(/textContent\s*=\s*[^;\n]*\bitem\.kind\b/g)]
    .concat([...ui.matchAll(/innerHTML\s*=\s*[^;\n]*\bitem\.kind\b/g)]);
  assert(leaks.length === 0,
    'item.kind выводится напрямую: ' + leaks.map(m => m[0]).join(' | '));
  assert(/kindInstruction/.test(ui), 'русские инструкции по типам должны использоваться');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
