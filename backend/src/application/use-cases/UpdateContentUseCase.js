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

  /**
   * Determine generation_method_id based on business logic (same as CreateContentUseCase)
   * @param {number} topicId - Topic ID
   * @param {string|number} providedMethod - Method provided in contentData
   * @param {number|string} contentTypeId - Content type ID
   * @param {Object} contentData - Content data object
   * @returns {Promise<string>} Determined generation method
   */
  async determineGenerationMethod(topicId, providedMethod, contentTypeId, contentData) {
    try {
      // Check if this is video_to_lesson (content from video transcription)
      if (contentData?.source === 'video' || contentData?.videoType || contentData?.transcript) {
        return 'video_to_lesson';
      }

      // Get all existing content for this topic
      const existingContent = await this.contentRepository.findAllByTopicId(topicId);
      const existingCount = existingContent?.length || 0;

      // If this is the first format
      if (existingCount === 0) {
        // Use provided method or default to manual
        const method = providedMethod || 'manual';
        // Normalize to valid method names
        if (method === 'ai_generated' || method === 'full_ai_generated') {
          return 'ai_assisted'; // Use ai_assisted for consistency
        }
        if (method === 'ai_assisted' || method === 'manual' || method === 'manual_edited') {
          return method;
        }
        // If it's a number, try to convert
        if (typeof method === 'number') {
          try {
            const methodName = await this.contentRepository.getGenerationMethodName(method);
            if (methodName && ['manual', 'ai_assisted', 'ai_generated', 'manual_edited'].includes(methodName)) {
              return methodName;
            }
          } catch (error) {
            console.warn('[UpdateContentUseCase] Failed to convert generation_method_id to name:', error.message);
          }
        }
        return 'manual'; // Default fallback
      }

      // If this is second+ format, check if any previous format used AI
      const hasAIContent = existingContent.some(content => {
        const method = content.generation_method_id;
        return method === 'ai_assisted' || 
               method === 'ai_generated' || 
               method === 'full_ai_generated' ||
               method === 'Mixed' ||
               method === 2 || // ai_assisted ID
               method === 5;    // full_ai_generated ID
      });

      // If any previous format used AI, and current is manual, change to Mixed
      if (hasAIContent) {
        const currentMethod = providedMethod || 'manual';
        // If current is manual or manual_edited, change to Mixed
        if (currentMethod === 'manual' || currentMethod === 'manual_edited' || currentMethod === 1) {
          return 'Mixed';
        }
        // If current is already AI, it's still Mixed (combination of AI and manual)
        if (currentMethod === 'ai_assisted' || currentMethod === 'ai_generated' || currentMethod === 2 || currentMethod === 5) {
          return 'Mixed';
        }
      }

      // If no AI in previous formats, use provided method or default to manual
      const method = providedMethod || 'manual';
      // Normalize to valid method names
      if (method === 'ai_generated' || method === 'full_ai_generated') {
        return 'ai_assisted';
      }
      if (method === 'ai_assisted' || method === 'manual' || method === 'manual_edited') {
        return method;
      }
      // If it's a number, try to convert
      if (typeof method === 'number') {
        try {
          const methodName = await this.contentRepository.getGenerationMethodName(method);
          if (methodName && ['manual', 'ai_assisted', 'ai_generated', 'manual_edited'].includes(methodName)) {
            return methodName;
          }
        } catch (error) {
          console.warn('[UpdateContentUseCase] Failed to convert generation_method_id to name:', error.message);
        }
      }
      return 'manual'; // Default fallback
    } catch (error) {
      console.error('[UpdateContentUseCase] Failed to determine generation method:', error.message);
      // Fallback to provided method or manual
      return providedMethod || 'manual';
    }
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

    // Re-determine generation_method_id for update (may need to change to Mixed)
    let finalGenerationMethod = existingContent.generation_method_id;
    if (updates.generation_method_id || updates.content_data) {
      finalGenerationMethod = await this.determineGenerationMethod(
        existingContent.topic_id,
        updates.generation_method_id || existingContent.generation_method_id,
        existingContent.content_type_id,
        updates.content_data || existingContent.content_data
      );
      updates.generation_method_id = finalGenerationMethod;
    }

    // Update content
    let updatedContent = await this.contentRepository.update(contentId, updates);

    // Update topic's generation_methods_id based on updated content's generation_method_id
    await this.updateTopicGenerationMethod(existingContent.topic_id, finalGenerationMethod);

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

  /**
   * Convert generation_method_id (string or number) to numeric ID only
   * @param {string|number} method - Generation method (name or ID)
   * @returns {Promise<number|null>} Numeric ID or null if not found
   */
  async convertMethodToId(method) {
    if (typeof method === 'number') {
      return method; // Already a number
    }
    
    if (typeof method === 'string') {
      try {
        // Convert string name to numeric ID
        return await this.contentRepository.getGenerationMethodId(method);
      } catch (error) {
        console.warn('[UpdateContentUseCase] Failed to convert method name to ID:', method, error.message);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Update topic's generation_methods_id based on content's generation_method_id
   * @param {number} topicId - Topic ID
   * @param {string|number} contentGenerationMethod - Content's generation_method_id
   * @returns {Promise<void>}
   */
  async updateTopicGenerationMethod(topicId, contentGenerationMethod) {
    if (!this.contentRepository) {
      console.warn('[UpdateContentUseCase] ContentRepository not available, skipping topic generation_methods_id update');
      return;
    }

    try {
      // Get all content for this topic to determine the overall method
      const allContent = await this.contentRepository.findAllByTopicId(topicId);
      if (!allContent || allContent.length === 0) {
        return;
      }

      // Convert all generation_method_id to numeric IDs only
      const methodIds = [];
      for (const content of allContent) {
        const methodId = await this.convertMethodToId(content.generation_method_id);
        if (methodId !== null) {
          methodIds.push(methodId);
        }
      }

      if (methodIds.length === 0) {
        return; // No valid methods found
      }

      // Determine the overall generation method for the topic (working only with numeric IDs)
      let topicMethodId = null;

      // Check if any content uses AI (IDs: 2 = ai_assisted, 5 = full_ai_generated)
      const hasAIContent = methodIds.some(id => id === 2 || id === 5);

      // Check if any content is manual (ID: 1 = manual)
      const hasManualContent = methodIds.some(id => id === 1);

      // Check if any content is video_to_lesson (ID: 3 = video_to_lesson)
      const hasVideoToLesson = methodIds.some(id => id === 3);

      // Determine topic method based on content methods (only numeric IDs)
      if (hasVideoToLesson) {
        topicMethodId = 3; // video_to_lesson
      } else if (hasAIContent && hasManualContent) {
        topicMethodId = 6; // Mixed
      } else if (hasAIContent) {
        // Check if it's full_ai_generated (all formats are AI - ID 5)
        const allAreAI = methodIds.every(id => id === 2 || id === 5);
        topicMethodId = allAreAI ? 5 : 2; // full_ai_generated (5) or ai_assisted (2)
      } else if (hasManualContent) {
        topicMethodId = 1; // manual
      }

      // Update topic if method was determined
      if (topicMethodId !== null && this.topicRepository) {
        await this.topicRepository.update(topicId, {
          generation_methods_id: topicMethodId,
        });
        console.log('[UpdateContentUseCase] Updated topic generation_methods_id', {
          topic_id: topicId,
          generation_methods_id: topicMethodId,
        });
      } else if (topicMethodId !== null && !this.topicRepository) {
        console.warn('[UpdateContentUseCase] TopicRepository not available, skipping topic generation_methods_id update', {
          topic_id: topicId,
          generation_methods_id: topicMethodId,
        });
      }
    } catch (error) {
      console.error('[UpdateContentUseCase] Failed to determine topic generation_methods_id:', error.message);
      // Don't throw - this is a non-critical update
    }
  }
}



