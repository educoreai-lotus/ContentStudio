/**
 * Search Content Use Case
 * Handles content search across courses, topics, and content items
 */
export class SearchContentUseCase {
  constructor({ searchService }) {
    this.searchService = searchService;
  }

  async execute(searchCriteria) {
    // Validate search criteria
    if (!searchCriteria.pagination) {
      throw new Error('Pagination is required');
    }

    if (!searchCriteria.pagination.page || !searchCriteria.pagination.limit) {
      throw new Error('Pagination page and limit are required');
    }

    // Normalize query (trim whitespace)
    const normalizedCriteria = {
      ...searchCriteria,
      query: searchCriteria.query?.trim() || '',
      filters: searchCriteria.filters || {},
      pagination: {
        page: parseInt(searchCriteria.pagination.page) || 1,
        limit: parseInt(searchCriteria.pagination.limit) || 10,
      },
    };

    // Execute search
    const results = await this.searchService.search(normalizedCriteria);

    return results;
  }
}



