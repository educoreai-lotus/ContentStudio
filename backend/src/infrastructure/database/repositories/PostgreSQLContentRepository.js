import { ContentRepository as IContentRepository } from '../../../domain/repositories/ContentRepository.js';
import { Content } from '../../../domain/entities/Content.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Content Repository Implementation
 */
export class PostgreSQLContentRepository extends IContentRepository {
  constructor() {
    super();
    this.db = db;
    this.supportsStatusColumn = undefined;
  }

  async ensureStatusSupport() {
    if (this.supportsStatusColumn !== undefined) {
      return this.supportsStatusColumn;
    }

    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'content'
          AND column_name = 'status'
      ) AS has_column
    `;

    try {
      const result = await this.db.query(query);
      this.supportsStatusColumn = Boolean(result.rows?.[0]?.has_column);
    } catch (error) {
      console.warn('[PostgreSQLContentRepository] Unable to detect status column, assuming absent.', error.message);
      this.supportsStatusColumn = false;
    }

    return this.supportsStatusColumn;
  }

  /**
   * Get type_id from type_name
   */
  async getContentTypeId(typeName) {
    const query = 'SELECT type_id FROM content_types WHERE type_name = $1';
    const result = await this.db.query(query, [typeName]);
    if (result.rows.length === 0) {
      throw new Error(`Content type not found: ${typeName}`);
    }
    return result.rows[0].type_id;
  }

  /**
   * Retrieve a map of content type IDs to names
   * @param {number[]} typeIds
   * @returns {Promise<Map<number, string>>}
   */
  async getContentTypeNamesByIds(typeIds = []) {
    const map = new Map();
    if (!typeIds || typeIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(typeIds)].filter(id => Number.isInteger(id));
    if (uniqueIds.length === 0) {
      return map;
    }

    const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT type_id, type_name FROM content_types WHERE type_id IN (${placeholders})`;
    const result = await this.db.query(query, uniqueIds);
    result.rows.forEach(row => {
      map.set(row.type_id, row.type_name);
    });
    return map;
  }

  /**
   * Get method_id from method_name
   */
  async getGenerationMethodId(methodName) {
    const query = 'SELECT method_id FROM generation_methods WHERE method_name = $1';
    const result = await this.db.query(query, [methodName]);
    if (result.rows.length === 0) {
      throw new Error(`Generation method not found: ${methodName}`);
    }
    return result.rows[0].method_id;
  }

  /**
   * Get method_name from method_id
   * @param {number} methodId - Generation method ID
   * @returns {Promise<string|null>} Method name or null if not found
   */
  async getGenerationMethodName(methodId) {
    const query = 'SELECT method_name FROM generation_methods WHERE method_id = $1';
    const result = await this.db.query(query, [methodId]);
    if (result.rows.length === 0) {
      // If not found, return null (don't return the ID)
      return null;
    }
    return result.rows[0].method_name;
  }

  /**
   * Increment usage_count for a generation method
   * @param {number|string} methodIdOrName - Generation method ID or name
   * @returns {Promise<void>}
   */
  async incrementGenerationMethodUsageCount(methodIdOrName) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected.');
    }

    // Determine if we have an ID or name
    let methodId;
    if (typeof methodIdOrName === 'string' && isNaN(Number(methodIdOrName))) {
      // It's a method name, get the ID
      methodId = await this.getGenerationMethodId(methodIdOrName);
    } else {
      // It's already an ID
      methodId = methodIdOrName;
    }

    const query = `
      UPDATE generation_methods 
      SET usage_count = usage_count + 1
      WHERE method_id = $1
    `;

    await this.db.query(query, [methodId]);
  }

  async create(content) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Convert type_name and method_name to IDs
    const contentTypeId = typeof content.content_type_id === 'string'
      ? await this.getContentTypeId(content.content_type_id)
      : content.content_type_id;

    const generationMethodId = typeof content.generation_method_id === 'string'
      ? await this.getGenerationMethodId(content.generation_method_id || 'manual')
      : content.generation_method_id;

    const query = `
      INSERT INTO content (
        topic_id, content_type_id, generation_method_id,
        content_data, quality_check_status, quality_check_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    // Log content_data before saving
    console.log('[PostgreSQLContentRepository] Saving content_data:', {
      type: typeof content.content_data,
      isString: typeof content.content_data === 'string',
      value: content.content_data,
    });

    const values = [
      content.topic_id,
      contentTypeId,
      generationMethodId,
      typeof content.content_data === 'string' 
        ? content.content_data  // Already a JSON string, don't stringify again
        : JSON.stringify(content.content_data),
      content.quality_check_status || 'pending',
      content.quality_check_data ? JSON.stringify(content.quality_check_data) : null,
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    // Increment usage_count for the generation method
    try {
      await this.incrementGenerationMethodUsageCount(generationMethodId);
    } catch (error) {
      console.warn('[PostgreSQLContentRepository] Failed to increment generation method usage count:', error.message);
      // Don't fail the entire operation if usage count increment fails
    }

    return await this.mapRowToContent(row);
  }

  async findById(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM content WHERE content_id = $1';
    const result = await this.db.query(query, [contentId]);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.mapRowToContent(result.rows[0]);
  }

  async findAllByTopicId(topicId, filters = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM content WHERE topic_id = $1';
    const params = [topicId];
    let paramIndex = 2;

    const supportsStatus = await this.ensureStatusSupport();

    if (!filters.includeArchived) {
      if (supportsStatus) {
        query += ` AND (status IS NULL OR status != $${paramIndex})`;
        params.push('archived');
        paramIndex++;
      } else {
        query += ` AND (quality_check_status IS NULL OR quality_check_status != $${paramIndex})`;
        params.push('deleted');
        paramIndex++;
      }
    }

    if (filters.content_type_id) {
      // Convert type_name to type_id if it's a string
      const contentTypeId = typeof filters.content_type_id === 'string'
        ? await this.getContentTypeId(filters.content_type_id)
        : filters.content_type_id;
      
      query += ` AND content_type_id = $${paramIndex}`;
      params.push(contentTypeId);
      paramIndex++;
    }

    if (filters.generation_method_id) {
      // Convert method_name to method_id if it's a string
      const generationMethodId = typeof filters.generation_method_id === 'string'
        ? await this.getGenerationMethodId(filters.generation_method_id)
        : filters.generation_method_id;
      
      query += ` AND generation_method_id = $${paramIndex}`;
      params.push(generationMethodId);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return await Promise.all(result.rows.map(row => this.mapRowToContent(row)));
  }

  async update(contentId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const allowedFields = [
      'content_data',
      'quality_check_status',
      'quality_check_data',
      'status',
      'generation_method_id',
    ];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates)) {
      if (!allowedFields.includes(key) || updates[key] === undefined) {
        continue;
      }

      if (key === 'content_data' || key === 'quality_check_data') {
        setClauses.push(`${key} = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(updates[key]));
      } else if (key === 'generation_method_id') {
        const generationMethodId =
          typeof updates[key] === 'string'
            ? await this.getGenerationMethodId(updates[key])
            : updates[key];
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(generationMethodId);
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return await this.findById(contentId);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(contentId);

    const query = `
      UPDATE content
      SET ${setClauses.join(', ')}
      WHERE content_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.mapRowToContent(result.rows[0]);
  }

  async findLatestByTopicAndType(topicId, contentTypeIdOrName) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let contentTypeId = contentTypeIdOrName;
    if (typeof contentTypeIdOrName === 'string') {
      if (/^\d+$/.test(contentTypeIdOrName)) {
        contentTypeId = parseInt(contentTypeIdOrName, 10);
      } else {
        contentTypeId = await this.getContentTypeId(contentTypeIdOrName);
      }
    }

    const supportsStatus = await this.ensureStatusSupport();

    const query = `
      SELECT * FROM content
      WHERE topic_id = $1
        AND content_type_id = $2
        ${supportsStatus
          ? "AND (status IS NULL OR status != 'archived')"
          : "AND (quality_check_status IS NULL OR quality_check_status != 'deleted')"}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [topicId, contentTypeId]);
    if (result.rows.length === 0) {
      return null;
    }
    return await this.mapRowToContent(result.rows[0]);
  }

  /**
   * Delete content from database
   * IMPORTANT: This method does NOT save to history - that must be done BEFORE calling this method
   * The ContentController.remove() method handles history saving before calling this method
   * @param {number} contentId - Content ID to delete
   * @param {boolean} skipHistoryCheck - If true, skip the history check (for cases where history was already saved)
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async delete(contentId, skipHistoryCheck = false) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    console.log(`[PostgreSQLContentRepository] Deleting content_id=${contentId}`, {
      skipHistoryCheck,
      note: skipHistoryCheck ? 'History should have been saved by ContentController before this call' : 'WARNING: History may not have been saved!',
    });

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const getQuery = 'SELECT * FROM content WHERE content_id = $1';
      const getResult = await client.query(getQuery, [contentId]);

      if (getResult.rows.length === 0) {
        throw new Error(`Content with id ${contentId} not found`);
      }

      const content = getResult.rows[0];

      // IMPORTANT: Only save to history if skipHistoryCheck is false
      // This is a safety net in case ContentController didn't save to history
      // But normally, ContentController should save to history BEFORE calling this method
      if (!skipHistoryCheck) {
        console.warn(`[PostgreSQLContentRepository] WARNING: History not saved before delete! Saving now as backup for content_id=${contentId}`);
        await this.saveRowToHistory(content, client);
        console.log(`[PostgreSQLContentRepository] Archived content_id=${contentId} → content_history (topic_id=${content.topic_id}, type_id=${content.content_type_id})`);
      } else {
        console.log(`[PostgreSQLContentRepository] Skipping history save (already saved by ContentController) for content_id=${contentId}`);
      }

      // Delete files from storage for all content types that use storage
      // This applies to: presentations (type 3), avatar videos (type 6), audio (type 4)
      const contentData = typeof content.content_data === 'string' 
        ? JSON.parse(content.content_data) 
        : content.content_data;

      // Try to extract storage path from various fields (storagePath, presentationUrl, fileUrl)
      let storagePathToDelete = null;
      if (contentData?.storagePath) {
        storagePathToDelete = contentData.storagePath;
      } else if (contentData?.presentationUrl && contentData.presentationUrl.includes('/storage/v1/object/public/')) {
        // Extract path from Supabase public URL: https://xxx.supabase.co/storage/v1/object/public/media/path/to/file
        const urlParts = contentData.presentationUrl.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          storagePathToDelete = urlParts[1];
        }
      } else if (contentData?.fileUrl && contentData.fileUrl.includes('/storage/v1/object/public/')) {
        // Extract path from Supabase public URL for avatar videos
        const urlParts = contentData.fileUrl.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          storagePathToDelete = urlParts[1];
        }
      }

      if (storagePathToDelete) {
        try {
          if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            // Determine bucket based on content type (all use 'media' bucket)
            const bucket = 'media';

            await supabase.storage
              .from(bucket)
              .remove([storagePathToDelete]);
            
            console.log(`[PostgreSQLContentRepository] Deleted file from storage: ${storagePathToDelete} (content_type_id=${content.content_type_id})`);
          } else {
            console.warn('[PostgreSQLContentRepository] Supabase not configured, skipping file deletion from storage');
          }
        } catch (storageError) {
          console.error('[PostgreSQLContentRepository] Failed to delete file from storage:', storageError);
          // Don't fail the entire deletion if storage deletion fails
        }
      }

      const deleteQuery = 'DELETE FROM content WHERE content_id = $1';
      await client.query(deleteQuery, [contentId]);

      await client.query('COMMIT');

      console.log(`[PostgreSQLContentRepository] Deleted content_id=${contentId} from content (content_type_id=${content.content_type_id})`);

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQLContentRepository] Delete failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveRowToHistory(contentRow, client = this.db) {
    if (!contentRow) return;

    const normalizedContentData =
      typeof contentRow.content_data === 'string'
        ? (() => {
            try {
              return JSON.parse(contentRow.content_data);
            } catch (parseError) {
              return { raw: contentRow.content_data };
            }
          })()
        : contentRow.content_data;

    // Clean content_data before saving to history to ensure consistency
    const { ContentDataCleaner } = await import('../../../application/utils/ContentDataCleaner.js');
    const cleanedContentData = ContentDataCleaner.clean(
      normalizedContentData,
      contentRow.content_type_id
    );

    const insertQuery = `
      INSERT INTO content_history (
        topic_id,
        content_type_id,
        content_data,
        generation_method_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
    `;

    await client.query(insertQuery, [
      contentRow.topic_id,
      contentRow.content_type_id,
      JSON.stringify(cleanedContentData),
      contentRow.generation_method_id,
    ]);
  }

  /**
   * Convert QualityCheck status to Content quality_check_status
   * Handles legacy statuses: 'processing', 'completed', 'failed'
   */
  normalizeQualityCheckStatus(status, qualityCheckData = {}) {
    if (!status) {
      return null;
    }

    // If already a valid Content status, return as-is
    if (['pending', 'approved', 'rejected', 'needs_revision'].includes(status)) {
      return status;
    }

    // Convert legacy QualityCheck statuses
    switch (status) {
      case 'processing':
        return 'pending';
      case 'completed':
        // Check if score is acceptable (>= 60)
        const score = qualityCheckData?.overall_score || qualityCheckData?.score;
        if (score !== null && score !== undefined) {
          return score >= 60 ? 'approved' : 'rejected';
        }
        return 'approved'; // Default to approved if completed without score
      case 'failed':
        return 'rejected';
      default:
        return 'pending'; // Default fallback
    }
  }

  /**
   * Map database row to Content entity
   * @param {Object} row - Database row
   * @returns {Content} Content entity
   */
  async mapRowToContent(row) {
    const qualityCheckData = row.quality_check_data
      ? (typeof row.quality_check_data === 'string'
          ? JSON.parse(row.quality_check_data)
          : row.quality_check_data)
      : null;

    // Normalize quality_check_status to ensure it's valid for Content entity
    const normalizedStatus = this.normalizeQualityCheckStatus(
      row.quality_check_status,
      qualityCheckData
    );

    // Convert generation_method_id from number to string if needed
    // CRITICAL: This conversion MUST succeed for needsQualityCheck() to work correctly
    let generationMethodId = row.generation_method_id;
    if (typeof generationMethodId === 'number') {
      try {
        const methodName = await this.getGenerationMethodName(generationMethodId);
        // If method name was found and is valid, use it
        if (methodName && typeof methodName === 'string') {
          // Validate that the method name is one of the allowed values
          const validMethods = ['manual', 'ai_assisted', 'ai_generated', 'manual_edited', 'video_to_lesson', 'full_ai_generated', 'Mixed'];
          if (validMethods.includes(methodName)) {
            generationMethodId = methodName;
          } else {
            // If method name is not valid, fallback to manual
            console.warn('[PostgreSQLContentRepository] Invalid method name from DB, using fallback:', {
              id: row.generation_method_id,
              name: methodName,
            });
            generationMethodId = 'manual';
          }
        } else if (methodName === generationMethodId) {
          // getGenerationMethodName returned the ID (not found in DB)
          // Check if it's a valid numeric ID (1-6)
          if (generationMethodId >= 1 && generationMethodId <= 6) {
            // Keep as number - it's valid (no assignment needed, already correct)
          } else {
            // Invalid ID, fallback to manual
            console.warn('[PostgreSQLContentRepository] Invalid generation_method_id, using fallback:', {
              id: row.generation_method_id,
            });
            generationMethodId = 'manual';
          }
        } else {
          // Unexpected case, fallback to manual
          console.warn('[PostgreSQLContentRepository] Unexpected generation_method_id format, using fallback:', {
            id: row.generation_method_id,
            returned: methodName,
          });
          generationMethodId = 'manual';
        }
      } catch (error) {
        console.error('[PostgreSQLContentRepository] CRITICAL: Failed to convert generation_method_id to name:', {
          id: row.generation_method_id,
          error: error.message,
        });
        // Fallback to manual instead of throwing - this allows the content to load
        generationMethodId = 'manual';
      }
    } else if (typeof generationMethodId === 'string') {
      // Already a string, validate it
      const validMethods = ['manual', 'ai_assisted', 'ai_generated', 'manual_edited', 'video_to_lesson', 'full_ai_generated', 'Mixed'];
      if (!validMethods.includes(generationMethodId)) {
        console.warn('[PostgreSQLContentRepository] Invalid string generation_method_id, using fallback:', {
          id: generationMethodId,
        });
        generationMethodId = 'manual';
      }
    } else if (!generationMethodId) {
      // Null or undefined, use default
      generationMethodId = 'manual';
    }

    return new Content({
      content_id: row.content_id,
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      generation_method_id: generationMethodId,
      content_data: typeof row.content_data === 'string' 
        ? JSON.parse(row.content_data) 
        : row.content_data,
      quality_check_status: normalizedStatus,
      quality_check_data: qualityCheckData,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}



