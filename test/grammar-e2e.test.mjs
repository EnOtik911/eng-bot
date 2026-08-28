/**
 * Сквозной круг на настоящем корпусе: node test/grammar-e2e.test.mjs
 *
 * Пробел, который закрывает именно этот набор: клиентские тесты работают с payload,
 * написанным руками, а серверные проверяют только свою половину. Расхождение в форме
 * данных между `buildGrammarSession` и `GrammarBlock` не поймал бы ни один из них —
 * оно проявилось бы только в приложении.
 *
 * Здесь настоящий корпус проходит настоящий валидатор, превращается в строки листа,
 * идёт через настоящий планировщик, отвечается настоящей проверкой ответа и
 * применяется настоящим flush. Заглушен только сам Sheets.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const TODAY = new Date().toISOString().slice(0, 10);
const read = (...p) => readFileSync(join(root, ...p), 'utf8');

// --- клиент -----------------------------------------------------------------
const win = {};
new Function('window', read('app', 'answer.js'))(win);
new Function('window', read('app', 'grammar.js'))(win);
globalThis.window = win;                       // grammar.js обращается к window.Answer

// --- корпус через настоящий валидатор ---------------------------------------
const imp = {};
new Function('sheet_', 'makeId_', 'exports',
  read('gas', 'Config.gs') + '\n' + read('gas', 'GrammarImport.gs') + '\n' +
  read('gas', 'GrammarSeed.gs') +
  '\nObject.assign(exports, {validateGrammarRow_, grammarSeedRows_, PATTERN_COLUMNS,' +
  ' GRAMMAR_ITEM_COLUMNS});'
)(() => { throw new Error('sheet_ не должен вызываться'); },
  (p) => p + '_' + Math.random().toString(36).slice(2, 8), imp);

const patterns = [];
const items = [];
const seenPattern = {};
imp.grammarSeedRows_().forEach((raw, i) => {
  const v = imp.validateGrammarRow_(raw);
  if (v.error) throw new Error('корпус невалиден на строке ' + (i + 1) + ': ' + v.error);
  const r = v.row;
  if (!seenPattern[r.pattern_id]) {
    seenPattern[r.pattern_id] = true;
    patterns.push({
      pattern_id: r.pattern_id, order_index: r.order_index, label: r.label,
      title_ru: r.title_ru, notes_slug: r.notes_slug, state: 'new', due: '',
      stability: '', difficulty: '', reps: 0, lapses: 0, last_review: '',
      first_review: '', created_at: '2026-08-01T00:00:00.000Z',
      user_id: '1', source_batch: 'seed'
    });
  }
  items.push({
    item_id: 'gi_' + i, pattern_id: r.pattern_id, kind: r.kind,
    prompt_ru: r.prompt_ru, stem: r.stem, answer: r.answer, tokens: r.tokens,
    hint_ru: r.hint_ru, serve_count: 0, last_served: '',
    created_at: '2026-08-01T00:00:00.000Z', source_batch: 'seed'
  });
});

// --- сервер с заглушенным Sheets --------------------------------------------
function server(state, settings = {}) {
  const scope = {};
  const env = {
    VALID_LAYERS: [], Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    readSettings_: () => Object.assign({
      timezone: 'Europe/Moscow', desired_retention: '0.85', leech_threshold: '5',
      unlock_interval_days: '21', daily_new_target: '6', session_size_cap: '120',
      grammar_daily_new_target: '1', grammar_desired_retention: '0.9',
      grammar_items_per_round: '3', grammar_session_cap: '8'
    }, settings),
    readCards_: () => [], writeCardUpdates_: () => 0, appendReviewLog_: () => {},
    readPatterns_: () => state.patterns.map((p, i) => Object.assign({ _row: i + 2 }, p)),
    readGrammarItems_: () => state.items.map((it, i) => Object.assign({ _row: i + 2 }, it)),
    // Заглушки пишут обратно в state, поэтому второй вызов видит результат первого —
    // без этого «повторный вход в приложение» проверить нельзя.
    writePatternUpdates_: (us) => {
      us.forEach(u => Object.assign(state.patterns[u._row - 2], u.patch));
      return us.length;
    },
    writeGrammarItemUpdates_: (us) => {
      us.forEach(u => Object.assign(state.items[u._row - 2], u.patch));
      return us.length;
    },
    appendGrammarLog_: (rows) => { state.log = (state.log || []).concat(rows); },
    flushSeen_: (id) => (state.batches || []).indexOf(id) >= 0,
    flushRecord_: (id) => { state.batches = (state.batches || []).concat([id]); }
  };
  const names = Object.keys(env);
  new Function(...names, 'exports',
    read('gas', 'Fsrs.gs') + '\n' + read('gas', 'Session.gs') + '\n' + read('gas', 'Grammar.gs') +
    '\nObject.assign(exports, {buildGrammarSession, applyGrammarFlush});'
  )(...names.map(n => env[n]), scope);
  return scope;
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

/** Как отвечал бы человек, знающий правило: канонический ответ. */
function correctAnswerFor(item) {
  return item.kind === 'scramble'
    ? item.tokens.join(' ')
    : win.Answer.alternatives(item.answer)[0];
}

function freshState() {
  return {
    patterns: patterns.map(p => Object.assign({}, p)),
    items: items.map(i => Object.assign({}, i)),
    log: [], batches: []
  };
}

console.log('Сквозной круг: корпус -> планировщик -> клиент -> flush');

check('корпус даёт 8 шаблонов и 96 заданий через настоящий валидатор', () => {
  assert(patterns.length === 8, 'шаблонов: ' + patterns.length);
  assert(items.length === 96, 'заданий: ' + items.length);
});

check('payload сервера принимается клиентом без переходников', () => {
  const state = freshState();
  const s = server(state).buildGrammarSession('1');
  const b = new win.GrammarBlock(s);
  assert(b.perRound === 3, 'items_per_round не прочитан: ' + b.perRound);
  assert(b.patterns.length === 8, 'шаблонов у клиента: ' + b.patterns.length);
  assert(b.startMixed() === 1, 'запланировано раундов: ' + b.plannedRounds);
  const round = b.nextRound();
  assert(round, 'раунд не собрался');
  assert(round.items.length === 3, 'заданий в раунде: ' + round.items.length);
  round.items.forEach(it => {
    assert(it.item_id && it.kind && it.answer && it.hint_ru, 'неполное задание: ' + JSON.stringify(it));
    assert(Array.isArray(it.tokens), 'tokens должен быть массивом: ' + typeof it.tokens);
    if (it.kind === 'scramble') assert(it.tokens.length >= 3, 'пустые токены у scramble');
  });
});

check('идеальный раунд доходит до сервера и даёт Легко', () => {
  const state = freshState();
  const s = server(state).buildGrammarSession('1');
  const b = new win.GrammarBlock(s);
  b.startMixed();
  const round = b.nextRound();
  round.items.forEach(it => {
    const res = b.submit(correctAnswerFor(it));
    assert(res.correct === true,
      'канонический ответ отклонён: [' + it.kind + '] "' + correctAnswerFor(it) + '"');
  });
  assert(b.roundFinished(), 'раунд не закрылся');
  const closed = b.closeRound();

  const out = server(state).applyGrammarFlush('1', 'e2e_1', [closed.entry]);
  assert(out.ok && out.applied === 1, JSON.stringify(out));
  assert(out.outcomes[0].rating === 4, 'оценка: ' + out.outcomes[0].rating);
  assert(out.outcomes[0].errors === 0 && out.outcomes[0].hints === 0, 'факты искажены');

  const p = state.patterns.find(x => x.pattern_id === closed.entry.pattern_id);
  assert(p.state === 'review' && p.first_review === TODAY, 'шаблон не обновлён: ' + JSON.stringify(p));
  assert(state.log.length === 1 && state.log[0][2] === 4, 'журнал: ' + JSON.stringify(state.log));
});

check('промах и подсказка дают С трудом, а не Легко', () => {
  const state = freshState();
  const s = server(state).buildGrammarSession('1');
  const b = new win.GrammarBlock(s);
  b.startMixed();
  const round = b.nextRound();
  b.markHint();
  b.submit('заведомо неверно');                       // 1-е: ошибка + подсказка
  b.submit(correctAnswerFor(round.items[1]));
  b.submit(correctAnswerFor(round.items[2]));
  b.submit(correctAnswerFor(round.items[0]));         // переспрос
  const closed = b.closeRound();
  const out = server(state).applyGrammarFlush('1', 'e2e_2', [closed.entry]);
  assert(out.outcomes[0].rating === 2, 'оценка: ' + out.outcomes[0].rating);
  assert(out.outcomes[0].errors === 1, 'ошибок: ' + out.outcomes[0].errors);
  assert(out.outcomes[0].hints === 1, 'подсказок: ' + out.outcomes[0].hints);
});

check('второй вход в приложение даёт ДРУГИЕ предложения того же шаблона', () => {
  const state = freshState();
  const first = server(state).buildGrammarSession('1');
  const b1 = new win.GrammarBlock(first);
  b1.startMixed();
  const r1 = b1.nextRound();
  const usedFirst = r1.items.map(i => i.item_id);
  r1.items.forEach(it => b1.submit(correctAnswerFor(it)));
  const c1 = b1.closeRound();
  server(state).applyGrammarFlush('1', 'e2e_3', [c1.entry]);

  // Счётчики показов записаны, значит следующий пул должен начаться с других заданий.
  const pid = c1.entry.pattern_id;
  const second = server(state).buildGrammarSession('1');
  const pool = second.pools[pid].map(i => i.item_id);
  const overlapAtHead = pool.slice(0, 3).filter(id => usedFirst.indexOf(id) >= 0);
  assert(overlapAtHead.length === 0,
    'пул снова начинается с уже показанных: ' + pool.slice(0, 3).join(',') +
    ' против ' + usedFirst.join(','));
});

check('шаблон, повторённый сегодня, уходит из очереди на завтра', () => {
  const state = freshState();
  const b = new win.GrammarBlock(server(state).buildGrammarSession('1'));
  b.startMixed();
  const r = b.nextRound();
  r.items.forEach(it => b.submit(correctAnswerFor(it)));
  server(state).applyGrammarFlush('1', 'e2e_4', [b.closeRound().entry]);

  const after = server(state).buildGrammarSession('1');
  assert(after.counts.due === 0, 'шаблон остался просроченным: due=' + after.counts.due);
  assert(after.counts.new_allowance_left === 0, 'норма новых не израсходована');
  assert(after.queue.length === 0, 'очередь не опустела: ' + JSON.stringify(after.queue));
});

check('глубина пула = два раунда: иначе повтору нечего показать', () => {
  const state = freshState();
  const s = server(state).buildGrammarSession('1');
  const depths = Object.keys(s.pools).map(k => s.pools[k].length);
  assert(depths.every(d => d === 6),
    'ожидалось по 6 заданий (items_per_round x 2), получено: ' + depths.join(','));
  // Полная проверка решаемости всех 96 живёт в grammar-import.test.mjs — здесь важно
  // именно то, что отдаёт сервер, и что этого хватает на два раунда без повторов.
});

check('каждое отданное сервером задание проходит полный круг ответа', () => {
  const state = freshState();
  // Открываем каждый шаблон вручную — режим выбора шаблона игнорирует расписание.
  const s = server(state).buildGrammarSession('1');
  const b = new win.GrammarBlock(s);
  const bad = [];
  let answered = 0;
  Object.keys(s.pools).forEach(pid => {
    s.pools[pid].forEach(it => {
      b.startSingle(pid);
      b.nextRound();
      // Подменяем текущее задание на проверяемое, чтобы обойти весь пул, а не первую тройку.
      b.round.items = [it];
      b.round.idx = 0;
      b.round.results = [];
      const res = b.submit(correctAnswerFor(it));
      answered++;
      if (!res.correct) bad.push('[' + pid + '/' + it.kind + '] ' + correctAnswerFor(it));
    });
  });
  assert(bad.length === 0, 'не приняты правильные ответы:\n         ' + bad.join('\n         '));
  assert(answered === 48, 'ожидалось 8 шаблонов x 6 заданий = 48, прогнано ' + answered);
  console.log('         прогнано заданий: ' + answered + ' (всё, что сервер отдал)');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
