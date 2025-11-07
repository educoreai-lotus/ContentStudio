import express from 'express';
import { SearchController } from '../controllers/SearchController.js';
import { SearchService } from '../../infrastructure/database/services/SearchService.js';
import { CourseRepository } from '../../infrastructure/database/repositories/CourseRepository.js';
import { TopicRepository } from '../../infrastructure/database/repositories/TopicRepository.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';

const router = express.Router();

// Initialize repositories
const courseRepository = new CourseRepository();
const topicRepository = new TopicRepository();
const contentRepository = new ContentRepository();

// Initialize search service
const searchService = new SearchService({
  courseRepository,
  topicRepository,
  contentRepository,
});

// Initialize controller
const searchController = new SearchController({ searchService });

// Routes
router.get('/', (req, res, next) => searchController.search(req, res, next));

export default router;



