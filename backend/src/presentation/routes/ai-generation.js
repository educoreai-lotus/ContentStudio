import express from 'express';
import { AIGenerationController } from '../controllers/AIGenerationController.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';
import { PromptTemplateRepository } from '../../infrastructure/database/repositories/PromptTemplateRepository.js';
import { PromptTemplateService } from '../../infrastructure/services/PromptTemplateService.js';

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
});

// TODO: Initialize quality check service
const qualityCheckService = null;

// Initialize controller
const aiGenerationController = new AIGenerationController({
  contentRepository,
  aiGenerationService,
  promptTemplateService,
  qualityCheckService,
});

// Routes
router.post('/generate', (req, res, next) =>
  aiGenerationController.generate(req, res, next)
);

router.post('/generate/text', (req, res, next) =>
  aiGenerationController.generateText(req, res, next)
);

router.post('/generate/code', (req, res, next) =>
  aiGenerationController.generateCode(req, res, next)
);

router.post('/generate/presentation', (req, res, next) =>
  aiGenerationController.generatePresentation(req, res, next)
);

router.post('/generate/audio', (req, res, next) =>
  aiGenerationController.generateAudio(req, res, next)
);

router.post('/generate/mind-map', (req, res, next) =>
  aiGenerationController.generateMindMap(req, res, next)
);

router.post('/generate/avatar-video', (req, res, next) =>
  aiGenerationController.generateAvatarVideo(req, res, next)
);

export default router;

