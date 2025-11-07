import { db } from '../DatabaseConnection.js';

/**
 * Language Statistics Repository
 * Manages language usage statistics and frequency tracking
 */
export class LanguageStatsRepository {
  constructor() {
    this.db = db;
  }

  /**
   * Update language statistics (increment request count)
   * @param {string} languageCode - Language code
   * @param {string} languageName - Language name (optional)
   * @returns {Promise<void>}
   */
  async incrementRequest(languageCode, languageName = null) {
    if (!this.db.isConnected()) {
      // In-memory fallback (would use a Map in production)
      return;
    }

    try {
      await this.db.query(
        'SELECT update_language_stats($1, $2)',
        [languageCode, languageName || languageCode]
      );
    } catch (error) {
      console.error('Failed to update language stats:', error);
    }
  }

  /**
   * Get language statistics
   * @param {string} languageCode - Language code
   * @returns {Promise<Object|null>} Language stats
   */
  async getLanguageStats(languageCode) {
    if (!this.db.isConnected()) {
      return null;
    }

    try {
      const result = await this.db.query(
        'SELECT * FROM language_stats WHERE language_code = $1',
        [languageCode]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get language stats:', error);
      return null;
    }
  }

  /**
   * Get all frequent languages
   * @returns {Promise<Array>} Array of frequent language codes
   */
  async getFrequentLanguages() {
    if (!this.db.isConnected()) {
      return ['en', 'he', 'ar']; // Default predefined languages
    }

    try {
      const result = await this.db.query(
        'SELECT language_code FROM language_stats WHERE is_frequent = true ORDER BY total_requests DESC'
      );

      return result.rows.map(row => row.language_code);
    } catch (error) {
      console.error('Failed to get frequent languages:', error);
      return ['en', 'he', 'ar'];
    }
  }

  /**
   * Check if language is frequent
   * @param {string} languageCode - Language code
   * @returns {Promise<boolean>} True if frequent
   */
  async isFrequentLanguage(languageCode) {
    const stats = await this.getLanguageStats(languageCode);
    return stats ? stats.is_frequent : false;
  }

  /**
   * Recalculate language frequency based on usage
   * IMPORTANT: This is a STATIC evaluation that should run periodically (every 2 weeks/month)
   * NOT in real-time. Real-time updates only increment statistics.
   * @returns {Promise<void>}
   */
  async recalculateFrequency() {
    if (!this.db.isConnected()) {
      return;
    }

    try {
      await this.db.query('SELECT recalculate_language_frequency()');
      console.log('Language frequency recalculation completed');
    } catch (error) {
      console.error('Failed to recalculate language frequency:', error);
      throw error;
    }
  }

  /**
   * Get non-frequent languages (candidates for cleanup)
   * @returns {Promise<Array>} Array of non-frequent language stats
   */
  async getNonFrequentLanguages() {
    if (!this.db.isConnected()) {
      return [];
    }

    try {
      const result = await this.db.query('SELECT * FROM get_non_frequent_languages()');
      return result.rows;
    } catch (error) {
      console.error('Failed to get non-frequent languages:', error);
      return [];
    }
  }

  /**
   * Get language popularity ranking
   * @param {number} limit - Number of languages to return
   * @returns {Promise<Array>} Array of language stats sorted by popularity
   */
  async getPopularLanguages(limit = 10) {
    if (!this.db.isConnected()) {
      return [];
    }

    try {
      const result = await this.db.query(
        'SELECT * FROM language_stats ORDER BY total_requests DESC LIMIT $1',
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Failed to get popular languages:', error);
      return [];
    }
  }

  /**
   * Increment lesson count for a language
   * @param {string} languageCode - Language code
   * @returns {Promise<void>}
   */
  async incrementLessonCount(languageCode) {
    if (!this.db.isConnected()) {
      return;
    }

    try {
      await this.db.query(
        'UPDATE language_stats SET total_lessons = total_lessons + 1, updated_at = CURRENT_TIMESTAMP WHERE language_code = $1',
        [languageCode]
      );
    } catch (error) {
      console.error('Failed to increment lesson count:', error);
    }
  }
}

