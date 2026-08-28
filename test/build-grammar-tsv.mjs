/**
 * Генерирует data/grammar-seed.tsv из gas/GrammarSeed.gs.
 *
 * Файл нужен как второй путь заливки: вставить в лист `grammar_inbox` руками, если
 * пункт меню недоступен. Но два источника одного корпуса разъезжаются, поэтому файл
 * генерируемый, а не написанный — и run-all.sh падает, если он устарел.
 *
 *   node test/build-grammar-tsv.mjs          # записать
 *   node test/build-grammar-tsv.mjs --check  # упасть, если устарел
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'data', 'grammar-seed.tsv');

function load(file, names) {
  const scope = {};
  new Function('sheet_', 'makeId_', 'exports',
    readFileSync(join(root, 'gas', file), 'utf8') +
    '\nObject.assign(exports, {' + names.join(',') + '});'
  )(() => { throw new Error('sheet_ не должен вызываться'); }, () => 'x', scope);
  return scope;
}

const { GRAMMAR_IMPORT_COLUMNS } = load('Config.gs', ['GRAMMAR_IMPORT_COLUMNS']);
const { grammarSeedRows_ } = load('GrammarSeed.gs', ['grammarSeedRows_']);
const rows = grammarSeedRows_();

// Таб или перевод строки внутри поля разъедут TSV молча — это единственная
// поломка, которую формат не может пережить.
rows.forEach((r, i) => r.forEach((v, c) => {
  if (/[\t\n\r]/.test(String(v))) {
    console.error(`поле с табом или переводом строки: строка ${i + 1}, колонка ` +
      GRAMMAR_IMPORT_COLUMNS[c]);
    process.exit(1);
  }
}));
rows.forEach((r, i) => {
  if (r.length !== GRAMMAR_IMPORT_COLUMNS.length) {
    console.error(`строка ${i + 1}: полей ${r.length}, ожидалось ${GRAMMAR_IMPORT_COLUMNS.length}`);
    process.exit(1);
  }
});

const text = [GRAMMAR_IMPORT_COLUMNS.join('\t')]
  .concat(rows.map(r => r.join('\t'))).join('\n') + '\n';

if (process.argv.includes('--check')) {
  if (!existsSync(out)) {
    console.error('  FAIL data/grammar-seed.tsv отсутствует — node test/build-grammar-tsv.mjs');
    process.exit(1);
  }
  if (readFileSync(out, 'utf8') !== text) {
    console.error('  FAIL data/grammar-seed.tsv устарел относительно gas/GrammarSeed.gs\n' +
      '       пересобрать: node test/build-grammar-tsv.mjs');
    process.exit(1);
  }
  console.log(`  data/grammar-seed.tsv в синхроне — ${rows.length} заданий`);
} else {
  writeFileSync(out, text);
  console.log(`записан data/grammar-seed.tsv — ${rows.length} заданий, ` +
    `${GRAMMAR_IMPORT_COLUMNS.length} колонок`);
}
