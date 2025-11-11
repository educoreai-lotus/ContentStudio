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

    const content = await this.contentRepository.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    return await this.contentVersionRepository.findByTopicAndType(
      content.topic_id,
      content.content_type_id
    );
  }
}



