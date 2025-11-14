import { fillAnalytics } from './fillAnalytics.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill Management microservice request
 * Same structure as Analytics: courses[], topics_stand_alone[]
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillManagement(data) {
  try {
    // Management uses the same structure as Analytics
    const filled = await fillAnalytics(data);

    logger.info('[fillManagement] Filled Management request', {
      courses_count: filled.courses.length,
      topics_stand_alone_count: filled.topics_stand_alone.length,
    });

    return filled;
  } catch (error) {
    logger.error('[fillManagement] Error filling Management request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

