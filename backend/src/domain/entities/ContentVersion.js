/**
 * Content Version Entity
 * Represents a version of content for version control and history
 */
export class ContentVersion {
  constructor({
    version_id,
    content_id,
    version_number,
    content_data,
    created_by,
    is_current_version = false,
    change_description = null,
    parent_version_id = null,
    created_at = new Date(),
  }) {
    this.version_id = version_id;
    this.content_id = content_id;
    this.version_number = version_number;
    this.content_data = content_data;
    this.created_by = created_by;
    this.is_current_version = is_current_version;
    this.change_description = change_description;
    this.parent_version_id = parent_version_id;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.content_id || typeof this.content_id !== 'number') {
      errors.push('content_id is required and must be a number');
    }

    if (!this.version_number || typeof this.version_number !== 'number' || this.version_number < 1) {
      errors.push('version_number is required and must be a positive number');
    }

    if (!this.content_data || (typeof this.content_data !== 'object' && typeof this.content_data !== 'string')) {
      errors.push('content_data is required and must be an object or string');
    }

    if (!this.created_by || this.created_by.trim() === '') {
      errors.push('created_by is required');
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
   * @param {number} latestVersionNumber - Latest version number
   * @returns {boolean} True if this is the latest version
   */
  isLatest(latestVersionNumber) {
    return this.version_number === latestVersionNumber;
  }

  /**
   * Get version summary
   * @returns {Object} Version summary
   */
  getSummary() {
    return {
      version_id: this.version_id,
      version_number: this.version_number,
      created_by: this.created_by,
      created_at: this.created_at,
      is_current_version: this.is_current_version,
      change_description: this.change_description,
    };
  }
}



