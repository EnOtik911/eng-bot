/**
 * Router. One deployment serves both the Mini App and the Telegram webhook —
 * they are told apart by the shape of the payload, not by the URL.
 *
 * Transport rule that must never be broken on the client side:
 * only "simple" requests. Apps Script does not answer OPTIONS at all, so any
 * preflight kills the call and no server-side header can fix it.
 */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  return json_({ ok: false, code: code, message: message || code });
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    if (action === 'ping') return json_({ ok: true, pong: new Date().toISOString() });
    if (action === 'diag') return json_(diagInitData(e.parameter.initData));
    if (action !== 'session' && action !== 'grammar' && action !== 'practice' &&
        action !== 'stats') {
      return fail_('BAD_REQUEST', 'unknown action: ' + action);
    }

    var auth = verifyInitData(e.parameter.initData);
    if (!auth.ok) return fail_(auth.code);

    if (action === 'grammar') return json_(buildGrammarSession(auth.userId));
    if (action === 'practice') return json_(buildPractice(auth.userId));
    if (action === 'stats') {
      var stats = buildStats(auth.userId);
      stats.achievements = evaluateAchievements(stats);
      return json_(stats);
    }
    return json_(buildSession(auth.userId));
  } catch (err) {
    Logger.log('doGet: ' + err.stack);
    return fail_('INTERNAL', String(err.message));
  }
}

function doPost(e) {
  try {
    var body = e && e.postData ? e.postData.contents : '';
    var payload;
    try { payload = JSON.parse(body || '{}'); } catch (parseErr) {
      return fail_('BAD_REQUEST', 'body is not JSON');
    }

    // Telegram webhook update: has update_id, never has `action`.
    if (payload.update_id !== undefined) {
      if (!verifyWebhookSecret_(e)) return json_({ ok: true });  // stay quiet to strangers
      handleBotUpdate_(payload);
      return json_({ ok: true });
    }

    if (payload.action !== 'flush' && payload.action !== 'grammar_flush') {
      return fail_('BAD_REQUEST', 'unknown action');
    }

    var auth = verifyInitData(payload.initData);
    if (!auth.ok) return fail_(auth.code);

    if (payload.action === 'grammar_flush') {
      return json_(applyGrammarFlush(auth.userId, payload.batch_id, payload.rounds));
    }
    return json_(applyFlush(auth.userId, payload.batch_id, payload.reviews));
  } catch (err) {
    Logger.log('doPost: ' + err.stack);
    if (String(err.message) === 'LOCKED') return fail_('LOCKED', 'another write is in progress');
    return fail_('INTERNAL', String(err.message));
  }
}
