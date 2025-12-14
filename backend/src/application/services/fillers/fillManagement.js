import { fillAnalyticsUsingSharedPrompt } from './fillAnalyticsShared.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill Management microservice request
 * Same structure as Analytics: courses[], topics_stand_alone[]
 * 
 * NOTE: This function uses the shared AI Query Builder prompt (same as searchSuitableCourse.js)
 * All requests from /api/fill-content-metrics MUST use the shared prompt
 * 
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillManagement(data) {
  try {
    // Management uses the same structure as Analytics
    // Both use the shared AI Query Builder prompt
    const filled = await fillAnalyticsUsingSharedPrompt(data);

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

