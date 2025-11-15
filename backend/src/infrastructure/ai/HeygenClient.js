import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

/**
 * Heygen API Client
 * Generates avatar videos using Heygen API
 */
export class HeygenClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      console.warn('[HeygenClient] API key not provided - avatar video generation will be disabled');
      this.client = null;
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
  }

  /**
   * Generate avatar video from script
   * @param {string} script - Narration script
   * @param {Object} config - Video configuration
   * @returns {Promise<Object>} Video data with URL
   */
  async generateVideo(script, config = {}) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    try {
      // Use valid Heygen avatar ID and voice ID
      const defaultAvatarId = 'Kristin_public_3_20240108';
      const defaultVoiceId = '1bd001e7e50f421d891986aad5158bc8'; // Heygen female voice
      
      // Step 1: Create video generation request
      const response = await this.client.post('/v2/video/generate', {
        test: true, // Test mode for faster generation
        caption: false,
        title: config.title || 'EduCore Lesson',
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: config.avatarId || defaultAvatarId,
              avatar_style: config.avatarStyle || 'normal',
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: config.voiceId || defaultVoiceId,
              speed: config.speed || 1.0,
            },
            background: {
              type: 'color',
              value: config.backgroundColor || '#FFFFFF',
            },
          },
        ],
        dimension: {
          width: config.width || 1280,
          height: config.height || 720,
        },
      });

      const videoId = response.data.data.video_id;
      console.log(`[HeygenClient] Video created successfully! Video ID: ${videoId}`);
      console.log(`[HeygenClient] Full response:`, JSON.stringify(response.data, null, 2));

      // Step 2: Poll for video completion
      let pollResult;
      try {
        pollResult = await this.pollVideoStatus(
          videoId,
          config.pollAttempts || 120,
          config.pollInterval || 5000,
        );
      } catch (pollError) {
        // If video generation failed permanently, don't return fallback - throw error
        if (pollError.status === 'failed' || (pollError.message && pollError.message.includes('Video generation failed'))) {
          console.error('[HeygenClient] Video generation failed permanently:', pollError.errorMessage || pollError.message);
          throw new Error(`Avatar video generation failed: ${pollError.errorMessage || pollError.message || 'Unknown error'}`);
        }
        
        // If polling timeout/error but not a permanent failure, return fallback URL
        const fallbackUrl = pollError.videoUrl || `https://app.heygen.com/share/${videoId}`;
        console.warn('[HeygenClient] Video not ready within polling window, returning fallback URL:', fallbackUrl);
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: fallbackUrl,
          videoId,
          duration: config.duration || 15,
          script,
          status: pollError.status || 'processing',
          fallback: true,
        };
      }

      const heygenVideoUrl = pollResult.videoUrl;

      // Step 3: Download and upload to Supabase Storage
      console.log(`[HeygenClient] Downloading video from Heygen...`);
      try {
        const videoBuffer = await this.downloadVideo(heygenVideoUrl);
        console.log(`[HeygenClient] Video downloaded (${videoBuffer.length} bytes)`);

        console.log(`[HeygenClient] Uploading to Supabase Storage...`);
        let storageUrl = null; // Start with null, not Heygen URL
        try {
          const uploadedUrl = await this.uploadToStorage({
            fileBuffer: videoBuffer,
            fileName: `avatar_${videoId}.mp4`,
            contentType: 'video/mp4',
          });
          if (uploadedUrl) {
            storageUrl = uploadedUrl;
            console.log(`[HeygenClient] Video uploaded to Supabase Storage: ${storageUrl}`);
          } else {
            console.warn('[HeygenClient] uploadToStorage returned null, using Heygen URL as fallback');
            storageUrl = heygenVideoUrl;
          }
        } catch (uploadErr) {
          console.warn('[HeygenClient] Upload to Supabase failed, using Heygen URL as fallback:', uploadErr.message);
          storageUrl = heygenVideoUrl; // Fallback to Heygen URL only if upload fails
        }

        // Ensure we always return a valid URL
        if (!storageUrl) {
          console.warn('[HeygenClient] No storage URL available, using Heygen URL as final fallback');
          storageUrl = heygenVideoUrl;
        }

        console.log(`[HeygenClient] Returning video URL: ${storageUrl} (${storageUrl.startsWith('http') ? 'Full URL' : 'Path'})`);

        return {
          videoUrl: storageUrl, // This should be Supabase public URL if upload succeeded, otherwise Heygen URL
          heygenVideoUrl: heygenVideoUrl, // Always keep original Heygen URL for reference
          videoId,
          duration: config.duration || 15,
          script,
          status: 'completed',
          fallback: storageUrl === heygenVideoUrl, // Mark as fallback if we're using Heygen URL
        };
      } catch (downloadErr) {
        const fallbackUrl = `https://app.heygen.com/share/${videoId}`;
        console.warn('[HeygenClient] Failed to download/upload video; returning fallback URL:', fallbackUrl, downloadErr.message);
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: heygenVideoUrl,
          videoId,
          duration: config.duration || 15,
          script,
          status: 'processing',
          fallback: true,
          error: downloadErr.message,
        };
      }

    } catch (error) {
      console.error('[HeygenClient] Video generation error:', error.response?.data || error.message);
      throw new Error(`Failed to generate avatar video: ${error.message}`);
    }
  }

  /**
   * Poll video generation status
   * @param {string} videoId - Video ID from Heygen
   * @returns {Promise<{status: string, videoUrl: string}>} Video status data
   */
  async pollVideoStatus(videoId, maxAttempts = 60, interval = 3000) {
    console.log(`[HeygenClient] Starting to poll for video ${videoId}`);
    
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Heygen API v1 endpoint for status
        const response = await this.client.get(`/v1/video_status.get?video_id=${videoId}`);
        const status = response.data.data.status;

        console.log(`[HeygenClient] Poll attempt ${attempt + 1}: status = ${status}`);

        if (status === 'completed') {
          const videoUrl = response.data.data.video_url;
          console.log(`[HeygenClient] Video completed! URL: ${videoUrl}`);
          return { status, videoUrl };
        } else if (status === 'failed') {
          // Get error message from response if available
          const errorMessage = response.data.data.error_message || response.data.data.error || 'Video generation failed';
          console.error(`[HeygenClient] Video generation failed: ${errorMessage}`, {
            videoId,
            attempt: attempt + 1,
            responseData: response.data.data,
          });
          // Throw error immediately - don't continue polling if video failed
          const failedError = new Error(`Video generation failed: ${errorMessage}`);
          failedError.status = 'failed';
          failedError.videoId = videoId;
          failedError.errorMessage = errorMessage;
          throw failedError;
        }

        // Wait before next poll (only if status is 'processing' or other non-final status)
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        // If video failed, don't retry - throw immediately
        if (error.status === 'failed' || (error.message && error.message.includes('Video generation failed'))) {
          console.error(`[HeygenClient] Video generation failed permanently, stopping polling:`, error.message);
          throw error;
        }
        
        // If we get a 404 or network error, the video might still be processing
        console.error(`[HeygenClient] Poll attempt ${attempt + 1} failed:`, error.response?.data || error.message);
        
        // Don't throw on last attempt - just continue to retry
        if (attempt === maxAttempts - 1) {
          console.warn(`[HeygenClient] Timeout reached. Video ${videoId} may still be processing.`);
        }
        
        // Wait before retry
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
        console.warn('[HeygenClient] Supabase not configured, returning Heygen URL');
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
        console.error('[HeygenClient] Supabase upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      
      if (!publicUrl) {
        console.error('[HeygenClient] Failed to get public URL from Supabase');
        throw new Error('Failed to get public URL from Supabase storage');
      }

      console.log(`[HeygenClient] Video uploaded successfully to Supabase: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error('[HeygenClient] Storage upload error:', error.message);
      throw new Error(`Failed to upload video to storage: ${error.message}`);
    }
  }

  /**
   * Create video (alias for generateVideo step 1)
   * @param {Object} options - Video options
   * @returns {Promise<Object>} Video ID
   */
  async createVideo({ script, language, avatarId, voiceId }) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    try {
      // Use valid Heygen IDs
      const defaultAvatarId = 'Kristin_public_3_20240108';
      const defaultVoiceId = '1bd001e7e50f421d891986aad5158bc8';
      
      const response = await this.client.post('/v2/video/generate', {
        test: true, // Set to true for faster testing (adds watermark)
        caption: false,
        title: 'EduCore Lesson',
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId || defaultAvatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: voiceId || defaultVoiceId,
              speed: 1.0,
            },
            background: {
              type: 'color',
              value: '#FFFFFF',
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      });

      return {
        videoId: response.data.data.video_id,
      };
    } catch (error) {
      console.error('[HeygenClient] Create video error:', error.response?.data || error.message);
      throw new Error(`Failed to create video: ${error.message}`);
    }
  }

  /**
   * Wait for video to be ready
   * @param {string} videoId - Video ID
   * @returns {Promise<string>} Video URL
   */
  async waitForVideo(videoId) {
    return await this.pollVideoStatus(videoId);
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
      console.error('[HeygenClient] Download video error:', error.message);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }
}

