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
import { getVoiceConfig } from '../config/heygen.js';

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
   * @param {string} [params.language] - Language code (for voice_id and locale)
   * @returns {Object} HeyGen Template v2 payload
   * @throws {Error} If validation fails
   */
  buildPayload({ templateId, slides, title, caption, voiceId, language = 'en' }) {
    // Validate inputs
    this._validateInputs({ templateId, slides, title, caption, voiceId });

    // Validate slides
    this._validateSlides(slides);

    // Build variables map
    const variables = this._buildVariables(slides, voiceId, language);

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

    // Final validation: check all required variables
    // 1. Avatar variable (image_1)
    if (!variables.image_1 || variables.image_1.type !== 'character') {
      throw new Error('Missing or invalid image_1 (avatar) variable');
    }
    if (!variables.image_1.name || variables.image_1.name !== 'image_1') {
      throw new Error('image_1 missing name field or name does not match key');
    }
    if (!variables.image_1.properties?.character_id) {
      throw new Error('image_1 missing character_id in properties');
    }

    // 2. Presentation image variables (imageOne-imageFive)
    const presentationImageNames = ['imageOne', 'imageTow', 'imageThree', 'imageFour', 'imageFive'];
    for (const imageName of presentationImageNames) {
      if (!variables[imageName] || variables[imageName].type !== 'image') {
        throw new Error(`Missing or invalid ${imageName} (presentation image) variable`);
      }
      if (!variables[imageName].name || variables[imageName].name !== imageName) {
        throw new Error(`${imageName} missing name field or name does not match key`);
      }
      if (!variables[imageName].properties?.url) {
        throw new Error(`${imageName} missing url in properties`);
      }
    }

    // 3. Speech variables (speech_1-speech_5)
    const speechVars = Object.keys(variables).filter(k => k.startsWith('speech_'));
    if (speechVars.length !== 5) {
      throw new Error(`Expected exactly 5 speech variables, got ${speechVars.length}`);
    }
    for (const speechKey of speechVars) {
      const speechVar = variables[speechKey];
      if (!speechVar || speechVar.type !== 'voice') {
        throw new Error(`Missing or invalid ${speechKey} (voice) variable`);
      }
      if (!speechVar.name || speechVar.name !== speechKey) {
        throw new Error(`${speechKey} missing name field or name does not match key`);
      }
      if (!speechVar.properties?.voice_id || !speechVar.properties?.input_text) {
        throw new Error(`${speechKey} missing voice_id or input_text in properties`);
      }
    }

    logger.info('[HeyGenTemplatePayloadBuilder] Built template payload', {
      templateId,
      slideCount: slides.length,
      variableCount: Object.keys(variables).length,
      hasCaption: caption,
      hasVoiceId: !!voiceId,
      hasAvatar: !!variables.image_1,
      presentationImagesCount: presentationImageNames.length,
      speechVariablesCount: speechVars.length,
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
   * @param {string} [voiceId] - Voice ID (if provided, use it; otherwise resolve from language)
   * @param {string} [language] - Language code (for voice_id resolution)
   * @returns {Object} Variables map with image_1 (avatar), imageOne-imageFive (presentation images), and speech_1-speech_5 (voices)
   */
  _buildVariables(slides, voiceId, language = 'en') {
    const variables = {};

    // Resolve voice_id from language if not provided
    let finalVoiceId = voiceId;
    
    if (!finalVoiceId) {
      const voiceConfig = getVoiceConfig(language);
      finalVoiceId = voiceConfig.voice_id;
    }

    // 1. Add avatar variable (image_1) - only one, fixed
    // Structure: { name: "image_1", type: "character", properties: { character_id: "...", type: "avatar" } }
    variables.image_1 = {
      name: 'image_1',
      type: 'character',
      properties: {
        character_id: 'Annie_Bar_Standing_Front_2_public',
        type: 'avatar',
      },
    };

    logger.info('[HeyGenTemplatePayloadBuilder] Building avatar variable (image_1)', {
      characterId: variables.image_1.properties.character_id,
    });

    // 2. Map slide index to presentation image variable names
    // Scene mapping: 1->imageOne, 2->imageTow, 3->imageThree, 4->imageFour, 5->imageFive
    const imageNameMap = {
      1: 'imageOne',
      2: 'imageTow',
      3: 'imageThree',
      4: 'imageFour',
      5: 'imageFive',
    };

    // 3. Sort slides by index to ensure correct ordering
    const sortedSlides = [...slides].sort((a, b) => a.index - b.index);

    // 4. Validate slide count (must be exactly 5)
    if (sortedSlides.length !== 5) {
      throw new Error(`Expected exactly 5 slides, got ${sortedSlides.length}`);
    }

    for (const slide of sortedSlides) {
      const slideNum = slide.index;

      // Validate slide index is 1-5
      if (slideNum < 1 || slideNum > 5) {
        throw new Error(`Slide index must be between 1 and 5, got ${slideNum}`);
      }

      // Add presentation image variable: imageOne, imageTow, imageThree, imageFour, imageFive
      // Structure: { name: "imageOne", type: "image", properties: { url: "...", fit: "none" } }
      const imageVarName = imageNameMap[slideNum];
      if (!imageVarName) {
        throw new Error(`No image variable name mapped for slide index ${slideNum}`);
      }

      const imageUrl = slide.imageUrl.trim();
      variables[imageVarName] = {
        name: imageVarName,
        type: 'image',
        properties: {
          url: imageUrl,
          fit: 'none',
        },
      };

      logger.info('[HeyGenTemplatePayloadBuilder] Building presentation image variable', {
        imageVarName,
        slideNum,
        imageUrl: imageUrl.substring(0, 100), // Log first 100 chars
      });

      // Add speech variable: speech_1, speech_2, ..., speech_5
      // Structure: { name: "speech_1", type: "voice", properties: { voice_id: "...", input_text: "..." } }
      const speechKey = `speech_${slideNum}`;
      variables[speechKey] = {
        name: speechKey,
        type: 'voice',
        properties: {
          voice_id: finalVoiceId,
          input_text: slide.speakerText.trim(), // The actual speech text from OpenAI
        },
      };

      logger.info('[HeyGenTemplatePayloadBuilder] Building speech variable (voice)', {
        speechKey,
        slideNum,
        voiceId: finalVoiceId,
        textLength: slide.speakerText.trim().length,
      });
    }

    return variables;
  }
}

