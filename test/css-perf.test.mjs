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

/** Сколько правил объявляют стекло — используется как нижняя граница числа блюров. */
function glassSelectorCount() {
  return [...css.matchAll(/^\s*([^@{}\n][^{}\n]*)\{[^}]*[^-]backdrop-filter\s*:/gm)].length;
}

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
  // Значение приходит через цепочку переменных: backdrop-filter -> --glass-fx ->
  // --glass-blur. Одноуровневая подстановка перестала его находить и тест молча начал
  // проверять только запасные 1px из @supports. Поэтому var() раскрывается до конца,
  // и отдельно утверждается, что найдено не меньше значений, чем стёкол — иначе
  // следующий такой рефакторинг снова спрячет измерение.
  const resolveVars = (value, depth = 0) => {
    if (depth > 5) return value;
    return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name) => {
      const decl = css.match(new RegExp('^\\s*' + name + ':\\s*([^;]+);', 'm'));
      return decl ? resolveVars(decl[1].trim(), depth + 1) : whole;
    });
  };

  const declarations = [...css.matchAll(/(?:^|[^-])backdrop-filter\s*:\s*([^;]+);/g)]
    .map(m => resolveVars(m[1].trim()));
  const blurs = declarations.flatMap(d =>
    [...d.matchAll(/blur\(([^)]+)\)/g)].map(m => m[1].trim()));

  console.log('         блюр: ' + blurs.join(', '));
  assert(blurs.length >= glassSelectorCount(),
    'найдено значений блюра ' + blurs.length + ', а стёкол ' + glassSelectorCount() +
    ' — значение спрятано за переменной, которую тест не раскрыл');
  blurs.forEach(v => {
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

check('запасной вариант покрывает КАЖДОЕ стекло, а не первые два', () => {
  // Без поддержки backdrop-filter полупрозрачная заливка не размывает фон, а
  // пропускает его: контур фоновых фигур встанет прямо под текстом. Раньше здесь
  // проверялось только наличие блока, поэтому два новых стекла остались бы без него.
  const block = css.match(/@supports not \(\([\s\S]*?\n\}/);
  assert(block, 'блок @supports not не найден');
  const covered = [...block[0].matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]);
  const glasses = [...css.matchAll(/^\s*\.([a-z0-9-]+)[^{}\n]*\{[^}]*[^-]backdrop-filter\s*:/gm)]
    .map(m => m[1]);
  const missing = glasses.filter(g => !covered.includes(g));
  assert(missing.length === 0,
    'стёкла без запасного варианта: ' + missing.join(', '));
  console.log('         под запасным вариантом: ' + covered.join(', '));
});

check('есть запасной вариант, если backdrop-filter не поддержан', () => {
  assert(/@supports not \(\(backdrop-filter/.test(css),
    'нужен @supports not: без него на неподдерживающем движке стекло станет ' +
    'прозрачной пустотой, а текст ляжет прямо на градиент');
});

check('отключение движения накрывает ВСЁ, а не перечисленное', () => {
  // Раньше здесь проверялось только наличие блока. Перечислять в нём селекторы —
  // значит забыть следующую добавленную анимацию, и тест этого не заметит.
  // Держит всё именно универсальное правило, поэтому проверяется оно.
  const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert(block, 'блок prefers-reduced-motion не найден');
  const universal = block[1].match(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{([^}]*)\}/);
  assert(universal, 'нет универсального правила — тогда каждая новая анимация ' +
    'должна быть перечислена вручную, и однажды не будет');
  assert(/animation-duration:[^;]*!important/.test(universal[1]),
    'animation-duration без !important проигрывает авторским правилам');
  assert(/transition-duration:[^;]*!important/.test(universal[1]),
    'переходы не отключены');
  const animated = [...css.matchAll(/^\s*([^@{}\n][^{}\n]*)\{[^}]*animation:/gm)]
    .map(m => m[1].trim().split('\n').pop().trim())
    .filter(sel => !sel.startsWith('.card.card-leaving'));
  console.log('         анимировано селекторов: ' + animated.length + ' — все под универсальным правилом');
});

check('движение отключается при prefers-reduced-motion', () => {
  assert(/@media \(prefers-reduced-motion: reduce\)/.test(css),
    'настройку «меньше движения» надо уважать: три бесконечных анимации фона');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
