import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../../infrastructure/logging/Logger.js';
import { extractLocalPdfPageImages } from '../narration-bundle/LocalPdfPageImageExtractor.js';
import { measureAudioDuration } from '../narration-bundle/measureAudioDuration.js';
import { alignPresentationWithBundle } from './alignPresentationWithBundle.js';
import { createSlideScene } from './createSlideScene.js';
import { concatenateVideoScenes } from './concatenateVideoScenes.js';
import { FINAL_DURATION_TOLERANCE_SECONDS } from './videoEncodingDefaults.js';
import { isNarratedVideoDurationDiagnosticsEnabled } from './durationDiagnostics.js';

/**
 * Isolated provider-neutral narrated presentation video builder.
 * Uses presentation PDF + NarrationBundle exact audio — NO AI / TTS / HeyGen.
 * Wired only into Personalized Fill when PERSONALIZED_NARRATED_PRESENTATION_ENABLED=true.
 */
export class NarratedPresentationVideoService {
  /**
   * @param {{
   *   extractPageImagesFn?: Function,
   *   createSceneFn?: Function,
   *   concatenateScenesFn?: Function,
   *   measureDurationFn?: Function,
   *   durationToleranceSeconds?: number,
   *   durationDiagnosticsEnabled?: boolean,
   * }} [deps]
   */
  constructor({
    extractPageImagesFn = null,
    createSceneFn = null,
    concatenateScenesFn = null,
    measureDurationFn = null,
    durationToleranceSeconds = FINAL_DURATION_TOLERANCE_SECONDS,
    durationDiagnosticsEnabled = null,
  } = {}) {
    this.extractPageImagesFn = extractPageImagesFn || extractLocalPdfPageImages;
    this.createSceneFn = createSceneFn || createSlideScene;
    this.concatenateScenesFn = concatenateScenesFn || concatenateVideoScenes;
    this.measureDurationFn = measureDurationFn || measureAudioDuration;
    this.durationToleranceSeconds = durationToleranceSeconds;
    this.durationDiagnosticsEnabled =
      typeof durationDiagnosticsEnabled === 'boolean'
        ? durationDiagnosticsEnabled
        : isNarratedVideoDurationDiagnosticsEnabled();
  }

  /**
   * @param {{
   *   presentationBuffer: Buffer,
   *   narrationBundle: {
   *     slides: Array<{ pageNumber: number, narration?: string, audioBuffer: Buffer, duration: number }>,
   *     combinedAudioDuration: number,
   *   },
   *   jobId?: string,
   * }} input
   * @returns {Promise<{ videoBuffer: Buffer, duration: number, slideCount: number }>}
   */
  async generateVideo({ presentationBuffer, narrationBundle, jobId = null }) {
    if (!Buffer.isBuffer(presentationBuffer) || presentationBuffer.length === 0) {
      throw new Error('presentationBuffer must be a non-empty Buffer');
    }
    if (!narrationBundle || typeof narrationBundle !== 'object') {
      throw new Error('narrationBundle is required');
    }
    if (
      !Number.isFinite(narrationBundle.combinedAudioDuration) ||
      narrationBundle.combinedAudioDuration <= 0
    ) {
      throw new Error(
        `Invalid narrationBundle.combinedAudioDuration: ${narrationBundle.combinedAudioDuration}`
      );
    }

    const resolvedJobId = jobId || randomUUID();
    const workspaceDir = join(
      tmpdir(),
      `narrated-video-${resolvedJobId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    mkdirSync(workspaceDir, { recursive: true });

    try {
      logger.info('[NarratedPresentationVideoService] Starting video generation', {
        jobId: resolvedJobId,
        workspaceDir,
        slideCount: narrationBundle.slides?.length,
      });

      if (this.durationDiagnosticsEnabled) {
        logNarrationBundleTimingDiagnostics(narrationBundle, resolvedJobId);
      }

      const pageImages = await this.extractPageImagesFn({
        pdfBuffer: presentationBuffer,
        workingDirectory: workspaceDir,
      });

      const aligned = alignPresentationWithBundle(pageImages, narrationBundle);

      const scenePaths = [];
      const slideDurations = [];

      for (const page of aligned) {
        const audioPath = join(workspaceDir, `audio-${page.pageNumber}.mp3`);
        writeFileSync(audioPath, page.audioBuffer);

        const written = readFileSync(audioPath);
        if (!written.equals(page.audioBuffer)) {
          throw new Error(
            `Audio materialization mismatch for pageNumber ${page.pageNumber}`
          );
        }

        const scenePath = join(workspaceDir, `scene-${page.pageNumber}.mp4`);
        await this.createSceneFn({
          imagePath: page.imagePath,
          audioPath,
          outputPath: scenePath,
          duration: page.duration,
        });
        scenePaths.push(scenePath);
        slideDurations.push(page.duration);

        if (this.durationDiagnosticsEnabled) {
          try {
            const sceneDuration = await this.measureDurationFn(scenePath);
            logger.info('[NarratedPresentationVideoService] [duration-diagnostics] scene timing', {
              jobId: resolvedJobId,
              pageNumber: page.pageNumber,
              audioDuration: page.duration,
              sceneDuration,
              difference: sceneDuration - page.duration,
            });
          } catch (diagError) {
            logger.warn(
              '[NarratedPresentationVideoService] [duration-diagnostics] scene probe failed',
              {
                jobId: resolvedJobId,
                pageNumber: page.pageNumber,
                error: diagError.message,
              }
            );
          }
        }
      }

      const finalVideoPath = join(workspaceDir, 'final-video.mp4');
      await this.concatenateScenesFn({
        scenePaths,
        outputPath: finalVideoPath,
        workingDirectory: workspaceDir,
      });

      const duration = await this.measureDurationFn(finalVideoPath);
      const expectedDurationFromSlides = slideDurations.reduce((a, b) => a + b, 0);

      if (this.durationDiagnosticsEnabled) {
        const sumSlideAudioDurations = expectedDurationFromSlides;
        const combinedAudioDuration = narrationBundle.combinedAudioDuration;
        logger.info('[NarratedPresentationVideoService] [duration-diagnostics] final comparison', {
          jobId: resolvedJobId,
          slideDurations,
          sumSlideAudioDurations,
          combinedAudioDuration,
          finalVideoDuration: duration,
          finalMinusSlideSum: duration - sumSlideAudioDurations,
          finalMinusCombinedAudio: duration - combinedAudioDuration,
          slideSumMinusCombinedAudio: sumSlideAudioDurations - combinedAudioDuration,
        });
      }

      assertDurationWithinTolerance(
        duration,
        expectedDurationFromSlides,
        this.durationToleranceSeconds
      );

      const videoBuffer = readFileSync(finalVideoPath);
      if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length === 0) {
        throw new Error('Final video buffer is empty');
      }

      const result = {
        videoBuffer,
        duration,
        slideCount: aligned.length,
      };

      logger.info('[NarratedPresentationVideoService] Video generation completed', {
        jobId: resolvedJobId,
        slideCount: result.slideCount,
        duration: result.duration,
        videoBytes: result.videoBuffer.length,
      });

      return result;
    } finally {
      cleanupVideoWorkspace(workspaceDir);
    }
  }
}

/**
 * @param {{
 *   slides?: Array<{ pageNumber: number, duration: number }>,
 *   combinedAudioDuration: number,
 * }} narrationBundle
 * @param {string} jobId
 */
export function logNarrationBundleTimingDiagnostics(narrationBundle, jobId) {
  const slides = Array.isArray(narrationBundle.slides) ? narrationBundle.slides : [];
  const slideDurations = slides.map((s) => ({
    pageNumber: s.pageNumber,
    duration: s.duration,
  }));
  const sumSlideAudioDurations = slides.reduce(
    (sum, s) => sum + (Number.isFinite(s.duration) ? s.duration : 0),
    0
  );
  const combinedAudioDuration = narrationBundle.combinedAudioDuration;

  logger.info('[NarratedPresentationVideoService] [duration-diagnostics] narration bundle timing', {
    jobId,
    slideCount: slides.length,
    slides: slideDurations,
    sumSlideAudioDurations,
    combinedAudioDuration,
    slideSumMinusCombinedAudio: sumSlideAudioDurations - combinedAudioDuration,
  });
}

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} toleranceSeconds
 */
export function assertDurationWithinTolerance(actual, expected, toleranceSeconds) {
  if (!Number.isFinite(actual) || actual <= 0) {
    throw new Error(`Invalid final video duration: ${actual}`);
  }
  if (!Number.isFinite(expected) || expected <= 0) {
    throw new Error(`Invalid expected combined audio duration: ${expected}`);
  }
  const delta = Math.abs(actual - expected);
  if (delta > toleranceSeconds) {
    throw new Error(
      `Final video duration ${actual}s differs from expected slide audio sum ${expected}s ` +
        `by ${delta}s (tolerance ${toleranceSeconds}s)`
    );
  }
}

/**
 * @param {string} workspaceDir
 */
export function cleanupVideoWorkspace(workspaceDir) {
  if (!workspaceDir || typeof workspaceDir !== 'string') {
    return;
  }
  if (!workspaceDir.includes('narrated-video-')) {
    logger.warn('[NarratedPresentationVideoService] Refusing to delete non-video workspace', {
      workspaceDir,
    });
    return;
  }
  try {
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.warn('[NarratedPresentationVideoService] Failed to cleanup workspace', {
      workspaceDir,
      error: error.message,
    });
  }
}
