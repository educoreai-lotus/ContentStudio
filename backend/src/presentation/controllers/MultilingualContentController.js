import { GetLessonByLanguageUseCase } from '../../application/use-cases/GetLessonByLanguageUseCase.js';
import {
  assertTrainerOwnsTopic,
  requireAuthenticatedTrainerId,
  respondToOwnershipError,
} from '../middleware/ownershipHelpers.js';

/**
 * Multilingual Content Controller
 * Handles multilingual content requests from Course Builder
 */
export class MultilingualContentController {
  constructor({ getLessonByLanguageUseCase }) {
    this.getLessonByLanguageUseCase = getLessonByLanguageUseCase;
  }

  /**
   * Get lesson content in preferred language
   * POST /api/content/multilingual/lesson
   */
  async getLessonContent(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const { lesson_id, preferred_language, content_type = 'text', learner_id, course_metadata } = req.body;

      if (!lesson_id || !preferred_language) {
        return res.status(400).json({
          success: false,
          error: 'lesson_id and preferred_language are required',
        });
      }

      const lessonIdNum = parseInt(lesson_id, 10);
      if (!Number.isNaN(lessonIdNum)) {
        await assertTrainerOwnsTopic(lessonIdNum, trainerId);
      }

      const result = await this.getLessonByLanguageUseCase.execute({
        lessonId: lesson_id,
        preferredLanguage: preferred_language,
        contentType: content_type,
      });

      res.json({
        success: true,
        data: {
          lesson_id,
          language: result.language,
          content: result.content,
          source: result.source,
          source_language: result.source_language,
          cached: result.cached,
          learner_id,
          generated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }
}
