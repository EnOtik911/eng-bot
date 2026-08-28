/**
 * Палитра в рантайме: node test/theme.test.mjs
 *
 * Дефект, ради которого набор существует, прожил один релиз и был найден глазами, а не
 * тестом. `applyTheme` переписывала пять CSS-переменных значениями из темы Telegram. В
 * styles.css существовали две из них. Одна — `--fg`. При тёмной теме Telegram присылает
 * белый `text_color`, `--fg` становился белым, фон оставался светлым — белый текст на
 * белом стекле. Всё на `--fg-dim` и `--fg-faint` читалось, потому что этих имён Telegram
 * не знает.
 *
 * contrast.test.mjs не мог это увидеть: он читает значения из CSS, а подмена
 * происходила в JS. Это тот самый случай, когда набор проверяет согласованность вместо
 * корректности. Здесь проверяется именно стык.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', 'app');
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const css = stripComments(readFileSync(join(app, 'styles.css'), 'utf8'));

const declared = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(m => m[1]));

// Переменные, на которых стоит проверка контраста. Если рантайм подменит любую из них,
// зелёный contrast.test.mjs перестанет что-либо значить.
const contrastSrc = readFileSync(join(here, 'contrast.test.mjs'), 'utf8');
const contrastVars = new Set([
  ...[...contrastSrc.matchAll(/cssVar\('([a-z0-9-]+)'\)/g)].map(m => '--' + m[1]),
  ...[...contrastSrc.matchAll(/expect\('(--[a-z0-9-]+)'/g)].map(m => m[1])
]);

const overrides = [];
for (const f of readdirSync(app).filter(f => f.endsWith('.js'))) {
  const src = readFileSync(join(app, f), 'utf8');
  for (const m of stripComments(src).matchAll(/setProperty\(\s*'(--[a-z0-9-]+)'/g)) {
    overrides.push({ file: f, name: m[1] });
  }
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Палитра: рантайм против CSS');

check('рантайм не подменяет переменные, на которых стоит проверка контраста', () => {
  assert(contrastVars.size >= 4, 'не удалось прочитать список переменных из contrast.test.mjs');
  const clash = overrides.filter(o => contrastVars.has(o.name));
  assert(clash.length === 0,
    'contrast.test.mjs проверяет эти переменные, а код переписывает их в рантайме — ' +
    'зелёный тест тогда ничего не гарантирует:\n         ' +
    clash.map(o => o.name + ' (в ' + o.file + ')').join('\n         '));
  console.log('         под проверкой контраста: ' + [...contrastVars].sort().join(', '));
});

check('каждая переменная, которую ставит рантайм, существует в styles.css', () => {
  const ghosts = overrides.filter(o => !declared.has(o.name));
  assert(ghosts.length === 0,
    'запись в несуществующую переменную — мёртвый код, который выглядит как работающая ' +
    'адаптация:\n         ' + ghosts.map(o => o.name + ' (в ' + o.file + ')').join('\n         '));
  console.log('         подмен в рантайме: ' + (overrides.length || 'ни одной'));
});

check('тема Telegram не читается для палитры', () => {
  // Комментарии вырезаны: имя переменной упоминается в объяснении, и без вырезания
  // тест ловил бы собственный текст. Ровно та ошибка, которую он призван предотвращать.
  const ui = stripComments(readFileSync(join(app, 'ui.js'), 'utf8'));
  const reads = [...ui.matchAll(/themeParams|\bp\.(?:bg_color|text_color|hint_color|button_color|secondary_bg_color)\b/g)];
  assert(reads.length === 0,
    'тема Telegram снова читается для цветов — если это осознанно, палитра должна ' +
    'браться из темы ЦЕЛИКОМ, иначе повторится белое на белом: ' +
    reads.map(m => m[0]).join(', '));
});

check('ни один цвет текста не обходит СРАЗУ и палитру, и проверку контраста', () => {
  // Литеральный цвет сам по себе допустим — белое на градиенте кнопки переменной не
  // выразить. Недопустимо другое: цвет, который не берётся из палитры И не проверяется
  // на контраст. Тогда он не защищён ничем.
  const rules = [...css.matchAll(/^\s*([^@{}\n][^{}\n]*)\{([^}]*)\}/gm)];
  const unguarded = [];
  rules.forEach(([, sel, body]) => {
    const m = body.match(/(?:^|;)\s*color:\s*([^;]+)/);
    if (!m) return;
    const v = m[1].trim();
    if (v.startsWith('var(') || v === 'inherit' || v === 'currentColor') return;
    const selector = sel.trim().split('\n').pop().trim();
    const classes = [...selector.matchAll(/\.([a-z0-9-]+)/g)].map(x => x[1]);
    const guarded = classes.some(c => contrastSrc.includes(c));
    if (!guarded) unguarded.push(selector + ' -> color: ' + v);
  });
  assert(unguarded.length === 0,
    'цвет задан литералом и при этом не покрыт contrast.test.mjs:\n         ' +
    unguarded.join('\n         '));
});

check('на body задан непрозрачный фон из палитры', () => {
  const body = (css.match(/^body\s*\{([^}]*)\}/m) || [, ''])[1];
  assert(/background/.test(body),
    'без явного фона на body страница берёт подложку хоста — в тёмном Telegram это ' +
    'тёмный фон под светлым текстом');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
