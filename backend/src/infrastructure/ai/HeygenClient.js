import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { getSafeAvatarId, getVoiceConfig } from '../../config/heygen.js';

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

    // Load avatar ID from config (with fallback to default)
    this.avatarId = getSafeAvatarId();
    this.avatarValidated = false;

    // Validate avatar on startup (async, non-blocking)
    // Skip validation for anna-public (no longer available)
    if (this.avatarId && this.avatarId !== 'anna-public') {
      this.validateAvatar().catch(error => {
        console.error('[HeygenClient] Failed to validate avatar on startup:', error.message);
      });
    } else if (this.avatarId === 'anna-public') {
      console.log('[HeyGen] Skipping startup validation for anna-public (no longer available)');
    }
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

    // Skip validation for anna-public (no longer available)
    if (this.avatarId === 'anna-public') {
      console.log('[HeyGen] Skipping validation for anna-public (no longer available)');
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

      // If avatar not found, mark as invalid (will skip generation)
      if (!avatarExists) {
        console.log(`[HeyGen] Avatar not found: ${this.avatarId} — skipping video generation`);
        this.avatarValidated = false;
        return false;
      }

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
   * Find a fallback avatar when configured avatar is not available
   * Selects a female, natural/neutral/professional, public avatar
   * @returns {Promise<string|null>} Fallback avatar ID or null if none found
   */
  async findFallbackAvatar() {
    if (!this.client) {
      return null;
    }

    try {
      // Try multiple endpoints for avatar listing
      const endpoints = ['/v1/avatar.list', '/v1/avatars', '/v2/avatars', '/v2/avatar.list'];
      let avatars = [];

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
            break; // Found avatars, exit loop
          }
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }

      if (avatars.length === 0) {
        console.warn('[HeyGen] No avatars found in API response');
        return null;
      }

      // Filter and score avatars: female/neutral, professional/natural, public
      const scoredAvatars = avatars
        .map(avatar => {
          const avatarId = avatar.avatar_id || avatar.id;
          const name = avatar.name || avatar.avatar_name || '';
          const gender = (avatar.gender || '').toLowerCase();
          const style = (avatar.style || avatar.avatar_style || '').toLowerCase();
          const categories = (avatar.categories || []).map(c => c.toLowerCase());
          const isPublic = avatar.is_public !== false && avatar.public !== false;

          if (!isPublic) return null;

          let score = 0;
          
          // Score by style: professional/neutral/natural
          if (style.includes('professional') || style.includes('neutral') || style.includes('natural')) {
            score += 20;
          }
          
          // Score by gender: female or neutral
          if (gender === 'female' || gender === 'neutral') {
            score += 10;
          }
          
          // Penalize unwanted categories
          const unwantedCategories = ['child', 'cartoon', 'fantasy', 'robot', 'dramatic', 'character'];
          if (categories.some(cat => unwantedCategories.some(unwanted => cat.includes(unwanted)))) {
            score -= 100;
          }
          
          // Penalize if name contains unwanted keywords
          const nameLower = name.toLowerCase();
          if (unwantedCategories.some(unwanted => nameLower.includes(unwanted))) {
            score -= 100;
          }

          return { avatarId, name, score };
        })
        .filter(avatar => avatar !== null && avatar.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scoredAvatars.length === 0) {
        console.warn('[HeyGen] No suitable fallback avatar found');
        return null;
      }

      const selectedAvatar = scoredAvatars[0];
      console.log(`[HeyGen] Selected fallback avatar: ${selectedAvatar.name} (${selectedAvatar.avatarId}) with score: ${selectedAvatar.score}`);
      return selectedAvatar.avatarId;
    } catch (error) {
      console.warn('[HeyGen] Failed to find fallback avatar:', error.message);
      return null;
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

      // Check if avatar is available
      if (!this.avatarId) {
        console.log('[HeyGen] Skipping avatar generation - reason: Avatar ID not configured');
        return {
          status: 'skipped',
          videoId: null,
          videoUrl: null,
          reason: 'forced_avatar_unavailable',
        };
      }

      // If anna-public is configured but not available, try to find a fallback avatar
      if (this.avatarId === 'anna-public') {
        console.log('[HeyGen] Avatar anna-public is no longer available. Attempting to find a fallback avatar...');
        
        // Try to validate and find an alternative avatar
        try {
          const fallbackAvatar = await this.findFallbackAvatar();
          if (fallbackAvatar) {
            console.log(`[HeyGen] Using fallback avatar: ${fallbackAvatar}`);
            this.avatarId = fallbackAvatar;
            // Continue with fallback avatar
          } else {
            console.log('[HeyGen] No fallback avatar found, skipping video generation.');
            return {
              status: 'skipped',
              videoId: null,
              videoUrl: null,
              reason: 'avatar_no_longer_available',
            };
          }
        } catch (error) {
          console.log('[HeyGen] Could not find fallback avatar, skipping video generation:', error.message);
          return {
            status: 'skipped',
            videoId: null,
            videoUrl: null,
            reason: 'avatar_no_longer_available',
          };
        }
      }

      // Note: anna-public is now skipped earlier in the flow, so we don't need special handling here
      if (this.avatarId && this.avatarId !== 'anna-public') {
        // Check if avatar was validated and found to be invalid
        // If validation hasn't run yet, we'll proceed (validation is async)
        // But if it ran and explicitly failed (not just unvalidated), we should not proceed
        // Note: If validation couldn't run due to 403, avatarValidated will be true (allowing generation)
        // IMPORTANT: If API is restricted (403), we allow generation to proceed and let HeyGen API validate
        if (this.avatarValidated === false && this.avatarId) {
          // Re-validate synchronously if not yet validated
          const isValid = await this.validateAvatar();
          // Only fail if validation explicitly failed (avatar not found in list)
          // If validation couldn't run (403), avatarValidated will be true, so we proceed
          if (!isValid && this.avatarValidated === false) {
            // Validation explicitly failed - avatar not in list
            return {
              status: 'failed',
              videoId: null,
              error: 'NO_AVAILABLE_AVATAR',
              errorCode: 'NO_AVAILABLE_AVATAR',
              errorDetail: `Configured avatar (${this.avatarId}) not found in HeyGen API. Please update config/heygen-avatar.json with a valid avatar ID. Contact HeyGen support for available public avatar IDs.`,
            };
          }
          // If validation couldn't run (403), avatarValidated is now true, so we proceed to API call
        }
      }

      // Get language from payload (required)
      const language = payload.language || 'en';
      
      // Get voice configuration (with fallback to default lecturer)
      const voiceConfig = getVoiceConfig(language);
      const voiceId = voiceConfig.voice_id;

      // Validate avatar and voice before sending request
      // Note: anna-public check is already done earlier, so we don't need to check again here
      if (!this.avatarId) {
        console.log('[HeyGen] Skipping avatar generation - reason: Avatar ID not configured');
        return {
          status: 'skipped',
          videoId: null,
          videoUrl: null,
          reason: 'avatar_not_configured',
        };
      }

      if (!voiceId) {
        console.log('[HeyGen] Skipping avatar generation - reason: Voice ID not available');
        return {
          status: 'skipped',
          videoId: null,
          videoUrl: null,
          reason: 'voice_not_available',
        };
      }

      // Build v2 API request payload (matching HeyGen v2 format)
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
              input_text: prompt.trim(), // Trainer's exact text, unmodified - no translation
              voice_id: voiceId,
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
        
        // Check if error is avatar_not_found or 403 Forbidden
        const isAvatarNotFound = 
          errorMessage.toLowerCase().includes('avatar') && 
          (errorMessage.toLowerCase().includes('not found') || 
           errorMessage.toLowerCase().includes('invalid') ||
           error.response?.status === 404);
        
        const isForbidden = error.response?.status === 403;
        
        // Handle avatar not found - skip gracefully (especially for forced avatar Anna)
        if (isAvatarNotFound || isForbidden) {
          const errorMsg = error.response?.data?.error?.message || errorMessage;
          console.log(`[HeyGen] Avatar not found: ${this.avatarId} — skipping video generation. Error: ${errorMsg}`);
          return {
            status: 'skipped',
            videoId: null,
            videoUrl: null,
            reason: 'avatar_not_found',
          };
        }
        
        console.error('[Avatar Generation Error] HeyGen API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: errorMessage,
          details: errorDetails,
          requestPayload: requestPayload,
        });

        // Avatar not found already handled above - this handles other API errors
        // Return generic error for other API failures (but don't crash)
        console.error('[HeyGen] API error (non-avatar):', errorMessage);

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
      
      console.log('[HeyGen] Video generation completed, starting download and storage upload', {
        videoId,
        heygenVideoUrl,
        isShareUrl: heygenVideoUrl?.includes('/share/'),
        pollResult,
      });

      // Validate that we have a video URL
      if (!heygenVideoUrl) {
        console.error('[HeyGen] No video URL returned from poll - cannot download', {
          videoId,
          pollResult,
        });
        const fallbackUrl = `https://app.heygen.com/share/${videoId}`;
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: fallbackUrl,
          videoId,
          duration: duration || 15,
          status: 'processing',
          fallback: true,
          error: 'No video URL returned from HeyGen API',
        };
      }

      // Download and upload to Supabase Storage
      console.log(`[HeyGen] Downloading video from Heygen...`);
      try {
        const videoBuffer = await this.downloadVideo(heygenVideoUrl);
        console.log(`[HeyGen] Video downloaded (${videoBuffer.length} bytes)`);
        console.log(`[HeyGen] Uploading to Supabase Storage...`);
        let storageUrl = null; // Start with null, not Heygen URL

        try {
          const uploadedUrl = await this.uploadToStorage({
            fileBuffer: videoBuffer,
            fileName: `avatar_${videoId}.mp4`,
            contentType: 'video/mp4',
          });
          if (uploadedUrl) {
            storageUrl = uploadedUrl;
            console.log(`[HeyGen] Video uploaded to Supabase Storage: ${storageUrl}`);
          } else {
            console.warn('[HeyGen] uploadToStorage returned null, using Heygen URL as fallback');
            storageUrl = heygenVideoUrl;
          }
        } catch (uploadErr) {
          console.warn('[HeyGen] Upload to Supabase failed, using Heygen URL as fallback:', uploadErr.message);
          storageUrl = heygenVideoUrl; // Fallback to Heygen URL only if upload fails
        }

        // Ensure we always return a valid URL
        if (!storageUrl) {
          console.warn('[HeyGen] No storage URL available, using Heygen URL as final fallback');
          storageUrl = heygenVideoUrl;
        }

        console.log(`[HeyGen] Returning video URL: ${storageUrl} (${storageUrl.startsWith('http') ? 'Full URL' : 'Path'})`);
        return {
          videoUrl: storageUrl, // This should be Supabase public URL if upload succeeded, otherwise Heygen URL
          heygenVideoUrl: heygenVideoUrl, // Always keep original Heygen URL for reference
          videoId,
          duration: duration || 15,
          status: 'completed',
          fallback: storageUrl === heygenVideoUrl, // Mark as fallback if we're using Heygen URL
        };
      } catch (downloadErr) {
        console.error('[HeyGen] Failed to download or upload video', {
          error: downloadErr.message,
          stack: downloadErr.stack,
          heygenVideoUrl,
        });
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
        const responseData = response.data?.data || {};
        const status = responseData.status;

        if (status === 'completed') {
          // Log all available fields to understand the response structure
          console.log('[HeyGen] Video status completed - checking for video URL', {
            videoId,
            attempt: attempt + 1,
            allFields: Object.keys(responseData),
            video_url: responseData.video_url,
            download_url: responseData.download_url,
            share_url: responseData.share_url,
            video_download_url: responseData.video_download_url,
            fullResponse: JSON.stringify(responseData, null, 2),
          });

          // Try multiple possible field names for the video URL
          const videoUrl = responseData.video_url 
            || responseData.download_url 
            || responseData.video_download_url
            || responseData.share_url
            || (responseData.video && responseData.video.url)
            || null;

          if (!videoUrl) {
            console.error('[HeyGen] No video URL found in completed response', {
              videoId,
              responseData,
            });
            // Fallback to share URL if no direct URL found
            const fallbackShareUrl = `https://app.heygen.com/share/${videoId}`;
            console.warn('[HeyGen] Using fallback share URL', { fallbackShareUrl });
            return { status, videoUrl: fallbackShareUrl, isFallback: true };
          }

          console.log('[HeyGen] Found video URL from poll response', {
            videoId,
            videoUrl,
            isShareUrl: videoUrl.includes('/share/'),
          });

          return { status, videoUrl, isFallback: videoUrl.includes('/share/') };
        } else if (status === 'failed') {
          const errorData = responseData || {};
          const errorMessage = errorData.error_message || errorData.error || 'Video generation failed';
          const errorCode = errorData.error_code || 'UNKNOWN_ERROR';
          const errorDetail = errorData.error_detail || errorMessage;
          
          console.error('[HeyGen] Video generation failed', {
            videoId,
            errorMessage,
            errorCode,
            errorDetail,
          });
          
          return {
            status: 'failed',
            videoUrl: null,
            errorMessage,
            errorCode,
            errorDetail,
          };
        }

        // Log progress for long-running polls
        if (attempt % 10 === 0) {
          console.log('[HeyGen] Polling video status', {
            videoId,
            attempt: attempt + 1,
            maxAttempts,
            status,
          });
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
        console.warn('[HeyGen] Supabase not configured, returning null');
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
        console.error('[HeyGen] Supabase upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      
      if (!publicUrl) {
        console.error('[HeyGen] Failed to get public URL from Supabase');
        throw new Error('Failed to get public URL from Supabase storage');
      }

      console.log(`[HeyGen] Video uploaded successfully to Supabase: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error('[HeyGen] Storage upload error:', error.message);
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
      console.error('[HeyGen] Download video error:', error.message);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }
}
