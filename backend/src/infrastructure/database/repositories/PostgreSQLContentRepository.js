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
    ];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'content_data' || key === 'quality_check_data') {
          setClauses.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(updates[key]));
        } else {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
        }
        paramIndex++;
      }
    });

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

  async delete(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    try {
      // First, get the content to check if we need to delete files from storage
      const getQuery = 'SELECT * FROM content WHERE content_id = $1';
      const getResult = await this.db.query(getQuery, [contentId]);

      if (getResult.rows.length === 0) {
        throw new Error(`Content with id ${contentId} not found`);
      }

      const content = getResult.rows[0];

      // If it's a presentation with a file in storage, delete it
      if (content.content_type_id === 3 && content.content_data?.storagePath) {
        try {
          // Only attempt storage deletion if Supabase is configured (using correct env var names)
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
          // Continue with DB deletion even if storage deletion fails
        }
      }

      // Hard delete from database
      const deleteQuery = 'DELETE FROM content WHERE content_id = $1 RETURNING *';
      const result = await this.db.query(deleteQuery, [contentId]);

      return true;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Map database row to Content entity
   * @param {Object} row - Database row
   * @returns {Content} Content entity
   */
  mapRowToContent(row) {
    return new Content({
      content_id: row.content_id,
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      generation_method_id: row.generation_method_id,
      content_data: typeof row.content_data === 'string' 
        ? JSON.parse(row.content_data) 
        : row.content_data,
      quality_check_status: row.quality_check_status,
      quality_check_data: row.quality_check_data
        ? (typeof row.quality_check_data === 'string'
            ? JSON.parse(row.quality_check_data)
            : row.quality_check_data)
        : null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}



