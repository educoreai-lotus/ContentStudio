/**
 * Search Service Interface
 * Defines contract for content search functionality
 */
export class SearchService {
  /**
   * Search content across courses, topics, and content items
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.query - Search query
   * @param {Object} criteria.filters - Filter options
   * @param {Object} criteria.pagination - Pagination options
   * @returns {Promise<Object>} Search results with pagination
   */
  async search(criteria) {
    throw new Error('SearchService.search() must be implemented');
  }
}



