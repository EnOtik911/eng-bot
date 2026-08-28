/**
 * Контраст текста на стекле.
 *
 * Главный риск глассморфизма — не производительность, а читаемость: полупрозрачный
 * слой поверх произвольного фона роняет контраст, и на неудачном участке градиента
 * текст пропадает.
 *
 * Проверка не привязана к теме. Для каждого цвета текста берутся ДВА крайних фона —
 * самый светлый и самый тёмный, какие могут оказаться под стеклом, — и берётся
 * худший из двух контрастов. Так тест остаётся верным и на светлой палитре, и на
 * тёмной: на светлой опасен тёмный фон, на тёмной наоборот, и заранее знать не надо.
 *
 * Пороги WCAG AA: 4.5:1 обычный текст, 3:1 крупный (>=24px, либо >=18.66px полужирным).
 *
 *   node test/contrast.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'app', 'styles.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

const hex = (h) => { const v = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

function cssVar(name) {
  const m = css.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  if (!m) throw new Error('переменная --' + name + ' не найдена в styles.css');
  return m[1].trim();
}
/** Разбирает #rrggbb или rgba(r,g,b,.a) в { rgb, a }. */
function color(spec) {
  const r = spec.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*(\.?\d+))?\s*\)/);
  if (r) return { rgb: [+r[1], +r[2], +r[3]], a: r[4] === undefined ? 1 : parseFloat(r[4].startsWith('.') ? '0' + r[4] : r[4]) };
  const h = spec.match(/#[0-9A-Fa-f]{6}/);
  if (h) return { rgb: hex(h[0]), a: 1 };
  throw new Error('не разобран цвет: ' + spec);
}

// --- два крайних фона под стеклом -------------------------------------------
const base = color(cssVar('bg-0')).rgb;
const auroraA = parseFloat('0' + (css.match(/\.aurora span \{[^}]*opacity:\s*(\.\d+)/) || [, '.5'])[1]);
const blobs = [...css.matchAll(/\.aurora span:nth-child\(\d\)[^}]*radial-gradient\(circle,\s*(#[0-9A-Fa-f]{6})/g)]
  .map(m => hex(m[1]));
if (blobs.length < 3) throw new Error('не найдены цвета фоновых пятен');

// «самый насыщенный» участок: два пятна друг на друге
let tinted = over(blobs[0], auroraA, base);
tinted = over(blobs[1], auroraA * 0.7, tinted);

const glass = color(cssVar('glass-fill'));
const BG_A = over(glass.rgb, glass.a, tinted);   // стекло над пятнами
const BG_B = over(glass.rgb, glass.a, base);     // стекло над чистой базой
const EXTREMES = [BG_A, BG_B];

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}

/** Худший контраст по обоим крайним фонам. */
function worst(textSpec, backgrounds) {
  const t = color(textSpec);
  return backgrounds.reduce((min, bg) => {
    const ink = t.a === 1 ? t.rgb : over(t.rgb, t.a, bg);
    return Math.min(min, ratio(ink, bg));
  }, Infinity);
}
function expect(label, textSpec, minRatio, backgrounds) {
  const r = worst(textSpec, backgrounds || EXTREMES);
  console.log(`         ${label}: ${r.toFixed(2)}:1 (порог ${minRatio})`);
  if (r < minRatio) throw new Error(`${label}: ${r.toFixed(2)}:1, нужно ${minRatio}:1`);
}

console.log('Контраст на стекле, худший из двух крайних фонов');
console.log('         фон над пятнами: rgb(' + BG_A.map(Math.round).join(',') + ')');
console.log('         фон над базой:   rgb(' + BG_B.map(Math.round).join(',') + ')');

check('основной текст --fg проходит 4.5:1', () => expect('--fg', cssVar('fg'), 4.5));
check('вторичный --fg-dim проходит 4.5:1 (в тексте 15px)', () => expect('--fg-dim', cssVar('fg-dim'), 4.5));
check('самый бледный --fg-faint проходит 4.5:1 (в тексте 10-13px)', () => expect('--fg-faint', cssVar('fg-faint'), 4.5));

check('цвет ответа проходит 3:1 как крупный текст', () => {
  const m = css.match(/\.answer\s*\{[^}]*color:\s*(#[0-9A-Fa-f]{6})/);
  if (!m) throw new Error('цвет .answer не найден');
  expect('.answer', m[1], 3);
});

check('текст на кнопках оценок проходит 4.5:1', () => {
  // Цвета читаются из CSS, а не хранятся копией: копия разъедется при первой правке.
  ['again', 'hard', 'good', 'easy'].forEach(function (n) {
    const fill = color(cssVar(n + '-fill'));
    const ink = cssVar(n + '-ink');
    // заливка кнопки лежит поверх стекла, поэтому фон считается в два слоя
    const backgrounds = EXTREMES.map(bg => over(fill.rgb, fill.a, bg));
    expect('rate-' + n, ink, 4.5, backgrounds);
  });
});

check('текст на главной кнопке проходит 4.5:1', () => {
  const grad = css.match(/\.btn-primary\s*\{[^}]*background:\s*linear-gradient\(([^;]+)\);/);
  if (!grad) throw new Error('градиент .btn-primary не найден');
  const stops = [...grad[1].matchAll(/var\(\s*(--[\w-]+)\s*\)|(#[0-9A-Fa-f]{6})/g)]
    .map(m => m[1] ? cssVar(m[1].slice(2)) : m[2]);
  if (!stops.length) throw new Error('остановки градиента не разобраны');
  stops.forEach(function (stop, i) {
    const bg = [color(stop).rgb];
    expect('btn-primary остановка ' + (i + 1), '#FFFFFF', 4.5, bg);
  });
});

check('баннер предупреждения читается', () => {
  const rule = css.match(/\.banner\s*\{([^}]*)\}/);
  const ink = rule[1].match(/color:\s*(#[0-9A-Fa-f]{6})/);
  const fill = rule[1].match(/background:\s*(rgba\([^)]+\))/);
  if (!ink || !fill) throw new Error('цвет или фон баннера не найдены');
  const f = color(fill[1]);
  expect('.banner', ink[1], 4.5, EXTREMES.map(bg => over(f.rgb, f.a, bg)));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
