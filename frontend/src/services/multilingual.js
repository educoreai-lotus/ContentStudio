import apiClient from './api';

/**
 * Multilingual Content Service
 * Handles multilingual content retrieval and language management
 */
export const multilingualService = {
  /**
   * Get lesson content in preferred language
   * POST /api/content/multilingual/lesson
   */
  async getLessonByLanguage(lessonId, preferredLanguage, contentType = 'text') {
    const response = await apiClient.post('/api/content/multilingual/lesson', {
      lesson_id: lessonId,
      preferred_language: preferredLanguage,
      content_type: contentType,
    });
    return response.data;
  },

  /**
   * Get language statistics
   * GET /api/content/multilingual/stats
   */
  async getLanguageStats() {
    const response = await apiClient.get('/api/content/multilingual/stats');
    return response.data;
  },

  /**
   * Get specific language statistics
   * GET /api/content/multilingual/stats/:languageCode
   */
  async getLanguageStat(languageCode) {
    const response = await apiClient.get(`/api/content/multilingual/stats/${languageCode}`);
    return response.data;
  },
};



