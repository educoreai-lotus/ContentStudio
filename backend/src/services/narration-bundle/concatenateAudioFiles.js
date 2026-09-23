import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '../../infrastructure/logging/Logger.js';
import { escapePathForShell, buildExecOptions } from './LocalPdfPageImageExtractor.js';
import { measureAudioDuration } from './measureAudioDuration.js';

const execAsync = promisify(exec);

/**
 * Concatenate ordered MP3 files into one combined MP3 using FFmpeg concat demuxer.
 * Does NOT regenerate TTS.
 *
 * @param {{
 *   audioPaths: string[],
 *   outputPath: string,
 *   workingDirectory: string,
 * }} params
 * @returns {Promise<{ outputPath: string, duration: number }>}
 */
export async function concatenateAudioFiles({
  audioPaths,
  outputPath,
  workingDirectory,
  execAsync: execAsyncOverride = null,
  measureDurationFn = null,
}) {
  if (!Array.isArray(audioPaths) || audioPaths.length === 0) {
    throw new Error('audioPaths must be a non-empty array');
  }
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('outputPath is required');
  }
  if (!workingDirectory || typeof workingDirectory !== 'string') {
    throw new Error('workingDirectory is required');
  }

  for (const audioPath of audioPaths) {
    if (!existsSync(audioPath)) {
      throw new Error(`Missing page audio file: ${audioPath}`);
    }
  }

  const run = execAsyncOverride || execAsync;
  const measure = measureDurationFn || measureAudioDuration;

  const listPath = join(workingDirectory, 'audio-concat.txt');
  const listContent = audioPaths
    .map((audioPath) => {
      const normalized = audioPath.replace(/\\/g, '/').replace(/'/g, `'\\''`);
      return `file '${normalized}'`;
    })
    .join('\n');

  writeFileSync(listPath, listContent, 'utf8');

  const command = buildAudioConcatCommand(listPath, outputPath);

  logger.info('[concatenateAudioFiles] Concatenating page audio with FFmpeg', {
    pageCount: audioPaths.length,
    outputPath,
  });

  try {
    const { isWindows } = escapePathForShell(listPath);
    await run(command, buildExecOptions(300000, isWindows));
  } catch (error) {
    throw new Error(`FFmpeg audio concatenation failed: ${error.message}`);
  }

  if (!existsSync(outputPath)) {
    throw new Error('FFmpeg did not create combined audio output');
  }

  const fileSize = statSync(outputPath).size;
  if (fileSize <= 0) {
    throw new Error('Combined audio output is empty');
  }

  const duration = await measure(outputPath);

  return { outputPath, duration };
}

/**
 * Build the FFmpeg concat command string (exported for unit tests).
 * @param {string} listPath
 * @param {string} outputPath
 */
export function buildAudioConcatCommand(listPath, outputPath) {
  const listEsc = escapePathForShell(listPath);
  const outEsc = escapePathForShell(outputPath);
  return (
    `ffmpeg -y -f concat -safe 0 -i ${listEsc.quote}${listEsc.escaped}${listEsc.quote} ` +
    `-c copy ${outEsc.quote}${outEsc.escaped}${outEsc.quote}`
  );
}
