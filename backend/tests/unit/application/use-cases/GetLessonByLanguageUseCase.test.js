import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GetLessonByLanguageUseCase } from '../../../../src/application/use-cases/GetLessonByLanguageUseCase.js';

describe('GetLessonByLanguageUseCase', () => {
  let useCase;
  let mockLanguageStatsRepository;
  let mockSupabaseStorageClient;
  let mockContentRepository;
  let mockTopicRepository;
  let mockTranslationService;
  let mockAIGenerationService;

  beforeEach(() => {
    mockLanguageStatsRepository = {
      incrementRequest: jest.fn(),
      isFrequentLanguage: jest.fn(),
      incrementLessonCount: jest.fn(),
    };

    mockSupabaseStorageClient = {
      getLessonContent: jest.fn(),
      storeLessonContent: jest.fn(),
      isConfigured: jest.fn(() => true),
    };

    mockContentRepository = {
      findAllByTopicId: jest.fn(),
    };

    mockTopicRepository = {
      findById: jest.fn(),
    };

    mockTranslationService = {
      translateStructured: jest.fn(),
    };

    mockAIGenerationService = {
      generate: jest.fn(),
    };

    useCase = new GetLessonByLanguageUseCase({
      languageStatsRepository: mockLanguageStatsRepository,
      supabaseStorageClient: mockSupabaseStorageClient,
      contentRepository: mockContentRepository,
      topicRepository: mockTopicRepository,
      translationService: mockTranslationService,
      aiGenerationService: mockAIGenerationService,
    });
  });

  describe('execute', () => {
    it('should return cached content if exists in Supabase', async () => {
      const cachedContent = { text: 'Cached content' };
      mockSupabaseStorageClient.getLessonContent.mockResolvedValue(cachedContent);
      mockLanguageStatsRepository.isFrequentLanguage.mockResolvedValue(true);

      const result = await useCase.execute({
        lessonId: '123',
        preferredLanguage: 'en',
        contentType: 'text',
      });

      expect(result.content).toEqual(cachedContent);
      expect(result.source).toBe('cache');
      expect(result.cached).toBe(true);
      expect(mockLanguageStatsRepository.incrementRequest).toHaveBeenCalledWith('en');
    });

    it('should translate from fallback language if not cached', async () => {
      mockSupabaseStorageClient.getLessonContent
        .mockResolvedValueOnce(null) // Preferred language not found
        .mockResolvedValueOnce({ text: 'English content' }); // Fallback found

      mockLanguageStatsRepository.isFrequentLanguage.mockResolvedValue(true);
      mockTranslationService.translateStructured.mockResolvedValue({
        text: 'Translated content',
      });

      const result = await useCase.execute({
        lessonId: '123',
        preferredLanguage: 'he',
        contentType: 'text',
      });

      expect(result.source).toBe('translation');
      expect(result.source_language).toBe('en');
      expect(mockTranslationService.translateStructured).toHaveBeenCalled();
    });

    it('should generate content if no source found', async () => {
      mockSupabaseStorageClient.getLessonContent.mockResolvedValue(null);
      mockContentRepository.findAllByTopicId.mockResolvedValue([]);
      mockTopicRepository.findById.mockResolvedValue({
        topic_id: '123',
        topic_name: 'Test Topic',
        description: 'Test Description',
      });
      mockAIGenerationService.generate.mockResolvedValue({
        text: 'Generated content',
      });

      const result = await useCase.execute({
        lessonId: '123',
        preferredLanguage: 'cs',
        contentType: 'text',
      });

      expect(result.source).toBe('generation');
      expect(mockAIGenerationService.generate).toHaveBeenCalled();
    });

    it('should store translated content if language is frequent', async () => {
      mockSupabaseStorageClient.getLessonContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ text: 'English content' });

      mockLanguageStatsRepository.isFrequentLanguage.mockResolvedValue(true);
      mockTranslationService.translateStructured.mockResolvedValue({
        text: 'Translated',
      });

      await useCase.execute({
        lessonId: '123',
        preferredLanguage: 'he',
        contentType: 'text',
      });

      expect(mockSupabaseStorageClient.storeLessonContent).toHaveBeenCalled();
      expect(mockLanguageStatsRepository.incrementLessonCount).toHaveBeenCalledWith('he');
    });

    it('should not store if language is not frequent', async () => {
      mockSupabaseStorageClient.getLessonContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ text: 'English content' });

      mockLanguageStatsRepository.isFrequentLanguage.mockResolvedValue(false);
      mockTranslationService.translateStructured.mockResolvedValue({
        text: 'Translated',
      });

      await useCase.execute({
        lessonId: '123',
        preferredLanguage: 'cs',
        contentType: 'text',
      });

      expect(mockSupabaseStorageClient.storeLessonContent).not.toHaveBeenCalled();
    });
  });
});



