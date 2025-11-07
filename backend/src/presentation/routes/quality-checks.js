import express from 'express';
import { QualityCheckController } from '../controllers/QualityCheckController.js';
import { QualityCheckService } from '../../infrastructure/ai/QualityCheckService.js';
import { QualityCheckRepository } from '../../infrastructure/database/repositories/QualityCheckRepository.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';

const router = express.Router();

// Initialize repositories
const qualityCheckRepository = new QualityCheckRepository();
const contentRepository = new ContentRepository();

// Initialize services
const openaiApiKey = process.env.OPENAI_API_KEY;
const qualityCheckService = new QualityCheckService({
  openaiApiKey,
  qualityCheckRepository,
  contentRepository,
});

// Initialize controller
const qualityCheckController = new QualityCheckController({
  qualityCheckService,
  qualityCheckRepository,
});

// Routes
router.post(
  '/content/:contentId/quality-check',
  (req, res, next) => qualityCheckController.trigger(req, res, next)
);
router.get(
  '/content/:contentId/quality-checks',
  (req, res, next) => qualityCheckController.getByContentId(req, res, next)
);
router.get('/:id', (req, res, next) => qualityCheckController.getById(req, res, next));

export default router;

