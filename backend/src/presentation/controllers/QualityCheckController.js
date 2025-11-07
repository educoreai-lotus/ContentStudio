import { TriggerQualityCheckUseCase } from '../../application/use-cases/TriggerQualityCheckUseCase.js';
import { GetQualityCheckUseCase } from '../../application/use-cases/GetQualityCheckUseCase.js';
import { GetContentQualityChecksUseCase } from '../../application/use-cases/GetContentQualityChecksUseCase.js';
import { QualityCheckDTO } from '../../application/dtos/QualityCheckDTO.js';

/**
 * Quality Check Controller
 */
export class QualityCheckController {
  constructor({ qualityCheckService, qualityCheckRepository }) {
    this.triggerQualityCheckUseCase = new TriggerQualityCheckUseCase({
      qualityCheckService,
    });
    this.getQualityCheckUseCase = new GetQualityCheckUseCase({
      qualityCheckRepository,
    });
    this.getContentQualityChecksUseCase = new GetContentQualityChecksUseCase({
      qualityCheckRepository,
    });
  }

  /**
   * Trigger quality check for content
   * POST /api/content/:contentId/quality-check
   */
  async trigger(req, res, next) {
    try {
      const contentId = parseInt(req.params.contentId);
      const checkType = req.body.check_type || 'full';

      const qualityCheck = await this.triggerQualityCheckUseCase.execute(
        contentId,
        checkType
      );

      res.status(201).json({
        success: true,
        data: QualityCheckDTO.toQualityCheckResponse(qualityCheck),
        message: 'Quality check triggered successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get quality check by ID
   * GET /api/quality-checks/:id
   */
  async getById(req, res, next) {
    try {
      const qualityCheckId = parseInt(req.params.id);
      const qualityCheck = await this.getQualityCheckUseCase.execute(qualityCheckId);

      if (!qualityCheck) {
        return res.status(404).json({
          success: false,
          error: 'Quality check not found',
        });
      }

      res.json({
        success: true,
        data: QualityCheckDTO.toQualityCheckResponse(qualityCheck),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all quality checks for content
   * GET /api/content/:contentId/quality-checks
   */
  async getByContentId(req, res, next) {
    try {
      const contentId = parseInt(req.params.contentId);
      const qualityChecks = await this.getContentQualityChecksUseCase.execute(
        contentId
      );

      res.json({
        success: true,
        data: QualityCheckDTO.toQualityCheckListResponse(qualityChecks),
      });
    } catch (error) {
      next(error);
    }
  }
}



