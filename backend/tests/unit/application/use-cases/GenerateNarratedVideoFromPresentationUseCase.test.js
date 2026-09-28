import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  GenerateNarratedVideoFromPresentationUseCase,
  isPdfPresentationBuffer,
} from '../../../../src/application/use-cases/GenerateNarratedVideoFromPresentationUseCase.js';
import { ContentDataCleaner } from '../../../../src/application/utils/ContentDataCleaner.js';

const PDF_MAGIC = Buffer.from('%PDF-1.4 mock');
const PPTX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]); // ZIP/PPTX

function makeBundle(slideCount = 2) {
  const slides = Array.from({ length: slideCount }, (_, i) => ({
    pageNumber: i + 1,
    narration: `Slide ${i + 1} narration`,
    audioBuffer: Buffer.from(`audio-${i + 1}`),
    duration: 3,
  }));
  return {
    slides,
    combinedText: slides.map((s) => s.narration).join('\n\n'),
    combinedAudioBuffer: Buffer.from('combined-audio'),
    combinedAudioDuration: slideCount * 3,
    audioVoice: 'alloy',
    audioFormat: 'mp3',
  };
}

describe('isPdfPresentationBuffer', () => {
  it('detects PDF by magic bytes', () => {
    expect(isPdfPresentationBuffer('https://cdn.example/file.bin', PDF_MAGIC)).toBe(true);
  });

  it('detects PDF by URL extension', () => {
    expect(
      isPdfPresentationBuffer('https://cdn.example/deck.pdf?x=1', Buffer.from('not-pdf'))
    ).toBe(true);
  });

  it('rejects PPTX magic without .pdf URL', () => {
    expect(isPdfPresentationBuffer('https://cdn.example/deck.pptx', PPTX_MAGIC)).toBe(false);
  });
});

describe('GenerateNarratedVideoFromPresentationUseCase', () => {
  let contentRepository;
  let openaiClient;
  let ttsClient;
  let narrationBundleService;
  let narratedVideoService;
  let avatarVideoStorage;
  let downloadFn;
  let useCase;

  beforeEach(() => {
    contentRepository = {
      findById: jest.fn().mockResolvedValue({
        content_id: 30,
        content_type_id: 3,
        content_data: {
          presentationUrl: 'https://cdn.example/deck.pdf',
          storagePath: 'presentations/deck.pdf',
        },
      }),
    };
    openaiClient = { generateText: jest.fn() };
    ttsClient = { generateAudio: jest.fn() };
    narrationBundleService = {
      buildBundle: jest.fn().mockResolvedValue(makeBundle(2)),
    };
    narratedVideoService = {
      generateVideo: jest.fn().mockResolvedValue({
        videoBuffer: Buffer.from('fake-mp4'),
        duration: 6,
        slideCount: 2,
      }),
    };
    avatarVideoStorage = {
      uploadVideoToStorage: jest.fn().mockResolvedValue({
        fileUrl: 'https://cdn.example/avatar_videos/out.mp4',
        fileName: 'out.mp4',
        fileSize: 8,
        fileType: 'video/mp4',
        storagePath: 'avatar_videos/out.mp4',
        uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        sha256Hash: 'abc',
        digitalSignature: 'sig',
      }),
    };
    downloadFn = jest.fn().mockResolvedValue({ data: PDF_MAGIC });

    useCase = new GenerateNarratedVideoFromPresentationUseCase({
      contentRepository,
      openaiClient,
      ttsClient,
      narrationBundleService,
      narratedVideoService,
      avatarVideoStorage,
      downloadFn,
    });
  });

  it('builds Type-6 narrated content_data without videoId or HeyGen', async () => {
    const result = await useCase.execute({
      presentation_content_id: 30,
      language: 'en',
      topicName: 'Loops',
    });

    expect(result.success).toBe(true);
    expect(result.content_data.videoUrl).toBe('https://cdn.example/avatar_videos/out.mp4');
    expect(result.content_data.fileUrl).toBe('https://cdn.example/avatar_videos/out.mp4');
    expect(result.content_data.videoMode).toBe('presentation_narration');
    expect(result.content_data.duration_seconds).toBe(6);
    expect(result.content_data.fileType).toBe('video/mp4');
    expect(result.content_data.script).toContain('Slide 1');
    expect(result.content_data.videoId).toBeUndefined();
    expect(result.content_data.storagePath).toBe('avatar_videos/out.mp4');
  });

  it('calls NarrationBundle once and video service once', async () => {
    await useCase.execute({ presentation_content_id: 30, language: 'en' });

    expect(narrationBundleService.buildBundle).toHaveBeenCalledTimes(1);
    expect(narratedVideoService.generateVideo).toHaveBeenCalledTimes(1);
    const bundleResult = await narrationBundleService.buildBundle.mock.results[0].value;
    expect(narratedVideoService.generateVideo.mock.calls[0][0].narrationBundle).toBe(
      bundleResult
    );
  });

  it('does not call openai/tts outside NarrationBundle (video path has 0 LLM/TTS)', async () => {
    await useCase.execute({ presentation_content_id: 30, language: 'en' });

    expect(openaiClient.generateText).not.toHaveBeenCalled();
    expect(ttsClient.generateAudio).not.toHaveBeenCalled();
  });

  it('rejects PPTX with UNSUPPORTED_PRESENTATION_FORMAT (no HeyGen fallback)', async () => {
    downloadFn.mockResolvedValue({ data: PPTX_MAGIC });
    contentRepository.findById.mockResolvedValue({
      content_id: 30,
      content_type_id: 3,
      content_data: { presentationUrl: 'https://cdn.example/deck.pptx' },
    });

    const result = await useCase.execute({ presentation_content_id: 30, language: 'en' });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED_PRESENTATION_FORMAT');
    expect(narrationBundleService.buildBundle).not.toHaveBeenCalled();
    expect(narratedVideoService.generateVideo).not.toHaveBeenCalled();
  });

  it('fails when presentation content missing', async () => {
    contentRepository.findById.mockResolvedValue(null);
    const result = await useCase.execute({ presentation_content_id: 99, language: 'en' });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PRESENTATION_REQUIRED');
  });

  it('prefers fileUrl then presentationUrl (same as legacy Type-6 resolver)', async () => {
    contentRepository.findById.mockResolvedValue({
      content_id: 30,
      content_type_id: 3,
      content_data: {
        fileUrl: 'https://cdn.example/from-file.pdf',
        presentationUrl: 'https://cdn.example/from-presentation.pdf',
      },
    });

    await useCase.execute({ presentation_content_id: 30, language: 'en' });

    expect(downloadFn).toHaveBeenCalledWith(
      'https://cdn.example/from-file.pdf',
      expect.objectContaining({ responseType: 'arraybuffer' })
    );
  });

  it('ContentDataCleaner preserves narrated Type-6 fields without requiring videoId', () => {
    const raw = {
      script: 'A\n\nB',
      videoUrl: 'https://cdn.example/v.mp4',
      fileUrl: 'https://cdn.example/v.mp4',
      duration_seconds: 12,
      videoMode: 'presentation_narration',
      fileName: 'v.mp4',
      fileSize: 100,
      fileType: 'video/mp4',
      storagePath: 'avatar_videos/v.mp4',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    };
    const cleaned = ContentDataCleaner.cleanAvatarVideoData(raw);
    expect(cleaned.videoMode).toBe('presentation_narration');
    expect(cleaned.videoUrl).toBe(raw.videoUrl);
    expect(cleaned.fileUrl).toBe(raw.fileUrl);
    expect(cleaned.duration_seconds).toBe(12);
    expect(cleaned.videoId).toBeUndefined();
  });
});

describe('NarrationBundle TTS accounting (Trainer narrated path)', () => {
  it('N slides imply N TTS calls only inside NarrationBundle mock', async () => {
    const slideCount = 4;
    const ttsClient = {
      generateAudio: jest.fn().mockResolvedValue({ audioBuffer: Buffer.from('a'), format: 'mp3' }),
    };
    // Simulate NarrationBundle calling TTS N times; use case must not add more.
    const narrationBundleService = {
      buildBundle: jest.fn().mockImplementation(async () => {
        for (let i = 0; i < slideCount; i += 1) {
          await ttsClient.generateAudio({ text: `s${i}` });
        }
        return makeBundle(slideCount);
      }),
    };
    const narratedVideoService = {
      generateVideo: jest.fn().mockResolvedValue({
        videoBuffer: Buffer.from('mp4'),
        duration: 12,
        slideCount,
      }),
    };
    const useCase = new GenerateNarratedVideoFromPresentationUseCase({
      contentRepository: {
        findById: jest.fn().mockResolvedValue({
          content_id: 1,
          content_type_id: 3,
          content_data: { presentationUrl: 'https://cdn.example/d.pdf' },
        }),
      },
      openaiClient: { generateText: jest.fn() },
      ttsClient,
      narrationBundleService,
      narratedVideoService,
      avatarVideoStorage: {
        uploadVideoToStorage: jest.fn().mockResolvedValue({
          fileUrl: 'https://cdn.example/v.mp4',
          fileName: 'v.mp4',
          fileSize: 3,
          fileType: 'video/mp4',
          storagePath: 'avatar_videos/v.mp4',
          uploadedAt: new Date(),
        }),
      },
      downloadFn: jest.fn().mockResolvedValue({ data: PDF_MAGIC }),
    });

    await useCase.execute({ presentation_content_id: 1, language: 'en' });

    expect(ttsClient.generateAudio).toHaveBeenCalledTimes(slideCount);
    expect(narrationBundleService.buildBundle).toHaveBeenCalledTimes(1);
    expect(narratedVideoService.generateVideo).toHaveBeenCalledTimes(1);
  });
});
