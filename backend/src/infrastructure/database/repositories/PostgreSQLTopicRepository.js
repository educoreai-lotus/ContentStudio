import { TopicRepository as ITopicRepository } from '../../../domain/repositories/TopicRepository.js';
import { Topic } from '../../../domain/entities/Topic.js';
import { db } from '../DatabaseConnection.js';
import { logger } from '../../logging/Logger.js';

/**
 * PostgreSQL Topic Repository Implementation
 */
export class PostgreSQLTopicRepository extends ITopicRepository {
  constructor() {
    super();
    this.db = db;
  }

  async create(topic) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      INSERT INTO topics (
        topic_name, trainer_id, description, course_id, template_id,
        skills, language, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    // Language is required for standalone topics (course_id is null)
    // For topics in a course, language comes from the course
    const language = topic.course_id === null 
      ? (topic.language || 'en') // Standalone topic - use provided language or default to 'en'
      : (topic.language || null); // Topic in course - language comes from course, but can be overridden

    const values = [
      topic.topic_name,
      topic.trainer_id,
      topic.description || null,
      topic.course_id || null,
      topic.template_id || null,
      topic.skills || [],
      language,
      topic.status || 'active', // Changed from 'draft' - ENUM doesn't support draft
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToTopic(row);
  }

  async findById(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // CRITICAL: Only return active topics in regular queries
    const query = 'SELECT * FROM topics WHERE topic_id = $1 AND status = $2';
    const result = await this.db.query(query, [topicId, 'active']);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTopic(result.rows[0]);
  }

  /**
   * Find topic by ID including deleted topics
   * Used for restore operations where we need to update status from 'deleted' to 'active'
   * @param {number} topicId - Topic ID
   * @returns {Promise<Topic|null>} Topic entity or null if not found
   */
  async findByIdIncludingDeleted(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Return topic regardless of status (for restore operations)
    const query = 'SELECT * FROM topics WHERE topic_id = $1';
    const result = await this.db.query(query, [topicId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTopic(result.rows[0]);
  }

  async findAll(filters = {}, pagination = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // CRITICAL: Only return active topics in regular queries
    // History sidebar will query with status='deleted' explicitly
    let query;
    const params = [];
    let paramIndex = 1;

    // Determine status filter first
    if (filters.status && filters.status !== 'all') {
      // If requesting deleted, show only deleted (for History Sidebar)
      query = 'SELECT * FROM topics WHERE status = $1';
      params.push(filters.status);
      paramIndex = 2;
    } else {
      // Default: only active topics
      query = 'SELECT * FROM topics WHERE status = $1';
      params.push('active');
      paramIndex = 2;
    }

    // Apply filters
    if (filters.trainer_id) {
      query += ` AND trainer_id = $${paramIndex}`;
      params.push(filters.trainer_id);
      paramIndex++;
    }

    if (filters.course_id !== undefined) {
      if (filters.course_id === null) {
        // Standalone topics (not in a course)
        query += ` AND course_id IS NULL`;
      } else {
        // Topics belonging to a specific course
        query += ` AND course_id = $${paramIndex}`;
        params.push(filters.course_id);
        paramIndex++;
      }
    }

    if (filters.language) {
      query += ` AND language = $${paramIndex}`;
      params.push(filters.language);
      paramIndex++;
    }

    // Apply pagination
    const limit = pagination.limit || 10;
    const offset = (pagination.page - 1) * limit || 0;

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToTopic(row));
  }

  async findByTrainer(trainerId, filters = {}, pagination = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = `
      SELECT t.*, 
             COUNT(DISTINCT c.content_type_id) as content_count
      FROM topics t
      LEFT JOIN content c ON t.topic_id = c.topic_id
      WHERE t.trainer_id = $1
    `;
    const params = [trainerId];
    let paramIndex = 2;

    // Apply status filter in WHERE clause (before GROUP BY)
    if (filters.status && filters.status !== 'all') {
      // If requesting deleted, show only deleted (for History Sidebar)
      if (filters.status === 'deleted') {
        query += ` AND t.status = $${paramIndex}`;
        params.push('deleted');
        paramIndex++;
      } else {
        // For active or other statuses, filter by that status
        query += ` AND t.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }
    } else {
      // Default: only active topics
      query += ` AND t.status = $${paramIndex}`;
      params.push('active');
      paramIndex++;
    }

    query += ` GROUP BY t.topic_id`;

    // Build HAVING conditions (after GROUP BY) - only for non-status filters
    let havingConditions = [];

    // Handle course_id filter - can be null (for standalone topics), a number (for course topics), or undefined (no filter)
    if (filters.course_id !== undefined) {
      if (filters.course_id === null || filters.course_id === 'null') {
        // Standalone topics (not in a course)
        havingConditions.push(`t.course_id IS NULL`);
      } else {
        // Topics belonging to a specific course
        const courseId = typeof filters.course_id === 'string' ? parseInt(filters.course_id) : filters.course_id;
        if (!isNaN(courseId)) {
          havingConditions.push(`t.course_id = $${paramIndex}`);
          params.push(courseId);
          paramIndex++;
        }
      }
    }

    if (filters.search) {
      havingConditions.push(`(t.topic_name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Add HAVING conditions to query
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }

    // Count total for pagination (wrap in subquery because of GROUP BY)
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || 0);

    // Apply pagination
    const limit = pagination.limit || 10;
    const offset = ((pagination.page || 1) - 1) * limit;

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      topics: result.rows.map(row => this.mapRowToTopic(row)),
      total
    };
  }

  async update(topicId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Validate updates parameter
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be a non-null object');
    }

    const allowedFields = [
      'topic_name',
      'description',
      'course_id',
      'template_id',
      'skills',
      'language',
      'status',
      'format_flags',
      'generation_methods_id',
    ];
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
      return await this.findById(topicId);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(topicId);

    const query = `
      UPDATE topics
      SET ${setClauses.join(', ')}
      WHERE topic_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTopic(result.rows[0]);
  }

  async delete(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Soft delete - UPDATE status = 'deleted' (never DELETE FROM)
    return await this.update(topicId, { status: 'deleted' });
  }

  async softDelete(topicId) {
    // Alias for delete() - implements soft delete (UPDATE status = 'deleted')
    return await this.delete(topicId);
  }

  async validateFormatRequirements(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    // Get topic with content count
    const query = `
      SELECT 
        t.*,
        COUNT(DISTINCT c.content_id) as total_content_formats
      FROM topics t
      LEFT JOIN content c ON c.topic_id = t.topic_id 
        AND c.status != 'deleted'
        AND c.content_type_id IN (1, 2, 3, 4, 5)
      WHERE t.topic_id = $1
      GROUP BY t.topic_id
    `;

    const result = await this.db.query(query, [topicId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const completed = parseInt(row.total_content_formats) || 0;
    const required = 5;

    return {
      topic_id: topicId,
      completed,
      required,
      percentage: (completed / required) * 100,
      is_complete: completed >= required,
    };
  }

  /**
   * Increment usage_count for a topic
   * @param {number} topicId - Topic ID
   * @returns {Promise<void>}
   */
  async incrementUsageCount(topicId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected.');
    }

    const query = `
      UPDATE topics 
      SET usage_count = usage_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE topic_id = $1
    `;

    await this.db.query(query, [topicId]);
  }

  /**
   * Map database row to Topic entity
   * @param {Object} row - Database row
   * @returns {Topic} Topic entity
   */
  mapRowToTopic(row) {
    return new Topic({
      topic_id: row.topic_id,
      topic_name: row.topic_name,
      trainer_id: row.trainer_id,
      description: row.description,
      course_id: row.course_id,
      template_id: row.template_id,
      skills: row.skills || [],
      language: row.language || 'en',
      status: row.status,
      format_flags: row.format_flags || {},
      usage_count: row.usage_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Update devlab_exercises field in topics table
   * @param {number} topicId - Topic ID
   * @param {string} answer - The answer code (HTML/CSS/JS) to save
   * @returns {Promise<void>}
   */
  async updateDevlabExercises(topicId, answer) {
    if (!this.db || !this.db.isConnected()) {
      logger.warn('[PostgreSQLTopicRepository] Database not connected, cannot update devlab_exercises');
      return;
    }

    try {
      // Save answer as string in devlab_exercises field (JSONB)
      const updateSql = `
        UPDATE topics
        SET devlab_exercises = $1::jsonb
        WHERE topic_id = $2
      `;

      await this.db.query(updateSql, [
        JSON.stringify(answer), // Save as string in JSONB
        topicId,
      ]);

      logger.info('[PostgreSQLTopicRepository] Updated devlab_exercises in topics table', {
        topic_id: topicId,
        answerLength: answer.length,
      });
    } catch (error) {
      logger.error('[PostgreSQLTopicRepository] Failed to update devlab_exercises', {
        topic_id: topicId,
        error: error.message,
      });
      throw error;
    }
  }
}



