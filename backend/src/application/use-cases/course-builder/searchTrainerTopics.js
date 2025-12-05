import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Search for existing topics by trainer_id, skills, and language
 * Used when Course Builder sends trainer_id to find relevant existing content
 * 
 * @param {string} trainerId - Trainer ID
 * @param {Array<string>} skills - Array of skills to match
 * @param {string} language - Language code (e.g., 'en', 'he', 'ar')
 * @returns {Promise<Array<Object>>} Array of matching topics with their content
 */
export async function searchTrainerTopics(trainerId, skills, language) {
  // Validate inputs
  if (!trainerId || typeof trainerId !== 'string') {
    logger.warn('[searchTrainerTopics] Invalid trainer_id, skipping search', {
      trainerId,
      trainerIdType: typeof trainerId,
    });
    return [];
  }

  if (!Array.isArray(skills) || skills.length === 0) {
    logger.warn('[searchTrainerTopics] Invalid skills array, skipping search', {
      skills,
    });
    return [];
  }

  if (!language || typeof language !== 'string') {
    logger.warn('[searchTrainerTopics] Invalid language, skipping search', {
      language,
    });
    return [];
  }

  try {
    await db.ready;
    if (!db.isConnected()) {
      logger.warn('[searchTrainerTopics] Database not connected, skipping search');
      return [];
    }

    logger.info('[searchTrainerTopics] Searching for topics', {
      trainerId,
      skillsCount: skills.length,
      language,
    });

    // Search for topics that:
    // 1. Belong to the trainer (trainer_id matches)
    // 2. Language matches
    // 3. Skills array contains at least one of the requested skills
    // 4. Status is not 'deleted'
    const query = `
      SELECT 
        t.topic_id,
        t.topic_name,
        t.description,
        t.language,
        t.skills,
        t.template_id,
        t.status,
        t.created_at,
        tm.format_order
      FROM topics t
      LEFT JOIN templates tm ON t.template_id = tm.template_id
      WHERE t.trainer_id = $1
        AND t.language = $2
        AND t.status != 'deleted'
        AND (
          -- Check if skills array contains any of the requested skills
          EXISTS (
            SELECT 1 
            FROM unnest(t.skills) AS topic_skill
            WHERE topic_skill = ANY($3::text[])
          )
        )
      ORDER BY t.created_at DESC
    `;

    const result = await db.query(query, [trainerId, language, skills]);

    if (!result.rows || result.rows.length === 0) {
      logger.info('[searchTrainerTopics] No matching topics found', {
        trainerId,
        skillsCount: skills.length,
        language,
      });
      return [];
    }

    logger.info('[searchTrainerTopics] Found matching topics', {
      trainerId,
      topicsCount: result.rows.length,
      language,
    });

    // Fetch content for each topic
    const topicsWithContent = [];
    for (const topic of result.rows) {
      // Fetch all content for this topic
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

      const contentResult = await db.query(contentQuery, [topic.topic_id]);

      // Map content types to format names
      const contentTypeMap = {
        1: 'text',
        2: 'code',
        3: 'presentation',
        4: 'audio',
        5: 'mind_map',
        6: 'avatar_video',
      };

      // Build contents array
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
            logger.warn('[searchTrainerTopics] Failed to parse content_data', {
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

      // Parse format_order from JSON if it's a string
      let formatOrder = [];
      if (topic.format_order) {
        formatOrder = typeof topic.format_order === 'string'
          ? JSON.parse(topic.format_order)
          : topic.format_order;
      }

      // Parse skills from JSON if it's a string
      let topicSkills = [];
      if (topic.skills) {
        topicSkills = Array.isArray(topic.skills)
          ? topic.skills
          : (typeof topic.skills === 'string' ? JSON.parse(topic.skills) : []);
      }

      topicsWithContent.push({
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        description: topic.description,
        language: topic.language,
        skills: topicSkills,
        template_id: topic.template_id,
        format_order: formatOrder,
        contents: contents,
        devlab_exercises: null, // Will be filled later if needed
        status: topic.status,
        created_at: topic.created_at,
      });
    }

    logger.info('[searchTrainerTopics] Successfully retrieved topics with content', {
      trainerId,
      topicsCount: topicsWithContent.length,
      language,
    });

    return topicsWithContent;
  } catch (error) {
    logger.error('[searchTrainerTopics] Error searching for topics', {
      trainerId,
      skills,
      language,
      error: error.message,
      stack: error.stack,
    });
    // Return empty array on error - don't fail the entire request
    return [];
  }
}

