/** Client session machine: node test/session.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'app', 'session.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const Session = window.Session;

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name + ' — ' + e.message); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

function payload(n) {
  return {
    settings: { daily_new_target: 6, desired_retention: 0.85 },
    warnings: [],
    counts: { due: n, new_in_session: 0 },
    cards: Array.from({ length: n }, (_, i) => ({ card_id: 'c' + i, direction: 'recog', type: 'word', en: 'w' + i, ru: 'с' + i }))
  };
}

console.log('Client session machine');

check('queue drains one card at a time', () => {
  const s = new Session(payload(3));
  assert(s.remaining() === 3, 'remaining before start');
  s.next();
  assert(s.current.card_id === 'c0', 'first card');
  assert(s.remaining() === 3, 'current counts toward remaining');
  s.rate(3); s.next();
  assert(s.current.card_id === 'c1', 'second card');
});

check('again puts the card back into the queue', () => {
  const s = new Session(payload(5));
  s.next();
  const first = s.current.card_id;
  s.rate(1);
  assert(s.queue.some(c => c.card_id === first), 'card must return to the queue');
  assert(s.queue[3].card_id === first, 'reinserted after 3 others, got index ' +
    s.queue.findIndex(c => c.card_id === first));
});

check('again on the last card returns it immediately, not never', () => {
  const s = new Session(payload(1));
  s.next();
  s.rate(1);
  assert(s.remaining() === 1, 'the card must still be pending, got ' + s.remaining());
  s.next();
  assert(s.current.card_id === 'c0', 'and it must be the same card');
});

check('good, hard and easy do not requeue', () => {
  for (const r of [2, 3, 4]) {
    const s = new Session(payload(4));
    s.next();
    const id = s.current.card_id;
    s.rate(r);
    assert(!s.queue.some(c => c.card_id === id), 'rating ' + r + ' must not requeue');
  }
});

check('answered counts every press, including repeats of one card', () => {
  const s = new Session(payload(2));
  s.next(); s.rate(1);
  s.next(); s.rate(3);
  assert(s.answered === 2, 'answered should be 2, got ' + s.answered);
});

check('rating with no current card is a no-op, not a crash', () => {
  const s = new Session(payload(0));
  assert(s.rate(3) === null, 'must return null');
});

check('buffer entry carries card_id, rating and a timestamp', () => {
  const s = new Session(payload(1));
  s.next();
  const e = s.rate(3);
  assert(e.card_id === 'c0' && e.rating === 3, 'fields');
  assert(!Number.isNaN(Date.parse(e.ts)), 'ts must be a parseable ISO string');
});


/**
 * Пауза. Ответы и раньше не терялись — они уходят в буфер сразу после оценки — но
 * позиция жила только в памяти, и возврат после перерыва начинался с нуля.
 * Снимок обязан переживать пересоздание объекта, иначе «продолжить» соврёт.
 */
check('снимок возвращает ту же карточку, на которой остановились', () => {
  const s = new Session(payload(5));
  s.next(); s.rate(3);
  s.next(); s.rate(3);
  s.next();                       // показана, но не оценена — терять её нельзя
  const shown = s.current.card_id;

  const back = new Session(s.snapshot('2026-08-31'));
  back.next();
  assert(back.current.card_id === shown,
    'продолжили с ' + back.current.card_id + ', а остановились на ' + shown);
});

check('снимок сохраняет прогресс, а не пересчитывает его от остатка', () => {
  const s = new Session(payload(5));
  s.next(); s.rate(3);
  s.next(); s.rate(3);
  const back = new Session(s.snapshot('2026-08-31'));
  assert(back.answered === 2, 'пройдено ' + back.answered + ', ожидалось 2');
  assert(back.plannedTotal === 5,
    'исходный объём ' + back.plannedTotal + ', ожидалось 5 — иначе полоса прогресса врёт');
});

check('незаданная карточка не удваивается в снимке', () => {
  const s = new Session(payload(3));
  s.next();
  const snap = s.snapshot('2026-08-31');
  assert(snap.cards.length === 3, 'в снимке ' + snap.cards.length + ' карточек, ожидалось 3');
  assert(snap.cards[0].card_id === 'c0', 'текущая карточка должна быть первой');
});

check('практика помечена в сессии и переживает снимок', () => {
  const p = payload(2); p.practice = true;
  const s = new Session(p);
  assert(s.practice === true, 'флаг практики не прочитан из payload');
  assert(new Session(s.snapshot('2026-08-31')).practice === true, 'флаг потерян в снимке');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
