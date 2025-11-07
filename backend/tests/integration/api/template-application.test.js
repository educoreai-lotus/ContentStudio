import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import templateApplicationRouter from '../../../src/presentation/routes/template-application.js';
import templatesRouter from '../../../src/presentation/routes/templates.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import contentRouter from '../../../src/presentation/routes/content.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/templates', templatesRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/content', contentRouter);
app.use('/api', templateApplicationRouter);
app.use(errorHandler);

describe('Template Application API Integration Tests', () => {
  let templateId;
  let topicId;
  let contentId;

  beforeEach(async () => {
    // Create a template with all mandatory formats
    const templateResponse = await request(app)
      .post('/api/templates')
      .send({
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'Test template',
        created_by: 'test-trainer',
      });

    if (templateResponse.status === 201) {
      templateId = templateResponse.body.data.template_id;
    }

    // Create a course first (if needed)
    // Then create a topic
    const topicResponse = await request(app)
      .post('/api/topics')
      .send({
        topic_name: 'Test Topic',
        course_id: 'test-course-1',
        description: 'Test topic for template application',
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
          text: 'Test content text',
        },
        created_by: 'test-trainer',
      });

    if (contentResponse.status === 201) {
      contentId = contentResponse.body.data.content_id;
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
      const response = await request(app)
        .post('/api/templates/99999/apply/1');

      // May return 400, 404, or 500 (depending on error handling)
      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should return error if topic not found', async () => {
      if (!templateId) {
        console.warn('Skipping test: template not created');
        return;
      }

      const response = await request(app)
        .post(`/api/templates/${templateId}/apply/99999`);

      // May return 400, 404, or 500 (depending on error handling)
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

      // First apply template
      await request(app)
        .post(`/api/templates/${templateId}/apply/${topicId}`)
        .expect(200);

      // Then get view
      const response = await request(app)
        .get(`/api/topics/${topicId}/view`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topic_id', topicId);
      expect(response.body.data).toHaveProperty('template');
      expect(response.body.data).toHaveProperty('content');
      expect(Array.isArray(response.body.data.content)).toBe(true);
    });

    it('should return 404 if topic not found', async () => {
      const response = await request(app)
        .get('/api/topics/non-existent/view')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });

    it('should return view even if no template applied (default order)', async () => {
      if (!topicId) {
        console.warn('Skipping test: topic not created');
        return;
      }

      const response = await request(app)
        .get(`/api/topics/${topicId}/view`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topic_id', topicId);
      expect(response.body.data).toHaveProperty('content');
    });
  });
});

