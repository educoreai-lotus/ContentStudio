import { describe, it, expect, jest } from '@jest/globals';
import { SearchContentUseCase } from '../../../../src/application/use-cases/SearchContentUseCase.js';

describe('SearchContentUseCase', () => {
  let searchService;
  let useCase;

  beforeEach(() => {
    searchService = {
      search: jest.fn(),
    };

    useCase = new SearchContentUseCase({ searchService });
  });

  describe('execute', () => {
    it('should search content with query', async () => {
      const searchCriteria = {
        query: 'javascript',
        filters: {},
        pagination: { page: 1, limit: 10 },
      };

      const mockResults = {
        results: [
          { id: 1, title: 'JavaScript Basics', type: 'text' },
          { id: 2, title: 'JavaScript Advanced', type: 'code' },
        ],
        total: 2,
        page: 1,
        limit: 10,
        total_pages: 1,
      };

      searchService.search.mockResolvedValue(mockResults);

      const result = await useCase.execute(searchCriteria);

      expect(result).toEqual(mockResults);
      expect(searchService.search).toHaveBeenCalledWith(searchCriteria);
    });

    it('should search with filters', async () => {
      const searchCriteria = {
        query: 'lesson',
        filters: {
          content_type_id: 'text',
          generation_method_id: 'manual',
          status: 'active',
        },
        pagination: { page: 1, limit: 10 },
      };

      const mockResults = {
        results: [{ id: 1, title: 'Lesson 1', type: 'text' }],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
      };

      searchService.search.mockResolvedValue(mockResults);

      const result = await useCase.execute(searchCriteria);

      expect(result).toEqual(mockResults);
      expect(searchService.search).toHaveBeenCalledWith(searchCriteria);
    });

    it('should handle pagination', async () => {
      const searchCriteria = {
        query: 'test',
        filters: {},
        pagination: { page: 2, limit: 5 },
      };

      const mockResults = {
        results: [{ id: 6, title: 'Test 6' }],
        total: 10,
        page: 2,
        limit: 5,
        total_pages: 2,
      };

      searchService.search.mockResolvedValue(mockResults);

      const result = await useCase.execute(searchCriteria);

      expect(result.total_pages).toBe(2);
      expect(result.page).toBe(2);
    });

    it('should handle empty query', async () => {
      const searchCriteria = {
        query: '',
        filters: { status: 'active' },
        pagination: { page: 1, limit: 10 },
      };

      const mockResults = {
        results: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 0,
      };

      searchService.search.mockResolvedValue(mockResults);

      const result = await useCase.execute(searchCriteria);

      expect(result.results).toEqual([]);
    });

    it('should validate search criteria', async () => {
      const invalidCriteria = {
        query: 'test',
        filters: {},
        // missing pagination
      };

      await expect(useCase.execute(invalidCriteria)).rejects.toThrow();
    });

    it('should handle search service errors', async () => {
      const searchCriteria = {
        query: 'test',
        filters: {},
        pagination: { page: 1, limit: 10 },
      };

      searchService.search.mockRejectedValue(new Error('Search service error'));

      await expect(useCase.execute(searchCriteria)).rejects.toThrow(
        'Search service error'
      );
    });
  });
});



