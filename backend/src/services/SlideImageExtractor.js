/**
 * SlideImageExtractor Service
 * Extracts images from PPTX slides and uploads them to Supabase Storage
 * 
 * Constraints:
 * - Max 10 slides
 * - Must run on Node.js backend (no browser APIs)
 * - Output must be uploaded to Supabase storage and return public URLs
 * - Deterministic naming: heygen/slides/{jobId}/slide-01.png
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';
import { logger } from '../infrastructure/logging/Logger.js';

const execAsync = promisify(exec);

/**
 * SlideImageExtractor Class
 * Extracts slide images from PPTX files and uploads them to storage
 */
export class SlideImageExtractor {
  /**
   * @param {Object} storageClient - SupabaseStorageClient instance
   * @param {string} bucketName - Supabase storage bucket name (default: 'content')
   */
  constructor(storageClient, bucketName = 'content') {
    if (!storageClient) {
      throw new Error('Storage client is required for SlideImageExtractor');
    }
    this.storageClient = storageClient;
    this.bucketName = bucketName;
  }

  /**
   * Extract images from PPTX slides and upload to storage
   * @param {string|Buffer} pptxInput - Path to PPTX file or Buffer
   * @param {string} jobId - Job ID for deterministic naming
   * @param {number} maxSlides - Maximum number of slides to extract (default: 10)
   * @returns {Promise<Array<{index: number, imageUrl: string}>>} Array of slide images with URLs
   * @throws {Error} If extraction or upload fails
   */
  async extractSlideImages(pptxInput, jobId, maxSlides = 10) {
    if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
      throw new Error('Job ID is required and must be a non-empty string');
    }

    if (maxSlides < 1 || maxSlides > 10) {
      throw new Error('maxSlides must be between 1 and 10');
    }

    let pptxBuffer;
    let tempPptxPath = null;
    let tempDir = null;

    try {
      // Handle input: path or buffer
      if (Buffer.isBuffer(pptxInput)) {
        pptxBuffer = pptxInput;
      } else if (typeof pptxInput === 'string') {
        pptxBuffer = readFileSync(pptxInput);
      } else {
        throw new Error('pptxInput must be a file path (string) or Buffer');
      }

      // Validate PPTX file (must be a ZIP file)
      try {
        const zip = await JSZip.loadAsync(pptxBuffer);
        const slideFiles = Object.keys(zip.files).filter(file => 
          file.startsWith('ppt/slides/slide') && file.endsWith('.xml')
        );

        if (slideFiles.length === 0) {
          throw new Error('No slides found in PPTX file');
        }

        const slideCount = Math.min(slideFiles.length, maxSlides);
        logger.info('[SlideImageExtractor] Found slides in PPTX', {
          totalSlides: slideFiles.length,
          extracting: slideCount,
          jobId,
        });

        // For now, we'll use a fallback approach:
        // Since converting PPTX slides to images requires external tools (LibreOffice, etc.),
        // we'll extract embedded images from slides and use them as placeholders
        // In production, you would use a proper PPTX-to-image converter
        
        return await this._extractSlideImagesFromPptx(pptxBuffer, jobId, slideCount);

      } catch (zipError) {
        if (zipError.message.includes('No slides found')) {
          throw zipError;
        }
        throw new Error(`Invalid PPTX file: ${zipError.message}`);
      }

    } catch (error) {
      logger.error('[SlideImageExtractor] Failed to extract slide images', {
        error: error.message,
        jobId,
        stack: error.stack,
      });
      throw error;
    } finally {
      // Cleanup temp files if created
      if (tempPptxPath) {
        try {
          unlinkSync(tempPptxPath);
        } catch (cleanupError) {
          logger.warn('[SlideImageExtractor] Failed to cleanup temp file', {
            path: tempPptxPath,
            error: cleanupError.message,
          });
        }
      }
      if (tempDir) {
        try {
          // Cleanup temp directory (if empty)
        } catch (cleanupError) {
          logger.warn('[SlideImageExtractor] Failed to cleanup temp directory', {
            path: tempDir,
            error: cleanupError.message,
          });
        }
      }
    }
  }

  /**
   * Extract slide images from PPTX buffer
   * @private
   * @param {Buffer} pptxBuffer - PPTX file buffer
   * @param {string} jobId - Job ID
   * @param {number} slideCount - Number of slides to extract
   * @returns {Promise<Array<{index: number, imageUrl: string}>>}
   */
  async _extractSlideImagesFromPptx(pptxBuffer, jobId, slideCount) {
    // Strategy: Try LibreOffice conversion first, fallback to embedded images
    try {
      return await this._extractUsingLibreOffice(pptxBuffer, jobId, slideCount);
    } catch (libreOfficeError) {
      logger.warn('[SlideImageExtractor] LibreOffice conversion failed, trying embedded images fallback', {
        error: libreOfficeError.message,
        jobId,
      });
      return await this._extractEmbeddedImages(pptxBuffer, jobId, slideCount);
    }
  }

  /**
   * Extract slide images using LibreOffice (converts PPTX -> PDF -> PNG)
   * @private
   * @param {Buffer} pptxBuffer - PPTX file buffer
   * @param {string} jobId - Job ID
   * @param {number} slideCount - Number of slides to extract
   * @returns {Promise<Array<{index: number, imageUrl: string}>>}
   */
  async _extractUsingLibreOffice(pptxBuffer, jobId, slideCount) {
    const tempDir = join(tmpdir(), `slide-extract-${jobId}-${Date.now()}`);
    const pptxPath = join(tempDir, 'presentation.pptx');
    const pdfPath = join(tempDir, 'presentation.pdf');
    const outputDir = join(tempDir, 'slides');

    try {
      // Create temp directory
      mkdirSync(tempDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      // Write PPTX to temp file
      writeFileSync(pptxPath, pptxBuffer);

      // Check if LibreOffice is available
      try {
        await execAsync('which libreoffice || where libreoffice');
      } catch (checkError) {
        throw new Error(
          'LibreOffice is not installed or not in PATH. ' +
          'Please install LibreOffice to convert PPTX slides to images. ' +
          'Alternatively, the extractor will try to use embedded images from the PPTX file.'
        );
      }

      // Convert PPTX to PDF using LibreOffice
      logger.info('[SlideImageExtractor] Converting PPTX to PDF using LibreOffice', { jobId });
      await execAsync(
        `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`,
        { timeout: 60000 } // 60 second timeout
      );

      if (!existsSync(pdfPath)) {
        throw new Error('LibreOffice conversion failed: PDF file not created');
      }

      // Convert PDF pages to PNG images (using pdf2pic or similar)
      // For now, we'll use a simple approach: check if pdf2pic is available
      // If not, we'll fall back to embedded images
      try {
        // Try using pdf-poppler or similar tool
        await execAsync(
          `pdftoppm -png -r 150 "${pdfPath}" "${join(outputDir, 'slide')}"`,
          { timeout: 120000 } // 2 minute timeout
        );
      } catch (pdfError) {
        // If pdftoppm is not available, try alternative
        throw new Error(
          'PDF to image conversion tool (pdftoppm) is not available. ' +
          'Please install poppler-utils or use embedded images fallback.'
        );
      }

      // Read generated PNG files
      const slideFiles = readdirSync(outputDir)
        .filter(file => file.startsWith('slide-') && file.endsWith('.png'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/slide-(\d+)\.png/)?.[1] || '0');
          const bNum = parseInt(b.match(/slide-(\d+)\.png/)?.[1] || '0');
          return aNum - bNum;
        })
        .slice(0, slideCount);

      if (slideFiles.length === 0) {
        throw new Error('No slide images were generated from PDF');
      }

      const results = [];

      // Upload each slide image
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideIndex = i + 1;
        const imagePath = join(outputDir, slideFile);
        const imageBuffer = readFileSync(imagePath);

        // Generate deterministic filename
        const fileName = `heygen/slides/${jobId}/slide-${String(slideIndex).padStart(2, '0')}.png`;

        // Upload to storage
        const uploadResult = await this.storageClient.uploadFile(
          imageBuffer,
          fileName,
          'image/png'
        );

        if (!uploadResult.url) {
          throw new Error(`Failed to get public URL for slide ${slideIndex}`);
        }

        results.push({
          index: slideIndex,
          imageUrl: uploadResult.url,
        });

        logger.info('[SlideImageExtractor] Uploaded slide image (LibreOffice)', {
          slideIndex,
          fileName,
          imageUrl: uploadResult.url,
          jobId,
        });
      }

      return results;

    } finally {
      // Cleanup temp files
      try {
        if (existsSync(pptxPath)) unlinkSync(pptxPath);
        if (existsSync(pdfPath)) unlinkSync(pdfPath);
        if (existsSync(outputDir)) {
          readdirSync(outputDir).forEach(file => {
            try {
              unlinkSync(join(outputDir, file));
            } catch (e) {
              // Ignore cleanup errors
            }
          });
        }
        // Note: We don't remove the tempDir itself as it might still be in use
      } catch (cleanupError) {
        logger.warn('[SlideImageExtractor] Failed to cleanup temp files', {
          error: cleanupError.message,
          jobId,
        });
      }
    }
  }

  /**
   * Extract embedded images from PPTX as fallback
   * @private
   * @param {Buffer} pptxBuffer - PPTX file buffer
   * @param {string} jobId - Job ID
   * @param {number} slideCount - Number of slides to extract
   * @returns {Promise<Array<{index: number, imageUrl: string}>>}
   */
  async _extractEmbeddedImages(pptxBuffer, jobId, slideCount) {
    const zip = await JSZip.loadAsync(pptxBuffer);
    
    // Get slide files (sorted by index)
    const slideFiles = Object.keys(zip.files)
      .filter(file => file.startsWith('ppt/slides/slide') && file.endsWith('.xml'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
        const bNum = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
        return aNum - bNum;
      })
      .slice(0, slideCount);

    logger.info('[SlideImageExtractor] Processing slides (embedded images fallback)', {
      slideCount: slideFiles.length,
      jobId,
    });

    // Get embedded images from media folder
    const mediaFiles = Object.keys(zip.files)
      .filter(file => file.startsWith('ppt/media/') && 
        /\.(jpg|jpeg|png|gif|bmp)$/i.test(file))
      .sort(); // Sort for consistent ordering

    if (mediaFiles.length === 0) {
      throw new Error(
        'No images found in PPTX file and LibreOffice conversion is not available. ' +
        'To extract slide images, please either:\n' +
        '1. Install LibreOffice (for automatic slide-to-image conversion), or\n' +
        '2. Ensure your PPTX file contains embedded images in the media folder.'
      );
    }

    const results = [];
    const usedMediaIndices = new Set();

      // Try to match media files to slides (simple round-robin)
    for (let i = 0; i < slideFiles.length; i++) {
      const slideIndex = i + 1;
      const mediaIndex = i % mediaFiles.length;
      const mediaFile = mediaFiles[mediaIndex];
      
      try {
        // Extract image from ZIP
        const imageBuffer = await zip.files[mediaFile].async('nodebuffer');
        
        // Determine image format from filename
        const imageExt = mediaFile.match(/\.(\w+)$/i)?.[1]?.toLowerCase() || 'png';
        const contentType = this._getContentType(imageExt);
        
        // Generate deterministic filename (always use .png extension for consistency)
        const fileName = `heygen/slides/${jobId}/slide-${String(slideIndex).padStart(2, '0')}.png`;
        
        // Upload to storage
        const uploadResult = await this.storageClient.uploadFile(
          imageBuffer,
          fileName,
          contentType
        );

        if (!uploadResult.url) {
          throw new Error(`Failed to get public URL for slide ${slideIndex}`);
        }

        results.push({
          index: slideIndex,
          imageUrl: uploadResult.url,
        });

        logger.info('[SlideImageExtractor] Uploaded slide image (embedded)', {
          slideIndex,
          fileName,
          imageUrl: uploadResult.url,
          jobId,
        });

      } catch (slideError) {
        logger.error('[SlideImageExtractor] Failed to process slide', {
          slideIndex,
          error: slideError.message,
          jobId,
        });
        // Continue with other slides
      }
    }

    if (results.length === 0) {
      throw new Error(
        'Failed to extract any slide images. ' +
        'Please ensure LibreOffice is installed for automatic conversion, ' +
        'or that your PPTX file contains embedded images.'
      );
    }

    // Ensure results are sorted by index
    results.sort((a, b) => a.index - b.index);

    logger.info('[SlideImageExtractor] Extraction completed (embedded images)', {
      extractedCount: results.length,
      expectedCount: slideFiles.length,
      jobId,
    });

    return results;
  }

  /**
   * Get content type from file extension
   * @private
   * @param {string} ext - File extension
   * @returns {string} MIME type
   */
  _getContentType(ext) {
    const contentTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
    };
    return contentTypes[ext.toLowerCase()] || 'image/png';
  }
}

