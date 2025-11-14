import { getSubtitles } from 'youtube-captions-scraper';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';
import { Innertube } from 'youtubei.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

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
    // Try multiple languages in order: en → he → ar → auto
    const languagesToTry = ['en', 'he', 'ar', 'auto'];
    
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

    // No captions found - fallback to Whisper (download audio first)
    logger.info('[VideoTranscriptionService] No captions found, switching to Whisper...', {
      videoId,
    });

    // Download audio and transcribe with Whisper
    return await this.transcribeYouTubeWithWhisper(youtubeUrl, videoId);
  }

  /**
   * Extract audio from muxed video file using ffmpeg.wasm
   * @param {string} videoPath - Path to video file
   * @param {string} audioPath - Path to output audio file
   * @returns {Promise<void>}
   * @throws {Error} If extraction fails
   */
  async extractAudioFromMuxedVideo(videoPath, audioPath) {
    try {
      logger.info('[FFmpeg] Extracting audio from video...', { videoPath, audioPath });

      // Lazy load ffmpeg to avoid blocking server startup
      const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
      
      const ffmpeg = createFFmpeg({ log: false });
      await ffmpeg.load();

      // Determine input file name based on extension
      const isWebm = videoPath.endsWith('.webm');
      const inputFileName = isWebm ? 'input.webm' : 'input.mp4';

      // Read video file into FFmpeg's virtual file system
      const videoData = await fetchFile(videoPath);
      ffmpeg.FS('writeFile', inputFileName, videoData);

      // Extract audio (no video, audio codec: mp3)
      // FFmpeg will auto-detect the input format
      await ffmpeg.run('-i', inputFileName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3');

      // Read extracted audio from virtual file system
      const audioData = ffmpeg.FS('readFile', 'output.mp3');

      // Write to actual file system
      fs.writeFileSync(audioPath, Buffer.from(audioData));

      // Clean up virtual files
      try {
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', 'output.mp3');
      } catch (cleanupError) {
        logger.warn('[FFmpeg] Failed to cleanup virtual files', {
          error: cleanupError.message,
        });
      }

      logger.info('[FFmpeg] Audio extracted successfully', {
        videoPath,
        audioPath,
        audioSize: audioData.length,
        inputFormat: isWebm ? 'webm' : 'mp4',
      });
    } catch (error) {
      logger.error('[VideoTranscriptionService] Audio extraction failed', {
        videoPath,
        audioPath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to extract audio from video: ${error.message}`);
    }
  }

  /**
   * Download YouTube video (muxed stream) using youtubei.js
   * Falls back to muxed stream if audio-only is not available
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string>} Path to downloaded video/audio file
   * @throws {Error} If download fails
   */
  async downloadYouTubeAudio(videoId) {
    try {
      logger.info('[YouTube] Downloading audio...', { videoId });

      // Initialize YouTube client
      const yt = await Innertube.create();

      // Get video info (this is the correct API for youtubei.js v16)
      const info = await yt.getInfo(videoId);

      // Check if streaming_data exists
      if (!info.streaming_data) {
        logger.error('[YouTube] No streaming_data found', { videoId });
        throw new Error('No streaming data available for this video');
      }

      const { adaptive_formats = [], formats = [] } = info.streaming_data;

      logger.info('[YouTube] Available streams', {
        videoId,
        adaptiveFormatsCount: adaptive_formats.length,
        formatsCount: formats.length,
      });

      let selectedFormat = null;
      let isMuxed = false;

      // Strategy 1: Try to find audio-only stream (preferred)
      selectedFormat = adaptive_formats.find(
        f => f.mime_type && (f.mime_type.includes('audio/mp4') || f.mime_type.includes('audio/webm'))
      );

      if (selectedFormat) {
        logger.info('[YouTube] Found audio-only stream', {
          videoId,
          mimeType: selectedFormat.mime_type,
          itag: selectedFormat.itag,
        });
        isMuxed = false;
      } else {
        // Strategy 2: Try muxed stream from formats (video + audio)
        logger.info('[YouTube] No audio-only stream found, trying muxed streams', { videoId });
        
        // Try formats with audio_quality first
        selectedFormat = formats.find(
          f => f.mime_type && f.mime_type.includes('video/mp4') && f.audio_quality
        );

        // If still not found, try any video/mp4 format (might have audio even without audio_quality flag)
        if (!selectedFormat) {
          selectedFormat = formats.find(
            f => f.mime_type && (f.mime_type.includes('video/mp4') || f.mime_type.includes('video/webm'))
          );
        }

        // If still not found, try adaptive_formats with video
        if (!selectedFormat) {
          selectedFormat = adaptive_formats.find(
            f => f.mime_type && (f.mime_type.includes('video/mp4') || f.mime_type.includes('video/webm'))
          );
        }

        if (selectedFormat) {
          logger.info('[YouTube] Found muxed stream', {
            videoId,
            mimeType: selectedFormat.mime_type,
            itag: selectedFormat.itag,
          });
          isMuxed = true;
        }
      }

      if (!selectedFormat) {
        // Log available formats for debugging
        logger.error('[YouTube] No suitable stream found', {
          videoId,
          availableAdaptiveFormats: adaptive_formats.map(f => ({
            mimeType: f.mime_type,
            itag: f.itag,
            hasUrl: !!f.url,
          })),
          availableFormats: formats.map(f => ({
            mimeType: f.mime_type,
            itag: f.itag,
            hasUrl: !!f.url,
            hasAudioQuality: !!f.audio_quality,
          })),
        });
        throw new Error('No audio or video stream found for this video');
      }

      // Create temp directory if it doesn't exist
      const tempDir = path.join(os.tmpdir(), 'youtube-audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Determine file extension based on mime type
      const isVideo = selectedFormat.mime_type?.includes('video/');
      const isWebm = selectedFormat.mime_type?.includes('webm');
      const fileExtension = isWebm ? '.webm' : '.mp4';
      
      const videoPath = path.join(tempDir, `${videoId}${fileExtension}`);
      const audioPath = path.join(tempDir, `${videoId}.mp3`);

      // Download stream
      logger.info('[YouTube] Downloading stream...', {
        videoId,
        isMuxed,
        isVideo,
        mimeType: selectedFormat.mime_type,
        fileExtension,
        itag: selectedFormat.itag,
      });

      // Get the stream URL from selectedFormat
      // In youtubei.js v16, format objects from getInfo() have a url property
      // The URL might be a signed URL that requires authentication headers
      let streamUrl = selectedFormat.url;

      if (!streamUrl) {
        logger.error('[YouTube] No URL found in format', {
          videoId,
          formatKeys: Object.keys(selectedFormat),
          formatType: typeof selectedFormat,
          formatConstructor: selectedFormat.constructor?.name,
        });
        throw new Error('No URL found in selected format');
      }

      logger.info('[YouTube] Got stream URL from format', {
        videoId,
        hasUrl: !!streamUrl,
        urlLength: streamUrl.length,
        urlStart: streamUrl.substring(0, 100),
      });

      // YouTube requires specific headers to download streams
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Range': 'bytes=0-',
      };

      const response = await fetch(streamUrl, {
        headers,
        redirect: 'follow',
      });

      if (!response.ok) {
        logger.error('[YouTube] Stream download failed', {
          videoId,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          streamUrl: streamUrl.substring(0, 100) + '...', // Log partial URL for debugging
        });
        throw new Error(`Failed to download stream: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write to file
      fs.writeFileSync(videoPath, buffer);

      logger.info('[YouTube] Stream downloaded successfully', {
        videoId,
        filePath: videoPath,
        fileSize: buffer.length,
        isMuxed,
        isVideo,
      });

      // If it's a video stream (muxed), extract audio
      if (isMuxed || isVideo) {
        logger.info('[YouTube] Extracting audio from video stream...', {
          videoId,
          videoPath,
          audioPath,
        });
        
        await this.extractAudioFromMuxedVideo(videoPath, audioPath);
        
        // Clean up video file
        try {
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
            logger.info('[YouTube] Cleaned up video file', { videoPath });
          }
        } catch (cleanupError) {
          logger.warn('[VideoTranscriptionService] Failed to cleanup video file', {
            videoPath,
            error: cleanupError.message,
          });
        }

        return audioPath;
      }

      // If it's audio-only, return the path (but rename to .mp3 for consistency)
      if (fs.existsSync(videoPath)) {
        fs.renameSync(videoPath, audioPath);
        logger.info('[YouTube] Renamed audio file', { videoPath, audioPath });
      }

      return audioPath;
    } catch (error) {
      logger.error('[VideoTranscriptionService] YouTube audio download failed', {
        videoId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to download YouTube audio: ${error.message}`);
    }
  }

  /**
   * Transcribe YouTube video using Whisper (fallback method)
   * Downloads audio first, then transcribes with Whisper
   * @param {string} youtubeUrl - YouTube URL
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} { transcript, source, videoType }
   * @throws {Error} If transcription fails
   */
  async transcribeYouTubeWithWhisper(youtubeUrl, videoId) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available. Please configure OpenAI API key.');
    }

    let audioPath = null;

    try {
      // Step 1: Download audio from YouTube
      audioPath = await this.downloadYouTubeAudio(videoId);

      // Step 2: Transcribe with Whisper
      logger.info('[Whisper] Transcribing...', { videoId, audioPath });

      const transcript = await this.transcribeWithWhisper(audioPath, {
        language: 'en',
      });

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Whisper transcription returned empty result');
      }

      logger.info('[Whisper] Done.', {
        videoId,
        transcriptLength: transcript.length,
      });

      return {
        transcript,
        source: 'whisper',
        videoType: 'youtube',
        videoId,
      };
    } catch (error) {
      logger.error('[VideoTranscriptionService] Whisper transcription failed', {
        videoId,
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Failed to transcribe YouTube video with Whisper: ${error.message}`);
    } finally {
      // Clean up downloaded audio file
      if (audioPath && fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
          logger.debug('[VideoTranscriptionService] Temporary audio file deleted', { audioPath });
        } catch (cleanupError) {
          logger.warn('[VideoTranscriptionService] Failed to cleanup audio file', {
            audioPath,
            error: cleanupError.message,
          });
        }
      }
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

