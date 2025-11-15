import express from 'express';
import { VideoToLessonController } from '../controllers/VideoToLessonController.js';
import { VideoToLessonUseCase } from '../../application/use-cases/VideoToLessonUseCase.js';
import { VideoTranscriptionService } from '../../infrastructure/ai/VideoTranscriptionService.js';
import { WhisperClient } from '../../infrastructure/external-apis/openai/WhisperClient.js';
import { OpenAIClient } from '../../infrastructure/external-apis/openai/OpenAIClient.js';
import { GeminiClient } from '../../infrastructure/external-apis/gemini/GeminiClient.js';
import { TTSClient } from '../../infrastructure/external-apis/openai/TTSClient.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { ContentGenerationOrchestrator } from '../../application/services/ContentGenerationOrchestrator.js';
import { PromptTemplateService } from '../../infrastructure/services/PromptTemplateService.js';
import { PromptTemplateRepository } from '../../infrastructure/database/repositories/PromptTemplateRepository.js';
import { QualityCheckService } from '../../infrastructure/ai/QualityCheckService.js';

const router = express.Router();

// Initialize clients
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key || process.env.GOOGLE_API_KEY;

const whisperClient = openaiApiKey ? new WhisperClient({ apiKey: openaiApiKey }) : null;
const openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
const geminiClient = geminiApiKey ? new GeminiClient({ apiKey: geminiApiKey }) : null;
const ttsClient = openaiApiKey ? new TTSClient({ apiKey: openaiApiKey }) : null;

const aiGenerationService = new AIGenerationService({
  openaiApiKey,
  geminiApiKey,
  heygenApiKey: process.env.HEYGEN_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
});

// Initialize repositories and services
let topicRepository = null;
let contentRepository = null;
let videoToLessonUseCase = null;
let videoTranscriptionService = null;
let contentGenerationOrchestrator = null;
let videoToLessonController = null;
let promptTemplateService = null;
let qualityCheckService = null;

// Initialize repositories and services asynchronously
const initServices = async () => {
  if (videoToLessonController) {
    return videoToLessonController; // Already initialized
  }

  try {
    topicRepository = await RepositoryFactory.getTopicRepository();
    contentRepository = await RepositoryFactory.getContentRepository();
    const courseRepository = await RepositoryFactory.getCourseRepository();
    const qualityCheckRepository = await RepositoryFactory.getQualityCheckRepository();

    // Initialize PromptTemplateService
    const promptTemplateRepository = new PromptTemplateRepository();
    promptTemplateService = new PromptTemplateService({
      promptTemplateRepository,
    });

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

    // Initialize use case
    videoToLessonUseCase = new VideoToLessonUseCase({
      whisperClient,
      openaiClient,
      geminiClient,
      ttsClient,
      topicRepository,
      contentRepository,
      aiGenerationService,
    });

    // Initialize video transcription service
    videoTranscriptionService = openaiApiKey
      ? new VideoTranscriptionService({ openaiApiKey })
      : null;

    // Initialize Content Generation Orchestrator
    contentGenerationOrchestrator = openaiApiKey
      ? new ContentGenerationOrchestrator({
          aiGenerationService,
          openaiClient,
          contentRepository,
          topicRepository,
          promptTemplateService,
          qualityCheckService,
        })
      : null;

    // Initialize controller
    videoToLessonController = new VideoToLessonController({
      videoToLessonUseCase,
      videoTranscriptionService,
      contentGenerationOrchestrator,
    });

    return videoToLessonController;
  } catch (error) {
    console.error('[video-to-lesson] Failed to initialize repositories:', error);
    throw error;
  }
};

// Initialize immediately
initServices().catch(err => {
  console.error('[video-to-lesson] Initialization error:', err);
});

// Middleware to ensure controller is initialized
const ensureController = async (req, res, next) => {
  try {
    const controller = await initServices();
    req.videoToLessonController = controller;
    next();
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service is initializing. Please try again in a moment.',
    });
  }
};

// Routes
router.post(
  '/',
  ensureController,
  (req, res, next) => {
    req.videoToLessonController.getUploadMiddleware()(req, res, (err) => {
      if (err) return next(err);
      return req.videoToLessonController.transform(req, res, next);
    });
  }
);

// New transcription endpoint with automatic content generation
router.post(
  '/transcribe',
  ensureController,
  (req, res, next) => {
    req.videoToLessonController.getUploadMiddleware()(req, res, (err) => {
      if (err) return next(err);
      return req.videoToLessonController.transcribe(req, res, next);
    });
  }
);

export default router;



