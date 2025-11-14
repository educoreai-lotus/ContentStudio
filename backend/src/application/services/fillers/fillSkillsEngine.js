import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill SkillsEngine microservice request
 * Fills: trainer_id, trainer_name, topic_id, topic_name
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillSkillsEngine(data) {
  try {
    const filled = { ...data };

    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty structure
    if (!db.isConnected()) {
      logger.warn('[fillSkillsEngine] Database not connected, returning empty structure');
      filled.trainer_id = data.trainer_id || '';
      filled.trainer_name = data.trainer_name || '';
      filled.topic_id = data.topic_id || '';
      filled.topic_name = '';
      return filled;
    }

    // If topic_id is provided, fetch topic details
    if (data.topic_id) {
      const topicQuery = 'SELECT topic_id, topic_name, trainer_id FROM topics WHERE topic_id = $1 AND status != $2';
      const topicResult = await db.query(topicQuery, [data.topic_id, 'deleted']);
      
      if (topicResult.rows.length > 0) {
        const topic = topicResult.rows[0];
        filled.topic_id = topic.topic_id;
        filled.topic_name = topic.topic_name || '';
        filled.trainer_id = topic.trainer_id || filled.trainer_id || '';
      }
    }

    // If trainer_id is provided, try to get trainer name from courses
    if (data.trainer_id && !filled.trainer_name) {
      // Note: trainer_name is not stored in Content Studio database
      // This would typically come from Directory microservice
      // For now, we just return the trainer_id
      filled.trainer_id = data.trainer_id;
      filled.trainer_name = data.trainer_name || '';
    }

    // Fill empty fields
    filled.trainer_id = filled.trainer_id || '';
    filled.trainer_name = filled.trainer_name || '';
    filled.topic_id = filled.topic_id || '';
    filled.topic_name = filled.topic_name || '';

    logger.info('[fillSkillsEngine] Filled SkillsEngine request', {
      trainer_id: filled.trainer_id || 'not provided',
      topic_id: filled.topic_id || 'not provided',
    });

    return filled;
  } catch (error) {
    logger.error('[fillSkillsEngine] Error filling SkillsEngine request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

