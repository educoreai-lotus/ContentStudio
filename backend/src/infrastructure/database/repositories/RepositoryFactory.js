import { db } from '../DatabaseConnection.js';
import { CourseRepository } from './CourseRepository.js';
import { PostgreSQLCourseRepository } from './PostgreSQLCourseRepository.js';
import { TopicRepository } from './TopicRepository.js';
import { PostgreSQLTopicRepository } from './PostgreSQLTopicRepository.js';
import { ContentRepository } from './ContentRepository.js';
import { PostgreSQLContentRepository } from './PostgreSQLContentRepository.js';
import { TemplateRepository } from './TemplateRepository.js';
import { PostgreSQLTemplateRepository } from './PostgreSQLTemplateRepository.js';
import { ContentVersionRepository } from './ContentVersionRepository.js';
import { PostgreSQLContentVersionRepository } from './PostgreSQLContentVersionRepository.js';
import { QualityCheckRepository } from './QualityCheckRepository.js';
import { PostgreSQLQualityCheckRepository } from './PostgreSQLQualityCheckRepository.js';
import { ExerciseRepository } from './ExerciseRepository.js';
import { PostgreSQLExerciseRepository } from './PostgreSQLExerciseRepository.js';

/**
 * Repository Factory
 * Returns PostgreSQL repositories if database is connected, otherwise in-memory repositories
 */
export class RepositoryFactory {
  static async getCourseRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLCourseRepository();
    }
    return new CourseRepository(null);
  }

  static async getTopicRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLTopicRepository();
    }
    return new TopicRepository(null);
  }

  static async getContentRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLContentRepository();
    }
    return new ContentRepository();
  }

  static async getTemplateRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLTemplateRepository();
    }
    return new TemplateRepository();
  }

  static async getContentVersionRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLContentVersionRepository();
    }
    return new ContentVersionRepository();
  }

  static async getQualityCheckRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLQualityCheckRepository();
    }
    return new QualityCheckRepository();
  }

  static async getExerciseRepository() {
    await db.ready;
    if (db.isConnected()) {
      return new PostgreSQLExerciseRepository();
    }
    return new ExerciseRepository();
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} True if connected
   */
  static async testConnection() {
    return await db.testConnection();
  }
}

