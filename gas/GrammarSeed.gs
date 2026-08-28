/**
 * The first grammar corpus: eight patterns, twelve items each, four exercise kinds.
 *
 * Which eight, and why these: not the textbook order. Russian has three tenses and
 * two aspects against twelve English forms, so the forms that cost a Russian speaker
 * the most are the perfect, the progressive, the copula `to be` (absent in the Russian
 * present), do-support in questions, and articles. Present Simple in the third person
 * is here for one reason only — the `-s` that keeps disappearing.
 *
 * Sentences come from kicksharing, hotel PMS and analyst work on purpose: grammar
 * drilled on sentences you would actually say at work pays twice.
 *
 * Columns: pattern_id, order_index, label, title_ru, notes_slug,
 *          kind, prompt_ru, stem, answer, tokens, hint_ru
 */
function grammarSeedRows_() {
  var P1 = ['to_be_present', 10, 'Present Simple · to be', 'Глагол «быть» в настоящем', 'to-be-present'];
  var P2 = ['present_simple_3sg', 20, 'Present Simple', 'Третье лицо: окончание -s', 'present-simple-3sg'];
  var P3 = ['present_vs_continuous', 30, 'Present Simple / Continuous', 'Вообще или прямо сейчас', 'present-vs-continuous'];
  var P4 = ['present_perfect_since_for', 40, 'Present Perfect', 'since / for: началось в прошлом, длится сейчас', 'present-perfect-since-for'];
  var P5 = ['present_perfect_vs_past', 50, 'Present Perfect / Past Simple', 'Результат сейчас или факт в прошлом', 'present-perfect-vs-past'];
  var P6 = ['questions_do_support', 60, 'Questions', 'Порядок слов и вспомогательный глагол', 'questions-do-support'];
  var P7 = ['past_simple_vs_continuous', 70, 'Past Simple / Past Continuous', 'Фон и то, что его прервало', 'past-simple-vs-continuous'];
  var P8 = ['articles_basic', 80, 'Articles', 'a / an / the и когда артикля нет', 'articles-basic'];

  var data = [
    /* --- to be в настоящем: русский обходится без связки, английский нет --- */
    [P1, 'scramble', 'Я продакт-маркетинг лид.', '', 'I am a product marketing lead.', 'I|am|a|product|marketing|lead', 'В русском «Я — лид» глагола нет вообще. В английском `am` обязателен: без него предложение не существует.'],
    [P1, 'scramble', 'Утилизация парка сегодня низкая.', '', 'Fleet utilization is low today.', 'Fleet|utilization|is|low|today', 'Подлежащее в третьем лице единственного числа берёт `is`.'],
    [P1, 'scramble', 'Мы не готовы к запуску в Бразилии.', '', 'We are not ready for the Brazil launch.', 'We|are|not|ready|for|the|Brazil|launch', 'Отрицание строится вставкой `not` после формы `to be`. Вспомогательный `do` здесь не нужен.'],
    [P1, 'gapfill', '', 'The rate plan ___ different on weekends.', 'is', '', '`The rate plan` — третье лицо единственного числа, значит `is`.'],
    [P1, 'gapfill', '', 'I ___ a business analyst at Libra Hospitality.', 'am', '', 'С `I` всегда `am`. Ни `is`, ни `are`.'],
    [P1, 'gapfill', '', 'The scooters ___ not available in this zone.', 'are', '', '`Scooters` — множественное число, значит `are`. Отрицание: `are not`.'],
    [P1, 'transform', '→ отрицание', 'The integration is ready.', "The integration is not ready.||The integration isn't ready.", '', 'Форма `to be` отрицается сама: `is not`. Добавлять `does not` — типичный перенос с обычных глаголов.'],
    [P1, 'transform', '→ вопрос', 'The report is correct.', 'Is the report correct?', '', 'Вопрос с `to be` — простая инверсия: форма глагола встаёт перед подлежащим, ничего не добавляется.'],
    [P1, 'transform', '→ подлежащее во множественном числе', 'The vehicle is idle.', 'The vehicles are idle.', '', 'Форма `to be` согласуется с подлежащим: `vehicle is` → `vehicles are`.'],
    [P1, 'fix', '', 'I product marketing lead at JET Sharing.', 'I am a product marketing lead at JET Sharing.', '', 'Пропущен `am` — калька с русского «Я лид». Плюс перед профессией нужен артикль `a`.'],
    [P1, 'fix', '', 'The guest folio are empty.', 'The guest folio is empty.', '', '`Folio` — единственное число, значит `is`, а не `are`.'],
    [P1, 'fix', '', 'She not in the office today.', "She is not in the office today.||She isn't in the office today.", '', 'Отрицание без формы `to be` невозможно: нужно `is not`.'],

    /* --- третье лицо и его -s --- */
    [P2, 'scramble', 'Система синхронизирует номерной фонд каждый час.', '', 'The system syncs room inventory every hour.', 'The|system|syncs|room|inventory|every|hour', '`The system` — третье лицо единственного числа, значит `syncs` с окончанием `-s`.'],
    [P2, 'scramble', 'Тарифный план меняется на выходных.', '', 'The rate plan changes on weekends.', 'The|rate|plan|changes|on|weekends', 'Регулярное действие идёт в Present Simple. Третье лицо → `changes`.'],
    [P2, 'scramble', 'Я собираю требования у трёх групп стейкхолдеров.', '', 'I gather requirements from three stakeholder groups.', 'I|gather|requirements|from|three|stakeholder|groups', 'С `I` окончания нет: `gather`, а не `gathers`.'],
    [P2, 'gapfill', '', 'The nightly job ___ (run) at three in the morning.', 'runs', '', 'Третье лицо единственного числа в Present Simple получает `-s`.'],
    [P2, 'gapfill', '', 'Our users ___ (open) the app twice a day on average.', 'open', '', '`Users` — множественное число, окончания нет.'],
    [P2, 'gapfill', '', 'The channel manager ___ (push) rates to every OTA.', 'pushes', '', 'После `-ch`, `-sh`, `-s`, `-x` добавляется `-es`: `push` → `pushes`.'],
    [P2, 'transform', '→ подлежащее `the analyst`', 'I document every business rule.', 'The analyst documents every business rule.', '', 'Смена подлежащего на третье лицо единственного числа требует `-s` у глагола.'],
    [P2, 'transform', '→ отрицание', 'The scooter reports its battery level.', "The scooter does not report its battery level.||The scooter doesn't report its battery level.", '', 'В отрицании `-s` уходит к вспомогательному: `does not report`, а не `does not reports`.'],
    [P2, 'transform', '→ вопрос', 'The integration sends data to the PMS.', 'Does the integration send data to the PMS?', '', 'В вопросе `-s` переезжает в `does`, а смысловой глагол остаётся в базовой форме.'],
    [P2, 'fix', '', 'The dashboard show fleet utilization by city.', 'The dashboard shows fleet utilization by city.', '', '`The dashboard` — третье лицо единственного числа, нужно `shows`.'],
    [P2, 'fix', '', "He doesn't knows the attribution window.", "He doesn't know the attribution window.", '', 'После `doesn’t` идёт базовая форма. Двух `-s` в одном отрицании не бывает.'],
    [P2, 'fix', '', 'Do the system support multiple currencies?', 'Does the system support multiple currencies?', '', '`The system` — третье лицо единственного числа, значит вопрос начинается с `Does`.'],

    /* --- Simple против Continuous: русский вид не подсказывает --- */
    [P3, 'scramble', 'Мы прямо сейчас выкатываем новый тариф.', '', 'We are rolling out a new rate plan right now.', 'We|are|rolling|out|a|new|rate|plan|right|now', '`right now` — действие в моменте, значит Continuous: `are rolling out`.'],
    [P3, 'scramble', 'Обычно мы выкатываем изменения по вторникам.', '', 'We usually roll out changes on Tuesdays.', 'We|usually|roll|out|changes|on|Tuesdays', '`usually` — регулярность, значит Present Simple без `-ing`.'],
    [P3, 'scramble', 'Утилизация падает уже третью неделю.', '', 'Utilization is falling for the third week.', 'Utilization|is|falling|for|the|third|week', 'Процесс в развитии → Continuous. В русском вид спрятан в слове «падает», в английском его несёт форма `is falling`.'],
    [P3, 'gapfill', '', 'I ___ (work) on the Brazil launch this month.', 'am working', '', '`this month` — ограниченный текущий период, значит Continuous.'],
    [P3, 'gapfill', '', 'The PMS ___ (store) every guest folio.', 'stores', '', 'Постоянное свойство системы идёт в Present Simple, не в Continuous.'],
    [P3, 'gapfill', '', 'Look at the map — three scooters ___ (move) toward the same zone.', 'are moving', '', '`Look at` указывает на момент наблюдения, значит Continuous.'],
    [P3, 'transform', '→ Present Continuous', 'I review the requirements.', "I am reviewing the requirements.||I'm reviewing the requirements.", '', 'Continuous — это форма `to be` плюс `-ing`. С `I` получается `am reviewing`.'],
    [P3, 'transform', '→ Present Simple', 'We are checking utilization every morning.', 'We check utilization every morning.', '', '`every morning` — регулярность, а регулярность идёт в Simple, даже если само действие длительное.'],
    [P3, 'transform', '→ вопрос', 'She is preparing the release notes.', 'Is she preparing the release notes?', '', 'В Continuous вопрос делается инверсией формы `to be`, `-ing` не трогаем.'],
    [P3, 'fix', '', 'I am knowing this integration well.', 'I know this integration well.', '', 'Глаголы состояния — `know`, `understand`, `want` — в Continuous не ставятся.'],
    [P3, 'fix', '', 'Right now we discuss the scope.', "Right now we are discussing the scope.||Right now we're discussing the scope.", '', '`Right now` требует Continuous. В русском форма одна, в английском выбор обязателен.'],
    [P3, 'fix', '', 'Our users are opening the app twice a day.', 'Our users open the app twice a day.', '', '`twice a day` — привычка, а привычки идут в Simple.'],

    /* --- Present Perfect с since/for: русское настоящее время сбивает --- */
    [P4, 'scramble', 'Я работаю в JET Sharing с 2023 года.', '', 'I have worked at JET Sharing since 2023.', 'I|have|worked|at|JET|Sharing|since|2023', 'Началось в прошлом и длится сейчас → Present Perfect. В русском здесь настоящее время, и это главная ловушка.'],
    [P4, 'scramble', 'Мы используем это окно атрибуции уже два года.', '', 'We have used this attribution window for two years.', 'We|have|used|this|attribution|window|for|two|years', '`for two years` — длительность до настоящего момента, значит `have used`, а не `use`.'],
    [P4, 'scramble', 'Она отвечает за миграцию с апреля.', '', 'She has owned the migration since April.', 'She|has|owned|the|migration|since|April', 'Третье лицо единственного числа в Present Perfect берёт `has`, а не `have`.'],
    [P4, 'gapfill', '', 'I ___ (be) a business analyst since 2021.', 'have been', '', '`since 2021` требует Present Perfect. Третья форма от `be` — `been`.'],
    [P4, 'gapfill', '', 'The channel manager ___ (work) without errors for three months.', 'has worked', '', '`The channel manager` — третье лицо единственного числа, значит `has`.'],
    [P4, 'gapfill', '', 'We ___ (not / see) this edge case since the last release.', "have not seen||haven't seen", '', 'В Present Perfect `not` встаёт между `have` и третьей формой.'],
    [P4, 'transform', '→ Present Perfect с since', 'I started working here in 2023.', "I have worked here since 2023.||I've worked here since 2023.", '', 'Past Simple сообщает только момент начала. Present Perfect с `since` добавляет, что это длится и сейчас.'],
    [P4, 'transform', '→ вопрос', 'You have used this rate plan for a year.', 'Have you used this rate plan for a year?', '', 'Вопрос — инверсия `have` и подлежащего, третья форма остаётся на месте.'],
    [P4, 'transform', '→ подлежащее `the team`', 'I have owned this integration since March.', 'The team has owned this integration since March.', '', '`The team` — третье лицо единственного числа, значит `has owned`.'],
    [P4, 'fix', '', 'I work at JET Sharing since 2023.', "I have worked at JET Sharing since 2023.||I've worked at JET Sharing since 2023.", '', 'Present Simple с `since` невозможен. Русское «работаю с 2023» переводится Present Perfect.'],
    [P4, 'fix', '', 'We have used this window since two years.', 'We have used this window for two years.', '', '`since` — точка отсчёта (2023, April), `for` — длительность (two years).'],
    [P4, 'fix', '', 'She have owned the migration since April.', 'She has owned the migration since April.', '', 'С `she` идёт `has`, а не `have`.'],

    /* --- Present Perfect против Past Simple: та самая ошибка --- */
    [P5, 'scramble', 'Мы уже выкатили эту функциональность.', '', 'We have already rolled out this feature.', 'We|have|already|rolled|out|this|feature', '`already` без указания когда — важен результат сейчас, значит Present Perfect.'],
    [P5, 'scramble', 'Мы выкатили её на прошлой неделе.', '', 'We rolled it out last week.', 'We|rolled|it|out|last|week', '`last week` — законченный момент в прошлом, значит Past Simple. С `last week` Present Perfect невозможен.'],
    [P5, 'scramble', 'Я ещё не видел этот отчёт.', '', "I have not seen this report yet.||I haven't seen this report yet.", 'I|have|not|seen|this|report|yet', '`yet` говорит о текущем положении дел, значит Present Perfect.'],
    [P5, 'gapfill', '', '___ (you / read) the spec yet?', 'Have you read', '', '`yet` требует Present Perfect: спрашивают про состояние на сейчас, а не про момент в прошлом.'],
    [P5, 'gapfill', '', 'I ___ (send) the requirements yesterday.', 'sent', '', '`yesterday` — конкретный момент в прошлом, значит Past Simple.'],
    [P5, 'gapfill', '', 'Utilization ___ (drop) three times this month.', 'has dropped', '', '`this month` — период ещё не закончился, значит Present Perfect.'],
    [P5, 'transform', '→ Past Simple, добавь `in April`', 'We have changed the rate plan.', 'We changed the rate plan in April.', '', 'Появилось указание момента — Present Perfect больше нельзя, фраза уходит в Past Simple.'],
    [P5, 'transform', '→ Present Perfect', 'I finished the analysis.', "I have finished the analysis.||I've finished the analysis.", '', 'Убираем привязку к моменту — остаётся результат, который важен сейчас.'],
    [P5, 'transform', '→ отрицание', 'She has approved the scope.', "She has not approved the scope.||She hasn't approved the scope.", '', '`not` встаёт после `has`, третья форма не меняется.'],
    [P5, 'fix', '', 'I have sent the report yesterday.', 'I sent the report yesterday.', '', '`yesterday` и Present Perfect несовместимы: конкретный момент требует Past Simple.'],
    [P5, 'fix', '', 'Did you read the spec yet?', 'Have you read the spec yet?', '', '`yet` — про сейчас, значит Present Perfect, а не Past Simple.'],
    [P5, 'fix', '', 'We already rolled out the fix, so the bug is gone.', "We have already rolled out the fix, so the bug is gone.||We've already rolled out the fix, so the bug is gone.", '', 'Результат действует сейчас — `the bug is gone` — значит Present Perfect.'],

    /* --- вопросы: в русском нет do-support, поэтому его забывают --- */
    [P6, 'scramble', 'Как часто система синхронизирует тарифы?', '', 'How often does the system sync rates?', 'How|often|does|the|system|sync|rates', 'После вопросительного слова идёт вспомогательный `does`, затем подлежащее, затем глагол в базовой форме.'],
    [P6, 'scramble', 'Почему упала утилизация парка?', '', 'Why did fleet utilization drop?', 'Why|did|fleet|utilization|drop', 'Прошедшее время в вопросе берёт `did`, а смысловой глагол остаётся базовым: `drop`, не `dropped`.'],
    [P6, 'scramble', 'Кто отвечает за эту интеграцию?', '', 'Who owns this integration?', 'Who|owns|this|integration', 'Когда вопрос задан к подлежащему, `do/does` не нужен и порядок слов остаётся прямым.'],
    [P6, 'gapfill', '', '___ the guest folio include the city tax?', 'Does', '', '`The guest folio` — третье лицо единственного числа в настоящем, значит `Does`.'],
    [P6, 'gapfill', '', 'Where ___ you gather these requirements?', 'did', '', 'Прошедшее время требует `did`, глагол дальше идёт в базовой форме.'],
    [P6, 'gapfill', '', '___ the scooters need a firmware update?', 'Do', '', '`Scooters` — множественное число, значит `Do`.'],
    [P6, 'transform', '→ вопрос', 'The analyst documents every business rule.', 'Does the analyst document every business rule?', '', '`-s` переезжает в `does`, и смысловой глагол теряет окончание.'],
    [P6, 'transform', '→ вопрос', 'They launched in Baku last spring.', 'Did they launch in Baku last spring?', '', 'Прошедшее время уходит в `did`, а `launched` становится `launch`.'],
    [P6, 'transform', '→ вопрос со `what` к дополнению', 'She reviewed the migration plan.', 'What did she review?', '', 'Вопрос к дополнению требует `did` и базовой формы: `did she review`.'],
    [P6, 'fix', '', 'Why the utilization dropped last week?', 'Why did the utilization drop last week?', '', 'В английском вопросе нельзя обойтись интонацией: нужен `did` и базовая форма глагола.'],
    [P6, 'fix', '', 'Does the system supports two currencies?', 'Does the system support two currencies?', '', 'После `does` глагол всегда базовый, без `-s`.'],
    [P6, 'fix', '', 'What you think about this scope?', 'What do you think about this scope?', '', 'Пропущен вспомогательный `do`. Русское «Что ты думаешь» строится без него, английское — нет.'],

    /* --- прошедшее: фон и событие --- */
    [P7, 'scramble', 'Когда упал сервер, я готовил отчёт.', '', 'I was preparing the report when the server went down.', 'I|was|preparing|the|report|when|the|server|went|down', 'Длинный фон идёт в Past Continuous — `was preparing`, а короткое событие внутри него в Past Simple — `went down`.'],
    [P7, 'scramble', 'Пока мы согласовывали объём, срок сдвинулся.', '', 'While we were aligning on scope, the deadline moved.', 'While|we|were|aligning|on|scope|the|deadline|moved', '`While` вводит фон, значит Past Continuous. Событие в главной части — Past Simple.'],
    [P7, 'scramble', 'Я проверил счёт гостя и нашёл ошибку.', '', 'I checked the guest folio and found an error.', 'I|checked|the|guest|folio|and|found|an|error', 'Два законченных действия друг за другом — оба в Past Simple, Continuous здесь не нужен.'],
    [P7, 'gapfill', '', 'I ___ (prepare) the report when the server went down.', 'was preparing', '', 'Фон, который уже шёл к моменту события, идёт в Past Continuous.'],
    [P7, 'gapfill', '', 'While the job ___ (run), we watched the logs.', 'was running', '', '`While` вводит длящийся фон, значит Past Continuous.'],
    [P7, 'gapfill', '', 'The deadline ___ (move) twice last quarter.', 'moved', '', 'Законченный факт с указанием периода идёт в Past Simple.'],
    [P7, 'transform', '→ Past Continuous', 'I reviewed the spec at nine.', 'I was reviewing the spec at nine.', '', 'Past Continuous говорит, что в девять процесс уже шёл, а не начался и закончился.'],
    [P7, 'transform', '→ Past Simple', 'She was writing the release notes.', 'She wrote the release notes.', '', 'Past Simple подаёт действие как законченный факт, без взгляда изнутри процесса.'],
    [P7, 'transform', '→ вопрос', 'They were rebalancing idle vehicles.', 'Were they rebalancing idle vehicles?', '', 'Вопрос в Continuous — инверсия `was/were` и подлежащего.'],
    [P7, 'fix', '', 'I was checking the folio and was finding an error.', 'I checked the folio and found an error.', '', 'Два коротких завершённых действия идут в Past Simple. Continuous растягивает то, что мгновенно.'],
    [P7, 'fix', '', 'While we were align on scope, the deadline moved.', 'While we were aligning on scope, the deadline moved.', '', 'После `were` нужна форма на `-ing`: `were aligning`.'],
    [P7, 'fix', '', 'They was testing the integration all morning.', 'They were testing the integration all morning.', '', '`They` — множественное число, значит `were`, а не `was`.'],

    /* --- артикли: в русском их нет вообще --- */
    [P8, 'scramble', 'Я продакт-менеджер в кикшеринговой компании.', '', 'I am a product manager at a kicksharing company.', 'I|am|a|product|manager|at|a|kicksharing|company', 'И профессия, и неопределённая компания требуют `a`: называем один экземпляр из класса, а не конкретный.'],
    [P8, 'scramble', 'Отчёт, который я отправил вчера, был неверный.', '', 'The report I sent yesterday was wrong.', 'The|report|I|sent|yesterday|was|wrong', 'Отчёт конкретный и уже определён контекстом, значит `the`.'],
    [P8, 'scramble', 'Утилизация парка важнее выручки.', '', 'Fleet utilization matters more than revenue.', 'Fleet|utilization|matters|more|than|revenue', 'Неисчисляемые понятия в общем смысле идут без артикля вообще.'],
    [P8, 'gapfill', '', 'We found ___ edge case that breaks the nightly job.', 'an', '', 'Первое упоминание, один из многих — неопределённый артикль. Перед гласным звуком `an`.'],
    [P8, 'gapfill', '', '___ channel manager pushes rates to every OTA.', 'The', '', 'Речь о конкретной, уже известной системе, значит `the`.'],
    [P8, 'gapfill', '', 'The bug appeared after ___ last release.', 'the', '', '`last release` — единственный конкретный релиз, значит `the`.'],
    [P8, 'transform', '→ первое упоминание аналитика', 'The analyst joined the team.', 'An analyst joined the team.', '', 'Если аналитик упомянут впервые и не важно кто именно — `an`. Команда при этом остаётся конкретной.'],
    [P8, 'transform', '→ множественное число, общий смысл', 'A scooter needs a daily check.', 'Scooters need a daily check.', '', 'Общее утверждение о классе во множественном числе идёт без артикля.'],
    [P8, 'transform', '→ речь о конкретном плане', 'We reviewed a rate plan.', 'We reviewed the rate plan.', '', '`the` показывает, что план один и обеим сторонам известно какой.'],
    [P8, 'fix', '', 'I am product manager at JET Sharing.', 'I am a product manager at JET Sharing.', '', 'Перед профессией в единственном числе нужен `a`. Русский обходится без артикля, английский — нет.'],
    [P8, 'fix', '', 'The fleet utilization is a key metric for the kicksharing.', 'Fleet utilization is a key metric for kicksharing.', '', 'Абстрактные понятия в общем смысле идут без артикля: ни `the fleet utilization`, ни `the kicksharing`.'],
    [P8, 'fix', '', 'We found a edge case in the import.', 'We found an edge case in the import.', '', 'Перед гласным звуком идёт `an`, а не `a`.']
  ];

  return data.map(function (d) {
    var p = d[0];
    // pattern_id, order_index, label, title_ru, notes_slug, kind, prompt_ru, stem, answer, tokens, hint_ru
    return [p[0], p[1], p[2], p[3], p[4], d[1], d[2], d[3], d[4], d[5], d[6]];
  });
}

/**
 * Writes the corpus into grammar_inbox. Deliberately not written straight into
 * grammar_items: routing it through the inbox means the seed is validated by the
 * same importer as any generated batch, so a broken item here fails loudly instead
 * of quietly becoming an unsolvable exercise.
 */
function seedGrammarBatch() {
  var rows = grammarSeedRows_();
  var sh = sheet_(SHEET_GRAMMAR_INBOX);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, GRAMMAR_IMPORT_COLUMNS.length).setValues(rows);
  Logger.log('grammar_inbox: залито строк — ' + rows.length);
  Logger.log('Теперь запусти runImportGrammar (или пункт меню «Импортировать грамматику»).');
  return rows.length;
}
