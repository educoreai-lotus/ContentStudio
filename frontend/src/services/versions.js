import apiClient from './api.js';

/**
 * Content Versions API Service
 */
export const versionsService = {
  /**
   * Create a new version for content
   * @param {number} contentId - Content ID
   * @param {Object} versionData - Version data
   * @returns {Promise<Object>} Created version
   */
  async createVersion(contentId, versionData) {
    const response = await apiClient.post(
      `/api/content/${contentId}/versions`,
      versionData
    );
    return response.data.data;
  },

  /**
   * Get all versions for content
   * @param {number} contentId - Content ID
   * @returns {Promise<Array>} Array of versions
   */
  async getVersions(contentId) {
    const response = await apiClient.get(
      `/api/content/${contentId}/versions`
    );
    return response.data.data;
  },

  /**
   * Get version by ID
   * @param {number} versionId - Version ID
   * @returns {Promise<Object>} Version
   */
  async getVersion(versionId) {
    const response = await apiClient.get(`/api/versions/${versionId}`);
    return response.data.data;
  },

  /**
   * Restore content to a specific version
   * @param {number} versionId - Version ID
   * @param {string} restoredBy - User who restored
   * @returns {Promise<Object>} Restored content
   */
  async restoreVersion(versionId, restoredBy = 'trainer123') {
    const response = await apiClient.post(`/api/versions/${versionId}/restore`, {
      restored_by: restoredBy,
    });
    return response.data.data;
  },
};



