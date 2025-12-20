import { logger } from '../../infrastructure/logging/Logger.js';
import { fillDirectory } from '../../application/services/fillers/fillDirectory.js';
import { fillCourseBuilder } from '../../application/services/fillers/fillCourseBuilder.js';
import { fillCourseBuilderByCompany } from '../../application/services/fillers/fillCourseBuilderByCompany.js';
import { fillCourseBuilderService } from '../../application/services/fillers/fillCourseBuilderService.js';
import { fillDevLab } from '../../application/services/fillers/fillDevLab.js';
import { fillSkillsEngine } from '../../application/services/fillers/fillSkillsEngine.js';
import { fillManagement } from '../../application/services/fillers/fillManagement.js';
import { fillAnalyticsUsingSharedPrompt } from '../../application/services/fillers/fillAnalyticsShared.js';
import { parseCourseRequest } from '../../application/use-cases/course-builder/parseCourseRequest.js';
import { searchSuitableCourse } from '../../application/use-cases/course-builder/searchSuitableCourse.js';
import { fetchArchivedCourseContent } from '../../application/use-cases/course-builder/fetchArchivedCourseContent.js';
import { mapSkillCoverage } from '../../application/use-cases/course-builder/mapSkillCoverage.js';
import { searchTrainerTopics } from '../../application/use-cases/course-builder/searchTrainerTopics.js';
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
  constructor(topicRepository = null) {
    this.topicRepository = topicRepository;
  }

  /**
   * Fill content metrics based on serviceName
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware
   */
  async fillContentMetrics(req, res, next) {
    try {
      // Send keep-alive headers to prevent connection timeout (especially for long-running AI generation)
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=600, max=1000');
      
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

      // ENFORCE STANDARD STRUCTURE: { requester_service, payload, response }
      // Validate requester_service (MUST exist at top level, MUST be a string)
      if (!requestBody.requester_service || typeof requestBody.requester_service !== 'string') {
        logger.error('[ContentMetricsController] Missing or invalid requester_service', {
          requester_service: requestBody.requester_service,
          requester_serviceType: typeof requestBody.requester_service,
        });
        return res.status(400).json({
          error: 'requester_service is required and must be a string at the top level',
        });
      }

      // Validate payload (MUST exist at top level, MUST be an object)
      if (!requestBody.payload || typeof requestBody.payload !== 'object' || requestBody.payload === null) {
        logger.error('[ContentMetricsController] Missing or invalid payload', {
          requester_service: requestBody.requester_service,
          payloadType: typeof requestBody.payload,
        });
        return res.status(400).json({
          error: 'payload is required and must be an object at the top level',
        });
      }

      // Validate response (MUST exist at top level, MUST be an object - can be empty)
      if (!requestBody.response || typeof requestBody.response !== 'object' || requestBody.response === null) {
        // Initialize response as empty object if missing or invalid
        requestBody.response = {};
      }

      // Store requester_service to avoid modifying the original request
      const requesterService = requestBody.requester_service;

      logger.info('[ContentMetricsController] Valid request structure', {
        requester_service: requesterService,
        payloadKeys: Object.keys(requestBody.payload),
        responseKeys: Object.keys(requestBody.response),
      });

      // Check if this is Course Builder format
      if (requesterService === 'course-builder' || requesterService === 'course_builder' || requesterService === 'CourseBuilder' || requesterService === 'Course Builder') {
        // Ensure response.course exists
        if (!requestBody.response.hasOwnProperty('course')) {
          requestBody.response.course = [];
        }

        return await this.handleCourseBuilderFormat(requestBody, res, next, req);
      }

      // Handle other services using requester_service
      // Note: We do NOT modify requester_service or payload - only fill response
      const parsedPayload = requestBody.payload;

      logger.info('[ContentMetricsController] Processing fill request', {
        requester_service: requesterService,
        payloadKeys: Object.keys(parsedPayload),
      });

      // Switch by requester_service and call appropriate fill function
      let filledData;
      try {
        switch (requesterService.toLowerCase()) {
          case 'directory':
            filledData = await fillDirectory(parsedPayload);
            break;

          case 'course-builder-service':
            // New handler for course-builder-service with learning paths
            return await fillCourseBuilderService(requestBody).then(filledRequest => {
              // Check if response was already sent or connection closed
              if (res.headersSent || res.writableEnded || !res.writable) {
                logger.warn('[ContentMetricsController] Response already sent or connection closed, skipping send', {
                  headersSent: res.headersSent,
                  writableEnded: res.writableEnded,
                  writable: res.writable,
                });
                return;
              }

              // Log FULL response body before sending to course builder via Coordinator
              const stringifiedResponse = JSON.stringify(filledRequest);
              const responseSize = stringifiedResponse.length;
              
              logger.info('[ContentMetricsController] ===== FULL RESPONSE BODY TO COURSE BUILDER (before sending to Coordinator) =====', {
                responseSize,
                responseSizeKB: Math.round(responseSize / 1024),
                responseSizeMB: (responseSize / (1024 * 1024)).toFixed(2),
                coursesCount: filledRequest.response?.courses?.length || 0,
                courseCount: filledRequest.response?.course?.length || 0,
                hasCourses: !!filledRequest.response?.courses,
                hasCourse: !!filledRequest.response?.course,
                requester_service: filledRequest.requester_service,
                payloadKeys: filledRequest.payload ? Object.keys(filledRequest.payload) : [],
                responseKeys: filledRequest.response ? Object.keys(filledRequest.response) : [],
              });
              
              // Log the FULL response body (entire JSON string)
              logger.info('[ContentMetricsController] FULL RESPONSE BODY JSON:', {
                fullResponseBody: stringifiedResponse,
              });
              
              // Also log a formatted preview (first 2000 characters)
              logger.info('[ContentMetricsController] Response preview (first 2000 chars):', {
                responsePreview: stringifiedResponse.substring(0, 2000),
              });
              
              // Ensure headers are set before sending
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Content-Length', Buffer.byteLength(stringifiedResponse, 'utf8'));
              
              logger.info('[ContentMetricsController] Response headers set, sending response', {
                contentType: res.getHeader('Content-Type'),
                contentLength: res.getHeader('Content-Length'),
                responseSize,
              });
              
              try {
                return res.status(200).send(stringifiedResponse);
              } catch (sendError) {
                logger.warn('[ContentMetricsController] Failed to send response (connection may have closed)', {
                  error: sendError.message,
                  headersSent: res.headersSent,
                  writableEnded: res.writableEnded,
                });
              }
            }).catch(error => {
              logger.error('[ContentMetricsController] Error in fillCourseBuilderService', {
                error: error.message,
                stack: error.stack,
              });
              
              // Check if response was already sent or connection closed
              if (res.headersSent || res.writableEnded || !res.writable) {
                logger.warn('[ContentMetricsController] Response already sent or connection closed, skipping error response', {
                  headersSent: res.headersSent,
                  writableEnded: res.writableEnded,
                  writable: res.writable,
                });
                return;
              }

              requestBody.response.courses = [];
              requestBody.response.course = [];
              
              // Log error response body before sending
              logger.info('[ContentMetricsController] Sending error response to course-builder-service', {
                responseBody: JSON.stringify(requestBody, null, 2),
                error: error.message,
              });
              
              const stringifiedResponse = JSON.stringify(requestBody);
              res.setHeader('Content-Type', 'application/json');
              
              try {
                return res.status(200).send(stringifiedResponse);
              } catch (sendError) {
                logger.warn('[ContentMetricsController] Failed to send error response (connection may have closed)', {
                  error: sendError.message,
                  headersSent: res.headersSent,
                  writableEnded: res.writableEnded,
                });
              }
            });

          case 'course_builder':
            filledData = await fillCourseBuilder(parsedPayload);
            break;

          case 'devlab':
          case 'dev_lab':
            filledData = await fillDevLab(parsedPayload);
            break;

          case 'skillsengine':
          case 'skills_engine':
            filledData = await fillSkillsEngine(parsedPayload);
            break;

          case 'analytics':
          case 'learninganalytics':
          case 'learning_analytics':
          case 'LearningAnalytics':
            filledData = await fillAnalyticsUsingSharedPrompt(parsedPayload);
            break;

          case 'management':
            filledData = await fillManagement(parsedPayload);
            break;

          case 'managementreporting':
            // ManagementReporting uses the same structure as LearningAnalytics/Management
            filledData = await fillManagement(parsedPayload);
            break;

          default:
            logger.error('[ContentMetricsController] Unknown requester_service', {
              requester_service: requesterService,
            });
            // Set error in response but keep original structure
            requestBody.response = {
              error: `Unknown requester_service: ${requesterService}`,
            };
            const errorStringified = JSON.stringify(requestBody);
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(errorStringified);
        }
      } catch (fillError) {
        logger.error('[ContentMetricsController] Fill function error', {
          requester_service: requesterService,
          error: fillError.message,
          stack: fillError.stack,
        });
        // Set error in response but keep original structure
        requestBody.response = {
          error: 'Internal Fill Error',
        };
        const errorStringified = JSON.stringify(requestBody);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(errorStringified);
      }

      // Update ONLY the response field with filled data
      // DO NOT modify requester_service or payload
      requestBody.response = filledData || {};

      // Stringify the entire original object (with updated response)
      let stringifiedResponse;
      try {
        stringifiedResponse = JSON.stringify(requestBody);
      } catch (stringifyError) {
        logger.error('[ContentMetricsController] Failed to stringify response', {
          requester_service: requesterService,
          error: stringifyError.message,
        });
        // Set error in response but keep original structure
        requestBody.response = {
          error: 'Failed to stringify response',
        };
        stringifiedResponse = JSON.stringify(requestBody);
      }

      // Return response with stringified entire object
      logger.info('[ContentMetricsController] Successfully filled content metrics', {
        requester_service: requesterService,
        filledKeys: Object.keys(filledData || {}),
        responseSize: stringifiedResponse.length,
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(stringifiedResponse);
    } catch (error) {
      logger.error('[ContentMetricsController] Unexpected error', {
        error: error.message,
        stack: error.stack,
      });
      
      // If we have a requestBody structure, return it with error in response
      if (typeof req.body === 'string') {
        try {
          const errorBody = JSON.parse(req.body);
          if (errorBody && typeof errorBody === 'object' && errorBody.requester_service && errorBody.payload) {
            errorBody.response = { error: 'Internal server error' };
            const errorStringified = JSON.stringify(errorBody);
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(errorStringified);
          }
        } catch (parseError) {
          // If we can't parse, fall through to next(error)
        }
      }
      
      next(error);
    }
  }


  /**
   * Handle Course Builder format: stringified JSON with requester_service, payload, response
   * Orchestrates the full workflow using existing use-cases
   * @param {Object} requestData - Parsed request data (with requester_service, payload, response)
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware
   * @param {Object} req - Express request object (for accessing trainer_id)
   */
  async handleCourseBuilderFormat(requestData, res, next, req) {
    // Note: Server timeout is set at server level (20 minutes in server.js)
    // This endpoint can take a long time due to AI content generation
    
    // Send keep-alive headers to prevent connection timeout
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=600, max=1000');
    
    try {
      // Validate structure (already validated in fillContentMetrics, but double-check)
      if (!requestData.payload || typeof requestData.payload !== 'object') {
        logger.error('[ContentMetricsController] Invalid Course Builder format - missing or invalid payload');
        requestData.response = { error: 'Invalid Course Builder format - payload is required' };
        const errorStringified = JSON.stringify(requestData);
        res.setHeader('Content-Type', 'application/json');
        return res.end(errorStringified);
      }

      // Ensure response.course exists
      if (!requestData.response || typeof requestData.response !== 'object') {
        requestData.response = {};
      }
      if (!requestData.response.hasOwnProperty('course')) {
        requestData.response.course = [];
      }

      logger.info('[ContentMetricsController] Starting Course Builder workflow orchestration', {
        requester_service: requestData.requester_service,
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

      // Step 2: Use preferred language from Course Builder request
      // NOTE: preferred_language is now REQUIRED and always provided by Course Builder
      // The fallback to Directory has been removed - Course Builder always sends preferred_language
      logger.info('[ContentMetricsController] Step 2: Using preferred language from Course Builder request');
      
      // preferred_language is already validated in parseCourseRequest
      const preferredLanguage = { preferred_language: parsedRequest.preferred_language };
      
      logger.info('[ContentMetricsController] Preferred language from Course Builder', {
        preferred_language: preferredLanguage.preferred_language,
      });

      // Step 2.5: If trainer_id is provided, search for existing topics by trainer
      let trainerTopics = [];
      if (parsedRequest.trainer_id) {
        logger.info('[ContentMetricsController] Step 2.5: Searching for existing topics by trainer', {
          trainer_id: parsedRequest.trainer_id,
          skills: parsedRequest.skills,
          language: preferredLanguage.preferred_language,
        });
        trainerTopics = await searchTrainerTopics(
          parsedRequest.trainer_id,
          parsedRequest.skills,
          preferredLanguage.preferred_language
        );
        logger.info('[ContentMetricsController] Found trainer topics', {
          trainer_id: parsedRequest.trainer_id,
          topicsCount: trainerTopics.length,
        });
      }

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

      // Step 5: Run mapSkillCoverage with trainer topics and course topics
      logger.info('[ContentMetricsController] Step 5: Mapping skill coverage');
      // Combine trainer topics and course topics for skill coverage mapping
      const allExistingTopics = [...trainerTopics, ...courseTopics];
      let skillCoverage = mapSkillCoverage(parsedRequest.skills, courseTopics, trainerTopics);
      logger.info('[ContentMetricsController] Initial skill coverage mapped', {
        total_skills: skillCoverage.length,
        found: skillCoverage.filter(s => s.status === 'found').length,
        missing: skillCoverage.filter(s => s.status === 'missing').length,
      });

      // Step 6: For each missing skill, try to find standalone topic (only if trainer topics not found)
      logger.info('[ContentMetricsController] Step 6: Searching for standalone topics');
      const standaloneTopics = [];
      
      // Only search for standalone topics if we don't have trainer topics
      // If trainer topics exist, they should cover most skills
      if (trainerTopics.length === 0) {
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
      } else {
        logger.info('[ContentMetricsController] Skipping standalone topic search - trainer topics found', {
          trainerTopicsCount: trainerTopics.length,
        });
      }

      // Step 7: For skills STILL missing, generate AI topic and save to DB
      // Only generate if trainer topics don't cover all skills
      logger.info('[ContentMetricsController] Step 7: Generating AI topics for missing skills');
      const aiGeneratedTopics = [];
      
      // Check if we have any missing skills
      const missingSkills = skillCoverage.filter(item => item.status === 'missing' && item.source === 'ai');
      
      if (missingSkills.length > 0) {
        logger.info('[ContentMetricsController] Generating AI topics for missing skills', {
          missingSkillsCount: missingSkills.length,
          hasTrainerTopics: trainerTopics.length > 0,
        });
        
        for (const coverageItem of missingSkills) {
          logger.info('[ContentMetricsController] Generating AI topic for skill', {
            skill: coverageItem.skill,
          });
          try {
            const generatedTopic = await generateAiTopic(coverageItem, preferredLanguage.preferred_language);
            if (generatedTopic) {
              // Ensure skills array is included for saving
              if (!generatedTopic.skills || !Array.isArray(generatedTopic.skills)) {
                generatedTopic.skills = [coverageItem.skill];
              }
              logger.info('[ContentMetricsController] Saving generated AI topic to database', {
                skill: coverageItem.skill,
              });
              try {
                // Use trainer_id from parsedRequest if available
                const trainerId = parsedRequest.trainer_id || req?.auth?.trainer?.trainer_id || null;
                
                const saveResult = await saveGeneratedTopicToDatabase(
                  generatedTopic,
                  preferredLanguage.preferred_language,
                  trainerId
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
              } catch (saveError) {
                logger.error('[ContentMetricsController] Failed to save generated AI topic', {
                  skill: coverageItem.skill,
                  error: saveError.message,
                  stack: saveError.stack,
                });
                // Continue to next skill even if save failed
              }
            }
          } catch (generateError) {
            logger.error('[ContentMetricsController] Failed to generate AI topic', {
              skill: coverageItem.skill,
              error: generateError.message,
              stack: generateError.stack,
            });
            // Continue to next skill even if generation failed - don't crash the entire request
          }
        }
      } else {
        logger.info('[ContentMetricsController] No missing skills - all covered by existing topics', {
          trainerTopicsCount: trainerTopics.length,
          courseTopicsCount: courseTopics.length,
          standaloneTopicsCount: standaloneTopics.length,
        });
      }

      // Build resolved topics array (trainer + course + standalone + AI)
      logger.info('[ContentMetricsController] Building resolved topics array');
      const resolvedTopics = [];
      const addedTopicIds = new Set(); // Track added topic IDs to avoid duplicates
      
      // Priority 1: Add trainer topics first (most relevant)
      // Increment usage_count for standalone trainer topics when they are used
      for (const topic of trainerTopics) {
        if (topic.topic_id && !addedTopicIds.has(topic.topic_id)) {
          resolvedTopics.push(topic);
          addedTopicIds.add(topic.topic_id);
          
          // Check if this is a standalone topic (course_id is null) and increment usage_count
          // Note: searchTrainerTopics returns topics that may be standalone or belong to courses
          // We only increment usage_count for standalone topics (those without a course_id)
          if (this.topicRepository) {
            try {
              // Check if topic is standalone by querying the database
              const topicDetails = await this.topicRepository.findById(topic.topic_id);
              if (topicDetails && topicDetails.course_id === null) {
                await this.topicRepository.incrementUsageCount(topic.topic_id);
                logger.info('[ContentMetricsController] Incremented usage_count for standalone trainer topic', {
                  topic_id: topic.topic_id,
                });
              }
            } catch (usageCountError) {
              logger.warn('[ContentMetricsController] Failed to increment usage_count for trainer topic (non-blocking)', {
                topic_id: topic.topic_id,
                error: usageCountError.message,
              });
            }
          }
        }
      }
      
      // Priority 2: Add course topics (avoid duplicates)
      for (const topic of courseTopics) {
        if (topic.topic_id && !addedTopicIds.has(topic.topic_id)) {
          resolvedTopics.push(topic);
          addedTopicIds.add(topic.topic_id);
        }
      }
      
      // Priority 3: Add standalone topics (avoid duplicates)
      // Increment usage_count for standalone topics when they are used
      for (const topic of standaloneTopics) {
        if (topic.topic_id && !addedTopicIds.has(topic.topic_id)) {
          resolvedTopics.push(topic);
          addedTopicIds.add(topic.topic_id);
          
          // Increment usage_count for standalone topic (non-blocking)
          if (this.topicRepository) {
            try {
              await this.topicRepository.incrementUsageCount(topic.topic_id);
              logger.info('[ContentMetricsController] Incremented usage_count for standalone topic', {
                topic_id: topic.topic_id,
              });
            } catch (usageCountError) {
              logger.warn('[ContentMetricsController] Failed to increment usage_count for standalone topic (non-blocking)', {
                topic_id: topic.topic_id,
                error: usageCountError.message,
              });
            }
          }
        }
      }
      
      // Priority 4: Add AI generated topics (avoid duplicates)
      for (const topic of aiGeneratedTopics) {
        if (topic.topic_id && !addedTopicIds.has(topic.topic_id)) {
          resolvedTopics.push(topic);
          addedTopicIds.add(topic.topic_id);
        }
      }

      logger.info('[ContentMetricsController] Resolved topics built', {
        total_topics: resolvedTopics.length,
        trainer_topics: trainerTopics.length,
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

      // Log FULL response body before sending to course builder via Coordinator
      logger.info('[ContentMetricsController] ===== FULL RESPONSE BODY TO COURSE BUILDER (handleCourseBuilderFormat - before sending to Coordinator) =====', {
        responseSize: stringifiedData.length,
        responseSizeKB: Math.round(stringifiedData.length / 1024),
        responseSizeMB: (stringifiedData.length / (1024 * 1024)).toFixed(2),
        topicsCount: resolvedTopics.length,
        requester_service: requestData.requester_service,
        payloadKeys: requestData.payload ? Object.keys(requestData.payload) : [],
        responseKeys: requestData.response ? Object.keys(requestData.response) : [],
      });
      
      // Log the FULL response body (entire JSON string)
      logger.info('[ContentMetricsController] FULL RESPONSE BODY JSON (handleCourseBuilderFormat):', {
        fullResponseBody: stringifiedData,
      });
      
      // Also log a formatted preview (first 2000 characters)
      logger.info('[ContentMetricsController] Response preview (first 2000 chars - handleCourseBuilderFormat):', {
        responsePreview: stringifiedData.substring(0, 2000),
      });

      logger.info('[ContentMetricsController] Successfully completed Course Builder workflow', {
        topicsCount: resolvedTopics.length,
        responseSize: stringifiedData.length,
      });

      // Return the stringified original object EXACTLY (not wrapped)
      // Use res.end() instead of res.send() to ensure response is sent even if connection closes
      try {
        res.end(stringifiedData);
      } catch (sendError) {
        // If response already sent or connection closed, log but don't throw
        logger.warn('[ContentMetricsController] Failed to send response (connection may have closed)', {
          error: sendError.message,
        });
      }
      return;
    } catch (error) {
      logger.error('[ContentMetricsController] Unexpected error in Course Builder format handler', {
        error: error.message,
        stack: error.stack,
      });
      // On error, set empty array and return stringified original
      requestData.response.course = [];
      const stringifiedData = JSON.stringify(requestData);
      try {
        res.end(stringifiedData);
      } catch (sendError) {
        logger.warn('[ContentMetricsController] Failed to send error response (connection may have closed)', {
          error: sendError.message,
        });
      }
      return;
    }
  }
}

