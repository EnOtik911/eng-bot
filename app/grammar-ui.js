/**
 * Grammar screens. Kept out of ui.js because the exercise card is a different
 * animal from the flashcard: four layouts, an objective check, and a corrective
 * step after a wrong answer.
 *
 * Two content rules, both from the brief and both load-bearing:
 *  - no theory anywhere on screen. The grammar label is always visible and always
 *    a link out to your own notes, so the form has a name you can go study.
 *  - hints exist and explain WHY, not WHAT. Using one caps the round at GOOD;
 *    the cap lives on the server (Grammar.gs), the honesty lives here.
 */
(function () {
  var A = window.App;
  var T = A.T;
  var el = A.el;

  // Та же кривая, что в --spring: значение читается из CSS, чтобы пружина была
  // одна на всё приложение, а не две расходящиеся копии.
  var SPRING = getComputedStyle(document.documentElement)
    .getPropertyValue('--spring').trim() || 'cubic-bezier(.32,.72,0,1)';

  var block = null;
  var phase = 'ask';            // ask | verdict
  var lastSummary = null;
  var advanceTimer = null;

  /** Перезапуск завершённой CSS-анимации: без снятия класса и рефлоу она не играет. */
  function restart(node, cls) {
    if (A.prefersReducedMotion()) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    node.addEventListener('animationend', function once() {
      node.classList.remove(cls);
      node.removeEventListener('animationend', once);
    });
  }

  function kindInstruction(kind) {
    switch (kind) {
      case 'scramble': return T.kindScramble;
      case 'gapfill': return T.kindGapfill;
      case 'transform': return T.kindTransform;
      case 'fix': return T.kindFix;
      default: return '';
    }
  }

  function notesUrl(slug) {
    var base = (window.ENGBOT_CONFIG && window.ENGBOT_CONFIG.GRAMMAR_NOTES_URL) || '';
    if (!base) return '';
    return base + '#' + String(slug || '').replace(/_/g, '-');
  }

  // ---------------------------------------------------------------- picker ---

  function open(payload) {
    if (!payload || !payload.patterns || !payload.patterns.length) {
      A.setBanner(T.grammarUnavailable, 'warn');
      A.goHome();
      return;
    }
    block = new window.GrammarBlock(payload);
    renderPicker();
  }

  function renderPicker() {
    var dueCount = block.dueQueue.filter(function (id) { return block.playable(id); }).length;
    el('pick-mixed-sub').textContent = T.pickerMixedSub(dueCount);
    el('pick-mixed').disabled = dueCount === 0;

    var list = el('pattern-list');
    list.innerHTML = '';
    block.patterns.forEach(function (p) {
      if (!block.playable(p.pattern_id)) return;
      var row = document.createElement('button');
      row.className = 'pattern-row';
      row.setAttribute('data-pattern', p.pattern_id);
      row.style.setProperty('--i', list.children.length);

      var badge = p.state === 'new' ? T.pickerNew
        : (p.is_due ? T.pickerDue : T.pickerScheduled(p.due));
      var badgeClass = p.state === 'new' ? 'badge badge-new'
        : (p.is_due ? 'badge badge-due' : 'badge');

      row.innerHTML =
        '<span class="pattern-main">' +
          '<span class="pattern-label">' + window.Answer.escapeHtml(p.label) + '</span>' +
          '<span class="pattern-title">' + window.Answer.escapeHtml(p.title_ru) + '</span>' +
        '</span>' +
        '<span class="pattern-meta">' +
          '<span class="' + badgeClass + '">' + window.Answer.escapeHtml(badge) + '</span>' +
          '<span class="pattern-pool">' + T.pickerPool(p.pool_size) + '</span>' +
        '</span>';
      list.appendChild(row);
    });

    A.show('screen-picker');
  }

  // ------------------------------------------------------------- exercise ---

  function beginMixed() {
    if (!block.startMixed()) {
      el('gdone-body').textContent = T.grammarEmpty;
      A.show('screen-gdone');
      return;
    }
    nextRound();
  }

  function beginSingle(patternId) {
    if (!block.startSingle(patternId)) return;
    nextRound();
  }

  function nextRound() {
    var round = block.nextRound();
    if (!round) { finishGrammar(); return; }
    phase = 'ask';
    renderItem();
  }

  function renderProgress() {
    var per = block.perRound;
    var r = block.round;
    var done = block.roundsDone * per + (r ? r.idx : 0);
    A.progress(done, Math.max(block.plannedRounds * per, 1));
    if (r) {
      // Коротко: два числа вместо двух фраз. На 390 пикселях длинная версия
      // выдавливала полосу прогресса, а смысл тот же.
      A.counter((block.roundsDone + 1) + '/' + block.plannedRounds + ' · ' +
        Math.min(r.idx + 1, per) + '/' + r.items.length);
    }
  }

  function renderItem() {
    var item = block.currentItem();
    if (!item) { closeRound(); return; }
    var p = block.round.pattern || {};
    var retry = block.isRetry();

    var url = notesUrl(p.notes_slug);
    var label = el('g-label');
    label.textContent = p.label || '';
    if (url) { label.setAttribute('href', url); label.classList.remove('tag-flat'); }
    else { label.removeAttribute('href'); label.classList.add('tag-flat'); }
    el('g-title').textContent = p.title_ru || '';

    el('g-instruction').textContent = retry
      ? T.retryLabel : kindInstruction(item.kind);

    var showPrompt = !!item.prompt_ru;
    el('g-prompt').hidden = !showPrompt;
    el('g-prompt').textContent = item.prompt_ru || '';

    var showStem = item.kind !== 'scramble' && !!item.stem;
    el('g-stem').hidden = !showStem;
    if (showStem) el('g-stem').innerHTML = renderStem(item.stem);

    var isScramble = item.kind === 'scramble';
    el('g-tokens').hidden = !isScramble;
    el('g-field').hidden = isScramble;

    if (isScramble) {
      buildTokens(item);
    } else {
      var box = el('g-input');
      // «Найди ошибку» подставляет исходное предложение: искать ошибку и
      // перепечатывать предложение целиком — две разные задачи, нужна первая.
      box.value = item.kind === 'fix' ? item.stem : '';
      box.placeholder = T.typeAnswer;
      setTimeout(function () { box.focus(); }, 30);
    }

    el('g-hint').hidden = true;
    el('g-hint').innerHTML = '';
    el('g-verdict').hidden = true;
    el('g-verdict').removeAttribute('data-shown');
    el('g-check').hidden = false;
    el('g-next').hidden = true;
    el('g-hint-btn').hidden = false;
    el('g-hint-btn').disabled = false;

    phase = 'ask';
    renderProgress();
    A.show('screen-grammar');
  }

  function renderStem(stem) {
    return window.Answer.escapeHtml(stem)
      .replace(/___/g, '<span class="gap">_____</span>');
  }

  function buildTokens(item) {
    var bank = el('g-bank');
    var slots = el('g-slots');
    bank.innerHTML = '';
    slots.innerHTML = '';
    slots.setAttribute('data-empty', T.tokenHint);

    window.Answer.shuffle(item.tokens).forEach(function (tok, i) {
      var b = document.createElement('button');
      b.className = 'token';
      b.textContent = tok;
      b.setAttribute('data-token-id', 'b' + i);
      b.style.setProperty('--i', i);
      bank.appendChild(b);
    });
  }

  /**
   * FLIP: замерить положение до перестановки, переставить, замерить после, и
   * проиграть разницу обратным сдвигом. Плитка выглядит летящей, хотя в разметке
   * она просто сменила родителя.
   *
   * Здесь это не украшение. Плитка, которая исчезает в одном месте и появляется в
   * другом, заставляет искать её глазами заново — в упражнении на порядок слов это
   * прямо мешает удерживать собранную часть фразы.
   *
   * Ни одной библиотеки: element.animate() есть в обоих движках, замерено.
   */
  function moveToken(token, target) {
    if (A.prefersReducedMotion() || !token.animate) {
      target.appendChild(token);
      return;
    }
    var before = token.getBoundingClientRect();
    target.appendChild(token);
    var after = token.getBoundingClientRect();
    var dx = before.left - after.left;
    var dy = before.top - after.top;
    if (!dx && !dy) return;
    token.animate(
      [{ transform: 'translate3d(' + dx + 'px,' + dy + 'px,0)' },
       { transform: 'translate3d(0,0,0)' }],
      { duration: 380, easing: SPRING, composite: 'replace' }
    );
  }

  function assembled() {
    return Array.prototype.map.call(el('g-slots').children, function (n) {
      return n.textContent;
    }).join(' ');
  }

  function currentValue() {
    var item = block.currentItem();
    if (!item) return '';
    return item.kind === 'scramble' ? assembled() : el('g-input').value;
  }

  function showHint() {
    var item = block.currentItem();
    if (!item) return;
    block.markHint();
    el('g-hint').hidden = false;
    el('g-hint').innerHTML = window.Answer.formatHint(item.hint_ru) +
      '<span class="hint-penalty">' + window.Answer.escapeHtml(T.hintPenalty) + '</span>';
    el('g-hint-btn').disabled = true;
  }

  function check() {
    if (phase !== 'ask') return;
    var value = currentValue();
    if (!String(value).trim()) return;

    var res = block.submit(value);
    if (!res) return;

    phase = 'verdict';
    el('g-check').hidden = true;
    el('g-hint-btn').hidden = true;
    el('g-verdict').hidden = false;
    el('g-verdict').setAttribute('data-shown', '1');
    el('g-verdict-text').textContent = res.correct ? T.correct : T.wrong;
    el('g-verdict-line').className = 'verdict-line ' + (res.correct ? 'ok' : 'bad');
    // Галочка обводится заново каждый раз: анимация запускается пересозданием узла,
    // потому что повторно проиграть завершённую CSS-анимацию иначе нельзя.
    var tick = el('g-tick');
    tick.hidden = !res.correct;
    if (res.correct) {
      var fresh = tick.cloneNode(true);
      tick.parentNode.replaceChild(fresh, tick);
    }

    if (res.correct) {
      el('g-answer').textContent = '';
      if (A.tg && A.tg.HapticFeedback) A.tg.HapticFeedback.impactOccurred('light');
      advanceTimer = setTimeout(advance, 900);
    } else {
      restart(el('gcard'), 'card-wrong');
      el('g-answer').textContent = T.correctAnswer + ' ' +
        window.Answer.alternatives(res.item.answer)[0];
      // Ошибка — единственный момент, когда объяснение точно нужно, поэтому
      // подсказка раскрывается сама и уже ничего не стоит: результат записан.
      el('g-hint').hidden = false;
      el('g-hint').innerHTML = window.Answer.formatHint(res.item.hint_ru);
      el('g-next').hidden = false;
      if (A.tg && A.tg.HapticFeedback) A.tg.HapticFeedback.notificationOccurred('error');
    }
  }

  function advance() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    if (block.roundFinished()) { closeRound(); return; }
    // Повторный промах на переспросе не зацикливает: элемент уходит в конец.
    if (block.isRetry() && phase === 'verdict' && !el('g-next').hidden) block.deferRetry();
    renderItem();
  }

  function closeRound() {
    var closed = block.closeRound();
    if (!closed) { finishGrammar(); return; }
    window.Store.pushRound(closed.entry);
    A.refreshPending();
    lastSummary = closed.summary;

    var s = closed.summary;
    el('round-label').textContent = s.label + ' · ' + s.title_ru;
    el('round-score').textContent =
      T.roundScore(s.items - s.errors, s.items) + T.roundHints(s.hints);
    el('round-next').textContent = block.hasMoreRounds() ? T.nextPattern : T.nextBtn;
    el('round-again').hidden = !block.playable(s.pattern_id);
    A.progress(block.roundsDone * block.perRound, Math.max(block.plannedRounds * block.perRound, 1));
    A.show('screen-round');
  }

  function finishGrammar() {
    el('gdone-body').textContent = T.grammarDoneBody(block ? block.roundsDone : 0);
    el('gdone-outcomes').hidden = true;
    el('gflush-status').textContent = T.sending;
    A.progress(1, 1);
    A.show('screen-gdone');

    A.flushGrammar(true).then(function (res) {
      if (!res) { el('gflush-status').textContent = T.sendFailed; return; }
      if (!res.ok) { el('gflush-status').textContent = A.errorText(res.code); return; }
      el('gflush-status').textContent = T.sent +
        (res.skipped_duplicate ? ' (уже было принято)' : '');
      // Оценку выводит сервер — показываем ровно то, что он записал, а не свою
      // догадку о ней. Иначе на экране был бы второй, расходящийся источник правды.
      if (res.outcomes && res.outcomes.length) {
        el('gdone-outcomes').hidden = false;
        el('gdone-outcomes').textContent = res.outcomes.map(function (o) {
          return o.label + ' → ' + (T.ratingLabel[o.rating] || o.rating) +
            ', ' + T.nextIn(o.interval_days);
        }).join('\n');
      }
    });
  }

  // ----------------------------------------------------------------- bind ---

  document.addEventListener('DOMContentLoaded', function () {
    el('pick-mixed').addEventListener('click', beginMixed);

    el('pattern-list').addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('[data-pattern]') : null;
      if (row) beginSingle(row.getAttribute('data-pattern'));
    });

    A.bindKeyboard(el('g-input'), el('g-done'), el('g-field'));
    el('g-check').addEventListener('click', check);
    el('g-next').addEventListener('click', advance);
    el('g-hint-btn').addEventListener('click', showHint);

    el('g-bank').addEventListener('click', function (e) {
      if (phase !== 'ask') return;
      if (e.target.classList.contains('token')) moveToken(e.target, el('g-slots'));
    });
    el('g-slots').addEventListener('click', function (e) {
      if (phase !== 'ask') return;
      if (e.target.classList.contains('token')) moveToken(e.target, el('g-bank'));
    });

    el('round-next').addEventListener('click', function () {
      if (block.hasMoreRounds()) nextRound(); else finishGrammar();
    });
    el('round-again').addEventListener('click', function () {
      if (!lastSummary) return;
      if (block.repeatLast(lastSummary.pattern_id)) nextRound();
    });
    el('gdone-home').addEventListener('click', function () { A.goHome(); });

    document.addEventListener('keydown', function (e) {
      if (!el('screen-grammar').hidden) {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Клавиатура уходит вместе с проверкой: иначе вердикт остаётся под ней.
          if (document.activeElement === el('g-input')) el('g-input').blur();
          if (phase === 'ask') check(); else advance();
        }
        return;
      }
      if (!el('screen-round').hidden && e.key === 'Enter') {
        e.preventDefault();
        el('round-next').click();
      }
    });
  });

  /** «Назад» из упражнения ведёт к выбору шаблона, а не сразу домой. */
  function backToPicker() {
    if (!block) return false;
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    renderPicker();
    return true;
  }

  window.GrammarUI = { open: open, backToPicker: backToPicker };
})();
