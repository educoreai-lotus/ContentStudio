import { logger } from '../logging/Logger.js';
import { postToCoordinator } from '../coordinatorClient/coordinatorClient.js';

/**
 * Skills Engine Client
 * Handles communication between Content Studio and Skills Engine microservice
 * Uses Stringified JSON Protocol over application/x-www-form-urlencoded
 * 
 * Protocol:
 * - Request: POST with serviceName="ContentStudio" and payload=JSON.stringify(object)
 * - Response: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
 */
export class SkillsEngineClient {
  constructor() {
    // Skills Engine client now uses Coordinator for all requests
    // No direct URL needed - Coordinator handles routing
    logger.info('[SkillsEngineClient] Initialized - using Coordinator for requests');
  }

  /**
   * Get rollback mock data when external request fails
   * @param {Object} payload - Original payload sent to Skills Engine
   * @returns {Object} Mock data matching expected structure
   */
  getRollbackMockData(payload) {
    return {
      trainer_id: payload.trainer_id || 'unknown',
      trainer_name: 'Unknown Trainer',
      topic: payload.topic || '',
      skills: [],
    };
  }

  /**
   * Send request to Skills Engine microservice via Coordinator
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from Skills Engine or rollback mock data
   */
  async sendRequest(payload) {
    // Validate payload
    if (typeof payload !== 'object' || payload === null) {
      logger.warn('[SkillsEngineClient] Invalid payload, using rollback mock data', {
        payloadType: typeof payload,
      });
      return this.getRollbackMockData(payload || {});
    }

    try {
      // Build envelope for Coordinator (standard structure)
      const envelope = {
        requester_service: 'content-studio',
        payload: payload,
        response: {},
      };

      logger.info('[SkillsEngineClient] Sending request to Skills Engine via Coordinator', {
        payloadKeys: Object.keys(payload),
      });

      // Send request via Coordinator
      const coordinatorResponse = await postToCoordinator(envelope, {
        endpoint: '/api/fill-content-metrics',
        timeout: 30000,
      });

      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!coordinatorResponse || typeof coordinatorResponse !== 'object' || coordinatorResponse === null) {
        logger.warn('[SkillsEngineClient] Coordinator returned invalid response structure, using rollback mock data', {
          responseType: typeof coordinatorResponse,
        });
        return this.getRollbackMockData(payload);
      }

      if (!coordinatorResponse.payload || typeof coordinatorResponse.payload !== 'string') {
        logger.warn('[SkillsEngineClient] Coordinator response missing or invalid payload field, using rollback mock data', {
          payloadType: typeof coordinatorResponse.payload,
          serviceName: coordinatorResponse.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Coordinator always returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(coordinatorResponse.payload);
      } catch (parseError) {
        logger.warn('[SkillsEngineClient] Failed to parse payload from Coordinator response, using rollback mock data', {
          error: parseError.message,
          payload: coordinatorResponse.payload.substring(0, 200),
          serviceName: coordinatorResponse.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[SkillsEngineClient] Coordinator returned invalid payload structure, using rollback mock data', {
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[SkillsEngineClient] Successfully received response from Skills Engine via Coordinator', {
        payloadKeys: Object.keys(responsePayload),
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[SkillsEngineClient] Coordinator request failed, using rollback mock data instead', {
        error: error.message,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      return this.getRollbackMockData(payload);
    }
  }

  /**
   * Fetch trainer skills from Skills Engine
   * @param {string} trainerId - Trainer ID
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Trainer skills with filled fields:
   *   - trainer_id: string
   *   - trainer_name: string
   *   - topic: string
   *   - skills: string[]
   */
  async fetchTrainerSkillsFromSkillsEngine(trainerId, topic) {
    if (!trainerId || typeof trainerId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[SkillsEngineClient] Invalid trainerId, using rollback mock data', {
        trainerId,
        topic,
      });
      return this.getRollbackMockData({
        trainer_id: trainerId || 'unknown',
        topic: topic || '',
      });
    }

    if (!topic || typeof topic !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[SkillsEngineClient] Invalid topic, using rollback mock data', {
        trainerId,
        topic,
      });
      return this.getRollbackMockData({
        trainer_id: trainerId,
        topic: topic || '',
      });
    }

    logger.info('[SkillsEngineClient] Fetching trainer skills from Skills Engine', {
      trainerId,
      topic,
    });

    // Build payload object with empty fields
    const payload = {
      trainer_id: trainerId,
      trainer_name: '',
      action: 'fetch this topic array of skills',
      topic: topic,
      skills: [],
    };

    // Send request to Skills Engine (will return rollback mock data if it fails)
    const filledSkills = await this.sendRequest(payload);

    // Build validated response with all required fields
    const validatedSkills = {
      trainer_id: typeof filledSkills.trainer_id === 'string' ? filledSkills.trainer_id : trainerId,
      trainer_name: typeof filledSkills.trainer_name === 'string' ? filledSkills.trainer_name : 'Unknown Trainer',
      topic: typeof filledSkills.topic === 'string' ? filledSkills.topic : topic,
      skills: Array.isArray(filledSkills.skills) ? filledSkills.skills.filter(skill => typeof skill === 'string') : [],
    };

    logger.info('[SkillsEngineClient] Trainer skills fetched successfully', {
      trainerId: validatedSkills.trainer_id,
      trainerName: validatedSkills.trainer_name || 'not provided',
      topic: validatedSkills.topic,
      skillsCount: validatedSkills.skills.length,
      skills: validatedSkills.skills,
    });

    return validatedSkills;
  }

  /**
   * Get skills mapping for a topic (alias for getSkillsMapping)
   * @param {string} trainerId - Trainer ID
   * @param {string} topicName - Topic name
   * @returns {Promise<Object>} Skills mapping with skills array:
   *   - topic_id: string | null
   *   - topic_name: string
   *   - skills: string[]
   *   - fallback: boolean (true if mock data)
   */
  async getSkillsMapping(trainerId, topicName) {
    // Use fetchTrainerSkillsFromSkillsEngine and convert to expected format
    const result = await this.fetchTrainerSkillsFromSkillsEngine(trainerId, topicName);
    
    return {
      topic_id: null,
      topic_name: result.topic,
      skills: result.skills,
      trainer_id: result.trainer_id,
      trainer_name: result.trainer_name,
      fallback: result.skills.length === 0 || !this.baseUrl, // Mark as fallback if no skills or URL not configured
    };
  }

  /**
   * Generate realistic mock skills based on topic name (for backward compatibility)
   * @param {string} topicName - Topic name
   * @returns {Object|Array} Mock skills - can be array or object with micro/nano (for backward compatibility)
   */
  generateMockSkills(topicName) {
    const lowerTopic = topicName.toLowerCase();
    
    // Programming-related topics
    if (lowerTopic.includes('javascript') || lowerTopic.includes('js')) {
      return {
        micro: ['JavaScript Fundamentals', 'ES6+ Features', 'Async Programming'],
        nano: ['Variables & Data Types', 'Arrow Functions', 'Promises', 'Async/Await']
      };
    }
    if (lowerTopic.includes('python')) {
      return {
        micro: ['Python Basics', 'Object-Oriented Programming', 'Data Structures'],
        nano: ['Variables', 'Functions', 'Classes', 'Lists & Dictionaries']
      };
    }
    if (lowerTopic.includes('react')) {
      return {
        micro: ['React Components', 'State Management', 'Hooks'],
        nano: ['JSX', 'Props', 'useState', 'useEffect', 'Context API']
      };
    }
    
    // Data-related topics
    if (lowerTopic.includes('data') || lowerTopic.includes('database')) {
      return {
        micro: ['Data Modeling', 'Query Optimization', 'Database Design'],
        nano: ['SQL Queries', 'Indexing', 'Normalization', 'Transactions']
      };
    }
    
    // Design-related topics
    if (lowerTopic.includes('design') || lowerTopic.includes('ui') || lowerTopic.includes('ux')) {
      return {
        micro: ['User Interface Design', 'User Experience', 'Visual Design'],
        nano: ['Color Theory', 'Typography', 'Layout', 'Accessibility']
      };
    }
    
    // Default generic skills
    return {
      micro: ['Problem Solving', 'Critical Thinking', 'Communication'],
      nano: ['Analysis', 'Research', 'Documentation', 'Collaboration']
    };
  }
}

// Export singleton instance
let skillsEngineClientInstance = null;

/**
 * Get Skills Engine client singleton instance
 * @returns {SkillsEngineClient} Skills Engine client instance
 */
export function getSkillsEngineClient() {
  if (!skillsEngineClientInstance) {
    skillsEngineClientInstance = new SkillsEngineClient();
  }
  return skillsEngineClientInstance;
}

// Export convenience function
export async function fetchTrainerSkillsFromSkillsEngine(trainerId, topic) {
  const client = getSkillsEngineClient();
  return client.fetchTrainerSkillsFromSkillsEngine(trainerId, topic);
}

