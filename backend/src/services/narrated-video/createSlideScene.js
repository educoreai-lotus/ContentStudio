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
 * Build FFmpeg command: static slide PNG + MP3 → H.264/AAC scene MP4.
 * Image loops; scene ends when audio ends (-shortest). Aspect ratio preserved via scale+pad.
 *
 * @param {{ imagePath: string, audioPath: string, outputPath: string }} params
 * @returns {string}
 */
export function buildSlideSceneCommand({ imagePath, audioPath, outputPath }) {
  const img = escapePathForShell(imagePath);
  const aud = escapePathForShell(audioPath);
  const out = escapePathForShell(outputPath);

  return (
    `ffmpeg -y -loop 1 -i ${img.quote}${img.escaped}${img.quote} ` +
    `-i ${aud.quote}${aud.escaped}${aud.quote} ` +
    `-c:v ${VIDEO_CODEC} -tune stillimage ` +
    `-c:a ${AUDIO_CODEC} -b:a ${AUDIO_BITRATE} ` +
    `-pix_fmt ${PIXEL_FORMAT} ` +
    `-r ${VIDEO_FPS} ` +
    `-vf "${SCALE_PAD_FILTER}" ` +
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
 *   execAsync?: Function,
 * }} params
 * @returns {Promise<{ outputPath: string }>}
 */
export async function createSlideScene({
  imagePath,
  audioPath,
  outputPath,
  execAsync: execAsyncOverride = null,
}) {
  if (!existsSync(imagePath)) {
    throw new Error(`Slide image does not exist: ${imagePath}`);
  }
  if (!existsSync(audioPath)) {
    throw new Error(`Slide audio does not exist: ${audioPath}`);
  }

  const run = execAsyncOverride || execAsync;
  const command = buildSlideSceneCommand({ imagePath, audioPath, outputPath });
  const { isWindows } = escapePathForShell(imagePath);

  logger.info('[createSlideScene] Generating slide scene', {
    imagePath,
    audioPath,
    outputPath,
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
