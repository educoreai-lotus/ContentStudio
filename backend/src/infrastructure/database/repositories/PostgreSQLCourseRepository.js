import { CourseRepository as ICourseRepository } from '../../../domain/repositories/CourseRepository.js';
import { Course } from '../../../domain/entities/Course.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Course Repository Implementation
 */
export class PostgreSQLCourseRepository extends ICourseRepository {
  constructor() {
    super();
    this.db = db;
  }

  async create(course) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      INSERT INTO trainer_courses (
        course_name, trainer_id, description, skills, language, status, company_logo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      course.course_name,
      course.trainer_id,
      course.description || null,
      course.skills || [],
      course.language || 'en',
      course.status || 'active',
      course.company_logo || null,
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToCourse(row);
  }

  async findById(courseId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM trainer_courses WHERE course_id = $1 AND status != $2';
    const result = await this.db.query(query, [courseId, 'deleted']);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCourse(result.rows[0]);
  }

  async findAll(filters = {}, pagination = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM trainer_courses WHERE status != $1';
    const params = ['deleted'];
    let paramIndex = 2;

    // Apply filters
    if (filters.trainer_id) {
      query += ` AND trainer_id = $${paramIndex}`;
      params.push(filters.trainer_id);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    // Apply pagination
    const limit = pagination.limit || 10;
    const offset = (pagination.page - 1) * limit || 0;

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToCourse(row));
  }

  async update(courseId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const allowedFields = ['course_name', 'description', 'skills', 'language', 'status', 'company_logo'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      return await this.findById(courseId);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(courseId);

    const query = `
      UPDATE trainer_courses
      SET ${setClauses.join(', ')}
      WHERE course_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCourse(result.rows[0]);
  }

  async delete(courseId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Soft delete
    return await this.update(courseId, { status: 'deleted' });
  }

  /**
   * Map database row to Course entity
   * @param {Object} row - Database row
   * @returns {Course} Course entity
   */
  mapRowToCourse(row) {
    return new Course({
      course_id: row.course_id,
      course_name: row.course_name,
      trainer_id: row.trainer_id,
      description: row.description,
      skills: row.skills || [],
      language: row.language || 'en',
      status: row.status,
      company_logo: row.company_logo,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}



