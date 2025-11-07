/**
 * Translation Service Interface
 * Defines contract for content translation
 */
export class TranslationService {
  /**
   * Translate content from source language to target language
   * @param {string} content - Content to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {Object} options - Translation options
   * @returns {Promise<string>} Translated content
   */
  async translate(content, sourceLanguage, targetLanguage, options = {}) {
    throw new Error('TranslationService.translate() must be implemented');
  }

  /**
   * Translate structured content (JSON object)
   * @param {Object} contentData - Structured content
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated content data
   */
  async translateStructured(contentData, sourceLanguage, targetLanguage) {
    throw new Error('TranslationService.translateStructured() must be implemented');
  }
}



