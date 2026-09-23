import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  NarratedPresentationVideoService,
  cleanupVideoWorkspace,
} from '../../../../src/services/narrated-video/NarratedPresentationVideoService.js';
import { isNarratedVideoDurationDiagnosticsEnabled } from '../../../../src/services/narrated-video/durationDiagnostics.js';
import { logger } from '../../../../src/infrastructure/logging/Logger.js';

describe('isNarratedVideoDurationDiagnosticsEnabled', () => {
  it('defaults to false', () => {
    expect(isNarratedVideoDurationDiagnosticsEnabled({})).toBe(false);
    expect(
      isNarratedVideoDurationDiagnosticsEnabled({
        NARRATED_VIDEO_DURATION_DIAGNOSTICS: 'false',
      })
    ).toBe(false);
  });

  it('enables only when exactly true', () => {
    expect(
      isNarratedVideoDurationDiagnosticsEnabled({
        NARRATED_VIDEO_DURATION_DIAGNOSTICS: 'true',
      })
    ).toBe(true);
  });
});

describe('NarratedPresentationVideoService duration diagnostics', () => {
  let capturedWorkspace;
  let infoSpy;

  beforeEach(() => {
    capturedWorkspace = null;
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    if (capturedWorkspace && existsSync(capturedWorkspace)) {
      cleanupVideoWorkspace(capturedWorkspace);
    }
  });

  function buildService(overrides = {}) {
    const measureDurationFn = jest.fn().mockImplementation(async (path) => {
      const normalized = String(path).replace(/\\/g, '/');
      if (normalized.includes('scene-1.mp4')) return 10.5;
      if (normalized.includes('scene-2.mp4')) return 20.5;
      if (normalized.includes('final-video.mp4')) return 30.0;
      return 30.0;
    });

    const service = new NarratedPresentationVideoService({
      extractPageImagesFn: async ({ workingDirectory }) => {
        capturedWorkspace = workingDirectory;
        const img1 = join(workingDirectory, 'slide-1.png');
        const img2 = join(workingDirectory, 'slide-2.png');
        writeFileSync(img1, Buffer.from('png1'));
        writeFileSync(img2, Buffer.from('png2'));
        return [
          { pageNumber: 1, imagePath: img1 },
          { pageNumber: 2, imagePath: img2 },
        ];
      },
      createSceneFn: async ({ outputPath }) => {
        writeFileSync(outputPath, Buffer.from('scene'));
        return { outputPath };
      },
      concatenateScenesFn: async ({ outputPath }) => {
        writeFileSync(outputPath, Buffer.from('FINAL'));
        return { outputPath };
      },
      measureDurationFn,
      ...overrides,
    });

    return { service, measureDurationFn };
  }

  const narrationBundle = {
    slides: [
      { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a1'), duration: 10 },
      { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('a2'), duration: 20 },
    ],
    combinedAudioDuration: 30,
    combinedText: 'A\n\nB',
  };

  it('flag OFF → no additional scene-duration probes (only final probe)', async () => {
    const { service, measureDurationFn } = buildService({
      durationDiagnosticsEnabled: false,
    });

    const result = await service.generateVideo({
      presentationBuffer: Buffer.from('%PDF'),
      narrationBundle,
      jobId: 'diag-off',
    });

    expect(measureDurationFn).toHaveBeenCalledTimes(1);
    expect(String(measureDurationFn.mock.calls[0][0])).toContain('final-video.mp4');
    expect(result.duration).toBe(30);
    expect(result.slideCount).toBe(2);
    expect(Buffer.isBuffer(result.videoBuffer)).toBe(true);

    const diagLogs = infoSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('[duration-diagnostics]')
    );
    expect(diagLogs).toHaveLength(0);
  });

  it('flag ON → measures each scene and logs bundle + scene + final deltas', async () => {
    const { service, measureDurationFn } = buildService({
      durationDiagnosticsEnabled: true,
    });

    const result = await service.generateVideo({
      presentationBuffer: Buffer.from('%PDF'),
      narrationBundle,
      jobId: 'diag-on',
    });

    // 2 scenes + 1 final
    expect(measureDurationFn).toHaveBeenCalledTimes(3);
    expect(String(measureDurationFn.mock.calls[0][0])).toContain('scene-1.mp4');
    expect(String(measureDurationFn.mock.calls[1][0])).toContain('scene-2.mp4');
    expect(String(measureDurationFn.mock.calls[2][0])).toContain('final-video.mp4');

    expect(result.duration).toBe(30);
    expect(result.slideCount).toBe(2);
    expect(result.videoBuffer.equals(Buffer.from('FINAL'))).toBe(true);

    const bundleLog = infoSpy.mock.calls.find(
      (c) => c[0] === '[NarratedPresentationVideoService] [duration-diagnostics] narration bundle timing'
    );
    expect(bundleLog).toBeTruthy();
    expect(bundleLog[1]).toMatchObject({
      jobId: 'diag-on',
      slideCount: 2,
      sumSlideAudioDurations: 30,
      combinedAudioDuration: 30,
      slideSumMinusCombinedAudio: 0,
    });
    expect(bundleLog[1].slides).toEqual([
      { pageNumber: 1, duration: 10 },
      { pageNumber: 2, duration: 20 },
    ]);

    const sceneLogs = infoSpy.mock.calls.filter(
      (c) => c[0] === '[NarratedPresentationVideoService] [duration-diagnostics] scene timing'
    );
    expect(sceneLogs).toHaveLength(2);
    expect(sceneLogs[0][1]).toMatchObject({
      pageNumber: 1,
      audioDuration: 10,
      sceneDuration: 10.5,
      difference: 0.5,
    });
    expect(sceneLogs[1][1]).toMatchObject({
      pageNumber: 2,
      audioDuration: 20,
      sceneDuration: 20.5,
      difference: 0.5,
    });

    const finalLog = infoSpy.mock.calls.find(
      (c) => c[0] === '[NarratedPresentationVideoService] [duration-diagnostics] final comparison'
    );
    expect(finalLog).toBeTruthy();
    expect(finalLog[1]).toMatchObject({
      jobId: 'diag-on',
      slideDurations: [10, 20],
      sumSlideAudioDurations: 30,
      combinedAudioDuration: 30,
      finalVideoDuration: 30,
      finalMinusSlideSum: 0,
      finalMinusCombinedAudio: 0,
      slideSumMinusCombinedAudio: 0,
    });
  });

  it('flag ON still uses existing assertion against combinedAudioDuration', async () => {
    const { service } = buildService({
      durationDiagnosticsEnabled: true,
      measureDurationFn: jest.fn().mockImplementation(async (path) => {
        const normalized = String(path).replace(/\\/g, '/');
        if (normalized.includes('scene-')) return 1;
        return 99; // final video far from combinedAudioDuration=30
      }),
    });

    await expect(
      service.generateVideo({
        presentationBuffer: Buffer.from('%PDF'),
        narrationBundle,
        jobId: 'diag-assert',
      })
    ).rejects.toThrow(/differs from combined audio/);
  });
});
