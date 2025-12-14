import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill LearningAnalytics/ManagementReporting request using the SHARED AI Query Builder prompt
 * Uses the EXACT SAME prompt structure as searchSuitableCourse.js
 * Only businessRules and task definitions change - the prompt template is identical
 * 
 * This is the SINGLE SOURCE OF TRUTH for LearningAnalytics/ManagementReporting data filling
 * All requests from /api/fill-content-metrics MUST use this shared prompt
 * 
 * @param {Object} parsedPayload - Parsed payload object (may contain businessRules for custom rules)
 * @returns {Promise<Object>} Filled data object with courses[] and topics_stand_alone[]
 */
export async function fillAnalyticsUsingSharedPrompt(parsedPayload) {
  try {
    const filled = { ...parsedPayload };

    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty arrays
    if (!db.isConnected()) {
      logger.warn('[fillAnalyticsUsingSharedPrompt] Database not connected, returning empty arrays');
      filled.courses = [];
      filled.topics_stand_alone = [];
      return filled;
    }

    // Load database schema using shared function
    const migrationContent = loadDatabaseSchema();

    // Business rules for LearningAnalytics/ManagementReporting
    // Use custom businessRules from parsedPayload if provided, otherwise use default
    const defaultBusinessRules = `RULE 1: Return ALL courses regardless of status (include 'active', 'archived', exclude only 'deleted')
RULE 2: For each course, include ALL topics (status != 'deleted')
RULE 3: For each topic, include ALL contents (no filtering)
RULE 4: Include nested structure: courses[] -> topics[] -> contents[]
RULE 5: Include standalone topics (course_id IS NULL) in separate array: topics_stand_alone[]
RULE 6: For courses: include course_id, course_name, course_language, trainer_id, trainer_name, permission, total_usage_count, created_at, status
RULE 7: For topics: include topic_id, topic_name, topic_language, skills[], contents[]
RULE 8: For contents: include content_id, content_type (from content_types.type_name), content_data, generation_methods (from generation_methods.method_name), generation_method_id
RULE 9: CRITICAL - Query contents from 'content' table ONLY, NEVER from 'content_history' table
RULE 10: content_history table is for version tracking/audit - LearningAnalytics needs current/live content only
RULE 11: Join content_types table to get type_name (content_type)
RULE 12: Join generation_methods table to get method_name (generation_methods)
RULE 13: permissions field in trainer_courses can be: 'all' (string) OR array of org_uuid strings OR NULL
RULE 14: trainer_name is not stored in Content Studio DB - use trainer_id as placeholder or fetch from Directory microservice
RULE 15: total_usage_count comes from usage_count field in trainer_courses and topics tables
RULE 16: Do NOT filter by learner_company or skills - return everything
RULE 17: Order courses by created_at DESC, topics by created_at DESC, contents by created_at DESC
RULE 18: NEVER use content_history table - only 'content' table contains the current active content`;

    const businessRules = parsedPayload.businessRules || defaultBusinessRules;

    // Use the SHARED AI Query Builder prompt
    // Services pass ONLY: schema, request body, business rules, task
    let sanitizedCoursesSql;
    try {
      sanitizedCoursesSql = await generateSQLQueryUsingSharedPrompt({
        schema: migrationContent,
        requestBody: parsedPayload, // Pass original request body as-is
        businessRules: businessRules,
        task: `Generate a PostgreSQL SELECT query to fetch ALL courses from trainer_courses table where:
- status != 'deleted'
- Include: course_id, course_name, language as course_language, trainer_id, permissions, usage_count as total_usage_count, status, created_at
- Order by created_at DESC`,
      });
    } catch (error) {
      logger.error('[fillAnalyticsUsingSharedPrompt] Failed to generate SQL query using shared prompt', {
        error: error.message,
      });
      filled.courses = [];
      filled.topics_stand_alone = [];
      return filled;
    }

    // Execute SQL safely
    const coursesResult = await db.query(sanitizedCoursesSql);
    
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
        logger.warn('[fillAnalyticsUsingSharedPrompt] Failed to increment courses usage count:', error.message);
      }
    }
    
    // Build courses array with nested topics and contents
    // Using direct SQL for nested queries (can be enhanced with AI Query Builder later)
    const courses = [];
    for (const courseRow of coursesResult.rows) {
      // Fetch topics for this course
      const topicsResult = await db.query(
        'SELECT topic_id, topic_name, language as topic_language, skills, usage_count as total_usage_count, status, created_at FROM topics WHERE course_id = $1 AND status != $2 ORDER BY created_at DESC',
        [courseRow.course_id, 'deleted']
      );
      
      // Increment usage_count for topics
      const topicIds = topicsResult.rows.map(row => row.topic_id);
      if (topicIds.length > 0) {
        try {
          const placeholders = topicIds.map((_, index) => `$${index + 1}`).join(', ');
          await db.query(
            `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id IN (${placeholders})`,
            topicIds
          );
        } catch (error) {
          logger.warn('[fillAnalyticsUsingSharedPrompt] Failed to increment topics usage count:', error.message);
        }
      }
      
      // Build topics array with contents
      const topics = [];
      for (const topicRow of topicsResult.rows) {
        // Fetch contents for this topic - CRITICAL: from 'content' table ONLY, NOT 'content_history'
        const contentsResult = await db.query(
          `SELECT 
            c.content_id,
            ct.type_name as content_type,
            c.content_data,
            gm.method_name as generation_methods,
            c.generation_method_id as generation_method_id
          FROM content c
          INNER JOIN content_types ct ON c.content_type_id = ct.type_id
          INNER JOIN generation_methods gm ON c.generation_method_id = gm.method_id
          WHERE c.topic_id = $1
          ORDER BY c.created_at DESC`,
          [topicRow.topic_id]
        );
        
        const contents = contentsResult.rows.map(contentRow => ({
          content_id: contentRow.content_id,
          content_type: contentRow.content_type || '',
          content_data: contentRow.content_data || {},
          generation_methods: contentRow.generation_methods || '',
          generation_method_id: contentRow.generation_method_id || null,
        }));
        
        topics.push({
          topic_id: topicRow.topic_id,
          topic_name: topicRow.topic_name || '',
          topic_language: topicRow.topic_language || 'en',
          skills: Array.isArray(topicRow.skills) ? topicRow.skills : (topicRow.skills ? JSON.parse(topicRow.skills) : []),
          contents: contents,
        });
      }
      
      courses.push({
        course_id: courseRow.course_id,
        course_name: courseRow.course_name || '',
        course_language: courseRow.course_language || 'en',
        trainer_id: courseRow.trainer_id || '',
        trainer_name: courseRow.trainer_id || '', // Note: trainer_name should come from Directory, using trainer_id as placeholder
        permission: courseRow.permissions || 'all',
        total_usage_count: courseRow.total_usage_count || 0,
        created_at: courseRow.created_at ? courseRow.created_at.toISOString() : null,
        status: courseRow.status || 'active',
        topics: topics,
      });
    }
    
    filled.courses = courses;

    // Fetch all standalone topics (topics without course_id) with their contents
    const standaloneTopicsResult = await db.query(
      'SELECT topic_id, topic_name, language as topic_language, skills, usage_count as total_usage_count, status, created_at FROM topics WHERE course_id IS NULL AND status != $1 ORDER BY created_at DESC',
      ['deleted']
    );
    
    // Increment usage_count for standalone topics
    const standaloneTopicIds = standaloneTopicsResult.rows.map(row => row.topic_id);
    if (standaloneTopicIds.length > 0) {
      try {
        const placeholders = standaloneTopicIds.map((_, index) => `$${index + 1}`).join(', ');
        await db.query(
          `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id IN (${placeholders})`,
          standaloneTopicIds
        );
      } catch (error) {
        logger.warn('[fillAnalyticsUsingSharedPrompt] Failed to increment standalone topics usage count:', error.message);
      }
    }
    
    // Build topics_stand_alone array with contents
    const topicsStandAlone = [];
    for (const topicRow of standaloneTopicsResult.rows) {
      // Fetch contents for this topic - CRITICAL: from 'content' table ONLY, NOT 'content_history'
      const contentsResult = await db.query(
        `SELECT 
          c.content_id,
          ct.type_name as content_type,
          c.content_data,
          gm.method_name as generation_methods,
          c.generation_method_id as generation_method_id
        FROM content c
        INNER JOIN content_types ct ON c.content_type_id = ct.type_id
        INNER JOIN generation_methods gm ON c.generation_method_id = gm.method_id
        WHERE c.topic_id = $1
        ORDER BY c.created_at DESC`,
        [topicRow.topic_id]
      );
      
      const contents = contentsResult.rows.map(contentRow => ({
        content_id: contentRow.content_id,
        content_type: contentRow.content_type || '',
        content_data: contentRow.content_data || {},
        generation_methods: contentRow.generation_methods || '',
        generation_method_id: contentRow.generation_method_id || null,
      }));
      
      topicsStandAlone.push({
        topic_id: topicRow.topic_id,
        topic_name: topicRow.topic_name || '',
        topic_language: topicRow.topic_language || 'en',
        skills: Array.isArray(topicRow.skills) ? topicRow.skills : (topicRow.skills ? JSON.parse(topicRow.skills) : []),
        total_usage_count: topicRow.total_usage_count || 0,
        created_at: topicRow.created_at ? topicRow.created_at.toISOString() : null,
        status: topicRow.status || 'active',
        contents: contents,
      });
    }
    
    filled.topics_stand_alone = topicsStandAlone;

    logger.info('[fillAnalyticsUsingSharedPrompt] Filled LearningAnalytics request using shared AI Query Builder prompt', {
      courses_count: filled.courses.length,
      topics_stand_alone_count: filled.topics_stand_alone.length,
      total_topics_in_courses: filled.courses.reduce((sum, course) => sum + (course.topics?.length || 0), 0),
    });

    return filled;
  } catch (error) {
    logger.error('[fillAnalyticsUsingSharedPrompt] Error filling LearningAnalytics request', {
      error: error.message,
      stack: error.stack,
    });
    // Return empty arrays on error
    const filled = { ...parsedPayload };
    filled.courses = [];
    filled.topics_stand_alone = [];
    return filled;
  }
}

