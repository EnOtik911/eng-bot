/**
 * Rendering and the whole app wiring. One screen, no router.
 */
(function () {
  var T = window.I18N.ru;
  var tg = window.Telegram && window.Telegram.WebApp;
  var session = null;
  var revealed = false;
  var flushing = false;

  function el(id) { return document.getElementById(id); }

  function setBanner(text, kind) {
    var b = el('banner');
    if (!text) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = text;
    b.className = 'banner banner-' + (kind || 'info');
  }

  function pendingCount() { return window.Store.getBuffer().length; }

  function refreshPending() {
    var n = pendingCount();
    el('pending').textContent = n ? T.pendingBanner(n) : '';
  }

  function show(screen) {
    ['screen-loading', 'screen-card', 'screen-empty', 'screen-done', 'screen-error']
      .forEach(function (id) { el(id).hidden = id !== screen; });
  }

  function renderCounters() {
    el('counter').textContent =
      T.counterDue + ' ' + (session.counts.due || 0) + ' · ' +
      T.counterNew + ' ' + (session.counts.new_in_session || 0) + ' · ' +
      'осталось ' + session.remaining();
  }

  function renderCard() {
    var card = session.current;
    if (!card) { finish(); return; }

    revealed = false;
    var isProd = card.direction === 'prod';

    el('direction').textContent = isProd ? T.directionProd : T.directionRecog;
    el('type').textContent = card.type;
    el('layer').textContent = card.layer || '';

    el('prompt').textContent = isProd ? card.ru : card.en;
    el('answer').textContent = isProd ? card.en : card.ru;
    el('example').textContent = card.example_en || '';
    el('example-ru').textContent = card.example_ru || '';

    el('typebox').hidden = !isProd;
    el('typebox').value = '';
    el('typehint').hidden = !isProd;

    el('answer-block').hidden = true;
    el('reveal').hidden = false;
    el('ratings').hidden = true;

    renderCounters();
    show('screen-card');
  }

  function reveal() {
    revealed = true;
    el('answer-block').hidden = false;
    el('reveal').hidden = true;
    el('ratings').hidden = false;
  }

  function rate(rating) {
    if (!revealed) return;
    var entry = session.rate(rating);
    if (entry) {
      window.Store.pushAnswer(entry);
      refreshPending();
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
    if (session.remaining() === 0) { finish(); return; }
    session.next();
    renderCard();
  }

  function finish() {
    el('done-body').textContent = T.doneBody(session ? session.answered : 0);
    show('screen-done');
    flush();
  }

  function flush(force) {
    var buffer = window.Store.getBuffer();
    if (!buffer.length || flushing) return Promise.resolve();
    if (!navigator.onLine && !force) { setBanner(T.offlineBanner, 'warn'); return Promise.resolve(); }

    flushing = true;
    el('flush-status').textContent = T.sending;
    var batchId = window.Store.getBatchId();

    return window.Api.flush(batchId, buffer).then(function (res) {
      flushing = false;
      if (res && res.ok) {
        window.Store.clearBuffer();
        refreshPending();
        el('flush-status').textContent = T.sent +
          (res.skipped_duplicate ? ' (уже было принято)' : '');
        if (res.leeches_new && res.leeches_new.length) {
          setBanner('Ушло в пиявки: ' + res.leeches_new.length +
            ' — переформулируй их в следующем батче', 'warn');
        }
      } else {
        el('flush-status').textContent = errorText(res && res.code);
      }
    }).catch(function () {
      flushing = false;
      el('flush-status').textContent = T.sendFailed;
    });
  }

  function errorText(code) {
    switch (code) {
      case 'BAD_INIT_DATA': return T.errAuth;
      case 'STALE_INIT_DATA': return T.errStale;
      case 'NOT_ALLOWED': return T.errNotAllowed;
      case 'LOCKED': return T.errLocked;
      default: return T.errGeneric;
    }
  }

  function start() {
    show('screen-loading');
    refreshPending();

    // Send anything left over from a previous launch before asking for new work.
    flush().then(function () {
      return window.Api.getSession();
    }).then(function (payload) {
      if (!payload || !payload.ok) {
        el('error-body').textContent = errorText(payload && payload.code);
        show('screen-error');
        return;
      }
      window.Store.setQueue(payload);
      launch(payload);
    }).catch(function () {
      // No network: fall back to whatever queue was cached last time.
      var cached = window.Store.getQueue();
      if (cached) {
        setBanner(T.offlineBanner, 'warn');
        launch(cached);
      } else {
        el('error-body').textContent = T.errGeneric;
        show('screen-error');
      }
    });
  }

  function launch(payload) {
    session = new window.Session(payload);

    if (session.warnings.indexOf('trigger_stale') >= 0) setBanner(T.triggerStale, 'warn');
    else if (session.warnings.indexOf('trigger_never_ran') >= 0) setBanner(T.triggerNever, 'warn');

    if (!session.queue.length) { show('screen-empty'); return; }
    session.next();
    renderCard();
  }

  function bind() {
    el('reveal').addEventListener('click', reveal);
    el('ratings').addEventListener('click', function (e) {
      var r = e.target.getAttribute('data-rating');
      if (r) rate(parseInt(r, 10));
    });
    el('retry').addEventListener('click', start);
    el('again-session').addEventListener('click', start);

    document.addEventListener('keydown', function (e) {
      if (el('screen-card').hidden) return;
      if (e.target === el('typebox') && e.key !== 'Enter') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return; }
      if (revealed && e.key >= '1' && e.key <= '4') { e.preventDefault(); rate(parseInt(e.key, 10)); }
    });

    window.addEventListener('online', function () { setBanner(''); flush(true); });
    window.addEventListener('offline', function () { setBanner(T.offlineBanner, 'warn'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  function applyTheme() {
    if (!tg) return;
    tg.ready();
    tg.expand();
    var p = tg.themeParams || {};
    var root = document.documentElement.style;
    if (p.bg_color) root.setProperty('--bg', p.bg_color);
    if (p.text_color) root.setProperty('--fg', p.text_color);
    if (p.hint_color) root.setProperty('--muted', p.hint_color);
    if (p.button_color) root.setProperty('--accent', p.button_color);
    if (p.secondary_bg_color) root.setProperty('--surface', p.secondary_bg_color);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme();
    bind();
    start();
  });
})();
