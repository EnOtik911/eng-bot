/**
 * Rendering and the whole app wiring. One screen, no router.
 */
(function () {
  var T = window.I18N.ru;
  var tg = window.Telegram && window.Telegram.WebApp;
  var session = null;
  var revealed = false;
  var flushing = false;
  var gflushing = false;
  var state = { vocab: null, grammar: null, grammarError: null };
  var currentScreen = 'screen-loading';

  function el(id) { return document.getElementById(id); }

  function setBanner(text, kind) {
    var b = el('banner');
    if (!text) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = text;
    b.className = 'banner banner-' + (kind || 'info');
  }

  function pendingCount() { return window.Store.getBuffer().length; }

  /**
   * Снимок позиции после каждой карточки. Ответы и без него не терялись — они уходят
   * в буфер сразу после оценки — но очередь жила только в памяти, поэтому возврат
   * после перерыва всегда начинался с главного экрана и с нулевого прогресса.
   * У практики позиции нет: она бесконечная и продолжать в ней нечего.
   */
  function saveProgress() {
    if (!session || session.practice) return;
    var day = (state.vocab && state.vocab.today) || '';
    window.Store.setProgress(session.snapshot(day));
  }

  /** Снимок сегодняшнего дня, если он есть. Вчерашний не годится: очередь уже другая. */
  function savedProgress() {
    var p = window.Store.getProgress();
    if (!p || !p.cards || !p.cards.length) return null;
    var today = state.vocab && state.vocab.today;
    if (today && p.day && p.day !== today) { window.Store.clearProgress(); return null; }
    return p;
  }

  function refreshPending() {
    var n = pendingCount() + window.Store.getGrammarBuffer().length;
    el('pending').textContent = n ? T.pendingBanner(n) : '';
  }

  var SCREENS = ['screen-loading', 'screen-home', 'screen-picker', 'screen-card',
    'screen-grammar', 'screen-round', 'screen-gdone', 'screen-empty', 'screen-done',
    'screen-stats',
    'screen-error'];

  var CHROME_FREE = ['screen-home', 'screen-picker', 'screen-loading', 'screen-error'];

  /**
   * Нативная кнопка «назад» Telegram. Она живёт в чроме приложения, поэтому её не
   * закрывает клавиатура и не надо угадывать её размер — в отличие от шеврона в
   * нашей панели, который до этого был единственным способом уйти назад.
   */
  function syncBackButton(screen) {
    if (!tg || !tg.BackButton) return;
    if (CHROME_FREE.indexOf(screen) >= 0 && screen !== 'screen-picker') {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }
  }

  function show(screen) {
    currentScreen = screen;
    SCREENS.forEach(function (id) { el(id).hidden = id !== screen; });
    syncBackButton(screen);
    // Кнопка «назад» и полоса прогресса имеют смысл только внутри сессии.
    el('home-btn').hidden = CHROME_FREE.indexOf(screen) >= 0;
    if (CHROME_FREE.indexOf(screen) >= 0) {
      el('counter').textContent = '';
      el('progress').style.width = '0%';
    }
  }

  /**
   * Прогресс считается от того, сколько работы было в начале сессии, а не от
   * текущей длины очереди: «не помню» возвращает карточку, и полоса не должна
   * ехать назад — иначе она врёт про пройденное.
   */
  function renderProgress() {
    var total = session.plannedTotal || 1;
    var done = Math.min(session.answered, total);
    el('progress').style.width = Math.round(done / total * 100) + '%';
  }

  /**
   * «Осталось 18» не отвечает на вопрос, который человек задаёт на улице: сколько
   * это ещё по времени и далеко ли конец. Позиция и минуты отвечают.
   */
  function renderCounters() {
    var total = session.plannedTotal || session.remaining();
    var pos = Math.min(session.answered + 1, total);
    el('counter').textContent =
      T.sessionPos(pos, total) + ' · ' + T.minutesLeft(minutesFor(session.remaining()));
  }

  /** Время по замеренной модели нагрузки, а не по ощущению: 8 секунд на карточку. */
  function minutesFor(cards) {
    return Math.max(1, Math.round(cards * T.SEC_PER_CARD / 60));
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

    el('typefield').hidden = !isProd;
    el('typebox').value = '';
    el('typehint').hidden = !isProd;

    renderGloss(card);

    el('answer-block').hidden = true;
    el('reveal').hidden = false;
    el('ratings').hidden = true;

    renderCounters();
    renderProgress();
    saveProgress();
    show('screen-card');
  }

  /**
   * Пословный разбор и объяснение «почему так говорится».
   *
   * Открыт только у новых карточек. На повторении он свёрнут: смысл повторения в
   * извлечении из памяти, а готовый разбор перед глазами это извлечение подменяет.
   * Ровно поэтому же он живёт внутри answer-block и появляется после «Показать».
   */
  function renderGloss(card) {
    var box = el('gloss');
    var words = String(card.breakdown || '').trim();
    var why = String(card.note || '').trim();
    if (!words && !why) { box.hidden = true; return; }

    box.hidden = false;
    el('gloss-words').textContent = words;
    el('gloss-words').hidden = !words;
    el('gloss-note').textContent = why;
    el('gloss-note').hidden = !why;
    box.open = String(card.state) === 'new';
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
      // В практике оценка живёт ровно до следующей карточки: она переставляет
      // «не помню» назад в очередь и на этом кончается. В буфер она НЕ попадает,
      // иначе свободный прогон уехал бы на сервер как настоящее повторение и
      // сдвинул расписание — то самое, ради чего этот режим отделён от сессии.
      if (!session.practice) {
        window.Store.pushAnswer(entry);
        refreshPending();
      }
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
    if (session.remaining() === 0) { finish(); return; }
    advance();
  }

  /**
   * Смена карточки. Где есть View Transitions — отдаём анимацию браузеру: она идёт
   * на GPU и стоит дешевле любой библиотеки. Где нет — короткий уход по CSS-классу.
   * Обе ветки заканчиваются одинаково, поэтому логика не зависит от поддержки.
   */
  function advance() {
    var swap = function () { session.next(); renderCard(); };
    if (document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(swap);
      return;
    }
    var card = el('card');
    card.classList.add('card-leaving');
    setTimeout(function () { card.classList.remove('card-leaving'); swap(); }, 180);
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function finish() {
    el('progress').style.width = '100%';
    var practice = session && session.practice;
    el('done-body').textContent = practice
      ? T.practiceDoneBody(session.answered)
      : T.doneBody(session ? session.answered : 0);
    el('done-title').textContent = practice ? T.practiceDoneTitle : T.doneTitle;
    renderWhatsNext(practice);
    // Пройденная сессия больше не «незакрытая»: снимок надо убрать, иначе на главном
    // экране навсегда повиснет «продолжить» с пустой очередью.
    window.Store.clearProgress();
    show('screen-done');
    if (!practice) flush();
  }

  /**
   * «Что меня ждёт дальше» — вопрос, который экран итогов раньше не закрывал:
   * он сообщал, сколько сделано, и молчал про завтра.
   */
  function renderWhatsNext(practice) {
    var box = el('done-next');
    if (practice || !state.vocab) { box.textContent = ''; return; }
    var c = state.vocab.counts || {};
    var left = (c.due || 0) + (c.new_in_session || 0) - (session ? session.answered : 0);
    var lines = [];
    lines.push(left > 0 ? T.doneLeftToday(left) : T.doneAllClear);
    lines.push(c.next_due ? T.doneNext(c.next_due) : T.doneNothingAhead);
    box.textContent = lines.join('\n');
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

  /** Отказ авторизации бьёт по обоим блокам, поэтому это экран ошибки, а не деградация. */
  function isFatal(code) {
    return code === 'BAD_INIT_DATA' || code === 'STALE_INIT_DATA' || code === 'NOT_ALLOWED';
  }

  function flushGrammar(force) {
    var buffer = window.Store.getGrammarBuffer();
    if (!buffer.length || gflushing) return Promise.resolve(null);
    if (!navigator.onLine && !force) { setBanner(T.offlineBanner, 'warn'); return Promise.resolve(null); }

    gflushing = true;
    var batchId = window.Store.getGrammarBatchId();
    return window.Api.flushGrammar(batchId, buffer).then(function (res) {
      gflushing = false;
      if (res && res.ok) {
        window.Store.clearGrammarBuffer();
        refreshPending();
        return res;
      }
      return res;
    }).catch(function () { gflushing = false; return null; });
  }

  /**
   * Два запроса вместо одного и намеренно параллельно: это два независимых
   * выполнения на стороне Apps Script, поэтому по времени они стоят почти как
   * один — а главный экран без обоих счётчиков врал бы про то, где долги.
   */
  function start() {
    show('screen-loading');
    refreshPending();

    var blocker = preflight();
    if (blocker) { showError(blocker); return; }

    Promise.all([flush(), flushGrammar()]).then(function () {
      return Promise.all([
        window.Api.getSession().catch(function () { return null; }),
        window.Api.getGrammar().catch(function () { return null; })
      ]);
    }).then(function (res) {
      var v = res[0];
      var g = res[1];

      if (v && !v.ok && isFatal(v.code)) { showError(v.code); return; }
      if (g && !g.ok && isFatal(g.code)) { showError(g.code); return; }

      if (v && v.ok) { window.Store.setQueue(v); state.vocab = v; }
      else { state.vocab = window.Store.getQueue(); if (!v) setBanner(T.offlineBanner, 'warn'); }

      if (g && g.ok) { window.Store.setGrammarQueue(g); state.grammar = g; state.grammarError = null; }
      else { state.grammar = window.Store.getGrammarQueue(); state.grammarError = (g && g.code) || 'UNAVAILABLE'; }

      if (!state.vocab && !state.grammar) { showError(v && v.code); return; }
      renderHome();
    });
  }

  /**
   * Одна строка, которая отвечает «много или мало». Долг сравнивается с дневной
   * нормой, а не с нулём: два просроченных при норме десять — это не долг, это
   * вчерашний хвост, и пугать им незачем.
   */
  function renderPulse(v) {
    if (!v || !v.counts) { el('pulse').hidden = true; return; }
    el('pulse').hidden = false;
    var c = v.counts;
    var due = c.due || 0;
    var fresh = c.new_in_session || 0;
    var target = (v.settings && v.settings.daily_new_target) || 10;

    var status;
    if (!due && !fresh) status = T.paceFree;
    else if (!c.total || c.total === fresh) status = T.paceFirst;
    else if (due > target * 2) status = T.paceDebt;
    else status = T.paceOnTrack;

    el('pulse-status').textContent = status;
    el('pulse-status').className = 'pulse-status' +
      (status === T.paceDebt ? ' is-debt' : status === T.paceFree ? ' is-free' : '');
    el('pulse-line').textContent = T.paceLine(due, fresh, minutesFor(due + fresh));
  }

  function renderHome() {
    setBanner('');
    var v = state.vocab;
    var g = state.grammar;

    var vDue = v ? (v.counts.due || 0) : 0;
    var vNew = v ? (v.counts.new_in_session || 0) : 0;
    el('tile-vocab-count').textContent = v
      ? T.homeDue(vDue) + T.homeNew(vNew) : '—';
    el('tile-vocab').disabled = !v;

    var gDue = g && g.counts ? (g.counts.due || 0) : 0;
    var gNew = g && g.counts ? (g.counts.new_in_session || 0) : 0;
    el('tile-grammar-count').textContent = g
      ? T.homeDue(gDue) + T.homeNew(gNew) : '—';
    el('tile-grammar').disabled = !g || !(g.patterns && g.patterns.length);

    renderPulse(v);

    var saved = savedProgress();
    var left = saved ? saved.cards.length : 0;
    el('resume-vocab').hidden = !saved;
    if (saved) el('resume-vocab').textContent = T.resumeVocab(left);
    if (saved) el('tile-vocab-count').textContent = T.resumeTile(left);

    var note = '';
    if (!g || !(g.patterns && g.patterns.length)) note = T.grammarUnavailable;
    el('home-note').hidden = !note;
    el('home-note').textContent = note;

    // Индекс задаёт задержку появления, лестница считается в CSS.
    ['tile-vocab', 'tile-grammar'].forEach(function (id, i) {
      el(id).style.setProperty('--i', i);
    });

    if (v && v.warnings) {
      if (v.warnings.indexOf('trigger_stale') >= 0) setBanner(T.triggerStale, 'warn');
      else if (v.warnings.indexOf('trigger_never_ran') >= 0) setBanner(T.triggerNever, 'warn');
    }

    show('screen-home');
  }

  /** Один смысл «назад» на всё приложение: из любого экрана — на главный. */
  function goBack() {
    if (currentScreen === 'screen-stats') { renderHome(); return; }
    if (currentScreen === 'screen-grammar' || currentScreen === 'screen-round' ||
        currentScreen === 'screen-gdone') {
      // Из упражнения — сначала к выбору шаблона, оттуда домой.
      if (window.GrammarUI && window.GrammarUI.backToPicker()) return;
    }
    renderHome();
  }

  /**
   * Клавиатура на телефоне закрывает кнопку действия, а закрыть её самому нечем:
   * тап «мимо поля» работает не везде, а Enter не все ищут. Поэтому пока поле в
   * фокусе — рядом стоит «Готово», а строка действий прилипает к низу карточки.
   */
  function bindKeyboard(input, doneBtn, field) {
    if (!input || !doneBtn) return;
    var actions = field ? field.closest('.card') : null;
    var row = actions ? actions.querySelector('.g-actions') : null;

    input.addEventListener('focus', function () {
      doneBtn.hidden = false;
      if (row) row.classList.add('keyboard-open');
    });
    input.addEventListener('blur', function () {
      doneBtn.hidden = true;
      if (row) row.classList.remove('keyboard-open');
    });
    doneBtn.addEventListener('click', function () { input.blur(); });
  }

  function startVocab() {
    // Плитка и кнопка «продолжить» ведут в одно и то же место намеренно: тап по
    // привычке не должен стоить позиции в незакрытой сессии.
    var saved = savedProgress();
    if (saved) { launch(saved); return; }
    var payload = state.vocab;
    if (!payload) { showError(null); return; }
    launch(payload);
  }

  /**
   * Свободная практика. Отдельный запрос, а не кусок обычной сессии: карточек
   * пройденного могут быть сотни, и таскать их в каждой сессии ради режима, который
   * открывают изредка, значит платить за него каждый день.
   */
  function startPractice() {
    show('screen-loading');
    window.Api.getPractice().then(function (res) {
      if (!res || !res.ok) { showError(res && res.code); return; }
      if (!res.cards.length) { el('empty-body').textContent = T.practiceEmpty; show('screen-empty'); return; }
      res.practice = true;
      launch(res);
    }).catch(function () { showError(null); });
  }

  function launch(payload) {
    session = new window.Session(payload);

    if (session.warnings.indexOf('trigger_stale') >= 0) setBanner(T.triggerStale, 'warn');
    else if (session.warnings.indexOf('trigger_never_ran') >= 0) setBanner(T.triggerNever, 'warn');

    if (!session.queue.length) {
      el('empty-body').textContent = T.emptyBody;
      show('screen-empty');
      return;
    }
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
    el('home-btn').addEventListener('click', goBack);

    if (tg && tg.BackButton && tg.BackButton.onClick) tg.BackButton.onClick(goBack);

    bindKeyboard(el('typebox'), el('typebox-done'), el('typefield'));
    el('tile-vocab').addEventListener('click', startVocab);
    el('resume-vocab').addEventListener('click', startVocab);
    el('pause-session').addEventListener('click', function () {
      saveProgress();
      flush();
      setBanner(T.paused, 'info');
      renderHome();
    });
    el('tile-stats').addEventListener('click', function () {
      if (window.Stats) window.Stats.open();
    });
    el('practice-empty').addEventListener('click', startPractice);
    el('practice-done').addEventListener('click', startPractice);
    el('tile-grammar').addEventListener('click', function () {
      if (window.GrammarUI) window.GrammarUI.open(state.grammar);
    });

    document.addEventListener('keydown', function (e) {
      if (el('screen-card').hidden) return;
      if (e.target === el('typebox') && e.key !== 'Enter') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return; }
      if (revealed && e.key >= '1' && e.key <= '4') { e.preventDefault(); rate(parseInt(e.key, 10)); }
    });

    window.addEventListener('online', function () {
      setBanner(''); flush(true); flushGrammar(true);
    });
    window.addEventListener('offline', function () { setBanner(T.offlineBanner, 'warn'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flush(); flushGrammar(); }
    });
  }

  /**
   * Палитра приложения НЕ берётся из themeParams Telegram, и это решение, а не пропуск.
   *
   * Раньше здесь переписывались пять переменных, из которых в styles.css существовали
   * две. Одна из них — `--fg`. У пользователя тёмная тема Telegram, значит `text_color`
   * приходил белым, `--fg` становился белым, а фон оставался светлым: белый текст на
   * белом стекле. Всё, что использовало `--fg-dim` и `--fg-faint`, при этом читалось
   * прекрасно — потому что имена тех переменных Telegram не знал.
   *
   * Взять половину цветов из чужой темы, а половину оставить своими — это и есть
   * гарантированный способ получить такое. Либо адаптироваться целиком, либо не
   * адаптироваться вовсе. Выбрано второе: контраст здесь проверен тестом именно для
   * этой палитры, а темы Telegram задаёт пользователь и гарантировать на них 4.5:1
   * невозможно.
   */
  function applyTheme() {
    if (!tg) return;
    tg.ready();
    tg.expand();
  }

  /**
   * Общая часть, которой пользуется grammar-ui.js. Экран грамматики живёт в своём
   * файле, но хром — баннер, прогресс, переключение экранов — один на приложение.
   */
  window.App = {
    el: el,
    bindKeyboard: bindKeyboard,
    syncBackButton: syncBackButton,
    show: show,
    setBanner: setBanner,
    T: T,
    tg: tg,
    errorText: errorText,
    showError: showError,
    goHome: renderHome,
    refreshPending: refreshPending,
    flushGrammar: flushGrammar,
    prefersReducedMotion: prefersReducedMotion,
    progress: function (done, total) {
      el('progress').style.width = Math.round(done / (total || 1) * 100) + '%';
    },
    counter: function (text) { el('counter').textContent = text; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme();
    bind();
    start();
  });
})();
