import express from 'express';
import { SearchController } from '../controllers/SearchController.js';
import { SearchService } from '../../infrastructure/database/services/SearchService.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repositories and services asynchronously
let courseRepository = null;
let topicRepository = null;
let contentRepository = null;
let searchService = null;
let searchController = null;

const initServices = async () => {
  if (searchController) {
    return searchController; // Already initialized
  }

  try {
    courseRepository = await RepositoryFactory.getCourseRepository();
    topicRepository = await RepositoryFactory.getTopicRepository();
    contentRepository = await RepositoryFactory.getContentRepository();

    // Initialize search service
    searchService = new SearchService({
      courseRepository,
      topicRepository,
      contentRepository,
    });

    // Initialize controller
    searchController = new SearchController({ searchService });

    return searchController;
  } catch (error) {
    console.error('[Search Routes] Failed to initialize services:', error);
    throw error;
  }
};

// Routes - ensure services are initialized before handling requests
router.get('/', async (req, res, next) => {
  const controller = await initServices();
  return controller.search(req, res, next);
});

export default router;



