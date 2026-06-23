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
    if (!trainerId) {
      throw new Error('Trainer identity is required');
    }
    return trainerId;
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

