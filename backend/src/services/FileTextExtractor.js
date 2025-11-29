import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { exec } from "child_process";
import axios from "axios";
import pdf from "pdf-parse";
import PptxParser from "pptx-parser";
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
   * @returns {Promise<string|null>} Extracted text or null if extraction failed
   */
  static async extractTextFromFile(filePathOrBuffer, fileExtension = null) {
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
        return await this._extractPDF(localPath);
      }

      if (normalizedExt === ".pptx") {
        return await this._extractPPTX(localPath);
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
   * @returns {Promise<string|null>} Extracted text or null if extraction failed
   */
  static async extractTextFromUrl(fileUrl, contentData = null) {
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

      // Prepare fallback options for PPT files
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
   */
  static async _extractPDF(localPath) {
    try {
      const dataBuffer = readFileSync(localPath);
      const result = await pdf(dataBuffer);
      const text = result.text?.trim() || "";
      
      logger.info('[FileTextExtractor] PDF text extracted:', {
        textLength: text.length,
        preview: text.substring(0, 100),
      });
      
      return text.length > 0 ? text : null;
    } catch (error) {
      logger.error('[FileTextExtractor] PDF extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from PPTX file
   * @private
   */
  static async _extractPPTX(localPath) {
    try {
      const buffer = readFileSync(localPath);
      const pptx = await PptxParser.parse(buffer);

      const texts = [];

      // Check if slides exist
      if (!pptx.slides || !Array.isArray(pptx.slides)) {
        logger.warn('[FileTextExtractor] PPTX has no slides array, trying alternative extraction methods');
        // Fallback: try to extract from raw data if available
        if (pptx.rawData) {
          const rawText = JSON.stringify(pptx.rawData);
          if (rawText && rawText.length > 50) {
            logger.info('[FileTextExtractor] PPTX extracted from rawData fallback');
            return rawText;
          }
        }
        return null;
      }

      // Extract text from slides
      for (const slide of pptx.slides) {
        // Check if slide has texts array
        if (slide.texts && Array.isArray(slide.texts)) {
          for (const t of slide.texts) {
            if (t && t.text) {
              texts.push(t.text);
            }
          }
        } else {
          // Fallback: try to extract from slide object directly
          logger.warn('[FileTextExtractor] Slide has no texts array, trying alternative extraction', {
            slideNumber: slide.number || 'unknown',
            slideKeys: Object.keys(slide || {}),
          });
          
          // Try common alternative properties
          if (slide.content) {
            texts.push(slide.content);
          } else if (slide.text) {
            texts.push(slide.text);
          } else if (slide.body) {
            texts.push(slide.body);
          } else if (slide.title) {
            texts.push(slide.title);
          }
        }
      }

      const full = texts.join("\n").trim();
      
      logger.info('[FileTextExtractor] PPTX text extracted:', {
        slideCount: pptx.slides?.length || 0,
        slidesWithTexts: pptx.slides.filter(s => s.texts && Array.isArray(s.texts)).length,
        textLength: full.length,
        preview: full.substring(0, 100),
      });
      
      return full.length > 0 ? full : null;
    } catch (error) {
      logger.error('[FileTextExtractor] PPTX extraction failed:', error.message);
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

