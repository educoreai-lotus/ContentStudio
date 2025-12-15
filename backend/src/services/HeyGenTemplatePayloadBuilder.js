/**
 * HeyGenTemplatePayloadBuilder Service
 * Builds request payload for HeyGen Template v2 generate API
 * 
 * Requirements:
 * - Input: templateId, slides (SlidePlan[]), title, caption (boolean), voiceId (optional)
 * - Output: request payload JSON for HeyGen Template v2 generate
 * - variables: map with keys image_1..image_10, speech_1..speech_10 from slides
 * - Do not include keys for slides that don't exist (if N<10)
 * - Validation: reject slides with missing imageUrl/speakerText
 */

import { logger } from '../infrastructure/logging/Logger.js';

/**
 * HeyGenTemplatePayloadBuilder Class
 * Builds payload for HeyGen Template API v2
 */
export class HeyGenTemplatePayloadBuilder {
  /**
   * Build HeyGen Template v2 generate payload
   * @param {Object} params - Payload parameters
   * @param {string} params.templateId - HeyGen template ID
   * @param {Array<{index: number, speakerText: string, imageUrl: string}>} params.slides - Slide plan items
   * @param {string} params.title - Video title
   * @param {boolean} params.caption - Enable captions
   * @param {string} [params.voiceId] - Optional voice ID
   * @returns {Object} HeyGen Template v2 payload
   * @throws {Error} If validation fails
   */
  buildPayload({ templateId, slides, title, caption, voiceId }) {
    // Validate inputs
    this._validateInputs({ templateId, slides, title, caption, voiceId });

    // Validate slides
    this._validateSlides(slides);

    // Build variables map
    const variables = this._buildVariables(slides);

    // Build base payload
    const payload = {
      template_id: templateId,
      title: title || 'EduCore Presentation',
      variables,
    };

    // Add caption settings if enabled
    if (caption) {
      payload.caption_settings = {
        enabled: true,
      };
    }

    // Add voice_id if provided
    if (voiceId) {
      payload.voice_id = voiceId;
    }

    logger.info('[HeyGenTemplatePayloadBuilder] Built template payload', {
      templateId,
      slideCount: slides.length,
      variableCount: Object.keys(variables).length,
      hasCaption: caption,
      hasVoiceId: !!voiceId,
    });

    return payload;
  }

  /**
   * Validate input parameters
   * @private
   * @param {Object} params - Input parameters
   * @throws {Error} If validation fails
   */
  _validateInputs({ templateId, slides, title, caption, voiceId }) {
    if (!templateId || typeof templateId !== 'string' || templateId.trim().length === 0) {
      throw new Error('templateId is required and must be a non-empty string');
    }

    if (!Array.isArray(slides)) {
      throw new Error('slides must be an array');
    }

    if (slides.length === 0) {
      throw new Error('slides array cannot be empty');
    }

    if (slides.length > 10) {
      throw new Error(`slides array cannot contain more than 10 slides. Received: ${slides.length}`);
    }

    if (title !== undefined && title !== null && typeof title !== 'string') {
      throw new Error('title must be a string if provided');
    }

    if (caption !== undefined && caption !== null && typeof caption !== 'boolean') {
      throw new Error('caption must be a boolean if provided');
    }

    if (voiceId !== undefined && voiceId !== null && typeof voiceId !== 'string') {
      throw new Error('voiceId must be a string if provided');
    }
  }

  /**
   * Validate slides array
   * @private
   * @param {Array} slides - Slides array
   * @throws {Error} If validation fails
   */
  _validateSlides(slides) {
    const indices = new Set();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      if (!slide || typeof slide !== 'object') {
        throw new Error(`Slide at position ${i} must be an object`);
      }

      // Validate index
      if (typeof slide.index !== 'number' || !Number.isInteger(slide.index)) {
        throw new Error(`Slide at position ${i} must have a valid integer index`);
      }

      if (slide.index < 1 || slide.index > 10) {
        throw new Error(`Slide index must be between 1 and 10. Received: ${slide.index}`);
      }

      if (indices.has(slide.index)) {
        throw new Error(`Duplicate slide index: ${slide.index}`);
      }
      indices.add(slide.index);

      // Validate speakerText (required)
      if (!slide.speakerText || typeof slide.speakerText !== 'string' || slide.speakerText.trim().length === 0) {
        throw new Error(`Slide at index ${slide.index} must have a non-empty speakerText`);
      }

      // Validate imageUrl (required)
      if (!slide.imageUrl || typeof slide.imageUrl !== 'string' || slide.imageUrl.trim().length === 0) {
        throw new Error(`Slide at index ${slide.index} must have a non-empty imageUrl`);
      }

      // Validate imageUrl is a valid URL
      try {
        new URL(slide.imageUrl);
      } catch (urlError) {
        throw new Error(`Slide at index ${slide.index} must have a valid URL for imageUrl. Received: ${slide.imageUrl}`);
      }
    }

    // Validate indices are sequential (1..N)
    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
    for (let i = 0; i < sortedIndices.length; i++) {
      if (sortedIndices[i] !== i + 1) {
        throw new Error(`Slide indices must be sequential starting from 1. Expected ${i + 1}, found ${sortedIndices[i]}`);
      }
    }
  }

  /**
   * Build variables map from slides
   * @private
   * @param {Array<{index: number, speakerText: string, imageUrl: string}>} slides - Slides array
   * @returns {Object} Variables map with image_N and speech_N keys
   */
  _buildVariables(slides) {
    const variables = {};

    // Sort slides by index to ensure correct ordering
    const sortedSlides = [...slides].sort((a, b) => a.index - b.index);

    for (const slide of sortedSlides) {
      const slideNum = slide.index;

      // Add image variable: image_1, image_2, ..., image_10
      // HeyGen Template API v2 expects variables in format: { name: "...", type: "image", properties: { url: "..." } }
      // Reference: https://docs.heygen.com/docs/generate-video-from-template-v2
      const imageUrl = slide.imageUrl.trim();
      const imageKey = `image_${slideNum}`;
      
      variables[imageKey] = {
        name: imageKey,
        type: 'image',
        properties: {
          url: imageUrl,
        },
      };

      // Add speech variable: speech_1, speech_2, ..., speech_10
      // HeyGen Template API v2 expects text variables in format: { name: "...", type: "text", properties: { content: "..." } }
      const speechKey = `speech_${slideNum}`;
      variables[speechKey] = {
        name: speechKey,
        type: 'text',
        properties: {
          content: slide.speakerText.trim(),
        },
      };
    }

    return variables;
  }
}

