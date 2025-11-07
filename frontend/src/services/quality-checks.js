import apiClient from './api.js';

/**
 * Quality Checks API Service
 */
export const qualityChecksService = {
  /**
   * Trigger quality check for content
   * @param {number} contentId - Content ID
   * @param {string} checkType - Check type: 'full', 'quick', 'originality_only'
   * @returns {Promise<Object>} Quality check result
   */
  async triggerQualityCheck(contentId, checkType = 'full') {
    const response = await apiClient.post(
      `/api/quality-checks/content/${contentId}/quality-check`,
      { check_type: checkType }
    );
    return response.data.data;
  },

  /**
   * Get all quality checks for content
   * @param {number} contentId - Content ID
   * @returns {Promise<Array>} Array of quality checks
   */
  async getQualityChecks(contentId) {
    const response = await apiClient.get(
      `/api/quality-checks/content/${contentId}/quality-checks`
    );
    return response.data.data;
  },

  /**
   * Get quality check by ID
   * @param {number} qualityCheckId - Quality check ID
   * @returns {Promise<Object>} Quality check
   */
  async getQualityCheck(qualityCheckId) {
    const response = await apiClient.get(`/api/quality-checks/${qualityCheckId}`);
    return response.data.data;
  },
};



