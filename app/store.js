/**
 * localStorage: the session queue and the answer buffer.
 * The buffer is the reason a dead network is a non-event: answers accumulate here
 * and are flushed as one batch when connectivity returns.
 */
(function () {
  var K_QUEUE = 'engbot.queue.v1';
  var K_BUFFER = 'engbot.buffer.v1';
  var K_BATCH = 'engbot.batch.v1';
  var K_META = 'engbot.meta.v1';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  window.Store = {
    getQueue: function () { return read(K_QUEUE, null); },
    setQueue: function (q) { write(K_QUEUE, q); },
    clearQueue: function () { try { localStorage.removeItem(K_QUEUE); } catch (e) {} },

    getBuffer: function () { return read(K_BUFFER, []); },
    pushAnswer: function (answer) {
      var buf = read(K_BUFFER, []);
      buf.push(answer);
      write(K_BUFFER, buf);
      return buf.length;
    },
    clearBuffer: function () {
      try { localStorage.removeItem(K_BUFFER); localStorage.removeItem(K_BATCH); } catch (e) {}
    },

    /** One batch id per buffer, so a retry of the same answers is recognised as a duplicate. */
    getBatchId: function () {
      var id = read(K_BATCH, null);
      if (!id) {
        id = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        write(K_BATCH, id);
      }
      return id;
    },

    getMeta: function () { return read(K_META, {}); },
    setMeta: function (m) { write(K_META, m); }
  };
})();
