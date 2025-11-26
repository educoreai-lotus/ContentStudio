import axios from 'axios';
import { logger } from '../logging/Logger.js';

/**
 * RTL (Right-to-Left) languages supported by Gamma
 * This list can be extended automatically if Gamma adds RTL support for more languages
 */
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/**
 * Language mapper for Gamma API
 * Maps various language inputs to Gamma's supported language codes
 */
const LANGUAGE_MAP = {
  // English variants
  'english': 'en',
  'en': 'en',
  'eng': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  // Hebrew variants
  'hebrew': 'he',
  'he': 'he',
  'heb': 'he',
  'he-il': 'he',
  // Arabic variants
  'arabic': 'ar',
  'ar': 'ar',
  'ara': 'ar',
  'ar-sa': 'ar',
  'ar-eg': 'ar',
  // Persian/Farsi variants
  'persian': 'fa',
  'farsi': 'fa',
  'fa': 'fa',
  'fa-ir': 'fa',
  // Urdu variants
  'urdu': 'ur',
  'ur': 'ur',
  'ur-pk': 'ur',
  // Spanish variants
  'spanish': 'es',
  'es': 'es',
  'es-es': 'es',
  'es-mx': 'es',
  // French variants
  'french': 'fr',
  'fr': 'fr',
  'fr-fr': 'fr',
  // German variants
  'german': 'de',
  'de': 'de',
  'de-de': 'de',
  // Italian variants
  'italian': 'it',
  'it': 'it',
  'it-it': 'it',
  // Japanese variants
  'japanese': 'ja',
  'ja': 'ja',
  'ja-jp': 'ja',
  // Chinese variants
  'chinese': 'zh',
  'zh': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  // Korean variants
  'korean': 'ko',
  'ko': 'ko',
  'ko-kr': 'ko',
};

/**
 * Normalize language code to Gamma API format
 * @param {string} language - Language input (can be "English", "english", "en", "EN", etc.)
 * @returns {string} Normalized language code (defaults to "en")
 */
export function normalizeLanguage(language) {
  if (!language || typeof language !== 'string') {
    return 'en';
  }

  const normalized = language.toLowerCase().trim();
  
  // Check direct mapping first
  if (LANGUAGE_MAP[normalized]) {
    return LANGUAGE_MAP[normalized];
  }
  
  // Extract base language code (e.g., 'en' from 'en-US')
  const baseCode = normalized.split('-')[0].split('_')[0];
  
  // Check if base code exists in map
  if (LANGUAGE_MAP[baseCode]) {
    return LANGUAGE_MAP[baseCode];
  }
  
  // If base code is 2-3 characters, use it directly
  if (baseCode.length >= 2 && baseCode.length <= 3) {
    return baseCode;
  }
  
  // Default to English
  return 'en';
}

/**
 * Check if a language is RTL (Right-to-Left)
 * @param {string} language - Language code
 * @returns {boolean} True if language is RTL
 */
export function isRTL(language) {
  if (!language || typeof language !== 'string') {
    return false;
  }
  
  const normalized = normalizeLanguage(language);
  return RTL_LANGUAGES.includes(normalized.toLowerCase());
}

/**
 * Build language rules instruction text to inject into Gamma requests
 * This ensures Gamma generates content in the exact language without translation
 * @param {string} language - Language code
 * @returns {string} Language rules instruction text
 */
export function buildLanguageRules(language) {
  const normalizedLang = normalizeLanguage(language);
  const rtl = isRTL(language);
  const direction = rtl ? 'RIGHT-TO-LEFT' : 'LEFT-TO-RIGHT';
  
  return `IMPORTANT — LANGUAGE RULES:

1) Do NOT translate the text. Keep all content in the exact original language.

2) The presentation MUST be fully written in ${normalizedLang}.

3) If ${normalizedLang} is an RTL language, you MUST use ${direction} layout.

4) All elements (titles, bullets, paragraphs, tables) MUST follow the selected language direction.

5) Do NOT mix English words unless they are programming syntax or technical names.

6) The tone must stay educational and clear, suitable for teaching.`;
}

/**
 * Gamma API Client
 * Handles presentation generation using Gamma's REST API with text prompts
 */
export class GammaClient {
  constructor({ apiKey, storageClient }) {
    if (!apiKey) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[GammaClient] API key not provided. Gamma integration disabled.');
      } else {
        console.warn('[GammaClient] API key not provided. Gamma integration disabled.');
      }
      this.enabled = false;
      return;
    }

    this.apiKey = apiKey;
    // Gamma Public API base URL
    this.baseUrl = process.env.GAMMA_API_URL || 'https://public-api.gamma.app';
    this.storageClient = storageClient; // SupabaseStorageClient for file uploads
    this.enabled = true;
  }

  /**
   * Check if Gamma client is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Generate a presentation using Gamma Public API with text prompt
   * Uses async job pattern: POST to create generation, then poll until completed
   * @param {string} inputText - Full text content for Gamma to generate presentation
   * @param {Object} options - Generation options
   * @param {string} options.topicName - Topic name for file naming
   * @param {string} options.language - Language code (e.g., 'en', 'he', 'ar')
   * @param {string} options.audience - Target audience (e.g., 'beginner developers', 'students')
   * @returns {Promise<Object>} Presentation data with storage info
   * @returns {string} presentationUrl - Public URL to view the presentation
   * @returns {string} storagePath - Storage path in Supabase
   * @returns {Object} rawResponse - Full response from Gamma API
   */
  async generatePresentation(inputText, options = {}) {
    if (!this.enabled) {
      throw new Error('Gamma client not enabled');
    }

    if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
      throw new Error('Input text is required for presentation generation');
    }

    const { topicName = 'presentation', language = 'en', audience = 'beginner developers' } = options;

    try {
      // Normalize language to Gamma's supported codes
      const normalizedLanguage = normalizeLanguage(language);
      const rtl = isRTL(language);
      
      logger.info('[GammaClient] Generating presentation with Gamma Public API', { 
        topicName, 
        language, 
        normalizedLanguage,
        isRTL: rtl,
        inputTextLength: inputText.length 
      });

      // Step 1: Build language rules instruction
      // CRITICAL: Inject language rules BEFORE the actual content to ensure Gamma follows them
      const languageRules = buildLanguageRules(language);
      
      // Step 2: Combine language rules with input text
      // Language rules must come FIRST to ensure Gamma processes them correctly
      const enhancedInputText = `${languageRules}

---

${inputText.trim()}`;

      // Step 3: POST to create generation job with correct payload structure
      // Gamma Public API v1.0 requires specific payload format
      // Build payload according to Gamma Public API v1.0 specification
      // MANDATORY: exportAs must be "pptx" to get PPTX download URL
      const payload = {
        inputText: enhancedInputText,
        textMode: 'generate',
        format: 'presentation',
        exportAs: 'pptx', // MANDATORY: Request PPTX export
        textOptions: {
          language: normalizedLanguage,
          amount: 'detailed',
          tone: 'professional',
        },
      };
      
      // Only add themeId if a valid theme is provided via environment variable
      // Gamma Public API may not support all themes, so we make it optional
      const themeId = process.env.GAMMA_THEME_ID;
      if (themeId && themeId.trim().length > 0) {
        payload.themeId = themeId.trim();
      }
      
      logger.info('[GammaClient] Sending payload to Gamma API', { 
        inputTextLength: payload.inputText.length,
        language: normalizedLanguage,
        isRTL: rtl,
        audience: payload.textOptions.audience
      });

      const createResponse = await axios.post(
        `${this.baseUrl}/v1.0/generations`,
        payload,
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Parse response to get generationId
      const createData = typeof createResponse.data === 'string' 
        ? JSON.parse(createResponse.data)
        : createResponse.data;
      
      const generationId = createData.generationId || createData.id;
      if (!generationId) {
        throw new Error('No generationId returned from Gamma API');
      }

      logger.info('[GammaClient] Generation job created', { generationId });

      // Step 2: Poll until generation is completed
      const result = await this._pollGenerationStatus(generationId, {
        maxAttempts: 60, // 60 attempts = 5 minutes max (5 second intervals)
        intervalMs: 5000, // Poll every 5 seconds
      });

      if (result.status !== 'completed') {
        throw new Error(`Generation failed with status: ${result.status}`);
      }

      // Step 3: Extract PPTX download URL from result and download to Supabase Storage
      // Gamma Public API v1.0 with exportAs: "pptx" returns:
      // Option 1: { exportUrl: "<temporary_download_url>" }
      // Option 2: { export: { pptx: "<temporary_download_url>" } }
      const resultData = result.result || result;
      logger.info('[GammaClient] Generation completed, extracting export URLs', { 
        resultKeys: Object.keys(resultData),
        hasExport: !!resultData.export,
        hasExportUrl: !!resultData.exportUrl,
        exportKeys: resultData.export ? Object.keys(resultData.export) : []
      });
      
      // Extract PPTX download URL - check both exportUrl (direct) and export.pptx (nested)
      // This is a TEMPORARY URL that expires - we MUST download immediately
      const pptxDownloadUrl = resultData.exportUrl || resultData.export?.pptx;
      const gammaUrl = resultData.gammaUrl; // For metadata only, NOT for storage
      
      if (!pptxDownloadUrl) {
        logger.error('[GammaClient] No PPTX export URL found in Gamma response', { 
          resultData: JSON.stringify(resultData).substring(0, 500),
          availableKeys: Object.keys(resultData)
        });
        throw new Error('Gamma API did not return PPTX export URL. exportAs: "pptx" must be included in request payload.');
      }

      logger.info('[GammaClient] Found PPTX download URL, downloading immediately', { 
        pptxUrl: pptxDownloadUrl.substring(0, 100) + '...' // Log partial URL for debugging
      });

      let finalPresentationUrl = null;
      let storagePath = null;
      let sha256Hash = null;
      let digitalSignature = null;

      // MANDATORY: Download PPTX file immediately (URL expires)
      try {
        const pptxResponse = await axios.get(pptxDownloadUrl, {
          responseType: 'arraybuffer',
          timeout: 120000, // 2 minutes for large PPTX files
          maxContentLength: 100 * 1024 * 1024, // 100MB max
        });

        // Validate that we got a PPTX file (check content-type or file signature)
        const contentType = pptxResponse.headers['content-type'] || '';
        const isPptx = contentType.includes('pptx') || 
                      contentType.includes('presentation') ||
                      (pptxResponse.data && pptxResponse.data.length > 4 &&
                       pptxResponse.data[0] === 0x50 && pptxResponse.data[1] === 0x4B &&
                       pptxResponse.data[2] === 0x03 && pptxResponse.data[3] === 0x04); // ZIP/PPTX magic bytes: PK

        if (!isPptx) {
          logger.error('[GammaClient] Response from PPTX URL is not a PPTX file', { 
            contentType,
            firstBytes: pptxResponse.data ? Array.from(pptxResponse.data.slice(0, 10)) : null
          });
          throw new Error('Gamma API returned non-PPTX file from export.pptx URL');
        }

        const fileBuffer = Buffer.from(pptxResponse.data);
        const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        
        if (uploadResult.url && uploadResult.path) {
          finalPresentationUrl = uploadResult.url;
          storagePath = uploadResult.path;
          // Extract integrity data from upload result
          sha256Hash = uploadResult.sha256Hash || null;
          digitalSignature = uploadResult.digitalSignature || null;
          logger.info('[GammaClient] PPTX downloaded and uploaded to Supabase Storage successfully', { 
            storagePath, 
            url: finalPresentationUrl,
            fileSize: fileBuffer.length,
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            hasHash: !!sha256Hash,
            hasSignature: !!digitalSignature,
          });
        } else {
          throw new Error('PPTX uploaded but no URL or path returned from storage');
        }
      } catch (pptxDownloadError) {
        logger.error('[GammaClient] PPTX download from export.pptx failed', { 
          error: pptxDownloadError.message,
          status: pptxDownloadError.response?.status,
          pptxUrl: pptxDownloadUrl.substring(0, 100) + '...'
        });
        
        // CRITICAL: Do NOT create JSON fallback - throw error instead
        // JSON files are NOT presentations - we MUST have a real PPTX file
        throw new Error(`Failed to download presentation PPTX from Gamma API: ${pptxDownloadError.message}. PPTX download is mandatory.`);
      }

      // MANDATORY: We MUST have a real PPTX file - no JSON fallback allowed
      if (!finalPresentationUrl || !storagePath) {
        throw new Error('Failed to download and store presentation file. PPTX download from Gamma API is mandatory.');
      }

      // Ensure we're not returning a gammaUrl directly
      if (finalPresentationUrl.includes('gamma.app')) {
        logger.error('[GammaClient] CRITICAL: Returning gammaUrl instead of Supabase URL', { 
          finalPresentationUrl,
          storagePath 
        });
        throw new Error('Invalid presentation URL: External Gamma URL detected. All presentations must be stored in Supabase Storage.');
      }

      logger.info('[GammaClient] Presentation generated successfully', { 
        presentationUrl: finalPresentationUrl, 
        storagePath,
        generationId 
      });

      return {
        presentationUrl: finalPresentationUrl,
        storagePath,
        sha256Hash: sha256Hash,
        digitalSignature: digitalSignature,
        rawResponse: {
          generationId,
          status: result.status,
          result: resultData,
        },
      };
    } catch (error) {
      logger.error('[GammaClient] Failed to generate presentation', {
        error: error.message,
        response: error.response?.data ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)).substring(0, 500) : null,
        status: error.response?.status,
      });

      if (error.response) {
        const errorData = error.response.data 
          ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)).substring(0, 500)
          : 'Unknown error';
        throw new Error(`Gamma API error: ${error.response.status} - ${errorData}`);
      }
      throw new Error(`Gamma API request failed: ${error.message}`);
    }
  }

  /**
   * Poll Gamma API for generation status until completed
   * @private
   * @param {string} generationId - Generation ID from POST response
   * @param {Object} options - Polling options
   * @param {number} options.maxAttempts - Maximum polling attempts
   * @param {number} options.intervalMs - Interval between polls in milliseconds
   * @returns {Promise<Object>} Generation result with status and result data
   */
  async _pollGenerationStatus(generationId, options = {}) {
    const { maxAttempts = 60, intervalMs = 5000 } = options;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/v1.0/generations/${generationId}`,
          {
            headers: {
              'X-API-KEY': this.apiKey,
            },
            timeout: 30000,
          }
        );

        const data = typeof response.data === 'string' 
          ? JSON.parse(response.data)
          : response.data;

        const status = data.status || data.state;

        logger.info('[GammaClient] Polling generation status', { 
          generationId, 
          status, 
          attempt: attempts + 1,
          hasResult: !!data.result,
          resultKeys: data.result ? Object.keys(data.result) : []
        });

        if (status === 'completed' || status === 'success') {
          // Log full result structure for debugging
          logger.info('[GammaClient] Generation completed', { 
            status,
            result: data.result,
            fullData: JSON.stringify(data).substring(0, 500)
          });
          return data;
        }

        if (status === 'failed' || status === 'error') {
          throw new Error(`Generation failed: ${data.error || data.message || 'Unknown error'}`);
        }

        // Status is pending or processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (error) {
        if (error.response?.status === 404) {
          // Generation not found yet, might be still initializing
          logger.warn('[GammaClient] Generation not found yet, retrying', { generationId, attempt: attempts + 1 });
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          attempts++;
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Generation timeout: exceeded ${maxAttempts} polling attempts`);
  }

  /**
   * Download deck file from Gamma
   * @private
   * @param {string} deckId - Gamma deck ID
   * @returns {Promise<Object|null>} File buffer and metadata or null
   */
  async _downloadDeckFile(deckId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/decks/${deckId}/export`,
        {
          headers: {
            'X-API-KEY': this.apiKey,  // Gamma Public API uses X-API-KEY header
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'application/pdf',
      };
    } catch (error) {
      logger.warn('[GammaClient] Failed to download deck file', { deckId, error: error.message });
      return null;
    }
  }

  /**
   * Upload presentation file to Supabase Storage
   * @private
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} topicName - Topic name for file naming
   * @param {string} language - Language code
   * @param {string} contentType - MIME type
   * @returns {Promise<Object>} Upload result with URL and path
   */
  async _uploadToStorage(fileBuffer, topicName, language, contentType = 'application/pdf') {
    if (!this.storageClient || !this.storageClient.isConfigured()) {
      throw new Error('Supabase Storage client not configured. Storage is mandatory for all presentations.');
    }

    try {
      // Generate file name with topicId if available (for better organization)
      const sanitizedTopicName = topicName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50)
        .toLowerCase();
      const timestamp = Date.now();
      // MANDATORY: Only PDF or PPTX files - NO JSON files allowed
      const extension = contentType.includes('pdf') ? 'pdf' : 'pptx';
      const fileName = `presentations/${sanitizedTopicName}_${timestamp}.${extension}`;

      // Upload to Supabase Storage
      const uploadResult = await this.storageClient.uploadFile(fileBuffer, fileName, contentType);

      if (!uploadResult.url || !uploadResult.path) {
        throw new Error('Storage upload succeeded but no URL or path returned');
      }

      logger.info('[GammaClient] Presentation uploaded to storage', { path: uploadResult.path, url: uploadResult.url });

      return {
        url: uploadResult.url,
        path: uploadResult.path,
      };
    } catch (error) {
      logger.error('[GammaClient] Failed to upload presentation to storage', { error: error.message, stack: error.stack });
      throw new Error(`Failed to upload presentation to storage: ${error.message}`);
    }
  }
}

/**
 * Convenience function to generate a presentation
 * @param {string} prompt - Text prompt for presentation
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Presentation data
 */
export async function generatePresentation(prompt, options = {}) {
  const apiKey = process.env.GAMMA_API;
  if (!apiKey) {
    throw new Error('GAMMA_API environment variable is required');
  }

  // Note: This convenience function doesn't have storageClient, so uploads will be skipped
  // For full functionality, use GammaClient instance with storageClient
  const client = new GammaClient({ apiKey, storageClient: null });
  return client.generatePresentation(prompt, options);
}
