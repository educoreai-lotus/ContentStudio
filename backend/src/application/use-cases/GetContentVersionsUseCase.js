/**
 * Get Content Versions Use Case
 */
export class GetContentVersionsUseCase {
  constructor({ contentVersionRepository }) {
    this.contentVersionRepository = contentVersionRepository;
  }

  async execute(contentId) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    return await this.contentVersionRepository.findByContentId(contentId);
  }
}



