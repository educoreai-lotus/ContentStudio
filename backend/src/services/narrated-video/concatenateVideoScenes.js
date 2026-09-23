import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '../../infrastructure/logging/Logger.js';
import {
  escapePathForShell,
  buildExecOptions,
} from '../narration-bundle/LocalPdfPageImageExtractor.js';

const execAsync = promisify(exec);

/**
 * Build FFmpeg concat command for ordered scene MP4s (stream copy).
 * Safe when all scenes share identical codec/resolution/audio settings.
 *
 * @param {string} listPath
 * @param {string} outputPath
 * @returns {string}
 */
export function buildVideoConcatCommand(listPath, outputPath) {
  const listEsc = escapePathForShell(listPath);
  const outEsc = escapePathForShell(outputPath);
  return (
    `ffmpeg -y -f concat -safe 0 -i ${listEsc.quote}${listEsc.escaped}${listEsc.quote} ` +
    `-c copy ${outEsc.quote}${outEsc.escaped}${outEsc.quote}`
  );
}

/**
 * Concatenate ordered scene MP4 files into one final MP4.
 *
 * @param {{
 *   scenePaths: string[],
 *   outputPath: string,
 *   workingDirectory: string,
 *   execAsync?: Function,
 * }} params
 * @returns {Promise<{ outputPath: string }>}
 */
export async function concatenateVideoScenes({
  scenePaths,
  outputPath,
  workingDirectory,
  execAsync: execAsyncOverride = null,
}) {
  if (!Array.isArray(scenePaths) || scenePaths.length === 0) {
    throw new Error('scenePaths must be a non-empty array');
  }
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('outputPath is required');
  }
  if (!workingDirectory || typeof workingDirectory !== 'string') {
    throw new Error('workingDirectory is required');
  }

  for (const scenePath of scenePaths) {
    if (!existsSync(scenePath)) {
      throw new Error(`Missing scene file: ${scenePath}`);
    }
  }

  const listPath = join(workingDirectory, 'video-concat.txt');
  const listContent = scenePaths
    .map((scenePath) => {
      const normalized = scenePath.replace(/\\/g, '/').replace(/'/g, `'\\''`);
      return `file '${normalized}'`;
    })
    .join('\n');

  writeFileSync(listPath, listContent, 'utf8');

  const run = execAsyncOverride || execAsync;
  const command = buildVideoConcatCommand(listPath, outputPath);
  const { isWindows } = escapePathForShell(listPath);

  logger.info('[concatenateVideoScenes] Concatenating scenes with FFmpeg', {
    sceneCount: scenePaths.length,
    outputPath,
  });

  try {
    await run(command, buildExecOptions(300000, isWindows));
  } catch (error) {
    throw new Error(`FFmpeg video concatenation failed: ${error.message}`);
  }

  if (!existsSync(outputPath)) {
    throw new Error('FFmpeg did not create final video output');
  }
  if (statSync(outputPath).size <= 0) {
    throw new Error('Final video output is empty');
  }

  return { outputPath };
}
