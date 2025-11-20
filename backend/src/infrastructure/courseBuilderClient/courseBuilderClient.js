import axios from 'axios';
import qs from 'qs';
import { logger } from '../logging/Logger.js';

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
    // Get Course Builder microservice URL from environment variable
    const courseBuilderUrl = process.env.COURSE_BUILDER_URL;
    
    if (!courseBuilderUrl) {
      logger.warn('[CourseBuilderClient] COURSE_BUILDER_URL not configured, Course Builder integration will not work');
      this.baseUrl = null;
    } else {
      // Remove trailing slash if present
      this.baseUrl = courseBuilderUrl.replace(/\/$/, '');
      logger.info('[CourseBuilderClient] Initialized with Course Builder URL', {
        baseUrl: this.baseUrl,
      });
    }
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
   * Send request to Course Builder microservice
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from Course Builder or rollback mock data
   */
  async sendRequest(payload) {
    // If baseUrl is not configured, return rollback immediately
    if (!this.baseUrl) {
      logger.warn('[CourseBuilderClient] Course Builder URL not configured, using rollback mock data', {
        payloadKeys: Object.keys(payload),
      });
      return this.getRollbackMockData(payload);
    }

    const endpoint = `${this.baseUrl}/api/fill-course-fields`;

    try {
      // Validate payload
      if (typeof payload !== 'object' || payload === null) {
        logger.warn('[CourseBuilderClient] Invalid payload, using rollback mock data', {
          payloadType: typeof payload,
        });
        return this.getRollbackMockData(payload || {});
      }

      // Convert payload to JSON string
      let payloadString;
      try {
        payloadString = JSON.stringify(payload);
      } catch (stringifyError) {
        logger.warn('[CourseBuilderClient] Failed to stringify payload, using rollback mock data', {
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

      logger.info('[CourseBuilderClient] Sending request to Course Builder', {
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

      // Validate response structure - Course Builder always returns: { serviceName: "ContentStudio", payload: "<string>" }
      if (!response.data || typeof response.data !== 'object' || response.data === null) {
        logger.warn('[CourseBuilderClient] Course Builder returned invalid response structure, using rollback mock data', {
          endpoint,
          responseType: typeof response.data,
        });
        return this.getRollbackMockData(payload);
      }

      if (!response.data.payload || typeof response.data.payload !== 'string') {
        logger.warn('[CourseBuilderClient] Course Builder response missing or invalid payload field, using rollback mock data', {
          endpoint,
          payloadType: typeof response.data.payload,
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Course Builder always returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(response.data.payload);
      } catch (parseError) {
        logger.warn('[CourseBuilderClient] Failed to parse payload from Course Builder response, using rollback mock data', {
          error: parseError.message,
          payload: response.data.payload.substring(0, 200),
          serviceName: response.data.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[CourseBuilderClient] Course Builder returned invalid payload structure, using rollback mock data', {
          endpoint,
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[CourseBuilderClient] Successfully received response from Course Builder', {
        endpoint,
        payloadKeys: Object.keys(responsePayload),
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[CourseBuilderClient] External request failed, using rollback mock data instead', {
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
    // If baseUrl is not configured, silently skip
    if (!this.baseUrl) {
      logger.warn('[CourseBuilderClient] Course Builder URL not configured, skipping course publish', {
        courseId: courseData?.course_id,
      });
      return;
    }

    const endpoint = `${this.baseUrl}/api/receive-course`;

    try {
      // Validate courseData
      if (!courseData || typeof courseData !== 'object') {
        logger.warn('[CourseBuilderClient] Invalid courseData, skipping course publish', {
          courseDataType: typeof courseData,
        });
        return;
      }

      // Build the course object in the required format
      const courseObject = {
        microservice_name: 'content_studio',
        payload: {
          course_id: courseData.course_id || '',
          course_name: courseData.course_name || '',
          course_description: courseData.course_description || '',
          course_language: courseData.course_language || 'en',
          trainer_id: courseData.trainer_id || '',
          trainer_name: courseData.trainer_name || '',
          topics: Array.isArray(courseData.topics) ? courseData.topics.map(topic => ({
            topic_id: topic.topic_id || '',
            topic_name: topic.topic_name || '',
            topic_description: topic.topic_description || '',
            topic_language: topic.topic_language || 'en',
            template_id: topic.template_id || '',
            format_order: Array.isArray(topic.format_order) ? topic.format_order : [],
            contents: Array.isArray(topic.contents) ? topic.contents.map(content => ({
              content_id: content.content_id || '',
              content_type: content.content_type || '',
              content_data: content.content_data || {},
            })) : [],
            devlab_exercises: topic.devlab_exercises || '',
          })) : [],
        },
      };

      // Stringify the entire course object
      let courseObjectString;
      try {
        courseObjectString = JSON.stringify(courseObject);
      } catch (stringifyError) {
        logger.error('[CourseBuilderClient] Failed to stringify course object', {
          error: stringifyError.message,
          courseId: courseData.course_id,
        });
        return;
      }

      // Build request body using qs.stringify with application/x-www-form-urlencoded format
      const body = qs.stringify({
        serviceName: 'ContentStudio',
        payload: courseObjectString,
      });

      logger.info('[CourseBuilderClient] Sending course to Course Builder', {
        endpoint,
        courseId: courseData.course_id,
        courseName: courseData.course_name,
        topicsCount: courseData.topics?.length || 0,
      });

      // Send POST request - fire and forget (no response expected)
      await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 seconds timeout
        validateStatus: () => true, // Accept any status code - we don't care about response
      });

      logger.info('[CourseBuilderClient] Course sent to Course Builder successfully', {
        courseId: courseData.course_id,
      });
    } catch (error) {
      // Log error and throw to allow PublishCourseUseCase to handle it
      logger.error('[CourseBuilderClient] Failed to send course to Course Builder', {
        error: error.message,
        endpoint,
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

