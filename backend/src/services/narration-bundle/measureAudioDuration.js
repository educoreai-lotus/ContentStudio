import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { logger } from '../../infrastructure/logging/Logger.js';
import { escapePathForShell, buildExecOptions } from './LocalPdfPageImageExtractor.js';

const execAsync = promisify(exec);

/**
 * Measure actual audio duration in seconds using ffprobe.
 *
 * @param {string} audioFilePath
 * @param {{ execAsync?: Function }} [options]
 * @returns {Promise<number>}
 */
export async function measureAudioDuration(audioFilePath, options = {}) {
  if (!audioFilePath || typeof audioFilePath !== 'string') {
    throw new Error('audioFilePath is required');
  }
  if (!existsSync(audioFilePath)) {
    throw new Error(`Audio file does not exist: ${audioFilePath}`);
  }

  const run = options.execAsync || execAsync;
  const { quote, escaped, isWindows } = escapePathForShell(audioFilePath);
  const command =
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${quote}${escaped}${quote}`;

  logger.info('[measureAudioDuration] Probing audio duration', { audioFilePath });

  let stdout;
  try {
    ({ stdout } = await run(command, buildExecOptions(30000, isWindows)));
  } catch (error) {
    throw new Error(`ffprobe duration probe failed: ${error.message}`);
  }

  const duration = parseFloat(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid audio duration from ffprobe: "${String(stdout).trim()}"`);
  }

  return duration;
}
