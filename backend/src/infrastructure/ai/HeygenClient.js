import axios from 'axios';
import { getSafeAvatarId, getVoiceConfig } from '../../config/heygen.js';
import { AvatarVideoStorageService } from '../storage/AvatarVideoStorageService.js';
import { logger } from '../logging/Logger.js';

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
      // Only log warning in non-test environments
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
      if (!isTestEnv) {
        logger.warn('[HeygenClient] API key not provided - avatar video generation will be disabled');
      }
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

    // Initialize storage service
    this.storageService = new AvatarVideoStorageService();

    // Load avatar ID from config (with fallback to default)
    this.avatarId = getSafeAvatarId();
    this.avatarValidated = false;

    // Validate avatar on startup (async, non-blocking)
    // Skip validation for anna-public (no longer available)
    // Skip validation in test environment
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
    if (!isTestEnv && this.avatarId && this.avatarId !== 'anna-public') {
      this.validateAvatar().catch(error => {
        // Only log error in non-test environments
        if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
          logger.error('[HeygenClient] Failed to validate avatar on startup:', { error: error.message });
        }
      });
    } else if (this.avatarId === 'anna-public') {
      if (!isTestEnv) {
        logger.info('[HeyGen] Skipping startup validation for anna-public (no longer available)');
      }
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
   * @param {string} payload.prompt - Trainer's exact prompt or OpenAI-generated explanation - REQUIRED
   * @param {string} payload.language - Language code (e.g., 'en', 'ar', 'he', 'en-US') - REQUIRED
   * @param {number} payload.duration - Video duration in seconds (default: 15, max: 900 for presentation videos)
   * @param {string} payload.presentation_file_url - Optional: URL to presentation file (PPTX/PDF) to use as background
   * @param {string} payload.avatar_id - Optional: Custom avatar ID (overrides default from config)
   * @param {boolean} payload.use_presentation_background - Optional: Whether to use presentation as background (default: false)
   * @returns {Promise<Object>} Video data with URL
   */
  async generateVideo(payload) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    // Define requestPayload outside try block so it's accessible in catch
    let requestPayload = null;

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

      // Get language from payload (needed for language preservation)
      const language = payload.language || 'en';
      
      // HeyGen has a limit of 900 seconds (15 minutes) per video for presentation-based videos
      // Approximate: ~10 characters per second of speech = ~9000 characters max
      // To be safe, we'll limit to 8000 characters (approximately 800 seconds)
      // For regular videos (without presentation), limit is 1500 characters (150 seconds)
      const MAX_PROMPT_LENGTH = payload.presentation_file_url ? 8000 : 1500;
      let finalPrompt = prompt.trim();
      let wasTruncated = false;

      if (finalPrompt.length > MAX_PROMPT_LENGTH) {
        console.warn('[HeyGen] Prompt is too long, truncating to prevent video generation failure', {
          originalLength: finalPrompt.length,
          maxLength: MAX_PROMPT_LENGTH,
        });
        // Truncate at word boundary to avoid cutting words
        const truncated = finalPrompt.substring(0, MAX_PROMPT_LENGTH);
        const lastSpace = truncated.lastIndexOf(' ');
        finalPrompt = lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
        wasTruncated = true;
        console.log('[HeyGen] Prompt truncated', {
          originalLength: prompt.length,
          truncatedLength: finalPrompt.length,
        });
      }

      // Note: We rely on the language field in voice object and voice_id selection
      // to ensure HeyGen speaks in the correct language
      // We do NOT add language instructions to the text itself, as HeyGen will read them aloud

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

      // Get voice configuration (with fallback to default lecturer)
      // Use the language from payload (already extracted above)
      const voiceConfig = getVoiceConfig(language);
      const voiceId = voiceConfig.voice_id;
      
      console.log('[HeyGen] Voice configuration selected', {
        language,
        voiceId,
        voiceLanguage: voiceConfig.language,
        source: voiceConfig.source,
      });

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
      // Map language code to HeyGen language format (e.g., 'he' -> 'he', 'ar' -> 'ar', 'en' -> 'en')
      const heygenLanguageMap = {
        'he': 'he',
        'ar': 'ar',
        'ru': 'ru',
        'es': 'es',
        'fr': 'fr',
        'de': 'de',
        'it': 'it',
        'ko': 'ko',
        'ja': 'ja',
        'zh': 'zh',
        'en': 'en',
      };
      const heygenLanguage = heygenLanguageMap[language] || language;

      // Use custom avatar_id if provided, otherwise use default
      const avatarId = payload.avatar_id || this.avatarId;
      
      // Check if we should use presentation as background
      const usePresentationBackground = payload.use_presentation_background || !!payload.presentation_file_url;
      
      requestPayload = {
        title: title || 'EduCore Lesson',
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: finalPrompt, // Use truncated prompt if needed
              voice_id: voiceId,
              language_code: heygenLanguage, // Explicitly set language code for HeyGen
            },
            // Add presentation as background if provided
            // HeyGen API v2 supports background media in video_inputs
            // The presentation will appear behind the avatar
            ...(usePresentationBackground && payload.presentation_file_url ? {
              background: {
                type: 'image',
                url: payload.presentation_file_url,
              },
            } : {}),
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      console.log('[HeyGen] Request payload with language and presentation', {
        language,
        heygenLanguage,
        voiceId,
        hasLanguageInVoice: !!requestPayload.video_inputs[0].voice.language_code,
        hasPresentationBackground: usePresentationBackground,
        presentationFileUrl: payload.presentation_file_url || 'none',
        avatarId: avatarId,
        promptLength: finalPrompt.length,
        maxPromptLength: MAX_PROMPT_LENGTH,
      });

      // Log request payload for debugging
      console.log('[Avatar Generation] Sending request to HeyGen:', JSON.stringify(requestPayload, null, 2));

      // Create video generation request
      // ⚠️ CRITICAL: Use /v2/video/generate endpoint (HeyGen API v2)
      if (!requestPayload) {
        return {
          status: 'failed',
          videoId: null,
          error: 'Failed to construct request payload',
          errorCode: 'INVALID_PAYLOAD',
        };
      }

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

      // Check if video generation failed
      if (pollResult.status === 'failed') {
        console.error('[HeyGen] Video generation failed during polling', {
          videoId,
          errorMessage: pollResult.errorMessage,
          errorCode: pollResult.errorCode,
          errorDetail: pollResult.errorDetail,
        });
        return {
          status: 'failed',
          videoId,
          error: pollResult.errorMessage || 'Video generation failed',
          errorCode: pollResult.errorCode || 'UNKNOWN_ERROR',
          errorDetail: pollResult.errorDetail || pollResult.errorMessage,
        };
      }

      // Video must be completed to have a URL
      if (pollResult.status !== 'completed') {
        console.warn('[HeyGen] Video status is not completed', {
          videoId,
          status: pollResult.status,
        });
        const fallbackUrl = `https://app.heygen.com/share/${videoId}`;
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: fallbackUrl,
          videoId,
          duration: duration || 15,
          status: pollResult.status || 'processing',
          fallback: true,
          error: `Video status: ${pollResult.status}`,
        };
      }

      // Get download URL and share URL from poll result
      const downloadUrl = pollResult.downloadUrl || null;
      const shareUrl = pollResult.shareUrl || pollResult.videoUrl || `https://app.heygen.com/share/${videoId}`;
      const heygenVideoUrl = downloadUrl || shareUrl;
      const isShareUrl = !downloadUrl || heygenVideoUrl.includes('/share/');
      
      console.log('[HeyGen] Video generation completed, starting download and storage upload', {
        videoId,
        hasDownloadUrl: !!downloadUrl,
        downloadUrl: downloadUrl ? downloadUrl.substring(0, 100) + '...' : null,
        shareUrl: shareUrl,
        isShareUrl,
      });

      // Validate that we have a video URL
      if (!heygenVideoUrl) {
        console.error('[HeyGen] No video URL returned from poll - cannot download', {
          videoId,
          pollResult,
        });
        return {
          status: 'failed',
          videoId,
          error: 'No video URL returned from HeyGen API',
          errorCode: 'MISSING_VIDEO_URL',
          errorDetail: 'Video status is completed but no URL was provided',
        };
      }

      // If we only have a share URL, we cannot download directly - need to skip download
      if (isShareUrl && !downloadUrl) {
        console.warn('[HeyGen] Only share URL available, cannot download video directly. Video will be stored with share URL only.', {
          videoId,
          shareUrl,
        });
        return {
          videoUrl: shareUrl,
          videoId,
          duration_seconds: duration || 15,
          status: 'completed',
          fallback: true,
          error: 'Only share URL available - cannot download video for Supabase storage',
          metadata: {
            heygen_video_url: shareUrl,
          },
        };
      }

      // Download and upload to Supabase Storage
      console.log(`[HeyGen] Downloading video from Heygen...`, {
        videoId,
        downloadUrl: downloadUrl?.substring(0, 100) + '...',
      });
      try {
        const videoBuffer = await this.downloadVideo(downloadUrl);
        console.log(`[HeyGen] Video downloaded (${videoBuffer.length} bytes)`);
        console.log(`[HeyGen] Uploading to Supabase Storage...`);
        
        let storageMetadata = null;
        let storageUrl = null;

        try {
          // Use new storage service to get full metadata
          storageMetadata = await this.storageService.uploadVideoToStorage(
            videoBuffer,
            `avatar_${videoId}.mp4`,
            'video/mp4'
          );
          
          if (storageMetadata && storageMetadata.fileUrl) {
            storageUrl = storageMetadata.fileUrl;
            console.log(`[HeyGen] Video uploaded to Supabase Storage with full metadata`, {
              fileUrl: storageMetadata.fileUrl,
              fileName: storageMetadata.fileName,
              fileSize: storageMetadata.fileSize,
              storagePath: storageMetadata.storagePath,
            });
          } else {
            console.warn('[HeyGen] Storage service returned incomplete metadata, using share URL as fallback');
            storageUrl = shareUrl;
          }
        } catch (uploadErr) {
          console.warn('[HeyGen] Upload to Supabase failed, using share URL as fallback:', uploadErr.message);
          storageUrl = shareUrl; // Fallback to share URL only if upload fails
        }

        // Ensure we always return a valid URL
        if (!storageUrl) {
          console.warn('[HeyGen] No storage URL available, using share URL as final fallback');
          storageUrl = shareUrl;
        }

        console.log(`[HeyGen] Returning video result with metadata`);
        return {
          videoUrl: storageUrl, // Supabase public URL if upload succeeded, otherwise share URL
          videoId,
          duration_seconds: duration || 15,
          status: 'completed',
          fallback: storageUrl === shareUrl, // Mark as fallback if we're using share URL
          // Include full storage metadata if available
          ...(storageMetadata && {
            fileUrl: storageMetadata.fileUrl,
            fileName: storageMetadata.fileName,
            fileSize: storageMetadata.fileSize,
            fileType: storageMetadata.fileType,
            storagePath: storageMetadata.storagePath,
            uploadedAt: storageMetadata.uploadedAt,
            sha256Hash: storageMetadata.sha256Hash,
            digitalSignature: storageMetadata.digitalSignature,
          }),
          // Include Heygen URLs in metadata
          metadata: {
            heygen_video_url: shareUrl, // Always keep share URL in metadata
            ...(downloadUrl && { heygen_download_url: downloadUrl }),
          },
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
          // Prefer download URLs over share URLs
          const downloadUrl = responseData.video_download_url 
            || responseData.download_url 
            || responseData.video_url
            || null;
          
          const shareUrl = responseData.share_url 
            || (responseData.video && responseData.video.url)
            || `https://app.heygen.com/share/${videoId}`;

          // Use download URL if available, otherwise use share URL
          const videoUrl = downloadUrl || shareUrl;
          const isFallback = !downloadUrl || videoUrl.includes('/share/');

          if (!videoUrl) {
            console.error('[HeyGen] No video URL found in completed response', {
              videoId,
              responseData,
            });
            // Fallback to share URL if no direct URL found
            const fallbackShareUrl = `https://app.heygen.com/share/${videoId}`;
            console.warn('[HeyGen] Using fallback share URL', { fallbackShareUrl });
            return { status, videoUrl: fallbackShareUrl, isFallback: true, downloadUrl: null, shareUrl: fallbackShareUrl };
          }

          console.log('[HeyGen] Found video URL from poll response', {
            videoId,
            videoUrl: downloadUrl ? downloadUrl.substring(0, 100) + '...' : videoUrl,
            downloadUrl: !!downloadUrl,
            shareUrl: shareUrl,
            isFallback,
          });

          return { 
            status, 
            videoUrl: downloadUrl || shareUrl, 
            downloadUrl: downloadUrl || null,
            shareUrl: shareUrl,
            isFallback 
          };
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
   * Upload video to Supabase Storage (DEPRECATED - use AvatarVideoStorageService)
   * @deprecated Use AvatarVideoStorageService.uploadVideoToStorage() instead
   * @param {Object} params
   * @param {Buffer} params.fileBuffer - Binary video buffer
   * @param {string} params.fileName - File name for storage
   * @param {string} params.contentType - MIME type
   * @returns {Promise<string>} Supabase public URL
   */
  async uploadToStorage({ fileBuffer, fileName, contentType = 'video/mp4' }) {
    // Delegate to storage service for backward compatibility
    const metadata = await this.storageService.uploadVideoToStorage(
      fileBuffer,
      fileName,
      contentType
    );
    return metadata.fileUrl;
  }
  
  /**
   * Generate video from pre-built HeyGen payload (from pipeline)
   * @param {Object} heygenPayload - Pre-built HeyGen API payload
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Video generation result
   */
  async generateVideoFromPayload(heygenPayload, options = {}) {
    if (!this.client) {
      return {
        status: 'skipped',
        videoId: null,
        videoUrl: null,
        reason: 'api_key_not_configured',
      };
    }

    logger.info('[HeyGen] Generating video from pre-built payload', {
      hasTitle: !!heygenPayload.title,
      hasVideoInputs: !!heygenPayload.video_inputs,
      videoInputsCount: heygenPayload.video_inputs?.length || 0,
      hasCaptions: !!heygenPayload.captions,
    });

    let response;
    try {
      response = await this.client.post('/v2/video/generate', heygenPayload);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      const errorDetails = error.response?.data || {};
      
      logger.error('[HeyGen] API error when generating from payload', {
        status: error.response?.status,
        message: errorMessage,
        details: errorDetails,
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
      logger.error('[HeyGen] No video_id in response', {
        responseData: response.data,
      });
      return {
        status: 'failed',
        videoId: null,
        error: 'HeyGen did not return a video_id',
        errorCode: 'MISSING_VIDEO_ID',
      };
    }

    // Poll for video completion
    const duration = options.duration || 15;
    try {
      const pollResult = await this.pollVideoStatus(videoId, 120, 5000);
      
      if (pollResult.status === 'failed') {
        return {
          status: 'failed',
          videoId,
          error: pollResult.error || 'Video generation failed',
          errorCode: pollResult.errorCode || 'GENERATION_FAILED',
        };
      }

      return {
        videoId,
        videoUrl: pollResult.videoUrl,
        heygenVideoUrl: pollResult.shareUrl,
        duration_seconds: pollResult.duration || duration,
        status: 'completed',
        metadata: pollResult.metadata || {},
      };
    } catch (pollError) {
      logger.warn('[HeyGen] Polling failed, returning partial result', {
        videoId,
        error: pollError.message,
      });
      
      return {
        videoId,
        videoUrl: pollError.videoUrl || `https://app.heygen.com/share/${videoId}`,
        status: pollError.status || 'processing',
        duration_seconds: duration,
      };
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

  /**
   * Generate video from HeyGen Template v2
   * @param {string} templateId - HeyGen template ID
   * @param {Object} payload - Template payload (from HeyGenTemplatePayloadBuilder)
   * @param {Object} [options] - Optional settings
   * @param {number} [options.maxRetries=3] - Maximum retry attempts for 5xx errors
   * @param {number} [options.retryDelay=1000] - Delay between retries in ms
   * @returns {Promise<Object>} Result with video_id
   * @throws {Error} If generation fails after retries
   */
  async generateTemplateVideo(templateId, payload, options = {}) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    if (!templateId || typeof templateId !== 'string' || templateId.trim().length === 0) {
      throw new Error('templateId is required and must be a non-empty string');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('payload is required and must be an object');
    }

    const { maxRetries = 3, retryDelay = 1000 } = options;
    const endpoint = `/v2/template/${templateId}/generate`;

    let lastError = null;
    let lastResponse = null;

    // Retry loop for transient 5xx errors
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.info('[HeyGen] Generating template video', {
          templateId,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          endpoint,
        });

        // Log payload structure for debugging (especially image variables)
        if (payload.variables) {
          const imageVars = Object.keys(payload.variables).filter(k => k.startsWith('image_'));
          const firstImageVar = imageVars[0] ? payload.variables[imageVars[0]] : null;
          
          logger.info('[HeyGen] Payload variables structure', {
            totalVariables: Object.keys(payload.variables).length,
            imageVariables: imageVars,
            firstImageVar: firstImageVar ? JSON.stringify(firstImageVar, null, 2) : 'none',
            firstImageVarType: firstImageVar?.type,
            firstImageVarValue: firstImageVar?.value ? JSON.stringify(firstImageVar.value, null, 2) : 'none',
            firstImageVarImage: firstImageVar?.value?.image ? JSON.stringify(firstImageVar.value.image, null, 2) : 'none',
            firstImageVarName: firstImageVar?.value?.image?.name,
            firstImageVarNameType: typeof firstImageVar?.value?.image?.name,
            firstImageVarNameLength: firstImageVar?.value?.image?.name?.length,
          });
          
          // Log full payload for debugging
          logger.info('[HeyGen] Full payload being sent', {
            payload: JSON.stringify(payload, null, 2),
          });
        }

        const response = await this.client.post(endpoint, payload);

        // Extract video_id from response
        const videoId = response.data?.data?.video_id || response.data?.video_id;
        
        if (!videoId) {
          const errorMessage = 'HeyGen did not return a video_id in template response';
          const responseSnippet = JSON.stringify(response.data || {}).substring(0, 500);
          
          logger.error('[HeyGen] No video_id in template response', {
            templateId,
            responseSnippet,
            statusCode: response.status,
          });

          throw new Error(`${errorMessage}. Response: ${responseSnippet}`);
        }

        logger.info('[HeyGen] Template video generation initiated', {
          templateId,
          videoId,
          attempt: attempt + 1,
        });

        return {
          success: true,
          video_id: videoId,
          template_id: templateId,
        };

      } catch (error) {
        lastError = error;
        lastResponse = error.response;

        const statusCode = error.response?.status;
        const isTransientError = statusCode >= 500 && statusCode < 600;
        const isLastAttempt = attempt >= maxRetries;

        // Log error details
        const errorDetails = {
          templateId,
          attempt: attempt + 1,
          statusCode: statusCode || 'N/A',
          statusText: error.response?.statusText || 'N/A',
          errorMessage: error.message,
          responseBody: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'N/A',
          isTransientError,
          willRetry: isTransientError && !isLastAttempt,
        };

        if (isTransientError && !isLastAttempt) {
          logger.warn('[HeyGen] Transient error, retrying template generation', {
            ...errorDetails,
            retryDelay,
            nextAttempt: attempt + 2,
          });

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1))); // Exponential backoff
          continue;
        }

        // Non-retryable error or last attempt
        logger.error('[HeyGen] Template video generation failed', errorDetails);

        // Build error message with proper error surface
        const errorMessage = lastResponse?.data?.message 
          || lastResponse?.data?.error_message 
          || lastError?.message 
          || 'Template video generation failed';

        const errorCode = lastResponse?.data?.error_code 
          || lastResponse?.data?.code 
          || (statusCode === 400 ? 'INVALID_REQUEST' : statusCode >= 500 ? 'SERVER_ERROR' : 'API_ERROR');

        const responseBodySnippet = lastResponse?.data 
          ? JSON.stringify(lastResponse.data).substring(0, 500) 
          : 'No response body';

        throw new Error(
          `Template video generation failed: ${errorMessage}. ` +
          `Status: ${statusCode || 'N/A'}, ` +
          `Code: ${errorCode}, ` +
          `Response: ${responseBodySnippet}`
        );
      }
    }

    // This should never be reached, but TypeScript/ESLint might complain
    throw lastError || new Error('Template video generation failed after retries');
  }
}
