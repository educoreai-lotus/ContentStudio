import { CreateContentVersionUseCase } from '../../application/use-cases/CreateContentVersionUseCase.js';
import { GetContentVersionsUseCase } from '../../application/use-cases/GetContentVersionsUseCase.js';
import { GetVersionUseCase } from '../../application/use-cases/GetVersionUseCase.js';
import { RestoreContentVersionUseCase } from '../../application/use-cases/RestoreContentVersionUseCase.js';
import { ContentVersionDTO } from '../../application/dtos/ContentVersionDTO.js';

/**
 * Content Version Controller
 */
export class ContentVersionController {
  constructor({
    contentVersionRepository,
    contentRepository,
  }) {
    this.createContentVersionUseCase = new CreateContentVersionUseCase({
      contentVersionRepository,
    });
    this.getContentVersionsUseCase = new GetContentVersionsUseCase({
      contentVersionRepository,
      contentRepository,
    });
    this.getVersionUseCase = new GetVersionUseCase({
      contentVersionRepository,
    });
    this.restoreContentVersionUseCase = new RestoreContentVersionUseCase({
      contentVersionRepository,
      contentRepository,
      createContentVersionUseCase: this.createContentVersionUseCase,
    });
  }

  /**
   * Create a new version for content
   * POST /api/content/:contentId/versions
   */
  async create(req, res, next) {
    try {
      const contentId = parseInt(req.params.contentId);
      const { content_data, change_description } = req.body;
      const createdBy = req.body.created_by || 'trainer123'; // TODO: Get from auth

      const version = await this.createContentVersionUseCase.execute(
        contentId,
        content_data,
        createdBy,
        change_description
      );

      res.status(201).json({
        success: true,
        data: ContentVersionDTO.toVersionResponse(version),
        message: 'Version created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all versions for content
   * GET /api/content/:contentId/versions
   */
  async list(req, res, next) {
    try {
      const contentId = parseInt(req.params.contentId);
      const versions = await this.getContentVersionsUseCase.execute(contentId);

      res.json({
        success: true,
        data: ContentVersionDTO.toVersionSummaryListResponse(versions),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get version by ID
   * GET /api/versions/:id
   */
  async getById(req, res, next) {
    try {
      const versionId = parseInt(req.params.id);
      const version = await this.getVersionUseCase.execute(versionId);

      if (!version) {
        return res.status(404).json({
          success: false,
          error: 'Version not found',
        });
      }

      res.json({
        success: true,
        data: ContentVersionDTO.toVersionResponse(version),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restore content to a specific version
   * POST /api/versions/:id/restore
   */
  async restore(req, res, next) {
    try {
      const versionId = parseInt(req.params.id);
      const restoredBy = req.body.restored_by || 'trainer123'; // TODO: Get from auth

      const content = await this.restoreContentVersionUseCase.execute(
        versionId,
        restoredBy
      );

      res.json({
        success: true,
        data: content,
        message: 'Version restored successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

