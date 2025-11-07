import apiClient from './api.js';

/**
 * Search API Service
 */
export const searchService = {
  /**
   * Search content across courses, topics, and content items
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.q - Search query
   * @param {Object} searchParams.filters - Filter options
   * @param {Object} searchParams.pagination - Pagination options
   * @returns {Promise<Object>} Search results
   */
  async search(searchParams) {
    const params = {
      q: searchParams.q || searchParams.query || '',
      page: searchParams.pagination?.page || 1,
      limit: searchParams.pagination?.limit || 10,
    };

    // Add filters
    if (searchParams.filters) {
      if (searchParams.filters.type) params.type = searchParams.filters.type;
      if (searchParams.filters.trainer_id) params.trainer_id = searchParams.filters.trainer_id;
      if (searchParams.filters.course_id) params.course_id = searchParams.filters.course_id;
      if (searchParams.filters.topic_id) params.topic_id = searchParams.filters.topic_id;
      if (searchParams.filters.status) params.status = searchParams.filters.status;
      if (searchParams.filters.content_type_id) params.content_type_id = searchParams.filters.content_type_id;
      if (searchParams.filters.generation_method_id) params.generation_method_id = searchParams.filters.generation_method_id;
    }

    const response = await apiClient.get('/api/search', { params });
    return response.data.data;
  },
};



