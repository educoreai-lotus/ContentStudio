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

  /**
   * Generate content using AI
   * POST /api/content/ai-generate
   */
  async generate(req, res, next) {
    try {
      const generationRequest = {
        topic_id: parseInt(req.body.topic_id),
        content_type_id: req.body.content_type_id,
        prompt: req.body.prompt,
        template_id: req.body.template_id ? parseInt(req.body.template_id) : undefined,
        template_variables: req.body.template_variables || {},
        language: req.body.language,
        style: req.body.style,
        difficulty: req.body.difficulty,
        include_comments: req.body.include_comments,
      };

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
}



