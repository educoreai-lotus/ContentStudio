/**
 * Content Data Transfer Objects
 */
export class ContentDTO {
  /**
   * Convert Content entity to API response
   * @param {Content} content - Content entity
   * @returns {Object} API response object
   */
  static toContentResponse(content) {
    return {
      content_id: content.content_id,
      topic_id: content.topic_id,
      content_type_id: content.content_type_id,
      content_data: content.content_data,
      generation_method_id: content.generation_method_id,
      quality_check_data: content.quality_check_data,
      quality_check_status: content.quality_check_status,
      quality_checked_at: content.quality_checked_at,
      created_at: content.created_at,
      updated_at: content.updated_at,
    };
  }

  /**
   * Convert array of Content entities to API response
   * @param {Content[]} contents - Array of Content entities
   * @returns {Object} API response with pagination
   */
  static toContentListResponse(contents, pagination = {}) {
    return {
      contents: contents.map(c => this.toContentResponse(c)),
      pagination: {
        total: pagination.total || contents.length,
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total_pages: pagination.total_pages || 1,
      },
    };
  }
}



