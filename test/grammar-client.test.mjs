/**
 * Grammar block on the client: node test/grammar-client.test.mjs
 *
 * The invariant worth the whole suite: a second round of the same pattern must
 * serve DIFFERENT sentences. If it repeats them, what gets learned is the sentence
 * and the scheduler will happily report a mastered rule that was never learned.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const window = {};
new Function('window', readFileSync(join(root, 'app', 'answer.js'), 'utf8'))(window);
new Function('window', readFileSync(join(root, 'app', 'grammar.js'), 'utf8'))(window);
const GrammarBlock = window.GrammarBlock;

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

function item(i, patternId = 'p1') {
  return {
    item_id: patternId + '_i' + i, pattern_id: patternId, kind: 'gapfill',
    prompt_ru: '', stem: 'gap ' + i + ' ___', answer: 'answer' + i,
    tokens: [], hint_ru: 'because ' + i
  };
}

function payload({ pools, queue, perRound = 3, patterns } = {}) {
  const ids = Object.keys(pools);
  return {
    settings: { items_per_round: perRound },
    patterns: patterns || ids.map((id, i) => ({
      pattern_id: id, order_index: (i + 1) * 10, label: 'L' + id,
      title_ru: 'T' + id, notes_slug: id, state: 'new', due: '',
      is_due: false, reps: 0, lapses: 0, pool_size: pools[id].length
    })),
    pools,
    queue: queue || ids,
    counts: { due: 0, new_in_session: ids.length }
  };
}

console.log('Клиент грамматики');

check('раунд берёт items_per_round заданий', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2, 3, 4, 5].map(i => item(i)) } }));
  b.startMixed();
  const r = b.nextRound();
  assert(r.items.length === 3, 'заданий в раунде: ' + r.items.length);
  assert(r.pattern_id === 'p1', 'шаблон: ' + r.pattern_id);
});

check('второй раунд того же шаблона даёт ДРУГИЕ предложения', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2, 3, 4, 5].map(i => item(i)) } }));
  b.startSingle('p1');
  const first = b.nextRound().items.map(i => i.item_id);
  b.repeatLast('p1');
  const second = b.nextRound().items.map(i => i.item_id);
  const overlap = first.filter(id => second.indexOf(id) >= 0);
  assert(overlap.length === 0,
    'раунды пересеклись: ' + first.join(',') + ' и ' + second.join(','));
});

check('пул короче раунда обходится по кругу, а не падает', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [item(0), item(1)] } }));
  b.startSingle('p1');
  const r = b.nextRound();
  assert(r.items.length === 2, 'раунд из короткого пула: ' + r.items.length);
  b.repeatLast('p1');
  const r2 = b.nextRound();
  assert(r2.items.length === 2, 'второй раунд: ' + r2.items.length);
});

check('верный ответ записывается и раунд едет дальше', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  const res = b.submit('answer0');
  assert(res.correct === true, 'ответ должен быть верным');
  assert(b.round.results.length === 1 && b.round.results[0].correct === true, 'запись результата');
  assert(b.currentItem().item_id === 'p1_i1', 'не перешли к следующему');
});

check('ошибка записывается ровно один раз, переспрос её не стирает', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  b.submit('чушь');            // i0 — мимо
  b.submit('answer1');
  b.submit('answer2');
  assert(b.round.retry.length === 1, 'промах не встал в переспрос');
  assert(!b.roundFinished(), 'раунд закрылся с непройденным переспросом');

  const before = JSON.stringify(b.round.results);
  b.submit('answer0');         // переспрос, теперь верно
  assert(b.roundFinished(), 'раунд не закрылся после переспроса');
  assert(JSON.stringify(b.round.results) === before,
    'переспрос изменил записанные результаты:\n         было ' + before +
    '\n         стало ' + JSON.stringify(b.round.results));
  assert(b.round.results.filter(r => !r.correct).length === 1, 'ошибок должно остаться одна');
});

check('промах на переспросе уходит в конец, а не зацикливается', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  b.submit('мимо'); b.submit('мимо'); b.submit('answer2');
  assert(b.round.retry.length === 2, 'в переспросе: ' + b.round.retry.length);
  const first = b.currentItem().item_id;
  b.submit('снова мимо');
  b.deferRetry();
  assert(b.currentItem().item_id !== first, 'переспрос застрял на том же задании');
  assert(b.round.retry.length === 2, 'состав переспроса изменился');
});

check('подсказка помечает только текущее задание', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  b.markHint();
  b.submit('answer0');
  b.submit('answer1');
  assert(b.round.results[0].hint_used === true, 'подсказка не записана');
  assert(b.round.results[1].hint_used === false,
    'подсказка протекла на следующее задание');
});

check('подсказка на переспросе ничего не меняет — результат уже записан', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  b.submit('мимо'); b.submit('answer1'); b.submit('answer2');
  const before = JSON.stringify(b.round.results);
  b.markHint();
  b.submit('answer0');
  assert(JSON.stringify(b.round.results) === before, 'подсказка на переспросе изменила запись');
});

check('закрытый раунд отдаёт факты, а не оценку', () => {
  const b = new GrammarBlock(payload({ pools: { p1: [0, 1, 2].map(i => item(i)) } }));
  b.startMixed(); b.nextRound();
  b.markHint(); b.submit('answer0');
  b.submit('мимо'); b.submit('answer2'); b.submit('answer1');
  const closed = b.closeRound();
  assert(closed.entry.pattern_id === 'p1', 'pattern_id');
  assert(closed.entry.results.length === 3, 'результатов: ' + closed.entry.results.length);
  // Оценку выводит сервер. Появление её здесь означало бы второй источник правды.
  assert(!('rating' in closed.entry), 'клиент прислал оценку — так быть не должно');
  closed.entry.results.forEach(r => {
    assert(Object.keys(r).sort().join() === 'correct,hint_used,item_id',
      'состав результата: ' + JSON.stringify(r));
  });
  assert(closed.summary.errors === 1, 'ошибок в сводке: ' + closed.summary.errors);
  assert(closed.summary.hints === 1, 'подсказок в сводке: ' + closed.summary.hints);
  assert(b.roundsDone === 1, 'счётчик раундов: ' + b.roundsDone);
});

check('вперемешку берёт только очередь планировщика и только играбельное', () => {
  const b = new GrammarBlock(payload({
    pools: { p1: [0, 1, 2].map(i => item(i, 'p1')), p2: [] },
    queue: ['p1', 'p2', 'p3']
  }));
  const planned = b.startMixed();
  assert(planned === 1, 'запланировано раундов: ' + planned);
  assert(b.nextRound().pattern_id === 'p1', 'не тот шаблон');
  assert(b.nextRound() === null, 'очередь не закончилась');
});

check('выбор конкретного шаблона игнорирует расписание', () => {
  const b = new GrammarBlock(payload({
    pools: { p1: [0, 1, 2].map(i => item(i, 'p1')), p2: [0, 1, 2].map(i => item(i, 'p2')) },
    queue: []                       // на сегодня ничего не запланировано
  }));
  assert(b.startMixed() === 0, 'вперемешку должно быть пусто');
  assert(b.startSingle('p2') === 1, 'выбор рукой не сработал');
  assert(b.nextRound().pattern_id === 'p2', 'открылся не тот шаблон');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
