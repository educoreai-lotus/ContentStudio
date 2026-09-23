import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ContentDataCleaner } from '../../../../../src/application/utils/ContentDataCleaner.js';
import { isPersonalizedNarratedPresentationEnabled } from '../../../../../src/application/services/fillers/personalizedNarratedPresentationConfig.js';
import {
  buildType1FromNarrationBundle,
  buildType6FromNarratedVideo,
  buildSynchronizedTextAndVideoFromPresentation,
} from '../../../../../src/application/services/fillers/personalizedSynchronizedContent.js';
import { generateTopicForStep } from '../../../../../src/application/services/fillers/fillCourseBuilderService.js';

describe('isPersonalizedNarratedPresentationEnabled', () => {
  it('defaults to false', () => {
    expect(isPersonalizedNarratedPresentationEnabled({})).toBe(false);
    expect(isPersonalizedNarratedPresentationEnabled({ PERSONALIZED_NARRATED_PRESENTATION_ENABLED: 'false' })).toBe(
      false
    );
  });

  it('enables only when exactly true', () => {
    expect(
      isPersonalizedNarratedPresentationEnabled({ PERSONALIZED_NARRATED_PRESENTATION_ENABLED: 'true' })
    ).toBe(true);
  });
});

describe('ContentDataCleaner videoMode', () => {
  it('preserves videoMode=presentation_narration', () => {
    const cleaned = ContentDataCleaner.cleanAvatarVideoData({
      script: 'hello',
      videoUrl: 'https://cdn.example/v.mp4',
      fileUrl: 'https://cdn.example/v.mp4',
      duration_seconds: 12,
      videoMode: 'presentation_narration',
      fileName: 'v.mp4',
      fileType: 'video/mp4',
      storagePath: 'avatar_videos/v.mp4',
    });
    expect(cleaned.videoMode).toBe('presentation_narration');
    expect(cleaned.videoUrl).toBe(cleaned.fileUrl);
  });

  it('does not invent videoMode for legacy HeyGen payloads', () => {
    const cleaned = ContentDataCleaner.cleanAvatarVideoData({
      script: 'heygen',
      videoUrl: 'https://cdn.example/h.mp4',
      videoId: 'hg-1',
      duration_seconds: 30,
    });
    expect(cleaned.videoMode).toBeUndefined();
    expect(cleaned.videoId).toBe('hg-1');
  });
});

describe('buildType1 / buildType6 from NarrationBundle', () => {
  it('builds Type-1 from combinedText and uploaded audio URL', () => {
    const data = buildType1FromNarrationBundle({
      narrationBundle: {
        combinedText: 'Slide one.\n\nSlide two.',
        combinedAudioDuration: 20.5,
        audioVoice: 'alloy',
        audioFormat: 'mp3',
      },
      audioUrl: 'https://cdn.example/combined.mp3',
    });
    expect(data).toEqual({
      text: 'Slide one.\n\nSlide two.',
      audioUrl: 'https://cdn.example/combined.mp3',
      audioVoice: 'alloy',
      audioFormat: 'mp3',
      audioDuration: 20.5,
    });
  });

  it('builds Type-6 with videoMode presentation_narration and matching URLs', () => {
    const data = buildType6FromNarratedVideo({
      narrationBundle: { combinedText: 'joined' },
      video: { duration: 20.5 },
      upload: {
        videoUrl: 'https://cdn.example/final.mp4',
        fileUrl: 'https://cdn.example/final.mp4',
        fileName: 'final.mp4',
        fileType: 'video/mp4',
        storagePath: 'avatar_videos/final.mp4',
      },
    });
    expect(data.videoMode).toBe('presentation_narration');
    expect(data.videoUrl).toBe(data.fileUrl);
    expect(data.script).toBe('joined');
    expect(data.duration_seconds).toBe(20.5);
    expect(data.videoId).toBeUndefined();
  });
});

describe('generateTopicForStep flag OFF (legacy)', () => {
  it('uses existing text LLM + TTS + HeyGen avatar path; does not call narrated services', async () => {
    const generateText = jest.fn().mockResolvedValue('Legacy lesson text');
    const generateAudio = jest.fn().mockResolvedValue({
      audioUrl: 'https://cdn.example/legacy.mp3',
      format: 'mp3',
      duration: 11,
      voice: 'alloy',
    });
    const generateCode = jest.fn().mockResolvedValue({ code: 'console.log(1)', language: 'javascript' });
    const generatePresentation = jest.fn().mockResolvedValue({
      format: 'gamma',
      presentationUrl: 'https://cdn.example/p.pdf',
      storagePath: 'presentations/p.pdf',
    });
    const generateMindMap = jest.fn().mockResolvedValue({ nodes: [{ id: '1' }], edges: [] });
    const generateAvatarVideo = jest.fn().mockResolvedValue({
      script: 'heygen script',
      videoUrl: 'https://cdn.example/heygen.mp4',
      videoId: 'hg-123',
      duration_seconds: 30,
      status: 'completed',
    });

    const buildBundle = jest.fn();
    const generateVideo = jest.fn();

    const topic = await generateTopicForStep({
      step: { title: 'Legacy Topic', description: 'Desc', skills_covered: ['A'] },
      language: 'en',
      aiGenerationService: {
        generateText,
        generateAudio,
        generateCode,
        generatePresentation,
        generateMindMap,
        generateAvatarVideo,
      },
      deps: {
        synchronizedMode: false,
        narrationBundleService: { buildBundle },
        narratedVideoService: { generateVideo },
      },
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateAudio).toHaveBeenCalledTimes(1);
    expect(generateAvatarVideo).toHaveBeenCalledTimes(1);
    expect(buildBundle).not.toHaveBeenCalled();
    expect(generateVideo).not.toHaveBeenCalled();

    expect(topic.contents.map((c) => c.content_type)).toEqual([
      'text',
      'code',
      'presentation',
      'mind_map',
      'avatar_video',
    ]);
    expect(topic.contents[0].content_data.text).toBe('Legacy lesson text');
    expect(topic.contents[0].content_data.audioUrl).toBe('https://cdn.example/legacy.mp3');
    expect(topic.contents[4].content_data.videoId).toBe('hg-123');
    expect(topic.contents[4].content_data.videoMode).toBeUndefined();
  });
});

describe('generateTopicForStep flag ON (synchronized)', () => {
  const presentationBuffer = Buffer.from('%PDF-synced');
  const slideAudio1 = Buffer.from('page-1-audio-bytes');
  const slideAudio2 = Buffer.from('page-2-audio-bytes');
  const combinedAudio = Buffer.from('combined-audio-bytes');
  const combinedText = 'Narration page one.\n\nNarration page two.';

  let uploadAudioCalls;
  let uploadVideoCalls;

  beforeEach(() => {
    uploadAudioCalls = [];
    uploadVideoCalls = [];
  });

  function buildMocks() {
    const generateText = jest.fn();
    const generateAudio = jest.fn();
    const generateAvatarVideo = jest.fn();
    const generateCode = jest.fn().mockResolvedValue({ code: 'x', language: 'javascript' });
    const generatePresentation = jest.fn().mockResolvedValue({
      format: 'gamma',
      presentationUrl: 'https://cdn.example/pres.pdf',
      storagePath: 'presentations/pres.pdf',
    });
    const generateMindMap = jest.fn().mockResolvedValue({ nodes: [], edges: [] });

    const narrationBundle = {
      slides: [
        { pageNumber: 1, narration: 'Narration page one.', audioBuffer: slideAudio1, duration: 5 },
        { pageNumber: 2, narration: 'Narration page two.', audioBuffer: slideAudio2, duration: 7 },
      ],
      combinedText,
      combinedAudioBuffer: combinedAudio,
      combinedAudioDuration: 12,
      audioVoice: 'alloy',
      audioFormat: 'mp3',
    };

    const buildBundle = jest.fn().mockResolvedValue(narrationBundle);
    const generateVideo = jest.fn().mockImplementation(async ({ presentationBuffer: buf, narrationBundle: bundle }) => {
      expect(buf).toBe(presentationBuffer);
      expect(bundle).toBe(narrationBundle);
      expect(bundle.slides[0].audioBuffer).toBe(slideAudio1);
      expect(bundle.slides[1].audioBuffer).toBe(slideAudio2);
      return {
        videoBuffer: Buffer.from('FINAL-MP4'),
        duration: 12,
        slideCount: 2,
      };
    });

    const uploadCombinedAudioFn = jest.fn().mockImplementation(async ({ combinedAudioBuffer }) => {
      uploadAudioCalls.push(combinedAudioBuffer);
      expect(combinedAudioBuffer.equals(combinedAudio)).toBe(true);
      return { audioUrl: 'https://cdn.example/synced-combined.mp3' };
    });

    const uploadVideoFn = jest.fn().mockImplementation(async ({ videoBuffer }) => {
      uploadVideoCalls.push(videoBuffer);
      expect(videoBuffer.equals(Buffer.from('FINAL-MP4'))).toBe(true);
      return {
        videoUrl: 'https://cdn.example/synced-video.mp4',
        fileUrl: 'https://cdn.example/synced-video.mp4',
        fileName: 'synced-video.mp4',
        fileType: 'video/mp4',
        storagePath: 'avatar_videos/synced-video.mp4',
      };
    });

    return {
      generateText,
      generateAudio,
      generateAvatarVideo,
      generateCode,
      generatePresentation,
      generateMindMap,
      buildBundle,
      generateVideo,
      uploadCombinedAudioFn,
      uploadVideoFn,
      narrationBundle,
      aiGenerationService: {
        generateText,
        generateAudio,
        generateCode,
        generatePresentation,
        generateMindMap,
        generateAvatarVideo,
        openaiClient: { generateText: jest.fn() },
        ttsClient: { generateAudio: jest.fn() },
        storageClient: { uploadFile: jest.fn() },
      },
    };
  }

  it('builds synchronized Type-1 and Type-6 from one NarrationBundle', async () => {
    const m = buildMocks();

    const topic = await generateTopicForStep({
      step: { title: 'Synced Topic', description: 'About sync', skills_covered: ['Sync'] },
      language: 'en',
      aiGenerationService: m.aiGenerationService,
      deps: {
        synchronizedMode: true,
        downloadPresentationBufferFn: async () => presentationBuffer,
        narrationBundleService: { buildBundle: m.buildBundle },
        narratedVideoService: { generateVideo: m.generateVideo },
        uploadCombinedAudioFn: m.uploadCombinedAudioFn,
        uploadVideoFn: m.uploadVideoFn,
      },
    });

    // Presentation once
    expect(m.generatePresentation).toHaveBeenCalledTimes(1);
    // NarrationBundle once
    expect(m.buildBundle).toHaveBeenCalledTimes(1);
    expect(m.buildBundle.mock.calls[0][0].presentationBuffer).toBe(presentationBuffer);

    // Old independent text/TTS/HeyGen NOT used
    expect(m.generateText).not.toHaveBeenCalled();
    expect(m.generateAudio).not.toHaveBeenCalled();
    expect(m.generateAvatarVideo).not.toHaveBeenCalled();

    // Video once with same buffer + bundle
    expect(m.generateVideo).toHaveBeenCalledTimes(1);

    // Storage: combined audio once, video once; no per-page audio upload
    expect(m.uploadCombinedAudioFn).toHaveBeenCalledTimes(1);
    expect(m.uploadVideoFn).toHaveBeenCalledTimes(1);
    expect(uploadAudioCalls).toHaveLength(1);
    expect(uploadVideoCalls).toHaveLength(1);

    expect(topic.contents.map((c) => c.content_type)).toEqual([
      'text',
      'code',
      'presentation',
      'mind_map',
      'avatar_video',
    ]);

    const textData = topic.contents[0].content_data;
    expect(textData.text).toBe(combinedText);
    expect(textData.audioUrl).toBe('https://cdn.example/synced-combined.mp3');
    expect(textData.audioDuration).toBe(12);
    expect(textData.audioVoice).toBe('alloy');
    expect(textData.audioFormat).toBe('mp3');

    // Shared source: Type-1 text == joined per-slide narrations
    expect(textData.text).toBe(
      `${m.narrationBundle.slides[0].narration}\n\n${m.narrationBundle.slides[1].narration}`
    );

    const videoData = topic.contents[4].content_data;
    expect(videoData.videoMode).toBe('presentation_narration');
    expect(videoData.videoUrl).toBe(videoData.fileUrl);
    expect(videoData.script).toBe(combinedText);
    expect(videoData.duration_seconds).toBe(12);
    expect(videoData.videoId).toBeUndefined();

    // Presentation preserved
    expect(topic.contents[2].content_data.presentationUrl).toBe('https://cdn.example/pres.pdf');
  });

  it('accounts for 1 narration LLM + N TTS inside bundle only (no extras after)', async () => {
    const llmCalls = { count: 0 };
    const ttsCalls = { count: 0 };

    const narrationBundleService = {
      buildBundle: jest.fn().mockImplementation(async () => {
        // Simulate NarrationBundle accounting: 1 LLM + N TTS happen inside the service
        llmCalls.count += 1;
        ttsCalls.count += 2;
        return {
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: slideAudio1, duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: slideAudio2, duration: 1 },
          ],
          combinedText: 'A\n\nB',
          combinedAudioBuffer: combinedAudio,
          combinedAudioDuration: 2,
          audioVoice: 'alloy',
          audioFormat: 'mp3',
        };
      }),
    };

    const generateText = jest.fn();
    const generateAudio = jest.fn();
    const generateAvatarVideo = jest.fn();

    await generateTopicForStep({
      step: { title: 'Accounting', description: 'd', skills_covered: ['X'] },
      language: 'en',
      aiGenerationService: {
        generateText,
        generateAudio,
        generateCode: jest.fn().mockResolvedValue({ code: 'c' }),
        generatePresentation: jest.fn().mockResolvedValue({
          presentationUrl: 'https://x/p.pdf',
          storagePath: 'p.pdf',
          format: 'gamma',
        }),
        generateMindMap: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        generateAvatarVideo,
        openaiClient: { generateText: jest.fn() },
        ttsClient: { generateAudio: jest.fn() },
        storageClient: { uploadFile: jest.fn() },
      },
      deps: {
        synchronizedMode: true,
        downloadPresentationBufferFn: async () => presentationBuffer,
        narrationBundleService,
        narratedVideoService: {
          generateVideo: jest.fn().mockResolvedValue({
            videoBuffer: Buffer.from('mp4'),
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

    expect(llmCalls.count).toBe(1);
    expect(ttsCalls.count).toBe(2);
    // After bundle: 0 additional text LLM / TTS / video LLM / TTS
    expect(generateText).not.toHaveBeenCalled();
    expect(generateAudio).not.toHaveBeenCalled();
    expect(generateAvatarVideo).not.toHaveBeenCalled();
  });

  it('does not fall back to legacy text/TTS/HeyGen when sync path fails', async () => {
    const generateText = jest.fn();
    const generateAudio = jest.fn();
    const generateAvatarVideo = jest.fn();

    const topic = await generateTopicForStep({
      step: { title: 'Fail Sync', description: 'd', skills_covered: ['X'] },
      language: 'en',
      aiGenerationService: {
        generateText,
        generateAudio,
        generateCode: jest.fn().mockResolvedValue({ code: 'c' }),
        generatePresentation: jest.fn().mockResolvedValue({
          presentationUrl: 'https://x/p.pdf',
          storagePath: 'p.pdf',
          format: 'gamma',
        }),
        generateMindMap: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        generateAvatarVideo,
      },
      deps: {
        synchronizedMode: true,
        downloadPresentationBufferFn: async () => presentationBuffer,
        narrationBundleService: {
          buildBundle: async () => {
            throw new Error('bundle boom');
          },
        },
      },
    });

    expect(generateText).not.toHaveBeenCalled();
    expect(generateAudio).not.toHaveBeenCalled();
    expect(generateAvatarVideo).not.toHaveBeenCalled();
    expect(topic.contents.find((c) => c.content_type === 'avatar_video').content_data.status).toBe(
      'failed'
    );
    expect(
      topic.contents.find((c) => c.content_type === 'avatar_video').content_data.videoMode
    ).toBe('presentation_narration');
  });
});

describe('buildSynchronizedTextAndVideoFromPresentation storage bounds', () => {
  it('uploads combined audio and video once; never per-slide audio', async () => {
    const combined = Buffer.from('COMBINED');
    const page1 = Buffer.from('P1');
    const page2 = Buffer.from('P2');
    const uploadFile = jest.fn().mockResolvedValue({ url: 'https://cdn/a.mp3' });
    const uploadVideoToStorage = jest.fn().mockResolvedValue({
      fileUrl: 'https://cdn/v.mp4',
      fileName: 'v.mp4',
      fileSize: 9,
      fileType: 'video/mp4',
      storagePath: 'avatar_videos/v.mp4',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await buildSynchronizedTextAndVideoFromPresentation({
      presentationBuffer: Buffer.from('%PDF'),
      language: 'en',
      topicName: 'Bounds',
      aiGenerationService: {
        openaiClient: { generateText: jest.fn() },
        ttsClient: { generateAudio: jest.fn() },
        storageClient: { uploadFile },
      },
      narrationBundleService: {
        buildBundle: async () => ({
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: page1, duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: page2, duration: 1 },
          ],
          combinedText: 'A\n\nB',
          combinedAudioBuffer: combined,
          combinedAudioDuration: 2,
          audioVoice: 'alloy',
          audioFormat: 'mp3',
        }),
      },
      narratedVideoService: {
        generateVideo: async () => ({
          videoBuffer: Buffer.from('MP4DATA'),
          duration: 2,
          slideCount: 2,
        }),
      },
      uploadCombinedAudioFn: async ({ combinedAudioBuffer }) => {
        expect(combinedAudioBuffer).toBe(combined);
        return { audioUrl: 'https://cdn/a.mp3' };
      },
      uploadVideoFn: async ({ videoBuffer }) => {
        expect(videoBuffer.equals(Buffer.from('MP4DATA'))).toBe(true);
        return {
          videoUrl: 'https://cdn/v.mp4',
          fileUrl: 'https://cdn/v.mp4',
          fileName: 'v.mp4',
          fileType: 'video/mp4',
          storagePath: 'avatar_videos/v.mp4',
        };
      },
    });

    expect(result.textContentData.audioUrl).toBe('https://cdn/a.mp3');
    expect(result.avatarContentData.videoMode).toBe('presentation_narration');
    // Direct storageClient.uploadFile not used when uploadCombinedAudioFn injected
    expect(uploadFile).not.toHaveBeenCalled();
    expect(uploadVideoToStorage).not.toHaveBeenCalled();
  });
});
