import { logger } from '../../infrastructure/logging/Logger.js';
import { fillDirectory } from '../../application/services/fillers/fillDirectory.js';
import { fillCourseBuilder } from '../../application/services/fillers/fillCourseBuilder.js';
import { fillCourseBuilderByCompany } from '../../application/services/fillers/fillCourseBuilderByCompany.js';
import { fillDevLab } from '../../application/services/fillers/fillDevLab.js';
import { fillSkillsEngine } from '../../application/services/fillers/fillSkillsEngine.js';
import { fillAnalytics } from '../../application/services/fillers/fillAnalytics.js';
import { fillManagement } from '../../application/services/fillers/fillManagement.js';

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
      // Check if request body is a stringified JSON (Course Builder format)
      let requestBody = req.body;
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
      }

      // Check if this is Course Builder format (has microservice_name instead of serviceName)
      if (requestBody.microservice_name === 'course-builder' || requestBody.microservice_name === 'CourseBuilder') {
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

      logger.info('[ContentMetricsController] Processing Course Builder format', {
        microservice_name: requestData.microservice_name,
        hasPayload: !!requestData.payload,
        hasResponse: requestData.response !== undefined,
      });

      // Fill the request data with topics
      let filledData;
      try {
        filledData = await fillCourseBuilderByCompany(requestData);
      } catch (fillError) {
        logger.error('[ContentMetricsController] Fill function error for Course Builder', {
          error: fillError.message,
          stack: fillError.stack,
        });
        // On error, set empty topics array
        filledData = { ...requestData, response: [] };
      }

      // Stringify the entire object
      let stringifiedData;
      try {
        stringifiedData = JSON.stringify(filledData);
      } catch (stringifyError) {
        logger.error('[ContentMetricsController] Failed to stringify Course Builder response', {
          error: stringifyError.message,
        });
        return res.status(500).json({
          error: 'Failed to stringify response',
        });
      }

      // Return response in Course Builder format: { response: stringifiedData }
      logger.info('[ContentMetricsController] Successfully filled Course Builder request', {
        topicsCount: Array.isArray(filledData.response) ? filledData.response.length : 0,
        responseSize: stringifiedData.length,
      });

      return res.status(200).json({
        response: stringifiedData,
      });
    } catch (error) {
      logger.error('[ContentMetricsController] Unexpected error in Course Builder format handler', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
}

