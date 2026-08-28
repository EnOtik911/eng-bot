/**
 * Run installTriggers() once by hand. Then set, in the trigger UI (clock icon),
 * "Failure notification settings" to "Notify me immediately" for each one —
 * that switch cannot be set from code, and without it a dead trigger is silent
 * until the daily summary email, which is easy to miss.
 */

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  var settings = readSettings_();
  var hour = parseInt(settings.ping_hour, 10);
  if (isNaN(hour)) hour = 8;

  ScriptApp.newTrigger('dailyPing').timeBased().atHour(hour).everyDays(1).create();
  ScriptApp.newTrigger('checkWebhook').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9).create();

  // A standalone script never runs a simple onOpen(), so the spreadsheet menu has to
  // be attached with an installable trigger bound to that specific document.
  ScriptApp.newTrigger('onOpenMenu')
    .forSpreadsheet(SpreadsheetApp.openById(cfg_('SHEET_ID')))
    .onOpen()
    .create();

  Logger.log('installed: dailyPing at ~' + hour + ':00, checkWebhook Mondays ~09:00, '
    + 'onOpenMenu on the spreadsheet');
  Logger.log('now set Failure notification to "Notify me immediately" for the two time-based ones');
}

function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    Logger.log(t.getHandlerFunction() + ' — ' + t.getEventType());
  });
}
