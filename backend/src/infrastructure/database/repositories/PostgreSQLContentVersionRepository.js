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
    this.supportsDeletedAt = undefined;
  }

  async ensureDeletedAtSupport() {
    if (this.supportsDeletedAt !== undefined) {
      return this.supportsDeletedAt;
    }

    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'content_history'
          AND column_name = 'deleted_at'
      ) AS has_column
    `;

    try {
      const result = await this.db.query(query);
      this.supportsDeletedAt = Boolean(result.rows?.[0]?.has_column);
    } catch (error) {
      console.warn('[PostgreSQLContentVersionRepository] Unable to detect deleted_at column, assuming absent.', error.message);
      this.supportsDeletedAt = false;
    }

    return this.supportsDeletedAt;
  }

  async create(version) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Get next version number if not provided
    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    const baseColumns = [
      'topic_id',
      'content_type_id',
      'version_number',
      'content_data',
      'generation_method_id',
      'created_at',
    ];

    const columns = supportsDeletedAt
      ? [...baseColumns, 'deleted_at']
      : baseColumns;

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    let topicId = version.topic_id || version.topicId;
    let contentTypeId = version.content_type_id || version.contentTypeId;
    let generationMethodId = version.generation_method_id || version.generationMethodId;

    const values = [
      topicId,
      contentTypeId,
      version.version_number,
      typeof version.content_data === 'string'
        ? version.content_data
        : JSON.stringify(version.content_data),
      generationMethodId,
      version.created_at || new Date(),
    ];

    if (supportsDeletedAt) {
      values.push(null);
    }

    const query = `
      INSERT INTO content_history (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

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

  async findByTopicAndType(topicId, contentTypeId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    const query = supportsDeletedAt
      ? `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND content_type_id = $2
          AND deleted_at IS NULL
        ORDER BY version_number DESC
      `
      : `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND content_type_id = $2
        ORDER BY version_number DESC
      `;

    const result = await this.db.query(query, [topicId, contentTypeId]);

    return result.rows.map(row => this.mapRowToContentVersion(row));
  }

  async findCurrentVersion(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    // Get the latest version (highest version_number)
    const query = supportsDeletedAt
      ? `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND content_type_id = $2 
          AND deleted_at IS NULL
        ORDER BY version_number DESC 
        LIMIT 1
      `
      : `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND content_type_id = $2 
        ORDER BY version_number DESC 
        LIMIT 1
      `;

    const result = await this.db.query(query, [contentId.topic_id, contentId.content_type_id]);

    if (result.rows.length === 0) {
      return null;
    }

    const version = this.mapRowToContentVersion(result.rows[0]);
    version.is_current_version = true; // Latest version is current
    return version;
  }

  async getNextVersionNumber(topicId, contentTypeId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      SELECT MAX(version_number) as max_version 
      FROM content_history 
      WHERE topic_id = $1
        AND content_type_id = $2
    `;
    const result = await this.db.query(query, [topicId, contentTypeId]);

    if (result.rows.length === 0 || !result.rows[0].max_version) {
      return 1;
    }

    return result.rows[0].max_version + 1;
  }

  async update() {
    throw new Error('Updating content history entries is not supported.');
  }

  async softDelete(versionId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    if (!supportsDeletedAt) {
      // Fall back to hard delete if column absent
      const deleteQuery = `
        DELETE FROM content_history
        WHERE history_id = $1
        RETURNING *
      `;
      const deleteResult = await this.db.query(deleteQuery, [versionId]);
      if (deleteResult.rows.length === 0) {
        throw new Error(`Version with id ${versionId} not found`);
      }
      return this.mapRowToContentVersion(deleteResult.rows[0]);
    }

    const query = `
      UPDATE content_history
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE history_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [versionId]);

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
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      generation_method_id: row.generation_method_id,
      version_number: row.version_number,
      content_data: typeof row.content_data === 'string' 
        ? JSON.parse(row.content_data) 
        : row.content_data,
      created_by: row.created_by || 'system',
      is_current_version: false, // Will be determined by findCurrentVersion
      created_at: row.created_at,
      deleted_at: row.deleted_at || null,
    });
  }
}



