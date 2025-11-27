import express from 'express';
import { AIGenerationController } from '../controllers/AIGenerationController.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';
import { PromptTemplateRepository } from '../../infrastructure/database/repositories/PromptTemplateRepository.js';
import { PromptTemplateService } from '../../infrastructure/services/PromptTemplateService.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { QualityCheckService } from '../../infrastructure/ai/QualityCheckService.js';

const router = express.Router();

// Initialize repositories and services
const contentRepository = new ContentRepository();
const promptTemplateRepository = new PromptTemplateRepository();
const promptTemplateService = new PromptTemplateService({
  promptTemplateRepository,
});

// Initialize AI services (use environment variables)
const openaiApiKey = process.env.OPENAI_API_KEY;
// Support multiple Gemini API key names (Railway uses Gemini_API_Key)
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key || process.env.GOOGLE_API_KEY;
const heygenApiKey = process.env.HEYGEN_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const aiGenerationService = new AIGenerationService({
  openaiApiKey,
  geminiApiKey,
  heygenApiKey,
  supabaseUrl,
  supabaseServiceKey,
  gammaApiKey: process.env.GAMMA_API,
});

// Initialize repositories and services asynchronously
let topicRepository = null;
let qualityCheckService = null;
let aiGenerationController = null;

const initServices = async () => {
  if (aiGenerationController) {
    return aiGenerationController; // Already initialized
  }

  try {
    topicRepository = await RepositoryFactory.getTopicRepository();
    const courseRepository = await RepositoryFactory.getCourseRepository();
    const qualityCheckRepository = await RepositoryFactory.getQualityCheckRepository();

    // Initialize QualityCheckService
    qualityCheckService = openaiApiKey
      ? new QualityCheckService({
          openaiApiKey,
          qualityCheckRepository,
          contentRepository,
          topicRepository,
          courseRepository,
        })
      : null;

    // Initialize controller
    aiGenerationController = new AIGenerationController({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
      topicRepository,
    });

    return aiGenerationController;
  } catch (error) {
    console.error('[AI Generation Routes] Failed to initialize services:', error);
    // Fallback: create controller without quality check service
    aiGenerationController = new AIGenerationController({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService: null,
      topicRepository: null,
    });
    return aiGenerationController;
  }
};

// Initialize services on module load
initServices().catch(err => {
  console.error('[AI Generation Routes] Error initializing services:', err);
});

// Routes - ensure services are initialized before handling requests
router.post('/generate', async (req, res, next) => {
  const controller = await initServices();
  return controller.generate(req, res, next);
});

router.post('/generate/text', async (req, res, next) => {
  const controller = await initServices();
  return controller.generateText(req, res, next);
});

router.post('/generate/code', async (req, res, next) => {
  const controller = await initServices();
  return controller.generateCode(req, res, next);
});

router.post('/generate/presentation', async (req, res, next) => {
  const controller = await initServices();
  return controller.generatePresentation(req, res, next);
});

router.post('/generate/audio', async (req, res, next) => {
  const controller = await initServices();
  return controller.generateAudio(req, res, next);
});

router.post('/generate/mind-map', async (req, res, next) => {
  const controller = await initServices();
  return controller.generateMindMap(req, res, next);
});

router.post('/generate/avatar-video', async (req, res, next) => {
  const controller = await initServices();
  return controller.generateAvatarVideo(req, res, next);
});

export default router;

