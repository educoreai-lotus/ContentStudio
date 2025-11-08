/**
 * Base Use Case
 * Provides common functionality for all use cases
 */
export class BaseUseCase {
  /**
   * Resolve trainer ID with fallback to mock trainer
   * @param {string|null} trainerId - Trainer ID from request
   * @returns {string} Resolved trainer ID
   */
  resolveTrainerId(trainerId) {
    return trainerId || 'trainer-maya-levi';
  }

  /**
   * Validate required fields
   * @param {Object} data - Data to validate
   * @param {Array<string>} requiredFields - List of required field names
   * @throws {Error} If any required field is missing
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}

