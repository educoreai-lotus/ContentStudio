import { describe, it, expect, jest } from '@jest/globals';
import { CreateContentUseCase } from '../../../../src/application/use-cases/CreateContentUseCase.js';
import { Content } from '../../../../src/domain/entities/Content.js';

describe('CreateContentUseCase', () => {
  let contentRepository;
  let qualityCheckService;
  let useCase;

  beforeEach(() => {
    contentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
    };

    qualityCheckService = {
      triggerQualityCheck: jest.fn(),
      validateContentQualityBeforeSave: jest.fn().mockResolvedValue({
        relevance_score: 90,
        originality_score: 85,
        difficulty_alignment_score: 80,
        consistency_score: 85,
      }),
    };

    useCase = new CreateContentUseCase({
      contentRepository,
      qualityCheckService,
    });
  });

  describe('execute', () => {
    it('should create content successfully', async () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample lesson text' },
      };

      const createdContent = new Content({
        ...contentData,
        content_id: 1,
        generation_method_id: 'manual',
      });

      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockResolvedValue();

      const result = await useCase.execute(contentData);

      expect(result).toBeInstanceOf(Content);
      expect(result.content_id).toBe(1);
      expect(contentRepository.create).toHaveBeenCalledWith(
        expect.any(Content)
      );
      expect(qualityCheckService.triggerQualityCheck).toHaveBeenCalledWith(1);
    });

    it('should use manual generation method by default', async () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
      };

      const createdContent = new Content({
        ...contentData,
        content_id: 1,
        generation_method_id: 'manual',
      });

      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockResolvedValue();

      await useCase.execute(contentData);

      const createdCall = contentRepository.create.mock.calls[0][0];
      expect(createdCall.generation_method_id).toBe('manual');
    });

    it('should throw error if topic_id is missing', async () => {
      const contentData = {
        content_type_id: 'text',
        content_data: { text: 'Sample' },
      };

      await expect(useCase.execute(contentData)).rejects.toThrow(
        'topic_id is required'
      );
    });

    it('should throw error if content_type_id is missing', async () => {
      const contentData = {
        topic_id: 1,
        content_data: { text: 'Sample' },
      };

      await expect(useCase.execute(contentData)).rejects.toThrow(
        'content_type_id is required'
      );
    });

    it('should throw error if content_data is missing', async () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
      };

      await expect(useCase.execute(contentData)).rejects.toThrow(
        'content_data is required'
      );
    });

    it('should not fail if quality check service fails', async () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
      };

      const createdContent = new Content({
        ...contentData,
        content_id: 1,
        generation_method_id: 'manual',
      });

      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockRejectedValue(
        new Error('Quality check service unavailable')
      );

      // Should not throw
      const result = await useCase.execute(contentData);

      expect(result).toBeInstanceOf(Content);
      expect(contentRepository.create).toHaveBeenCalled();
    });

    it('should not trigger quality check if content already has status', async () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
        quality_check_status: 'approved',
      };

      const createdContent = new Content({
        ...contentData,
        content_id: 1,
        generation_method_id: 'manual',
      });

      contentRepository.create.mockResolvedValue(createdContent);

      await useCase.execute(contentData);

      expect(qualityCheckService.triggerQualityCheck).not.toHaveBeenCalled();
    });
  });
});



