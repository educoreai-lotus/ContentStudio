import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AITranslationService } from '../../../../src/infrastructure/ai/AITranslationService.js';

describe('AITranslationService', () => {
  let service;
  let mockOpenAIClient;
  let mockGeminiClient;

  beforeEach(() => {
    mockOpenAIClient = {
      generateText: jest.fn(),
    };

    mockGeminiClient = {
      generate: jest.fn(),
    };

    service = new AITranslationService({
      openaiApiKey: 'test-key',
      geminiApiKey: 'test-key',
      preferredProvider: 'openai',
    });

    service.openaiClient = mockOpenAIClient;
    service.geminiClient = mockGeminiClient;
  });

  describe('translate', () => {
    it('should translate content using OpenAI', async () => {
      const sourceText = 'Hello, world!';
      const translatedText = 'שלום, עולם!';

      mockOpenAIClient.generateText.mockResolvedValue(translatedText);

      const result = await service.translate(sourceText, 'en', 'he');

      expect(result).toBe(translatedText);
      expect(mockOpenAIClient.generateText).toHaveBeenCalled();
    });

    it('should use Gemini as fallback if OpenAI not available', async () => {
      service.openaiClient = null;
      const translatedText = 'שלום, עולם!';

      mockGeminiClient.generate.mockResolvedValue(translatedText);

      const result = await service.translate('Hello', 'en', 'he');

      expect(result).toBe(translatedText);
      expect(mockGeminiClient.generate).toHaveBeenCalled();
    });

    it('should throw error if no provider available', async () => {
      service.openaiClient = null;
      service.geminiClient = null;

      await expect(service.translate('Hello', 'en', 'he')).rejects.toThrow(
        'No translation provider available'
      );
    });

    it('should include context in prompt', async () => {
      mockOpenAIClient.generateText.mockResolvedValue('Translated');

      await service.translate('Hello', 'en', 'he', { context: 'Greeting' });

      const callArgs = mockOpenAIClient.generateText.mock.calls[0];
      expect(callArgs[0]).toContain('Context: Greeting');
    });
  });

  describe('translateStructured', () => {
    it('should translate structured content', async () => {
      const structuredContent = {
        title: 'Introduction',
        description: 'Welcome to the course',
        sections: [
          { heading: 'Section 1', content: 'Content 1' },
        ],
      };

      mockOpenAIClient.generateText
        .mockResolvedValueOnce('הקדמה')
        .mockResolvedValueOnce('ברוכים הבאים לקורס')
        .mockResolvedValueOnce('סעיף 1')
        .mockResolvedValueOnce('תוכן 1');

      const result = await service.translateStructured(structuredContent, 'en', 'he');

      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
      expect(mockOpenAIClient.generateText).toHaveBeenCalled();
    });

    it('should skip technical fields', async () => {
      const structuredContent = {
        id: '123',
        url: 'https://example.com',
        title: 'Introduction',
      };

      mockOpenAIClient.generateText.mockResolvedValue('הקדמה');

      const result = await service.translateStructured(structuredContent, 'en', 'he');

      expect(result.id).toBe('123'); // Not translated
      expect(result.url).toBe('https://example.com'); // Not translated
      expect(result.title).toBe('הקדמה'); // Translated
    });
  });

  describe('isTechnicalField', () => {
    it('should identify technical fields correctly', () => {
      expect(service.isTechnicalField('id')).toBe(true);
      expect(service.isTechnicalField('url')).toBe(true);
      expect(service.isTechnicalField('created_at')).toBe(true);
      expect(service.isTechnicalField('title')).toBe(false);
      expect(service.isTechnicalField('description')).toBe(false);
    });
  });
});



