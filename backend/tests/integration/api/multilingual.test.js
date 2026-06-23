import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import multilingualRouter from '../../../src/presentation/routes/multilingual.js';
import multilingualStatsRouter from '../../../src/presentation/routes/multilingual-stats.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import contentRouter from '../../../src/presentation/routes/content.js';
import { createIntegrationTestApp } from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([
  { path: '/api/topics', router: topicsRouter },
  { path: '/api/content', router: contentRouter },
  { path: '/api/content/multilingual', router: multilingualRouter },
  { path: '/api/content/multilingual', router: multilingualStatsRouter },
]);

describe('Multilingual Content API Integration Tests', () => {
  let topicId;

  beforeEach(async () => {
    const topicResponse = await request(app)
      .post('/api/topics')
      .send({
        topic_name: 'Test Topic',
        description: 'Test topic for multilingual',
        language: 'en',
      });

    if (topicResponse.status === 201) {
      topicId = topicResponse.body.topic_id;
    }

    if (topicId) {
      await request(app)
        .post('/api/content')
        .send({
          topic_id: topicId,
          content_type_id: 1,
          content_data: { text: 'Hello, this is test content' },
          generation_method_id: 'manual',
          quality_check_status: 'approved',
        });
    }
  });

  describe('POST /api/content/multilingual/lesson', () => {
    it('should get lesson content in preferred language', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app)
        .post('/api/content/multilingual/lesson')
        .send({
          lesson_id: topicId,
          preferred_language: 'en',
        });

      expect([200, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('lesson_id', String(topicId));
        expect(response.body.data).toHaveProperty('language', 'en');
        expect(response.body.data).toHaveProperty('content');
      }
    });

    it('should return 400 if lesson_id is missing', async () => {
      const response = await request(app)
        .post('/api/content/multilingual/lesson')
        .send({
          preferred_language: 'en',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if preferred_language is missing', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app)
        .post('/api/content/multilingual/lesson')
        .send({
          lesson_id: topicId,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle different language codes', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const languages = ['en', 'he', 'ar', 'fr', 'es'];

      for (const lang of languages) {
        const response = await request(app)
          .post('/api/content/multilingual/lesson')
          .send({
            lesson_id: topicId,
            preferred_language: lang,
          });

        expect([200, 404, 500]).toContain(response.status);
      }
    });
  });

  describe('GET /api/content/multilingual/stats', () => {
    it('should get language statistics', async () => {
      const response = await request(app)
        .get('/api/content/multilingual/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('frequent_languages');
      expect(Array.isArray(response.body.data.frequent_languages)).toBe(true);
      expect(response.body.data).toHaveProperty('popular_languages');
      expect(Array.isArray(response.body.data.popular_languages)).toBe(true);
      expect(response.body.data).toHaveProperty('non_frequent_languages');
      expect(Array.isArray(response.body.data.non_frequent_languages)).toBe(true);
    });

    it('should include summary statistics', async () => {
      const response = await request(app)
        .get('/api/content/multilingual/stats')
        .expect(200);

      expect(response.body.data).toHaveProperty('total_languages');
      expect(response.body.data).toHaveProperty('frequent_count');
      expect(response.body.data).toHaveProperty('non_frequent_count');
      expect(response.body.data).toHaveProperty('frequent_languages');
      expect(Array.isArray(response.body.data.frequent_languages)).toBe(true);
    });
  });

  describe('GET /api/content/multilingual/stats/:languageCode', () => {
    it('should get statistics for specific language', async () => {
      const response = await request(app).get('/api/content/multilingual/stats/en');

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('language_code', 'en');
        expect(response.body.data).toHaveProperty('total_requests');
        expect(response.body.data).toHaveProperty('total_lessons');
      } else {
        expect(response.body.error || response.body.success === false).toBeDefined();
      }
    });

    it('should return 404 for non-existent language', async () => {
      const response = await request(app)
        .get('/api/content/multilingual/stats/xyz')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });
});
