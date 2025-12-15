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
   * @param {string|Buffer} pptxInput - Path to PPTX file or Buffer (or PDF file/Buffer)
   * @param {string} jobId - Job ID for deterministic naming
   * @param {number} maxSlides - Maximum number of slides to extract (default: 10)
   * @param {boolean} requireFullRendering - If true, requires full slide rendering (LibreOffice/pdftoppm). 
   *                                         No fallback to embedded images. Throws error if rendering unavailable.
   *                                         Used for avatar video generation where slide text must be visible.
   * @param {string} [inputFormat] - Input format: 'pptx' (default) or 'pdf'. If 'pdf', skips LibreOffice conversion.
   * @returns {Promise<Array<{index: number, imageUrl: string}>>} Array of slide images with URLs
   * @throws {Error} If extraction or upload fails
   */
  async extractSlideImages(pptxInput, jobId, maxSlides = 10, requireFullRendering = false, inputFormat = 'pptx') {
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

      // If input is PDF, extract directly from PDF (no LibreOffice needed)
      if (inputFormat === 'pdf') {
        // For PDF, we need to determine slide count from PDF pages
        // We'll extract all pages and limit to maxSlides
        return await this._extractFromPDF(pptxBuffer, jobId, maxSlides, requireFullRendering);
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
          requireFullRendering,
          inputFormat,
        });

        // Extract slide images with appropriate strategy (PPTX -> PDF -> PNG)
        return await this._extractSlideImagesFromPptx(pptxBuffer, jobId, slideCount, requireFullRendering);

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
   * @param {boolean} requireFullRendering - If true, requires full slide rendering (no fallback)
   * @returns {Promise<Array<{index: number, imageUrl: string}>>}
   * @throws {Error} If requireFullRendering is true and LibreOffice/pdftoppm is unavailable
   */
  async _extractSlideImagesFromPptx(pptxBuffer, jobId, slideCount, requireFullRendering = false) {
    logger.info('[SlideImageExtractor] Starting slide image extraction', {
      jobId,
      slideCount,
      requireFullRendering,
      strategy: requireFullRendering ? 'FULL_SLIDE_RENDERING_REQUIRED' : 'FULL_RENDERING_WITH_FALLBACK',
    });

    // Strategy: Try LibreOffice conversion first
    try {
      const result = await this._extractUsingLibreOffice(pptxBuffer, jobId, slideCount);
      logger.info('[SlideImageExtractor] Successfully extracted slides using FULL SLIDE RENDERING (LibreOffice + pdftoppm)', {
        jobId,
        slideCount: result.length,
        strategy: 'FULL_SLIDE_RENDERING',
        renderingMethod: 'LibreOffice -> PDF -> PNG (pdftoppm)',
      });
      return result;
    } catch (libreOfficeError) {
      // If full rendering is required (e.g., for avatar videos), throw hard error
      if (requireFullRendering) {
        logger.error('[SlideImageExtractor] FULL SLIDE RENDERING REQUIRED but LibreOffice/pdftoppm unavailable', {
          jobId,
          error: libreOfficeError.message,
          strategy: 'FULL_SLIDE_RENDERING_REQUIRED',
          reason: 'Avatar videos require fully rendered slide images (background + text + layout). Embedded images fallback is not allowed.',
          requiredTools: ['LibreOffice', 'poppler-utils (pdftoppm)'],
        });
        throw new Error(
          `FULL SLIDE RENDERING REQUIRED: LibreOffice/pdftoppm is not available. ` +
          `Avatar videos require fully rendered slide images where all text, backgrounds, and layouts are visible. ` +
          `Embedded images fallback is NOT allowed for avatar video generation. ` +
          `Please install LibreOffice and poppler-utils. ` +
          `Original error: ${libreOfficeError.message}`
        );
      }

      // Fallback to embedded images only if full rendering is NOT required
      logger.warn('[SlideImageExtractor] LibreOffice conversion failed, using embedded images fallback', {
        error: libreOfficeError.message,
        jobId,
        strategy: 'EMBEDDED_IMAGES_FALLBACK',
        warning: 'This fallback does NOT render slide text/layout. Only embedded images are extracted.',
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
      let libreOfficeAvailable = false;
      try {
        await execAsync('which libreoffice || where libreoffice');
        libreOfficeAvailable = true;
        logger.info('[SlideImageExtractor] LibreOffice is available', { jobId });
      } catch (checkError) {
        logger.error('[SlideImageExtractor] LibreOffice is NOT available', {
          jobId,
          error: checkError.message,
        });
        throw new Error(
          'LibreOffice is not installed or not in PATH. ' +
          'Please install LibreOffice to convert PPTX slides to images. ' +
          'Installation: sudo apt-get install libreoffice (Linux) or brew install libreoffice (Mac)'
        );
      }

      // Convert PPTX to PDF using LibreOffice
      logger.info('[SlideImageExtractor] Converting PPTX to PDF using LibreOffice (FULL SLIDE RENDERING)', {
        jobId,
        strategy: 'FULL_SLIDE_RENDERING',
        step: 'PPTX -> PDF',
      });
      await execAsync(
        `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`,
        { timeout: 60000 } // 60 second timeout
      );

      if (!existsSync(pdfPath)) {
        throw new Error('LibreOffice conversion failed: PDF file not created');
      }

      // Convert PDF pages to PNG images using pdftoppm (poppler-utils)
      // CRITICAL: This is required for full slide rendering (text + layout + background)
      logger.info('[SlideImageExtractor] Converting PDF pages to PNG images using pdftoppm (FULL SLIDE RENDERING)', {
        jobId,
        strategy: 'FULL_SLIDE_RENDERING',
        step: 'PDF -> PNG',
        tool: 'pdftoppm (poppler-utils)',
      });
      
      // Check if pdftoppm is available
      // Try multiple methods: command -v, which, and direct path check
      let pdftoppmAvailable = false;
      let pdftoppmPath = null;
      
      // Try command -v first (POSIX standard)
      try {
        const { stdout } = await execAsync('command -v pdftoppm');
        pdftoppmPath = stdout.trim();
        pdftoppmAvailable = true;
        logger.info('[SlideImageExtractor] pdftoppm is available', { jobId, path: pdftoppmPath });
      } catch (checkError1) {
        // Try which as fallback
        try {
          const { stdout } = await execAsync('which pdftoppm');
          pdftoppmPath = stdout.trim();
          pdftoppmAvailable = true;
          logger.info('[SlideImageExtractor] pdftoppm is available (via which)', { jobId, path: pdftoppmPath });
        } catch (checkError2) {
          // Try common installation paths
          const commonPaths = ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', '/bin/pdftoppm'];
          for (const path of commonPaths) {
            try {
              await execAsync(`test -f ${path} && ${path} -v`);
              pdftoppmPath = path;
              pdftoppmAvailable = true;
              logger.info('[SlideImageExtractor] pdftoppm found at common path', { jobId, path: pdftoppmPath });
              break;
            } catch {
              // Continue to next path
            }
          }
          
          if (!pdftoppmAvailable) {
            logger.error('[SlideImageExtractor] pdftoppm is NOT available', {
              jobId,
              error: checkError1.message,
              triedPaths: commonPaths,
            });
            throw new Error(
              'PDF to image conversion tool (pdftoppm) is not installed or not in PATH. ' +
              'pdftoppm is required for full slide rendering. ' +
              'Please install poppler-utils: sudo apt-get install poppler-utils (Linux) or brew install poppler (Mac)'
            );
          }
        }
      }

      // Convert PDF to PNG images (one per page/slide)
      // Use pdftoppmPath if found, otherwise use 'pdftoppm' (assume it's in PATH)
      const pdftoppmCommand = pdftoppmPath || 'pdftoppm';
      try {
        await execAsync(
          `${pdftoppmCommand} -png -r 150 "${pdfPath}" "${join(outputDir, 'slide')}"`,
          { timeout: 120000 } // 2 minute timeout
        );
        logger.info('[SlideImageExtractor] Successfully converted PDF to PNG images', {
          jobId,
          outputDir,
        });
      } catch (pdfError) {
        logger.error('[SlideImageExtractor] pdftoppm conversion failed', {
          jobId,
          error: pdfError.message,
          pdfPath,
        });
        throw new Error(
          `PDF to PNG conversion failed using pdftoppm: ${pdfError.message}. ` +
          `This is required for full slide rendering.`
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

        logger.info('[SlideImageExtractor] Uploaded slide image (FULL SLIDE RENDERING)', {
          slideIndex,
          fileName,
          imageUrl: uploadResult.url,
          jobId,
          renderingMethod: 'LibreOffice -> PDF -> PNG (pdftoppm)',
          strategy: 'FULL_SLIDE_RENDERING',
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
   * Extract slide images directly from PDF (no LibreOffice needed)
   * @private
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {string} jobId - Job ID
   * @param {number} slideCount - Number of slides to extract
   * @param {boolean} requireFullRendering - If true, requires pdftoppm (no fallback)
   * @returns {Promise<Array<{index: number, imageUrl: string}>>}
   * @throws {Error} If requireFullRendering is true and pdftoppm is unavailable
   */
  async _extractFromPDF(pdfBuffer, jobId, slideCount, requireFullRendering = false) {
    const tempDir = join(tmpdir(), `pdf-extract-${jobId}-${Date.now()}`);
    const pdfPath = join(tempDir, 'presentation.pdf');
    const outputDir = join(tempDir, 'slides');

    try {
      // Create temp directory
      mkdirSync(tempDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      // Write PDF to temp file
      writeFileSync(pdfPath, pdfBuffer);

      logger.info('[SlideImageExtractor] Converting PDF pages to PNG images (FULL SLIDE RENDERING)', {
        jobId,
        strategy: 'FULL_SLIDE_RENDERING',
        step: 'PDF -> PNG',
        tool: 'pdftoppm (poppler-utils)',
      });

      // Check if pdftoppm is available
      // Try multiple methods: command -v, which, and direct path check
      let pdftoppmAvailable = false;
      let pdftoppmPath = null;
      
      // Try command -v first (POSIX standard)
      try {
        const { stdout } = await execAsync('command -v pdftoppm');
        pdftoppmPath = stdout.trim();
        pdftoppmAvailable = true;
        logger.info('[SlideImageExtractor] pdftoppm is available', { jobId, path: pdftoppmPath });
      } catch (checkError1) {
        // Try which as fallback
        try {
          const { stdout } = await execAsync('which pdftoppm');
          pdftoppmPath = stdout.trim();
          pdftoppmAvailable = true;
          logger.info('[SlideImageExtractor] pdftoppm is available (via which)', { jobId, path: pdftoppmPath });
        } catch (checkError2) {
          // Try common installation paths
          const commonPaths = ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', '/bin/pdftoppm'];
          for (const path of commonPaths) {
            try {
              await execAsync(`test -f ${path} && ${path} -v`);
              pdftoppmPath = path;
              pdftoppmAvailable = true;
              logger.info('[SlideImageExtractor] pdftoppm found at common path', { jobId, path: pdftoppmPath });
              break;
            } catch {
              // Continue to next path
            }
          }
          
          if (!pdftoppmAvailable) {
            logger.error('[SlideImageExtractor] pdftoppm is NOT available', {
              jobId,
              error: checkError1.message,
              triedPaths: commonPaths,
            });
            if (requireFullRendering) {
              throw new Error(
                'PDF to image conversion tool (pdftoppm) is not installed or not in PATH. ' +
                'pdftoppm is required for full slide rendering. ' +
                'Please install poppler-utils: sudo apt-get install poppler-utils (Linux) or brew install poppler (Mac)'
              );
            }
            // If not required, we can't proceed without pdftoppm for PDF
            throw new Error(
              'PDF to image conversion requires pdftoppm. ' +
              'Please install poppler-utils: sudo apt-get install poppler-utils (Linux) or brew install poppler (Mac)'
            );
          }
        }
      }

      // Convert PDF to PNG images (one per page/slide)
      // Use pdftoppmPath if found, otherwise use 'pdftoppm' (assume it's in PATH)
      const pdftoppmCommand = pdftoppmPath || 'pdftoppm';
      logger.info('[SlideImageExtractor] Using pdftoppm command', { jobId, command: pdftoppmCommand, pdfPath });
      try {
        await execAsync(
          `${pdftoppmCommand} -png -r 150 "${pdfPath}" "${join(outputDir, 'slide')}"`,
          { timeout: 120000 } // 2 minute timeout
        );
        logger.info('[SlideImageExtractor] Successfully converted PDF to PNG images', {
          jobId,
          outputDir,
        });
      } catch (pdfError) {
        logger.error('[SlideImageExtractor] pdftoppm conversion failed', {
          jobId,
          error: pdfError.message,
          pdfPath,
        });
        throw new Error(
          `PDF to PNG conversion failed using pdftoppm: ${pdfError.message}. ` +
          `This is required for full slide rendering.`
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

        logger.info('[SlideImageExtractor] Uploaded slide image (PDF -> PNG)', {
          slideIndex,
          fileName,
          imageUrl: uploadResult.url,
          jobId,
          renderingMethod: 'PDF -> PNG (pdftoppm)',
          strategy: 'FULL_SLIDE_RENDERING',
        });
      }

      return results;

    } finally {
      // Cleanup temp files
      try {
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
      } catch (cleanupError) {
        logger.warn('[SlideImageExtractor] Failed to cleanup temp files', {
          error: cleanupError.message,
          jobId,
        });
      }
    }
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

