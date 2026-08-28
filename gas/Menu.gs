/** Custom menu on the spreadsheet. The import workflow lives here. */

function onOpen() {
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

function menuImport() {
  var ui = SpreadsheetApp.getUi();
  try {
    var userId = cfgAllowlist_()[0];
    var report = importInbox(userId);
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
  try { dailyPing(); ui.alert('Пинг отправлен'); }
  catch (e) { ui.alert('Не отправлен', String(e.message), ui.ButtonSet.OK); }
}

function menuCheckWebhook() {
  var info = tgApi_('getWebhookInfo', {});
  SpreadsheetApp.getUi().alert('getWebhookInfo', JSON.stringify(info.result || info, null, 2),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuSelfCheck() {
  selfCheck();
  SpreadsheetApp.getUi().alert('Готово', 'Результат в журнале выполнения (Ctrl+Enter).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
