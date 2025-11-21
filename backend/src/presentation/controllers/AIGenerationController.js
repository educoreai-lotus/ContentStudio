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
      prompt: body.prompt || '', // ⚠️ CRITICAL: Trainer's exact prompt for avatar video
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
      
      // Check if content generation failed (especially for avatar_video)
      // For avatar_video, check if videoUrl is null/undefined or error exists (status removed)
      const isAvatarVideo = content.content_type_id === 6; // avatar_video
      const isFailed = isAvatarVideo 
        ? (!content.content_data?.videoUrl || content.content_data?.error)
        : content.content_data?.status === 'failed';
      
      if (isFailed && isAvatarVideo) {
        const errorMessage = content.content_data?.reason || 
                            content.content_data?.error || 
                            'Avatar video generation failed';
        const errorCode = content.content_data?.errorCode || 'AVATAR_GENERATION_FAILED';
        
        console.error('[AI Generation] Avatar video generation failed:', {
          contentType: content.content_type_id,
          topicId: content.topic_id,
          error: errorMessage,
          errorCode,
        });

        return res.status(400).json({
          success: false,
          error: errorMessage,
          errorCode,
          data: ContentDTO.toContentResponse(content),
          message: 'Avatar video generation failed',
        });
      }

      console.log('[AI Generation] Content generated successfully:', {
        hasContentData: !!content.content_data,
        contentType: content.content_type_id,
        topicId: content.topic_id,
        // Status removed for avatar_video - check videoUrl/error instead
        status: isAvatarVideo ? (content.content_data?.videoUrl ? 'success' : 'failed') : (content.content_data?.status || 'success'),
      });

      const responseData = ContentDTO.toContentResponse(content);
      const isResponseAvatarVideo = responseData.content_type_id === 6;
      console.log('[AI Generation] Response data prepared:', {
        hasContentData: !!responseData.content_data,
        contentDataKeys: responseData.content_data ? Object.keys(responseData.content_data) : [],
        // Status removed for avatar_video - check videoUrl/error instead
        status: isResponseAvatarVideo ? (responseData.content_data?.videoUrl ? 'success' : 'failed') : (responseData.content_data?.status || 'success'),
      });

      res.status(201).json({
        success: true,
        data: responseData,
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



