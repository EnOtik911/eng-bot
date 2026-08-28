/**
 * Whether a typed answer counts as correct.
 *
 * This lives on the client because that is where the feedback has to be rendered:
 * checking on the server would put a 400-1500 ms round trip between "I typed it"
 * and "was I right", which is exactly the latency this architecture exists to avoid.
 * The server records what happened and derives the rating from it — see
 * docs/spec-grammar.md for the trust boundary.
 *
 * Both sides of the comparison go through the same canonical form, so contractions,
 * punctuation and case never decide correctness. Only grammar does.
 */
(function () {
  // Ambiguous clitics are only expanded after words where they cannot be a
  // possessive: "the guest's folio" must not become "the guest is folio".
  var IS_HOSTS = "(he|she|it|that|this|there|here|what|who|where|when|everything|nothing)";

  function canon(s) {
    var t = String(s === null || s === undefined ? '' : s)
      .replace(/[‘’ʼ]/g, "'")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // Irregular negatives first: a blind n't -> not would produce "won not".
    t = t.replace(/\bwon't\b/g, 'will not')
         .replace(/\bcan't\b/g, 'cannot')
         .replace(/\bshan't\b/g, 'shall not')
         .replace(/n't\b/g, ' not');

    // 's / 'd are ambiguous, so the following participle decides.
    t = t.replace(new RegExp('\\b' + IS_HOSTS + "'s (been|got)\\b", 'g'), '$1 has $2')
         .replace(/\b(\w+)'d (been|had)\b/g, '$1 had $2')
         .replace(/'ve\b/g, ' have')
         .replace(/'re\b/g, ' are')
         .replace(/'m\b/g, ' am')
         .replace(/'ll\b/g, ' will')
         .replace(/'d\b/g, ' would')
         .replace(new RegExp('\\b' + IS_HOSTS + "'s\\b", 'g'), '$1 is');

    // One spelling for the one form that has two.
    t = t.replace(/\bcannot\b/g, 'can not');

    // Punctuation never decides correctness; a leftover apostrophe would.
    return t.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** answerField may hold several accepted forms separated by "||". */
  function alternatives(answerField) {
    return String(answerField === null || answerField === undefined ? '' : answerField)
      .split('||')
      .map(function (a) { return a.trim(); })
      .filter(function (a) { return a.length > 0; });
  }

  function check(input, answerField) {
    var want = canon(input);
    if (!want) return false;
    var alts = alternatives(answerField);
    for (var i = 0; i < alts.length; i++) {
      if (canon(alts[i]) === want) return true;
    }
    return false;
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Hints mark the form under discussion in backticks; render those as code. */
  function formatHint(s) {
    return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /** Fisher-Yates, and never the identity permutation when a shuffle is possible. */
  function shuffle(list) {
    var a = list.slice();
    if (a.length < 2) return a;
    for (var attempt = 0; attempt < 8; attempt++) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      var same = a.every(function (v, i) { return v === list[i]; });
      if (!same) return a;
    }
    return a;
  }

  window.Answer = {
    canon: canon,
    check: check,
    alternatives: alternatives,
    formatHint: formatHint,
    escapeHtml: escapeHtml,
    shuffle: shuffle
  };
})();
