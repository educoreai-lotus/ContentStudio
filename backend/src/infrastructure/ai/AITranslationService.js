import { TranslationService as ITranslationService } from '../../domain/services/TranslationService.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { GeminiClient } from '../external-apis/gemini/GeminiClient.js';

/**
 * AI Translation Service Implementation
 * Uses OpenAI or Gemini for content translation
 */
export class AITranslationService extends ITranslationService {
  constructor({ openaiApiKey, geminiApiKey, preferredProvider = 'openai' }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.geminiClient = geminiApiKey ? new GeminiClient({ apiKey: geminiApiKey }) : null;
    this.preferredProvider = preferredProvider;
  }

  /**
   * Translate content using AI
   * @param {string} content - Content to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {Object} options - Translation options
   * @returns {Promise<string>} Translated content
   */
  async translate(content, sourceLanguage, targetLanguage, options = {}) {
    const { preserveFormatting = true, context = null } = options;

    const languageNames = {
      en: 'English',
      he: 'Hebrew',
      ar: 'Arabic',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
    };

    const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    let prompt = `Translate the following ${sourceLangName} content to ${targetLangName}.\n\n`;
    
    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `Content to translate:\n${content}\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Maintain the same meaning and tone\n`;
    prompt += `- Keep technical terms and proper nouns unchanged if appropriate\n`;
    
    if (preserveFormatting) {
      prompt += `- Preserve all formatting, markdown, and structure\n`;
    }

    prompt += `- Return only the translated content, no additional text`;

    try {
      // Try preferred provider first
      if (this.preferredProvider === 'openai' && this.openaiClient) {
        return await this.openaiClient.generateText(prompt, {
          systemPrompt: `You are an expert translator. Translate content accurately while preserving meaning, tone, and formatting.`,
          temperature: 0.3, // Lower temperature for more consistent translation
          max_tokens: 4000,
        });
      } else if (this.preferredProvider === 'gemini' && this.geminiClient) {
        return await this.geminiClient.generate(prompt, {
          temperature: 0.3,
          max_tokens: 4000,
        });
      }

      // Fallback to available provider
      if (this.openaiClient) {
        return await this.openaiClient.generateText(prompt, {
          systemPrompt: `You are an expert translator. Translate content accurately while preserving meaning, tone, and formatting.`,
          temperature: 0.3,
          max_tokens: 4000,
        });
      }

      if (this.geminiClient) {
        return await this.geminiClient.generate(prompt, {
          temperature: 0.3,
          max_tokens: 4000,
        });
      }

      throw new Error('No translation provider available');
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Translate structured content (JSON object)
   * @param {Object} contentData - Structured content
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated content data
   */
  async translateStructured(contentData, sourceLanguage, targetLanguage) {
    // Translate each text field in the content data
    const translated = { ...contentData };

    // Recursively translate text fields
    for (const [key, value] of Object.entries(contentData)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        // Skip URLs, IDs, and technical fields
        if (!this.isTechnicalField(key)) {
          try {
            translated[key] = await this.translate(value, sourceLanguage, targetLanguage, {
              context: `Field: ${key}`,
            });
          } catch (error) {
            console.warn(`Failed to translate field ${key}:`, error);
            translated[key] = value; // Keep original on error
          }
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively translate nested objects
        translated[key] = await this.translateStructured(value, sourceLanguage, targetLanguage);
      } else if (Array.isArray(value)) {
        // Translate array items
        translated[key] = await Promise.all(
          value.map(item =>
            typeof item === 'string'
              ? this.translate(item, sourceLanguage, targetLanguage, { context: `Array item in ${key}` })
              : typeof item === 'object'
              ? this.translateStructured(item, sourceLanguage, targetLanguage)
              : item
          )
        );
      }
    }

    return translated;
  }

  /**
   * Check if field should not be translated
   * @param {string} fieldName - Field name
   * @returns {boolean} True if technical field
   */
  isTechnicalField(fieldName) {
    const technicalFields = [
      'id',
      'url',
      'path',
      'link',
      'code',
      'language',
      'format',
      'type',
      'status',
      'created_at',
      'updated_at',
      'version',
      'metadata',
    ];

    return technicalFields.some(field => fieldName.toLowerCase().includes(field));
  }
}

