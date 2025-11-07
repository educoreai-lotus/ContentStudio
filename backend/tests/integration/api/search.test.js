import request from 'supertest';
import express from 'express';
import cors from 'cors';
import searchRouter from '../../../src/presentation/routes/search.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/search', searchRouter);
app.use(errorHandler);

describe('Search API Integration Tests', () => {
  describe('GET /api/search', () => {
    it('should search content with query', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('total_pages');
    });

    it('should search with filters', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'course',
          type: 'course',
          status: 'active',
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.type).toBe('course');
      expect(response.body.data.filters.status).toBe('active');
    });

    it('should handle empty query (return all)', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query).toBe('');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', page: 2, limit: 5 })
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(5);
    });

    it('should filter by content type', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'code',
          type: 'content',
          content_type_id: 'code',
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.data.filters.content_type_id).toBe('code');
    });

    it('should filter by generation method', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'lesson',
          generation_method_id: 'manual',
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.data.filters.generation_method_id).toBe('manual');
    });

    it('should use default pagination if not provided', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });
  });
});



