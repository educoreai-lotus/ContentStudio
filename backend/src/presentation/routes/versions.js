import express from 'express';
import { ContentVersionController } from '../controllers/ContentVersionController.js';
import { ContentVersionRepository } from '../../infrastructure/database/repositories/ContentVersionRepository.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';

const router = express.Router();

// Initialize repositories
// Note: In production, these should be singletons or injected via DI
const contentVersionRepository = new ContentVersionRepository();
const contentRepository = new ContentRepository();

// Export for test access
export { contentRepository };

// Initialize controller
const contentVersionController = new ContentVersionController({
  contentVersionRepository,
  contentRepository,
});

// Routes
router.post(
  '/content/:contentId/versions',
  (req, res, next) => contentVersionController.create(req, res, next)
);
router.get(
  '/content/:contentId/versions',
  (req, res, next) => contentVersionController.list(req, res, next)
);
router.get(
  '/versions/:id',
  (req, res, next) => contentVersionController.getById(req, res, next)
);
router.post(
  '/versions/:id/restore',
  (req, res, next) => contentVersionController.restore(req, res, next)
);

export default router;

