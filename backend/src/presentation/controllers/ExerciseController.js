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
    this.topicRepository = new PostgreSQLTopicRepository();

    // Initialize use case
    this.createExercisesUseCase = new CreateExercisesUseCase({
      exerciseRepository: this.exerciseRepository,
      topicRepository: this.topicRepository,
    });
  }

  /**
   * Get all exercises for a topic
   * GET /api/exercises/topic/:topicId
   * Returns exercises from topics.devlab_exercises JSONB field (new format)
   * Falls back to exercises table if devlab_exercises is empty
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

      // First, try to get exercises from topics.devlab_exercises (new format)
      const topic = await this.topicRepository.findById(topicIdNum);
      
      logger.info('[ExerciseController] Topic found', {
        topic_id: topicIdNum,
        hasTopic: !!topic,
        hasDevlabExercises: !!topic?.devlab_exercises,
        devlabExercisesType: topic?.devlab_exercises ? typeof topic.devlab_exercises : 'none',
      });
      
      if (topic && topic.devlab_exercises) {
        try {
          // devlab_exercises is stored as JSONB: { html: "...", questions: [...], metadata: {...} }
          const devlabData = typeof topic.devlab_exercises === 'string' 
            ? JSON.parse(topic.devlab_exercises) 
            : topic.devlab_exercises;
          
          logger.info('[ExerciseController] Parsed devlab_exercises', {
            topic_id: topicIdNum,
            hasDevlabData: !!devlabData,
            hasQuestions: !!devlabData?.questions,
            questionsIsArray: Array.isArray(devlabData?.questions),
            questionsLength: devlabData?.questions?.length || 0,
            devlabDataKeys: devlabData ? Object.keys(devlabData) : [],
          });
          
          if (devlabData && devlabData.questions && Array.isArray(devlabData.questions) && devlabData.questions.length > 0) {
            logger.info('[ExerciseController] Found exercises in topics.devlab_exercises', {
              topic_id: topicIdNum,
              questionsCount: devlabData.questions.length,
            });
            
            // Map questions to frontend format
            const exercises = devlabData.questions.map((q, index) => ({
              exercise_id: `exercise_${topicIdNum}_${index + 1}`,
              question_text: q.question_text || q.stem || q.title || q.description || '',
              difficulty: q.difficulty || null,
              language: q.language || topic.language || 'en',
              test_cases: q.test_cases || null,
              order_index: q.order_index || (index + 1),
              hint: q.hint || null,
              question_type: q.question_type || 'code', // Include question_type
              // Include theoretical question specific fields
              ...(q.question_type === 'theoretical' && {
                options: q.options || null,
                explanation: q.explanation || null,
                type: q.type || 'mcq',
                solution: q.solution || null, // Include solution for theoretical
              }),
              // Include code question specific fields
              ...(q.question_type === 'code' && {
                programming_language: q.programming_language || null,
                solution: q.solution || null,
              }),
            }));
            
            // Collect hints
            const hints = exercises
              .filter(ex => ex.hint)
              .map((ex, index) => ({
                question_id: ex.exercise_id,
                hint: ex.hint,
              }));
            
            return res.status(200).json({
              success: true,
              exercises: exercises,
              hints: hints,
              count: exercises.length,
              source: 'devlab_exercises',
            });
          }
        } catch (parseError) {
          logger.warn('[ExerciseController] Failed to parse devlab_exercises, falling back to exercises table', {
            topic_id: topicIdNum,
            error: parseError.message,
          });
        }
      }
      
      // Fallback: get from exercises table (old format)
      const exercises = await this.exerciseRepository.findByTopicId(topicIdNum);

      return res.status(200).json({
        success: true,
        exercises: exercises.map(ex => ex.toJSON()),
        hints: [],
        count: exercises.length,
        source: 'exercises_table',
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
      const { topic_id, question_type, programming_language, language, amount, theoretical_question_type } = req.body;
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
        amount: amount || 4,
        theoretical_question_type,
      });

      const result = await this.createExercisesUseCase.generateAIExercises({
        topic_id,
        question_type,
        programming_language,
        language,
        amount: amount || 4, // Always 4 for both code and theoretical
        theoretical_question_type,
        created_by: trainerId,
      });

      logger.info('[ExerciseController] Use case result', {
        topic_id,
        success: result?.success,
        hasData: !!result?.data,
        dataKeys: result?.data ? Object.keys(result?.data) : [],
        questionsCount: result?.data?.questions?.length || 0,
        hintsCount: result?.data?.hints?.length || 0,
        message: result?.message,
      });

      // Handle new response format: { success: true/false, ... }
      if (result && result.success === true) {
        logger.info('[ExerciseController] Returning success response', {
          topic_id,
          status: 201,
          questionsCount: result.data?.questions?.length || 0,
        });
        return res.status(201).json(result);
      } else {
        // Failure response - minimal, no error details (200 status per requirements)
        logger.warn('[ExerciseController] Returning failure response', {
          topic_id,
          status: 200,
          resultSuccess: result?.success,
        });
        return res.status(200).json({ success: false });
      }
    } catch (error) {
      logger.error('[ExerciseController] Error generating AI exercises', {
        error: error.message,
        stack: error.stack,
      });
      // Return minimal failure response (200 status per requirements)
      return res.status(200).json({ success: false });
    }
  }

  /**
   * Create manual code exercises (always 4 exercises together)
   * POST /api/exercises/manual
   * 
   * Request body:
   * {
   *   topic_id: number,
   *   topic_name: string,
   *   skills: string[],
   *   question_type: "code" (only code allowed),
   *   programming_language: string (required),
   *   language: string,
   *   exercises: Array<{ question_text, hint?, solution? }> (exactly 4)
   * }
   */
  async createManualExercise(req, res, next) {
    try {
      const {
        topic_id,
        topic_name,
        skills,
        question_type,
        programming_language,
        language,
        exercises, // Array of 4 exercises
      } = req.body;
      const trainerId = req.auth?.trainer?.trainer_id || req.body.trainer_id;

      if (!trainerId) {
        return res.status(401).json({
          error: 'Trainer ID is required',
        });
      }

      // Validate that only code questions can be manual
      if (question_type !== 'code') {
        return res.status(400).json({
          success: false,
          error: 'Manual exercises are only allowed for code questions. Theoretical questions must be AI-generated.',
          validation_failed: true,
        });
      }

      // Validate programming_language is provided
      if (!programming_language || !programming_language.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Programming language is required for code questions',
          validation_failed: true,
        });
      }

      // Validate exercises array exists and has exactly 4 items
      if (!Array.isArray(exercises) || exercises.length !== 4) {
        return res.status(400).json({
          success: false,
          error: 'Manual code exercises must include exactly 4 questions',
          validation_failed: true,
        });
      }

      // Validate all exercises have question_text
      const emptyExercises = exercises.filter(ex => !ex.question_text || !ex.question_text.trim());
      if (emptyExercises.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'All 4 exercises must have question text',
          validation_failed: true,
        });
      }

      logger.info('[ExerciseController] Creating manual code exercises (4 together)', {
        topic_id,
        topic_name,
        trainer_id: trainerId,
        question_type,
        programming_language,
        exercisesCount: exercises.length,
      });

      const createdExercises = await this.createExercisesUseCase.createManualExercises({
        topic_id,
        topic_name,
        skills: skills || [],
        question_type: 'code',
        programming_language,
        language: language || 'en',
        exercises,
        created_by: trainerId,
      });

      logger.info('[ExerciseController] Manual exercises created successfully', {
        topic_id,
        exercisesCount: createdExercises.length,
      });

      return res.status(201).json({
        success: true,
        message: 'Exercises created and validated successfully',
        data: {
          questions: createdExercises,
          count: createdExercises.length,
        },
      });
    } catch (error) {
      logger.error('[ExerciseController] Error creating manual exercises', {
        error: error.message,
        stack: error.stack,
      });

      // Check if it's a validation error (needs_revision or validation failed)
      if (error.message.includes('validation failed') || 
          error.message.includes('rejected') || 
          error.message.includes('needs_revision') ||
          error.message.includes('Manual exercises are only allowed')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          validation_failed: true,
        });
      }

      // Other errors - return generic failure
      return res.status(500).json({
        success: false,
        error: 'Failed to create exercises',
      });
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

