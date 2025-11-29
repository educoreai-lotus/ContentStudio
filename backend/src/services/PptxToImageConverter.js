import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "../infrastructure/logging/Logger.js";

const execAsync = promisify(exec);

/**
 * Convert PPTX slides to images
 * Uses LibreOffice or similar tool to convert PPTX to images
 */
export class PptxToImageConverter {
  /**
   * Convert PPTX file to array of base64-encoded images (one per slide)
   * @param {string} pptxPath - Path to PPTX file
   * @returns {Promise<string[]>} Array of base64-encoded images
   * 
   * NOTE: This requires LibreOffice or similar tool to be installed on the server.
   * If not available, returns empty array and Vision fallback will be skipped.
   */
  static async convertPPTXToImages(pptxPath) {
    try {
      // Try multiple conversion methods
      // Method 1: LibreOffice (if available)
      if (await this._isLibreOfficeAvailable()) {
        logger.info('[PptxToImageConverter] Using LibreOffice for conversion');
        return await this._convertWithLibreOffice(pptxPath);
      }

      // Method 2: Use unoconv (if available)
      if (await this._isUnoconvAvailable()) {
        logger.info('[PptxToImageConverter] Using unoconv for conversion');
        return await this._convertWithUnoconv(pptxPath);
      }

      // No conversion tool available
      logger.warn('[PptxToImageConverter] No conversion tool available (LibreOffice/unoconv not installed). Vision fallback will be skipped.');
      logger.warn('[PptxToImageConverter] To enable Vision fallback, install LibreOffice: sudo apt-get install libreoffice (Linux) or brew install libreoffice (Mac)');
      return [];

    } catch (error) {
      logger.error('[PptxToImageConverter] Failed to convert PPTX to images:', error.message);
      return [];
    }
  }

  /**
   * Check if LibreOffice is available
   * @private
   */
  static async _isLibreOfficeAvailable() {
    try {
      await execAsync('which libreoffice || which soffice');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if unoconv is available
   * @private
   */
  static async _isUnoconvAvailable() {
    try {
      await execAsync('which unoconv');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert PPTX to images using LibreOffice
   * @private
   */
  static async _convertWithLibreOffice(pptxPath) {
    const outputDir = join(tmpdir(), `pptx-images-${Date.now()}`);
    const images = [];

    try {
      // Create output directory
      await execAsync(`mkdir -p "${outputDir}"`);

      // Convert PPTX to PNG images (one per slide)
      await execAsync(`libreoffice --headless --convert-to png --outdir "${outputDir}" "${pptxPath}"`);

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

      logger.info('[PptxToImageConverter] Converted PPTX to images using LibreOffice:', {
        slideCount: images.length,
      });

      return images;
    } catch (error) {
      logger.error('[PptxToImageConverter] LibreOffice conversion failed:', error.message);
      // Clean up on error
      try {
        await execAsync(`rm -rf "${outputDir}"`);
      } catch {}
      return [];
    }
  }

  /**
   * Convert PPTX to images using unoconv
   * @private
   */
  static async _convertWithUnoconv(pptxPath) {
    // Similar to LibreOffice but using unoconv
    // Implementation similar to _convertWithLibreOffice
    logger.warn('[PptxToImageConverter] unoconv conversion not yet implemented');
    return [];
  }
}

/**
 * Export function for compatibility
 */
export async function convertPPTXToImages(pptxPath) {
  return await PptxToImageConverter.convertPPTXToImages(pptxPath);
}

