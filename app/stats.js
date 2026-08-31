/**
 * Экран «Прогресс»: метрики по блокам, динамика и ачивки.
 *
 * Графики рисуются инлайновым SVG без библиотеки — по той же причине, что и
 * анимации (см. комментарий про движение в styles.css): столбики и ломаная это
 * десяток строк арифметики, а CDN-зависимость в офлайн-первом приложении стоит
 * и байтов на LTE, и самой возможности работать без сети.
 *
 * Все числа приходят с сервера готовыми. Клиент не считает ни среднего, ни
 * удержания: журнал повторений растёт и тащить его на телефон нельзя.
 */
(function () {
  var T = window.I18N.ru;
  var el = function (id) { return document.getElementById(id); };
  var state = null;

  function pluralRu(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function pct(v) { return v === null || v === undefined ? '—' : Math.round(v * 100) + '%'; }
  function num(v) { return v === null || v === undefined ? '—' : String(v); }

  function row(label, value) {
    return '<div class="st-row"><span class="st-k">' + label +
      '</span><span class="st-v">' + value + '</span></div>';
  }

  /**
   * Возвращает ТОЛЬКО строки, без карточки-обёртки: обёртка стоит в разметке.
   * Класс .card несёт backdrop-filter, и печатать его из кода значит снять
   * ограничение на число стёкол — css-perf.test.mjs это ловит намеренно.
   */
  function blockRows(b) {
    return '' +
      row('Освоено', num(b.learned) + ' из ' + num(b.total)) +
      row('В работе', num(b.in_progress)) +
      row('В запасе', num(b.fresh)) +
      (b.leeches ? row('Пиявок', num(b.leeches)) : '') +
      row('Удержание за 30 дней', pct(b.retention_30d)) +
      row('Повторений за 30 дней', num(b.reviews_30d)) +
      row('Средняя стабильность', b.avg_stability_days === null ? '—'
        : b.avg_stability_days + ' ' + pluralRu(Math.round(b.avg_stability_days), 'день', 'дня', 'дней'));
  }

  /**
   * Столбики повторений. Лексика и грамматика стопкой: важен общий объём дня,
   * а разделение показывает, чем именно он набран.
   */
  function bars(days, a, b) {
    var W = 300, H = 72, gap = 1.6;
    var bw = (W - gap * (days.length - 1)) / days.length;
    var max = Math.max(1, Math.max.apply(null, days.map(function (_, i) { return a[i] + b[i]; })));
    var out = [];
    for (var i = 0; i < days.length; i++) {
      var x = i * (bw + gap);
      var ha = (a[i] / max) * H, hb = (b[i] / max) * H;
      if (hb) out.push('<rect x="' + x.toFixed(1) + '" y="' + (H - hb).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + hb.toFixed(1) + '" class="st-bar st-bar-g"/>');
      if (ha) out.push('<rect x="' + x.toFixed(1) + '" y="' + (H - hb - ha).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + ha.toFixed(1) + '" class="st-bar st-bar-v"/>');
    }
    return '<svg class="st-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="Повторений по дням за 30 дней">' + out.join('') + '</svg>';
  }

  /** Накопленный словарь: ломаная. Ось Y начинается не с нуля, а с базы окна. */
  function line(values) {
    var W = 300, H = 56;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = Math.max(1, max - min);
    var pts = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * W;
      var y = H - ((v - min) / span) * (H - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="st-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="Освоено единиц, накопительно">' +
      '<polyline points="' + pts + '" class="st-line"/></svg>';
  }

  function achievement(a) {
    return '<div class="st-ach' + (a.unlocked ? ' is-on' : '') + '">' +
      '<div class="st-ach-head"><span class="st-ach-title">' + a.title + '</span>' +
      (a.unlocked ? '<span class="st-ach-mark">&#10003;</span>' : '') + '</div>' +
      '<p class="st-ach-note">' + (a.unlocked ? a.note : a.hint) + '</p>' +
      (a.unlocked ? '' :
        '<div class="st-prog"><i style="width:' + Math.round(a.progress * 100) + '%"></i></div>' +
        '<span class="st-ach-num">' + a.current + ' / ' + a.target + '</span>') +
      '</div>';
  }

  function render(s) {
    state = s;
    var t = s.totals;
    el('st-summary').innerHTML =
      '<div class="st-big"><b>' + t.streak_days + '</b><span>' +
      pluralRu(t.streak_days, 'день подряд', 'дня подряд', 'дней подряд') + '</span></div>' +
      '<div class="st-big"><b>' + t.reviews_all_time + '</b><span>' +
      pluralRu(t.reviews_all_time, 'повторение', 'повторения', 'повторений') + ' всего</span></div>' +
      '<div class="st-big"><b>' + t.active_days + '</b><span>' +
      pluralRu(t.active_days, 'активный день', 'активных дня', 'активных дней') + '</span></div>';

    el('st-vocab').innerHTML = blockRows(s.blocks.vocab);
    el('st-grammar').innerHTML = blockRows(s.blocks.grammar);

    el('st-chart-reviews').innerHTML = bars(s.series.days, s.series.reviews, s.series.grammar_reviews);
    el('st-chart-reviews-note').textContent =
      'За ' + s.window_days + ' дней. Синим — лексика, светлым — грамматика.';

    var cum = s.series.learned_cumulative;
    el('st-chart-learned').innerHTML = line(cum);
    el('st-chart-learned-note').textContent =
      'Накопительно, от ' + cum[0] + ' до ' + cum[cum.length - 1] + '.';

    var a = s.achievements;
    el('st-ach-count').textContent = a.unlocked + ' из ' + a.total;
    // Открытые вперёд закрытых: экран должен начинаться с того, что уже есть.
    var sorted = a.list.slice().sort(function (x, y) {
      if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1;
      return y.progress - x.progress;
    });
    el('st-achievements').innerHTML = sorted.map(achievement).join('');
  }

  window.Stats = {
    open: function () {
      window.App.show('screen-loading');
      window.Api.getStats().then(function (res) {
        if (!res || !res.ok) { window.App.showError(res && res.code); return; }
        render(res);
        window.App.show('screen-stats');
      }).catch(function () { window.App.showError(null); });
    },
    render: render,
    get state() { return state; }
  };
})();
