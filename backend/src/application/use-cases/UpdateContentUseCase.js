import { Content } from '../../domain/entities/Content.js';

/**
 * Update Content Use Case
 * Updates content and automatically creates a version
 */
export class UpdateContentUseCase {
  constructor({
    contentRepository,
    contentVersionRepository,
    createContentVersionUseCase,
  }) {
    this.contentRepository = contentRepository;
    this.contentVersionRepository = contentVersionRepository;
    this.createContentVersionUseCase = createContentVersionUseCase;
  }

  async execute(contentId, updates, updatedBy) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    // Get existing content
    const existingContent = await this.contentRepository.findById(contentId);
    if (!existingContent) {
      throw new Error('Content not found');
    }

    // Create version from current content before updating
    if (updates.content_data && this.hasContentChanged(existingContent.content_data, updates.content_data)) {
      try {
        await this.createContentVersionUseCase.execute(
          contentId,
          existingContent.content_data,
          updatedBy || existingContent.created_by,
          'Auto-version before update'
        );
      } catch (error) {
        // Log but don't fail the update if versioning fails
        console.error('Failed to create version before update:', error);
      }
    }

    // Update content
    const updatedContent = await this.contentRepository.update(contentId, updates);

    return updatedContent;
  }

  /**
   * Check if content data has actually changed
   * @param {Object|string} oldData - Old content data
   * @param {Object|string} newData - New content data
   * @returns {boolean} True if content changed
   */
  hasContentChanged(oldData, newData) {
    const oldStr = typeof oldData === 'string' ? oldData : JSON.stringify(oldData);
    const newStr = typeof newData === 'string' ? newData : JSON.stringify(newData);
    return oldStr !== newStr;
  }
}



