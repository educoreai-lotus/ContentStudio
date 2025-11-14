import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logging/Logger.js';

const execAsync = promisify(exec);

/**
 * Detect if a video file contains an audio track
 * @param {string} filePath - Path to video file
 * @returns {Promise<boolean>} True if audio track exists, false otherwise
 * @throws {Error} If ffprobe fails or file doesn't exist
 */
export async function detectAudioTrack(filePath) {
  try {
    logger.info('[FFprobe] Detecting audio track...', { filePath });

    // Escape file path for shell command
    // Use single quotes for Unix (Railway/Linux) and double quotes for Windows
    const isWindows = process.platform === 'win32';
    const escapedPath = isWindows 
      ? filePath.replace(/"/g, '\\"')
      : filePath.replace(/'/g, "'\"'\"'");
    const quote = isWindows ? '"' : "'";
    const command = `ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1 ${quote}${escapedPath}${quote}`;
    
    const execOptions = {
      timeout: 30000, // 30 seconds timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
    };
    
    // Use bash on Unix for better path handling, default shell on Windows
    if (!isWindows) {
      execOptions.shell = '/bin/bash';
    }
    
    const { stdout, stderr } = await execAsync(command, execOptions);

    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('[FFprobe] stderr output', { stderr: stderr.substring(0, 200) });
    }

    const hasAudio = stdout.includes('codec_type=audio');

    logger.info('[FFprobe] Audio track detection completed', {
      filePath,
      hasAudio,
      stdout: stdout.substring(0, 200),
    });

    return hasAudio;
  } catch (err) {
    logger.error('[FFprobe] Failed to inspect file', {
      filePath,
      error: err.message,
      code: err.code,
      stdout: err.stdout,
      stderr: err.stderr,
    });
    throw new Error(`Failed to detect audio track: ${err.message}`);
  }
}

