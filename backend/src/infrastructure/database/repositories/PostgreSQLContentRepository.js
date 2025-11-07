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

  async create(content) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      INSERT INTO content (
        topic_id, content_type_id, generation_method_id,
        content_data, quality_check_status, quality_check_data,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      content.topic_id,
      content.content_type_id,
      content.generation_method_id || 'manual',
      JSON.stringify(content.content_data),
      content.quality_check_status || 'pending',
      content.quality_check_data ? JSON.stringify(content.quality_check_data) : null,
      content.status || 'active',
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToContent(row);
  }

  async findById(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM content WHERE content_id = $1 AND status != $2';
    const result = await this.db.query(query, [contentId, 'deleted']);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToContent(result.rows[0]);
  }

  async findAllByTopicId(topicId, filters = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM content WHERE topic_id = $1 AND status != $2';
    const params = [topicId, 'deleted'];
    let paramIndex = 3;

    if (filters.content_type_id) {
      query += ` AND content_type_id = $${paramIndex}`;
      params.push(filters.content_type_id);
      paramIndex++;
    }

    if (filters.generation_method_id) {
      query += ` AND generation_method_id = $${paramIndex}`;
      params.push(filters.generation_method_id);
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

    // Soft delete
    return await this.update(contentId, { status: 'deleted' });
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



