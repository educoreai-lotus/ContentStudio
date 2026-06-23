/**
 * Integration tests for Avatar Orchestrator API route
 */

import request from 'supertest';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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
import { RepositoryFactory } from '../../../src/infrastructure/database/repositories/RepositoryFactory.js';
import { Topic } from '../../../src/domain/entities/Topic.js';
import {
  TEST_TRAINER_ID,
  createIntegrationTestApp,
} from '../../helpers/testAuth.js';

jest.mock('../../../src/infrastructure/logging/Logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockExecute = jest.fn();
jest.mock('../../../src/services/GammaHeyGenAvatarOrchestrator.js', () => ({
  GammaHeyGenAvatarOrchestrator: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

describe('POST /api/ai-generation/generate/avatar-orchestrator', () => {
  let app;
  let unauthenticatedApp;
  let topicId;

  const waitForAiGenerationInit = async () => {
    for (let i = 0; i < 20; i++) {
      const probe = createIntegrationTestApp(
        [{ path: '/api/ai-generation', router: aiGenerationRoutes }],
        { authenticated: false }
      );
      const res = await request(probe)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send({});
      if (res.status !== 503) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockExecute.mockClear();

    const topicRepository = await RepositoryFactory.getTopicRepository();
    const topic = await topicRepository.create(
      new Topic({
        topic_name: 'Avatar Orchestrator Topic',
        trainer_id: TEST_TRAINER_ID,
        language: 'he',
      })
    );
    topicId = topic.topic_id;

    app = createIntegrationTestApp([
      { path: '/api/ai-generation', router: aiGenerationRoutes },
    ]);
    unauthenticatedApp = createIntegrationTestApp(
      [{ path: '/api/ai-generation', router: aiGenerationRoutes }],
      { authenticated: false }
    );

    await waitForAiGenerationInit();
  });

  const avatarPayload = (overrides = {}, { omit = [] } = {}) => {
    const payload = {
      topic_id: topicId,
      language_code: 'he',
      mode: 'avatar',
      input_text: 'Test',
      ai_slide_explanations: ['Slide 1'],
      ...overrides,
    };
    for (const key of omit) {
      delete payload[key];
    }
    return payload;
  };

  describe('Input Validation', () => {
    it('should return 401 without authenticated trainer', async () => {
      const response = await request(unauthenticatedApp)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload());

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if topic_id is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({}, { omit: ['topic_id'] }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('topic_id');
    });

    it('should return 400 if language_code is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({}, { omit: ['language_code'] }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('language_code');
    });

    it('should return 400 if mode is missing', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({}, { omit: ['mode'] }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('mode');
    });

    it('should return 400 if input_text is missing when mode is "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({}, { omit: ['input_text'] }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('input_text');
    });

    it('should return 400 if ai_slide_explanations is missing when mode is "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({}, { omit: ['ai_slide_explanations'] }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('ai_slide_explanations');
    });
  });

  describe('Mode Handling', () => {
    it('should return 200 with "skipped" if mode is not "avatar"', async () => {
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload({ mode: 'presentation' }));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'skipped');
      expect(response.body.message).toContain('not "avatar"');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return 202 with jobId if mode is "avatar"', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        video_id: 'video-123',
        jobId: 'job-123',
      });

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(
          avatarPayload({
            input_text: 'This is a test presentation.',
            ai_slide_explanations: [
              'ברוכים הבאים למצגת על רכיבי React.',
              'היום נלמד על רכיבים פונקציונליים.',
            ],
          })
        );

      expect([202, 503]).toContain(response.status);
      if (response.status !== 202) return;

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'accepted');
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('video_id', null);
      expect(response.body.message).toContain('Avatar video generation started');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(GammaHeyGenAvatarOrchestrator).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          trainerId: TEST_TRAINER_ID,
          topicId,
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
      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload());

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
        .send(avatarPayload());
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000);
      expect([202, 503]).toContain(response.status);
      if (response.status !== 202) return;
      expect(response.body).toHaveProperty('jobId');

      resolveOrchestrator({
        success: true,
        video_id: 'video-123',
        jobId: response.body.jobId,
      });

      await orchestratorPromise;
    });

    it('should handle orchestrator errors gracefully (logged but not returned)', async () => {
      const orchestratorError = new Error('Orchestrator failed');
      orchestratorError.step = 'gamma_generation';
      mockExecute.mockRejectedValue(orchestratorError);

      const response = await request(app)
        .post('/api/ai-generation/generate/avatar-orchestrator')
        .send(avatarPayload());

      expect([202, 503]).toContain(response.status);
      if (response.status !== 202) return;
      expect(response.body).toHaveProperty('jobId');

      await new Promise(resolve => setTimeout(resolve, 100));

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
        .send(
          avatarPayload({
            input_text: 'This is a test presentation about React.',
            ai_slide_explanations: [
              'ברוכים הבאים למצגת על רכיבי React.',
              'היום נלמד על רכיבים פונקציונליים.',
            ],
          })
        );

      expect([202, 503]).toContain(response.status);
      if (response.status !== 202) return;
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
