/**
 * Services — side effects (speech, badges, storage helpers).
 *
 * Each service is a focused module handling one domain:
 * - Speech: browser TTS
 * - BadgeService: achievement checking and awarding
 * - FavoriteService: character favorites CRUD
 * - ErrorBookService: wrong answers tracking
 * - StatsService: play statistics and streaks
 */

/**
 * Speech synthesis wrapper.
 * Priority: 1) Local /tts server (when using server.py)
 *           2) Baidu TTS (free, good Mandarin)
 *           3) Web Speech API fallback
 */
const Speech = (() => {
  let _useLocalTTS = false;
  let _audio = null;

  /**
   * Speak a character or text aloud.
   * @param {string} text - Text to speak
   */
  function speak(text) {
    if (!text) return;
    if (_audio) { _audio.pause(); _audio.currentTime = 0; }

    if (_useLocalTTS) {
      _audio = new Audio(`/tts?text=${encodeURIComponent(text)}`);
    } else {
      _audio = new Audio(`https://fanyi.baidu.com/gettts?lan=zh&spd=4&source=web&text=${encodeURIComponent(text)}`);
    }

    _audio.play().catch(() => {
      // Final fallback: Web Speech API
      _speakWebAPI(text);
    });
  }

  /** Fallback: Web Speech API */
  function _speakWebAPI(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = State.config('speech.rate', 0.8);
    const voices = speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;
    speechSynthesis.speak(utterance);
  }

  /** Initialize: detect local TTS server, preload Web Speech voices */
  function init() {
    // Check if local /tts server is available
    fetch('/tts?text=好').then(res => {
      if (res.ok && res.headers.get('content-type')?.includes('audio')) {
        _useLocalTTS = true;
        console.info('[Speech] Using local TTS server');
      }
    }).catch(() => {});

    // Preload Web Speech voices for fallback
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
      }
    }
  }

  return { speak, init };
})();

/**
 * Badge/achievement service.
 * Checks conditions and awards badges. Definitions loaded from config.
 */
const BadgeService = (() => {
  const BADGE_DEFS = [
    {
      id: 'first_challenge',
      emoji: '🌱',
      name: '初次挑战',
      desc: '完成第一轮挑战',
      check: () => State.get('stats').totalRounds >= 1
    },
    {
      id: 'perfect_round',
      emoji: '🎯',
      name: '百发百中',
      desc: '单轮10题全对',
      check: () => {
        const q = State.get('quiz');
        const minQuestions = State.config('questionsPerRound', 10);
        return q.score === q.questions.length && q.questions.length >= minQuestions;
      }
    },
    {
      id: '200_correct',
      emoji: '📚',
      name: '识字达人',
      desc: '累计答对200题',
      check: () => State.get('stats').totalCorrect >= 200
    }
  ];

  /**
   * Check all badge conditions and award new ones.
   * @returns {Array} Newly awarded badge objects
   */
  function checkAndAward() {
    const badges = State.get('badges');
    const newBadges = [];

    BADGE_DEFS.forEach(badge => {
      if (!badges.includes(badge.id) && badge.check()) {
        badges.push(badge.id);
        newBadges.push(badge);
      }
    });

    if (newBadges.length) {
      State.set('badges', badges);
      State.persist('badges');
    }
    return newBadges;
  }

  /** @returns {Array} All badge definitions */
  function getAll() { return BADGE_DEFS; }

  /** @returns {boolean} Whether badge has been earned */
  function isEarned(id) { return State.get('badges').includes(id); }

  return { checkAndAward, getAll, isEarned };
})();

/**
 * Favorite characters service.
 * Manages the user's saved/starred characters list.
 */
const FavoriteService = (() => {
  /**
   * Toggle a character's favorite status.
   * @param {string} char - The character to toggle
   * @returns {boolean} New favorite status (true = now favorite)
   */
  function toggle(char) {
    const favs = State.get('favorites');
    const idx = favs.indexOf(char);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(char);
    State.set('favorites', favs);
    State.persist('favorites');
    return favs.includes(char);
  }

  /** @returns {boolean} Whether char is in favorites */
  function isFavorite(char) { return State.get('favorites').includes(char); }

  /** @returns {Array} All favorited character strings */
  function getAll() { return State.get('favorites'); }

  /**
   * Remove a character from favorites.
   * @param {string} char - Character to remove
   */
  function remove(char) {
    const favs = State.get('favorites').filter(f => f !== char);
    State.set('favorites', favs);
    State.persist('favorites');
  }

  return { toggle, isFavorite, getAll, remove };
})();

/**
 * Error book service.
 * Tracks characters answered incorrectly in challenge mode.
 * Characters are removed after consecutive correct answers.
 */
const ErrorBookService = (() => {
  /** Consecutive correct answers needed to remove from book (from config) */
  function getRemoveThreshold() {
    return State.config('wrongAnswersToRemoveFromErrorBook', 3);
  }

  /**
   * Add or increment a wrong answer.
   * @param {string} char - The character
   * @param {string} pinyin - The character's pinyin
   */
  function addWrong(char, pinyin) {
    const book = State.get('errorBook');
    const existing = book.find(e => e.char === char);
    if (existing) {
      existing.wrongCount++;
      existing.consecutiveCorrect = 0;
    } else {
      book.push({ char, pinyin, wrongCount: 1, consecutiveCorrect: 0 });
    }
    State.set('errorBook', book);
    State.persist('errorBook');
  }

  /**
   * Mark a character as answered correctly (in error review mode).
   * Removes from book after REMOVE_AFTER consecutive correct answers.
   * @param {string} char - The character
   */
  function markCorrect(char) {
    const book = State.get('errorBook');
    const entry = book.find(e => e.char === char);
    if (!entry) return;

    entry.consecutiveCorrect = (entry.consecutiveCorrect || 0) + 1;
    if (entry.consecutiveCorrect >= getRemoveThreshold()) {
      State.set('errorBook', book.filter(e => e.char !== char));
    }
    State.persist('errorBook');
  }

  /** @returns {Array} All error book entries */
  function getAll() { return State.get('errorBook'); }

  /** @returns {number} Number of entries in error book */
  function count() { return State.get('errorBook').length; }

  return { addWrong, markCorrect, getAll, count };
})();

/**
 * Statistics service.
 * Tracks cumulative play stats and daily streaks.
 */
const StatsService = (() => {
  /**
   * Record the results of a completed quiz round.
   * @param {number} score - Correct answers this round
   * @param {number} total - Total questions this round
   */
  function recordRound(score, total) {
    const stats = State.get('stats');
    stats.totalRounds++;
    stats.totalCorrect += score;
    stats.totalAnswered += total;

    // Update daily streak
    const today = new Date().toISOString().slice(0, 10);
    if (stats.lastPlayDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      stats.consecutiveDays = (stats.lastPlayDate === yesterday)
        ? stats.consecutiveDays + 1
        : 1;
      stats.lastPlayDate = today;
    }

    State.set('stats', stats);
    State.persist('stats');
  }

  /** @returns {Object} Current stats object */
  function get() { return State.get('stats'); }

  return { recordRound, get };
})();
