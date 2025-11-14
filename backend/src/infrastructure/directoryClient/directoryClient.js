import axios from 'axios';
import qs from 'qs';
import { logger } from '../logging/Logger.js';

/**
 * Directory Client
 * Handles communication between Content Studio and Directory microservice
 * Uses Stringified JSON Protocol over application/x-www-form-urlencoded
 * 
 * Protocol:
 * - Request: POST with serviceName="ContentStudio" and payload=JSON.stringify(object)
 * - Response: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
 */
export class DirectoryClient {
  constructor() {
    // Get Directory microservice URL from environment variable
    const directoryUrl = process.env.DIRECTORY_URL;
    
    if (!directoryUrl) {
      logger.warn('[DirectoryClient] DIRECTORY_URL not configured, Directory integration will not work');
      this.baseUrl = null;
    } else {
      // Remove trailing slash if present
      this.baseUrl = directoryUrl.replace(/\/$/, '');
      logger.info('[DirectoryClient] Initialized with Directory URL', {
        baseUrl: this.baseUrl,
      });
    }
  }

  /**
   * Get rollback mock data when external request fails
   * @param {Object} payload - Original payload sent to Directory
   * @returns {Object} Mock data matching expected structure
   */
  getRollbackMockData(payload) {
    // Determine if this is a trainer profile request or exercise limits request
    if (payload.hasOwnProperty('trainer_id') && payload.hasOwnProperty('trainer_name')) {
      // Trainer profile rollback
      return {
        trainer_id: payload.trainer_id || 'unknown',
        trainer_name: 'Unknown Trainer',
        company_id: 'N/A',
        ai_enabled: false,
        can_publish_publicly: false,
      };
    } else if (payload.hasOwnProperty('exercises_limited')) {
      // Exercise limits rollback
      return {
        exercises_limited: false,
        num_of_exercises: null,
        ...(payload.trainer_id ? { trainer_id: payload.trainer_id } : {}),
      };
    }
    
    // Generic fallback - return payload with default values
    return {
      ...payload,
      trainer_name: payload.trainer_name || 'Unknown Trainer',
      company_id: payload.company_id || 'N/A',
      ai_enabled: payload.ai_enabled !== undefined ? payload.ai_enabled : false,
      can_publish_publicly: payload.can_publish_publicly !== undefined ? payload.can_publish_publicly : false,
      exercises_limited: payload.exercises_limited !== undefined ? payload.exercises_limited : false,
      num_of_exercises: payload.num_of_exercises !== undefined ? payload.num_of_exercises : null,
    };
  }

  /**
   * Send request to Directory microservice
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from Directory or rollback mock data
   */
  async sendRequest(payload) {
    // If baseUrl is not configured, return rollback immediately
    if (!this.baseUrl) {
      logger.warn('[DirectoryClient] Directory URL not configured, using rollback mock data', {
        payloadKeys: Object.keys(payload),
      });
      return this.getRollbackMockData(payload);
    }

    const endpoint = `${this.baseUrl}/api/fill-directory-fields`;

    try {
      // Validate payload
      if (typeof payload !== 'object' || payload === null) {
        logger.warn('[DirectoryClient] Invalid payload, using rollback mock data', {
          payloadType: typeof payload,
        });
        return this.getRollbackMockData(payload || {});
      }

      // Convert payload to JSON string
      let payloadString;
      try {
        payloadString = JSON.stringify(payload);
      } catch (stringifyError) {
        logger.warn('[DirectoryClient] Failed to stringify payload, using rollback mock data', {
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

      logger.info('[DirectoryClient] Sending request to Directory', {
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

      // Validate response structure - Directory always returns: { serviceName: "ContentStudio", payload: "<string>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        logger.warn('[DirectoryClient] Directory returned invalid response structure, using rollback mock data', {
          endpoint,
          responseType: typeof response.data,
        });
        return this.getRollbackMockData(payload);
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        logger.warn('[DirectoryClient] Directory response missing or invalid payload field, using rollback mock data', {
          endpoint,
          payloadType: typeof response.data.payload,
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Directory always returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        logger.warn('[DirectoryClient] Failed to parse payload from Directory response, using rollback mock data', {
          error: parseError.message,
          payload: response.data.payload.substring(0, 200),
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[DirectoryClient] Directory returned invalid payload structure, using rollback mock data', {
          endpoint,
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[DirectoryClient] Successfully received response from Directory', {
        endpoint,
        payloadKeys: Object.keys(responsePayload),
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[DirectoryClient] External request failed, using rollback mock data instead', {
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
   * Fetch trainer basic profile from Directory
   * @param {string} trainerId - Trainer ID
   * @returns {Promise<Object>} Trainer profile with filled fields:
   *   - trainer_id: string
   *   - trainer_name: string
   *   - company_id: string
   *   - ai_enabled: boolean | null
   *   - can_publish_publicly: boolean | null
   * @throws {Error} If request fails or response is invalid
   */
  async fetchTrainerProfileFromDirectory(trainerId) {
    if (!trainerId || typeof trainerId !== 'string') {
      throw new Error('trainerId must be a non-empty string');
    }

    logger.info('[DirectoryClient] Fetching trainer profile from Directory', {
      trainerId,
    });

    // Build payload object with empty fields
    const payload = {
      trainer_id: trainerId,
      trainer_name: '',
      company_id: '',
      ai_enabled: null,
      can_publish_publicly: null,
    };

    // Send request to Directory (will return rollback mock data if it fails)
    const filledProfile = await this.sendRequest(payload);

    // Build validated response with all required fields
    const validatedProfile = {
      trainer_id: typeof filledProfile.trainer_id === 'string' ? filledProfile.trainer_id : trainerId,
      trainer_name: typeof filledProfile.trainer_name === 'string' ? filledProfile.trainer_name : 'Unknown Trainer',
      company_id: typeof filledProfile.company_id === 'string' ? filledProfile.company_id : 'N/A',
      ai_enabled: typeof filledProfile.ai_enabled === 'boolean' ? filledProfile.ai_enabled : (filledProfile.ai_enabled === null ? null : false),
      can_publish_publicly: typeof filledProfile.can_publish_publicly === 'boolean' ? filledProfile.can_publish_publicly : (filledProfile.can_publish_publicly === null ? null : false),
    };

    logger.info('[DirectoryClient] Trainer profile fetched successfully', {
      trainerId: validatedProfile.trainer_id,
      trainerName: validatedProfile.trainer_name || 'not provided',
      companyId: validatedProfile.company_id || 'not provided',
      aiEnabled: validatedProfile.ai_enabled,
      canPublishPublicly: validatedProfile.can_publish_publicly,
    });

    return validatedProfile;
  }

  /**
   * Fetch exercise limits from Directory
   * @param {string} trainerId - Trainer ID (optional, may be used by Directory for context)
   * @returns {Promise<Object>} Exercise limits with filled fields:
   *   - exercises_limited: boolean
   *   - num_of_exercises: number | null (only if exercises_limited === true)
   * @throws {Error} If request fails or response is invalid
   */
  async fetchExerciseLimitsFromDirectory(trainerId = null) {
    logger.info('[DirectoryClient] Fetching exercise limits from Directory', {
      trainerId: trainerId || 'not provided',
    });

    // Build payload object with null fields
    const payload = {
      exercises_limited: null,
      num_of_exercises: null,
    };

    // Add trainer_id if provided (Directory may use it for context)
    if (trainerId) {
      payload.trainer_id = trainerId;
    }

    // Send request to Directory (will return rollback mock data if it fails)
    const filledLimits = await this.sendRequest(payload);

    // Build validated response
    const validatedLimits = {
      exercises_limited: typeof filledLimits.exercises_limited === 'boolean' ? filledLimits.exercises_limited : false,
      num_of_exercises: null,
    };

    // Apply rules:
    // - If exercises_limited === false → num_of_exercises must be null
    // - If exercises_limited === true → num_of_exercises must be > 0
    if (validatedLimits.exercises_limited === false) {
      // Rule: If exercises_limited is false, num_of_exercises must be null
      validatedLimits.num_of_exercises = null;
    } else {
      // Rule: If exercises_limited is true, num_of_exercises must be > 0
      if (typeof filledLimits.num_of_exercises === 'number' && filledLimits.num_of_exercises > 0) {
        validatedLimits.num_of_exercises = filledLimits.num_of_exercises;
      } else {
        // Invalid: exercises_limited is true but num_of_exercises is missing or invalid
        logger.warn('[DirectoryClient] exercises_limited is true but num_of_exercises is missing or invalid', {
          num_of_exercises: filledLimits.num_of_exercises,
          numOfExercisesType: typeof filledLimits.num_of_exercises,
          trainerId: trainerId || 'not provided',
        });
        validatedLimits.num_of_exercises = null;
      }
    }

    logger.info('[DirectoryClient] Exercise limits fetched successfully', {
      trainerId: trainerId || 'not provided',
      exercises_limited: validatedLimits.exercises_limited,
      num_of_exercises: validatedLimits.num_of_exercises,
    });

    return validatedLimits;
  }
}

// Export singleton instance
let directoryClientInstance = null;

/**
 * Get Directory client singleton instance
 * @returns {DirectoryClient} Directory client instance
 */
export function getDirectoryClient() {
  if (!directoryClientInstance) {
    directoryClientInstance = new DirectoryClient();
  }
  return directoryClientInstance;
}

// Export convenience functions
export async function fetchTrainerProfileFromDirectory(trainerId) {
  const client = getDirectoryClient();
  return client.fetchTrainerProfileFromDirectory(trainerId);
}

export async function fetchExerciseLimitsFromDirectory(trainerId = null) {
  const client = getDirectoryClient();
  return client.fetchExerciseLimitsFromDirectory(trainerId);
}
