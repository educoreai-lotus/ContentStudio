import apiClient from './api.js';

/**
 * Templates API Service
 */
export const templatesService = {
  /**
   * Create a new template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(templateData) {
    const response = await apiClient.post('/api/templates', templateData);
    return response.data.data;
  },

  /**
   * Get all templates
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of templates
   */
  async getTemplates(filters = {}) {
    const params = {};
    if (filters.created_by) params.created_by = filters.created_by;
    if (filters.search) params.search = filters.search;

    const response = await apiClient.get('/api/templates', { params });
    return response.data.data;
  },

  /**
   * Get template by ID
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} Template
   */
  async getTemplate(templateId) {
    const response = await apiClient.get(`/api/templates/${templateId}`);
    return response.data.data;
  },

  /**
   * Update template
   * @param {number} templateId - Template ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(templateId, updates) {
    const response = await apiClient.put(`/api/templates/${templateId}`, updates);
    return response.data.data;
  },

  /**
   * Delete template
   * @param {number} templateId - Template ID
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateId) {
    await apiClient.delete(`/api/templates/${templateId}`);
  },
};



