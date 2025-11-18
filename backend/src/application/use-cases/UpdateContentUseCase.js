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

    // MANDATORY: Always save previous version to history before updating
    // This applies to ALL content formats and ALL update scenarios
    if (this.contentHistoryService?.saveVersion) {
      try {
        console.log('[UpdateContentUseCase] Saving previous version to history before update:', {
          content_id: contentId,
          topic_id: existingContent.topic_id,
          content_type_id: existingContent.content_type_id,
        });
        await this.contentHistoryService.saveVersion(existingContent, { force: true });
        console.log('[UpdateContentUseCase] Successfully archived previous version to history');
      } catch (error) {
        console.error('[UpdateContentUseCase] Failed to save previous version to history:', error.message, error.stack);
        // Do not proceed with update if history save fails
        throw new Error(`Failed to archive content to history: ${error.message}`);
      }
    } else {
      throw new Error('ContentHistoryService is required for content updates');
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



