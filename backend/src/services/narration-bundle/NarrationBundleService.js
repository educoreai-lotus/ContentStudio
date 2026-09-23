import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../../infrastructure/logging/Logger.js';
import {
  getTTSVoiceForLanguage,
  isTTSVoiceAvailable,
} from '../../infrastructure/ai/LanguageValidator.js';
import { extractPdfPageTexts } from './PdfPageTextExtractor.js';
import { extractLocalPdfPageImages } from './LocalPdfPageImageExtractor.js';
import { alignPagesByNumber } from './pageAlignment.js';
import { SlideNarrationGenerator } from './SlideNarrationGenerator.js';
import { measureAudioDuration } from './measureAudioDuration.js';
import { concatenateAudioFiles } from './concatenateAudioFiles.js';

/**
 * Provider-neutral NarrationBundle builder.
 * Wired only into Personalized Fill when PERSONALIZED_NARRATED_PRESENTATION_ENABLED=true.
 * Not used by Trainer / V2L / HeyGen / GenerateContentUseCase.
 */
export class NarrationBundleService {
  /**
   * @param {{
   *   openaiClient: { generateText: Function },
   *   ttsClient: { generateAudio: Function },
   *   slideNarrationGenerator?: SlideNarrationGenerator,
   *   extractPageTextsFn?: Function,
   *   extractPageImagesFn?: Function,
   *   measureDurationFn?: Function,
   *   concatenateAudioFn?: Function,
   * }} deps
   */
  constructor({
    openaiClient,
    ttsClient,
    slideNarrationGenerator = null,
    extractPageTextsFn = null,
    extractPageImagesFn = null,
    measureDurationFn = null,
    concatenateAudioFn = null,
  }) {
    if (!openaiClient) {
      throw new Error('openaiClient is required');
    }
    if (!ttsClient || typeof ttsClient.generateAudio !== 'function') {
      throw new Error('ttsClient with generateAudio is required');
    }

    this.openaiClient = openaiClient;
    this.ttsClient = ttsClient;
    this.slideNarrationGenerator =
      slideNarrationGenerator ||
      new SlideNarrationGenerator({ openaiClient });
    this.extractPageTextsFn = extractPageTextsFn || extractPdfPageTexts;
    this.extractPageImagesFn = extractPageImagesFn || extractLocalPdfPageImages;
    this.measureDurationFn = measureDurationFn || measureAudioDuration;
    this.concatenateAudioFn = concatenateAudioFn || concatenateAudioFiles;
  }

  /**
   * Build a NarrationBundle from an existing presentation PDF buffer.
   *
   * @param {{
   *   presentationBuffer: Buffer,
   *   language: string,
   *   topicName?: string,
   *   jobId?: string,
   * }} input
   * @returns {Promise<{
   *   slides: Array<{ pageNumber: number, narration: string, audioBuffer: Buffer, duration: number }>,
   *   combinedText: string,
   *   combinedAudioBuffer: Buffer,
   *   combinedAudioDuration: number,
   *   audioVoice: string,
   *   audioFormat: string,
   * }>}
   */
  async buildBundle({
    presentationBuffer,
    language,
    topicName = 'lesson',
    jobId = null,
  }) {
    if (!Buffer.isBuffer(presentationBuffer) || presentationBuffer.length === 0) {
      throw new Error('presentationBuffer must be a non-empty Buffer');
    }
    if (!language || typeof language !== 'string') {
      throw new Error('language is required');
    }
    if (!isTTSVoiceAvailable(language)) {
      throw new Error(`TTS voice not available for language: ${language}`);
    }

    const resolvedJobId = jobId || randomUUID();
    const workspaceDir = join(
      tmpdir(),
      `narration-bundle-${resolvedJobId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    mkdirSync(workspaceDir, { recursive: true });

    try {
      logger.info('[NarrationBundleService] Starting bundle generation', {
        jobId: resolvedJobId,
        language,
        topicName,
        workspaceDir,
      });

      const pageTexts = await this.extractPageTextsFn(presentationBuffer);
      const pageImages = await this.extractPageImagesFn({
        pdfBuffer: presentationBuffer,
        workingDirectory: workspaceDir,
      });

      const alignedPages = alignPagesByNumber(pageTexts, pageImages);

      const narrations = await this.slideNarrationGenerator.generateNarrations({
        language,
        topicName,
        slides: alignedPages.map(({ pageNumber, text }) => ({ pageNumber, text })),
      });

      const voice = getTTSVoiceForLanguage(language);
      const audioFormat = 'mp3';
      const slideResults = [];

      for (const narrationItem of narrations) {
        const aligned = alignedPages.find((p) => p.pageNumber === narrationItem.pageNumber);
        if (!aligned) {
          throw new Error(`Aligned page missing for narration page ${narrationItem.pageNumber}`);
        }

        const audioBuffer = await this.ttsClient.generateAudio(narrationItem.narration, {
          voice,
          model: 'tts-1',
          format: audioFormat,
        });

        if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
          throw new Error(`Empty TTS buffer for page ${narrationItem.pageNumber}`);
        }

        const audioPath = join(workspaceDir, `audio-${narrationItem.pageNumber}.mp3`);
        writeFileSync(audioPath, audioBuffer);

        const duration = await this.measureDurationFn(audioPath);

        slideResults.push({
          pageNumber: narrationItem.pageNumber,
          narration: narrationItem.narration,
          audioBuffer,
          duration,
          audioPath,
          imagePath: aligned.imagePath,
        });
      }

      const combinedText = buildCombinedText(slideResults.map((s) => s.narration));
      const combinedAudioPath = join(workspaceDir, 'combined-audio.mp3');

      const { duration: combinedAudioDuration } = await this.concatenateAudioFn({
        audioPaths: slideResults.map((s) => s.audioPath),
        outputPath: combinedAudioPath,
        workingDirectory: workspaceDir,
      });

      const combinedAudioBuffer = readFileSync(combinedAudioPath);

      // Retain exact per-slide TTS Buffers in memory before workspace cleanup.
      // Do not expose audioPath / imagePath outside the service.
      const result = {
        slides: slideResults.map(({ pageNumber, narration, audioBuffer, duration }) => ({
          pageNumber,
          narration,
          audioBuffer,
          duration,
        })),
        combinedText,
        combinedAudioBuffer,
        combinedAudioDuration,
        audioVoice: voice,
        audioFormat,
      };

      logger.info('[NarrationBundleService] Bundle generation completed', {
        jobId: resolvedJobId,
        slideCount: result.slides.length,
        combinedAudioDuration: result.combinedAudioDuration,
        combinedTextLength: result.combinedText.length,
      });

      return result;
    } finally {
      cleanupWorkspace(workspaceDir);
    }
  }
}

/**
 * Join narrations in page order with paragraph separation.
 * @param {string[]} narrations
 * @returns {string}
 */
export function buildCombinedText(narrations) {
  return narrations
    .map((text) => String(text || '').trim())
    .filter((text) => text.length > 0)
    .join('\n\n');
}

/**
 * Remove the workspace directory recursively. Never deletes outside the path.
 * @param {string} workspaceDir
 */
export function cleanupWorkspace(workspaceDir) {
  if (!workspaceDir || typeof workspaceDir !== 'string') {
    return;
  }
  if (!workspaceDir.includes('narration-bundle-')) {
    logger.warn('[NarrationBundleService] Refusing to delete non-bundle workspace', {
      workspaceDir,
    });
    return;
  }
  try {
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.warn('[NarrationBundleService] Failed to cleanup workspace', {
      workspaceDir,
      error: error.message,
    });
  }
}
