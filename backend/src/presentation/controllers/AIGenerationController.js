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

  validateBody(body, contentTypeOverride) {
    if (!body.topic_id) {
      throw new Error('Missing required fields: topic_id');
    }

    if (!body.content_type_id && !contentTypeOverride) {
      throw new Error('Missing required fields: content_type_id');
    }

    const lessonFields = ['lessonTopic', 'lessonDescription', 'language', 'skillsList'];
    const missingLessonFields = lessonFields.filter(
      field => body[field] === undefined || body[field] === null || body[field] === ''
    );

    if (missingLessonFields.length > 0 && !body.prompt) {
      throw new Error(`Missing required fields: ${missingLessonFields.join(', ')}`);
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

    const fallbackTopic = body.prompt
      ? body.prompt.split('\n').find(Boolean)?.slice(0, 80)
      : undefined;
    const lessonTopic = body.lessonTopic || fallbackTopic || 'Untitled Lesson';
    const lessonDescription =
      body.lessonDescription || 'Auto-generated description derived from prompt.';
    const language = body.language || 'English';
    const normalizedSkills = skillsList.length > 0 ? skillsList : ['General Learning'];

    return {
      topic_id: parseInt(body.topic_id),
      content_type_id: contentType || body.content_type_id,
      lessonTopic,
      lessonDescription,
      language,
      skillsList: normalizedSkills,
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
      this.validateBody(req.body, contentTypeOverride);
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



