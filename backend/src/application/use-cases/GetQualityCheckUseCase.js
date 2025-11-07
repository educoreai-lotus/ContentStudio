/**
 * Get Quality Check Use Case
 */
export class GetQualityCheckUseCase {
  constructor({ qualityCheckRepository }) {
    this.qualityCheckRepository = qualityCheckRepository;
  }

  async execute(qualityCheckId) {
    return await this.qualityCheckRepository.findById(qualityCheckId);
  }
}



