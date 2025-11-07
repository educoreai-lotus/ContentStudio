import { ContentVersionRepository as IContentVersionRepository } from '../../../domain/repositories/ContentVersionRepository.js';
import { ContentVersion } from '../../../domain/entities/ContentVersion.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Content Version Repository Implementation
 */
export class PostgreSQLContentVersionRepository extends IContentVersionRepository {
  constructor() {
    super();
    this.db = db;
  }

  async create(version) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Get next version number if not provided
    if (!version.version_number) {
      version.version_number = await this.getNextVersionNumber(version.content_id);
    }

    const query = `
      INSERT INTO content_history (
        content_id, topic_id, content_type_id,
        version_number, content_data, generation_method_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    // Get content to get topic_id and content_type_id
    const contentQuery = 'SELECT topic_id, content_type_id, generation_method_id FROM content WHERE content_id = $1';
    const contentResult = await this.db.query(contentQuery, [version.content_id]);
    
    if (contentResult.rows.length === 0) {
      throw new Error(`Content with id ${version.content_id} not found`);
    }

    const content = contentResult.rows[0];

    const values = [
      version.content_id,
      content.topic_id,
      content.content_type_id,
      version.version_number,
      typeof version.content_data === 'string' 
        ? version.content_data 
        : JSON.stringify(version.content_data),
      content.generation_method_id,
      version.created_at || new Date(),
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToContentVersion(row);
  }

  async findById(versionId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM content_history WHERE history_id = $1';
    const result = await this.db.query(query, [versionId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToContentVersion(result.rows[0]);
  }

  async findByContentId(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      SELECT * FROM content_history 
      WHERE content_id = $1 
      ORDER BY version_number DESC
    `;
    const result = await this.db.query(query, [contentId]);

    return result.rows.map(row => this.mapRowToContentVersion(row));
  }

  async findCurrentVersion(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Get the latest version (highest version_number)
    const query = `
      SELECT * FROM content_history 
      WHERE content_id = $1 
      ORDER BY version_number DESC 
      LIMIT 1
    `;
    const result = await this.db.query(query, [contentId]);

    if (result.rows.length === 0) {
      return null;
    }

    const version = this.mapRowToContentVersion(result.rows[0]);
    version.is_current_version = true; // Latest version is current
    return version;
  }

  async getNextVersionNumber(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      SELECT MAX(version_number) as max_version 
      FROM content_history 
      WHERE content_id = $1
    `;
    const result = await this.db.query(query, [contentId]);

    if (result.rows.length === 0 || !result.rows[0].max_version) {
      return 1;
    }

    return result.rows[0].max_version + 1;
  }

  async update(versionId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Note: content_history is typically append-only, but we can update metadata
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.change_description !== undefined) {
      setClause.push(`change_description = $${paramIndex}`);
      values.push(updates.change_description);
      paramIndex++;
    }

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(versionId);
    const query = `
      UPDATE content_history 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE history_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Version with id ${versionId} not found`);
    }

    return this.mapRowToContentVersion(result.rows[0]);
  }

  /**
   * Map database row to ContentVersion entity
   * @param {Object} row - Database row
   * @returns {ContentVersion} ContentVersion entity
   */
  mapRowToContentVersion(row) {
    return new ContentVersion({
      version_id: row.history_id, // Map history_id to version_id
      content_id: row.content_id,
      version_number: row.version_number,
      content_data: typeof row.content_data === 'string' 
        ? JSON.parse(row.content_data) 
        : row.content_data,
      created_by: row.created_by || 'system',
      is_current_version: false, // Will be determined by findCurrentVersion
      change_description: row.change_description || null,
      parent_version_id: row.parent_version_id || null,
      created_at: row.created_at,
    });
  }
}



