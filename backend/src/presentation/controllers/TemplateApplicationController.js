import { ApplyTemplateToLessonUseCase } from '../../application/use-cases/ApplyTemplateToLessonUseCase.js';

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
      const { templateId, topicId } = req.params;

      const result = await this.applyTemplateToLessonUseCase.execute({
        topicId: parseInt(topicId),
        templateId: parseInt(templateId), // templateId from URL
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get lesson view with applied template
   * GET /api/topics/:topicId/view
   */
  async getLessonView(req, res, next) {
    try {
      const { topicId } = req.params;

      // Get topic to find its template_id
      const { TopicRepository } = await import('../../domain/repositories/TopicRepository.js');
      const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
      
      const topicRepository = RepositoryFactory.getTopicRepository();
      const topic = await topicRepository.findById(parseInt(topicId));

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

      // Use ApplyTemplateToLessonUseCase to get the view
      const result = await this.applyTemplateToLessonUseCase.execute({
        topicId: parseInt(topicId),
        templateId: topic.template_id, // Use topic's template_id
      });

      res.json({
        success: true,
        data: result.view_data,
      });
    } catch (error) {
      next(error);
    }
  }
}

