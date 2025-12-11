import { GenerateContentUseCase } from '../../application/use-cases/GenerateContentUseCase.js';
import { ContentDTO } from '../../application/dtos/ContentDTO.js';
import { logger } from '../../infrastructure/logging/Logger.js';

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
    topicRepository,
  }) {
    this.generateContentUseCase = new GenerateContentUseCase({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
      topicRepository,
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
      
      // Debug: Log content_data structure for avatar_video
      if (isAvatarVideo) {
        console.log('[AI Generation] Avatar video content_data check:', {
          hasStatus: 'status' in (content.content_data || {}),
          status: content.content_data?.status,
          hasVideoUrl: !!content.content_data?.videoUrl,
          hasError: !!content.content_data?.error,
          hasReason: !!content.content_data?.reason,
          contentDataKeys: content.content_data ? Object.keys(content.content_data) : [],
        });
      }
      
      // Check if avatar video was skipped (not failed)
      // CRITICAL: Check status first, then check videoUrl/error only if status is not 'skipped'
      const isSkipped = isAvatarVideo && content.content_data?.status === 'skipped';
      
      // Check if avatar video failed (not skipped)
      // IMPORTANT: For skipped status, isFailed must be false even if videoUrl is null
      // Also check reason field - if reason contains 'avatar_no_longer_available' or 'forced_avatar_unavailable', treat as skipped
      const hasSkippedReason = isAvatarVideo && (
        content.content_data?.reason === 'avatar_no_longer_available' ||
        content.content_data?.reason === 'forced_avatar_unavailable' ||
        content.content_data?.reason === 'avatar_not_configured' ||
        content.content_data?.reason === 'voice_not_available'
      );
      
      const isFailed = isAvatarVideo 
        ? (!isSkipped && !hasSkippedReason && (!content.content_data?.videoUrl || content.content_data?.error))
        : content.content_data?.status === 'failed';
      
      // If skipped (by status or reason), log and continue (don't return error)
      if (isSkipped || hasSkippedReason) {
        console.log('[AI Generation] Avatar video generation skipped:', content.content_data?.reason || 'forced_avatar_unavailable');
        // Continue normally - don't return error
      } else if (isFailed && isAvatarVideo) {
        // Only return error if actually failed (not skipped)
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

      // Determine actual status for logging
      let actualStatus = 'success';
      if (isAvatarVideo) {
        if (isSkipped || hasSkippedReason) {
          actualStatus = 'skipped';
        } else if (content.content_data?.videoUrl) {
          actualStatus = 'success';
        } else {
          actualStatus = 'failed';
        }
      } else {
        actualStatus = content.content_data?.status || 'success';
      }

      console.log('[AI Generation] Content generated successfully:', {
        hasContentData: !!content.content_data,
        contentType: content.content_type_id,
        topicId: content.topic_id,
        status: actualStatus,
      });

      const responseData = ContentDTO.toContentResponse(content);
      const isResponseAvatarVideo = responseData.content_type_id === 6;
      
      // Determine actual status for response logging
      let responseStatus = 'success';
      if (isResponseAvatarVideo) {
        if (isSkipped || hasSkippedReason) {
          responseStatus = 'skipped';
        } else if (responseData.content_data?.videoUrl) {
          responseStatus = 'success';
        } else {
          responseStatus = 'failed';
        }
      } else {
        responseStatus = responseData.content_data?.status || 'success';
      }
      
      console.log('[AI Generation] Response data prepared:', {
        hasContentData: !!responseData.content_data,
        contentDataKeys: responseData.content_data ? Object.keys(responseData.content_data) : [],
        status: responseStatus,
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

  /**
   * Generate avatar video - NEW WORKFLOW: Requires presentation first
   * Avatar videos can only be created from presentations now
   */
  async generateAvatarVideo(req, res, next) {
    try {
      const { topic_id, presentation_content_id } = req.body;

      // NEW WORKFLOW: Avatar video must be created from a presentation
      // Check if presentation_content_id is provided
      if (presentation_content_id) {
        // Use new workflow: generate from presentation
        return this.generateAvatarVideoFromPresentation(req, res, next);
      }

      // If no presentation_content_id, check if topic has a presentation
      if (topic_id) {
        const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
        const contentRepository = await RepositoryFactory.getContentRepository();
        
        logger.info('[AIGenerationController] Searching for presentation in topic', {
          topic_id: parseInt(topic_id),
        });
        
        // Find presentation content for this topic
        const allContent = await contentRepository.findByTopicId(parseInt(topic_id));
        
        logger.info('[AIGenerationController] Found content in topic', {
          topic_id: parseInt(topic_id),
          contentCount: allContent?.length || 0,
          contentTypes: allContent?.map(c => ({ 
            content_id: c.content_id, 
            content_type_id: c.content_type_id,
            hasFileUrl: !!(c.content_data?.fileUrl || c.content_data?.presentationUrl),
          })) || [],
        });
        
        const presentationContent = allContent?.find(c => c.content_type_id === 3); // presentation type
        
        if (presentationContent) {
          // Found presentation - use new workflow
          logger.info('[AIGenerationController] Found presentation, using it for avatar video', {
            presentation_content_id: presentationContent.content_id,
            topic_id: parseInt(topic_id),
            hasFileUrl: !!(presentationContent.content_data?.fileUrl || presentationContent.content_data?.presentationUrl),
          });
          
          req.body.presentation_content_id = presentationContent.content_id;
          return this.generateAvatarVideoFromPresentation(req, res, next);
        } else {
          // No presentation found - block creation
          logger.warn('[AIGenerationController] No presentation found in topic', {
            topic_id: parseInt(topic_id),
            availableContentTypes: allContent?.map(c => c.content_type_id) || [],
            totalContent: allContent?.length || 0,
          });
          
          return res.status(400).json({
            success: false,
            error: 'Avatar video can only be created from a presentation. Please create or upload a presentation first.',
            requires_presentation: true,
            availableContentTypes: allContent?.map(c => c.content_type_id) || [],
            totalContent: allContent?.length || 0,
          });
        }
      }

      // No topic_id and no presentation_content_id - block creation
      return res.status(400).json({
        success: false,
        error: 'Avatar video requires a presentation. Please provide presentation_content_id or topic_id with an existing presentation.',
        requires_presentation: true,
      });

    } catch (error) {
      logger.error('[AIGenerationController] Error in generateAvatarVideo', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * Generate avatar video from presentation
   * New workflow: presentation → extract text → OpenAI explanation → HeyGen video
   * 
   * POST /api/ai-generation/generate/avatar-video-from-presentation
   * Body: {
   *   presentation_content_id: number,
   *   custom_prompt?: string,
   *   avatar_id?: string,
   *   language?: string
   * }
   */
  async generateAvatarVideoFromPresentation(req, res, next) {
    try {
      const { presentation_content_id, custom_prompt, avatar_id, language } = req.body;

      if (!presentation_content_id) {
        return res.status(400).json({
          success: false,
          error: 'presentation_content_id is required',
        });
      }

      // Import dependencies
      const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
      const { GenerateAvatarVideoFromPresentationUseCase } = await import('../../application/use-cases/GenerateAvatarVideoFromPresentationUseCase.js');
      
      const contentRepository = await RepositoryFactory.getContentRepository();
      const topicRepository = await RepositoryFactory.getTopicRepository();
      const courseRepository = await RepositoryFactory.getCourseRepository();
      const heygenClient = this.generateContentUseCase.aiGenerationService.heygenClient;
      const openaiClient = this.generateContentUseCase.aiGenerationService.openaiClient;
      const qualityCheckService = this.generateContentUseCase.qualityCheckService;

      if (!heygenClient) {
        return res.status(503).json({
          success: false,
          error: 'HeyGen client not configured',
        });
      }

      if (!openaiClient) {
        return res.status(503).json({
          success: false,
          error: 'OpenAI client not configured',
        });
      }

      // Create use case instance with all required services (same as CreateContentUseCase)
      const useCase = new GenerateAvatarVideoFromPresentationUseCase({
        heygenClient,
        openaiClient,
        contentRepository,
        qualityCheckService, // For language and quality validation
        topicRepository,     // For getting topic language
        courseRepository,    // For quality check context
        language: language || 'en',
      });

      // Execute
      const result = await useCase.execute({
        presentation_content_id,
        custom_prompt,
        avatar_id,
        language: language || 'en',
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate avatar video',
          status: result.status,
        });
      }

      return res.json({
        success: true,
        data: {
          videoId: result.videoId,
          videoUrl: result.videoUrl,
          duration_seconds: result.duration_seconds,
          status: result.status,
          metadata: result.metadata,
        },
      });

    } catch (error) {
      logger.error('[AIGenerationController] Error generating avatar video from presentation', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
}



