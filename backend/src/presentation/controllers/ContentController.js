import { CreateContentUseCase } from '../../application/use-cases/CreateContentUseCase.js';
import { UpdateContentUseCase } from '../../application/use-cases/UpdateContentUseCase.js';
import { RegenerateContentUseCase } from '../../application/use-cases/RegenerateContentUseCase.js';
import { ContentDTO } from '../../application/dtos/ContentDTO.js';
import { FileIntegrityService } from '../../infrastructure/security/FileIntegrityService.js';
import { logger } from '../../infrastructure/logging/Logger.js';

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
    promptTemplateService,
    topicRepository,
    courseRepository,
  }) {
    this.createContentUseCase = new CreateContentUseCase({
      contentRepository,
      qualityCheckService,
      aiGenerationService,
      contentHistoryService,
      topicRepository,
      courseRepository,
    });
    this.updateContentUseCase = new UpdateContentUseCase({
      contentRepository,
      contentHistoryService,
      qualityCheckService,
      topicRepository,
    });
    this.regenerateContentUseCase = new RegenerateContentUseCase({
      contentRepository,
      contentHistoryService,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
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
      // Handle language validation errors
      if (error.code === 'LANGUAGE_MISMATCH' || error.code === 'LANGUAGE_DETECTION_FAILED' || error.code === 'LANGUAGE_VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
          },
        });
      }
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
            relevance: qualityData.relevance_score || 'N/A',
            originality: qualityData.originality_score || 'N/A',
            difficultyAlignment: qualityData.difficulty_alignment_score || 'N/A',
            consistency: qualityData.consistency_score || 'N/A',
            overall: qualityData.overall_score || qualityData.score || 'N/A',
          };
          
          // Build detailed message with scores and feedback
          let detailedMessage = `Content saved and quality check completed successfully!\n\nQuality Scores:\n- Relevance: ${scores.relevance}/100\n- Originality: ${scores.originality}/100\n- Difficulty Alignment: ${scores.difficultyAlignment}/100\n- Consistency: ${scores.consistency}/100\n- Overall: ${scores.overall}/100`;
          
          if (qualityData.feedback_summary) {
            detailedMessage += `\n\nAI Feedback:\n${qualityData.feedback_summary}`;
          }
          
          message = detailedMessage;
          qualityCheckInfo = {
            status: content.quality_check_status,
            scores: scores,
            feedback: qualityData.feedback_summary || null,
            feedback_summary: qualityData.feedback_summary || null,
          };
        } else if (content.quality_check_status === 'pending') {
          message = 'Content saved. Quality check is in progress...';
          qualityCheckInfo = {
            status: 'pending',
            message: 'Quality check is being performed. Please refresh to see results.',
          };
        } else if (content.quality_check_status === 'rejected') {
          const qualityData = content.quality_check_data || {};
          const errorMessage = qualityData.error_message || qualityData.feedback_summary || 'Content did not meet quality standards';
          
          // Build detailed error message with feedback
          let detailedMessage = `Content creation failed.\n\nReason:\n${errorMessage}`;
          
          if (qualityData.relevance_score !== undefined) {
            detailedMessage += `\n\nQuality Scores:\n- Relevance: ${qualityData.relevance_score}/100`;
          }
          if (qualityData.originality_score !== undefined) {
            detailedMessage += `\n- Originality: ${qualityData.originality_score}/100`;
          }
          if (qualityData.difficulty_alignment_score !== undefined) {
            detailedMessage += `\n- Difficulty Alignment: ${qualityData.difficulty_alignment_score}/100`;
          }
          if (qualityData.consistency_score !== undefined) {
            detailedMessage += `\n- Consistency: ${qualityData.consistency_score}/100`;
          }
          
          message = detailedMessage;
          qualityCheckInfo = {
            status: content.quality_check_status,
            feedback: qualityData.feedback_summary || qualityData.error_message || null,
            feedback_summary: qualityData.feedback_summary || qualityData.error_message || null,
            error_message: qualityData.error_message || null,
            scores: {
              relevance: qualityData.relevance_score,
              originality: qualityData.originality_score,
              difficultyAlignment: qualityData.difficulty_alignment_score,
              consistency: qualityData.consistency_score,
            },
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
        status_messages: content.status_messages || [],
      });
    } catch (error) {
      console.error('[Content Approve] Error:', error.message);
      
      // Handle language validation errors
      if (error.code === 'LANGUAGE_MISMATCH' || error.code === 'LANGUAGE_DETECTION_FAILED' || error.code === 'LANGUAGE_VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      // Handle quality check failures
      // If quality check failed, content should have been deleted, but if it wasn't, return error
      if (error.message && (
        error.message.includes('Quality check failed') || 
        error.message.includes('quality check') ||
        error.message.includes('Content failed quality check') ||
        error.message.includes('originality') ||
        error.message.includes('relevance') ||
        error.message.includes('Content is not relevant') ||
        error.message.includes('appears to be copied') ||
        error.message.includes('plagiarized') ||
        error.message.includes('Difficulty level mismatch') ||
        error.message.includes('Low consistency score')
      )) {
        // Extract feedback from error message if available
        const errorMessage = error.message;
        const feedbackMatch = errorMessage.match(/AI Feedback:\s*(.+)/s) || 
                             errorMessage.match(/feedback_summary[:\s]+(.+)/i) ||
                             errorMessage.match(/(.+?)(?:\.\s*Quality Scores|$)/s);
        
        const feedback = feedbackMatch ? feedbackMatch[1].trim() : null;
        
        // Extract scores from error message if available
        const relevanceMatch = errorMessage.match(/Relevance[:\s]+(\d+)/i);
        const originalityMatch = errorMessage.match(/Originality[:\s]+(\d+)/i);
        const difficultyMatch = errorMessage.match(/Difficulty Alignment[:\s]+(\d+)/i);
        const consistencyMatch = errorMessage.match(/Consistency[:\s]+(\d+)/i);
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'QUALITY_CHECK_FAILED',
            message: errorMessage,
            reason: 'Content did not pass quality check. Content was not saved.',
            feedback: feedback || errorMessage,
            feedback_summary: feedback || errorMessage,
            scores: {
              relevance: relevanceMatch ? parseInt(relevanceMatch[1]) : undefined,
              originality: originalityMatch ? parseInt(originalityMatch[1]) : undefined,
              difficultyAlignment: difficultyMatch ? parseInt(difficultyMatch[1]) : undefined,
              consistency: consistencyMatch ? parseInt(consistencyMatch[1]) : undefined,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }
      
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

      // Verify file integrity if hash and signature are present
      await this._verifyContentIntegrity(content);

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

      // Verify integrity for all content items
      for (const content of contents) {
        await this._verifyContentIntegrity(content);
      }

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
   * IMPORTANT: If editing AI-generated content, triggers quality check
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
      const statusMessages = req.body.status_messages || null;
      const updatedContent = await this.updateContentUseCase.execute(
        contentId,
        updates,
        updatedBy,
        statusMessages
      );

      // Determine message based on quality check status
      let message = 'Content updated successfully. Version created automatically.';
      let qualityCheckInfo = null;

      // Check if quality check was performed and get results
      if (updatedContent.quality_check_status) {
        if (updatedContent.quality_check_status === 'approved') {
          const qualityData = updatedContent.quality_check_data || {};
          const scores = {
            relevance: qualityData.relevance_score || 'N/A',
            originality: qualityData.originality_score || 'N/A',
            difficultyAlignment: qualityData.difficulty_alignment_score || 'N/A',
            consistency: qualityData.consistency_score || 'N/A',
            overall: qualityData.overall_score || qualityData.score || 'N/A',
          };
          message = `Content updated and quality check completed successfully! Scores: Relevance ${scores.relevance}/100, Originality ${scores.originality}/100, Difficulty Alignment ${scores.difficultyAlignment}/100, Consistency ${scores.consistency}/100, Overall ${scores.overall}/100`;
          qualityCheckInfo = {
            status: updatedContent.quality_check_status,
            scores: scores,
            feedback: qualityData.feedback_summary || null,
          };
        } else if (updatedContent.quality_check_status === 'pending') {
          message = 'Content updated. Quality check is in progress...';
          qualityCheckInfo = {
            status: 'pending',
            message: 'Quality check is being performed. Please refresh to see results.',
          };
        } else if (updatedContent.quality_check_status === 'rejected') {
          const qualityData = updatedContent.quality_check_data || {};
          message = `Content updated but quality check failed: ${qualityData.feedback_summary || 'Content did not meet quality standards'}`;
          qualityCheckInfo = {
            status: updatedContent.quality_check_status,
            feedback: qualityData.feedback_summary || null,
          };
        }
      }

      res.json({
        success: true,
        data: ContentDTO.toContentResponse(updatedContent),
        message,
        qualityCheck: qualityCheckInfo,
        status_messages: updatedContent.status_messages || [],
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
   * Delete content (hard delete with mandatory history)
   * DELETE /api/content/:id
   * 
   * MANDATORY: Always save to content_history BEFORE deletion
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

      // MANDATORY: Save to history BEFORE deletion for ALL content types
      // This applies to: text (1), code (2), presentation (3), audio (4), mind_map (5), avatar_video (6)
      if (this.contentHistoryService?.saveVersion) {
        try {
          console.log('[ContentController] MANDATORY: Saving content to history before deletion:', {
            content_id: contentId,
            topic_id: existingContent.topic_id,
            content_type_id: existingContent.content_type_id,
            content_type_name: existingContent.content_type_id === 1 ? 'text_audio' :
                              existingContent.content_type_id === 2 ? 'code' :
                              existingContent.content_type_id === 3 ? 'presentation' :
                              existingContent.content_type_id === 4 ? 'audio' :
                              existingContent.content_type_id === 5 ? 'mind_map' :
                              existingContent.content_type_id === 6 ? 'avatar_video' : 'unknown',
          });
          await this.contentHistoryService.saveVersion(existingContent, { force: true });
          console.log('[ContentController] ✅ Successfully archived content to history before deletion');
        } catch (error) {
          console.error('[ContentController] ❌ Failed to save content to history before deletion:', error.message, error.stack);
          // CRITICAL: Do not proceed with deletion if history save fails
          // This ensures we never lose content without saving it to history first
          throw new Error(`Failed to archive content to history: ${error.message}`);
        }
      } else {
        // CRITICAL: If ContentHistoryService is not available, we should NOT proceed with deletion
        // This is a safety measure to prevent data loss
        console.error('[ContentController] ❌ ContentHistoryService not available - CANNOT proceed with deletion');
        throw new Error('ContentHistoryService is required for content deletion. Cannot delete content without saving to history first.');
      }

      // Repository delete() method will skip history save since we already did it above
      // Pass skipHistoryCheck=true to prevent duplicate history entries
      await this.contentRepository.delete(contentId, true);

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
   * Get all history for a topic (all content types)
   * GET /api/content/topic/:topicId/history
   */
  async topicHistory(req, res, next) {
    try {
      const topicId = parseInt(req.params.topicId);
      const history = await this.contentHistoryService.getHistoryByTopic(topicId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
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

  /**
   * Verify file integrity for content
   * @private
   * @param {Object} content - Content object with content_data
   */
  async _verifyContentIntegrity(content) {
    if (!content || !content.content_data) {
      return; // No content data to verify
    }

    const contentData = content.content_data;
    const publicKey = process.env.CONTENT_STUDIO_PUBLIC_KEY;

    // Check for integrity data in different content types
    let sha256Hash = null;
    let digitalSignature = null;

    // Audio files, Avatar videos, Presentations - all use same structure
    if (contentData.sha256Hash && contentData.digitalSignature) {
      sha256Hash = contentData.sha256Hash;
      digitalSignature = contentData.digitalSignature;
    }

    // If we have integrity data, verify it
    if (sha256Hash && digitalSignature) {
      if (!publicKey) {
        logger.warn('[ContentController] Public key not configured, skipping file integrity verification', {
          contentId: content.id,
        });
        return; // Continue without verification if public key is not configured
      }

      try {
        const isValid = FileIntegrityService.verifySignature(
          sha256Hash,
          digitalSignature,
          publicKey
        );

        if (!isValid) {
          logger.error('[ContentController] File integrity verification failed', {
            contentId: content.id,
            contentType: content.content_type_id,
            hashPrefix: sha256Hash.substring(0, 16) + '...',
          });
          // Don't throw error - just log it. The content can still be served, but we know it's been tampered with
          // In production, you might want to throw an error or mark the content as suspicious
        } else {
          logger.debug('[ContentController] File integrity verified successfully', {
            contentId: content.id,
            contentType: content.content_type_id,
          });
        }
      } catch (verificationError) {
        logger.error('[ContentController] File integrity verification error', {
          contentId: content.id,
          error: verificationError.message,
        });
        // Continue - don't block content serving if verification fails
      }
    }
  }
}

