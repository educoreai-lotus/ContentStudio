import request from 'supertest';
import searchRouter from '../../../src/presentation/routes/search.js';
import { createIntegrationTestApp } from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([{ path: '/api/search', router: searchRouter }]);

const unauthenticatedApp = createIntegrationTestApp(
  [{ path: '/api/search', router: searchRouter }],
  { authenticated: false }
);

describe('Search API Integration Tests', () => {
  describe('GET /api/search', () => {
    it('should return 401 without authenticated trainer', async () => {
      const response = await request(unauthenticatedApp)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

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
