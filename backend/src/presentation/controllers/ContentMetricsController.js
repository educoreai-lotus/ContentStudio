import { logger } from '../../infrastructure/logging/Logger.js';
import { fillDirectory } from '../../application/services/fillers/fillDirectory.js';
import { fillCourseBuilder } from '../../application/services/fillers/fillCourseBuilder.js';
import { fillCourseBuilderByCompany } from '../../application/services/fillers/fillCourseBuilderByCompany.js';
import { fillDevLab } from '../../application/services/fillers/fillDevLab.js';
import { fillSkillsEngine } from '../../application/services/fillers/fillSkillsEngine.js';
import { fillAnalytics } from '../../application/services/fillers/fillAnalytics.js';
import { fillManagement } from '../../application/services/fillers/fillManagement.js';
import { parseCourseRequest } from '../../application/use-cases/course-builder/parseCourseRequest.js';
import { getPreferredLanguage } from '../../application/use-cases/course-builder/getPreferredLanguage.js';
import { searchSuitableCourse } from '../../application/use-cases/course-builder/searchSuitableCourse.js';
import { fetchArchivedCourseContent } from '../../application/use-cases/course-builder/fetchArchivedCourseContent.js';
import { mapSkillCoverage } from '../../application/use-cases/course-builder/mapSkillCoverage.js';
import { findStandaloneTopic } from '../../application/use-cases/topics/findStandaloneTopic.js';
import { generateAiTopic } from '../../application/use-cases/course-builder/generateAiTopic.js';
import { saveGeneratedTopicToDatabase } from '../../application/use-cases/topics/saveGeneratedTopicToDatabase.js';
import { generateDevLabExercisesForTopic } from '../../application/use-cases/devlab/generateDevLabExercisesForTopic.js';
import { buildFinalContentResponse } from '../../application/use-cases/content-response/buildFinalContentResponse.js';

/**
 * Content Metrics Controller
 * Handles requests from other microservices to fill content metrics
 * Endpoint: POST /api/fill-content-metrics
 */
export class ContentMetricsController {
  /**
   * Fill content metrics based on serviceName
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware
   */
  async fillContentMetrics(req, res, next) {
    try {
      // ALWAYS treat req.body as a STRING and manually parse it
      let requestBody;
      if (typeof req.body === 'string') {
        try {
          requestBody = JSON.parse(req.body);
        } catch (parseError) {
          logger.error('[ContentMetricsController] Failed to parse stringified request body', {
            error: parseError.message,
            bodyPreview: req.body.substring(0, 200),
          });
          return res.status(400).json({
            error: 'Invalid JSON in request body',
          });
        }
      } else {
        // If body is already parsed (shouldn't happen, but handle it)
        requestBody = req.body;
      }

      // Check if this is Course Builder format (has microservice_name instead of serviceName)
      if (requestBody.microservice_name === 'course-builder' || requestBody.microservice_name === 'CourseBuilder' || requestBody.microservice_name === 'Course Builder') {
        // Validate Course Builder format structure
        if (!requestBody.microservice_name || !requestBody.payload || requestBody.response === undefined) {
          logger.error('[ContentMetricsController] Invalid Course Builder format - missing required fields');
          return res.status(400).json({
            error: 'Invalid Course Builder format - microservice_name, payload, and response are required',
          });
        }

        // Ensure response.course exists
        if (!requestBody.response || typeof requestBody.response !== 'object') {
          requestBody.response = { course: [] };
        }
        if (!requestBody.response.hasOwnProperty('course')) {
          requestBody.response.course = [];
        }

        return await this.handleCourseBuilderFormat(requestBody, res, next);
      }

      // Otherwise, handle the old format with serviceName/payload
      const { serviceName, payload } = requestBody;

      // Validate serviceName
      if (!serviceName || typeof serviceName !== 'string') {
        logger.error('[ContentMetricsController] Missing or invalid serviceName', {
          serviceName,
          serviceNameType: typeof serviceName,
        });
        return res.status(400).json({
          error: 'serviceName is required and must be a string',
        });
      }

      // Validate payload presence (allow string or object)
      if (payload === undefined || payload === null) {
        logger.error('[ContentMetricsController] Missing payload', {
          serviceName,
          payloadType: typeof payload,
        });
        return res.status(400).json({
          error: 'payload is required',
        });
      }

      // Parse payload (accept stringified JSON or plain object)
      let parsedPayload;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
        } catch (parseError) {
          logger.error('[ContentMetricsController] Failed to parse payload', {
            serviceName,
            error: parseError.message,
            payloadPreview: payload.substring(0, 200),
          });
          return res.status(400).json({
            serviceName,
            payload: JSON.stringify({ error: 'Invalid JSON payload' }),
          });
        }
      } else if (typeof payload === 'object') {
        parsedPayload = payload;
      } else {
        logger.error('[ContentMetricsController] Invalid payload type', {
          serviceName,
          payloadType: typeof payload,
        });
        return res.status(400).json({
          serviceName,
          payload: JSON.stringify({ error: 'Invalid payload type' }),
        });
      }

      // Validate parsed payload is an object
      if (typeof parsedPayload !== 'object' || parsedPayload === null) {
        logger.error('[ContentMetricsController] Parsed payload is not an object', {
          serviceName,
          payloadType: typeof parsedPayload,
        });
        return res.status(400).json({
          serviceName,
          payload: JSON.stringify({ error: 'Invalid JSON payload' }),
        });
      }

      logger.info('[ContentMetricsController] Processing fill request', {
        serviceName,
        payloadKeys: Object.keys(parsedPayload),
      });

      // Switch by serviceName and call appropriate fill function
      let filledData;
      try {
        switch (serviceName) {
          case 'Directory':
            filledData = await fillDirectory(parsedPayload);
            break;

          case 'CourseBuilder':
            filledData = await fillCourseBuilder(parsedPayload);
            break;

          case 'DevLab':
            filledData = await fillDevLab(parsedPayload);
            break;

          case 'SkillsEngine':
            filledData = await fillSkillsEngine(parsedPayload);
            break;

          case 'Analytics':
            filledData = await fillAnalytics(parsedPayload);
            break;

          case 'Management':
            filledData = await fillManagement(parsedPayload);
            break;

          default:
            logger.error('[ContentMetricsController] Unknown serviceName', {
              serviceName,
            });
            return res.status(400).json({
              serviceName,
              payload: JSON.stringify({ error: 'Unknown serviceName' }),
            });
        }
      } catch (fillError) {
        logger.error('[ContentMetricsController] Fill function error', {
          serviceName,
          error: fillError.message,
          stack: fillError.stack,
        });
        return res.status(200).json({
          serviceName,
          payload: JSON.stringify({ error: 'Internal Fill Error' }),
        });
      }

      // Stringify the filled data
      let stringifiedPayload;
      try {
        stringifiedPayload = JSON.stringify(filledData);
      } catch (stringifyError) {
        logger.error('[ContentMetricsController] Failed to stringify filled data', {
          serviceName,
          error: stringifyError.message,
        });
        return res.status(500).json({
          serviceName,
          payload: JSON.stringify({ error: 'Failed to stringify response' }),
        });
      }

      // Return response with stringified payload
      logger.info('[ContentMetricsController] Successfully filled content metrics', {
        serviceName,
        filledKeys: Object.keys(filledData),
        payloadSize: stringifiedPayload.length,
      });

      return res.status(200).json({
        serviceName,
        payload: stringifiedPayload,
      });
    } catch (error) {
      logger.error('[ContentMetricsController] Unexpected error', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }


  /**
   * Handle Course Builder format: stringified JSON with microservice_name, payload, response
   * Orchestrates the full workflow using existing use-cases
   * @param {Object} requestData - Parsed request data
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware
   */
  async handleCourseBuilderFormat(requestData, res, next) {
    try {
      // Validate structure
      if (!requestData.payload || typeof requestData.payload !== 'object') {
        logger.error('[ContentMetricsController] Invalid Course Builder format - missing or invalid payload');
        return res.status(400).json({
          error: 'Invalid Course Builder format - payload is required',
        });
      }

      // Ensure response field exists (initialize to null if not present)
      if (requestData.response === undefined) {
        requestData.response = null;
      }

      logger.info('[ContentMetricsController] Starting Course Builder workflow orchestration', {
        microservice_name: requestData.microservice_name,
        hasPayload: !!requestData.payload,
      });

      // Step 1: Parse the body
      logger.info('[ContentMetricsController] Step 1: Parsing course request');
      let parsedRequest;
      try {
        parsedRequest = parseCourseRequest(requestData);
      } catch (parseError) {
        logger.error('[ContentMetricsController] Failed to parse course request', {
          error: parseError.message,
        });
        // On error, set empty array and return stringified original
        requestData.response.course = [];
        const stringifiedData = JSON.stringify(requestData);
        return res.status(200).send(stringifiedData);
      }

      // Step 2: Request preferred language
      logger.info('[ContentMetricsController] Step 2: Getting preferred language');
      const preferredLanguage = await getPreferredLanguage(parsedRequest);
      logger.info('[ContentMetricsController] Preferred language retrieved', {
        preferred_language: preferredLanguage.preferred_language,
      });

      // Step 3: Try to find an ORGANIZATION-SPECIFIC course
      logger.info('[ContentMetricsController] Step 3: Searching for suitable course');
      const courseRow = await searchSuitableCourse(parsedRequest, preferredLanguage);
      let courseTopics = [];
      let courseContent = null;

      // Step 4: If found AND status=archived → fetch ALL course topics + content
      if (courseRow && courseRow.status === 'archived') {
        logger.info('[ContentMetricsController] Step 4: Fetching archived course content', {
          course_id: courseRow.course_id,
        });
        courseContent = await fetchArchivedCourseContent(courseRow);
        if (courseContent && Array.isArray(courseContent.topics)) {
          courseTopics = courseContent.topics;
          logger.info('[ContentMetricsController] Fetched course topics', {
            topics_count: courseTopics.length,
          });
        }
      } else {
        logger.info('[ContentMetricsController] No suitable archived course found');
      }

      // Step 5: Run mapSkillCoverage with initially empty standalone topics
      logger.info('[ContentMetricsController] Step 5: Mapping skill coverage');
      let skillCoverage = mapSkillCoverage(parsedRequest.skills, courseTopics, []);
      logger.info('[ContentMetricsController] Initial skill coverage mapped', {
        total_skills: skillCoverage.length,
        found: skillCoverage.filter(s => s.status === 'found').length,
        missing: skillCoverage.filter(s => s.status === 'missing').length,
      });

      // Step 6: For each missing skill, try to find standalone topic
      logger.info('[ContentMetricsController] Step 6: Searching for standalone topics');
      const standaloneTopics = [];
      for (const coverageItem of skillCoverage) {
        if (coverageItem.status === 'missing' && coverageItem.source === 'ai') {
          logger.info('[ContentMetricsController] Searching standalone topic for skill', {
            skill: coverageItem.skill,
          });
          const standaloneTopic = await findStandaloneTopic(
            coverageItem.skill,
            preferredLanguage.preferred_language
          );
          if (standaloneTopic) {
            standaloneTopics.push(standaloneTopic);
            logger.info('[ContentMetricsController] Found standalone topic', {
              skill: coverageItem.skill,
              topic_id: standaloneTopic.topic_id,
            });
          }
        }
      }

      // Re-run mapSkillCoverage with standalone topics
      if (standaloneTopics.length > 0) {
        logger.info('[ContentMetricsController] Re-mapping skill coverage with standalone topics');
        skillCoverage = mapSkillCoverage(parsedRequest.skills, courseTopics, standaloneTopics);
      }

      // Step 7: For skills STILL missing, generate AI topic and save to DB
      logger.info('[ContentMetricsController] Step 7: Generating AI topics for missing skills');
      const aiGeneratedTopics = [];
      for (const coverageItem of skillCoverage) {
        if (coverageItem.status === 'missing' && coverageItem.source === 'ai') {
          logger.info('[ContentMetricsController] Generating AI topic for skill', {
            skill: coverageItem.skill,
          });
          const generatedTopic = await generateAiTopic(coverageItem, preferredLanguage.preferred_language);
          if (generatedTopic) {
            // Ensure skills array is included for saving
            if (!generatedTopic.skills || !Array.isArray(generatedTopic.skills)) {
              generatedTopic.skills = [coverageItem.skill];
            }
            logger.info('[ContentMetricsController] Saving generated AI topic to database', {
              skill: coverageItem.skill,
            });
            const saveResult = await saveGeneratedTopicToDatabase(
              generatedTopic,
              preferredLanguage.preferred_language
            );
            if (saveResult && saveResult.saved) {
              logger.info('[ContentMetricsController] AI topic saved successfully', {
                topic_id: saveResult.topic_id,
                skill: coverageItem.skill,
              });
              // Fetch the saved topic to include in response
              generatedTopic.topic_id = saveResult.topic_id;
              aiGeneratedTopics.push(generatedTopic);
            }
          }
        }
      }

      // Build resolved topics array (course + standalone + AI)
      logger.info('[ContentMetricsController] Building resolved topics array');
      const resolvedTopics = [];
      
      // Add course topics
      for (const topic of courseTopics) {
        resolvedTopics.push(topic);
      }
      
      // Add standalone topics (avoid duplicates)
      for (const topic of standaloneTopics) {
        if (!resolvedTopics.find(t => t.topic_id === topic.topic_id)) {
          resolvedTopics.push(topic);
        }
      }
      
      // Add AI generated topics
      for (const topic of aiGeneratedTopics) {
        resolvedTopics.push(topic);
      }

      logger.info('[ContentMetricsController] Resolved topics built', {
        total_topics: resolvedTopics.length,
        course_topics: courseTopics.length,
        standalone_topics: standaloneTopics.length,
        ai_topics: aiGeneratedTopics.length,
      });

      // Step 8: Generate DevLab exercises for each topic
      logger.info('[ContentMetricsController] Step 8: Generating DevLab exercises');
      for (const topic of resolvedTopics) {
        if (topic.devlab_exercises === null || topic.devlab_exercises === undefined) {
          logger.info('[ContentMetricsController] Generating DevLab exercises for topic', {
            topic_id: topic.topic_id,
          });
          await generateDevLabExercisesForTopic(topic);
        } else {
          logger.info('[ContentMetricsController] Topic already has DevLab exercises', {
            topic_id: topic.topic_id,
          });
        }
      }

      // Step 9: Set resolved topics in original request
      logger.info('[ContentMetricsController] Step 9: Setting resolved topics in response');
      requestData.response.course = resolvedTopics;

      // Stringify the entire original request object
      const stringifiedData = JSON.stringify(requestData);

      logger.info('[ContentMetricsController] Successfully completed Course Builder workflow', {
        topicsCount: resolvedTopics.length,
        responseSize: stringifiedData.length,
      });

      // Return the stringified original object EXACTLY (not wrapped)
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(stringifiedData);
    } catch (error) {
      logger.error('[ContentMetricsController] Unexpected error in Course Builder format handler', {
        error: error.message,
        stack: error.stack,
      });
      // On error, set empty array and return stringified original
      requestData.response.course = [];
      const stringifiedData = JSON.stringify(requestData);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(stringifiedData);
    }
  }
}

