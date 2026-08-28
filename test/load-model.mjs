/**
 * Simulates real review load against the actual scheduler.
 * Not a test — a measurement tool. The GATE 1 recommendation of 6 new words/day
 * rests on the "steady load = new * 5" rule of thumb; this checks it.
 *
 *   node test/load-model.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'gas', 'Fsrs.gs'), 'utf8');
const scope = {};
new Function('exports', source + '\nObject.assign(exports, {fsrsReview, fsrsRetrievability});')(scope);
const { fsrsReview, fsrsRetrievability } = scope;

let rng = 987654321;
const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;

function simulate({ newWordsPerDay, retention, days, unlockAt = 21, missEvery = 0 }) {
  const cards = [];                       // {stability, difficulty, reps, lapses, due, locked, itemId}
  let nextItem = 0;
  const perDay = [];

  for (let day = 1; day <= days; day++) {
    const skipped = missEvery > 0 && day % missEvery === 0;

    // introduce new words: recognition card active, production card locked
    if (!skipped) {
      for (let i = 0; i < newWordsPerDay; i++) {
        const itemId = nextItem++;
        cards.push({ stability: null, difficulty: null, reps: 0, lapses: 0, due: day, locked: false, itemId, dir: 'recog' });
        cards.push({ stability: null, difficulty: null, reps: 0, lapses: 0, due: null, locked: true, itemId, dir: 'prod' });
      }
    }

    if (skipped) { perDay.push(0); continue; }

    const due = cards.filter(c => !c.locked && c.lapses < 5 && c.due !== null && c.due <= day);
    let reviews = 0;

    for (const c of due) {
      const elapsed = c.reps === 0 ? 0 : Math.max(day - c.lastDay, 0);
      const r = c.reps === 0 ? 1 : fsrsRetrievability(c.stability, elapsed);
      // recall succeeds with probability r; ratings mimic a real user
      let rating;
      if (rand() > r) rating = 1;
      else rating = rand() < 0.12 ? 4 : (rand() < 0.18 ? 2 : 3);

      const out = fsrsReview(c, rating, elapsed, { desiredRetention: retention, fuzzSeed: rand() });
      c.stability = out.stability; c.difficulty = out.difficulty;
      c.reps = out.reps; c.lapses = out.lapses;
      c.due = day + out.intervalDays; c.lastDay = day;
      reviews++;

      // unlock the production sibling once recognition matured
      if (c.dir === 'recog' && out.intervalDays >= unlockAt) {
        const sib = cards.find(x => x.itemId === c.itemId && x.dir === 'prod' && x.locked);
        if (sib) { sib.locked = false; sib.due = day + 1; }
      }
    }
    perDay.push(reviews);
  }

  const last30 = perDay.slice(-30).filter(v => v > 0);
  const avg = last30.reduce((a, b) => a + b, 0) / last30.length;
  const peak = Math.max(...perDay);
  const active = cards.filter(c => !c.locked && c.lapses < 5).length;
  const leeches = cards.filter(c => c.lapses >= 5).length;
  return { avg, peak, perDay, activeCards: active, leeches, words: nextItem };
}

const SEC_PER_CARD = 8;
function minutes(reviews) { return (reviews * SEC_PER_CARD / 60).toFixed(1); }

console.log('Steady-state load after 180 days, desired retention 0.85, 8 s per card\n');
console.log('new words/day |  reviews/day  |  minutes/day  |  ×new  | активных карточек | пиявок | слов');
console.log('--------------+---------------+---------------+--------+-------------------+--------+------');
for (const n of [4, 6, 10, 15, 20]) {
  const r = simulate({ newWordsPerDay: n, retention: 0.85, days: 180 });
  console.log(
    String(n).padStart(13) + ' | ' +
    r.avg.toFixed(0).padStart(13) + ' | ' +
    minutes(r.avg).padStart(13) + ' | ' +
    (r.avg / n).toFixed(1).padStart(6) + ' | ' +
    String(r.activeCards).padStart(17) + ' | ' +
    String(r.leeches).padStart(6) + ' | ' +
    String(r.words).padStart(5)
  );
}

console.log('\nSame at retention 0.90 — the lever GATE 1 claims is the strongest one\n');
console.log('new words/day |  reviews/day  |  minutes/day  |  ×new');
console.log('--------------+---------------+---------------+-------');
for (const n of [6, 10]) {
  const r = simulate({ newWordsPerDay: n, retention: 0.90, days: 180 });
  console.log(String(n).padStart(13) + ' | ' + r.avg.toFixed(0).padStart(13) + ' | ' +
    minutes(r.avg).padStart(13) + ' | ' + (r.avg / n).toFixed(1).padStart(5));
}

console.log('\nMissing every 3rd day, 6 new words/day, retention 0.85');
const miss = simulate({ newWordsPerDay: 6, retention: 0.85, days: 180, missEvery: 3 });
const clean = simulate({ newWordsPerDay: 6, retention: 0.85, days: 180 });
console.log(`  без пропусков: ${clean.avg.toFixed(0)} повторений/день, пик ${clean.peak}`);
console.log(`  с пропусками:  ${miss.avg.toFixed(0)} повторений/день, пик ${miss.peak}`);
console.log(`  пиявок: ${clean.leeches} против ${miss.leeches}`);
