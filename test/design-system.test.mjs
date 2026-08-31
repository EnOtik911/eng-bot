/**
 * Визуальная система: node test/design-system.test.mjs
 *
 * Набор написан после замера, а не из вкуса. В styles.css было 29 РАЗНЫХ значений
 * font-size, включая 13.5 против 13 и 14.5 против 14: каждое по отдельности
 * выглядит осмысленным, а вместе это и читается как «сыро и не выверено».
 * Полупиксельный дрейф невозможно заметить на одном экране — только замером.
 *
 * И второе: ни одного правила :focus-visible при живых клавиатурных сокращениях
 * (пробел раскрывает карточку, 1-4 ставят оценку).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'app', 'styles.css'), 'utf8');
const guide = readFileSync(join(root, 'app', 'guide.css'), 'utf8');

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Визуальная система');

check('шкала кегля объявлена токенами', () => {
  const steps = [...css.matchAll(/--t-[\w]+:\s*([\d.]+)px;/g)].map(m => +m[1]);
  assert(steps.length >= 6, 'ступеней всего ' + steps.length + ' — это не шкала');
  const sorted = [...steps].sort((a, b) => a - b);
  assert(new Set(steps).size === steps.length, 'ступени дублируются: ' + steps.join(', '));
  console.log('         ступени: ' + sorted.join(' / ') + ' px');
});

check('текст сидит на шкале, а не на произвольных пикселях', () => {
  // Разрешены только глифы и базовый кегль: это не текст в потоке, шкала их не касается.
  const ALLOWED = new Set(['16px', '26px', '28px', '30px']);
  const hard = [...css.matchAll(/font-size:\s*([\d.]+px)\s*;/g)]
    .map(m => m[1]).filter(v => !ALLOWED.has(v));
  assert(hard.length === 0,
    'вне шкалы: ' + [...new Set(hard)].join(', ') +
    '\n         именно так и набегает полупиксельный дрейф');
  const onScale = (css.match(/font-size:\s*var\(--t-/g) || []).length;
  assert(onScale >= 30, 'на шкале всего ' + onScale + ' правил — похоже, токены не применены');
  console.log('         правил на шкале: ' + onScale);
});

check('заголовок экрана один на всё приложение, включая гайд', () => {
  assert(/--h-screen:/.test(css), 'токена --h-screen нет');
  const appClamps = [...css.matchAll(/font-size:\s*(clamp\([^)]*\))/g)].map(m => m[1]);
  // Гайд не имеет права заводить свой размер того же заголовка: на переходе
  // из приложения в документ заголовок прыгал с 26-34 на 28-38.
  const guideClamps = [...guide.matchAll(/font-size:\s*(clamp\([^)]*\))/g)].map(m => m[1]);
  assert(guideClamps.length === 0 || guideClamps.every(c => appClamps.includes(c)),
    'гайд объявляет свои размеры заголовков: ' + guideClamps.join(' | '));
});

check('фокус с клавиатуры виден', () => {
  assert(/:focus-visible/.test(css), 'ни одного правила :focus-visible');
  const ring = css.match(/:focus-visible[^{]*\{([^}]*)\}/);
  assert(/outline:\s*[^;]*(solid|auto)/.test(ring[1]),
    'в правиле :focus-visible нет видимой обводки: ' + ring[1].trim());
});

check('нигде не снят фокус без замены', () => {
  const kills = [...css.matchAll(/([^{}]*)\{[^}]*outline:\s*none[^}]*\}/g)].map(m => m[1].trim());
  kills.forEach(sel => {
    const base = sel.replace(/:focus(-visible)?/, '').trim();
    assert(css.includes(base + ':focus-visible') || /border-color/.test(
      css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))?.[1] || ''),
      sel + ' снимает outline и не даёт ничего взамен');
  });
});

check('зона нажатия «?» дотянута до нормы псевдоэлементом', () => {
  // Кружок должен остаться маленьким на вид: увеличить его — значит чинить
  // промах ценой композиции. Замер на 390x844 давал 26x26.
  const rule = css.match(/\.g-help::after\s*\{([^}]*)\}/);
  assert(rule, 'у .g-help нет расширения зоны нажатия');
  const inset = rule[1].match(/inset:\s*(-?[\d.]+)px/);
  assert(inset && Math.abs(+inset[1]) >= 9,
    'расширение ' + (inset && inset[1]) + 'px — до 44 не дотягивает');
});

check('радиусы берутся из токенов', () => {
  const hard = [...css.matchAll(/border-radius:\s*([\d.]+px)\s*;/g)].map(m => m[1]);
  const big = hard.filter(v => parseFloat(v) >= 8);
  assert(big.length === 0,
    'крупные радиусы мимо токенов: ' + [...new Set(big)].join(', '));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
