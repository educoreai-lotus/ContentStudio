import apiClient from './api';

/**
 * Template Application Service
 * Handles template application to lessons and lesson view retrieval
 */
export const templateApplicationService = {
  /**
   * Apply template to lesson
   * POST /api/templates/:templateId/apply/:topicId
   */
  async applyTemplate(templateId, topicId) {
    const response = await apiClient.post(
      `/api/templates/${templateId}/apply/${topicId}`
    );
    return response.data;
  },

  /**
   * Get lesson view with applied template
   * GET /api/topics/:topicId/view
   */
  async getLessonView(topicId) {
    const response = await apiClient.get(`/api/topics/${topicId}/view`);
    return response.data;
  },
};

