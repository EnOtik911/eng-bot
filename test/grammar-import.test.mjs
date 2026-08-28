/**
 * Grammar import and the seeded corpus: node test/grammar-import.test.mjs
 *
 * Two halves, and the second is the one that would actually have bitten:
 *  1. the validator rejects each malformed shape (negative tests, not just happy path)
 *  2. every one of the 96 seeded items is SOLVABLE end to end — its canonical answer
 *     is accepted by the real client checker, and for "найди ошибку" the wrong stem
 *     is rejected by it. An item that fails either way is an exercise with no
 *     correct answer, and structural validation alone cannot see that.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const win = {};
new Function('window', readFileSync(join(root, 'app', 'answer.js'), 'utf8'))(win);
const A = win.Answer;

const scope = {};
new Function('sheet_', 'makeId_', 'exports',
  readFileSync(join(root, 'gas', 'Config.gs'), 'utf8') + '\n' +
  readFileSync(join(root, 'gas', 'GrammarImport.gs'), 'utf8') + '\n' +
  readFileSync(join(root, 'gas', 'GrammarSeed.gs'), 'utf8') +
  '\nObject.assign(exports, {validateGrammarRow_, grammarItemKey_, grammarSeedRows_,' +
  ' GRAMMAR_IMPORT_COLUMNS, VALID_KINDS});'
)(() => { throw new Error('sheet_ must not be touched by a validator'); },
  () => 'id_stub', scope);

const { validateGrammarRow_, grammarItemKey_, grammarSeedRows_, GRAMMAR_IMPORT_COLUMNS } = scope;
const COL = {};
GRAMMAR_IMPORT_COLUMNS.forEach((c, i) => { COL[c] = i; });

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

/** A valid row, then mutated per case — so each test isolates exactly one rule. */
function row(over = {}) {
  const base = {
    pattern_id: 'present_perfect', order_index: 10, label: 'Present Perfect',
    title_ru: 'since / for', notes_slug: 'pp', kind: 'gapfill',
    prompt_ru: '', stem: 'I ___ here since 2023.', answer: 'have worked',
    tokens: '', hint_ru: 'потому что действие длится'
  };
  const merged = Object.assign({}, base, over);
  return GRAMMAR_IMPORT_COLUMNS.map(c => merged[c]);
}
function rejected(over, fragment) {
  const v = validateGrammarRow_(row(over));
  assert(v.error, 'должно было отклониться: ' + JSON.stringify(over));
  if (fragment) {
    assert(v.error.indexOf(fragment) >= 0,
      'причина "' + v.error + '" не содержит "' + fragment + '"');
  }
}
function accepted(over) {
  const v = validateGrammarRow_(row(over));
  assert(!v.error, 'должно было пройти, но: ' + v.error);
  return v.row;
}

console.log('Импорт грамматики');

check('корректная строка проходит', () => {
  const r = accepted({});
  assert(r.order_index === 10, 'order_index не число: ' + typeof r.order_index);
  assert(r.notes_slug === 'pp', 'notes_slug: ' + r.notes_slug);
});

check('notes_slug по умолчанию берётся из pattern_id', () => {
  const r = accepted({ notes_slug: '' });
  assert(r.notes_slug === 'present_perfect', 'подставилось: ' + r.notes_slug);
});

check('метаданные шаблона обязательны', () => {
  rejected({ pattern_id: '' }, 'pattern_id');
  rejected({ pattern_id: 'Present Perfect' }, 'lower_snake_case');
  rejected({ label: '' }, 'label');
  rejected({ title_ru: '' }, 'title_ru');
  rejected({ order_index: 'скоро' }, 'order_index');
  rejected({ order_index: -1 }, 'order_index');
});

check('вид задания только из списка', () => {
  rejected({ kind: '' }, 'kind must be one of');
  rejected({ kind: 'multiple_choice' }, 'kind must be one of');
  scope.VALID_KINDS.forEach(k => {
    const over = { kind: k };
    if (k === 'scramble') {
      over.tokens = 'I|have|worked|here';
      over.answer = 'I have worked here.';
      over.prompt_ru = 'Я работаю здесь.';
      over.stem = '';
    }
    if (k === 'transform') { over.prompt_ru = '→ Present Perfect'; over.answer = 'I have worked here.'; over.stem = 'I worked here.'; }
    if (k === 'fix') { over.answer = 'I have worked here.'; over.stem = 'I work here since 2023.'; }
    accepted(over);
  });
});

check('подсказка обязательна для любого задания', () => {
  rejected({ hint_ru: '' }, 'hint_ru is empty');
  rejected({ hint_ru: '   ' }, 'hint_ru is empty');
});

check('ответ обязателен и не содержит маркера пропуска', () => {
  rejected({ answer: '' }, 'answer is empty');
  rejected({ answer: 'have ___ worked' }, 'must not contain');
});

check('scramble: токены обязательны и должны собираться в ответ', () => {
  const s = { kind: 'scramble', stem: '', prompt_ru: 'Я работаю здесь с 2023.' };
  rejected(Object.assign({}, s, { tokens: '' }), 'tokens are required');
  rejected(Object.assign({}, s, { tokens: 'I|have', answer: 'I have.' }), 'at least 3 tokens');
  rejected(Object.assign({}, s, {
    tokens: 'I|have|worked|somewhere|else', answer: 'I have worked here.'
  }), 'do not assemble');
  accepted(Object.assign({}, s, { tokens: 'I|have|worked|here', answer: 'I have worked here.' }));
});

check('scramble без русского смысла — это ребус, а не упражнение', () => {
  rejected({
    kind: 'scramble', stem: '', prompt_ru: '',
    tokens: 'I|have|worked|here', answer: 'I have worked here.'
  }, 'prompt_ru is required');
});

check('токены запрещены там, где их не показывают', () => {
  rejected({ tokens: 'I|have|worked' }, 'only apply to kind scramble');
});

check('gapfill без маркера пропуска нерешаем', () => {
  rejected({ stem: 'I have worked here since 2023.' }, 'gap marker');
});

check('нескрамбл без stem нечего показывать', () => {
  rejected({ kind: 'fix', stem: '', answer: 'I have worked here.' }, 'stem is required');
});

check('transform и fix требуют реального изменения', () => {
  rejected({
    kind: 'transform', prompt_ru: '→ Present Perfect',
    stem: 'I have worked here.', answer: 'I have worked here.'
  }, 'identical');
  rejected({
    kind: 'fix', stem: 'I have worked here.', answer: 'I have worked here.'
  }, 'identical');
  rejected({
    kind: 'transform', prompt_ru: '', stem: 'I worked here.', answer: 'I have worked here.'
  }, 'prompt_ru is required');
});

check('ключ дедупликации различает задания с одинаковым коротким ответом', () => {
  const a = grammarItemKey_(accepted({
    kind: 'gapfill', stem: '___ channel manager pushes rates.', answer: 'The'
  }));
  const b = grammarItemKey_(accepted({
    kind: 'gapfill', stem: 'The bug appeared after ___ last release.', answer: 'the'
  }));
  assert(a !== b, 'два разных задания с ответом "the" считаются дублем:\n         ' + a);
});

check('ключ дедупликации ловит настоящий повтор', () => {
  const one = grammarItemKey_(accepted({}));
  const two = grammarItemKey_(accepted({ hint_ru: 'другая формулировка подсказки' }));
  assert(one === two, 'та же задача с другой подсказкой не распознана как дубль');
});

// --- корпус --------------------------------------------------------------

const rows = grammarSeedRows_();

check('корпус проходит структурную проверку целиком', () => {
  const bad = [];
  rows.forEach((r, i) => {
    const v = validateGrammarRow_(r);
    if (v.error) bad.push('строка ' + (i + 1) + ' [' + r[COL.pattern_id] + '/' + r[COL.kind] + ']: ' + v.error);
  });
  assert(bad.length === 0, bad.join('\n         '));
});

check('в корпусе нет дублей', () => {
  const seen = {}; const dup = [];
  rows.forEach((r, i) => {
    const v = validateGrammarRow_(r);
    if (v.error) return;
    const k = grammarItemKey_(v.row);
    if (seen[k]) dup.push('строка ' + (i + 1) + ' повторяет ' + seen[k] + ': ' + k);
    seen[k] = i + 1;
  });
  assert(dup.length === 0, dup.join('\n         '));
});

check('каждое задание корпуса РЕШАЕМО настоящей проверкой ответа', () => {
  const bad = [];
  rows.forEach((r, i) => {
    const v = validateGrammarRow_(r);
    if (v.error) return;
    const it = v.row;
    const canonical = it.kind === 'scramble'
      ? it.tokens.split('|').join(' ')
      : A.alternatives(it.answer)[0];
    if (!A.check(canonical, it.answer)) {
      bad.push('строка ' + (i + 1) + ' [' + it.pattern_id + '/' + it.kind +
        ']: правильный ответ "' + canonical + '" не принимается');
    }
  });
  assert(bad.length === 0, bad.join('\n         '));
});

check('все альтернативы через || тоже принимаются', () => {
  const bad = [];
  rows.forEach((r, i) => {
    const v = validateGrammarRow_(r);
    if (v.error) return;
    A.alternatives(v.row.answer).forEach(alt => {
      if (!A.check(alt, v.row.answer)) {
        bad.push('строка ' + (i + 1) + ': альтернатива "' + alt + '" не принимается');
      }
    });
  });
  assert(bad.length === 0, bad.join('\n         '));
});

check('в заданиях «найди ошибку» и «перестрой» исходник ОТКЛОНЯЕТСЯ', () => {
  const bad = [];
  rows.forEach((r, i) => {
    const v = validateGrammarRow_(r);
    if (v.error) return;
    const it = v.row;
    if (it.kind !== 'fix' && it.kind !== 'transform') return;
    if (A.check(it.stem, it.answer)) {
      bad.push('строка ' + (i + 1) + ' [' + it.pattern_id + '/' + it.kind +
        ']: исходное предложение принимается как верное — упражнение пустое');
    }
  });
  assert(bad.length === 0, bad.join('\n         '));
});

check('корпус покрывает все виды заданий в каждом шаблоне', () => {
  const byPattern = {};
  rows.forEach(r => {
    const p = r[COL.pattern_id];
    byPattern[p] = byPattern[p] || {};
    byPattern[p][r[COL.kind]] = (byPattern[p][r[COL.kind]] || 0) + 1;
  });
  const ids = Object.keys(byPattern);
  assert(ids.length >= 8, 'шаблонов в корпусе: ' + ids.length);
  const thin = [];
  ids.forEach(p => {
    scope.VALID_KINDS.forEach(k => {
      if (!byPattern[p][k]) thin.push(p + ' без вида ' + k);
    });
    const total = Object.keys(byPattern[p]).reduce((a, k) => a + byPattern[p][k], 0);
    // Раунд — три задания. Пул меньше шести не даёт второму раунду свежих предложений,
    // а именно на этом держится идея планировать шаблон, а не предложение.
    if (total < 6) thin.push(p + ' имеет всего ' + total + ' заданий');
  });
  assert(thin.length === 0, thin.join('\n         '));
});

check('порядок шаблонов задан по интерференции, а не по алфавиту', () => {
  const order = {};
  rows.forEach(r => { order[r[COL.pattern_id]] = Number(r[COL.order_index]); });
  const ids = Object.keys(order).sort((a, b) => order[a] - order[b]);
  assert(ids[0] === 'to_be_present',
    'первым должен идти to_be_present — в русском связки в настоящем нет; сейчас ' + ids[0]);
  assert(order.present_perfect_vs_past > order.present_perfect_since_for,
    'контраст перфекта с прошедшим должен идти после самого перфекта');
  assert(new Set(Object.values(order)).size === ids.length, 'order_index не уникальны');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
