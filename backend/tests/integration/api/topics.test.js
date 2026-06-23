import request from 'supertest';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import coursesRouter from '../../../src/presentation/routes/courses.js';
import { TEST_TRAINER_ID, createIntegrationTestApp } from '../../helpers/testAuth.js';

const testApp = createIntegrationTestApp([
  { path: '/api/courses', router: coursesRouter },
  { path: '/api/topics', router: topicsRouter },
]);

describe('Topics API Integration Tests', () => {
  let createdTopicId;
  let courseId;

  beforeAll(async () => {
    const courseRes = await request(testApp)
      .post('/api/courses')
      .send({ course_name: 'Topics Test Course', description: 'For topic tests' });
    if (courseRes.status === 201) {
      courseId = courseRes.body.course_id;
    }
  });

  describe('POST /api/topics', () => {
    it('should create a topic with valid data', async () => {
      const topicData = {
        topic_name: 'Integration Test Topic',
        description: 'Test Description',
        trainer_id: 'ignored-client-id',
        course_id: courseId,
        skills: ['JavaScript', 'React'],
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(201);

      expect(response.body).toHaveProperty('topic_id');
      expect(response.body.topic_name).toBe(topicData.topic_name);
      expect(response.body.trainer_id).toBe(TEST_TRAINER_ID);
      expect(response.body.course_id).toBe(courseId);
      expect(response.body.status).toBe('active');
      expect(response.body.is_standalone).toBe(false);

      createdTopicId = response.body.topic_id;
    });

    it('should create a stand-alone topic (course_id null)', async () => {
      const topicData = {
        topic_name: 'Stand-alone Topic',
        trainer_id: 'ignored-client-id',
        course_id: null,
        language: 'en',
      };

      const response = await request(testApp)
        .post('/api/topics')
        .send(topicData)
        .expect(201);

      expect(response.body.course_id).toBeNull();
      expect(response.body.is_standalone).toBe(true);
    });

    it('should return 400 if topic_name is missing', async () => {
      const response = await request(testApp)
        .post('/api/topics')
        .send({ trainer_id: TEST_TRAINER_ID })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if topic_name is too short', async () => {
      const response = await request(testApp)
        .post('/api/topics')
        .send({ topic_name: 'AB', trainer_id: TEST_TRAINER_ID, language: 'en' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/topics', () => {
    it('should return list of topics', async () => {
      const response = await request(testApp)
        .get('/api/topics')
        .query({ trainer_id: 'ignored-client-id' })
        .expect(200);

      expect(response.body).toHaveProperty('topics');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.topics)).toBe(true);
    });

    it('should filter by course_id', async () => {
      const response = await request(testApp)
        .get('/api/topics')
        .query({ course_id: courseId })
        .expect(200);

      expect(response.body.topics).toBeDefined();
      if (response.body.topics.length > 0) {
        response.body.topics.forEach(topic => {
          expect(topic.course_id).toBe(courseId);
        });
      }
    });

    it('should filter stand-alone topics (course_id null)', async () => {
      await request(testApp)
        .post('/api/topics')
        .send({
          topic_name: 'Stand-alone Filter Test',
          course_id: null,
          language: 'en',
        });

      const response = await request(testApp)
        .get('/api/topics')
        .query({ course_id: 'null' })
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
          .send({ topic_name: 'Get Test Topic', language: 'en' });
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
      const response = await request(testApp).get('/api/topics/99999').expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/topics/:id/validate-formats', () => {
    it('should validate format requirements', async () => {
      if (!createdTopicId) {
        const createResponse = await request(testApp)
          .post('/api/topics')
          .send({ topic_name: 'Format Test Topic', language: 'en' });
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
          .send({ topic_name: 'Incomplete Format Topic', language: 'en' });
        createdTopicId = createResponse.body.topic_id;
      }

      const contentItems = [{ content_type: 'text' }, { content_type: 'code' }];

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
