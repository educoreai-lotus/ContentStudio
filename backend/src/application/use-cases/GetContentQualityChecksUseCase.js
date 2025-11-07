/**
 * Get Content Quality Checks Use Case
 */
export class GetContentQualityChecksUseCase {
  constructor({ qualityCheckRepository }) {
    this.qualityCheckRepository = qualityCheckRepository;
  }

  async execute(contentId) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    return await this.qualityCheckRepository.findByContentId(contentId);
  }
}



