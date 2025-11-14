import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../logging/Logger.js';

const execAsync = promisify(exec);

/**
 * Convert video file to MP3 audio file
 * Optimizes audio for Whisper: mono channel, 16kHz sample rate
 * @param {string} videoPath - Path to video file
 * @returns {Promise<string>} Path to output MP3 file
 * @throws {Error} If conversion fails
 */
export async function convertVideoToMp3(videoPath) {
  try {
    logger.info('[FFmpeg] Converting video to MP3...', { videoPath });

    // Generate output path by replacing extension with .mp3
    // Use path.join and path.dirname to handle paths correctly
    const dir = path.dirname(videoPath);
    const basename = path.basename(videoPath, path.extname(videoPath));
    const outputPath = path.join(dir, `${basename}.mp3`);

    // FFmpeg command:
    // -y: overwrite output file if it exists
    // -i: input file
    // -vn: disable video (audio only)
    // -acodec libmp3lame: use MP3 codec
    // -ac 1: mono channel (1 channel)
    // -ar 16000: 16kHz sample rate (optimal for Whisper)
    // -q:a 2: high quality audio
    // Escape paths for shell command
    // Use single quotes for Unix (Railway/Linux) and double quotes for Windows
    const isWindows = process.platform === 'win32';
    const escapePathForShell = (filePath) => isWindows 
      ? filePath.replace(/"/g, '\\"')
      : filePath.replace(/'/g, "'\"'\"'");
    const quote = isWindows ? '"' : "'";
    const escapedVideoPath = escapePathForShell(videoPath);
    const escapedOutputPath = escapePathForShell(outputPath);
    const command = `ffmpeg -y -i ${quote}${escapedVideoPath}${quote} -vn -acodec libmp3lame -ac 1 -ar 16000 -q:a 2 ${quote}${escapedOutputPath}${quote}`;
    
    logger.info('[FFmpeg] Executing conversion command...', { 
      command,
      videoPath,
      outputPath,
      isWindows,
    });
    
    const execOptions = {
      timeout: 600000, // 10 minutes timeout for long videos
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    };
    
    // Use bash on Unix for better path handling, default shell on Windows
    if (!isWindows) {
      execOptions.shell = '/bin/bash';
    }
    
    const { stdout, stderr } = await execAsync(command, execOptions);

    if (stderr && !stderr.includes('WARNING') && !stderr.includes('frame=')) {
      logger.warn('[FFmpeg] stderr output', { stderr: stderr.substring(0, 500) });
    }

    if (stdout) {
      logger.info('[FFmpeg] stdout output', { stdout: stdout.substring(0, 500) });
    }

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      logger.error('[FFmpeg] Output file not created', {
        videoPath,
        outputPath,
        stdout,
        stderr,
      });
      throw new Error('FFmpeg failed to generate MP3 file');
    }

    const fileSize = fs.statSync(outputPath).size;

    logger.info('[FFmpeg] Conversion completed successfully', {
      videoPath,
      outputPath,
      fileSize,
    });

    return outputPath;
  } catch (err) {
    logger.error('[FFmpeg] Conversion failed', {
      videoPath,
      error: err.message,
      code: err.code,
      stdout: err.stdout,
      stderr: err.stderr,
    });
    throw new Error(`Failed to convert video to MP3: ${err.message}`);
  }
}

