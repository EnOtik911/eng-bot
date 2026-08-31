/**
 * Метрики: node test/stats-server.test.mjs
 *
 * Проверяются те места, где цифра выглядит правдоподобной и при этом врёт:
 * удержание, посчитанное вместе с первым показом, измеряет темп ввода новых
 * слов, а не память; серия, обнуляющаяся до первой утренней карточки, каждый
 * день сбрасывает то, ради чего её и заводят; накопительный график без базы
 * начинается с нуля и врёт про объём словаря.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const shift = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') + d * 86400000)
  .toISOString().slice(0, 10);

function load({ cards = [], patterns = [], log = [], glog = [], settings = {} }) {
  const scope = {};
  const env = {
    LOG_COLUMNS: [], GRAMMAR_LOG_COLUMNS: [], STATS_WINDOW_DAYS: 30,
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    todayStr_: () => TODAY,
    readSettings_: () => ({ timezone: 'Europe/Moscow', ...settings }),
    readCards_: () => cards,
    readPatterns_: () => patterns,
    logSheetName_: () => 'review_log',
    grammarLogSheetName_: () => 'grammar_log',
    readRows_: (name) => (name === 'review_log' ? log : glog)
  };
  const names = Object.keys(env);
  new Function(...names, 'exports',
    readFileSync(join(root, 'gas', 'Stats.gs'), 'utf8') +
    '\nObject.assign(exports, {buildStats, exportReviewsCsv, streak_, retention_});'
  )(...names.map(n => env[n]), scope);
  return scope;
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

const card = (o = {}) => ({ card_id: 'c1', user_id: '1', state: 'review', en: 'a', ru: 'б',
  direction: 'recog', layer: 'core', type: 'word', stability: 10, first_review: shift(-5), ...o });
const rev = (o = {}) => ({ card_id: 'c1', ts: TODAY + 'T09:00:00Z', rating: 3,
  elapsed_days: 3, interval_days: 6, stability: 10, difficulty: 5, ...o });

console.log('Метрики');

check('удержание не считает первый показ карточки', () => {
  // Первый показ всегда elapsed_days = 0 и почти всегда «не помню». Если мешать
  // его в долю, метрика поедет вниз ровно тогда, когда вводится больше новых слов.
  const { buildStats } = load({
    cards: [card()],
    log: [rev({ rating: 1, elapsed_days: 0 }), rev({ rating: 1, elapsed_days: 0 }),
          rev({ rating: 3, elapsed_days: 4 }), rev({ rating: 4, elapsed_days: 6 })]
  });
  const r = buildStats('1').blocks.vocab.retention_7d;
  assert(r === 1, 'удержание ' + r + ', ожидалась 1 — первые показы попали в расчёт');
});

check('удержание без зрелых повторений равно null, а не нулю', () => {
  const { buildStats } = load({ cards: [card()], log: [rev({ rating: 1, elapsed_days: 0 })] });
  const r = buildStats('1').blocks.vocab.retention_7d;
  assert(r === null, 'вернулось ' + r + ' — ноль читается как «всё забыл», а данных просто нет');
});

check('серия считает дни подряд назад от сегодня', () => {
  const { streak_ } = load({});
  assert(streak_([TODAY, shift(-1), shift(-2)], TODAY) === 3, 'три дня подряд посчитаны неверно');
  assert(streak_([TODAY, shift(-1), shift(-3)], TODAY) === 2, 'разрыв не оборвал серию');
});

check('серия не обнуляется утром, пока сегодня ещё не начато', () => {
  const { streak_ } = load({});
  const n = streak_([shift(-1), shift(-2), shift(-3)], TODAY);
  assert(n === 3, 'серия ' + n + ' вместо 3 — до первой утренней карточки она бы сбрасывалась');
});

check('накопительный график стартует с уже освоенного, а не с нуля', () => {
  const { buildStats } = load({
    cards: [card({ card_id: 'old1', first_review: shift(-200) }),
            card({ card_id: 'old2', first_review: shift(-100) }),
            card({ card_id: 'new1', first_review: TODAY })]
  });
  const s = buildStats('1').series;
  assert(s.learned_cumulative[0] === 2,
    'первый день графика = ' + s.learned_cumulative[0] + ', а до окна уже освоено 2');
  assert(s.learned_cumulative[s.learned_cumulative.length - 1] === 3,
    'последний день = ' + s.learned_cumulative.at(-1) + ', ожидалось 3');
});

check('ось графика — ровно окно и заканчивается сегодня', () => {
  const { buildStats } = load({ cards: [card()] });
  const s = buildStats('1').series;
  assert(s.days.length === 30, 'дней ' + s.days.length);
  assert(s.days.at(-1) === TODAY, 'последний день оси ' + s.days.at(-1));
  assert(s.reviews.length === s.days.length, 'ряд короче оси — график съедет');
});

check('чужие карточки и шаблоны не попадают в метрики', () => {
  const { buildStats } = load({
    cards: [card({ user_id: '1' }), card({ card_id: 'x', user_id: '2' })],
    patterns: [{ pattern_id: 'p1', user_id: '2', state: 'review' }]
  });
  const r = buildStats('1');
  assert(r.blocks.vocab.total === 1, 'лексика: ' + r.blocks.vocab.total);
  assert(r.blocks.grammar.total === 0, 'грамматика: ' + r.blocks.grammar.total);
});

check('отсутствие листа журнала не роняет метрики', () => {
  const scope = {};
  const env = {
    LOG_COLUMNS: [], GRAMMAR_LOG_COLUMNS: [], STATS_WINDOW_DAYS: 30,
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    todayStr_: () => TODAY,
    readSettings_: () => ({ timezone: 'Europe/Moscow' }),
    readCards_: () => [card()], readPatterns_: () => [],
    logSheetName_: () => 'review_log', grammarLogSheetName_: () => 'grammar_log',
    readRows_: () => { throw new Error('лист не найден'); }
  };
  const names = Object.keys(env);
  new Function(...names, 'exports',
    readFileSync(join(root, 'gas', 'Stats.gs'), 'utf8') +
    '\nObject.assign(exports, {buildStats});')(...names.map(n => env[n]), scope);
  const r = scope.buildStats('1');
  assert(r.ok === true, 'метрики упали на пустом журнале');
  assert(r.totals.reviews_all_time === 0, 'повторений ' + r.totals.reviews_all_time);
});

check('выгрузка экранирует запятые и кавычки', () => {
  const { exportReviewsCsv } = load({
    cards: [card({ en: 'settle up, quickly', ru: 'сказал "да"' })],
    log: [rev()]
  });
  const { csv, rows } = exportReviewsCsv('1');
  assert(rows === 1, 'строк ' + rows);
  assert(csv.includes('"settle up, quickly"'), 'запятая не экранирована:\n' + csv);
  assert(csv.includes('"сказал ""да"""'), 'кавычки не удвоены:\n' + csv);
});

check('в выгрузку не попадают чужие и удалённые карточки', () => {
  const { exportReviewsCsv } = load({
    cards: [card({ card_id: 'mine', user_id: '1' })],
    log: [rev({ card_id: 'mine' }), rev({ card_id: 'alien' }), rev({ card_id: 'deleted' })]
  });
  const { rows, csv } = exportReviewsCsv('1');
  assert(rows === 1, 'строк ' + rows + ' — в файл уехало лишнее');
  assert(!csv.includes('alien'), 'чужая строка в выгрузке');
});

check('выгрузка содержит и лексику, и грамматику', () => {
  const { exportReviewsCsv } = load({
    cards: [card({ card_id: 'v1' })],
    patterns: [{ pattern_id: 'p1', user_id: '1', label: 'Present Simple', title_ru: 'третье лицо' }],
    log: [rev({ card_id: 'v1' })],
    glog: [{ pattern_id: 'p1', ts: TODAY + 'T10:00:00Z', rating: 3, elapsed_days: 2 }]
  });
  const { csv } = exportReviewsCsv('1');
  assert(/,vocab,/.test(csv), 'нет строк лексики');
  assert(/,grammar,/.test(csv), 'нет строк грамматики');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
