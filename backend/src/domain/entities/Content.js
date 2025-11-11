/**
 * Content Entity
 * Represents a content item (text, code, presentation, audio, mind_map, avatar_video)
 * within a topic/lesson
 */
export class Content {
  constructor({
    content_id,
    topic_id,
    content_type_id,
    content_data,
    generation_method_id,
    quality_check_data = null,
    quality_check_status = null,
    quality_checked_at = null,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.content_id = content_id;
    this.topic_id = topic_id;
    this.content_type_id = content_type_id;
    this.content_data = content_data;
    this.generation_method_id = generation_method_id;
    this.quality_check_data = quality_check_data;
    this.quality_check_status = quality_check_status;
    this.quality_checked_at = quality_checked_at;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
    this.updated_at = updated_at instanceof Date ? updated_at : new Date(updated_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.topic_id || typeof this.topic_id !== 'number' || this.topic_id <= 0) {
      errors.push('topic_id must be a positive integer');
    }

    // Content type validation (accept both string and integer)
    if (!this.content_type_id) {
      errors.push('content_type_id is required');
    }

    // Content data validation
    if (!this.content_data || typeof this.content_data !== 'object') {
      errors.push('content_data must be an object');
    }

    // Generation method validation (accept both string and integer)
    if (!this.generation_method_id) {
      errors.push('generation_method_id is required');
    }

    // Quality check status validation (if provided)
    if (this.quality_check_status !== null) {
      const validStatuses = ['pending', 'approved', 'rejected', 'needs_revision'];
      if (!validStatuses.includes(this.quality_check_status)) {
        errors.push(
          `quality_check_status must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(`Content validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Update quality check results
   * @param {Object} qualityCheckData - Quality check results
   * @param {string} status - Quality check status
   */
  updateQualityCheck(qualityCheckData, status) {
    const validStatuses = ['pending', 'approved', 'rejected', 'needs_revision'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid quality check status: ${status}`);
    }

    this.quality_check_data = qualityCheckData;
    this.quality_check_status = status;
    this.quality_checked_at = new Date();
    this.updated_at = new Date();
  }

  /**
   * Check if content needs quality check
   * @returns {boolean}
   */
  needsQualityCheck() {
    return this.quality_check_status === null;
  }

  /**
   * Soft delete content
   */
  softDelete() {
    this.quality_check_status = 'deleted';
    this.status = 'archived';
    this.updated_at = new Date();
  }
}


