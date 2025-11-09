/**
 * Content Repository Interface
 * Defines the contract for content data persistence
 */
export class ContentRepository {
  /**
   * Create a new content item
   * @param {Content} content - Content entity
   * @returns {Promise<Content>} Created content
   */
  async create(content) {
    throw new Error('ContentRepository.create() must be implemented');
  }

  /**
   * Find content by ID
   * @param {number} contentId - Content ID
   * @returns {Promise<Content|null>} Content or null if not found
   */
  async findById(contentId) {
    throw new Error('ContentRepository.findById() must be implemented');
  }

  /**
   * Find all content items for a topic
   * @param {number} topicId - Topic ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Content[]>} Array of content items
   */
  async findByTopicId(topicId, filters = {}) {
    throw new Error('ContentRepository.findByTopicId() must be implemented');
  }

  /**
   * Update content item
   * @param {number} contentId - Content ID
   * @param {Object} updates - Update data
   * @returns {Promise<Content>} Updated content
   */
  async update(contentId, updates) {
    throw new Error('ContentRepository.update() must be implemented');
  }

  /**
   * Soft delete content item
   * @param {number} contentId - Content ID
   * @returns {Promise<void>}
   */
  async delete(contentId) {
    throw new Error('ContentRepository.delete() must be implemented');
  }

  /**
   * Check if topic has content of specific type
   * @param {number} topicId - Topic ID
   * @param {string} contentType - Content type
   * @returns {Promise<boolean>}
   */
  async hasContentType(topicId, contentType) {
    throw new Error('ContentRepository.hasContentType() must be implemented');
  }

  /**
   * Retrieve a map of content type IDs to their string names
   * @param {number[]} typeIds - Array of type IDs
   * @returns {Promise<Map<number, string>>}
   */
  async getContentTypeNamesByIds(typeIds) {
    throw new Error('ContentRepository.getContentTypeNamesByIds() must be implemented');
  }
}


