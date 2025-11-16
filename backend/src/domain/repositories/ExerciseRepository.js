/**
 * Exercise Repository Interface
 * Defines the contract for exercise data access
 */
export class ExerciseRepository {
  /**
   * Create a new exercise
   * @param {Exercise} exercise - Exercise entity
   * @returns {Promise<Exercise>} Created exercise
   */
  async create(exercise) {
    throw new Error('create method must be implemented');
  }

  /**
   * Find exercise by ID
   * @param {number} exerciseId - Exercise ID
   * @returns {Promise<Exercise|null>} Exercise or null if not found
   */
  async findById(exerciseId) {
    throw new Error('findById method must be implemented');
  }

  /**
   * Find all exercises for a topic
   * @param {number} topicId - Topic ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Exercise[]>} Array of exercises
   */
  async findByTopicId(topicId, filters = {}) {
    throw new Error('findByTopicId method must be implemented');
  }

  /**
   * Update an exercise
   * @param {number} exerciseId - Exercise ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Exercise|null>} Updated exercise or null if not found
   */
  async update(exerciseId, updates) {
    throw new Error('update method must be implemented');
  }

  /**
   * Delete an exercise (soft delete)
   * @param {number} exerciseId - Exercise ID
   * @returns {Promise<Exercise|null>} Deleted exercise or null if not found
   */
  async delete(exerciseId) {
    throw new Error('delete method must be implemented');
  }

  /**
   * Create multiple exercises in batch
   * @param {Exercise[]} exercises - Array of exercise entities
   * @returns {Promise<Exercise[]>} Created exercises
   */
  async createBatch(exercises) {
    throw new Error('createBatch method must be implemented');
  }
}

