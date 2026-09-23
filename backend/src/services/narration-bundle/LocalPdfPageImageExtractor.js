import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../../infrastructure/logging/Logger.js';

const execAsync = promisify(exec);

/**
 * Escape a file path for shell use (matches convertVideoToMp3 / detectAudioTrack conventions).
 * @param {string} filePath
 * @returns {{ quote: string, escaped: string, isWindows: boolean }}
 */
export function escapePathForShell(filePath) {
  const isWindows = process.platform === 'win32';
  const escaped = isWindows
    ? String(filePath).replace(/"/g, '\\"')
    : String(filePath).replace(/'/g, `'\"'\"'`);
  const quote = isWindows ? '"' : "'";
  return { quote, escaped, isWindows };
}

/**
 * Build exec options with timeout and Unix bash shell when needed.
 * @param {number} timeoutMs
 * @param {boolean} isWindows
 */
export function buildExecOptions(timeoutMs, isWindows) {
  const execOptions = {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  };
  if (!isWindows) {
    execOptions.shell = '/bin/bash';
  }
  return execOptions;
}

/**
 * Extract each PDF page to a local PNG via pdftoppm.
 * Does NOT upload. Does NOT clean up. Parent owns cleanup.
 *
 * @param {{
 *   pdfBuffer: Buffer,
 *   workingDirectory: string,
 *   dpi?: number,
 *   execAsync?: typeof execAsync,
 * }} options
 * @returns {Promise<Array<{ pageNumber: number, imagePath: string }>>}
 */
export async function extractLocalPdfPageImages({
  pdfBuffer,
  workingDirectory,
  dpi = 150,
  execAsync: execAsyncOverride = null,
}) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('pdfBuffer must be a non-empty Buffer');
  }
  if (!workingDirectory || typeof workingDirectory !== 'string') {
    throw new Error('workingDirectory is required');
  }

  const run = execAsyncOverride || execAsync;
  const { writeFileSync } = await import('fs');

  mkdirSync(workingDirectory, { recursive: true });
  const pdfPath = join(workingDirectory, 'presentation.pdf');
  const outputPrefix = join(workingDirectory, 'slide');

  writeFileSync(pdfPath, pdfBuffer);

  const { quote, escaped: escapedPdf, isWindows } = escapePathForShell(pdfPath);
  const { escaped: escapedPrefix } = escapePathForShell(outputPrefix);
  const command = `pdftoppm -png -r ${Number(dpi)} ${quote}${escapedPdf}${quote} ${quote}${escapedPrefix}${quote}`;

  logger.info('[LocalPdfPageImageExtractor] Converting PDF pages to PNG', {
    workingDirectory,
    dpi,
  });

  try {
    await run(command, buildExecOptions(120000, isWindows));
  } catch (error) {
    throw new Error(
      `pdftoppm conversion failed: ${error.message}. ` +
        'pdftoppm (poppler-utils) must be available in the runtime environment.'
    );
  }

  const files = readdirSync(workingDirectory)
    .filter((file) => /^slide-\d+\.png$/i.test(file))
    .map((file) => {
      const match = file.match(/slide-(\d+)\.png/i);
      return {
        pageNumber: parseInt(match[1], 10),
        imagePath: join(workingDirectory, file),
      };
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);

  if (files.length === 0) {
    throw new Error('pdftoppm produced no slide-*.png files');
  }

  for (const file of files) {
    if (!existsSync(file.imagePath)) {
      throw new Error(`Expected slide image missing: ${file.imagePath}`);
    }
  }

  logger.info('[LocalPdfPageImageExtractor] Extracted local slide images', {
    pageCount: files.length,
  });

  return files;
}
