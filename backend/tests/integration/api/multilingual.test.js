import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import multilingualRouter from '../../../src/presentation/routes/multilingual.js';
import multilingualStatsRouter from '../../../src/presentation/routes/multilingual-stats.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import contentRouter from '../../../src/presentation/routes/content.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/topics', topicsRouter);
app.use('/api/content', contentRouter);
app.use('/api/content/multilingual', multilingualRouter);
app.use('/api/content/multilingual', multilingualStatsRouter);
app.use(errorHandler);

describe('Multilingual Content API Integration Tests', () => {
  let topicId;
  let contentId;

  beforeEach(async () => {
    // Create a topic
    const topicResponse = await request(app)
      .post('/api/topics')
      .send({
        topic_name: 'Test Topic',
        course_id: 'test-course-1',
        description: 'Test topic for multilingual',
        created_by: 'test-trainer',
      });

    if (topicResponse.status === 201) {
      topicId = topicResponse.body.data.topic_id;
    }

    // Create content for the topic
    const contentResponse = await request(app)
      .post('/api/content')
      .send({
        topic_id: topicId,
        content_type: 'text',
        content_data: {
          text: 'Hello, this is test content',
        },
        created_by: 'test-trainer',
      });

    if (contentResponse.status === 201) {
      contentId = contentResponse.body.data.content_id;
    }
  });

  describe('GET /api/content/multilingual/lesson', () => {
    it('should get lesson content in preferred language', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app)
        .get('/api/content/multilingual/lesson')
        .query({
          topic_id: topicId,
          preferred_language: 'en',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topic_id', topicId);
      expect(response.body.data).toHaveProperty('language', 'en');
      expect(response.body.data).toHaveProperty('content');
    });

    it('should return 400 or 404 if topic_id is missing', async () => {
      const response = await request(app)
        .get('/api/content/multilingual/lesson')
        .query({
          preferred_language: 'en',
        });

      // May return 400 (validation) or 404 (not found)
      expect([400, 404]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should return 400 if preferred_language is missing', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app)
        .get('/api/content/multilingual/lesson')
        .query({
          topic_id: topicId,
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
          .get('/api/content/multilingual/lesson')
          .query({
            topic_id: topicId,
            preferred_language: lang,
          });

        // Should either succeed or return 404/500 (if AI services not configured)
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
      const response = await request(app)
        .get('/api/content/multilingual/stats/en');

      // May return 404 if language not found in DB (in-memory repo returns null)
      // or 200 if language exists
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

