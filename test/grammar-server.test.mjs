/**
 * Grammar scheduler on the server: node test/grammar-server.test.mjs
 *
 * The defect class this guards against is the one the vocabulary block already
 * shipped once: an allowance applied per app launch instead of per day. Grammar
 * has the same shape, so it gets the same assertion up front rather than after
 * the fact.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const TODAY = new Date().toISOString().slice(0, 10);

function dayShift(days) {
  return new Date(Date.parse(TODAY + 'T00:00:00Z') + days * 86400000)
    .toISOString().slice(0, 10);
}

// Список слоёв берётся ИЗ Config.gs, а не переписывается здесь: заглушка успела
// устареть — в ней не было social и analysis, зато остались выведенные mobility и
// hospitality. Порядок слоёв решает, что выдаётся раньше, поэтому набор проверял
// сортировку по списку, которого в проде уже нет. Тот же класс, что и с датами.
const cfgScope = {};
new Function('exports', readFileSync(join(root, 'gas', 'Config.gs'), 'utf8') +
  '\nObject.assign(exports, {VALID_LAYERS});')(cfgScope);

function load({ patterns = [], items = [], settings = {}, flushed = false } = {}) {
  const scope = {};
  const env = {
    VALID_LAYERS: cfgScope.VALID_LAYERS,
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    readSettings_: () => Object.assign({
      timezone: 'Europe/Moscow', session_size_cap: '120', daily_new_target: '6',
      desired_retention: '0.85', leech_threshold: '5', unlock_interval_days: '21',
      grammar_daily_new_target: '1', grammar_desired_retention: '0.9',
      grammar_items_per_round: '3', grammar_session_cap: '8',
      ui_lang: 'ru', last_trigger_run: new Date().toISOString()
    }, settings),
    readCards_: () => [],
    writeCardUpdates_: () => 0,
    appendReviewLog_: () => {},
    readPatterns_: () => patterns.map((p, i) => Object.assign({ _row: i + 2 }, p)),
    readGrammarItems_: () => items.map((it, i) => Object.assign({ _row: i + 2 }, it)),
    writePatternUpdates_: (u) => { scope.__patterns = u; return u.length; },
    writeGrammarItemUpdates_: (u) => { scope.__items = u; return u.length; },
    appendGrammarLog_: (r) => { scope.__log = r; },
    flushSeen_: () => flushed,
    flushRecord_: (id, n) => { scope.__recorded = [id, n]; }
  };
  const names = Object.keys(env);
  const body = readFileSync(join(root, 'gas', 'Fsrs.gs'), 'utf8') + '\n' +
    readFileSync(join(root, 'gas', 'Session.gs'), 'utf8') + '\n' +
    readFileSync(join(root, 'gas', 'Grammar.gs'), 'utf8') +
    '\nObject.assign(exports, {buildGrammarSession, applyGrammarFlush, grammarRating_, sortPool_});';
  new Function(...names, 'exports', body)(...names.map(n => env[n]), scope);
  return scope;
}

function pattern(over = {}) {
  return Object.assign({
    pattern_id: 'p1', order_index: 10, label: 'Present Perfect', title_ru: 'since / for',
    notes_slug: 'pp', state: 'new', due: '', stability: '', difficulty: '',
    reps: 0, lapses: 0, last_review: '', first_review: '',
    created_at: '2026-08-01T00:00:00.000Z', user_id: '1', source_batch: 'g'
  }, over);
}

function item(over = {}) {
  return Object.assign({
    item_id: 'i' + Math.random().toString(36).slice(2, 7), pattern_id: 'p1',
    kind: 'gapfill', prompt_ru: '', stem: 'I ___ here.', answer: 'have been',
    tokens: '', hint_ru: 'потому что', serve_count: 0, last_served: '',
    created_at: '2026-08-01T00:00:00.000Z', source_batch: 'g'
  }, over);
}

function poolOf(patternId, n, over = () => ({})) {
  return Array.from({ length: n }, (_, i) =>
    item(Object.assign({ item_id: patternId + '_i' + i, pattern_id: patternId }, over(i))));
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Планировщик грамматики');

check('оценка выводится из фактов, а не запрашивается', () => {
  const { grammarRating_ } = load();
  assert(grammarRating_(0, 0, 3) === 4, 'чисто и без подсказок → Легко');
  assert(grammarRating_(0, 1, 3) === 3, 'подсказка обрезает до Помню');
  assert(grammarRating_(0, 3, 3) === 3, 'три подсказки всё равно Помню, не ниже');
  assert(grammarRating_(1, 0, 3) === 2, 'одна ошибка из трёх → С трудом');
  assert(grammarRating_(2, 0, 3) === 1, 'две ошибки из трёх → Не помню');
  assert(grammarRating_(1, 1, 3) === 2, 'ошибка важнее подсказки');
});

check('подсказка НИКОГДА не даёт максимальную оценку', () => {
  const { grammarRating_ } = load();
  for (let total = 1; total <= 8; total++) {
    for (let hints = 1; hints <= total; hints++) {
      const r = grammarRating_(0, hints, total);
      assert(r <= 3, `errors=0 hints=${hints} total=${total} дал ${r}`);
    }
  }
});

check('шаблон без заданий не попадает ни в очередь, ни в пулы', () => {
  const { buildGrammarSession } = load({
    patterns: [pattern({ pattern_id: 'empty' }), pattern({ pattern_id: 'full' })],
    items: poolOf('full', 3)
  });
  const s = buildGrammarSession('1');
  assert(s.queue.indexOf('empty') < 0, 'пустой шаблон в очереди: ' + JSON.stringify(s.queue));
  assert(!s.pools.empty, 'пустой шаблон получил пул');
  assert(s.pools.full.length === 3, 'полный шаблон без пула');
});

check('долг идёт раньше новых, новые ограничены дневной нормой', () => {
  const { buildGrammarSession } = load({
    patterns: [
      pattern({ pattern_id: 'a', state: 'review', due: dayShift(-2), order_index: 30 }),
      pattern({ pattern_id: 'b', state: 'new', order_index: 10 }),
      pattern({ pattern_id: 'c', state: 'new', order_index: 20 }),
      pattern({ pattern_id: 'd', state: 'review', due: dayShift(+5), order_index: 40 })
    ],
    items: [...poolOf('a', 3), ...poolOf('b', 3), ...poolOf('c', 3), ...poolOf('d', 3)]
  });
  const s = buildGrammarSession('1');
  assert(s.queue.length === 2, 'ожидалось долг+1 новый, получено ' + JSON.stringify(s.queue));
  assert(s.queue[0] === 'a', 'долг должен быть первым: ' + JSON.stringify(s.queue));
  assert(s.queue[1] === 'b', 'новый берётся по order_index: ' + JSON.stringify(s.queue));
  assert(s.queue.indexOf('d') < 0, 'шаблон на будущее попал в очередь');
  // Пул отдаётся и для незапланированного шаблона: выбор рукой не должен стоить запроса.
  assert(s.pools.d && s.pools.d.length === 3, 'пул для будущего шаблона не отдан');
});

check('дневная норма считается по дню, а не по запуску приложения', () => {
  const { buildGrammarSession } = load({
    patterns: [
      pattern({ pattern_id: 'x', state: 'review', due: dayShift(+9), first_review: TODAY }),
      pattern({ pattern_id: 'y', state: 'new', order_index: 20 })
    ],
    items: [...poolOf('x', 3), ...poolOf('y', 3)]
  });
  const s = buildGrammarSession('1');
  assert(s.counts.new_introduced_today === 1, 'введено сегодня: ' + s.counts.new_introduced_today);
  assert(s.counts.new_allowance_left === 0, 'остаток нормы: ' + s.counts.new_allowance_left);
  assert(s.queue.length === 0, 'норма израсходована, а очередь не пуста: ' + JSON.stringify(s.queue));
});

check('пул отдаётся начиная с наименее показанных', () => {
  const { buildGrammarSession } = load({
    patterns: [pattern({ pattern_id: 'p1' })],
    items: [
      item({ item_id: 'hot', serve_count: 9, last_served: dayShift(-1) }),
      item({ item_id: 'cold', serve_count: 0, last_served: '' }),
      item({ item_id: 'mid', serve_count: 2, last_served: dayShift(-9) })
    ],
    settings: { grammar_items_per_round: '1' }
  });
  const s = buildGrammarSession('1');
  const ids = s.pools.p1.map(i => i.item_id);
  assert(ids[0] === 'cold', 'первым должен идти ни разу не показанный: ' + ids.join(','));
  assert(ids[1] === 'mid', 'вторым — показанный дважды: ' + ids.join(','));
});

check('токены приходят массивом, а не строкой с разделителями', () => {
  const { buildGrammarSession } = load({
    patterns: [pattern()],
    items: [item({ kind: 'scramble', tokens: 'I|have|been|here', answer: 'I have been here.' })]
  });
  const s = buildGrammarSession('1');
  const t = s.pools.p1[0].tokens;
  assert(Array.isArray(t) && t.length === 4, 'tokens: ' + JSON.stringify(t));
  assert(t[0] === 'I' && t[3] === 'here', 'порядок токенов: ' + JSON.stringify(t));
});

check('чужие шаблоны не видны', () => {
  const { buildGrammarSession } = load({
    patterns: [pattern({ user_id: '999' })],
    items: poolOf('p1', 3)
  });
  const s = buildGrammarSession('1');
  assert(s.patterns.length === 0, 'чужой шаблон отдан: ' + JSON.stringify(s.patterns));
});

check('раунд пишет состояние шаблона и счётчики показов', () => {
  const scope = load({ patterns: [pattern()], items: poolOf('p1', 3) });
  const res = scope.applyGrammarFlush('1', 'b1', [{
    pattern_id: 'p1',
    results: [
      { item_id: 'p1_i0', correct: true, hint_used: false },
      { item_id: 'p1_i1', correct: true, hint_used: false },
      { item_id: 'p1_i2', correct: true, hint_used: false }
    ],
    ts: new Date().toISOString()
  }]);
  assert(res.ok && res.applied === 1, 'applied: ' + JSON.stringify(res));
  assert(res.outcomes[0].rating === 4, 'оценка: ' + res.outcomes[0].rating);
  assert(res.outcomes[0].interval_days >= 1, 'интервал: ' + res.outcomes[0].interval_days);

  const p = scope.__patterns[0].patch;
  assert(p.state === 'review', 'состояние: ' + p.state);
  assert(p.first_review === TODAY, 'first_review: ' + p.first_review);
  assert(p.due === res.outcomes[0].due, 'due расходится с отчётом');
  assert(Number(p.stability) > 0, 'стабильность не записана');

  assert(scope.__items.length === 3, 'счётчики показов: ' + scope.__items.length);
  scope.__items.forEach(u => {
    assert(u.patch.serve_count === 1, 'serve_count: ' + u.patch.serve_count);
    assert(u.patch.last_served === TODAY, 'last_served: ' + u.patch.last_served);
  });
});

check('два раунда одного шаблона в одном батче складываются, а не затирают друг друга', () => {
  const scope = load({ patterns: [pattern()], items: poolOf('p1', 6) });
  const clean = (ids) => ids.map(i => ({ item_id: i, correct: true, hint_used: false }));
  const dirty = (ids) => ids.map(i => ({ item_id: i, correct: false, hint_used: false }));
  const res = scope.applyGrammarFlush('1', 'b2', [
    { pattern_id: 'p1', results: clean(['p1_i0', 'p1_i1', 'p1_i2']) },
    { pattern_id: 'p1', results: dirty(['p1_i3', 'p1_i4', 'p1_i5']) }
  ]);
  assert(res.applied === 2, 'applied: ' + res.applied);
  assert(res.outcomes[0].rating === 4 && res.outcomes[1].rating === 1,
    'оценки: ' + res.outcomes.map(o => o.rating).join(','));
  const patch = scope.__patterns[0].patch;
  assert(patch.reps === 2, 'reps после двух раундов: ' + patch.reps);
  assert(patch.lapses === 1, 'провал второго раунда не записан: lapses=' + patch.lapses);
  assert(scope.__log.length === 2, 'строк в журнале: ' + scope.__log.length);
  assert(scope.__log[0].length === 11, 'ширина строки журнала: ' + scope.__log[0].length);
});

check('повторный батч с тем же id ничего не применяет', () => {
  const scope = load({ patterns: [pattern()], items: poolOf('p1', 3), flushed: true });
  const res = scope.applyGrammarFlush('1', 'b1', [{
    pattern_id: 'p1', results: [{ item_id: 'p1_i0', correct: true, hint_used: false }]
  }]);
  assert(res.ok && res.applied === 0 && res.skipped_duplicate === true,
    JSON.stringify(res));
  assert(scope.__patterns === undefined, 'запись всё-таки произошла');
});

check('раунд по чужому шаблону игнорируется', () => {
  const scope = load({ patterns: [pattern({ user_id: '999' })], items: poolOf('p1', 3) });
  const res = scope.applyGrammarFlush('1', 'b3', [{
    pattern_id: 'p1', results: [{ item_id: 'p1_i0', correct: true, hint_used: false }]
  }]);
  assert(res.applied === 0, 'applied: ' + res.applied);
});

check('батч без id отклоняется', () => {
  const scope = load({ patterns: [pattern()], items: poolOf('p1', 3) });
  const res = scope.applyGrammarFlush('1', '', [{ pattern_id: 'p1', results: [] }]);
  assert(res.ok === false && res.code === 'BAD_REQUEST', JSON.stringify(res));
});


/**
 * Та же форма данных, что и в session-server: живая таблица отдаёт даты объектами
 * Date, а не строками. Шаблоны фильтруются по сроку своим кодом, значит и ломаться
 * могут отдельно от лексики.
 */
check('шаблон со сроком возвращается, когда дата пришла объектом Date', () => {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.parse(today + 'T00:00:00Z') - 3 * 86400000);
  const g = load({
    patterns: [pattern({ pattern_id: 'p_due', state: 'review', due: past })],
    items: Array.from({ length: 12 }, (_, i) =>
      item({ item_id: 'i' + i, pattern_id: 'p_due' }))
  }).buildGrammarSession('1');
  assert(g.counts.due === 1,
    'к повторению ' + g.counts.due + ' вместо 1 — сравнение срока не понимает объект Date');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
