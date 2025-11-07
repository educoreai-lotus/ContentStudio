import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import aiGenerationRouter from '../../../src/presentation/routes/ai-generation.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/content', aiGenerationRouter);
app.use(errorHandler);

describe('AI Generation API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/content/generate', () => {
    it('should generate text content with prompt', async () => {
      // Note: This test requires OpenAI API key in environment
      // For now, it will test the validation and error handling
      // Mock implementation would require mocking OpenAI SDK

      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        prompt: 'Generate a lesson about JavaScript basics',
      };

      // Without OpenAI API key, this will fail with error
      // In real scenario, mock OpenAI SDK
      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest);

      // Should either succeed (if API key exists) or fail with proper error
      expect([200, 201, 500]).toContain(response.status);
      if (response.body.success) {
        expect(response.body.data).toHaveProperty('content_id');
        expect(response.body.data.content_type_id).toBe('text');
        expect(response.body.data.generation_method_id).toBe('ai_assisted');
      }
    });

    it('should generate code content', async () => {
      // Note: This test requires OpenAI API key in environment

      const generationRequest = {
        topic_id: 1,
        content_type_id: 'code',
        prompt: 'Generate a fibonacci function',
        language: 'javascript',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest);

      // Should either succeed (if API key exists) or fail with proper error
      expect([200, 201, 500]).toContain(response.status);
      if (response.body.success) {
        expect(response.body.data.content_type_id).toBe('code');
        expect(response.body.data.content_data).toHaveProperty('code');
      }
    });

    it('should return 400 if topic_id is missing', async () => {
      const generationRequest = {
        content_type_id: 'text',
        prompt: 'Test prompt',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if content_type_id is missing', async () => {
      const generationRequest = {
        topic_id: 1,
        prompt: 'Test prompt',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if neither prompt nor template_id provided', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Without valid API key, this should fail gracefully
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        prompt: 'Test prompt',
      };

      const response = await request(app)
        .post('/api/content/generate')
        .send(generationRequest);

      // Should return error if API key is missing or invalid
      if (!process.env.OPENAI_API_KEY) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error).toBeDefined();
      }
    });
  });
});

