import axios from 'axios';
import { logger } from '../logging/Logger.js';

/**
 * Language mapper for Gamma API
 * Maps various language inputs to Gamma's supported language codes
 */
const LANGUAGE_MAP = {
  // English variants
  'english': 'en',
  'en': 'en',
  'eng': 'en',
  // Hebrew variants
  'hebrew': 'he',
  'he': 'he',
  'heb': 'he',
  // Arabic variants
  'arabic': 'ar',
  'ar': 'ar',
  'ara': 'ar',
};

/**
 * Normalize language code to Gamma API format
 * @param {string} language - Language input (can be "English", "english", "en", "EN", etc.)
 * @returns {string} Normalized language code (defaults to "en")
 */
function normalizeLanguage(language) {
  if (!language || typeof language !== 'string') {
    return 'en';
  }

  const normalized = language.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || 'en';
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
      logger.info('[GammaClient] Generating presentation with Gamma Public API', { topicName, language, inputTextLength: inputText.length });

      // Step 1: POST to create generation job with correct payload structure
      // Gamma Public API v1.0 requires specific payload format
      // Normalize language to Gamma's supported codes
      const normalizedLanguage = normalizeLanguage(language);
      
      // Build payload according to Gamma Public API v1.0 specification
      // Note: themeId is optional - only include if valid theme exists
      const payload = {
        inputText: inputText.trim(),
        textMode: 'generate',
        format: 'presentation',
        numCards: 8,
        cardSplit: 'auto',
        additionalInstructions: 'Create an educational presentation for students.',
        textOptions: {
          amount: 'detailed',
          tone: 'educational',
          audience: audience || 'students',
          language: normalizedLanguage,
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

      // Step 3: Extract URLs from result and download PDF to Supabase Storage
      // Gamma Public API v1.0 returns: gammaUrl, pdfUrl (optional), viewUrl (optional)
      const resultData = result.result || result;
      logger.info('[GammaClient] Generation completed, extracting URLs', { resultKeys: Object.keys(resultData) });
      
      // Extract all possible URL fields from Gamma response
      const gammaUrl = resultData.gammaUrl;
      const pdfUrl = resultData.pdfUrl || resultData.fileUrl || resultData.exportUrl;
      const viewUrl = resultData.viewUrl || resultData.url || resultData.presentationUrl;
      
      logger.info('[GammaClient] Extracted URLs from Gamma', { gammaUrl, pdfUrl, viewUrl });

      let finalPresentationUrl = null;
      let storagePath = null;

      // Priority 1: Try to download PDF from direct pdfUrl if available
      if (pdfUrl) {
        try {
          logger.info('[GammaClient] Downloading PDF from Gamma pdfUrl', { pdfUrl });
          const pdfResponse = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
          });

          const fileBuffer = Buffer.from(pdfResponse.data);
          const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language, 'application/pdf');
          
          if (uploadResult.url) {
            finalPresentationUrl = uploadResult.url;
            storagePath = uploadResult.path;
            logger.info('[GammaClient] PDF uploaded to Supabase Storage', { storagePath, url: finalPresentationUrl });
          }
        } catch (downloadError) {
          logger.warn('[GammaClient] Failed to download PDF from pdfUrl, trying generationId endpoint', { error: downloadError.message });
        }
      }

      // Priority 2: Try to download PDF using generationId endpoint (primary method)
      // This is the recommended way to get PDF from Gamma Public API
      if (!finalPresentationUrl && result.generationId) {
        try {
          logger.info('[GammaClient] Attempting to download PDF using generationId endpoint', { generationId: result.generationId });
          const pdfResponse = await axios.get(
            `${this.baseUrl}/v1.0/generations/${result.generationId}/pdf`,
            {
              headers: {
                'X-API-KEY': this.apiKey,
              },
              responseType: 'arraybuffer',
              timeout: 60000,
            }
          );

          const fileBuffer = Buffer.from(pdfResponse.data);
          const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language, 'application/pdf');
          
          if (uploadResult.url) {
            finalPresentationUrl = uploadResult.url;
            storagePath = uploadResult.path;
            logger.info('[GammaClient] PDF downloaded and uploaded to Supabase Storage successfully', { storagePath, url: finalPresentationUrl });
          } else {
            logger.warn('[GammaClient] PDF uploaded but no URL returned from storage');
          }
        } catch (pdfDownloadError) {
          logger.error('[GammaClient] PDF download via generationId endpoint failed', { 
            error: pdfDownloadError.message,
            status: pdfDownloadError.response?.status,
            data: pdfDownloadError.response?.data ? Buffer.from(pdfDownloadError.response.data).toString('utf-8').substring(0, 200) : null
          });
        }
      }

      // MANDATORY: We MUST store the presentation in Supabase Storage
      // If PDF download failed, create a JSON fallback file with gammaUrl
      if (!finalPresentationUrl || !storagePath) {
        logger.warn('[GammaClient] PDF download failed, creating JSON fallback with gammaUrl', { 
          generationId: result.generationId,
          gammaUrl 
        });
        
        // Create JSON fallback file containing gammaUrl
        const fallbackData = {
          gammaUrl: gammaUrl || viewUrl,
          generationId: result.generationId,
          status: 'completed',
          note: 'PDF download not available, storing gammaUrl as fallback',
        };
        
        const jsonBuffer = Buffer.from(JSON.stringify(fallbackData, null, 2), 'utf-8');
        const uploadResult = await this._uploadToStorage(jsonBuffer, topicName, language, 'application/json');
        
        if (!uploadResult.url || !uploadResult.path) {
          throw new Error('Failed to upload presentation to Supabase Storage. Storage is required for all presentations.');
        }
        
        finalPresentationUrl = uploadResult.url;
        storagePath = uploadResult.path;
        logger.info('[GammaClient] Created JSON fallback and uploaded to Supabase Storage', { 
          storagePath,
          url: finalPresentationUrl 
        });
      }

      // Final validation: We MUST have a Supabase Storage URL
      if (!finalPresentationUrl || !storagePath) {
        throw new Error('Failed to store presentation in Supabase Storage. This is mandatory - external URLs are not allowed.');
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
      const extension = contentType.includes('json') ? 'json' : (contentType.includes('pdf') ? 'pdf' : 'pptx');
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
