import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { ContentDataCleaner } from '../../utils/ContentDataCleaner.js';
import { AvatarVideoStorageService } from '../../../infrastructure/storage/AvatarVideoStorageService.js';

// Content type name to ID mapping
const CONTENT_TYPE_MAP = {
  'text_audio': 1,
  'text': 1,
  'code': 2,
  'presentation': 3,
  'audio': 4,
  'mind_map': 5,
  'avatar_video': 6,
};

/**
 * Saves a full AI-generated topic to the database.
 * Uses parameterized queries for safe and reliable data insertion.
 * 
 * @param {Object} generatedTopic - Full topic object from generateAiTopic
 * @param {string} preferredLanguage - Preferred language code
 * @param {string|null} trainerId - Trainer ID from authenticated context (optional, defaults to null)
 * @returns {Promise<Object|null>} Response object with saved status or null
 */
export async function saveGeneratedTopicToDatabase(generatedTopic, preferredLanguage, trainerId = null) {
  // Validation
  if (!generatedTopic || typeof generatedTopic !== 'object') {
    logger.warn('[UseCase] Invalid generatedTopic provided');
    return null;
  }

  if (!Array.isArray(generatedTopic.contents) || generatedTopic.contents.length < 1) {
    logger.warn('[UseCase] generatedTopic.contents must be a non-empty array');
    return null;
  }

  if (!preferredLanguage || typeof preferredLanguage !== 'string') {
    logger.warn('[UseCase] preferredLanguage is required');
    return null;
  }

  if (!Array.isArray(generatedTopic.skills) || generatedTopic.skills.length === 0) {
    logger.warn('[UseCase] generatedTopic.skills must be a non-empty array');
    return null;
  }

  // Ensure database is ready
  await db.ready;
  if (!db.isConnected()) {
    logger.error('[UseCase] Database not connected');
    return null;
  }

  try {
    // Step 1: Save topic using parameterized query to ensure proper data handling
    const topicLanguage = generatedTopic.topic_language || preferredLanguage;
    const skillsArray = generatedTopic.skills || [];

    // Build topic INSERT with parameterized query
    // Note: In DB schema, fields are 'description' and 'language', not 'topic_description' and 'topic_language'
    // Note: skills is text[] (PostgreSQL array), not JSONB - pg driver will convert array automatically
    const insertTopicSql = `
      INSERT INTO topics (
        topic_name,
        description,
        language,
        skills,
        trainer_id,
        course_id,
        template_id,
        generation_methods_id,
        status,
        devlab_exercises,
        usage_count
      ) VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, 0)
      RETURNING topic_id
    `;

    // Determine trainer_id: use provided trainerId, or fallback to 'system-auto'
    const finalTrainerId = trainerId || 'system-auto';

    // Log warning if using fallback
    if (!trainerId) {
      logger.warn('[UseCase] Missing trainer_id for generated topic. Using system-auto fallback.', {
        topic_name: generatedTopic.topic_name,
        preferred_language: preferredLanguage,
      });
    }

    // Execute topic INSERT with parameterized query
    // Pass skillsArray directly - pg driver will convert to PostgreSQL array automatically
    const topicResult = await db.query(insertTopicSql, [
      generatedTopic.topic_name || '',
      generatedTopic.topic_description || '', // description field in DB
      topicLanguage, // language field in DB - ensure language is passed correctly
      skillsArray, // PostgreSQL array - pg driver handles conversion automatically
      finalTrainerId, // Use real trainer_id or fallback to 'system-auto'
      null, // course_id
      null, // template_id
      5, // generation_methods_id
      'archived',
      null, // devlab_exercises
    ]);

    if (!topicResult.rows || topicResult.rows.length === 0 || !topicResult.rows[0].topic_id) {
      logger.error('[UseCase] Failed to save topic - no topic_id returned');
      return null;
    }

    const topicId = topicResult.rows[0].topic_id;
    logger.info('[UseCase] Topic saved successfully', { 
      topic_id: topicId,
      topic_language: topicLanguage,
    });

    // Step 2: Save contents
    let contentsSaved = 0;
    const storageService = new AvatarVideoStorageService();
    
    for (const content of generatedTopic.contents) {
      let storagePathToRollback = null;
      
      try {
        const contentTypeName = content.content_type;
        const contentTypeId = CONTENT_TYPE_MAP[contentTypeName];
        
        if (!contentTypeId) {
          logger.warn('[UseCase] Unknown content_type, skipping', { content_type: contentTypeName });
          continue;
        }

        // Clean content_data before saving
        const rawContentData = content.content_data || {};
        const cleanedContentData = ContentDataCleaner.clean(rawContentData, contentTypeId);

        // For avatar video, extract storage path for potential rollback
        if (contentTypeName === 'avatar_video' && cleanedContentData.storagePath) {
          storagePathToRollback = cleanedContentData.storagePath;
          logger.info('[UseCase] Avatar video content detected, will rollback storage if DB save fails', {
            storagePath: storagePathToRollback,
            topic_id: topicId,
          });
        }

        // Use parameterized query for JSONB to avoid SQL injection and escaping issues
        const insertContentSql = `
          INSERT INTO content (
            topic_id,
            content_type_id,
            content_data,
            generation_method_id,
            quality_check_status,
            quality_check_data
          ) VALUES ($1, $2, $3::jsonb, $4, NULL, NULL)
        `;

        // Execute content INSERT with parameterized query
        await db.query(insertContentSql, [
          topicId,
          contentTypeId,
          JSON.stringify(cleanedContentData), // pg will handle JSONB conversion
          5, // generation_method_id
        ]);
        contentsSaved++;
        logger.info('[UseCase] Content saved successfully', {
          topic_id: topicId,
          content_type: contentTypeName,
          hasStoragePath: !!storagePathToRollback,
        });
        
        // Clear rollback path on success
        storagePathToRollback = null;
      } catch (contentError) {
        logger.error('[UseCase] Failed to save content', {
          error: contentError.message,
          error_stack: contentError.stack,
          content_type: content.content_type,
          topic_id: topicId,
          content_data_size: JSON.stringify(content.content_data || {}).length,
        });
        
        // Rollback: Delete file from Supabase Storage if DB save failed for avatar video
        if (storagePathToRollback && contentTypeName === 'avatar_video') {
          logger.warn('[UseCase] Rolling back avatar video storage due to DB save failure', {
            storagePath: storagePathToRollback,
            topic_id: topicId,
          });
          try {
            await storageService.deleteVideoFromStorage(storagePathToRollback);
            logger.info('[UseCase] Avatar video file deleted from storage (rollback successful)', {
              storagePath: storagePathToRollback,
            });
          } catch (rollbackError) {
            logger.error('[UseCase] Failed to rollback avatar video storage', {
              error: rollbackError.message,
              storagePath: storagePathToRollback,
            });
            // Don't throw - rollback failure is logged but doesn't break the flow
          }
        }
        
        // Continue with next content (transaction-like logic - log only)
      }
    }

    // Step 3: Update usage counters
    try {
      // Update topic usage_count
      const updateTopicUsageSql = `UPDATE topics SET usage_count = usage_count + 1 WHERE topic_id = ${topicId}`;
      await db.query(updateTopicUsageSql);

      // Update generation_methods usage_count (method_id = 5)
      const updateMethodUsageSql = `UPDATE generation_methods SET usage_count = usage_count + 1 WHERE method_id = 5`;
      await db.query(updateMethodUsageSql);

      logger.info('[UseCase] Usage counters updated', { topic_id: topicId });
    } catch (usageError) {
      logger.warn('[UseCase] Failed to update usage counters', {
        error: usageError.message,
        topic_id: topicId,
      });
      // Don't fail the whole operation if usage counters fail
    }

    // Return response
    return {
      saved: true,
      topic_id: topicId,
      contents_saved: contentsSaved,
      method_id: 5,
    };
  } catch (error) {
    logger.error('[UseCase] Failed to save generated topic to database', {
      error: error.message,
      topic_name: generatedTopic.topic_name,
    });
    return null;
  }
}

