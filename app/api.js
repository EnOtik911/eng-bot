/**
 * Transport. The one rule that cannot be broken:
 * only "simple" requests — no custom headers, and Content-Type must stay text/plain.
 * Apps Script never answers an OPTIONS preflight, so a preflighted request fails
 * with a CORS error that no server-side change can fix. See tech-bank/004.
 */
(function () {
  function base() {
    return (window.ENGBOT_CONFIG && window.ENGBOT_CONFIG.WEB_APP_URL) || '';
  }

  function initData() {
    var tg = window.Telegram && window.Telegram.WebApp;
    return tg && tg.initData ? tg.initData : '';
  }

  window.Api = {
    getSession: function () {
      var url = base() + '?action=session&initData=' + encodeURIComponent(initData());
      return fetch(url, { method: 'GET', redirect: 'follow' })
        .then(function (r) { return r.json(); });
    },

    /** Практика только читает: обратного вызова у этого режима нет по замыслу. */
    getPractice: function () {
      var url = base() + '?action=practice&initData=' + encodeURIComponent(initData());
      return fetch(url, { method: 'GET', redirect: 'follow' })
        .then(function (r) { return r.json(); });
    },

    getGrammar: function () {
      var url = base() + '?action=grammar&initData=' + encodeURIComponent(initData());
      return fetch(url, { method: 'GET', redirect: 'follow' })
        .then(function (r) { return r.json(); });
    },

    flushGrammar: function (batchId, rounds) {
      return fetch(base(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'grammar_flush',
          initData: initData(),
          batch_id: batchId,
          rounds: rounds
        })
      }).then(function (r) { return r.json(); });
    },

    flush: function (batchId, reviews) {
      return fetch(base(), {
        method: 'POST',
        // text/plain keeps this a simple request; the body is still JSON
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'flush',
          initData: initData(),
          batch_id: batchId,
          reviews: reviews
        })
      }).then(function (r) { return r.json(); });
    }
  };
})();
