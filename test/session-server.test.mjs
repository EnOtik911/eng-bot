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
const TODAY = '2026-08-28';

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
      state: 'review', due: '2026-08-29', reps: 1,
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
      state: 'review', due: '2026-08-29', reps: 1,
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
      state: 'review', due: '2026-09-10', reps: 3,
      last_review: '2026-08-20', first_review: '2026-08-20', stability: 20, difficulty: 5
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
      state: 'review', due: '2026-08-27', reps: 2,
      last_review: '2026-08-25', first_review: '2026-08-20', stability: 2, difficulty: 5
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
  mod.applyFlush('1', 'b1', [{ card_id: 'cA', rating: 3, ts: '2026-08-28T10:00:00Z' }]);
  const patch = mod.__written[0].patch;
  assert(patch.first_review, 'first_review обязан быть проставлен');
  assert(patch.reps === 1, 'reps должен стать 1');
});

check('applyFlush не перезаписывает уже стоящий first_review', () => {
  const cards = [card({
    card_id: 'cB', user_id: '1', state: 'review', reps: 3, stability: 5, difficulty: 5,
    last_review: '2026-08-25', first_review: '2026-08-10'
  })];
  const mod = load({ cards });
  mod.applyFlush('1', 'b2', [{ card_id: 'cB', rating: 3, ts: '2026-08-28T10:00:00Z' }]);
  const patch = mod.__written[0].patch;
  assert(patch.first_review === undefined,
    'первая дата не должна меняться, а пришло ' + patch.first_review);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
