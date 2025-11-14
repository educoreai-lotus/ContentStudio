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
      // Fetch topic details
      const topicQuery = `
        SELECT 
          t.topic_id, 
          t.topic_name, 
          t.description as topic_description, 
          t.language as topic_language,
          t.template_id,
          tm.format_order
        FROM topics t
        LEFT JOIN templates tm ON t.template_id = tm.template_id
        WHERE t.topic_id = $1 AND t.status != $2
      `;
      const topicResult = await db.query(topicQuery, [data.topic_id, 'deleted']);
      
      if (topicResult.rows.length > 0) {
        const topic = topicResult.rows[0];
        filled.topic_id = topic.topic_id;
        filled.topic_name = topic.topic_name || '';
        filled.topic_description = topic.topic_description || '';
        filled.topic_language = topic.topic_language || '';
        filled.template_id = topic.template_id || null;
        
        // Parse format_order from JSON if it's a string
        if (topic.format_order) {
          filled.format_order = typeof topic.format_order === 'string' 
            ? JSON.parse(topic.format_order) 
            : topic.format_order;
        } else {
          filled.format_order = [];
        }

        // Fetch all content for this topic (all 6 formats)
        const contentQuery = `
          SELECT 
            c.content_id,
            c.content_type_id,
            ct.type_name as content_type,
            c.content_data,
            c.quality_check_status,
            c.quality_check_data,
            c.audio_url,
            c.status
          FROM content c
          LEFT JOIN content_types ct ON c.content_type_id = ct.type_id
          WHERE c.topic_id = $1 
            AND (c.status IS NULL OR c.status != 'deleted')
          ORDER BY c.content_type_id
        `;
        const contentResult = await db.query(contentQuery, [data.topic_id]);
        
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

