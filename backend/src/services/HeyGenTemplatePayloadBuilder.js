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

    // Final validation: log all character variables (image_N) and voice variables (speech_N)
    const imageVars = Object.keys(variables).filter(k => k.startsWith('image_'));
    const speechVars = Object.keys(variables).filter(k => k.startsWith('speech_'));
    
    for (const imageKey of imageVars) {
      const imageVar = variables[imageKey];
      if (!imageVar?.character?.character_id) {
        logger.error('[HeyGenTemplatePayloadBuilder] Image variable missing character_id', {
          imageKey,
          imageVar: JSON.stringify(imageVar, null, 2),
        });
        throw new Error(`Image variable ${imageKey} is missing character_id field`);
      }
    }
    
    for (const speechKey of speechVars) {
      const speechVar = variables[speechKey];
      if (!speechVar?.voice?.voice_id || !speechVar?.voice?.input_text) {
        logger.error('[HeyGenTemplatePayloadBuilder] Speech variable missing voice_id or input_text', {
          speechKey,
          speechVar: JSON.stringify(speechVar, null, 2),
        });
        throw new Error(`Speech variable ${speechKey} is missing voice_id or input_text field`);
      }
    }
    
    logger.info('[HeyGenTemplatePayloadBuilder] Built template payload', {
      templateId,
      slideCount: slides.length,
      variableCount: Object.keys(variables).length,
      hasCaption: caption,
      hasVoiceId: !!voiceId,
      characterVariablesCount: imageVars.length,
      voiceVariablesCount: speechVars.length,
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
   * @param {string} [language] - Language code (for voice_id and locale resolution)
   * @returns {Object} Variables map with image_N and speech_N keys
   */
  _buildVariables(slides, voiceId, language = 'en') {
    const variables = {};

    // Resolve voice_id and locale from language if not provided
    let finalVoiceId = voiceId;
    let locale = null;
    
    if (!finalVoiceId) {
      const voiceConfig = getVoiceConfig(language);
      finalVoiceId = voiceConfig.voice_id;
      // Map language to locale (e.g., 'en' -> 'en-US', 'he' -> 'he-IL')
      const localeMap = {
        'en': 'en-US',
        'he': 'he-IL',
        'ar': 'ar-SA',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'ko': 'ko-KR',
        'ja': 'ja-JP',
        'zh': 'zh-CN',
        'ru': 'ru-RU',
      };
      locale = localeMap[language] || language;
    } else {
      // If voiceId is provided, try to infer locale from it or use language
      const localeMap = {
        'en': 'en-US',
        'he': 'he-IL',
        'ar': 'ar-SA',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'ko': 'ko-KR',
        'ja': 'ja-JP',
        'zh': 'zh-CN',
        'ru': 'ru-RU',
      };
      locale = localeMap[language] || language;
    }

    // Default character_id (can be overridden per slide if needed)
    // Using the first character from template: "Annie_Bar_Standing_Front_2_public"
    const defaultCharacterId = 'Annie_Bar_Standing_Front_2_public';

    // Sort slides by index to ensure correct ordering
    const sortedSlides = [...slides].sort((a, b) => a.index - b.index);

    for (const slide of sortedSlides) {
      const slideNum = slide.index;

      // Add image variable: image_1, image_2, ..., image_10
      // Template expects: { type: "character", character: { character_id: "...", type: "avatar" } }
      // Based on template definition: image_N is type "character" not "image"
      const imageKey = `image_${slideNum}`;
      
      // Use character_id based on slide number (alternating between characters as in template)
      // Template shows: image_1 uses "Annie_Bar_Standing_Front_2_public", others use "Annie_Casual_Standing_Front_2_public"
      const characterId = slideNum === 1 
        ? 'Annie_Bar_Standing_Front_2_public' 
        : 'Annie_Casual_Standing_Front_2_public';
      
      const imageVar = {
        type: 'character', // Template defines image_N as character type
        character: {
          character_id: characterId,
          type: 'avatar',
        },
      };
      
      logger.info('[HeyGenTemplatePayloadBuilder] Building image variable (character)', {
        imageKey,
        slideNum,
        characterId,
        fullStructure: JSON.stringify(imageVar, null, 2),
      });
      
      variables[imageKey] = imageVar;

      // Add speech variable: speech_1, speech_2, ..., speech_10
      // Template expects: { type: "voice", voice: { voice_id: "...", locale: "...", input_text: "..." } }
      // Based on template definition: speech_N is type "voice" not "text"
      const speechKey = `speech_${slideNum}`;
      variables[speechKey] = {
        type: 'voice', // Template defines speech_N as voice type
        voice: {
          voice_id: finalVoiceId,
          locale: locale,
          input_text: slide.speakerText.trim(), // The actual speech text
        },
      };
      
      logger.info('[HeyGenTemplatePayloadBuilder] Building speech variable (voice)', {
        speechKey,
        slideNum,
        voiceId: finalVoiceId,
        locale: locale,
        textLength: slide.speakerText.trim().length,
      });
    }

    return variables;
  }
}

