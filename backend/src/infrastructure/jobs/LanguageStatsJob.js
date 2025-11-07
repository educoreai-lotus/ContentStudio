import { LanguageStatsRepository } from '../database/repositories/LanguageStatsRepository.js';

/**
 * Background Job for Language Statistics Evaluation
 * Recalculates language frequency and promotes/demotes languages
 * 
 * IMPORTANT: This job runs PERIODICALLY (every 2 weeks or monthly),
 * NOT in real-time. Language usage statistics are updated in real-time,
 * but promotion/demotion decisions are made only during scheduled evaluations.
 * 
 * Schedule: Every 2 weeks (bi-weekly) or monthly
 */
export class LanguageStatsJob {
  constructor({ languageStatsRepository }) {
    this.languageStatsRepository = languageStatsRepository;
  }

  /**
   * Execute the evaluation job
   * Recalculates language frequency based on collected usage statistics
   * This is a STATIC evaluation - only runs during scheduled periods
   */
  async execute() {
    console.log('Starting scheduled language statistics evaluation...');
    console.log('This is a periodic evaluation (not real-time)');

    try {
      // Step 1: Recalculate frequency based on collected statistics
      await this.languageStatsRepository.recalculateFrequency();

      // Step 2: Get updated language statuses
      const allLanguages = await this.languageStatsRepository.getPopularLanguages(100);
      const frequentLanguages = allLanguages.filter(lang => lang.is_frequent);
      const demotedLanguages = allLanguages.filter(
        lang => !lang.is_frequent && !lang.is_predefined
      );

      // Step 3: Log evaluation results
      console.log('Language evaluation completed:', {
        evaluation_date: new Date().toISOString(),
        total_languages: allLanguages.length,
        frequent_languages: frequentLanguages.length,
        demoted_languages: demotedLanguages.length,
        newly_promoted: frequentLanguages
          .filter(lang => lang.total_requests > 0)
          .map(lang => ({
            code: lang.language_code,
            requests: lang.total_requests,
            percentage: this.calculatePercentage(lang.total_requests, allLanguages),
          })),
        top_languages: allLanguages.slice(0, 10).map(lang => ({
          code: lang.language_code,
          requests: lang.total_requests,
          frequent: lang.is_frequent,
          predefined: lang.is_predefined,
        })),
      });

      return {
        success: true,
        evaluation_date: new Date().toISOString(),
        total_languages: allLanguages.length,
        frequent_languages: frequentLanguages.length,
        demoted_languages: demotedLanguages.length,
        promoted_languages: frequentLanguages.filter(lang => !lang.is_predefined).length,
      };
    } catch (error) {
      console.error('Language stats evaluation job failed:', error);
      throw error;
    }
  }

  /**
   * Calculate percentage of total requests
   * @param {number} requests - Language requests
   * @param {Array} allLanguages - All language stats
   * @returns {number} Percentage
   */
  calculatePercentage(requests, allLanguages) {
    const total = allLanguages.reduce((sum, lang) => sum + (lang.total_requests || 0), 0);
    return total > 0 ? ((requests / total) * 100).toFixed(2) : 0;
  }
}

