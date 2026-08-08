/**
 * Daily Task Service & Controller
 *
 * Guides the child through one lesson per day in 4 steps:
 *   Step 1: 复习 (Review)   — SRS-scheduled chars, max 10, active recall
 *   Step 2: 回顾 (Recap)    — previous lesson's chars, quick recall
 *   Step 3: 学习 (Learn)    — current lesson chars in full Learn mode
 *   Step 4: 闯关 (Quiz)     — current lesson chars in full Challenge mode
 *
 * Lesson progression is sequential within grade/semester.
 * Score >= 60% advances to next lesson. Below 60% repeats tomorrow.
 * Wrong chars self-heal via SRS (Leitner box system).
 *
 * Growth levels: 种子→萌芽→小苗→小树→大树→千字王→识字冠军
 */

// ─────────────────────────────────────────────────────────────
// Constants shared across Service and Controller
// ─────────────────────────────────────────────────────────────
const _DT_CONSTANTS = {
  MAX_REVIEW_CHARS: 10,
  MIN_PASS_PERCENT: 60,
  GRADE_NAMES: ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'],
  GRADE_ICONS: ['', '📘', '📗', '📙', '📕', '📒', '📘', '📖', '📖', '📖'],
  SEM_NAMES: ['', '上册', '下册'],
  GROWTH_LEVELS: [
    { min: 0, emoji: '🌰', name: '种子', next: 50 },
    { min: 50, emoji: '🌱', name: '萌芽', next: 100 },
    { min: 100, emoji: '🌿', name: '小苗', next: 200 },
    { min: 200, emoji: '🌳', name: '小树', next: 500 },
    { min: 500, emoji: '⭐', name: '大树', next: 1000 },
    { min: 1000, emoji: '👑', name: '千字王', next: 2000 },
    { min: 2000, emoji: '🏆', name: '识字冠军', next: 9999 }
  ],
  GROWTH_REWARDS: [
    { min: 0, max: 59, points: 1, msg: '继续加油！明天再复习这些字', emoji: '💪' },
    { min: 60, max: 79, points: 2, msg: '不错哦！差一点就满分了', emoji: '👍' },
    { min: 80, max: 99, points: 3, msg: '太厉害了！', emoji: '⭐' },
    { min: 100, max: 100, points: 5, msg: '完美！你是识字冠军！', emoji: '🌟' }
  ],
  STEPS: ['review', 'recap', 'learn', 'quiz', 'done'],
  TRACK_INTERVAL_MS: 300
};

const DailyTaskService = (() => {
  const GROWTH_REWARDS = _DT_CONSTANTS.GROWTH_REWARDS;

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
      step: 'review',        // 'review' | 'recap' | 'learn' | 'quiz' | 'done'
      reviewDone: false,
      recapDone: false,
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
      recapDone: false,
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

  /** Get chars due for review (from SRS), max 10 per session */
  function getReviewChars() {
    const MAX_REVIEW = 10;
    const dueChars = SpacedRepService.getDueChars();
    const allChars = State.get('allChars') || [];
    // Map char strings to full char objects, prioritize lower boxes (more forgotten)
    const result = [];
    const seen = new Set();
    for (const c of allChars) {
      if (dueChars.includes(c.char) && !seen.has(c.char)) {
        seen.add(c.char);
        result.push(c);
      }
    }
    // Sort by box level (lower box = more urgent) then shuffle within same box
    const srsData = State.load('spacedRep', {});
    result.sort((a, b) => {
      const boxA = srsData[a.char] ? srsData[a.char].box : 0;
      const boxB = srsData[b.char] ? srsData[b.char].box : 0;
      if (boxA !== boxB) return boxA - boxB;
      return Math.random() - 0.5;
    });
    return result.slice(0, MAX_REVIEW);
  }

  /** Mark review step as done */
  function completeReview(reviewedCount) {
    const state = getTaskState();
    state.reviewDone = true;
    state.reviewedCount = reviewedCount || 0;
    state.step = 'recap';
    _saveTask(state);
  }

  /** Get chars for recap (previous lesson's chars) */
  function getRecapChars() {
    const progress = getProgress();
    if (!progress) return [];
    const allChars = State.get('allChars') || [];
    const lessons = State.get('lessons') || [];

    // Find the previous lesson (the one before current)
    const gradeLessons = lessons.filter(l => {
      const [g, s] = l.id.split('-');
      return parseInt(g) === progress.grade && parseInt(s) === progress.semester;
    });

    const prevIndex = progress.lessonIndex - 1;
    if (prevIndex < 0) {
      // Check previous semester's last lesson
      let prevGrade = progress.grade;
      let prevSem = progress.semester - 1;
      if (prevSem < 1) { prevGrade--; prevSem = 2; }
      if (prevGrade < 1) return [];
      const prevGradeLessons = lessons.filter(l => {
        const [g, s] = l.id.split('-');
        return parseInt(g) === prevGrade && parseInt(s) === prevSem;
      });
      if (prevGradeLessons.length === 0) return [];
      const lastLesson = prevGradeLessons[prevGradeLessons.length - 1];
      return lastLesson.chars || [];
    }

    if (prevIndex >= gradeLessons.length) return [];
    const prevLesson = gradeLessons[prevIndex];
    return prevLesson.chars || [];
  }

  /** Mark recap step as done */
  function completeRecap(recapCount) {
    const state = getTaskState();
    state.recapDone = true;
    state.recapCount = recapCount || 0;
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

    // #4: Don't advance if score < 60% — redo tomorrow
    if (pct >= 60) {
      state.advanced = true;
      _advanceLesson();
    } else {
      state.advanced = false;
    }

    _saveTask(state);

    // Record growth points
    const growth = State.load('growthPoints', 0);
    State.save('growthPoints', growth + reward.points);

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
    const levels = _DT_CONSTANTS.GROWTH_LEVELS;
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
    getRecapChars,
    completeReview,
    completeRecap,
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
 *
 * Manages the 4-step task flow (复习→回顾→学习→闯关) and renders:
 * - Setup wizard (3-step: grade → semester → lesson)
 * - Active task screen with step progress
 * - Completion screen with growth summary
 * - Recall card UI (shared by review and recap steps)
 * - Integration with Learn/Challenge modes (learn + quiz steps)
 */
const DailyTaskController = (() => {
  // --- Module state for card-based steps ---
  let _cardStack = [];   // Current cards being reviewed/recapped
  let _cardIndex = 0;    // Current position in the stack
  let _cardMode = '';    // 'review' | 'recap'

  /** Render the daily task screen */
  function render() {
    const container = document.getElementById('dailyTaskMode');
    if (!container) return;

    // Clean up any floating banner or button
    const banner = document.getElementById('dtTaskBanner');
    if (banner) banner.remove();
    const floatBtn = document.getElementById('dtFloatingBtn');
    if (floatBtn) floatBtn.remove();
    const returnBtn = document.getElementById('dtReturnBtn');
    if (returnBtn) returnBtn.remove();

    // Ensure data is loaded
    const allChars = State.get('allChars');
    if (!allChars || allChars.length === 0) {
      container.innerHTML = '<div class="dt-setup"><p>正在加载数据...</p></div>';
      // Retry after data loads
      setTimeout(render, 500);
      return;
    }

    const needsSetupResult = DailyTaskService.needsSetup();

    // First-time setup
    if (needsSetupResult) {
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
      container.innerHTML = `<div class="dt-setup"><p style="color:var(--error)">❌ 加载失败: ${e.message}</p><button class="dt-btn-secondary" id="dtRetryBtn">重试</button></div>`;
      const retryBtn = document.getElementById('dtRetryBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => render());
    }
  }

  /** Render the first-time setup screen — Step 1: pick grade */
  function _renderSetup(container) {
    const { GRADE_NAMES, GRADE_ICONS } = _DT_CONSTANTS;
    const allChars = State.get('allChars') || [];

    // Find which grades have data
    const availableGrades = [];
    for (let g = 1; g <= 9; g++) {
      const gradeChars = allChars.filter(c => c.grade === g);
      if (gradeChars.length > 0) {
        availableGrades.push({ grade: g, charCount: gradeChars.length });
      }
    }

    container.innerHTML = `
      <div class="dt-setup">
        <div class="dt-setup-header">
          <div class="dt-setup-emoji">👋</div>
          <h2>欢迎！你现在学到哪里了？</h2>
          <p class="dt-setup-subtitle">第一步：选择年级</p>
        </div>
        <div class="dt-setup-grades" id="dtSetupGrades">
          ${availableGrades.map(o => `
            <button class="dt-setup-grade" data-setup-grade="${o.grade}">
              <span class="dt-setup-grade-icon">${GRADE_ICONS[o.grade]}</span>
              <span class="dt-setup-grade-name">${GRADE_NAMES[o.grade]}</span>
              <span class="dt-setup-grade-count">${o.charCount}字</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Bind grade buttons via event delegation on container
    container.addEventListener('click', function _setupGradeHandler(e) {
      const btn = e.target.closest('[data-setup-grade]');
      if (!btn) return;
      container.removeEventListener('click', _setupGradeHandler);
      const grade = parseInt(btn.dataset.setupGrade);
      _renderSetupSemester(container, grade);
    });
  }

  /** Setup Step 2: pick semester */
  function _renderSetupSemester(container, grade) {
    const { GRADE_NAMES, SEM_NAMES } = _DT_CONSTANTS;
    const lessons = State.get('lessons') || [];
    const allChars = State.get('allChars') || [];

    // Find available semesters for this grade
    const semesters = [];
    for (let s = 1; s <= 2; s++) {
      const semLessons = lessons.filter(l => { const [g, ls] = l.id.split('-'); return parseInt(g) === grade && parseInt(ls) === s; });
      if (semLessons.length > 0) {
        const charCount = allChars.filter(c => c.grade === grade && c.semester === s).length;
        semesters.push({ semester: s, lessonCount: semLessons.length, charCount });
      }
    }

    container.innerHTML = `
      <div class="dt-setup">
        <div class="dt-setup-header">
          <h2>${GRADE_NAMES[grade]} — 哪个学期？</h2>
          <p class="dt-setup-subtitle">第二步：选择学期</p>
        </div>
        <div class="dt-setup-grades">
          ${semesters.map(o => `
            <button class="dt-setup-grade" data-setup-sem="${o.semester}">
              <span class="dt-setup-grade-icon">📖</span>
              <span class="dt-setup-grade-name">${SEM_NAMES[o.semester]}</span>
              <span class="dt-setup-grade-count">${o.lessonCount}课 · ${o.charCount}字</span>
            </button>
          `).join('')}
        </div>
        <button class="dt-setup-back" id="dtSetupBack">← 返回选年级</button>
      </div>
    `;

    // Bind semester buttons → go to step 3
    container.querySelectorAll('[data-setup-sem]').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectGradeSem(grade, parseInt(btn.dataset.setupSem));
      });
    });
    document.getElementById('dtSetupBack').addEventListener('click', () => _renderSetup(container));
  }

  /** Called from onclick — select grade+semester, show lesson picker */
  function _selectGradeSem(grade, semester) {
    const container = document.getElementById('dailyTaskMode');
    _renderSetupLesson(container, grade, semester);
  }

  /** Render lesson selection — Step 3: pick lesson */
  function _renderSetupLesson(container, grade, semester) {
    const { GRADE_NAMES, SEM_NAMES } = _DT_CONSTANTS;
    const lessons = State.get('lessons') || [];
    const gradeLessons = lessons.filter(l => { const [g, s] = l.id.split('-'); return parseInt(g) === grade && parseInt(s) === semester; });

    container.innerHTML = `
      <div class="dt-setup">
        <div class="dt-setup-header">
          <h2>${GRADE_NAMES[grade]}${SEM_NAMES[semester]} — 从哪一课开始？</h2>
          <p class="dt-setup-subtitle">第三步：选择起始课文</p>
        </div>
        <div class="dt-setup-lessons">
          <button class="dt-setup-lesson highlighted" data-lesson-idx="0">
            <span class="dt-setup-lesson-icon">⭐</span>
            <span class="dt-setup-lesson-name">从头开始</span>
            <span class="dt-setup-lesson-info">第1课</span>
          </button>
          ${gradeLessons.map((l, i) => `
            <button class="dt-setup-lesson" data-lesson-idx="${i}">
              <span class="dt-setup-lesson-icon">📄</span>
              <span class="dt-setup-lesson-name">${escapeHtml(l.title)}</span>
              <span class="dt-setup-lesson-info">${l.chars.length}字</span>
            </button>
          `).join('')}
        </div>
        <button class="dt-setup-back" id="dtSetupBack">← 返回选学期</button>
      </div>
    `;

    // Bind lesson buttons
    container.querySelectorAll('[data-lesson-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectLesson(grade, semester, parseInt(btn.dataset.lessonIdx));
      });
    });
    document.getElementById('dtSetupBack').addEventListener('click', () => _renderSetupSemester(container, grade));
  }

  /** Called from onclick — select lesson and start */
  function _selectLesson(grade, semester, idx) {
    // Preserve completedLessons history before resetting
    const oldProgress = DailyTaskService.getProgress();
    if (oldProgress && oldProgress.completedLessons && oldProgress.completedLessons.length > 0) {
      const history = State.load('completedLessonsHistory', []);
      history.push(...oldProgress.completedLessons.filter(id => !history.includes(id)));
      State.save('completedLessonsHistory', history);
    }
    DailyTaskService.initProgress(grade, semester, idx);
    render();
  }

  /** Render the active task screen */
  function _renderTask(container, state, lesson, progress, growth) {
    const reviewChars = DailyTaskService.getReviewChars();
    const recapChars = DailyTaskService.getRecapChars();
    const lessonChars = lesson.chars || [];
    const gradeLessons = DailyTaskService.getCurrentGradeLessons();
    const totalLessons = gradeLessons.length;

    const gradeName = _DT_CONSTANTS.GRADE_NAMES[progress.grade] || `${progress.grade}年级`;
    const semName = _DT_CONSTANTS.SEM_NAMES[progress.semester] || '';

    const hasRecap = recapChars.length > 0;

    container.innerHTML = `
      <div class="dt-header">
        <div class="dt-growth-mini">
          ${growth.emoji} <span class="dt-growth-count">${growth.total}字</span>
        </div>
        <h2 class="dt-title">📖 今日任务</h2>
        <div class="dt-lesson-info">${gradeName}${semName} · ${lesson.title}</div>
        <div class="dt-lesson-progress">第 ${progress.lessonIndex + 1}/${totalLessons} 课 · ${lessonChars.length}个生字</div>
        <div class="dt-semester-progress">
          <div class="dt-semester-bar"><div class="dt-semester-fill" style="width:${Math.round(progress.lessonIndex / totalLessons * 100)}%"></div></div>
          <span class="dt-semester-label">已学 ${progress.lessonIndex}/${totalLessons} 课</span>
        </div>
        <button class="dt-change-level-btn" id="dtChangeLevel">🔄 切换课文</button>
      </div>

      <div class="dt-steps">
        <div class="dt-step ${state.reviewDone ? 'done' : state.step === 'review' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.reviewDone ? '✅' : '🔄'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">复习</div>
            <div class="dt-step-desc">${state.reviewDone ? '已复习 ' + (state.reviewedCount || 0) + '字' : (reviewChars.length > 0 ? reviewChars.length + '个字需要复习' : '无需复习')}</div>
          </div>
          ${!state.reviewDone && state.step === 'review' ? `<button class="dt-step-btn" id="dtStartReview">${reviewChars.length > 0 ? '开始' : '跳过'}</button>` : ''}
        </div>

        <div class="dt-step ${state.recapDone ? 'done' : state.step === 'recap' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.recapDone ? '✅' : '🔁'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">回顾上课</div>
            <div class="dt-step-desc">${state.recapDone ? '已回顾 ' + (state.recapCount || 0) + '字' : (hasRecap ? recapChars.length + '个字快速回顾' : '无上课内容')}</div>
          </div>
          ${!state.recapDone && state.step === 'recap' ? `<button class="dt-step-btn" id="dtStartRecap">${hasRecap ? '开始' : '跳过'}</button>` : ''}
        </div>

        <div class="dt-step ${state.learnDone ? 'done' : state.step === 'learn' ? 'active' : 'locked'}">
          <div class="dt-step-icon">${state.learnDone ? '✅' : '🆕'}</div>
          <div class="dt-step-content">
            <div class="dt-step-title">学习新字</div>
            <div class="dt-step-desc">${state.learnDone ? '已学 ' + state.learnedChars.length + '字' : lessonChars.length + '个生字: ' + lessonChars.slice(0, 6).map(c => c.char).join(' ') + (lessonChars.length > 6 ? '...' : '')}</div>
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
    if (reviewBtn) reviewBtn.addEventListener('click', () => _startCardSession(reviewChars, 'review'));

    const recapBtn = document.getElementById('dtStartRecap');
    if (recapBtn) recapBtn.addEventListener('click', () => _startCardSession(recapChars, 'recap'));

    const learnBtn = document.getElementById('dtStartLearn');
    if (learnBtn) learnBtn.addEventListener('click', () => _startLearn(lesson.chars));

    const quizBtn = document.getElementById('dtStartQuiz');
    if (quizBtn) quizBtn.addEventListener('click', () => _startQuiz(lesson.chars));

    const changeBtn = document.getElementById('dtChangeLevel');
    if (changeBtn) changeBtn.addEventListener('click', () => {
      // Go directly to lesson picker for current grade/semester (skip grade/sem selection)
      _renderSetupLesson(container, progress.grade, progress.semester);
    });
  }

  /** Render completion screen */
  function _renderComplete(container, state, growth) {
    const pct = state.quizTotal > 0 ? Math.round(state.quizScore / state.quizTotal * 100) : 0;
    const reward = DailyTaskService.GROWTH_REWARDS.find(r => pct >= r.min && pct <= r.max) || DailyTaskService.GROWTH_REWARDS[0];
    const advanced = state.advanced !== false; // default true for old data

    container.innerHTML = `
      <div class="dt-complete">
        <div class="dt-complete-emoji">${advanced ? '🎉' : '📖'}</div>
        <h2>${advanced ? '今天的任务完成了！' : '再练练就更好了！'}</h2>
        ${!advanced ? '<p class="dt-complete-hint">正确率不到60%，明天再挑战一次这课吧</p>' : ''}
        <div class="dt-complete-stats">
          <div class="dt-stat">🔄 复习 ${state.reviewedCount || 0}字 ✅</div>
          <div class="dt-stat">🔁 回顾 ${state.recapCount || 0}字 ✅</div>
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
          ${advanced ? '<button class="dt-btn-primary" id="dtBtnNextLesson">📖 继续学下一课</button>' : ''}
          <button class="dt-btn-secondary" id="dtBtnRedo">🔄 重新挑战这课</button>
          <button class="dt-btn-${advanced ? 'secondary' : 'primary'}" id="dtBtnFreePractice">自由练习 →</button>
          <button class="dt-btn-secondary" id="dtBtnDone">明天见 👋</button>
        </div>
      </div>
    `;

    const nextLessonBtn = document.getElementById('dtBtnNextLesson');
    if (nextLessonBtn) {
      nextLessonBtn.addEventListener('click', () => {
        // Reset today's task state to start next lesson immediately
        const newState = {
          date: new Date().toISOString().slice(0, 10),
          step: 'review',
          reviewDone: false,
          recapDone: false,
          learnDone: false,
          learnedChars: [],
          quizDone: false,
          quizScore: 0,
          quizTotal: 0,
          growthEarned: 0
        };
        State.save('dailyTask', newState);
        render();
      });
    }

    document.getElementById('dtBtnRedo').addEventListener('click', () => {
      // If lesson already advanced, roll back to redo the same lesson
      if (state.advanced) {
        const progress = DailyTaskService.getProgress();
        if (progress && progress.lessonIndex > 0) {
          progress.lessonIndex--;
          // Remove from completedLessons if it was just added
          if (progress.completedLessons.length > 0) {
            progress.completedLessons.pop();
          }
          State.save('lessonProgress', progress);
        }
      }
      // Reset task state to start over
      const newState = {
        date: new Date().toISOString().slice(0, 10),
        step: 'review',
        reviewDone: false,
        recapDone: false,
        learnDone: false,
        learnedChars: [],
        quizDone: false,
        quizScore: 0,
        quizTotal: 0,
        growthEarned: 0
      };
      State.save('dailyTask', newState);
      render();
    });

    document.getElementById('dtBtnFreePractice').addEventListener('click', () => {
      AppController.switchMode('learn');
    });
    document.getElementById('dtBtnDone').addEventListener('click', () => {
      // Stay on completion screen
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

  // === Recall Card UI (shared by review and recap steps) ===

  /**
   * Start a recall card session.
   * @param {Array} chars - Character objects to review
   * @param {'review'|'recap'} mode - Which step this is for
   */
  function _startCardSession(chars, mode) {
    if (chars.length === 0) {
      if (mode === 'review') DailyTaskService.completeReview(0);
      else DailyTaskService.completeRecap(0);
      render();
      return;
    }
    _cardStack = chars;
    _cardIndex = 0;
    _cardMode = mode;
    _renderRecallCard();
  }

  /** Render a single recall card (show char → flip → 记得/忘了) */
  function _renderRecallCard() {
    const container = document.getElementById('dailyTaskMode');
    const char = _cardStack[_cardIndex];
    const total = _cardStack.length;
    const icon = _cardMode === 'review' ? '🔄' : '🔁';
    const title = _cardMode === 'review' ? '复习' : '回顾上课';
    const hint = _cardMode === 'review'
      ? '想一想读音，然后点击验证'
      : '还记得怎么读吗？点击验证';

    container.innerHTML = `
      <div class="dt-card-screen">
        <div class="dt-card-header">
          <span>${icon} ${title} ${_cardIndex + 1}/${total}</span>
          <div class="dt-progress-mini">
            <div class="dt-progress-fill-mini" style="width:${Math.round((_cardIndex + 1) / total * 100)}%"></div>
          </div>
        </div>
        <div class="dt-card" id="dtCard" role="button">
          <div class="dt-card-front">
            <div class="dt-card-char">${char.char}</div>
            <div class="dt-card-hint">${hint}</div>
          </div>
          <div class="dt-card-back hidden">
            <div class="dt-card-pinyin">${char.pinyin}</div>
            <div class="dt-card-words">${(char.words || []).join(' · ')}</div>
            <div class="dt-card-sentence">${char.sentence || ''}</div>
          </div>
        </div>
        <div class="dt-card-actions hidden" id="dtCardActions">
          <button class="dt-btn-secondary" id="dtCardSpeak">🔊</button>
          <button class="dt-review-forgot" id="dtCardForgot">😅 忘了</button>
          <button class="dt-review-knew" id="dtCardKnew">😊 记得</button>
        </div>
      </div>
    `;

    let flipped = false;
    document.getElementById('dtCard').addEventListener('click', () => {
      if (!flipped) {
        document.querySelector('.dt-card-front').classList.add('hidden');
        document.querySelector('.dt-card-back').classList.remove('hidden');
        document.getElementById('dtCardActions').classList.remove('hidden');
        flipped = true;
        Speech.speak(char.char);
      }
    });

    document.getElementById('dtCardSpeak').addEventListener('click', () => Speech.speak(char.char));
    document.getElementById('dtCardKnew').addEventListener('click', () => _advanceCard(true));
    document.getElementById('dtCardForgot').addEventListener('click', () => _advanceCard(false));
  }

  /** Advance to next card or complete the session */
  function _advanceCard(correct) {
    const char = _cardStack[_cardIndex];
    SpacedRepService.recordAnswer(char.char, correct);

    _cardIndex++;
    if (_cardIndex >= _cardStack.length) {
      // Session complete
      if (_cardMode === 'review') {
        DailyTaskService.completeReview(_cardStack.length);
      } else {
        DailyTaskService.completeRecap(_cardStack.length);
      }
      render();
    } else {
      _renderRecallCard();
    }
  }

  /** Start learn step — use the real Learn mode UI */
  function _startLearn(chars) {
    // Filter to lesson chars
    State.set('filteredChars', chars);
    State.set('currentIndex', 0);
    LearnController.resetShuffle();

    // Update lesson dropdown to show current lesson
    const lesson = DailyTaskService.getCurrentLesson();
    const sel = document.getElementById('lessonFilter');
    if (sel && lesson) {
      sel.innerHTML = `<option value="${lesson.id}">📖 ${escapeHtml(lesson.title)} (${chars.length}字)</option>`;
    }

    // Switch to learn mode
    AppController.switchMode('learn');
    LearnController.showCurrent();

    // Show floating button (disabled until all cards viewed)
    _showDtFloatingBtn(chars.length);

    // Track card navigation to mark chars as learned
    _startTrackingLearn(chars);
  }

  /** Track which cards the user has viewed in learn mode */
  function _startTrackingLearn(chars) {
    const total = chars.length;
    const viewed = new Set();

    // Mark the first card as viewed
    _markCurrentViewed(chars, viewed);

    // Poll currentIndex changes to track viewed cards
    let lastIndex = 0;
    const tracker = setInterval(() => {
      // Stop if we left learn mode or button is gone
      const btn = document.getElementById('dtFloatingBtn');
      if (!btn || State.get('mode') !== 'learn') {
        clearInterval(tracker);
        return;
      }

      const idx = State.get('currentIndex');
      if (idx !== lastIndex) {
        lastIndex = idx;
        _markCurrentViewed(chars, viewed);

        // Update button state
        const count = viewed.size;
        if (count >= total) {
          btn.disabled = false;
          btn.classList.remove('dt-floating-btn-disabled');
          btn.innerHTML = `✅ 学完了，回到任务 (${total}/${total})`;
        } else {
          btn.innerHTML = `📖 已看 ${count}/${total} · 继续翻看`;
        }
      }
    }, 300);
  }

  /** Mark the current card as viewed and record in daily task */
  function _markCurrentViewed(chars, viewedSet) {
    const idx = State.get('currentIndex');
    if (idx < chars.length) {
      const char = chars[idx];
      viewedSet.add(char.char);
      DailyTaskService.markCharLearned(char.char);
    }
  }

  /** Show a floating action button to complete learn step and return */
  function _showDtFloatingBtn(totalChars) {
    // Remove old if any
    const old = document.getElementById('dtFloatingBtn');
    if (old) old.remove();

    const btn = document.createElement('button');
    btn.id = 'dtFloatingBtn';
    btn.className = 'dt-floating-btn dt-floating-btn-disabled';
    btn.disabled = true;
    btn.innerHTML = `📖 已看 0/${totalChars} · 继续翻看`;
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      DailyTaskService.completeLearn();
      btn.remove();
      AppController.switchMode('dailyTask');
    });
  }

  /** Start quiz step — use the real Challenge mode UI */
  function _startQuiz(chars) {
    // Filter to lesson chars
    State.set('filteredChars', chars);
    State.set('currentIndex', 0);

    // Update lesson dropdown to show current lesson
    const lesson = DailyTaskService.getCurrentLesson();
    const sel = document.getElementById('lessonFilter');
    if (sel && lesson) {
      sel.innerHTML = `<option value="${lesson.id}">📖 ${escapeHtml(lesson.title)} (${chars.length}字)</option>`;
    }

    // Switch to challenge mode and start
    AppController.switchMode('challenge');
    ChallengeController.start();

    // Hook into quiz end to auto-return
    _hookQuizEnd();
  }

  /** Hook into quiz end to return to daily task */
  function _hookQuizEnd() {
    // Watch for quiz end screen to appear
    const observer = new MutationObserver(() => {
      const endEl = document.getElementById('quizEnd');
      if (endEl && !endEl.classList.contains('hidden')) {
        observer.disconnect();
        const quiz = State.get('quiz');
        // Complete the quiz immediately (so progress is saved even if user navigates away)
        DailyTaskService.completeQuiz(quiz.score, quiz.questions.length);
        // Add a "返回任务" button to the end screen
        setTimeout(() => {
          _addReturnButton();
        }, 500);
      }
    });
    const challengeEl = document.getElementById('challengeMode');
    if (challengeEl) {
      observer.observe(challengeEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  /** Add a return button to the quiz end screen */
  function _addReturnButton() {
    const endActions = document.querySelector('#quizEnd .end-actions');
    if (!endActions) return;
    // Don't add twice
    if (document.getElementById('dtReturnBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'dtReturnBtn';
    btn.className = 'btn-play-again dt-return-btn';
    btn.textContent = '📖 返回每日任务';
    endActions.prepend(btn);

    btn.addEventListener('click', () => {
      AppController.switchMode('dailyTask');
    });
  }

  return { render };
})();
