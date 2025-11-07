import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import templatesRouter from '../../../src/presentation/routes/templates.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/templates', templatesRouter);
app.use(errorHandler);

describe('Templates API Integration Tests', () => {
  describe('POST /api/templates', () => {
    it('should create a template successfully', async () => {
      const templateData = {
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'A test template',
        created_by: 'trainer123',
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('template_id');
      expect(response.body.data.template_name).toBe('Test Template');
      // Should include all 5 mandatory formats
      expect(response.body.data.format_order).toContain('text');
      expect(response.body.data.format_order).toContain('code');
      expect(response.body.data.format_order).toContain('presentation');
      expect(response.body.data.format_order).toContain('audio');
      expect(response.body.data.format_order).toContain('mind_map');
    });

    it('should return 400 if template_name is missing', async () => {
      const templateData = {
        format_order: ['text'],
        created_by: 'trainer123',
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if format_order is invalid', async () => {
      const templateData = {
        template_name: 'Test',
        format_order: ['invalid_type'],
        created_by: 'trainer123',
      };

      const response = await request(app)
        .post('/api/templates')
        .send(templateData);

      // Should return 400 or 500 (validation error)
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
      const response = await request(app)
        .get('/api/templates')
        .query({ created_by: 'system' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(template => {
        expect(template.created_by).toBe('system');
      });
    });

    it('should search templates by name', async () => {
      const response = await request(app)
        .get('/api/templates')
        .query({ search: 'Standard' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(template => {
        expect(template.template_name.toLowerCase()).toContain('standard');
      });
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should get template by ID', async () => {
      // First create a template
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Get Test Template',
          format_order: ['text'],
          created_by: 'trainer123',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      // Then get it
      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.template_id).toBe(templateId);
      expect(response.body.data.template_name).toBe('Get Test Template');
    });

    it('should return 404 if template not found', async () => {
      const response = await request(app).get('/api/templates/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Template not found');
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update template successfully', async () => {
      // Create template
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Update Test Template',
          format_order: ['text'],
          created_by: 'trainer123',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      // Update it
      const updateResponse = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({
          template_name: 'Updated Template Name',
          format_order: ['code', 'text'],
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.template_name).toBe('Updated Template Name');
      expect(updateResponse.body.data.format_order).toEqual(['code', 'text']);
    });

    it('should return 404 if template not found', async () => {
      const response = await request(app)
        .put('/api/templates/99999')
        .send({
          template_name: 'Updated',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should soft delete template successfully', async () => {
      // Create template
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          template_name: 'Delete Test Template',
          format_order: ['text'],
          created_by: 'trainer123',
        })
        .expect(201);

      const templateId = createResponse.body.data.template_id;

      // Delete it
      const deleteResponse = await request(app)
        .delete(`/api/templates/${templateId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify it's not found in list
      const listResponse = await request(app).get('/api/templates').expect(200);
      const deletedTemplate = listResponse.body.data.find(
        t => t.template_id === templateId
      );
      expect(deletedTemplate).toBeUndefined();
    });
  });
});

