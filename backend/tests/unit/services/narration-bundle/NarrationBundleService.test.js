import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  NarrationBundleService,
  buildCombinedText,
  cleanupWorkspace,
} from '../../../../src/services/narration-bundle/NarrationBundleService.js';

describe('buildCombinedText', () => {
  it('joins narrations with paragraph breaks in order', () => {
    expect(buildCombinedText(['One', 'Two', 'Three'])).toBe('One\n\nTwo\n\nThree');
  });
});

describe('NarrationBundleService', () => {
  let createdWorkspaces;

  beforeEach(() => {
    createdWorkspaces = [];
  });

  afterEach(() => {
    for (const dir of createdWorkspaces) {
      cleanupWorkspace(dir);
    }
  });

  it('builds bundle with one TTS call per page and no combined-text TTS', async () => {
    const generateText = jest.fn().mockResolvedValue(
      JSON.stringify({
        slides: [
          { pageNumber: 1, narration: 'Narration one' },
          { pageNumber: 2, narration: 'Narration two' },
        ],
      })
    );

    const generateAudio = jest.fn().mockImplementation(async (text) => {
      return Buffer.from(`audio:${text}`);
    });

    let capturedWorkspace = null;

    const service = new NarrationBundleService({
      openaiClient: { generateText },
      ttsClient: { generateAudio },
      extractPageTextsFn: async () => [
        { pageNumber: 1, text: 'Text one' },
        { pageNumber: 2, text: 'Text two' },
      ],
      extractPageImagesFn: async ({ workingDirectory }) => {
        capturedWorkspace = workingDirectory;
        createdWorkspaces.push(workingDirectory);
        return [
          { pageNumber: 1, imagePath: join(workingDirectory, 'slide-1.png') },
          { pageNumber: 2, imagePath: join(workingDirectory, 'slide-2.png') },
        ];
      },
      measureDurationFn: async () => 4.2,
      concatenateAudioFn: async ({ audioPaths, outputPath }) => {
        expect(audioPaths[0]).toContain('audio-1.mp3');
        expect(audioPaths[1]).toContain('audio-2.mp3');
        writeFileSync(outputPath, Buffer.from('combined-bytes'));
        return { outputPath, duration: 8.4 };
      },
    });

    const result = await service.buildBundle({
      presentationBuffer: Buffer.from('%PDF'),
      language: 'en',
      topicName: 'Demo',
      jobId: 'test-job',
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateAudio).toHaveBeenCalledTimes(2);
    expect(generateAudio.mock.calls[0][0]).toBe('Narration one');
    expect(generateAudio.mock.calls[1][0]).toBe('Narration two');

    // No third TTS for combined text
    expect(generateAudio).not.toHaveBeenCalledWith(result.combinedText, expect.anything());

    expect(result.combinedText).toBe('Narration one\n\nNarration two');
    expect(result.combinedAudioDuration).toBe(8.4);
    expect(Buffer.isBuffer(result.combinedAudioBuffer)).toBe(true);

    expect(result.slides).toHaveLength(2);
    expect(result.slides[0]).toMatchObject({
      pageNumber: 1,
      narration: 'Narration one',
      duration: 4.2,
    });
    expect(result.slides[1]).toMatchObject({
      pageNumber: 2,
      narration: 'Narration two',
      duration: 4.2,
    });

    // Exact per-slide TTS buffers retained (same bytes returned by TTS)
    expect(Buffer.isBuffer(result.slides[0].audioBuffer)).toBe(true);
    expect(Buffer.isBuffer(result.slides[1].audioBuffer)).toBe(true);
    expect(result.slides[0].audioBuffer.equals(Buffer.from('audio:Narration one'))).toBe(true);
    expect(result.slides[1].audioBuffer.equals(Buffer.from('audio:Narration two'))).toBe(true);
    expect(result.audioVoice).toBeTruthy();
    expect(result.audioFormat).toBe('mp3');

    // Temp paths must not leak
    expect(result.slides[0].audioPath).toBeUndefined();
    expect(result.slides[0].imagePath).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('imagePath');
    expect(JSON.stringify(result)).not.toContain('audioPath');
    expect(JSON.stringify(result)).not.toContain('narration-bundle-');

    // Workspace cleaned
    expect(capturedWorkspace).toBeTruthy();
    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('cleans temp workspace on failure', async () => {
    let capturedWorkspace = null;

    const service = new NarrationBundleService({
      openaiClient: {
        generateText: async () => {
          throw new Error('boom');
        },
      },
      ttsClient: {
        generateAudio: async () => Buffer.from('x'),
      },
      extractPageTextsFn: async () => [
        { pageNumber: 1, text: 'A' },
        { pageNumber: 2, text: 'B' },
      ],
      extractPageImagesFn: async ({ workingDirectory }) => {
        capturedWorkspace = workingDirectory;
        createdWorkspaces.push(workingDirectory);
        writeFileSync(join(workingDirectory, 'marker.txt'), 'keep');
        return [
          { pageNumber: 1, imagePath: join(workingDirectory, 'slide-1.png') },
          { pageNumber: 2, imagePath: join(workingDirectory, 'slide-2.png') },
        ];
      },
    });

    await expect(
      service.buildBundle({
        presentationBuffer: Buffer.from('%PDF'),
        language: 'en',
        jobId: 'fail-job',
      })
    ).rejects.toThrow(/boom|Failed to generate structured/);

    expect(capturedWorkspace).toBeTruthy();
    expect(existsSync(capturedWorkspace)).toBe(false);
  });

  it('refuses to delete non-bundle directories', () => {
    const safeDir = join(tmpdir(), `not-a-bundle-${Date.now()}`);
    // Should no-op rather than delete
    expect(() => cleanupWorkspace(safeDir)).not.toThrow();
    expect(() => cleanupWorkspace('/tmp')).not.toThrow();
  });
});

describe('NarrationBundleService isolation', () => {
  it('is not imported by Trainer / GenerateContentUseCase / Personalized-unrelated paths', async () => {
    const { readFileSync } = await import('fs');
    const files = [
      'src/application/use-cases/GenerateContentUseCase.js',
      'src/application/use-cases/course-builder/generateAiTopic.js',
      'src/application/use-cases/GenerateAvatarVideoFromPresentationUseCase.js',
      'src/services/GammaHeyGenAvatarOrchestrator.js',
    ];

    for (const relative of files) {
      const content = readFileSync(join(process.cwd(), relative), 'utf8');
      expect(content).not.toContain('NarrationBundleService');
      expect(content).not.toContain('narration-bundle');
    }
  });
});
