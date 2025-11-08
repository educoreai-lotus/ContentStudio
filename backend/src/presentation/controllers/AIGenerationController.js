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

    // Lesson fields will be fetched from topic if missing, so we don't validate them here
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
      console.log('[AI Generation] Starting generation:', {
        topic_id: req.body.topic_id,
        content_type: contentTypeOverride || req.body.content_type_id,
      });
      
      this.validateBody(req.body, contentTypeOverride);
      
      // If lesson fields are missing, fetch them from the topic
      if (!req.body.lessonTopic || !req.body.lessonDescription || !req.body.skillsList) {
        console.log('[AI Generation] Fetching topic data for topic_id:', req.body.topic_id);
        const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
        const topicRepository = await RepositoryFactory.getTopicRepository();
        const topic = await topicRepository.findById(parseInt(req.body.topic_id));
        
        if (topic) {
          console.log('[AI Generation] Topic found:', topic.topic_name);
          req.body.lessonTopic = req.body.lessonTopic || topic.topic_name;
          req.body.lessonDescription = req.body.lessonDescription || topic.description;
          req.body.skillsList = req.body.skillsList || topic.skills || [];
          req.body.language = req.body.language || topic.language || 'English';
        } else {
          console.warn('[AI Generation] Topic not found for id:', req.body.topic_id);
        }
      }
      
      const generationRequest = this.buildGenerationRequest(req, contentTypeOverride);
      console.log('[AI Generation] Generation request built:', {
        topic_id: generationRequest.topic_id,
        content_type_id: generationRequest.content_type_id,
        lessonTopic: generationRequest.lessonTopic,
      });

      const content = await this.generateContentUseCase.execute(generationRequest);
      console.log('[AI Generation] Content generated successfully:', content.content_id);

      res.status(201).json({
        success: true,
        data: ContentDTO.toContentResponse(content),
        message: 'Content generated successfully',
      });
    } catch (error) {
      console.error('[AI Generation] Error:', error.message, error.stack);
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



