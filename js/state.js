/**
 * State Management — single source of truth for app state.
 *
 * Supports multi-profile: each profile has its own localStorage namespace.
 * Shared data: profiles list, active profile ID
 * Per-profile: favorites, errorBook, stats, badges
 */
const State = (() => {
  const STORAGE_PREFIX = 'szb_';
  const SHARED_KEYS = ['profiles', 'activeProfile', 'welcomed'];
  let _config = {};
  let _profileId = '';

  /**
   * Get the full storage key (with profile prefix for per-user data).
   * @param {string} key
   * @returns {string}
   */
  function _key(key) {
    if (SHARED_KEYS.includes(key)) return STORAGE_PREFIX + key;
    return STORAGE_PREFIX + _profileId + '_' + key;
  }

  /**
   * Load a value from localStorage.
   * @param {string} key - Storage key
   * @param {*} defaultVal - Default if not found
   * @returns {*}
   */
  function load(key, defaultVal) {
    try {
      const raw = localStorage.getItem(_key(key));
      return raw ? JSON.parse(raw) : defaultVal;
    } catch (_e) {
      return defaultVal;
    }
  }

  /**
   * Save a value to localStorage.
   * @param {string} key
   * @param {*} val
   */
  function save(key, val) {
    localStorage.setItem(_key(key), JSON.stringify(val));
  }

  /**
   * Load shared data (not profile-specific).
   */
  function loadShared(key, defaultVal) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch (_e) {
      return defaultVal;
    }
  }

  function saveShared(key, val) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  }

  /**
   * Load config.json at startup.
   */
  async function loadConfig() {
    try {
      const res = await fetch('config.json');
      if (res.ok) _config = await res.json();
    } catch (_e) {
      console.warn('[State] config.json not found, using defaults');
    }
    return _config;
  }

  /**
   * Get a config value (dot-notation: 'speech.rate').
   */
  function config(key, defaultVal) {
    const parts = key.split('.');
    let val = _config;
    for (const part of parts) {
      if (val == null || typeof val !== 'object') return defaultVal;
      val = val[part];
    }
    return val !== undefined ? val : defaultVal;
  }

  /**
   * Set active profile and reload persisted data.
   * Also migrates legacy (pre-profile) data on first use.
   * @param {string} profileId
   */
  function setProfile(profileId) {
    _profileId = profileId;
    saveShared('activeProfile', profileId);

    // Migrate legacy data (from before profiles were added)
    const migrationKey = STORAGE_PREFIX + profileId + '_migrated';
    if (!localStorage.getItem(migrationKey)) {
      const legacyKeys = ['favorites', 'errorBook', 'stats', 'badges'];
      legacyKeys.forEach(key => {
        const legacyVal = localStorage.getItem(STORAGE_PREFIX + key);
        const profileVal = localStorage.getItem(STORAGE_PREFIX + profileId + '_' + key);
        // Only migrate if legacy exists and profile key is empty
        if (legacyVal && !profileVal) {
          localStorage.setItem(STORAGE_PREFIX + profileId + '_' + key, legacyVal);
        }
      });
      localStorage.setItem(migrationKey, 'true');
    }

    // Reload per-profile data
    state.favorites = load('favorites', []);
    state.errorBook = load('errorBook', []);
    state.stats = load('stats', {
      totalRounds: 0, totalCorrect: 0, totalAnswered: 0,
      streak: 0, lastPlayDate: '', consecutiveDays: 0
    });
    state.badges = load('badges', []);
  }

  /** @returns {string} Current profile ID */
  function getProfileId() { return _profileId; }

  // Initial state (profile data loaded after setProfile is called)
  const state = {
    mode: 'learn',
    selectedSemester: '1',
    selectedGrade: '1',
    currentIndex: 0,
    showPinyin: false,
    allChars: [],
    filteredChars: [],
    lessons: [],
    favorites: [],
    errorBook: [],
    stats: { totalRounds: 0, totalCorrect: 0, totalAnswered: 0, streak: 0, lastPlayDate: '', consecutiveDays: 0 },
    badges: [],
    quiz: { questions: [], current: 0, score: 0, streak: 0, isErrorReview: false }
  };

  return {
    get: (key) => state[key],
    set: (key, val) => { state[key] = val; },
    persist: (key) => save(key, state[key]),
    load,
    save,
    loadShared,
    saveShared,
    loadConfig,
    config,
    setProfile,
    getProfileId
  };
})();
