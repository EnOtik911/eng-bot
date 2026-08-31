/**
 * Аналитика: по блокам и по общей динамике.
 *
 * Считается на СЕРВЕРЕ, а не на клиенте, и это то же решение, что лежит в основе
 * всей архитектуры: журнал повторений растёт линейно со временем и уже сейчас
 * измеряется сотнями строк, а телефон получает два запроса на сессию. Отдавать
 * ему сырой журнал ради подсчёта среднего — тот же per-answer round trip, только
 * в профиль.
 *
 * Ачивки живут отдельно (Achievements.gs) и считаются ЧИСТОЙ функцией от того,
 * что вернёт этот файл: тогда их можно проверять без единого обращения к таблице.
 */

var STATS_WINDOW_DAYS = 30;

function dayKey_(ts, tz) {
  if (!ts) return '';
  var d = ts instanceof Date ? ts : new Date(String(ts));
  if (isNaN(d.getTime())) return String(ts).slice(0, 10);
  return Utilities.formatDate(d, tz || 'Europe/Moscow', 'yyyy-MM-dd');
}

/** Список последних N дат включительно по сегодня — ось графиков. */
function lastDays_(today, n) {
  var out = [];
  var base = Date.parse(today + 'T00:00:00Z');
  for (var i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function readReviewLog_() { return readRows_(logSheetName_(), LOG_COLUMNS); }
function readGrammarLog_() { return readRows_(grammarLogSheetName_(), GRAMMAR_LOG_COLUMNS); }

/**
 * Удержание — доля оценок «Помню» и «Легко» от всех повторений.
 *
 * Считается ТОЛЬКО по повторениям зрелых карточек, то есть без первого показа:
 * первый ответ на невиданное слово почти всегда «не помню», и если мешать его в
 * общую долю, метрика будет измерять темп ввода новых слов, а не память.
 */
function retention_(entries) {
  var graded = entries.filter(function (e) { return Number(e.elapsed_days) > 0; });
  if (!graded.length) return null;
  var good = graded.filter(function (e) { return Number(e.rating) >= 3; }).length;
  return +(good / graded.length).toFixed(3);
}

function within_(entries, days, today, tz) {
  var edge = Date.parse(today + 'T00:00:00Z') - (days - 1) * 86400000;
  return entries.filter(function (e) {
    var k = dayKey_(e.ts, tz);
    return k && Date.parse(k + 'T00:00:00Z') >= edge;
  });
}

/** Сколько дней подряд, считая назад от сегодня, была хотя бы одна оценка. */
function streak_(daysWithWork, today) {
  var set = {};
  daysWithWork.forEach(function (d) { set[d] = true; });
  var n = 0;
  var t = Date.parse(today + 'T00:00:00Z');
  // Сегодняшний день не обрывает серию, если он ещё не начат: считаем со вчера,
  // иначе утром серия обнулялась бы каждый день до первой карточки.
  if (!set[today]) t -= 86400000;
  while (set[new Date(t).toISOString().slice(0, 10)]) { n++; t -= 86400000; }
  return n;
}

function buildStats(userId) {
  var settings = readSettings_();
  var tz = settings.timezone || 'Europe/Moscow';
  var today = todayStr_(tz);
  var axis = lastDays_(today, STATS_WINDOW_DAYS);

  var mine = readCards_().filter(function (c) { return String(c.user_id) === String(userId); });
  var myPatterns = readPatterns_().filter(function (p) { return String(p.user_id) === String(userId); });

  var log = [], glog = [];
  try { log = readReviewLog_(); } catch (e) { log = []; }
  try { glog = readGrammarLog_(); } catch (e) { glog = []; }

  // --- лексика ---
  var byState = {};
  mine.forEach(function (c) {
    var s = String(c.state || 'new');
    byState[s] = (byState[s] || 0) + 1;
  });
  var learned = mine.filter(function (c) { return c.first_review; }).length;
  var stab = mine.filter(function (c) { return Number(c.stability) > 0; })
    .map(function (c) { return Number(c.stability); });

  // --- ряды по дням ---
  var perDay = {}, perDayG = {}, introduced = {};
  log.forEach(function (e) {
    var k = dayKey_(e.ts, tz);
    if (k) perDay[k] = (perDay[k] || 0) + 1;
  });
  glog.forEach(function (e) {
    var k = dayKey_(e.ts, tz);
    if (k) perDayG[k] = (perDayG[k] || 0) + 1;
  });
  mine.forEach(function (c) {
    var k = dayKey_(c.first_review, tz);
    if (k) introduced[k] = (introduced[k] || 0) + 1;
  });

  // Освоено накопительно: сколько единиц было введено ДО начала окна плюс прирост
  // по дням. Без базы график начинался бы с нуля и врал бы про объём словаря.
  var beforeWindow = 0;
  Object.keys(introduced).forEach(function (k) { if (k < axis[0]) beforeWindow += introduced[k]; });
  var cumulative = [], running = beforeWindow;
  axis.forEach(function (d) { running += (introduced[d] || 0); cumulative.push(running); });

  var daysWithWork = Object.keys(perDay).concat(Object.keys(perDayG));

  function block(entries, cards, kind) {
    var w7 = within_(entries, 7, today, tz), w30 = within_(entries, 30, today, tz);
    return {
      kind: kind,
      total: cards.total,
      learned: cards.learned,
      in_progress: cards.in_progress,
      fresh: cards.fresh,
      leeches: cards.leeches || 0,
      reviews_7d: w7.length,
      reviews_30d: w30.length,
      retention_7d: retention_(w7),
      retention_30d: retention_(w30),
      avg_stability_days: cards.avgStability
    };
  }

  var vocab = block(log, {
    total: mine.length,
    learned: learned,
    in_progress: (byState.review || 0) + (byState.relearning || 0),
    fresh: byState['new'] || 0,
    leeches: byState.leech || 0,
    avgStability: stab.length ? +(stab.reduce(function (a, b) { return a + b; }, 0) / stab.length).toFixed(1) : null
  }, 'vocab');

  var gstab = myPatterns.filter(function (p) { return Number(p.stability) > 0; })
    .map(function (p) { return Number(p.stability); });
  var grammar = block(glog, {
    total: myPatterns.length,
    learned: myPatterns.filter(function (p) { return p.first_review; }).length,
    in_progress: myPatterns.filter(function (p) {
      var s = String(p.state || 'new'); return s === 'review' || s === 'relearning';
    }).length,
    fresh: myPatterns.filter(function (p) { return String(p.state || 'new') === 'new'; }).length,
    avgStability: gstab.length ? +(gstab.reduce(function (a, b) { return a + b; }, 0) / gstab.length).toFixed(1) : null
  }, 'grammar');

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    window_days: STATS_WINDOW_DAYS,
    blocks: { vocab: vocab, grammar: grammar },
    series: {
      days: axis,
      reviews: axis.map(function (d) { return perDay[d] || 0; }),
      grammar_reviews: axis.map(function (d) { return perDayG[d] || 0; }),
      learned_cumulative: cumulative
    },
    totals: {
      reviews_all_time: log.length + glog.length,
      streak_days: streak_(daysWithWork, today),
      active_days: Object.keys(perDay).concat(Object.keys(perDayG))
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).length
    }
  };
}

/**
 * CSV журнала повторений — чтобы анализировать чем угодно, а не только этим экраном.
 * Разделитель — запятая, значения экранируются: в примерах встречаются и запятые,
 * и кавычки, и перевод строки.
 */
function csvEscape_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportReviewsCsv(userId) {
  var cards = {};
  readCards_().forEach(function (c) {
    if (String(c.user_id) === String(userId)) cards[String(c.card_id)] = c;
  });

  var log = [];
  try { log = readReviewLog_(); } catch (e) { log = []; }

  var head = ['ts', 'block', 'card_id', 'en', 'ru', 'direction', 'layer', 'type',
    'rating', 'elapsed_days', 'interval_days', 'stability', 'difficulty'];
  var rows = [head.join(',')];

  log.forEach(function (e) {
    var c = cards[String(e.card_id)];
    if (!c) return;   // чужие строки и удалённые карточки в выгрузку не идут
    rows.push([e.ts, 'vocab', e.card_id, c.en, c.ru, c.direction, c.layer, c.type,
      e.rating, e.elapsed_days, e.interval_days, e.stability, e.difficulty]
      .map(csvEscape_).join(','));
  });

  var patterns = {};
  readPatterns_().forEach(function (p) {
    if (String(p.user_id) === String(userId)) patterns[String(p.pattern_id)] = p;
  });
  var glog = [];
  try { glog = readGrammarLog_(); } catch (e) { glog = []; }
  glog.forEach(function (e) {
    var p = patterns[String(e.pattern_id)];
    if (!p) return;
    rows.push([e.ts, 'grammar', e.pattern_id, p.label, p.title_ru, '', '', '',
      e.rating, e.elapsed_days, e.interval_days, e.stability, e.difficulty]
      .map(csvEscape_).join(','));
  });

  return { csv: rows.join('\n'), rows: rows.length - 1 };
}
