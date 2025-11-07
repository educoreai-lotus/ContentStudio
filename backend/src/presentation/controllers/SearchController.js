import { SearchContentUseCase } from '../../application/use-cases/SearchContentUseCase.js';

/**
 * Search Controller
 * Handles search and filtering requests
 */
export class SearchController {
  constructor({ searchService }) {
    this.searchContentUseCase = new SearchContentUseCase({ searchService });
  }

  /**
   * Search content
   * GET /api/search
   */
  async search(req, res, next) {
    try {
      const searchCriteria = {
        query: req.query.q || req.query.query || '',
        filters: {
          type: req.query.type, // 'course', 'topic', 'content', or undefined for all
          trainer_id: req.query.trainer_id,
          course_id: req.query.course_id ? parseInt(req.query.course_id) : undefined,
          topic_id: req.query.topic_id ? parseInt(req.query.topic_id) : undefined,
          status: req.query.status,
          content_type_id: req.query.content_type_id,
          generation_method_id: req.query.generation_method_id,
        },
        pagination: {
          page: req.query.page ? parseInt(req.query.page) : 1,
          limit: req.query.limit ? parseInt(req.query.limit) : 10,
        },
      };

      // Remove undefined filters
      Object.keys(searchCriteria.filters).forEach(key => {
        if (searchCriteria.filters[key] === undefined) {
          delete searchCriteria.filters[key];
        }
      });

      const results = await this.searchContentUseCase.execute(searchCriteria);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

