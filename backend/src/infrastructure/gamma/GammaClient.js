import axios from 'axios';
import { logger } from '../logging/Logger.js';

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
   * @param {string} prompt - Text prompt for Gamma to generate presentation
   * @param {Object} options - Generation options
   * @param {string} options.topicName - Topic name for file naming
   * @param {string} options.language - Language code
   * @returns {Promise<Object>} Presentation data with storage info
   * @returns {string} presentationUrl - Public URL to view the presentation
   * @returns {string} storagePath - Storage path in Supabase
   * @returns {Object} rawResponse - Full response from Gamma API
   */
  async generatePresentation(prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('Gamma client not enabled');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required for presentation generation');
    }

    const { topicName = 'presentation', language = 'en' } = options;

    try {
      logger.info('[GammaClient] Generating presentation with text prompt', { topicName, language, promptLength: prompt.length });

      // Step 1: POST to create generation job
      const payload = {
        inputText: prompt.trim(),
        textMode: 'generate', // Options: 'generate', 'condense', 'preserve'
      };

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

      // Step 3: Extract URLs from result
      const resultData = result.result || {};
      const presentationUrl = resultData.url || resultData.presentationUrl || resultData.viewUrl;
      const pdfUrl = resultData.pdfUrl || resultData.fileUrl || resultData.exportUrl;

      let finalPresentationUrl = presentationUrl;
      let storagePath = null;

      // Step 4: Download PDF if available and upload to Supabase
      if (pdfUrl) {
        try {
          logger.info('[GammaClient] Downloading PDF from Gamma', { pdfUrl });
          const pdfResponse = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
          });

          const fileBuffer = Buffer.from(pdfResponse.data);
          const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language, 'application/pdf');
          
          if (uploadResult.url) {
            finalPresentationUrl = uploadResult.url;
            storagePath = uploadResult.path;
            logger.info('[GammaClient] PDF uploaded to Supabase Storage', { storagePath });
          }
        } catch (downloadError) {
          logger.warn('[GammaClient] Failed to download PDF, using Gamma URL', { error: downloadError.message });
          // Fallback to Gamma URL if download fails
        }
      }

      // If no PDF URL but we have presentation URL, use it directly
      if (!finalPresentationUrl && presentationUrl) {
        finalPresentationUrl = presentationUrl;
      }

      if (!finalPresentationUrl) {
        throw new Error('No presentation URL or PDF URL found in Gamma response');
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

        logger.info('[GammaClient] Polling generation status', { generationId, status, attempt: attempts + 1 });

        if (status === 'completed' || status === 'success') {
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
      logger.warn('[GammaClient] Storage client not configured, skipping upload');
      return { url: null, path: null };
    }

    try {
      // Generate file name
      const sanitizedTopicName = topicName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50)
        .toLowerCase();
      const timestamp = Date.now();
      const extension = contentType.includes('pdf') ? 'pdf' : 'pptx';
      const fileName = `presentations/${language}/${sanitizedTopicName}_${timestamp}.${extension}`;

      // Upload to Supabase Storage
      const uploadResult = await this.storageClient.uploadFile(fileBuffer, fileName, contentType);

      logger.info('[GammaClient] Presentation uploaded to storage', { path: uploadResult.path, url: uploadResult.url });

      return {
        url: uploadResult.url,
        path: uploadResult.path,
      };
    } catch (error) {
      logger.error('[GammaClient] Failed to upload presentation to storage', { error: error.message });
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
