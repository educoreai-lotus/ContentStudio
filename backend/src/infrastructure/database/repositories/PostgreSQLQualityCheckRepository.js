import { QualityCheck } from '../../../domain/entities/QualityCheck.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Quality Check Repository Implementation
 * 
 * Note: Quality checks are stored in the content table's quality_check_data JSONB field
 * This repository provides an abstraction layer for managing quality checks
 */
export class PostgreSQLQualityCheckRepository {
  constructor() {
    this.db = db;
  }

  async create(qualityCheck) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Quality checks are stored in content.quality_check_data
    // We need to update the content record
    const query = `
      UPDATE content 
      SET 
        quality_check_status = $1,
        quality_check_data = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE content_id = $3
      RETURNING *
    `;

    const qualityCheckData = {
      quality_check_id: qualityCheck.quality_check_id || null,
      content_id: qualityCheck.content_id,
      check_type: qualityCheck.check_type,
      status: qualityCheck.status,
      results: qualityCheck.results || {},
      overall_score: qualityCheck.score || qualityCheck.overall_score || null,
      created_at: qualityCheck.created_at || new Date(),
      completed_at: qualityCheck.completed_at || null,
      error_message: qualityCheck.error_message || null,
    };

    const values = [
      qualityCheck.status,
      JSON.stringify(qualityCheckData),
      qualityCheck.content_id,
    ];

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Content with id ${qualityCheck.content_id} not found`);
    }

    // Return QualityCheck entity
    return this.mapContentRowToQualityCheck(result.rows[0]);
  }

  async findById(qualityCheckId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Search in all content records for quality_check_data with matching ID
    const query = `
      SELECT * FROM content 
      WHERE quality_check_data->>'quality_check_id' = $1::text
      LIMIT 1
    `;
    const result = await this.db.query(query, [qualityCheckId.toString()]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapContentRowToQualityCheck(result.rows[0]);
  }

  async findByContentId(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM content WHERE content_id = $1';
    const result = await this.db.query(query, [contentId]);

    if (result.rows.length === 0) {
      return [];
    }

    const content = result.rows[0];
    
    // If quality_check_data exists, return it as QualityCheck
    if (content.quality_check_data) {
      return [this.mapContentRowToQualityCheck(content)];
    }

    return [];
  }

  async findLatestByContentId(contentId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const checks = await this.findByContentId(contentId);
    return checks.length > 0 ? checks[0] : null;
  }

  async findAll(filters = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM content WHERE quality_check_data IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    if (filters.content_id) {
      query += ` AND content_id = $${paramIndex}`;
      params.push(filters.content_id);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND quality_check_status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.check_type) {
      query += ` AND quality_check_data->>'check_type' = $${paramIndex}::text`;
      params.push(filters.check_type);
      paramIndex++;
    }

    query += ' ORDER BY updated_at DESC';

    const result = await this.db.query(query, params);

    return result.rows
      .filter(row => row.quality_check_data) // Only rows with quality check data
      .map(row => this.mapContentRowToQualityCheck(row));
  }

  /**
   * Map content row to QualityCheck entity
   * @param {Object} row - Content database row
   * @returns {QualityCheck} QualityCheck entity
   */
  mapContentRowToQualityCheck(row) {
    const qualityCheckData = typeof row.quality_check_data === 'string'
      ? JSON.parse(row.quality_check_data)
      : row.quality_check_data;

    // If quality_check_data doesn't exist, create a basic structure
    if (!qualityCheckData) {
      return new QualityCheck({
        quality_check_id: null,
        content_id: row.content_id,
        check_type: 'general',
        status: row.quality_check_status || 'pending',
        results: {},
        overall_score: null,
        created_at: row.created_at,
        completed_at: null,
        error_message: null,
      });
    }

    return new QualityCheck({
      quality_check_id: qualityCheckData.quality_check_id || null,
      content_id: row.content_id,
      check_type: qualityCheckData.check_type || 'general',
      status: row.quality_check_status || qualityCheckData.status || 'pending',
      results: qualityCheckData.results || {},
      score: qualityCheckData.overall_score || qualityCheckData.score || null,
      created_at: qualityCheckData.created_at || row.created_at,
      completed_at: qualityCheckData.completed_at || null,
      error_message: qualityCheckData.error_message || null,
    });
  }
}

