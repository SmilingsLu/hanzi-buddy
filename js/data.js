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
   * @param {Object} targetChar - The correct character object
   * @param {number} count - Number of distractors needed
   * @returns {Array} Distractor character objects
   */
  function getRandomDistractors(targetChar, count = 3) {
    const filtered = State.get('filteredChars');
    const pool = filtered.filter(c => c.pinyin !== targetChar.pinyin);
    // Shuffle without mutating the original array
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generate a set of quiz questions from current filter or error book.
   * @param {boolean} fromErrorBook - If true, quiz only error book characters
   * @returns {Array|null} Questions array, or null if insufficient characters
   */
  function generateQuizQuestions(fromErrorBook = false) {
    const allChars = State.get('allChars');
    const filtered = State.get('filteredChars');
    const errorBook = State.get('errorBook');

    const pool = fromErrorBook
      ? allChars.filter(c => errorBook.some(e => e.char === c.char))
      : filtered;

    if (pool.length < 4) return null;

    const count = Math.min(10, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const questions = [];

    for (let i = 0; i < count; i++) {
      const target = shuffled[i];
      const distractors = getRandomDistractors(target);
      const options = [target, ...distractors].sort(() => Math.random() - 0.5);
      questions.push({ target, options, answered: false });
    }

    return questions;
  }

  return { loadAll, getFilteredLessons, applyFilter, generateQuizQuestions };
})();
