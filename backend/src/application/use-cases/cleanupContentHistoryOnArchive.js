import { db } from '../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../infrastructure/logging/Logger.js';
import { AvatarVideoStorageService } from '../../infrastructure/storage/AvatarVideoStorageService.js';

/**
 * Cleanup Content History on Archive
 * When a course or topic is archived, delete all related content_history records
 * First deletes files from Storage, then deletes records from content_history table
 */
export class CleanupContentHistoryOnArchive {
  constructor() {
    this.storageService = new AvatarVideoStorageService();
  }

  /**
   * Cleanup content history for a topic
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupTopicHistory(topicId) {
    if (!topicId || typeof topicId !== 'number') {
      throw new Error('topicId must be a valid number');
    }

    try {
      logger.info('[CleanupContentHistoryOnArchive] Starting cleanup for topic', {
        topicId,
      });

      // Step 1: Get all content_history records for this topic
      const historyRecords = await this.getTopicHistoryRecords(topicId);

      if (historyRecords.length === 0) {
        logger.info('[CleanupContentHistoryOnArchive] No history records found for topic', {
          topicId,
        });
        return {
          success: true,
          deletedFromStorage: 0,
          deletedFromDatabase: 0,
          errors: [],
        };
      }

      logger.info('[CleanupContentHistoryOnArchive] Found history records', {
        topicId,
        recordsCount: historyRecords.length,
      });

      // Step 2: Delete files from Storage first
      const storageResults = await this.deleteStorageFiles(historyRecords);

      // Step 3: Delete records from content_history table
      const dbResults = await this.deleteHistoryRecords(topicId);

      const errors = [...storageResults.errors, ...dbResults.errors];

      logger.info('[CleanupContentHistoryOnArchive] Cleanup completed', {
        topicId,
        deletedFromStorage: storageResults.deleted,
        deletedFromDatabase: dbResults.deleted,
        errorsCount: errors.length,
      });

      return {
        success: errors.length === 0,
        deletedFromStorage: storageResults.deleted,
        deletedFromDatabase: dbResults.deleted,
        errors: errors,
      };
    } catch (error) {
      logger.error('[CleanupContentHistoryOnArchive] Failed to cleanup topic history', {
        topicId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Cleanup content history for all topics in a course
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupCourseHistory(courseId) {
    if (!courseId || typeof courseId !== 'number') {
      throw new Error('courseId must be a valid number');
    }

    try {
      logger.info('[CleanupContentHistoryOnArchive] Starting cleanup for course', {
        courseId,
      });

      // Step 1: Get all topic IDs for this course
      const topicIds = await this.getCourseTopicIds(courseId);

      if (topicIds.length === 0) {
        logger.info('[CleanupContentHistoryOnArchive] No topics found for course', {
          courseId,
        });
        return {
          success: true,
          topicsProcessed: 0,
          deletedFromStorage: 0,
          deletedFromDatabase: 0,
          errors: [],
        };
      }

      logger.info('[CleanupContentHistoryOnArchive] Found topics for course', {
        courseId,
        topicsCount: topicIds.length,
      });

      // Step 2: Cleanup history for each topic
      let totalDeletedFromStorage = 0;
      let totalDeletedFromDatabase = 0;
      const allErrors = [];

      for (const topicId of topicIds) {
        try {
          const result = await this.cleanupTopicHistory(topicId);
          totalDeletedFromStorage += result.deletedFromStorage;
          totalDeletedFromDatabase += result.deletedFromDatabase;
          allErrors.push(...result.errors);
        } catch (topicError) {
          logger.error('[CleanupContentHistoryOnArchive] Failed to cleanup topic', {
            courseId,
            topicId,
            error: topicError.message,
          });
          allErrors.push({
            topicId,
            error: topicError.message,
          });
        }
      }

      logger.info('[CleanupContentHistoryOnArchive] Course cleanup completed', {
        courseId,
        topicsProcessed: topicIds.length,
        deletedFromStorage: totalDeletedFromStorage,
        deletedFromDatabase: totalDeletedFromDatabase,
        errorsCount: allErrors.length,
      });

      return {
        success: allErrors.length === 0,
        topicsProcessed: topicIds.length,
        deletedFromStorage: totalDeletedFromStorage,
        deletedFromDatabase: totalDeletedFromDatabase,
        errors: allErrors,
      };
    } catch (error) {
      logger.error('[CleanupContentHistoryOnArchive] Failed to cleanup course history', {
        courseId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get all content_history records for a topic
   * @param {number} topicId - Topic ID
   * @returns {Promise<Array>} History records
   */
  async getTopicHistoryRecords(topicId) {
    await db.ready;

    const query = `
      SELECT 
        history_id,
        content_id,
        topic_id,
        content_type_id,
        content_data,
        version_number
      FROM content_history
      WHERE topic_id = $1
        AND deleted_at IS NULL
    `;

    const result = await db.query(query, [topicId]);
    return result.rows || [];
  }

  /**
   * Get all topic IDs for a course
   * @param {number} courseId - Course ID
   * @returns {Promise<Array<number>>} Topic IDs
   */
  async getCourseTopicIds(courseId) {
    await db.ready;

    const query = `
      SELECT topic_id
      FROM topics
      WHERE course_id = $1
    `;

    const result = await db.query(query, [courseId]);
    return result.rows.map(row => row.topic_id);
  }

  /**
   * Delete files from Storage based on content_history records
   * @param {Array} historyRecords - History records
   * @returns {Promise<Object>} Deletion results
   */
  async deleteStorageFiles(historyRecords) {
    const deleted = [];
    const errors = [];

    for (const record of historyRecords) {
      try {
        const contentData = typeof record.content_data === 'string'
          ? JSON.parse(record.content_data)
          : record.content_data;

        if (!contentData || typeof contentData !== 'object') {
          continue;
        }

        // Extract storage paths from various fields
        const storagePaths = this.extractStoragePaths(contentData, record.content_type_id);

        for (const storagePath of storagePaths) {
          try {
            if (this.storageService.isConfigured()) {
              await this.storageService.deleteFileFromStorage(storagePath);
              deleted.push({
                historyId: record.history_id,
                storagePath,
                contentTypeId: record.content_type_id,
              });
              logger.info('[CleanupContentHistoryOnArchive] Deleted file from storage', {
                historyId: record.history_id,
                storagePath,
              });
            }
          } catch (deleteError) {
            logger.warn('[CleanupContentHistoryOnArchive] Failed to delete file from storage', {
              historyId: record.history_id,
              storagePath,
              error: deleteError.message,
            });
            errors.push({
              historyId: record.history_id,
              storagePath,
              error: deleteError.message,
            });
          }
        }
      } catch (parseError) {
        logger.warn('[CleanupContentHistoryOnArchive] Failed to parse content_data', {
          historyId: record.history_id,
          error: parseError.message,
        });
        errors.push({
          historyId: record.history_id,
          error: `Failed to parse content_data: ${parseError.message}`,
        });
      }
    }

    return {
      deleted: deleted.length,
      errors,
    };
  }

  /**
   * Extract storage paths from content_data
   * @param {Object} contentData - Content data
   * @param {number} contentTypeId - Content type ID
   * @returns {Array<string>} Storage paths
   */
  extractStoragePaths(contentData, contentTypeId) {
    const paths = [];

    // Avatar video (type 6) - check storagePath, videoUrl, storageUrl
    if (contentTypeId === 6) {
      if (contentData.storagePath) {
        paths.push(contentData.storagePath);
      }
      if (contentData.videoUrl && contentData.videoUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.videoUrl);
        if (path) paths.push(path);
      }
      if (contentData.storageUrl && contentData.storageUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.storageUrl);
        if (path) paths.push(path);
      }
      // Check metadata
      if (contentData.metadata?.storagePath) {
        paths.push(contentData.metadata.storagePath);
      }
    }

    // Presentation (type 3) - check presentationUrl, fileUrl, googleSlidesUrl
    if (contentTypeId === 3) {
      if (contentData.presentationUrl && contentData.presentationUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.presentationUrl);
        if (path) paths.push(path);
      }
      if (contentData.fileUrl && contentData.fileUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.fileUrl);
        if (path) paths.push(path);
      }
      if (contentData.googleSlidesUrl && contentData.googleSlidesUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.googleSlidesUrl);
        if (path) paths.push(path);
      }
    }

    // Audio (type 4) - check audioUrl
    if (contentTypeId === 4) {
      if (contentData.audioUrl && contentData.audioUrl.includes('/storage/v1/object/public/')) {
        const path = this.extractPathFromSupabaseUrl(contentData.audioUrl);
        if (path) paths.push(path);
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Extract storage path from Supabase public URL
   * @param {string} url - Supabase URL
   * @returns {string|null} Storage path
   */
  extractPathFromSupabaseUrl(url) {
    try {
      if (!url || typeof url !== 'string') {
        return null;
      }

      // Format: https://xxx.supabase.co/storage/v1/object/public/BUCKET_NAME/path/to/file
      // Example: https://xxx.supabase.co/storage/v1/object/public/media/avatar_videos/file.mp4
      // We need to extract: avatar_videos/file.mp4 (without bucket name)
      
      // Match pattern: /storage/v1/object/public/BUCKET_NAME/path/to/file
      const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
      if (match && match[1]) {
        const extractedPath = match[1];
        // Decode URL encoding if present
        try {
          return decodeURIComponent(extractedPath);
        } catch {
          return extractedPath;
        }
      }
      
      // Alternative: if URL already contains just the path (without domain)
      if (url.startsWith('avatar_videos/') || url.includes('/')) {
        return url;
      }
      
      return null;
    } catch (error) {
      logger.warn('[CleanupContentHistoryOnArchive] Failed to extract path from URL', {
        url: url?.substring(0, 100),
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Delete history records from database
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Deletion results
   */
  async deleteHistoryRecords(topicId) {
    await db.ready;

    try {
      // Soft delete: set deleted_at timestamp
      const query = `
        UPDATE content_history
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE topic_id = $1
          AND deleted_at IS NULL
      `;

      const result = await db.query(query, [topicId]);

      logger.info('[CleanupContentHistoryOnArchive] Deleted history records from database', {
        topicId,
        deletedCount: result.rowCount || 0,
      });

      return {
        deleted: result.rowCount || 0,
        errors: [],
      };
    } catch (error) {
      logger.error('[CleanupContentHistoryOnArchive] Failed to delete history records', {
        topicId,
        error: error.message,
      });
      return {
        deleted: 0,
        errors: [{
          topicId,
          error: error.message,
        }],
      };
    }
  }
}

