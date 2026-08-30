/**
 * Одна команда, отвечающая на вопрос «почему ничего не происходит».
 *
 * Она существует потому, что двухдневная тишина имеет минимум пять разных причин —
 * триггер не установлен, триггер падает, токен отозван, очередь действительно пуста,
 * листы не созданы — и различить их снаружи нельзя. Раньше на это уходил обмен
 * сообщениями из пяти шагов.
 *
 * Запускать из редактора: выбрать runDiagnostics, Выполнить, читать журнал.
 */
function runDiagnostics() {
  var out = [];
  function say(s) { out.push(s); Logger.log(s); }
  function head(s) { say(''); say('=== ' + s); }

  head('СЕКРЕТЫ');
  ['BOT_TOKEN', 'SHEET_ID', 'ALLOWLIST'].forEach(function (k) {
    var v = PropertiesService.getScriptProperties().getProperty(k);
    say('  ' + k + ': ' + (v ? 'задан (' + v.length + ' символов)' : 'ОТСУТСТВУЕТ'));
  });

  head('ТРИГГЕРЫ');
  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    say('  НИ ОДНОГО ТРИГГЕРА. Это и есть причина тишины.');
    say('  Лечится так: выполнить installTriggers() и потом в интерфейсе триггеров');
    say('  поставить уведомления о сбоях на «Notify me immediately».');
  } else {
    triggers.forEach(function (t) {
      say('  ' + t.getHandlerFunction() + ' — ' + t.getEventType());
    });
    ['dailyPing', 'checkWebhook', 'onOpenMenu'].forEach(function (fn) {
      var found = triggers.some(function (t) { return t.getHandlerFunction() === fn; });
      if (!found) say('  ОТСУТСТВУЕТ триггер для ' + fn + ' — выполни installTriggers()');
    });
  }

  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  head('ПОСЛЕДНИЙ ЗАПУСК ТРИГГЕРА');
  if (!settings.last_trigger_run) {
    say('  НИ РАЗУ. Триггер либо не установлен, либо падает при каждом запуске.');
    say('  Проверь: Выполнения (Executions) в левом меню редактора — там видно ошибки.');
  } else {
    var ageH = (Date.now() - new Date(settings.last_trigger_run).getTime()) / 3600000;
    say('  ' + settings.last_trigger_run + '  (' + ageH.toFixed(1) + ' часов назад)');
    if (ageH > 36) say('  СТАРШЕ 36 ЧАСОВ — триггер не отработал, смотри Выполнения.');
  }

  head('БОТ');
  try {
    var me = tgApi_('getMe', {});
    say('  getMe: ' + (me && me.ok ? 'ok, @' + me.result.username : 'ОШИБКА ' + JSON.stringify(me)));
  } catch (e) { say('  getMe: ИСКЛЮЧЕНИЕ — ' + e.message); }
  try {
    var wh = tgApi_('getWebhookInfo', {});
    var r = wh && wh.result ? wh.result : {};
    say('  webhook url: ' + (r.url || 'НЕ УСТАНОВЛЕН'));
    if (r.last_error_message) {
      say('  ПОСЛЕДНЯЯ ОШИБКА WEBHOOK: ' + r.last_error_message + ' (' + r.last_error_date + ')');
    }
    if (r.pending_update_count) say('  необработанных обновлений: ' + r.pending_update_count);
  } catch (e) { say('  getWebhookInfo: ИСКЛЮЧЕНИЕ — ' + e.message); }

  var userId = cfgAllowlist_()[0];
  head('ЛЕКСИКА (пользователь ' + userId + ')');
  var cards = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var byState = {};
  cards.forEach(function (c) {
    var st = String(c.state || 'пусто');
    byState[st] = (byState[st] || 0) + 1;
  });
  say('  всего карточек: ' + cards.length);
  Object.keys(byState).sort().forEach(function (k) { say('    ' + k + ': ' + byState[k]); });
  var due = cards.filter(function (c) {
    var st = String(c.state);
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
    return c.due && String(c.due).slice(0, 10) <= today;
  });
  var introduced = cards.filter(function (c) {
    return c.first_review && String(c.first_review).slice(0, 10) === today;
  });
  var noFirst = cards.filter(function (c) { return c.last_review && !c.first_review; });
  say('  к повторению сегодня (' + today + '): ' + due.length);
  say('  введено сегодня: ' + introduced.length +
    ' из нормы ' + (settings.daily_new_target || '?'));
  if (noFirst.length) {
    say('  ВНИМАНИЕ: ' + noFirst.length + ' карточек показывались, но без first_review —');
    say('  дневная норма считается неверно. Выполни backfillFirstReview() один раз.');
  }
  var futureDue = cards.map(function (c) { return c.due ? String(c.due).slice(0, 10) : ''; })
    .filter(function (d) { return d && d > today; }).sort();
  say('  ближайшее будущее повторение: ' + (futureDue[0] || 'нет'));

  head('ГРАММАТИКА');
  try {
    var pats = readPatterns_().filter(function (p) { return String(p.user_id) === String(userId); });
    var items = readGrammarItems_();
    say('  шаблонов: ' + pats.length + ', заданий: ' + items.length);
    if (!pats.length) {
      say('  ПУСТО. Выполни по порядку: setupSpreadsheet, seedGrammarBatch, runImportGrammar.');
    } else {
      var gState = {};
      pats.forEach(function (p) {
        var st = String(p.state || 'new');
        gState[st] = (gState[st] || 0) + 1;
      });
      Object.keys(gState).sort().forEach(function (k) { say('    ' + k + ': ' + gState[k]); });
      var gDue = pats.filter(function (p) {
        var st = String(p.state || 'new');
        if (st === 'new' || st === 'suspended') return false;
        return p.due && String(p.due).slice(0, 10) <= today;
      }).length;
      say('  к повторению сегодня: ' + gDue);
      var gFuture = pats.map(function (p) { return p.due ? String(p.due).slice(0, 10) : ''; })
        .filter(function (d) { return d && d > today; }).sort();
      say('  ближайшее будущее повторение: ' + (gFuture[0] || 'нет'));
    }
  } catch (e) {
    say('  листы грамматики недоступны: ' + e.message);
    say('  Выполни setupSpreadsheet, затем seedGrammarBatch, затем runImportGrammar.');
  }

  head('ВЫВОД');
  if (!triggers.length) {
    say('  Уведомлений нет, потому что триггеры не установлены. installTriggers().');
  } else if (!settings.last_trigger_run) {
    say('  Триггеры есть, но ни один не отработал. Смотри Выполнения — там будет ошибка.');
  } else if (!due.length) {
    say('  Уведомлений нет, потому что работы действительно нет: ближайшее повторение ' +
      (futureDue[0] || '— карточки кончились'));
    say('  Если хочется учиться чаще — подними daily_new_target или залей новый батч.');
  } else {
    say('  Работа есть (' + due.length + ' к повторению), а уведомления не приходят —');
    say('  значит падает отправка. Смотри строку про getMe и webhook выше.');
  }
  say('');
  return out.join('\n');
}
