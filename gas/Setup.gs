/**
 * Creates every tab with headers and seeds settings. Idempotent: running it twice
 * changes nothing. This is what makes the deploy reproducible from an empty sheet.
 */

function setupSpreadsheet() {
  var ss = ss_();

  ensureTab_(ss, SHEET_CARDS, CARD_COLUMNS);
  ensureTab_(ss, SHEET_SETTINGS, ['key', 'value']);
  ensureTab_(ss, SHEET_INBOX, IMPORT_COLUMNS);
  ensureTab_(ss, SHEET_REJECTS, ['inbox_line', 'reason', 'ts'].concat(IMPORT_COLUMNS));
  ensureTab_(ss, SHEET_FLUSH_LOG, ['batch_id', 'received_at', 'count']);
  ensureTab_(ss, logSheetName_(), LOG_COLUMNS);

  ensureTab_(ss, SHEET_PATTERNS, PATTERN_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_INBOX, GRAMMAR_IMPORT_COLUMNS);
  ensureTab_(ss, SHEET_GRAMMAR_REJECTS,
    ['inbox_line', 'reason', 'ts'].concat(GRAMMAR_IMPORT_COLUMNS));
  ensureTab_(ss, grammarLogSheetName_(), GRAMMAR_LOG_COLUMNS);

  var existing = readSettings_();
  var seeded = 0;
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    var sh = ss.getSheetByName(SHEET_SETTINGS);
    var lastRow = sh.getLastRow();
    var keys = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 1).getValues()
      .map(function (r) { return String(r[0]).trim(); }) : [];
    if (keys.indexOf(k) < 0) { sh.appendRow([k, DEFAULT_SETTINGS[k]]); seeded++; }
  });

  // Data validation on the inbox so a wrong type is caught before import even runs.
  var inbox = ss.getSheetByName(SHEET_INBOX);
  inbox.getRange(2, 1, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_TYPES, true).build());
  inbox.getRange(2, 6, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_LAYERS, true).build());

  var ginbox = ss.getSheetByName(SHEET_GRAMMAR_INBOX);
  ginbox.getRange(2, GRAMMAR_IMPORT_COLUMNS.indexOf('kind') + 1, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(VALID_KINDS, true).build());

  Logger.log('setup done. settings seeded: ' + seeded);
  Logger.log('tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var current = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var same = current.length === headers.length && current.every(function (v, i) {
    return String(v) === headers[i];
  });
  if (!same) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Twenty hand-made cards so the vertical slice has something to show before the
 * first real batch exists. Safe to run once; duplicates are skipped by importInbox.
 */
function seedStarterBatch() {
  var rows = [
    ['collocation', 'roll out a feature', 'выкатывать функциональность', 'We roll out the feature to ten percent of users first.', 'Сначала мы выкатываем функциональность на десять процентов пользователей.', 'business', 'release', ''],
    ['collocation', 'push back on a deadline', 'оспаривать срок', 'I had to push back on the deadline because scope grew.', 'Мне пришлось оспорить срок, потому что объём вырос.', 'business', 'negotiation', ''],
    ['collocation', 'take ownership of', 'брать ответственность за', 'She took ownership of the migration end to end.', 'Она взяла ответственность за миграцию от начала до конца.', 'business', 'ownership', ''],
    ['collocation', 'align on scope', 'согласовать объём работ', 'Let us align on scope before we estimate.', 'Давайте согласуем объём работ до оценки.', 'business', 'planning', ''],
    ['collocation', 'raise a concern', 'озвучить опасение', 'I want to raise a concern about the rollout plan.', 'Хочу озвучить опасение по плану выкатки.', 'business', 'meetings', ''],
    ['phrase', 'let me walk you through it', 'давай я проведу тебя по этому', 'Let me walk you through it step by step.', 'Давай я проведу тебя по этому шаг за шагом.', 'business', 'meetings', ''],
    ['phrase', 'correct me if I am wrong', 'поправь меня, если я не прав', 'Correct me if I am wrong, but the sync is nightly.', 'Поправь меня, если я не прав, но синхронизация ночная.', 'business', 'meetings', ''],
    ['phrase', 'that is out of scope for now', 'сейчас это вне объёма работ', 'That is out of scope for now, let us park it.', 'Сейчас это вне объёма работ, давайте отложим.', 'business', 'meetings', ''],
    ['collocation', 'fleet utilization', 'утилизация парка', 'Fleet utilization dropped after the price change.', 'Утилизация парка упала после изменения цены.', 'mobility', 'metrics', ''],
    ['collocation', 'unit economics', 'юнит-экономика', 'The unit economics break even at four rides per day.', 'Юнит-экономика выходит в ноль на четырёх поездках в день.', 'mobility', 'metrics', ''],
    ['collocation', 'idle vehicle', 'простаивающий транспорт', 'We rebalance idle vehicles every morning.', 'Мы перераспределяем простаивающий транспорт каждое утро.', 'mobility', 'ops', ''],
    ['collocation', 'ride completion rate', 'доля завершённых поездок', 'Ride completion rate fell in the rainy week.', 'Доля завершённых поездок упала в дождливую неделю.', 'mobility', 'metrics', ''],
    ['collocation', 'promo redemption', 'использование промокода', 'Promo redemption spiked on the first weekend.', 'Использование промокода подскочило в первые выходные.', 'mobility', 'growth', ''],
    ['collocation', 'attribution window', 'окно атрибуции', 'We use a seven day attribution window.', 'Мы используем семидневное окно атрибуции.', 'mobility', 'growth', ''],
    ['collocation', 'rate plan', 'тарифный план', 'The rate plan changes on weekends.', 'Тарифный план меняется на выходных.', 'hospitality', 'pms', ''],
    ['collocation', 'guest folio', 'счёт гостя', 'Charges post to the guest folio automatically.', 'Начисления попадают на счёт гостя автоматически.', 'hospitality', 'pms', ''],
    ['collocation', 'room inventory', 'номерной фонд', 'Room inventory syncs with the channel manager.', 'Номерной фонд синхронизируется с channel manager.', 'hospitality', 'pms', ''],
    ['collocation', 'no-show policy', 'политика незаезда', 'The no-show policy charges the first night.', 'Политика незаезда списывает первую ночь.', 'hospitality', 'pms', ''],
    ['collocation', 'gather requirements', 'собирать требования', 'I gather requirements from three stakeholder groups.', 'Я собираю требования у трёх групп стейкхолдеров.', 'business', 'analysis', ''],
    ['collocation', 'edge case', 'краевой случай', 'This edge case breaks the nightly job.', 'Этот краевой случай ломает ночную задачу.', 'business', 'analysis', '']
  ];
  var sh = sheet_(SHEET_INBOX);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, IMPORT_COLUMNS.length).setValues(rows);
  Logger.log('seeded ' + rows.length + ' rows into inbox — now run "Импортировать батч" from the menu');
}

/**
 * Заполняет first_review для карточек, созданных до появления этой колонки.
 * Идемпотентна: уже заполненные не трогает. Запустить один раз после обновления кода.
 */
function backfillFirstReview() {
  var cards = readCards_();
  var updates = [];
  cards.forEach(function (c) {
    if (c.first_review) return;
    if (!c.last_review) return;                 // ещё ни разу не показывалась
    updates.push({
      _row: c._row,
      patch: { first_review: String(c.last_review).slice(0, 10) }
    });
  });
  var written = writeCardUpdates_(updates);
  Logger.log('first_review заполнен у ' + written + ' карточек из ' + cards.length);
  Logger.log('Внимание: для уже показанных карточек в качестве даты первого показа взята '
    + 'дата последнего — точнее взять негде, и это влияет только на подсчёт дневной нормы.');
  return written;
}
