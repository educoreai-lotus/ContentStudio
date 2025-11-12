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
   * Keeps: presentation data, googleSlidesUrl, essential metadata
   * 
   * @param {Object} contentData - Raw content data
   * @returns {Object} Cleaned content data
   */
  static cleanPresentationData(contentData) {
    if (!contentData || typeof contentData !== 'object') {
      return contentData;
    }

    const cleaned = {
      presentation: contentData.presentation,
    };

    if (contentData.format) {
      cleaned.format = contentData.format;
    }
    if (contentData.slide_count !== undefined) {
      cleaned.slide_count = contentData.slide_count;
    }
    if (contentData.googleSlidesUrl || contentData.storageUrl) {
      cleaned.googleSlidesUrl = contentData.googleSlidesUrl || contentData.storageUrl;
    }

    // Keep only essential metadata (style, generated_at), remove topic/skills/language metadata
    if (contentData.metadata) {
      const essentialMetadata = {};
      if (contentData.metadata.style) {
        essentialMetadata.style = contentData.metadata.style;
      }
      if (contentData.metadata.generated_at) {
        essentialMetadata.generated_at = contentData.metadata.generated_at;
      }
      if (contentData.metadata.googleSlidesUrl) {
        essentialMetadata.googleSlidesUrl = contentData.metadata.googleSlidesUrl;
      }
      
      // Remove: language (redundant - stored in topics table)
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
   * Removes: redundant metadata, language (duplicate), fallback flag, error (if null)
   * Keeps: script, videoUrl, videoId, duration, status
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
    if (contentData.status) {
      cleaned.status = contentData.status;
    }

    // Remove: language (redundant - stored in topics table)
    // Remove: fallback (technical flag, not needed for display)

    // Keep only essential metadata (heygen_video_url, generation_status), remove topic/skills/language/error metadata
    if (contentData.metadata) {
      const essentialMetadata = {};
      if (contentData.metadata.heygen_video_url) {
        essentialMetadata.heygen_video_url = contentData.metadata.heygen_video_url;
      }
      if (contentData.metadata.generation_status) {
        essentialMetadata.generation_status = contentData.metadata.generation_status;
      }
      if (contentData.metadata.storage_fallback !== undefined) {
        essentialMetadata.storage_fallback = contentData.metadata.storage_fallback;
      }
      
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

