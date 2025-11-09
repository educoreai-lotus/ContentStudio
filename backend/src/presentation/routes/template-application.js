import express from 'express';
import { ApplyTemplateToLessonUseCase } from '../../application/use-cases/ApplyTemplateToLessonUseCase.js';
import { TemplateApplicationController } from '../controllers/TemplateApplicationController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repositories (PostgreSQL if connected, otherwise in-memory)
const templateRepository = await RepositoryFactory.getTemplateRepository();
const topicRepository = await RepositoryFactory.getTopicRepository();
const contentRepository = await RepositoryFactory.getContentRepository();

// Initialize use case
const applyTemplateToLessonUseCase = new ApplyTemplateToLessonUseCase({
  templateRepository,
  topicRepository,
  contentRepository,
});

// Initialize controller
const templateApplicationController = new TemplateApplicationController({
  applyTemplateToLessonUseCase,
});

/**
 * Apply template to lesson
 * POST /api/templates/:templateId/apply/:topicId
 *
 * Flow: Trainer creates content → selects template → sees lesson view
 */
router.post(
  '/templates/:templateId/apply/:topicId',
  (req, res, next) => templateApplicationController.applyTemplate(req, res, next)
);

/**
 * Get lesson view with applied template
 * GET /api/topics/:topicId/view
 */
router.get(
  '/topics/:topicId/view',
  (req, res, next) => templateApplicationController.getLessonView(req, res, next)
);

export default router;



