import express from 'express';
import { QualityCheckController } from '../controllers/QualityCheckController.js';
import { QualityCheckService } from '../../infrastructure/ai/QualityCheckService.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repositories and services asynchronously
let qualityCheckController;

(async () => {
  const qualityCheckRepository = await RepositoryFactory.getQualityCheckRepository();
  const contentRepository = await RepositoryFactory.getContentRepository();
  const topicRepository = await RepositoryFactory.getTopicRepository();
  const courseRepository = await RepositoryFactory.getCourseRepository();

  // Initialize services
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const qualityCheckService = new QualityCheckService({
    openaiApiKey,
    qualityCheckRepository,
    contentRepository,
    topicRepository,
    courseRepository,
  });

  // Initialize controller
  qualityCheckController = new QualityCheckController({
    qualityCheckService,
    qualityCheckRepository,
  });
})();

// Routes - with async initialization check
router.post(
  '/content/:contentId/quality-check',
  async (req, res, next) => {
    if (!qualityCheckController) {
      return res.status(503).json({ error: 'Service initializing, please try again' });
    }
    return qualityCheckController.trigger(req, res, next);
  }
);
router.get(
  '/content/:contentId/quality-checks',
  async (req, res, next) => {
    if (!qualityCheckController) {
      return res.status(503).json({ error: 'Service initializing, please try again' });
    }
    return qualityCheckController.getByContentId(req, res, next);
  }
);
router.get('/:id', async (req, res, next) => {
  if (!qualityCheckController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return qualityCheckController.getById(req, res, next);
});

export default router;

