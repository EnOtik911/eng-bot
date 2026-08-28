/**
 * Grammar block, client side.
 *
 * A round is one PATTERN and N sentences drawn from its pool. The rating is not
 * asked for: it is derived on the server from what happened in the round. Here we
 * only record facts — correct on first attempt, hint revealed.
 *
 * Items answered wrongly are re-asked at the end of the round. The second attempt
 * deliberately does not change the recorded result: the corrective repetition is
 * for the learner, and letting it erase the mistake would make the scheduler
 * believe the pattern was known.
 */
(function () {

  function GrammarBlock(payload) {
    this.settings = payload.settings || {};
    this.patterns = payload.patterns || [];
    this.pools = payload.pools || {};
    this.counts = payload.counts || {};
    this.dueQueue = (payload.queue || []).slice();

    this.perRound = this.settings.items_per_round || 3;
    this.queue = [];
    this.mode = null;
    this.plannedRounds = 0;
    this.roundsDone = 0;
    this.round = null;
    this.cursor = {};              // pattern_id -> next index into its pool

    this.byId = {};
    var self = this;
    this.patterns.forEach(function (p) { self.byId[String(p.pattern_id)] = p; });
  }

  GrammarBlock.prototype.pattern = function (id) { return this.byId[String(id)] || null; };

  GrammarBlock.prototype.playable = function (id) {
    var pool = this.pools[String(id)];
    return !!(pool && pool.length);
  };

  GrammarBlock.prototype.startMixed = function () {
    this.mode = 'mixed';
    var self = this;
    this.queue = this.dueQueue.filter(function (id) { return self.playable(id); });
    this.plannedRounds = this.queue.length;
    this.roundsDone = 0;
    this.round = null;
    return this.plannedRounds;
  };

  GrammarBlock.prototype.startSingle = function (patternId) {
    this.mode = 'single';
    this.queue = this.playable(patternId) ? [String(patternId)] : [];
    this.plannedRounds = this.queue.length;
    this.roundsDone = 0;
    this.round = null;
    return this.plannedRounds;
  };

  /** One more round of the pattern just finished — the "ещё раз" button. */
  GrammarBlock.prototype.repeatLast = function (patternId) {
    if (!this.playable(patternId)) return false;
    this.queue.push(String(patternId));
    this.plannedRounds++;
    return true;
  };

  /**
   * The pool cursor walks the pool and wraps around, so a pattern drilled twice in
   * a row gets different sentences the second time. That is the whole point of
   * scheduling the pattern instead of the sentence.
   */
  GrammarBlock.prototype.nextRound = function () {
    var id = this.queue.shift();
    if (!id) { this.round = null; return null; }
    var pool = this.pools[String(id)] || [];
    if (!pool.length) return this.nextRound();

    var start = this.cursor[String(id)] || 0;
    var take = Math.min(this.perRound, pool.length);
    var items = [];
    for (var i = 0; i < take; i++) items.push(pool[(start + i) % pool.length]);
    this.cursor[String(id)] = (start + take) % pool.length;

    this.round = {
      pattern_id: String(id),
      pattern: this.pattern(id),
      items: items,
      idx: 0,
      results: [],
      retry: [],
      hintUsed: false,
      ts: new Date().toISOString()
    };
    return this.round;
  };

  GrammarBlock.prototype.currentItem = function () {
    var r = this.round;
    if (!r) return null;
    if (r.idx < r.items.length) return r.items[r.idx];
    if (r.retry.length) return r.retry[0];
    return null;
  };

  GrammarBlock.prototype.isRetry = function () {
    var r = this.round;
    return !!(r && r.idx >= r.items.length && r.retry.length);
  };

  GrammarBlock.prototype.markHint = function () {
    if (!this.round) return;
    // A hint on a re-ask changes nothing: the result for that item is already recorded.
    if (this.isRetry()) return;
    this.round.hintUsed = true;
  };

  /** Returns { correct, item }. Advancing is a separate step so the UI can show the fix. */
  GrammarBlock.prototype.submit = function (value) {
    var r = this.round;
    var item = this.currentItem();
    if (!r || !item) return null;
    var correct = window.Answer.check(value, item.answer);

    if (!this.isRetry()) {
      r.results.push({
        item_id: item.item_id,
        correct: correct,
        hint_used: r.hintUsed
      });
      r.hintUsed = false;
      if (!correct) r.retry.push(item);
      r.idx++;
    } else if (correct) {
      r.retry.shift();
    }
    return { correct: correct, item: item, retry_pending: r.retry.length };
  };

  /** Called after a wrong re-attempt: move it to the back rather than looping on it. */
  GrammarBlock.prototype.deferRetry = function () {
    var r = this.round;
    if (!r || !r.retry.length) return;
    r.retry.push(r.retry.shift());
  };

  GrammarBlock.prototype.roundFinished = function () {
    var r = this.round;
    if (!r) return false;
    return r.idx >= r.items.length && r.retry.length === 0;
  };

  /** The buffer entry: facts only, no rating. */
  GrammarBlock.prototype.closeRound = function () {
    var r = this.round;
    if (!r) return null;
    this.roundsDone++;
    var entry = { pattern_id: r.pattern_id, results: r.results, ts: r.ts };
    var summary = {
      pattern_id: r.pattern_id,
      label: r.pattern ? r.pattern.label : '',
      title_ru: r.pattern ? r.pattern.title_ru : '',
      items: r.results.length,
      errors: r.results.filter(function (x) { return !x.correct; }).length,
      hints: r.results.filter(function (x) { return x.hint_used; }).length
    };
    return { entry: entry, summary: summary };
  };

  GrammarBlock.prototype.hasMoreRounds = function () { return this.queue.length > 0; };

  window.GrammarBlock = GrammarBlock;
})();
