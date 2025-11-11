import { describe, it, expect, jest } from '@jest/globals';
import { UpdateContentUseCase } from '../../../../src/application/use-cases/UpdateContentUseCase.js';
import { Content } from '../../../../src/domain/entities/Content.js';

describe('UpdateContentUseCase', () => {
  let contentRepository;
  let contentHistoryService;
  let useCase;

  beforeEach(() => {
    contentRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    contentHistoryService = {
      saveVersion: jest.fn(),
    };

    useCase = new UpdateContentUseCase({
      contentRepository,
      contentHistoryService,
    });
  });

  describe('execute', () => {
    it('should update content successfully', async () => {
      const existingContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Original content' },
        generation_method_id: 'manual',
      });

      const updatedContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Updated content' },
        generation_method_id: 'manual',
      });

      contentRepository.findById.mockResolvedValue(existingContent);
      contentRepository.update.mockResolvedValue(updatedContent);
      contentHistoryService.saveVersion.mockResolvedValue({});

      const result = await useCase.execute(1, { content_data: { text: 'Updated content' } }, 'trainer123');

      expect(result).toBeInstanceOf(Content);
      expect(result.content_data.text).toBe('Updated content');
      expect(contentHistoryService.saveVersion).toHaveBeenCalled();
    });

    it('should create version before updating if content changed', async () => {
      const existingContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Original' },
        generation_method_id: 'manual',
      });

      const updatedContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Updated' },
        generation_method_id: 'manual',
      });

      contentRepository.findById.mockResolvedValue(existingContent);
      contentRepository.update.mockResolvedValue(updatedContent);
      contentHistoryService.saveVersion.mockResolvedValue({});

      await useCase.execute(1, { content_data: { text: 'Updated' } }, 'trainer123');

      expect(contentHistoryService.saveVersion).toHaveBeenCalledWith(existingContent);
    });

    it('should not create version if content_data unchanged', async () => {
      const existingContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Same content' },
        generation_method_id: 'manual',
      });

      const updatedContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Same content' },
        generation_method_id: 'manual',
      });

      contentRepository.findById.mockResolvedValue(existingContent);
      contentRepository.update.mockResolvedValue(updatedContent);

      await useCase.execute(1, { quality_check_status: 'completed' }, 'trainer123');

      expect(contentHistoryService.saveVersion).not.toHaveBeenCalled();
    });

    it('should throw error if content_id is missing', async () => {
      await expect(useCase.execute(null, {})).rejects.toThrow('content_id is required');
    });

    it('should throw error if content not found', async () => {
      contentRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999, {})).rejects.toThrow('Content not found');
    });

    it('should continue update even if versioning fails', async () => {
      const existingContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Original' },
        generation_method_id: 'manual',
      });

      const updatedContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Updated' },
        generation_method_id: 'manual',
      });

      contentRepository.findById.mockResolvedValue(existingContent);
      contentRepository.update.mockResolvedValue(updatedContent);
      contentHistoryService.saveVersion.mockRejectedValue(new Error('Versioning failed'));

      // Should not throw, update should succeed
      const result = await useCase.execute(1, { content_data: { text: 'Updated' } }, 'trainer123');
      expect(result).toBeInstanceOf(Content);
    });
  });
});



