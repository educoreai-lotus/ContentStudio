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
        template_name, template_type, created_by, format_order
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      template.template_name,
      template.template_type || 'manual',
      template.created_by,
      JSON.stringify(template.format_order || []),
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

    // If created_by is specified, filter by it
    // Otherwise, return ALL templates (system templates + trainer templates)
    if (filters.created_by) {
      query += ` AND created_by = $${paramIndex}`;
      params.push(filters.created_by);
      paramIndex++;
    }
    // If no created_by filter, return all templates (system + all trainers)

    query += ' ORDER BY created_at DESC';

    console.log('[PostgreSQLTemplateRepository] findAll query:', {
      query,
      params,
      filters,
    });

    const result = await this.db.query(query, params);
    
    console.log('[PostgreSQLTemplateRepository] findAll result:', {
      rowsCount: result.rows.length,
      templateIds: result.rows.map(r => r.template_id),
      createdByValues: result.rows.map(r => r.created_by),
    });

    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  async update(templateId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const allowedFields = ['template_name', 'template_type', 'format_order'];
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

    const query = 'DELETE FROM templates WHERE template_id = $1';
    await this.db.query(query, [templateId]);
    return true;
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
      format_order: typeof row.format_order === 'string'
        ? JSON.parse(row.format_order)
        : row.format_order || [],
      created_by: row.created_by,
      created_at: row.created_at,
    });
  }
}



