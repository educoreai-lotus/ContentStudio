import { Exercise } from '../../domain/entities/Exercise.js';
import { logger } from '../../infrastructure/logging/Logger.js';
import { generateAIExercises, validateManualExercise } from '../../infrastructure/devlabClient/devlabClient.js';

/**
 * Create Exercises Use Case
 * Handles creation of DevLab exercises for a topic
 * Supports both AI and Manual generation modes
 */
export class CreateExercisesUseCase {
  constructor({ exerciseRepository, topicRepository }) {
    this.exerciseRepository = exerciseRepository;
    this.topicRepository = topicRepository;
  }

  /**
   * Generate AI exercises for a topic
   * @param {Object} requestData - Request data:
   *   {
   *     topic_id: number,
   *     question_type: "code" | "theoretical",
   *     programming_language: string,
   *     language: string,
   *     amount: number (default 4),
   *     created_by: string (trainer_id)
   *   }
   * @returns {Promise<Exercise[]>} Created exercises
   */
  async generateAIExercises(requestData) {
    const { topic_id, question_type, programming_language, language, amount = 4, created_by } = requestData;

    // Validate required fields
    if (!topic_id) {
      throw new Error('topic_id is required');
    }
    if (!created_by) {
      throw new Error('created_by (trainer_id) is required');
    }

    // Fetch topic to get topic_name and skills
    const topic = await this.topicRepository.findById(topic_id);
    if (!topic) {
      throw new Error(`Topic with id ${topic_id} not found`);
    }

    logger.info('[CreateExercisesUseCase] Generating AI exercises', {
      topic_id,
      topic_name: topic.topic_name,
      question_type,
      amount,
    });

    // Build exercise request for Dabla
    const exerciseRequest = {
      topic_id: topic_id.toString(),
      topic_name: topic.topic_name || '',
      skills: topic.skills || [],
      question_type: question_type || 'code',
      programming_language: programming_language || '',
      Language: language || topic.language || 'en',
      amount: amount,
    };

    // Call Dabla to generate exercises
    let dablaResponse;
    try {
      dablaResponse = await generateAIExercises(exerciseRequest);
    } catch (error) {
      logger.error('[CreateExercisesUseCase] Failed to generate AI exercises from Dabla', {
        topic_id,
        error: error.message,
      });
      throw new Error(`Failed to generate AI exercises: ${error.message}`);
    }

    // Validate response structure
    if (!dablaResponse || !Array.isArray(dablaResponse.exercises)) {
      throw new Error('Invalid response from Dabla: exercises array not found');
    }

    // Create Exercise entities from Dabla response
    const exercises = dablaResponse.exercises.map((exerciseData, index) => {
      return new Exercise({
        topic_id,
        question_text: exerciseData.question_text || exerciseData.question || '',
        question_type: question_type || 'code',
        programming_language: programming_language || '',
        language: language || topic.language || 'en',
        skills: topic.skills || [],
        hint: exerciseData.hint || null,
        solution: exerciseData.solution || null,
        test_cases: exerciseData.test_cases || null,
        difficulty: exerciseData.difficulty || null,
        points: exerciseData.points || 10,
        order_index: index,
        generation_mode: 'ai',
        validation_status: 'approved', // AI exercises are auto-approved
        validation_message: null,
        devlab_response: exerciseData, // Store full response
        created_by,
        status: 'active',
      });
    });

    // Save all exercises to database
    const createdExercises = await this.exerciseRepository.createBatch(exercises);

    logger.info('[CreateExercisesUseCase] Successfully created AI exercises', {
      topic_id,
      exercisesCount: createdExercises.length,
    });

    return createdExercises;
  }

  /**
   * Validate and create a single manual exercise
   * @param {Object} exerciseData - Exercise data:
   *   {
   *     topic_id: number,
   *     question_text: string,
   *     question_type: "code" | "theoretical",
   *     programming_language: string,
   *     language: string,
   *     hint: string (optional),
   *     solution: string (optional),
   *     created_by: string (trainer_id)
   *   }
   * @returns {Promise<Exercise>} Created and validated exercise
   */
  async createManualExercise(exerciseData) {
    const {
      topic_id,
      question_text,
      question_type,
      programming_language,
      language,
      hint,
      solution,
      created_by,
    } = exerciseData;

    // Validate required fields
    if (!topic_id) {
      throw new Error('topic_id is required');
    }
    if (!question_text) {
      throw new Error('question_text is required');
    }
    if (!created_by) {
      throw new Error('created_by (trainer_id) is required');
    }

    // Fetch topic to get topic_name and skills
    const topic = await this.topicRepository.findById(topic_id);
    if (!topic) {
      throw new Error(`Topic with id ${topic_id} not found`);
    }

    logger.info('[CreateExercisesUseCase] Validating manual exercise', {
      topic_id,
      question_text: question_text.substring(0, 100),
    });

    // Build validation request for Dabla
    const validationRequest = {
      topic_id: topic_id.toString(),
      topic_name: topic.topic_name || '',
      skills: topic.skills || [],
      question_type: question_type || 'code',
      programming_language: programming_language || '',
      Language: language || topic.language || 'en',
      question_text,
      hint: hint || null,
      solution: solution || null,
    };

    // Call Dabla to validate exercise
    let validationResult;
    try {
      validationResult = await validateManualExercise(validationRequest);
    } catch (error) {
      logger.error('[CreateExercisesUseCase] Failed to validate manual exercise with Dabla', {
        topic_id,
        error: error.message,
      });
      throw new Error(`Failed to validate exercise: ${error.message}`);
    }

    // Check validation result
    if (!validationResult.valid) {
      const errorMessage = validationResult.message || 'Exercise validation failed';
      logger.warn('[CreateExercisesUseCase] Exercise validation rejected', {
        topic_id,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    // Get the next order_index for this topic
    const existingExercises = await this.exerciseRepository.findByTopicId(topic_id);
    const nextOrderIndex = existingExercises.length;

    // Create Exercise entity
    const exercise = new Exercise({
      topic_id,
      question_text,
      question_type: question_type || 'code',
      programming_language: programming_language || '',
      language: language || topic.language || 'en',
      skills: topic.skills || [],
      hint: hint || null,
      solution: solution || null,
      test_cases: validationResult.exercise?.test_cases || null,
      difficulty: validationResult.exercise?.difficulty || null,
      points: validationResult.exercise?.points || 10,
      order_index: nextOrderIndex,
      generation_mode: 'manual',
      validation_status: 'approved',
      validation_message: null,
      devlab_response: validationResult, // Store full validation response
      created_by,
      status: 'active',
    });

    // Save exercise to database
    const createdExercise = await this.exerciseRepository.create(exercise);

    logger.info('[CreateExercisesUseCase] Successfully created manual exercise', {
      topic_id,
      exercise_id: createdExercise.exercise_id,
    });

    return createdExercise;
  }

  /**
   * Create multiple manual exercises in batch (after all are validated)
   * @param {Object} requestData - Request data:
   *   {
   *     topic_id: number,
   *     exercises: Array<{
   *       question_text: string,
   *       question_type: "code" | "theoretical",
   *       programming_language: string,
   *       language: string,
   *       hint: string (optional),
   *       solution: string (optional)
   *     }>,
   *     created_by: string (trainer_id)
   *   }
   * @returns {Promise<Exercise[]>} Created exercises
   */
  async createManualExercisesBatch(requestData) {
    const { topic_id, exercises, created_by } = requestData;

    if (!topic_id) {
      throw new Error('topic_id is required');
    }
    if (!Array.isArray(exercises) || exercises.length === 0) {
      throw new Error('exercises array is required and must not be empty');
    }
    if (!created_by) {
      throw new Error('created_by (trainer_id) is required');
    }

    logger.info('[CreateExercisesUseCase] Creating batch of manual exercises', {
      topic_id,
      exercisesCount: exercises.length,
    });

    // Validate and create each exercise
    const createdExercises = [];
    for (const exerciseData of exercises) {
      try {
        const exercise = await this.createManualExercise({
          ...exerciseData,
          topic_id,
          created_by,
        });
        createdExercises.push(exercise);
      } catch (error) {
        logger.error('[CreateExercisesUseCase] Failed to create exercise in batch', {
          topic_id,
          error: error.message,
        });
        // Continue with other exercises even if one fails
      }
    }

    logger.info('[CreateExercisesUseCase] Successfully created batch of manual exercises', {
      topic_id,
      createdCount: createdExercises.length,
      requestedCount: exercises.length,
    });

    return createdExercises;
  }
}

