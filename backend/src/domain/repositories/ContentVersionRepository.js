/**
 * Content Version Repository Interface
 * Defines contract for content version data operations
 */
export class ContentVersionRepository {
  /**
   * Create a new content version
   * @param {ContentVersion} version - Content version entity
   * @returns {Promise<ContentVersion>} Created version
   */
  async create(version) {
    throw new Error('ContentVersionRepository.create() must be implemented');
  }

  /**
   * Find version by ID
   * @param {number} versionId - Version ID
   * @returns {Promise<ContentVersion|null>} Version or null if not found
   */
  async findById(versionId) {
    throw new Error('ContentVersionRepository.findById() must be implemented');
  }

  /**
   * Find all versions for a topic + content type
   * @param {number} topicId - Topic ID
   * @param {number} contentTypeId - Content type ID
   * @returns {Promise<ContentVersion[]>} Array of versions
   */
  async findByTopicAndType(topicId, contentTypeId) {
    throw new Error('ContentVersionRepository.findByTopicAndType() must be implemented');
  }

  /**
   * Find all versions for a topic (all content types)
   * @param {number} topicId - Topic ID
   * @returns {Promise<ContentVersion[]>} Array of versions
   */
  async findByTopic(topicId) {
    throw new Error('ContentVersionRepository.findByTopic() must be implemented');
  }

  /**
   * Find current version for content
   * @param {number} topicId - Topic ID
   * @param {number} contentTypeId - Content type ID
   * @returns {Promise<ContentVersion|null>} Current version or null
   */
  async findCurrentVersion(topicId, contentTypeId) {
    throw new Error('ContentVersionRepository.findCurrentVersion() must be implemented');
  }

  /**
   * Get next version number for content
   * @param {number} topicId - Topic ID
   * @param {number} contentTypeId - Content type ID
   * @returns {Promise<number>} Next version number
   */
  async getNextVersionNumber(topicId, contentTypeId) {
    throw new Error('ContentVersionRepository.getNextVersionNumber() must be implemented');
  }

  /**
   * Update version
   * @param {number} versionId - Version ID
   * @param {Object} updates - Update data
   * @returns {Promise<ContentVersion>} Updated version
   */
  async update(versionId, updates) {
    throw new Error('ContentVersionRepository.update() must be implemented');
  }

  /**
   * Mark all versions as not current for content
   * @param {number} topicId - Topic ID
   * @param {number} contentTypeId - Content type ID
   * @returns {Promise<void>}
   */
  async markAllAsNotCurrent(topicId, contentTypeId) {
    throw new Error('ContentVersionRepository.markAllAsNotCurrent() must be implemented');
  }

  /**
   * Soft delete (archive) a version entry
   * @param {number} versionId - Version/history ID
   * @returns {Promise<void>}
   */
  async softDelete(versionId) {
    throw new Error('ContentVersionRepository.softDelete() must be implemented');
  }
}



