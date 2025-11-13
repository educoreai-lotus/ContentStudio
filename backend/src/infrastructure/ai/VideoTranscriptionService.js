import { getSubtitles } from 'youtube-captions-scraper';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Video Transcription Service
 * Handles transcription from YouTube URLs (captions) and uploaded video files (Whisper)
 */
export class VideoTranscriptionService {
  constructor({ openaiApiKey }) {
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
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

      if (!subtitles || subtitles.length === 0) {
        logger.warn('[VideoTranscriptionService] No captions found for video', { videoId, lang });
        return null;
      }

      // Merge all caption segments into clean text
      let transcript = '';
      for (const subtitle of subtitles) {
        if (subtitle.text) {
          transcript += subtitle.text + ' ';
        }
      }

      // Clean up the transcript
      transcript = transcript
        .replace(/\n/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s.,!?;:()\-'"]/g, '') // Remove special symbols but keep punctuation
        .trim();

      logger.info('[VideoTranscriptionService] YouTube captions extracted successfully', {
        videoId,
        length: transcript.length,
      });

      return transcript;
    } catch (error) {
      logger.warn('[VideoTranscriptionService] Failed to fetch YouTube captions', {
        videoId,
        lang,
        error: error.message,
      });
      return null;
    }
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
   * Tries captions first, falls back to Whisper if captions unavailable
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

    // Try YouTube captions first
    const captions = await this.fetchYouTubeCaptions(videoId, options.lang || 'en');
    if (captions && captions.length > 0) {
      return {
        transcript: captions,
        source: 'youtube-captions',
        videoType: 'youtube',
        videoId,
      };
    }

    // Fallback to Whisper (would need to download video/audio first)
    // For now, we'll throw an error and let the caller handle it
    // In production, you might want to download the audio and use Whisper
    logger.warn('[VideoTranscriptionService] No captions found, Whisper fallback not implemented for YouTube', {
      videoId,
    });

    throw new Error(
      'No captions available for this YouTube video. Please upload the video file directly or ensure the video has captions enabled.'
    );
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

