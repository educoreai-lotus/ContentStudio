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
      const heygenVideoUrl = await this.pollVideoStatus(videoId);

      // Step 3: Download and upload to Supabase Storage
      console.log(`[HeygenClient] Downloading video from Heygen...`);
      const videoBuffer = await this.downloadVideo(heygenVideoUrl);
      
      console.log(`[HeygenClient] Uploading to Supabase Storage...`);
      const storagePath = await this.uploadToStorage(heygenVideoUrl, `avatar_${videoId}.mp4`);

      return {
        videoUrl: storagePath,
        heygenVideoUrl: heygenVideoUrl,
        videoId,
        duration: config.duration || 15,
        script,
      };
    } catch (error) {
      console.error('[HeygenClient] Video generation error:', error.response?.data || error.message);
      throw new Error(`Failed to generate avatar video: ${error.message}`);
    }
  }

  /**
   * Poll video generation status
   * @param {string} videoId - Video ID from Heygen
   * @returns {Promise<string>} Video URL
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
          return videoUrl;
        } else if (status === 'failed') {
          throw new Error('Video generation failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        // If we get a 404 or network error, the video might still be processing
        console.error(`[HeygenClient] Poll attempt ${attempt + 1} failed:`, error.response?.data || error.message);
        
        // Don't throw on last attempt - return a placeholder URL with video ID
        if (attempt === maxAttempts - 1) {
          console.warn(`[HeygenClient] Timeout reached. Video ${videoId} may still be processing.`);
          console.warn(`[HeygenClient] Check Heygen dashboard or use video ID: ${videoId}`);
          // Return a special URL that indicates the video is still processing
          return `https://app.heygen.com/share/${videoId}`;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    // This shouldn't be reached, but just in case
    return `https://app.heygen.com/share/${videoId}`;
  }

  /**
   * Upload video to Supabase Storage
   * @param {string} videoUrl - Heygen video URL
   * @param {string} fileName - File name for storage
   * @returns {Promise<string>} Supabase storage path
   */
  async uploadToStorage(videoUrl, fileName) {
    try {
      // Download video from Heygen
      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
      });

      // Upload to Supabase Storage
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[HeygenClient] Supabase not configured, returning Heygen URL');
        return videoUrl;
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const filePath = `avatar_videos/${fileName}`;
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, videoResponse.data, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (error) {
        console.error('[HeygenClient] Supabase upload error:', error);
        return videoUrl; // Fallback to Heygen URL
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('[HeygenClient] Storage upload error:', error.message);
      return videoUrl; // Fallback to Heygen URL
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
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('[HeygenClient] Download video error:', error.message);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }
}

