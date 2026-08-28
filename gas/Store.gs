/**
 * The only place that touches Sheets. Rules that everything else relies on:
 *  - read and write whole ranges, never a cell in a loop (two orders of magnitude)
 *  - the write lock is taken immediately before writing, never around a whole function
 *  - the scheduler never reads review_log; card state lives in the card row
 */

function ss_() {
  return SpreadsheetApp.openById(cfg_('SHEET_ID'));
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet tab is missing: ' + name + ' — run setupSpreadsheet()');
  return sh;
}

function logSheetName_() {
  return 'review_log_' + new Date().getFullYear();
}

/** One read of the whole cards tab as objects, plus the row index for writing back. */
function readCards_() {
  var sh = sheet_(SHEET_CARDS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, CARD_COLUMNS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < CARD_COLUMNS.length; c++) o[CARD_COLUMNS[c]] = values[i][c];
    out.push(o);
  }
  return out;
}

function readSettings_() {
  var sh = sheet_(SHEET_SETTINGS);
  var lastRow = sh.getLastRow();
  var out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    values.forEach(function (r) {
      if (r[0]) out[String(r[0]).trim()] = r[1] === null ? '' : String(r[1]).trim();
    });
  }
  return out;
}

function writeSetting_(key, value) {
  var sh = sheet_(SHEET_SETTINGS);
  var lastRow = sh.getLastRow();
  var keys = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sh.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

/**
 * Applies a batch of card updates in one write per contiguous block.
 * updates: [{ _row, patch: {column: value} }]
 */
function writeCardUpdates_(updates) {
  if (!updates.length) return 0;
  var sh = sheet_(SHEET_CARDS);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    // Read-modify-write of only the touched rows, one getValues + one setValues per row block.
    updates.sort(function (a, b) { return a._row - b._row; });
    var written = 0;
    var i = 0;
    while (i < updates.length) {
      var start = i;
      while (i + 1 < updates.length && updates[i + 1]._row === updates[i]._row + 1) i++;
      var firstRow = updates[start]._row;
      var count = updates[i]._row - firstRow + 1;
      var range = sh.getRange(firstRow, 1, count, CARD_COLUMNS.length);
      var block = range.getValues();
      for (var u = start; u <= i; u++) {
        var rowIdx = updates[u]._row - firstRow;
        var patch = updates[u].patch;
        Object.keys(patch).forEach(function (col) {
          var c = CARD_COLUMNS.indexOf(col);
          if (c < 0) throw new Error('Unknown card column: ' + col);
          block[rowIdx][c] = patch[col];
        });
        written++;
      }
      range.setValues(block);
      i++;
    }
    SpreadsheetApp.flush();
    return written;
  } finally {
    lock.releaseLock();
  }
}

function appendCards_(rows) {
  if (!rows.length) return 0;
  var sh = sheet_(SHEET_CARDS);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, CARD_COLUMNS.length).setValues(rows);
    SpreadsheetApp.flush();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function appendReviewLog_(rows) {
  if (!rows.length) return;
  var name = logSheetName_();
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, LOG_COLUMNS.length).setValues([LOG_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_COLUMNS.length).setValues(rows);
}

/** Idempotency: returns true when this batch was already applied. */
function flushSeen_(batchId) {
  var sh = sheet_(SHEET_FLUSH_LOG);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;
  var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(batchId)) return true;
  }
  return false;
}

function flushRecord_(batchId, count) {
  var sh = sheet_(SHEET_FLUSH_LOG);
  sh.appendRow([batchId, new Date().toISOString(), count]);
  var lastRow = sh.getLastRow();
  if (lastRow > 201) sh.deleteRows(2, lastRow - 201);   // keep the newest 200
}

/* ---------------------------------------------------------------------------
 * Grammar. Same two rules as above: whole ranges, lock only around the write.
 * The generic reader is worth the indirection here — patterns and items differ
 * only by their column list, and a second hand-rolled reader would be the third
 * copy of the same loop.
 * ------------------------------------------------------------------------- */

function readRows_(sheetName, columns) {
  var sh = sheet_(sheetName);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, columns.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < columns.length; c++) o[columns[c]] = values[i][c];
    out.push(o);
  }
  return out;
}

function writeRowUpdates_(sheetName, columns, updates) {
  if (!updates.length) return 0;
  var sh = sheet_(sheetName);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    updates.sort(function (a, b) { return a._row - b._row; });
    var written = 0;
    var i = 0;
    while (i < updates.length) {
      var start = i;
      while (i + 1 < updates.length && updates[i + 1]._row === updates[i]._row + 1) i++;
      var firstRow = updates[start]._row;
      var count = updates[i]._row - firstRow + 1;
      var range = sh.getRange(firstRow, 1, count, columns.length);
      var block = range.getValues();
      for (var u = start; u <= i; u++) {
        var rowIdx = updates[u]._row - firstRow;
        var patch = updates[u].patch;
        Object.keys(patch).forEach(function (col) {
          var c = columns.indexOf(col);
          if (c < 0) throw new Error('Unknown column in ' + sheetName + ': ' + col);
          block[rowIdx][c] = patch[col];
        });
        written++;
      }
      range.setValues(block);
      i++;
    }
    SpreadsheetApp.flush();
    return written;
  } finally {
    lock.releaseLock();
  }
}

function appendRows_(sheetName, columns, rows) {
  if (!rows.length) return 0;
  var sh = sheet_(sheetName);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('LOCKED');
  try {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, columns.length).setValues(rows);
    SpreadsheetApp.flush();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function readPatterns_() { return readRows_(SHEET_PATTERNS, PATTERN_COLUMNS); }
function readGrammarItems_() { return readRows_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS); }

function writePatternUpdates_(updates) {
  return writeRowUpdates_(SHEET_PATTERNS, PATTERN_COLUMNS, updates);
}
function writeGrammarItemUpdates_(updates) {
  return writeRowUpdates_(SHEET_GRAMMAR_ITEMS, GRAMMAR_ITEM_COLUMNS, updates);
}

function grammarLogSheetName_() {
  return 'grammar_log_' + new Date().getFullYear();
}

function appendGrammarLog_(rows) {
  if (!rows.length) return;
  var name = grammarLogSheetName_();
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, GRAMMAR_LOG_COLUMNS.length)
      .setValues([GRAMMAR_LOG_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, GRAMMAR_LOG_COLUMNS.length).setValues(rows);
}
