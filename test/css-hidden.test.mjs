/**
 * The `hidden` attribute is defeated by any author `display` rule, because author
 * styles beat the browser's own stylesheet. Every element the app hides at runtime
 * whose class also sets `display` was therefore visible while marked hidden — which
 * is exactly what happened to the rating buttons.
 *
 * A browser is needed to test rendering; this checks the invariant that prevents the
 * class of bug instead: if any author rule sets `display`, the [hidden] guard must
 * exist. It fails if someone removes the guard, or adds a display rule without it.
 *
 *   node test/css-hidden.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'app', 'styles.css'), 'utf8');
const html = readFileSync(join(here, '..', 'app', 'index.html'), 'utf8');

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

console.log('CSS: hidden must actually hide');

// strip comments so prose about `display` does not count as a rule
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

check('some author rule sets display, so the guard is required', () => {
  const rules = code.match(/display\s*:\s*(grid|flex|block|inline-flex|inline-block|inline|table)/g) || [];
  assert(rules.length > 0,
    'no author display rules found — if that is now true the guard is optional, ' +
    'but check before deleting this test');
});

check('[hidden] guard is present with !important', () => {
  assert(/\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/.test(code),
    'styles.css must contain [hidden] { display: none !important; } — without it any ' +
    'class with an explicit display stays visible while the element is marked hidden');
});

check('every element hidden in markup is covered by the guard', () => {
  const ids = [...html.matchAll(/id="([^"]+)"[^>]*\shidden/g)].map(m => m[1]);
  assert(ids.length > 0, 'expected some elements to start hidden in index.html');
  // The guard is global, so presence is enough; this asserts the list is non-trivial
  // and prints it, so a reviewer sees what depends on the rule.
  console.log('         зависят от правила: ' + ids.join(', '));
});

check('the rating buttons in particular are hidden at start', () => {
  assert(/id="ratings"[^>]*\shidden/.test(html),
    'ratings must start hidden — revealing the answer is what unlocks them');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
