/**
 * Daily Task Service & Controller
 *
 * Guides the child through one lesson per day:
 *   Step 1: 复习 — review SRS due chars (from previous lessons)
 *   Step 2: 学习 — flip through all chars in current lesson
 *   Step 3: 闯关 — quiz on the full lesson
 *
 * Lesson progression is sequential within grade/semester.
 * Always forward, never stuck. Wrong chars self-heal via SRS.
 *
 * Growth rewards:
 *   <60%:  tree +1  |  60-79%: +2  |  80-99%: +3  |  100%: +5
 */

const DailyTaskService = (() => {
  const GROWTH_REWARDS = [
    { min: 0, max: 59, points: 1, msg: '继续加油！明天再复习这些字', emoji: '💪' },
    { min: 60, max: 79, points: 2, msg: '不错哦！差一点就满分了', emoji: '👍' },
    { min: 80, max: 99, points: 3, msg: '太厉害了！', emoji: '⭐' },
    { min: 100, max: 100, points: 5, msg: '完美！你是识字冠军！', emoji: '🌟' }
  ];

  /** Get today's date string */
  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Get lesson progress for current profile */
  function getProgress() {
    return State.load('lessonProgress', null);
  }

  /** Check if initial setup has been done */
  function needsSetup() {
    return getProgress() === null;
  }

  /** Initialize progress with defaults (called after setup) */
  function initProgress(grade, semester, lessonIndex = 0) {
    const progress = {
      grade,
      semester,
      lessonIndex,
      completedLessons: []
    };
    _saveProgress(progress);
    return progress;
  }

  /** Save lesson progress */
  function _saveProgress(progress) {
    State.save('lessonProgress', progress);
  }

  /** Get today's task state */
  function getTaskState() {
    const state = State.load('dailyTask', {
      date: '',
      step: 'review',        // 'review' | 'learn' | 'quiz' | 'done'
      reviewDone: false,
      learnDone: false,
      learnedChars: [],      // chars flipped today
      quizDone: false,
      quizScore: 0,
      quizTotal: 0,
      growthEarned: 0
    });
    // Reset if it's a new day
    if (state.date !== _today()) {
      return _newDayState();
    }
    return state;
  }

  /** Create fresh task state for today */
  function _newDayState() {
    const state = {
      date: _today(),
      step: 'review',
      reviewDone: false,
      learnDone: false,
      learnedChars: [],
      quizDone: false,
      quizScore: 0,
      quizTotal: 0,
      growthEarned: 0
    };
    State.save('dailyTask', state);
    return state;
  }

  /** Save task state */
  function _saveTask(state) {
    State.save('dailyTask', state);
  }

  /** Get the current lesson's character data */
  function getCurrentLesson() {
    const progress = getProgress();
    if (!progress) return null;
    const lessons = State.get('lessons') || [];
    // Find lessons for the current grade/semester
    const gradeLessons = lessons.filter(l => {
      const [g, s] = l.id.split('-');
      return parseInt(g) === progress.grade && parseInt(s) === progress.semester;
    });
    if (progress.lessonIndex >= gradeLessons.length) {
      return null; // All lessons in this semester done
    }
    return gradeLessons[progress.lessonIndex];
  }

  /** Get all lessons for current grade/semester */
  function getCurrentGradeLessons() {
    const progress = getProgress();
    if (!progress) return [];
    const lessons = State.get('lessons') || [];
    return lessons.filter(l => {
      const [g, s] = l.id.split('-');
      return parseInt(g) === progress.grade && parseInt(s) === progress.semester;
    });
  }

  /** Get chars due for review (from SRS) */
  function getReviewChars() {
    const dueChars = SpacedRepService.getDueChars();
    const allChars = State.get('allChars') || [];
    // Map char strings to full char objects
    const result = [];
    const seen = new Set();
    for (const c of allChars) {
      if (dueChars.includes(c.char) && !seen.has(c.char)) {
        seen.add(c.char);
        result.push(c);
      }
    }
    return result;
  }

  /** Mark review step as done */
  function completeReview() {
    const state = getTaskState();
    state.reviewDone = true;
    state.step = 'learn';
    _saveTask(state);
  }

  /** Record a char as "seen" during learn step */
  function markCharLearned(char) {
    const state = getTaskState();
    if (!state.learnedChars.includes(char)) {
      state.learnedChars.push(char);
    }
    _saveTask(state);
  }

  /** Mark learn step as done */
  function completeLearn() {
    const state = getTaskState();
    state.learnDone = true;
    state.step = 'quiz';
    _saveTask(state);
  }

  /** Complete the quiz step and calculate rewards */
  function completeQuiz(score, total) {
    const state = getTaskState();
    state.quizDone = true;
    state.quizScore = score;
    state.quizTotal = total;
    state.step = 'done';

    // Calculate growth reward
    const pct = total > 0 ? Math.round(score / total * 100) : 0;
    const reward = GROWTH_REWARDS.find(r => pct >= r.min && pct <= r.max) || GROWTH_REWARDS[0];
    state.growthEarned = reward.points;
    _saveTask(state);

    // Record growth points
    const growth = State.load('growthPoints', 0);
    State.save('growthPoints', growth + reward.points);

    // Advance to next lesson
    _advanceLesson();

    // Update streak
    StatsService.recordDailyTask();

    return reward;
  }

  /** Advance lesson progress to next lesson */
  function _advanceLesson() {
    const progress = getProgress();
    if (!progress) return;
    const lesson = getCurrentLesson();
    if (lesson) {
      progress.completedLessons.push(lesson.id);
    }
    progress.lessonIndex++;

    // Check if all lessons in this semester are done
    const gradeLessons = getCurrentGradeLessons();
    if (progress.lessonIndex >= gradeLessons.length) {
      // Advance to next semester or grade
      if (progress.semester === 1) {
        progress.semester = 2;
        progress.lessonIndex = 0;
      } else {
        progress.grade++;
        progress.semester = 1;
        progress.lessonIndex = 0;
      }
    }
    _saveProgress(progress);
  }

  /** Get growth level based on total unique chars in SRS */
  function getGrowthLevel() {
    const total = SpacedRepService.getTotalCount();
    const levels = [
      { min: 0, emoji: '🌰', name: '种子', next: 50 },
      { min: 50, emoji: '🌱', name: '萌芽', next: 100 },
      { min: 100, emoji: '🌿', name: '小苗', next: 200 },
      { min: 200, emoji: '🌳', name: '小树', next: 500 },
      { min: 500, emoji: '⭐', name: '大树', next: 1000 },
      { min: 1000, emoji: '👑', name: '千字王', next: 2000 },
      { min: 2000, emoji: '🏆', name: '识字冠军', next: 9999 }
    ];
    let current = levels[0];
    for (const l of levels) {
      if (total >= l.min) current = l;
      else break;
    }
    const nextLevel = levels[levels.indexOf(current) + 1] || current;
    return {
      ...current,
      total,
      nextEmoji: nextLevel.emoji,
      nextName: nextLevel.name,
      nextMin: nextLevel.min,
      progress: current.next > current.min ? (total - current.min) / (current.next - current.min) : 1
    };
  }

  /** Check if today's task is already completed */
  function isCompletedToday() {
    const state = getTaskState();
    return state.step === 'done';
  }

  /** Set the starting grade/semester for a new user or manual override */
  function setStartLevel(grade, semester, lessonIndex = 0) {
    initProgress(grade, semester, lessonIndex);
  }

  return {
    getProgress,
    needsSetup,
    initProgress,
    getTaskState,
    getCurrentLesson,
    getCurrentGradeLessons,
    getReviewChars,
    completeReview,
    markCharLearned,
    completeLearn,
    completeQuiz,
    getGrowthLevel,
    isCompletedToday,
    setStartLevel,
    GROWTH_REWARDS
  };
})();

/**
 * Daily Task UI Controller
 * Manages the 3-step task flow rendering and user interactions.
 */
const DailyTaskController = (() => {
  let _reviewCards = [];
  let _reviewIndex = 0;
  let _learnCards = [];
  let _learnIndex = 0;

  /** Render the daily task screen */
  function render() {
    const container = document.getElementById('dailyTaskMode');
    if (!container) return;

    // Ensure data is loaded
    const allChars = State.get('allChars');
    if (!allChars || allChars.length === 0) {
      container.innerHTML = '<div class="dt-setup"><p>正在加载数据...</p></div>';
      // Retry after data loads
      setTimeout(render, 500);
      return;
    }

    // First-time setup
    if (DailyTaskService.needsSetup()) {
      _renderSetup(container);
      return;
    }

    try {
      const state = DailyTaskService.getTaskState();
      const lesson = DailyTaskService.getCurrentLesson();
      const progress = DailyTaskService.getProgress();
      const growth = DailyTaskService.getGrowthLevel();

      if (state.step === 'done') {
        _renderComplete(container, state, growth);
      } else if (!lesson) {
        _renderAllDone(container, progress, growth);
      } else {
        _renderTask(container, state, lesson, progress, growth);
      }
    } catch (e) {
      container.innerHTML = `<div class="dt-setup"><p style="color:var(--error)">❌ 加载失败: ${e.message}</p><button class="dt-btn-secondary" onclick="DailyTaskController.render()">重试</button></div>`;
    }
  }

  /** Render the first-time setup screen */
  function _renderSetup(container) {
    const GRADE_NAMES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
    const GRADE_ICONS = ['', '📘', '📗', '📙', '📕', '📒', '📘', '📖', '📖', '📖'];
    const SEM_NAMES = ['', '上册', '下册'];
    const lessons = State.get('lessons') || [];
    const allChars = State.get('allChars') || [];

    // Build list of available grade-semester combinations
    const options = [];
    for (let g = 1; g <= 9; g++) {
      for (let s = 1; s <= 2; s++) {
        const gradeLessons = lessons.filter(l => { const [lg, ls] = l.id.split('-'); return parseInt(lg) === g && parseInt(ls) === s; });
        if (gradeLessons.length === 0) continue;
        const charCount = allChars.filter(c => c.grade === g && c.semester === s).length;
        options.push({ grade: g, semester: s, lessonCount: gradeLessons.length, charCount });
      }
    }

    container.innerHTML = `
      <div class="dt-setup">
        <div class="dt-setup-header">
          <div class="dt-setup-emoji">👋</div>
          <h2>欢迎！你现在学到哪里了？</h2>
          <p class="dt-setup-subtitle">选择年级和学期，每日任务从这里开始</p>
        </div>
        <div class="dt-setup-grades">
          ${options.map(o => `
            <button class="dt-setup-grade" onclick="DailyTaskController._selectGradeSem(${o.grade}, ${o.semester})">
              <span class="dt-setup-grade-icon">${GRADE_ICONS[o.grade]}</span>
              <span class="dt-setup-grade-name">${GRADE_NAMES[o.grade]}${SEM_NAMES[o.semester]}</span>
              <span class="dt-setup-grade-count">${o.lessonCount}课 · ${o.charCount}字</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /** Called from onclick — select grade+semester, show lesson picker */
  function _selectGradeSem(grade, semester) {
    const container = document.getElementById('dailyTaskMode');
    _renderSetupLesson(container, grade, semester);
  }

  /** Render lesson selection */
  function _renderSetupLesson(container, grade, semester) {
    const GRADE_NAMES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
    const SEM_NAMES = ['', '上册', '下册'];
    const lessons = State.get('lessons') || [];
    const gradeLessons = lessons.filter(l => { const [g, s] = l.id.split('-'); return parseInt(g) === grade && parseInt(s) === semester; });

    container.innerHTML = `
      <div class="dt-setup">
        <div class="dt-setup-header">
          <h2>${GRADE_NAMES[grade]}${SEM_NAMES[semester]} — 从哪一课开始？</h2>
          <p class="dt-setup-subtitle">选择你还没学过的第一课</p>
        </div>
        <div class="dt-setup-lessons">
          <button class="dt-setup-lesson highlighted" onclick="DailyTaskController._selectLesson(${grade}, ${semester}, 0)">
            <span class="dt-setup-lesson-icon">⭐</span>
            <span class="dt-setup-lesson-name">从头开始</span>
            <span class="dt-setup-lesson-info">第1课</span>
          </button>
          ${gradeLessons.map((l, i) => `
            <button class="dt-setup-lesson" onclick="DailyTaskController._selectLesson(${grade}, ${semester}, ${i})">
              <span class="dt-setup-lesson-icon">📄</span>
              <span class="dt-setup-lesson-name">${escapeHtml(l.title)}</span>
              <span class="dt-setup-lesson-info">${l.chars.length}字</span>
            </button>
          `).join('')}
        </div>
        <button class="dt-setup-back" onclick="DailyTaskController.render()">← 返回</button>
      </div>
    `;
  }

  /** Called from onclick — select lesson and start */
  function _selectLesson(grade, semester, idx) {
    DailyTaskService.initProgress(grade, semester, idx);
    render();
  }

  /** Render the active task screen */
  function _renderTask(container, state, lesson, progress, growth) {
    const reviewChars = DailyTaskService.getReviewChars();
    const lessonChars = lesson.chars || [];
    const gradeLessons = DailyTaskService.getCurrentGradeLessons();
    const totalLessons = gradeLessons.length;

    const gradeNames = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
    const semNames = ['', '上册', '下册'];
    const gradeName = gradeNames[progress.grade] || `${progress.grade}年级`;
    const semName = semNames[progress.semester] || '';

    container.innerHTML = `
      <div class="dt-header">
        <div class="dt-growth-mini">
          ${growth.emoji} <span class="dt-growth-count">${growth.total}字</span>
        </div>
        <h2 class="dt-title">📖 今日任务</h2>
        <div class="dt-lesson-info">${gradeName}${semName} · ${lesson.title}</div>
        <div class="dt-lesson-progress">第 ${progress.lessonIndex + 1}/${totalLessons} 课 · ${lessonChars.length}个生字</div>
      </div>

      <div class="dt-steps">
        <div class="dt-step ${state.reviewDone ? 'done' : state.step === 'review' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.reviewDone ? '✅' : '🔄'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">复习</div>
            <div class="dt-step-desc">${reviewChars.length > 0 ? reviewChars.length + '个字需要复习' : '无需复习'}</div>
          </div>
          ${!state.reviewDone && state.step === 'review' ? `<button class="dt-step-btn" id="dtStartReview">${reviewChars.length > 0 ? '开始' : '跳过'}</button>` : ''}
        </div>

        <div class="dt-step ${state.learnDone ? 'done' : state.step === 'learn' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.learnDone ? '✅' : '🆕'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">学习新字</div>
            <div class="dt-step-desc">${lessonChars.length}个生字: ${lessonChars.slice(0, 6).map(c => c.char).join(' ')}${lessonChars.length > 6 ? '...' : ''}</div>
          </div>
          ${!state.learnDone && state.step === 'learn' ? '<button class="dt-step-btn" id="dtStartLearn">开始</button>' : ''}
        </div>

        <div class="dt-step ${state.quizDone ? 'done' : state.step === 'quiz' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.quizDone ? '✅' : '🎮'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">闯关测验</div>
            <div class="dt-step-desc">${lessonChars.length}道题</div>
          </div>
          ${!state.quizDone && state.step === 'quiz' ? '<button class="dt-step-btn" id="dtStartQuiz">开始</button>' : ''}
        </div>
      </div>
    `;

    // Bind buttons
    const reviewBtn = document.getElementById('dtStartReview');
    if (reviewBtn) reviewBtn.addEventListener('click', () => _startReview(reviewChars));

    const learnBtn = document.getElementById('dtStartLearn');
    if (learnBtn) learnBtn.addEventListener('click', () => _startLearn(lesson.chars));

    const quizBtn = document.getElementById('dtStartQuiz');
    if (quizBtn) quizBtn.addEventListener('click', () => _startQuiz(lesson.chars));
  }

  /** Render completion screen */
  function _renderComplete(container, state, growth) {
    const pct = state.quizTotal > 0 ? Math.round(state.quizScore / state.quizTotal * 100) : 0;
    const reward = DailyTaskService.GROWTH_REWARDS.find(r => pct >= r.min && pct <= r.max) || DailyTaskService.GROWTH_REWARDS[0];

    container.innerHTML = `
      <div class="dt-complete">
        <div class="dt-complete-emoji">🎉</div>
        <h2>今天的任务完成了！</h2>
        <div class="dt-complete-stats">
          <div class="dt-stat">🔄 复习 ✅</div>
          <div class="dt-stat">🆕 新学 ${state.learnedChars.length}字 ✅</div>
          <div class="dt-stat">🎮 闯关 ${state.quizScore}/${state.quizTotal} (${pct}%) ${reward.emoji}</div>
        </div>
        <div class="dt-growth-result">
          <div class="dt-growth-big">${growth.emoji} 已认识 ${growth.total} 个字</div>
          <div class="dt-growth-bar">
            <div class="dt-growth-fill" style="width:${Math.round(growth.progress * 100)}%"></div>
          </div>
          <div class="dt-growth-next">下一站: ${growth.nextEmoji} ${growth.nextName} (${growth.nextMin}字)</div>
        </div>
        <div class="dt-complete-actions">
          <button class="dt-btn-primary" id="dtBtnFreePractice">自由练习 →</button>
          <button class="dt-btn-secondary" id="dtBtnDone">明天见 👋</button>
        </div>
      </div>
    `;

    document.getElementById('dtBtnFreePractice').addEventListener('click', () => {
      // Switch to learn mode
      AppController.switchMode('learn');
    });
    document.getElementById('dtBtnDone').addEventListener('click', () => {
      // Just stay on this screen — app will show this next time too until tomorrow
    });
  }

  /** Render "all lessons done" screen */
  function _renderAllDone(container, progress, growth) {
    const gradeNames = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
    container.innerHTML = `
      <div class="dt-complete">
        <div class="dt-complete-emoji">🏆</div>
        <h2>恭喜！${gradeNames[progress.grade - 1] || ''}全部学完了！</h2>
        <div class="dt-growth-big">${growth.emoji} 已认识 ${growth.total} 个字</div>
        <div class="dt-complete-actions">
          <button class="dt-btn-primary" id="dtBtnFreePractice">自由练习 →</button>
        </div>
      </div>
    `;
    document.getElementById('dtBtnFreePractice').addEventListener('click', () => {
      AppController.switchMode('learn');
    });
  }

  // === Step implementations ===

  /** Start review step — show due cards as flip-through */
  function _startReview(reviewChars) {
    if (reviewChars.length === 0) {
      DailyTaskService.completeReview();
      render();
      return;
    }

    _reviewCards = reviewChars;
    _reviewIndex = 0;
    _renderReviewCard();
  }

  function _renderReviewCard() {
    const container = document.getElementById('dailyTaskMode');
    const char = _reviewCards[_reviewIndex];
    const total = _reviewCards.length;

    container.innerHTML = `
      <div class="dt-card-screen">
        <div class="dt-card-header">
          <span>🔄 复习 ${_reviewIndex + 1}/${total}</span>
          <div class="dt-progress-mini">
            <div class="dt-progress-fill-mini" style="width:${Math.round((_reviewIndex + 1) / total * 100)}%"></div>
          </div>
        </div>
        <div class="dt-card" id="dtCard" role="button">
          <div class="dt-card-front">
            <div class="dt-card-char">${char.char}</div>
            <div class="dt-card-hint">点击翻转</div>
          </div>
          <div class="dt-card-back hidden">
            <div class="dt-card-pinyin">${char.pinyin}</div>
            <div class="dt-card-words">${(char.words || []).join(' · ')}</div>
            <div class="dt-card-sentence">${char.sentence || ''}</div>
          </div>
        </div>
        <div class="dt-card-actions">
          <button class="dt-btn-secondary" id="dtCardSpeak">🔊</button>
          <button class="dt-btn-primary" id="dtCardNext">${_reviewIndex < total - 1 ? '下一个 →' : '完成复习 ✅'}</button>
        </div>
      </div>
    `;

    let flipped = false;
    document.getElementById('dtCard').addEventListener('click', () => {
      if (!flipped) {
        document.querySelector('.dt-card-front').classList.add('hidden');
        document.querySelector('.dt-card-back').classList.remove('hidden');
        flipped = true;
        // Record in SRS as reviewed (correct — they're just reviewing)
        SpacedRepService.recordAnswer(char.char, true);
      }
    });

    document.getElementById('dtCardSpeak').addEventListener('click', () => {
      Speech.speak(char.char);
    });

    document.getElementById('dtCardNext').addEventListener('click', () => {
      _reviewIndex++;
      if (_reviewIndex >= total) {
        DailyTaskService.completeReview();
        render();
      } else {
        _renderReviewCard();
      }
    });
  }

  /** Start learn step — flip through lesson chars */
  function _startLearn(chars) {
    _learnCards = chars;
    _learnIndex = 0;
    _renderLearnCard();
  }

  function _renderLearnCard() {
    const container = document.getElementById('dailyTaskMode');
    const char = _learnCards[_learnIndex];
    const total = _learnCards.length;

    container.innerHTML = `
      <div class="dt-card-screen">
        <div class="dt-card-header">
          <span>🆕 学习新字 ${_learnIndex + 1}/${total}</span>
          <div class="dt-progress-mini">
            <div class="dt-progress-fill-mini" style="width:${Math.round((_learnIndex + 1) / total * 100)}%"></div>
          </div>
        </div>
        <div class="dt-card" id="dtCard" role="button">
          <div class="dt-card-front">
            <div class="dt-card-char">${char.char}</div>
            <div class="dt-card-pinyin-small">${char.pinyin}</div>
            <div class="dt-card-hint">点击查看详情</div>
          </div>
          <div class="dt-card-back hidden">
            <div class="dt-card-pinyin">${char.pinyin}</div>
            <div class="dt-card-words">${(char.words || []).join(' · ')}</div>
            <div class="dt-card-sentence">${char.sentence || ''}</div>
          </div>
        </div>
        <div class="dt-card-actions">
          <button class="dt-btn-secondary" id="dtCardSpeak">🔊</button>
          <button class="dt-btn-primary" id="dtCardNext">${_learnIndex < total - 1 ? '下一个 →' : '开始闯关 🎮'}</button>
        </div>
      </div>
    `;

    let flipped = false;
    document.getElementById('dtCard').addEventListener('click', () => {
      if (!flipped) {
        document.querySelector('.dt-card-front').classList.add('hidden');
        document.querySelector('.dt-card-back').classList.remove('hidden');
        flipped = true;
        DailyTaskService.markCharLearned(char.char);
      }
    });

    document.getElementById('dtCardSpeak').addEventListener('click', () => {
      Speech.speak(char.char);
    });

    // Auto-speak on show
    setTimeout(() => Speech.speak(char.char), 300);

    document.getElementById('dtCardNext').addEventListener('click', () => {
      // Mark as learned even if not flipped
      DailyTaskService.markCharLearned(char.char);
      _learnIndex++;
      if (_learnIndex >= total) {
        DailyTaskService.completeLearn();
        render();
      } else {
        _renderLearnCard();
      }
    });
  }

  /** Start quiz step — quiz on lesson chars */
  function _startQuiz(chars) {
    // Generate quiz questions from lesson chars
    const origFiltered = State.get('filteredChars');
    State.set('filteredChars', chars);

    const questions = DataService.generateQuizQuestions(false, 'mixed', chars.length);
    State.set('filteredChars', origFiltered); // restore

    if (!questions || questions.length === 0) {
      // Fallback: skip quiz if can't generate
      DailyTaskService.completeQuiz(0, 0);
      render();
      return;
    }

    // Use the quiz state but in daily task context
    State.set('quiz', { questions, current: 0, score: 0, streak: 0, isErrorReview: false, isDailyTask: true });

    const container = document.getElementById('dailyTaskMode');
    container.innerHTML = `
      <div class="dt-quiz-screen">
        <div class="dt-card-header">
          <span>🎮 闯关测验</span>
          <span id="dtQuizProgress">1/${questions.length}</span>
        </div>
        <div class="dt-quiz-content" id="dtQuizContent"></div>
      </div>
    `;

    _renderQuizQuestion();
  }

  function _renderQuizQuestion() {
    const quiz = State.get('quiz');
    const q = quiz.questions[quiz.current];
    const content = document.getElementById('dtQuizContent');
    if (!content) return;

    // Render prompt
    let promptHtml = '';
    if (q.type === 'pickPinyin') {
      promptHtml = `<div class="dt-quiz-char">${q.target.char}</div>`;
    } else if (q.type === 'pickChar') {
      promptHtml = `<div class="dt-quiz-prompt">${q.target.pinyin}</div>`;
    } else if (q.type === 'fillBlank') {
      promptHtml = `<div class="dt-quiz-prompt">${q.sentence}</div>`;
    } else if (q.type === 'pickWord') {
      promptHtml = `<div class="dt-quiz-prompt">${q.blankedWord}</div>`;
    } else {
      promptHtml = `<div class="dt-quiz-char">${q.target.char}</div>`;
    }

    // Render options
    let optionsHtml = '<div class="dt-quiz-options">';
    q.options.forEach((opt, i) => {
      let label = '';
      if (q.type === 'pickPinyin') label = opt.pinyin;
      else if (q.type === 'pickChar' || q.type === 'fillBlank' || q.type === 'pickWord') label = opt.char;
      else label = opt.pinyin;
      optionsHtml += `<button class="dt-quiz-option" data-idx="${i}">${label}</button>`;
    });
    optionsHtml += '</div>';

    content.innerHTML = `
      <div class="dt-quiz-dots">
        ${quiz.questions.map((_, i) => `<span class="dt-dot ${i < quiz.current ? 'done' : i === quiz.current ? 'current' : ''}"></span>`).join('')}
      </div>
      ${promptHtml}
      ${optionsHtml}
      <div class="dt-quiz-score">📊 ${quiz.score}分 · 🔥 ${quiz.streak}连对</div>
    `;

    // Update progress
    const progEl = document.getElementById('dtQuizProgress');
    if (progEl) progEl.textContent = `${quiz.current + 1}/${quiz.questions.length}`;

    // Bind option clicks
    content.querySelectorAll('.dt-quiz-option').forEach(btn => {
      btn.addEventListener('click', () => _handleQuizAnswer(parseInt(btn.dataset.idx)));
    });
  }

  function _handleQuizAnswer(selectedIdx) {
    const quiz = State.get('quiz');
    const q = quiz.questions[quiz.current];
    if (q.answered) return;
    q.answered = true;

    const correctIdx = q.options.indexOf(q.target);
    const isCorrect = selectedIdx === correctIdx;

    // Update score
    if (isCorrect) {
      quiz.score++;
      quiz.streak++;
      Speech.speak(q.target.char);
    } else {
      quiz.streak = 0;
      ErrorBookService.addWrong(q.target.char, q.target.pinyin);
    }

    // Record in SRS
    SpacedRepService.recordAnswer(q.target.char, isCorrect);

    // Visual feedback
    const options = document.querySelectorAll('.dt-quiz-option');
    options.forEach(o => o.style.pointerEvents = 'none');
    options[correctIdx].classList.add('correct');
    if (!isCorrect && selectedIdx >= 0) options[selectedIdx].classList.add('wrong');

    State.set('quiz', quiz);

    // Next question or end
    setTimeout(() => {
      quiz.current++;
      if (quiz.current < quiz.questions.length) {
        _renderQuizQuestion();
      } else {
        // Quiz complete
        const reward = DailyTaskService.completeQuiz(quiz.score, quiz.questions.length);
        render();
      }
    }, 1000);
  }

  return { render, _selectGradeSem, _selectLesson };
})();
