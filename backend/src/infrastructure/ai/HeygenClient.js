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
    this.baseURL = 'https://api.heygen.com/v2';
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
      // Use valid Heygen avatar ID
      const defaultAvatarId = 'Kristin_public_3_20240108';
      
      // Step 1: Create video generation request
      const response = await this.client.post('/video/generate', {
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
              voice_id: config.voiceId || 'en-US-JennyNeural',
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

      // Step 2: Poll for video completion
      const videoUrl = await this.pollVideoStatus(videoId);

      // Step 3: Return Heygen URL directly (no Supabase upload for now)
      return {
        videoUrl: videoUrl,
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
  async pollVideoStatus(videoId, maxAttempts = 30, interval = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.get(`/video/status/${videoId}`);
        const status = response.data.data.status;

        if (status === 'completed') {
          return response.data.data.video_url;
        } else if (status === 'failed') {
          throw new Error('Video generation failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error(`[HeygenClient] Poll attempt ${attempt + 1} failed:`, error.message);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Video generation timeout');
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
      // Use a valid Heygen avatar ID or test mode
      // Popular Heygen avatar IDs: 
      // - 'Kristin_public_3_20240108' (female)
      // - 'Tyler-incasualsuit-20220721' (male)
      // - 'josh_lite3_20230714' (male)
      const defaultAvatarId = 'Kristin_public_3_20240108';
      
      const response = await this.client.post('/video/generate', {
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
              voice_id: voiceId || 'en-US-JennyNeural',
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

