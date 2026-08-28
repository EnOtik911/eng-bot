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
    this.queue = payload.cards.slice();
    // Исходный объём работы: по нему считается прогресс. Длина очереди для этого
    // не годится — «не помню» возвращает карточку, и полоса поехала бы назад.
    this.plannedTotal = this.queue.length;
    this.answered = 0;
    this.current = null;
  }

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
