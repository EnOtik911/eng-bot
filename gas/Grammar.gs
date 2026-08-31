/**
 * Grammar block. What makes it different from the vocabulary block, in one line:
 * FSRS state lives on the PATTERN, and every review draws different sentences
 * from that pattern's pool.
 *
 * If the same sentence came back on schedule, the thing that got strengthened
 * would be the sentence. The rule is what has to transfer into speech, so the
 * rule is what gets scheduled — see docs/spec-grammar.md.
 *
 * One GET brings the whole grammar block down, including item pools for every
 * introduced pattern. That is deliberate: picking a pattern by hand must not cost
 * a round trip, and the whole block then works offline for free.
 */

/**
 * Rating is derived from what actually happened, not self-reported.
 *
 * Grammar differs from vocabulary here: "did I know this word" is only knowable
 * by the learner, but "is this sentence correct" is objectively checkable. Asking
 * for a self-rating on top of an objective check would be inventing noise.
 *
 * Revealing a hint caps the round at GOOD. Without that cap, a hinted answer
 * would look identical to a known one and the interval would grow on borrowed
 * knowledge — the scheduler would be lying to itself.
 */
function grammarRating_(errors, hints, total) {
  if (!total) return RATING_GOOD;
  if (errors === 0) return hints > 0 ? RATING_GOOD : RATING_EASY;
  if (errors * 3 <= total) return RATING_HARD;
  return RATING_AGAIN;
}

function grammarSettings_(settings) {
  return {
    tz: settings.timezone || 'Europe/Moscow',
    retention: parseFloat(settings.grammar_desired_retention) || 0.9,
    perRound: parseInt(settings.grammar_items_per_round, 10) || 3,
    sessionCap: parseInt(settings.grammar_session_cap, 10) || 8,
    newTarget: parseInt(settings.grammar_daily_new_target, 10) || 1,
    leechThreshold: parseInt(settings.leech_threshold, 10) || 5
  };
}

/**
 * Pool rotation: least-served first, oldest-served next. Ties broken by item_id
 * so the order is stable rather than accidental — an unstable tie-break would make
 * the same call return different pools and nothing would be reproducible.
 */
function sortPool_(items) {
  return items.slice().sort(function (a, b) {
    var sa = Number(a.serve_count) || 0;
    var sb = Number(b.serve_count) || 0;
    if (sa !== sb) return sa - sb;
    var la = String(a.last_served || '');
    var lb = String(b.last_served || '');
    if (la !== lb) return la < lb ? -1 : 1;
    return String(a.item_id) < String(b.item_id) ? -1 : 1;
  });
}

function publicItem_(it) {
  return {
    item_id: it.item_id,
    pattern_id: it.pattern_id,
    kind: it.kind,
    prompt_ru: it.prompt_ru,
    stem: it.stem,
    answer: it.answer,
    tokens: it.tokens ? String(it.tokens).split('|').map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; }) : [],
    hint_ru: it.hint_ru
  };
}

/**
 * The whole grammar block in one payload:
 *   patterns — every pattern with its due state, for the picker
 *   pools    — items for the patterns that are playable right now
 *   queue    — pattern ids in scheduler order, for the "mixed" mode
 */
function buildGrammarSession(userId) {
  var settings = readSettings_();
  var g = grammarSettings_(settings);
  var today = todayStr_(g.tz);

  var all = readPatterns_();
  var mine = all.filter(function (p) { return String(p.user_id) === String(userId); });

  var items = readGrammarItems_();
  var byPattern = {};
  items.forEach(function (it) {
    var k = String(it.pattern_id);
    if (!byPattern[k]) byPattern[k] = [];
    byPattern[k].push(it);
  });

  var introducedToday = 0;
  mine.forEach(function (p) {
    if (p.first_review && dateKey_(p.first_review, g.tz) === today) introducedToday++;
  });
  var newAllowance = Math.max(g.newTarget - introducedToday, 0);

  mine.sort(function (a, b) {
    var oa = Number(a.order_index) || 0;
    var ob = Number(b.order_index) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.pattern_id) < String(b.pattern_id) ? -1 : 1;
  });

  var due = [];
  var fresh = [];
  var later = [];
  mine.forEach(function (p) {
    var state = String(p.state || 'new');
    if (state === 'suspended') return;
    var pool = byPattern[String(p.pattern_id)] || [];
    if (!pool.length) return;                       // a pattern with no sentences is not playable
    if (state === 'new') { fresh.push(p); return; }
    var dueStr = dateKey_(p.due, g.tz);
    if (dueStr && dueStr <= today) due.push(p); else later.push(p);
  });

  // Debt before growth, exactly as in the vocabulary block.
  var queue = due.concat(fresh.slice(0, newAllowance)).slice(0, g.sessionCap);

  // Pools are sent for everything playable, not only for the queue: choosing a
  // pattern by hand is a first-class mode and must not need another round trip.
  var pools = {};
  var poolDepth = g.perRound * 2;
  due.concat(fresh, later).forEach(function (p) {
    var key = String(p.pattern_id);
    if (pools[key]) return;
    pools[key] = sortPool_(byPattern[key]).slice(0, poolDepth).map(publicItem_);
  });

  return {
    ok: true,
    server_ts: new Date().toISOString(),
    today: today,
    settings: {
      items_per_round: g.perRound,
      desired_retention: g.retention,
      daily_new_target: g.newTarget,
      session_cap: g.sessionCap
    },
    patterns: mine.map(function (p) {
      var pool = byPattern[String(p.pattern_id)] || [];
      var dueStr = dateKey_(p.due, g.tz);
      return {
        pattern_id: p.pattern_id,
        order_index: Number(p.order_index) || 0,
        label: p.label,
        title_ru: p.title_ru,
        notes_slug: p.notes_slug,
        state: String(p.state || 'new'),
        due: dueStr,
        is_due: String(p.state) !== 'new' && !!dueStr && dueStr <= today,
        reps: Number(p.reps) || 0,
        lapses: Number(p.lapses) || 0,
        pool_size: pool.length
      };
    }),
    pools: pools,
    queue: queue.map(function (p) { return String(p.pattern_id); }),
    counts: {
      total: mine.length,
      due: due.length,
      new_available: fresh.length,
      new_in_session: Math.min(fresh.length, newAllowance),
      new_introduced_today: introducedToday,
      new_allowance_left: newAllowance,
      scheduled: later.length
    }
  };
}

/**
 * rounds: [{ pattern_id, results: [{ item_id, correct, hint_used }], ts }]
 *
 * The client sends what happened, never a rating: the derivation lives here so
 * there is exactly one copy of it. Answer checking stays on the client because
 * that is where the immediate feedback has to be rendered anyway, and this is a
 * single-user system — the deliberate trust boundary is written down in
 * docs/spec-grammar.md rather than left implicit.
 */
function applyGrammarFlush(userId, batchId, rounds) {
  if (!batchId) return { ok: false, code: 'BAD_REQUEST', message: 'batch_id is required' };
  if (!rounds || !rounds.length) return { ok: true, applied: 0, skipped_duplicate: false };

  if (flushSeen_(batchId)) return { ok: true, applied: 0, skipped_duplicate: true };

  var settings = readSettings_();
  var g = grammarSettings_(settings);
  var today = todayStr_(g.tz);

  var patterns = readPatterns_();
  var byId = {};
  patterns.forEach(function (p) { byId[String(p.pattern_id)] = p; });

  var items = readGrammarItems_();
  var itemById = {};
  items.forEach(function (it) { itemById[String(it.item_id)] = it; });

  var patternUpdates = {};
  var itemUpdates = {};
  var logRows = [];
  var outcomes = [];
  var applied = 0;

  rounds.forEach(function (round) {
    var p = byId[String(round.pattern_id)];
    if (!p) return;
    if (String(p.user_id) !== String(userId)) return;
    var results = round.results || [];
    if (!results.length) return;

    var errors = 0;
    var hints = 0;
    results.forEach(function (r) {
      if (!r.correct) errors++;
      if (r.hint_used) hints++;
      var it = itemById[String(r.item_id)];
      if (!it) return;
      // Serve counters drive pool rotation. Bumped on flush rather than on build,
      // so an abandoned session does not burn through the pool.
      itemUpdates[String(r.item_id)] = {
        _row: it._row,
        patch: {
          serve_count: (Number(it.serve_count) || 0) + 1,
          last_served: today
        }
      };
    });

    var rating = grammarRating_(errors, hints, results.length);
    var elapsed = p.last_review ? daysBetween_(p.last_review, today) : 0;
    var out = fsrsReview({
      stability: p.stability === '' ? null : Number(p.stability),
      difficulty: p.difficulty === '' ? null : Number(p.difficulty),
      reps: Number(p.reps) || 0,
      lapses: Number(p.lapses) || 0
    }, rating, elapsed, { desiredRetention: g.retention });

    var dueDate = new Date(new Date(today + 'T00:00:00Z').getTime() + out.intervalDays * 86400000);
    var dueStr = Utilities.formatDate(dueDate, 'UTC', 'yyyy-MM-dd');

    var patch = {
      state: 'review', due: dueStr,
      stability: out.stability, difficulty: out.difficulty,
      reps: out.reps, lapses: out.lapses, last_review: today
    };
    if (!p.first_review) { patch.first_review = today; p.first_review = today; }

    // A pattern reviewed twice in one session must chain, not overwrite: the
    // second round has to start from the state the first one left behind.
    p.stability = out.stability;
    p.difficulty = out.difficulty;
    p.reps = out.reps;
    p.lapses = out.lapses;
    p.last_review = today;
    p.state = 'review';
    p.due = dueStr;

    patternUpdates[String(p.pattern_id)] = { _row: p._row, patch: patch };

    logRows.push([p.pattern_id, round.ts || new Date().toISOString(), rating,
      errors, hints, results.length, elapsed, out.intervalDays,
      out.stability, out.difficulty, batchId]);

    outcomes.push({
      pattern_id: p.pattern_id,
      label: p.label,
      rating: rating,
      errors: errors,
      hints: hints,
      items: results.length,
      interval_days: out.intervalDays,
      due: dueStr
    });
    applied++;
  });

  writePatternUpdates_(Object.keys(patternUpdates).map(function (k) { return patternUpdates[k]; }));
  writeGrammarItemUpdates_(Object.keys(itemUpdates).map(function (k) { return itemUpdates[k]; }));
  appendGrammarLog_(logRows);
  flushRecord_(batchId, applied);

  return { ok: true, applied: applied, skipped_duplicate: false, outcomes: outcomes };
}
