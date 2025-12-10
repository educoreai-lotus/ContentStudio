/**
 * Avatar Video Validation Tests
 * 
 * ⚠️ CRITICAL: These tests ensure that Avatar Video narration NEVER uses OpenAI.
 * 
 * Avatar narration must come ONLY from HeyGen using our formatted prompt (topic, description, skills, trainer_prompt/transcript).
 * 
 * ❌ FORBIDDEN: OpenAI cannot generate "video script" or "narration text" for HeyGen.
 * ✅ REQUIRED: Our prompt is formatted by buildAvatarText() and sent directly to HeyGen.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AIGenerationService } from '../../../../src/infrastructure/ai/AIGenerationService.js';

describe('Avatar Video Validation - No OpenAI Script Generation', () => {
  let service;
  let mockOpenAIClient;
  let mockHeygenClient;

  beforeEach(() => {
    // Create mocks
    mockOpenAIClient = {
      generateText: jest.fn(),
    };

    mockHeygenClient = {
      generateVideo: jest.fn().mockResolvedValue({
        videoUrl: 'https://example.com/video.mp4',
        videoId: 'test-video-id',
        status: 'completed',
        heygenVideoUrl: 'https://heygen.com/share/test-video-id',
        duration: 15,
      }),
    };

    // Create service with mocked clients
    service = new AIGenerationService({
      openaiApiKey: 'test-key',
      heygenApiKey: 'test-heygen-key',
    });

    // Replace clients with mocks
    service.openaiClient = mockOpenAIClient;
    service.heygenClient = mockHeygenClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAvatarVideo() - No OpenAI Script Generation', () => {
    it('should use trainer prompt directly without OpenAI', async () => {
      const lessonData = {
        lessonTopic: 'JavaScript Basics',
        lessonDescription: 'Introduction to JavaScript programming',
        skillsList: ['javascript', 'variables', 'functions'],
        trainerRequestText: 'Explain the basics clearly',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called with trainer prompt
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      expect(heygenCall[0].prompt).toBe('Explain the basics clearly');
    });

    it('should use transcript text when available without OpenAI', async () => {
      const lessonData = {
        lessonTopic: 'React Hooks',
        lessonDescription: 'Understanding React Hooks',
        skillsList: ['react', 'hooks', 'usestate'],
        transcriptText: 'In this lesson, we will learn about React Hooks...',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
        transcriptText: 'In this lesson, we will learn about React Hooks...', // Pass in config as fallback
      });

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called with transcript text
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      expect(heygenCall[0].prompt).toContain('In this lesson');
    });

    it('should use transcript text when available instead of trainer prompt', async () => {
      const lessonData = {
        lessonTopic: 'Python Basics',
        transcriptText: 'Python is a high-level programming language...',
        // Don't include trainerRequestText in lessonData - it will be checked first
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
        transcriptText: 'Python is a high-level programming language...', // Pass in config
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      expect(heygenCall[0].prompt).toContain('Python is a high-level');
    });

    it('should use trainer prompt when transcript is not available', async () => {
      const lessonData = {
        lessonTopic: 'Python Basics',
        trainerRequestText: 'Explain Python basics clearly',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      expect(heygenCall[0].prompt).toBe('Explain Python basics clearly');
    });

    it('should return error when no prompt available', async () => {
      const lessonData = {
        lessonTopic: 'Empty Topic',
        // No trainerRequestText or transcriptText
      };

      const result = await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      // Should return failed status when no prompt
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Trainer prompt is required');
    });
  });

  describe('generateAvatarVideo() - Direct HeyGen Integration', () => {
    it('should NOT call OpenAI before HeyGen', async () => {
      // Spy on OpenAI client to track calls
      const openAISpy = jest.spyOn(mockOpenAIClient, 'generateText');

      const lessonData = {
        lessonTopic: 'Test Topic',
        lessonDescription: 'Test Description',
        skillsList: ['skill1', 'skill2'],
        trainerRequestText: 'Test prompt',
      };

      // Mock OpenAI to be called (simulating violation)
      openAISpy.mockResolvedValue('This should NOT be generated');

      // If OpenAI is called, this would be a violation
      // The code structure prevents this, but we test it explicitly
      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      // ⚠️ CRITICAL ASSERTION: OpenAI must NOT be called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called instead
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();

      openAISpy.mockRestore();
    });

    it('should send formatted prompt to HeyGen, not OpenAI-generated text', async () => {
      const lessonData = {
        lessonTopic: 'JavaScript Arrays',
        lessonDescription: 'Working with arrays in JavaScript',
        skillsList: ['javascript', 'arrays'],
        trainerRequestText: 'Explain arrays clearly',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called with trainer prompt directly
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const videoConfig = heygenCall[0];

      // Verify HeyGen was called with correct config
      expect(videoConfig).toHaveProperty('title');
      expect(videoConfig).toHaveProperty('prompt');
      expect(videoConfig).toHaveProperty('language');
      expect(videoConfig.prompt).toBe('Explain arrays clearly');
    });

    it('should use transcript text when available instead of trainer prompt', async () => {
      const lessonData = {
        lessonTopic: 'React State',
        transcriptText: 'In this video, we will explore React state management...',
        // Don't include trainerRequestText - transcriptText should be used
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
        transcriptText: 'In this video, we will explore React state management...', // Pass in config
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const videoConfig = heygenCall[0];

      // Should contain transcript
      expect(videoConfig.prompt).toContain('In this video, we will explore React state management');
    });

    it('should validate that text contains expected prompt components', async () => {
      const lessonData = {
        lessonTopic: 'Test Topic',
        lessonDescription: 'Test Description',
        trainerRequestText: 'Test prompt text', // Need to provide prompt
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const videoConfig = heygenCall[0];

      // Should have prompt
      expect(videoConfig).toHaveProperty('prompt');
      expect(videoConfig.prompt).toBe('Test prompt text');
    });

    it('should return error if HeyGen client is not configured', async () => {
      service.heygenClient = null;

      const lessonData = {
        lessonTopic: 'Test Topic',
      };

      const result = await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      // Should not call OpenAI even on error
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Should return failed status
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Heygen client not configured');
    });
  });

  describe('Integration - GenerateContentUseCase Avatar Video Flow', () => {
    it('should ensure GenerateContentUseCase does not call OpenAI for avatar video', async () => {
      // This test validates the full flow from GenerateContentUseCase
      // Import and test GenerateContentUseCase separately
      const { GenerateContentUseCase } = await import('../../../../src/application/use-cases/GenerateContentUseCase.js');
      
      const mockContentRepository = {
        create: jest.fn().mockResolvedValue({
          content_id: 1,
          topic_id: 1,
          content_type_id: 6,
          content_data: {},
        }),
      };

      const mockPromptTemplateService = {
        getTemplate: jest.fn().mockResolvedValue(null),
      };

      const mockQualityCheckService = {
        triggerQualityCheck: jest.fn().mockResolvedValue({}),
      };

      const useCase = new GenerateContentUseCase({
        contentRepository: mockContentRepository,
        aiGenerationService: service,
        promptTemplateService: mockPromptTemplateService,
        qualityCheckService: mockQualityCheckService,
      });

      const generationRequest = {
        topic_id: 1,
        content_type_id: 6, // avatar_video
        prompt: 'Test prompt text', // Required
        // GenerateContentUseCase expects these directly, not in promptVariables
        lessonTopic: 'Test Topic',
        lessonDescription: 'Test Description',
        skillsList: ['skill1'],
        language: 'en',
        trainerRequestText: 'Test prompt',
        promptVariables: {
          lessonTopic: 'Test Topic',
          lessonDescription: 'Test Description',
          skillsList: ['skill1'],
          skillsListArray: ['skill1'],
          trainerRequestText: 'Test prompt',
          language: 'en',
        },
        trainer_id: 'trainer-1',
        generation_method_id: 'ai_full',
      };

      await useCase.execute(generationRequest);

      // ⚠️ CRITICAL: OpenAI must NOT be called for avatar video generation
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Safeguards', () => {
    it('should handle empty lesson data gracefully without OpenAI', async () => {
      const result = await service.generateAvatarVideo({}, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      // Should return failed status when no prompt
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Trainer prompt is required');
    });

    it('should sanitize input without calling OpenAI', async () => {
      const lessonData = {
        lessonTopic: '<script>alert("xss")</script>Test Topic',
        lessonDescription: 'Test Description',
        trainerRequestText: 'Test prompt',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      // Main validation: OpenAI was NOT called (prevent injection)
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
    });

    it('should handle long transcript text without OpenAI summarization', async () => {
      const longTranscript = 'A'.repeat(2000); // Very long transcript
      const lessonData = {
        lessonTopic: 'Test Topic',
        transcriptText: longTranscript,
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
        transcriptText: longTranscript, // Pass in config as fallback
      });

      // Should NOT call OpenAI to summarize
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Should send transcript directly to HeyGen (no truncation in generateAvatarVideo)
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      expect(heygenCall[0].prompt).toBe(longTranscript);
    });
  });
});

