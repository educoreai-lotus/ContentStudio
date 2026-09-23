import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Content } from '../../../../src/domain/entities/Content.js';
import { ContentGenerationOrchestrator } from '../../../../src/application/services/ContentGenerationOrchestrator.js';
import { isVideoToLessonNarratedPresentationEnabled } from '../../../../src/application/services/videoToLessonNarratedPresentationConfig.js';
import {
  buildType4FromNarrationBundle,
  buildType1FromNarrationBundle,
} from '../../../../src/application/services/fillers/personalizedSynchronizedContent.js';

describe('isVideoToLessonNarratedPresentationEnabled', () => {
  it('defaults to false', () => {
    expect(isVideoToLessonNarratedPresentationEnabled({})).toBe(false);
    expect(
      isVideoToLessonNarratedPresentationEnabled({
        VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED: 'false',
      })
    ).toBe(false);
  });

  it('enables only when exactly true', () => {
    expect(
      isVideoToLessonNarratedPresentationEnabled({
        VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED: 'true',
      })
    ).toBe(true);
  });
});

describe('buildType4FromNarrationBundle', () => {
  it('reuses the same audioUrl as Type 1', () => {
    const narrationBundle = {
      combinedText: 'A\n\nB',
      combinedAudioDuration: 9,
      audioVoice: 'alloy',
      audioFormat: 'mp3',
    };
    const audioUrl = 'https://cdn.example/shared.mp3';
    const type1 = buildType1FromNarrationBundle({ narrationBundle, audioUrl });
    const type4 = buildType4FromNarrationBundle({ narrationBundle, audioUrl });
    expect(type1.audioUrl).toBe(type4.audioUrl);
    expect(type4.text).toBeUndefined();
    expect(type4.audioDuration).toBe(9);
  });
});

function createOrchestrator({ executeImpl }) {
  const created = [];
  const contentRepository = {
    findLatestByTopicAndType: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (entity) => {
      const saved = {
        content_id: created.length + 1,
        topic_id: entity.topic_id,
        content_type_id: entity.content_type_id,
        content_data: entity.content_data,
        generation_method_id: entity.generation_method_id,
      };
      created.push(saved);
      return saved;
    }),
    update: jest.fn(),
  };

  const topicRepository = {
    findById: jest.fn().mockResolvedValue({
      topic_name: 'V2L Topic',
      description: 'Desc',
      language: 'en',
      skills: ['skill-a'],
    }),
  };

  const orchestrator = new ContentGenerationOrchestrator({
    aiGenerationService: {
      openaiClient: { generateText: jest.fn() },
      ttsClient: { generateAudio: jest.fn() },
      storageClient: { uploadFile: jest.fn() },
    },
    openaiClient: null,
    contentRepository,
    topicRepository,
    promptTemplateService: {},
    qualityCheckService: null,
    contentHistoryService: null,
  });

  orchestrator.generateContentUseCase = {
    execute: jest.fn().mockImplementation(executeImpl),
  };

  return { orchestrator, contentRepository, created };
}

function contentEntity(topicId, typeId, content_data) {
  return new Content({
    topic_id: topicId,
    content_type_id: typeId,
    content_data,
    generation_method_id: 'ai_assisted',
  });
}

describe('ContentGenerationOrchestrator flag OFF (legacy)', () => {
  it('runs all 6 formats via use case; does not call NarrationBundle/video services', async () => {
    const executeCalls = [];
    const { orchestrator } = createOrchestrator({
      executeImpl: async (req) => {
        executeCalls.push(req.content_type_id);
        const dataByType = {
          1: { text: 'legacy text', audioUrl: 'https://a1.mp3', audioFormat: 'mp3', audioDuration: 1, audioVoice: 'alloy' },
          2: { code: 'console.log(1)', language: 'javascript' },
          3: { presentationUrl: 'https://p.pdf', storagePath: 'p.pdf', format: 'gamma' },
          4: { audioUrl: 'https://a4.mp3', audioFormat: 'mp3', audioDuration: 2, audioVoice: 'alloy' },
          5: { nodes: [], edges: [] },
          6: { videoUrl: 'https://heygen.mp4', videoId: 'hg-1', duration_seconds: 30, script: 's' },
        };
        return contentEntity(req.topic_id, req.content_type_id, dataByType[req.content_type_id]);
      },
    });

    const buildBundle = jest.fn();
    const generateVideo = jest.fn();

    const result = await orchestrator.generateAll('Hello transcript about learning.', {
      topic_id: 42,
      synchronizedMode: false,
      syncDeps: {
        narrationBundleService: { buildBundle },
        narratedVideoService: { generateVideo },
      },
    });

    expect(executeCalls.sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildBundle).not.toHaveBeenCalled();
    expect(generateVideo).not.toHaveBeenCalled();
    expect(result.content_formats.text_audio.generated).toBe(true);
    expect(result.content_formats.audio.generated).toBe(true);
    expect(result.content_formats.avatar_video.content_data.videoId).toBe('hg-1');
    expect(result.content_formats.avatar_video.content_data.videoMode).toBeUndefined();
  });
});

describe('ContentGenerationOrchestrator flag ON (synchronized)', () => {
  const presentationBuffer = Buffer.from('%PDF-v2l');
  const slide1 = Buffer.from('s1-audio');
  const slide2 = Buffer.from('s2-audio');
  const combined = Buffer.from('combined-audio');
  const combinedText = 'Page one.\n\nPage two.';

  beforeEach(() => {});

  it('shares NarrationBundle across Type1, Type4, Type6 with one audio upload', async () => {
    const executeCalls = [];
    const { orchestrator, created } = createOrchestrator({
      executeImpl: async (req) => {
        executeCalls.push(req.content_type_id);
        // Sync path must NOT call use case for 1, 4, 6
        expect([2, 3, 5]).toContain(req.content_type_id);
        const dataByType = {
          2: { code: 'x', language: 'javascript' },
          3: {
            presentationUrl: 'https://cdn.example/pres.pdf',
            storagePath: 'presentations/pres.pdf',
            format: 'gamma',
          },
          5: { nodes: [{ id: '1' }], edges: [] },
        };
        return contentEntity(req.topic_id, req.content_type_id, dataByType[req.content_type_id]);
      },
    });

    const narrationBundle = {
      slides: [
        { pageNumber: 1, narration: 'Page one.', audioBuffer: slide1, duration: 4 },
        { pageNumber: 2, narration: 'Page two.', audioBuffer: slide2, duration: 5 },
      ],
      combinedText,
      combinedAudioBuffer: combined,
      combinedAudioDuration: 9,
      audioVoice: 'alloy',
      audioFormat: 'mp3',
    };

    const buildBundle = jest.fn().mockResolvedValue(narrationBundle);
    const generateVideo = jest.fn().mockImplementation(async ({ presentationBuffer: buf, narrationBundle: bundle }) => {
      expect(buf).toBe(presentationBuffer);
      expect(bundle).toBe(narrationBundle);
      return { videoBuffer: Buffer.from('MP4'), duration: 9, slideCount: 2 };
    });

    let audioUploadCount = 0;
    let videoUploadCount = 0;

    const result = await orchestrator.generateAll('Transcript body for V2L.', {
      topic_id: 99,
      synchronizedMode: true,
      syncDeps: {
        downloadPresentationBufferFn: async (url) => {
          expect(url).toBe('https://cdn.example/pres.pdf');
          return presentationBuffer;
        },
        narrationBundleService: { buildBundle },
        narratedVideoService: { generateVideo },
        uploadCombinedAudioFn: async ({ combinedAudioBuffer }) => {
          audioUploadCount += 1;
          expect(combinedAudioBuffer.equals(combined)).toBe(true);
          return { audioUrl: 'https://cdn.example/shared-lesson.mp3' };
        },
        uploadVideoFn: async ({ videoBuffer }) => {
          videoUploadCount += 1;
          expect(videoBuffer.equals(Buffer.from('MP4'))).toBe(true);
          return {
            videoUrl: 'https://cdn.example/narrated.mp4',
            fileUrl: 'https://cdn.example/narrated.mp4',
            fileName: 'narrated.mp4',
            fileType: 'video/mp4',
            storagePath: 'avatar_videos/narrated.mp4',
          };
        },
      },
    });

    expect(executeCalls.sort()).toEqual([2, 3, 5]);
    expect(buildBundle).toHaveBeenCalledTimes(1);
    expect(generateVideo).toHaveBeenCalledTimes(1);
    expect(audioUploadCount).toBe(1);
    expect(videoUploadCount).toBe(1);

    const text = result.content_formats.text_audio;
    const audio = result.content_formats.audio;
    const video = result.content_formats.avatar_video;
    const slides = result.content_formats.slides;

    expect(text.generated).toBe(true);
    expect(audio.generated).toBe(true);
    expect(video.generated).toBe(true);
    expect(slides.generated).toBe(true);

    expect(text.content_data.text).toBe(combinedText);
    expect(text.content_data.audioUrl).toBe('https://cdn.example/shared-lesson.mp3');
    expect(audio.content_data.audioUrl).toBe(text.content_data.audioUrl);
    expect(audio.content_data.text).toBeUndefined();

    expect(video.content_data.videoMode).toBe('presentation_narration');
    expect(video.content_data.videoUrl).toBe(video.content_data.fileUrl);
    expect(video.content_data.script).toBe(combinedText);
    expect(video.content_data.videoId).toBeUndefined();

    // All 6 content types persisted
    const typeIds = created.map((c) => c.content_type_id).sort();
    expect(typeIds).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('accounts for 1 narration LLM + N TTS only inside bundle', async () => {
    const llm = { n: 0 };
    const tts = { n: 0 };

    const { orchestrator } = createOrchestrator({
      executeImpl: async (req) => {
        const dataByType = {
          2: { code: 'c' },
          3: { presentationUrl: 'https://p.pdf', storagePath: 'p.pdf', format: 'gamma' },
          5: { nodes: [], edges: [] },
        };
        return contentEntity(req.topic_id, req.content_type_id, dataByType[req.content_type_id]);
      },
    });

    await orchestrator.generateAll('Transcript.', {
      topic_id: 7,
      synchronizedMode: true,
      syncDeps: {
        downloadPresentationBufferFn: async () => presentationBuffer,
        narrationBundleService: {
          buildBundle: async () => {
            llm.n += 1;
            tts.n += 2;
            return {
              slides: [
                { pageNumber: 1, narration: 'A', audioBuffer: slide1, duration: 1 },
                { pageNumber: 2, narration: 'B', audioBuffer: slide2, duration: 1 },
              ],
              combinedText: 'A\n\nB',
              combinedAudioBuffer: combined,
              combinedAudioDuration: 2,
              audioVoice: 'alloy',
              audioFormat: 'mp3',
            };
          },
        },
        narratedVideoService: {
          generateVideo: async () => ({
            videoBuffer: Buffer.from('v'),
            duration: 2,
            slideCount: 2,
          }),
        },
        uploadCombinedAudioFn: async () => ({ audioUrl: 'https://a.mp3' }),
        uploadVideoFn: async () => ({
          videoUrl: 'https://v.mp4',
          fileUrl: 'https://v.mp4',
          fileType: 'video/mp4',
        }),
      },
    });

    expect(llm.n).toBe(1);
    expect(tts.n).toBe(2);
  });

  it('does not fall back to legacy Type1/4/6 when NarrationBundle fails', async () => {
    const executeCalls = [];
    const { orchestrator } = createOrchestrator({
      executeImpl: async (req) => {
        executeCalls.push(req.content_type_id);
        const dataByType = {
          2: { code: 'c' },
          3: { presentationUrl: 'https://p.pdf', storagePath: 'p.pdf', format: 'gamma' },
          5: { nodes: [], edges: [] },
        };
        return contentEntity(req.topic_id, req.content_type_id, dataByType[req.content_type_id]);
      },
    });

    const result = await orchestrator.generateAll('Transcript.', {
      topic_id: 8,
      synchronizedMode: true,
      syncDeps: {
        downloadPresentationBufferFn: async () => presentationBuffer,
        narrationBundleService: {
          buildBundle: async () => {
            throw new Error('bundle boom');
          },
        },
      },
    });

    expect(executeCalls.sort()).toEqual([2, 3, 5]);
    expect(result.content_formats.text_audio.generated).toBe(false);
    expect(result.content_formats.audio.generated).toBe(false);
    expect(result.content_formats.avatar_video.generated).toBe(false);
    expect(result.content_formats.avatar_video.content_data.videoMode).toBe(
      'presentation_narration'
    );
    expect(result.content_formats.code_examples.generated).toBe(true);
    expect(result.content_formats.mind_map.generated).toBe(true);
    expect(result.content_formats.slides.generated).toBe(true);
  });

  it('keeps Code/Mind Map independent when presentation fails', async () => {
    const { orchestrator } = createOrchestrator({
      executeImpl: async (req) => {
        if (req.content_type_id === 3) {
          throw new Error('gamma down');
        }
        const dataByType = {
          2: { code: 'c' },
          5: { nodes: [], edges: [] },
        };
        return contentEntity(req.topic_id, req.content_type_id, dataByType[req.content_type_id]);
      },
    });

    const buildBundle = jest.fn();
    const result = await orchestrator.generateAll('Transcript.', {
      topic_id: 11,
      synchronizedMode: true,
      syncDeps: { narrationBundleService: { buildBundle } },
    });

    expect(buildBundle).not.toHaveBeenCalled();
    expect(result.content_formats.code_examples.generated).toBe(true);
    expect(result.content_formats.mind_map.generated).toBe(true);
    expect(result.content_formats.slides.generated).toBe(false);
    expect(result.content_formats.text_audio.generated).toBe(false);
    expect(result.content_formats.audio.generated).toBe(false);
    expect(result.content_formats.avatar_video.generated).toBe(false);
  });
});
