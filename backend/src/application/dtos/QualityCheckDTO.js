/**
 * Quality Check Data Transfer Object
 */
export class QualityCheckDTO {
  static toQualityCheckResponse(qualityCheck) {
    return {
      quality_check_id: qualityCheck.quality_check_id,
      content_id: qualityCheck.content_id,
      check_type: qualityCheck.check_type,
      status: qualityCheck.status,
      results: qualityCheck.results,
      score: qualityCheck.score,
      error_message: qualityCheck.error_message,
      created_at: qualityCheck.created_at.toISOString(),
      completed_at: qualityCheck.completed_at
        ? qualityCheck.completed_at.toISOString()
        : null,
      quality_level: qualityCheck.getQualityLevel(),
      is_acceptable: qualityCheck.isAcceptable(),
    };
  }

  static toQualityCheckListResponse(qualityChecks) {
    return qualityChecks.map(check => this.toQualityCheckResponse(check));
  }
}



