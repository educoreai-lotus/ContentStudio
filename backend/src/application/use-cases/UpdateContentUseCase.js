import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';

/**
 * Update Content Use Case
 * Updates content and automatically creates a version
 */
export class UpdateContentUseCase {
  constructor({
    contentRepository,
    contentHistoryService,
  }) {
    this.contentRepository = contentRepository;
    this.contentHistoryService = contentHistoryService;
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
        await this.contentHistoryService.saveVersion(existingContent);
      } catch (error) {
        console.error('Failed to store content history before update:', error);
      }
    }

    // Clean content_data before updating if it's being updated
    if (updates.content_data) {
      const cleanedContentData = ContentDataCleaner.clean(
        updates.content_data,
        existingContent.content_type_id
      );
      updates = {
        ...updates,
        content_data: cleanedContentData,
      };
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



