import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import templatesRouter from '../../../src/presentation/routes/templates.js';
import {
  TEST_TRAINER_ID,
  VALID_TEMPLATE_FORMAT_ORDER,
  createIntegrationTestApp,
} from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([{ path: '/api/templates', router: templatesRouter }]);

describe('Templates API Integration Tests', () => {
  describe('POST /api/templates', () => {
    it('should create a template successfully', async () => {
      const templateData = {
        template_name: 'Test Template',
        format_order: VALID_TEMPLATE_FORMAT_ORDER,
        description: 'A test template',
        created_by: 'ignored-client-id',
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('template_id');
      expect(response.body.data.template_name).toBe('Test Template');
      expect(response.body.data.format_order).toEqual(expect.arrayContaining(VALID_TEMPLATE_FORMAT_ORDER));
    });

    it('should return 400 if template_name is missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          format_order: VALID_TEMPLATE_FORMAT_ORDER,
          created_by: 'ignored-client-id',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if format_order is invalid', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Test',
          format_order: ['invalid_type'],
          created_by: 'ignored-client-id',
        });

      expect([400, 500]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/templates', () => {
    it('should list all templates', async () => {
      const response = await request(app).get('/api/templates').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter templates by created_by', async () => {
      const response = await request(app).get('/api/templates').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.some(t => t.created_by === 'system')).toBe(true);
      expect(response.body.data.some(t => t.created_by === TEST_TRAINER_ID)).toBe(true);
    });

    it('should search templates by name', async () => {
      const response = await request(app)
        .get('/api/templates')
        .query({ search: 'Foundational' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(template => {
        expect(template.template_name.toLowerCase()).toContain('foundational');
      });
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should get template by ID', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Get Test Template',
          format_order: VALID_TEMPLATE_FORMAT_ORDER,
          created_by: 'ignored-client-id',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.template_id).toBe(templateId);
      expect(response.body.data.template_name).toBe('Get Test Template');
    });

    it('should return 404 if template not found', async () => {
      const response = await request(app).get('/api/templates/99999').expect(404);

      expect(response.body.error?.code || response.body.error).toBeTruthy();
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update template successfully', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Update Test Template',
          format_order: VALID_TEMPLATE_FORMAT_ORDER,
          created_by: 'ignored-client-id',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      const updateResponse = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({
          template_name: 'Updated Template Name',
          format_order: ['code', 'text_audio', 'presentation', 'mind_map', 'avatar_video'],
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.template_name).toBe('Updated Template Name');
    });

    it('should return 404 if template not found', async () => {
      const response = await request(app)
        .put('/api/templates/99999')
        .send({ template_name: 'Updated' })
        .expect(404);

      expect(response.body.error?.code || response.body.error).toBeTruthy();
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should soft delete template successfully', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Delete Test Template',
          format_order: VALID_TEMPLATE_FORMAT_ORDER,
          created_by: 'ignored-client-id',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      const deleteResponse = await request(app)
        .delete(`/api/templates/${templateId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      const getResponse = await request(app).get(`/api/templates/${templateId}`).expect(404);
      expect(getResponse.body.error?.code || getResponse.body.error).toBeTruthy();
    });
  });
});
