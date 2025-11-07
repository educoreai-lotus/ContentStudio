import { GenerateContentUseCase } from '../../application/use-cases/GenerateContentUseCase.js';
import { ContentDTO } from '../../application/dtos/ContentDTO.js';

/**
 * AI Generation Controller
 * Handles AI content generation requests
 */
export class AIGenerationController {
  constructor({
    contentRepository,
    aiGenerationService,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.generateContentUseCase = new GenerateContentUseCase({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
    });
  }

  validateBody(body) {
    const required = ['topic_id', 'lessonTopic', 'lessonDescription', 'language', 'skillsList'];
    const missing = required.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  buildGenerationRequest(req, contentType) {
    const body = req.body;
    const skillsList = Array.isArray(body.skillsList)
      ? body.skillsList
      : String(body.skillsList || '')
          .split(',')
          .map(skill => skill.trim())
          .filter(Boolean);

    return {
      topic_id: parseInt(body.topic_id),
      content_type_id: contentType || body.content_type_id,
      lessonTopic: body.lessonTopic,
      lessonDescription: body.lessonDescription,
      language: body.language,
      skillsList,
      style: body.style,
      difficulty: body.difficulty,
      programming_language: body.programming_language,
      voice: body.voice,
      slide_count: body.slide_count,
      audio_format: body.audio_format,
      tts_model: body.tts_model,
    };
  }

  async handleGeneration(req, res, next, contentTypeOverride) {
    try {
      this.validateBody(req.body);
      const generationRequest = this.buildGenerationRequest(req, contentTypeOverride);

      const content = await this.generateContentUseCase.execute(generationRequest);

      res.status(201).json({
        success: true,
        data: ContentDTO.toContentResponse(content),
        message: 'Content generated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async generate(req, res, next) {
    return this.handleGeneration(req, res, next);
  }

  async generateText(req, res, next) {
    return this.handleGeneration(req, res, next, 'text');
  }

  async generateCode(req, res, next) {
    return this.handleGeneration(req, res, next, 'code');
  }

  async generatePresentation(req, res, next) {
    return this.handleGeneration(req, res, next, 'presentation');
  }

  async generateAudio(req, res, next) {
    return this.handleGeneration(req, res, next, 'audio');
  }

  async generateMindMap(req, res, next) {
    return this.handleGeneration(req, res, next, 'mind_map');
  }

  async generateAvatarVideo(req, res, next) {
    return this.handleGeneration(req, res, next, 'avatar_video');
  }
}



