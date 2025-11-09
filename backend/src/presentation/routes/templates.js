import express from 'express';
import { TemplateController } from '../controllers/TemplateController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

const router = express.Router();

// Initialize repositories (PostgreSQL if connected, otherwise in-memory)
const templateRepository = await RepositoryFactory.getTemplateRepository();
const topicRepository = await RepositoryFactory.getTopicRepository();

// Initialize AI services (reuse configuration from AI generation routes)
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey =
  process.env.GEMINI_API_KEY || process.env.Gemini_API_Key || process.env.GOOGLE_API_KEY;
const heygenApiKey = process.env.HEYGEN_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const aiGenerationService = new AIGenerationService({
  openaiApiKey,
  geminiApiKey,
  heygenApiKey,
  supabaseUrl,
  supabaseServiceKey,
});

// Initialize controller
const templateController = new TemplateController({
  templateRepository,
  topicRepository,
  aiGenerationService,
});

// Routes
router.post('/', (req, res, next) => templateController.create(req, res, next));
router.get('/', (req, res, next) => templateController.list(req, res, next));
router.post('/generate/ai', (req, res, next) => templateController.generateWithAI(req, res, next));
router.get('/:id', (req, res, next) => templateController.getById(req, res, next));
router.put('/:id', (req, res, next) => templateController.update(req, res, next));
router.delete('/:id', (req, res, next) => templateController.remove(req, res, next));

export default router;

