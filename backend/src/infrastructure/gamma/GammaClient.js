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
    this.baseUrl = process.env.GAMMA_API_URL || 'https://api.gamma.app';
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
   * Generate a presentation using Gamma API with text prompt
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

      // Build request payload with text prompt
      const payload = {
        prompt: prompt.trim(),
        options: {
          language: language,
        },
      };

      // Make API request to Gamma
      // Gamma API endpoint: /v2/generate (correct endpoint for slide generation)
      const response = await axios.post(
        `${this.baseUrl}/v2/generate`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 120 seconds timeout (presentations can take longer)
          responseType: 'arraybuffer', // Handle both JSON and file responses
        }
      );

      // Handle response - could be JSON with URLs or a file
      let presentationUrl = null;
      let storagePath = null;
      let rawResponse = null;

      const contentType = response.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        // JSON response with URLs
        const jsonData = JSON.parse(Buffer.from(response.data).toString('utf-8'));
        rawResponse = jsonData;
        
        presentationUrl = jsonData.url || jsonData.presentationUrl || jsonData.viewUrl;
        const deckId = jsonData.id || jsonData.deckId;

        if (!presentationUrl) {
          logger.warn('[GammaClient] Gamma returned JSON but no URL, attempting to download file');
          // If no URL, try to download the deck as a file
          if (deckId) {
            const fileResponse = await this._downloadDeckFile(deckId);
            if (fileResponse) {
              const uploadResult = await this._uploadToStorage(fileResponse.buffer, topicName, language);
              presentationUrl = uploadResult.url;
              storagePath = uploadResult.path;
            }
          }
        } else {
          // Store the URL in metadata, but also try to download and store the file
          logger.info('[GammaClient] Gamma returned URL, storing reference', { presentationUrl });
          // For now, we'll use the URL directly, but could download and store for backup
        }
      } else if (contentType.includes('application/pdf') || contentType.includes('application/vnd')) {
        // File response (PDF or presentation file)
        logger.info('[GammaClient] Gamma returned file, uploading to storage');
        const fileBuffer = Buffer.from(response.data);
        const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language, contentType);
        presentationUrl = uploadResult.url;
        storagePath = uploadResult.path;
        rawResponse = { type: 'file', contentType, size: fileBuffer.length };
      } else {
        // Try to parse as JSON first, then handle as file
        try {
          const jsonData = JSON.parse(Buffer.from(response.data).toString('utf-8'));
          rawResponse = jsonData;
          presentationUrl = jsonData.url || jsonData.presentationUrl || jsonData.viewUrl;
          
          if (!presentationUrl) {
            throw new Error('No URL found in response');
          }
        } catch (parseError) {
          // Not JSON, treat as file
          logger.info('[GammaClient] Response is not JSON, treating as file');
          const fileBuffer = Buffer.from(response.data);
          const uploadResult = await this._uploadToStorage(fileBuffer, topicName, language);
          presentationUrl = uploadResult.url;
          storagePath = uploadResult.path;
          rawResponse = { type: 'file', size: fileBuffer.length };
        }
      }

      if (!presentationUrl) {
        logger.error('[GammaClient] Failed to extract presentation URL or upload file', { response: rawResponse });
        throw new Error('Failed to get presentation URL or upload file from Gamma response');
      }

      logger.info('[GammaClient] Presentation generated successfully', { presentationUrl, storagePath });

      return {
        presentationUrl,
        storagePath,
        rawResponse,
      };
    } catch (error) {
      logger.error('[GammaClient] Failed to generate presentation', {
        error: error.message,
        response: error.response?.data ? Buffer.from(error.response.data).toString('utf-8').substring(0, 500) : null,
        status: error.response?.status,
      });

      if (error.response) {
        const errorData = error.response.data 
          ? Buffer.from(error.response.data).toString('utf-8').substring(0, 500)
          : 'Unknown error';
        throw new Error(`Gamma API error: ${error.response.status} - ${errorData}`);
      }
      throw new Error(`Gamma API request failed: ${error.message}`);
    }
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
            'Authorization': `Bearer ${this.apiKey}`,
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
