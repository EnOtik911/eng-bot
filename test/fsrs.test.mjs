/**
 * Runs gas/Fsrs.gs as-is — one source of truth for backend and tests.
 *   node test/fsrs.test.mjs
 *   node test/fsrs.test.mjs --demo-red    # proves the constant test really bites
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
let source = readFileSync(join(here, '..', 'gas', 'Fsrs.gs'), 'utf8');

const DEMO_RED = process.argv.includes('--demo-red');
if (DEMO_RED) {
  // Corrupt the FACTOR derivation the way a typo would. The identity tests must catch it.
  source = source.replace('Math.pow(0.9, 1 / decay) - 1', 'Math.pow(0.8, 1 / decay) - 1');
}

const scope = {};
new Function('exports', source + '\nObject.assign(exports, {fsrsReview, fsrsInterval, fsrsRetrievability, FSRS_DEFAULT_W, FSRS_MAX_INTERVAL_DAYS});')(scope);
const { fsrsReview, fsrsInterval, fsrsRetrievability, FSRS_DEFAULT_W, FSRS_MAX_INTERVAL_DAYS } = scope;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failures.push(name + ' — ' + e.message);
    console.log('  FAIL ' + name + '\n         ' + e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function close(a, b, eps, msg) {
  if (Math.abs(a - b) > eps) throw new Error(`${msg}: ${a} vs ${b} (eps ${eps})`);
}

console.log('FSRS-6 scheduler' + (DEMO_RED ? '  [DEMO-RED: FACTOR derivation deliberately corrupted]' : ''));

check('derivation consistent: interval(S, 0.9) === round(S)', () => {
  for (const S of [1, 3, 10, 42, 365]) {
    close(fsrsInterval(S, 0.9), Math.round(S), 0.5,
      `at S=${S} the 0.9-retention interval must equal stability`);
  }
});

check('derivation consistent: R(S, S) === 0.9', () => {
  for (const S of [1, 10, 100]) close(fsrsRetrievability(S, S), 0.9, 1e-6, `R(${S},${S})`);
});

check('golden values pin the actual weights', () => {
  // These are the only assertions that would catch a typo in FSRS_DEFAULT_W itself.
  // The two identity tests above cannot: FACTOR is derived from w20, so w20 cancels out.
  close(FSRS_DEFAULT_W.length, 21, 0, 'FSRS-6 has 21 weights');
  for (const [rating, expected] of [[1, 0.212], [2, 1.2931], [3, 2.3065], [4, 8.2956]]) {
    close(fsrsReview({}, rating, 0, { fuzzSeed: 0.5 }).stability, expected, 1e-9,
      `initial stability for rating ${rating} must equal w[${rating - 1}]`);
  }
  close(fsrsReview({}, 3, 0, { fuzzSeed: 0.5 }).difficulty, 6.4133 - Math.exp(0.8334 * 2) + 1, 1e-9,
    'initial difficulty for Good must follow w4 - exp(w5*(g-1)) + 1');
});

check('retrievability decreases with elapsed time', () => {
  let prev = Infinity;
  for (const t of [0, 1, 5, 20, 100, 1000]) {
    const r = fsrsRetrievability(10, t);
    assert(r < prev, `R must fall: t=${t} gave ${r} >= ${prev}`);
    assert(r > 0 && r <= 1, `R out of range at t=${t}: ${r}`);
    prev = r;
  }
});

check('lower desired retention gives longer intervals', () => {
  const a = fsrsInterval(20, 0.95), b = fsrsInterval(20, 0.9), c = fsrsInterval(20, 0.85);
  assert(a < b && b < c, `expected 0.95 < 0.9 < 0.85, got ${a}, ${b}, ${c}`);
  assert(c / b > 1.5, `0.85 should be well above 1.5x of 0.9, got ${(c / b).toFixed(2)}x`);
});

check('new card: easy beats good beats hard beats again', () => {
  const s = [1, 2, 3, 4].map(r => fsrsReview({}, r, 0, { fuzzSeed: 0.5 }).stability);
  for (let i = 1; i < s.length; i++) {
    assert(s[i] > s[i - 1], `stability must rise with rating: ${JSON.stringify(s)}`);
  }
});

check('again on a mature card cuts stability and counts a lapse', () => {
  const mature = { stability: 60, difficulty: 5, reps: 8, lapses: 0 };
  const out = fsrsReview(mature, 1, 60, { desiredRetention: 0.85, fuzzSeed: 0.5 });
  assert(out.stability < mature.stability, `stability must drop: ${out.stability}`);
  assert(out.lapses === 1, `lapses must increment, got ${out.lapses}`);
  assert(out.lapsed === true, 'lapsed flag must be set');
});

check('good on a mature card raises stability', () => {
  const mature = { stability: 30, difficulty: 5, reps: 5, lapses: 0 };
  const out = fsrsReview(mature, 3, 30, { desiredRetention: 0.85, fuzzSeed: 0.5 });
  assert(out.stability > mature.stability, `stability must rise: ${out.stability}`);
  assert(out.lapses === 0, 'no lapse on a successful review');
});

check('first review never counts as a lapse', () => {
  const out = fsrsReview({}, 1, 0, { fuzzSeed: 0.5 });
  assert(out.lapses === 0, `a brand-new card rated Again must not lapse, got ${out.lapses}`);
});

check('same-day repeat does not explode stability', () => {
  const card = { stability: 5, difficulty: 5, reps: 1, lapses: 0 };
  const out = fsrsReview(card, 3, 0, { desiredRetention: 0.85, fuzzSeed: 0.5 });
  assert(out.stability >= card.stability, 'same-day good must not reduce stability');
  assert(out.stability < card.stability * 3, `same-day gain too large: ${out.stability}`);
});

check('1000 random reviews keep every value in range', () => {
  let card = { stability: null, difficulty: null, reps: 0, lapses: 0 };
  let rng = 12345;
  const next = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 1000; i++) {
    const rating = 1 + Math.floor(next() * 4);
    const elapsed = Math.floor(next() * 90);
    const out = fsrsReview(card, rating, elapsed,
      { desiredRetention: 0.85, fuzzSeed: next() });
    assert(Number.isFinite(out.stability), `stability not finite at i=${i}`);
    assert(out.stability >= 0.001, `stability underflow at i=${i}: ${out.stability}`);
    assert(out.difficulty >= 1 && out.difficulty <= 10,
      `difficulty out of [1,10] at i=${i}: ${out.difficulty}`);
    assert(Number.isInteger(out.intervalDays), `interval not integer at i=${i}`);
    assert(out.intervalDays >= 1 && out.intervalDays <= FSRS_MAX_INTERVAL_DAYS,
      `interval out of range at i=${i}: ${out.intervalDays}`);
    card = { stability: out.stability, difficulty: out.difficulty, reps: out.reps, lapses: out.lapses };
  }
});

check('rating order is monotone in interval for one state', () => {
  const card = { stability: 20, difficulty: 5, reps: 4, lapses: 0 };
  const iv = [1, 2, 3, 4].map(r =>
    fsrsReview(card, r, 20, { desiredRetention: 0.85, fuzzSeed: 0.5 }).intervalDays);
  for (let i = 1; i < iv.length; i++) {
    assert(iv[i] >= iv[i - 1], `interval must not shrink with a better rating: ${iv}`);
  }
});

check('fuzz stays inside +/-5% and is deterministic with a seed', () => {
  const base = fsrsReview({ stability: 100, difficulty: 5, reps: 5, lapses: 0 }, 3, 100,
    { desiredRetention: 0.85, fuzzSeed: 0.5 }).intervalDays;
  const lo = fsrsReview({ stability: 100, difficulty: 5, reps: 5, lapses: 0 }, 3, 100,
    { desiredRetention: 0.85, fuzzSeed: 0 }).intervalDays;
  const hi = fsrsReview({ stability: 100, difficulty: 5, reps: 5, lapses: 0 }, 3, 100,
    { desiredRetention: 0.85, fuzzSeed: 1 }).intervalDays;
  assert(lo < base && base < hi, `fuzz must move the interval: ${lo}, ${base}, ${hi}`);
  assert((hi - lo) / base < 0.12, `fuzz spread too wide: ${(hi - lo)} on ${base}`);
  const again = fsrsReview({ stability: 100, difficulty: 5, reps: 5, lapses: 0 }, 3, 100,
    { desiredRetention: 0.85, fuzzSeed: 0.5 }).intervalDays;
  assert(again === base, 'same seed must give the same interval');
});

check('bad rating is rejected loudly', () => {
  let threw = false;
  try { fsrsReview({}, 5, 0); } catch (e) { threw = true; }
  assert(threw, 'rating 5 must throw');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
