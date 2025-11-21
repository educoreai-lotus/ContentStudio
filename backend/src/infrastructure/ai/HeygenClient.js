import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

/**
 * Heygen API Client
 * Generates avatar videos using Heygen API
 * 
 * IMPORTANT: This client sends ONLY the minimal required fields:
 * - title
 * - prompt (trainer's exact text, unmodified)
 * - topic
 * - description
 * - skills
 * 
 * NO voice, voice_id, video_inputs, script generation, or avatar selection
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
   * Generate avatar video
   * 
   * @param {Object} data - Video data
   * @param {string} data.prompt - Trainer's exact prompt (unmodified)
   * @param {string} data.topic - Topic name
   * @param {string} data.description - Topic description
   * @param {Array<string>} data.skills - Skills array
   * @param {Object} config - Video configuration
   * @returns {Promise<Object>} Video data with URL
   */
  async generateVideo(data, config = {}) {
    if (!this.client) {
      throw new Error('Heygen client not configured');
    }

    try {
      // Validate required fields
      if (!data || typeof data !== 'object') {
        console.error('[Avatar Generation Error] HeyGen rejected the request. Possible invalid parameters.');
        return {
          status: 'failed',
          videoId: null,
          error: 'Invalid data provided',
          errorCode: 'INVALID_DATA',
          errorDetail: 'Data must be an object with prompt, topic, description, and skills',
        };
      }

      const { prompt, topic, description, skills } = data;

      // Validate prompt (trainer's exact text)
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

      // Build minimal request payload - ONLY allowed fields
      const requestPayload = {
        title: config.title || 'EduCore Lesson',
        prompt: prompt.trim(), // Trainer's exact text, unmodified
        topic: topic || '',
        description: description || '',
        skills: Array.isArray(skills) ? skills : [],
      };

      // Minimal logging - only allowed messages
      console.log('[Avatar Generation] Sending prompt to HeyGen');
      console.log('[Avatar Generation] Video generation started...');

      // Create video generation request
      const response = await this.client.post('/v2/video/generate', requestPayload);

      const videoId = response.data.data?.video_id;
      if (!videoId) {
        console.error('[Avatar Generation Error] HeyGen rejected the request. Possible invalid parameters.');
        throw new Error('HeyGen did not return a video_id');
      }

      // Poll for video completion
      let pollResult;
      try {
        pollResult = await this.pollVideoStatus(
          videoId,
          config.pollAttempts || 120,
          config.pollInterval || 5000,
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
          duration: config.duration || 15,
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
          duration: config.duration || 15,
          status: 'completed',
          fallback: storageUrl === heygenVideoUrl,
        };
      } catch (downloadErr) {
        const fallbackUrl = `https://app.heygen.com/share/${videoId}`;
        return {
          videoUrl: fallbackUrl,
          heygenVideoUrl: heygenVideoUrl,
          videoId,
          duration: config.duration || 15,
          status: 'processing',
          fallback: true,
          error: downloadErr.message,
        };
      }

    } catch (error) {
      const is400Error = error.response?.status === 400 || error.response?.statusCode === 400;
      
      if (is400Error) {
        console.error('[Avatar Generation Error] HeyGen rejected the request. Possible invalid parameters.');
      }

      return {
        status: 'failed',
        videoId: null,
        error: error.message || 'Video generation failed',
        errorCode: error.response?.data?.error_code || 'UNKNOWN_ERROR',
        errorDetail: error.response?.data?.error_message || error.message,
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
