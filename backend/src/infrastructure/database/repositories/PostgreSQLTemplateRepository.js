import { TemplateRepository as ITemplateRepository } from '../../../domain/repositories/TemplateRepository.js';
import { Template } from '../../../domain/entities/Template.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Template Repository Implementation
 */
export class PostgreSQLTemplateRepository extends ITemplateRepository {
  constructor() {
    super();
    this.db = db;
  }

  async create(template) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      INSERT INTO templates (
        template_name, template_type, description, notes,
        format_order, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      template.template_name,
      template.template_type || 'manual',
      template.description || null,
      template.notes || null,
      JSON.stringify(template.format_order || []),
      template.created_by,
      template.is_active !== undefined ? template.is_active : true,
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToTemplate(row);
  }

  async findById(templateId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM templates WHERE template_id = $1';
    const result = await this.db.query(query, [templateId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplate(result.rows[0]);
  }

  async findAll(filters = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM templates WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.template_type) {
      query += ` AND template_type = $${paramIndex}`;
      params.push(filters.template_type);
      paramIndex++;
    }

    if (filters.created_by) {
      query += ` AND created_by = $${paramIndex}`;
      params.push(filters.created_by);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  async update(templateId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const allowedFields = [
      'template_name',
      'template_type',
      'description',
      'notes',
      'format_order',
      'is_active',
      'usage_count',
    ];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'format_order') {
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
      return await this.findById(templateId);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(templateId);

    const query = `
      UPDATE templates
      SET ${setClauses.join(', ')}
      WHERE template_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplate(result.rows[0]);
  }

  async delete(templateId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Soft delete by deactivating
    return await this.update(templateId, { is_active: false });
  }

  /**
   * Map database row to Template entity
   * @param {Object} row - Database row
   * @returns {Template} Template entity
   */
  mapRowToTemplate(row) {
    return new Template({
      template_id: row.template_id,
      template_name: row.template_name,
      template_type: row.template_type,
      description: row.description,
      notes: row.notes,
      format_order: typeof row.format_order === 'string'
        ? JSON.parse(row.format_order)
        : row.format_order || [],
      created_by: row.created_by,
      is_active: row.is_active,
      usage_count: row.usage_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}



