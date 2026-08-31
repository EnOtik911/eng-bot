/**
 * Декор: node test/decor.test.mjs
 *
 * Декор здесь не украшение — четыре кольца и Boeing 737 это то, ради чего владелец
 * учит язык. Поэтому у него есть правильность, которую можно нарушить молча.
 *
 * Главный дефект, ради которого набор написан: нос самолёта смотрит ВПРАВО, а
 * положительный rotate() в CSS крутит по часовой. Значит на наборе высоты стоял
 * +20deg и машина лезла вверх, опустив нос. Ошибка знака, которую видно только
 * глазами и только если знать, куда смотреть.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'app', 'styles.css'), 'utf8');
const html = readFileSync(join(root, 'app', 'index.html'), 'utf8');

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('Декор: кольца и 737');

check('нос задран на всём цикле полёта, а не опущен', () => {
  const kf = css.match(/@keyframes takeoff\s*\{([\s\S]*?)\n\}/);
  assert(kf, '@keyframes takeoff не найден');
  const angles = [...kf[1].matchAll(/rotate\(\s*(-?[\d.]+)deg\s*\)/g)].map(m => parseFloat(m[1]));
  assert(angles.length >= 3, 'в анимации меньше трёх кадров с поворотом');
  const noseDown = angles.filter(a => a > 0);
  assert(noseDown.length === 0,
    'положительный rotate() опускает нос (нос смотрит вправо, поворот по часовой): ' +
    noseDown.join(', ') + 'deg');
});

check('в наборе высоты тангаж круче, чем на заходе', () => {
  const kf = css.match(/@keyframes takeoff\s*\{([\s\S]*?)\n\}/)[1];
  const angles = [...kf.matchAll(/rotate\(\s*(-?[\d.]+)deg\s*\)/g)].map(m => parseFloat(m[1]));
  assert(Math.min(...angles) <= -8,
    'максимальный тангаж всего ' + Math.min(...angles) + 'deg — набор не читается');
});

check('самолёт — геометрия из чертежа, а не силуэт от руки', () => {
  const svg = html.match(/<svg class="decor-plane"[\s\S]*?<\/svg>/);
  assert(svg, 'блок .decor-plane не найден');
  const shapes = (svg[0].match(/<(path|polyline|line)\b/g) || []).length;
  assert(shapes > 50,
    'в силуэте всего ' + shapes + ' элементов — похоже, чертёж заменили рисунком от руки');
});

check('кольца держат пропорции логотипа', () => {
  const svg = html.match(/<svg class="decor-rings"[\s\S]*?<\/svg>/);
  assert(svg, 'блок .decor-rings не найден');
  const cx = [...svg[0].matchAll(/cx="([\d.]+)"/g)].map(m => +m[1]);
  const r = [...svg[0].matchAll(/\br="([\d.]+)"/g)].map(m => +m[1]);
  assert(cx.length === 4, 'колец ' + cx.length + ', а не 4');
  assert(new Set(r).size === 1, 'радиусы разъехались: ' + r.join(', '));

  const gaps = cx.slice(1).map((v, i) => v - cx[i]);
  assert(new Set(gaps).size === 1, 'шаг между кольцами неравномерный: ' + gaps.join(', '));
  const ratio = gaps[0] / (2 * r[0]);
  assert(Math.abs(ratio - 0.75) < 0.03,
    'шаг ' + ratio.toFixed(3) + ' диаметра вместо 0.75 — кольца перестанут читаться как знак');
});

check('кольца не проходят через искажающий фильтр', () => {
  const svg = html.match(/<svg class="decor-rings"[\s\S]*?<\/svg>/)[0];
  assert(!/filter=/.test(svg),
    'на кольцах снова фильтр — он гнёт окружности, и знак перестаёт узнаваться');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
