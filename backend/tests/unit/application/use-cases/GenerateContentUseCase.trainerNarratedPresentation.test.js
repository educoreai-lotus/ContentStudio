import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const PDF_MAGIC = Buffer.from('%PDF-1.4 mock');

describe('GenerateContentUseCase Trainer narrated Type-6 branch', () => {
  const originalFlag = process.env.TRAINER_NARRATED_PRESENTATION_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.TRAINER_NARRATED_PRESENTATION_ENABLED;
    } else {
      process.env.TRAINER_NARRATED_PRESENTATION_ENABLED = originalFlag;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest.resetModules();
  });

  async function loadUseCaseWithMocks({
    flagOn,
    presentationContent,
    narratedExecute,
    heygenExecute,
  }) {
    process.env.TRAINER_NARRATED_PRESENTATION_ENABLED = flagOn ? 'true' : 'false';

    const narratedExecuteFn =
      narratedExecute ||
      jest.fn().mockResolvedValue({
        success: true,
        content_data: {
          script: 'Narrated',
          videoUrl: 'https://cdn.example/narrated.mp4',
          fileUrl: 'https://cdn.example/narrated.mp4',
          duration_seconds: 10,
          videoMode: 'presentation_narration',
          fileName: 'narrated.mp4',
          fileSize: 100,
          fileType: 'video/mp4',
          storagePath: 'avatar_videos/narrated.mp4',
          uploadedAt: new Date().toISOString(),
        },
      });

    const heygenExecuteFn =
      heygenExecute ||
      jest.fn().mockResolvedValue({
        success: true,
        videoUrl: 'https://cdn.example/heygen.mp4',
        videoId: 'hg-123',
        duration_seconds: 30,
        status: 'completed',
        explanation: 'heygen script',
        metadata: {},
      });

    jest.unstable_mockModule(
      '../../../../src/application/use-cases/GenerateNarratedVideoFromPresentationUseCase.js',
      () => ({
        GenerateNarratedVideoFromPresentationUseCase: jest.fn().mockImplementation(() => ({
          execute: narratedExecuteFn,
        })),
        isPdfPresentationBuffer: jest.fn(),
      })
    );

    jest.unstable_mockModule(
      '../../../../src/application/use-cases/GenerateAvatarVideoFromPresentationUseCase.js',
      () => ({
        GenerateAvatarVideoFromPresentationUseCase: jest.fn().mockImplementation(() => ({
          execute: heygenExecuteFn,
        })),
      })
    );

    jest.unstable_mockModule(
      '../../../../src/infrastructure/database/repositories/RepositoryFactory.js',
      () => ({
        RepositoryFactory: {
          getTopicRepository: jest.fn().mockResolvedValue({}),
          getCourseRepository: jest.fn().mockResolvedValue({}),
        },
      })
    );

    const { GenerateContentUseCase } = await import(
      '../../../../src/application/use-cases/GenerateContentUseCase.js'
    );

    const contentRepository = {
      findByTopicId: jest.fn().mockResolvedValue(
        presentationContent
          ? [presentationContent]
          : [{ content_id: 1, content_type_id: 1, content_data: { text: 'x' } }]
      ),
      findById: jest.fn().mockResolvedValue(presentationContent || null),
    };

    const aiGenerationService = {
      openaiClient: { generateText: jest.fn() },
      ttsClient: { generateAudio: jest.fn() },
      heygenClient: { generateVideo: jest.fn() },
      storageClient: { uploadFile: jest.fn() },
    };

    const useCase = new GenerateContentUseCase({
      contentRepository,
      aiGenerationService,
      promptTemplateService: { getTemplate: jest.fn() },
      qualityCheckService: null,
      topicRepository: {
        findById: jest.fn().mockResolvedValue({
          topic_name: 'Topic',
          description: 'Desc',
          language: 'en',
          skills: ['js'],
        }),
      },
    });

    return { useCase, narratedExecuteFn, heygenExecuteFn, contentRepository, aiGenerationService };
  }

  function makeBaseRequest(overrides = {}) {
    return {
      topic_id: 10,
      content_type_id: 6,
      prompt: 'ignored for type 6',
      lessonTopic: 'Topic',
      lessonDescription: 'Desc',
      language: 'en',
      skillsList: ['js'],
      ...overrides,
    };
  }

  const presentation = {
    content_id: 30,
    content_type_id: 3,
    content_data: {
      presentationUrl: 'https://cdn.example/deck.pdf',
      storagePath: 'presentations/deck.pdf',
    },
  };

  it('flag OFF calls HeyGen use case and not narrated use case', async () => {
    const { useCase, narratedExecuteFn, heygenExecuteFn } = await loadUseCaseWithMocks({
      flagOn: false,
      presentationContent: presentation,
    });

    const content = await useCase.execute(makeBaseRequest());

    expect(heygenExecuteFn).toHaveBeenCalledTimes(1);
    expect(narratedExecuteFn).not.toHaveBeenCalled();
    expect(content.content_data.videoId).toBe('hg-123');
    expect(content.content_data.videoMode).toBeUndefined();
  });

  it('flag ON calls narrated use case and not HeyGen use case', async () => {
    const { useCase, narratedExecuteFn, heygenExecuteFn, aiGenerationService } =
      await loadUseCaseWithMocks({
        flagOn: true,
        presentationContent: presentation,
      });

    const content = await useCase.execute(makeBaseRequest());

    expect(narratedExecuteFn).toHaveBeenCalledTimes(1);
    expect(heygenExecuteFn).not.toHaveBeenCalled();
    expect(aiGenerationService.heygenClient.generateVideo).not.toHaveBeenCalled();
    expect(content.content_data.videoMode).toBe('presentation_narration');
    expect(content.content_data.videoUrl).toBe('https://cdn.example/narrated.mp4');
    expect(content.content_data.fileUrl).toBe('https://cdn.example/narrated.mp4');
    expect(content.content_data.videoId).toBeUndefined();
  });

  it('flag ON + no Presentation returns PRESENTATION_REQUIRED without calling narrated/HeyGen', async () => {
    const { useCase, narratedExecuteFn, heygenExecuteFn } = await loadUseCaseWithMocks({
      flagOn: true,
      presentationContent: null,
    });

    const content = await useCase.execute(makeBaseRequest());

    expect(content.content_data.status).toBe('failed');
    expect(content.content_data.errorCode).toBe('PRESENTATION_REQUIRED');
    expect(narratedExecuteFn).not.toHaveBeenCalled();
    expect(heygenExecuteFn).not.toHaveBeenCalled();
  });

  it('does not alter text generation path', async () => {
    process.env.TRAINER_NARRATED_PRESENTATION_ENABLED = 'true';
    jest.resetModules();

    const { GenerateContentUseCase } = await import(
      '../../../../src/application/use-cases/GenerateContentUseCase.js'
    );

    const generateText = jest.fn().mockResolvedValue('Hello lesson');
    const generateAudio = jest.fn().mockResolvedValue({
      audioUrl: 'https://cdn.example/a.mp3',
      format: 'mp3',
      duration: 5,
      voice: 'alloy',
    });

    const useCase = new GenerateContentUseCase({
      contentRepository: { findByTopicId: jest.fn() },
      aiGenerationService: {
        generateText,
        generateAudio,
        openaiClient: {},
        ttsClient: {},
      },
      promptTemplateService: { getTemplate: jest.fn().mockResolvedValue(null) },
      qualityCheckService: null,
      topicRepository: {
        findById: jest.fn().mockResolvedValue({
          topic_name: 'T',
          description: 'D',
          language: 'en',
          skills: ['a'],
        }),
      },
    });

    const content = await useCase.execute({
      topic_id: 1,
      content_type_id: 1,
      prompt: 'write text',
      lessonTopic: 'T',
      lessonDescription: 'D',
      language: 'en',
      skillsList: ['a'],
    });

    expect(generateText).toHaveBeenCalled();
    expect(content.content_type_id).toBe(1);
    expect(content.content_data.text).toBe('Hello lesson');
  });
});
