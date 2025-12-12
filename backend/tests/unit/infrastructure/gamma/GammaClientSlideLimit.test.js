/**
 * Test suite for Gamma Client Slide Limit
 * Validates hard limit of 10 slides for Gamma presentation generation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GammaClient } from '../../../../src/infrastructure/gamma/GammaClient.js';
import axios from 'axios';
import { logger } from '../../../../src/infrastructure/logging/Logger.js';

// Mock axios module
let mockPost, mockGet;

describe('GammaClient Slide Limit', () => {
  let gammaClient;
  let mockStorageClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock storage client
    mockStorageClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      uploadFile: jest.fn().mockResolvedValue({
        url: 'https://storage.example.com/presentation.pptx',
        path: 'presentations/test.pptx',
      }),
    };

    // Setup axios mocks
    mockPost = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        generationId: 'test-generation-id',
      },
    });

    mockGet = jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({
        data: {
          status: 'completed',
          result: {
            exportUrl: 'https://gamma.app/export/test.pptx',
            gammaUrl: 'https://gamma.app/test',
          },
        },
      })
      .mockResolvedValueOnce({
        data: Buffer.from('fake-pptx-content'),
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
      });

    // Mock logger
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    gammaClient = new GammaClient({
      apiKey: 'test-api-key',
      storageClient: mockStorageClient,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('maxSlides parameter', () => {
    it('should use default maxSlides of 10 when not provided', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
      });

      // Verify that the POST request includes slide limit instruction
      expect(mockPost).toHaveBeenCalled();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      
      expect(payload.inputText).toContain('exactly 10 slides');
      expect(payload.inputText).toContain('no more than 10 slides');
    });

    it('should use provided maxSlides when less than 10', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 5,
      });

      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      
      expect(payload.inputText).toContain('exactly 5 slides');
      expect(payload.inputText).toContain('no more than 5 slides');
    });

    it('should enforce hard limit of 10 when maxSlides exceeds 10', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 20,
      });

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        '[GammaClient] Requested slides exceed hard limit, enforcing limit',
        expect.objectContaining({
          requested: 20,
          enforced: 10,
        })
      );

      // Verify that the POST request uses 10 slides, not 20
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      
      expect(payload.inputText).toContain('exactly 10 slides');
      expect(payload.inputText).toContain('no more than 10 slides');
      expect(payload.inputText).not.toContain('20 slides');
    });

    it('should enforce hard limit of 10 when maxSlides equals 10', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 10,
      });

      // Verify no warning was logged (exactly at limit)
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Requested slides exceed hard limit'),
        expect.anything()
      );

      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      
      expect(payload.inputText).toContain('exactly 10 slides');
    });

    it('should enforce minimum of 1 slide (0 → 1)', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 0,
      });

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        '[GammaClient] Requested slides is less than minimum, enforcing minimum',
        expect.objectContaining({
          requested: 0,
          enforced: 1,
        })
      );

      // Verify that the POST request uses 1 slide, not 0
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      
      expect(payload.inputText).toContain('exactly 1 slides');
      expect(payload.inputText).not.toContain('0 slides');
    });

    it('should use Math.max and Math.min to enforce limits correctly', async () => {
      const testCases = [
        { requested: 0, expected: 1, shouldWarn: true, warnType: 'minimum' }, // Edge case: 0 → 1
        { requested: 1, expected: 1, shouldWarn: false },
        { requested: 5, expected: 5, shouldWarn: false },
        { requested: 10, expected: 10, shouldWarn: false },
        { requested: 15, expected: 10, shouldWarn: true, warnType: 'maximum' },
        { requested: 100, expected: 10, shouldWarn: true, warnType: 'maximum' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        await gammaClient.generatePresentation('Test content', {
          topicName: 'Test',
          language: 'en',
          maxSlides: testCase.requested,
        });

        const callArgs = mockPost.mock.calls[0];
        const payload = callArgs[1];
        
        // Should always contain the expected number of slides (never 0)
        expect(payload.inputText).toContain(`exactly ${testCase.expected} slides`);
        expect(payload.inputText).not.toContain('0 slides'); // Never allow 0 slides

        if (testCase.shouldWarn) {
          if (testCase.warnType === 'maximum') {
            expect(logger.warn).toHaveBeenCalledWith(
              '[GammaClient] Requested slides exceed hard limit, enforcing limit',
              expect.objectContaining({
                requested: testCase.requested,
                enforced: 10,
              })
            );
          } else if (testCase.warnType === 'minimum') {
            expect(logger.warn).toHaveBeenCalledWith(
              '[GammaClient] Requested slides is less than minimum, enforcing minimum',
              expect.objectContaining({
                requested: testCase.requested,
                enforced: 1,
              })
            );
          }
        } else {
          // Should not warn for valid requests
          expect(logger.warn).not.toHaveBeenCalled();
        }
      }
    });

    it('should not fail when maxSlides exceeds limit', async () => {
      const inputText = 'Test presentation content';
      
      // Should not throw error
      await expect(
        gammaClient.generatePresentation(inputText, {
          topicName: 'Test Topic',
          language: 'en',
          maxSlides: 50,
        })
      ).resolves.toBeDefined();

      // Should have logged warning but continued
      expect(logger.warn).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalled();
    });

    it('should include maxSlides in log info', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 7,
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[GammaClient] Generating presentation with Gamma Public API',
        expect.objectContaining({
          maxSlides: 7,
          requestedSlides: 7,
        })
      );
    });

    it('should log requested vs enforced slides when limit is exceeded', async () => {
      const inputText = 'Test presentation content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        maxSlides: 25,
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[GammaClient] Generating presentation with Gamma Public API',
        expect.objectContaining({
          maxSlides: 10, // enforced
          requestedSlides: 25, // original request
        })
      );
    });
  });
});

