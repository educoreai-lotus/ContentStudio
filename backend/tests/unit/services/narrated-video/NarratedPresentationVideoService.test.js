import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  NarratedPresentationVideoService,
  assertDurationWithinTolerance,
  cleanupVideoWorkspace,
} from '../../../../src/services/narrated-video/NarratedPresentationVideoService.js';
import { FINAL_DURATION_TOLERANCE_SECONDS } from '../../../../src/services/narrated-video/videoEncodingDefaults.js';

describe('assertDurationWithinTolerance', () => {
  it('accepts valid duration within tolerance', () => {
    expect(() => assertDurationWithinTolerance(10.4, 10.0, 1.0)).not.toThrow();
  });

  it('rejects invalid final duration', () => {
    expect(() => assertDurationWithinTolerance(0, 10, 1)).toThrow(/Invalid final video duration/);
  });

  it('rejects non-finite final duration', () => {
    expect(() => assertDurationWithinTolerance(NaN, 10, 1)).toThrow(/Invalid final video duration/);
  });

  it('accepts reasonable tolerance', () => {
    expect(() =>
      assertDurationWithinTolerance(10.5, 10.0, FINAL_DURATION_TOLERANCE_SECONDS)
    ).not.toThrow();
  });

  it('rejects excessive deviation', () => {
    expect(() => assertDurationWithinTolerance(15, 10, 1)).toThrow(/differs from combined audio/);
  });
});

describe('NarratedPresentationVideoService', () => {
  let capturedWorkspace;

  beforeEach(() => {
    capturedWorkspace = null;
  });

  afterEach(() => {
    if (capturedWorkspace && existsSync(capturedWorkspace)) {
      cleanupVideoWorkspace(capturedWorkspace);
    }
  });

  function buildService(overrides = {}) {
    const audioSeen = {};

    const service = new NarratedPresentationVideoService({
      extractPageImagesFn: async ({ workingDirectory }) => {
        capturedWorkspace = workingDirectory;
        const img1 = join(workingDirectory, 'slide-1.png');
        const img2 = join(workingDirectory, 'slide-2.png');
        const img3 = join(workingDirectory, 'slide-3.png');
        writeFileSync(img1, Buffer.from('png1'));
        writeFileSync(img2, Buffer.from('png2'));
        writeFileSync(img3, Buffer.from('png3'));
        return [
          { pageNumber: 1, imagePath: img1 },
          { pageNumber: 2, imagePath: img2 },
          { pageNumber: 3, imagePath: img3 },
        ];
      },
      createSceneFn: async ({ imagePath, audioPath, outputPath }) => {
        const audioBytes = readFileSync(audioPath);
        const pageMatch = /audio-(\d+)\.mp3$/.exec(audioPath.replace(/\\/g, '/'));
        expect(pageMatch).toBeTruthy();
        audioSeen[Number(pageMatch[1])] = Buffer.from(audioBytes);
        expect(imagePath).toContain(`slide-${pageMatch[1]}.png`);
        writeFileSync(outputPath, Buffer.from(`scene-${pageMatch[1]}`));
        return { outputPath };
      },
      concatenateScenesFn: async ({ scenePaths, outputPath, workingDirectory }) => {
        expect(scenePaths.map((p) => p.replace(/\\/g, '/'))).toEqual([
          expect.stringContaining('scene-1.mp4'),
          expect.stringContaining('scene-2.mp4'),
          expect.stringContaining('scene-3.mp4'),
        ]);
        expect(scenePaths[0].includes('scene-1.mp4')).toBe(true);
        expect(scenePaths[1].includes('scene-2.mp4')).toBe(true);
        expect(scenePaths[2].includes('scene-3.mp4')).toBe(true);
        expect(workingDirectory).toBe(capturedWorkspace);
        writeFileSync(outputPath, Buffer.from('FINAL-MP4-BYTES'));
        return { outputPath };
      },
      measureDurationFn: async () => 30.0,
      ...overrides,
    });

    return { service, audioSeen };
  }

  it('materializes exact NarrationBundle audioBuffers with zero AI/TTS calls', async () => {
    const generateText = jest.fn();
    const generateAudio = jest.fn();
    const openaiClient = { generateText };
    const ttsClient = { generateAudio };

    const audio1 = Buffer.from('exact-audio-page-1');
    const audio2 = Buffer.from('exact-audio-page-2');
    const audio3 = Buffer.from('exact-audio-page-3');

    const { service, audioSeen } = buildService();

    const result = await service.generateVideo({
      presentationBuffer: Buffer.from('%PDF'),
      narrationBundle: {
        slides: [
          { pageNumber: 3, narration: 'C', audioBuffer: audio3, duration: 10 },
          { pageNumber: 1, narration: 'A', audioBuffer: audio1, duration: 10 },
          { pageNumber: 2, narration: 'B', audioBuffer: audio2, duration: 10 },
        ],
        combinedText: 'A\n\nB\n\nC',
        combinedAudioBuffer: Buffer.from('combined'),
        combinedAudioDuration: 30,
      },
      jobId: 'video-audio-reuse',
    });

    expect(audioSeen[1].equals(audio1)).toBe(true);
    expect(audioSeen[2].equals(audio2)).toBe(true);
    expect(audioSeen[3].equals(audio3)).toBe(true);

    expect(generateText).not.toHaveBeenCalled();
    expect(generateAudio).not.toHaveBeenCalled();
    expect(openaiClient.generateText).not.toHaveBeenCalled();
    expect(ttsClient.generateAudio).not.toHaveBeenCalled();

    expect(Buffer.isBuffer(result.videoBuffer)).toBe(true);
    expect(result.videoBuffer.equals(Buffer.from('FINAL-MP4-BYTES'))).toBe(true);
    expect(result.duration).toBe(30);
    expect(result.slideCount).toBe(3);

    expect(result.videoPath).toBeUndefined();
    expect(result.workspaceDir).toBeUndefined();
    expect(JSON.stringify({ ...result, videoBuffer: undefined })).not.toContain('narrated-video-');
    expect(JSON.stringify({ ...result, videoBuffer: undefined })).not.toContain('scene-');
    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('orders shuffled pages 3,1,2 into scenes 1→2→3', async () => {
    const sceneOrder = [];
    const { service } = buildService({
      createSceneFn: async ({ audioPath, outputPath }) => {
        const page = Number(/audio-(\d+)\.mp3$/.exec(audioPath.replace(/\\/g, '/'))[1]);
        sceneOrder.push(page);
        writeFileSync(outputPath, Buffer.from(`scene-${page}`));
        return { outputPath };
      },
    });

    await service.generateVideo({
      presentationBuffer: Buffer.from('%PDF'),
      narrationBundle: {
        slides: [
          { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
          { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
          { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
        ],
        combinedAudioDuration: 30,
      },
    });

    expect(sceneOrder).toEqual([1, 2, 3]);
  });

  it('cleans workspace on success', async () => {
    const { service } = buildService();
    await service.generateVideo({
      presentationBuffer: Buffer.from('%PDF'),
      narrationBundle: {
        slides: [
          { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
          { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
          { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
        ],
        combinedAudioDuration: 30,
      },
    });
    expect(capturedWorkspace).toBeTruthy();
    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('cleans workspace when scene generation fails', async () => {
    const { service } = buildService({
      createSceneFn: async () => {
        throw new Error('scene boom');
      },
    });

    await expect(
      service.generateVideo({
        presentationBuffer: Buffer.from('%PDF'),
        narrationBundle: {
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
            { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
          ],
          combinedAudioDuration: 30,
        },
      })
    ).rejects.toThrow(/scene boom/);

    expect(capturedWorkspace).toBeTruthy();
    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('cleans workspace when concat fails', async () => {
    const { service } = buildService({
      concatenateScenesFn: async () => {
        throw new Error('concat boom');
      },
    });

    await expect(
      service.generateVideo({
        presentationBuffer: Buffer.from('%PDF'),
        narrationBundle: {
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
            { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
          ],
          combinedAudioDuration: 30,
        },
      })
    ).rejects.toThrow(/concat boom/);

    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('cleans workspace when final duration read fails', async () => {
    const { service } = buildService({
      measureDurationFn: async () => {
        throw new Error('ffprobe boom');
      },
    });

    await expect(
      service.generateVideo({
        presentationBuffer: Buffer.from('%PDF'),
        narrationBundle: {
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
            { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
          ],
          combinedAudioDuration: 30,
        },
      })
    ).rejects.toThrow(/ffprobe boom/);

    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('rejects excessive final duration deviation', async () => {
    const { service } = buildService({
      measureDurationFn: async () => 99,
    });

    await expect(
      service.generateVideo({
        presentationBuffer: Buffer.from('%PDF'),
        narrationBundle: {
          slides: [
            { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 1 },
            { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 1 },
            { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('a3'), duration: 1 },
          ],
          combinedAudioDuration: 30,
        },
      })
    ).rejects.toThrow(/differs from combined audio/);

    expect(existsSync(capturedWorkspace)).toBe(false);
  });
});

describe('NarratedPresentationVideoService isolation', () => {
  it('is not imported by Trainer / GenerateContentUseCase paths', () => {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const root = join(thisDir, '../../../../src');

    const forbidden = [
      'application/use-cases/GenerateContentUseCase.js',
      'application/use-cases/GenerateAvatarVideoFromPresentationUseCase.js',
      'application/use-cases/course-builder/generateAiTopic.js',
      'services/GammaHeyGenAvatarOrchestrator.js',
    ];

    for (const rel of forbidden) {
      const abs = join(root, rel);
      if (!existsSync(abs)) continue;
      const text = readFileSync(abs, 'utf8');
      expect(text).not.toMatch(/narrated-video|NarratedPresentationVideoService/);
    }
  });
});
