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
  writeSetting_('last_trigger_run', new Date().toISOString());

  var allow = cfgAllowlist_();
  var cards = readCards_();
  var today = todayStr_(settings.timezone);

  allow.forEach(function (userId) {
    var mine = cards.filter(function (c) { return String(c.user_id) === String(userId); });
    var due = mine.filter(function (c) {
      var st = String(c.state);
      if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return false;
      return c.due && String(c.due).slice(0, 10) <= today;
    }).length;
    var fresh = mine.filter(function (c) { return String(c.state) === 'new'; }).length;
    var target = Math.min(parseInt(settings.daily_new_target, 10) || 6, fresh);
    var leeches = mine.filter(function (c) { return String(c.state) === 'leech'; }).length;

    if (due === 0 && target === 0) return;   // nothing to do, so say nothing

    var lines = ['<b>На сегодня</b>'];
    if (due) lines.push('К повторению: ' + due);
    if (target) lines.push('Новых: ' + target);
    if (leeches) lines.push('Пиявок ждёт переформулировки: ' + leeches);
    sendMessage_(userId, lines.join('\n'), launchKeyboard_());
  });
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

function handleBotUpdate_(update) {
  if (updateSeen_(update.update_id)) return;   // повторная доставка того же апдейта
  var msg = update.message;
  if (!msg || !msg.text) return;
  var userId = String(msg.from && msg.from.id);
  if (cfgAllowlist_().indexOf(userId) < 0) return;

  var text = String(msg.text).trim();
  if (text === '/start' || text === '/open') {
    sendMessage_(userId, 'Тренажёр готов.', launchKeyboard_());
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
