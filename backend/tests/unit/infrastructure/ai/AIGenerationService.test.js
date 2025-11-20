import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AIGenerationService } from '../../../../src/infrastructure/ai/AIGenerationService.js';

describe('AIGenerationService', () => {
  let service;
  let mockOpenAIClient;
  let mockTTSClient;
  let mockGeminiClient;

  beforeEach(() => {
    mockOpenAIClient = {
      generateText: jest.fn(),
    };

    mockTTSClient = {
      generateAudioWithMetadata: jest.fn(),
    };

    mockGeminiClient = {
      generateMindMap: jest.fn(),
    };

    // Create service with mocked clients
    service = new AIGenerationService({
      openaiApiKey: 'test-key',
      geminiApiKey: 'test-key',
    });

    // Replace clients with mocks
    service.openaiClient = mockOpenAIClient;
    service.ttsClient = mockTTSClient;
    service.geminiClient = mockGeminiClient;
  });

  describe('generateAudio', () => {
    it('should generate audio from text', async () => {
      const text = 'This is a test text for audio generation.';
      const audioBuffer = Buffer.from('fake-audio-data');
      
      mockTTSClient.generateAudioWithMetadata.mockResolvedValue({
        audio: audioBuffer,
        format: 'mp3',
        duration: 5.0,
        voice: 'alloy',
        word_count: 8,
      });

      const result = await service.generateAudio(text, {
        voice: 'alloy',
        format: 'mp3',
      });

      expect(result).toHaveProperty('audio');
      expect(result.format).toBe('mp3');
      expect(result.duration).toBe(5.0);
      expect(result.voice).toBe('alloy');
      expect(mockTTSClient.generateAudioWithMetadata).toHaveBeenCalled();
    });

    it('should summarize long text before generating audio', async () => {
      const longText = 'A'.repeat(5000); // Very long text
      const summarizedText = 'Summarized text';
      const audioBuffer = Buffer.from('fake-audio-data');

      mockOpenAIClient.generateText.mockResolvedValue(summarizedText);
      mockTTSClient.generateAudioWithMetadata.mockResolvedValue({
        audio: audioBuffer,
        format: 'mp3',
        duration: 2.0,
        voice: 'alloy',
        word_count: 2,
      });

      const result = await service.generateAudio(longText);

      expect(mockOpenAIClient.generateText).toHaveBeenCalled();
      expect(result.text).toBe(summarizedText);
      expect(result.metadata.original_text_length).toBe(5000);
      expect(result.metadata.converted_text_length).toBe(summarizedText.length);
    });

    it('should throw error if TTS client not configured', async () => {
      service.ttsClient = null;

      await expect(service.generateAudio('test')).rejects.toThrow(
        'TTS client not configured'
      );
    });
  });

  describe('generateAvatarVideo', () => {
    let mockHeygenClient;

    beforeEach(() => {
      mockHeygenClient = {
        generateVideo: jest.fn().mockResolvedValue({
          videoUrl: 'https://example.com/video.mp4',
          videoId: 'test-video-id',
          status: 'completed',
          heygenVideoUrl: 'https://heygen.com/share/test-video-id',
          duration: 15,
        }),
      };
      service.heygenClient = mockHeygenClient;
    });

    it('should NOT call OpenAI for avatar video generation', async () => {
      const lessonData = {
        lessonTopic: 'JavaScript Basics',
        lessonDescription: 'Introduction to JavaScript',
        skillsList: ['javascript', 'variables'],
        trainerRequestText: 'Explain basics clearly',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      // ⚠️ CRITICAL: OpenAI must NOT be called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify HeyGen was called instead
      expect(mockHeygenClient.generateVideo).toHaveBeenCalled();
    });

    it('should format prompt text using buildAvatarText without OpenAI', () => {
      const lessonData = {
        lessonTopic: 'React Hooks',
        lessonDescription: 'Understanding React Hooks',
        skillsList: ['react', 'hooks'],
        trainerRequestText: 'Explain hooks clearly',
      };

      const result = service.buildAvatarText(lessonData);

      // Verify OpenAI was NOT called
      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      // Verify formatted text contains our data
      expect(result).toContain('React Hooks');
      expect(result).toContain('Understanding React Hooks');
      expect(result).toContain('react, hooks');
      expect(result).toContain('Explain hooks clearly');
    });

    it('should send formatted text directly to HeyGen', async () => {
      const lessonData = {
        lessonTopic: 'Python Basics',
        lessonDescription: 'Python programming fundamentals',
        skillsList: ['python'],
        trainerRequestText: 'Start with basics',
      };

      await service.generateAvatarVideo(lessonData, {
        language: 'en',
      });

      expect(mockOpenAIClient.generateText).not.toHaveBeenCalled();

      const heygenCall = mockHeygenClient.generateVideo.mock.calls[0];
      const scriptText = heygenCall[0];

      // Verify script contains our prompt, not AI-generated text
      expect(scriptText).toContain('Python Basics');
      expect(scriptText).toContain('Python programming fundamentals');
      expect(scriptText).toContain('python');
      expect(scriptText).toContain('Start with basics');
    });
  });

  describe('generatePresentation', () => {
    it('should generate presentation from topic', async () => {
      const topic = 'Introduction to JavaScript';
      const mockPresentation = {
        title: 'Introduction to JavaScript',
        slides: [
          {
            slide_number: 1,
            title: 'What is JavaScript?',
            content: ['JavaScript is a programming language', 'It runs in browsers'],
          },
        ],
      };

      mockOpenAIClient.generateText.mockResolvedValue(
        JSON.stringify(mockPresentation)
      );

      const result = await service.generatePresentation(topic, {
        slide_count: 10,
        style: 'educational',
      });

      expect(result).toHaveProperty('presentation');
      expect(result.presentation.title).toBe('Introduction to JavaScript');
      expect(result.presentation.slides).toHaveLength(1);
      expect(result.format).toBe('json');
      expect(result.slide_count).toBe(1);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const topic = 'Test Topic';
      const invalidJson = 'This is not valid JSON';

      mockOpenAIClient.generateText.mockResolvedValue(invalidJson);

      const result = await service.generatePresentation(topic);

      expect(result).toHaveProperty('presentation');
      expect(result.presentation.title).toBe(topic);
      expect(Array.isArray(result.presentation.slides)).toBe(true);
    });

    it('should extract JSON from markdown code blocks', async () => {
      const topic = 'Test Topic';
      const jsonInMarkdown = '```json\n{"title": "Test", "slides": []}\n```';

      mockOpenAIClient.generateText.mockResolvedValue(jsonInMarkdown);

      const result = await service.generatePresentation(topic);

      expect(result.presentation.title).toBe('Test');
    });

    it('should throw error if OpenAI client not configured', async () => {
      service.openaiClient = null;

      await expect(service.generatePresentation('test')).rejects.toThrow(
        'OpenAI client not configured'
      );
    });
  });

  describe('generate', () => {
    it('should call generateAudio for audio content type', async () => {
      const audioBuffer = Buffer.from('fake-audio');
      mockTTSClient.generateAudioWithMetadata.mockResolvedValue({
        audio: audioBuffer,
        format: 'mp3',
        duration: 5.0,
        voice: 'alloy',
        word_count: 5,
      });

      const result = await service.generate({
        prompt: 'Test text',
        content_type: 'audio',
        config: {},
      });

      expect(result).toHaveProperty('audio');
      expect(mockTTSClient.generateAudioWithMetadata).toHaveBeenCalled();
    });

    it('should call generatePresentation for presentation content type', async () => {
      const mockPresentation = {
        title: 'Test',
        slides: [],
      };

      mockOpenAIClient.generateText.mockResolvedValue(
        JSON.stringify(mockPresentation)
      );

      const result = await service.generate({
        prompt: 'Test topic',
        content_type: 'presentation',
        config: {},
      });

      expect(result).toHaveProperty('presentation');
      expect(mockOpenAIClient.generateText).toHaveBeenCalled();
    });
  });
});



