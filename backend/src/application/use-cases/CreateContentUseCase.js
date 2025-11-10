import { Content } from '../../domain/entities/Content.js';

/**
 * Create Content Use Case
 * Handles manual content creation with automatic quality check trigger
 */
export class CreateContentUseCase {
  constructor({ contentRepository, qualityCheckService, aiGenerationService }) {
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    this.aiGenerationService = aiGenerationService;
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

    const enrichedContentData = {
      ...contentData,
      content_data: { ...contentData.content_data },
    };

    // Auto-generate audio for manual text content when possible
    if (await this.shouldGenerateAudio(enrichedContentData)) {
      await this.attachGeneratedAudio(enrichedContentData);
    }

    // Set generation method to manual for manual creation
    const content = new Content({
      ...enrichedContentData,
      generation_method_id: enrichedContentData.generation_method_id || 'manual',
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

      const metadata = {
        ...(contentData.content_data?.metadata || {}),
        audioGeneratedAt: new Date().toISOString(),
      };

      contentData.content_data = {
        ...contentData.content_data,
        audioUrl: audioResult.audioUrl || contentData.content_data.audioUrl,
        audioFormat: audioResult.format || contentData.content_data.audioFormat,
        audioDuration: audioResult.duration || contentData.content_data.audioDuration,
        audioVoice: audioResult.voice || contentData.content_data.audioVoice,
        audioText: audioResult.text || text,
        metadata,
      };
    } catch (error) {
      console.warn('[CreateContentUseCase] Failed to auto-generate audio for manual text:', error.message);
    }
  }
}



