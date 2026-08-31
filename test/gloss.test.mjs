/**
 * Разбор словосочетаний: node test/gloss.test.mjs
 *
 * Разбор пишется руками в TSV, значит расходится с форматом тихо: лишний разделитель
 * или пропущенное тире не ломают ни импорт, ни экран — просто на карточке появляется
 * мусор, и заметить это можно только глазами на конкретной карточке.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const scope = {};
new Function('exports', readFileSync(join(root, 'gas', 'Config.gs'), 'utf8') +
  '\nObject.assign(exports, {IMPORT_COLUMNS, CARD_COLUMNS});')(scope);
const COLS = scope.IMPORT_COLUMNS;
const iEn = COLS.indexOf('en');
const iNote = COLS.indexOf('note');
const iBreak = COLS.indexOf('breakdown');

const files = readdirSync(dataDir).filter(f => /^(bank-|seed-).*\.tsv$/.test(f)).sort();
const units = [];
for (const f of files) {
  const lines = readFileSync(join(dataDir, f), 'utf8').split('\n').filter(l => l.length);
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    units.push({ file: f, en: c[iEn], note: (c[iNote] || '').trim(), breakdown: (c[iBreak] || '').trim() });
  }
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Разбор словосочетаний');

const withGloss = units.filter(u => u.breakdown);

check('схема импорта знает про breakdown, и он последний', () => {
  assert(COLS.includes('breakdown'), 'колонки breakdown нет в IMPORT_COLUMNS');
  assert(COLS[COLS.length - 1] === 'breakdown',
    'breakdown не последний: вставка в середину сдвинула бы живые строки');
  assert(scope.CARD_COLUMNS[scope.CARD_COLUMNS.length - 1] === 'breakdown',
    'в CARD_COLUMNS breakdown тоже обязан быть последним');
});

check('слои, которые владелец учит сейчас, разобраны целиком', () => {
  const need = ['seed-batch-001.tsv', 'bank-002-core.tsv', 'bank-003-social.tsv'];
  need.forEach(f => {
    const inFile = units.filter(u => u.file === f);
    const gone = inFile.filter(u => !u.breakdown).map(u => u.en);
    assert(gone.length === 0, f + ': без разбора ' + gone.length + ' — ' + gone.slice(0, 5).join(' | '));
    console.log('         ' + f + ': ' + inFile.length + ' единиц');
  });
});

check('каждый фрагмент разбора — «слово — перевод»', () => {
  const bad = [];
  withGloss.forEach(u => {
    u.breakdown.split(' · ').forEach(part => {
      if (!part.includes(' — ')) bad.push(u.en + ' -> ' + part);
    });
  });
  assert(bad.length === 0, 'фрагменты без тире:\n         ' + bad.slice(0, 5).join('\n         '));
});

check('разделители не склеены и не пусты', () => {
  const bad = withGloss.filter(u =>
    /·\s*·/.test(u.breakdown) || /^·|·$/.test(u.breakdown.trim()) ||
    u.breakdown.split(' · ').some(p => !p.trim()));
  assert(bad.length === 0, 'битые разделители: ' + bad.map(u => u.en).join(', '));
});

check('разбор и объяснение — разный текст, а не копия', () => {
  const same = withGloss.filter(u => u.note && u.note === u.breakdown);
  assert(same.length === 0, 'note дублирует breakdown: ' + same.map(u => u.en).join(', '));
});

check('у разобранной единицы есть и объяснение «почему так»', () => {
  const noWhy = withGloss.filter(u => !u.note).map(u => u.en);
  assert(noWhy.length === 0,
    'есть пословный разбор, но нет объяснения: ' + noWhy.slice(0, 6).join(' | '));
});

check('в тексте нет табов и переводов строки — они порвут TSV', () => {
  const bad = units.filter(u => /[\t\r\n]/.test(u.note) || /[\t\r\n]/.test(u.breakdown));
  assert(bad.length === 0, 'управляющие символы в: ' + bad.map(u => u.en).join(', '));
});

check('объяснение не разрастается до простыни', () => {
  const long = withGloss.filter(u => u.note.length > 400).map(u => u.en + ' (' + u.note.length + ')');
  assert(long.length === 0, 'слишком длинные объяснения: ' + long.join(', '));
  const lens = withGloss.map(u => u.note.length);
  console.log('         объяснений: ' + withGloss.length + ', средняя длина ' +
    Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) + ' символов');
});

check('карточка отдаёт клиенту и разбор, и объяснение', () => {
  const src = readFileSync(join(root, 'gas', 'Session.gs'), 'utf8');
  const fn = src.match(/function cardPayload_\(c\)\s*\{[\s\S]*?\n\}/);
  assert(fn, 'cardPayload_ не найден');
  assert(/note:/.test(fn[0]), 'note не уезжает на клиент — объяснение будет невидимым');
  assert(/breakdown:/.test(fn[0]), 'breakdown не уезжает на клиент');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
