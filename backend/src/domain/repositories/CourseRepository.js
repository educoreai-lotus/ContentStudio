/**
 * Course Repository Interface
 * Defines the contract for course data persistence
 */
export class CourseRepository {
  /**
   * Create a new course
   * @param {Course} course - Course entity
   * @returns {Promise<Course>} Created course with ID
   */
  async create(course) {
    throw new Error('CourseRepository.create() must be implemented');
  }

  /**
   * Find course by ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Course|null>} Course entity or null if not found
   */
  async findById(courseId) {
    throw new Error('CourseRepository.findById() must be implemented');
  }

  /**
   * Find all courses for a trainer
   * @param {string} trainerId - Trainer ID
   * @param {Object} filters - Filter options (status, search, etc.)
   * @param {Object} pagination - Pagination options (page, limit)
   * @returns {Promise<{courses: Course[], total: number}>} Courses and total count
   */
  async findByTrainer(trainerId, filters = {}, pagination = {}) {
    throw new Error('CourseRepository.findByTrainer() must be implemented');
  }

  /**
   * Update course
   * @param {Course} course - Course entity with updated data
   * @returns {Promise<Course>} Updated course
   */
  async update(course) {
    throw new Error('CourseRepository.update() must be implemented');
  }

  /**
   * Soft delete course (update status to deleted)
   * @param {number} courseId - Course ID
   * @returns {Promise<void>}
   */
  async softDelete(courseId) {
    throw new Error('CourseRepository.softDelete() must be implemented');
  }
}

