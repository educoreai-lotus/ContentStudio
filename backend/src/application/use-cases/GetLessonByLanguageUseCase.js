import { LanguageStatsRepository } from '../../infrastructure/database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../../infrastructure/storage/SupabaseStorageClient.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';
import { TopicRepository } from '../../infrastructure/database/repositories/TopicRepository.js';
import { AITranslationService } from '../../infrastructure/ai/AITranslationService.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

/**
 * Get Lesson By Language Use Case
 * Intelligent multilingual content retrieval and generation
 */
export class GetLessonByLanguageUseCase {
  constructor({
    languageStatsRepository,
    supabaseStorageClient,
    contentRepository,
    topicRepository,
    translationService,
    aiGenerationService,
  }) {
    this.languageStatsRepository = languageStatsRepository;
    this.supabaseStorageClient = supabaseStorageClient;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
    this.translationService = translationService;
    this.aiGenerationService = aiGenerationService;
  }

  /**
   * Get lesson content in preferred language
   * @param {Object} params - Request parameters
   * @param {string} params.lessonId - Lesson/Topic ID
   * @param {string} params.preferredLanguage - Preferred language code
   * @param {string} params.contentType - Content type (text, code, presentation, etc.)
   * @returns {Promise<Object>} Lesson content in preferred language
   */
  async execute({ lessonId, preferredLanguage, contentType = 'text' }) {
    // Step 1: Update language statistics
    await this.languageStatsRepository.incrementRequest(preferredLanguage);

    // Step 2: Check if content exists in preferred language (Supabase Storage)
    const cachedContent = await this.supabaseStorageClient.getLessonContent(
      preferredLanguage,
      lessonId,
      contentType
    );

    if (cachedContent) {
      console.log(`Content found in cache for ${preferredLanguage}`);
      return {
        content: cachedContent,
        source: 'cache',
        language: preferredLanguage,
        cached: true,
      };
    }

    // Step 3: Check if language is frequent (should be in storage)
    const isFrequent = await this.languageStatsRepository.isFrequentLanguage(preferredLanguage);

    // Step 4: Try to find content in fallback languages (English, Hebrew, Arabic)
    const fallbackLanguages = ['en', 'he', 'ar'];
    let sourceContent = null;
    let sourceLanguage = null;

    for (const fallbackLang of fallbackLanguages) {
      const fallbackContent = await this.supabaseStorageClient.getLessonContent(
        fallbackLang,
        lessonId,
        contentType
      );

      if (fallbackContent) {
        sourceContent = fallbackContent;
        sourceLanguage = fallbackLang;
        break;
      }
    }

    // Step 5: If no cached content found, try database
    if (!sourceContent) {
      const topic = await this.topicRepository.findById(lessonId);
      if (topic) {
        const contents = await this.contentRepository.findAllByTopicId(lessonId, {
          content_type_id: contentType,
        });

        if (contents.length > 0) {
          sourceContent = contents[0].content_data;
          sourceLanguage = contents[0].language || 'en';
        }
      }
    }

    let translatedContent;

    // Step 6: If source content found, translate it
    if (sourceContent && sourceLanguage !== preferredLanguage) {
      console.log(`Translating from ${sourceLanguage} to ${preferredLanguage}`);
      translatedContent = await this.translationService.translateStructured(
        sourceContent,
        sourceLanguage,
        preferredLanguage
      );

      // Step 7: Store in Supabase if language is frequent or predefined
      if (isFrequent) {
        try {
          await this.supabaseStorageClient.storeLessonContent(
            preferredLanguage,
            lessonId,
            translatedContent,
            contentType
          );
          await this.languageStatsRepository.incrementLessonCount(preferredLanguage);
          console.log(`Stored translated content for frequent language: ${preferredLanguage}`);
        } catch (error) {
          console.error(`Failed to store content for ${preferredLanguage}:`, error);
        }
      }
    } else if (!sourceContent) {
      // Step 8: Full AI Generation if no source content exists
      console.log(`No source content found, generating new content in ${preferredLanguage}`);
      translatedContent = await this.generateContentFromScratch(lessonId, preferredLanguage, contentType);
    } else {
      // Content already in preferred language
      translatedContent = sourceContent;
    }

    return {
      content: translatedContent,
      source: sourceContent ? 'translation' : 'generation',
      language: preferredLanguage,
      source_language: sourceLanguage,
      cached: false,
    };
  }

  /**
   * Generate content from scratch using AI
   * @param {string} lessonId - Lesson ID
   * @param {string} language - Target language
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Generated content
   */
  async generateContentFromScratch(lessonId, language, contentType) {
    // Get lesson metadata
    const topic = await this.topicRepository.findById(lessonId);
    if (!topic) {
      throw new Error('Lesson not found');
    }

    const languageNames = {
      en: 'English',
      he: 'Hebrew',
      ar: 'Arabic',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
    };

    const langName = languageNames[language] || language;

    const prompt = `Generate ${contentType} content for a lesson about "${topic.topic_name}" in ${langName}.\n\n`;
    const promptSuffix = topic.description ? `Lesson description: ${topic.description}\n\n` : '';
    const fullPrompt = prompt + promptSuffix + `Create comprehensive, educational ${contentType} content in ${langName}.`;

    const generatedContent = await this.aiGenerationService.generate({
      prompt: fullPrompt,
      content_type: contentType,
      config: {
        language: language,
        style: 'educational',
      },
    });

    return generatedContent;
  }
}

