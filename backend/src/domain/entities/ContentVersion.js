/**
 * Content Version Entity
 * Represents a version of content for version control and history
 */
export class ContentVersion {
  constructor({
    version_id,
    content_id = null,
    topic_id = null,
    content_type_id = null,
    generation_method_id = null,
    version_number = null, // Deprecated: use timestamps instead
    content_data,
    created_by = 'system',
    is_current_version = false,
    change_description = null,
    parent_version_id = null,
    created_at = new Date(),
    updated_at = null,
    deleted_at = null,
  }) {
    this.version_id = version_id;
    this.content_id = content_id;
    this.topic_id = topic_id;
    this.content_type_id = content_type_id;
    this.generation_method_id = generation_method_id;
    this.version_number = version_number; // Deprecated: kept for backward compatibility
    this.content_data = content_data;
    this.created_by = created_by;
    this.is_current_version = is_current_version;
    this.change_description = change_description;
    this.parent_version_id = parent_version_id;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
    this.updated_at = updated_at ? (updated_at instanceof Date ? updated_at : new Date(updated_at)) : this.created_at;
    this.deleted_at = deleted_at ? (deleted_at instanceof Date ? deleted_at : new Date(deleted_at)) : null;

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.content_data || (typeof this.content_data !== 'object' && typeof this.content_data !== 'string')) {
      errors.push('content_data is required and must be an object or string');
    }

    // Validate content_id if provided
    if (this.content_id !== null && (typeof this.content_id !== 'number' || this.content_id <= 0)) {
      errors.push('content_id must be a positive integer if provided');
    }

    // Validate version_number if provided (deprecated but still validated)
    if (this.version_number !== null && (typeof this.version_number !== 'number' || this.version_number <= 0)) {
      errors.push('version_number must be a positive integer if provided');
    }

    // Validate created_by
    if (!this.created_by || typeof this.created_by !== 'string' || this.created_by.trim() === '') {
      errors.push('created_by is required and must be a non-empty string');
    }

    if (errors.length > 0) {
      throw new Error(`ContentVersion validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Mark this version as the current version
   */
  markAsCurrent() {
    this.is_current_version = true;
  }

  /**
   * Mark this version as not current
   */
  markAsNotCurrent() {
    this.is_current_version = false;
  }

  /**
   * Check if this version is the latest
   * @param {Date} latestTimestamp - Latest timestamp (updated_at or created_at)
   * @returns {boolean} True if this is the latest version
   */
  isLatest(latestTimestamp) {
    const thisTimestamp = this.updated_at || this.created_at;
    return thisTimestamp.getTime() === latestTimestamp.getTime();
  }

  /**
   * Get version summary
   * @returns {Object} Version summary
   */
  getSummary() {
    return {
      version_id: this.version_id,
      version_number: this.version_number, // Deprecated: kept for backward compatibility
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_current_version: this.is_current_version,
      change_description: this.change_description,
    };
  }
}



