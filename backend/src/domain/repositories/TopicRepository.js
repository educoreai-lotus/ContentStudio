/**
 * Topic Repository Interface
 * Defines the contract for topic data persistence
 */
export class TopicRepository {
  /**
   * Create a new topic
   * @param {Topic} topic - Topic entity
   * @returns {Promise<Topic>} Created topic with ID
   */
  async create(topic) {
    throw new Error('TopicRepository.create() must be implemented');
  }

  /**
   * Find topic by ID
   * @param {number} topicId - Topic ID
   * @returns {Promise<Topic|null>} Topic entity or null if not found
   */
  async findById(topicId) {
    throw new Error('TopicRepository.findById() must be implemented');
  }

  /**
   * Find all topics for a trainer
   * @param {string} trainerId - Trainer ID
   * @param {Object} filters - Filter options (status, course_id, etc.)
   * @param {Object} pagination - Pagination options (page, limit)
   * @returns {Promise<{topics: Topic[], total: number}>} Topics and total count
   */
  async findByTrainer(trainerId, filters = {}, pagination = {}) {
    throw new Error('TopicRepository.findByTrainer() must be implemented');
  }

  /**
   * Find topics by course ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Topic[]>} Array of topics
   */
  async findByCourseId(courseId) {
    throw new Error('TopicRepository.findByCourseId() must be implemented');
  }

  /**
   * Update topic
   * @param {Topic} topic - Topic entity with updated data
   * @returns {Promise<Topic>} Updated topic
   */
  async update(topic) {
    throw new Error('TopicRepository.update() must be implemented');
  }

  /**
   * Soft delete topic (update status to deleted)
   * @param {number} topicId - Topic ID
   * @returns {Promise<void>}
   */
  async softDelete(topicId) {
    throw new Error('TopicRepository.softDelete() must be implemented');
  }

  /**
   * Increment usage count
   * @param {number} topicId - Topic ID
   * @returns {Promise<void>}
   */
  async incrementUsageCount(topicId) {
    throw new Error('TopicRepository.incrementUsageCount() must be implemented');
  }
}

