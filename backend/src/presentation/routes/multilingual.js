import express from 'express';
import { MultilingualContentController } from '../controllers/MultilingualContentController.js';
import { GetLessonByLanguageUseCase } from '../../application/use-cases/GetLessonByLanguageUseCase.js';
import { LanguageStatsRepository } from '../../infrastructure/database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../../infrastructure/storage/SupabaseStorageClient.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { AITranslationService } from '../../infrastructure/ai/AITranslationService.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

const router = express.Router();

// Initialize services
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const languageStatsRepository = new LanguageStatsRepository();
const supabaseStorageClient = new SupabaseStorageClient({
  supabaseUrl,
  supabaseKey,
});

const contentRepository = RepositoryFactory.getContentRepository();
const topicRepository = RepositoryFactory.getTopicRepository();

const translationService = new AITranslationService({
  openaiApiKey,
  geminiApiKey,
  preferredProvider: 'openai',
});

const aiGenerationService = new AIGenerationService({
  openaiApiKey,
  geminiApiKey,
});

const getLessonByLanguageUseCase = new GetLessonByLanguageUseCase({
  languageStatsRepository,
  supabaseStorageClient,
  contentRepository,
  topicRepository,
  translationService,
  aiGenerationService,
});

const multilingualContentController = new MultilingualContentController({
  getLessonByLanguageUseCase,
});

// Routes
router.post(
  '/lesson',
  (req, res, next) => multilingualContentController.getLessonContent(req, res, next)
);

// Stats routes moved to multilingual-stats.js

export default router;

