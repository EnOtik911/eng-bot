/**
 * Список батчей в коде против файлов на диске: node test/bank-load.test.mjs
 *
 * BANK_FILES в gas/BankLoad.gs — это то, что скрипт скачает и зальёт. Файл, добавленный
 * в data/ и забытый в списке, не заливается вообще и не даёт ни одной ошибки: отчёт
 * покажет успешную загрузку остальных. Ровно тот случай, когда правило и то, что его
 * инстанцирует, живут в разных файлах и расходятся молча.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'gas', 'BankLoad.gs'), 'utf8');

const scope = {};
new Function('exports', readFileSync(join(root, 'gas', 'Config.gs'), 'utf8') +
  '\nObject.assign(exports, {IMPORT_COLUMNS, VALID_LAYERS});')(scope);

const listed = [...src.matchAll(/'(bank-[\w-]+\.tsv)'/g)].map(m => m[1]);
const onDisk = readdirSync(join(root, 'data')).filter(f => /^bank-.*\.tsv$/.test(f)).sort();

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Загрузка банка: код против диска');

check('каждый файл банка из data/ перечислен в BANK_FILES', () => {
  const missing = onDisk.filter(f => !listed.includes(f));
  assert(missing.length === 0,
    'лежат в data/, но скрипт их не зальёт: ' + missing.join(', '));
});

check('каждый файл из BANK_FILES существует на диске', () => {
  const ghosts = listed.filter(f => !onDisk.includes(f));
  assert(ghosts.length === 0,
    'перечислены в коде, но файлов нет — загрузка упадёт: ' + ghosts.join(', '));
  console.log('         батчей: ' + listed.length + ' (' + listed.join(', ') + ')');
});

check('порядок загрузки совпадает с очередью освоения слоёв', () => {
  // Слой каждого файла берётся из самого файла, а не из его имени: имя может врать.
  const layerOf = (f) => {
    const lines = readFileSync(join(root, 'data', f), 'utf8').split('\n').filter(l => l.trim());
    const idx = scope.IMPORT_COLUMNS.indexOf('layer');
    const layers = new Set(lines.slice(1).map(l => l.split('\t')[idx]));
    assert(layers.size === 1, f + ' смешивает слои: ' + [...layers].join(', '));
    return [...layers][0];
  };
  const ranks = listed.map(f => scope.VALID_LAYERS.indexOf(layerOf(f)));
  ranks.forEach((r, i) => assert(r >= 0, listed[i] + ': слой не из VALID_LAYERS'));
  const sorted = ranks.slice().sort((a, b) => a - b);
  assert(ranks.join() === sorted.join(),
    'порядок в BANK_FILES не совпадает с порядком слоёв: ' +
    listed.map((f, i) => f + '=' + scope.VALID_LAYERS[ranks[i]]).join(', '));
  console.log('         порядок: ' + ranks.map(r => scope.VALID_LAYERS[r]).join(' -> '));
});

check('адрес репозитория указывает на raw, а не на страницу GitHub', () => {
  const m = src.match(/BANK_REPO_RAW = '([^']+)'/);
  assert(m, 'BANK_REPO_RAW не найден');
  assert(m[1].startsWith('https://raw.githubusercontent.com/'),
    'страница github.com отдаёт HTML, а не TSV: ' + m[1]);
  assert(m[1].endsWith('/'), 'адрес должен заканчиваться слэшем, иначе имя приклеится: ' + m[1]);
});

check('заголовок каждого файла совпадает со схемой импорта', () => {
  const want = scope.IMPORT_COLUMNS.join('\t');
  onDisk.forEach(f => {
    const head = readFileSync(join(root, 'data', f), 'utf8').split('\n')[0];
    assert(head === want, f + ':\n         получено:  ' + head +
      '\n         ожидалось: ' + want);
  });
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
