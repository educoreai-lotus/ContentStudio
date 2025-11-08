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
    contentVersionRepository,
    createContentVersionUseCase,
  }) {
    this.createContentUseCase = new CreateContentUseCase({
      contentRepository,
      qualityCheckService,
    });
    this.updateContentUseCase = new UpdateContentUseCase({
      contentRepository,
      contentVersionRepository,
      createContentVersionUseCase,
    });
    this.contentRepository = contentRepository;
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
      } = req.body;

      console.log('[Content Approve] Approving content:', {
        topic_id,
        content_type_id,
        was_edited,
      });

      // Determine generation method based on whether content was edited
      let generation_method_id = 'ai_assisted';
      if (was_edited) {
        generation_method_id = 'manual_edited';
        console.log('[Content Approve] Content was edited by trainer, will trigger quality check');
      }

      const contentData = {
        topic_id: parseInt(topic_id),
        content_type_id,
        content_data,
        generation_method_id,
      };

      const content = await this.createContentUseCase.execute(contentData);
      
      console.log('[Content Approve] Content saved successfully:', content.content_id);

      res.status(201).json({
        success: true,
        data: ContentDTO.toContentResponse(content),
        message: was_edited
          ? 'Content saved and quality check triggered'
          : 'Content saved successfully',
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
   */
  async remove(req, res, next) {
    try {
      const contentId = parseInt(req.params.id);
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
}

