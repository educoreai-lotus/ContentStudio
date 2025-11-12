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

    return this.mapRowToContent(row);
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

    return this.mapRowToContent(result.rows[0]);
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
    return result.rows.map(row => this.mapRowToContent(row));
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

    return this.mapRowToContent(result.rows[0]);
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
    return this.mapRowToContent(result.rows[0]);
  }

  async delete(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    console.log(`[PostgreSQLContentRepository] Deleting content_id=${contentId}`);

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const getQuery = 'SELECT * FROM content WHERE content_id = $1';
      const getResult = await client.query(getQuery, [contentId]);

      if (getResult.rows.length === 0) {
        throw new Error(`Content with id ${contentId} not found`);
      }

      const content = getResult.rows[0];

      await this.saveRowToHistory(content, client);
      console.log(`[PostgreSQLContentRepository] Archived content_id=${contentId} → content_history (topic_id=${content.topic_id}, type_id=${content.content_type_id})`);

      if (content.content_type_id === 3 && content.content_data?.storagePath) {
        try {
          if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            await supabase.storage
              .from('media')
              .remove([content.content_data.storagePath]);
            
            console.log(`Deleted file from storage: ${content.content_data.storagePath}`);
          } else {
            console.warn('Supabase not configured, skipping file deletion from storage');
          }
        } catch (storageError) {
          console.error('Failed to delete file from storage:', storageError);
        }
      }

      const deleteQuery = 'DELETE FROM content WHERE content_id = $1';
      await client.query(deleteQuery, [contentId]);

      await client.query('COMMIT');

      console.log(`[PostgreSQLContentRepository] Deleted content_id=${contentId} from content`);
      console.log(`✅ History entry created once successfully.`);

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
    const { ContentDataCleaner } = await import('../../application/utils/ContentDataCleaner.js');
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
  mapRowToContent(row) {
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

    return new Content({
      content_id: row.content_id,
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      generation_method_id: row.generation_method_id,
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



