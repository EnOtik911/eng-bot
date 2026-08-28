/**
 * FSRS-6 scheduler. Pure arithmetic — no SpreadsheetApp, no PropertiesService, no dates
 * beyond plain numbers. This file is loaded verbatim by test/fsrs.test.mjs, so the
 * backend and the tests share one source of truth.
 *
 * Reference implementation: open-spaced-repetition/py-fsrs (fsrs/scheduler.py).
 * Sanity identity that pins the constants: at desiredRetention 0.9 the next interval
 * equals stability exactly, because FACTOR is derived so that R(S, S) = 0.9.
 */

// 21 default weights, FSRS-6.
var FSRS_DEFAULT_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
  1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542
];

var FSRS_STABILITY_MIN = 0.001;
var FSRS_DIFFICULTY_MIN = 1.0;
var FSRS_DIFFICULTY_MAX = 10.0;
var FSRS_MAX_INTERVAL_DAYS = 3650; // 10 years is plenty; 36500 is noise at our volume

// Ratings.
var RATING_AGAIN = 1;
var RATING_HARD = 2;
var RATING_GOOD = 3;
var RATING_EASY = 4;

function fsrsDecay_(w) {
  return -w[20];
}

function fsrsFactor_(w) {
  var decay = fsrsDecay_(w);
  return Math.pow(0.9, 1 / decay) - 1;
}

function fsrsClampStability_(s) {
  return Math.max(s, FSRS_STABILITY_MIN);
}

function fsrsClampDifficulty_(d) {
  return Math.min(Math.max(d, FSRS_DIFFICULTY_MIN), FSRS_DIFFICULTY_MAX);
}

/** Probability of recall after elapsedDays with the given stability. */
function fsrsRetrievability(stability, elapsedDays, w) {
  w = w || FSRS_DEFAULT_W;
  if (stability <= 0) return 0;
  var t = Math.max(elapsedDays, 0);
  return Math.pow(1 + fsrsFactor_(w) * t / stability, fsrsDecay_(w));
}

/** Days until retrievability decays to desiredRetention. */
function fsrsInterval(stability, desiredRetention, w) {
  w = w || FSRS_DEFAULT_W;
  var decay = fsrsDecay_(w);
  var raw = (stability / fsrsFactor_(w)) * (Math.pow(desiredRetention, 1 / decay) - 1);
  return Math.min(Math.max(Math.round(raw), 1), FSRS_MAX_INTERVAL_DAYS);
}

function fsrsInitialStability_(rating, w) {
  return fsrsClampStability_(w[rating - 1]);
}

function fsrsInitialDifficulty_(rating, w, clamp) {
  var d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return clamp === false ? d : fsrsClampDifficulty_(d);
}

function fsrsNextDifficulty_(difficulty, rating, w) {
  var deltaD = -(w[6] * (rating - 3));
  var damped = (10.0 - difficulty) * deltaD / 9.0;
  var arg2 = difficulty + damped;
  var arg1 = fsrsInitialDifficulty_(RATING_EASY, w, false);
  var next = w[7] * arg1 + (1 - w[7]) * arg2;   // mean reversion toward "easy" baseline
  return fsrsClampDifficulty_(next);
}

function fsrsRecallStability_(difficulty, stability, retrievability, rating, w) {
  var hardPenalty = rating === RATING_HARD ? w[15] : 1;
  var easyBonus = rating === RATING_EASY ? w[16] : 1;
  return stability * (
    1 + Math.exp(w[8])
      * (11 - difficulty)
      * Math.pow(stability, -w[9])
      * (Math.exp((1 - retrievability) * w[10]) - 1)
      * hardPenalty
      * easyBonus
  );
}

function fsrsForgetStability_(difficulty, stability, retrievability, w) {
  var longTerm = w[11]
    * Math.pow(difficulty, -w[12])
    * (Math.pow(stability + 1, w[13]) - 1)
    * Math.exp((1 - retrievability) * w[14]);
  var shortTerm = stability / Math.exp(w[17] * w[18]);
  return Math.min(longTerm, shortTerm);
}

/** Same-day repeat: elapsed time carries no information, so a separate track is used. */
function fsrsShortTermStability_(stability, rating, w) {
  var inc = Math.exp(w[17] * (rating - 3 + w[18])) * Math.pow(stability, -w[19]);
  if (rating !== RATING_AGAIN) inc = Math.max(inc, 1.0);
  return fsrsClampStability_(stability * inc);
}

/**
 * The only entry point the rest of the backend uses.
 *
 * card: { stability, difficulty, reps, lapses } — stability/difficulty null for a new card
 * rating: 1..4
 * elapsedDays: whole days since last_review; 0 for a same-day repeat
 * opts: { desiredRetention, w, fuzzSeed }
 *
 * returns { stability, difficulty, intervalDays, retrievability, reps, lapses, lapsed }
 */
function fsrsReview(card, rating, elapsedDays, opts) {
  opts = opts || {};
  var w = opts.w || FSRS_DEFAULT_W;
  var retention = opts.desiredRetention || 0.9;

  if (rating < RATING_AGAIN || rating > RATING_EASY) {
    throw new Error('fsrsReview: rating out of range: ' + rating);
  }

  var isNew = card.stability === null || card.stability === undefined || !card.reps;
  var stability, difficulty, retrievability;

  if (isNew) {
    stability = fsrsInitialStability_(rating, w);
    difficulty = fsrsInitialDifficulty_(rating, w);
    retrievability = 1;
  } else {
    retrievability = fsrsRetrievability(card.stability, elapsedDays, w);
    difficulty = fsrsNextDifficulty_(card.difficulty, rating, w);
    if (elapsedDays <= 0) {
      stability = fsrsShortTermStability_(card.stability, rating, w);
    } else if (rating === RATING_AGAIN) {
      stability = fsrsClampStability_(
        fsrsForgetStability_(difficulty, card.stability, retrievability, w));
    } else {
      stability = fsrsClampStability_(
        fsrsRecallStability_(difficulty, card.stability, retrievability, rating, w));
    }
  }

  var interval = fsrsInterval(stability, retention, w);
  interval = fsrsFuzz_(interval, opts.fuzzSeed);

  var lapsed = !isNew && rating === RATING_AGAIN;
  return {
    stability: stability,
    difficulty: difficulty,
    intervalDays: interval,
    retrievability: retrievability,
    reps: (card.reps || 0) + 1,
    lapses: (card.lapses || 0) + (lapsed ? 1 : 0),
    lapsed: lapsed
  };
}

/**
 * +/-5% spread on intervals longer than two days. Without it a batch imported on one day
 * comes back as a single wall on the same future day, forever.
 * Deterministic when fuzzSeed is supplied, so tests stay reproducible.
 */
function fsrsFuzz_(intervalDays, fuzzSeed) {
  if (intervalDays <= 2) return intervalDays;
  var r = fuzzSeed === undefined || fuzzSeed === null ? Math.random() : fuzzSeed;
  var spread = intervalDays * 0.05;
  var delta = (r * 2 - 1) * spread;
  var out = Math.round(intervalDays + delta);
  return Math.min(Math.max(out, 1), FSRS_MAX_INTERVAL_DAYS);
}
