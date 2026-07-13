/**
 * Controllers — connect state, data, and UI; handle user interactions
 */

// --- Profile Manager ---
const ProfileManager = (() => {
  const AVATARS = ['👧', '👦', '🧒', '👶', '🧒🏻', '👦🏻', '🐱', '🐶', '🦁', '🐼', '🦄', '🌟', '🚀', '🎈'];

  function getProfiles() { return State.loadShared('profiles', []); }
  function saveProfiles(profiles) { State.saveShared('profiles', profiles); }

  /**
   * Show profile picker (called at startup if no active profile, or from header button).
   * @param {Function} onSelect - Callback after profile is selected
   */
  function showPicker(onSelect) {
    const profiles = getProfiles();
    const activeId = State.getProfileId();

    // Build picker HTML
    let profilesHtml = profiles.map(p => `
      <div class="profile-item ${p.id === activeId ? 'active' : ''}" data-id="${p.id}">
        <span class="avatar">${p.avatar}</span>
        <span class="name">${p.name}</span>
        <span class="edit-icon" data-edit="${p.id}">✏️</span>
      </div>
    `).join('');

    profilesHtml += `
      <div class="profile-item profile-add" id="btnAddProfile">
        <span class="avatar">＋</span>
        <span class="name">添加</span>
      </div>
    `;

    const picker = document.createElement('div');
    picker.className = 'profile-picker';
    picker.id = 'profilePicker';
    picker.innerHTML = `
      <div class="profile-panel">
        <button class="profile-panel-close" id="btnPickerClose">✕</button>
        <h3>谁来学习？</h3>
        <div class="profile-list">${profilesHtml}</div>
        <div class="add-profile-form hidden" id="addProfileForm">
          <input type="text" id="newProfileName" placeholder="输入名字" maxlength="6">
          <div class="avatar-picker" id="avatarPicker">
            ${AVATARS.map(a => `<button data-avatar="${a}">${a}</button>`).join('')}
          </div>
          <button class="btn-confirm" id="btnConfirmAdd">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(picker);

    // Event: close picker
    document.getElementById('btnPickerClose').addEventListener('click', () => {
      picker.remove();
    });

    // Event: select existing profile
    picker.querySelectorAll('.profile-item:not(.profile-add)').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.edit-icon')) return; // Don't select when editing
        const id = item.dataset.id;
        State.setProfile(id);
        updateHeaderAvatar();
        picker.remove();
        if (onSelect) onSelect();
      });
    });

    // Event: edit profile (avatar only, name is the key and cannot change)
    picker.querySelectorAll('.edit-icon').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = icon.dataset.edit;
        const profiles = getProfiles();
        const profile = profiles.find(p => p.id === id);
        if (!profile) return;

        const form = document.getElementById('addProfileForm');
        form.classList.remove('hidden');
        const nameInput = document.getElementById('newProfileName');
        nameInput.value = profile.name;
        nameInput.disabled = true; // Name cannot be changed
        nameInput.style.opacity = '0.5';

        // Pre-select current avatar
        selectedAvatar = profile.avatar;
        document.querySelectorAll('.avatar-picker button').forEach(b => {
          b.classList.toggle('selected', b.dataset.avatar === profile.avatar);
        });

        // Change confirm button to save edit
        const confirmBtn = document.getElementById('btnConfirmAdd');
        confirmBtn.textContent = '保存头像';
        confirmBtn.onclick = () => {
          profile.avatar = selectedAvatar;
          saveProfiles(profiles);
          updateHeaderAvatar();
          picker.remove();
          showPicker(onSelect); // Re-render
        };
      });
    });

    // Event: add new profile
    let selectedAvatar = AVATARS[0];
    document.getElementById('btnAddProfile').addEventListener('click', () => {
      const form = document.getElementById('addProfileForm');
      const nameInput = document.getElementById('newProfileName');
      const confirmBtn = document.getElementById('btnConfirmAdd');
      // Reset form state (may have been left in edit mode)
      nameInput.value = '';
      nameInput.disabled = false;
      nameInput.style.opacity = '';
      confirmBtn.textContent = '确定';
      confirmBtn.onclick = null; // Clear edit handler so addEventListener works
      selectedAvatar = AVATARS[0];
      document.querySelectorAll('.avatar-picker button').forEach(b => {
        b.classList.toggle('selected', b.dataset.avatar === AVATARS[0]);
      });
      form.classList.remove('hidden');
      nameInput.focus();
    });

    document.getElementById('avatarPicker').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      selectedAvatar = btn.dataset.avatar;
      document.querySelectorAll('.avatar-picker button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    // Pre-select first avatar
    setTimeout(() => {
      const first = document.querySelector('.avatar-picker button');
      if (first) first.classList.add('selected');
    }, 0);

    document.getElementById('btnConfirmAdd').addEventListener('click', (e) => {
      // If onclick was set by edit handler, let it handle it (skip this listener)
      if (e.currentTarget.onclick) return;
      const name = document.getElementById('newProfileName').value.trim();
      if (!name) return;
      const profiles = getProfiles();
      // Check duplicate name
      if (profiles.find(p => p.id === name)) {
        alert('这个名字已经存在了');
        return;
      }
      profiles.push({ id: name, name, avatar: selectedAvatar });
      saveProfiles(profiles);
      State.setProfile(name);
      updateHeaderAvatar();
      picker.remove();
      if (onSelect) onSelect();
    });
  }

  /**
   * Initialize profile system. Auto-selects last active profile or first profile.
   * Only shows picker if no profiles exist at all.
   * @param {Function} onReady - Called when profile is set
   */
  function init(onReady) {
    const profiles = getProfiles();
    const activeId = State.loadShared('activeProfile', '');

    if (profiles.length === 0) {
      // No profiles — create a default one silently
      const defaultProfile = { id: '宝贝', name: '宝贝', avatar: '🧒' };
      saveProfiles([defaultProfile]);
      State.setProfile('宝贝');
      updateHeaderAvatar();
      if (onReady) onReady();
    } else if (activeId && profiles.find(p => p.id === activeId)) {
      // Resume last active profile
      State.setProfile(activeId);
      updateHeaderAvatar();
      if (onReady) onReady();
    } else {
      // Fallback to first profile
      State.setProfile(profiles[0].id);
      updateHeaderAvatar();
      if (onReady) onReady();
    }
  }

  function updateHeaderAvatar() {
    const profiles = getProfiles();
    const active = profiles.find(p => p.id === State.getProfileId());
    if (active) {
      const avatarEl = document.getElementById('profileAvatar');
      const nameEl = document.getElementById('profileName');
      if (avatarEl) avatarEl.textContent = active.avatar;
      if (nameEl) nameEl.textContent = active.name;
    }
    updateGreeting();
  }

  /** Set greeting based on time of day */
  function updateGreeting() {
    const hour = new Date().getHours();
    const profiles = getProfiles();
    const active = profiles.find(p => p.id === State.getProfileId());
    const name = active ? active.name : '';

    let greeting;
    if (hour < 12) greeting = `☀️ 早安${name}！今天认几个新字？`;
    else if (hour < 18) greeting = `🌤️ ${name}加油！继续学习吧`;
    else greeting = `🌙 ${name}，睡前再认几个字`;

    const el = document.getElementById('appGreeting');
    if (el) el.textContent = greeting;
  }

  return { init, showPicker, getProfiles, updateHeaderAvatar };
})();

const LearnController = (() => {
  function showCurrent() {
    const chars = State.get('filteredChars');
    if (!chars.length) return;
    const idx = State.get('currentIndex');
    CardUI.render(chars[idx], idx, chars.length);
  }

  function next() {
    const total = State.get('filteredChars').length;
    State.set('currentIndex', (State.get('currentIndex') + 1) % total);
    showCurrent();
  }

  function prev() {
    const total = State.get('filteredChars').length;
    State.set('currentIndex', (State.get('currentIndex') - 1 + total) % total);
    showCurrent();
  }

  /** Reset reinforce button state (called when filter changes) */
  function resetShuffle() {
    _resetReinforce();
  }

  /**
   * 加强记忆: toggle between normal and 3x repeated shuffle.
   * First click: triple + shuffle. Second click: restore original.
   */
  let _reinforceOriginal = null;

  function reinforce() {
    const btn = document.getElementById('btnReinforce');

    if (_reinforceOriginal) {
      // Already reinforced — restore original
      State.set('filteredChars', _reinforceOriginal);
      State.set('currentIndex', 0);
      _reinforceOriginal = null;
      if (btn) { btn.textContent = '🔁 加强记忆'; btn.classList.remove('active'); }
      showCurrent();
      return;
    }

    // Enter reinforce: save original, triple + shuffle
    const chars = State.get('filteredChars');
    if (chars.length < 1) return;

    _reinforceOriginal = [...chars];
    const repeated = [...chars, ...chars, ...chars];
    // Fisher-Yates shuffle
    for (let i = repeated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [repeated[i], repeated[j]] = [repeated[j], repeated[i]];
    }
    State.set('filteredChars', repeated);
    State.set('currentIndex', 0);
    if (btn) { btn.textContent = '🔁 退出加强'; btn.classList.add('active'); }
    showCurrent();
  }

  /** Reset reinforce state (called when filter/semester changes) */
  function _resetReinforce() {
    _reinforceOriginal = null;
    const btn = document.getElementById('btnReinforce');
    if (btn) { btn.textContent = '🔁 加强记忆'; btn.classList.remove('active'); }
  }

  function flip() { CardUI.flip(); }

  function togglePinyin() {
    const show = !State.get('showPinyin');
    State.set('showPinyin', show);
    CardUI.togglePinyinDisplay(show);
  }

  function toggleFavorite() {
    const chars = State.get('filteredChars');
    const charData = chars[State.get('currentIndex')];
    const char = charData.char;
    const isFav = FavoriteService.toggle(char);
    // Store the grade/semester context of where the char was favorited
    FavoriteService.setContext(char, charData.grade, charData.semester);
    CardUI.updateFavIcon(isFav);
    FilterUI.updateFavCount();
  }

  function speakCurrent() {
    const chars = State.get('filteredChars');
    Speech.speak(chars[State.get('currentIndex')].char);
  }

  return { showCurrent, next, prev, resetShuffle, reinforce, flip, togglePinyin, toggleFavorite, speakCurrent };
})();

const ChallengeController = (() => {
  let _questionType = 'pickPinyin';
  let _questionCount = 'all';
  let _timerSeconds = 0; // 0 = off, 5/10/15
  let _timerInterval = null;

  function setType(type) { _questionType = type; }
  function getType() { return _questionType; }
  function setCount(count) { _questionCount = count; }
  function getCount() { return _questionCount; }
  function setTimer(seconds) { _timerSeconds = seconds; }

  function _startTimer() {
    _clearTimer();
    if (_timerSeconds <= 0) {
      const bar = document.getElementById('quizTimerBar');
      if (bar) bar.classList.add('hidden');
      return;
    }

    const bar = document.getElementById('quizTimerBar');
    const fill = document.getElementById('quizTimerFill');
    if (!bar || !fill) return;

    bar.classList.remove('hidden');
    fill.style.transition = 'none';
    fill.style.width = '100%';

    // Force reflow then start animation
    fill.offsetHeight;
    fill.style.transition = `width ${_timerSeconds}s linear`;
    fill.style.width = '0%';

    // Auto-answer wrong when time runs out
    _timerInterval = setTimeout(() => {
      const quiz = State.get('quiz');
      const q = quiz.questions[quiz.current];
      if (!q.answered) {
        // Time's up — treat as wrong
        answer(-1); // -1 = no selection (timeout)
      }
    }, _timerSeconds * 1000);
  }

  function _clearTimer() {
    if (_timerInterval) {
      clearTimeout(_timerInterval);
      _timerInterval = null;
    }
  }

  function start(fromErrorBook = false) {
    console.log('[Challenge] start() called, fromErrorBook=' + fromErrorBook);
    // DEBUG: Visual feedback that button was clicked
    const endMsg = document.getElementById('endMsg');
    if (endMsg) endMsg.textContent = fromErrorBook ? '正在生成错题...' : '正在出题...';

    let questions;
    try {
      questions = DataService.generateQuizQuestions(fromErrorBook, _questionType, _questionCount);
    } catch (err) {
      console.error('[Challenge] Error generating questions:', err);
      _showStartError('生成题目时出错: ' + err.message);
      return;
    }
    if (!questions) {
      // Show feedback instead of silently failing
      console.warn('[Challenge] Cannot generate questions:', { fromErrorBook, type: _questionType, count: _questionCount, filteredLen: State.get('filteredChars').length, errorBookLen: ErrorBookService.count() });
      if (fromErrorBook) {
        const errCount = ErrorBookService.count();
        if (errCount === 0) {
          _showStartError('📖 错题本是空的，暂无可复习的字');
        } else {
          _showStartError('字数太少，无法生成题目（至少需要4个不同的字）');
        }
      } else {
        const filtered = State.get('filteredChars');
        if (!filtered || filtered.length === 0) {
          _showStartError('当前范围没有生字，请选择其他课文');
        } else {
          _showStartError('无法生成题目（filteredLen=' + filtered.length + '）');
        }
      }
      return;
    }
    State.set('quiz', { questions, current: 0, score: 0, streak: 0, isErrorReview: fromErrorBook });
    QuizUI.showQuizActive();
    showQuestion();
  }

  /** Show a brief toast/message when quiz cannot start */
  function _showStartError(msg) {
    // If end screen is visible, show message there; otherwise show toast
    const endEl = document.getElementById('quizEnd');
    if (endEl && !endEl.classList.contains('hidden')) {
      const msgEl = document.getElementById('endMsg');
      if (msgEl) {
        const origText = msgEl.textContent;
        msgEl.textContent = msg;
        msgEl.style.color = 'var(--error, #e53e3e)';
        setTimeout(() => { msgEl.textContent = origText; msgEl.style.color = ''; }, 2500);
      }
    } else {
      // Toast fallback for non-end-screen context
      const toast = document.createElement('div');
      toast.className = 'quiz-toast';
      toast.textContent = msg;
      toast.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:var(--surface,#fff);color:var(--error,#e53e3e);padding:12px 24px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;font-size:15px;animation:fadeIn .2s';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }
  }

  function showQuestion() {
    const quiz = State.get('quiz');
    const q = quiz.questions[quiz.current];
    QuizUI.renderQuestion(q, quiz.score, quiz.streak, quiz.current + 1, quiz.questions.length);
    _startTimer();
  }

  function answer(selectedIdx) {
    _clearTimer();
    const quiz = State.get('quiz');
    const q = quiz.questions[quiz.current];
    if (q.answered) return;
    q.answered = true;

    const correctIdx = q.options.indexOf(q.target);
    const isCorrect = selectedIdx >= 0 && selectedIdx === correctIdx;

    // Record for spaced repetition (every quiz answer)
    SpacedRepService.recordAnswer(q.target.char, isCorrect);

    if (isCorrect) {
      quiz.score++;
      quiz.streak++;
      Speech.speak(q.target.char);
      if (quiz.isErrorReview || State.get('selectedGrade') === 'err') {
        ErrorBookService.markCorrect(q.target.char);
      }
      if (State.get('selectedGrade') === 'fav') {
        _trackFavCorrect(q.target.char);
      }
    } else {
      quiz.streak = 0;
      ErrorBookService.addWrong(q.target.char, q.target.pinyin);
      // Reset favorites consecutive count on wrong
      if (State.get('selectedGrade') === 'fav') {
        _resetFavCorrect(q.target.char);
      }
    }
    FilterUI.updateErrCount();
    FilterUI.updateSrsCount();

    State.set('quiz', quiz);
    QuizUI.showFeedback(selectedIdx, correctIdx, isCorrect);
    QuizUI.updateStreak(quiz.streak);

    setTimeout(() => {
      quiz.current++;
      if (quiz.current < quiz.questions.length) {
        showQuestion();
      } else {
        endRound();
      }
    }, State.config('quizFeedbackDelayMs', 1200));
  }

  function endRound() {
    const quiz = State.get('quiz');
    const milestone = StatsService.recordRound(quiz.score, quiz.questions.length);
    QuizUI.showEndScreen(quiz.score, quiz.questions.length);
    FilterUI.updateStreakDisplay();
    FilterUI.updateSrsCount();

    // Show milestone celebration
    if (milestone) {
      BadgePopupUI.show(milestone);
    }

    const newBadges = BadgeService.checkAndAward();
    newBadges.forEach(b => BadgePopupUI.show(b));
  }

  // Track consecutive correct answers for favorites removal
  const _favCorrectCounts = {};

  function _trackFavCorrect(char) {
    _favCorrectCounts[char] = (_favCorrectCounts[char] || 0) + 1;
    if (_favCorrectCounts[char] >= 3) {
      FavoriteService.remove(char);
      FilterUI.updateFavCount();
      delete _favCorrectCounts[char];
    }
  }

  function _resetFavCorrect(char) {
    _favCorrectCounts[char] = 0;
  }

  return { start, answer, setType, getType, setCount, getCount, setTimer };
})();

const AppController = (() => {
  function switchMode(newMode) {
    State.set('mode', newMode);
    document.querySelectorAll('.mode-tab').forEach((t, i) => {
      t.classList.toggle('active', (i === 0 && newMode === 'learn') || (i === 1 && newMode === 'challenge'));
    });
    // Mode switch UI
    document.getElementById('learnMode').classList.toggle('hidden', newMode !== 'learn');
    document.getElementById('challengeMode').classList.toggle('hidden', newMode !== 'challenge');

    if (newMode === 'challenge') {
      // Move the lesson filter into challenge mode (before quiz type selector)
      const filterEl = document.querySelector('.content-header');
      const typeSel = document.getElementById('quizTypeSelector');
      if (typeSel && filterEl) {
        typeSel.before(filterEl);
      }
      ChallengeController.start();
    } else {
      // Move the lesson filter back into learn mode (first child)
      const filterEl = document.querySelector('.content-header');
      const learnEl = document.getElementById('learnMode');
      if (learnEl && filterEl) {
        learnEl.insertBefore(filterEl, learnEl.firstChild);
      }
    }
  }

  function selectSemester(sem, grade) {
    State.set('selectedSemester', sem);
    State.set('selectedGrade', grade);
    LearnController.resetShuffle();

    const currentMode = State.get('mode');

    if (grade === 'fav') {
      // Special: filter to favorites with semester-based dropdown
      const allChars = State.get('allChars');
      const favorites = FavoriteService.getAll();

      // Build favChars using stored context (grade/semester where char was favorited)
      // Fallback: for legacy favorites without context, use first match in allChars
      const favChars = [];
      const seen = new Set();
      for (const char of favorites) {
        if (seen.has(char)) continue;
        seen.add(char);
        const ctx = FavoriteService.getContext(char);
        if (ctx) {
          // Use stored context — find the exact allChars entry matching grade+semester
          const match = allChars.find(c => c.char === char && c.grade === ctx.grade && c.semester === ctx.semester);
          if (match) { favChars.push(match); continue; }
        }
        // Fallback: use first occurrence in allChars
        const fallback = allChars.find(c => c.char === char);
        if (fallback) favChars.push(fallback);
      }

      State.set('filteredChars', favChars);
      State.set('currentIndex', 0);

      // Group favorites by grade-semester
      const gradeNames = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
      const semNames = ['', '上册', '下册'];
      const bySemester = {};
      for (const c of favChars) {
        const key = `${c.grade}-${c.semester}`;
        if (!bySemester[key]) bySemester[key] = [];
        bySemester[key].push(c);
      }

      let options = `<option value="fav_all">❤️ 全部收藏 (${favChars.length}字)</option>`;
      const sortedKeys = Object.keys(bySemester).sort((a, b) => {
        const [g1, s1] = a.split('-').map(Number);
        const [g2, s2] = b.split('-').map(Number);
        return g1 !== g2 ? g1 - g2 : s1 - s2;
      });
      for (const key of sortedKeys) {
        const [g, s] = key.split('-').map(Number);
        if (g > 0 && g < gradeNames.length && s > 0 && s < semNames.length) {
          options += `<option value="fav_sem_${key}">📗 ${gradeNames[g]}${semNames[s]} (${bySemester[key].length}字)</option>`;
        }
      }

      const sel = document.getElementById('lessonFilter');
      sel.innerHTML = options;
    } else if (grade === 'err') {
      // Special: filter to error book with frequency-based dropdown
      const allChars = State.get('allChars');
      const errorBook = ErrorBookService.getAll();
      const seen = new Set();
      const errChars = [];
      for (const c of allChars) {
        if (errorBook.some(e => e.char === c.char) && !seen.has(c.char)) {
          seen.add(c.char);
          errChars.push(c);
        }
      }
      State.set('filteredChars', errChars);
      State.set('currentIndex', 0);

      // Group by error frequency
      const frequent = errorBook.filter(e => e.wrongCount >= 3);
      const occasional = errorBook.filter(e => e.wrongCount === 2);
      const recent = errorBook.filter(e => e.wrongCount === 1);

      let options = `<option value="err_all">📖 全部错题 (${errChars.length}字)</option>`;
      if (frequent.length > 0) options += `<option value="err_frequent">🔴 经常出错 (${frequent.length}字)</option>`;
      if (occasional.length > 0) options += `<option value="err_occasional">🟡 偶尔出错 (${occasional.length}字)</option>`;
      if (recent.length > 0) options += `<option value="err_recent">🟢 刚出错 (${recent.length}字)</option>`;

      const sel = document.getElementById('lessonFilter');
      sel.innerHTML = options;
    } else if (grade === 'srs') {
      // Special: filter to spaced repetition with categorized dropdown
      const allChars = State.get('allChars');
      const categories = SpacedRepService.getCategorizedChars();
      const dueCharList = SpacedRepService.getDueChars();

      // Build "all due" list (default view)
      const seen = new Set();
      const srsChars = [];
      for (const c of allChars) {
        if (dueCharList.includes(c.char) && !seen.has(c.char)) {
          seen.add(c.char);
          srsChars.push(c);
        }
      }
      State.set('filteredChars', srsChars);
      State.set('currentIndex', 0);

      // Build dropdown with categories
      const sel = document.getElementById('lessonFilter');
      const allDueCount = srsChars.length;
      const todayCount = categories.todayTask.length;
      const reviewCount = categories.scheduledReview.length;
      const familiarCount = categories.familiar.length;
      const almostCount = categories.almostMastered.length;
      const masteredCount = categories.mastered.length;

      let options = `<option value="srs_all">📈 全部待复习 (${allDueCount}字)</option>`;
      if (todayCount > 0) options += `<option value="srs_today">🔴 今日任务 (${todayCount}字)</option>`;
      if (reviewCount > 0) options += `<option value="srs_review">🟡 复习回顾 (${reviewCount}字)</option>`;
      if (familiarCount > 0) options += `<option value="srs_familiar">🔵 熟悉中 (${familiarCount}字)</option>`;
      if (almostCount > 0) options += `<option value="srs_almost">🟣 快掌握了 (${almostCount}字)</option>`;
      if (masteredCount > 0) options += `<option value="srs_mastered">⭐ 已掌握 (${masteredCount}字)</option>`;
      sel.innerHTML = options;
    } else {
      FilterUI.renderLessons();
      DataService.applyFilter('all');
    }

    if (currentMode === 'challenge') {
      ChallengeController.start();
    } else {
      LearnController.showCurrent();
    }
  }

  function selectLesson(lessonId) {
    // Handle SRS category filters
    if (lessonId && lessonId.startsWith('srs_')) {
      const allChars = State.get('allChars');
      const categories = SpacedRepService.getCategorizedChars();
      let targetChars = [];

      if (lessonId === 'srs_all') {
        targetChars = SpacedRepService.getDueChars();
      } else if (lessonId === 'srs_today') {
        targetChars = categories.todayTask;
      } else if (lessonId === 'srs_review') {
        targetChars = categories.scheduledReview;
      } else if (lessonId === 'srs_familiar') {
        targetChars = categories.familiar;
      } else if (lessonId === 'srs_almost') {
        targetChars = categories.almostMastered;
      } else if (lessonId === 'srs_mastered') {
        targetChars = categories.mastered;
      }

      const targetSet = new Set(targetChars);
      const seen = new Set();
      const filtered = [];
      for (const c of allChars) {
        if (targetSet.has(c.char) && !seen.has(c.char)) {
          seen.add(c.char);
          filtered.push(c);
        }
      }
      State.set('filteredChars', filtered);
      State.set('currentIndex', 0);
    } else if (lessonId && lessonId.startsWith('fav_')) {
      // Handle favorites semester filters
      const allChars = State.get('allChars');
      const favorites = FavoriteService.getAll();
      const seen = new Set();
      const favChars = [];
      for (const c of allChars) {
        if (favorites.includes(c.char) && !seen.has(c.char)) {
          seen.add(c.char);
          favChars.push(c);
        }
      }

      if (lessonId === 'fav_all') {
        State.set('filteredChars', favChars);
      } else if (lessonId.startsWith('fav_sem_')) {
        // fav_sem_G-S — filter by grade and semester
        const [gradeNum, semNum] = lessonId.replace('fav_sem_', '').split('-').map(Number);
        const filtered = favChars.filter(c => c.grade === gradeNum && c.semester === semNum);
        State.set('filteredChars', filtered);
      }
      State.set('currentIndex', 0);
    } else if (lessonId && lessonId.startsWith('err_')) {
      // Handle error book frequency filters
      const allChars = State.get('allChars');
      const errorBook = ErrorBookService.getAll();
      let targetChars = [];

      if (lessonId === 'err_all') {
        targetChars = errorBook.map(e => e.char);
      } else if (lessonId === 'err_frequent') {
        targetChars = errorBook.filter(e => e.wrongCount >= 3).map(e => e.char);
      } else if (lessonId === 'err_occasional') {
        targetChars = errorBook.filter(e => e.wrongCount === 2).map(e => e.char);
      } else if (lessonId === 'err_recent') {
        targetChars = errorBook.filter(e => e.wrongCount === 1).map(e => e.char);
      }

      const targetSet = new Set(targetChars);
      const seen = new Set();
      const filtered = [];
      for (const c of allChars) {
        if (targetSet.has(c.char) && !seen.has(c.char)) {
          seen.add(c.char);
          filtered.push(c);
        }
      }
      State.set('filteredChars', filtered);
      State.set('currentIndex', 0);
    } else {
      DataService.applyFilter(lessonId);
    }

    if (State.get('mode') === 'challenge') {
      ChallengeController.start();
    } else {
      LearnController.showCurrent();
    }
  }

  function showFavorites() {
    const html = ModalUI.renderFavorites(FavoriteService.getAll());
    ModalUI.show(`❤️ 生词本 (${FavoriteService.getAll().length}字)`, html);
  }

  function showErrorBook() {
    const html = ModalUI.renderErrorBook(ErrorBookService.getAll());
    ModalUI.show(`📖 错题本 (${ErrorBookService.count()}字)`, html);
  }

  function showBadges() {
    // Award any badges that qualify but haven't been awarded yet
    BadgeService.checkAndAward();
    const html = ModalUI.renderBadges(BadgeService.getAll(), StatsService.get());
    ModalUI.show('🏆 成就墙', html);
  }

  function removeFavorite(char) {
    FavoriteService.remove(char);
    showFavorites();
    LearnController.showCurrent();
    FilterUI.updateFavCount();
  }

  function reviewFavoritesAsCards() {
    const allChars = State.get('allChars');
    const favorites = FavoriteService.getAll();
    const favChars = allChars.filter(c => favorites.includes(c.char));
    if (!favChars.length) return;
    State.set('filteredChars', favChars);
    State.set('currentIndex', 0);
    ModalUI.close();
    switchMode('learn');
    LearnController.showCurrent();
  }

  function reviewFavoritesAsQuiz() {
    const allChars = State.get('allChars');
    const favorites = FavoriteService.getAll();
    const favChars = allChars.filter(c => favorites.includes(c.char));
    if (favChars.length < 4) { alert('生词本中字数不足4个，无法开始挑战'); return; }
    State.set('filteredChars', favChars);
    ModalUI.close();
    switchMode('challenge');
  }

  function setupSwipe() {
    let startX = 0;
    let startY = 0;
    const container = document.getElementById('cardContainer');
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (State.get('mode') !== 'learn') return;
      const diffX = startX - e.changedTouches[0].clientX;
      const diffY = Math.abs(startY - e.changedTouches[0].clientY);
      if (diffY > 50) return; // vertical scroll, ignore
      if (diffX > 60) LearnController.next();
      else if (diffX < -60) LearnController.prev();
    }, { passive: true });
  }

  async function init() {
    try {
      // Show loading state
      const mainEl = document.querySelector('main');
      mainEl.innerHTML = `
        <div style="text-align:center;padding:48px 24px;color:var(--text-muted)">
          <div style="font-size:36px;margin-bottom:12px">⏳</div>
          <p>正在加载数据...</p>
        </div>`;

      // Load configuration first
      await State.loadConfig();

      // Preload speech voices (async in some browsers)
      Speech.init();

      // Load character data
      const { allChars } = await DataService.loadAll();

      // Handle empty data gracefully
      if (!allChars.length) {
        mainEl.innerHTML = `
          <div style="text-align:center;padding:48px 24px;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:16px">📭</div>
            <h3 style="color:var(--text);margin-bottom:8px">暂无数据</h3>
            <p>请将生字JSON文件放入 data/ 目录</p>
            <p style="font-size:12px;margin-top:12px">格式: grade{N}-semester{M}.json</p>
          </div>`;
        return;
      }

      // Restore main content (was replaced by loading state)
      mainEl.innerHTML = _getMainContentHTML();

      // Profile selection — waits for user to pick/create a profile before proceeding
      ProfileManager.init(() => {
        try {
          FilterUI.updateStripCounts(State.get('lessons'));
          FilterUI.renderLessons();
          FilterUI.updateFavCount();
          FilterUI.updateErrCount();
          FilterUI.updateSrsCount();
          FilterUI.updateStreakDisplay();

          // Default view: show favorites if any, otherwise show 一上
          const favorites = FavoriteService.getAll();
          if (favorites.length > 0) {
            selectSemester('fav', 'fav');
            // Update sidebar active state
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            const favItem = document.querySelector('.sidebar-item[data-grade="fav"]');
            if (favItem) favItem.classList.add('active');
          } else {
            selectSemester('1', '1');
          }
        } catch (e) {
          console.warn('[App] Setup error (non-fatal):', e);
        }

        console.info('[App] Binding events...');
        bindEvents();
        console.info('[App] ✅ Ready!');        setupSwipe();
      });
    } catch (err) {
      console.error('[App] Initialization failed:', err);
      const mainEl = document.querySelector('main');
      mainEl.innerHTML = `
        <div style="text-align:center;padding:48px 24px;color:var(--error)">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <h3 style="color:var(--text);margin-bottom:8px">加载失败</h3>
          <p style="color:var(--text-muted)">${escapeHtml(err.message)}</p>
          <button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer">重试</button>
        </div>`;
    }
  }

  /** Returns the original main content HTML (restored after loading state) */
  function _getMainContentHTML() {
    return `
    <!-- Learning Mode -->
    <div id="learnMode">
      <div class="content-header">
        <label for="lessonFilter" class="hidden">选择课文</label>
        <select id="lessonFilter" aria-label="选择课文">
          <option value="all">全部课文</option>
        </select>
      </div>
      <div class="card-container" id="cardContainer">
        <div class="card" id="flashcard" role="button" aria-label="点击翻转卡片">
          <div class="card-face card-front">
            <button class="pinyin-toggle" id="btnPinyinToggle">拼音</button>
            <button class="fav-btn" id="favBtn">🤍</button>
            <div class="card-char char-display" id="cardChar">天</div>
            <div class="card-pinyin-small hidden" id="cardPinyinSmall">tiān</div>
            <div class="card-hint">点击翻转 →</div>
          </div>
          <div class="card-face card-back">
            <div class="card-pinyin-back" id="cardPinyinBack">tiān</div>
            <div class="card-words" id="cardWords">天空 · 今天 · 蓝天</div>
            <div class="card-sentence" id="cardSentence">天在上，地在下。</div>
          </div>
        </div>
      </div>
      <div class="card-controls">
        <button id="btnPrev" aria-label="上一个">⬅️ 上一个</button>
        <button id="btnFlip" aria-label="翻转卡片">🔄 翻转</button>
        <button id="btnSpeak" aria-label="朗读">🔊 朗读</button>
        <button id="btnReinforce" aria-label="加强记忆" class="btn-reinforce">🔁 加强记忆</button>
        <button id="btnNext" aria-label="下一个">➡️ 下一个</button>
      </div>
      <div class="progress-container">
        <div class="progress-track"><div class="progress-fill" id="progressFill" style="width:2%"></div></div>
        <div class="progress-text" id="progressBar">1 / 45</div>
      </div>
    </div>

    <!-- Challenge Mode -->
    <div id="challengeMode" class="hidden">
      <div class="quiz-type-selector" id="quizTypeSelector">
        <button class="quiz-type-btn active" data-qtype="pickPinyin">字→音</button>
        <button class="quiz-type-btn" data-qtype="pickChar">音→字</button>
        <button class="quiz-type-btn" data-qtype="fillBlank">📝 填空</button>
        <button class="quiz-type-btn" data-qtype="mixed">🎲 混合</button>
        <select id="quizTimerSelect" class="quiz-timer-select">
          <option value="0">⏱️ 关</option>
          <option value="5">⏱️ 5秒</option>
          <option value="10">⏱️ 10秒</option>
          <option value="15">⏱️ 15秒</option>
        </select>
      </div>
      <div class="quiz-timer-bar hidden" id="quizTimerBar">
        <div class="quiz-timer-fill" id="quizTimerFill"></div>
      </div>
      <div class="quiz-container" id="quizActive">
        <div class="quiz-dots" id="quizDots"></div>
        <div class="quiz-stats">
          <span>📊 <span id="quizScore">0</span>分</span>
          <span>🔥 <span id="quizStreak">0</span>连对 <span id="streakFire" class="streak-fire hidden">🔥</span></span>
          <span>📝 <span id="quizProgress">1/10</span></span>
        </div>
        <div class="quiz-char char-display" id="quizChar">天</div>
        <div class="quiz-options" id="quizOptions"></div>
      </div>
      <div id="quizEnd" class="end-screen hidden">
        <div class="end-score" id="endScore">8</div>
        <div class="end-detail" id="endDetail">正确率 80%</div>
        <div class="end-msg" id="endMsg">很厉害！继续加油！💪</div>
        <div class="end-actions">
          <button class="btn-play-again" id="btnPlayAgain" onclick="ChallengeController.start()">🔄 再来一轮</button>
          <button class="btn-play-again btn-play-again--secondary" id="btnErrorReview" onclick="ChallengeController.start(true)">📖 错题复习</button>
        </div>
      </div>
    </div>`;
  }

  function bindEvents() {
    // --- Header actions ---
    document.getElementById('btnProfile').addEventListener('click', () => {
      ProfileManager.showPicker(() => {
        // Reload UI with new profile's data
        FilterUI.updateFavCount();
        FilterUI.updateErrCount();
        SpacedRepService.resetCache();
    FilterUI.updateSrsCount();
        FilterUI.updateStreakDisplay();
        LearnController.showCurrent();
      });
    });
    document.getElementById('btnFavorites').addEventListener('click', showFavorites);
    document.getElementById('btnErrorBook').addEventListener('click', showErrorBook);
    document.getElementById('btnBadges').addEventListener('click', showBadges);

    // --- Navigation: sidebar ---
    // Review group toggle (collapsible)
    document.getElementById('reviewGroupToggle').addEventListener('click', () => {
      const header = document.getElementById('reviewGroupToggle');
      const items = document.getElementById('reviewGroupItems');
      const arrow = document.getElementById('reviewArrow');
      const isCollapsed = items.classList.toggle('collapsed');
      header.classList.toggle('collapsed');
      arrow.textContent = isCollapsed ? '+' : '−';
    });

    // Grade accordion — click header to expand, collapse others
    document.getElementById('sidebarGrades').addEventListener('click', (e) => {
      const header = e.target.closest('.sidebar-grade-header');
      if (header) {
        const group = header.closest('.sidebar-grade-group');
        const children = group.querySelector('.sidebar-grade-children');
        const isExpanded = children.classList.contains('expanded');

        // Collapse all
        document.querySelectorAll('.sidebar-grade-children.expanded').forEach(el => el.classList.remove('expanded'));
        document.querySelectorAll('.sidebar-grade-header.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sidebar-grade-arrow').forEach(el => el.textContent = '+');

        // Expand clicked (if it wasn't already open)
        if (!isExpanded) {
          children.classList.add('expanded');
          header.classList.add('active');
          header.querySelector('.sidebar-grade-arrow').textContent = '−';
        }
        return;
      }
    });

    // Sidebar item clicks (semester selection + review items)
    document.getElementById('sidebar').addEventListener('click', (e) => {
      const item = e.target.closest('.sidebar-item');
      if (!item || item.classList.contains('disabled')) return;

      // Handle badges button
      if (item.id === 'sidebarBadges') {
        showBadges();
        return;
      }

      // Handle grade/review item selection
      if (item.dataset.sem && item.dataset.grade) {
        document.querySelectorAll('.sidebar-item').forEach(c => c.classList.remove('active'));
        item.classList.add('active');
        selectSemester(item.dataset.sem, item.dataset.grade);
      }
    });

    // --- Navigation: lesson filter ---
    document.getElementById('lessonFilter').addEventListener('change', (e) => {
      selectLesson(e.target.value);
    });

    // --- Navigation: mode tabs ---
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // --- Learning mode: card interactions ---
    document.getElementById('flashcard').addEventListener('click', LearnController.flip);
    document.getElementById('btnPinyinToggle').addEventListener('click', (e) => { e.stopPropagation(); LearnController.togglePinyin(); });
    document.getElementById('favBtn').addEventListener('click', (e) => { e.stopPropagation(); LearnController.toggleFavorite(); });
    document.getElementById('btnPrev').addEventListener('click', LearnController.prev);
    document.getElementById('btnFlip').addEventListener('click', LearnController.flip);
    document.getElementById('btnSpeak').addEventListener('click', LearnController.speakCurrent);
    document.getElementById('btnReinforce').addEventListener('click', LearnController.reinforce);
    document.getElementById('btnNext').addEventListener('click', LearnController.next);

    // --- Challenge mode: quiz actions ---
    document.getElementById('quizTypeSelector').addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-type-btn');
      if (!btn) return;
      document.querySelectorAll('.quiz-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ChallengeController.setType(btn.dataset.qtype);
      ChallengeController.start();
    });
    document.getElementById('quizTimerSelect').addEventListener('change', (e) => {
      ChallengeController.setTimer(parseInt(e.target.value));
      ChallengeController.start();
    });
    document.getElementById('btnPlayAgain').addEventListener('click', () => ChallengeController.start());
    document.getElementById('btnErrorReview').addEventListener('click', () => ChallengeController.start(true));
    document.getElementById('quizOptions').addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-option');
      if (btn) ChallengeController.answer(parseInt(btn.dataset.index));
    });

    // --- Modal ---
    document.getElementById('btnModalClose').addEventListener('click', ModalUI.close);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) ModalUI.close();
    });
    document.getElementById('modalContent').addEventListener('click', (e) => {
      const removeFavBtn = e.target.closest('[data-action="remove-fav"]');
      if (removeFavBtn) { removeFavorite(removeFavBtn.dataset.char); return; }

      const reviewCards = e.target.closest('[data-action="review-cards"]');
      if (reviewCards) { reviewFavoritesAsCards(); return; }

      const reviewQuiz = e.target.closest('[data-action="review-quiz"]');
      if (reviewQuiz) { reviewFavoritesAsQuiz(); return; }
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
      if (State.get('mode') !== 'learn') return;
      if (e.key === 'ArrowRight') LearnController.next();
      else if (e.key === 'ArrowLeft') LearnController.prev();
      else if (e.key === ' ') { e.preventDefault(); LearnController.flip(); }
    });
  }

  return { init, switchMode, selectSemester, selectLesson, showFavorites, showErrorBook, showBadges };
})();
