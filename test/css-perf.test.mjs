/**
 * Бюджет производительности визуальной системы.
 *
 * Измеренные ограничения из исследования, а не эстетические предпочтения:
 *  - каждое backdrop-filter это отдельный расчёт блюра на GPU; 3-5 элементов
 *    безопасны, 10+ роняют кадры на среднем телефоне;
 *  - blur держать в диапазоне 8-16px, у нас 18 как осознанное превышение на одном
 *    большом элементе, но не выше;
 *  - blur никогда не анимировать: пересчёт растра каждый кадр;
 *  - -webkit-backdrop-filter обязателен, Telegram Desktop на macOS это WebKit.
 *
 *   node test/css-perf.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'app', 'styles.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');   // без комментариев: там про blur написано словами

/**
 * Достаёт тело блока со сбалансированными скобками.
 * Регуляркой это делать нельзя: у @keyframes внутри свои вложенные блоки, и
 * нежадный поиск до "\n}" уезжает в следующее правило. Первая версия этого теста
 * именно так и падала — на CSS без единой ошибки.
 */
function blocks(source, headerRe) {
  const out = [];
  let m;
  const re = new RegExp(headerRe.source, 'g');
  while ((m = re.exec(source))) {
    let i = source.indexOf('{', m.index);
    if (i < 0) continue;
    let depth = 0, start = i;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') { depth--; if (depth === 0) break; }
    }
    out.push({ header: m[0], body: source.slice(start + 1, i) });
  }
  return out;
}

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('CSS: бюджет производительности');

check('backdrop-filter стоит не более чем на 5 селекторах', () => {
  // -webkit- вариант не считаем отдельным элементом: это тот же слой
  const selectors = new Set();
  const re = /([^{}]+)\{[^}]*?(?:-webkit-)?backdrop-filter\s*:/g;
  let m;
  while ((m = re.exec(css))) selectors.add(m[1].trim().split('\n').pop().trim());
  console.log('         стёкла: ' + [...selectors].join(', '));
  assert(selectors.size <= 5,
    selectors.size + ' стеклянных селекторов — больше пяти роняет кадры на среднем телефоне');
  assert(selectors.size >= 1, 'ни одного стекла — тогда этот тест не нужен');
});

check('каждое backdrop-filter имеет -webkit- пару', () => {
  const plain = (css.match(/(?<!-webkit-)backdrop-filter\s*:/g) || []).length;
  const webkit = (css.match(/-webkit-backdrop-filter\s*:/g) || []).length;
  assert(webkit >= plain,
    `${plain} объявлений без префикса против ${webkit} с префиксом — ` +
    'Telegram Desktop на macOS это WebKit, там нужен -webkit-');
});

check('значение блюра не превышает 20px', () => {
  const values = [...css.matchAll(/backdrop-filter\s*:\s*blur\(([^)]+)\)/g)]
    .map(m => m[1].trim());
  const resolved = values.map(v => {
    if (v.startsWith('var(')) {
      const name = v.match(/var\(\s*(--[\w-]+)/)[1];
      const decl = css.match(new RegExp(name + ':\\s*([^;]+);'));
      return decl ? decl[1].trim() : v;
    }
    return v;
  });
  console.log('         блюр: ' + resolved.join(', '));
  resolved.forEach(v => {
    const px = parseFloat(v);
    assert(!Number.isNaN(px), 'не удалось разобрать значение блюра: ' + v);
    assert(px <= 20, px + 'px превышает бюджет — 8-16 рекомендуемо, 20 предел');
  });
});

check('blur и backdrop-filter не участвуют в анимациях и переходах', () => {
  const keyframeBlocks = blocks(css, /@keyframes\s+[\w-]+/);
  assert(keyframeBlocks.length >= 4, 'ожидалось минимум 4 набора кадров, найдено ' +
    keyframeBlocks.length);
  keyframeBlocks.forEach(b => {
    assert(!/blur\(/.test(b.body),
      'blur() в ' + b.header + ' — растр будет пересчитываться каждый кадр');
  });
  console.log('         наборов кадров проверено: ' + keyframeBlocks.length);
  const transitions = [...css.matchAll(/transition\s*:\s*([^;]+);/g)].map(m => m[1]);
  transitions.forEach(t => {
    assert(!/blur|backdrop-filter|filter/.test(t),
      'blur или filter в transition: ' + t.trim());
  });
  console.log('         переходов проверено: ' + transitions.length);
});

check('фоновые пятна анимируются только по transform', () => {
  const drift = blocks(css, /@keyframes\s+drift-[a-z]/);
  assert(drift.length === 3, 'ожидалось три анимации пятен, найдено ' + drift.length);
  drift.forEach(b => {
    const props = [...b.body.matchAll(/([a-z-]+)\s*:/g)].map(m => m[1]);
    assert(props.length > 0, b.header + ' ничего не меняет');
    props.forEach(pr => {
      assert(pr === 'transform',
        b.header + ' меняет ' + pr + ' — должен меняться только transform, ' +
        'иначе анимация уходит с композитора на пересчёт слоя');
    });
  });
  console.log('         пятна двигаются только по transform');
});

check('есть запасной вариант, если backdrop-filter не поддержан', () => {
  assert(/@supports not \(\(backdrop-filter/.test(css),
    'нужен @supports not: без него на неподдерживающем движке стекло станет ' +
    'прозрачной пустотой, а текст ляжет прямо на градиент');
});

check('движение отключается при prefers-reduced-motion', () => {
  assert(/@media \(prefers-reduced-motion: reduce\)/.test(css),
    'настройку «меньше движения» надо уважать: три бесконечных анимации фона');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
