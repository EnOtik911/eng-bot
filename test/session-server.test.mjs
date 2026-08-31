/**
 * buildSession: the daily new-card allowance.
 *
 * The defect this suite exists for was found in the first real session: the target was
 * six new cards a day, and opening the app three times served eighteen — because the
 * allowance was applied per launch. Fifteen distinct cards were introduced in one
 * sitting, which is exactly the review-debt mechanism the default was chosen to avoid.
 *
 *   node test/session-server.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
// Вычисляется, а не задаётся: заглушка Utilities.formatDate возвращает настоящую
// текущую дату, поэтому захардкоженное значение делало набор проходящим ровно один
// календарный день. Он и прошёл — 28 августа, и упал 30-го.
const TODAY = new Date().toISOString().slice(0, 10);

/** Все даты в наборе относительны сегодня: иначе «в будущем» однажды станет прошлым. */
function dayShift(days) {
  return new Date(Date.parse(TODAY + 'T00:00:00Z') + days * 86400000)
    .toISOString().slice(0, 10);
}

function load({ cards, settings = {} }) {
  const src = readFileSync(join(root, 'gas', 'Session.gs'), 'utf8');
  const fsrs = readFileSync(join(root, 'gas', 'Fsrs.gs'), 'utf8');

  const scope = {};
  const env = {
    VALID_LAYERS: ['core', 'business', 'mobility', 'hospitality', 'tech'],
    Utilities: {
      formatDate: (date) => new Date(date).toISOString().slice(0, 10)
    },
    readSettings_: () => Object.assign({
      timezone: 'Europe/Moscow', session_size_cap: '120', daily_new_target: '6',
      desired_retention: '0.85', leech_threshold: '5', unlock_interval_days: '21',
      ui_lang: 'ru', last_trigger_run: new Date().toISOString()
    }, settings),
    readCards_: () => cards.map((c, i) => Object.assign({ _row: i + 2 }, c)),
    writeCardUpdates_: (u) => { scope.__written = u; return u.length; },
    appendReviewLog_: (r) => { scope.__logged = r; },
    flushSeen_: () => false,
    flushRecord_: () => {}
  };

  const names = Object.keys(env);
  const body = fsrs + '\n' + src +
    '\nObject.assign(exports, {buildSession, applyFlush, daysBetween_});';
  new Function(...names, 'exports', body)(...names.map(n => env[n]), scope);
  return scope;
}

function card(over = {}) {
  return Object.assign({
    card_id: 'c' + Math.random().toString(36).slice(2, 7),
    item_id: 'i1', direction: 'recog', type: 'collocation',
    en: 'x', ru: 'х', example_en: '', example_ru: '',
    layer: 'business', topic: '', note: '',
    state: 'new', due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
    last_review: '', created_at: '2026-08-01T00:00:00.000Z',
    user_id: '1', source_batch: 'imp', first_review: ''
  }, over);
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('buildSession: дневная норма новых');

check('на чистый день выдаётся ровно daily_new_target', () => {
  const cards = Array.from({ length: 20 }, () => card({ user_id: '1' }));
  const s = load({ cards }).buildSession('1');
  assert(s.cards.length === 6, 'ожидалось 6, получено ' + s.cards.length);
  assert(s.counts.new_introduced_today === 0, 'сегодня ещё ничего не вводилось');
  assert(s.counts.new_allowance_left === 6, 'остаток нормы должен быть 6');
});

check('норма уменьшается на введённые сегодня — тот самый дефект', () => {
  const cards = [
    // шесть уже введено сегодня
    ...Array.from({ length: 6 }, () => card({
      state: 'review', due: dayShift(-1), reps: 1,
      last_review: TODAY, first_review: TODAY, stability: 1, difficulty: 5
    })),
    // и четырнадцать ещё нетронутых
    ...Array.from({ length: 14 }, () => card())
  ];
  const s = load({ cards }).buildSession('1');
  const newOnes = s.cards.filter(c => c.state === 'new');
  assert(s.counts.new_introduced_today === 6,
    'введено сегодня должно быть 6, получено ' + s.counts.new_introduced_today);
  assert(s.counts.new_allowance_left === 0,
    'остаток нормы должен быть 0, получен ' + s.counts.new_allowance_left);
  assert(newOnes.length === 0,
    'новых выдавать нельзя, норма израсходована — выдано ' + newOnes.length);
});

check('частично израсходованная норма выдаёт остаток', () => {
  const cards = [
    ...Array.from({ length: 4 }, () => card({
      state: 'review', due: dayShift(-1), reps: 1,
      last_review: TODAY, first_review: TODAY, stability: 1, difficulty: 5
    })),
    ...Array.from({ length: 10 }, () => card())
  ];
  const s = load({ cards }).buildSession('1');
  const newOnes = s.cards.filter(c => c.state === 'new');
  assert(newOnes.length === 2, 'должно остаться 2 из 6, выдано ' + newOnes.length);
});

check('введённые в прошлые дни норму не расходуют', () => {
  const cards = [
    ...Array.from({ length: 9 }, () => card({
      state: 'review', due: dayShift(+11), reps: 3,
      last_review: dayShift(-10), first_review: dayShift(-10), stability: 20, difficulty: 5
    })),
    ...Array.from({ length: 10 }, () => card())
  ];
  const s = load({ cards }).buildSession('1');
  const newOnes = s.cards.filter(c => c.state === 'new');
  assert(s.counts.new_introduced_today === 0, 'вчерашние не считаются');
  assert(newOnes.length === 6, 'должно выдаться 6, выдано ' + newOnes.length);
});

check('долг идёт впереди новых', () => {
  const cards = [
    ...Array.from({ length: 3 }, () => card({
      state: 'review', due: dayShift(-3), reps: 2,
      last_review: dayShift(-5), first_review: dayShift(-10), stability: 2, difficulty: 5
    })),
    ...Array.from({ length: 10 }, () => card())
  ];
  const s = load({ cards }).buildSession('1');
  assert(s.cards.length === 9, 'три долга плюс шесть новых, получено ' + s.cards.length);
  assert(s.cards.slice(0, 3).every(c => c.state === 'review'),
    'первыми должны идти просроченные');
});

check('locked, leech и suspended в очередь не попадают', () => {
  const cards = [
    card({ state: 'locked', direction: 'prod' }),
    card({ state: 'leech', lapses: 5 }),
    card({ state: 'suspended' }),
    card()
  ];
  const s = load({ cards }).buildSession('1');
  assert(s.cards.length === 1, 'только одна карточка годна, получено ' + s.cards.length);
  assert(s.counts.locked === 1 && s.counts.leeches === 1, 'счётчики должны это отразить');
});

check('карточки другого пользователя не видны', () => {
  const cards = [card({ user_id: '1' }), card({ user_id: '999' })];
  const s = load({ cards }).buildSession('1');
  assert(s.counts.total === 1, 'всего должно быть 1, получено ' + s.counts.total);
});

check('applyFlush ставит first_review при первой оценке', () => {
  const cards = [card({ card_id: 'cA', user_id: '1' })];
  const mod = load({ cards });
  mod.applyFlush('1', 'b1', [{ card_id: 'cA', rating: 3, ts: TODAY + 'T10:00:00Z' }]);
  const patch = mod.__written[0].patch;
  assert(patch.first_review, 'first_review обязан быть проставлен');
  assert(patch.reps === 1, 'reps должен стать 1');
});

check('applyFlush не перезаписывает уже стоящий first_review', () => {
  const cards = [card({
    card_id: 'cB', user_id: '1', state: 'review', reps: 3, stability: 5, difficulty: 5,
    last_review: dayShift(-5), first_review: dayShift(-20)
  })];
  const mod = load({ cards });
  mod.applyFlush('1', 'b2', [{ card_id: 'cB', rating: 3, ts: TODAY + 'T10:00:00Z' }]);
  const patch = mod.__written[0].patch;
  assert(patch.first_review === undefined,
    'первая дата не должна меняться, а пришло ' + patch.first_review);
});


/**
 * Форма данных, которая приходит из ЖИВОЙ таблицы.
 *
 * Весь набор выше подставляет даты строками — и потому четыре месяца не видел
 * дефекта: getValues() возвращает сырые значения, а Google Sheets молча
 * превращает записанную строку '2026-08-28' в дату. Обратно приходит объект Date,
 * String(date).slice(0, 10) даёт 'Sun Aug 28', и это не равно ни одной дате и
 * БОЛЬШЕ любой '2026-..' при лексикографическом сравнении. Значит 'due <= today'
 * вечно ложно: карточка со сроком не возвращается никогда.
 *
 * Ровно тот случай, ради которого правило «зелёный тест не доказательство»
 * и написано: тест подставлял форму, которой в проде нет.
 */
const asSheetDate = (ymd) => new Date(Date.parse(ymd + 'T00:00:00Z'));

check('карточка со сроком возвращается, когда дата пришла объектом Date', () => {
  const { buildSession } = load({ cards: [
    card({ card_id: 'due1', state: 'review', due: asSheetDate(dayShift(-2)) }),
    card({ card_id: 'due2', state: 'review', due: asSheetDate(TODAY) }),
    card({ card_id: 'later', state: 'review', due: asSheetDate(dayShift(5)) })
  ]});
  const s = buildSession('1');
  assert(s.counts.due === 2,
    'к повторению ' + s.counts.due + ' вместо 2 — сравнение даты не понимает объект Date');
  const ids = s.cards.map(c => c.card_id).sort().join(',');
  assert(ids === 'due1,due2', 'в очереди: ' + ids);
});

check('дневная норма видит новые, введённые сегодня, когда дата пришла объектом Date', () => {
  const { buildSession } = load({
    settings: { daily_new_target: '6' },
    cards: [
      card({ card_id: 'a', state: 'review', first_review: asSheetDate(TODAY), due: asSheetDate(dayShift(9)) }),
      card({ card_id: 'b', state: 'review', first_review: asSheetDate(TODAY), due: asSheetDate(dayShift(9)) }),
      ...Array.from({ length: 20 }, (_, i) => card({ card_id: 'n' + i, state: 'new', due: '' }))
    ]
  });
  const s = buildSession('1');
  assert(s.counts.new_introduced_today === 2,
    'введено сегодня ' + s.counts.new_introduced_today + ' вместо 2 — норма не учитывает ' +
    'уже введённое, и каждый запуск приложения выдаёт полную порцию новых заново');
  assert(s.counts.new_in_session === 4,
    'выдаётся ' + s.counts.new_in_session + ' новых вместо 4 (6 минус 2 введённых)');
});

check('elapsed_days для планировщика считается и по объекту Date', () => {
  const { daysBetween_ } = load({ cards: [] });
  const n = daysBetween_(asSheetDate(dayShift(-7)), TODAY);
  assert(n === 7, 'прошло дней: ' + n + ' — в FSRS уехало бы NaN, а с ним стабильность и сложность');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
