/**
 * Quality Check Entity
 * Represents a quality and originality check for content
 */
export class QualityCheck {
  constructor({
    quality_check_id,
    content_id,
    check_type,
    status,
    results = null,
    score = null,
    error_message = null,
    created_at = new Date(),
    completed_at = null,
  }) {
    this.quality_check_id = quality_check_id;
    this.content_id = content_id;
    this.check_type = check_type;
    this.status = status;
    this.results = results;
    this.score = score;
    this.error_message = error_message;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
    this.completed_at =
      completed_at instanceof Date || completed_at === null
        ? completed_at
        : new Date(completed_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.content_id || typeof this.content_id !== 'number') {
      errors.push('content_id is required and must be a number');
    }

    // Check type validation
    const validCheckTypes = ['full', 'quick', 'originality_only'];
    if (!this.check_type || !validCheckTypes.includes(this.check_type)) {
      errors.push(`check_type must be one of: ${validCheckTypes.join(', ')}`);
    }

    // Status validation
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!this.status || !validStatuses.includes(this.status)) {
      errors.push(`status must be one of: ${validStatuses.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`QualityCheck validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Mark quality check as completed
   * @param {Object} results - Quality check results
   * @param {number} score - Overall quality score
   */
  markCompleted(results, score) {
    this.status = 'completed';
    this.results = results;
    this.score = score;
    this.completed_at = new Date();
  }

  /**
   * Mark quality check as failed
   * @param {string} errorMessage - Error message
   */
  markFailed(errorMessage) {
    this.status = 'failed';
    this.error_message = errorMessage;
    this.completed_at = new Date();
  }

  /**
   * Calculate overall score from results
   * @returns {number} Calculated score (0-100)
   */
  calculateScore() {
    if (!this.results) return null;

    const weights = {
      clarity: 0.3,
      structure: 0.25,
      originality: 0.25,
      difficulty_match: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (this.results.clarity !== undefined) {
      totalScore += this.results.clarity * weights.clarity;
      totalWeight += weights.clarity;
    }

    if (this.results.structure !== undefined) {
      totalScore += this.results.structure * weights.structure;
      totalWeight += weights.structure;
    }

    if (this.results.originality !== undefined) {
      totalScore += this.results.originality * weights.originality;
      totalWeight += weights.originality;
    }

    if (this.results.difficulty_match !== undefined) {
      totalScore += this.results.difficulty_match * weights.difficulty_match;
      totalWeight += weights.difficulty_match;
    }

    // Penalize if plagiarism detected
    if (this.results.plagiarism_detected === true) {
      totalScore *= 0.5; // Reduce score by 50%
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : null;
  }

  /**
   * Check if quality is acceptable (score >= 70 and no plagiarism)
   * @returns {boolean} True if quality is acceptable
   */
  isAcceptable() {
    if (this.status !== 'completed' || !this.score) return false;
    if (this.results?.plagiarism_detected === true) return false;
    return this.score >= 70;
  }

  /**
   * Get quality level
   * @returns {string} Quality level: 'excellent', 'good', 'fair', 'poor'
   */
  getQualityLevel() {
    if (!this.score) return null;

    if (this.score >= 90) return 'excellent';
    if (this.score >= 80) return 'good';
    if (this.score >= 70) return 'fair';
    return 'poor';
  }
}



