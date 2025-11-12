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

  /**
   * Convert QualityCheck status to Content quality_check_status
   * QualityCheck uses: 'pending', 'processing', 'completed', 'failed'
   * Content uses: 'pending', 'approved', 'rejected', 'needs_revision'
   * @param {string} qualityCheckStatus - Status from QualityCheck entity
   * @param {Object} qualityCheckData - Quality check data (may contain score, results, etc.)
   * @param {Object} updates - Optional updates object (may contain score, results, etc.)
   */
  convertQualityCheckStatusToContentStatus(qualityCheckStatus, qualityCheckData = {}, updates = {}) {
    if (!qualityCheckStatus) {
      return 'pending';
    }

    // Get score from updates first (most recent), then from qualityCheckData
    const score = updates.score || updates.overall_score || qualityCheckData.overall_score || qualityCheckData.score;

    switch (qualityCheckStatus) {
      case 'pending':
      case 'processing':
        return 'pending';
      case 'completed':
        // Check if score is acceptable (>= 60)
        if (score !== null && score !== undefined) {
          return score >= 60 ? 'approved' : 'rejected';
        }
        return 'approved'; // Default to approved if completed without score
      case 'failed':
        return 'rejected';
      default:
        // If it's already a Content status, return as-is
        if (['pending', 'approved', 'rejected', 'needs_revision'].includes(qualityCheckStatus)) {
          return qualityCheckStatus;
        }
        return 'pending';
    }
  }

  async create(qualityCheck) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Generate quality_check_id if not provided (use content_id as base for uniqueness)
    const qualityCheckId = qualityCheck.quality_check_id || `qc_${qualityCheck.content_id}_${Date.now()}`;

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
      quality_check_id: qualityCheckId,
      content_id: qualityCheck.content_id,
      check_type: qualityCheck.check_type,
      status: qualityCheck.status,
      results: qualityCheck.results || {},
      overall_score: qualityCheck.score || qualityCheck.overall_score || null,
      created_at: qualityCheck.created_at || new Date(),
      completed_at: qualityCheck.completed_at || null,
      error_message: qualityCheck.error_message || null,
    };

    // Convert QualityCheck status to Content status
    const contentStatus = this.convertQualityCheckStatusToContentStatus(
      qualityCheck.status,
      qualityCheckData,
      {} // No updates in create
    );

    const values = [
      contentStatus, // Use converted status for content table
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

  async update(qualityCheckId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Handle null or undefined quality_check_id
    if (!qualityCheckId) {
      // If content_id is in updates, use it directly
      if (updates.content_id) {
        const findQuery = `SELECT * FROM content WHERE content_id = $1 LIMIT 1`;
        const findResult = await this.db.query(findQuery, [updates.content_id]);
        if (findResult.rows.length === 0) {
          throw new Error(`Content with id ${updates.content_id} not found`);
        }
        const contentRow = findResult.rows[0];
        const existingQualityCheckData = typeof contentRow.quality_check_data === 'string'
          ? JSON.parse(contentRow.quality_check_data)
          : contentRow.quality_check_data || {};
        
        // Generate a new quality_check_id if it doesn't exist
        const newQualityCheckId = existingQualityCheckData.quality_check_id || `qc_${contentRow.content_id}_${Date.now()}`;
        const updatedQualityCheckData = {
          ...existingQualityCheckData,
          ...updates,
          quality_check_id: newQualityCheckId,
          content_id: contentRow.content_id,
        };

        const updateQuery = `
          UPDATE content 
          SET 
            quality_check_status = COALESCE($1, quality_check_status),
            quality_check_data = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE content_id = $3
          RETURNING *
        `;

        // Convert QualityCheck status to Content status
        const contentStatus = this.convertQualityCheckStatusToContentStatus(
          updates.status || contentRow.quality_check_status,
          updatedQualityCheckData,
          updates // Pass updates to check for score
        );

        const values = [
          contentStatus, // Use converted status for content table
          JSON.stringify(updatedQualityCheckData),
          contentRow.content_id,
        ];

        const result = await this.db.query(updateQuery, values);
        if (result.rows.length === 0) {
          throw new Error(`Content with id ${contentRow.content_id} not found`);
        }
        return this.mapContentRowToQualityCheck(result.rows[0]);
      }
      throw new Error('quality_check_id is required for update');
    }

    // Find the content record with this quality check ID
    // First try by quality_check_id in quality_check_data
    let findQuery = `
      SELECT * FROM content 
      WHERE quality_check_data->>'quality_check_id' = $1::text
      LIMIT 1
    `;
    let findParams = [qualityCheckId.toString()];
    
    let findResult = await this.db.query(findQuery, findParams);

    // If not found, try to find by content_id (fallback for cases where quality_check_id format differs)
    if (findResult.rows.length === 0) {
      // Try to extract content_id from quality_check_id if it follows the pattern qc_{content_id}_{timestamp}
      const match = qualityCheckId.toString().match(/^qc_(\d+)_/);
      if (match && match[1]) {
        findQuery = `SELECT * FROM content WHERE content_id = $1 LIMIT 1`;
        findParams = [parseInt(match[1])];
        findResult = await this.db.query(findQuery, findParams);
      }
    }

    if (findResult.rows.length === 0) {
      throw new Error(`Quality check with id ${qualityCheckId} not found`);
    }

    const contentRow = findResult.rows[0];
    const existingQualityCheckData = typeof contentRow.quality_check_data === 'string'
      ? JSON.parse(contentRow.quality_check_data)
      : contentRow.quality_check_data || {};

    // Merge updates with existing data
    const updatedQualityCheckData = {
      ...existingQualityCheckData,
      ...updates,
      quality_check_id: qualityCheckId,
      content_id: contentRow.content_id, // Ensure content_id is preserved
    };

    // Update the content record
    const updateQuery = `
      UPDATE content 
      SET 
        quality_check_status = COALESCE($1, quality_check_status),
        quality_check_data = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE content_id = $3
      RETURNING *
    `;

    // Convert QualityCheck status to Content status
    const contentStatus = this.convertQualityCheckStatusToContentStatus(
      updates.status || contentRow.quality_check_status,
      updatedQualityCheckData,
      updates // Pass updates to check for score
    );

    const values = [
      contentStatus, // Use converted status for content table
      JSON.stringify(updatedQualityCheckData),
      contentRow.content_id,
    ];

    const result = await this.db.query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new Error(`Content with id ${contentRow.content_id} not found`);
    }

    return this.mapContentRowToQualityCheck(result.rows[0]);
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

