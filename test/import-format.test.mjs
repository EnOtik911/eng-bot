/**
 * Checks every data/*.tsv against the rules of ITS OWN importer:
 *   node test/import-format.test.mjs
 *
 * Two schemas live in data/ now, so the file is routed by its header. Routing rather
 * than skipping is deliberate: a suite that skips files it does not recognise would
 * let a new corpus sit unchecked, which is worse than the false failure that made this
 * necessary. An unrecognised header is a failure, not a pass.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const COLUMNS = ['type', 'en', 'ru', 'example_en', 'example_ru', 'layer', 'topic', 'note'];
const TYPES = ['word', 'collocation', 'phrase'];
const LAYERS = ['core', 'business', 'mobility', 'hospitality', 'tech'];
const norm = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
// Must stay identical to matchTokens_ / exampleUsesUnit_ in gas/Import.gs.
// Literal containment is impossible for collocations: determiners vary and verbs
// inflect. Token overlap catches the real failure — a wrongly paired sentence.
const matchTokens = s => norm(s)
  .replace(/[.,;:!?()"'\-]/g, ' ')
  .replace(/\b(a|an|the)\b/g, ' ')
  .split(/\s+/)
  .filter(t => t.length > 1);
const exampleUsesUnit = (en, example) => {
  const unit = matchTokens(en);
  if (!unit.length) return true;
  const words = matchTokens(example);
  const hit = unit.filter(t => words.some(w => w.includes(t) || t.includes(w))).length;
  return hit / unit.length >= 0.6;
};

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

// The rule was loosened twice to accommodate real English. These assertions prove it
// still rejects what it exists to reject — otherwise the loosening made it toothless.
console.log('Import format rules');

check('the match rule still rejects a wrongly paired example', () => {
  assert(!exampleUsesUnit('fleet utilization', 'The rate plan changes on weekends.'),
    'a completely unrelated sentence must be rejected');
  assert(!exampleUsesUnit('promo redemption', 'Room inventory syncs with the channel manager.'),
    'another unrelated pair must be rejected');
  assert(!exampleUsesUnit('attribution window', 'We use a seven day window.'),
    'half the unit present (1 of 2) is below the threshold and must be rejected');
});

check('the match rule accepts the variation it was loosened for', () => {
  assert(exampleUsesUnit('roll out a feature', 'We roll out the feature to ten percent of users.'),
    'determiner variation must pass');
  assert(exampleUsesUnit('take ownership of', 'She took ownership of the migration.'),
    'verb inflection must pass');
  assert(exampleUsesUnit('idle vehicle', 'We rebalance idle vehicles every morning.'),
    'plural must pass');
});

// Грамматический корпус проверяется своим валидатором — тем же, что и импорт.
const gscope = {};
new Function('sheet_', 'makeId_', 'exports',
  readFileSync(join(here, '..', 'gas', 'Config.gs'), 'utf8') + '\n' +
  readFileSync(join(here, '..', 'gas', 'GrammarImport.gs'), 'utf8') +
  '\nObject.assign(exports, {validateGrammarRow_, grammarItemKey_, GRAMMAR_IMPORT_COLUMNS});'
)(() => { throw new Error('sheet_ must not be called'); }, () => 'x', gscope);
const GRAMMAR_COLUMNS = gscope.GRAMMAR_IMPORT_COLUMNS;

const files = readdirSync(dataDir).filter(f => f.endsWith('.tsv'));
console.log('Import format (' + files.length + ' file(s))');

const vocabFiles = [];
const grammarFiles = [];

for (const file of files) {
  const text = readFileSync(join(dataDir, file), 'utf8');
  const lines = text.split('\n').filter(l => l.length > 0);
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map((l, i) => ({ line: i + 2, cells: l.split('\t') }));
  const isVocab = header.join('\t') === COLUMNS.join('\t');
  const isGrammar = header.join('\t') === GRAMMAR_COLUMNS.join('\t');

  check(file + ': header matches a known schema', () => {
    assert(isVocab || isGrammar,
      'заголовок не совпадает ни с лексической схемой, ни с грамматической.\n' +
      '         получено:   ' + header.join(', ') + '\n' +
      '         лексика:    ' + COLUMNS.join(', ') + '\n' +
      '         грамматика: ' + GRAMMAR_COLUMNS.join(', '));
  });

  if (isGrammar) {
    grammarFiles.push(file);

    check(file + ': every row has exactly ' + GRAMMAR_COLUMNS.length + ' cells', () => {
      rows.forEach(r => assert(r.cells.length === GRAMMAR_COLUMNS.length,
        `line ${r.line}: ${r.cells.length} cells`));
    });

    check(file + ': every row passes the real grammar import validator', () => {
      rows.forEach(r => {
        const v = gscope.validateGrammarRow_(r.cells);
        assert(!v.error, `line ${r.line}: ${v.error}`);
      });
    });

    check(file + ': no duplicate exercises', () => {
      const seen = new Map();
      rows.forEach(r => {
        const v = gscope.validateGrammarRow_(r.cells);
        if (v.error) return;
        const k = gscope.grammarItemKey_(v.row);
        assert(!seen.has(k), `line ${r.line} duplicates line ${seen.get(k)}`);
        seen.set(k, r.line);
      });
    });

    continue;
  }

  if (!isVocab) continue;
  vocabFiles.push(file);

  check(file + ': header matches IMPORT_COLUMNS', () => {
    assert(header.length === COLUMNS.length, `${header.length} columns, expected ${COLUMNS.length}`);
    COLUMNS.forEach((c, i) => assert(header[i] === c, `column ${i}: "${header[i]}" != "${c}"`));
  });

  check(file + ': every row has exactly 8 tab-separated cells', () => {
    rows.forEach(r => assert(r.cells.length === COLUMNS.length,
      `line ${r.line}: ${r.cells.length} cells`));
  });

  check(file + ': no quotes anywhere (TSV needs none, and models add them)', () => {
    rows.forEach(r => assert(!r.cells.join('').includes('"'), `line ${r.line} contains a quote`));
  });

  check(file + ': type and layer come from the enums', () => {
    rows.forEach(r => {
      assert(TYPES.includes(r.cells[0]), `line ${r.line}: bad type "${r.cells[0]}"`);
      assert(LAYERS.includes(r.cells[5]), `line ${r.line}: bad layer "${r.cells[5]}"`);
    });
  });

  check(file + ': en and ru are non-empty, en within 80 chars', () => {
    rows.forEach(r => {
      assert(r.cells[1].trim(), `line ${r.line}: empty en`);
      assert(r.cells[2].trim(), `line ${r.line}: empty ru`);
      assert(r.cells[1].length <= 80, `line ${r.line}: en is ${r.cells[1].length} chars`);
    });
  });

  check(file + ': collocation and phrase carry an example that uses the unit', () => {
    rows.forEach(r => {
      if (r.cells[0] === 'word') return;
      assert(r.cells[3].trim(), `line ${r.line}: missing example_en`);
      assert(exampleUsesUnit(r.cells[1], r.cells[3]),
        `line ${r.line}: example_en does not use "${r.cells[1]}"`);
    });
  });

  check(file + ': no duplicate units', () => {
    const seen = new Set();
    rows.forEach(r => {
      const k = norm(r.cells[1]);
      assert(!seen.has(k), `line ${r.line}: duplicate "${r.cells[1]}"`);
      seen.add(k);
    });
  });

  check(file + ': at least 70% are collocations or phrases', () => {
    const multi = rows.filter(r => r.cells[0] !== 'word').length;
    const share = multi / rows.length;
    assert(share >= 0.7, `only ${(share * 100).toFixed(0)}% multi-word — the unit of a card is a chunk, not a word`);
  });
}

check('every TSV in data/ was routed to a validator', () => {
  const routed = vocabFiles.length + grammarFiles.length;
  assert(routed === files.length,
    `файлов ${files.length}, проверено ${routed} — какой-то остался без валидатора`);
  console.log('         лексика: ' + (vocabFiles.join(', ') || '—'));
  console.log('         грамматика: ' + (grammarFiles.join(', ') || '—'));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
