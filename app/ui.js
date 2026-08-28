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

  /** Показывает не только текст, но и код: без кода причину приходится угадывать. */
  function showError(code) {
    el('error-body').textContent = errorText(code);
    el('error-code').textContent = code ? T.codeLabel + ': ' + code : '';
    el('diag').hidden = false;
    show('screen-error');
  }

  function runDiag() {
    var url = (window.ENGBOT_CONFIG.WEB_APP_URL) + '?action=diag&initData=' +
      encodeURIComponent((window.Telegram && window.Telegram.WebApp &&
        window.Telegram.WebApp.initData) || '');
    var tg = window.Telegram && window.Telegram.WebApp;
    var client = {
      sdk_loaded: !!tg,
      platform: tg ? tg.platform : null,
      version: tg ? tg.version : null,
      init_data_length: tg && tg.initData ? tg.initData.length : 0,
      init_data_unsafe_user_id: tg && tg.initDataUnsafe && tg.initDataUnsafe.user
        ? String(tg.initDataUnsafe.user.id) : null,
      backend_url_set: !!(window.ENGBOT_CONFIG &&
        window.ENGBOT_CONFIG.WEB_APP_URL &&
        window.ENGBOT_CONFIG.WEB_APP_URL.indexOf('PASTE_') !== 0),
      app_version: window.ENGBOT_CONFIG ? window.ENGBOT_CONFIG.VERSION : null
    };
    el('diag-out').hidden = false;
    el('diag-out').textContent = 'КЛИЕНТ:\n' + JSON.stringify(client, null, 2) +
      '\n\nСЕРВЕР: запрашиваю…';
    fetch(url, { method: 'GET', redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        el('diag-out').textContent = el('diag-out').textContent
          .replace('СЕРВЕР: запрашиваю…', 'СЕРВЕР:\n' + JSON.stringify(d, null, 2));
      })
      .catch(function (e) {
        el('diag-out').textContent = el('diag-out').textContent
          .replace('СЕРВЕР: запрашиваю…', 'СЕРВЕР: не отвечает — ' + e.message);
      });
  }

  function errorText(code) {
    switch (code) {
      case 'BAD_INIT_DATA': return T.errAuth;
      case 'STALE_INIT_DATA': return T.errStale;
      case 'NOT_ALLOWED': return T.errNotAllowed;
      case 'LOCKED': return T.errLocked;
      case 'NO_SDK': return T.errNoSdk;
      case 'NO_INIT_DATA': return T.errNoInitData;
      case 'NO_BACKEND_URL': return 'В app/config.js не подставлен адрес backend';
      default: return T.errGeneric;
    }
  }

  /**
   * Разделяет три разных сбоя, которые раньше показывались одним сообщением:
   * SDK не загрузился, SDK есть но initData пустая, и отказ сервера.
   * Без этого различия причину приходится угадывать — что и произошло.
   */
  function preflight() {
    if (!window.Telegram || !window.Telegram.WebApp) return 'NO_SDK';
    if (!window.Telegram.WebApp.initData) return 'NO_INIT_DATA';
    if (!window.ENGBOT_CONFIG || !window.ENGBOT_CONFIG.WEB_APP_URL ||
        window.ENGBOT_CONFIG.WEB_APP_URL.indexOf('PASTE_') === 0) return 'NO_BACKEND_URL';
    return null;
  }

  function start() {
    show('screen-loading');
    refreshPending();

    var blocker = preflight();
    if (blocker) { showError(blocker); return; }

    // Send anything left over from a previous launch before asking for new work.
    flush().then(function () {
      return window.Api.getSession();
    }).then(function (payload) {
      if (!payload || !payload.ok) {
        showError(payload && payload.code);
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
        showError(null);
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
    el('diag').addEventListener('click', runDiag);
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
