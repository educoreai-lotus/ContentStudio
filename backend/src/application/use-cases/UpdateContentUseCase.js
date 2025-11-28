import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { pushStatus, createStatusMessages } from '../utils/StatusMessages.js';

/**
 * Update Content Use Case
 * Updates content and automatically creates a version
 * IMPORTANT: If editing AI-generated content, triggers quality check
 */
export class UpdateContentUseCase {
  constructor({
    contentRepository,
    contentHistoryService,
    qualityCheckService,
  }) {
    this.contentRepository = contentRepository;
    this.contentHistoryService = contentHistoryService;
    this.qualityCheckService = qualityCheckService;
  }

  async execute(contentId, updates, updatedBy, statusMessages = null) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    // Get existing content
    const existingContent = await this.contentRepository.findById(contentId);
    if (!existingContent) {
      throw new Error('Content not found');
    }

    // Check if content was originally AI-generated and is being edited
    const wasAIGenerated = existingContent.generation_method_id === 'ai_assisted' || 
                          existingContent.generation_method_id === 'ai_generated' ||
                          existingContent.generation_method_id === 'ai';
    const isContentBeingUpdated = updates.content_data && this.hasContentChanged(
      existingContent.content_data,
      updates.content_data
    );
    const needsQualityCheckAfterEdit = wasAIGenerated && isContentBeingUpdated && this.qualityCheckService;

    console.log('[UpdateContentUseCase] Quality check evaluation:', {
      contentId,
      contentTypeId: existingContent.content_type_id,
      wasAIGenerated,
      isContentBeingUpdated,
      hasQualityCheckService: !!this.qualityCheckService,
      needsQualityCheckAfterEdit,
      originalGenerationMethod: existingContent.generation_method_id,
    });

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

    // If editing AI-generated content, mark as manual_edited and reset quality check status
    if (needsQualityCheckAfterEdit) {
      updates.generation_method_id = 'manual_edited';
      updates.quality_check_status = 'pending';
      updates.quality_check_data = null;
      console.log('[UpdateContentUseCase] ✅ AI-generated content was edited - marking as manual_edited and resetting quality check');
    }

    // Update content
    let updatedContent = await this.contentRepository.update(contentId, updates);

    // Trigger quality check if AI-generated content was edited
    // IMPORTANT: This applies to ALL content types (text, code, etc.)
    if (needsQualityCheckAfterEdit) {
      console.log('[UpdateContentUseCase] ✅ Triggering quality check for edited AI-generated content:', {
        contentId: updatedContent.content_id,
        contentTypeId: updatedContent.content_type_id,
        contentType: updatedContent.content_type_id === 1 || updatedContent.content_type_id === 'text_audio' ? 'text_audio' : 
                     updatedContent.content_type_id === 2 || updatedContent.content_type_id === 'code' ? 'code' : 
                     'other',
      });
      if (!statusMessages) {
        statusMessages = createStatusMessages();
      }
      pushStatus(statusMessages, 'Starting quality check for edited content...');
      try {
        await this.qualityCheckService.triggerQualityCheck(updatedContent.content_id, 'full', statusMessages);
        pushStatus(statusMessages, 'Quality check completed successfully.');
        console.log('[UpdateContentUseCase] ✅ Quality check passed for edited content', {
          contentId: updatedContent.content_id,
          contentTypeId: updatedContent.content_type_id,
        });
        // Reload content to get updated quality check status and results
        const contentAfterQualityCheck = await this.contentRepository.findById(updatedContent.content_id);
        if (contentAfterQualityCheck) {
          updatedContent = contentAfterQualityCheck;
        }
      } catch (error) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
        console.error('[UpdateContentUseCase] ❌ Quality check failed for edited content:', {
          contentId: updatedContent.content_id,
          contentTypeId: updatedContent.content_type_id,
          error: error.message,
        });
        // Re-throw if quality check fails (content should be rejected)
        throw error;
      }
    }

    // Attach status messages if provided
    if (statusMessages) {
      updatedContent.status_messages = statusMessages;
    }

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



