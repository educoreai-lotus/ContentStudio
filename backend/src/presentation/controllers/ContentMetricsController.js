import { logger } from '../../infrastructure/logging/Logger.js';
import { fillDirectory } from '../../application/services/fillers/fillDirectory.js';
import { fillCourseBuilder } from '../../application/services/fillers/fillCourseBuilder.js';
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
      const { serviceName, payload } = req.body;

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

      // Validate payload
      if (!payload || typeof payload !== 'string') {
        logger.error('[ContentMetricsController] Missing or invalid payload', {
          serviceName,
          payloadType: typeof payload,
        });
        return res.status(400).json({
          error: 'payload is required and must be a stringified JSON',
        });
      }

      // Parse payload
      let parsedPayload;
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
}

