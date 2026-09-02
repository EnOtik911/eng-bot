/**
 * Свободная практика: node test/practice-server.test.mjs
 *
 * Режим существует ради одного свойства — он НЕ двигает расписание. Поэтому набор
 * проверяет не «что-то вернулось», а границы: что практика не выдаёт неувиденное
 * (иначе новое слово въезжает в обход дневной нормы) и что у неё нет обратного
 * канала на сервер (иначе прогон раньше срока записался бы как настоящее повторение
 * и занизил интервал — FSRS считает его от момента фактического ответа).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Список слоёв берётся ИЗ Config.gs, а не переписывается здесь: заглушка успела
// устареть — в ней не было social и analysis, зато остались выведенные mobility и
// hospitality. Порядок слоёв решает, что выдаётся раньше, поэтому набор проверял
// сортировку по списку, которого в проде уже нет. Тот же класс, что и с датами.
const cfgScope = {};
new Function('exports', readFileSync(join(root, 'gas', 'Config.gs'), 'utf8') +
  '\nObject.assign(exports, {VALID_LAYERS});')(cfgScope);

function load({ cards, settings = {} }) {
  const src = readFileSync(join(root, 'gas', 'Session.gs'), 'utf8');
  const fsrs = readFileSync(join(root, 'gas', 'Fsrs.gs'), 'utf8');
  const scope = {};
  const env = {
    VALID_LAYERS: cfgScope.VALID_LAYERS,
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    readSettings_: () => Object.assign({
      timezone: 'Europe/Moscow', session_size_cap: '120', daily_new_target: '10',
      desired_retention: '0.85', leech_threshold: '5', ui_lang: 'ru',
      last_trigger_run: new Date().toISOString()
    }, settings),
    readCards_: () => cards.map((c, i) => Object.assign({ _row: i + 2 }, c)),
    writeCardUpdates_: () => 0,
    appendReviewLog_: () => {},
    flushSeen_: () => false,
    flushRecord_: () => {}
  };
  const names = Object.keys(env);
  new Function(...names, 'exports',
    fsrs + '\n' + src + '\nObject.assign(exports, {buildPractice, buildSession});'
  )(...names.map(n => env[n]), scope);
  return scope;
}

function card(over = {}) {
  return Object.assign({
    card_id: 'c' + Math.random().toString(36).slice(2, 8),
    user_id: '1', direction: 'recog', type: 'collocation',
    en: 'settle the invoice', ru: 'оплатить счёт', example_en: '', example_ru: '',
    layer: 'core', state: 'review', due: '2030-01-01', reps: 3, lapses: 0
  }, over);
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Свободная практика');

check('выдаёт только то, что пользователь уже видел', () => {
  const { buildPractice } = load({ cards: [
    card({ card_id: 'seen1', state: 'review' }),
    card({ card_id: 'seen2', state: 'relearning' }),
    card({ card_id: 'fresh', state: 'new' }),
    card({ card_id: 'lock', state: 'locked' }),
    card({ card_id: 'susp', state: 'suspended' })
  ]});
  const ids = buildPractice('1').cards.map(c => c.card_id).sort();
  assert(ids.join(',') === 'seen1,seen2',
    'выдано: ' + ids.join(',') + ' — новое/запертое/снятое сюда попадать не должно');
});

check('новое слово нельзя протащить в обход дневной нормы', () => {
  const { buildPractice } = load({ cards: Array.from({ length: 50 },
    (_, i) => card({ card_id: 'n' + i, state: 'new' })) });
  const res = buildPractice('1');
  assert(res.cards.length === 0,
    'практика выдала ' + res.cards.length + ' невиданных карточек');
  assert(res.counts.available === 0, 'counts.available врёт: ' + res.counts.available);
});

check('чужие карточки не видны', () => {
  const { buildPractice } = load({ cards: [
    card({ card_id: 'mine', user_id: '1' }),
    card({ card_id: 'alien', user_id: '2' })
  ]});
  const ids = buildPractice('1').cards.map(c => c.card_id);
  assert(ids.length === 1 && ids[0] === 'mine', 'утекло чужое: ' + ids.join(','));
});

check('срок повторения не влияет на выдачу — гонять можно что угодно', () => {
  const { buildPractice } = load({ cards: [
    card({ card_id: 'far', due: '2099-01-01' }),
    card({ card_id: 'near', due: '2020-01-01' })
  ]});
  assert(buildPractice('1').cards.length === 2, 'практика отфильтровала по сроку');
});

check('порядок перемешан, а не совпадает с порядком в таблице', () => {
  const source = Array.from({ length: 40 }, (_, i) => card({ card_id: 'c' + i }));
  const { buildPractice } = load({ cards: source });
  const order = buildPractice('1').cards.map(c => c.card_id);
  const asStored = source.map(c => c.card_id).slice(0, order.length);
  assert(order.join(',') !== asStored.join(','),
    'порядок совпал с табличным — перемешивания нет');
});

check('размер прогона ограничен', () => {
  const { buildPractice } = load({ cards: Array.from({ length: 400 },
    (_, i) => card({ card_id: 'c' + i })) });
  const res = buildPractice('1');
  assert(res.cards.length <= 60, 'выдано ' + res.cards.length + ' — потолок пробит');
  assert(res.counts.available === 400, 'counts.available должен считать всё: ' + res.counts.available);
});

check('форма карточки та же, что и в обычной сессии', () => {
  const cards = [card({ card_id: 'x', state: 'review', due: '2020-01-01' })];
  const { buildPractice, buildSession } = load({ cards });
  const a = Object.keys(buildPractice('1').cards[0]).sort().join(',');
  const b = Object.keys(buildSession('1').cards[0]).sort().join(',');
  assert(a === b, 'формы разошлись:\n         практика: ' + a + '\n         сессия:   ' + b);
});

check('обратного канала у практики нет: сервер не принимает practice_flush', () => {
  const main = readFileSync(join(root, 'gas', 'Main.gs'), 'utf8');
  assert(!/practice_flush/.test(main),
    'в роутере появился practice_flush — прогон начнёт двигать расписание');
  assert(/action === 'practice'/.test(main), 'действие practice не проброшено в doGet');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
