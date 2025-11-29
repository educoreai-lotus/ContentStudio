import { readFileSync } from "fs";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { logger } from "../infrastructure/logging/Logger.js";

/**
 * Professional PPTX Extractor
 * Extracts text from all layers of PPTX files:
 * - slide.text
 * - shape.text
 * - paragraph.runs
 * - txBody
 * - spTree
 * 
 * Works in Node.js without window dependency
 */
export class PptxExtractorPro {
  /**
   * Extract all text from PPTX file
   * @param {string} filePath - Path to PPTX file
   * @returns {Promise<string>} Extracted text from all slides
   */
  static async extractText(filePath) {
    try {
      const buffer = readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);
      
      const texts = [];
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        ignoreNameSpace: false,
        parseTagValue: true,
        parseNodeValue: true,
        trimValues: true,
      });

      // Get all slide files
      const slideFiles = Object.keys(zip.files).filter(file => 
        file.startsWith("ppt/slides/slide") && file.endsWith(".xml")
      );

      logger.info('[PptxExtractorPro] Found slides:', { count: slideFiles.length });

      for (const slideFile of slideFiles) {
        try {
          const slideXml = await zip.files[slideFile].async("string");
          const slideData = parser.parse(slideXml);
          
          // Extract text from all possible locations
          const slideTexts = this._extractTextFromSlide(slideData);
          if (slideTexts.length > 0) {
            texts.push(...slideTexts);
          }
        } catch (slideError) {
          logger.warn('[PptxExtractorPro] Failed to extract from slide:', {
            slide: slideFile,
            error: slideError.message,
          });
        }
      }

      const fullText = texts.join("\n").trim();
      
      logger.info('[PptxExtractorPro] Text extraction completed:', {
        slideCount: slideFiles.length,
        textLength: fullText.length,
        preview: fullText.substring(0, 100),
      });

      return fullText.length > 0 ? fullText : null;
    } catch (error) {
      logger.error('[PptxExtractorPro] Extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from a single slide XML structure
   * @private
   */
  static _extractTextFromSlide(slideData) {
    const texts = [];

    // Helper function to recursively extract text from any object
    const extractTextRecursive = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      // Check for direct text properties
      if (obj['#text'] && typeof obj['#text'] === 'string') {
        const text = obj['#text'].trim();
        if (text.length > 0) {
          texts.push(text);
        }
      }

      // Check for common text properties
      if (obj.text && typeof obj.text === 'string') {
        const text = obj.text.trim();
        if (text.length > 0) {
          texts.push(text);
        }
      }

      // Check for t (text) elements in runs
      if (obj.t && typeof obj.t === 'string') {
        const text = obj.t.trim();
        if (text.length > 0) {
          texts.push(text);
        }
      }

      // Check for array of t elements
      if (Array.isArray(obj.t)) {
        for (const t of obj.t) {
          if (typeof t === 'string') {
            const text = t.trim();
            if (text.length > 0) {
              texts.push(text);
            }
          } else if (t && t['#text']) {
            const text = t['#text'].trim();
            if (text.length > 0) {
              texts.push(text);
            }
          }
        }
      }

      // Check for a:t (text in runs)
      if (obj['a:t'] && typeof obj['a:t'] === 'string') {
        const text = obj['a:t'].trim();
        if (text.length > 0) {
          texts.push(text);
        }
      }

      // Check for array of a:t elements
      if (Array.isArray(obj['a:t'])) {
        for (const t of obj['a:t']) {
          if (typeof t === 'string') {
            const text = t.trim();
            if (text.length > 0) {
              texts.push(text);
            }
          }
        }
      }

      // Recursively process all properties
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && key !== '#text' && key !== 'text' && key !== 't' && key !== 'a:t') {
          if (Array.isArray(obj[key])) {
            for (const item of obj[key]) {
              extractTextRecursive(item, `${path}.${key}[]`);
            }
          } else if (typeof obj[key] === 'object') {
            extractTextRecursive(obj[key], `${path}.${key}`);
          }
        }
      }
    };

    // Start extraction from root
    extractTextRecursive(slideData);

    // Also check specific PPTX structures
    // p:spTree (shape tree)
    if (slideData['p:sld'] && slideData['p:sld']['p:cSld'] && slideData['p:sld']['p:cSld']['p:spTree']) {
      extractTextRecursive(slideData['p:sld']['p:cSld']['p:spTree'], 'spTree');
    }

    // p:txBody (text body)
    if (slideData['p:txBody']) {
      extractTextRecursive(slideData['p:txBody'], 'txBody');
    }

    // a:p (paragraphs) and a:r (runs)
    if (slideData['a:p']) {
      extractTextRecursive(slideData['a:p'], 'paragraph');
    }

    if (slideData['a:r']) {
      extractTextRecursive(slideData['a:r'], 'run');
    }

    return texts;
  }
}

