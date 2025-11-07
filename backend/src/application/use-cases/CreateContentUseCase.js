import { Content } from '../../domain/entities/Content.js';

/**
 * Create Content Use Case
 * Handles manual content creation with automatic quality check trigger
 */
export class CreateContentUseCase {
  constructor({ contentRepository, qualityCheckService }) {
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
  }

  async execute(contentData) {
    // Validate input
    if (!contentData.topic_id) {
      throw new Error('topic_id is required');
    }

    if (!contentData.content_type_id) {
      throw new Error('content_type_id is required');
    }

    if (!contentData.content_data) {
      throw new Error('content_data is required');
    }

    // Set generation method to manual for manual creation
    const content = new Content({
      ...contentData,
      generation_method_id: contentData.generation_method_id || 'manual',
    });

    // Save content to repository
    const createdContent = await this.contentRepository.create(content);

    // Trigger quality check automatically for manual content
    if (createdContent.needsQualityCheck() && this.qualityCheckService) {
      try {
        await this.qualityCheckService.triggerQualityCheck(createdContent.content_id);
      } catch (error) {
        // Log error but don't fail the creation
        console.error('Failed to trigger quality check:', error);
      }
    }

    return createdContent;
  }
}



