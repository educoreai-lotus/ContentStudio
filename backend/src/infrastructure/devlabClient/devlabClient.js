import axios from 'axios';
import qs from 'qs';
import { logger } from '../logging/Logger.js';

/**
 * DevLab Client
 * Handles communication between Content Studio and DevLab microservice
 * Uses Stringified JSON Protocol over application/x-www-form-urlencoded
 * 
 * Protocol:
 * - Request: POST with serviceName="ContentStudio" and payload=JSON.stringify(object)
 * - Response: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
 */
export class DevlabClient {
  constructor() {
    // Get Coordinator microservice URL from environment variable
    const coordinatorUrl = process.env.COORDINATOR_URL;
    
    if (!coordinatorUrl) {
      logger.warn('[DevlabClient] COORDINATOR_URL not configured, DevLab integration will not work');
      this.baseUrl = null;
    } else {
      // Remove trailing slash if present
      this.baseUrl = coordinatorUrl.replace(/\/$/, '');
      logger.info('[DevlabClient] Initialized with Coordinator URL', {
        baseUrl: this.baseUrl,
      });
    }
  }

  /**
   * Get rollback mock data when external request fails
   * @param {Object} payload - Original payload sent to DevLab
   * @returns {Object} Mock data matching expected structure
   */
  getRollbackMockData(payload) {
    return {
      question: payload.question || '',
      course_id: payload.course_id || '',
      trainer_id: payload.trainer_id || '',
      valid: false,
      message: 'DevLab unavailable – returned rollback',
      ajax: null,
    };
  }

  /**
   * Send request to DevLab microservice
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from DevLab or rollback mock data
   */
  async sendRequest(payload) {
    // If baseUrl is not configured, return rollback immediately
    if (!this.baseUrl) {
      logger.warn('[DevlabClient] DevLab URL not configured, using rollback mock data', {
        payloadKeys: Object.keys(payload),
      });
      return this.getRollbackMockData(payload);
    }

    const endpoint = `${this.baseUrl}/api/check-trainer-question`;

    try {
      // Validate payload
      if (typeof payload !== 'object' || payload === null) {
        logger.warn('[DevlabClient] Invalid payload, using rollback mock data', {
          payloadType: typeof payload,
        });
        return this.getRollbackMockData(payload || {});
      }

      // Convert payload to JSON string
      let payloadString;
      try {
        payloadString = JSON.stringify(payload);
      } catch (stringifyError) {
        logger.warn('[DevlabClient] Failed to stringify payload, using rollback mock data', {
          error: stringifyError.message,
          payloadKeys: Object.keys(payload),
        });
        return this.getRollbackMockData(payload);
      }

      // Build request body using qs.stringify
      // Protocol: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending request to Coordinator', {
        endpoint,
        payloadKeys: Object.keys(payload),
        payloadStringLength: payloadString.length,
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Validate response structure
      // Coordinator always returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        logger.warn('[DevlabClient] Coordinator returned invalid response structure, using rollback mock data', {
          endpoint,
          responseType: typeof response.data,
        });
        return this.getRollbackMockData(payload);
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        logger.warn('[DevlabClient] Coordinator response missing or invalid payload field, using rollback mock data', {
          endpoint,
          payloadType: typeof response.data.payload,
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Coordinator returns payload as stringified JSON
      // After parsing, payload contains: { verified: boolean, answer: "string", ...other fields }
      // NO devlab_exercises field in response!
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        logger.warn('[DevlabClient] Failed to parse payload from Coordinator response, using rollback mock data', {
          error: parseError.message,
          payload: response.data.payload.substring(0, 200),
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[DevlabClient] Coordinator returned invalid payload structure, using rollback mock data', {
          endpoint,
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      // Coordinator fills the response fields: verified, answer, etc.
      // NO devlab_exercises field in response!
      logger.info('[DevlabClient] Successfully received response from Coordinator', {
        endpoint,
        payloadKeys: Object.keys(responsePayload),
        verified: responsePayload.verified,
        hasAnswer: !!responsePayload.answer,
        valid: responsePayload.valid, // backward compatibility
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[DevlabClient] External request failed, using rollback mock data instead', {
        error: error.message,
        endpoint,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      return this.getRollbackMockData(payload);
    }
  }

  /**
   * Generate AI exercises from Coordinator/DevLab
   * Used when trainer selects AI mode for exercise generation
   * 
   * IMPORTANT RULES:
   * - Code questions: Can be generated via AI OR manual (4 questions sent together)
   * - Theoretical questions: ONLY AI (manual not allowed)
   * 
   * @param {Object} exerciseRequest - Exercise generation request:
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" | "theoretical",
   *     programming_language: string (required only for code questions),
   *     Language: string,
   *     amount: number (default 4, always 4 for code questions)
   *   }
   * @returns {Promise<Object>} Response with exercises array and verified status:
   *   {
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string,
   *       solution: string,
   *       test_cases: any,
   *       difficulty: string,
   *       html_code: string (HTML code to display the exercise),
   *       ...other fields
   *     }>,
   *     verified: boolean,
   *     answer: "string" (code HTML/CSS/JS or error message) - NO devlab_exercises field!
   *   }
   */
  async generateAIExercises(exerciseRequest) {
    if (!this.baseUrl) {
      logger.warn('[DevlabClient] Coordinator URL not configured, cannot generate AI exercises', {
        topicId: exerciseRequest?.topic_id,
      });
      throw new Error('Coordinator URL not configured');
    }

    // Validate question type
    const questionType = exerciseRequest.question_type || 'code';
    if (questionType === 'theoretical') {
      // Theoretical questions are AI-only - this is enforced by the caller
      logger.info('[DevlabClient] Generating AI theoretical exercises', {
        topicId: exerciseRequest?.topic_id,
      });
    } else if (questionType === 'code') {
      // Code questions can be AI or manual, but programming_language is required
      if (!exerciseRequest.programming_language) {
        throw new Error('Programming language is required for code questions');
      }
      logger.info('[DevlabClient] Generating AI code exercises', {
        topicId: exerciseRequest?.topic_id,
        programmingLanguage: exerciseRequest.programming_language,
      });
    }

    const endpoint = `${this.baseUrl}/api/generate-exercises`;

    try {
      // Validate exerciseRequest
      if (!exerciseRequest || typeof exerciseRequest !== 'object') {
        throw new Error('Invalid exercise request');
      }

      // Build payload with required fields
      // Protocol: { requester_service: "content-studio", payload: { action, ... }, response: { answer: "" } }
      // For code questions: amount is always 4, programming_language is required
      // For theoretical questions: amount can vary, no programming_language
      const payloadData = {
        action: 'generate-questions',
        topic_id: exerciseRequest.topic_id || '',
        topic_name: exerciseRequest.topic_name || '',
        question_type: questionType,
        skills: Array.isArray(exerciseRequest.skills) ? exerciseRequest.skills : [],
        humanLanguage: exerciseRequest.Language || exerciseRequest.language || 'en',
        amount: questionType === 'code' ? 4 : (exerciseRequest.amount || 4),
      };

      // Add programming_language only for code questions
      if (questionType === 'code') {
        payloadData.programming_language = exerciseRequest.programming_language || '';
      }

      // Build full request structure
      const requestPayload = {
        requester_service: 'content-studio',
        payload: payloadData,
        response: {
          answer: '',
        },
      };

      // Stringify the full request
      let payloadString;
      try {
        payloadString = JSON.stringify(requestPayload);
      } catch (stringifyError) {
        throw new Error(`Failed to stringify payload: ${stringifyError.message}`);
      }

      // Build request body (form-urlencoded)
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending AI exercise generation request to Coordinator', {
        endpoint,
        topicId: payloadData.topic_id,
        topicName: payloadData.topic_name,
        questionType: payloadData.question_type,
        amount: payloadData.amount,
        programmingLanguage: payloadData.programming_language || 'N/A',
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 60000, // 60 seconds timeout for AI generation
      });

      // Validate response structure
      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        throw new Error('Invalid response structure from Coordinator');
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        throw new Error('Missing or invalid payload in response');
      }

      // Parse response structure
      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      // Inside payload: { requester_service: "content-studio", payload: {...}, response: { verified: boolean, answer: "string" } }
      // answer is ALWAYS a plain string (code, explanation, or error message) - NEVER JSON
      let responseStructure;
      try {
        responseStructure = JSON.parse(response.data.payload);
      } catch (parseError) {
        throw new Error(`Failed to parse response payload: ${parseError.message}`);
      }

      // Validate response structure
      if (typeof responseStructure !== 'object' || responseStructure === null) {
        throw new Error('Invalid payload structure in response');
      }

      // Extract response object
      if (!responseStructure.response || typeof responseStructure.response !== 'object') {
        throw new Error('Missing or invalid response field in payload');
      }

      // answer is ALWAYS a plain string (code HTML/CSS/JS or error message) - NEVER JSON
      // Response structure: { response: { answer: "string" } }
      // NO verified field in response! Only answer.
      const answer = typeof responseStructure.response.answer === 'string' 
        ? responseStructure.response.answer 
        : '';

      // Check if answer is an error message or code
      // Error messages typically don't contain HTML/CSS/JS code patterns
      const isError = answer.length === 0 || 
        answer.toLowerCase().includes('error') ||
        answer.toLowerCase().includes('failed') ||
        answer.toLowerCase().includes('invalid') ||
        answer.toLowerCase().includes('not match') ||
        answer.toLowerCase().includes('does not match') ||
        (!answer.includes('<') && !answer.includes('function') && !answer.includes('const') && !answer.includes('let'));

      if (isError) {
        const errorMessage = answer || 'Exercise validation failed';
        logger.warn('[DevlabClient] AI exercises generation failed', {
          topicId: payloadData.topic_id,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      // If answer contains code (not error), return it
      const finalResponse = {
        answer: answer, // The code (HTML/CSS/JS) - will be saved to DB in devlab_exercises
      };

      logger.info('[DevlabClient] Successfully received AI exercises from Coordinator', {
        topicId: payloadData.topic_id,
        questionType: questionType,
        answerLength: answer.length,
        hasAnswer: answer.length > 0,
      });

      return finalResponse;
    } catch (error) {
      logger.error('[DevlabClient] Failed to generate AI exercises', {
        error: error.message,
        endpoint,
        topicId: exerciseRequest?.topic_id,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }

  /**
   * Validate manual exercises from trainer
   * Used when trainer selects Manual mode and submits questions
   * 
   * IMPORTANT RULES:
   * - ONLY code questions can be manual (theoretical questions are AI-only)
   * - Always sends 4 questions together as an array
   * - Coordinator returns if approved and HTML code to display them
   * 
   * @param {Object} exerciseData - Exercise data (can be single exercise or array of 4):
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" (only code allowed for manual),
   *     programming_language: string (required),
   *     Language: string,
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string (optional),
   *       solution: string (optional)
   *     }> (exactly 4 exercises)
   *   }
   * @returns {Promise<Object>} Validation result:
   *   {
   *     verified: boolean,
   *     valid: boolean (backward compatibility),
   *     message: string (if rejected),
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string,
   *       solution: string,
   *       html_code: string (HTML code to display the exercise),
   *       ...other fields
   *     }> (if approved, contains validated exercises),
   *     answer: "string" (code HTML/CSS/JS or error message) - NO devlab_exercises field!
   *   }
   */
  async validateManualExercise(exerciseData) {
    if (!this.baseUrl) {
      logger.warn('[DevlabClient] Coordinator URL not configured, cannot validate exercise', {
        topicId: exerciseData?.topic_id,
      });
      throw new Error('Coordinator URL not configured');
    }

    // Validate that only code questions can be manual
    const questionType = exerciseData.question_type || 'code';
    if (questionType !== 'code') {
      throw new Error('Manual exercises are only allowed for code questions. Theoretical questions must be AI-generated.');
    }

    // Validate programming_language is provided for code questions
    if (!exerciseData.programming_language) {
      throw new Error('Programming language is required for code questions');
    }

    // Validate that exercises array exists and has exactly 4 items
    const exercises = Array.isArray(exerciseData.exercises) ? exerciseData.exercises : [];
    if (exercises.length !== 4) {
      throw new Error('Manual code exercises must include exactly 4 questions');
    }

    const endpoint = `${this.baseUrl}/api/validate-exercise`;

    try {
      // Validate exerciseData
      if (!exerciseData || typeof exerciseData !== 'object') {
        throw new Error('Invalid exercise data');
      }

      // Build payload with required fields
      // Protocol: { requester_service: "content-studio", payload: { action, ... }, response: { answer: "" } }
      // For manual code exercises: always send 4 questions together
      // exercises is an array of strings (question texts)
      const payloadData = {
        action: 'validate-question',
        topic_id: exerciseData.topic_id || '',
        topic_name: exerciseData.topic_name || '',
        question_type: 'code', // Manual is only for code questions
        programming_language: exerciseData.programming_language || '',
        skills: Array.isArray(exerciseData.skills) ? exerciseData.skills : [],
        humanLanguage: exerciseData.Language || exerciseData.language || 'en',
        exercises: exercises.map(ex => {
          // Support both string format and object format for backward compatibility
          if (typeof ex === 'string') {
            return ex;
          }
          return ex.question_text || '';
        }), // Array of 4 question strings
      };

      // Build full request structure
      const requestPayload = {
        requester_service: 'content-studio',
        payload: payloadData,
        response: {
          answer: '',
        },
      };

      // Stringify the full request
      let payloadString;
      try {
        payloadString = JSON.stringify(requestPayload);
      } catch (stringifyError) {
        throw new Error(`Failed to stringify payload: ${stringifyError.message}`);
      }

      // Build request body (form-urlencoded)
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending manual code exercises validation request to Coordinator', {
        endpoint,
        topicId: payloadData.topic_id,
        questionType: payloadData.question_type,
        exercisesCount: exercises.length,
        programmingLanguage: payloadData.programming_language,
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Validate response structure
      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        throw new Error('Invalid response structure from Coordinator');
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        throw new Error('Missing or invalid payload in response');
      }

      // Parse response structure
      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      // Inside payload: { requester_service: "content-studio", payload: {...}, response: { answer: "<stringified JSON>" } }
      // The answer field contains the actual response data
      let responseStructure;
      try {
        responseStructure = JSON.parse(response.data.payload);
      } catch (parseError) {
        throw new Error(`Failed to parse response payload: ${parseError.message}`);
      }

      // Validate response structure
      if (typeof responseStructure !== 'object' || responseStructure === null) {
        throw new Error('Invalid payload structure in response');
      }

      // Extract response object
      if (!responseStructure.response || typeof responseStructure.response !== 'object') {
        throw new Error('Missing or invalid response field in payload');
      }

      // answer can be:
      // 1. A JSON stringified object with { success: true, data: { status: "needs_revision", message: "..." } }
      // 2. A plain HTML/CSS/JS code string (if validation passed)
      const answer = typeof responseStructure.response.answer === 'string' 
        ? responseStructure.response.answer 
        : '';

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

      // If validation failed (needs_revision), throw error with message
      if (isNeedsRevision) {
        logger.warn('[DevlabClient] Manual exercises validation failed - needs revision', {
          topicId: payloadData.topic_id,
          revisionMessage,
        });
        throw new Error(revisionMessage);
      }

      // If answer is empty or doesn't look like code, treat as error
      if (answer.length === 0) {
        const errorMessage = 'Exercise validation failed - empty response';
        logger.warn('[DevlabClient] Manual exercises validation failed - empty answer', {
          topicId: payloadData.topic_id,
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
        logger.warn('[DevlabClient] Manual exercises validation failed - answer does not look like code', {
          topicId: payloadData.topic_id,
          errorMessage: errorMessage.substring(0, 200),
        });
        throw new Error(errorMessage);
      }

      // If answer contains code (validation passed), return it
      // The answer will be saved to DB in devlab_exercises field
      const finalResponse = {
        answer: answer, // The HTML code (HTML/CSS/JS) - will be saved to DB in devlab_exercises
        exercises: exercises, // Keep original exercises array for reference
      };

      logger.info('[DevlabClient] Successfully received validation result from Coordinator', {
        topicId: payloadData.topic_id,
        answerLength: answer.length,
        hasAnswer: answer.length > 0,
        exercisesCount: exercises.length,
      });

      return finalResponse;
    } catch (error) {
      logger.error('[DevlabClient] Failed to validate manual exercise', {
        error: error.message,
        endpoint,
        topicId: exerciseData?.topic_id,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }

  /**
   * Fetch trainer question validation from DevLab
   * @param {string} question - Question text
   * @param {string} courseId - Course ID
   * @param {string} trainerId - Trainer ID
   * @returns {Promise<Object>} Question validation result with filled fields:
   *   - question: string
   *   - course_id: string
   *   - trainer_id: string
   *   - valid: boolean
   *   - message: string (only in fail case)
   *   - ajax: any (only if valid=true, Content Studio does NOT validate this)
   */
  async fetchTrainerQuestionValidation(question, courseId, trainerId) {
    if (!question || typeof question !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid question, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    if (!courseId || typeof courseId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid courseId, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    if (!trainerId || typeof trainerId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid trainerId, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    logger.info('[DevlabClient] Fetching trainer question validation from DevLab', {
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      courseId,
      trainerId,
    });

    // Build payload object with empty fields
    const payload = {
      question: question,
      course_id: courseId,
      trainer_id: trainerId,
      valid: null,
      message: '',
      ajax: null,
    };

    // Send request to DevLab (will return rollback mock data if it fails)
    const filledValidation = await this.sendRequest(payload);

    // Build validated response with all required fields
    // Important: Content Studio does NOT inspect ajax field - return it AS IS if valid=true
    const validatedResult = {
      question: typeof filledValidation.question === 'string' ? filledValidation.question : question,
      course_id: typeof filledValidation.course_id === 'string' ? filledValidation.course_id : courseId,
      trainer_id: typeof filledValidation.trainer_id === 'string' ? filledValidation.trainer_id : trainerId,
      valid: typeof filledValidation.valid === 'boolean' ? filledValidation.valid : false,
      message: typeof filledValidation.message === 'string' ? filledValidation.message : '',
      // Return ajax AS IS - Content Studio does NOT validate this field
      ajax: filledValidation.ajax !== undefined ? filledValidation.ajax : null,
    };

    logger.info('[DevlabClient] Trainer question validation fetched successfully', {
      question: validatedResult.question.substring(0, 100) + (validatedResult.question.length > 100 ? '...' : ''),
      courseId: validatedResult.course_id,
      trainerId: validatedResult.trainer_id,
      valid: validatedResult.valid,
      hasMessage: validatedResult.message.length > 0,
      hasAjax: validatedResult.ajax !== null,
    });

    return validatedResult;
  }
}

// Export singleton instance
let devlabClientInstance = null;

/**
 * Get DevLab client singleton instance
 * @returns {DevlabClient} DevLab client instance
 */
export function getDevlabClient() {
  if (!devlabClientInstance) {
    devlabClientInstance = new DevlabClient();
  }
  return devlabClientInstance;
}

// Export convenience functions
export async function validateTrainerQuestion(question, courseId, trainerId) {
  const client = getDevlabClient();
  return client.fetchTrainerQuestionValidation(question, courseId, trainerId);
}

export async function generateAIExercises(exerciseRequest) {
  const client = getDevlabClient();
  return client.generateAIExercises(exerciseRequest);
}

export async function validateManualExercise(exerciseData) {
  const client = getDevlabClient();
  return client.validateManualExercise(exerciseData);
}

