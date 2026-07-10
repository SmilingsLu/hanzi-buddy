/**
 * UI Components — rendering only, no business logic.
 *
 * Modules:
 * - FilterUI: lesson dropdown and sidebar count updates
 * - CardUI: flash card rendering and flip
 * - QuizUI: quiz question rendering and feedback
 * - ModalUI: generic modal for favorites, error book, badges
 * - BadgePopupUI: badge unlock celebration
 */

/** Filter UI — manages sidebar counts and lesson dropdown */
const FilterUI = (() => {
  /** Render the lesson dropdown options for current grade/semester */
  function renderLessons() {
    const sel = document.getElementById('lessonFilter');
    const lessons = DataService.getFilteredLessons();
    const charCount = lessons.reduce((sum, l) => sum + l.chars.length, 0);
    sel.innerHTML = `<option value="all">全部课文 (${charCount}字)</option>`;
    lessons.forEach(l => {
      sel.innerHTML += `<option value="${escapeHtml(l.id)}">${escapeHtml(l.title)} (${l.chars.length}字)</option>`;
    });
  }

  function updateStripCounts(lessons) {
    // Update per-grade/semester character counts
    const countEls = document.querySelectorAll('[data-count-for]');
    countEls.forEach(el => {
      const key = el.dataset.countFor; // e.g. "1-1"
      const [grade, sem] = key.split('-');
      const matching = lessons.filter(l => l.id.split('-')[0] === grade && l.id.split('-')[1] === sem);
      const count = matching.reduce((sum, l) => sum + l.chars.length, 0);
      el.textContent = count > 0 ? count : '';
      // Disable sidebar items with no characters
      const item = el.closest('.sidebar-item');
      if (item) item.classList.toggle('disabled', count === 0);
    });

    // Set first available item as active
    const firstActive = document.querySelector('.sidebar-grades .sidebar-item:not(.disabled)');
    if (firstActive && !document.querySelector('.sidebar-grades .sidebar-item.active')) {
      firstActive.classList.add('active');
    }

    updateFavCount();
    updateErrCount();
  }

  function updateFavCount() {
    const count = FavoriteService.getAll().length;
    const el = document.getElementById('favSideCount');
    if (el) el.textContent = count;
    const item = el ? el.closest('.sidebar-item') : null;
    if (item) item.classList.toggle('disabled', count === 0);
  }

  function updateErrCount() {
    const count = ErrorBookService.count();
    const el = document.getElementById('errSideCount');
    if (el) el.textContent = count;
    const item = el ? el.closest('.sidebar-item') : null;
    if (item) item.classList.toggle('disabled', count === 0);
  }

  function updateSrsCount() {
    const count = SpacedRepService.getDueCount();
    console.info('[SRS] Due count:', count, 'Total:', SpacedRepService.getTotalCount());
    const el = document.getElementById('srsSideCount');
    if (el) el.textContent = count;
    const item = el ? el.closest('.sidebar-item') : null;
    if (item) item.classList.toggle('disabled', count === 0);
  }

  /** Update streak display in header */
  function updateStreakDisplay() {
    const el = document.getElementById('streakNumber');
    if (el) el.textContent = State.get('stats').consecutiveDays || 0;
  }

  return { renderLessons, updateStripCounts, updateFavCount, updateErrCount, updateSrsCount, updateStreakDisplay };
})();

/** Card UI — flash card rendering, flip animation, state display */
const CardUI = (() => {
  /** Render a character on the card (front + back content) */
  function render(charData, index, total) {
    const card = document.getElementById('flashcard');
    // Skip flip animation when navigating — instantly show front
    card.style.transition = 'none';
    card.classList.remove('flipped');
    // Force reflow to apply instant change, then restore transition
    card.offsetHeight;
    card.style.transition = '';

    document.getElementById('cardChar').textContent = charData.char;
    document.getElementById('cardPinyinSmall').textContent = charData.pinyin;
    document.getElementById('cardPinyinSmall').classList.toggle('hidden', !State.get('showPinyin'));
    document.getElementById('cardPinyinBack').textContent = charData.pinyin;
    document.getElementById('cardWords').textContent = charData.words.join(' · ');
    document.getElementById('cardSentence').textContent = charData.sentence;
    document.getElementById('favBtn').textContent = FavoriteService.isFavorite(charData.char) ? '❤️' : '🤍';
    document.getElementById('progressBar').textContent = `${index + 1} / ${total}`;
    document.getElementById('progressFill').style.width = `${((index + 1) / total) * 100}%`;
  }

  function flip() {
    document.getElementById('flashcard').classList.toggle('flipped');
  }

  function updateFavIcon(isFav) {
    document.getElementById('favBtn').textContent = isFav ? '❤️' : '🤍';
  }

  function togglePinyinDisplay(show) {
    document.getElementById('cardPinyinSmall').classList.toggle('hidden', !show);
  }

  return { render, flip, updateFavIcon, togglePinyinDisplay };
})();

/** Quiz UI — question rendering, feedback animations, end screen */
const QuizUI = (() => {
  /** Render a quiz question with options and progress dots */
  function renderQuestion(question, score, streak, progress, total) {
    const quizCharEl = document.getElementById('quizChar');
    document.getElementById('quizScore').textContent = score;
    document.getElementById('quizStreak').textContent = streak;
    document.getElementById('quizProgress').textContent = `${progress}/${total}`;
    document.getElementById('streakFire').classList.toggle('hidden', streak < State.config('streakThresholdForFire', 3));

    // Render prompt based on question type
    const type = question.type || 'pickPinyin';
    if (type === 'pickPinyin') {
      quizCharEl.textContent = question.target.char;
      quizCharEl.style.fontSize = '';
    } else if (type === 'pickChar') {
      quizCharEl.textContent = question.target.pinyin;
      quizCharEl.style.fontSize = '36px';
    } else if (type === 'fillBlank') {
      quizCharEl.textContent = question.sentence;
      quizCharEl.style.fontSize = '20px';
    }

    // Render dots
    const dotsEl = document.getElementById('quizDots');
    if (dotsEl.children.length !== total) {
      dotsEl.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'quiz-dot';
        dotsEl.appendChild(dot);
      }
    }
    dotsEl.querySelectorAll('.quiz-dot').forEach((d, i) => {
      d.classList.toggle('current', i === progress - 1);
    });

    // Render options based on type
    const container = document.getElementById('quizOptions');
    container.innerHTML = '';
    question.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      if (type === 'pickPinyin') {
        btn.textContent = opt.pinyin;
      } else if (type === 'pickChar' || type === 'fillBlank') {
        btn.textContent = opt.char;
        btn.classList.add('quiz-option-char');
      }
      btn.dataset.index = i;
      container.appendChild(btn);
    });
  }

  function showFeedback(selectedIdx, correctIdx, isCorrect) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(o => o.classList.add('disabled'));
    options[correctIdx].classList.add('correct');
    if (!isCorrect && selectedIdx >= 0) options[selectedIdx].classList.add('wrong');

    // Update dot color
    const quiz = State.get('quiz');
    const dots = document.querySelectorAll('.quiz-dot');
    if (dots[quiz.current]) {
      dots[quiz.current].classList.remove('current');
      dots[quiz.current].classList.add(isCorrect ? 'correct' : 'wrong');
    }

    // Score bounce
    if (isCorrect) {
      const scoreEl = document.getElementById('quizScore');
      scoreEl.classList.add('score-bounce');
      setTimeout(() => scoreEl.classList.remove('score-bounce'), 300);
    }
  }

  function updateStreak(streak) {
    document.getElementById('quizStreak').textContent = streak;
    document.getElementById('streakFire').classList.toggle('hidden', streak < State.config('streakThresholdForFire', 3));
    document.getElementById('quizScore').textContent = State.get('quiz').score;
  }

  function showEndScreen(score, total) {
    document.getElementById('quizActive').classList.add('hidden');
    document.getElementById('quizEnd').classList.remove('hidden');
    const pct = Math.round(score / total * 100);
    document.getElementById('endScore').textContent = `${score}/${total}`;
    document.getElementById('endDetail').textContent = `正确率 ${pct}%`;

    let msg;
    if (pct === 100) msg = State.config('encourageMessages.perfect', '太棒了！你是识字冠军！🏆');
    else if (pct >= 70) msg = State.config('encourageMessages.good', '很厉害！继续加油！💪');
    else if (pct >= 40) msg = State.config('encourageMessages.ok', '不错哦，再练习一下吧！📖');
    else msg = State.config('encourageMessages.low', '别灰心，多看看生词卡片再来挑战！🌟');
    document.getElementById('endMsg').textContent = msg;
  }

  function showQuizActive() {
    document.getElementById('quizActive').classList.remove('hidden');
    document.getElementById('quizEnd').classList.add('hidden');
  }

  return { renderQuestion, showFeedback, updateStreak, showEndScreen, showQuizActive };
})();

/** Modal UI — generic modal for displaying lists and content */
const ModalUI = (() => {
  /** Show a modal with given title and HTML content */
  function show(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function close() {
    document.getElementById('modalOverlay').classList.remove('show');
  }

  function renderFavorites(favorites) {
    if (!favorites.length) return '<p style="color:#999">还没有收藏生字</p>';
    let html = favorites.map(f =>
      `<div class="modal-item"><span class="char-display" style="font-size:24px">${escapeHtml(f)}</span><button data-action="remove-fav" data-char="${escapeHtml(f)}">✕</button></div>`
    ).join('');
    html += `<div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
      <button data-action="review-cards" class="btn-modal-action btn-modal-action--primary">📚 复习卡片</button>
      <button data-action="review-quiz" class="btn-modal-action btn-modal-action--warning">🎮 生词挑战</button>
    </div>`;
    return html;
  }

  function renderErrorBook(entries) {
    if (!entries.length) return '<p style="color:#999">没有错题，太厉害了！</p>';
    return entries.map(e =>
      `<div class="modal-item"><span class="char-display" style="font-size:24px">${escapeHtml(e.char)}</span><span>${escapeHtml(e.pinyin)} (错${e.wrongCount}次)</span></div>`
    ).join('');
  }

  // Badge theme colors (unlocked state)
  const BADGE_COLORS = {
    'challenge_master': '#4f46e5',
    'perfect_record': '#059669',
    'literacy_master': '#2563eb',
    'streak_record': '#ea580c',
    'error_killer': '#7c3aed'
  };

  function renderBadges(allBadges, stats) {
    let html = allBadges.map(b => {
      const earned = BadgeService.isEarned(b.id);
      const color = earned ? (BADGE_COLORS[b.id] || '#1e293b') : '#999';
      return `<div class="modal-item" style="opacity:${earned ? 1 : .4}">
        <span style="font-size:28px">${b.emoji}</span>
        <span style="color:${earned ? '#1e293b' : '#999'}"><strong style="color:${color}">${b.name}</strong><br><small style="color:${earned ? color : '#bbb'}">${b.desc}</small></span>
        ${earned ? '<span>✅</span>' : '<span>🔒</span>'}
      </div>`;
    }).join('');
    html += `<hr style="margin:16px 0"><p style="font-size:13px;color:#999">累计: ${stats.totalRounds}轮 | ${stats.totalCorrect}/${stats.totalAnswered}题 | 连续${stats.consecutiveDays}天</p>`;
    html += `<p style="font-size:10px;color:#ccc;margin-top:8px" id="versionTag">v1.0</p>`;
    return html;
  }

  return { show, close, renderFavorites, renderErrorBook, renderBadges };
})();

/** Badge Popup UI — celebration overlay when earning a new badge */
const BadgePopupUI = (() => {
  /** Show a badge unlock popup (auto-dismisses after 3s) */
  function show(badge) {
    const div = document.createElement('div');
    div.className = 'badge-popup';
    div.innerHTML = `<div class="emoji">${badge.emoji}</div><h3>🎉 获得新徽章！</h3><p>${badge.name} — ${badge.desc}</p>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }
  return { show };
})();
