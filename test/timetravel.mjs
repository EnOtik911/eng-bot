/**
 * Прогоняет каждый набор с системной датой, сдвинутой вперёд:
 *   node test/timetravel.mjs
 *
 * Существует потому, что session-server.test.mjs держал захардкоженную дату и проходил
 * ровно один календарный день — 28 августа. На 30-е он упал, и упал бы посреди любой
 * другой работы. Хуже того, в нём лежала карточка с `due` в будущем, которая через
 * одиннадцать дней стала бы прошлым молча, поменяв смысл проверки без единой ошибки.
 *
 * Сдвиги подобраны так, чтобы пересечь границы, на которых такое ломается: завтра,
 * через две недели, через полгода.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const SHIFTS = [1, 14, 180];

// Параметры идут через окружение, а не через argv: при запуске через `node -e`
// argv раскладывается иначе, и раннер падал ещё до импорта набора — а падение
// раннера выглядело точно так же, как падение всех наборов сразу.
const runner = `
const shift = Number(process.env.TT_SHIFT) * 86400000;
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (!a.length) super(RealDate.now() + shift); else super(...a); }
  static now() { return RealDate.now() + shift; }
}
globalThis.Date = FakeDate;
await import(process.env.TT_TARGET);
`;

const suites = readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();
let failed = 0;

for (const shift of SHIFTS) {
  const broken = [];
  for (const s of suites) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', runner], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        TT_SHIFT: String(shift),
        TT_TARGET: pathToFileURL(join(here, s)).href
      })
    });
    if (r.status !== 0) {
      const out = (r.stdout + r.stderr).trim().split('\n');
      // Берём строку с FAIL, а не последнюю: последняя у Node — это версия.
      const why = out.find(l => l.includes('FAIL')) || out.find(l => l.includes('Error')) ||
        out[out.length - 1];
      broken.push(s + ' — ' + why.trim());
    }
  }
  if (broken.length) {
    failed += broken.length;
    console.log('  FAIL при сдвиге на +' + shift + ' дней:');
    broken.forEach(b => console.log('         ' + b));
  } else {
    console.log('  ok   все ' + suites.length + ' наборов проходят при сдвиге на +' + shift + ' дней');
  }
}

console.log(failed ? '\n' + failed + ' набор(ов) зависят от календаря' :
  '\nни один набор не зависит от календарной даты');
process.exit(failed ? 1 : 0);
