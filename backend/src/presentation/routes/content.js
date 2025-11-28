import express from 'express';
import { ContentController } from '../controllers/ContentController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { ContentHistoryService } from '../../application/services/ContentHistoryService.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

const router = express.Router();

// Initialize repositories asynchronously
let contentController;

(async () => {
  // Initialize repositories (PostgreSQL if connected, otherwise in-memory)
  const contentRepository = await RepositoryFactory.getContentRepository();
  const contentVersionRepository = await RepositoryFactory.getContentVersionRepository();

  // Initialize use cases
  const contentHistoryService = new ContentHistoryService({
    contentRepository,
    contentHistoryRepository: contentVersionRepository,
  });

  // Initialize quality check service (only for manual content)
  const qualityCheckRepository = await RepositoryFactory.getQualityCheckRepository();
  const topicRepository = await RepositoryFactory.getTopicRepository();
  const courseRepository = await RepositoryFactory.getCourseRepository();
  
  const { QualityCheckService } = await import('../../infrastructure/ai/QualityCheckService.js');
  const qualityCheckService = new QualityCheckService({
    openaiApiKey: process.env.OPENAI_API_KEY,
    qualityCheckRepository,
    contentRepository,
    topicRepository,
    courseRepository,
  });

  const aiGenerationService = new AIGenerationService({
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.Gemini_API_Key,
    heygenApiKey: process.env.HEYGEN_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    gammaApiKey: process.env.GAMMA_API,
  });

  const { PromptTemplateService } = await import('../../infrastructure/services/PromptTemplateService.js');
  const promptTemplateService = new PromptTemplateService({
    templateRepository: await RepositoryFactory.getTemplateRepository(),
  });

  contentController = new ContentController({
    contentRepository,
    qualityCheckService,
    aiGenerationService,
    contentHistoryService,
    promptTemplateService,
    topicRepository,
    courseRepository,
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

router.get('/topic/:topicId/history', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.topicHistory(req, res, next);
});

router.get('/:id/history', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.history(req, res, next);
});

router.post('/history/:historyId/restore', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.restoreHistory(req, res, next);
});

router.delete('/history/:historyId', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.deleteHistory(req, res, next);
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

router.post('/:id/regenerate', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.regenerate(req, res, next);
});

router.delete('/:id', async (req, res, next) => {
  if (!contentController) {
    return res.status(503).json({ error: 'Service initializing, please try again' });
  }
  return contentController.remove(req, res, next);
});

export default router;

