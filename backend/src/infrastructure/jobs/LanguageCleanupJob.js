import { LanguageStatsRepository } from '../database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { ContentRepository } from '../database/repositories/ContentRepository.js';
import { TopicRepository } from '../database/repositories/TopicRepository.js';

/**
 * Language Cleanup Job
 * Removes or archives outdated lesson content for non-frequent languages from Supabase Storage
 * 
 * IMPORTANT: This job runs AFTER each language evaluation cycle
 * It cleans up Supabase Storage to optimize space by removing content from demoted languages
 * 
 * Schedule: Runs immediately after LanguageStatsJob (every 2 weeks or monthly)
 */
export class LanguageCleanupJob {
  constructor({
    languageStatsRepository,
    supabaseStorageClient,
    contentRepository,
    topicRepository,
  }) {
    this.languageStatsRepository = languageStatsRepository;
    this.supabaseStorageClient = supabaseStorageClient;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
  }

  /**
   * Execute the cleanup job
   * Removes outdated content for non-frequent languages
   */
  async execute() {
    console.log('Starting language cleanup job...');
    console.log('Removing outdated content for non-frequent languages from Supabase Storage');

    try {
      // Step 1: Get all non-frequent languages (excluding predefined)
      // Use dedicated function for better performance
      const nonFrequentLanguages = await this.languageStatsRepository.getNonFrequentLanguages();

      if (nonFrequentLanguages.length === 0) {
        console.log('No non-frequent languages to clean up');
        return {
          success: true,
          cleaned_languages: 0,
          cleaned_lessons: 0,
        };
      }

      console.log(`Found ${nonFrequentLanguages.length} non-frequent languages to clean up`);

      // Step 2: For each non-frequent language, clean up Supabase Storage
      let totalCleanedLessons = 0;
      const cleanupResults = [];

      for (const language of nonFrequentLanguages) {
        try {
          const cleanedCount = await this.cleanupLanguageContent(language.language_code);
          totalCleanedLessons += cleanedCount;

          cleanupResults.push({
            language_code: language.language_code,
            language_name: language.language_name,
            cleaned_lessons: cleanedCount,
            last_used: language.last_used,
          });

          console.log(
            `Cleaned up ${cleanedCount} lessons for language: ${language.language_code}`
          );
        } catch (error) {
          console.error(
            `Failed to cleanup language ${language.language_code}:`,
            error.message
          );
          cleanupResults.push({
            language_code: language.language_code,
            error: error.message,
          });
        }
      }

      // Step 3: Log cleanup results
      console.log('Language cleanup completed:', {
        cleanup_date: new Date().toISOString(),
        cleaned_languages: nonFrequentLanguages.length,
        total_cleaned_lessons: totalCleanedLessons,
        results: cleanupResults,
      });

      return {
        success: true,
        cleanup_date: new Date().toISOString(),
        cleaned_languages: nonFrequentLanguages.length,
        total_cleaned_lessons: totalCleanedLessons,
        results: cleanupResults,
      };
    } catch (error) {
      console.error('Language cleanup job failed:', error);
      throw error;
    }
  }

  /**
   * Clean up content for a specific language
   * @param {string} languageCode - Language code to clean up
   * @returns {Promise<number>} Number of lessons cleaned
   */
  async cleanupLanguageContent(languageCode) {
    if (!this.supabaseStorageClient.isConfigured()) {
      console.warn('Supabase not configured, skipping cleanup');
      return 0;
    }

    // Strategy: Keep only recent or most-used content
    // For now, we'll remove all content for non-frequent languages
    // In production, you might want to keep the most recent N lessons

    // Get all topics that might have content in this language
    const topics = await this.topicRepository.findAll({}, { page: 1, limit: 1000 });

    let cleanedCount = 0;

    for (const topic of topics) {
      try {
        // Check if content exists in Supabase for this language
        const contentTypes = ['text', 'code', 'presentation', 'audio', 'mind_map'];

        for (const contentType of contentTypes) {
          const exists = await this.supabaseStorageClient.lessonContentExists(
            languageCode,
            topic.topic_id.toString(),
            contentType
          );

          if (exists) {
            // Delete the content
            await this.supabaseStorageClient.deleteLessonContent(
              languageCode,
              topic.topic_id.toString()
            );
            cleanedCount++;
            console.log(
              `Deleted ${contentType} content for lesson ${topic.topic_id} in ${languageCode}`
            );
          }
        }
      } catch (error) {
        console.error(
          `Failed to cleanup lesson ${topic.topic_id} for ${languageCode}:`,
          error.message
        );
      }
    }

    return cleanedCount;
  }

  /**
   * Archive content instead of deleting (alternative strategy)
   * Moves content to archive folder in Supabase
   * @param {string} languageCode - Language code
   * @returns {Promise<number>} Number of lessons archived
   */
  async archiveLanguageContent(languageCode) {
    // TODO: Implement archiving strategy
    // Move content to archive/ folder instead of deleting
    // This allows recovery if language is promoted again
    return 0;
  }
}

