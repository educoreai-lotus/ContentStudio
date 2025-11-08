import { LanguageStatsRepository } from '../../infrastructure/database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../../infrastructure/storage/SupabaseStorageClient.js';
import { TopicRepository } from '../../infrastructure/database/repositories/TopicRepository.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';
import { AITranslationService } from '../../infrastructure/ai/AITranslationService.js';

/**
 * Preload Frequent Languages Use Case
 * Pre-populates Supabase Storage with content for frequent languages (en, he, ar)
 * Should run on system startup or periodically
 */
export class PreloadFrequentLanguagesUseCase {
  constructor({
    languageStatsRepository,
    supabaseStorageClient,
    topicRepository,
    contentRepository,
    translationService,
  }) {
    this.languageStatsRepository = languageStatsRepository;
    this.supabaseStorageClient = supabaseStorageClient;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.translationService = translationService;
  }

  /**
   * Preload content for all frequent languages
   * @param {Object} options - Preload options
   * @param {Array<string>} options.languages - Specific languages to preload (optional)
   * @param {number} options.maxLessons - Maximum lessons to preload per language
   * @returns {Promise<Object>} Preload results
   */
  async execute(options = {}) {
    const { languages = null, maxLessons = 100 } = options;

    console.log('Starting frequent languages preload...');

    try {
      // Get frequent languages
      const frequentLanguages = languages
        ? languages
        : await this.languageStatsRepository.getFrequentLanguages();

      if (frequentLanguages.length === 0) {
        console.log('No frequent languages to preload');
        return {
          success: true,
          preloaded_languages: 0,
          preloaded_lessons: 0,
        };
      }

      console.log(`Preloading ${frequentLanguages.length} frequent languages`);

      // Get all topics/lessons
      const topics = await this.topicRepository.findAll(
        { language: 'en' },
        { page: 1, limit: maxLessons }
      );

      const results = {
        success: true,
        languages: [],
        total_preloaded: 0,
      };

      // For each frequent language, ensure content exists
      for (const languageCode of frequentLanguages) {
        try {
          const preloadedCount = await this.preloadLanguage(languageCode, topics);
          results.languages.push({
            language_code: languageCode,
            preloaded_lessons: preloadedCount,
          });
          results.total_preloaded += preloadedCount;
        } catch (error) {
          console.error(`Failed to preload ${languageCode}:`, error);
          results.languages.push({
            language_code: languageCode,
            error: error.message,
          });
        }
      }

      console.log('Frequent languages preload completed:', results);

      return results;
    } catch (error) {
      console.error('Preload frequent languages failed:', error);
      throw error;
    }
  }

  /**
   * Preload content for a specific language
   * @param {string} languageCode - Language code
   * @param {Array} topics - Topics to preload
   * @returns {Promise<number>} Number of lessons preloaded
   */
  async preloadLanguage(languageCode, topics) {
    let preloadedCount = 0;

    for (const topic of topics) {
      try {
        // Check if content already exists
        const exists = await this.supabaseStorageClient.lessonContentExists(
          languageCode,
          topic.topic_id.toString(),
          'text'
        );

        if (exists) {
          continue; // Skip if already exists
        }

        // Get content from database (prefer English as source)
        const contents = await this.contentRepository.findAllByTopicId(topic.topic_id, {
          content_type_id: 'text',
        });

        if (contents.length === 0) {
          continue; // No content to preload
        }

        const sourceContent = contents[0].content_data;
        const sourceLanguage = 'en'; // Default source

        // Translate if needed
        let translatedContent = sourceContent;
        if (languageCode !== sourceLanguage) {
          translatedContent = await this.translationService.translateStructured(
            sourceContent,
            sourceLanguage,
            languageCode
          );
        }

        // Store in Supabase
        await this.supabaseStorageClient.storeLessonContent(
          languageCode,
          topic.topic_id.toString(),
          translatedContent,
          'text'
        );

        preloadedCount++;
        console.log(
          `Preloaded lesson ${topic.topic_id} for language ${languageCode}`
        );
      } catch (error) {
        console.error(
          `Failed to preload lesson ${topic.topic_id} for ${languageCode}:`,
          error.message
        );
      }
    }

    return preloadedCount;
  }
}



