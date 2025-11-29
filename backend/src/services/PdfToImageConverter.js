import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "../infrastructure/logging/Logger.js";

const execAsync = promisify(exec);

/**
 * Convert PDF pages to images
 * Uses pdftoppm or similar tool to convert PDF to images
 */
export class PdfToImageConverter {
  /**
   * Convert PDF file to array of base64-encoded images (one per page)
   * @param {string} pdfPath - Path to PDF file
   * @returns {Promise<string[]>} Array of base64-encoded images
   * 
   * NOTE: This requires pdftoppm (poppler-utils) or similar tool to be installed on the server.
   * If not available, returns empty array and Vision fallback will be skipped.
   */
  static async convertPDFToImages(pdfPath) {
    try {
      // Try multiple conversion methods
      // Method 1: pdftoppm (poppler-utils) - most common
      if (await this._isPdfToPpmAvailable()) {
        logger.info('[PdfToImageConverter] Using pdftoppm for conversion');
        return await this._convertWithPdfToPpm(pdfPath);
      }

      // Method 2: ImageMagick (if available)
      if (await this._isImageMagickAvailable()) {
        logger.info('[PdfToImageConverter] Using ImageMagick for conversion');
        return await this._convertWithImageMagick(pdfPath);
      }

      // No conversion tool available
      logger.warn('[PdfToImageConverter] No conversion tool available (pdftoppm/ImageMagick not installed). Vision fallback will be skipped.');
      logger.warn('[PdfToImageConverter] To enable Vision fallback, install poppler-utils: sudo apt-get install poppler-utils (Linux) or brew install poppler (Mac)');
      return [];

    } catch (error) {
      logger.error('[PdfToImageConverter] Failed to convert PDF to images:', error.message);
      return [];
    }
  }

  /**
   * Check if pdftoppm is available
   * @private
   */
  static async _isPdfToPpmAvailable() {
    try {
      await execAsync('which pdftoppm');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if ImageMagick is available
   * @private
   */
  static async _isImageMagickAvailable() {
    try {
      await execAsync('which convert');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert PDF to images using pdftoppm
   * @private
   */
  static async _convertWithPdfToPpm(pdfPath) {
    const outputDir = join(tmpdir(), `pdf-images-${Date.now()}`);
    const images = [];

    try {
      // Create output directory
      await execAsync(`mkdir -p "${outputDir}"`);

      // Convert PDF to PNG images (one per page)
      // Output format: page-001.png, page-002.png, etc.
      await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${join(outputDir, 'page')}"`);

      // Read all generated PNG files
      const fs = await import("fs");
      const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();

      for (const file of files) {
        const imagePath = join(outputDir, file);
        const imageBuffer = readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        images.push(base64);
        
        // Clean up
        unlinkSync(imagePath);
      }

      // Clean up directory
      await execAsync(`rmdir "${outputDir}"`);

      logger.info('[PdfToImageConverter] Converted PDF to images using pdftoppm:', {
        pageCount: images.length,
      });

      return images;
    } catch (error) {
      logger.error('[PdfToImageConverter] pdftoppm conversion failed:', error.message);
      // Clean up on error
      try {
        await execAsync(`rm -rf "${outputDir}"`);
      } catch {}
      return [];
    }
  }

  /**
   * Convert PDF to images using ImageMagick
   * @private
   */
  static async _convertWithImageMagick(pdfPath) {
    const outputDir = join(tmpdir(), `pdf-images-${Date.now()}`);
    const images = [];

    try {
      // Create output directory
      await execAsync(`mkdir -p "${outputDir}"`);

      // Convert PDF to PNG images (one per page)
      await execAsync(`convert -density 150 "${pdfPath}" "${join(outputDir, 'page-%03d.png')}"`);

      // Read all generated PNG files
      const fs = await import("fs");
      const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();

      for (const file of files) {
        const imagePath = join(outputDir, file);
        const imageBuffer = readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        images.push(base64);
        
        // Clean up
        unlinkSync(imagePath);
      }

      // Clean up directory
      await execAsync(`rmdir "${outputDir}"`);

      logger.info('[PdfToImageConverter] Converted PDF to images using ImageMagick:', {
        pageCount: images.length,
      });

      return images;
    } catch (error) {
      logger.error('[PdfToImageConverter] ImageMagick conversion failed:', error.message);
      // Clean up on error
      try {
        await execAsync(`rm -rf "${outputDir}"`);
      } catch {}
      return [];
    }
  }
}

/**
 * Export function for compatibility
 */
export async function convertPDFToImages(pdfPath) {
  return await PdfToImageConverter.convertPDFToImages(pdfPath);
}

