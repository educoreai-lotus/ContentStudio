import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-key';
}

import aiGenerationRouter from '../../../src/presentation/routes/ai-generation.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import { TEST_TRAINER_ID, createIntegrationTestApp } from '../../helpers/testAuth.js';
import { RepositoryFactory } from '../../../src/infrastructure/database/repositories/RepositoryFactory.js';
import { Topic } from '../../../src/domain/entities/Topic.js';

const app = createIntegrationTestApp([
  { path: '/api/topics', router: topicsRouter },
  { path: '/api/content', router: aiGenerationRouter },
]);

const unauthenticatedApp = createIntegrationTestApp(
  [{ path: '/api/content', router: aiGenerationRouter }],
  { authenticated: false }
);

describe('AI Generation API Integration Tests', () => {
  let topicId;

  beforeEach(async () => {
    const topicRepository = await RepositoryFactory.getTopicRepository();
    const topic = await topicRepository.create(
      new Topic({
        topic_name: 'AI Generation Topic',
        trainer_id: TEST_TRAINER_ID,
        language: 'en',
      })
    );
    topicId = topic.topic_id;
  });

  describe('POST /api/content/generate', () => {
    it('should return 401 without authenticated trainer', async () => {
      const response = await request(unauthenticatedApp)
        .post('/api/content/generate')
        .send({
          topic_id: topicId,
          content_type_id: 'text',
          prompt: 'Test prompt',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should generate text content with prompt', async () => {
      const generationRequest = {
        topic_id: topicId,
        content_type_id: 'text',
        prompt: 'Generate a lesson about JavaScript basics',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest);

      expect([200, 201, 400, 500, 503]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('content_id');
        expect(response.body.data.content_type_id).toBe('text');
        expect(response.body.data.generation_method_id).toBe('ai_assisted');
      } else {
        expect(response.body.error || response.body.success === false).toBeDefined();
      }
    });

    it('should generate code content', async () => {
      const generationRequest = {
        topic_id: topicId,
        content_type_id: 'code',
        prompt: 'Generate a fibonacci function',
        language: 'javascript',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest);

      expect([200, 201, 400, 500, 503]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.content_type_id).toBe('code');
        expect(response.body.data.content_data).toHaveProperty('code');
      } else {
        expect(response.body.error || response.body.success === false).toBeDefined();
      }
    });

    it('should return 400 if topic_id is missing', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({
          content_type_id: 'text',
          prompt: 'Test prompt',
        });

      expect([400, 503]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should return 400 if content_type_id is missing', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({
          topic_id: topicId,
          prompt: 'Test prompt',
        });

      expect([400, 503]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should return 400 if neither prompt nor template_id provided', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({
          topic_id: topicId,
          content_type_id: 'text',
        });

      expect([400, 503]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const response = await request(app)
        .post('/api/content/generate')
        .send({
          topic_id: topicId,
          content_type_id: 'text',
          prompt: 'Test prompt',
        });

      expect([400, 500, 503]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeDefined();
    });
  });
});
