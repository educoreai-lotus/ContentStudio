import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { exec } from "child_process";
import axios from "axios";
// Use dynamic import for pdf-parse to avoid test file loading issue
// import pdf from "pdf-parse";
// Use dynamic import for pptx2json (Node.js compatible, no window dependency)
// import pptx2json from "pptx2json";
import mammoth from "mammoth";
import { logger } from "../infrastructure/logging/Logger.js";

const execAsync = promisify(exec);

/**
 * Unified File Text Extractor
 * Extracts text from PDF, PPTX, and PPT files
 */
export class FileTextExtractor {
  /**
   * Extract text from a file (local path or buffer)
   * @param {string|Buffer} filePathOrBuffer - Local file path or file buffer
   * @param {string} fileExtension - File extension (e.g., '.pdf', '.pptx', '.ppt')
   * @param {Object} options - Optional options including fallback URLs for PPT files (pdfUrl, pptxUrl) and openaiClient for Vision fallback
   * @returns {Promise<string|null>} Extracted text or null if extraction failed
   */
  static async extractTextFromFile(filePathOrBuffer, fileExtension = null, options = {}) {
    // Ensure options is always an object
    if (!options || typeof options !== 'object') {
      options = {};
    }
    let ext = fileExtension;
    let localPath = null;
    let isBuffer = false;

    // Determine file extension
    if (!ext) {
      if (typeof filePathOrBuffer === 'string') {
        ext = this._getExtension(filePathOrBuffer);
        localPath = filePathOrBuffer;
      } else if (Buffer.isBuffer(filePathOrBuffer)) {
        // If buffer, we need to save it temporarily
        ext = '.tmp'; // Will be determined from content or URL
        isBuffer = true;
      }
    } else {
      if (typeof filePathOrBuffer === 'string') {
        localPath = filePathOrBuffer;
      } else if (Buffer.isBuffer(filePathOrBuffer)) {
        isBuffer = true;
      }
    }

    // If buffer, save to temp file first
    if (isBuffer && Buffer.isBuffer(filePathOrBuffer)) {
      const tempPath = join(tmpdir(), `extract-${Date.now()}-${Math.random().toString(36).substring(7)}${ext || '.tmp'}`);
      writeFileSync(tempPath, filePathOrBuffer);
      localPath = tempPath;
    }

    if (!localPath) {
      logger.warn('[FileTextExtractor] No valid file path or buffer provided');
      return null;
    }

    ext = ext || this._getExtension(localPath);
    const normalizedExt = ext.toLowerCase();

    try {
      if (normalizedExt === ".pdf") {
        return await this._extractPDF(localPath, options);
      }

      if (normalizedExt === ".pptx") {
        return await this._extractPPTX(localPath, options);
      }

      if (normalizedExt === ".ppt") {
        return await this._extractPPT(localPath, options);
      }

      logger.warn('[FileTextExtractor] Unsupported file type:', normalizedExt);
      return null;
    } catch (error) {
      logger.error('[FileTextExtractor] Failed to extract text:', {
        error: error.message,
        filePath: localPath,
        extension: normalizedExt,
      });
      return null;
    } finally {
      // Clean up temp file if we created it
      if (isBuffer && localPath && localPath.startsWith(tmpdir())) {
        try {
          unlinkSync(localPath);
        } catch (cleanupError) {
          logger.warn('[FileTextExtractor] Failed to cleanup temp file:', cleanupError.message);
        }
      }
    }
  }

  /**
   * Download file from URL and extract text
   * @param {string} fileUrl - URL to download file from
   * @param {Object} contentData - Optional content_data object to search for fallback URLs (pdfUrl, pptxUrl)
   * @param {Object} openaiClient - Optional OpenAI client for Vision fallback
   * @returns {Promise<string|null>} Extracted text or null if extraction failed
   */
  static async extractTextFromUrl(fileUrl, contentData = null, openaiClient = null) {
    if (!fileUrl) {
      return null;
    }

    const ext = this._getExtension(fileUrl);
    if (!ext || (!ext.endsWith('.pdf') && !ext.endsWith('.pptx') && !ext.endsWith('.ppt'))) {
      logger.warn('[FileTextExtractor] Unsupported file URL extension:', ext);
      return null;
    }

    try {
      // Download file to temp location
      const tempPath = join(tmpdir(), `download-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
      
      logger.info('[FileTextExtractor] Downloading file for text extraction:', {
        url: fileUrl.substring(0, 100) + '...',
        tempPath,
      });

      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
      });

      const buffer = Buffer.from(response.data);
      writeFileSync(tempPath, buffer);

      // Prepare fallback options
      const options = {};
      if (ext.endsWith('.ppt') && contentData) {
        // Search for fallback URLs in content_data
        options.pdfUrl = contentData.pdfUrl || contentData.pdf_url || contentData.presentationPdfUrl;
        options.pptxUrl = contentData.pptxUrl || contentData.pptx_url || contentData.presentationPptxUrl;
        
        if (options.pdfUrl || options.pptxUrl) {
          logger.info('[FileTextExtractor] Found fallback URLs for PPT:', {
            hasPdfUrl: !!options.pdfUrl,
            hasPptxUrl: !!options.pptxUrl,
          });
        }
      }
      
      // Add OpenAI client for Vision fallback (for PPTX and PDF)
      if ((ext.endsWith('.pptx') || ext.endsWith('.pdf')) && openaiClient) {
        options.openaiClient = openaiClient;
      }

      // Extract text
      const text = await this.extractTextFromFile(tempPath, ext, options);

      // Clean up temp file
      try {
        unlinkSync(tempPath);
      } catch (cleanupError) {
        logger.warn('[FileTextExtractor] Failed to cleanup temp file:', cleanupError.message);
      }

      return text;
    } catch (error) {
      logger.error('[FileTextExtractor] Failed to download and extract text from URL:', {
        error: error.message,
        url: fileUrl.substring(0, 100) + '...',
      });
      return null;
    }
  }

  /**
   * Extract text from PDF file
   * @private
   * @param {string} localPath - Path to PDF file
   * @param {Object} options - Options including openaiClient for Vision fallback
   * @returns {Promise<string|null>} Extracted text or null
   */
  static async _extractPDF(localPath, options = {}) {
    // Try to load pdf-parse with error handling for test file issue
    let pdf;
    let pdfModuleLoaded = false;
    
    try {
      // Try dynamic import
      const pdfModule = await import("pdf-parse");
      pdf = pdfModule.default || pdfModule;
      pdfModuleLoaded = true;
      logger.info('[FileTextExtractor] Successfully loaded pdf-parse module');
    } catch (importError) {
      // If import fails due to test file error, try CommonJS require as fallback
      if (importError.message && importError.message.includes('test/data')) {
        logger.warn('[FileTextExtractor] PDF-parse test file error detected during import, trying CommonJS require fallback');
        try {
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          pdf = require('pdf-parse');
          pdfModuleLoaded = true;
          logger.info('[FileTextExtractor] Successfully loaded pdf-parse via require fallback');
        } catch (requireError) {
          logger.warn('[FileTextExtractor] Both import and require failed for pdf-parse:', requireError.message);
          // Continue to try Vision fallback below
        }
      } else {
        // For other import errors, log and continue to Vision fallback
        logger.warn('[FileTextExtractor] Failed to import pdf-parse:', importError.message);
      }
    }

    // If pdf-parse is loaded, try to use it
    if (pdfModuleLoaded && pdf) {
      try {
        const dataBuffer = readFileSync(localPath);
        
        // Call pdf with buffer
        const result = await pdf(dataBuffer);
        const text = result.text?.trim() || "";
        
        logger.info('[FileTextExtractor] PDF text extracted using pdf-parse:', {
          textLength: text.length,
          preview: text.substring(0, 100),
        });
        
        // If extracted text is too short, try Vision fallback
        if (text.length < 10 && options.openaiClient) {
          logger.warn('[FileTextExtractor] PDF extraction returned very little text, trying Vision fallback');
          try {
            return await this._extractPDFWithVision(localPath, options.openaiClient);
          } catch (visionError) {
            logger.warn('[FileTextExtractor] Vision fallback failed, returning extracted text:', visionError.message);
            // Return what we have even if it's short
            return text.length > 0 ? text : null;
          }
        }
        
        return text.length > 0 ? text : null;
      } catch (parseError) {
        // If pdf-parse fails to parse the file, try Vision fallback
        logger.warn('[FileTextExtractor] pdf-parse failed to extract text, trying Vision fallback:', parseError.message);
        if (options.openaiClient) {
          try {
            return await this._extractPDFWithVision(localPath, options.openaiClient);
          } catch (visionError) {
            logger.error('[FileTextExtractor] Vision fallback also failed:', visionError.message);
            throw new Error(`PDF extraction failed: ${parseError.message}. Vision fallback also failed: ${visionError.message}`);
          }
        }
        throw parseError;
      }
    }
    
    // If pdf-parse is not available, try Vision fallback
    if (options.openaiClient) {
      logger.warn('[FileTextExtractor] pdf-parse not available, trying Vision fallback');
      try {
        return await this._extractPDFWithVision(localPath, options.openaiClient);
      } catch (visionError) {
        logger.error('[FileTextExtractor] Vision fallback failed:', visionError.message);
        throw new Error(`PDF extraction failed: pdf-parse not available and Vision fallback failed: ${visionError.message}`);
      }
    }
    
    // No extraction method available
    throw new Error('PDF extraction failed: pdf-parse not available and Vision fallback not configured');
  }

  /**
   * Extract text from PDF using OpenAI Vision API (OCR fallback)
   * Converts PDF pages to images and sends to Vision API
   * @private
   */
  static async _extractPDFWithVision(localPath, openaiClient) {
    try {
      logger.info('[FileTextExtractor] Starting Vision-based PDF extraction');
      
      // Convert PDF pages to images
      // Note: This requires pdf2pic or similar library
      // For now, we'll use a simpler approach - convert first page only
      const { convertPDFToImages } = await import("./PdfToImageConverter.js");
      const pageImages = await convertPDFToImages(localPath);
      
      if (!pageImages || pageImages.length === 0) {
        logger.warn('[FileTextExtractor] Failed to convert PDF pages to images - poppler-utils not installed');
        throw new Error('Vision fallback requires poppler-utils to be installed. Please install it: sudo apt-get install poppler-utils (Linux) or brew install poppler (Mac)');
      }

      const allTexts = [];

      // Send each page image to OpenAI Vision API
      for (let i = 0; i < pageImages.length; i++) {
        try {
          const imageBase64 = pageImages[i];
          const visionText = await openaiClient.extractTextFromImage(imageBase64);
          
          if (visionText && visionText.trim().length > 0) {
            allTexts.push(`Page ${i + 1}: ${visionText}`);
          }
        } catch (pageError) {
          logger.warn('[FileTextExtractor] Failed to extract text from PDF page image:', {
            page: i + 1,
            error: pageError.message,
          });
        }
      }

      const fullText = allTexts.join("\n\n").trim();
      
      logger.info('[FileTextExtractor] Vision-based PDF extraction completed:', {
        pageCount: pageImages.length,
        textLength: fullText.length,
        preview: fullText.substring(0, 100),
      });

      return fullText.length > 0 ? fullText : null;
    } catch (error) {
      logger.error('[FileTextExtractor] Vision-based PDF extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from PPTX file
   * @private
   * @param {string} localPath - Path to PPTX file
   * @param {Object} options - Options including openaiClient for Vision fallback
   * @returns {Promise<string|null>} Extracted text or null
   */
  static async _extractPPTX(localPath, options = {}) {
    try {
      // Try PptxExtractorPro first (reads all PPTX layers: slide.text, shape.text, paragraph.runs, txBody, spTree)
      const { PptxExtractorPro } = await import("./PptxExtractorPro.js");
      const extractedText = await PptxExtractorPro.extractText(localPath);
      
      if (extractedText && extractedText.trim().length >= 10) {
        logger.info('[FileTextExtractor] PPTX text extracted successfully (PptxExtractorPro):', {
          textLength: extractedText.length,
          preview: extractedText.substring(0, 100),
        });
        return extractedText;
      }

      // If extraction failed or returned too little text, try Vision fallback
      if (options.openaiClient) {
        logger.warn('[FileTextExtractor] PPTX extraction returned insufficient text, trying Vision fallback');
        return await this._extractPPTXWithVision(localPath, options.openaiClient);
      }

      logger.warn('[FileTextExtractor] PPTX extraction failed and no Vision fallback available');
      return null;
    } catch (error) {
      logger.error('[FileTextExtractor] PPTX extraction failed:', error.message);
      
      // Try Vision fallback on error if available
      if (options.openaiClient) {
        logger.info('[FileTextExtractor] Attempting Vision fallback after extraction error');
        try {
          return await this._extractPPTXWithVision(localPath, options.openaiClient);
        } catch (visionError) {
          logger.error('[FileTextExtractor] Vision fallback also failed:', visionError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Extract text from PPTX using OpenAI Vision API (OCR fallback)
   * Converts each slide to image and sends to Vision API
   * @private
   */
  static async _extractPPTXWithVision(localPath, openaiClient) {
    try {
      logger.info('[FileTextExtractor] Starting Vision-based PPTX extraction');
      
      // Convert PPTX slides to images
      const { convertPPTXToImages } = await import("./PptxToImageConverter.js");
      const slideImages = await convertPPTXToImages(localPath);
      
      if (!slideImages || slideImages.length === 0) {
        logger.warn('[FileTextExtractor] Failed to convert PPTX slides to images');
        return null;
      }

      const allTexts = [];

      // Send each slide image to OpenAI Vision API
      for (let i = 0; i < slideImages.length; i++) {
        try {
          const imageBase64 = slideImages[i];
          const visionText = await openaiClient.extractTextFromImage(imageBase64);
          
          if (visionText && visionText.trim().length > 0) {
            allTexts.push(`Slide ${i + 1}: ${visionText}`);
          }
        } catch (slideError) {
          logger.warn('[FileTextExtractor] Failed to extract text from slide image:', {
            slide: i + 1,
            error: slideError.message,
          });
        }
      }

      const fullText = allTexts.join("\n\n").trim();
      
      logger.info('[FileTextExtractor] Vision-based extraction completed:', {
        slideCount: slideImages.length,
        textLength: fullText.length,
        preview: fullText.substring(0, 100),
      });

      return fullText.length > 0 ? fullText : null;
    } catch (error) {
      logger.error('[FileTextExtractor] Vision-based extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from PPT file (older format)
   * @private
   * @param {string} localPath - Path to PPT file
   * @param {Object} options - Optional fallback URLs (pdfUrl, pptxUrl)
   * @returns {Promise<string|null>} Extracted text or null
   */
  static async _extractPPT(localPath, options = {}) {
    try {
      // Mammoth works well for older PPT files (Office 97-2003)
      const result = await mammoth.extractRawText({ path: localPath });
      const text = result.value.trim();
      
      logger.info('[FileTextExtractor] PPT text extracted (mammoth):', {
        textLength: text.length,
        preview: text.substring(0, 100),
      });
      
      // If mammoth returned very little text (< 10 chars), try fallback
      if (text.length < 10) {
        logger.warn('[FileTextExtractor] PPT extraction returned very little text, trying fallback URLs', {
          textLength: text.length,
          hasPdfUrl: !!options.pdfUrl,
          hasPptxUrl: !!options.pptxUrl,
        });
        
        // Try PDF fallback first (most reliable)
        if (options.pdfUrl) {
          try {
            logger.info('[FileTextExtractor] Attempting PDF fallback for PPT');
            const pdfText = await this.extractTextFromUrl(options.pdfUrl);
            if (pdfText && pdfText.trim().length >= 10) {
              logger.info('[FileTextExtractor] ✅ PDF fallback successful for PPT');
              return pdfText;
            }
          } catch (pdfError) {
            logger.warn('[FileTextExtractor] PDF fallback failed:', pdfError.message);
          }
        }
        
        // Try PPTX fallback
        if (options.pptxUrl) {
          try {
            logger.info('[FileTextExtractor] Attempting PPTX fallback for PPT');
            const pptxText = await this.extractTextFromUrl(options.pptxUrl);
            if (pptxText && pptxText.trim().length >= 10) {
              logger.info('[FileTextExtractor] ✅ PPTX fallback successful for PPT');
              return pptxText;
            }
          } catch (pptxError) {
            logger.warn('[FileTextExtractor] PPTX fallback failed:', pptxError.message);
          }
        }
        
        // If all fallbacks failed, return null
        logger.warn('[FileTextExtractor] PPT extraction and all fallbacks failed, returning null');
        return null;
      }
      
      return text.length > 0 ? text : null;
    } catch (error) {
      logger.error('[FileTextExtractor] PPT extraction failed:', error.message);
      
      // Try fallback URLs even on error
      if (options.pdfUrl || options.pptxUrl) {
        logger.info('[FileTextExtractor] PPT extraction error, trying fallback URLs');
        if (options.pdfUrl) {
          try {
            const pdfText = await this.extractTextFromUrl(options.pdfUrl);
            if (pdfText && pdfText.trim().length >= 10) {
              return pdfText;
            }
          } catch (pdfError) {
            // Ignore fallback errors
          }
        }
        if (options.pptxUrl) {
          try {
            const pptxText = await this.extractTextFromUrl(options.pptxUrl);
            if (pptxText && pptxText.trim().length >= 10) {
              return pptxText;
            }
          } catch (pptxError) {
            // Ignore fallback errors
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Get file extension from path or URL
   * @private
   */
  static _getExtension(filePath) {
    if (!filePath) return null;
    
    // Remove query parameters from URL
    const cleanPath = filePath.split('?')[0];
    
    // Get extension
    const lastDot = cleanPath.lastIndexOf('.');
    if (lastDot === -1) return null;
    
    return cleanPath.substring(lastDot);
  }
}


