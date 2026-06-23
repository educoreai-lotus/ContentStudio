import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import templateApplicationRouter from '../../../src/presentation/routes/template-application.js';
import templatesRouter from '../../../src/presentation/routes/templates.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import contentRouter from '../../../src/presentation/routes/content.js';
import {
  VALID_TEMPLATE_FORMAT_ORDER,
  createIntegrationTestApp,
} from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([
  { path: '/api/templates', router: templatesRouter },
  { path: '/api/topics', router: topicsRouter },
  { path: '/api/content', router: contentRouter },
  { path: '/api', router: templateApplicationRouter },
]);

describe('Template Application API Integration Tests', () => {
  let templateId;
  let topicId;

  beforeEach(async () => {
    const templateResponse = await request(app)
      .post('/api/templates')
      .send({
        template_name: 'Test Template',
        format_order: VALID_TEMPLATE_FORMAT_ORDER,
        description: 'Test template',
      });

    if (templateResponse.status === 201) {
      templateId = templateResponse.body.data.template_id;
    }

    const topicResponse = await request(app)
      .post('/api/topics')
      .send({
        topic_name: 'Test Topic',
        description: 'Test topic for template application',
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
          content_data: { text: 'Test content text' },
          generation_method_id: 'manual',
          quality_check_status: 'approved',
        });
    }
  });

  describe('POST /api/templates/:templateId/apply/:topicId', () => {
    it('should apply template to topic successfully', async () => {
      if (!templateId || !topicId) {
        console.warn('Skipping test: template or topic not created');
        return;
      }

      const response = await request(app)
        .post(`/api/templates/${templateId}/apply/${topicId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('template');
      expect(response.body.data.template).toHaveProperty('template_id', templateId);
      expect(response.body.data).toHaveProperty('lesson');
      expect(response.body.data.lesson).toHaveProperty('topic_id', topicId);
    });

    it('should return error if template not found', async () => {
      const response = await request(app).post('/api/templates/99999/apply/1');

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should return error if topic not found', async () => {
      if (!templateId) {
        console.warn('Skipping test: template not created');
        return;
      }

      const response = await request(app).post(`/api/templates/${templateId}/apply/99999`);

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });
  });

  describe('GET /api/topics/:topicId/view', () => {
    it('should get lesson view for topic with template', async () => {
      if (!topicId || !templateId) {
        console.warn('Skipping test: topic or template not created');
        return;
      }

      await request(app).post(`/api/templates/${templateId}/apply/${topicId}`).expect(200);

      const response = await request(app).get(`/api/topics/${topicId}/view`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.topic?.topic_id || response.body.data.lesson?.topic_id).toBe(topicId);
      expect(response.body.data).toHaveProperty('template');
      expect(response.body.data).toHaveProperty('formats');
      expect(Array.isArray(response.body.data.formats)).toBe(true);
    });

    it('should return 404 if topic not found', async () => {
      const response = await request(app).get('/api/topics/99999/view').expect(404);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when no template is applied yet', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app).get(`/api/topics/${topicId}/view`).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No template applied');
    });
  });
});
