import express from 'express';
import { VideoToLessonController } from '../controllers/VideoToLessonController.js';
import { VideoToLessonUseCase } from '../../application/use-cases/VideoToLessonUseCase.js';
import { VideoTranscriptionService } from '../../infrastructure/ai/VideoTranscriptionService.js';
import { WhisperClient } from '../../infrastructure/external-apis/openai/WhisperClient.js';
import { OpenAIClient } from '../../infrastructure/external-apis/openai/OpenAIClient.js';
import { GeminiClient } from '../../infrastructure/external-apis/gemini/GeminiClient.js';
import { TTSClient } from '../../infrastructure/external-apis/openai/TTSClient.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';
import { TopicRepository } from '../../infrastructure/database/repositories/TopicRepository.js';
import { ContentRepository } from '../../infrastructure/database/repositories/ContentRepository.js';

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

// Initialize repositories
const topicRepository = new TopicRepository(null);
const contentRepository = new ContentRepository();

// Initialize use case
const videoToLessonUseCase = new VideoToLessonUseCase({
  whisperClient,
  openaiClient,
  geminiClient,
  ttsClient,
  topicRepository,
  contentRepository,
  aiGenerationService,
});

// Initialize video transcription service
const videoTranscriptionService = openaiApiKey
  ? new VideoTranscriptionService({ openaiApiKey })
  : null;

// Initialize controller
const videoToLessonController = new VideoToLessonController({
  videoToLessonUseCase,
  videoTranscriptionService,
});

// Routes
router.post(
  '/',
  videoToLessonController.getUploadMiddleware(),
  (req, res, next) => videoToLessonController.transform(req, res, next)
);

// New transcription endpoint
router.post(
  '/transcribe',
  videoToLessonController.getUploadMiddleware(),
  (req, res, next) => videoToLessonController.transcribe(req, res, next)
);

export default router;



