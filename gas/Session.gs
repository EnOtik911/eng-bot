/**
 * Builds the session queue and applies a flushed batch.
 * One GET per session, one POST per session — see docs/deploy.md for why.
 */

/**
 * Дата из таблицы в вид 'YYYY-MM-DD'.
 *
 * getValues() возвращает СЫРЫЕ значения ячеек, а Google Sheets молча превращает
 * записанную строку '2026-08-28' в дату. Обратно она приходит объектом Date, и
 * String(date).slice(0, 10) даёт 'Sun Aug 28' — строку, которая не равна ни одной
 * дате и при этом БОЛЬШЕ любой '2026-..' при лексикографическом сравнении.
 *
 * Поэтому условие `due <= today` было вечно ложным: карточка, у которой наступил
 * срок, не возвращалась НИКОГДА. По той же причине дневная норма считала, что
 * сегодня не введено ничего, и выдавала полную порцию новых на каждый запуск, а
 * daysBetween_ отдавал NaN — прямо в планировщик, вместе со стабильностью.
 *
 * Юнит-тесты этого не видели четыре месяца, потому что подставляли даты СТРОКАМИ —
 * форму, которой в живой таблице нет.
 */
function dateKey_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, tz || 'Europe/Moscow', 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function todayStr_(tz) {
  return Utilities.formatDate(new Date(), tz || 'Europe/Moscow', 'yyyy-MM-dd');
}

function daysBetween_(from, to) {
  var a = Date.parse(dateKey_(from) + 'T00:00:00Z');
  var b = Date.parse(dateKey_(to) + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(Math.round((b - a) / 86400000), 0);
}

/** Ближайший срок среди зрелых карточек. Пустая строка = впереди ничего нет. */
function nextDue_(cards, today, tz) {
  var dates = [];
  cards.forEach(function (c) {
    var st = String(c.state || '');
    if (st === 'leech' || st === 'suspended' || st === 'locked' || st === 'new') return;
    var k = dateKey_(c.due, tz);
    if (k && k > today) dates.push(k);
  });
  dates.sort();
  return dates.length ? dates[0] : '';
}

function buildSession(userId) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var cap = parseInt(settings.session_size_cap, 10) || 120;
  var newTarget = parseInt(settings.daily_new_target, 10) || 6;
  var leechThreshold = parseInt(settings.leech_threshold, 10) || 5;

  var all = readCards_();
  var mine = all.filter(function (c) { return String(c.user_id) === String(userId); });

  var due = [];
  var fresh = [];
  var leeches = 0;
  var locked = 0;
  var introducedToday = 0;

  mine.forEach(function (c) {
    // Сколько новых уже введено сегодня. Считается по строке карточки, а не по
    // журналу: планировщик журнал не читает, это условие из ADR-02.
    if (c.first_review && dateKey_(c.first_review, tz) === today) introducedToday++;
  });

  mine.forEach(function (c) {
    var state = String(c.state || '');
    if (state === 'leech') { leeches++; return; }
    if (state === 'suspended') return;
    if (state === 'locked') { locked++; return; }
    if (state === 'new') { fresh.push(c); return; }
    var dueStr = dateKey_(c.due, tz);
    if (dueStr && dueStr <= today) due.push(c);
  });

  // Layer order decides which new cards come first; within a layer, import order.
  var layerRank = {};
  VALID_LAYERS.forEach(function (l, i) { layerRank[l] = i; });
  fresh.sort(function (a, b) {
    var la = layerRank[a.layer] === undefined ? 99 : layerRank[a.layer];
    var lb = layerRank[b.layer] === undefined ? 99 : layerRank[b.layer];
    if (la !== lb) return la - lb;
    return String(a.created_at) < String(b.created_at) ? -1 : 1;
  });

  // The daily allowance is per DAY, not per app launch. Serving `newTarget` on every
  // launch is what produced fifteen new cards in one sitting during the first real
  // session, against a target of six — and fifteen cards due the next morning.
  var newAllowance = Math.max(newTarget - introducedToday, 0);

  // Due cards always come before new ones: debt first, growth second.
  var queue = due.concat(fresh.slice(0, newAllowance)).slice(0, cap);

  var warnings = [];
  if (settings.last_trigger_run) {
    var ageHours = (Date.now() - new Date(settings.last_trigger_run).getTime()) / 3600000;
    if (ageHours > 36) warnings.push('trigger_stale');
  } else {
    warnings.push('trigger_never_ran');
  }

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    settings: {
      daily_new_target: newTarget,
      desired_retention: parseFloat(settings.desired_retention) || 0.85,
      session_size_cap: cap,
      leech_threshold: leechThreshold,
      ui_lang: settings.ui_lang || 'ru'
    },
    cards: queue.map(cardPayload_),
    counts: {
      due: due.length,
      new_available: fresh.length,
      new_in_session: Math.min(fresh.length, newAllowance),
      new_introduced_today: introducedToday,
      new_allowance_left: newAllowance,
      total: mine.length,
      leeches: leeches,
      locked: locked,
      // Ближайшая дата, когда снова появится работа. Без неё экран итогов может
      // сказать «на сегодня всё», но не может сказать, что будет завтра — а
      // именно этого владелец и не понимал, закрывая сессию.
      next_due: nextDue_(mine, today, tz)
    },
    warnings: warnings
  };
}

/**
 * Форма карточки, которую видит клиент. Одна на все режимы: свободная практика
 * рендерится тем же кодом, что и сессия, и разойтись эти две формы не должны.
 */
function cardPayload_(c) {
  return {
    card_id: c.card_id,
    direction: c.direction,
    type: c.type,
    en: c.en,
    ru: c.ru,
    example_en: c.example_en,
    example_ru: c.example_ru,
    layer: c.layer,
    state: c.state
  };
}

/** Fisher-Yates. Порядок расписания в практике не нужен и вреден: он предсказуем. */
function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/**
 * Свободная практика: гонять уже пройденное сколько угодно, НЕ трогая расписание.
 *
 * Почему у этого режима нет и не должно быть flush: FSRS считает интервал от момента
 * фактического повторения. Лишний прогон раньше срока, записанный как настоящий,
 * занижает интервал — алгоритм решает, что материал знают хуже, чем знают, и
 * завтрашняя нагрузка растёт на ровном месте. Поэтому сервер здесь только ОТДАЁТ
 * карточки и не принимает по ним ничего обратно; ответов в этом режиме не существует
 * ни в буфере клиента, ни в журнале.
 *
 * Берутся только те карточки, которые пользователь уже видел. new/locked/suspended
 * он по определению не видел, и подсунуть их здесь значило бы ввести новое слово в
 * обход дневной нормы — ровно то, от чего норма и защищает.
 */
function buildPractice(userId, limit) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var cap = parseInt(limit, 10) || parseInt(settings.practice_size_cap, 10) || 60;

  var mine = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var seen = mine.filter(function (c) {
    var st = String(c.state || '');
    return st !== 'new' && st !== 'locked' && st !== 'suspended';
  });

  shuffle_(seen);

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: todayStr_(tz),
    settings: { ui_lang: settings.ui_lang || 'ru' },
    cards: seen.slice(0, cap).map(cardPayload_),
    counts: {
      available: seen.length,
      in_session: Math.min(seen.length, cap)
    },
    warnings: []
  };
}

/**
 * reviews: [{ card_id, rating, ts }] in the order they happened.
 * Ratings for the same card in one batch are applied in sequence, which is exactly
 * how a card answered Again and then Good later in the session should behave.
 */
function applyFlush(userId, batchId, reviews) {
  if (!batchId) return { ok: false, code: 'BAD_REQUEST', message: 'batch_id is required' };
  if (!reviews || !reviews.length) return { ok: true, applied: 0, skipped_duplicate: false };

  if (flushSeen_(batchId)) {
    return { ok: true, applied: 0, skipped_duplicate: true };
  }

  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var retention = parseFloat(settings.desired_retention) || 0.85;
  var leechThreshold = parseInt(settings.leech_threshold, 10) || 5;
  var unlockAt = parseInt(settings.unlock_interval_days, 10) || 21;

  var all = readCards_();
  var byId = {};
  all.forEach(function (c) { byId[String(c.card_id)] = c; });

  var updates = {};
  var logRows = [];
  var newLeeches = [];
  var unlocked = [];
  var applied = 0;

  reviews.forEach(function (r) {
    var card = byId[String(r.card_id)];
    if (!card) return;
    if (String(card.user_id) !== String(userId)) return;

    var rating = parseInt(r.rating, 10);
    if (!(rating >= 1 && rating <= 4)) return;

    var elapsed = card.last_review ? daysBetween_(card.last_review, today) : 0;
    var out = fsrsReview({
      stability: card.stability === '' ? null : Number(card.stability),
      difficulty: card.difficulty === '' ? null : Number(card.difficulty),
      reps: Number(card.reps) || 0,
      lapses: Number(card.lapses) || 0
    }, rating, elapsed, { desiredRetention: retention });

    var isLeech = out.lapses >= leechThreshold;
    var dueDate = new Date(new Date(today + 'T00:00:00Z').getTime() + out.intervalDays * 86400000);
    var dueStr = Utilities.formatDate(dueDate, 'UTC', 'yyyy-MM-dd');

    card.stability = out.stability;
    card.difficulty = out.difficulty;
    card.reps = out.reps;
    card.lapses = out.lapses;
    card.last_review = today;
    card.state = isLeech ? 'leech' : 'review';
    card.due = isLeech ? '' : dueStr;

    var patch = {
      state: card.state, due: card.due, stability: out.stability,
      difficulty: out.difficulty, reps: out.reps, lapses: out.lapses,
      last_review: today
    };
    // Дата первого в жизни показа. Ставится один раз и больше не меняется —
    // по ней считается дневная норма новых.
    if (!card.first_review) { patch.first_review = today; card.first_review = today; }

    updates[card.card_id] = { _row: card._row, patch: patch };

    if (isLeech && newLeeches.indexOf(card.card_id) < 0) newLeeches.push(card.card_id);

    logRows.push([card.card_id, r.ts || new Date().toISOString(), rating, elapsed,
      out.intervalDays, out.stability, out.difficulty, batchId]);
    applied++;

    // Unlock the production sibling once recognition matured.
    if (card.direction === 'recog' && !isLeech && out.intervalDays >= unlockAt) {
      all.forEach(function (sib) {
        if (String(sib.item_id) !== String(card.item_id)) return;
        if (sib.direction !== 'prod' || String(sib.state) !== 'locked') return;
        updates[sib.card_id] = {
          _row: sib._row,
          patch: { state: 'new', due: '' }
        };
        sib.state = 'new';
        unlocked.push(sib.card_id);
      });
    }
  });

  var updateList = Object.keys(updates).map(function (k) { return updates[k]; });
  writeCardUpdates_(updateList);
  appendReviewLog_(logRows);
  flushRecord_(batchId, applied);

  return {
    ok: true,
    applied: applied,
    skipped_duplicate: false,
    leeches_new: newLeeches,
    unlocked: unlocked
  };
}
