/**
 * SlideSpeechBuilder Service
 * Builds speaker text for slides from AI-generated explanations
 * 
 * Requirements:
 * - Input: aiSlideExplanations (array of strings or structured objects)
 * - Output: Array<{index: number, speakerText: string}> (max 10)
 * - Language consistency: keep text exactly as provided (no translation)
 * - Validation: no empty speech, trim excessive whitespace
 */

import { logger } from '../infrastructure/logging/Logger.js';

/**
 * SlideSpeechBuilder Class
 * Transforms AI slide explanations into structured speaker text
 */
export class SlideSpeechBuilder {
  /**
   * @param {number} maxSlides - Maximum number of slides (default: 10)
   */
  constructor(maxSlides = 10) {
    if (maxSlides < 1 || maxSlides > 10) {
      throw new Error('maxSlides must be between 1 and 10');
    }
    this.maxSlides = maxSlides;
  }

  /**
   * Build speaker text array from AI slide explanations
   * @param {Array<string|Object>} aiSlideExplanations - AI-generated explanations
   * @returns {Array<{index: number, speakerText: string}>} Structured speaker text
   * @throws {Error} If validation fails
   */
  buildSpeakerText(aiSlideExplanations) {
    if (!Array.isArray(aiSlideExplanations)) {
      throw new Error('aiSlideExplanations must be an array');
    }

    if (aiSlideExplanations.length === 0) {
      throw new Error('aiSlideExplanations cannot be empty');
    }

    if (aiSlideExplanations.length > this.maxSlides) {
      logger.warn('[SlideSpeechBuilder] More explanations than max slides, truncating', {
        provided: aiSlideExplanations.length,
        max: this.maxSlides,
      });
    }

    const results = [];
    const slideCount = Math.min(aiSlideExplanations.length, this.maxSlides);

    for (let i = 0; i < slideCount; i++) {
      const explanation = aiSlideExplanations[i];
      const slideIndex = i + 1;

      try {
        // Extract text from explanation (handle both string and object formats)
        const speakerText = this._extractText(explanation);

        // Validate and clean
        const cleanedText = this._validateAndClean(speakerText, slideIndex);

        results.push({
          index: slideIndex,
          speakerText: cleanedText,
        });

      } catch (error) {
        logger.error('[SlideSpeechBuilder] Failed to process slide explanation', {
          slideIndex,
          error: error.message,
          explanationType: typeof explanation,
        });
        throw new Error(`Failed to process slide ${slideIndex}: ${error.message}`);
      }
    }

    logger.info('[SlideSpeechBuilder] Built speaker text', {
      slideCount: results.length,
      totalProvided: aiSlideExplanations.length,
    });

    return results;
  }

  /**
   * Extract text from explanation (handles string or object)
   * @private
   * @param {string|Object} explanation - Explanation input
   * @returns {string} Extracted text
   */
  _extractText(explanation) {
    // Handle null/undefined first
    if (explanation === null || explanation === undefined) {
      throw new Error('Explanation is null or undefined');
    }

    if (typeof explanation === 'string') {
      return explanation;
    }

    if (typeof explanation === 'object') {
      // Try common property names for text content
      const textProperties = [
        'speakerText',
        'text',
        'narration',
        'content',
        'explanation',
        'description',
        'answer', // For OpenAI responses
        'message', // For some API responses
        'content', // For structured responses
      ];

      for (const prop of textProperties) {
        if (explanation[prop] && typeof explanation[prop] === 'string') {
          return explanation[prop];
        }
      }

      // If it's an array with a single string element
      if (Array.isArray(explanation) && explanation.length > 0) {
        const firstItem = explanation[0];
        if (typeof firstItem === 'string') {
          return firstItem;
        }
        // Recursively try to extract from first item
        return this._extractText(firstItem);
      }

      // If object has a 'slides' array (structured format)
      if (explanation.slides && Array.isArray(explanation.slides)) {
        // This is a structured format, we'll handle it in the main loop
        // For now, try to get the first slide's text
        if (explanation.slides.length > 0) {
          return this._extractText(explanation.slides[0]);
        }
      }

      // Last resort: try to stringify and extract meaningful content
      throw new Error(
        `Cannot extract text from object. Expected properties: ${textProperties.join(', ')}. ` +
        `Found keys: ${Object.keys(explanation).join(', ')}`
      );
    }

    throw new Error(`Invalid explanation type: ${typeof explanation}. Expected string or object.`);
  }

  /**
   * Validate and clean speaker text
   * @private
   * @param {string} text - Raw text
   * @param {number} slideIndex - Slide index for error messages
   * @returns {string} Cleaned text
   * @throws {Error} If validation fails
   */
  _validateAndClean(text, slideIndex) {
    if (text === null || text === undefined) {
      throw new Error(`Speaker text for slide ${slideIndex} is null or undefined`);
    }

    if (typeof text !== 'string') {
      throw new Error(`Speaker text for slide ${slideIndex} must be a string. Got: ${typeof text}`);
    }

    // Trim whitespace (including newlines and tabs)
    let cleaned = text.trim();

    // Replace multiple whitespace (spaces, newlines, tabs) with single space
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Final trim
    cleaned = cleaned.trim();

    // Validate: no empty speech
    if (cleaned.length === 0) {
      throw new Error(`Speaker text for slide ${slideIndex} cannot be empty after cleaning`);
    }

    // Validate: minimum length (at least 3 characters to avoid meaningless text)
    if (cleaned.length < 3) {
      logger.warn('[SlideSpeechBuilder] Speaker text is very short', {
        slideIndex,
        length: cleaned.length,
        text: cleaned,
      });
      // Don't throw, just warn - might be valid (e.g., "OK" in some languages)
    }

    return cleaned;
  }

  /**
   * Build from structured format (e.g., {slides: [{index: 1, narration: "..."}, ...]})
   * @param {Object} structuredData - Structured data with slides array
   * @returns {Array<{index: number, speakerText: string}>}
   */
  buildFromStructured(structuredData) {
    if (!structuredData || typeof structuredData !== 'object') {
      throw new Error('structuredData must be an object');
    }

    if (!Array.isArray(structuredData.slides)) {
      throw new Error('structuredData must have a slides array');
    }

    // Extract explanations from structured format
    const explanations = structuredData.slides.map(slide => {
      // Prefer 'narration' or 'speakerText', fallback to other text properties
      return slide.narration || slide.speakerText || slide.text || slide.content || slide;
    });

    return this.buildSpeakerText(explanations);
  }
}

