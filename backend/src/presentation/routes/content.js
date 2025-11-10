import express from 'express';
import { ContentController } from '../controllers/ContentController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { ContentVersionRepository } from '../../infrastructure/database/repositories/ContentVersionRepository.js';
import { CreateContentVersionUseCase } from '../../application/use-cases/CreateContentVersionUseCase.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

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

  const aiGenerationService = new AIGenerationService({
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.Gemini_API_Key,
    heygenApiKey: process.env.HEYGEN_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });

  contentController = new ContentController({
    contentRepository,
    qualityCheckService,
    aiGenerationService,
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

