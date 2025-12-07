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
      findAllByTopicId: jest.fn().mockResolvedValue([]),
      getGenerationMethodName: jest.fn(),
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

      // saveVersion is called with existingContent and { force: true }
      expect(contentHistoryService.saveVersion).toHaveBeenCalled();
      const callArgs = contentHistoryService.saveVersion.mock.calls[0];
      expect(callArgs[0]).toBeInstanceOf(Content);
      expect(callArgs[0].content_id).toBe(existingContent.content_id);
      expect(callArgs[1]).toEqual({ force: true });
    });

    it('should create version even if content_data unchanged when force flag is used', async () => {
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
      contentHistoryService.saveVersion.mockResolvedValue({});

      await useCase.execute(1, { quality_check_status: 'completed' }, 'trainer123');

      // Version is always saved before update (with force: true)
      expect(contentHistoryService.saveVersion).toHaveBeenCalled();
    });

    it('should throw error if content_id is missing', async () => {
      await expect(useCase.execute(null, {})).rejects.toThrow('content_id is required');
    });

    it('should throw error if content not found', async () => {
      contentRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999, {})).rejects.toThrow('Content not found');
    });

    it('should throw error if versioning fails', async () => {
      const existingContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Original' },
        generation_method_id: 'manual',
      });

      contentRepository.findById.mockResolvedValue(existingContent);
      contentHistoryService.saveVersion.mockRejectedValue(new Error('Versioning failed'));

      // Should throw error if versioning fails (as per current implementation)
      await expect(useCase.execute(1, { content_data: { text: 'Updated' } }, 'trainer123'))
        .rejects.toThrow('Failed to archive content to history');
    });
  });
});



