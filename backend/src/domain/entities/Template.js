/**
 * Template Entity
 * Represents a reusable template that defines the order and structure of content formats
 */
export class Template {
  constructor({
    template_id,
    template_name,
    format_order,
    description = null,
    notes = null,
    created_by,
    is_active = true,
    usage_count = 0,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.template_id = template_id;
    this.template_name = template_name;
    this.format_order = format_order;
    this.description = description;
    this.notes = notes;
    this.created_by = created_by;
    this.is_active = is_active;
    this.usage_count = usage_count;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
    this.updated_at = updated_at instanceof Date ? updated_at : new Date(updated_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.template_name || this.template_name.trim() === '') {
      errors.push('template_name is required and cannot be empty');
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
      const mandatoryFormats = ['text', 'code', 'presentation', 'audio', 'mind_map'];
      const missingFormats = mandatoryFormats.filter(
        format => !this.format_order.includes(format)
      );
      if (missingFormats.length > 0) {
        errors.push(
          `Template must include all 5 mandatory formats. Missing: ${missingFormats.join(', ')}`
        );
      }

      // REQUIRED: Audio must always be with text (text before or immediately after audio)
      const audioIndex = this.format_order.indexOf('audio');
      const textIndex = this.format_order.indexOf('text');
      
      if (audioIndex !== -1 && textIndex !== -1) {
        // Check if text is before audio or immediately after
        const isTextBeforeAudio = textIndex < audioIndex;
        const isTextImmediatelyAfter = textIndex === audioIndex + 1;
        
        if (!isTextBeforeAudio && !isTextImmediatelyAfter) {
          errors.push(
            'Audio format must always be with text. Text must appear before audio or immediately after it in the format order.'
          );
        }
      } else if (audioIndex !== -1 && textIndex === -1) {
        // This shouldn't happen due to mandatory check, but double-check
        errors.push('Audio format requires text format to be present');
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
   * Increment usage count
   */
  incrementUsage() {
    this.usage_count += 1;
    this.updated_at = new Date();
  }

  /**
   * Deactivate template
   */
  deactivate() {
    this.is_active = false;
    this.updated_at = new Date();
  }

  /**
   * Activate template
   */
  activate() {
    this.is_active = true;
    this.updated_at = new Date();
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
    this.updated_at = new Date();
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

