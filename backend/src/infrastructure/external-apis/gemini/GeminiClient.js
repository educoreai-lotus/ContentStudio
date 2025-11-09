import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Client
 * Handles communication with Google Gemini API
 * Used for mind map generation
 */
export class GeminiClient {
  constructor({ apiKey, googleClientId, googleClientSecret, googleProjectId }) {
    // Support both direct API key and Google OAuth credentials
    if (!apiKey && !googleProjectId) {
      throw new Error('Gemini API key or Google Project ID is required');
    }
    
    // Use API key if provided (simpler, preferred)
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      // For OAuth, we still need an API key for Generative AI
      // Note: Google Generative AI SDK primarily uses API keys
      // OAuth is typically for other Google APIs (like Slides)
      throw new Error('Gemini API key is required. Google OAuth credentials are for other Google APIs.');
    }
  }

  /**
   * Generate content using Gemini
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated content
   */
  async generate(prompt, options = {}) {
    try {
      // Use Gemini 1.5 Flash (free, stable, and fast)
      const model = options.model || 'gemini-1.5-flash';
      const genModel = this.genAI.getGenerativeModel({ model });

      const generationConfig = {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.max_tokens || 2000,
      };

      const result = await genModel.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = await result.response;
      return response.text() || '';
    } catch (error) {
      throw new Error(`Failed to generate with Gemini: ${error.message}`);
    }
  }

  /**
   * Generate mind map structure
   * @param {string} topicText - Topic text to analyze
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Mind map JSON structure
   */
  async generateMindMap(topicText, options = {}) {
    const prompt = `Analyze the following educational content and create a mind map structure in JSON format.
The JSON should have a "nodes" array with objects containing "id", "label", and "type" fields,
and an "edges" array with objects containing "source", "target" fields representing relationships.

Content to analyze:
${topicText}

Return only valid JSON, no additional text.`;

    try {
      const response = await this.generate(prompt, {
        temperature: 0.3, // Lower temperature for more structured output
        max_tokens: 3000,
      });

      // Parse JSON response
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Invalid JSON response from Gemini');
    } catch (error) {
      throw new Error(`Failed to generate mind map: ${error.message}`);
    }
  }
}

