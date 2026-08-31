/**
 * Ачивки.
 *
 * ЧИСТАЯ функция от того, что вернул buildStats: ни одного обращения к таблице,
 * ни одного new Date(). Поэтому весь набор проверяется юнит-тестом на выдуманных
 * числах, а не «прокликиванием» вживую — а прокликать тридцатидневную серию
 * вживую нельзя в принципе.
 *
 * Выданные ачивки хранятся в settings отдельно (grantAchievements_), но экран
 * от хранилища не зависит: список каждый раз выводится из метрик заново. Потеря
 * строки в settings стоит одного уведомления в чат, а не самих достижений.
 *
 * Про тон: чёрный юмор — сознательный выбор владельца. Единственная граница,
 * которую я держу сам: ни одной шутки про реальные катастрофы и погибших.
 * Корпоративные скандалы, прокрастинация и самоирония — сколько угодно.
 */

function pct_(cur, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(1, cur / target));
}

function evaluateAchievements(stats) {
  var v = stats.blocks.vocab;
  var g = stats.blocks.grammar;
  var t = stats.totals;

  var defs = [
    { id: 'taxiing', title: 'Руление', hint: 'Первые 10 повторений',
      note: 'Ещё никуда не летим, но двигатели уже жрут.',
      cur: t.reviews_all_time, target: 10 },

    { id: 'first_flight', title: 'Первый взлёт', hint: 'Первая закрытая сессия',
      note: 'Отрыв произошёл. Дальше только набор высоты и турбулентность.',
      cur: Math.min(t.reviews_all_time, 1), target: 1 },

    { id: 'second_engine', title: 'Второй двигатель', hint: 'Первая сессия грамматики',
      note: 'На одном тоже летают. Просто не так далеко.',
      cur: Math.min(g.reviews_30d + (g.learned ? 1 : 0), 1), target: 1 },

    { id: 'gear_up', title: 'Шасси убраны', hint: '3 дня подряд',
      note: 'Три дня — это уже не случайность, это пока ещё не привычка.',
      cur: t.streak_days, target: 3 },

    { id: 'flight_level', title: 'Занял эшелон', hint: '14 дней подряд',
      note: 'Две недели. Организм смирился.',
      cur: t.streak_days, target: 14 },

    { id: 'autopilot', title: 'Автопилот', hint: '30 дней подряд',
      note: 'Решения принимает расписание. Ты просто на борту.',
      cur: t.streak_days, target: 30 },

    { id: 'turbo', title: 'Турбина раскрутилась', hint: '100 повторений',
      note: 'Лаг закончился, началась тяга.',
      cur: t.reviews_all_time, target: 100 },

    { id: 'quattro', title: 'Quattro', hint: '444 повторения',
      note: 'Четыре кольца, четыре сотни. Сцепление с материалом на всех колёсах.',
      cur: t.reviews_all_time, target: 444 },

    { id: 'black_box', title: 'Чёрный ящик', hint: '1000 повторений',
      note: 'Записано всё. В том числе то, что ты предпочёл бы не вспоминать.',
      cur: t.reviews_all_time, target: 1000 },

    { id: 'rs6', title: 'RS6', hint: '500 повторений за 30 дней',
      note: 'Избыточная мощность для поездки за хлебом. И всё равно берут.',
      cur: v.reviews_30d + g.reviews_30d, target: 500 },

    { id: 'overhead_bin', title: 'Багажная полка', hint: '100 освоенных единиц',
      note: 'Ручная кладь набита. Взвешивать никто не станет.',
      cur: v.learned, target: 100 },

    { id: 'cruise', title: 'Крейсерский режим', hint: 'Средняя стабильность 21 день',
      note: 'Материал держится сам. Можно отстегнуть ремни.',
      cur: v.avg_stability_days || 0, target: 21 },

    { id: 's_line', title: 'S line', hint: 'Удержание 90% на 50+ повторениях за неделю',
      note: 'Внешне спортивно, под капотом обычный мотор. Работает же.',
      cur: (v.reviews_7d >= 50 && v.retention_7d !== null) ? Math.round(v.retention_7d * 100) : 0,
      target: 90 },

    { id: 'dieselgate', title: 'Дизельгейт', hint: 'Удержание 95% за месяц',
      note: 'Показатели подозрительно хорошие. Проверять, к счастью, некому.',
      cur: v.retention_30d !== null ? Math.round(v.retention_30d * 100) : 0, target: 95 },

    { id: 'go_around', title: 'Уход на второй круг', hint: '10 пиявок',
      note: 'Десять слов зашли неудачно. Это не про тебя, это про формулировки.',
      cur: v.leeches, target: 10 },

    { id: 'holding', title: 'Зона ожидания', hint: '200 слов в запасе',
      note: 'Двести единиц кружат и ждут разрешения на посадку.',
      cur: v.fresh, target: 200 },

    { id: 'maintenance', title: 'ТО пройдено', hint: '300 повторений и ни одной пиявки',
      note: 'Ни одного узла под замену. Подозрительно.',
      cur: (v.leeches === 0 ? t.reviews_all_time : 0), target: 300 }
  ];

  var unlocked = 0;
  var list = defs.map(function (d) {
    var done = d.cur >= d.target;
    if (done) unlocked++;
    return {
      id: d.id, title: d.title, hint: d.hint, note: d.note,
      unlocked: done,
      current: Math.round(d.cur), target: d.target,
      progress: +pct_(d.cur, d.target).toFixed(3)
    };
  });

  // Анти-ачивка: показывается ТОЛЬКО когда заслужена, иначе это просто упрёк
  // в интерфейсе на пустом месте.
  if (t.streak_days === 0 && t.reviews_all_time > 0) {
    list.push({
      id: 'parking_brake', title: 'Стояночный тормоз', hint: 'Серия прервана',
      note: 'Ты не занимался. Мы оба это знаем.',
      unlocked: true, current: 1, target: 1, progress: 1
    });
    unlocked++;
  }

  return { list: list, unlocked: unlocked, total: list.length };
}

/**
 * Диффует выданное с сохранённым и возвращает ТОЛЬКО новые — чтобы бот объявлял
 * их один раз, а не каждое утро заново.
 */
function grantAchievements_(stats) {
  var settings = readSettings_();
  var known = String(settings.achievements || '').split(',')
    .map(function (s) { return s.trim(); }).filter(Boolean);

  var earned = evaluateAchievements(stats).list
    .filter(function (a) { return a.unlocked; }).map(function (a) { return a.id; });

  var fresh = earned.filter(function (id) { return known.indexOf(id) < 0; });
  if (fresh.length) writeSetting_('achievements', known.concat(fresh).join(','));
  return fresh;
}
