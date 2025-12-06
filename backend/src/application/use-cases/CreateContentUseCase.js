import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { pushStatus, createStatusMessages } from '../utils/StatusMessages.js';
import { FileTextExtractor } from '../../services/FileTextExtractor.js';

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

    // Determine generation_method_id based on business logic
    const determinedGenerationMethod = await this.determineGenerationMethod(
      contentData.topic_id,
      enrichedContentData.generation_method_id,
      enrichedContentData.content_type_id,
      enrichedContentData.content_data
    );

    // Set generation method based on business logic
    const content = new Content({
      ...enrichedContentData,
      generation_method_id: determinedGenerationMethod,
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
            const contentText = await this.extractTextForLanguageValidation(content);
            
            // If extractTextForLanguageValidation returns null (e.g., failed to extract text from file),
            // we cannot validate language - this is an error for presentations
            if (contentText === null) {
              // For presentations (type 3), if we can't extract text, we cannot validate language
              // This is a critical error - we need text to validate language
              if (content.content_type_id === 3 || content.content_type_id === '3' || content.content_type_id === 'presentation') {
                const errorMessage = 'Failed to extract text from presentation file. Cannot validate language without text content. Please ensure the presentation file is valid and contains text.';
                const error = new Error(errorMessage);
                error.code = 'LANGUAGE_DETECTION_FAILED';
                error.details = {
                  topic_id: topic.topic_id,
                  content_type_id: content.content_type_id,
                  reason: 'Text extraction failed - no text found in presentation file',
                };
                throw error;
              }
              // For other content types, skip language validation if no text
              console.log('[CreateContentUseCase] Language validation skipped - no extractable text:', {
                content_type_id: content.content_type_id,
                topic_id: topic.topic_id,
              });
            }
            // For code content without explanation, skip language validation (code should be in English)
            else if (content.content_type_id === 2 || content.content_type_id === 'code' || content.content_type_id === '2') {
              const isCodeContent = true;
              if (!contentText || contentText.trim().length === 0) {
                console.log('[CreateContentUseCase] Code content without explanation - skipping language validation (code should be in English):', {
                  content_type_id: content.content_type_id,
                  topic_id: topic.topic_id,
                });
                // Skip language validation for code without explanation
              } else if (contentText && contentText.trim().length > 0) {
                // Detect language of explanation only
                const detectedLanguage = await this.detectContentLanguage(contentText);
                
                // Skip validation if text is too short (placeholder like "Manual Entry")
                if (detectedLanguage === null) {
                  console.log('[CreateContentUseCase] Language detection skipped - text too short (likely placeholder):', {
                    textLength: contentText.trim().length,
                    textPreview: contentText.substring(0, 50),
                    topic_id: topic.topic_id,
                  });
                  // Skip language validation for placeholder texts
                }
                // If language is detected but doesn't match, block creation
                else if (contentText.trim().length >= 10 && detectedLanguage !== expectedLanguage) {
                  console.warn('[CreateContentUseCase] Language mismatch detected - blocking creation:', {
                    expected_language: expectedLanguage,
                    detected_language: detectedLanguage,
                    topic_id: topic.topic_id,
                    content_type_id: content.content_type_id,
                  });
                  const errorMessage = `Explanation language (${detectedLanguage}) does not match expected language (${expectedLanguage}). Code should be in English, but explanation should be in ${expectedLanguage}.`;
                  const error = new Error(errorMessage);
                  error.code = 'LANGUAGE_MISMATCH';
                  error.details = {
                    expected_language: expectedLanguage,
                    detected_language: detectedLanguage,
                    topic_id: topic.topic_id,
                    content_type_id: content.content_type_id,
                    is_code_content: true,
                  };
                  throw error;
                }
                
                // Language matches or was skipped - proceed
                if (detectedLanguage !== null) {
                  console.log('[CreateContentUseCase] ✅ Language validation passed for code explanation:', {
                    expected_language: expectedLanguage,
                    detected_language: detectedLanguage,
                    content_type_id: content.content_type_id,
                  });
                }
              }
            } else if (contentText && contentText.trim().length > 0) {
              // Detect language of content
              // detectContentLanguage may return null if text is too short (placeholder text)
              const detectedLanguage = await this.detectContentLanguage(contentText);
              
              // Skip validation if text is too short (placeholder like "Manual Entry")
              if (detectedLanguage === null) {
                console.log('[CreateContentUseCase] Language detection skipped - text too short (likely placeholder):', {
                  textLength: contentText.trim().length,
                  textPreview: contentText.substring(0, 50),
                  topic_id: topic.topic_id,
                });
                // Skip language validation for placeholder texts
                // Continue with content creation
              }
              // If language is detected but doesn't match, block creation
              // Only check mismatch if we have a valid detection (not null) and text is long enough
              else if (contentText.trim().length >= 10 && detectedLanguage !== expectedLanguage) {
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
              
              // Language matches or was skipped - proceed
              if (detectedLanguage !== null) {
                console.log('[CreateContentUseCase] ✅ Language validation passed - proceeding with DB save and quality check:', {
                  expected_language: expectedLanguage,
                  detected_language: detectedLanguage,
                  content_type_id: content.content_type_id,
                });
              }
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

      // Re-determine generation_method_id for update (may need to change to Mixed)
      const updatedGenerationMethod = await this.determineGenerationMethod(
        content.topic_id,
        content.generation_method_id,
        content.content_type_id,
        content.content_data
      );

      // Save content WITHOUT audio first (if quality check is needed)
      let updatedContent = await this.contentRepository.update(existingContent.content_id, {
        content_data: content.content_data,
        quality_check_status: 'pending',
        quality_check_data: null,
        generation_method_id: updatedGenerationMethod,
      });

      // Update topic's generation_methods_id based on updated content's generation_method_id
      await this.updateTopicGenerationMethod(content.topic_id, updatedGenerationMethod);

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
    
    // Update topic's generation_methods_id based on content's generation_method_id
    await this.updateTopicGenerationMethod(content.topic_id, createdContent.generation_method_id);
    
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
   * @async
   */
  async extractTextForLanguageValidation(content) {
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
    
    // For presentations (content_type_id === 3), extract text from slides
    if (contentTypeId === 3 || contentTypeId === '3' || contentTypeId === 'presentation') {
      // Check for slides array in different possible locations
      if (content.content_data?.slides && Array.isArray(content.content_data.slides)) {
        const slideTexts = content.content_data.slides
          .map(slide => slide.text || slide.title || slide.content || slide.body || '')
          .filter(Boolean)
          .join('\n');
        if (slideTexts.trim().length > 0) {
          return slideTexts;
        }
      }
      
      // Check for nested presentation.slides
      if (content.content_data?.presentation?.slides && Array.isArray(content.content_data.presentation.slides)) {
        const slideTexts = content.content_data.presentation.slides
          .map(slide => slide.text || slide.title || slide.content || slide.body || '')
          .filter(Boolean)
          .join('\n');
        if (slideTexts.trim().length > 0) {
          return slideTexts;
        }
      }
      
      // Check for presentation as object/array
      if (content.content_data?.presentation) {
        const presentationData = content.content_data.presentation;
        if (Array.isArray(presentationData)) {
          const slideTexts = presentationData
            .map(slide => slide.text || slide.title || slide.content || slide.body || '')
            .filter(Boolean)
            .join('\n');
          if (slideTexts.trim().length > 0) {
            return slideTexts;
          }
        } else if (typeof presentationData === 'object') {
          // Try to extract text from presentation object
          const presentationText = JSON.stringify(presentationData);
          if (presentationText && presentationText.length > 50) {
            return presentationText;
          }
        }
      }
      
      // For manual presentations (fileUrl only, no slides), try to extract text from the file
      if (content.content_data?.fileUrl || content.content_data?.presentationUrl) {
        const fileUrl = content.content_data?.fileUrl || content.content_data?.presentationUrl;
        const ext = fileUrl.toLowerCase();
        
        // Check if it's a supported file type
        if (ext.endsWith('.pptx') || ext.endsWith('.ppt') || ext.endsWith('.pdf')) {
          try {
            console.log('[CreateContentUseCase] Attempting to extract text from presentation file for language validation:', {
              fileUrl: fileUrl.substring(0, 100) + '...',
              extension: ext.substring(ext.lastIndexOf('.')),
            });
            
            // Download and extract text from file (pass content_data and openaiClient for Vision fallback)
            const openaiClient = this.qualityCheckService?.openaiClient || null;
            const fileText = await FileTextExtractor.extractTextFromUrl(fileUrl, content.content_data, openaiClient);
            
            if (fileText && fileText.trim().length >= 10) {
              console.log('[CreateContentUseCase] ✅ Successfully extracted text from presentation file:', {
                textLength: fileText.length,
                preview: fileText.substring(0, 100),
              });
              return fileText; // Real text extracted => proceed with language detection
            } else {
              // If we can't extract text from presentation file, we cannot validate language
              // This is a critical error - throw error instead of returning null
              const errorMessage = 'Failed to extract text from presentation file. Cannot validate language without text content. Please ensure the presentation file is valid and contains text.';
              const error = new Error(errorMessage);
              error.code = 'LANGUAGE_DETECTION_FAILED';
              error.details = {
                topic_id: content.topic_id,
                content_type_id: content.content_type_id,
                reason: 'Text extraction failed - no text found in presentation file or text too short',
                fileUrl: fileUrl.substring(0, 100) + '...',
              };
              throw error;
            }
          } catch (error) {
            // If it's already a LANGUAGE_DETECTION_FAILED error, re-throw it
            if (error.code === 'LANGUAGE_DETECTION_FAILED') {
              throw error;
            }
            // For other errors, wrap them as LANGUAGE_DETECTION_FAILED
            console.error('[CreateContentUseCase] Failed to extract text from presentation file:', {
              error: error.message,
              fileUrl: fileUrl.substring(0, 100) + '...',
            });
            const detectionError = new Error(`Failed to extract text from presentation file: ${error.message}. Cannot validate language without text content.`);
            detectionError.code = 'LANGUAGE_DETECTION_FAILED';
            detectionError.details = {
              topic_id: content.topic_id,
              content_type_id: content.content_type_id,
              reason: `Text extraction error: ${error.message}`,
              fileUrl: fileUrl.substring(0, 100) + '...',
            };
            throw detectionError;
          }
        } else {
          console.log('[CreateContentUseCase] Presentation file URL has unsupported extension, skipping file extraction');
          // Fall through to metadata extraction below
        }
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
   * Detect language of content text using multiple methods
   * @param {string} text - Text to detect language for
   * @returns {Promise<string|null>} Detected language code, or null if text is too short (placeholder)
   */
  async detectContentLanguage(text) {
    if (!text || text.trim().length === 0) {
      console.warn('[CreateContentUseCase] Empty text provided for language detection, defaulting to English');
      return 'en';
    }

    // If text is too short (< 10 chars), skip detection
    // Short texts like "Manual Entry" will always be detected as English
    // Return null to skip validation for placeholder texts
    if (text.trim().length < 10) {
      console.log('[CreateContentUseCase] Text too short for reliable language detection, skipping:', {
        textLength: text.trim().length,
        textPreview: text.substring(0, 50),
      });
      return null; // Return null to indicate detection should be skipped
    }

    // STEP 1: Ratio-based detection (most accurate for presentations and technical content)
    // This detects language based on character percentage, which works even with many English technical terms
    try {
      const { detectLanguageByRatio } = await import('../utils/LanguageRatioDetector.js');
      const ratioLang = detectLanguageByRatio(text);
      if (ratioLang) {
        console.log('[CreateContentUseCase] Language detected via ratio-based detection:', {
          language: ratioLang,
          textLength: text.length,
          textPreview: text.substring(0, 100),
        });
        return ratioLang;
      }
    } catch (error) {
      console.warn('[CreateContentUseCase] Failed to load LanguageRatioDetector, continuing with other methods:', error.message);
    }

    // STEP 2: Import technical terms filter (dynamic import to avoid circular dependencies)
    let filterTechnicalTerms, analyzeLanguageWithTechnicalTerms, filteredText, hasTechnicalTerms;
    try {
      const technicalTermsModule = await import('../utils/TechnicalTermsFilter.js');
      filterTechnicalTerms = technicalTermsModule.filterTechnicalTerms;
      analyzeLanguageWithTechnicalTerms = technicalTermsModule.analyzeLanguageWithTechnicalTerms;
      
      // Analyze text with technical terms consideration
      const analysis = analyzeLanguageWithTechnicalTerms(text);
      
      // Prioritize non-English languages even with low confidence
      // This is important because technical terms can make English seem dominant
      if (analysis.dominantLanguage !== 'en') {
        console.log('[CreateContentUseCase] Language detected via technical terms analysis (prioritizing non-English):', {
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
      
      const prompt = `You are a language detection expert. Analyze the following text and determine its PRIMARY language.

CRITICAL: This is educational programming/development content that may contain technical English terms mixed with another language.

YOUR TASK (IN ORDER OF PRIORITY):
1. FIRST: Check for non-Latin script characters. If you see ANY Arabic (ا-ي), Hebrew (א-ת), Persian, Cyrillic, Chinese, Japanese, or Korean characters, return that language code IMMEDIATELY, even if there are many English technical terms.
2. SECOND: If no non-Latin characters, identify the DOMINANT language of the EXPLANATORY/EDUCATIONAL text (not code or technical terms)
3. COMPLETELY IGNORE all technical English programming terms, even if they appear frequently
4. Look for patterns of the actual language used for explanations, instructions, and educational content
5. Only return 'en' if the EXPLANATORY sentences themselves are in English AND there are no non-Latin characters

LANGUAGE DETECTION RULES:
- Arabic characters (ا-ي) → ALWAYS return 'ar' (even if only 1-2 characters)
- Hebrew characters (א-ת) → ALWAYS return 'he' (even if only 1-2 characters)
- Persian/Farsi characters → ALWAYS return 'fa'
- Cyrillic characters (А-Я) → ALWAYS return 'ru'
- Chinese characters (汉字) → ALWAYS return 'zh'
- Japanese characters (ひらがな, カタカナ, 漢字) → ALWAYS return 'ja'
- Korean characters (한글) → ALWAYS return 'ko'
- Spanish, French, German, Italian, Portuguese → 'es', 'fr', 'de', 'it', 'pt'

TECHNICAL TERMS TO IGNORE (do not count these as English):
- Programming keywords: if, else, for, while, function, class, const, let, var, return, import, export, async, await, try, catch
- Technologies: docker, kubernetes, react, vue, angular, node, express, API, REST, GraphQL, JSON, HTML, CSS, JavaScript, TypeScript, Python, Java
- Tools: Git, GitHub, npm, yarn, webpack, MongoDB, PostgreSQL, MySQL, Redis
- Concepts: server, client, database, backend, frontend, DevOps, HTTP, HTTPS, OAuth, JWT, algorithm, array, object, string, number, boolean

EXAMPLES:
- "في هذا الدرس سنتعلم عن docker containers" → 'ar' (Arabic, ignore "docker")
- "في docker" → 'ar' (Even with just 2 Arabic words, return 'ar')
- "בשיעור זה נלמד על React components" → 'he' (Hebrew, ignore "React")
- "En esta lección aprenderemos sobre docker" → 'es' (Spanish, ignore "docker")
- "Dans cette leçon, nous apprendrons sur docker" → 'fr' (French, ignore "docker")
- "В этом уроке мы изучим docker containers" → 'ru' (Russian, ignore "docker")
- "In this lesson we will learn about docker" → 'en' (English explanatory text)

Text to analyze:
${textForDetection.substring(0, 500)}

Return ONLY the 2-letter ISO 639-1 language code (e.g., 'en', 'he', 'ar', 'es', 'fr'). Nothing else.`;

      // Use openaiClient directly (not through AIGenerationService.generateText which requires language config)
      const response = await this.aiGenerationService.openaiClient.generateText(prompt, {
        systemPrompt: 'You are a specialized language detection expert for educational programming content. CRITICAL RULES: 1) If you see ANY Arabic characters (ا-ي), return "ar" IMMEDIATELY. 2) If you see ANY Hebrew characters (א-ת), return "he" IMMEDIATELY. 3) If you see ANY non-Latin script characters, return that language code. 4) Completely ignore ALL technical English programming terms, keywords, technologies, and tools. 5) Only return "en" if the explanatory sentences themselves are in English AND there are NO non-Latin characters. Return ONLY the 2-letter ISO 639-1 language code, nothing else.',
        temperature: 0.0, // Lower temperature for more consistent results
        max_tokens: 5, // Only need 2 letters
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

    // Arabic pattern - check FIRST (most common issue)
    // Even 1 Arabic character should be detected
    const arabicPattern = /[\u0600-\u06FF]/;
    if (arabicPattern.test(text)) {
      console.log('[CreateContentUseCase] Arabic characters detected in heuristic check');
      return 'ar';
    }

    // Hebrew pattern
    const hebrewPattern = /[\u0590-\u05FF]/;
    if (hebrewPattern.test(text)) {
      console.log('[CreateContentUseCase] Hebrew characters detected in heuristic check');
      return 'he';
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

  /**
   * Determine generation_method_id based on business logic:
   * - First format: manual or ai_assisted/ai_generated (based on input)
   * - Second+ format: Mixed if any previous format used AI, otherwise keep original
   * - Video to lesson: video_to_lesson
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
            console.warn('[CreateContentUseCase] Failed to convert generation_method_id to name:', error.message);
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
          console.warn('[CreateContentUseCase] Failed to convert generation_method_id to name:', error.message);
        }
      }
      return 'manual'; // Default fallback
    } catch (error) {
      console.error('[CreateContentUseCase] Failed to determine generation method:', error.message);
      // Fallback to provided method or manual
      return providedMethod || 'manual';
    }
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
        console.warn('[CreateContentUseCase] Failed to convert method name to ID:', method, error.message);
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
    if (!this.topicRepository) {
      console.warn('[CreateContentUseCase] TopicRepository not available, skipping topic generation_methods_id update');
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
      if (topicMethodId !== null) {
        await this.topicRepository.update(topicId, {
          generation_methods_id: topicMethodId,
        });
        console.log('[CreateContentUseCase] Updated topic generation_methods_id', {
          topic_id: topicId,
          generation_methods_id: topicMethodId,
        });
      }
    } catch (error) {
      console.error('[CreateContentUseCase] Failed to update topic generation_methods_id:', error.message);
      // Don't throw - this is a non-critical update
    }
  }
}



