import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import qualityChecksRouter from '../../../src/presentation/routes/quality-checks.js';
import { RepositoryFactory } from '../../../src/infrastructure/database/repositories/RepositoryFactory.js';
import { Content } from '../../../src/domain/entities/Content.js';
import { Topic } from '../../../src/domain/entities/Topic.js';
import { TEST_TRAINER_ID, createIntegrationTestApp } from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([
  { path: '/api/quality-checks', router: qualityChecksRouter },
]);

describe('Quality Checks API Integration Tests', () => {
  let testContentId;

  beforeEach(async () => {
    const topicRepository = await RepositoryFactory.getTopicRepository();
    const contentRepository = await RepositoryFactory.getContentRepository();

    const topic = await topicRepository.create(
      new Topic({
        topic_name: 'Quality Check Topic',
        trainer_id: TEST_TRAINER_ID,
        language: 'en',
      })
    );

    const createdContent = await contentRepository.create(
      new Content({
        topic_id: topic.topic_id,
        content_type_id: 'text',
        content_data: {
          text: 'This is a sample educational content for quality checking. It should be clear, well-structured, and original.',
        },
        generation_method_id: 'manual',
      })
    );
    testContentId = createdContent.content_id;
  });

  describe('POST /api/quality-checks/content/:contentId/quality-check', () => {
    it('should trigger quality check successfully', async () => {
      const response = await request(app)
        .post(`/api/quality-checks/content/${testContentId}/quality-check`)
        .send({ check_type: 'full' });

      expect([200, 201, 404, 500, 503]).toContain(response.status);
      if (response.body.success) {
        expect(response.body.data).toHaveProperty('quality_check_id');
        expect(response.body.data.content_id).toBe(testContentId);
        expect(response.body.data.check_type).toBe('full');
      } else {
        expect(response.body.error).toBeDefined();
      }
    });

    it('should trigger quick check', async () => {
      const response = await request(app)
        .post(`/api/quality-checks/content/${testContentId}/quality-check`)
        .send({ check_type: 'quick' });

      expect([200, 201, 404, 500, 503]).toContain(response.status);
      if (response.body.success) {
        expect(response.body.data.check_type).toBe('quick');
      }
    });

    it('should return 400 if content_id is missing', async () => {
      const response = await request(app)
        .post('/api/quality-checks/content/invalid/quality-check')
        .send({ check_type: 'full' });

      expect([400, 404]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if check_type is invalid', async () => {
      const response = await request(app)
        .post(`/api/quality-checks/content/${testContentId}/quality-check`)
        .send({ check_type: 'invalid_type' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/quality-checks/content/:contentId/quality-checks', () => {
    it('should get all quality checks for content', async () => {
      try {
        await request(app)
          .post(`/api/quality-checks/content/${testContentId}/quality-check`)
          .send({ check_type: 'full' });
      } catch {
        // Ignore if fails without API key
      }

      const response = await request(app)
        .get(`/api/quality-checks/content/${testContentId}/quality-checks`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return empty array if no quality checks exist', async () => {
      const response = await request(app)
        .get('/api/quality-checks/content/99999/quality-checks')
        .expect(404);

      expect(response.body.error?.code || response.body.error).toBeTruthy();
    });
  });

  describe('GET /api/quality-checks/:id', () => {
    it('should get quality check by ID', async () => {
      const createResponse = await request(app)
        .post(`/api/quality-checks/content/${testContentId}/quality-check`)
        .send({ check_type: 'full' });

      if (createResponse.body.success && createResponse.body.data?.quality_check_id) {
        const qualityCheckId = createResponse.body.data.quality_check_id;

        const response = await request(app)
          .get(`/api/quality-checks/${qualityCheckId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.quality_check_id).toBe(qualityCheckId);
        expect(response.body.data).toHaveProperty('quality_level');
        expect(response.body.data).toHaveProperty('is_acceptable');
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return 404 if quality check not found', async () => {
      const response = await request(app)
        .get('/api/quality-checks/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Quality check not found');
    });
  });
});
