import { CreateContentUseCase } from '../../application/use-cases/CreateContentUseCase.js';
import { UpdateContentUseCase } from '../../application/use-cases/UpdateContentUseCase.js';
import { ContentDTO } from '../../application/dtos/ContentDTO.js';

/**
 * Content Controller
 * Handles HTTP requests for content operations
 */
export class ContentController {
  constructor({
    contentRepository,
    qualityCheckService,
    aiGenerationService,
    contentHistoryService,
  }) {
    this.createContentUseCase = new CreateContentUseCase({
      contentRepository,
      qualityCheckService,
      aiGenerationService,
      contentHistoryService,
    });
    this.updateContentUseCase = new UpdateContentUseCase({
      contentRepository,
      contentHistoryService,
    });
    this.contentRepository = contentRepository;
    this.contentHistoryService = contentHistoryService;
  }

  /**
   * Create new content
   * POST /api/content
   */
  async create(req, res, next) {
    try {
      const contentData = {
        topic_id: parseInt(req.body.topic_id),
        content_type_id: req.body.content_type_id,
        content_data: req.body.content_data,
        generation_method_id: req.body.generation_method_id || 'manual',
      };

      const content = await this.createContentUseCase.execute(contentData);
      res.status(201).json({
        success: true,
        data: ContentDTO.toContentResponse(content),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve and save AI-generated content
   * POST /api/content/approve
   */
  async approve(req, res, next) {
    try {
      const {
        topic_id,
        content_type_id,
        content_data,
        was_edited,
        original_content_data,
          generation_method_id: requestedGenerationMethod,
        } = req.body;

      console.log('[Content Approve] Approving content:', {
        topic_id,
        content_type_id,
        was_edited,
      });

      // Determine generation method based on whether content was edited
        let generation_method_id = requestedGenerationMethod || null;
        if (!generation_method_id) {
          generation_method_id = was_edited ? 'manual_edited' : 'ai_assisted';
        } else if (generation_method_id === 'manual_edited' && !was_edited) {
          console.log('[Content Approve] Manual edited generation method requested without edits, proceeding as manual.');
        }
        // Quality check will be triggered automatically in CreateContentUseCase for manual content only

      const contentData = {
        topic_id: parseInt(topic_id),
        content_type_id,
        content_data,
          generation_method_id,
      };

      const content = await this.createContentUseCase.execute(contentData);
      
      console.log('[Content Approve] Content saved successfully:', {
        content_id: content.content_id,
        generation_method_id: content.generation_method_id,
        quality_check_status: content.quality_check_status,
        has_quality_check_data: !!content.quality_check_data,
      });

      // Determine message and quality check info based on generation method
      const isManualContent = generation_method_id === 'manual' || generation_method_id === 'manual_edited';
      console.log('[Content Approve] Quality check info:', {
        isManualContent,
        quality_check_status: content.quality_check_status,
        quality_check_data: content.quality_check_data,
      });
      let message = 'Content saved successfully';
      let qualityCheckInfo = null;

      if (isManualContent) {
        if (content.quality_check_status === 'approved') {
          const qualityData = content.quality_check_data || {};
          const scores = {
            originality: qualityData.originality_score || 'N/A',
            difficultyAlignment: qualityData.difficulty_alignment_score || 'N/A',
            consistency: qualityData.consistency_score || 'N/A',
            overall: qualityData.overall_score || qualityData.score || 'N/A',
          };
          message = `Content saved and quality check completed successfully! Scores: Originality ${scores.originality}/100, Difficulty Alignment ${scores.difficultyAlignment}/100, Consistency ${scores.consistency}/100, Overall ${scores.overall}/100`;
          qualityCheckInfo = {
            status: content.quality_check_status,
            scores: scores,
            feedback: qualityData.feedback_summary || null,
          };
        } else if (content.quality_check_status === 'pending') {
          message = 'Content saved. Quality check is in progress...';
          qualityCheckInfo = {
            status: 'pending',
            message: 'Quality check is being performed. Please refresh to see results.',
          };
        } else if (content.quality_check_status === 'rejected') {
          const qualityData = content.quality_check_data || {};
          message = `Content saved but quality check failed: ${qualityData.feedback_summary || 'Content did not meet quality standards'}`;
          qualityCheckInfo = {
            status: content.quality_check_status,
            feedback: qualityData.feedback_summary || null,
          };
        } else {
          message = 'Content saved and quality check completed';
        }
      }

      res.status(201).json({
        success: true,
        data: ContentDTO.toContentResponse(content),
        message,
        qualityCheck: qualityCheckInfo,
      });
    } catch (error) {
      console.error('[Content Approve] Error:', error.message);
      next(error);
    }
  }

  /**
   * Get content by ID
   * GET /api/content/:id
   */
  async getById(req, res, next) {
    try {
      const contentId = parseInt(req.params.id);
      const content = await this.contentRepository.findById(contentId);

      if (!content) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found',
          },
        });
      }

      res.json({
        success: true,
        data: ContentDTO.toContentResponse(content),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all content for a topic
   * GET /api/content?topic_id=1
   */
  async list(req, res, next) {
    try {
      const topicId = req.query.topic_id ? parseInt(req.query.topic_id) : null;
      const filters = {
        content_type_id: req.query.content_type_id,
        generation_method_id: req.query.generation_method_id,
      };

      if (!topicId) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'topic_id query parameter is required',
          },
        });
      }

      const contents = await this.contentRepository.findAllByTopicId(topicId, filters);

      const response = ContentDTO.toContentListResponse(contents);
      res.json({
        success: true,
        ...response,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update content
   * PUT /api/content/:id
   * Automatically creates a version before updating
   */
  async update(req, res, next) {
    try {
      const contentId = parseInt(req.params.id);
      const updates = {
        content_data: req.body.content_data,
        quality_check_data: req.body.quality_check_data,
        quality_check_status: req.body.quality_check_status,
      };

      // Remove undefined fields
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      const updatedBy = req.body.updated_by || 'trainer123'; // TODO: Get from auth
      const updatedContent = await this.updateContentUseCase.execute(
        contentId,
        updates,
        updatedBy
      );

      res.json({
        success: true,
        data: ContentDTO.toContentResponse(updatedContent),
        message: 'Content updated successfully. Version created automatically.',
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  /**
   * Delete content (soft delete)
   * DELETE /api/content/:id
   * 
   * Note: The repository's delete() method handles archiving to history
   * within a transaction, so we don't need to call contentHistoryService.saveVersion() here.
   */
  async remove(req, res, next) {
    try {
      const contentId = parseInt(req.params.id);
      const existingContent = await this.contentRepository.findById(contentId);

      if (!existingContent) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found',
          },
        });
      }

      // Repository delete() method handles archiving to history within a transaction
      await this.contentRepository.delete(contentId);

      res.status(204).send();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  /**
   * Get history for a content item
   * GET /api/content/:id/history
   */
  async history(req, res, next) {
    try {
      const contentId = parseInt(req.params.id);
      const history = await this.contentHistoryService.getHistoryByContent(contentId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  /**
   * Restore a specific history version
   * POST /api/content/history/:historyId/restore
   */
  async restoreHistory(req, res, next) {
    try {
      const historyId = parseInt(req.params.historyId);
      const restoredContent = await this.contentHistoryService.restoreVersion(historyId);

      res.json({
        success: true,
        data: restoredContent,
        message: 'Content restored successfully.',
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_HISTORY_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  /**
   * Delete (archive) a history version
   * DELETE /api/content/history/:historyId
   */
  async deleteHistory(req, res, next) {
    try {
      const historyId = parseInt(req.params.historyId);
      await this.contentHistoryService.deleteVersion(historyId);
      res.status(204).send();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'CONTENT_HISTORY_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }
}

