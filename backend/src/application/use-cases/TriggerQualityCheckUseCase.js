/**
 * Trigger Quality Check Use Case
 */
export class TriggerQualityCheckUseCase {
  constructor({ qualityCheckService }) {
    this.qualityCheckService = qualityCheckService;
  }

  async execute(contentId, checkType = 'full') {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    const validCheckTypes = ['full', 'quick', 'originality_only'];
    if (!validCheckTypes.includes(checkType)) {
      throw new Error(`check_type must be one of: ${validCheckTypes.join(', ')}`);
    }

    return await this.qualityCheckService.triggerQualityCheck(contentId, checkType);
  }
}



