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
              // detectContentLanguage always returns a language code (never null, defaults to 'en')
              const detectedLanguage = await this.detectContentLanguage(contentText);
              
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
            // CRITICAL: Verify quality check status is approved before proceeding
            // If status is 'rejected' or 'pending', we must rollback the content and throw error
            if (contentAfterQualityCheck.quality_check_status !== 'approved') {
              console.error('[CreateContentUseCase] ❌ Quality check status is not approved:', contentAfterQualityCheck.quality_check_status);
              // Rollback content to original state if quality check status is not approved
              try {
                await this.contentRepository.update(existingContent.content_id, {
                  content_data: originalContentData,
                  quality_check_status: originalQualityCheckStatus,
                  quality_check_data: originalQualityCheckData,
                  generation_method_id: originalGenerationMethod,
                });
                console.log('[CreateContentUseCase] ✅ Content rolled back to original state - quality check status not approved');
              } catch (rollbackError) {
                console.error('[CreateContentUseCase] ❌ Failed to rollback content after quality check failure:', rollbackError.message);
                // Continue to throw the original error even if rollback fails
              }
              // Get error message from quality_check_data if available
              const qualityData = contentAfterQualityCheck.quality_check_data || {};
              const errorMessage = qualityData.error_message || 
                                   qualityData.feedback_summary || 
                                   `Content failed quality check. Status: ${contentAfterQualityCheck.quality_check_status}`;
              throw new Error(errorMessage);
            }
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

    // CRITICAL: For manual content, we MUST run quality check BEFORE saving to DB
    // If quality check fails, we should NOT save the content at all
    let qualityCheckResults = null;

    // Validate content quality BEFORE saving to DB for manual content
    if (needsQualityCheck) {
      console.log('[CreateContentUseCase] ✅ Validating content quality BEFORE saving to DB');
      pushStatus(statusMessages, 'Starting quality check...');
      try {
        // Validate content quality before saving - this will throw error if check fails
        qualityCheckResults = await this.qualityCheckService.validateContentQualityBeforeSave(
          content,
          content.topic_id,
          statusMessages
        );
        pushStatus(statusMessages, 'Quality check completed successfully.');
        console.log('[CreateContentUseCase] ✅ Quality check passed, proceeding with DB save');
      } catch (error) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
        console.error('[CreateContentUseCase] ❌ Quality check failed - content will NOT be saved:', error.message);
        // Re-throw if quality check fails (content should NOT be saved to DB)
        throw error;
      }
    }

    // Save content to DB ONLY if quality check passed (or if not required)
    let createdContent = await this.contentRepository.create(content);
    
    // If quality check was performed and passed, create quality check record and update content
    if (needsQualityCheck && qualityCheckResults) {
      try {
        // Create quality check record
        const { QualityCheck } = await import('../../domain/entities/QualityCheck.js');
        const qualityCheck = new QualityCheck({
          content_id: createdContent.content_id,
          check_type: 'full',
          status: 'completed',
        });
        qualityCheck.markCompleted(qualityCheckResults, qualityCheckResults.overall_score);
        
        const savedCheck = await this.qualityCheckService.qualityCheckRepository.create(qualityCheck);
        
        // Update content with quality check results
        createdContent = await this.contentRepository.update(createdContent.content_id, {
          quality_check_status: 'approved',
          quality_check_data: {
            quality_check_id: savedCheck.quality_check_id,
            ...qualityCheckResults,
          },
        });
        
        console.log('[CreateContentUseCase] ✅ Quality check record created and content updated:', {
          content_id: createdContent.content_id,
          quality_check_id: savedCheck.quality_check_id,
          quality_check_status: 'approved',
        });
      } catch (error) {
        console.error('[CreateContentUseCase] ❌ Failed to create quality check record:', error.message);
        // CRITICAL: If quality check record creation failed, delete the content
        // We cannot have content saved without proper quality check record
        try {
          await this.contentRepository.delete(createdContent.content_id, true);
          console.log('[CreateContentUseCase] ✅ Content deleted - quality check record creation failed');
        } catch (deleteError) {
          console.error('[CreateContentUseCase] ❌ CRITICAL: Failed to delete content after quality check record creation failure:', deleteError.message);
        }
        throw new Error(`Failed to create quality check record: ${error.message}. Content was not saved.`);
      }
    }

    // Generate audio ONLY if quality check passed (or if not needed)
    // CRITICAL: Pass quality_check_status to shouldGenerateAudio to prevent audio generation for rejected content
    const shouldGenerate = await this.shouldGenerateAudio({
      ...enrichedContentData,
      quality_check_status: createdContent.quality_check_status,
    });
    
    if (shouldGenerate) {
      // CRITICAL: Double-check quality check status before generating audio
      if (needsQualityCheck && createdContent.quality_check_status !== 'approved') {
        console.error('[CreateContentUseCase] ❌ Quality check status is not approved - aborting audio generation:', createdContent.quality_check_status);
        throw new Error(`Content failed quality check. Status: ${createdContent.quality_check_status}. Cannot generate audio.`);
      }
      
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
   * @returns {Promise<string>} Detected language code (never returns null - defaults to 'en')
   */
  async detectContentLanguage(text) {
    if (!text || text.trim().length === 0) {
      console.warn('[CreateContentUseCase] Empty text provided for language detection, defaulting to English');
      return 'en';
    }

    // Import technical terms filter (dynamic import to avoid circular dependencies)
    let filterTechnicalTerms, analyzeLanguageWithTechnicalTerms, filteredText, hasTechnicalTerms;
    try {
      const technicalTermsModule = await import('../utils/TechnicalTermsFilter.js');
      filterTechnicalTerms = technicalTermsModule.filterTechnicalTerms;
      analyzeLanguageWithTechnicalTerms = technicalTermsModule.analyzeLanguageWithTechnicalTerms;
      
      // Analyze text with technical terms consideration
      const analysis = analyzeLanguageWithTechnicalTerms(text);
      
      // If we have high confidence in a non-English language, use it
      if (analysis.confidence > 0.3 && analysis.dominantLanguage !== 'en') {
        console.log('[CreateContentUseCase] Language detected via technical terms analysis:', {
          language: analysis.dominantLanguage,
          confidence: analysis.confidence,
          hasTechnicalTerms: analysis.hasTechnicalTerms,
        });
        return analysis.dominantLanguage;
      }

      // Filter out technical terms before detection
      filteredText = filterTechnicalTerms(text);
      hasTechnicalTerms = filteredText.length < text.length * 0.8;
    } catch (error) {
      console.warn('[CreateContentUseCase] Failed to load TechnicalTermsFilter, using original text:', error.message);
      filteredText = text;
      hasTechnicalTerms = false;
    }
    
    // Use filtered text for heuristic detection (more accurate for technical content)
    const heuristicLanguage = this.detectLanguageHeuristic(filteredText.length > 0 ? filteredText : text);
    if (heuristicLanguage) {
      console.log('[CreateContentUseCase] Language detected via heuristic (after filtering technical terms):', {
        language: heuristicLanguage,
        hasTechnicalTerms,
        originalLength: text.length,
        filteredLength: filteredText.length,
      });
      return heuristicLanguage;
    }

    // If heuristic didn't detect (likely English or other Latin-based language), try AI detection
    if (!this.aiGenerationService || !this.aiGenerationService.openaiClient) {
      console.log('[CreateContentUseCase] OpenAI client not available for language detection, defaulting to English (heuristic found no special characters)');
      // Default to English if we can't detect and no OpenAI (heuristic found no special characters = likely English)
      return 'en';
    }

    try {
      // Use filtered text for AI detection (removes technical terms that might confuse detection)
      const textForDetection = filteredText && filteredText.length > 50 ? filteredText : text;
      
      const prompt = `Detect the language of the following text and return only the ISO 639-1 language code (e.g., 'en', 'he', 'ar', 'es', 'fr').

CRITICAL INSTRUCTIONS:
1. This text is from a programming/development educational context
2. The text may contain technical English terms (programming keywords, technologies, tools)
3. IGNORE all technical English terms when detecting the language
4. Focus ONLY on the dominant language of the explanatory/educational text
5. Common technical English terms to IGNORE include: docker, kubernetes, react, vue, angular, node, express, API, REST, GraphQL, JSON, HTML, CSS, JavaScript, TypeScript, Python, Java, if, else, for, while, function, class, const, let, var, return, import, export, async, await, promise, callback, try, catch, SQL, NoSQL, MongoDB, PostgreSQL, MySQL, Redis, Git, GitHub, npm, yarn, server, client, database, backend, frontend, DevOps, HTTP, HTTPS, OAuth, JWT, algorithm, array, object, string, number, boolean, UI, UX, DOM, AJAX, CORS, CRUD, MVC, ORM, and similar programming/technical terms
6. If the explanatory text is primarily in Hebrew, Arabic, or another language, return that language code even if there are many English technical terms
7. Only return 'en' if the EXPLANATORY text itself is primarily in English

Text:
${textForDetection.substring(0, 500)}

Return only the 2-letter language code, nothing else.`;

      // Use openaiClient directly (not through AIGenerationService.generateText which requires language config)
      const response = await this.aiGenerationService.openaiClient.generateText(prompt, {
        systemPrompt: 'You are a language detection expert for educational programming content. Your task is to identify the PRIMARY language of the explanatory/educational text, completely ignoring any technical English programming terms (keywords, technologies, tools, frameworks). Focus on the language used for explanations, instructions, and educational content, not on technical terminology. Return only the ISO 639-1 language code (2 letters).',
        temperature: 0.1,
        max_tokens: 10,
      });

      if (!response || !response.trim()) {
        console.log('[CreateContentUseCase] Language detection returned empty response, defaulting to English (likely English content)');
        return 'en';
      }

      // Clean response - remove any punctuation or extra text
      const languageCode = response.trim().toLowerCase().replace(/[^a-z]/g, '').substring(0, 2);
      const validCodes = ['en', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'fa', 'ur'];
      
      if (validCodes.includes(languageCode)) {
        console.log('[CreateContentUseCase] Language detected via AI:', languageCode);
        return languageCode;
      }

      console.log('[CreateContentUseCase] Language detection returned invalid code:', languageCode, 'defaulting to English');
      // If AI returned invalid code, default to English (most common case)
      return 'en';
    } catch (error) {
      console.warn('[CreateContentUseCase] Language detection failed:', error.message, 'defaulting to English');
      // If AI detection fails, default to English (most common case)
      return 'en';
    }
  }

  /**
   * Heuristic language detection (fast, no API calls)
   * @param {string} text - Text to detect language for
   * @returns {string|null} Detected language code or null
   */
  detectLanguageHeuristic(text) {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Hebrew pattern
    const hebrewPattern = /[\u0590-\u05FF]/;
    if (hebrewPattern.test(text)) {
      return 'he';
    }

    // Arabic pattern
    const arabicPattern = /[\u0600-\u06FF]/;
    if (arabicPattern.test(text)) {
      return 'ar';
    }

    // Persian/Farsi pattern
    const persianPattern = /[\u06A0-\u06FF]/;
    if (persianPattern.test(text)) {
      return 'fa';
    }

    // Russian/Cyrillic pattern
    const cyrillicPattern = /[\u0400-\u04FF]/;
    if (cyrillicPattern.test(text)) {
      return 'ru';
    }

    // Chinese pattern
    const chinesePattern = /[\u4E00-\u9FFF]/;
    if (chinesePattern.test(text)) {
      return 'zh';
    }

    // Japanese pattern
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
    if (japanesePattern.test(text)) {
      return 'ja';
    }

    // Korean pattern
    const koreanPattern = /[\uAC00-\uD7AF]/;
    if (koreanPattern.test(text)) {
      return 'ko';
    }

    // If no special characters detected, likely English or other Latin-based language
    // Return null to allow AI detection or default to English
    return null;
  }
}



