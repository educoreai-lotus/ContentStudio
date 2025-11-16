import { logger } from '../../infrastructure/logging/Logger.js';
import { CreateExercisesUseCase } from '../../application/use-cases/CreateExercisesUseCase.js';
import { PostgreSQLExerciseRepository } from '../../infrastructure/database/repositories/PostgreSQLExerciseRepository.js';
import { PostgreSQLTopicRepository } from '../../infrastructure/database/repositories/PostgreSQLTopicRepository.js';

/**
 * Exercise Controller
 * Handles HTTP requests for DevLab exercises
 */
export class ExerciseController {
  constructor() {
    // Initialize repositories
    this.exerciseRepository = new PostgreSQLExerciseRepository();
    const topicRepository = new PostgreSQLTopicRepository();

    // Initialize use case
    this.createExercisesUseCase = new CreateExercisesUseCase({
      exerciseRepository: this.exerciseRepository,
      topicRepository,
    });
  }

  /**
   * Get all exercises for a topic
   * GET /api/exercises/topic/:topicId
   */
  async getExercisesByTopic(req, res, next) {
    try {
      const { topicId } = req.params;
      const topicIdNum = parseInt(topicId);

      if (isNaN(topicIdNum)) {
        return res.status(400).json({
          error: 'Invalid topic ID',
        });
      }

      logger.info('[ExerciseController] Fetching exercises for topic', {
        topic_id: topicIdNum,
      });

      const exercises = await this.exerciseRepository.findByTopicId(topicIdNum);

      return res.status(200).json({
        success: true,
        exercises: exercises.map(ex => ex.toJSON()),
        count: exercises.length,
      });
    } catch (error) {
      logger.error('[ExerciseController] Error fetching exercises', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * Generate AI exercises for a topic
   * POST /api/exercises/generate-ai
   */
  async generateAIExercises(req, res, next) {
    try {
      const { topic_id, question_type, programming_language, language, amount } = req.body;
      const trainerId = req.auth?.trainer?.trainer_id || req.body.trainer_id;

      if (!trainerId) {
        return res.status(401).json({
          error: 'Trainer ID is required',
        });
      }

      logger.info('[ExerciseController] Generating AI exercises', {
        topic_id,
        trainer_id: trainerId,
        question_type,
        amount,
      });

      const exercises = await this.createExercisesUseCase.generateAIExercises({
        topic_id,
        question_type,
        programming_language,
        language,
        amount: amount || 4,
        created_by: trainerId,
      });

      return res.status(201).json({
        success: true,
        exercises: exercises.map(ex => ex.toJSON()),
        count: exercises.length,
      });
    } catch (error) {
      logger.error('[ExerciseController] Error generating AI exercises', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * Create a single manual exercise (validate and save)
   * POST /api/exercises/manual
   */
  async createManualExercise(req, res, next) {
    try {
      const {
        topic_id,
        question_text,
        question_type,
        programming_language,
        language,
        hint,
        solution,
      } = req.body;
      const trainerId = req.auth?.trainer?.trainer_id || req.body.trainer_id;

      if (!trainerId) {
        return res.status(401).json({
          error: 'Trainer ID is required',
        });
      }

      logger.info('[ExerciseController] Creating manual exercise', {
        topic_id,
        trainer_id: trainerId,
        question_text: question_text?.substring(0, 100),
      });

      const exercise = await this.createExercisesUseCase.createManualExercise({
        topic_id,
        question_text,
        question_type,
        programming_language,
        language,
        hint,
        solution,
        created_by: trainerId,
      });

      return res.status(201).json({
        success: true,
        exercise: exercise.toJSON(),
      });
    } catch (error) {
      logger.error('[ExerciseController] Error creating manual exercise', {
        error: error.message,
        stack: error.stack,
      });

      // Check if it's a validation error
      if (error.message.includes('validation failed') || error.message.includes('rejected')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          validation_failed: true,
        });
      }

      next(error);
    }
  }

  /**
   * Create multiple manual exercises in batch
   * POST /api/exercises/manual/batch
   */
  async createManualExercisesBatch(req, res, next) {
    try {
      const { topic_id, exercises } = req.body;
      const trainerId = req.auth?.trainer?.trainer_id || req.body.trainer_id;

      if (!trainerId) {
        return res.status(401).json({
          error: 'Trainer ID is required',
        });
      }

      logger.info('[ExerciseController] Creating batch of manual exercises', {
        topic_id,
        trainer_id: trainerId,
        exercisesCount: exercises?.length || 0,
      });

      const createdExercises = await this.createExercisesUseCase.createManualExercisesBatch({
        topic_id,
        exercises,
        created_by: trainerId,
      });

      return res.status(201).json({
        success: true,
        exercises: createdExercises.map(ex => ex.toJSON()),
        count: createdExercises.length,
      });
    } catch (error) {
      logger.error('[ExerciseController] Error creating batch of manual exercises', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
}

