import apiClient from './api.js';

/**
 * Topic API Service
 */
export const topicsService = {
  /**
   * Create a new topic
   * @param {Object} topicData - Topic data
   * @returns {Promise<Object>} Created topic
   */
  async create(topicData) {
    const response = await apiClient.post('/api/topics', topicData);
    return response.data;
  },

  async suggestSkills({ topic_name, trainer_id }) {
    const response = await apiClient.post('/api/topics/suggest-skills', {
      topic_name,
      trainer_id,
    });
    return response.data;
  },

  /**
   * Get all topics for a trainer
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Topics and pagination info
   */
  async list(filters = {}, pagination = {}) {
    const params = {
      trainer_id: filters.trainer_id,
      status: filters.status,
      course_id: filters.course_id === null || filters.course_id === undefined ? 'null' : filters.course_id,
      search: filters.search,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    };

    // Remove undefined values to avoid sending them in query params
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    const response = await apiClient.get('/api/topics', { params });
    return response.data;
  },

  /**
   * Get topic by ID
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Topic data
   */
  async getById(topicId) {
    const response = await apiClient.get(`/api/topics/${topicId}`);
    return response.data;
  },

  /**
   * Update topic
   * @param {number} topicId - Topic ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated topic
   */
  async update(topicId, updateData) {
    const response = await apiClient.put(`/api/topics/${topicId}`, updateData);
    return response.data;
  },

  /**
   * Soft delete topic
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Delete result
   */
  async delete(topicId) {
    const response = await apiClient.delete(`/api/topics/${topicId}`);
    return response.data;
  },

  /**
   * Validate format requirements
   * @param {number} topicId - Topic ID
   * @param {Array} contentItems - Content items array
   * @returns {Promise<Object>} Validation result
   */
  async validateFormatRequirements(topicId, contentItems) {
    const response = await apiClient.post(`/api/topics/${topicId}/validate-formats`, {
      content_items: contentItems,
    });
    return response.data;
  },

  /**
   * Apply a template to a topic
   * @param {number} topicId
   * @param {number} templateId
   * @returns {Promise<Object>}
   */
  async applyTemplate(topicId, templateId) {
    const response = await apiClient.post(`/api/topics/${topicId}/apply-template`, {
      template_id: templateId,
    });
    return response.data;
  },

  /**
   * Publish standalone topic (save and finish lesson)
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Publish result
   */
  async publishStandalone(topicId) {
    const response = await apiClient.post(`/api/topics/${topicId}/publish-standalone`);
    return response.data;
  },
};


