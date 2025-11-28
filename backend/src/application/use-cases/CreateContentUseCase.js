import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { pushStatus, createStatusMessages } from '../utils/StatusMessages.js';

/**
 * Create Content Use Case
 * Handles manual content creation with automatic quality check trigger
 */
export class CreateContentUseCase {
  constructor({ contentRepository, qualityCheckService, aiGenerationService, contentHistoryService, topicRepository, courseRepository }) {
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    this.aiGenerationService = aiGenerationService;
    this.contentHistoryService = contentHistoryService;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
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

    // Initialize status messages array
    const statusMessages = contentData.status_messages || createStatusMessages();
    contentData.status_messages = statusMessages;

    const enrichedContentData = {
      ...contentData,
      content_data: { ...contentData.content_data },
    };

    // Set generation method to manual for manual creation
    const content = new Content({
      ...enrichedContentData,
      generation_method_id: enrichedContentData.generation_method_id || 'manual',
    });

    const { candidateIdsOrNames, resolverDebugLabel } = await this.getContentTypeIdentifiers(content);
    let existingContent = await this.findExistingContent(content.topic_id, candidateIdsOrNames, resolverDebugLabel);

    // If findExistingContent didn't find content, try direct lookup by topic_id and content_type_id
    if (!existingContent && content.content_type_id) {
      try {
        if (typeof this.contentRepository.findLatestByTopicAndType === 'function') {
          existingContent = await this.contentRepository.findLatestByTopicAndType(
            content.topic_id,
            content.content_type_id
          );
          if (existingContent) {
            console.log('[CreateContentUseCase] Found existing content via direct lookup:', {
              content_id: existingContent.content_id,
              topic_id: existingContent.topic_id,
              content_type_id: existingContent.content_type_id,
            });
          }
        }
      } catch (error) {
        console.warn('[CreateContentUseCase] Failed to find existing content via direct lookup:', error.message);
      }
    }

    // Check if this content needs quality check BEFORE audio generation
    // IMPORTANT: Quality check applies ONLY to manual content types (manual, manual_edited)
    // AI-generated content is NOT checked here because:
    // 1. AI already generates quality content
    // 2. If quality check is needed for AI content, it should be done in GenerateContentUseCase before approval
    const isManualContent = content.generation_method_id === 'manual' || content.generation_method_id === 'manual_edited';
    const needsQualityCheck = isManualContent && this.qualityCheckService;
    
    // CRITICAL: If manual content but qualityCheckService is missing, block creation
    // We cannot allow manual content without quality check
    if (isManualContent && !this.qualityCheckService) {
      throw new Error('Quality check service is required for manual content creation. Cannot create content without quality validation.');
    }
    
    console.log('[CreateContentUseCase] Quality check evaluation:', {
      generation_method_id: content.generation_method_id,
      contentTypeId: content.content_type_id,
      isManualContent,
      hasQualityCheckService: !!this.qualityCheckService,
      needsQualityCheck,
      hasExistingContent: !!existingContent,
    });

    // STEP 1: Language validation BEFORE quality check and DB operations (to save tokens)
    // For manual content, validate language matches topic language BEFORE saving to DB or history
    // This applies to both new content and updates, and to both standalone topics and topics in courses
    // If language doesn't match, we skip quality check and DB operations to save tokens
    // IMPORTANT: This check happens BEFORE history save to avoid unnecessary operations
    if (isManualContent && this.topicRepository) {
      try {
        const topic = await this.topicRepository.findById(content.topic_id);
        if (topic) {
          // Get topic language - either from topic itself or from course
          let expectedLanguage = topic.language;
          if (!expectedLanguage && topic.course_id && this.courseRepository) {
            try {
              const course = await this.courseRepository.findById(topic.course_id);
              if (course && course.language) {
                expectedLanguage = course.language;
                console.log('[CreateContentUseCase] Using course language for validation:', {
                  course_id: topic.course_id,
                  course_language: course.language,
                });
              }
            } catch (error) {
              console.warn('[CreateContentUseCase] Failed to get course language:', error.message);
            }
          }

          if (expectedLanguage) {
            // Extract text from content for language detection
            // For code content (type 2), only check explanation (code itself should be in English)
            const contentText = this.extractTextForLanguageValidation(content);
            
            // For code content without explanation, skip language validation (code should be in English)
            const isCodeContent = content.content_type_id === 2 || content.content_type_id === 'code' || content.content_type_id === '2';
            if (isCodeContent && (!contentText || contentText.trim().length === 0)) {
              console.log('[CreateContentUseCase] Code content without explanation - skipping language validation (code should be in English):', {
                content_type_id: content.content_type_id,
                topic_id: topic.topic_id,
              });
              // Skip language validation for code without explanation
            } else if (contentText && contentText.trim().length > 0) {
              // Detect language of content
              const detectedLanguage = await this.detectContentLanguage(contentText);
              
              // CRITICAL: If language detection fails (returns null), block content creation
              // We cannot verify the language, so we must reject the content to be safe
              if (!detectedLanguage) {
                console.warn('[CreateContentUseCase] Language detection failed - blocking creation:', {
                  expected_language: expectedLanguage,
                  topic_id: topic.topic_id,
                  course_id: topic.course_id,
                  content_type_id: content.content_type_id,
                  content_preview: contentText.substring(0, 100),
                });
                const isCodeContent = content.content_type_id === 2 || content.content_type_id === 'code' || content.content_type_id === '2';
                const errorMessage = isCodeContent
                  ? `Failed to detect language of explanation. Please ensure your explanation is in ${expectedLanguage}.`
                  : `Failed to detect content language. Please ensure your content is in ${expectedLanguage}.`;
                const error = new Error(errorMessage);
                error.code = 'LANGUAGE_DETECTION_FAILED';
                error.details = {
                  expected_language: expectedLanguage,
                  detected_language: null,
                  topic_id: topic.topic_id,
                  course_id: topic.course_id,
                  content_type_id: content.content_type_id,
                  is_code_content: isCodeContent,
                };
                throw error;
              }
              
              // If language is detected but doesn't match, block creation
              if (detectedLanguage !== expectedLanguage) {
                console.warn('[CreateContentUseCase] Language mismatch detected - blocking creation to save tokens:', {
                  expected_language: expectedLanguage,
                  detected_language: detectedLanguage,
                  topic_id: topic.topic_id,
                  course_id: topic.course_id,
                  content_type_id: content.content_type_id,
                  content_preview: contentText.substring(0, 100),
                });
                // Block content creation if language doesn't match (saves tokens by skipping quality check)
                const isCodeContent = content.content_type_id === 2 || content.content_type_id === 'code' || content.content_type_id === '2';
                const errorMessage = isCodeContent
                  ? `Explanation language (${detectedLanguage}) does not match expected language (${expectedLanguage}). Code should be in English, but explanation should be in ${expectedLanguage}.`
                  : `Content language (${detectedLanguage}) does not match expected language (${expectedLanguage}). Please create content in the correct language.`;
                const error = new Error(errorMessage);
                error.code = 'LANGUAGE_MISMATCH';
                error.details = {
                  expected_language: expectedLanguage,
                  detected_language: detectedLanguage,
                  topic_id: topic.topic_id,
                  course_id: topic.course_id,
                  content_type_id: content.content_type_id,
                  is_code_content: isCodeContent,
                };
                throw error;
              }
              
              // Language matches - proceed
              console.log('[CreateContentUseCase] ✅ Language validation passed - proceeding with DB save and quality check:', {
                expected_language: expectedLanguage,
                detected_language: detectedLanguage,
                content_type_id: content.content_type_id,
              });
            }
          }
        }
      } catch (error) {
        // Re-throw if it's our language validation error (mismatch or detection failed)
        if (error.code === 'LANGUAGE_MISMATCH' || error.code === 'LANGUAGE_DETECTION_FAILED') {
          throw error;
        }
        console.warn('[CreateContentUseCase] Failed to validate language:', error.message);
        // For other errors (e.g., topic not found), we still block creation to be safe
        // If we can't validate language, we shouldn't proceed
        const validationError = new Error(`Language validation failed: ${error.message}. Content cannot be created without language validation.`);
        validationError.code = 'LANGUAGE_VALIDATION_ERROR';
        validationError.details = {
          original_error: error.message,
          topic_id: content.topic_id,
        };
        throw validationError;
      }
    }

    // MANDATORY: Save existing content to history BEFORE creating/updating new content
    // This applies to ALL content formats - no exceptions
    if (existingContent) {
      if (!this.contentHistoryService?.saveVersion) {
        throw new Error('ContentHistoryService is required for content updates. History save is mandatory.');
      }

      try {
        console.log('[CreateContentUseCase] MANDATORY: Saving existing content to history before update:', {
          content_id: existingContent.content_id,
          topic_id: existingContent.topic_id,
          content_type_id: existingContent.content_type_id,
        });
        await this.contentHistoryService.saveVersion(existingContent, { force: true });
        console.log('[CreateContentUseCase] Successfully saved content to history');
      } catch (error) {
        console.error('[CreateContentUseCase] Failed to save previous version before update:', error.message, error.stack);
        // Do not proceed with update if history save fails
        throw new Error(`Failed to archive content to history: ${error.message}`);
      }
    }

    if (existingContent) {
      // Store original content data for rollback if quality check fails
      // NOTE: Language validation was already done above (before history save) to save tokens
      const originalContentData = existingContent.content_data;
      const originalGenerationMethod = existingContent.generation_method_id;
      const originalQualityCheckStatus = existingContent.quality_check_status;
      const originalQualityCheckData = existingContent.quality_check_data;

      // Save content WITHOUT audio first (if quality check is needed)
      let updatedContent = await this.contentRepository.update(existingContent.content_id, {
        content_data: content.content_data,
        quality_check_status: 'pending',
        quality_check_data: null,
        generation_method_id: content.generation_method_id,
      });

      // Trigger quality check BEFORE audio generation for manual content
      console.log('[CreateContentUseCase] Checking if quality check should run:', {
        needsQualityCheck,
        updatedContentNeedsQualityCheck: updatedContent.needsQualityCheck(),
        updatedContentGenerationMethod: updatedContent.generation_method_id,
        updatedContentId: updatedContent.content_id,
      });
      
      if (needsQualityCheck && updatedContent.needsQualityCheck()) {
        console.log('[CreateContentUseCase] ✅ Triggering quality check BEFORE audio generation for manual content:', updatedContent.content_id);
        pushStatus(statusMessages, 'Starting quality check...');
        try {
          await this.qualityCheckService.triggerQualityCheck(updatedContent.content_id, 'full', statusMessages);
          pushStatus(statusMessages, 'Quality check completed successfully.');
          console.log('[CreateContentUseCase] ✅ Quality check passed, proceeding with audio generation');
          // Reload content to get updated quality check status and results
          const contentAfterQualityCheck = await this.contentRepository.findById(updatedContent.content_id);
          if (contentAfterQualityCheck) {
            updatedContent = contentAfterQualityCheck;
          }
        } catch (error) {
          pushStatus(statusMessages, `Quality check failed: ${error.message}`);
          console.error('[CreateContentUseCase] ❌ Quality check failed, rolling back content to original state:', error.message);
          
          // CRITICAL: Rollback content to original state if quality check failed
          try {
            await this.contentRepository.update(existingContent.content_id, {
              content_data: originalContentData,
              quality_check_status: originalQualityCheckStatus,
              quality_check_data: originalQualityCheckData,
              generation_method_id: originalGenerationMethod,
            });
            console.log('[CreateContentUseCase] ✅ Content rolled back to original state after quality check failure');
          } catch (rollbackError) {
            console.error('[CreateContentUseCase] ❌ Failed to rollback content after quality check failure:', rollbackError.message);
            // Continue to throw the original error even if rollback fails
          }
          
          // Re-throw if quality check fails (content should be rejected, no audio generation)
          throw error;
        }
      } else {
        console.log('[CreateContentUseCase] ⚠️ Quality check NOT triggered:', {
          reason: !needsQualityCheck ? 'needsQualityCheck is false' : 'updatedContent.needsQualityCheck() returned false',
          needsQualityCheck,
          updatedContentNeedsQualityCheck: updatedContent?.needsQualityCheck(),
        });
      }

      // Generate audio ONLY if quality check passed (or if not needed)
      // CRITICAL: Pass quality_check_status to shouldGenerateAudio to prevent audio generation for rejected content
      const shouldGenerate = await this.shouldGenerateAudio({
        ...enrichedContentData,
        quality_check_status: updatedContent.quality_check_status,
      });
      
      if (shouldGenerate) {
        pushStatus(statusMessages, 'Generating audio...');
        try {
          await this.attachGeneratedAudio(enrichedContentData);
          pushStatus(statusMessages, 'Audio generation completed successfully.');
          // Update content with audio
          const finalUpdatedContent = await this.contentRepository.update(updatedContent.content_id, {
            content_data: enrichedContentData.content_data,
          });
          // Reload content to get updated quality check results
          const finalContent = await this.contentRepository.findById(finalUpdatedContent.content_id);
          if (finalContent) {
            finalContent.status_messages = statusMessages;
            return finalContent;
          }
          finalUpdatedContent.status_messages = statusMessages;
          return finalUpdatedContent;
        } catch (error) {
          pushStatus(statusMessages, `Audio generation failed: ${error.message}`);
          throw error;
        }
      } else {
        console.log('[CreateContentUseCase] ⚠️ Audio generation skipped (update):', {
          quality_check_status: updatedContent.quality_check_status,
          content_type_id: enrichedContentData.content_type_id,
        });
      }

      // Reload content to get updated quality check results
      const finalContent = await this.contentRepository.findById(updatedContent.content_id);
      if (finalContent) {
        finalContent.status_messages = statusMessages;
        return finalContent;
      }
      updatedContent.status_messages = statusMessages;
      return updatedContent;
    }

    // Save content to repository WITHOUT audio first
    // NOTE: Content is saved before quality check because triggerQualityCheck needs content_id
    // If quality check fails, we will delete the content from DB
    let createdContent = await this.contentRepository.create(content);
    let contentIdToDeleteOnFailure = createdContent.content_id; // Store ID for potential rollback

    // Trigger quality check BEFORE audio generation for manual content
    console.log('[CreateContentUseCase] Checking if quality check should run (new content):', {
      needsQualityCheck,
      createdContentNeedsQualityCheck: createdContent.needsQualityCheck(),
      createdContentGenerationMethod: createdContent.generation_method_id,
      createdContentId: createdContent.content_id,
    });
    
    if (needsQualityCheck && createdContent.needsQualityCheck()) {
      console.log('[CreateContentUseCase] ✅ Triggering quality check BEFORE audio generation for manual content:', createdContent.content_id);
      pushStatus(statusMessages, 'Starting quality check...');
      try {
        await this.qualityCheckService.triggerQualityCheck(createdContent.content_id, 'full', statusMessages);
        pushStatus(statusMessages, 'Quality check completed successfully.');
        console.log('[CreateContentUseCase] ✅ Quality check passed, proceeding with audio generation');
        // Reload content to get updated quality check status and results
        const contentAfterQualityCheck = await this.contentRepository.findById(createdContent.content_id);
        if (contentAfterQualityCheck) {
          createdContent = contentAfterQualityCheck;
          // Verify quality check status is approved before proceeding
          if (contentAfterQualityCheck.quality_check_status !== 'approved') {
            console.error('[CreateContentUseCase] ❌ Quality check status is not approved:', contentAfterQualityCheck.quality_check_status);
            // Delete content if quality check status is not approved
            if (contentIdToDeleteOnFailure) {
              try {
                await this.contentRepository.delete(contentIdToDeleteOnFailure, true);
                console.log('[CreateContentUseCase] ✅ Content deleted from DB - quality check status not approved');
              } catch (deleteError) {
                console.error('[CreateContentUseCase] ❌ Failed to delete content:', deleteError.message);
              }
            }
            throw new Error(`Content failed quality check. Status: ${contentAfterQualityCheck.quality_check_status}`);
          }
        }
        // Clear the rollback flag since quality check passed
        contentIdToDeleteOnFailure = null;
      } catch (error) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
        console.error('[CreateContentUseCase] ❌ Quality check failed, deleting content from DB:', error.message);
        
        // CRITICAL: Delete content from DB if quality check failed
        // MUST succeed - if deletion fails, we cannot proceed
        if (contentIdToDeleteOnFailure) {
          try {
            await this.contentRepository.delete(contentIdToDeleteOnFailure, true);
            console.log('[CreateContentUseCase] ✅ Content deleted from DB after quality check failure');
            contentIdToDeleteOnFailure = null; // Mark as deleted
          } catch (deleteError) {
            console.error('[CreateContentUseCase] ❌ CRITICAL: Failed to delete content after quality check failure:', deleteError.message);
            // Try one more time with force
            try {
              await this.contentRepository.delete(contentIdToDeleteOnFailure, true);
              console.log('[CreateContentUseCase] ✅ Content deleted on retry');
              contentIdToDeleteOnFailure = null;
            } catch (retryError) {
              console.error('[CreateContentUseCase] ❌ CRITICAL: Content deletion failed even on retry:', retryError.message);
              // Still throw the original error - content should not be saved if quality check fails
            }
          }
        }
        
        // Re-throw if quality check fails (content should be rejected, no audio generation)
        throw error;
      }
    } else {
      console.log('[CreateContentUseCase] ⚠️ Quality check NOT triggered (new content):', {
        reason: !needsQualityCheck ? 'needsQualityCheck is false' : 'createdContent.needsQualityCheck() returned false',
        isManualContent,
        needsQualityCheck,
        createdContentNeedsQualityCheck: createdContent.needsQualityCheck(),
        hasQualityCheckService: !!this.qualityCheckService,
        generation_method_id: content.generation_method_id,
      });
    }

    // CRITICAL: Verify content still exists and quality check passed before generating audio
    // If content was deleted due to failed quality check, we should not proceed
    if (contentIdToDeleteOnFailure) {
      console.error('[CreateContentUseCase] ❌ Content was marked for deletion, cannot proceed with audio generation');
      throw new Error('Content failed quality check and was deleted. Cannot generate audio.');
    }

    // Verify content exists and quality check status is approved (if quality check was required)
    if (needsQualityCheck) {
      const currentContent = await this.contentRepository.findById(createdContent.content_id);
      if (!currentContent) {
        console.error('[CreateContentUseCase] ❌ Content not found after quality check - may have been deleted');
        throw new Error('Content not found after quality check');
      }
      if (currentContent.quality_check_status !== 'approved') {
        console.error('[CreateContentUseCase] ❌ Quality check status is not approved:', currentContent.quality_check_status);
        throw new Error(`Content quality check failed. Status: ${currentContent.quality_check_status}`);
      }
    }

    // Generate audio ONLY if quality check passed (or if not needed)
    // CRITICAL: Pass quality_check_status to shouldGenerateAudio to prevent audio generation for rejected content
    const shouldGenerate = await this.shouldGenerateAudio({
      ...enrichedContentData,
      quality_check_status: createdContent.quality_check_status,
    });
    
    if (shouldGenerate) {
      pushStatus(statusMessages, 'Generating audio...');
      try {
        await this.attachGeneratedAudio(enrichedContentData);
        pushStatus(statusMessages, 'Audio generation completed successfully.');
        // Update content with audio
        const finalUpdatedContent = await this.contentRepository.update(createdContent.content_id, {
          content_data: enrichedContentData.content_data,
        });
        // Reload content to get updated quality check results
        const finalContent = await this.contentRepository.findById(finalUpdatedContent.content_id);
        if (finalContent) {
          finalContent.status_messages = statusMessages;
          return finalContent;
        }
        finalUpdatedContent.status_messages = statusMessages;
        return finalUpdatedContent;
      } catch (error) {
        pushStatus(statusMessages, `Audio generation failed: ${error.message}`);
        throw error;
      }
    } else {
      console.log('[CreateContentUseCase] ⚠️ Audio generation skipped:', {
        quality_check_status: createdContent.quality_check_status,
        content_type_id: enrichedContentData.content_type_id,
      });
    }

    // Reload content to get updated quality check results
    const finalContent = await this.contentRepository.findById(createdContent.content_id);
    if (finalContent) {
      finalContent.status_messages = statusMessages;
      return finalContent;
    }
    createdContent.status_messages = statusMessages;
    return createdContent;
  }

  async findExistingContent(topicId, candidates, debugLabel) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const tryCandidates = async lookupFn => {
      for (const candidate of candidates) {
        try {
          const result = await lookupFn(candidate);
          if (result) {
            return result;
          }
        } catch (error) {
          console.warn(
            `[CreateContentUseCase] Failed lookup for candidate "${candidate}" (${debugLabel}): ${error.message}`
          );
        }
      }
      return null;
    };

    if (typeof this.contentRepository.findLatestByTopicAndType === 'function') {
      const found = await tryCandidates(candidate =>
        this.contentRepository.findLatestByTopicAndType(topicId, candidate)
      );
      if (found) {
        return found;
      }
    }

    if (typeof this.contentRepository.findAllByTopicId === 'function') {
      try {
        const allContent = await this.contentRepository.findAllByTopicId(topicId);
        const sorted = Array.isArray(allContent)
          ? [...allContent].sort(
              (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
            )
          : [];
        return sorted.find(item =>
          candidates.some(candidate => this.contentTypesMatch(item.content_type_id, candidate))
        );
      } catch (error) {
        console.warn('[CreateContentUseCase] Failed to load all content for fallback lookup:', error.message);
      }
    }

    return null;
  }

  contentTypesMatch(existingType, candidate) {
    if (existingType === candidate) {
      return true;
    }

    const existingLower = typeof existingType === 'string' ? existingType.toLowerCase() : null;
    const candidateLower = typeof candidate === 'string' ? candidate.toLowerCase() : null;
    if (existingLower && candidateLower && existingLower === candidateLower) {
      return true;
    }

    const existingNumeric = Number(existingType);
    const candidateNumeric = Number(candidate);
    if (!Number.isNaN(existingNumeric) && !Number.isNaN(candidateNumeric) && existingNumeric === candidateNumeric) {
      return true;
    }

    return false;
  }

  async getContentTypeIdentifiers(content) {
    const rawType = content.content_type_id;
    const candidates = new Set();

    if (rawType !== undefined && rawType !== null) {
      candidates.add(rawType);
    }

    const numericId = Number(rawType);
    if (!Number.isNaN(numericId)) {
      candidates.add(numericId);
    }

    if (typeof rawType === 'string') {
      candidates.add(rawType.toLowerCase());
    }

    // Attempt to resolve official type name via repository
    if (!Number.isNaN(numericId) && typeof this.contentRepository.getContentTypeNamesByIds === 'function') {
      try {
        const map = await this.contentRepository.getContentTypeNamesByIds([numericId]);
        const name = map?.get?.(numericId);
        if (name) {
          candidates.add(name);
          candidates.add(name.toLowerCase());
        }
      } catch (error) {
        console.warn('[CreateContentUseCase] Failed to resolve content type name:', error.message);
      }
    }

    return {
      candidateIdsOrNames: Array.from(candidates).filter(Boolean),
      resolverDebugLabel: `topic:${content.topic_id}`,
    };
  }

  async shouldGenerateAudio(contentData) {
    if (!this.aiGenerationService || typeof this.aiGenerationService.generateAudio !== 'function') {
      return false;
    }

    const contentTypeId = contentData.content_type_id;
    const isTextType =
      contentTypeId === 1 ||
      contentTypeId === '1' ||
      contentTypeId === 'text_audio' ||
      contentTypeId === 'text'; // Support both for backward compatibility

    if (!isTextType) {
      return false;
    }

    // CRITICAL: Do not generate audio if quality check failed or is not approved
    // This prevents audio generation for content that failed quality check
    if (contentData.quality_check_status && contentData.quality_check_status !== 'approved') {
      console.warn('[CreateContentUseCase] ⚠️ Skipping audio generation - quality check status is not approved:', contentData.quality_check_status);
      return false;
    }

    const text = this.extractTextContent(contentData.content_data);
    if (!text) {
      return false;
    }

    if (text.length > 4000) {
      throw new Error('Text content exceeds the 4000 character limit for audio generation');
    }

    if (contentData.content_data.audioUrl) {
      // Audio already present, skip regeneration
      return false;
    }

    return true;
  }

  extractTextContent(contentData) {
    if (!contentData) return '';
    if (typeof contentData.text === 'string') {
      return contentData.text.trim();
    }
    if (typeof contentData === 'string') {
      return contentData.trim();
    }
    return '';
  }

  async attachGeneratedAudio(contentData) {
    try {
      const text = this.extractTextContent(contentData.content_data);
      if (!text) return;

      const language =
        contentData.content_data?.metadata?.language ||
        contentData.content_data?.language ||
        'en';

      const audioResult = await this.aiGenerationService.generateAudio(text, {
        voice: 'alloy',
        model: 'tts-1',
        format: 'mp3',
        language,
      });

      if (!audioResult) {
        return;
      }

      // Build raw content data with audio
      const rawContentData = {
        ...contentData.content_data,
        text: contentData.content_data?.text || text,
        audioUrl: audioResult.audioUrl || contentData.content_data.audioUrl,
        audioFormat: audioResult.format || contentData.content_data.audioFormat,
        audioDuration: audioResult.duration || contentData.content_data.audioDuration,
        audioVoice: audioResult.voice || contentData.content_data.audioVoice,
      };

      // Clean content data: remove audioText (duplicate) and redundant metadata
      // Determine content type (default to 1 for text+audio)
      const contentTypeId = contentData.content_type_id || 1;
      contentData.content_data = ContentDataCleaner.clean(rawContentData, contentTypeId);
    } catch (error) {
      console.warn('[CreateContentUseCase] Failed to auto-generate audio for manual text:', error.message);
    }
  }

  /**
   * Extract text from content for language detection
   * Similar to QualityCheckService.extractTextFromContent
   * NOTE: For code content (type 2), only extracts explanation (code itself should be in English)
   */
  extractTextFromContent(content) {
    if (typeof content.content_data === 'string') {
      try {
        const parsed = JSON.parse(content.content_data);
        if (parsed.code) {
          const codeText = parsed.code;
          const explanationText = parsed.explanation || '';
          return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
        }
        if (parsed.metadata) {
          const metadataText = [
            parsed.metadata.title,
            parsed.metadata.description,
            parsed.metadata.lessonTopic,
          ].filter(Boolean).join('\n');
          if (metadataText) return metadataText;
        }
        return parsed.text || JSON.stringify(parsed);
      } catch {
        return content.content_data;
      }
    }
    
    if (content.content_data?.text) {
      return content.content_data.text;
    }
    
    if (content.content_data?.code) {
      const codeText = content.content_data.code;
      const explanationText = content.content_data.explanation || '';
      return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
    }
    
    if (content.content_data?.metadata) {
      const metadataText = [
        content.content_data.metadata.title,
        content.content_data.metadata.description,
        content.content_data.metadata.lessonTopic,
      ].filter(Boolean).join('\n');
      if (metadataText) return metadataText;
    }
    
    if (content.content_data?.nodes && Array.isArray(content.content_data.nodes)) {
      const nodeTexts = content.content_data.nodes
        .map(node => node.data?.label || node.label || node.text || '')
        .filter(Boolean);
      if (nodeTexts.length > 0) {
        return nodeTexts.join('\n');
      }
    }
    
    if (content.content_data?.script) {
      return content.content_data.script;
    }
    
    return JSON.stringify(content.content_data);
  }

  /**
   * Extract text from content for language validation
   * For code content (type 2), only extracts explanation (code itself should be in English)
   * For other content types, extracts all text as usual
   */
  extractTextForLanguageValidation(content) {
    const contentTypeId = content.content_type_id;
    const isCodeContent = contentTypeId === 2 || contentTypeId === 'code' || contentTypeId === '2';

    if (typeof content.content_data === 'string') {
      try {
        const parsed = JSON.parse(content.content_data);
        if (isCodeContent && parsed.explanation) {
          // For code: only check explanation, not the code itself
          return parsed.explanation;
        }
        if (parsed.code && !isCodeContent) {
          // For non-code content that has code field, include both
          const codeText = parsed.code;
          const explanationText = parsed.explanation || '';
          return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
        }
        if (parsed.metadata) {
          const metadataText = [
            parsed.metadata.title,
            parsed.metadata.description,
            parsed.metadata.lessonTopic,
          ].filter(Boolean).join('\n');
          if (metadataText) return metadataText;
        }
        return parsed.text || JSON.stringify(parsed);
      } catch {
        return content.content_data;
      }
    }
    
    if (content.content_data?.text) {
      return content.content_data.text;
    }
    
    if (content.content_data?.code) {
      if (isCodeContent) {
        // For code: only check explanation, not the code itself
        return content.content_data.explanation || '';
      } else {
        // For non-code content, include both code and explanation
        const codeText = content.content_data.code;
        const explanationText = content.content_data.explanation || '';
        return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
      }
    }
    
    if (content.content_data?.metadata) {
      const metadataText = [
        content.content_data.metadata.title,
        content.content_data.metadata.description,
        content.content_data.metadata.lessonTopic,
      ].filter(Boolean).join('\n');
      if (metadataText) return metadataText;
    }
    
    if (content.content_data?.nodes && Array.isArray(content.content_data.nodes)) {
      const nodeTexts = content.content_data.nodes
        .map(node => node.data?.label || node.label || node.text || '')
        .filter(Boolean);
      if (nodeTexts.length > 0) {
        return nodeTexts.join('\n');
      }
    }
    
    if (content.content_data?.script) {
      return content.content_data.script;
    }
    
    return JSON.stringify(content.content_data);
  }

  /**
   * Detect language of content text using AI
   * @param {string} text - Text to detect language for
   * @returns {Promise<string|null>} Detected language code or null
   */
  async detectContentLanguage(text) {
    if (!this.aiGenerationService || !text || text.trim().length === 0) {
      return null;
    }

    try {
      const prompt = `Detect the language of the following text and return only the ISO 639-1 language code (e.g., 'en', 'he', 'ar', 'es', 'fr').

Text:
${text.substring(0, 500)}

Return only the 2-letter language code, nothing else.`;

      // Use generateText method from AIGenerationService
      const response = await this.aiGenerationService.generateText(prompt, {
        temperature: 0.1,
        max_tokens: 10,
      });

      if (!response) {
        return null;
      }

      const languageCode = response.trim().toLowerCase();
      const validCodes = ['en', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'fa', 'ur'];
      
      if (validCodes.includes(languageCode)) {
        return languageCode;
      }

      return null;
    } catch (error) {
      console.warn('[CreateContentUseCase] Language detection failed:', error.message);
      return null;
    }
  }
}



