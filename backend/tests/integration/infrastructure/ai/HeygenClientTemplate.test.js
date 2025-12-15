/**
 * Integration tests for HeyGen Template v2 generate endpoint
 * Uses HTTP mocking to verify correct URL path and payload
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import { HeygenClient } from '../../../../src/infrastructure/ai/HeygenClient.js';
import * as LoggerModule from '../../../../src/infrastructure/logging/Logger.js';

// Mock axios to intercept HTTP requests
jest.mock('axios');

describe('HeygenClient - Template v2 Generate Integration', () => {
  let client;
  let mockAxiosPost;
  let loggerSpy;
  const apiKey = 'test-api-key-123';
  const baseURL = 'https://api.heygen.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on logger
    loggerSpy = {
      info: jest.spyOn(LoggerModule.logger, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(LoggerModule.logger, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(LoggerModule.logger, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(LoggerModule.logger, 'debug').mockImplementation(() => {}),
    };

    // Create axios instance mock
    const mockPost = jest.fn();
    const mockGet = jest.fn();
    
    const axiosCreate = jest.fn(() => ({
      post: mockPost,
      get: mockGet,
    }));

    // Mock axios.create
    axios.create = axiosCreate;

    // Create client
    client = new HeygenClient({ apiKey });

    // Get the mocked post function
    mockAxiosPost = mockPost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateTemplateVideo - URL Path', () => {
    it('should call correct endpoint with template_id in path', async () => {
      const templateId = 'template-abc-123';
      const payload = {
        title: 'Test Template',
        variables: {
          image_1: { url: 'https://example.com/slide1.png' },
          speech_1: 'First slide text',
        },
      };

      // Mock successful response
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: 'video-123',
          },
        },
      });

      await client.generateTemplateVideo(templateId, payload);

      // Verify correct endpoint was called
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `/v2/template/${templateId}/generate`,
        payload
      );
    });

    it('should handle template_id with special characters in URL', async () => {
      const templateId = 'template-123_abc-def';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: 'video-123',
          },
        },
      });

      await client.generateTemplateVideo(templateId, payload);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        `/v2/template/${templateId}/generate`,
        expect.any(Object)
      );
    });
  });

  describe('generateTemplateVideo - Payload', () => {
    it('should send correct JSON payload with variables', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'My Presentation',
        variables: {
          image_1: { url: 'https://example.com/slide1.png' },
          speech_1: 'First slide narration',
          image_2: { image: { name: 'slide2', url: 'https://example.com/slide2.png' } },
          speech_2: 'Second slide narration',
        },
        caption_settings: {
          enabled: true,
        },
        voice_id: 'voice-456',
      };

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: 'video-789',
          },
        },
      });

      await client.generateTemplateVideo(templateId, payload);

      // Verify payload was sent correctly
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        payload
      );

      // Verify payload structure
      const callArgs = mockAxiosPost.mock.calls[0];
      const sentPayload = callArgs[1];

      expect(sentPayload).toHaveProperty('title', 'My Presentation');
      expect(sentPayload).toHaveProperty('variables');
      expect(sentPayload.variables).toHaveProperty('image_1');
      expect(sentPayload.variables.image_1).toEqual({ image: { name: 'slide1', url: 'https://example.com/slide1.png' } });
      expect(sentPayload.variables).toHaveProperty('speech_1', 'First slide narration');
      expect(sentPayload.variables).toHaveProperty('image_2');
      expect(sentPayload.variables.image_2).toEqual({ image: { name: 'slide2', url: 'https://example.com/slide2.png' } });
      expect(sentPayload.variables).toHaveProperty('speech_2', 'Second slide narration');
      expect(sentPayload).toHaveProperty('caption_settings');
      expect(sentPayload.caption_settings).toHaveProperty('enabled', true);
      expect(sentPayload).toHaveProperty('voice_id', 'voice-456');
    });

    it('should send payload with all 10 slides', async () => {
      const templateId = 'template-123';
      const variables = {};
      
      // Build variables for 10 slides
      for (let i = 1; i <= 10; i++) {
        variables[`image_${i}`] = { image: { name: `slide${i}`, url: `https://example.com/slide${i}.png` } };
        variables[`speech_${i}`] = `Slide ${i} narration`;
      }

      const payload = {
        title: '10 Slide Presentation',
        variables,
      };

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: 'video-123',
          },
        },
      });

      await client.generateTemplateVideo(templateId, payload);

      const callArgs = mockAxiosPost.mock.calls[0];
      const sentPayload = callArgs[1];

      // Verify all 10 slides are present
      for (let i = 1; i <= 10; i++) {
        expect(sentPayload.variables).toHaveProperty(`image_${i}`);
        expect(sentPayload.variables).toHaveProperty(`speech_${i}`);
      }

      // Verify no extra slides
      expect(sentPayload.variables).not.toHaveProperty('image_11');
      expect(sentPayload.variables).not.toHaveProperty('speech_11');
    });
  });

  describe('generateTemplateVideo - Response Handling', () => {
    it('should return video_id from successful response', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      const expectedVideoId = 'video-abc-123';

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: expectedVideoId,
          },
        },
      });

      const result = await client.generateTemplateVideo(templateId, payload);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('video_id', expectedVideoId);
      expect(result).toHaveProperty('template_id', templateId);
    });

    it('should handle response with video_id at root level', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      const expectedVideoId = 'video-xyz-789';

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          video_id: expectedVideoId, // At root level, not in data
        },
      });

      const result = await client.generateTemplateVideo(templateId, payload);

      expect(result.video_id).toBe(expectedVideoId);
    });
  });

  describe('generateTemplateVideo - Error Handling', () => {
    it('should throw error with status code and response body for 4xx errors', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      const errorResponse = {
        status: 400,
        statusText: 'Bad Request',
        data: {
          message: 'Invalid template_id',
          error_code: 'INVALID_TEMPLATE',
          details: 'Template not found',
        },
      };

      mockAxiosPost.mockRejectedValueOnce({
        response: errorResponse,
        message: 'Request failed with status code 400',
      });

      try {
        await client.generateTemplateVideo(templateId, payload);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Template video generation failed');
        expect(error.message).toContain('Status: 400');
        expect(error.message).toContain('Invalid template_id');
      }
    });

    it('should retry on transient 5xx errors', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      // First two attempts fail with 500, third succeeds
      mockAxiosPost
        .mockRejectedValueOnce({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: { message: 'Server error' },
          },
          message: 'Request failed with status code 500',
        })
        .mockRejectedValueOnce({
          response: {
            status: 503,
            statusText: 'Service Unavailable',
            data: { message: 'Service temporarily unavailable' },
          },
          message: 'Request failed with status code 503',
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: {
              video_id: 'video-success',
            },
          },
        });

      const result = await client.generateTemplateVideo(templateId, payload, {
        maxRetries: 2,
        retryDelay: 10, // Short delay for testing
      });

      expect(result.video_id).toBe('video-success');
      expect(mockAxiosPost).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    }, 30000); // Increase timeout for retries

    it('should throw error after max retries on persistent 5xx errors', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      // All attempts fail with 500
      mockAxiosPost
        .mockRejectedValueOnce({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: {
              message: 'Persistent server error',
              error_code: 'SERVER_ERROR',
            },
          },
          message: 'Request failed with status code 500',
        })
        .mockRejectedValueOnce({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: {
              message: 'Persistent server error',
              error_code: 'SERVER_ERROR',
            },
          },
          message: 'Request failed with status code 500',
        })
        .mockRejectedValueOnce({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: {
              message: 'Persistent server error',
              error_code: 'SERVER_ERROR',
            },
          },
          message: 'Request failed with status code 500',
        });

      await expect(
        client.generateTemplateVideo(templateId, payload, {
          maxRetries: 2,
          retryDelay: 10, // Short delay for testing
        })
      ).rejects.toThrow('Template video generation failed');

      // Should have tried maxRetries + 1 times (initial + retries)
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    }, 30000); // Increase timeout for retries

    it('should not retry on 4xx errors', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {
            message: 'Template not found',
          },
        },
        message: 'Request failed with status code 404',
      });

      await expect(
        client.generateTemplateVideo(templateId, payload)
      ).rejects.toThrow('Template video generation failed');

      // Should not retry on 4xx
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });

    it('should throw error when video_id is missing from response', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            // No video_id
          },
        },
      });

      await expect(
        client.generateTemplateVideo(templateId, payload)
      ).rejects.toThrow('HeyGen did not return a video_id');

      await expect(
        client.generateTemplateVideo(templateId, payload)
      ).rejects.toThrow('Response:');
    });
  });

  describe('generateTemplateVideo - Validation', () => {
    it('should throw error if client is not configured', async () => {
      const unconfiguredClient = new HeygenClient({ apiKey: null });

      await expect(
        unconfiguredClient.generateTemplateVideo('template-123', {})
      ).rejects.toThrow('Heygen client not configured');
    });

    it('should throw error if templateId is missing', async () => {
      await expect(
        client.generateTemplateVideo('', { title: 'Test', variables: {} })
      ).rejects.toThrow('templateId is required');

      await expect(
        client.generateTemplateVideo(null, { title: 'Test', variables: {} })
      ).rejects.toThrow('templateId is required');
    });

    it('should throw error if payload is missing', async () => {
      await expect(
        client.generateTemplateVideo('template-123', null)
      ).rejects.toThrow('payload is required');

      await expect(
        client.generateTemplateVideo('template-123', undefined)
      ).rejects.toThrow('payload is required');
    });
  });

  describe('generateTemplateVideo - Logging', () => {
    it('should log info on successful generation', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            video_id: 'video-123',
          },
        },
      });

      await client.generateTemplateVideo(templateId, payload);

      expect(loggerSpy.info).toHaveBeenCalledWith(
        '[HeyGen] Generating template video',
        expect.objectContaining({
          templateId,
          attempt: 1,
        })
      );

      expect(loggerSpy.info).toHaveBeenCalledWith(
        '[HeyGen] Template video generation initiated',
        expect.objectContaining({
          templateId,
          videoId: 'video-123',
        })
      );
    });

    it('should log warning on retry', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost
        .mockRejectedValueOnce({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: { message: 'Server error' },
          },
          message: 'Request failed with status code 500',
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: {
              video_id: 'video-123',
            },
          },
        });

      await client.generateTemplateVideo(templateId, payload, {
        maxRetries: 1,
        retryDelay: 10, // Short delay for testing
      });

      expect(loggerSpy.warn).toHaveBeenCalledWith(
        '[HeyGen] Transient error, retrying template generation',
        expect.objectContaining({
          templateId,
          isTransientError: true,
          willRetry: true,
        })
      );
    }, 30000); // Increase timeout for retries

    it('should log error on failure', async () => {
      const templateId = 'template-123';
      const payload = {
        title: 'Test',
        variables: {},
      };

      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Invalid payload',
            error_code: 'INVALID_REQUEST',
          },
        },
        message: 'Request failed',
      });

      await expect(
        client.generateTemplateVideo(templateId, payload)
      ).rejects.toThrow();

      expect(loggerSpy.error).toHaveBeenCalledWith(
        '[HeyGen] Template video generation failed',
        expect.objectContaining({
          templateId,
          statusCode: 400,
          errorMessage: expect.any(String),
        })
      );
    });
  });
});

