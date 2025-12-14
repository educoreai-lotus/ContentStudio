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
   *     programming_language: string (required for code),
   *     language: string,
   *     amount: number (always 4 for both code and theoretical),
   *     theoretical_question_type: "multiple_choice" | "open_ended" (required for theoretical),
   *     created_by: string (trainer_id)
   *   }
   * @returns {Promise<Exercise[]>} Created exercises
   */
  async generateAIExercises(requestData) {
    const { topic_id, question_type, programming_language, language, amount = 4, theoretical_question_type, created_by } = requestData;

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
      language: language || topic.language || 'en', // Use lowercase 'language' for consistency
      amount: amount, // Always 4 for both code and theoretical
      theoretical_question_type: theoretical_question_type, // Only for theoretical questions
    };

    // Call Devlab to generate exercises
    let dablaResponse;
    try {
      dablaResponse = await generateAIExercises(exerciseRequest);
    } catch (error) {
      logger.error('[CreateExercisesUseCase] Failed to generate AI exercises from Devlab', {
        topic_id,
        error: error.message,
      });
      // Return failure response - no error details
      return { success: false };
    }

    // Validate response structure (DevlabClient now returns structured data directly)
    if (!dablaResponse || !dablaResponse.html || !dablaResponse.questions) {
      logger.error('[CreateExercisesUseCase] Invalid response from DevlabClient: missing html or questions', {
        topic_id,
        hasHtml: !!dablaResponse?.html,
        hasQuestions: Array.isArray(dablaResponse?.questions),
        questionsCount: dablaResponse?.questions?.length || 0,
      });
      return { success: false };
    }

    // Extract structured data (already parsed by DevlabClient)
    const htmlCode = dablaResponse.html;
    const questions = dablaResponse.questions;
    const metadata = dablaResponse.metadata || {};

    // Validate required fields
    if (!htmlCode || typeof htmlCode !== 'string' || htmlCode.length === 0) {
      logger.error('[CreateExercisesUseCase] Missing or invalid html field', {
        topic_id,
        hasHtml: !!htmlCode,
        htmlType: typeof htmlCode,
      });
      return { success: false };
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      logger.error('[CreateExercisesUseCase] Missing or empty questions array', {
        topic_id,
        hasQuestions: !!questions,
        questionsType: typeof questions,
        questionsLength: questions?.length || 0,
      });
      return { success: false };
    }

    // Save to database atomically (transaction)
    const { db } = await import('../../infrastructure/database/DatabaseConnection.js');
    const client = await db.getClient();
    let createdExercises = [];
    let hints = [];

    try {
      await client.query('BEGIN');

      // Save HTML code to devlab_exercises in topics table (using client for transaction)
      const updateSql = `
        UPDATE topics
        SET devlab_exercises = $1::jsonb
        WHERE topic_id = $2
      `;
      await client.query(updateSql, [JSON.stringify(htmlCode), topic_id]);

      // Create Exercise entities from questions
      const exerciseEntities = questions.map((questionData, index) => {
        // Extract question fields
        const questionText = questionData.title || questionData.description || questionData.question_text || '';
        const questionDescription = questionData.description || questionData.title || '';
        const questionDifficulty = questionData.difficulty || null;
        const questionLanguage = questionData.language || language || topic.language || 'en';
        const testCases = questionData.testCases || questionData.test_cases || null;
        const expectsReturn = questionData.expectsReturn || questionData.expects_return || null;
        const hintText = questionData.hint || null;

        return {
          topic_id,
          question_text: questionText,
          question_type: question_type || 'code',
          programming_language: programming_language || '',
          language: questionLanguage,
          skills: topic.skills || [],
          hint: hintText,
          solution: questionData.solution || null,
          test_cases: testCases,
          difficulty: questionDifficulty,
          points: 10,
          order_index: index,
          generation_mode: 'ai',
          validation_status: 'approved',
          validation_message: null,
          devlab_response: {
            html: htmlCode,
            question: questionData,
            metadata: metadata,
            generated_at: metadata.generated_at || new Date().toISOString(),
          },
          created_by,
          status: 'active',
        };
      });

      // Save all exercises to database (using client for transaction)
      const insertQuery = `
        INSERT INTO exercises (
          topic_id, question_text, question_type, programming_language, language,
          skills, hint, solution, test_cases, difficulty, points, order_index,
          generation_mode, validation_status, validation_message, devlab_response,
          created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;

      for (const exercise of exerciseEntities) {
        const values = [
          exercise.topic_id,
          exercise.question_text,
          exercise.question_type,
          exercise.programming_language || null,
          exercise.language || 'en',
          exercise.skills || [],
          exercise.hint || null,
          exercise.solution || null,
          exercise.test_cases ? JSON.stringify(exercise.test_cases) : null,
          exercise.difficulty || null,
          exercise.points || 10,
          exercise.order_index || 0,
          exercise.generation_mode,
          exercise.validation_status || 'pending',
          exercise.validation_message || null,
          exercise.devlab_response ? JSON.stringify(exercise.devlab_response) : null,
          exercise.created_by,
          exercise.status || 'active',
        ];

        const result = await client.query(insertQuery, values);
        const row = result.rows[0];
        const createdExercise = this.exerciseRepository.mapRowToExercise(row);
        createdExercises.push(createdExercise);

        // Collect hints with question_id
        if (createdExercise.hint) {
          hints.push({
            question_id: createdExercise.exercise_id,
            hint: createdExercise.hint,
          });
        }
      }

      await client.query('COMMIT');

      logger.info('[CreateExercisesUseCase] Successfully created AI exercises', {
        topic_id,
        exercisesCount: createdExercises.length,
        hintsCount: hints.length,
      });

      // Return success response with clean data
      return {
        success: true,
        message: 'Questions generated successfully',
        data: {
          questions: createdExercises.map(ex => ({
            exercise_id: ex.exercise_id,
            question_text: ex.question_text,
            difficulty: ex.difficulty,
            language: ex.language,
            test_cases: ex.test_cases,
            order_index: ex.order_index,
          })),
          hints: hints,
        },
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      logger.error('[CreateExercisesUseCase] Database save failed', {
        topic_id,
        error: dbError.message,
      });
      return { success: false };
    } finally {
      client.release();
    }
  }

  /**
   * Create manual code exercises (always 4 exercises together)
   * Validates all 4 with Coordinator/DevLab before saving
   * @param {Object} requestData - Request data:
   *   {
   *     topic_id: number,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" (only code allowed),
   *     programming_language: string (required),
   *     language: string,
   *     exercises: Array<{ question_text, hint?, solution? }> (exactly 4),
   *     created_by: string (trainer_id)
   *   }
   * @returns {Promise<Exercise[]>} Created and validated exercises (4 exercises)
   */
  async createManualExercises(requestData) {
    const {
      topic_id,
      topic_name,
      skills,
      question_type,
      programming_language,
      language,
      exercises, // Array of 4
      created_by,
    } = requestData;

    // Validate required fields
    if (!topic_id) {
      throw new Error('topic_id is required');
    }
    if (!created_by) {
      throw new Error('created_by (trainer_id) is required');
    }
    if (question_type !== 'code') {
      throw new Error('Manual exercises are only allowed for code questions. Theoretical questions must be AI-generated.');
    }
    if (!programming_language || !programming_language.trim()) {
      throw new Error('Programming language is required for code questions');
    }
    if (!Array.isArray(exercises) || exercises.length !== 4) {
      throw new Error('Manual code exercises must include exactly 4 questions');
    }

    // Fetch topic to get additional info if needed
    const topic = await this.topicRepository.findById(topic_id);
    if (!topic) {
      throw new Error(`Topic with id ${topic_id} not found`);
    }

    logger.info('[CreateExercisesUseCase] Validating 4 manual code exercises together', {
      topic_id,
      topic_name: topic_name || topic.topic_name,
      programming_language,
      exercisesCount: exercises.length,
    });

    // Build validation request for Coordinator
    // exercises should be an array of strings (question texts)
    const validationRequest = {
      topic_id: topic_id.toString(),
      topic_name: topic_name || topic.topic_name || '',
      skills: skills || topic.skills || [],
      question_type: 'code',
      programming_language: programming_language,
      language: language || topic.language || 'en', // Use lowercase 'language' for consistency
      exercises: exercises.map(ex => {
        // Support both string format and object format
        if (typeof ex === 'string') {
          return ex;
        }
        return ex.question_text || '';
      }), // Array of 4 question strings
    };

    // Call Coordinator to validate all 4 exercises together
    let validationResult;
    try {
      validationResult = await validateManualExercise(validationRequest);
    } catch (error) {
      logger.error('[CreateExercisesUseCase] Failed to validate manual exercises with Coordinator', {
        topic_id,
        error: error.message,
      });
      throw new Error(`Failed to validate exercises: ${error.message}`);
    }

    // Check validation result
    // Coordinator returns: { answer: "string" }
    // answer can be:
    // 1. A JSON stringified object with { success: true, data: { status: "needs_revision", message: "..." } } - validation failed
    // 2. A plain HTML/CSS/JS code string - validation passed
    const answer = validationResult.answer || '';

    // Try to parse answer as JSON to check if it's a validation rejection
    let parsedAnswer;
    let isNeedsRevision = false;
    let revisionMessage = '';

    try {
      parsedAnswer = JSON.parse(answer);
      // Check if it's a validation rejection response
      if (parsedAnswer && 
          parsedAnswer.success === true && 
          parsedAnswer.data && 
          parsedAnswer.data.status === 'needs_revision' &&
          typeof parsedAnswer.data.message === 'string') {
        isNeedsRevision = true;
        revisionMessage = parsedAnswer.data.message;
      }
    } catch (parseError) {
      // Not JSON, treat as plain code string
      parsedAnswer = null;
    }

    // If validation failed (needs_revision), throw error with message for trainer
    if (isNeedsRevision) {
      logger.warn('[CreateExercisesUseCase] Exercises validation rejected - needs revision', {
        topic_id,
        revisionMessage,
      });
      throw new Error(revisionMessage);
    }

    // If answer is empty, treat as error
    if (answer.length === 0) {
      const errorMessage = 'Exercise validation failed - empty response';
      logger.warn('[CreateExercisesUseCase] Exercises validation rejected - empty answer', {
        topic_id,
      });
      throw new Error(errorMessage);
    }

    // Check if answer looks like code (contains HTML/CSS/JS patterns)
    const looksLikeCode = answer.includes('<') || 
                         answer.includes('function') || 
                         answer.includes('const') || 
                         answer.includes('let') ||
                         answer.includes('{') ||
                         answer.includes('css') ||
                         answer.includes('html');

    if (!looksLikeCode) {
      // If it doesn't look like code, it might be an error message
      const errorMessage = answer || 'Exercise validation failed';
      logger.warn('[CreateExercisesUseCase] Exercises validation rejected - answer does not look like code', {
        topic_id,
        errorMessage: errorMessage.substring(0, 200),
      });
      throw new Error(errorMessage);
    }

    // If answer contains code (not error), save it to devlab_exercises in topics table
    const htmlCode = answer;
    
    // Save the answer code to devlab_exercises field in topics table
    try {
      await this.topicRepository.updateDevlabExercises(topic_id, htmlCode);
      logger.info('[CreateExercisesUseCase] Saved answer code to devlab_exercises in topics table', {
        topic_id,
        answerLength: htmlCode.length,
      });
    } catch (updateError) {
      logger.warn('[CreateExercisesUseCase] Failed to update devlab_exercises in topics table', {
        topic_id,
        error: updateError.message,
      });
      // Continue even if update fails - exercises will still be created
    }

    // Get validated exercises from response (if provided) or use original exercises
    let validatedExercises = validationResult.exercises;
    if (!Array.isArray(validatedExercises) || validatedExercises.length !== 4) {
      // If exercises array not provided, use original exercises and add html_code
      validatedExercises = exercises.map((ex, index) => ({
        question_text: ex.question_text || '',
        hint: ex.hint || null,
        solution: ex.solution || null,
        html_code: htmlCode, // Use the same HTML code for all exercises
      }));
    } else {
      // If exercises array provided, add html_code to each
      validatedExercises = validatedExercises.map((ex, index) => ({
        ...ex,
        html_code: ex.html_code || htmlCode, // Use exercise-specific code or fallback to answer
      }));
    }

    // Get the next order_index for this topic
    const existingExercises = await this.exerciseRepository.findByTopicId(topic_id);
    const startOrderIndex = existingExercises.length;

    // Create Exercise entities from validated response
    const exerciseEntities = validatedExercises.map((exerciseData, index) => {
      return new Exercise({
        topic_id,
        question_text: exerciseData.question_text || exercises[index].question_text || '',
        question_type: 'code',
        programming_language: programming_language,
        language: language || topic.language || 'en',
        skills: skills || topic.skills || [],
        hint: exerciseData.hint || exercises[index].hint || null,
        solution: exerciseData.solution || exercises[index].solution || null,
        html_code: exerciseData.html_code || htmlCode, // HTML/CSS/JS code for display
        test_cases: exerciseData.test_cases || null,
        difficulty: exerciseData.difficulty || null,
        points: exerciseData.points || 10,
        order_index: startOrderIndex + index,
        generation_mode: 'manual',
        validation_status: 'approved',
        validation_message: null,
        devlab_response: {
          ...exerciseData,
          verified: validationResult.verified,
          answer: htmlCode, // Store the answer code
        },
        created_by,
        status: 'active',
      });
    });

    // Save all 4 exercises to database
    const createdExercises = await this.exerciseRepository.createBatch(exerciseEntities);

    logger.info('[CreateExercisesUseCase] Successfully created 4 manual code exercises', {
      topic_id,
      exercisesCount: createdExercises.length,
      verified: validationResult.verified,
    });

    return createdExercises;
  }

  /**
   * Validate and create a single manual exercise (DEPRECATED - use createManualExercises for code)
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

