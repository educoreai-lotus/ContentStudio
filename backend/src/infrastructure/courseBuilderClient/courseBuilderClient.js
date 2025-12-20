import { logger } from '../logging/Logger.js';
import { postToCoordinator } from '../coordinatorClient/coordinatorClient.js';
import { verifyCoordinatorSignature } from '../utils/verifyCoordinatorSignature.js';

/**
 * Course Builder Client
 * Handles communication between Content Studio and Course Builder microservice
 * Uses Stringified JSON Protocol over application/x-www-form-urlencoded
 * 
 * Protocol:
 * - Request: POST with serviceName="ContentStudio" and payload=JSON.stringify(object)
 * - Response: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
 */
export class CourseBuilderClient {
  constructor() {
    // Course Builder client now uses Coordinator for all requests
    // No direct URL needed - Coordinator handles routing
    logger.info('[CourseBuilderClient] Initialized - using Coordinator for requests');
  }

  /**
   * Get rollback mock data when external request fails
   * @param {Object} payload - Original payload sent to Course Builder
   * @returns {Object} Mock data matching expected structure
   */
  getRollbackMockData(payload) {
    return {
      learner_id: payload.learner_id || 'unknown',
      learner_company: 'Unknown',
      skills: [],
    };
  }

  /**
   * Send request to Course Builder microservice via Coordinator
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from Course Builder or rollback mock data
   */
  async sendRequest(payload) {
    // Validate payload
    if (typeof payload !== 'object' || payload === null) {
      logger.warn('[CourseBuilderClient] Invalid payload, using rollback mock data', {
        payloadType: typeof payload,
      });
      return this.getRollbackMockData(payload || {});
    }

    try {
      // Build envelope for Coordinator (standard structure)
      // IMPORTANT: Use same structure as devlabClient for consistency (response: { answer: '' })
      // The Coordinator signature validation requires response: { answer: '' } for all services
      const envelope = {
        requester_service: 'content-studio',
        payload: payload,
        response: {
          answer: '',
        },
      };

      logger.info('[CourseBuilderClient] Sending request to Course Builder via Coordinator', {
        payloadKeys: Object.keys(payload),
      });

      // Send request via Coordinator
      const coordinatorResponse = await postToCoordinator(envelope, {
        endpoint: '/api/fill-content-metrics',
        timeout: 1200000, // 20 minutes timeout (matches server timeout for long-running requests)
      });

      // Extract response components
      const responseData = coordinatorResponse.data || coordinatorResponse; // Support both new and old format
      const rawBodyString = coordinatorResponse.rawBodyString || JSON.stringify(responseData);
      const responseHeaders = coordinatorResponse.headers || {};

      // Log full response body from Coordinator
      logger.info('[CourseBuilderClient] Full Coordinator response body', {
        rawBodyString: rawBodyString,
        rawBodyLength: rawBodyString?.length || 0,
      });

      // Verify Coordinator signature
      const signature = responseHeaders['x-service-signature'] || responseHeaders['X-Service-Signature'];
      const signer = responseHeaders['x-service-name'] || responseHeaders['X-Service-Name'];
      const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY;

      if (!signature || !signer) {
        throw new Error('Missing coordinator signature');
      }
      if (signer !== 'coordinator') {
        throw new Error('Unexpected signer: ' + signer);
      }

      if (coordinatorPublicKey) {
        // IMPORTANT: Always verify signature on the FULL raw response body
        // Coordinator signs the entire response body, not just parts of it
        // We MUST verify on rawBodyString (the complete JSON string), NOT on responseData.data
        const bodyToVerify = rawBodyString; // Full object: {"success":true,"data":{...},"metadata":{...}}
        
        logger.info('[CourseBuilderClient] Verifying signature with public key', {
          signatureLength: signature?.length || 0,
          signaturePreview: signature?.substring(0, 50) || '',
          publicKeyLength: coordinatorPublicKey?.length || 0,
          rawBodyLength: rawBodyString?.length || 0,
          rawBodyPreview: rawBodyString?.substring(0, 200) || '',
          bodyToVerifyLength: bodyToVerify?.length || 0,
          verifyingFullObject: true,
        });
        
        const isValid = verifyCoordinatorSignature(coordinatorPublicKey, signature, bodyToVerify);
        
        logger.info('[CourseBuilderClient] Signature verification result', {
          isValid,
          signatureLength: signature?.length || 0,
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        if (!isValid) {
          logger.error('[CourseBuilderClient] Invalid coordinator signature', {
            signatureLength: signature?.length || 0,
            signaturePreview: signature?.substring(0, 100) || '',
            rawBodyLength: rawBodyString?.length || 0,
            rawBodyPreview: rawBodyString?.substring(0, 500) || '',
            publicKeyLength: coordinatorPublicKey?.length || 0,
          });
          throw new Error('Invalid coordinator signature');
        }
      }

      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!responseData || typeof responseData !== 'object' || responseData === null) {
        logger.warn('[CourseBuilderClient] Coordinator returned invalid response structure, using rollback mock data', {
          responseType: typeof responseData,
        });
        return this.getRollbackMockData(payload);
      }

      if (!responseData.payload || typeof responseData.payload !== 'string') {
        logger.warn('[CourseBuilderClient] Coordinator response missing or invalid payload field, using rollback mock data', {
          payloadType: typeof responseData.payload,
          serviceName: responseData.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Coordinator always returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(responseData.payload);
      } catch (parseError) {
        logger.warn('[CourseBuilderClient] Failed to parse payload from Coordinator response, using rollback mock data', {
          error: parseError.message,
          payload: responseData.payload.substring(0, 200),
          serviceName: responseData.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[CourseBuilderClient] Coordinator returned invalid payload structure, using rollback mock data', {
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[CourseBuilderClient] Successfully received response from Course Builder via Coordinator', {
        payloadKeys: Object.keys(responsePayload),
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[CourseBuilderClient] Coordinator request failed, using rollback mock data instead', {
        error: error.message,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      return this.getRollbackMockData(payload);
    }
  }

  /**
   * Send course data to Course Builder when trainer publishes a course
   * Triggered when:
   * - Trainer finishes creating a course
   * - Trainer selects a template
   * - Trainer generates questions
   * - Trainer clicks Publish
   * 
   * @param {Object} courseData - Full course object with structure:
   *   {
   *     course_id: string,
   *     course_name: string,
   *     course_description: string,
   *     course_language: string,
   *     trainer_id: string,
   *     trainer_name: string,
   *     topics: Array<{
   *       topic_id: string,
   *       topic_name: string,
   *       topic_description: string,
   *       topic_language: string,
   *       template_id: string,
   *       format_order: string[],
   *       contents: Array<{
   *         content_id: string,
   *         content_type: string,
   *         content_data: Object
   *       }>,
   *       devlab_exercises: string
   *     }>
   *   }
   * @returns {Promise<void>} No return value expected - fire and forget
   */
  async sendCourseToCourseBuilder(courseData) {
    try {
      // Validate courseData
      if (!courseData || typeof courseData !== 'object') {
        logger.warn('[CourseBuilderClient] Invalid courseData, skipping course publish', {
          courseDataType: typeof courseData,
        });
        return;
      }

      // Build payload in the required format (flat structure, no nesting)
      // IMPORTANT: Match devlabClient structure exactly - include targetService and description for Coordinator routing
      const payloadData = {
        action: 'send this trainer course to publish',
        description: 'Send course to Course Builder for publishing',
        targetService: 'course-builder-service',
        course_id: courseData.course_id || '',
        course_name: courseData.course_name || '',
        course_description: courseData.course_description || '',
        course_language: courseData.course_language || 'en',
        trainer_id: courseData.trainer_id || '',
        trainer_name: courseData.trainer_name || '',
        topics: Array.isArray(courseData.topics) ? courseData.topics.map(topic => {
          // Ensure all fields are present and properly typed to avoid JSON.stringify inconsistencies
          const topicObj = {
            topic_id: topic.topic_id || '',
            topic_name: topic.topic_name || '',
            topic_description: topic.topic_description || '',
            topic_language: topic.topic_language || 'en',
            template_id: topic.template_id || '',
            format_order: Array.isArray(topic.format_order) ? topic.format_order : [],
            contents: Array.isArray(topic.contents) ? topic.contents.map(content => ({
              content_id: content.content_id || '',
              content_type: content.content_type || '',
              content_data: content.content_data && typeof content.content_data === 'object' ? content.content_data : {},
            })) : [],
            // Convert devlab_exercises to string if it's an object/array
            // Empty string if not present (to avoid null/undefined issues)
            devlab_exercises: topic.devlab_exercises 
              ? (typeof topic.devlab_exercises === 'string' 
                  ? topic.devlab_exercises 
                  : JSON.stringify(topic.devlab_exercises))
              : '',
          };
          return topicObj;
        }) : [],
      };

      // Build envelope for Coordinator (standard structure)
      // Note: requester_service is 'content-studio' (who is sending)
      // Coordinator will route to Course Builder based on the action in payload
      // IMPORTANT: According to POSTMAN_COURSE_BUILDER_REQUEST.md line 203, Course Builder expects response: {}
      // This is different from DevLab which uses response: { answer: '' }
      // Field order: requester_service, payload, response (must match documentation)
      const envelope = {
        requester_service: 'content-studio',
        payload: payloadData,
        response: {},
      };

      
      await postToCoordinator(envelope, {
        endpoint: '/api/fill-content-metrics',
        timeout: 1200000, // 20 minutes timeout (matches server timeout for long-running requests)
      });

      logger.info('[CourseBuilderClient] Course sent to Course Builder successfully', {
        courseId: courseData.course_id,
      });
    } catch (error) {
      // Log error and throw to allow PublishCourseUseCase to handle it
      logger.error('[CourseBuilderClient] Failed to send course to Course Builder', {
        error: error.message,
        courseId: courseData?.course_id,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      // Throw error so PublishCourseUseCase can catch and return appropriate error message
      throw new Error('Transfer failed — Course Builder could not receive the data. Please try again later.');
    }
  }

  /**
   * Fetch learner info from Course Builder
   * @param {string} learnerId - Learner ID
   * @returns {Promise<Object>} Learner info with filled fields:
   *   - learner_id: string
   *   - learner_company: string
   *   - skills: string[]
   */
  async fetchLearnerInfoFromCourseBuilder(learnerId) {
    if (!learnerId || typeof learnerId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[CourseBuilderClient] Invalid learnerId, using rollback mock data', {
        learnerId,
      });
      return this.getRollbackMockData({ learner_id: learnerId || 'unknown' });
    }

    logger.info('[CourseBuilderClient] Fetching learner info from Course Builder', {
      learnerId,
    });

    // Build payload object with empty fields
    const payload = {
      learner_id: learnerId,
      learner_company: '',
      skills: [],
    };

    // Send request to Course Builder (will return rollback mock data if it fails)
    const filledInfo = await this.sendRequest(payload);

    // Build validated response with all required fields
    const validatedInfo = {
      learner_id: typeof filledInfo.learner_id === 'string' ? filledInfo.learner_id : learnerId,
      learner_company: typeof filledInfo.learner_company === 'string' ? filledInfo.learner_company : 'Unknown',
      skills: Array.isArray(filledInfo.skills) ? filledInfo.skills.filter(skill => typeof skill === 'string') : [],
    };

    logger.info('[CourseBuilderClient] Learner info fetched successfully', {
      learnerId: validatedInfo.learner_id,
      learnerCompany: validatedInfo.learner_company || 'not provided',
      skillsCount: validatedInfo.skills.length,
      skills: validatedInfo.skills,
    });

    return validatedInfo;
  }
}

// Export singleton instance
let courseBuilderClientInstance = null;

/**
 * Get Course Builder client singleton instance
 * @returns {CourseBuilderClient} Course Builder client instance
 */
export function getCourseBuilderClient() {
  if (!courseBuilderClientInstance) {
    courseBuilderClientInstance = new CourseBuilderClient();
  }
  return courseBuilderClientInstance;
}

// Export convenience functions
export async function fetchLearnerInfoFromCourseBuilder(learnerId) {
  const client = getCourseBuilderClient();
  return client.fetchLearnerInfoFromCourseBuilder(learnerId);
}

export async function sendCourseToCourseBuilder(courseData) {
  const client = getCourseBuilderClient();
  return client.sendCourseToCourseBuilder(courseData);
}

