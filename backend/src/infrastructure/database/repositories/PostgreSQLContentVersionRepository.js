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
    this.supportsVersionNumber = undefined;
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

  async ensureVersionNumberSupport() {
    if (this.supportsVersionNumber !== undefined) {
      return this.supportsVersionNumber;
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
          AND column_name = 'version_number'
      ) AS has_column
    `;

    try {
      const result = await this.db.query(query);
      this.supportsVersionNumber = Boolean(result.rows?.[0]?.has_column);
    } catch (error) {
      console.warn('[PostgreSQLContentVersionRepository] Unable to detect version_number column, assuming absent.', error.message);
      this.supportsVersionNumber = false;
    }

    return this.supportsVersionNumber;
  }

  async create(version) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();
    const supportsVersionNumber = await this.ensureVersionNumberSupport();

    let topicId = version.topic_id || version.topicId;
    let contentTypeId = version.content_type_id || version.contentTypeId;
    let generationMethodId = version.generation_method_id || version.generationMethodId;

    if (!topicId || !contentTypeId) {
      throw new Error('topic_id and content_type_id are required to create a content history entry');
    }

    // Convert generation_method_id from string to integer ID if needed
    // The database expects INTEGER, but Content entity may have string (method_name)
    if (typeof generationMethodId === 'string') {
      try {
        const query = 'SELECT method_id FROM generation_methods WHERE method_name = $1';
        const result = await this.db.query(query, [generationMethodId]);
        if (result.rows.length === 0) {
          console.warn(`[PostgreSQLContentVersionRepository] Generation method not found: ${generationMethodId}, using default`);
          // Try to get default method_id (usually 'manual' = 1)
          const defaultResult = await this.db.query('SELECT method_id FROM generation_methods WHERE method_name = $1', ['manual']);
          generationMethodId = defaultResult.rows.length > 0 ? defaultResult.rows[0].method_id : 1;
        } else {
          generationMethodId = result.rows[0].method_id;
        }
      } catch (error) {
        console.error('[PostgreSQLContentVersionRepository] Failed to convert generation_method_id to integer:', error.message);
        // Fallback to default method_id
        generationMethodId = 1; // Default to 'manual' method_id
      }
    }

    const now = new Date();
    const baseColumns = [
      'topic_id',
      'content_type_id',
      'content_data',
      'generation_method_id',
      'created_at',
      'updated_at',
    ];

    // Add version_number only if column exists (for backward compatibility with old schemas)
    if (supportsVersionNumber) {
      baseColumns.splice(4, 0, 'version_number'); // Insert after generation_method_id
    }

    const columns = supportsDeletedAt
      ? [...baseColumns, 'deleted_at']
      : baseColumns;

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const values = [
      topicId,
      contentTypeId,
      typeof version.content_data === 'string'
        ? version.content_data
        : JSON.stringify(version.content_data),
      generationMethodId,
    ];

    // Add version_number value only if column exists
    if (supportsVersionNumber) {
      values.push(version.version_number || null); // For backward compatibility
    }

    values.push(version.created_at || now);
    values.push(version.updated_at || now);

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
        ORDER BY updated_at DESC, created_at DESC
      `
      : `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND content_type_id = $2
        ORDER BY updated_at DESC, created_at DESC
      `;

    const result = await this.db.query(query, [topicId, contentTypeId]);

    return result.rows.map(row => this.mapRowToContentVersion(row));
  }

  async findByTopic(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    const query = supportsDeletedAt
      ? `
        SELECT * FROM content_history 
        WHERE topic_id = $1
          AND deleted_at IS NULL
        ORDER BY content_type_id, updated_at DESC, created_at DESC
      `
      : `
        SELECT * FROM content_history 
        WHERE topic_id = $1
        ORDER BY content_type_id, updated_at DESC, created_at DESC
      `;

    const result = await this.db.query(query, [topicId]);

    return result.rows.map(row => this.mapRowToContentVersion(row));
  }

  async findCurrentVersion(topicId, contentTypeId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const supportsDeletedAt = await this.ensureDeletedAtSupport();

    const query = `
      SELECT * FROM content_history 
      WHERE topic_id = $1
        AND content_type_id = $2
        ${supportsDeletedAt ? 'AND deleted_at IS NULL' : ''}
      ORDER BY updated_at DESC, created_at DESC 
      LIMIT 1
    `;

    const result = await this.db.query(query, [topicId, contentTypeId]);

    if (result.rows.length === 0) {
      return null;
    }

    const version = this.mapRowToContentVersion(result.rows[0]);
    version.is_current_version = true;
    return version;
  }

  async getNextVersionNumber(topicId, contentTypeId) {
    // Deprecated: version_number is no longer used. This method is kept for backward compatibility
    // but returns null to indicate timestamps should be used instead.
    console.warn('[PostgreSQLContentVersionRepository] getNextVersionNumber is deprecated. Use timestamps for version tracking.');
    return null;
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

  async markAllAsNotCurrent() {
    // No-op: "current" is determined at read time by selecting the most recent timestamp.
  }

  /**
   * Map database row to ContentVersion entity
   * @param {Object} row - Database row
   * @returns {ContentVersion} ContentVersion entity
   */
  mapRowToContentVersion(row) {
    return new ContentVersion({
      version_id: row.history_id, // Map history_id to version_id
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      generation_method_id: row.generation_method_id,
      version_number: row.version_number || null, // For backward compatibility
      content_data: typeof row.content_data === 'string' 
        ? JSON.parse(row.content_data) 
        : row.content_data,
      created_by: row.created_by || 'system',
      is_current_version: false, // Will be determined by findCurrentVersion
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
      deleted_at: row.deleted_at || null,
    });
  }
}



