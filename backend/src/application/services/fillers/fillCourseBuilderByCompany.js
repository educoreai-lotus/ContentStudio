import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill CourseBuilder microservice request by company and skills
 * Priority 1: Company-specific topics (topics in courses where permissions = company)
 * Priority 2: Standalone topics (course_id IS NULL)
 * Both must match at least one of the provided skills
 * 
 * @param {Object} requestData - Full request object with microservice_name, payload, response
 * @returns {Promise<Object>} Updated requestData with topics in response field
 */
export async function fillCourseBuilderByCompany(requestData) {
  try {
    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty topics array
    if (!db.isConnected()) {
      logger.warn('[fillCourseBuilderByCompany] Database not connected, returning empty topics');
      requestData.response = [];
      return requestData;
    }

    const { payload } = requestData;
    const company = payload?.learner_company;
    const skills = payload?.skills || [];

    if (!company) {
      logger.warn('[fillCourseBuilderByCompany] No learner_company provided');
      requestData.response = [];
      return requestData;
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      logger.warn('[fillCourseBuilderByCompany] No skills provided');
      requestData.response = [];
      return requestData;
    }

    logger.info('[fillCourseBuilderByCompany] Querying topics', {
      company,
      skillsCount: skills.length,
      skills,
    });

    let topics = [];

    // Priority 1: Company-specific topics
    // Topics that belong to courses where trainer_courses.permissions = company
    // AND topic skills match at least one of the provided skills
    const companyTopicsQuery = `
      SELECT DISTINCT
        t.topic_id,
        t.topic_name,
        t.description,
        t.language,
        t.skills,
        t.course_id,
        t.template_id,
        t.status,
        t.created_at,
        t.updated_at
      FROM topics t
      INNER JOIN trainer_courses tc ON t.course_id = tc.course_id
      WHERE tc.permissions = $1
        AND t.status != 'deleted'
        AND t.skills && $2::TEXT[]
      ORDER BY t.created_at DESC
    `;

    try {
      const companyResult = await db.query(companyTopicsQuery, [company, skills]);
      topics = companyResult.rows.map(row => ({
        topic_id: row.topic_id,
        topic_name: row.topic_name,
        description: row.description,
        language: row.language || 'en',
        skills: row.skills || [],
        course_id: row.course_id,
        template_id: row.template_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      logger.info('[fillCourseBuilderByCompany] Found company-specific topics', {
        company,
        topicsCount: topics.length,
      });
    } catch (error) {
      logger.error('[fillCourseBuilderByCompany] Error querying company topics', {
        company,
        error: error.message,
        stack: error.stack,
      });
    }

    // Priority 2: Standalone topics (only if no company-specific topics found)
    if (topics.length === 0) {
      const standaloneTopicsQuery = `
        SELECT 
          t.topic_id,
          t.topic_name,
          t.description,
          t.language,
          t.skills,
          t.course_id,
          t.template_id,
          t.status,
          t.created_at,
          t.updated_at
        FROM topics t
        WHERE t.course_id IS NULL
          AND t.status != 'deleted'
          AND t.skills && $1::TEXT[]
        ORDER BY t.created_at DESC
      `;

      try {
        const standaloneResult = await db.query(standaloneTopicsQuery, [skills]);
        topics = standaloneResult.rows.map(row => ({
          topic_id: row.topic_id,
          topic_name: row.topic_name,
          description: row.description,
          language: row.language || 'en',
          skills: row.skills || [],
          course_id: null,
          template_id: row.template_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        logger.info('[fillCourseBuilderByCompany] Found standalone topics', {
          topicsCount: topics.length,
        });
      } catch (error) {
        logger.error('[fillCourseBuilderByCompany] Error querying standalone topics', {
          error: error.message,
          stack: error.stack,
        });
      }
    }

    // Increment usage_count for all found topics
    if (topics.length > 0) {
      const topicIds = topics.map(t => t.topic_id);
      try {
        await db.query(
          `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP 
           WHERE topic_id = ANY($1::INTEGER[])`,
          [topicIds]
        );
      } catch (error) {
        logger.warn('[fillCourseBuilderByCompany] Failed to increment topic usage counts', {
          error: error.message,
        });
      }
    }

    // Write results to response field (not payload)
    requestData.response = topics;

    logger.info('[fillCourseBuilderByCompany] Successfully filled topics', {
      company,
      topicsCount: topics.length,
      priority: topics.length > 0 && topics[0].course_id !== null ? 'company-specific' : 'standalone',
    });

    return requestData;
  } catch (error) {
    logger.error('[fillCourseBuilderByCompany] Error filling CourseBuilder request', {
      error: error.message,
      stack: error.stack,
    });
    // Return empty topics on error
    requestData.response = [];
    return requestData;
  }
}

