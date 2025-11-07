/**
 * Get Version Use Case
 */
export class GetVersionUseCase {
  constructor({ contentVersionRepository }) {
    this.contentVersionRepository = contentVersionRepository;
  }

  async execute(versionId) {
    return await this.contentVersionRepository.findById(versionId);
  }
}



