/** Telegram bot: a daily ping and a launch button. Nothing else lives here. */

function tgApi_(method, payload) {
  var url = 'https://api.telegram.org/bot' + cfg_('BOT_TOKEN') + '/' + method;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var body = res.getContentText();
  var parsed;
  try { parsed = JSON.parse(body); } catch (e) { parsed = { ok: false, raw: body }; }
  if (!parsed.ok) Logger.log('Telegram ' + method + ' failed: ' + body);
  return parsed;
}

/**
 * Файл в чат. Именно документом, а не текстом: CSV на несколько тысяч строк не
 * влезет в 4096 символов сообщения, а обрезанная выгрузка хуже её отсутствия.
 * multipart собирается вручную — UrlFetchApp сам делает это для payload с Blob.
 */
function sendDocument_(chatId, name, content, caption) {
  var url = 'https://api.telegram.org/bot' + cfg_('BOT_TOKEN') + '/sendDocument';
  var blob = Utilities.newBlob(content, 'text/csv', name);
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { chat_id: String(chatId), caption: caption || '', document: blob },
    muteHttpExceptions: true
  });
  var parsed;
  try { parsed = JSON.parse(res.getContentText()); } catch (e) { parsed = { ok: false }; }
  if (!parsed.ok) Logger.log('sendDocument failed: ' + res.getContentText());
  return parsed;
}

function sendMessage_(chatId, text, replyMarkup) {
  return tgApi_('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup || undefined
  });
}

function launchKeyboard_() {
  var url = PropertiesService.getScriptProperties().getProperty('MINI_APP_URL');
  if (!url) return undefined;
  return { inline_keyboard: [[{ text: 'Открыть тренажёр', web_app: { url: url } }]] };
}

/** Called by the daily trigger. */
function dailyPing() {
  var settings = readSettings_();
  var allow = cfgAllowlist_();
  var delivered = true;
  var cards = readCards_();
  var today = todayStr_(settings.timezone);
  var patterns = [];
  var grammarItems = [];
  try {
    patterns = readPatterns_();
    grammarItems = readGrammarItems_();
  } catch (e) {
    // Листы грамматики могут ещё не существовать — это не повод молчать про лексику.
  }
  var poolSize = {};
  grammarItems.forEach(function (it) {
    poolSize[String(it.pattern_id)] = (poolSize[String(it.pattern_id)] || 0) + 1;
  });

  allow.forEach(function (userId) {
    var mine = cards.filter(function (c) { return String(c.user_id) === String(userId); });
    var due = mine.filter(function (c) {
      var st = String(c.state);
      if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
      return c.due && dateKey_(c.due, settings.timezone) <= today;
    }).length;
    var fresh = mine.filter(function (c) { return String(c.state) === 'new'; }).length;
    var target = Math.min(parseInt(settings.daily_new_target, 10) || 6, fresh);
    var leeches = mine.filter(function (c) { return String(c.state) === 'leech'; }).length;

    // Грамматика считается тем же способом и тем же условием, что и планировщик:
    // шаблон без заданий не играбелен, поэтому в счёт не идёт.
    var myPatterns = patterns.filter(function (p) {
      return String(p.user_id) === String(userId) && poolSize[String(p.pattern_id)];
    });
    var gDue = myPatterns.filter(function (p) {
      var st = String(p.state || 'new');
      if (st === 'new' || st === 'suspended') return false;
      return p.due && dateKey_(p.due, settings.timezone) <= today;
    }).length;
    var gFresh = myPatterns.filter(function (p) { return String(p.state || 'new') === 'new'; }).length;
    var gTarget = Math.min(parseInt(settings.grammar_daily_new_target, 10) || 1, gFresh);

    var nothing = (due + target + gDue + gTarget) === 0;

    var lines;
    if (nothing) {
      // Раньше здесь стоял ранний возврат, и «сегодня нечего делать» было неотличимо
      // от «триггер умер». Два дня тишины ровно так и выглядели.
      var next = nextDueDate_(mine, myPatterns);
      lines = ['<b>Сегодня свободно</b>',
        'Всё повторено, новых на сегодня нет.',
        next ? 'Следующее повторение: ' + next : 'Новых карточек в запасе не осталось — залей батч.'];
      if (!ok_(sendMessage_(userId, lines.join('\n')))) delivered = false;
      return;
    }

    lines = ['<b>На сегодня</b>'];
    if (due || target) {
      lines.push('Лексика — к повторению: ' + due + ', новых: ' + target);
    }
    if (gDue || gTarget) {
      lines.push('Грамматика — шаблонов к повторению: ' + gDue + ', новых: ' + gTarget);
    }
    if (leeches) lines.push('Пиявок ждёт переформулировки: ' + leeches);
    if (!ok_(sendMessage_(userId, lines.join('\n'), launchKeyboard_()))) delivered = false;
  });

  // Новые ачивки объявляются здесь, а не на экране: смысл ачивки в том, что она
  // ПРИЛЕТАЕТ, а не в том, что её однажды находят в списке.
  try {
    allow.forEach(function (userId) {
      var fresh = grantAchievements_(buildStats(userId));
      if (!fresh.length) return;
      var all = evaluateAchievements(buildStats(userId)).list;
      var lines = ['<b>Разблокировано</b>'];
      fresh.forEach(function (id) {
        var a = all.filter(function (x) { return x.id === id; })[0];
        if (a) lines.push('&#127894; <b>' + a.title + '</b>\n<i>' + a.note + '</i>');
      });
      sendMessage_(userId, lines.join('\n'));
    });
  } catch (e) {
    // Ачивки — украшение. Уронить из-за них ежедневный пинг было бы смешно.
    Logger.log('achievements: ' + e.message);
  }

  // Отметка ставится ПОСЛЕ фактической отправки, а не в начале функции.
  // Раньше она стояла первой строкой, и упавший между отметкой и отправкой пинг
  // выглядел совершенно живым: приложение читает эту же метку, чтобы предупредить
  // «триггер молчит». Метка о намерении вместо метки о результате — это тот самый
  // зелёный тест при мёртвом процессе, только в проде.
  if (delivered) writeSetting_('last_trigger_run', new Date().toISOString());
}

/** Ответ Telegram — единственное доказательство, что сообщение ушло. */
function ok_(res) {
  return !!(res && res.ok);
}

/** Ближайшая дата, когда снова появится работа. Нужна, чтобы тишина была объяснимой. */
function nextDueDate_(cards, patterns) {
  var dates = [];
  cards.forEach(function (c) {
    var st = String(c.state);
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return;
    if (c.due) dates.push(dateKey_(c.due));
  });
  patterns.forEach(function (p) {
    if (String(p.state || 'new') === 'new' || String(p.state) === 'suspended') return;
    if (p.due) dates.push(dateKey_(p.due));
  });
  dates.sort();
  return dates.length ? dates[0] : '';
}


/** Weekly: is the webhook alive? A lost webhook is silent otherwise. */
function checkWebhook() {
  var info = tgApi_('getWebhookInfo', {});
  writeSetting_('webhook_last_check', new Date().toISOString());
  if (!info.ok || !info.result) return;
  var r = info.result;
  var problem = !r.url || (r.pending_update_count || 0) > 20 || r.last_error_message;
  if (problem) {
    cfgAllowlist_().forEach(function (id) {
      sendMessage_(id, '<b>Webhook требует внимания</b>\nurl: ' + (r.url || 'пусто') +
        '\npending: ' + (r.pending_update_count || 0) +
        (r.last_error_message ? '\nошибка: ' + r.last_error_message : ''));
    });
  }
}

/** Run once by hand after deploying the Web App. */
function setWebhook() {
  var url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (!url) throw new Error('Set WEB_APP_URL in Script Properties first');
  var res = tgApi_('setWebhook', {
    url: url + '?secret=' + cfg_('BOT_TOKEN').slice(-16),
    allowed_updates: ['message']
  });
  Logger.log(JSON.stringify(res));
}

/**
 * Дедуп апдейтов Telegram.
 *
 * Apps Script на POST отвечает редиректом 302, и Telegram считает это неуспехом,
 * поэтому повторяет доставку того же update_id — один /start превращается в пять
 * одинаковых ответов. Идемпотентность по update_id решает это тем же приёмом,
 * что и batch_id для отправки оценок.
 */
function updateSeen_(updateId) {
  if (!updateId) return false;
  var cache = CacheService.getScriptCache();
  var key = 'upd_' + updateId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 3600);   // час с запасом: повторы приходят в течение минут
  return false;
}

/** Отчёт уходит в <pre>, поэтому угловые скобки из сообщений об ошибках надо обезвредить. */
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** У Telegram потолок 4096 символов на сообщение, а отчёт растёт вместе с числом батчей. */
function clip_(s, max) {
  return s.length <= max ? s : s.slice(0, max) + '\n… отчёт обрезан';
}

function handleBotUpdate_(update) {
  if (updateSeen_(update.update_id)) return;   // повторная доставка того же апдейта
  var msg = update.message;
  if (!msg || !msg.text) return;
  var userId = String(msg.from && msg.from.id);
  if (cfgAllowlist_().indexOf(userId) < 0) return;

  var text = String(msg.text).trim();
  if (text === '/start' || text === '/open') {
    sendMessage_(userId, 'Тренажёр готов.', launchKeyboard_());
  } else if (text === '/load') {
    // Единственный пульт для заливки банка. Пункт меню в таблице требует рук в таблице,
    // а `clasp run` требует GCP-проекта, которого у этого проекта намеренно нет.
    // Дедуп по update_id стоит ВЫШЕ по функции, поэтому повтор доставки не зальёт дважды.
    sendMessage_(userId, 'Заливаю банк из репозитория. Это занимает минуту-две.');
    var report;
    try {
      report = loadEverything();
    } catch (e) {
      // Молча в Logger такая ошибка ушла бы навсегда: логи Apps Script никто не открывает.
      sendMessage_(userId, '<b>Заливка упала</b>\n<pre>' + escapeHtml_(String(e.message)) + '</pre>');
      return;
    }
    sendMessage_(userId, '<pre>' + escapeHtml_(clip_(String(report), 3500)) + '</pre>',
      launchKeyboard_());
  } else if (text === '/gloss') {
    try {
      sendMessage_(userId, escapeHtml_(backfillGloss()));
    } catch (e) {
      sendMessage_(userId, '<b>Заливка разбора упала</b>\n<pre>' +
        escapeHtml_(String(e.message)) + '</pre>');
    }
  } else if (text === '/export') {
    var dump = exportReviewsCsv(userId);
    if (!dump.rows) { sendMessage_(userId, 'Выгружать пока нечего — журнал пуст.'); return; }
    var stamp = Utilities.formatDate(new Date(), readSettings_().timezone || 'Europe/Moscow',
      'yyyy-MM-dd');
    sendDocument_(userId, 'eng-bot-reviews-' + stamp + '.csv', dump.csv,
      'Журнал повторений: строк ' + dump.rows);
  } else if (text === '/stats') {
    var s = buildSession(userId);
    sendMessage_(userId, [
      '<b>Состояние базы</b>',
      'Всего карточек: ' + s.counts.total,
      'К повторению сейчас: ' + s.counts.due,
      'Новых в запасе: ' + s.counts.new_available,
      'Заблокировано до созревания: ' + s.counts.locked,
      'Пиявок: ' + s.counts.leeches
    ].join('\n'), launchKeyboard_());
  }
}
