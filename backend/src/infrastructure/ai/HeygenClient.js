import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { getVoiceIdForLanguage } from './heygenVoicesConfig.js';
import { getAvatarId } from './heygenAvatarConfig.js';

/**
 * Heygen API Client
 * Generates avatar videos using Heygen API v2
 * 
 * IMPORTANT: This client uses HeyGen API v2 format:
 * - title
 * - prompt (trainer's exact text, unmodified)
 * - video_inputs with character (avatar_id) and voice (voice_id, input_text)
 * 
 * Voice ID is automatically selected from config based on language
 */
export class HeygenClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      console.warn('[HeygenClient] API key not provided - avatar video generation will be disabled');
      this.client = null;
      this.avatarId = null;
      this.avatarValidated = false;
      return;
    }

    this.apiKey = apiKey;
    this.baseURL = 'https://api.heygen.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Load avatar ID from config
    this.avatarId = getAvatarId();
    this.avatarValidated = false;

    // Validate avatar on startup (async, non-blocking)
    this.validateAvatar().catch(error => {
      console.error('[HeygenClient] Failed to validate avatar on startup:', error.message);
    });
  }

  /**
   * Validate that configured avatar exists in HeyGen API
   * Called once on startup to ensure avatar is available
   * @returns {Promise<boolean>} True if avatar is valid, false otherwise
   */
  async validateAvatar() {
    if (!this.client || !this.avatarId) {
      this.avatarValidated = false;
      return false;
    }

    try {
      // Try multiple endpoints for avatar validation
      const endpoints = ['/v1/avatar.list', '/v1/avatars', '/v2/avatars', '/v2/avatar.list'];
      let avatars = [];
      let validationSucceeded = false;

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint);
          
          // Handle different response structures
          if (response.data?.data?.avatars) {
            avatars = response.data.data.avatars;
          } else if (response.data?.data) {
            avatars = Array.isArray(response.data.data) ? response.data.data : [];
          } else if (response.data?.avatars) {
            avatars = response.data.avatars;
          } else if (Array.isArray(response.data)) {
            avatars = response.data;
          }

          if (avatars.length > 0) {
            validationSucceeded = true;
            break; // Found avatars, exit loop
          }
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }

      // If we couldn't fetch avatars list (403 or other errors), skip validation
      // This allows manual avatar configuration to work
      if (!validationSucceeded) {
        console.warn('[HeyGen] Could not fetch avatar list for validation (endpoint may be restricted). Proceeding with configured avatar.');
        // Mark as validated to allow generation to proceed
        // The actual API call will fail if avatar is invalid
        this.avatarValidated = true;
        return true;
      }

      // Check if configured avatar_id exists in the list
      const avatarExists = avatars.some(avatar => {
        const avatarId = avatar.avatar_id || avatar.id;
        return avatarId === this.avatarId;
      });

      if (!avatarExists) {
        console.warn(`[HeyGen] Configured avatar not found (${this.avatarId}), skipping avatar generation`);
        this.avatarValidated = false;
        return false;
      }

      this.avatarValidated = true;
      console.log(`[HeyGen] Avatar validated successfully: ${this.avatarId}`);
      return true;
    } catch (error) {
      console.warn('[HeyGen] Failed to validate avatar (API error):', error.message);
      // If validation fails due to 403 or other API restrictions, allow generation to proceed
      // The actual video generation will fail if avatar is invalid
      if (error.response?.status === 403) {
        console.warn('[HeyGen] Avatar list endpoint is restricted (403). Proceeding with configured avatar - validation will occur during video generation.');
        this.avatarValidated = true; // Allow to proceed
        return true;
      }
      // Don't fail completely - allow generation to proceed, but mark as unvalidated
      this.avatarValidated = false;
      return false;
    }
  }

  /**
   * Generate avatar video
   * 
   * ⚠️ CRITICAL: 
   * - Use endpoint: POST /v2/video/generate (HeyGen API v2)
   * - HeyGen V2 API requires: title, video_inputs with character (avatar_id) and voice (voice_id, input_text)
   * - Avatar ID is loaded from config/heygen-avatar.json
   * - Voice ID is automatically selected from config based on language parameter
   * 
   * @param {Object} payload - Request payload
   * @param {string} payload.title - Video title (default: 'EduCore Lesson')
   * @param {string} payload.prompt - Trainer's exact prompt (unmodified) - REQUIRED
   * @param {string} payload.language - Language code (e.g., 'en', 'ar', 'he', 'en-US') - REQUIRED
   * @param {number} payload.duration - Video duration in seconds (default: 15) - used for response only
   * @returns {Promise<Object>} Video data with URL
   */
  async generateVideo(payload) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    try {
      // Validate required fields
      if (!payload || typeof payload !== 'object') {
        console.error('[Avatar Generation Error] HeyGen rejected the request. Possible invalid parameters.');
        return {
          status: 'failed',
          videoId: null,
          error: 'Invalid payload provided',
          errorCode: 'INVALID_PAYLOAD',
          errorDetail: 'Payload must be an object with title and prompt',
        };
      }

      const { prompt, title } = payload;

      // Validate prompt (trainer's exact text) - REQUIRED
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.error('[Avatar Generation Error] HeyGen rejected the request. Possible invalid parameters.');
        return {
          status: 'failed',
          videoId: null,
          error: 'Prompt is required',
          errorCode: 'INVALID_PROMPT',
          errorDetail: 'The prompt must be a non-empty string',
        };
      }

      // Check if avatar is available - fail immediately without calling HeyGen API
      if (!this.avatarId) {
        console.error('[Avatar Generation Error] Avatar ID not configured');
        return {
          status: 'failed',
          videoId: null,
          error: 'NO_AVAILABLE_AVATAR',
          errorCode: 'NO_AVAILABLE_AVATAR',
          errorDetail: 'Avatar ID not configured. Please run fetch-heygen-avatar.js script.',
        };
      }

      // Check if avatar was validated and found to be invalid
      // If validation hasn't run yet, we'll proceed (validation is async)
      // But if it ran and explicitly failed (not just unvalidated), we should not proceed
      // Note: If validation couldn't run due to 403, avatarValidated will be true (allowing generation)
      if (this.avatarValidated === false && this.avatarId) {
        // Re-validate synchronously if not yet validated
        const isValid = await this.validateAvatar();
        if (!isValid && this.avatarValidated === false) {
          // Only fail if validation explicitly failed (avatar not found)
          // If validation couldn't run (403), avatarValidated will be true
          return {
            status: 'failed',
            videoId: null,
            error: 'NO_AVAILABLE_AVATAR',
            errorCode: 'NO_AVAILABLE_AVATAR',
            errorDetail: `Configured avatar (${this.avatarId}) not found in HeyGen API`,
          };
        }
      }

      // Get language from payload (required)
      const language = payload.language || 'en';
      
      // Get voice ID for language
      const voiceId = getVoiceIdForLanguage(language);

      // Check if voice ID is available - fail immediately without calling HeyGen API
      if (!voiceId) {
        console.error('[Avatar Generation Error] Voice ID not found for language:', language);
        return {
          status: 'failed',
          videoId: null,
          error: 'HEYGEN_VOICE_NOT_FOUND',
          errorCode: 'HEYGEN_VOICE_NOT_FOUND',
          errorDetail: `No voice ID configured for language: ${language}`,
        };
      }

      // Build v2 API request payload
      const requestPayload = {
        title: title || 'EduCore Lesson',
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: this.avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: prompt.trim(), // Trainer's exact text, unmodified
              voice_id: voiceId,
              speed: 1.0,
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      // Log request payload for debugging
      console.log('[Avatar Generation] Sending request to HeyGen:', JSON.stringify(requestPayload, null, 2));

      // Create video generation request
      // ⚠️ CRITICAL: Use /v2/video/generate endpoint (HeyGen API v2)
      let response;
      try {
        response = await this.client.post('/v2/video/generate', requestPayload);
      } catch (error) {
        // Extract detailed error information from HeyGen response
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        const errorDetails = error.response?.data || {};
        
        console.error('[Avatar Generation Error] HeyGen API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: errorMessage,
          details: errorDetails,
          requestPayload: requestPayload,
        });

        return {
          status: 'failed',
          videoId: null,
          error: errorMessage,
          errorCode: error.response?.status === 400 ? 'INVALID_REQUEST' : 'API_ERROR',
          errorDetail: JSON.stringify(errorDetails),
        };
      }

      // Extract video_id from v2 API response
      const videoId = response.data?.data?.video_id || response.data?.video_id;
      if (!videoId) {
        console.error('[Avatar Generation Error] HeyGen did not return video_id:', JSON.stringify(response.data, null, 2));
        return {
          status: 'failed',
          videoId: null,
          error: 'HeyGen did not return a video_id',
          errorCode: 'MISSING_VIDEO_ID',
          errorDetail: JSON.stringify(response.data),
        };
      }

      // Poll for video completion
      let pollResult;
      const duration = payload.duration || 15; // Use from payload or default
      try {
        pollResult = await this.pollVideoStatus(
          videoId,
          120, // maxAttempts
          5000, // interval
        );
      } catch (pollError) {
        if (pollError.status === 'failed' || (pollError.message && pollError.message.includes('Video generation failed'))) {
          return {
            status: 'failed',
            videoId,
            error: pollError.errorMessage || pollError.message,
            errorCode: pollError.errorCode || 'UNKNOWN_ERROR',
            errorDetail: pollError.errorDetail || pollError.message,
          };
        }

        // Timeout - return fallback URL
        const fallbackUrl = pollError.videoUrl || `https://app.heygen.com/share/${videoId}`;
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: fallbackUrl,
          videoId,
          duration: duration || 15,
          status: pollError.status || 'processing',
          fallback: true,
        };
      }

      const heygenVideoUrl = pollResult.videoUrl;

      // Download and upload to Supabase Storage
      try {
        const videoBuffer = await this.downloadVideo(heygenVideoUrl);
        let storageUrl = null;

        try {
          const uploadedUrl = await this.uploadToStorage({
            fileBuffer: videoBuffer,
            fileName: `avatar_${videoId}.mp4`,
            contentType: 'video/mp4',
          });
          if (uploadedUrl) {
            storageUrl = uploadedUrl;
          } else {
            storageUrl = heygenVideoUrl;
          }
        } catch (uploadErr) {
          storageUrl = heygenVideoUrl;
        }

        if (!storageUrl) {
          storageUrl = heygenVideoUrl;
        }

        return {
          videoUrl: storageUrl,
          heygenVideoUrl: heygenVideoUrl,
          videoId,
          duration: duration || 15,
          status: 'completed',
          fallback: storageUrl === heygenVideoUrl,
        };
      } catch (downloadErr) {
        const fallbackUrl = `https://app.heygen.com/share/${videoId}`;
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: heygenVideoUrl,
          videoId,
          duration: duration || 15,
          status: 'processing',
          fallback: true,
          error: downloadErr.message,
        };
      }

    } catch (error) {
      // Extract detailed error information from HeyGen response
      const errorStatus = error.response?.status || error.status || 500;
      const errorData = error.response?.data || {};
      const errorMessage = errorData.message || errorData.error_message || error.message || 'Video generation failed';
      
      console.error('[Avatar Generation Error] HeyGen API error details:', {
        status: errorStatus,
        statusText: error.response?.statusText || 'Unknown',
        errorMessage: errorMessage,
        errorData: JSON.stringify(errorData, null, 2),
        requestURL: `${this.baseURL}/v2/video/generate`,
        requestPayload: requestPayload || payload || 'Not available',
      });

      return {
        status: 'failed',
        videoId: null,
        error: errorMessage,
        errorCode: errorData.error_code || errorData.code || (errorStatus === 400 ? 'INVALID_REQUEST' : 'API_ERROR'),
        errorDetail: JSON.stringify(errorData),
      };
    }
  }

  /**
   * Poll video generation status
   * @param {string} videoId - Video ID from Heygen
   * @returns {Promise<{status: string, videoUrl: string}>} Video status data
   */
  async pollVideoStatus(videoId, maxAttempts = 60, interval = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // ⚠️ CRITICAL: Use /v1/video_status.get (with underscore, NOT hyphen)
        const response = await this.client.get(`/v1/video_status.get?video_id=${videoId}`);
        const status = response.data.data.status;

        if (status === 'completed') {
          const videoUrl = response.data.data.video_url;
          return { status, videoUrl };
        } else if (status === 'failed') {
          const errorData = response.data.data || {};
          const errorMessage = errorData.error_message || errorData.error || 'Video generation failed';
          const errorCode = errorData.error_code || 'UNKNOWN_ERROR';
          const errorDetail = errorData.error_detail || errorMessage;
          
          return {
            status: 'failed',
            videoUrl: null,
            errorMessage,
            errorCode,
            errorDetail,
          };
        }

        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        if (error.status === 'failed' || (error.message && error.message.includes('Video generation failed'))) {
          throw error;
        }
        
        if (attempt === maxAttempts - 1) {
          const timeoutError = new Error(`Video ${videoId} not ready after polling`);
          timeoutError.status = 'processing';
          timeoutError.videoUrl = `https://app.heygen.com/share/${videoId}`;
          throw timeoutError;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    const timeoutError = new Error(`Video ${videoId} not ready after polling`);
    timeoutError.status = 'processing';
    timeoutError.videoUrl = `https://app.heygen.com/share/${videoId}`;
    throw timeoutError;
  }

  /**
   * Upload video to Supabase Storage
   * @param {Object} params
   * @param {Buffer} params.fileBuffer - Binary video buffer
   * @param {string} params.fileName - File name for storage
   * @param {string} params.contentType - MIME type
   * @returns {Promise<string>} Supabase storage path
   */
  async uploadToStorage({ fileBuffer, fileName, contentType = 'video/mp4' }) {
    try {
      if (!fileBuffer || !(fileBuffer instanceof Buffer) || fileBuffer.length === 0) {
        throw new Error('Invalid video buffer received for upload');
      }

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const filePath = `avatar_videos/${fileName}`;
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );

      const { data, error } = await supabase.storage.from('media').upload(
        filePath,
        arrayBuffer,
        {
          contentType,
          cacheControl: '3600',
          upsert: true,
        },
      );

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      
      if (!publicUrl) {
        throw new Error('Failed to get public URL from Supabase storage');
      }

      return publicUrl;
    } catch (error) {
      throw new Error(`Failed to upload video to storage: ${error.message}`);
    }
  }

  /**
   * Download video from URL
   * @param {string} videoUrl - Video URL
   * @returns {Promise<Buffer>} Video buffer
   */
  async downloadVideo(videoUrl) {
    try {
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('video')) {
        throw new Error(`Unexpected content type received: ${contentType || 'unknown'}`);
      }
      const buffer = Buffer.from(response.data);
      if (!buffer || buffer.length === 0) {
        throw new Error('Downloaded video buffer is empty');
      }
      return buffer;
    } catch (error) {
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }
}
