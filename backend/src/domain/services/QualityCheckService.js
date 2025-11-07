/**
 * Quality Check Service Interface
 * Defines contract for quality and originality checking
 */
export class QualityCheckService {
  /**
   * Trigger quality check for content
   * @param {number} contentId - Content ID
   * @param {string} checkType - Type of check: 'full', 'quick', 'originality_only'
   * @returns {Promise<QualityCheck>} Quality check result
   */
  async triggerQualityCheck(contentId, checkType = 'full') {
    throw new Error('QualityCheckService.triggerQualityCheck() must be implemented');
  }

  /**
   * Check content clarity
   * @param {string} contentText - Content text to check
   * @returns {Promise<number>} Clarity score (0-100)
   */
  async checkClarity(contentText) {
    throw new Error('QualityCheckService.checkClarity() must be implemented');
  }

  /**
   * Check content structure
   * @param {string} contentText - Content text to check
   * @returns {Promise<number>} Structure score (0-100)
   */
  async checkStructure(contentText) {
    throw new Error('QualityCheckService.checkStructure() must be implemented');
  }

  /**
   * Check content originality (plagiarism detection)
   * @param {string} contentText - Content text to check
   * @returns {Promise<Object>} Originality check result
   */
  async checkOriginality(contentText) {
    throw new Error('QualityCheckService.checkOriginality() must be implemented');
  }

  /**
   * Check difficulty match
   * @param {string} contentText - Content text
   * @param {string} targetDifficulty - Target difficulty level
   * @returns {Promise<number>} Difficulty match score (0-100)
   */
  async checkDifficultyMatch(contentText, targetDifficulty) {
    throw new Error('QualityCheckService.checkDifficultyMatch() must be implemented');
  }
}



