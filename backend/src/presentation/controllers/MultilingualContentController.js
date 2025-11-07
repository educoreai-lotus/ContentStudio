import { GetLessonByLanguageUseCase } from '../../application/use-cases/GetLessonByLanguageUseCase.js';

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
   * Expected from Course Builder:
   * {
   *   "lesson_id": "123",
   *   "preferred_language": "he",
   *   "content_type": "text",
   *   "learner_id": "learner456",
   *   "course_metadata": {...}
   * }
   */
  async getLessonContent(req, res, next) {
    try {
      const { lesson_id, preferred_language, content_type = 'text', learner_id, course_metadata } = req.body;

      if (!lesson_id || !preferred_language) {
        return res.status(400).json({
          success: false,
          error: 'lesson_id and preferred_language are required',
        });
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
      next(error);
    }
  }

}

