import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill Analytics microservice request
 * Fills: courses[], topics_stand_alone[]
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillAnalytics(data) {
  try {
    const filled = { ...data };

    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty arrays
    if (!db.isConnected()) {
      logger.warn('[fillAnalytics] Database not connected, returning empty arrays');
      filled.courses = [];
      filled.topics_stand_alone = [];
      return filled;
    }

    // Fetch all active courses
    const coursesQuery = `
      SELECT 
        course_id,
        course_name,
        trainer_id,
        description,
        skills,
        language,
        status,
        created_at,
        updated_at
      FROM trainer_courses
      WHERE status != 'deleted'
      ORDER BY created_at DESC
    `;
    const coursesResult = await db.query(coursesQuery);
    
    // Increment usage_count for all fetched courses
    const courseIds = coursesResult.rows.map(row => row.course_id);
    if (courseIds.length > 0) {
      try {
        const placeholders = courseIds.map((_, index) => `$${index + 1}`).join(', ');
        await db.query(
          `UPDATE trainer_courses SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE course_id IN (${placeholders})`,
          courseIds
        );
      } catch (error) {
        logger.warn('[fillAnalytics] Failed to increment courses usage count:', error.message);
        // Don't fail the entire operation if usage count increment fails
      }
    }
    
    filled.courses = coursesResult.rows.map(row => ({
      course_id: row.course_id,
      course_name: row.course_name || '',
      trainer_id: row.trainer_id || '',
      description: row.description || '',
      skills: Array.isArray(row.skills) ? row.skills : (row.skills ? JSON.parse(row.skills) : []),
      language: row.language || 'en',
      status: row.status || 'active',
      created_at: row.created_at ? row.created_at.toISOString() : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    }));

    // Fetch all standalone topics (topics without course_id)
    const topicsQuery = `
      SELECT 
        topic_id,
        topic_name,
        trainer_id,
        description,
        course_id,
        template_id,
        skills,
        language,
        status,
        created_at,
        updated_at
      FROM topics
      WHERE course_id IS NULL AND status != 'deleted'
      ORDER BY created_at DESC
    `;
    const topicsResult = await db.query(topicsQuery);
    
    // Increment usage_count for all fetched topics
    const topicIds = topicsResult.rows.map(row => row.topic_id);
    if (topicIds.length > 0) {
      try {
        const placeholders = topicIds.map((_, index) => `$${index + 1}`).join(', ');
        await db.query(
          `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id IN (${placeholders})`,
          topicIds
        );
      } catch (error) {
        logger.warn('[fillAnalytics] Failed to increment topics usage count:', error.message);
        // Don't fail the entire operation if usage count increment fails
      }
    }
    
    filled.topics_stand_alone = topicsResult.rows.map(row => ({
      topic_id: row.topic_id,
      topic_name: row.topic_name || '',
      trainer_id: row.trainer_id || '',
      description: row.description || '',
      course_id: row.course_id || null,
      template_id: row.template_id || null,
      skills: Array.isArray(row.skills) ? row.skills : (row.skills ? JSON.parse(row.skills) : []),
      language: row.language || 'en',
      status: row.status || 'active',
      created_at: row.created_at ? row.created_at.toISOString() : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    }));

    logger.info('[fillAnalytics] Filled Analytics request', {
      courses_count: filled.courses.length,
      topics_stand_alone_count: filled.topics_stand_alone.length,
    });

    return filled;
  } catch (error) {
    logger.error('[fillAnalytics] Error filling Analytics request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

