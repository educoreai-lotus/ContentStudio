import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Step 4 - Fetches all archived course content with topics and contents.
 * Uses AI Query Builder (OpenAI 3.5) to generate SQL queries dynamically.
 * 
 * @param {Object} courseRow - Full trainer_courses row from searchSuitableCourse()
 * @returns {Promise<Object>} Course with topics and contents
 */
export async function fetchArchivedCourseContent(courseRow) {
  // Validate input
  if (!courseRow || typeof courseRow !== 'object') {
    throw new Error('courseRow must be an object');
  }

  if (!courseRow.course_id) {
    throw new Error('courseRow.course_id is required');
  }

  // Validate course is archived
  if (courseRow.status !== 'archived') {
    logger.warn('[UseCase] Course is not archived', {
      course_id: courseRow.course_id,
      status: courseRow.status,
    });
    return null;
  }

  // Load database schema using shared function
  const migrationContent = loadDatabaseSchema();

  // Build request body
  const requestBody = {
    course_id: courseRow.course_id,
    course_language: courseRow.language,
  };

  // Business rules
  const businessRules = `COURSE FILTER:
- trainer_courses.status MUST be 'archived'
- Use ONLY the provided course_id from courseRow

TOPIC FILTER:
- topics.course_id = courseRow.course_id
- topics.status MUST be 'archived'
- topics.language MUST equal courseRow.language
- topics.template_id MUST NOT be NULL

CONTENT FILTER:
- contents.topic_id = topics.topic_id
- MUST join with content_types to return the type_name
- MUST preserve template.format_order when sorting contents

TEMPLATE JOIN:
- templates.template_id = topics.template_id
- FORMAT ORDER must instruct how the content sorting is done

OUTPUT REQUIREMENTS:
- Return ALL columns from topics, templates, content, content_types
- Contents must be sorted according to template.format_order array
- Return devlab_exercises from topics table if exists`;

  // Use the SHARED AI Query Builder prompt
  // Services pass ONLY: schema, request body, business rules, task
  try {
    const sanitizedSql = await generateSQLQueryUsingSharedPrompt({
      schema: migrationContent,
      requestBody: requestBody, // Pass original request body as-is
      businessRules: businessRules,
      task: `Generate a PostgreSQL SELECT query that:
1. Joins trainer_courses, topics, templates, content, and content_types
2. Filters for archived course and archived topics matching the course_id and language
3. Returns all necessary columns to build the response structure
4. Orders contents by template.format_order array (map content_types.type_name to format_order positions)`,
    });

    // Execute SQL safely
    await db.ready;
    if (!db.isConnected()) {
      logger.error('[UseCase] Database not connected');
      return null;
    }

    const result = await db.query(sanitizedSql);

    if (!result.rows || result.rows.length === 0) {
      logger.info('[UseCase] No archived topics found for course', {
        course_id: courseRow.course_id,
      });
      return {
        course_id: courseRow.course_id,
        course_name: courseRow.course_name || '',
        course_description: courseRow.description || '',
        course_language: courseRow.language || 'en',
        trainer_id: courseRow.trainer_id || '',
        trainer_name: courseRow.trainer_name || '',
        topics: [],
      };
    }

    // Group results by topic and build response structure
    const topicsMap = new Map();

    for (const row of result.rows) {
      const topicId = row.topic_id;

      if (!topicsMap.has(topicId)) {
        topicsMap.set(topicId, {
          topic_id: row.topic_id,
          topic_name: row.topic_name,
          topic_description: row.description || '',
          topic_language: row.language || courseRow.language,
          template_id: row.template_id,
          format_order: row.format_order || [],
          contents: [],
          devlab_exercises: row.devlab_exercises || null,
        });
      }

      const topic = topicsMap.get(topicId);

      // Add content if exists
      if (row.content_id) {
        topic.contents.push({
          content_id: row.content_id,
          content_type: row.type_name || '',
          content_data: row.content_data || {},
        });
      }
    }

    // Sort contents by format_order for each topic
    const topics = Array.from(topicsMap.values()).map(topic => {
      if (topic.format_order && Array.isArray(topic.format_order) && topic.contents.length > 0) {
        // Create a map of content_type to index in format_order
        const orderMap = new Map();
        topic.format_order.forEach((type, index) => {
          orderMap.set(type, index);
        });

        // Sort contents by format_order
        topic.contents.sort((a, b) => {
          const aIndex = orderMap.get(a.content_type) ?? 999;
          const bIndex = orderMap.get(b.content_type) ?? 999;
          return aIndex - bIndex;
        });
      }

      return topic;
    });

    return {
      course_id: courseRow.course_id,
      course_name: courseRow.course_name || '',
      course_description: courseRow.description || '',
      course_language: courseRow.language || 'en',
      trainer_id: courseRow.trainer_id || '',
      trainer_name: courseRow.trainer_name || '',
      topics,
    };
  } catch (error) {
    logger.error('[UseCase] Failed to fetch archived course content', {
      error: error.message,
      course_id: courseRow.course_id,
    });
    return null;
  }
}

