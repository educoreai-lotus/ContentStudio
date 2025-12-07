import request from 'supertest';
import express from 'express';
import cors from 'cors';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create a test app instance
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/topics', topicsRouter);
  app.use(errorHandler);
  return app;
};

const testApp = createTestApp();

describe('Topics API Integration Tests', () => {
  let createdTopicId;

  describe('POST /api/topics', () => {
    it('should create a topic with valid data', async () => {
      const topicData = {
        topic_name: 'Integration Test Topic',
        description: 'Test Description',
        trainer_id: 'trainer123',
        course_id: 1,
        skills: ['JavaScript', 'React'],
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(201);

      expect(response.body).toHaveProperty('topic_id');
      expect(response.body.topic_name).toBe(topicData.topic_name);
      expect(response.body.trainer_id).toBe(topicData.trainer_id);
      expect(response.body.course_id).toBe(topicData.course_id);
      expect(response.body.status).toBe('active');
      expect(response.body.is_standalone).toBe(false);

      createdTopicId = response.body.topic_id;
    });

    it('should create a stand-alone topic (course_id null)', async () => {
      const topicData = {
        topic_name: 'Stand-alone Topic',
        trainer_id: 'trainer123',
        course_id: null,
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(201);

      expect(response.body.course_id).toBeNull();
      expect(response.body.is_standalone).toBe(true);
    });

    it('should return 400 if topic_name is missing', async () => {
      const topicData = {
        trainer_id: 'trainer123',
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if topic_name is too short', async () => {
      const topicData = {
        topic_name: 'AB',
        trainer_id: 'trainer123',
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/topics', () => {
    it('should return list of topics', async () => {
      const response = await request(testApp)
        .get('/api/topics')
        .query({ trainer_id: 'trainer123' })
        .expect(200);

      expect(response.body).toHaveProperty('topics');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.topics)).toBe(true);
    });

    it('should filter by course_id', async () => {
      const response = await request(testApp)
        .get('/api/topics')
        .query({ trainer_id: 'trainer123', course_id: 1 })
        .expect(200);

      expect(response.body.topics).toBeDefined();
      if (response.body.topics.length > 0) {
        response.body.topics.forEach(topic => {
          expect(topic.course_id).toBe(1);
        });
      }
    });

    it('should filter stand-alone topics (course_id null)', async () => {
      // First create a stand-alone topic
      const createResponse = await request(testApp)
        .post('/api/topics')
        .send({
          topic_name: 'Stand-alone Filter Test',
          trainer_id: 'trainer123',
          course_id: null,
        });
      
      expect(createResponse.body.is_standalone).toBe(true);

      // Then filter for stand-alone topics
      const response = await request(testApp)
        .get('/api/topics')
        .query({ trainer_id: 'trainer123', course_id: 'null' })
        .expect(200);

      expect(response.body.topics).toBeDefined();
      if (response.body.topics.length > 0) {
        response.body.topics.forEach(topic => {
          expect(topic.is_standalone || topic.course_id === null).toBe(true);
        });
      }
    });
  });

  describe('GET /api/topics/:id', () => {
    it('should return topic by ID', async () => {
      if (!createdTopicId) {
        const createResponse = await request(testApp)
          .post('/api/topics')
          .send({
            topic_name: 'Get Test Topic',
            trainer_id: 'trainer123',
          });
        createdTopicId = createResponse.body.topic_id;
      }

      const response = await request(testApp)
        .get(`/api/topics/${createdTopicId}`)
        .expect(200);

      expect(response.body).toHaveProperty('topic_id');
      expect(response.body.topic_id).toBe(createdTopicId);
      expect(response.body).toHaveProperty('format_flags');
    });

    it('should return 404 if topic not found', async () => {
      const response = await request(testApp)
        .get('/api/topics/99999')
        .expect(404);

      expect(response.body.error.code).toBe('TOPIC_NOT_FOUND');
    });
  });

  describe('POST /api/topics/:id/validate-formats', () => {
    it('should validate format requirements', async () => {
      if (!createdTopicId) {
        const createResponse = await request(testApp)
          .post('/api/topics')
          .send({
            topic_name: 'Format Test Topic',
            trainer_id: 'trainer123',
          });
        createdTopicId = createResponse.body.topic_id;
      }

      const contentItems = [
        { content_type: 'text' },
        { content_type: 'code' },
        { content_type: 'presentation' },
        { content_type: 'audio' },
        { content_type: 'mind_map' },
      ];

      const response = await request(testApp)
        .post(`/api/topics/${createdTopicId}/validate-formats`)
        .send({ content_items: contentItems })
        .expect(200);

      expect(response.body.hasAllFormats).toBe(true);
      expect(response.body.totalFormats).toBe(5);
      expect(response.body.requiredFormats).toBe(5);
      expect(response.body.missingFormats).toEqual([]);
    });

    it('should return missing formats when not all present', async () => {
      if (!createdTopicId) {
        const createResponse = await request(testApp)
          .post('/api/topics')
          .send({
            topic_name: 'Incomplete Format Topic',
            trainer_id: 'trainer123',
          });
        createdTopicId = createResponse.body.topic_id;
      }

      const contentItems = [
        { content_type: 'text' },
        { content_type: 'code' },
        // Missing: presentation, audio, mind_map
      ];

      const response = await request(testApp)
        .post(`/api/topics/${createdTopicId}/validate-formats`)
        .send({ content_items: contentItems })
        .expect(200);

      expect(response.body.hasAllFormats).toBe(false);
      expect(response.body.totalFormats).toBe(2);
      expect(response.body.missingFormats.length).toBe(3);
      expect(response.body.missingFormats).toContain('presentation');
      expect(response.body.missingFormats).toContain('audio');
      expect(response.body.missingFormats).toContain('mind_map');
    });
  });
});

