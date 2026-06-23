import { ApplyTemplateToLessonUseCase } from '../../application/use-cases/ApplyTemplateToLessonUseCase.js';
import {
  assertTrainerCanReadTemplate,
  assertTrainerOwnsTopic,
  requireAuthenticatedTrainerId,
  respondToOwnershipError,
} from '../middleware/ownershipHelpers.js';

export class TemplateApplicationController {
  constructor({ applyTemplateToLessonUseCase }) {
    this.applyTemplateToLessonUseCase = applyTemplateToLessonUseCase;
  }

  /**
   * Apply template to lesson
   * POST /api/templates/:templateId/apply/:topicId
   */
  async applyTemplate(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const { templateId, topicId } = req.params;

      await assertTrainerOwnsTopic(parseInt(topicId), trainerId);
      await assertTrainerCanReadTemplate(parseInt(templateId), trainerId);

      const result = await this.applyTemplateToLessonUseCase.execute({
        topicId: parseInt(topicId),
        templateId: parseInt(templateId),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }

  /**
   * Get lesson view with applied template
   * GET /api/topics/:topicId/view
   */
  async getLessonView(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const { topicId } = req.params;
      const topicIdNum = parseInt(topicId);

      await assertTrainerOwnsTopic(topicIdNum, trainerId);

      const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
      
      const topicRepository = await RepositoryFactory.getTopicRepository();
      const topic = await topicRepository.findById(topicIdNum);

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic/Lesson not found',
        });
      }

      if (!topic.template_id) {
        return res.status(400).json({
          success: false,
          error: 'No template applied to this lesson. Please apply a template first.',
        });
      }

      await assertTrainerCanReadTemplate(topic.template_id, trainerId);

      const result = await this.applyTemplateToLessonUseCase.execute({
        topicId: topicIdNum,
        templateId: topic.template_id,
      });

      res.json({
        success: true,
        data: result.view_data,
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }
}
