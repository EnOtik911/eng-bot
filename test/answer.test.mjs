/**
 * Answer checking: node test/answer.test.mjs
 *
 * The point of this suite is the boundary, not the happy path. A checker that is
 * too strict marks correct English wrong and teaches you to distrust it; one that
 * is too loose accepts the exact error the exercise exists to catch. Both halves
 * are asserted here, and the negative half is the one that matters.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const window = {};
new Function('window', readFileSync(join(here, '..', 'app', 'answer.js'), 'utf8'))(window);
const A = window.Answer;

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }
function accepts(input, answer) {
  assert(A.check(input, answer) === true,
    'должно приниматься: "' + input + '" против "' + answer + '"\n         canon: "' +
    A.canon(input) + '" vs "' + A.canon(String(answer).split('||')[0]) + '"');
}
function rejects(input, answer) {
  assert(A.check(input, answer) === false,
    'должно отклоняться: "' + input + '" против "' + answer + '"');
}

console.log('Проверка ответа');

check('регистр, лишние пробелы и знаки не влияют', () => {
  accepts('is  the   REPORT correct!!', 'Is the report correct?');
  accepts('we rolled it out last week', 'We rolled it out last week.');
});

check('сокращения принимаются в обе стороны', () => {
  accepts("I haven't seen this report yet", 'I have not seen this report yet.');
  accepts('I have not seen this report yet', "I haven't seen this report yet.");
  accepts("we're discussing the scope", 'We are discussing the scope.');
  accepts("I've finished the analysis", 'I have finished the analysis.');
});

check('нерегулярные отрицания не превращаются в мусор', () => {
  accepts("he won't approve it", 'He will not approve it.');
  accepts("she can't see the folio", 'She cannot see the folio.');
  accepts('she can not see the folio', "She can't see the folio.");
  assert(A.canon("won't") === 'will not', "won't → " + A.canon("won't"));
});

check("'s разбирается по следующему слову, а не наугад", () => {
  accepts("she's been working here", 'She has been working here.');
  accepts("she's late", 'She is late.');
});

check("'s в притяжательном не ломает предложение", () => {
  // "the guest's folio" не должно превратиться в "the guest is folio":
  // список хостов для раскрытия закрытый именно из-за этого.
  assert(A.canon("the guest's folio").indexOf(' is ') < 0,
    'притяжательное раскрылось как is: ' + A.canon("the guest's folio"));
  accepts("the guest's folio is empty", "The guest's folio is empty.");
});

check('альтернативы через || принимаются все', () => {
  const ans = 'I have worked here since 2023.||I have been here since 2023.';
  accepts('I have worked here since 2023', ans);
  accepts('I have been here since 2023', ans);
  rejects('I work here since 2023', ans);
});

check('ошибка, ради которой упражнение существует, отклоняется', () => {
  rejects('Does the system supports two currencies?', 'Does the system support two currencies?');
  rejects('I work at JET Sharing since 2023.', 'I have worked at JET Sharing since 2023.');
  rejects('I have sent the report yesterday.', 'I sent the report yesterday.');
  rejects('She have owned the migration since April.', 'She has owned the migration since April.');
  rejects('We found a edge case in the import.', 'We found an edge case in the import.');
  rejects('havent seen it', 'have not seen it');
});

check('пустой ввод никогда не верен', () => {
  rejects('', 'anything at all');
  rejects('   ', 'anything at all');
});

check('порядок слов значим — иначе scramble бессмыслен', () => {
  rejects('report the is correct', 'Is the report correct?');
  accepts('Is the report correct', 'Is the report correct?');
});

check('подсказка размечает форму, а не вставляет HTML', () => {
  const out = A.formatHint('Нужен `am`, а <script> должен остаться текстом');
  assert(out.indexOf('<code>am</code>') >= 0, 'бэктики не стали code: ' + out);
  assert(out.indexOf('<script>') < 0, 'HTML не экранирован: ' + out);
});

check('перемешивание не возвращает исходный порядок', () => {
  const src = ['I', 'am', 'a', 'product', 'manager'];
  let identical = 0;
  for (let i = 0; i < 200; i++) {
    const out = A.shuffle(src);
    assert(out.length === src.length, 'длина изменилась');
    assert(out.slice().sort().join() === src.slice().sort().join(), 'состав изменился');
    if (out.every((v, k) => v === src[k])) identical++;
  }
  assert(identical === 0, 'исходный порядок вернулся ' + identical + ' раз из 200');
  assert(A.shuffle(['one']).length === 1, 'один элемент должен выживать');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
