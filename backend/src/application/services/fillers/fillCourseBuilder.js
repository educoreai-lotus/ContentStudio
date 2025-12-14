import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Fill CourseBuilder microservice request
 * Fills: topic_id, topic_name, topic_description, topic_language, template_id, format_order, contents[], devlab_exercises
 * @param {Object} data - Parsed payload object
 * @returns {Promise<Object>} Filled data object
 */
export async function fillCourseBuilder(data) {
  try {
    const filled = { ...data };

    // Wait for database to be ready
    await db.ready;

    // If database is not connected, return empty structure
    if (!db.isConnected()) {
      logger.warn('[fillCourseBuilder] Database not connected, returning empty structure');
      filled.topic_id = data.topic_id || '';
      filled.topic_name = '';
      filled.topic_description = '';
      filled.topic_language = '';
      filled.template_id = null;
      filled.format_order = [];
      filled.contents = [];
      filled.devlab_exercises = data.devlab_exercises || [];
      return filled;
    }

    // If topic_id is provided, fetch topic details and all its content
    if (data.topic_id) {
      // Load database schema using shared function
      const migrationContent = loadDatabaseSchema();

      // Business rules for CourseBuilder topic fetching
      const businessRules = `RULE 1: Query topics table with topic_id filter
RULE 2: topics.status must NOT be 'deleted'
RULE 3: LEFT JOIN with templates table to get format_order
RULE 4: Return: topic_id, topic_name, description as topic_description, language as topic_language, template_id, format_order
RULE 5: format_order comes from templates.format_order (may be JSON string or array)`;

      // Use the SHARED AI Query Builder prompt
      // Services pass ONLY: schema, request body, business rules, task
      let sanitizedTopicSql;
      try {
        sanitizedTopicSql = await generateSQLQueryUsingSharedPrompt({
          schema: migrationContent,
          requestBody: { topic_id: data.topic_id }, // Pass original request body as-is
          businessRules: businessRules,
          task: `Generate a PostgreSQL SELECT query to fetch topic details from topics table where:
- topic_id = ${data.topic_id}
- status != 'deleted'
- LEFT JOIN with templates table to get format_order
- Include: topic_id, topic_name, description as topic_description, language as topic_language, template_id, format_order`,
        });
      } catch (error) {
        logger.error('[fillCourseBuilder] Failed to generate SQL query using shared prompt for topic', {
          error: error.message,
        });
        // Return empty structure on error
        filled.topic_id = data.topic_id;
        filled.topic_name = '';
        filled.topic_description = '';
        filled.topic_language = '';
        filled.template_id = null;
        filled.format_order = [];
        filled.contents = [];
        filled.devlab_exercises = data.devlab_exercises || [];
        return filled;
      }

      // Execute SQL safely
      const topicResult = await db.query(sanitizedTopicSql);
      
      if (topicResult.rows.length > 0) {
        const topic = topicResult.rows[0];
        filled.topic_id = topic.topic_id;
        filled.topic_name = topic.topic_name || '';
        filled.topic_description = topic.topic_description || '';
        filled.topic_language = topic.topic_language || '';
        filled.template_id = topic.template_id || null;
        
        // Increment usage_count for this topic
        try {
          await db.query(
            'UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id = $1',
            [data.topic_id]
          );
        } catch (error) {
          logger.warn('[fillCourseBuilder] Failed to increment topic usage count:', error.message);
          // Don't fail the entire operation if usage count increment fails
        }
        
        // Parse format_order from JSON if it's a string
        if (topic.format_order) {
          filled.format_order = typeof topic.format_order === 'string' 
            ? JSON.parse(topic.format_order) 
            : topic.format_order;
        } else {
          filled.format_order = [];
        }

        // Fetch all content for this topic (all 6 formats) using SHARED AI Query Builder
        const contentBusinessRules = `RULE 1: Query content table with topic_id filter
RULE 2: content.status must be NULL OR not 'deleted'
RULE 3: LEFT JOIN with content_types table to get type_name as content_type
RULE 4: CRITICAL - Query from 'content' table ONLY, NOT from 'content_history' table
RULE 5: Return: content_id, content_type_id, content_type (from content_types.type_name), content_data, quality_check_status, quality_check_data, audio_url, status
RULE 6: Order by content_type_id`;

        let sanitizedContentSql;
        try {
          sanitizedContentSql = await generateSQLQueryUsingSharedPrompt({
            schema: migrationContent,
            requestBody: { topic_id: data.topic_id }, // Pass original request body as-is
            businessRules: contentBusinessRules,
            task: `Generate a PostgreSQL SELECT query to fetch all content for topic_id = ${data.topic_id} from 'content' table (NOT content_history) where:
- topic_id = ${data.topic_id}
- status IS NULL OR status != 'deleted'
- LEFT JOIN with content_types table to get type_name as content_type
- Include: content_id, content_type_id, content_type, content_data, quality_check_status, quality_check_data, audio_url, status
- Order by content_type_id`,
          });
        } catch (error) {
          logger.error('[fillCourseBuilder] Failed to generate SQL query using shared prompt for content', {
            error: error.message,
          });
          // Continue with empty contents array
          filled.contents = [];
          filled.devlab_exercises = data.devlab_exercises || [];
          return filled;
        }

        // Execute SQL safely
        const contentResult = await db.query(sanitizedContentSql);
        
        // Map content types to format names
        const contentTypeMap = {
          1: 'text',
          2: 'code',
          3: 'presentation',
          4: 'audio',
          5: 'mind_map',
          6: 'avatar_video',
        };

        // Build contents array with all 6 formats
        const contents = [];
        const contentByType = {};
        
        contentResult.rows.forEach(row => {
          const formatType = contentTypeMap[row.content_type_id] || 'unknown';
          
          // Parse JSON fields if they are strings
          let contentData = row.content_data;
          if (typeof contentData === 'string') {
            try {
              contentData = JSON.parse(contentData);
            } catch (parseError) {
              logger.warn('[fillCourseBuilder] Failed to parse content_data', {
                content_id: row.content_id,
                error: parseError.message,
              });
              contentData = {};
            }
          }
          
          let qualityCheckData = row.quality_check_data;
          if (qualityCheckData && typeof qualityCheckData === 'string') {
            try {
              qualityCheckData = JSON.parse(qualityCheckData);
            } catch (parseError) {
              logger.warn('[fillCourseBuilder] Failed to parse quality_check_data', {
                content_id: row.content_id,
                error: parseError.message,
              });
              qualityCheckData = null;
            }
          }
          
          contentByType[formatType] = {
            content_id: row.content_id,
            content_type: row.content_type || formatType,
            content_data: contentData || {},
            quality_check_status: row.quality_check_status || null,
            quality_check_data: qualityCheckData || null,
            audio_url: row.audio_url || null,
            status: row.status || 'active',
          };
        });

        // Ensure all 6 formats are present (even if empty)
        const allFormats = ['text', 'code', 'presentation', 'audio', 'mind_map', 'avatar_video'];
        allFormats.forEach(format => {
          if (contentByType[format]) {
            contents.push(contentByType[format]);
          } else {
            contents.push({
              content_id: null,
              content_type: format,
              content_data: {},
              quality_check_status: null,
              quality_check_data: null,
              audio_url: null,
              status: 'missing',
            });
          }
        });

        filled.contents = contents;
      } else {
        // Topic not found - return empty structure
        filled.topic_id = data.topic_id;
        filled.topic_name = '';
        filled.topic_description = '';
        filled.topic_language = '';
        filled.template_id = null;
        filled.format_order = [];
        filled.contents = [];
      }
    } else {
      // No topic_id provided - return empty structure
      filled.topic_id = '';
      filled.topic_name = '';
      filled.topic_description = '';
      filled.topic_language = '';
      filled.template_id = null;
      filled.format_order = [];
      filled.contents = [];
    }

    // DevLab exercises - placeholder (would need integration with DevLab)
    filled.devlab_exercises = data.devlab_exercises || [];

    logger.info('[fillCourseBuilder] Filled CourseBuilder request', {
      topic_id: filled.topic_id || 'not provided',
      contents_count: filled.contents?.length || 0,
    });

    return filled;
  } catch (error) {
    logger.error('[fillCourseBuilder] Error filling CourseBuilder request', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

