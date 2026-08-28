/**
 * Проверка сгенерированного гайда.
 *
 * Конвертер markdown — тот класс кода, который ломается тихо: неподдержанная
 * конструкция не падает, а просто выводится как есть, и документ выглядит
 * почти правильно. Здесь проверяется, что ничего не потерялось и ничего
 * не просочилось необработанным.
 *
 *   node test/guide-html.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, '..', 'docs', 'guide.md'), 'utf8');
const html = readFileSync(join(here, '..', 'app', 'guide.html'), 'utf8');

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

/** Только текстовые узлы: маркеры разметки внутри тегов и скриптов не считаются. */
function visibleText(page) {
  const body = page.slice(page.indexOf('<article'), page.indexOf('</article>'));
  return body.replace(/<[^>]+>/g, ' ');
}

console.log('Гайд: markdown -> html');

check('все заголовки второго уровня перенесены и получили якорь', () => {
  const heads = [...md.matchAll(/^## (.+)$/gm)].map(m => m[1]);
  assert(heads.length >= 10, 'ожидалось не меньше 10 разделов, найдено ' + heads.length);
  const rendered = [...html.matchAll(/<h2 id="([^"]+)" class="g-h2">(.*?)<\/h2>/g)];
  assert(rendered.length === heads.length,
    `в markdown ${heads.length} разделов, в html ${rendered.length}`);
  rendered.forEach(m => {
    assert(html.includes('href="#' + m[1] + '"'),
      'у раздела ' + m[1] + ' нет пункта в содержании');
  });
  console.log('         разделов: ' + heads.length);
});

check('все таблицы перенесены и обёрнуты в скроллящийся контейнер', () => {
  const mdTables = md.split('\n').filter(l => /^\|\s*-{2,}/.test(l) || /^\|[\s:-]+\|$/.test(l)).length;
  const htmlTables = (html.match(/<table class="g-table">/g) || []).length;
  assert(htmlTables === mdTables, `в markdown ${mdTables} таблиц, в html ${htmlTables}`);
  const wraps = (html.match(/<div class="g-tablewrap">/g) || []).length;
  assert(wraps === htmlTables, 'каждая таблица должна быть в g-tablewrap, иначе поедет на узком экране');
  console.log('         таблиц: ' + htmlTables);
});

check('все инлайн-фрагменты кода перенесены', () => {
  // Считаем по обратным кавычкам, а не построчным regex: фрагмент может быть
  // перенесён через строку в markdown, и конвертер это обрабатывает верно,
  // потому что склеивает абзац до разбора. Первая версия этого теста ловила
  // именно такие фрагменты как расхождение — ошибка была в тесте.
  const fenceLines = (md.match(/^```/gm) || []).length;
  const inlineTicks = (md.match(/`/g) || []).length - fenceLines * 3;
  assert(inlineTicks % 2 === 0,
    'непарная обратная кавычка в guide.md: ' + inlineTicks + ' штук вне заграждений');
  const expected = inlineTicks / 2 + fenceLines / 2;
  const htmlCode = (html.match(/<code>/g) || []).length;
  assert(htmlCode === expected,
    `ожидалось ${expected} тегов code (${inlineTicks / 2} инлайн + ${fenceLines / 2} блоков), в html ${htmlCode}`);
  console.log('         фрагментов кода: ' + htmlCode);
});

check('маркеры markdown не просочились в видимый текст', () => {
  const text = visibleText(html);
  assert(!text.includes('**'), 'в тексте остались ** — жирный не преобразован');
  assert(!text.includes('`'), 'в тексте остались обратные кавычки');
  assert(!/\]\(/.test(text), 'в тексте осталась ссылка в синтаксисе markdown');
  assert(!/@@CODE\d+@@/.test(html), 'в html остались метки-заместители кода');
  assert(!/^#{1,6} /m.test(text), 'в тексте остались решётки заголовка');
});

check('относительных ссылок на markdown не осталось', () => {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const bad = hrefs.filter(h => /\.md/.test(h) && !/^https?:/.test(h));
  assert(bad.length === 0,
    'ссылки на .md должны быть абсолютными, иначе с Pages не откроются: ' + bad.join(', '));
  const anchors = hrefs.filter(h => h.startsWith('#'));
  assert(anchors.length >= 10, 'ожидались якоря содержания, найдено ' + anchors.length);
});

check('файл помечен как сгенерированный', () => {
  assert(/СГЕНЕРИРОВАНО из docs\/guide\.md/.test(html),
    'нужна пометка в начале файла, иначе кто-нибудь поправит html и потеряет правку');
});

check('гайд переиспользует стили приложения, а не заводит свою палитру', () => {
  assert(html.includes('href="styles.css"'), 'styles.css должен подключаться');
  const guideCss = readFileSync(join(here, '..', 'app', 'guide.css'), 'utf8');
  const hardcoded = [...guideCss.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => m[0]);
  // Пара точечных исключений допустима, но палитры быть не должно
  assert(hardcoded.length <= 3,
    'в guide.css ' + hardcoded.length + ' захардкоженных цветов (' + hardcoded.join(', ') +
    ') — токены должны браться из styles.css, иначе темы разъедутся');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
