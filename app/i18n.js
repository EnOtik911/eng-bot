/**
 * Every user-facing string lives here. The RU/EN interface toggle was cut from MVP
 * on purpose (GATE 1, deviation 2), but the structure that makes it a twenty-line
 * change later is in place from day one.
 */
function plural(n, one, few, many) {
  var m10 = n % 10;
  var m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

window.I18N = {
  ru: {
    loading: 'Загружаю очередь…',
    offlineBanner: 'Нет сети — ответы копятся локально и уйдут при подключении',
    pendingBanner: function (n) { return 'Не отправлено ответов: ' + n; },
    triggerStale: 'Ежедневный триггер не отчитывался больше 36 часов — проверь его',
    triggerNever: 'Триггер ни разу не отчитывался — установи его',
    emptyTitle: 'На сегодня всё',
    emptyBody: 'Очередь пуста. Либо дневная норма новых уже израсходована, либо всё повторено. Возвращайся завтра или подними daily_new_target в настройках.',
    showAnswer: 'Показать',
    again: 'Не помню',
    hard: 'С трудом',
    good: 'Помню',
    easy: 'Легко',
    typeHint: 'Набери по-английски и нажми «Показать»',
    // Восемь секунд на карточку — не выдумка, а величина из замеренной модели
    // нагрузки (test/load-model.mjs). По ней же считалась дневная норма.
    SEC_PER_CARD: 8,
    paceFree: 'На сегодня свободно',
    paceOnTrack: 'Идёшь по плану',
    paceDebt: 'Накопился долг',
    paceFirst: 'Первая сессия',
    paceLine: function (due, fresh, minutes) {
      var parts = [];
      if (due) parts.push('долгов ' + due);
      if (fresh) parts.push('новых ' + fresh);
      if (!parts.length) return 'ничего не ждёт';
      return parts.join(' · ') + ' · ≈' + minutes + ' мин';
    },
    sessionPos: function (n, total) { return 'карточка ' + n + ' из ' + total; },
    minutesLeft: function (m) { return '≈' + m + ' мин осталось'; },
    pause: 'Пауза',
    paused: 'Сохранено. Вернёшься — продолжишь с этой же карточки.',
    doneNext: function (date) { return 'Следующее повторение: ' + date; },
    doneNothingAhead: 'Впереди пусто — залей ещё батч или подними норму.',
    doneLeftToday: function (n) { return 'Сегодня осталось: ' + n; },
    doneAllClear: 'На сегодня всё закрыто.',
    doneTitle: 'Сессия закрыта',
    resumeVocab: function (n) {
      return 'Продолжить: осталось ' + n + ' ' + plural(n, 'карточка', 'карточки', 'карточек');
    },
    resumeTile: function (n) { return 'не закрыто: ' + n; },
    practiceDoneTitle: 'Прогон закончен',
    practiceDoneBody: function (n) {
      return 'Прогнал карточек: ' + n + '. Расписание не тронуто.';
    },
    practiceEmpty: 'Гонять пока нечего — сначала пройди хотя бы одну сессию.',
    doneBody: function (n) { return 'Пройдено карточек: ' + n; },
    sending: 'Отправляю…',
    sent: 'Отправлено',
    sendFailed: 'Не отправилось — попробую при следующем открытии',
    errAuth: 'Открой приложение из бота — данные запуска не приняты',
    errNotAllowed: 'Доступ не разрешён для этого аккаунта',
    errStale: 'Данные запуска устарели. Закрой и открой заново из бота',
    errLocked: 'Идёт другая запись, повторяю через секунду',
    errGeneric: 'Ошибка связи',
    counterDue: 'долг',
    counterNew: 'новые',
    directionRecog: 'EN → RU',
    directionProd: 'RU → EN',
    retry: 'Повторить',
    diag: 'Показать диагностику',
    errNoSdk: 'SDK Telegram не загрузился — страница открыта вне Telegram или скрипт telegram.org заблокирован',
    errNoInitData: 'Telegram не передал данные запуска. Так бывает, если приложение открыто по ссылке, а не кнопкой Mini App, либо кеш держит старую версию страницы',
    codeLabel: 'код',

    // --- главный экран и грамматика ---
    homeTitle: 'Что тренируем',
    blockVocab: 'Лексика',
    blockVocabSub: 'слова и словосочетания по расписанию',
    blockGrammar: 'Грамматика',
    blockGrammarSub: 'времена и порядок слов, по шаблонам',
    homeDue: function (n) { return n ? 'к повторению: ' + n : 'долгов нет'; },
    homeNew: function (n) { return n ? ' · новых: ' + n : ''; },
    grammarUnavailable: 'Грамматика ещё не залита. В таблице: «Первичная настройка листов» → «Засеять грамматику» → «Импортировать грамматику»',
    back: 'Назад',
    pickerTitle: 'Грамматика',
    pickerMixed: 'Вперемешку',
    pickerMixedSub: function (n) {
      return n ? 'по расписанию: ' + n + ' ' + plural(n, 'шаблон', 'шаблона', 'шаблонов')
        : 'на сегодня всё повторено';
    },
    pickerOr: 'или выбери шаблон',
    pickerDue: 'пора',
    pickerNew: 'новый',
    pickerScheduled: function (d) { return 'до ' + d; },
    pickerPool: function (n) {
      return n + ' ' + plural(n, 'задание', 'задания', 'заданий');
    },

    kindScramble: 'Собери предложение',
    kindGapfill: 'Впиши пропущенное',
    kindTransform: 'Перестрой предложение',
    kindFix: 'Найди и исправь ошибку',

    checkBtn: 'Проверить',
    hintBtn: 'Подсказка',
    nextBtn: 'Дальше',
    tokenHint: 'Нажимай слова в нужном порядке',
    typeAnswer: 'Впиши ответ',
    correct: 'Верно',
    wrong: 'Не так',
    correctAnswer: 'Правильно так:',
    retryLabel: 'Повтор — набери правильно',
    hintPenalty: 'С подсказкой раунд оценивается не выше «Помню»',

    roundDone: 'Раунд закрыт',
    roundScore: function (ok, total) { return 'Верно с первого раза: ' + ok + ' из ' + total; },
    roundHints: function (n) { return n ? ' · подсказок: ' + n : ''; },
    oneMoreRound: 'Ещё раунд по этому шаблону',
    nextPattern: 'Следующий шаблон',
    grammarDone: 'Грамматика на сегодня закрыта',
    grammarDoneBody: function (n) {
      return 'Раундов пройдено: ' + n;
    },
    grammarEmpty: 'Все шаблоны повторены, а дневная норма новых израсходована. Возвращайся завтра или выбери шаблон вручную.',
    ratingLabel: { 1: 'Не помню', 2: 'С трудом', 3: 'Помню', 4: 'Легко' },
    nextIn: function (days) {
      return 'следующий показ через ' + days + ' ' + plural(days, 'день', 'дня', 'дней');
    }
  }
};
