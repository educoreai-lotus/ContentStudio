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
    // Get DevLab microservice URL from environment variable
    const devlabUrl = process.env.DEVLAB_URL;
    
    if (!devlabUrl) {
      logger.warn('[DevlabClient] DEVLAB_URL not configured, DevLab integration will not work');
      this.baseUrl = null;
    } else {
      // Remove trailing slash if present
      this.baseUrl = devlabUrl.replace(/\/$/, '');
      logger.info('[DevlabClient] Initialized with DevLab URL', {
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
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending request to DevLab', {
        endpoint,
        payloadKeys: Object.keys(payload),
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Validate response structure - DevLab always returns: { serviceName: "ContentStudio", payload: "<string>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        logger.warn('[DevlabClient] DevLab returned invalid response structure, using rollback mock data', {
          endpoint,
          responseType: typeof response.data,
        });
        return this.getRollbackMockData(payload);
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        logger.warn('[DevlabClient] DevLab response missing or invalid payload field, using rollback mock data', {
          endpoint,
          payloadType: typeof response.data.payload,
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - DevLab always returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        logger.warn('[DevlabClient] Failed to parse payload from DevLab response, using rollback mock data', {
          error: parseError.message,
          payload: response.data.payload.substring(0, 200),
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[DevlabClient] DevLab returned invalid payload structure, using rollback mock data', {
          endpoint,
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[DevlabClient] Successfully received response from DevLab', {
        endpoint,
        payloadKeys: Object.keys(responsePayload),
        valid: responsePayload.valid,
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
   * Generate AI exercises from Dabla/DevLab
   * Used when trainer selects AI mode for exercise generation
   * @param {Object} exerciseRequest - Exercise generation request:
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" | "theoretical",
   *     programming_language: string,
   *     Language: string,
   *     amount: number (default 4)
   *   }
   * @returns {Promise<Object>} Response with exercises array:
   *   {
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string,
   *       solution: string,
   *       test_cases: any,
   *       difficulty: string,
   *       ...other fields
   *     }>
   *   }
   */
  async generateAIExercises(exerciseRequest) {
    if (!this.baseUrl) {
      logger.warn('[DevlabClient] DevLab URL not configured, cannot generate AI exercises', {
        topicId: exerciseRequest?.topic_id,
      });
      throw new Error('DevLab URL not configured');
    }

    const endpoint = `${this.baseUrl}/api/generate-exercises`;

    try {
      // Validate exerciseRequest
      if (!exerciseRequest || typeof exerciseRequest !== 'object') {
        throw new Error('Invalid exercise request');
      }

      // Build payload with required fields
      const payload = {
        topic_id: exerciseRequest.topic_id || '',
        topic_name: exerciseRequest.topic_name || '',
        skills: Array.isArray(exerciseRequest.skills) ? exerciseRequest.skills : [],
        question_type: exerciseRequest.question_type || 'code',
        programming_language: exerciseRequest.programming_language || '',
        Language: exerciseRequest.Language || exerciseRequest.language || 'en',
        amount: exerciseRequest.amount || 4,
      };

      // Stringify payload
      let payloadString;
      try {
        payloadString = JSON.stringify(payload);
      } catch (stringifyError) {
        throw new Error(`Failed to stringify payload: ${stringifyError.message}`);
      }

      // Build request body
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending AI exercise generation request to Dabla', {
        endpoint,
        topicId: payload.topic_id,
        topicName: payload.topic_name,
        questionType: payload.question_type,
        amount: payload.amount,
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 60000, // 60 seconds timeout for AI generation
      });

      // Validate response structure
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        throw new Error('Invalid response structure from Dabla');
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        throw new Error('Missing or invalid payload in response');
      }

      // Parse payload string
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        throw new Error(`Failed to parse response payload: ${parseError.message}`);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        throw new Error('Invalid payload structure in response');
      }

      logger.info('[DevlabClient] Successfully received AI exercises from Dabla', {
        topicId: payload.topic_id,
        exercisesCount: Array.isArray(responsePayload.exercises) ? responsePayload.exercises.length : 0,
      });

      return responsePayload;
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
   * Validate a single manual exercise from trainer
   * Used when trainer selects Manual mode and submits a question
   * @param {Object} exerciseData - Exercise data:
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" | "theoretical",
   *     programming_language: string,
   *     Language: string,
   *     question_text: string,
   *     hint: string (optional),
   *     solution: string (optional)
   *   }
   * @returns {Promise<Object>} Validation result:
   *   {
   *     valid: boolean,
   *     message: string (if rejected),
   *     exercise: Object (if approved, contains validated exercise data)
   *   }
   */
  async validateManualExercise(exerciseData) {
    if (!this.baseUrl) {
      logger.warn('[DevlabClient] DevLab URL not configured, cannot validate exercise', {
        topicId: exerciseData?.topic_id,
      });
      throw new Error('DevLab URL not configured');
    }

    const endpoint = `${this.baseUrl}/api/validate-exercise`;

    try {
      // Validate exerciseData
      if (!exerciseData || typeof exerciseData !== 'object') {
        throw new Error('Invalid exercise data');
      }

      // Build payload with required fields
      const payload = {
        topic_id: exerciseData.topic_id || '',
        topic_name: exerciseData.topic_name || '',
        skills: Array.isArray(exerciseData.skills) ? exerciseData.skills : [],
        question_type: exerciseData.question_type || 'code',
        programming_language: exerciseData.programming_language || '',
        Language: exerciseData.Language || exerciseData.language || 'en',
        question_text: exerciseData.question_text || '',
        hint: exerciseData.hint || null,
        solution: exerciseData.solution || null,
      };

      // Stringify payload
      let payloadString;
      try {
        payloadString = JSON.stringify(payload);
      } catch (stringifyError) {
        throw new Error(`Failed to stringify payload: ${stringifyError.message}`);
      }

      // Build request body
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: payloadString,
      });

      logger.info('[DevlabClient] Sending manual exercise validation request to Dabla', {
        endpoint,
        topicId: payload.topic_id,
        questionType: payload.question_type,
      });

      // Send POST request
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Validate response structure
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        throw new Error('Invalid response structure from Dabla');
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        throw new Error('Missing or invalid payload in response');
      }

      // Parse payload string
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        throw new Error(`Failed to parse response payload: ${parseError.message}`);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        throw new Error('Invalid payload structure in response');
      }

      logger.info('[DevlabClient] Successfully received validation result from Dabla', {
        topicId: payload.topic_id,
        valid: responsePayload.valid,
      });

      return responsePayload;
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

