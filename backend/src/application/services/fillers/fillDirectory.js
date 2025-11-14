import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill Directory microservice request
 * Fills: course_id, course_name, trainer_id, trainer_name, status
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillDirectory(data) {
  try {
    const filled = { ...data };

    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty structure
    if (!db.isConnected()) {
      logger.warn('[fillDirectory] Database not connected, returning empty structure');
      filled.course_id = data.course_id || '';
      filled.course_name = '';
      filled.trainer_id = data.trainer_id || '';
      filled.trainer_name = '';
      filled.status = '';
      return filled;
    }

    // If course_id is provided, fetch course details
    if (data.course_id) {
      const courseQuery = 'SELECT course_id, course_name, trainer_id, status FROM trainer_courses WHERE course_id = $1 AND status != $2';
      const courseResult = await db.query(courseQuery, [data.course_id, 'deleted']);
      
      if (courseResult.rows.length > 0) {
        const course = courseResult.rows[0];
        filled.course_id = course.course_id;
        filled.course_name = course.course_name || '';
        filled.trainer_id = course.trainer_id || '';
        filled.status = course.status || '';
      }
    }

    // If trainer_id is provided but course_id is not, fetch trainer info from courses
    if (data.trainer_id && !data.course_id) {
      const trainerQuery = 'SELECT trainer_id FROM trainer_courses WHERE trainer_id = $1 AND status != $2 LIMIT 1';
      const trainerResult = await db.query(trainerQuery, [data.trainer_id, 'deleted']);
      
      if (trainerResult.rows.length > 0) {
        filled.trainer_id = trainerResult.rows[0].trainer_id || '';
      }
    }

    // Fill empty fields with empty strings if not found
    filled.course_id = filled.course_id || '';
    filled.course_name = filled.course_name || '';
    filled.trainer_id = filled.trainer_id || '';
    filled.trainer_name = filled.trainer_name || '';
    filled.status = filled.status || '';

    logger.info('[fillDirectory] Filled Directory request', {
      course_id: filled.course_id || 'not provided',
      trainer_id: filled.trainer_id || 'not provided',
    });

    return filled;
  } catch (error) {
    logger.error('[fillDirectory] Error filling Directory request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

