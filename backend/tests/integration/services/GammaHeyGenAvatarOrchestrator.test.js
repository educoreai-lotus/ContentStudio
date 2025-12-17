/**
 * End-to-end integration test for GammaHeyGenAvatarOrchestrator
 * Tests the complete pipeline with mocks for Gamma, extraction, and HeyGen
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GammaHeyGenAvatarOrchestrator, OrchestratorStepError } from '../../../src/services/GammaHeyGenAvatarOrchestrator.js';
import { logger } from '../../../src/infrastructure/logging/Logger.js';
import axios from 'axios';

// Mock logger
jest.mock('../../../src/infrastructure/logging/Logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('GammaHeyGenAvatarOrchestrator - End-to-End', () => {
  let orchestrator;
  let mockGammaClient;
  let mockStorageClient;
  let mockHeygenClient;
  let mockSlideImageExtractor;
  let mockSlideSpeechBuilder;
  let mockVoiceIdResolver;
  let mockTemplatePayloadBuilder;
  let axiosGetSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on axios.get for PPTX download
    axiosGetSpy = jest.spyOn(axios, 'get');

    // Mock GammaClient
    mockGammaClient = {
      generatePresentation: jest.fn(),
    };

    // Mock StorageClient
    mockStorageClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      uploadFile: jest.fn(),
    };

    // Mock HeygenClient
    mockHeygenClient = {
      generateTemplateVideo: jest.fn(),
    };

    // Mock SlideImageExtractor
    mockSlideImageExtractor = {
      extractSlideImages: jest.fn(),
    };

    // Mock SlideSpeechBuilder
    mockSlideSpeechBuilder = {
      buildSpeakerText: jest.fn(),
    };

    // Mock VoiceIdResolver
    mockVoiceIdResolver = {
      resolve: jest.fn(),
    };

    // Mock HeyGenTemplatePayloadBuilder
    mockTemplatePayloadBuilder = {
      buildPayload: jest.fn(),
    };

    orchestrator = new GammaHeyGenAvatarOrchestrator({
      gammaClient: mockGammaClient,
      storageClient: mockStorageClient,
      heygenClient: mockHeygenClient,
      templateId: '01a1ee50978a4517a86a3e0858a32d6a',
      slideImageExtractor: mockSlideImageExtractor,
      slideSpeechBuilder: mockSlideSpeechBuilder,
      voiceIdResolver: mockVoiceIdResolver,
      templatePayloadBuilder: mockTemplatePayloadBuilder,
    });
  });

  describe('execute - End-to-End Pipeline', () => {
    it('should execute complete pipeline successfully', async () => {
      const trainerId = 'trainer-123';
      const topicId = 5;
      const languageCode = 'he';
      const mode = 'avatar';
      const inputText = 'This is a test presentation about React components.';
      const aiSlideExplanations = [
        'ברוכים הבאים למצגת על רכיבי React.',
        'היום נלמד על רכיבים פונקציונליים.',
        'רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה.',
      ];

      // Step 1: Mock Gamma generation
      const mockGammaResult = {
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
        url: 'https://storage.example.com/presentations/test.pptx',
        path: 'presentations/test.pptx',
      };
      mockGammaClient.generatePresentation.mockResolvedValueOnce(mockGammaResult);

      // Mock PPTX download for Step 2
      const mockPptxBuffer = Buffer.from('fake-pptx-content');
      axiosGetSpy.mockResolvedValueOnce({
        data: mockPptxBuffer,
      });

      // Step 2: Mock image extraction
      const mockSlideImages = [
        { index: 1, imageUrl: 'https://storage.example.com/heygen/slides/job-123/slide-01.png' },
        { index: 2, imageUrl: 'https://storage.example.com/heygen/slides/job-123/slide-02.png' },
        { index: 3, imageUrl: 'https://storage.example.com/heygen/slides/job-123/slide-03.png' },
      ];
      mockSlideImageExtractor.extractSlideImages.mockResolvedValueOnce(mockSlideImages);

      // Step 3: Mock speech building
      const mockSlideSpeeches = [
        { index: 1, speakerText: 'ברוכים הבאים למצגת על רכיבי React.' },
        { index: 2, speakerText: 'היום נלמד על רכיבים פונקציונליים.' },
        { index: 3, speakerText: 'רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה.' },
      ];
      mockSlideSpeechBuilder.buildSpeakerText.mockReturnValueOnce(mockSlideSpeeches);

      // Step 5: Mock voice resolution
      const mockVoiceId = '4ebba0f2f4944d2aa75d21552764c638'; // Hebrew voice
      mockVoiceIdResolver.resolve.mockReturnValueOnce(mockVoiceId);

      // Step 6: Mock payload building
      const mockHeygenPayload = {
        template_id: '01a1ee50978a4517a86a3e0858a32d6a',
        title: 'EduCore Presentation - Topic 5',
        variables: {
          image_1: 'https://storage.example.com/heygen/slides/job-123/slide-01.png',
          speech_1: 'ברוכים הבאים למצגת על רכיבי React.',
          image_2: 'https://storage.example.com/heygen/slides/job-123/slide-02.png',
          speech_2: 'היום נלמד על רכיבים פונקציונליים.',
          image_3: 'https://storage.example.com/heygen/slides/job-123/slide-03.png',
          speech_3: 'רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה.',
        },
        caption_settings: {
          enabled: true,
        },
        voice_id: mockVoiceId,
      };
      mockTemplatePayloadBuilder.buildPayload.mockReturnValueOnce(mockHeygenPayload);

      // Step 7: Mock HeyGen template generation
      const mockHeygenResult = {
        success: true,
        video_id: 'video-heygen-123',
        template_id: '01a1ee50978a4517a86a3e0858a32d6a',
      };
      mockHeygenClient.generateTemplateVideo.mockResolvedValueOnce(mockHeygenResult);

      // Execute pipeline
      const result = await orchestrator.execute({
        trainerId,
        topicId,
        languageCode,
        mode,
        inputText,
        aiSlideExplanations,
      });

      // Verify result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('video_id', 'video-heygen-123');
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('jobState');

      // Verify job state
      expect(result.jobState).toHaveProperty('status', 'completed');
      expect(result.jobState).toHaveProperty('videoId', 'video-heygen-123');
      expect(result.jobState.steps).toHaveProperty('gammaGeneration');
      expect(result.jobState.steps).toHaveProperty('imageExtraction');
      expect(result.jobState.steps).toHaveProperty('speechBuilding');
      expect(result.jobState.steps).toHaveProperty('slidePlanCreation');
      expect(result.jobState.steps).toHaveProperty('voiceResolution');
      expect(result.jobState.steps).toHaveProperty('payloadBuilding');
      expect(result.jobState.steps).toHaveProperty('heygenGeneration');

      // Verify all steps were called
      expect(mockGammaClient.generatePresentation).toHaveBeenCalledWith(
        inputText,
        expect.objectContaining({
          topicName: `Topic ${topicId}`,
          language: languageCode,
          maxSlides: 10,
        })
      );

      expect(axiosGetSpy).toHaveBeenCalledWith(
        mockGammaResult.fileUrl,
        { responseType: 'arraybuffer' }
      );

      expect(mockSlideImageExtractor.extractSlideImages).toHaveBeenCalledWith(
        expect.any(Buffer),
        result.jobId,
        10,
        true // requireFullRendering: Avatar videos MUST use fully rendered slide images
      );

      expect(mockSlideSpeechBuilder.buildSpeakerText).toHaveBeenCalledWith(aiSlideExplanations);

      expect(mockVoiceIdResolver.resolve).toHaveBeenCalledWith(languageCode);

      expect(mockTemplatePayloadBuilder.buildPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: '01a1ee50978a4517a86a3e0858a32d6a',
          slides: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              imageUrl: expect.any(String),
              speakerText: expect.any(String),
            }),
          ]),
          title: expect.stringContaining('Topic 5'),
          caption: true,
          voiceId: mockVoiceId,
        })
      );

      expect(mockHeygenClient.generateTemplateVideo).toHaveBeenCalledWith(
        '01a1ee50978a4517a86a3e0858a32d6a',
        mockHeygenPayload
      );
    });

    it('should throw OrchestratorStepError if mode is not "avatar"', async () => {
      await expect(
        orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'presentation', // Wrong mode
          inputText: 'Test',
          aiSlideExplanations: [],
        })
      ).rejects.toThrow(OrchestratorStepError);

      await expect(
        orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'presentation',
          inputText: 'Test',
          aiSlideExplanations: [],
        })
      ).rejects.toThrow('validation');
    });

    it('should throw OrchestratorStepError with step field if Gamma generation fails', async () => {
      mockGammaClient.generatePresentation.mockRejectedValueOnce(
        new Error('Gamma API error: 401 Unauthorized')
      );

      try {
        await orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'avatar',
          inputText: 'Test',
          aiSlideExplanations: [],
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorStepError);
        expect(error.step).toBe('gamma_generation');
        expect(error.jobId).toBeTruthy();
        expect(error.message).toContain('gamma_generation');
      }
    });

    it('should throw OrchestratorStepError with step field if image extraction fails', async () => {
      mockGammaClient.generatePresentation.mockResolvedValueOnce({
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
      });

      axiosGetSpy.mockResolvedValueOnce({
        data: Buffer.from('fake-pptx'),
      });

      mockSlideImageExtractor.extractSlideImages.mockRejectedValueOnce(
        new Error('Failed to extract images: No images found in PPTX')
      );

      try {
        await orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'avatar',
          inputText: 'Test',
          aiSlideExplanations: [],
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorStepError);
        expect(error.step).toBe('image_extraction');
        expect(error.jobId).toBeTruthy();
      }
    });

    it('should throw OrchestratorStepError with step field if speech building fails', async () => {
      mockGammaClient.generatePresentation.mockResolvedValueOnce({
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
      });

      axiosGetSpy.mockResolvedValueOnce({
        data: Buffer.from('fake-pptx'),
      });

      mockSlideImageExtractor.extractSlideImages.mockResolvedValueOnce([
        { index: 1, imageUrl: 'https://example.com/slide1.png' },
      ]);

      mockSlideSpeechBuilder.buildSpeakerText.mockImplementation(() => {
        throw new Error('aiSlideExplanations cannot be empty');
      });

      try {
        await orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'avatar',
          inputText: 'Test',
          aiSlideExplanations: [], // Empty - will cause error
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorStepError);
        expect(error.step).toBe('speech_building');
        expect(error.jobId).toBeTruthy();
      }
    });

    it('should throw OrchestratorStepError with step field if HeyGen generation fails', async () => {
      // Setup all previous steps to succeed
      mockGammaClient.generatePresentation.mockResolvedValueOnce({
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
      });

      axiosGetSpy.mockResolvedValueOnce({
        data: Buffer.from('fake-pptx'),
      });

      mockSlideImageExtractor.extractSlideImages.mockResolvedValueOnce([
        { index: 1, imageUrl: 'https://example.com/slide1.png' },
      ]);

      mockSlideSpeechBuilder.buildSpeakerText.mockReturnValueOnce([
        { index: 1, speakerText: 'First slide' },
      ]);

      mockVoiceIdResolver.resolve.mockReturnValueOnce('voice-123');

      mockTemplatePayloadBuilder.buildPayload.mockReturnValueOnce({
        template_id: '01a1ee50978a4517a86a3e0858a32d6a',
        title: 'Test',
        variables: {},
      });

      mockHeygenClient.generateTemplateVideo.mockRejectedValueOnce(
        new Error('Template video generation failed: Invalid template_id. Status: 404')
      );

      try {
        await orchestrator.execute({
          trainerId: 'trainer-123',
          topicId: 5,
          languageCode: 'he',
          mode: 'avatar',
          inputText: 'Test',
          aiSlideExplanations: ['First slide'],
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorStepError);
        expect(error.step).toBe('heygen_generation');
        expect(error.jobId).toBeTruthy();
      }
    });

    it('should use provided jobId if given', async () => {
      const customJobId = 'custom-job-id-123';

      mockGammaClient.generatePresentation.mockResolvedValueOnce({
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
      });

      axiosGetSpy.mockResolvedValueOnce({
        data: Buffer.from('fake-pptx'),
      });

      mockSlideImageExtractor.extractSlideImages.mockResolvedValueOnce([
        { index: 1, imageUrl: 'https://example.com/slide1.png' },
      ]);

      mockSlideSpeechBuilder.buildSpeakerText.mockReturnValueOnce([
        { index: 1, speakerText: 'First slide' },
      ]);

      mockVoiceIdResolver.resolve.mockReturnValueOnce('voice-123');

      mockTemplatePayloadBuilder.buildPayload.mockReturnValueOnce({
        template_id: '01a1ee50978a4517a86a3e0858a32d6a',
        title: 'Test',
        variables: {},
      });

      mockHeygenClient.generateTemplateVideo.mockResolvedValueOnce({
        success: true,
        video_id: 'video-123',
      });

      const result = await orchestrator.execute({
        trainerId: 'trainer-123',
        topicId: 5,
        languageCode: 'he',
        mode: 'avatar',
        inputText: 'Test',
        aiSlideExplanations: ['First slide'],
        jobId: customJobId,
      });

      expect(result.jobId).toBe(customJobId);
      expect(mockSlideImageExtractor.extractSlideImages).toHaveBeenCalledWith(
        expect.any(Buffer),
        customJobId,
        10,
        true // requireFullRendering: Avatar videos MUST use fully rendered slide images
      );
    });

    it('should include job state with all step statuses', async () => {
      mockGammaClient.generatePresentation.mockResolvedValueOnce({
        fileUrl: 'https://storage.example.com/presentations/test.pptx',
      });

      axiosGetSpy.mockResolvedValueOnce({
        data: Buffer.from('fake-pptx'),
      });

      mockSlideImageExtractor.extractSlideImages.mockResolvedValueOnce([
        { index: 1, imageUrl: 'https://example.com/slide1.png' },
      ]);

      mockSlideSpeechBuilder.buildSpeakerText.mockReturnValueOnce([
        { index: 1, speakerText: 'First slide' },
      ]);

      mockVoiceIdResolver.resolve.mockReturnValueOnce('voice-123');

      mockTemplatePayloadBuilder.buildPayload.mockReturnValueOnce({
        template_id: '01a1ee50978a4517a86a3e0858a32d6a',
        title: 'Test',
        variables: {},
      });

      mockHeygenClient.generateTemplateVideo.mockResolvedValueOnce({
        success: true,
        video_id: 'video-123',
      });

      const result = await orchestrator.execute({
        trainerId: 'trainer-123',
        topicId: 5,
        languageCode: 'he',
        mode: 'avatar',
        inputText: 'Test',
        aiSlideExplanations: ['First slide'],
      });

      // Verify job state structure
      expect(result.jobState).toHaveProperty('jobId');
      expect(result.jobState).toHaveProperty('trainerId', 'trainer-123');
      expect(result.jobState).toHaveProperty('topicId', 5);
      expect(result.jobState).toHaveProperty('languageCode', 'he');
      expect(result.jobState).toHaveProperty('mode', 'avatar');
      expect(result.jobState).toHaveProperty('startedAt');
      expect(result.jobState).toHaveProperty('completedAt');
      expect(result.jobState).toHaveProperty('status', 'completed');
      expect(result.jobState).toHaveProperty('steps');

      // Verify all steps have status
      expect(result.jobState.steps.gammaGeneration).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.imageExtraction).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.speechBuilding).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.slidePlanCreation).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.voiceResolution).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.payloadBuilding).toHaveProperty('status', 'completed');
      expect(result.jobState.steps.heygenGeneration).toHaveProperty('status', 'completed');
    });
  });
});

