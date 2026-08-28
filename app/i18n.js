/**
 * Every user-facing string lives here. The RU/EN interface toggle was cut from MVP
 * on purpose (GATE 1, deviation 2), but the structure that makes it a twenty-line
 * change later is in place from day one.
 */
window.I18N = {
  ru: {
    loading: 'Загружаю очередь…',
    offlineBanner: 'Нет сети — ответы копятся локально и уйдут при подключении',
    pendingBanner: function (n) { return 'Не отправлено ответов: ' + n; },
    triggerStale: 'Ежедневный триггер не отчитывался больше 36 часов — проверь его',
    triggerNever: 'Триггер ни разу не отчитывался — установи его',
    emptyTitle: 'На сегодня всё',
    emptyBody: 'Очередь пуста. Возвращайся завтра или добавь новый батч в inbox.',
    showAnswer: 'Показать',
    again: 'Не помню',
    hard: 'С трудом',
    good: 'Помню',
    easy: 'Легко',
    typeHint: 'Набери по-английски и нажми «Показать»',
    doneTitle: 'Сессия закрыта',
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
    codeLabel: 'код'
  }
};
