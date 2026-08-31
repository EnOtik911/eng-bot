/**
 * docs/guide.md -> app/guide.html
 *
 * Одна причина существования этого скрипта: два файла с одним содержимым
 * расходятся. Источник истины — markdown; html генерируется, а run-all.sh падает,
 * если он устарел, — так же, как с dist/all-in-one.gs.
 *
 * Конвертер поддерживает ровно тот набор конструкций, который в гайде есть, и на
 * незнакомой блочной конструкции ПАДАЕТ, а не пропускает её молча. Молчаливое
 * искажение документа хуже отсутствия документа.
 *
 *   node test/build-guide.mjs          # записать
 *   node test/build-guide.mjs --check  # упасть, если устарел
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'docs', 'guide.md');
const OUT = join(root, 'app', 'guide.html');
const REPO = 'https://github.com/EnOtik911/eng-bot/blob/main/';

const esc = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Инлайн-разметка. Код вынимается первым: внутри него ничего не форматируется.
 * Метка-заместитель обязана быть такой, какая в живом тексте встретиться не может —
 * первая версия использовала число в пробелах и подменяла бы любое число в прозе.
 */
function inline(text) {
  const codes = [];
  let t = text.replace(/`([^`]+)`/g, (m, c) => {
    codes.push('<code>' + esc(c) + '</code>');
    return '@@CODE' + (codes.length - 1) + '@@';
  });
  t = esc(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) => {
    // Относительные ссылки на markdown ведут в репозиторий: html лежит на Pages,
    // и .md-файлы оттуда не открываются.
    let url = href;
    if (href.startsWith('../')) url = REPO + href.slice(3);
    else if (href.startsWith('./')) url = REPO + 'docs/' + href.slice(2);
    else if (!/^https?:|^#/.test(href)) url = REPO + 'docs/' + href;
    return '<a href="' + url + '">' + label + '</a>';
  });
  return t.replace(/@@CODE(\d+)@@/g, (m, i) => codes[+i]);
}

function convert(md) {
  const lines = md.split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  let seq = 0;

  const slug = (text) => {
    seq++;
    return 's' + seq + '-' + text.toLowerCase()
      .replace(/[^0-9a-zа-яё]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  };
  const isBlockStart = (l) => !l.trim() || l.startsWith('|') || l.startsWith('> ') ||
    l.startsWith('```') || /^#{1,6} /.test(l) || /^-{3,}$/.test(l) ||
    /^- /.test(l) || /^\d+\. /.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('```')) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push('<pre class="g-pre"><code>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }

    if (/^-{3,}$/.test(line)) { out.push('<hr class="g-hr">'); i++; continue; }

    const h = line.match(/^(#{1,6}) (.+)$/);
    if (h) {
      const level = h[1].length;
      if (level === 2) {
        const id = slug(h[2]);
        toc.push({ id, text: h[2] });
        out.push('<h2 id="' + id + '" class="g-h2">' + inline(h[2]) + '</h2>');
      } else {
        out.push('<h' + level + ' class="g-h' + level + '">' + inline(h[2]) + '</h' + level + '>');
      }
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('> ')) body.push(lines[i++].slice(2));
      out.push('<blockquote class="g-quote">' + inline(body.join(' ')) + '</blockquote>');
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      const first = i;
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (rows.length < 2 || !/^[\s|:-]+$/.test(rows[1])) {
        throw new Error('таблица без строки-разделителя на строке ' + (first + 1));
      }
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      body.forEach((r, n) => {
        if (r.length !== head.length) {
          throw new Error('в таблице со строки ' + (first + 1) + ' строка ' + (n + 1) +
            ' имеет ' + r.length + ' ячеек вместо ' + head.length);
        }
      });
      out.push('<div class="g-tablewrap"><table class="g-table"><thead><tr>' +
        head.map(c => '<th>' + inline(c) + '</th>').join('') +
        '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      throw new Error('в guide.md появился список на строке ' + (i + 1) +
        ' — конвертер его не поддерживает. Добавь поддержку или используй таблицу.');
    }

    const para = [lines[i++]];
    while (i < lines.length && !isBlockStart(lines[i])) para.push(lines[i++]);
    out.push('<p class="g-p">' + inline(para.join(' ')) + '</p>');
  }

  return { html: out.join('\n'), toc };
}

const { html, toc } = convert(readFileSync(SRC, 'utf8'));

const page = '<!doctype html>\n' +
'<html lang="ru">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
'<meta name="theme-color" content="#EDF1F8">\n' +
'<title>Гайд · Eng_bot</title>\n' +
'<!-- СГЕНЕРИРОВАНО из docs/guide.md командой node test/build-guide.mjs. Не править вручную. -->\n' +
'<link rel="stylesheet" href="styles.css">\n' +
'<link rel="stylesheet" href="guide.css">\n' +
'<script src="https://telegram.org/js/telegram-web-app.js"></script>\n' +
'</head>\n' +
'<body>\n\n' +
'<div class="aurora" aria-hidden="true"><span></span><span></span><span></span></div>\n\n' +
'<header class="topbar">\n' +
'  <a class="g-back" href="./">&larr; Тренажёр</a>\n' +
'  <span class="counter">Гайд</span>\n' +
'</header>\n\n' +
'<main class="g-main">\n' +
'  <details class="g-toc card">\n' +
'    <summary>Содержание</summary>\n    ' +
toc.map(t => '<a href="#' + t.id + '">' + esc(t.text) + '</a>').join('\n    ') + '\n' +
'  </details>\n\n' +
'  <article class="g-doc card">\n' + html + '\n  </article>\n' +
'</main>\n\n' +
'<script>\n' +
'  (function () {\n' +
'    var tg = window.Telegram && window.Telegram.WebApp;\n' +
'    if (tg) { tg.ready(); tg.expand(); }\n' +
'    var toc = document.querySelector(".g-toc");\n' +
'    // Раскрытость задаётся здесь, а не атрибутом open: CSS не умеет открыть\n' +
'    // details, а на телефоне тринадцать пунктов отжимали текст гайда за экран.\n' +
'    function fitToc() { toc.open = window.matchMedia("(min-width: 900px)").matches; }\n' +
'    fitToc();\n' +
'    window.addEventListener("resize", fitToc);\n' +
'    var links = [].slice.call(document.querySelectorAll(".g-toc a"));\n' +
'    links.forEach(function (a) {\n' +
'      a.addEventListener("click", function () {\n' +
'        if (!window.matchMedia("(min-width: 900px)").matches) toc.open = false;\n' +
'      });\n' +
'    });\n' +
'    var heads = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });\n' +
'    function mark() {\n' +
'      var y = window.scrollY + 140, active = 0;\n' +
'      heads.forEach(function (h, i) { if (h && h.offsetTop <= y) active = i; });\n' +
'      links.forEach(function (a, i) { a.classList.toggle("is-active", i === active); });\n' +
'    }\n' +
'    window.addEventListener("scroll", mark, { passive: true });\n' +
'    mark();\n' +
'  })();\n' +
'</script>\n' +
'</body>\n' +
'</html>\n';

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== page) {
    console.log('  FAIL app/guide.html устарел — запусти: node test/build-guide.mjs');
    process.exit(1);
  }
  console.log('  app/guide.html соответствует docs/guide.md (' + toc.length +
    ' разделов, ' + page.split('\n').length + ' строк)');
} else {
  writeFileSync(OUT, page);
  console.log('записан app/guide.html — ' + toc.length + ' разделов, ' +
    page.split('\n').length + ' строк');
}
