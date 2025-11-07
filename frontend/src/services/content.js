import apiClient from './api.js';

/**
 * Content API Service
 */
export const contentService = {
  /**
   * Create new content
   * @param {Object} contentData - Content data
   * @returns {Promise<Object>} Created content
   */
  async create(contentData) {
    const response = await apiClient.post('/api/content', contentData);
    return response.data.data;
  },

  /**
   * Get content by ID
   * @param {number} contentId - Content ID
   * @returns {Promise<Object>} Content data
   */
  async getById(contentId) {
    const response = await apiClient.get(`/api/content/${contentId}`);
    return response.data.data;
  },

  /**
   * Get all content for a topic
   * @param {number} topicId - Topic ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Content list and pagination
   */
  async listByTopic(topicId, filters = {}) {
    const params = {
      topic_id: topicId,
      content_type_id: filters.content_type_id,
      generation_method_id: filters.generation_method_id,
    };

    const response = await apiClient.get('/api/content', { params });
    return response.data.data;
  },

  /**
   * Update content
   * @param {number} contentId - Content ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated content
   */
  async update(contentId, updateData) {
    const response = await apiClient.put(`/api/content/${contentId}`, updateData);
    return response.data.data;
  },

  /**
   * Delete content
   * @param {number} contentId - Content ID
   * @returns {Promise<void>}
   */
  async delete(contentId) {
    await apiClient.delete(`/api/content/${contentId}`);
  },
};



