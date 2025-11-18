import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { pushStatus, createStatusMessages } from '../utils/StatusMessages.js';

/**
 * Create Content Use Case
 * Handles manual content creation with automatic quality check trigger
 */
export class CreateContentUseCase {
  constructor({ contentRepository, qualityCheckService, aiGenerationService, contentHistoryService }) {
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    this.aiGenerationService = aiGenerationService;
    this.contentHistoryService = contentHistoryService;
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

    // Check if this is manual content that needs quality check BEFORE audio generation
    const isManualContent = content.generation_method_id === 'manual' || content.generation_method_id === 'manual_edited';
    const needsQualityCheck = isManualContent && this.qualityCheckService;
    
    console.log('[CreateContentUseCase] Quality check evaluation:', {
      generation_method_id: content.generation_method_id,
      isManualContent,
      hasQualityCheckService: !!this.qualityCheckService,
      needsQualityCheck,
      hasExistingContent: !!existingContent,
    });

    // Save existing content to history BEFORE creating/updating new content
    if (existingContent && this.contentHistoryService?.saveVersion) {
      try {
        console.log('[CreateContentUseCase] Saving existing content to history before update:', {
          content_id: existingContent.content_id,
          topic_id: existingContent.topic_id,
          content_type_id: existingContent.content_type_id,
        });
        await this.contentHistoryService.saveVersion(existingContent, { force: true });
        console.log('[CreateContentUseCase] Successfully saved content to history');
      } catch (error) {
        console.error('[CreateContentUseCase] Failed to save previous version before update:', error.message, error.stack);
      }
    } else if (existingContent && !this.contentHistoryService?.saveVersion) {
      console.warn('[CreateContentUseCase] ContentHistoryService not available, skipping history save');
    }

    if (existingContent) {

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
          console.error('[CreateContentUseCase] ❌ Quality check failed, rejecting content:', error.message);
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
      if (await this.shouldGenerateAudio(enrichedContentData)) {
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
    let createdContent = await this.contentRepository.create(content);

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
        }
      } catch (error) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
        // Re-throw if quality check fails (content should be rejected, no audio generation)
        console.error('[CreateContentUseCase] ❌ Quality check failed, rejecting content:', error.message);
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

    // Generate audio ONLY if quality check passed (or if not needed)
    if (await this.shouldGenerateAudio(enrichedContentData)) {
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
      contentTypeId === 'text';

    if (!isTextType) {
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
}



