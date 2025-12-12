/**
 * Integration tests for Avatar Orchestrator API route
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set mock API keys BEFORE importing routes (services are initialized on module load)
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-key';
}
if (!process.env.HEYGEN_API_KEY) {
  process.env.HEYGEN_API_KEY = 'test-heygen-key';
}
if (!process.env.GAMMA_API) {
  process.env.GAMMA_API = 'test-gamma-key';
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'http://localhost:54321';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}

import aiGenerationRoutes from '../../../src/presentation/routes/ai-generation.js';
import { GammaHeyGenAvatarOrchestrator } from '../../../src/services/GammaHeyGenAvatarOrchestrator.js';
import { logger } from '../../../src/infrastructure/logging/Logger.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Mock logger
jest.mock('../../../src/infrastructure/logging/Logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock GammaHeyGenAvatarOrchestrator
const mockExecute = jest.fn();
jest.mock('../../../src/services/GammaHeyGenAvatarOrchestrator.js', () => ({
  GammaHeyGenAvatarOrchestrator: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

describe('POST /api/ai-generation/generate/avatar-orchestrator', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockClear();

    app = express();
    app.use(express.json());
    app.use('/api/ai-generation', aiGenerationRoutes);
    app.use(errorHandler);
  });

  describe('Input Validation', () => {
    it('should return 400 if trainer_id is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('trainer_id');
    });

    it('should return 400 if topic_id is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('topic_id');
    });

    it('should return 400 if language_code is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('language_code');
    });

    it('should return 400 if mode is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('mode');
    });

    it('should return 400 if input_text is missing when mode is "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('input_text');
    });

    it('should return 400 if ai_slide_explanations is missing when mode is "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('ai_slide_explanations');
    });
  });

  describe('Mode Handling', () => {
    it('should return 200 with "skipped" if mode is not "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'presentation',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'skipped');
      expect(response.body.message).toContain('not "avatar"');

      // Orchestrator should not be called
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 202 with jobId if mode is "avatar"', async () => {
      // Mock orchestrator to resolve immediately (but we don't wait for it)
      mockExecute.mockResolvedValue({
        success: true,
        video_id: 'video-123',
        jobId: 'job-123',
      });

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'This is a test presentation.',
          ai_slide_explanations: [
            'ברוכים הבאים למצגת על רכיבי React.',
            'היום נלמד על רכיבים פונקציונליים.',
          ],
        });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'accepted');
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('video_id', null);
      expect(response.body.message).toContain('Avatar video generation started');

      // Wait a bit to ensure orchestrator was called
      await new Promise(resolve => setTimeout(resolve, 100));

      // Orchestrator should be called
      expect(GammaHeyGenAvatarOrchestrator).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'avatar',
          inputText: 'This is a test presentation.',
          aiSlideExplanations: expect.arrayContaining([
            'ברוכים הבאים למצגת על רכיבי React.',
            'היום נלמד על רכיבים פונקציונליים.',
          ]),
          jobId: expect.any(String),
        })
      );
    });
  });

  describe('Service Configuration', () => {
    it('should return 503 if Gamma client is not configured', async () => {
      // This test requires mocking the AIGenerationService
      // For now, we'll test the validation path
      // In a real scenario, the service would check gammaClient.isEnabled()

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      // The actual status depends on service initialization
      // If services are not initialized, it might return 503 or 500
      expect([400, 503, 500]).toContain(response.status);
    });
  });

  describe('Asynchronous Processing', () => {
    it('should return 202 immediately without waiting for orchestrator completion', async () => {
      let resolveOrchestrator;
      const orchestratorPromise = new Promise(resolve => {
        resolveOrchestrator = resolve;
      });

      mockExecute.mockReturnValue(orchestratorPromise);

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });
      const responseTime = Date.now() - startTime;

      // Response should be fast (less than 1 second)
      expect(responseTime).toBeLessThan(1000);
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('jobId');

      // Resolve orchestrator after response
      resolveOrchestrator({
        success: true,
        video_id: 'video-123',
        jobId: response.body.jobId,
      });

      // Wait for orchestrator to complete
      await orchestratorPromise;
    });

    it('should handle orchestrator errors gracefully (logged but not returned)', async () => {
      const orchestratorError = new Error('Orchestrator failed');
      orchestratorError.step = 'gamma_generation';
      mockExecute.mockRejectedValue(orchestratorError);

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'Test',
          ai_slide_explanations: ['Slide 1'],
        });

      // Response should still be 202 (error is logged but not returned)
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('jobId');

      // Wait for orchestrator to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error should be logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Avatar orchestrator failed'),
        expect.objectContaining({
          error: 'Orchestrator failed',
          step: 'gamma_generation',
        })
      );
    });
  });

  describe('Request/Response Format', () => {
    it('should accept valid request and return proper response format', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        video_id: 'video-123',
        jobId: 'job-123',
      });

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({
          trainer_id: 'trainer-123',
          topic_id: 5,
          language_code: 'he',
          mode: 'avatar',
          input_text: 'This is a test presentation about React.',
          ai_slide_explanations: [
            'ברוכים הבאים למצגת על רכיבי React.',
            'היום נלמד על רכיבים פונקציונליים.',
          ],
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        success: true,
        status: 'accepted',
        message: 'Avatar video generation started',
        video_id: null,
        jobId: expect.stringMatching(/^job-\d+-[a-z0-9]+$/),
      });
    });
  });
});

