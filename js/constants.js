/**
 * Constants and utilities shared across modules.
 */

/**
 * @typedef {Object} CharData
 * @property {string} char - The Chinese character
 * @property {string} pinyin - Pinyin with tone marks
 * @property {string[]} words - Example words containing this character
 * @property {string} sentence - Example sentence
 * @property {string} [lesson] - Lesson title (added at load time)
 * @property {number} [grade] - Grade number 1-6 (added at load time)
 * @property {number} [semester] - Semester 1 or 2 (added at load time)
 */

/**
 * @typedef {Object} ErrorEntry
 * @property {string} char - The character
 * @property {string} pinyin - The character's pinyin
 * @property {number} wrongCount - Times answered incorrectly
 * @property {number} consecutiveCorrect - Consecutive correct answers in review
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {CharData} target - The correct character
 * @property {CharData[]} options - Answer options (including target)
 * @property {boolean} answered - Whether this question has been answered
 */

/**
 * @typedef {Object} Profile
 * @property {string} id - Unique profile identifier (same as name)
 * @property {string} name - Display name
 * @property {string} avatar - Emoji avatar
 */

/**
 * Escape HTML special characters to prevent XSS.
 * Use this whenever inserting dynamic text via innerHTML.
 * @param {string} str - Raw string
 * @returns {string} Escaped string safe for innerHTML
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
