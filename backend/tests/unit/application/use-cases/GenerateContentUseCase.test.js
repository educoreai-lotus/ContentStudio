import { describe, it, expect, jest } from '@jest/globals';
import { GenerateContentUseCase } from '../../../../src/application/use-cases/GenerateContentUseCase.js';
import { Content } from '../../../../src/domain/entities/Content.js';

describe('GenerateContentUseCase', () => {
  let contentRepository;
  let aiGenerationService;
  let promptTemplateService;
  let qualityCheckService;
  let useCase;

  beforeEach(() => {
    contentRepository = {
      create: jest.fn(),
    };

    aiGenerationService = {
      generateText: jest.fn(),
      generateCode: jest.fn(),
    };

    promptTemplateService = {
      getTemplate: jest.fn(),
    };

    qualityCheckService = {
      triggerQualityCheck: jest.fn(),
    };

    useCase = new GenerateContentUseCase({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
    });
  });

  describe('execute', () => {
    it('should generate text content successfully', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        prompt: 'Generate a lesson about JavaScript basics',
      };

      const generatedText = 'JavaScript is a programming language...';
      const createdContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: generatedText },
        generation_method_id: 'ai_assisted',
      });

      aiGenerationService.generateText.mockResolvedValue(generatedText);
      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockResolvedValue();

      const result = await useCase.execute(generationRequest);

      expect(result).toBeInstanceOf(Content);
      expect(result.content_id).toBe(1);
      expect(aiGenerationService.generateText).toHaveBeenCalledWith(
        'Generate a lesson about JavaScript basics',
        expect.objectContaining({
          style: 'educational',
          difficulty: 'intermediate',
        })
      );
      expect(contentRepository.create).toHaveBeenCalled();
      expect(qualityCheckService.triggerQualityCheck).toHaveBeenCalledWith(1);
    });

    it('should generate code content successfully', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'code',
        prompt: 'Generate a function to calculate fibonacci',
        language: 'javascript',
      };

      const generatedCode = {
        code: 'function fibonacci(n) { ... }',
        explanation: 'This function calculates...',
      };
      const createdContent = new Content({
        content_id: 2,
        topic_id: 1,
        content_type_id: 'code',
        content_data: {
          code: generatedCode,
          language: 'javascript',
        },
        generation_method_id: 'ai_assisted',
      });

      aiGenerationService.generateCode.mockResolvedValue(generatedCode);
      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockResolvedValue();

      const result = await useCase.execute(generationRequest);

      expect(result).toBeInstanceOf(Content);
      expect(aiGenerationService.generateCode).toHaveBeenCalledWith(
        'Generate a function to calculate fibonacci',
        'javascript',
        expect.objectContaining({
          include_comments: true,
        })
      );
    });

    it('should use template if template_id provided', async () => {
      const template = {
        render: jest.fn().mockReturnValue('Rendered template prompt'),
      };

      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        template_id: 1,
        template_variables: { topic: 'JavaScript' },
      };

      const createdContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Generated text' },
        generation_method_id: 'ai_assisted',
      });

      promptTemplateService.getTemplate.mockResolvedValue(template);
      aiGenerationService.generateText.mockResolvedValue('Generated text');
      contentRepository.create.mockResolvedValue(createdContent);

      await useCase.execute(generationRequest);

      expect(promptTemplateService.getTemplate).toHaveBeenCalledWith(1);
      expect(template.render).toHaveBeenCalledWith({ topic: 'JavaScript' });
      expect(aiGenerationService.generateText).toHaveBeenCalledWith(
        'Rendered template prompt',
        expect.any(Object)
      );
    });

    it('should throw error if topic_id is missing', async () => {
      const generationRequest = {
        content_type_id: 'text',
        prompt: 'Test prompt',
      };

      await expect(useCase.execute(generationRequest)).rejects.toThrow(
        'topic_id is required'
      );
    });

    it('should throw error if content_type_id is missing', async () => {
      const generationRequest = {
        topic_id: 1,
        prompt: 'Test prompt',
      };

      await expect(useCase.execute(generationRequest)).rejects.toThrow(
        'content_type_id is required'
      );
    });

    it('should throw error if neither prompt nor template_id provided', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
      };

      await expect(useCase.execute(generationRequest)).rejects.toThrow(
        'Either prompt or template_id is required'
      );
    });

    it('should handle AI generation errors gracefully', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        prompt: 'Test prompt',
      };

      aiGenerationService.generateText.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(useCase.execute(generationRequest)).rejects.toThrow(
        'AI generation failed'
      );
    });

    it('should not fail if quality check service fails', async () => {
      const generationRequest = {
        topic_id: 1,
        content_type_id: 'text',
        prompt: 'Test prompt',
      };

      const createdContent = new Content({
        content_id: 1,
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Generated' },
        generation_method_id: 'ai_assisted',
      });

      aiGenerationService.generateText.mockResolvedValue('Generated');
      contentRepository.create.mockResolvedValue(createdContent);
      qualityCheckService.triggerQualityCheck.mockRejectedValue(
        new Error('Quality check unavailable')
      );

      // Should not throw
      const result = await useCase.execute(generationRequest);
      expect(result).toBeInstanceOf(Content);
    });
  });
});

