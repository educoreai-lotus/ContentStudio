/**
 * Template Entity
 * Represents a reusable template that defines the order and structure of content formats
 */
export class Template {
  constructor({
    template_id,
    template_name,
    template_type = 'manual',
    format_order,
    created_by,
    created_at = new Date(),
  }) {
    this.template_id = template_id;
    this.template_name = template_name;
    this.template_type = template_type;
    this.format_order = format_order;
    this.created_by = created_by;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.template_name || this.template_name.trim() === '') {
      errors.push('template_name is required and cannot be empty');
    }

    // Template type validation
    const allowedTemplateTypes = [
      'ready_template',
      'ai_generated',
      'manual',
      'mixed_ai_manual',
    ];
    if (!this.template_type || !allowedTemplateTypes.includes(this.template_type)) {
      errors.push(`template_type must be one of: ${allowedTemplateTypes.join(', ')}`);
    }

    // Format order validation
    if (!Array.isArray(this.format_order)) {
      errors.push('format_order must be an array');
    } else if (this.format_order.length === 0) {
      errors.push('format_order cannot be empty');
    } else {
      const validContentTypes = [
        'avatar_video',
        'text',
        'code',
        'presentation',
        'audio',
        'mind_map',
      ];
      const invalidTypes = this.format_order.filter(
        type => !validContentTypes.includes(type)
      );
      if (invalidTypes.length > 0) {
        errors.push(
          `Invalid content types in format_order: ${invalidTypes.join(', ')}`
        );
      }

      // REQUIRED: Template must include all 5 mandatory formats
      // Note: text_audio counts as text for validation purposes
      const mandatoryFormats = ['text', 'code', 'presentation', 'audio', 'mind_map'];
      const hasText = this.format_order.includes('text') || this.format_order.includes('text_audio');
      const missingFormats = mandatoryFormats.filter(format => {
        if (format === 'text') {
          return !hasText;
        }
        return !this.format_order.includes(format);
      });
      if (missingFormats.length > 0) {
        errors.push(
          `Template must include all 5 mandatory formats. Missing: ${missingFormats.join(', ')}`
        );
      }

      // REQUIRED: Audio must always be with text (text before or immediately after audio)
      // Note: text_audio counts as text for this validation (hasText already defined above)
      const audioIndex = this.format_order.indexOf('audio');
      const textIndex = this.format_order.indexOf('text');
      
      if (audioIndex !== -1) {
        if (!hasText) {
          errors.push('Audio format requires text format to be present');
        } else if (textIndex !== -1) {
          // Check if text is before audio or immediately after
          const isTextBeforeAudio = textIndex < audioIndex;
          const isTextImmediatelyAfter = textIndex === audioIndex + 1;
          
          if (!isTextBeforeAudio && !isTextImmediatelyAfter) {
            errors.push(
              'Audio format must always be with text. Text must appear before audio or immediately after it in the format order.'
            );
          }
        }
        // If text_audio is present, it's valid (it contains text)
      }
    }

    // Created by validation
    if (!this.created_by || this.created_by.trim() === '') {
      errors.push('created_by is required');
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Update format order
   * @param {string[]} newFormatOrder - New format order
   */
  updateFormatOrder(newFormatOrder) {
    if (!Array.isArray(newFormatOrder) || newFormatOrder.length === 0) {
      throw new Error('format_order must be a non-empty array');
    }

    const validContentTypes = [
      'avatar_video',
      'text',
      'code',
      'presentation',
      'audio',
      'mind_map',
    ];
    const invalidTypes = newFormatOrder.filter(
      type => !validContentTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid content type in format_order: ${invalidTypes.join(', ')}`);
    }

    this.format_order = newFormatOrder;
  }

  /**
   * Get next format to create based on current content
   * @param {Object} currentContent - Current content items by type
   * @returns {string|null} Next format to create, or null if all formats exist
   */
  getNextFormat(currentContent = {}) {
    for (const formatType of this.format_order) {
      if (!currentContent[formatType]) {
        return formatType;
      }
    }
    return null;
  }

  /**
   * Check if template is complete for a topic
   * @param {Object} currentContent - Current content items by type
   * @returns {boolean} True if all formats in template exist
   */
  isComplete(currentContent = {}) {
    return this.format_order.every(formatType => currentContent[formatType]);
  }

  /**
   * Get missing formats for a topic
   * @param {Object} currentContent - Current content items by type
   * @returns {string[]} Array of missing format types
   */
  getMissingFormats(currentContent = {}) {
    return this.format_order.filter(formatType => !currentContent[formatType]);
  }
}

