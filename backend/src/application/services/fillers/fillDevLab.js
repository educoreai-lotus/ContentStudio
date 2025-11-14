import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill DevLab microservice request
 * Fills: valid, message, ajax
 * Note: DevLab validation logic would be handled by DevLab itself,
 * this is just a pass-through that returns the structure
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillDevLab(data) {
  try {
    const filled = { ...data };

    // DevLab handles validation internally, so we just return the structure
    // Content Studio doesn't validate questions - that's DevLab's job
    filled.valid = data.valid !== undefined ? data.valid : null;
    filled.message = data.message || '';
    filled.ajax = data.ajax !== undefined ? data.ajax : null;

    logger.info('[fillDevLab] Filled DevLab request', {
      valid: filled.valid,
      hasMessage: filled.message.length > 0,
      hasAjax: filled.ajax !== null,
    });

    return filled;
  } catch (error) {
    logger.error('[fillDevLab] Error filling DevLab request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

