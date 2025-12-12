/**
 * SlidePlan Domain Model
 * Represents a structured plan for presentation slides (max 10 slides)
 * 
 * @typedef {Object} SlidePlanItem
 * @property {number} index - Slide index (1-10, must be sequential 1..N)
 * @property {string} [title] - Optional slide title
 * @property {string} speakerText - Required speaker narration text for this slide
 * @property {string} imageUrl - Required public URL to slide image/background
 */

/**
 * SlidePlan Class
 * Validates and manages a collection of up to 10 slides
 */
export class SlidePlan {
  /**
   * @param {SlidePlanItem[]} slides - Array of slide items
   * @throws {Error} If validation fails
   */
  constructor(slides = []) {
    this.slides = [];
    this._validateAndSetSlides(slides);
  }

  /**
   * Validate and set slides
   * @private
   * @param {SlidePlanItem[]} slides - Array of slide items
   * @throws {Error} If validation fails
   */
  _validateAndSetSlides(slides) {
    if (!Array.isArray(slides)) {
      throw new Error('Slides must be an array');
    }

    if (slides.length === 0) {
      throw new Error('SlidePlan must contain at least 1 slide');
    }

    if (slides.length > 10) {
      throw new Error(`SlidePlan cannot contain more than 10 slides. Received: ${slides.length}`);
    }

    // Validate each slide and check indices
    const indices = new Set();
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      // Validate slide is an object
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

      // Validate title (optional, but if provided must be string)
      if (slide.title !== undefined && slide.title !== null && typeof slide.title !== 'string') {
        throw new Error(`Slide at index ${slide.index} title must be a string if provided`);
      }
    }

    // Validate indices are sequential (1..N)
    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
    for (let i = 0; i < sortedIndices.length; i++) {
      if (sortedIndices[i] !== i + 1) {
        throw new Error(`Slide indices must be sequential starting from 1. Expected ${i + 1}, found ${sortedIndices[i]}`);
      }
    }

    // All validations passed, set slides
    this.slides = slides.map(slide => ({
      index: slide.index,
      title: slide.title || undefined,
      speakerText: slide.speakerText.trim(),
      imageUrl: slide.imageUrl.trim(),
    }));
  }

  /**
   * Get number of slides
   * @returns {number}
   */
  get slideCount() {
    return this.slides.length;
  }

  /**
   * Get slide by index
   * @param {number} index - Slide index (1-10)
   * @returns {SlidePlanItem|undefined}
   */
  getSlide(index) {
    return this.slides.find(slide => slide.index === index);
  }

  /**
   * Get all slides sorted by index
   * @returns {SlidePlanItem[]}
   */
  getAllSlides() {
    return [...this.slides].sort((a, b) => a.index - b.index);
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      slides: this.getAllSlides(),
      slideCount: this.slideCount,
    };
  }

  /**
   * Create SlidePlan from JSON
   * @param {Object} json - JSON object with slides array
   * @returns {SlidePlan}
   */
  static fromJSON(json) {
    if (!json || !json.slides) {
      throw new Error('Invalid JSON: must contain slides array');
    }
    return new SlidePlan(json.slides);
  }
}

