import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnection } from '../../../src/infrastructure/database/DatabaseConnection.js';
import { PostgreSQLCourseRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLCourseRepository.js';
import { PostgreSQLTopicRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLTopicRepository.js';
import { PostgreSQLContentRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLContentRepository.js';
import { PostgreSQLTemplateRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLTemplateRepository.js';
import { PostgreSQLContentVersionRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLContentVersionRepository.js';
import { PostgreSQLQualityCheckRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLQualityCheckRepository.js';

/**
 * PostgreSQL Integration Tests
 * 
 * These tests require a running PostgreSQL database.
 * Set DATABASE_URL environment variable to run these tests.
 * 
 * Example: DATABASE_URL=postgresql://user:password@localhost:5432/content_studio_test
 */
describe('PostgreSQL Repository Integration Tests', () => {
  let db;
  let courseRepository;
  let topicRepository;
  let contentRepository;
  let templateRepository;
  let versionRepository;
  let qualityCheckRepository;

  beforeAll(async () => {
    // Skip tests if DATABASE_URL is not set
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set, skipping PostgreSQL integration tests');
      return;
    }

    db = DatabaseConnection.getInstance();
    
    // Wait for connection
    if (!db.isConnected()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!db.isConnected()) {
      console.warn('Database not connected, skipping PostgreSQL integration tests');
      return;
    }

    // Initialize repositories
    courseRepository = new PostgreSQLCourseRepository();
    topicRepository = new PostgreSQLTopicRepository();
    contentRepository = new PostgreSQLContentRepository();
    templateRepository = new PostgreSQLTemplateRepository();
    versionRepository = new PostgreSQLContentVersionRepository();
    qualityCheckRepository = new PostgreSQLQualityCheckRepository();
  });

  afterAll(async () => {
    // Cleanup test data
    if (db && db.isConnected()) {
      try {
        // Delete test data in reverse order of dependencies
        await db.query('DELETE FROM content_history WHERE content_id IN (SELECT content_id FROM content WHERE created_by = $1)', ['test-user']);
        await db.query('DELETE FROM content WHERE created_by = $1', ['test-user']);
        await db.query('DELETE FROM topics WHERE created_by = $1', ['test-user']);
        await db.query('DELETE FROM courses WHERE created_by = $1', ['test-user']);
        await db.query('DELETE FROM templates WHERE created_by = $1', ['test-user']);
      } catch (error) {
        console.error('Error cleaning up test data:', error);
      }
    }
  });

  describe('PostgreSQLCourseRepository', () => {
    it('should create a course', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const courseData = {
        course_name: 'Test Course',
        description: 'Test course description',
        created_by: 'test-user',
      };

      const course = await courseRepository.create(courseData);
      expect(course).toBeDefined();
      expect(course.course_id).toBeDefined();
      expect(course.course_name).toBe('Test Course');
    });

    it('should find course by ID', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const courseData = {
        course_name: 'Test Course Find',
        description: 'Test',
        created_by: 'test-user',
      };

      const created = await courseRepository.create(courseData);
      const found = await courseRepository.findById(created.course_id);
      
      expect(found).toBeDefined();
      expect(found.course_id).toBe(created.course_id);
      expect(found.course_name).toBe('Test Course Find');
    });

    it('should update a course', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const courseData = {
        course_name: 'Test Course Update',
        description: 'Test',
        created_by: 'test-user',
      };

      const created = await courseRepository.create(courseData);
      const updated = await courseRepository.update(created.course_id, {
        course_name: 'Updated Course Name',
      });

      expect(updated).toBeDefined();
      expect(updated.course_name).toBe('Updated Course Name');
    });

    it('should delete a course (soft delete)', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const courseData = {
        course_name: 'Test Course Delete',
        description: 'Test',
        created_by: 'test-user',
      };

      const created = await courseRepository.create(courseData);
      await courseRepository.delete(created.course_id);
      
      const found = await courseRepository.findById(created.course_id);
      expect(found).toBeNull();
    });
  });

  describe('PostgreSQLTopicRepository', () => {
    let testCourseId;

    beforeAll(async () => {
      if (db && db.isConnected()) {
        const course = await courseRepository.create({
          course_name: 'Test Course for Topics',
          description: 'Test',
          created_by: 'test-user',
        });
        testCourseId = course.course_id;
      }
    });

    it('should create a topic', async () => {
      if (!db || !db.isConnected() || !testCourseId) {
        console.warn('Skipping: Database not connected or test course not created');
        return;
      }

      const topicData = {
        topic_name: 'Test Topic',
        course_id: testCourseId,
        description: 'Test topic description',
        created_by: 'test-user',
      };

      const topic = await topicRepository.create(topicData);
      expect(topic).toBeDefined();
      expect(topic.topic_id).toBeDefined();
      expect(topic.topic_name).toBe('Test Topic');
    });

    it('should find topics by course ID', async () => {
      if (!db || !db.isConnected() || !testCourseId) {
        console.warn('Skipping: Database not connected or test course not created');
        return;
      }

      const topics = await topicRepository.findByCourseId(testCourseId);
      expect(Array.isArray(topics)).toBe(true);
    });
  });

  describe('PostgreSQLContentRepository', () => {
    let testTopicId;

    beforeAll(async () => {
      if (db && db.isConnected()) {
        const course = await courseRepository.create({
          course_name: 'Test Course for Content',
          description: 'Test',
          created_by: 'test-user',
        });
        const topic = await topicRepository.create({
          topic_name: 'Test Topic for Content',
          course_id: course.course_id,
          description: 'Test',
          created_by: 'test-user',
        });
        testTopicId = topic.topic_id;
      }
    });

    it('should create content', async () => {
      if (!db || !db.isConnected() || !testTopicId) {
        console.warn('Skipping: Database not connected or test topic not created');
        return;
      }

      const contentData = {
        topic_id: testTopicId,
        content_type_id: 'text',
        content_data: { text: 'Test content' },
        created_by: 'test-user',
      };

      const content = await contentRepository.create(contentData);
      expect(content).toBeDefined();
      expect(content.content_id).toBeDefined();
    });

    it('should find content by topic ID', async () => {
      if (!db || !db.isConnected() || !testTopicId) {
        console.warn('Skipping: Database not connected or test topic not created');
        return;
      }

      const contents = await contentRepository.findAllByTopicId(testTopicId);
      expect(Array.isArray(contents)).toBe(true);
    });
  });

  describe('PostgreSQLTemplateRepository', () => {
    it('should create a template', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const templateData = {
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'Test template',
        created_by: 'test-user',
      };

      const template = await templateRepository.create(templateData);
      expect(template).toBeDefined();
      expect(template.template_id).toBeDefined();
      expect(template.template_name).toBe('Test Template');
    });

    it('should find all templates', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const templates = await templateRepository.findAll();
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('PostgreSQLContentVersionRepository', () => {
    let testContentId;

    beforeAll(async () => {
      if (db && db.isConnected()) {
        const course = await courseRepository.create({
          course_name: 'Test Course for Versions',
          description: 'Test',
          created_by: 'test-user',
        });
        const topic = await topicRepository.create({
          topic_name: 'Test Topic for Versions',
          course_id: course.course_id,
          description: 'Test',
          created_by: 'test-user',
        });
        const content = await contentRepository.create({
          topic_id: topic.topic_id,
          content_type_id: 'text',
          content_data: { text: 'Original content' },
          created_by: 'test-user',
        });
        testContentId = content.content_id;
      }
    });

    it('should create a content version', async () => {
      if (!db || !db.isConnected() || !testContentId) {
        console.warn('Skipping: Database not connected or test content not created');
        return;
      }

      const versionData = {
        content_id: testContentId,
        content_data: { text: 'Version 1 content' },
        version_number: 1,
      };

      const version = await versionRepository.create(versionData);
      expect(version).toBeDefined();
      expect(version.version_id).toBeDefined();
      expect(version.version_number).toBe(1);
    });

    it('should find versions by content ID', async () => {
      if (!db || !db.isConnected() || !testContentId) {
        console.warn('Skipping: Database not connected or test content not created');
        return;
      }

      const versions = await versionRepository.findByContentId(testContentId);
      expect(Array.isArray(versions)).toBe(true);
    });
  });

  describe('PostgreSQLQualityCheckRepository', () => {
    let testContentId;

    beforeAll(async () => {
      if (db && db.isConnected()) {
        const course = await courseRepository.create({
          course_name: 'Test Course for Quality',
          description: 'Test',
          created_by: 'test-user',
        });
        const topic = await topicRepository.create({
          topic_name: 'Test Topic for Quality',
          course_id: course.course_id,
          description: 'Test',
          created_by: 'test-user',
        });
        const content = await contentRepository.create({
          topic_id: topic.topic_id,
          content_type_id: 'text',
          content_data: { text: 'Test content for quality check' },
          created_by: 'test-user',
        });
        testContentId = content.content_id;
      }
    });

    it('should create a quality check', async () => {
      if (!db || !db.isConnected() || !testContentId) {
        console.warn('Skipping: Database not connected or test content not created');
        return;
      }

      const qualityCheckData = {
        content_id: testContentId,
        status: 'pending',
        results: {},
      };

      const qualityCheck = await qualityCheckRepository.create(qualityCheckData);
      expect(qualityCheck).toBeDefined();
      expect(qualityCheck.content_id).toBe(testContentId);
    });

    it('should find quality check by content ID', async () => {
      if (!db || !db.isConnected() || !testContentId) {
        console.warn('Skipping: Database not connected or test content not created');
        return;
      }

      const qualityCheck = await qualityCheckRepository.findByContentId(testContentId);
      expect(qualityCheck).toBeDefined();
    });
  });
});

