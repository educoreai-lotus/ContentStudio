import express from 'express';
import { ContentController } from '../controllers/ContentController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { ContentVersionRepository } from '../../infrastructure/database/repositories/ContentVersionRepository.js';
import { CreateContentVersionUseCase } from '../../application/use-cases/CreateContentVersionUseCase.js';

const router = express.Router();

// Initialize repositories asynchronously
let contentController;

(async () => {
  // Initialize repositories (PostgreSQL if connected, otherwise in-memory)
  const contentRepository = await RepositoryFactory.getContentRepository();
  const contentVersionRepository = new ContentVersionRepository();

  // Initialize use cases
  const createContentVersionUseCase = new CreateContentVersionUseCase({
    contentVersionRepository,
  });

  // TODO: Initialize quality check service
  const qualityCheckService = null; // Will be implemented later

  contentController = new ContentController({
    contentRepository,
    qualityCheckService,
    contentVersionRepository,
    createContentVersionUseCase,
  });
})();

// Routes - with async initialization check
router.post('/', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.create(req, res, next);
});

router.post('/approve', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.approve(req, res, next);
});

router.get('/', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.list(req, res, next);
});

router.get('/:id', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.getById(req, res, next);
});

router.put('/:id', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.update(req, res, next);
});

router.delete('/:id', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.remove(req, res, next);
});

export default router;

