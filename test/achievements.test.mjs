/**
 * Ачивки: node test/achievements.test.mjs
 *
 * Набор существует потому, что проверить их вживую невозможно: чтобы увидеть
 * «30 дней подряд», нужно тридцать дней. Функция чистая — значит серия, удержание
 * и стабильность подставляются числом, и весь набор считается за миллисекунды.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scope = {};
new Function('exports', readFileSync(join(root, 'gas', 'Achievements.gs'), 'utf8') +
  '\nObject.assign(exports, {evaluateAchievements});')(scope);
const { evaluateAchievements } = scope;

let passed = 0; const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failures.push(name); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }

function stats(over = {}) {
  const base = {
    blocks: {
      vocab: { total: 0, learned: 0, in_progress: 0, fresh: 0, leeches: 0,
        reviews_7d: 0, reviews_30d: 0, retention_7d: null, retention_30d: null,
        avg_stability_days: null },
      grammar: { total: 0, learned: 0, in_progress: 0, fresh: 0, leeches: 0,
        reviews_7d: 0, reviews_30d: 0, retention_7d: null, retention_30d: null,
        avg_stability_days: null }
    },
    totals: { reviews_all_time: 0, streak_days: 0, active_days: 0 }
  };
  return {
    blocks: { vocab: { ...base.blocks.vocab, ...(over.vocab || {}) },
              grammar: { ...base.blocks.grammar, ...(over.grammar || {}) } },
    totals: { ...base.totals, ...(over.totals || {}) }
  };
}
const byId = (res, id) => res.list.filter(a => a.id === id)[0];

console.log('Ачивки');

check('на пустой базе не выдано ни одной', () => {
  const res = evaluateAchievements(stats());
  assert(res.unlocked === 0, 'выдано ' + res.unlocked + ' на нулевых метриках');
  assert(res.list.length > 10, 'список подозрительно короткий: ' + res.list.length);
});

check('прогресс считается, а не только факт выдачи', () => {
  const a = byId(evaluateAchievements(stats({ totals: { reviews_all_time: 50 } })), 'turbo');
  assert(!a.unlocked, 'выдано раньше цели');
  assert(Math.abs(a.progress - 0.5) < 0.001, 'прогресс ' + a.progress + ', ожидался 0.5');
});

check('прогресс не выходит за единицу при перевыполнении', () => {
  const a = byId(evaluateAchievements(stats({ totals: { reviews_all_time: 99999 } })), 'turbo');
  assert(a.progress === 1, 'прогресс ' + a.progress + ' — полоса уедет за край');
});

check('серия открывает ступени по порядку, а не все сразу', () => {
  const res = evaluateAchievements(stats({ totals: { streak_days: 14, reviews_all_time: 5 } }));
  assert(byId(res, 'gear_up').unlocked, '3 дня не выдано при серии 14');
  assert(byId(res, 'flight_level').unlocked, '14 дней не выдано при серии 14');
  assert(!byId(res, 'autopilot').unlocked, '30 дней выдано при серии 14');
});

check('«ТО пройдено» не выдаётся, пока есть пиявки', () => {
  const dirty = evaluateAchievements(stats({
    vocab: { leeches: 1 }, totals: { reviews_all_time: 5000 } }));
  assert(!byId(dirty, 'maintenance').unlocked,
    'выдано при наличии пиявок — условие «и ни одной пиявки» не работает');
  const clean = evaluateAchievements(stats({
    vocab: { leeches: 0 }, totals: { reviews_all_time: 5000 } }));
  assert(byId(clean, 'maintenance').unlocked, 'не выдано при чистой базе и 5000 повторений');
});

check('S line требует и удержания, и объёма', () => {
  const few = evaluateAchievements(stats({ vocab: { reviews_7d: 10, retention_7d: 1 } }));
  assert(!byId(few, 's_line').unlocked,
    'выдано за 10 повторений — на такой выборке 100% ничего не значат');
  const enough = evaluateAchievements(stats({ vocab: { reviews_7d: 60, retention_7d: 0.93 } }));
  assert(byId(enough, 's_line').unlocked, 'не выдано при 60 повторениях и 93%');
});

check('анти-ачивка появляется только когда заслужена', () => {
  const fresh = evaluateAchievements(stats());
  assert(!byId(fresh, 'parking_brake'),
    'упрёк показан новичку, который ещё ничего не успел нарушить');
  const lapsed = evaluateAchievements(stats({ totals: { streak_days: 0, reviews_all_time: 300 } }));
  assert(byId(lapsed, 'parking_brake'), 'серия прервана, а тормоз не показан');
});

check('null в метриках не ломает счёт', () => {
  const res = evaluateAchievements(stats({ vocab: { retention_30d: null, avg_stability_days: null } }));
  res.list.forEach(a => {
    assert(Number.isFinite(a.progress), a.id + ': прогресс ' + a.progress);
    assert(Number.isFinite(a.current), a.id + ': current ' + a.current);
  });
});

check('у каждой ачивки есть заголовок, подсказка и текст', () => {
  evaluateAchievements(stats({ totals: { streak_days: 0, reviews_all_time: 1 } })).list
    .forEach(a => {
      assert(a.title && a.hint && a.note, a.id + ': не хватает текста');
      assert(a.title.length <= 32, a.id + ': заголовок не влезет в плитку — ' + a.title);
    });
});

check('идентификаторы уникальны', () => {
  const ids = evaluateAchievements(stats({ totals: { streak_days: 0, reviews_all_time: 1 } }))
    .list.map(a => a.id);
  assert(new Set(ids).size === ids.length, 'дубликаты id: ' + ids.join(','));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
