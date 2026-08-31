/**
 * Session state machine, entirely client side.
 * Cards rated "again" go back into the queue a few positions later — that is what
 * replaces sub-day learning steps, which a date-granularity `due` cannot express.
 */
(function () {
  var AGAIN_REINSERT_AFTER = 3;

  function Session(payload) {
    this.settings = payload.settings;
    this.warnings = payload.warnings || [];
    this.counts = payload.counts || {};
    // Свободная практика: ответы никуда не пишутся, расписание не двигается.
    // Флаг живёт на сессии, а не в UI, чтобы «куда девать оценку» решалось в одном месте.
    this.practice = !!payload.practice;
    this.queue = payload.cards.slice();
    // Исходный объём работы: по нему считается прогресс. Длина очереди для этого
    // не годится — «не помню» возвращает карточку, и полоса поехала бы назад.
    this.plannedTotal = payload.planned_total || this.queue.length;
    this.answered = payload.answered || 0;
    this.current = null;
  }

  /**
   * Состояние, которого достаточно, чтобы продолжить с той же карточки.
   * Текущая карточка кладётся обратно в голову очереди: показанная, но не оценённая,
   * она ещё не прожита, и терять её при выходе нельзя.
   */
  Session.prototype.snapshot = function (day) {
    return {
      day: day,
      practice: this.practice,
      settings: this.settings,
      counts: this.counts,
      warnings: this.warnings,
      planned_total: this.plannedTotal,
      answered: this.answered,
      cards: (this.current ? [this.current] : []).concat(this.queue)
    };
  };

  Session.prototype.next = function () {
    this.current = this.queue.length ? this.queue.shift() : null;
    return this.current;
  };

  Session.prototype.remaining = function () {
    return this.queue.length + (this.current ? 1 : 0);
  };

  /** Records the rating, reinserts on "again", returns the buffer entry to persist. */
  Session.prototype.rate = function (rating) {
    var card = this.current;
    if (!card) return null;
    this.answered++;
    // The card leaves `current` the moment it is rated, otherwise remaining()
    // counts it twice and the session never reports itself as finished.
    this.current = null;

    if (rating === 1) {
      var at = Math.min(AGAIN_REINSERT_AFTER, this.queue.length);
      this.queue.splice(at, 0, card);
    }

    return {
      card_id: card.card_id,
      rating: rating,
      ts: new Date().toISOString()
    };
  };

  window.Session = Session;
})();
