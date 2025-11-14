import { getSubtitles } from 'youtube-captions-scraper';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Video Transcription Service
 * Handles transcription from YouTube URLs (captions) and uploaded video files (Whisper)
 */
export class VideoTranscriptionService {
  constructor({ openaiApiKey }) {
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    // Piped.video API base URL
    this.pipedApiUrl = 'https://piped.video';
  }

  /**
   * Extract video ID from YouTube URL
   * @param {string} url - YouTube URL
   * @returns {string|null} Video ID or null if invalid
   */
  extractVideoId(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Fetch YouTube captions
   * @param {string} videoId - YouTube video ID
   * @param {string} lang - Language code (default: 'en')
   * @returns {Promise<string|null>} Transcript text or null if not available
   */
  async fetchYouTubeCaptions(videoId, lang = 'en') {
    try {
      logger.info('[VideoTranscriptionService] Fetching YouTube captions', { videoId, lang });

      const subtitles = await getSubtitles({
        videoID: videoId,
        lang: lang,
      });

      // Check if we got valid subtitles array
      if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
        logger.warn('[VideoTranscriptionService] No captions found for video', { videoId, lang });
        return null;
      }

      // Merge all caption segments into clean text
      let transcript = '';
      for (const subtitle of subtitles) {
        // Handle both formats: {text: "..."} and {text: "...", start: ..., dur: ...}
        if (subtitle && subtitle.text) {
          transcript += subtitle.text + ' ';
        }
      }

      // Clean up the transcript
      transcript = transcript
        .replace(/\n/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s.,!?;:()\-'"]/g, '') // Remove special symbols but keep punctuation
        .trim();

      if (!transcript || transcript.length === 0) {
        logger.warn('[VideoTranscriptionService] Captions found but transcript is empty', {
          videoId,
          lang,
          subtitlesCount: subtitles.length,
        });
        return null;
      }

      logger.info('[VideoTranscriptionService] YouTube captions extracted successfully', {
        videoId,
        lang,
        length: transcript.length,
        segmentsCount: subtitles.length,
      });

      return transcript;
    } catch (error) {
      // The library throws an error if captions not found, so we catch and return null
      logger.warn('[VideoTranscriptionService] Failed to fetch YouTube captions', {
        videoId,
        lang,
        error: error.message,
        errorName: error.name,
      });
      return null;
    }
  }

  /**
   * Try to fetch YouTube captions in multiple languages
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<{transcript: string, lang: string}|null>} Transcript with language or null
   */
  async fetchYouTubeCaptionsMultiLang(videoId) {
    // Try multiple languages in order of preference
    const languagesToTry = ['en', 'he', 'ar', 'auto', 'en-US', 'en-GB'];
    
    for (const lang of languagesToTry) {
      try {
        logger.info('[VideoTranscriptionService] Trying to fetch captions...', { videoId, lang });
        const transcript = await this.fetchYouTubeCaptions(videoId, lang);
        if (transcript && transcript.length > 0) {
          return { transcript, lang };
        }
      } catch (error) {
        logger.debug('[VideoTranscriptionService] Failed to fetch captions for language', {
          videoId,
          lang,
          error: error.message,
        });
        // Continue to next language
      }
    }

    // Try without specifying language (auto-detect) - gets first available captions
    try {
      logger.info('[VideoTranscriptionService] Trying auto-detect captions (no lang specified)', { videoId });
      const subtitles = await getSubtitles({
        videoID: videoId,
        // Don't specify lang - will get first available captions
      });
      
      if (subtitles && Array.isArray(subtitles) && subtitles.length > 0) {
        let transcript = '';
        for (const subtitle of subtitles) {
          if (subtitle && subtitle.text) {
            transcript += subtitle.text + ' ';
          }
        }
        transcript = transcript
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s.,!?;:()\-'"]/g, '')
          .trim();
        
        if (transcript && transcript.length > 0) {
          logger.info('[VideoTranscriptionService] Auto-detect captions found', {
            videoId,
            length: transcript.length,
            captionsCount: subtitles.length,
          });
          return { transcript, lang: 'auto' };
        }
      }
    } catch (error) {
      logger.debug('[VideoTranscriptionService] Auto-detect failed', {
        videoId,
        error: error.message,
      });
    }

    return null;
  }

  /**
   * Transcribe audio file using Whisper
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeWithWhisper(audioFilePath, options = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI API key not configured');
    }

    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    try {
      logger.info('[VideoTranscriptionService] Transcribing with Whisper', { audioFilePath });

      // Read file as stream
      const fileStream = fs.createReadStream(audioFilePath);

      // Use the OpenAI client's transcribeAudio method
      const transcript = await this.openaiClient.transcribeAudio(fileStream, {
        language: options.language || 'en',
      });

      logger.info('[VideoTranscriptionService] Whisper transcription completed', {
        audioFilePath,
        length: transcript.length,
      });

      return transcript;
    } catch (error) {
      logger.error('[VideoTranscriptionService] Whisper transcription failed', {
        audioFilePath,
        error: error.message,
      });
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Extract audio from video file (if needed)
   * For now, we'll pass the video file directly to Whisper
   * Whisper can handle video files directly
   * @param {string} videoFilePath - Path to video file
   * @returns {Promise<string>} Path to audio file (or video file if extraction not needed)
   */
  async extractAudioFromVideo(videoFilePath) {
    // Whisper can handle video files directly, so we can return the video path
    // If needed in the future, we can use ffmpeg here to extract audio
    return videoFilePath;
  }

  /**
   * Transcribe video from YouTube URL
   * Tries captions first in multiple languages, falls back to Whisper if captions unavailable
   * @param {string} youtubeUrl - YouTube URL
   * @param {Object} options - Options
   * @returns {Promise<Object>} { transcript, source, videoType }
   */
  async transcribeYouTube(youtubeUrl, options = {}) {
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    logger.info('[VideoTranscriptionService] Processing YouTube URL', { youtubeUrl, videoId });

    // Try YouTube captions first - try multiple languages
    let captionsResult = null;
    
    // If specific language requested, try it first
    if (options.lang) {
      const captions = await this.fetchYouTubeCaptions(videoId, options.lang);
      if (captions && captions.length > 0) {
        captionsResult = { transcript: captions, lang: options.lang };
      }
    }
    
    // If not found, try multiple languages
    if (!captionsResult) {
      captionsResult = await this.fetchYouTubeCaptionsMultiLang(videoId);
    }

    if (captionsResult && captionsResult.transcript && captionsResult.transcript.length > 0) {
      logger.info('[VideoTranscriptionService] YouTube captions found', {
        videoId,
        lang: captionsResult.lang,
        length: captionsResult.transcript.length,
      });
      return {
        transcript: captionsResult.transcript,
        source: 'youtube-captions',
        videoType: 'youtube',
        videoId,
      };
    }

    // No captions found - ALWAYS fallback to Whisper
    logger.info('[VideoTranscriptionService] No captions found, switching to Whisper...', {
      videoId,
    });

    // Always try Whisper fallback - don't throw error if captions missing
    return await this.transcribeYouTubeWithWhisper(youtubeUrl, videoId);
  }

  /**
   * Download YouTube audio and transcribe with Whisper (fallback method)
   * Uses Piped.video API to get audio stream URL and download directly
   * @param {string} youtubeUrl - YouTube URL
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} { transcript, source, videoType }
   * @throws {Error} If download or transcription fails
   */
  async transcribeYouTubeWithWhisper(youtubeUrl, videoId) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available. Please configure OpenAI API key.');
    }

    logger.info('[VideoTranscriptionService] Downloading YouTube audio for Whisper transcription', {
      videoId,
      youtubeUrl,
    });

    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const audioPath = path.join(tempDir, `${videoId}.mp3`);

    try {
      // Step 1: Get video streams from Piped.video API
      logger.info('[VideoTranscriptionService] Fetching video streams from Piped.video API...', {
        videoId,
        apiUrl: `${this.pipedApiUrl}/streams/${videoId}`,
      });

      let streamsData;
      try {
        const response = await axios.get(`${this.pipedApiUrl}/streams/${videoId}`, {
          timeout: 30000, // 30 seconds timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          responseType: 'json', // Explicitly request JSON response
        });
        // Handle different response types
        let rawData = response.data;
        
        // If response is a Buffer or array of numbers, try to parse as JSON string
        if (Buffer.isBuffer(rawData)) {
          try {
            rawData = JSON.parse(rawData.toString('utf8'));
          } catch (parseError) {
            logger.warn('[VideoTranscriptionService] Failed to parse Buffer as JSON', {
              videoId,
              error: parseError.message,
            });
          }
        } else if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'number') {
          // If it's an array of numbers, it might be a Buffer representation
          // Try to convert to string and parse as JSON
          try {
            const buffer = Buffer.from(rawData);
            rawData = JSON.parse(buffer.toString('utf8'));
            logger.info('[VideoTranscriptionService] Successfully parsed array of numbers as JSON', {
              videoId,
            });
          } catch (parseError) {
            logger.warn('[VideoTranscriptionService] Failed to parse array of numbers as JSON', {
              videoId,
              error: parseError.message,
            });
          }
        }
        
        streamsData = rawData;
        
        // Log response structure for debugging
        logger.info('[VideoTranscriptionService] Piped.video API response structure', {
          videoId,
          isArray: Array.isArray(streamsData),
          isObject: typeof streamsData === 'object' && streamsData !== null && !Array.isArray(streamsData),
          type: typeof streamsData,
          hasAudioStreams: streamsData && typeof streamsData === 'object' && !Array.isArray(streamsData) && 'audioStreams' in streamsData,
          keys: streamsData && typeof streamsData === 'object' && !Array.isArray(streamsData) ? Object.keys(streamsData).slice(0, 10) : 'N/A',
          arrayLength: Array.isArray(streamsData) ? streamsData.length : 'N/A',
          firstItemType: Array.isArray(streamsData) && streamsData.length > 0 ? typeof streamsData[0] : 'N/A',
          firstItemSample: Array.isArray(streamsData) && streamsData.length > 0 && typeof streamsData[0] === 'object' ? Object.keys(streamsData[0]).slice(0, 5) : (Array.isArray(streamsData) && streamsData.length > 0 ? String(streamsData[0]).substring(0, 50) : 'N/A'),
        });
      } catch (apiError) {
        logger.error('[VideoTranscriptionService] Piped.video API request failed', {
          videoId,
          error: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
        });
        throw new Error(`Failed to fetch video streams from Piped.video: ${apiError.message}`);
      }

      // Step 2: Handle different response structures from Piped.video
      let audioStreams = [];
      
      // Case 1: Response is an object with audioStreams property
      if (streamsData && typeof streamsData === 'object' && !Array.isArray(streamsData) && streamsData.audioStreams) {
        if (Array.isArray(streamsData.audioStreams)) {
          audioStreams = streamsData.audioStreams;
        }
      }
      // Case 2: Response is an array of streams (direct array)
      else if (Array.isArray(streamsData)) {
        // Filter audio streams from the array
        audioStreams = streamsData.filter(stream => 
          stream && typeof stream === 'object' && stream.mimeType && stream.mimeType.includes('audio')
        );
      }
      // Case 3: Response might have different structure - try to find audio streams in nested structure
      else if (streamsData && typeof streamsData === 'object' && !Array.isArray(streamsData)) {
        // Try to find audioStreams in nested properties
        for (const key in streamsData) {
          if (Array.isArray(streamsData[key])) {
            const potentialStreams = streamsData[key].filter(item => 
              item && typeof item === 'object' && item.mimeType && item.mimeType.includes('audio')
            );
            if (potentialStreams.length > 0) {
              audioStreams = potentialStreams;
              break;
            }
          }
        }
      }

      // Step 3: Validate we found audio streams
      if (!audioStreams || audioStreams.length === 0) {
        logger.error('[VideoTranscriptionService] No audio streams found in Piped.video response', {
          videoId,
          responseType: Array.isArray(streamsData) ? 'array' : typeof streamsData,
          responseKeys: streamsData && typeof streamsData === 'object' && !Array.isArray(streamsData) ? Object.keys(streamsData).slice(0, 20) : 'N/A',
          arrayLength: Array.isArray(streamsData) ? streamsData.length : 'N/A',
        });
        throw new Error('No audio streams available for this video');
      }

      // Filter to ensure all streams have audio mimeType
      audioStreams = audioStreams.filter(stream => 
        stream && stream.mimeType && stream.mimeType.includes('audio')
      );

      if (audioStreams.length === 0) {
        logger.error('[VideoTranscriptionService] No audio streams with audio mimeType found', {
          videoId,
          totalStreamsFound: audioStreams.length,
          responseType: Array.isArray(streamsData) ? 'array' : typeof streamsData,
        });
        throw new Error('No audio streams available for this video');
      }

      // Sort by bitrate (highest first) and take the best one
      const bestAudioStream = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      if (!bestAudioStream.url) {
        logger.error('[VideoTranscriptionService] Audio stream has no URL', {
          videoId,
          stream: bestAudioStream,
        });
        throw new Error('Audio stream URL is missing');
      }

      logger.info('[VideoTranscriptionService] Found best audio stream', {
        videoId,
        mimeType: bestAudioStream.mimeType,
        bitrate: bestAudioStream.bitrate,
        quality: bestAudioStream.quality,
        url: bestAudioStream.url.substring(0, 100) + '...',
      });

      // Step 3: Download audio from the stream URL
      logger.info('[VideoTranscriptionService] Downloading audio from stream URL...', {
        videoId,
        audioPath,
      });

      try {
        const audioResponse = await axios({
          method: 'GET',
          url: bestAudioStream.url,
          responseType: 'stream',
          timeout: 300000, // 5 minutes timeout for large files
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        // Write stream to file
        const writeStream = fs.createWriteStream(audioPath);
        audioResponse.data.pipe(writeStream);

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', (error) => {
            try {
              if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
              }
            } catch (unlinkError) {
              // Ignore cleanup errors
            }
            reject(error);
          });
          audioResponse.data.on('error', (error) => {
            writeStream.destroy();
            try {
              if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
              }
            } catch (unlinkError) {
              // Ignore cleanup errors
            }
            reject(error);
          });
        });
      } catch (downloadError) {
        logger.error('[VideoTranscriptionService] Audio download failed', {
          videoId,
          error: downloadError.message,
          url: bestAudioStream.url.substring(0, 100) + '...',
        });
        throw new Error(`Failed to download audio stream: ${downloadError.message}`);
      }

      // Step 4: Verify file was downloaded
      if (!fs.existsSync(audioPath)) {
        throw new Error('Audio file was not downloaded. The download may have failed.');
      }

      const fileSize = fs.statSync(audioPath).size;
      if (fileSize === 0) {
        fs.unlinkSync(audioPath);
        throw new Error('Downloaded audio file is empty');
      }

      logger.info('[VideoTranscriptionService] Audio downloaded successfully', {
        videoId,
        audioPath,
        fileSize,
      });

      // Step 5: Transcribe with Whisper
      logger.info('[VideoTranscriptionService] Transcribing with Whisper...', {
        videoId,
      });

      const transcript = await this.transcribeWithWhisper(audioPath, { language: 'en' });

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Whisper transcription returned empty result');
      }

      // Step 6: Clean up downloaded file
      try {
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
          logger.debug('[VideoTranscriptionService] Temporary audio file deleted', { audioPath });
        }
      } catch (cleanupError) {
        logger.warn('[VideoTranscriptionService] Failed to cleanup downloaded audio', {
          audioPath,
          error: cleanupError.message,
        });
      }

      logger.info('[VideoTranscriptionService] Transcript ready', {
        videoId,
        transcriptLength: transcript.length,
        source: 'whisper',
      });

      return {
        transcript,
        source: 'whisper',
        videoType: 'youtube',
        videoId,
      };
    } catch (error) {
      // Clean up on error
      try {
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      logger.error('[VideoTranscriptionService] Whisper fallback failed', {
        videoId,
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Failed to transcribe YouTube video with Whisper: ${error.message}`);
    }
  }

  /**
   * Transcribe uploaded video file using Whisper
   * @param {string} videoFilePath - Path to uploaded video file
   * @param {Object} options - Options
   * @returns {Promise<Object>} { transcript, source, videoType }
   */
  async transcribeUploadedFile(videoFilePath, options = {}) {
    logger.info('[VideoTranscriptionService] Processing uploaded video file', { videoFilePath });

    // Extract audio if needed (for now, Whisper handles video directly)
    const audioPath = await this.extractAudioFromVideo(videoFilePath);

    // Transcribe with Whisper
    const transcript = await this.transcribeWithWhisper(audioPath, options);

    return {
      transcript,
      source: 'whisper',
      videoType: 'upload',
    };
  }

  /**
   * Main transcription method - handles both YouTube URLs and file uploads
   * @param {Object} input - Input data
   * @param {string} input.youtubeUrl - YouTube URL (optional)
   * @param {string} input.videoFilePath - Path to uploaded video file (optional)
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} { transcript, source, videoType }
   */
  async transcribe(input, options = {}) {
    if (input.youtubeUrl) {
      return this.transcribeYouTube(input.youtubeUrl, options);
    } else if (input.videoFilePath) {
      return this.transcribeUploadedFile(input.videoFilePath, options);
    } else {
      throw new Error('Either youtubeUrl or videoFilePath must be provided');
    }
  }
}

