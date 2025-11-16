import { ExerciseRepository as IExerciseRepository } from '../../../domain/repositories/ExerciseRepository.js';
import { Exercise } from '../../../domain/entities/Exercise.js';
import { db } from '../DatabaseConnection.js';

/**
 * PostgreSQL Exercise Repository Implementation
 */
export class PostgreSQLExerciseRepository extends IExerciseRepository {
  constructor() {
    super();
    this.db = db;
  }

  async create(exercise) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = `
      INSERT INTO exercises (
        topic_id, question_text, question_type, programming_language, language,
        skills, hint, solution, test_cases, difficulty, points, order_index,
        generation_mode, validation_status, validation_message, devlab_response,
        created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      exercise.topic_id,
      exercise.question_text,
      exercise.question_type,
      exercise.programming_language || null,
      exercise.language || 'en',
      exercise.skills || [],
      exercise.hint || null,
      exercise.solution || null,
      exercise.test_cases ? JSON.stringify(exercise.test_cases) : null,
      exercise.difficulty || null,
      exercise.points || 10,
      exercise.order_index || 0,
      exercise.generation_mode,
      exercise.validation_status || 'pending',
      exercise.validation_message || null,
      exercise.devlab_response ? JSON.stringify(exercise.devlab_response) : null,
      exercise.created_by,
      exercise.status || 'active',
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToExercise(row);
  }

  async findById(exerciseId) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const query = 'SELECT * FROM exercises WHERE exercise_id = $1 AND status != $2';
    const result = await this.db.query(query, [exerciseId, 'deleted']);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToExercise(result.rows[0]);
  }

  async findByTopicId(topicId, filters = {}) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    let query = 'SELECT * FROM exercises WHERE topic_id = $1 AND status != $2';
    const params = [topicId, 'deleted'];
    let paramIndex = 3;

    if (filters.generation_mode) {
      query += ` AND generation_mode = $${paramIndex}`;
      params.push(filters.generation_mode);
      paramIndex++;
    }

    if (filters.validation_status) {
      query += ` AND validation_status = $${paramIndex}`;
      params.push(filters.validation_status);
      paramIndex++;
    }

    query += ' ORDER BY order_index ASC, created_at ASC';

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToExercise(row));
  }

  async update(exerciseId, updates) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    const allowedFields = [
      'question_text',
      'question_type',
      'programming_language',
      'language',
      'skills',
      'hint',
      'solution',
      'test_cases',
      'difficulty',
      'points',
      'order_index',
      'validation_status',
      'validation_message',
      'devlab_response',
      'status',
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'test_cases' || key === 'devlab_response') {
          setClauses.push(`${key} = $${paramIndex}::JSONB`);
          values.push(JSON.stringify(updates[key]));
        } else {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
        }
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      return await this.findById(exerciseId);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(exerciseId);

    const query = `
      UPDATE exercises
      SET ${setClauses.join(', ')}
      WHERE exercise_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToExercise(result.rows[0]);
  }

  async delete(exerciseId) {
    // Soft delete
    return await this.update(exerciseId, { status: 'deleted' });
  }

  async createBatch(exercises) {
    if (!this.db.isConnected()) {
      throw new Error('Database not connected. Using in-memory repository.');
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return [];
    }

    const createdExercises = [];
    
    // Use transaction for batch insert
    for (const exercise of exercises) {
      const created = await this.create(exercise);
      createdExercises.push(created);
    }

    return createdExercises;
  }

  /**
   * Map database row to Exercise entity
   * @param {Object} row - Database row
   * @returns {Exercise} Exercise entity
   */
  mapRowToExercise(row) {
    return new Exercise({
      exercise_id: row.exercise_id,
      topic_id: row.topic_id,
      question_text: row.question_text,
      question_type: row.question_type,
      programming_language: row.programming_language,
      language: row.language || 'en',
      skills: row.skills || [],
      hint: row.hint,
      solution: row.solution,
      test_cases: row.test_cases ? (typeof row.test_cases === 'string' ? JSON.parse(row.test_cases) : row.test_cases) : null,
      difficulty: row.difficulty,
      points: row.points || 10,
      order_index: row.order_index || 0,
      generation_mode: row.generation_mode,
      validation_status: row.validation_status || 'pending',
      validation_message: row.validation_message,
      devlab_response: row.devlab_response ? (typeof row.devlab_response === 'string' ? JSON.parse(row.devlab_response) : row.devlab_response) : null,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status || 'active',
    });
  }
}

