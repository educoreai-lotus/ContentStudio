/**
 * AI Generation Service Interface
 * Defines contract for AI content generation
 */
export class AIGenerationService {
  /**
   * Generate content using AI
   * @param {Object} options - Generation options
   * @param {string} options.prompt - Generation prompt
   * @param {string} options.content_type - Content type (text, code, etc.)
   * @param {Object} options.config - Additional configuration
   * @returns {Promise<Object>} Generated content data
   */
  async generate(options) {
    throw new Error('AIGenerationService.generate() must be implemented');
  }

  /**
   * Generate text content
   * @param {string} prompt - Text generation prompt
   * @param {Object} config - Configuration options
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, config = {}) {
    throw new Error('AIGenerationService.generateText() must be implemented');
  }

  /**
   * Generate code content
   * @param {string} prompt - Code generation prompt
   * @param {string} language - Programming language
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} Generated code with metadata
   */
  async generateCode(prompt, language, config = {}) {
    throw new Error('AIGenerationService.generateCode() must be implemented');
  }
}



