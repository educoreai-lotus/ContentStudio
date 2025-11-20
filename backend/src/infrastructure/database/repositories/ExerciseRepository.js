import { ExerciseRepository as IExerciseRepository } from '../../../domain/repositories/ExerciseRepository.js';
import { Exercise } from '../../../domain/entities/Exercise.js';

/**
 * In-Memory Exercise Repository Implementation
 * Used when database is not connected (development/testing)
 */
export class ExerciseRepository extends IExerciseRepository {
  constructor(database) {
    super();
    this.db = database;
    // In-memory storage for development/testing
    this.exercises = [];
    this.nextId = 1;
  }

  async create(exercise) {
    // Handle both Exercise instance and plain object
    const exerciseData = exercise instanceof Exercise 
      ? exercise.toJSON() 
      : exercise;
    
    const exerciseEntity = {
      ...exerciseData,
      exercise_id: this.nextId++,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const createdExercise = new Exercise(exerciseEntity);
    this.exercises.push(createdExercise);

    return createdExercise;
  }

  async findById(exerciseId) {
    const exerciseData = this.exercises.find(e => e.exercise_id === exerciseId);

    if (!exerciseData) {
      return null;
    }

    return new Exercise(exerciseData.toJSON());
  }

  async findByTopicId(topicId, filters = {}) {
    let filtered = this.exercises.filter(e => e.topic_id === topicId);

    if (filters.generation_mode) {
      filtered = filtered.filter(e => e.generation_mode === filters.generation_mode);
    }

    if (filters.validation_status) {
      filtered = filtered.filter(e => e.validation_status === filters.validation_status);
    }

    // Filter out deleted exercises
    filtered = filtered.filter(e => e.status !== 'deleted');

    // Sort by order_index, then by created_at
    filtered.sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return (a.order_index || 0) - (b.order_index || 0);
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });

    return filtered.map(e => new Exercise(e.toJSON()));
  }

  async update(exerciseId, updates) {
    const index = this.exercises.findIndex(e => e.exercise_id === exerciseId);

    if (index === -1) {
      return null;
    }

    const current = this.exercises[index];
    const merged = {
      ...current.toJSON(),
      ...updates,
      exercise_id: current.exercise_id,
      updated_at: new Date().toISOString(),
    };

    const updatedExercise = new Exercise(merged);
    this.exercises[index] = updatedExercise;

    return updatedExercise;
  }

  async delete(exerciseId) {
    // Soft delete
    return await this.update(exerciseId, { status: 'deleted' });
  }

  async createBatch(exercises) {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return [];
    }

    const createdExercises = [];
    
    for (const exercise of exercises) {
      const created = await this.create(exercise);
      createdExercises.push(created);
    }

    return createdExercises;
  }
}

