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
   * Find all versions for content
   * @param {number} contentId - Content ID
   * @returns {Promise<ContentVersion[]>} Array of versions
   */
  async findByContentId(contentId) {
    throw new Error('ContentVersionRepository.findByContentId() must be implemented');
  }

  /**
   * Find current version for content
   * @param {number} contentId - Content ID
   * @returns {Promise<ContentVersion|null>} Current version or null
   */
  async findCurrentVersion(contentId) {
    throw new Error('ContentVersionRepository.findCurrentVersion() must be implemented');
  }

  /**
   * Get next version number for content
   * @param {number} contentId - Content ID
   * @returns {Promise<number>} Next version number
   */
  async getNextVersionNumber(contentId) {
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
   * @param {number} contentId - Content ID
   * @returns {Promise<void>}
   */
  async markAllAsNotCurrent(contentId) {
    throw new Error('ContentVersionRepository.markAllAsNotCurrent() must be implemented');
  }
}



