import apiClient from './api.js';

/**
 * Course API Service
 */
export const coursesService = {
  /**
   * Create a new course
   * @param {Object} courseData - Course data
   * @returns {Promise<Object>} Created course
   */
  async create(courseData) {
    const response = await apiClient.post('/api/courses', courseData);
    return response.data;
  },

  /**
   * Get all courses for a trainer
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Courses and pagination info
   */
  async list(filters = {}, pagination = {}) {
    const params = {
      trainer_id: filters.trainer_id,
      status: filters.status,
      search: filters.search,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    };

    const response = await apiClient.get('/api/courses', { params });
    return response.data;
  },

  /**
   * Get course by ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Course data
   */
  async getById(courseId) {
    const response = await apiClient.get(`/api/courses/${courseId}`);
    return response.data;
  },

  /**
   * Update course
   * @param {number} courseId - Course ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated course
   */
  async update(courseId, updateData) {
    const response = await apiClient.put(`/api/courses/${courseId}`, updateData);
    return response.data;
  },

  /**
   * Soft delete course
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Delete result
   */
  async delete(courseId) {
    const response = await apiClient.delete(`/api/courses/${courseId}`);
    return response.data;
  },
};


