/**
 * grammar_inbox -> patterns + grammar_items.
 *
 * The inbox is deliberately flat and denormalised: pattern metadata repeats on
 * every row. That is what makes a generated TSV pasteable in one go, and the
 * pattern row is created here on first sight rather than by hand.
 *
 * Structural validation only. Whether a typed answer counts as correct is decided
 * on the client (app/answer.js) — see docs/spec-grammar.md for why the boundary
 * sits there.
 */

var GRAMMAR_GAP = '___';

function collapse_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Structural comparison for the tokens/answer cross-check: case and punctuation off. */
function bareText_(s) {
  return collapse_(s).toLowerCase().replace(/[.,;:!?"()]/g, '').replace(/\s+/g, ' ').trim();
}

/** Identity of an exercise: pattern, kind, prompt shown, answer expected. */
function grammarItemKey_(it) {
  return [String(it.pattern_id), String(it.kind),
    bareText_(it.stem), bareText_(it.tokens), bareText_(String(it.answer).split('||')[0])].join('|');
}

function firstAlternative_(answer) {
  return collapse_(String(answer).split('||')[0]);
}

function validateGrammarRow_(row) {
  var r = {};
  GRAMMAR_IMPORT_COLUMNS.forEach(function (c, i) { r[c] = collapse_(row[i]); });

  if (!r.pattern_id) return { error: 'pattern_id is empty' };
  if (!/^[a-z0-9_]+$/.test(r.pattern_id)) {
    return { error: 'pattern_id must be lower_snake_case, got "' + r.pattern_id + '"' };
  }
  if (!r.label) return { error: 'label is empty — it is the chip shown on every screen' };
  if (!r.title_ru) return { error: 'title_ru is empty' };
  var order = parseInt(r.order_index, 10);
  if (isNaN(order) || order < 0) return { error: 'order_index must be a non-negative number' };
  r.order_index = order;
  if (!r.notes_slug) r.notes_slug = r.pattern_id;

  if (VALID_KINDS.indexOf(r.kind) < 0) {
    return { error: 'kind must be one of ' + VALID_KINDS.join('|') + ', got "' + r.kind + '"' };
  }
  if (!r.answer) return { error: 'answer is empty' };
  // A hint that does not exist cannot explain anything, and an unexplained
  // correction teaches the answer instead of the rule.
  if (!r.hint_ru) return { error: 'hint_ru is empty — every item must be able to explain itself' };
  if (r.answer.indexOf(GRAMMAR_GAP) >= 0) return { error: 'answer must not contain ' + GRAMMAR_GAP };

  if (r.kind === 'scramble') {
    if (!r.tokens) return { error: 'tokens are required for kind scramble' };
    var toks = r.tokens.split('|').map(collapse_).filter(function (t) { return t.length > 0; });
    if (toks.length < 3) {
      return { error: 'scramble needs at least 3 tokens, got ' + toks.length };
    }
    // The cross-check that catches the mistake actually worth catching: tokens that
    // do not assemble into the answer make the exercise unsolvable.
    if (bareText_(toks.join(' ')) !== bareText_(firstAlternative_(r.answer))) {
      return {
        error: 'tokens do not assemble into answer: "' + toks.join(' ') +
          '" vs "' + firstAlternative_(r.answer) + '"'
      };
    }
    if (!r.prompt_ru) {
      return { error: 'prompt_ru is required for scramble — without the meaning it is a word puzzle' };
    }
    r.tokens = toks.join('|');
  } else {
    if (!r.stem) return { error: 'stem is required for kind ' + r.kind };
    if (r.tokens) return { error: 'tokens only apply to kind scramble' };
  }

  if (r.kind === 'gapfill') {
    if (r.stem.indexOf(GRAMMAR_GAP) < 0) {
      return { error: 'gapfill stem must contain the gap marker ' + GRAMMAR_GAP };
    }
  }
  if (r.kind === 'transform' || r.kind === 'fix') {
    if (bareText_(r.stem) === bareText_(firstAlternative_(r.answer))) {
      return { error: 'stem and answer are identical — nothing to ' + r.kind };
    }
    if (r.kind === 'transform' && !r.prompt_ru) {
      return { error: 'prompt_ru is required for transform — it names the target form' };
    }
  }

  return { row: r };
}

function importGrammarInbox(userId) {
  var sh = sheet_(SHEET_GRAMMAR_INBOX);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return { accepted: 0, rejected: 0, duplicates: 0, patterns_created: 0, message: 'grammar_inbox is empty' };
  }

  var raw = sh.getRange(2, 1, lastRow - 1, GRAMMAR_IMPORT_COLUMNS.length).getValues();

  var patterns = readPatterns_();
  var patternById = {};
  patterns.forEach(function (p) { patternById[String(p.pattern_id)] = p; });

  // The dedupe key has to include the stem, not only the answer: two different
  // gap-fills inside one pattern legitimately share a one-word answer like "the",
  // and keying on the answer alone threw the second one away as a duplicate.
  var existing = {};
  readGrammarItems_().forEach(function (it) { existing[grammarItemKey_(it)] = true; });

  var batch = makeId_('gimp');
  var now = new Date().toISOString();
  var itemRows = [];
  var patternRows = [];
  var newPatterns = {};
  var rejects = [];
  var duplicates = 0;
  var seenInBatch = {};

  for (var i = 0; i < raw.length; i++) {
    var lineNo = i + 2;
    if (!collapse_(raw[i][0]) && !collapse_(raw[i][8])) continue;      // blank line

    var v = validateGrammarRow_(raw[i]);
    if (v.error) {
      rejects.push([lineNo, v.error, now].concat(raw[i]));
      continue;
    }
    var r = v.row;
    var key = grammarItemKey_(r);
    if (existing[key] || seenInBatch[key]) {
      duplicates++;
      rejects.push([lineNo, 'duplicate of an existing item', now].concat(raw[i]));
      continue;
    }
    seenInBatch[key] = true;

    if (!patternById[r.pattern_id] && !newPatterns[r.pattern_id]) {
      var pvalues = {
        pattern_id: r.pattern_id, order_index: r.order_index, label: r.label,
        title_ru: r.title_ru, notes_slug: r.notes_slug,
        state: 'new', due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
        last_review: '', first_review: '', created_at: now,
        user_id: userId, source_batch: batch
      };
      var prow = [];
      PATTERN_COLUMNS.forEach(function (c) { prow.push(pvalues[c]); });
      patternRows.push(prow);
      newPatterns[r.pattern_id] = true;
    }

    var ivalues = {
      item_id: makeId_('gi'), pattern_id: r.pattern_id, kind: r.kind,
      prompt_ru: r.prompt_ru, stem: r.stem, answer: r.answer, tokens: r.tokens,
      hint_ru: r.hint_ru, serve_count: 0, last_served: '',
      created_at: now, source_batch: batch
    };
    var irow = [];
    GRAMMAR_ITEM_COLUMNS.forEach(function (c) { irow.push(ivalues[c]); });
    itemRows.push(irow);
  }

  if (patternRows.length) appendRows_(SHEET_PATTERNS, PATTERN_COLUMNS, patternRows);
  if (itemRows.length) appendRows_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS, itemRows);

  if (rejects.length) {
    var rj = sheet_(SHEET_GRAMMAR_REJECTS);
    var width = 3 + GRAMMAR_IMPORT_COLUMNS.length;
    var padded = rejects.map(function (x) {
      while (x.length < width) x.push('');
      return x.slice(0, width);
    });
    rj.getRange(rj.getLastRow() + 1, 1, padded.length, width).setValues(padded);
  }

  sh.getRange(2, 1, lastRow - 1, GRAMMAR_IMPORT_COLUMNS.length).clearContent();

  return {
    accepted: itemRows.length,
    patterns_created: patternRows.length,
    rejected: rejects.length - duplicates,
    duplicates: duplicates,
    batch: batch
  };
}

/** Removes every pattern and item from one grammar import batch. */
function rollbackGrammarBatch(batchId) {
  var removed = { items: 0, patterns: 0 };
  [[SHEET_GRAMMAR_ITEMS, readGrammarItems_(), 'items'],
   [SHEET_PATTERNS, readPatterns_(), 'patterns']].forEach(function (spec) {
    var sh = sheet_(spec[0]);
    var rows = spec[1].filter(function (x) { return String(x.source_batch) === String(batchId); })
      .map(function (x) { return x._row; })
      .sort(function (a, b) { return b - a; });
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('LOCKED');
    try {
      rows.forEach(function (r) { sh.deleteRow(r); });
    } finally {
      lock.releaseLock();
    }
    removed[spec[2]] = rows.length;
  });
  return removed;
}
