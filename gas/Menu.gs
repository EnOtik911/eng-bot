/**
 * Меню таблицы.
 *
 * ВАЖНО: этот проект standalone (ADR-02), а простой `onOpen()` вызывается только
 * у скриптов, привязанных к документу. Поэтому меню ставится УСТАНАВЛИВАЕМЫМ
 * триггером на конкретную таблицу — см. installTriggers() в Triggers.gs.
 * Без этого триггера меню не появится, и это не поломка настроек, а следствие
 * выбора standalone.
 *
 * Каждая операция продублирована функцией без префикса `menu`, которую можно
 * запустить прямо из редактора Apps Script: результат уходит в журнал выполнения,
 * а не в диалог. Так всё доступно даже до установки триггера.
 */

function onOpenMenu(e) {
  var ss = e && e.source ? e.source : ss_();
  SpreadsheetApp.getUi()
    .createMenu('Eng_bot')
    .addItem('Импортировать батч из inbox', 'menuImport')
    .addSeparator()
    .addItem('Отправить тестовый пинг', 'menuTestPing')
    .addItem('Проверить webhook', 'menuCheckWebhook')
    .addSeparator()
    .addItem('Первичная настройка листов', 'setupSpreadsheet')
    .addItem('Засеять стартовый батч', 'seedStarterBatch')
    .addItem('Самопроверка конфигурации', 'menuSelfCheck')
    .addToUi();
}

/** Совместимость: если проект однажды сделают привязанным, меню появится и так. */
function onOpen(e) {
  onOpenMenu(e);
}

// ---------------------------------------------------------------------------
// Запускается из редактора: без UI, отчёт в журнал выполнения
// ---------------------------------------------------------------------------

/** Импорт из inbox. Запускай из редактора, результат в журнале (Ctrl+Enter). */
function runImport() {
  var report = importInbox(cfgAllowlist_()[0]);
  Logger.log('Принято единиц: ' + (report.accepted || 0));
  Logger.log('Создано карточек: ' + (report.cards_created || 0));
  Logger.log('Отклонено: ' + (report.rejected || 0));
  Logger.log('Дубликатов: ' + (report.duplicates || 0));
  if (report.batch) Logger.log('Батч: ' + report.batch);
  if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
    Logger.log('Причины построчно — на листе "' + SHEET_REJECTS + '"');
  }
  if (report.message) Logger.log(report.message);
  return report;
}

/** Тестовый пинг в Telegram. Запускай из редактора. */
function runTestPing() {
  dailyPing();
  Logger.log('dailyPing выполнен. Если сообщения нет — проверь BOT_TOKEN и ALLOWLIST.');
}

/** Состояние webhook. Запускай из редактора. */
function runCheckWebhook() {
  var info = tgApi_('getWebhookInfo', {});
  Logger.log(JSON.stringify(info.result || info, null, 2));
  return info;
}

/** Состояние очереди по данным, а не по ощущениям. Запускай из редактора. */
function runStats() {
  var s = buildSession(cfgAllowlist_()[0]);
  Logger.log('Всего карточек: ' + s.counts.total);
  Logger.log('К повторению сейчас: ' + s.counts.due);
  Logger.log('Новых в запасе: ' + s.counts.new_available);
  Logger.log('Заблокировано до созревания: ' + s.counts.locked);
  Logger.log('Пиявок: ' + s.counts.leeches);
  if (s.warnings.length) Logger.log('Предупреждения: ' + s.warnings.join(', '));
  return s.counts;
}

// ---------------------------------------------------------------------------
// Обработчики пунктов меню: те же операции, но с диалогами
// ---------------------------------------------------------------------------

function menuImport() {
  var ui = SpreadsheetApp.getUi();
  try {
    var report = runImport();
    var lines = [
      'Принято единиц: ' + (report.accepted || 0),
      'Создано карточек: ' + (report.cards_created || 0),
      'Отклонено: ' + (report.rejected || 0),
      'Дубликатов: ' + (report.duplicates || 0)
    ];
    if (report.batch) lines.push('', 'Батч: ' + report.batch);
    if ((report.rejected || 0) + (report.duplicates || 0) > 0) {
      lines.push('Причины построчно — на листе "' + SHEET_REJECTS + '".');
    }
    ui.alert('Импорт', lines.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Импорт не выполнен', String(e.message), ui.ButtonSet.OK);
  }
}

function menuTestPing() {
  var ui = SpreadsheetApp.getUi();
  try { runTestPing(); ui.alert('Пинг отправлен'); }
  catch (e) { ui.alert('Не отправлен', String(e.message), ui.ButtonSet.OK); }
}

function menuCheckWebhook() {
  var ui = SpreadsheetApp.getUi();
  var info = runCheckWebhook();
  ui.alert('getWebhookInfo', JSON.stringify(info.result || info, null, 2), ui.ButtonSet.OK);
}

function menuSelfCheck() {
  selfCheck();
  var ui = SpreadsheetApp.getUi();
  ui.alert('Готово', 'Результат в журнале выполнения (Ctrl+Enter).', ui.ButtonSet.OK);
}
