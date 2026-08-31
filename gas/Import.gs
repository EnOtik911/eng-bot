/**
 * inbox -> cards. Nothing happens silently: every rejected row lands in `rejects`
 * with a reason, and a duplicate is skipped rather than overwriting your data.
 */

function normalizeEn_(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Does the example actually use this unit?
 *
 * Literal substring matching cannot work for real collocations, and both failure
 * modes showed up in the very first batch:
 *   - determiners vary:  "roll out a feature"  ->  "we roll out the feature"
 *   - verbs inflect:     "take ownership of"   ->  "she took ownership of"
 *
 * So the check is token overlap, not containment: at least 60% of the unit's tokens
 * must appear in the example (a token counts if any example word contains it, which
 * covers plurals like vehicle/vehicles). That still catches the failure worth catching
 * — a generator that paired the wrong sentence — and stops rejecting correct English.
 */
function matchTokens_(s) {
  return normalizeEn_(s)
    .replace(/[.,;:!?()"'\-]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .split(/\s+/)
    .filter(function (t) { return t.length > 1; });
}

function exampleUsesUnit_(en, example) {
  var unit = matchTokens_(en);
  if (!unit.length) return true;
  var words = matchTokens_(example);
  var hit = 0;
  unit.forEach(function (t) {
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(t) >= 0 || t.indexOf(words[i]) >= 0) { hit++; return; }
    }
  });
  return hit / unit.length >= 0.6;
}

function makeId_(prefix) {
  return prefix + '_' + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 4);
}

function validateImportRow_(row, lineNo) {
  var r = {};
  IMPORT_COLUMNS.forEach(function (c, i) { r[c] = String(row[i] === null || row[i] === undefined ? '' : row[i]).trim(); });

  if (!r.en) return { error: 'en is empty' };
  if (!r.ru) return { error: 'ru is empty' };
  if (r.en.length > 80) return { error: 'en longer than 80 chars (' + r.en.length + ')' };
  if (VALID_TYPES.indexOf(r.type) < 0) {
    return { error: 'type must be one of ' + VALID_TYPES.join('|') + ', got "' + r.type + '"' };
  }
  if (VALID_LAYERS.indexOf(r.layer) < 0) {
    return { error: 'layer must be one of ' + VALID_LAYERS.join('|') + ', got "' + r.layer + '"' };
  }
  if (r.type !== 'word' && !r.example_en) {
    return { error: 'example_en is required for type ' + r.type };
  }
  if (r.example_en && !exampleUsesUnit_(r.en, r.example_en)) {
    return { error: 'example_en does not use en (token overlap below 60%)' };
  }
  return { row: r };
}

/**
 * Reads the inbox tab, validates, appends accepted rows as two cards each.
 * Returns a report object; the caller decides how to show it.
 */
function importInbox(userId) {
  var sh = sheet_(SHEET_INBOX);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { accepted: 0, rejected: 0, duplicates: 0, message: 'inbox is empty' };

  var raw = sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).getValues();
  var existing = {};
  readCards_().forEach(function (c) {
    if (String(c.direction) === 'recog') existing[normalizeEn_(c.en)] = true;
  });

  var batch = makeId_('imp');
  var now = new Date().toISOString();
  var cardRows = [];
  var rejects = [];
  var duplicates = 0;
  var seenInBatch = {};

  for (var i = 0; i < raw.length; i++) {
    var lineNo = i + 2;
    if (!String(raw[i][1] || '').trim() && !String(raw[i][0] || '').trim()) continue; // blank line

    var v = validateImportRow_(raw[i], lineNo);
    if (v.error) {
      rejects.push([lineNo, v.error, now].concat(raw[i]));
      continue;
    }
    var key = normalizeEn_(v.row.en);
    if (existing[key] || seenInBatch[key]) {
      duplicates++;
      rejects.push([lineNo, 'duplicate of an existing card', now].concat(raw[i]));
      continue;
    }
    seenInBatch[key] = true;

    var itemId = makeId_('i');
    var r = v.row;
    ['recog', 'prod'].forEach(function (dir) {
      var row = [];
      var values = {
        card_id: makeId_('c'), item_id: itemId, direction: dir, type: r.type,
        en: r.en, ru: r.ru, example_en: r.example_en, example_ru: r.example_ru,
        layer: r.layer, topic: r.topic, note: r.note, breakdown: r.breakdown,
        state: dir === 'recog' ? 'new' : 'locked',
        due: '', stability: '', difficulty: '', reps: 0, lapses: 0,
        last_review: '', created_at: now, user_id: userId, source_batch: batch,
        first_review: ''
      };
      CARD_COLUMNS.forEach(function (c) { row.push(values[c]); });
      cardRows.push(row);
    });
  }

  if (cardRows.length) appendCards_(cardRows);

  if (rejects.length) {
    var rj = sheet_(SHEET_REJECTS);
    var width = 3 + IMPORT_COLUMNS.length;
    var padded = rejects.map(function (r) {
      while (r.length < width) r.push('');
      return r.slice(0, width);
    });
    rj.getRange(rj.getLastRow() + 1, 1, padded.length, width).setValues(padded);
  }

  // Clear the inbox only after everything above succeeded.
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, IMPORT_COLUMNS.length).clearContent();

  return {
    accepted: cardRows.length / 2,
    cards_created: cardRows.length,
    rejected: rejects.length - duplicates,
    duplicates: duplicates,
    batch: batch
  };
}

/** Removes every card from one import batch. The escape hatch for a bad load. */
function rollbackBatch(batchId) {
  var sh = sheet_(SHEET_CARDS);
  var cards = readCards_();
  var rows = cards.filter(function (c) { return String(c.source_batch) === String(batchId); })
    .map(function (c) { return c._row; })
    .sort(function (a, b) { return b - a; });   // delete bottom-up so indices hold
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    rows.forEach(function (r) { sh.deleteRow(r); });
  } finally {
    lock.releaseLock();
  }
  return rows.length;
}
