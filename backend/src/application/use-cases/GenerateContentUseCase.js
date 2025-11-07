import { Content } from '../../domain/entities/Content.js';

/**
 * Generate Content Use Case
 * Handles AI-assisted content generation
 */
export class GenerateContentUseCase {
  constructor({
    contentRepository,
    aiGenerationService,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.contentRepository = contentRepository;
    this.aiGenerationService = aiGenerationService;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;
  }

  async execute(generationRequest) {
    // Validate input
    if (!generationRequest.topic_id) {
      throw new Error('topic_id is required');
    }

    if (!generationRequest.content_type_id) {
      throw new Error('content_type_id is required');
    }

    if (!generationRequest.prompt && !generationRequest.template_id) {
      throw new Error('Either prompt or template_id is required');
    }

    // Get or build prompt
    let prompt = generationRequest.prompt;
    if (generationRequest.template_id) {
      const template = await this.promptTemplateService.getTemplate(
        generationRequest.template_id
      );
      prompt = template.render(generationRequest.template_variables || {});
    }

    // Generate content based on type
    let contentData = {};
    try {
      switch (generationRequest.content_type_id) {
        case 'text':
          contentData = {
            text: await this.aiGenerationService.generateText(prompt, {
              style: generationRequest.style || 'educational',
              difficulty: generationRequest.difficulty || 'intermediate',
            }),
          };
          break;

        case 'code':
          contentData = {
            code: await this.aiGenerationService.generateCode(
              prompt,
              generationRequest.language || 'javascript',
              {
                include_comments: generationRequest.include_comments !== false,
              }
            ),
            language: generationRequest.language || 'javascript',
          };
          break;

        default:
          throw new Error(
            `AI generation not yet supported for type: ${generationRequest.content_type_id}`
          );
      }
    } catch (error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }

    // Create content entity
    const content = new Content({
      topic_id: generationRequest.topic_id,
      content_type_id: generationRequest.content_type_id,
      content_data: contentData,
      generation_method_id: 'ai_assisted',
    });

    // Save content
    const createdContent = await this.contentRepository.create(content);

    // Trigger quality check automatically
    if (createdContent.needsQualityCheck() && this.qualityCheckService) {
      try {
        await this.qualityCheckService.triggerQualityCheck(createdContent.content_id);
      } catch (error) {
        console.error('Failed to trigger quality check:', error);
      }
    }

    return createdContent;
  }
}



