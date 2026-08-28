/**
 * Контраст текста на стекле.
 *
 * Главный риск глассморфизма — не производительность, а читаемость: полупрозрачный
 * слой поверх произвольного фона роняет контраст ниже WCAG, и на светлом пятне
 * градиента текст пропадает. Здесь считается худший случай: самое светлое, что
 * может оказаться под стеклом.
 *
 * Пороги WCAG AA: 4.5:1 для обычного текста, 3:1 для крупного
 * (>=24px, либо >=18.66px полужирным).
 *
 *   node test/contrast.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'app', 'styles.css'), 'utf8');

const hex = (h) => {
  const v = h.replace('#', '');
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
};
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Из CSS достаём фактические значения, чтобы тест не разъехался с файлом. */
function cssVar(name) {
  const m = css.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  if (!m) throw new Error('переменная --' + name + ' не найдена в styles.css');
  return m[1].trim();
}
function alphaOfWhite(value) {
  const m = value.match(/rgba\(\s*242,\s*245,\s*249,\s*\.?([0-9]+)\s*\)/);
  if (!m) return null;
  return parseFloat('0.' + m[1]);
}

const BASE = hex('#070A0F');
// Самая светлая точка фона: два пятна градиента накладываются друг на друга.
// Считаем пессимистично — синее и фиолетовое пятно по 0.5 прозрачности.
const auroraAlpha = parseFloat('0' + (css.match(/\.aurora span \{[^}]*opacity:\s*(\.\d+)/) || [, '.38'])[1]);
let bright = over(hex('#2B4CCF'), auroraAlpha, BASE);
bright = over(hex('#7A3BD6'), auroraAlpha * 0.7, bright);
// плюс заливка стекла — берётся из --glass-fill как есть, включая её цвет:
// тёмное стекло опускает худший фон, белое поднимало его до нечитаемого.
const gf = cssVar('glass-fill').match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*\.?(\d+)\s*\)/);
if (!gf) throw new Error('не разобрано значение --glass-fill: ' + cssVar('glass-fill'));
const WORST_BG = over([+gf[1], +gf[2], +gf[3]], parseFloat('0.' + gf[4]), bright);

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}

function expectContrast(label, colorSpec, minRatio) {
  let rgb;
  const a = alphaOfWhite(colorSpec);
  if (a !== null) rgb = over(hex('#F2F5F9'), a, WORST_BG);
  else rgb = hex(colorSpec);
  const r = ratio(rgb, WORST_BG);
  if (r < minRatio) {
    throw new Error(`${label}: ${r.toFixed(2)}:1, нужно ${minRatio}:1 ` +
      `(на худшем фоне rgb(${WORST_BG.map(Math.round).join(',')}))`);
  }
  console.log(`         ${label}: ${r.toFixed(2)}:1 (порог ${minRatio})`);
}

console.log('Контраст на худшем фоне под стеклом');
console.log('         фон: rgb(' + WORST_BG.map(Math.round).join(',') + ')');

check('основной текст --fg проходит 4.5:1', () => {
  expectContrast('--fg', cssVar('fg'), 4.5);
});

check('приглушённый --fg-dim проходит 4.5:1 (используется в 15px тексте)', () => {
  expectContrast('--fg-dim', cssVar('fg-dim'), 4.5);
});

check('самый бледный --fg-faint проходит 4.5:1 (используется в 10-13px)', () => {
  expectContrast('--fg-faint', cssVar('fg-faint'), 4.5);
});

check('цвет ответа проходит 3:1 как крупный текст', () => {
  const m = css.match(/\.answer\s*\{[^}]*color:\s*(#[0-9A-Fa-f]{6})/);
  if (!m) throw new Error('цвет .answer не найден');
  expectContrast('.answer', m[1], 3);
});

check('белый текст на кнопках оценок проходит 4.5:1', () => {
  // Цвета берутся из CSS, а не хранятся копией: копия разъедется при первой правке.
  // Проверяется КАЖДАЯ остановка градиента — светлая обычно и есть худший случай.
  const names = ['again', 'hard', 'good', 'easy'];
  let checked = 0;
  names.forEach(function (n) {
    const rule = css.match(new RegExp('\\.rate-' + n + '\\s*\\{[^}]*background:\\s*linear-gradient\\(([^;]+)\\);'));
    if (!rule) throw new Error('градиент .rate-' + n + ' не найден в styles.css');
    const stops = [...rule[1].matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*\.?(\d+)\)/g)];
    if (!stops.length) throw new Error('в .rate-' + n + ' не разобрана ни одна остановка');
    stops.forEach(function (m, i) {
      const rgb = [+m[1], +m[2], +m[3]];
      const a = parseFloat('0.' + m[4]);
      const bg = over(rgb, a, WORST_BG);
      const r = ratio([255, 255, 255], bg);
      console.log(`         rate-${n} остановка ${i + 1}: ${r.toFixed(2)}:1`);
      if (r < 4.5) throw new Error(`rate-${n} остановка ${i + 1}: ${r.toFixed(2)}:1, нужно 4.5:1`);
      checked++;
    });
  });
  if (checked < 8) throw new Error('ожидалось минимум 8 остановок, проверено ' + checked);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
