import apiClient from './api.js';

/**
 * AI Generation API Service
 */
export const aiGenerationService = {
  /**
   * Generate content using AI
   * @param {Object} generationRequest - Generation request data
   * @returns {Promise<Object>} Generated content
   */
  async generate(generationRequest) {
    const response = await apiClient.post('/api/content/generate', generationRequest);
    return response.data.data;
  },
};



