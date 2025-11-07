import { LanguageStatsJob } from './LanguageStatsJob.js';
import { LanguageCleanupJob } from './LanguageCleanupJob.js';

/**
 * Language Evaluation Orchestrator
 * Coordinates the periodic evaluation and cleanup process
 * 
 * Flow:
 * 1. Run LanguageStatsJob (evaluate and promote/demote languages)
 * 2. Run LanguageCleanupJob (clean up Supabase Storage for demoted languages)
 * 
 * Schedule: Every 2 weeks (bi-weekly) or monthly
 */
export class LanguageEvaluationOrchestrator {
  constructor({
    languageStatsRepository,
    supabaseStorageClient,
    contentRepository,
    topicRepository,
  }) {
    this.languageStatsJob = new LanguageStatsJob({
      languageStatsRepository,
    });

    this.languageCleanupJob = new LanguageCleanupJob({
      languageStatsRepository,
      supabaseStorageClient,
      contentRepository,
      topicRepository,
    });
  }

  /**
   * Execute the complete evaluation cycle
   * 1. Evaluate language statistics
   * 2. Clean up non-frequent languages
   * @returns {Promise<Object>} Evaluation and cleanup results
   */
  async execute() {
    console.log('========================================');
    console.log('Starting Language Evaluation Cycle');
    console.log('========================================');

    try {
      // Step 1: Evaluate language statistics (promote/demote)
      console.log('\n[Step 1/2] Evaluating language statistics...');
      const evaluationResult = await this.languageStatsJob.execute();

      // Step 2: Clean up Supabase Storage for demoted languages
      console.log('\n[Step 2/2] Cleaning up Supabase Storage...');
      const cleanupResult = await this.languageCleanupJob.execute();

      console.log('\n========================================');
      console.log('Language Evaluation Cycle Completed');
      console.log('========================================');

      return {
        success: true,
        evaluation: evaluationResult,
        cleanup: cleanupResult,
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Language evaluation cycle failed:', error);
      throw error;
    }
  }
}



