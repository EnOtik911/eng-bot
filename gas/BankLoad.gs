/**
 * Заливка банка слов прямо из репозитория.
 *
 * Почему не встроенный в код массив, как в GrammarSeed.gs: батчи уже лежат в data/,
 * где их проверяет настоящий валидатор на каждом прогоне тестов. Копия в .gs была бы
 * вторым источником правды и разошлась бы с первой же правкой. Репозиторий публичный,
 * поэтому UrlFetch обходится без авторизации.
 *
 * Один вход в редакторе: loadEverything(). Он ставит норму, заливает все батчи по
 * порядку слоёв и печатает отчёт.
 */

var BANK_REPO_RAW = 'https://raw.githubusercontent.com/EnOtik911/eng-bot/main/data/';

/**
 * ПОРЯДОК ЗНАЧИМ — он совпадает с порядком слоёв в VALID_LAYERS, то есть с очередью
 * освоения. Заливать вразнобой можно, но тогда планировщик выдаст сначала то, что
 * попало в таблицу раньше.
 */
var BANK_FILES = [
  'bank-002-core.tsv',
  'bank-003-social.tsv',
  'bank-004-business.tsv',
  'bank-005-analysis.tsv',
  'bank-006-fintech.tsv',
  'bank-007-tech.tsv'
];

function fetchTsv_(fileName) {
  var res = UrlFetchApp.fetch(BANK_REPO_RAW + fileName, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('не удалось скачать ' + fileName + ': HTTP ' + code);
  }
  var lines = res.getContentText().split('\n').filter(function (l) { return l.trim().length; });
  if (!lines.length) throw new Error(fileName + ' пуст');

  var header = lines[0].split('\t');
  // Заголовок сверяется со схемой, а не принимается на веру: файл в репозитории мог
  // уехать вперёд относительно кода, и тогда колонки молча встанут не туда.
  if (header.join('\t') !== IMPORT_COLUMNS.join('\t')) {
    throw new Error(fileName + ': заголовок не совпадает со схемой.\n  получено: ' +
      header.join(', ') + '\n  ожидалось: ' + IMPORT_COLUMNS.join(', '));
  }

  return lines.slice(1).map(function (l) {
    var cells = l.split('\t');
    while (cells.length < IMPORT_COLUMNS.length) cells.push('');
    return cells.slice(0, IMPORT_COLUMNS.length);
  });
}

/** Один батч: скачать, положить в inbox, импортировать, вернуть отчёт. */
function loadBankFile(fileName) {
  var rows = fetchTsv_(fileName);
  var sh = sheet_(SHEET_INBOX);

  // Inbox должен быть пуст: чужие недоимпортированные строки уехали бы в этот батч.
  // Заголовок переписывается каждый раз: схема выросла на колонку, и лист,
  // созданный до этого, молча разъехался бы со значениями.
  sh.getRange(1, 1, 1, IMPORT_COLUMNS.length).setValues([IMPORT_COLUMNS]).setFontWeight('bold');
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).clearContent();

  sh.getRange(2, 1, rows.length, IMPORT_COLUMNS.length).setValues(rows);
  SpreadsheetApp.flush();

  var report = importInbox(cfgAllowlist_()[0]);
  report.file = fileName;
  report.rows_in_file = rows.length;
  return report;
}

/**
 * Дописать разбор и объяснение в УЖЕ импортированные карточки.
 *
 * Обычный импорт для этого не годится: он отклоняет дубликаты, а все эти единицы
 * в таблице уже есть. Сопоставление идёт по `en` — в банке это ключ уникальности,
 * по нему же импортёр ловит дубликаты. Обновляются обе карточки единицы (recog и
 * prod): разбор принадлежит словосочетанию, а не направлению.
 */
function backfillGloss() {
  var text = {};
  var files = ['seed-batch-001.tsv'].concat(BANK_FILES);
  var scanned = 0;
  files.forEach(function (f) {
    var rows;
    try { rows = fetchTsv_(f); } catch (e) { Logger.log(f + ': ' + e.message); return; }
    rows.forEach(function (cells) {
      var en = String(cells[1] || '').trim();
      var note = String(cells[7] || '').trim();
      var breakdown = String(cells[8] || '').trim();
      scanned++;
      if (en && (note || breakdown)) text[en] = { note: note, breakdown: breakdown };
    });
  });

  var updates = [];
  readCards_().forEach(function (c) {
    var t = text[String(c.en).trim()];
    if (!t) return;
    // Пустым значением ничего не затираем: файл мог отстать от таблицы.
    var patch = {};
    if (t.note && String(c.note || '') !== t.note) patch.note = t.note;
    if (t.breakdown && String(c.breakdown || '') !== t.breakdown) patch.breakdown = t.breakdown;
    if (Object.keys(patch).length) updates.push({ _row: c._row, patch: patch });
  });

  var written = writeCardUpdates_(updates);
  var report = 'разбор: в файлах ' + Object.keys(text).length + ' единиц из ' + scanned +
    ', обновлено карточек ' + written;
  Logger.log(report);
  return report;
}

/** Дневная норма новых. Меняется без переустановки триггеров. */
function tuneDailyTarget(newTarget) {
  var before = readSettings_().daily_new_target;
  writeSetting_('daily_new_target', String(newTarget));
  Logger.log('daily_new_target: ' + before + ' -> ' + newTarget);
  return { before: before, after: newTarget };
}

/**
 * Всё за один запуск: норма, листы, грамматика, весь банк слов.
 * Безопасно запускать повторно — дубликаты отклоняются импортёром, а не пишутся вторым
 * экземпляром.
 */
function loadEverything() {
  var log = [];
  function say(s) { log.push(s); Logger.log(s); }

  say('=== ДНЕВНАЯ НОРМА');
  var t = tuneDailyTarget(10);
  say('  было ' + t.before + ', стало ' + t.after +
    '  (по модели нагрузки: ~95 повторений и ~13 минут в день)');

  say('');
  say('=== ЛИСТЫ');
  setupSpreadsheet();
  say('  проверены и созданы недостающие');

  say('');
  say('=== ГРАММАТИКА');
  try {
    var pats = readPatterns_();
    if (pats.length) {
      say('  уже залита: шаблонов ' + pats.length + ', заданий ' + readGrammarItems_().length);
    } else {
      seedGrammarBatch();
      var g = importGrammarInbox(cfgAllowlist_()[0]);
      say('  шаблонов создано: ' + (g.patterns_created || 0) +
        ', заданий принято: ' + (g.accepted || 0) +
        ', отклонено: ' + (g.rejected || 0) + ', дубликатов: ' + (g.duplicates || 0));
    }
  } catch (e) {
    say('  ОШИБКА: ' + e.message);
  }

  say('');
  say('=== БАНК СЛОВ');
  var totalAccepted = 0;
  var totalRejected = 0;
  var totalDup = 0;
  BANK_FILES.forEach(function (f) {
    try {
      var r = loadBankFile(f);
      totalAccepted += r.accepted || 0;
      totalRejected += r.rejected || 0;
      totalDup += r.duplicates || 0;
      say('  ' + f + ': в файле ' + r.rows_in_file +
        ', принято ' + (r.accepted || 0) +
        ', карточек ' + (r.cards_created || 0) +
        ', отклонено ' + (r.rejected || 0) +
        ', дубликатов ' + (r.duplicates || 0));
    } catch (e) {
      say('  ' + f + ': ОШИБКА — ' + e.message);
    }
  });
  say('  ИТОГО принято единиц: ' + totalAccepted +
    ', отклонено: ' + totalRejected + ', дубликатов: ' + totalDup);
  if (totalRejected) {
    say('  Причины отклонений построчно — на листе "' + SHEET_REJECTS + '"');
  }

  say('');
  say('=== ЧТО ПОЛУЧИЛОСЬ');
  var s = buildSession(cfgAllowlist_()[0]);
  say('  карточек всего: ' + s.counts.total);
  say('  к повторению сейчас: ' + s.counts.due);
  say('  новых в запасе: ' + s.counts.new_available);
  say('  выдаётся сегодня новых: ' + s.counts.new_in_session);
  var gs = buildGrammarSession(cfgAllowlist_()[0]);
  say('  шаблонов грамматики: ' + gs.counts.total + ', в очереди сегодня: ' + gs.queue.length);
  say('');
  say('Открывай приложение.');

  return log.join('\n');
}
