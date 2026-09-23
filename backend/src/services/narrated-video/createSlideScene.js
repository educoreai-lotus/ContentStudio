import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { logger } from '../../infrastructure/logging/Logger.js';
import {
  escapePathForShell,
  buildExecOptions,
} from '../narration-bundle/LocalPdfPageImageExtractor.js';
import {
  VIDEO_CODEC,
  AUDIO_CODEC,
  PIXEL_FORMAT,
  AUDIO_BITRATE,
  VIDEO_FPS,
  SCALE_PAD_FILTER,
} from './videoEncodingDefaults.js';

const execAsync = promisify(exec);

/**
 * Format slide duration for FFmpeg -t (stable decimal, no scientific notation).
 * @param {number} duration
 * @returns {string}
 */
export function formatSceneDurationForFfmpeg(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid scene duration for FFmpeg: ${duration}`);
  }
  // Trim trailing zeros while keeping enough precision for sub-second audio
  const fixed = duration.toFixed(6).replace(/\.?0+$/, '');
  return fixed.length > 0 ? fixed : String(duration);
}

/**
 * Build FFmpeg command: static slide PNG + MP3 → H.264/AAC scene MP4.
 * Input framerate matches output fps; output duration pinned with -t.
 *
 * @param {{ imagePath: string, audioPath: string, outputPath: string, duration: number }} params
 * @returns {string}
 */
export function buildSlideSceneCommand({ imagePath, audioPath, outputPath, duration }) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`duration must be a finite number > 0 (got: ${duration})`);
  }

  const img = escapePathForShell(imagePath);
  const aud = escapePathForShell(audioPath);
  const out = escapePathForShell(outputPath);
  const durationArg = formatSceneDurationForFfmpeg(duration);

  return (
    `ffmpeg -y -loop 1 -framerate ${VIDEO_FPS} -i ${img.quote}${img.escaped}${img.quote} ` +
    `-i ${aud.quote}${aud.escaped}${aud.quote} ` +
    `-c:v ${VIDEO_CODEC} -tune stillimage ` +
    `-c:a ${AUDIO_CODEC} -b:a ${AUDIO_BITRATE} ` +
    `-pix_fmt ${PIXEL_FORMAT} ` +
    `-r ${VIDEO_FPS} ` +
    `-vf "${SCALE_PAD_FILTER}" ` +
    `-t ${durationArg} ` +
    `-shortest ` +
    `${out.quote}${out.escaped}${out.quote}`
  );
}

/**
 * Generate one scene MP4 from a slide image and matching audio file.
 *
 * @param {{
 *   imagePath: string,
 *   audioPath: string,
 *   outputPath: string,
 *   duration: number,
 *   execAsync?: Function,
 * }} params
 * @returns {Promise<{ outputPath: string }>}
 */
export async function createSlideScene({
  imagePath,
  audioPath,
  outputPath,
  duration,
  execAsync: execAsyncOverride = null,
}) {
  if (!existsSync(imagePath)) {
    throw new Error(`Slide image does not exist: ${imagePath}`);
  }
  if (!existsSync(audioPath)) {
    throw new Error(`Slide audio does not exist: ${audioPath}`);
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`duration must be a finite number > 0 (got: ${duration})`);
  }

  const run = execAsyncOverride || execAsync;
  const command = buildSlideSceneCommand({ imagePath, audioPath, outputPath, duration });
  const { isWindows } = escapePathForShell(imagePath);

  logger.info('[createSlideScene] Generating slide scene', {
    imagePath,
    audioPath,
    outputPath,
    duration,
  });

  try {
    await run(command, buildExecOptions(300000, isWindows));
  } catch (error) {
    throw new Error(`FFmpeg slide scene generation failed: ${error.message}`);
  }

  if (!existsSync(outputPath)) {
    throw new Error(`FFmpeg did not create scene output: ${outputPath}`);
  }
  if (statSync(outputPath).size <= 0) {
    throw new Error(`Scene output is empty: ${outputPath}`);
  }

  return { outputPath };
}
