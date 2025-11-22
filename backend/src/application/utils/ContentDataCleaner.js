/**
 * Content Data Cleaner Utility
 * Removes duplicate and redundant fields from content_data JSON
 * 
 * This ensures content_data only contains essential fields for display/playback,
 * removing data that's already stored in relational tables (topics, skills, etc.)
 */

export class ContentDataCleaner {
  /**
   * Clean content_data for text + audio content type
   * Removes: audioText (duplicate of text), metadata (redundant)
   * Keeps: text, audioUrl, audioVoice, audioFormat, audioDuration
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanTextAudioData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {
      text: contentData.text,
    };

    // Add audio fields only if they exist
    if (contentData.audioUrl) {
      cleaned.audioUrl = contentData.audioUrl;
    }
    if (contentData.audioVoice) {
      cleaned.audioVoice = contentData.audioVoice;
    }
    if (contentData.audioFormat) {
      cleaned.audioFormat = contentData.audioFormat;
    }
    if (contentData.audioDuration !== undefined && contentData.audioDuration !== null) {
      cleaned.audioDuration = contentData.audioDuration;
    }

    // Explicitly remove redundant fields
    // audioText is removed (duplicate of text)
    // metadata is removed (language, skillsList, lessonTopic, lessonDescription are in other tables)

    return cleaned;
  }

  /**
   * Clean content_data for code content type
   * Removes: metadata with redundant topic/skills info
   * Keeps: code, language, explanation, and essential metadata
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanCodeData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {
      code: contentData.code,
    };

    if (contentData.language) {
      cleaned.language = contentData.language;
    }
    if (contentData.explanation) {
      cleaned.explanation = contentData.explanation;
    }

    // Keep only programming_language in metadata if it exists, remove topic/skills metadata
    if (contentData.metadata?.programming_language) {
      cleaned.metadata = {
        programming_language: contentData.metadata.programming_language,
      };
    }

    return cleaned;
  }

  /**
   * Clean content_data for presentation content type
   * Removes: redundant metadata (lessonTopic, lessonDescription, language, skillsList)
   * Keeps: Gamma presentation URLs, essential metadata
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanPresentationData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {};

    // MANDATORY: Keep format, presentationUrl, and storagePath at top level
    if (contentData.format) {
      cleaned.format = contentData.format;
    }
    if (contentData.presentationUrl) {
      // Validate that it's not a gammaUrl
      if (contentData.presentationUrl.includes('gamma.app')) {
        throw new Error('Invalid presentation URL in content data: External Gamma URL detected. All presentations must be stored in Supabase Storage.');
      }
      cleaned.presentationUrl = contentData.presentationUrl;
    }
    if (contentData.storagePath) {
      cleaned.storagePath = contentData.storagePath;
    }

    // Keep only essential metadata, remove topic/skills/language metadata
    // DO NOT include presentationUrl or storagePath in metadata - they're top-level fields
    if (contentData.metadata) {
      const essentialMetadata = {};
      if (contentData.metadata.generated_at) {
        essentialMetadata.generated_at = contentData.metadata.generated_at;
      }
      if (contentData.metadata.source) {
        essentialMetadata.source = contentData.metadata.source;
      }
      if (contentData.metadata.audience) {
        essentialMetadata.audience = contentData.metadata.audience;
      }
      if (contentData.metadata.language) {
        essentialMetadata.language = contentData.metadata.language;
      }
      if (contentData.metadata.gamma_generation_id) {
        essentialMetadata.gamma_generation_id = contentData.metadata.gamma_generation_id;
      }
      if (contentData.metadata.gamma_raw_response) {
        essentialMetadata.gamma_raw_response = contentData.metadata.gamma_raw_response;
      }
      if (contentData.metadata.deckId) {
        essentialMetadata.deckId = contentData.metadata.deckId;
      }
      if (contentData.metadata.embedUrl) {
        essentialMetadata.embedUrl = contentData.metadata.embedUrl;
      }
      if (contentData.metadata.audience) {
        essentialMetadata.audience = contentData.metadata.audience;
      }
      if (contentData.metadata.source) {
        essentialMetadata.source = contentData.metadata.source;
      }
      if (contentData.metadata.gamma_raw_response) {
        essentialMetadata.gamma_raw_response = contentData.metadata.gamma_raw_response;
      }
      
      // Remove: lessonTopic, lessonDescription, skillsList (redundant - stored in topics/skills tables)
      
      if (Object.keys(essentialMetadata).length > 0) {
        cleaned.metadata = essentialMetadata;
      }
    }

    return cleaned;
  }

  /**
   * Clean content_data for audio content type
   * Removes: redundant metadata, text (duplicate), audio buffer
   * Keeps: audioUrl, audioFormat, audioDuration, audioVoice
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanAudioData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {};

    if (contentData.audioUrl) {
      cleaned.audioUrl = contentData.audioUrl;
    }
    if (contentData.audioVoice) {
      cleaned.audioVoice = contentData.audioVoice;
    }
    if (contentData.audioFormat) {
      cleaned.audioFormat = contentData.audioFormat;
    }
    if (contentData.audioDuration !== undefined && contentData.audioDuration !== null) {
      cleaned.audioDuration = contentData.audioDuration;
    }

    // Remove: text (duplicate, not needed for playback)
    // Remove: audio buffer (not needed, we have URL)
    // Remove: metadata (original_text_length, converted_text_length, word_count are redundant)

    return cleaned;
  }

  /**
   * Clean content_data for mind map content type
   * Removes: redundant metadata
   * Keeps: mind map structure (nodes, edges)
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanMindMapData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {};

    if (contentData.nodes) {
      cleaned.nodes = contentData.nodes;
    }
    if (contentData.edges) {
      cleaned.edges = contentData.edges;
    }
    if (contentData.root) {
      cleaned.root = contentData.root;
    }

    // Remove metadata (redundant topic/skills info)

    return cleaned;
  }

  /**
   * Clean content_data for avatar video content type
   * Removes: status, redundant metadata, language (duplicate), fallback flag, error (if null)
   * Keeps: script, videoUrl, videoId, duration, heygen_video_url
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanAvatarVideoData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {};

    if (contentData.script) {
      cleaned.script = contentData.script;
    }
    if (contentData.videoUrl) {
      cleaned.videoUrl = contentData.videoUrl;
    }
    if (contentData.videoId) {
      cleaned.videoId = contentData.videoId;
    }
    if (contentData.duration_seconds !== undefined) {
      cleaned.duration_seconds = contentData.duration_seconds;
    }

    // Keep status and reason for skipped/failed states (needed for proper error handling)
    if (contentData.status === 'skipped' || contentData.status === 'failed') {
      cleaned.status = contentData.status;
      if (contentData.reason) {
        cleaned.reason = contentData.reason;
      }
    }
    // Also keep error fields for failed status
    if (contentData.status === 'failed') {
      if (contentData.error) {
        cleaned.error = contentData.error;
      }
      if (contentData.errorCode) {
        cleaned.errorCode = contentData.errorCode;
      }
    }

    // Remove: status is now kept for skipped/failed, but removed for success (can be inferred from videoUrl presence)
    // Remove: language (redundant - stored in topics table)
    // Remove: fallback (technical flag, not needed for display)

    // Keep only essential metadata (heygen_video_url), remove status/generation_status/storage_fallback
    if (contentData.metadata) {
      const essentialMetadata = {};
      if (contentData.metadata.heygen_video_url) {
        essentialMetadata.heygen_video_url = contentData.metadata.heygen_video_url;
      }
      
      // Remove: generation_status (redundant - can be inferred from videoUrl)
      // Remove: storage_fallback (technical flag, not needed for display)
      // Remove: error (if null or not needed for display)
      // Remove: language (redundant - stored in topics table)
      
      if (Object.keys(essentialMetadata).length > 0) {
        cleaned.metadata = essentialMetadata;
      }
    }

    return cleaned;
  }

  /**
   * Clean content_data based on content type ID
   * 
   * @param {Object} contentData - Raw content data
   * @param {number} contentTypeId - Content type ID (1=text, 2=code, 3=presentation, 4=audio, 5=mind_map, 6=avatar_video)
   * @returns {Object} Cleaned content data
   */
  static clean(contentData, contentTypeId) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    switch (contentTypeId) {
      case 1: // text + audio
        return this.cleanTextAudioData(contentData);
      case 2: // code
        return this.cleanCodeData(contentData);
      case 3: // presentation
        return this.cleanPresentationData(contentData);
      case 4: // audio
        return this.cleanAudioData(contentData);
      case 5: // mind_map
        return this.cleanMindMapData(contentData);
      case 6: // avatar_video
        return this.cleanAvatarVideoData(contentData);
      default:
        // For unknown types, return as-is but log a warning
        console.warn(`[ContentDataCleaner] Unknown content type ID: ${contentTypeId}, returning data as-is`);
        return contentData;
    }
  }
}

