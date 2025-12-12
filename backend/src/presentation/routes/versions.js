import express from 'express';
import { ContentVersionController } from '../controllers/ContentVersionController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repositories asynchronously
let contentVersionRepository = null;
let contentRepository = null;
let contentVersionController = null;

const initServices = async () => {
  if (contentVersionController) {
    return contentVersionController; // Already initialized
  }

  try {
    contentVersionRepository = await RepositoryFactory.getContentVersionRepository();
    contentRepository = await RepositoryFactory.getContentRepository();

    // Initialize controller
    contentVersionController = new ContentVersionController({
      contentVersionRepository,
      contentRepository,
    });

    return contentVersionController;
  } catch (error) {
    console.error('[Versions Routes] Failed to initialize services:', error);
    throw error;
  }
};

// Export for test access (will be null until initServices is called)
export { contentRepository, contentVersionRepository };

// Routes - ensure services are initialized before handling requests
router.post(
  '/content/:contentId/versions',
  async (req, res, next) => {
    const controller = await initServices();
    return controller.create(req, res, next);
  }
);
router.get(
  '/content/:contentId/versions',
  async (req, res, next) => {
    const controller = await initServices();
    return controller.list(req, res, next);
  }
);
router.get(
  '/versions/:id',
  async (req, res, next) => {
    const controller = await initServices();
    return controller.getById(req, res, next);
  }
);
router.post(
  '/versions/:id/restore',
  async (req, res, next) => {
    const controller = await initServices();
    return controller.restore(req, res, next);
  }
);

export default router;

