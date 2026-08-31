/**
 * Concatenates gas/*.gs into dist/all-in-one.gs so the project can be set up
 * entirely in the browser, with one paste instead of eleven.
 *
 * Apps Script loads every file into one global scope and hoists function
 * declarations, so a single file behaves identically to eleven.
 *
 *   node test/build-all-in-one.mjs          # write
 *   node test/build-all-in-one.mjs --check  # fail if stale (used by run-all.sh)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const order = ['Config.gs', 'Fsrs.gs', 'Store.gs', 'Auth.gs', 'Session.gs', 'Stats.gs', 'Achievements.gs',
  'Grammar.gs', 'Import.gs', 'GrammarImport.gs', 'GrammarSeed.gs',
  'Bot.gs', 'Triggers.gs', 'Diagnose.gs', 'Setup.gs', 'BankLoad.gs', 'Menu.gs', 'Main.gs'];

const present = readdirSync(join(root, 'gas')).filter(f => f.endsWith('.gs')).sort();
const missing = present.filter(f => !order.includes(f));
if (missing.length) {
  console.error('These files exist in gas/ but are not listed in the build order: ' +
    missing.join(', ') + '\nAdd them to `order` in test/build-all-in-one.mjs.');
  process.exit(1);
}

const parts = [
  '/**',
  ' * GENERATED — do not edit. Source of truth is gas/*.gs.',
  ' * Regenerate: node test/build-all-in-one.mjs',
  ' *',
  ' * Every gas/*.gs file concatenated in dependency order, for setting the project',
  ' * up in the browser without clasp: create a script, delete the default contents',
  ' * of Code.gs, paste this whole file.',
  ' */',
  ''
];
for (const f of order) {
  parts.push('// ' + '='.repeat(74));
  parts.push('// ' + f);
  parts.push('// ' + '='.repeat(74));
  parts.push('');
  parts.push(readFileSync(join(root, 'gas', f), 'utf8').trimEnd());
  parts.push('');
}
const out = parts.join('\n') + '\n';

const target = join(root, 'dist', 'all-in-one.gs');
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== out) {
    console.log('  FAIL dist/all-in-one.gs is stale — run: node test/build-all-in-one.mjs');
    process.exit(1);
  }
  console.log('  dist/all-in-one.gs matches gas/ (' + order.length + ' files, ' +
    out.split('\n').length + ' lines)');
} else {
  writeFileSync(target, out);
  console.log('wrote dist/all-in-one.gs — ' + order.length + ' files, ' +
    out.split('\n').length + ' lines');
}

// The concatenation must parse, or the browser path hands over broken code.
try { new Function(out); }
catch (e) { console.error('the concatenated file does not parse: ' + e.message); process.exit(1); }
