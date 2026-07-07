/**
 * Data Service — loading, filtering, and quiz question generation.
 *
 * Responsibilities:
 * - Load character data from JSON files (one per grade/semester)
 * - Filter characters by grade, semester, or lesson
 * - Generate quiz questions with random distractors
 */
const DataService = (() => {
  // Total: 12 files (grade 1-6, semester 1-2). Missing files are skipped silently.
  const DATA_FILES = [];
  for (let grade = 1; grade <= 6; grade++) {
    for (let sem = 1; sem <= 2; sem++) {
      DATA_FILES.push(`data/grade${grade}-semester${sem}.json`);
    }
  }

  /**
   * Load all data files and populate state.
   * @returns {Promise<{allChars: Array, lessons: Array}>}
   */
  async function loadAll() {
    const allChars = [];
    const lessons = [];

    for (const file of DATA_FILES) {
      try {
        const res = await fetch(file);
        if (!res.ok) continue;
        const data = await res.json();
        data.lessons.forEach(lesson => {
          lesson.chars.forEach(char => {
            char.lesson = lesson.title;
            char.semester = data.semester;
            char.grade = data.grade;
            allChars.push(char);
          });
          lessons.push(lesson);
        });
      } catch (_e) {
        // File doesn't exist or is invalid — skip silently
      }
    }

    State.set('allChars', allChars);
    State.set('lessons', lessons);
    State.set('filteredChars', [...allChars]);
    return { allChars, lessons };
  }

  /**
   * Get lessons matching the currently selected grade and semester.
   * @returns {Array} Filtered lessons
   */
  function getFilteredLessons() {
    const semester = State.get('selectedSemester');
    const grade = State.get('selectedGrade');
    const lessons = State.get('lessons');
    if (!semester || !grade) return lessons;
    return lessons.filter(l => {
      const [g, s] = l.id.split('-');
      return g === grade && s === semester;
    });
  }

  /**
   * Apply a filter (by lesson ID, or by current grade/semester selection).
   * Updates State.filteredChars and resets currentIndex to 0.
   * @param {string} lessonId - Specific lesson ID or 'all'
   * @returns {Array} Filtered characters
   */
  function applyFilter(lessonId) {
    const semester = State.get('selectedSemester');
    const grade = State.get('selectedGrade');
    const allChars = State.get('allChars');
    const lessons = State.get('lessons');
    let filtered;

    if (lessonId && lessonId !== 'all') {
      // Filter by specific lesson
      const lesson = lessons.find(l => l.id === lessonId);
      filtered = lesson ? [...lesson.chars] : [...allChars];
    } else if (semester && grade) {
      // Filter by grade + semester
      const matchingLessons = lessons.filter(l => {
        const [g, s] = l.id.split('-');
        return g === grade && s === semester;
      });
      filtered = matchingLessons.flatMap(l => l.chars);
    } else {
      filtered = [...allChars];
    }

    State.set('filteredChars', filtered);
    State.set('currentIndex', 0);
    return filtered;
  }

  /**
   * Get random distractor characters (different pinyin from target).
   * Uses allChars as pool to ensure enough distractors even for small lessons.
   */
  function getRandomDistractors(targetChar, count = 3) {
    const allChars = State.get('allChars');
    const pool = allChars.filter(c => c.pinyin !== targetChar.pinyin && c.char !== targetChar.char);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Get random distractors by char (different char, for 看拼音选汉字).
   */
  function getCharDistractors(targetChar, count = 3) {
    const allChars = State.get('allChars');
    const pool = allChars.filter(c => c.char !== targetChar.char);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generate quiz questions with mixed types.
   * Types: 'pickPinyin' (看汉字选拼音), 'pickChar' (看拼音选汉字), 'fillBlank' (填空)
   * @param {boolean} fromErrorBook
   * @param {string} questionType - 'mixed', 'pickPinyin', 'pickChar', 'fillBlank', 'match'
   * @returns {Array|null}
   */
  function generateQuizQuestions(fromErrorBook = false, questionType = 'mixed', maxCount = 10) {
    const allChars = State.get('allChars');
    const filtered = State.get('filteredChars');
    const errorBook = State.get('errorBook');

    const pool = fromErrorBook
      ? allChars.filter(c => errorBook.some(e => e.char === c.char))
      : (filtered.length > 0 ? filtered : allChars);

    if (pool.length < 1) return null;

    const count = (maxCount === 'all') ? pool.length : Math.min(maxCount, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const questions = [];

    // Available types for mixed mode
    const types = questionType === 'mixed'
      ? ['pickPinyin', 'pickChar', 'fillBlank']
      : [questionType];

    for (let i = 0; i < count; i++) {
      const target = shuffled[i];
      const type = types[Math.floor(Math.random() * types.length)];
      const question = _buildQuestion(target, type);
      if (question) questions.push(question);
    }

    return questions.length > 0 ? questions : null;
  }

  /**
   * Build a single question of the specified type.
   */
  function _buildQuestion(target, type) {
    switch (type) {
      case 'pickPinyin': {
        // 看汉字选拼音: show char, pick correct pinyin
        const distractors = getRandomDistractors(target);
        if (distractors.length < 3) return null;
        const options = [target, ...distractors].sort(() => Math.random() - 0.5);
        return { target, options, type: 'pickPinyin', answered: false };
      }
      case 'pickChar': {
        // 看拼音选汉字: show pinyin, pick correct char
        const distractors = getCharDistractors(target);
        if (distractors.length < 3) return null;
        const options = [target, ...distractors].sort(() => Math.random() - 0.5);
        return { target, options, type: 'pickChar', answered: false };
      }
      case 'fillBlank': {
        // 填空: show sentence with blank, pick correct char
        // Skip if sentence is auto-generated (too short/formulaic) or doesn't contain char
        const sent = target.sentence || '';
        const isAutoGenerated = sent.startsWith('我知道') || sent.startsWith('今天我学了') || 
                                sent.startsWith('书上写着') || sent.startsWith('老师让我们记住') ||
                                sent.startsWith('妈妈说') || sent.length < 6;
        if (!sent.includes(target.char) || isAutoGenerated) {
          // Fallback to pickChar for characters without good sentences
          return _buildQuestion(target, 'pickChar');
        }
        const distractors = getCharDistractors(target);
        if (distractors.length < 3) return null;
        const options = [target, ...distractors].sort(() => Math.random() - 0.5);
        const sentence = sent.replace(target.char, '___');
        return { target, options, type: 'fillBlank', sentence, answered: false };
      }
      default:
        return null;
    }
  }

  /**
   * Generate pairs for match game (6 pairs of char + pinyin).
   * @returns {Array|null} Array of {char, pinyin} pairs
   */
  function generateMatchPairs() {
    const filtered = State.get('filteredChars');
    const allChars = State.get('allChars');
    const pool = filtered.length >= 6 ? filtered : allChars;
    if (pool.length < 6) return null;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    // Deduplicate by char
    const seen = new Set();
    const pairs = [];
    for (const c of shuffled) {
      if (!seen.has(c.char)) {
        seen.add(c.char);
        pairs.push({ char: c.char, pinyin: c.pinyin });
        if (pairs.length >= 6) break;
      }
    }
    return pairs.length >= 6 ? pairs : null;
  }

  return { loadAll, getFilteredLessons, applyFilter, generateQuizQuestions, generateMatchPairs };
})();
