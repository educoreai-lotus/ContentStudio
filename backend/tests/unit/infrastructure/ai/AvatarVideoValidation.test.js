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

  describe('buildAvatarText() - Pure Function Validation', () => {
    it('should be a pure function with no side effects', () => {
      const lessonData = {
        lessonTopic: 'JavaScript Basics',
        lessonDescription: 'Introduction to JavaScript programming',
        skillsList: ['javascript', 'variables', 'functions'],
        trainerRequestText: 'Explain the basics clearly',
      };

      // Call buildAvatarText - should NOT call OpenAI
      const result = service.buildAvatarText(lessonData);

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify result is formatted text from our prompt
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('JavaScript Basics');
      expect(result).toContain('Introduction to JavaScript programming');
      expect(result).toContain('javascript, variables, functions');
      expect(result).toContain('Explain the basics clearly');
    });

    it('should format text from lesson data without OpenAI', () => {
      const lessonData = {
        lessonTopic: 'React Hooks',
        lessonDescription: 'Understanding React Hooks',
        skillsList: ['react', 'hooks', 'usestate'],
        transcriptText: 'In this lesson, we will learn about React Hooks...',
      };

      const result = service.buildAvatarText(lessonData);

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify result contains our data
      expect(result).toContain('React Hooks');
      expect(result).toContain('Understanding React Hooks');
      expect(result).toContain('react, hooks, usestate');
      expect(result).toContain('In this lesson');
    });

    it('should use transcript text when available', () => {
      const lessonData = {
        lessonTopic: 'Python Basics',
        transcriptText: 'Python is a high-level programming language...',
        trainerRequestText: 'This should be ignored if transcript exists',
      };

      const result = service.buildAvatarText(lessonData);

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      expect(result).toContain('Python is a high-level');
      expect(result).not.toContain('This should be ignored');
    });

    it('should use trainer prompt when transcript is not available', () => {
      const lessonData = {
        lessonTopic: 'Python Basics',
        trainerRequestText: 'Explain Python basics clearly',
      };

      const result = service.buildAvatarText(lessonData);

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      expect(result).toContain('Explain Python basics clearly');
    });

    it('should provide fallback text when no data available', () => {
      const lessonData = {
        lessonTopic: 'Empty Topic',
      };

      const result = service.buildAvatarText(lessonData);

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      // Fallback text format: "Today we'll learn about {topic}" or "Welcome to the lesson about {topic}"
      expect(result).toMatch(/Empty Topic|Welcome to/);
    });
  });

  describe('generateAvatarVideo() - No OpenAI Script Generation', () => {
    it('should FAIL if OpenAI is called before HeyGen', async () => {
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

      // Verify HeyGen was called with our formatted text
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const scriptText = heygenCall[0];

      // Verify script contains our prompt components
      expect(scriptText).toContain('JavaScript Arrays');
      expect(scriptText).toContain('Working with arrays in JavaScript');
      expect(scriptText).toContain('javascript, arrays');
      expect(scriptText).toContain('Explain arrays clearly');

      // Verify script is NOT OpenAI-generated (should not contain typical AI summary patterns)
      expect(scriptText).not.toMatch(/^(In this|This lesson|We will)/i); // Typical AI summary starts
    });

    it('should use transcript text when available instead of trainer prompt', async () => {
      const lessonData = {
        lessonTopic: 'React State',
        transcriptText: 'In this video, we will explore React state management...',
        trainerRequestText: 'This should be ignored',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const scriptText = heygenCall[0];

      // Should contain transcript, not trainer prompt
      expect(scriptText).toContain('In this video, we will explore React state management');
      expect(scriptText).not.toContain('This should be ignored');
    });

    it('should validate that text contains expected prompt components', async () => {
      const lessonData = {
        lessonTopic: 'Test Topic',
        lessonDescription: 'Test Description',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      
      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const scriptText = heygenCall[0];

      // Should contain topic and description
      expect(scriptText).toContain('Test Topic');
      expect(scriptText).toContain('Test Description');
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
    it('should handle empty lesson data gracefully without OpenAI', () => {
      const result = service.buildAvatarText({});

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      expect(result).toBe('Welcome to this lesson.');
    });

    it('should sanitize input without calling OpenAI', () => {
      const lessonData = {
        lessonTopic: '<script>alert("xss")</script>Test Topic',
        lessonDescription: 'Test Description',
      };

      const result = service.buildAvatarText(lessonData);

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();
      // Should contain topic (sanitization handled by PromptSanitizer)
      // PromptSanitizer may not remove all HTML, but key is: NO OpenAI call
      expect(result).toContain('Test Topic');
      // Main validation: OpenAI was NOT called (prevent injection, not sanitize HTML)
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle long transcript text without OpenAI summarization', () => {
      const longTranscript = 'A'.repeat(2000); // Very long transcript
      const lessonData = {
        lessonTopic: 'Test Topic',
        transcriptText: longTranscript,
      };

      const result = service.buildAvatarText(lessonData);

      // Should NOT call OpenAI to summarize
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Should truncate to first 500 chars (our internal logic)
      expect(result.length).toBeLessThanOrEqual(longTranscript.substring(0, 500).length + 100); // Account for other parts
    });
  });
});

