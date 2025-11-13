import { getSubtitles } from 'youtube-captions-scraper';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Video Transcription Service
 * Handles transcription from YouTube URLs (captions) and uploaded video files (Whisper)
 */
export class VideoTranscriptionService {
  constructor({ openaiApiKey }) {
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    // yt-dlp binary path (bundled with the project)
    this.ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  }

  /**
   * Get yt-dlp binary path
   * @returns {string} Path to yt-dlp binary
   * @throws {Error} If binary doesn't exist
   */
  getYtDlpPath() {
    // Check if binary exists
    if (!fs.existsSync(this.ytDlpPath)) {
      throw new Error(
        `yt-dlp binary not found at ${this.ytDlpPath}. ` +
        'Please download it from https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp ' +
        'and place it in the bin/ directory.'
      );
    }

    // Make sure it's executable (Unix/Linux)
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(this.ytDlpPath, 0o755);
      } catch (error) {
        logger.warn('[VideoTranscriptionService] Failed to set executable permissions', {
          error: error.message,
        });
      }
    }

    return this.ytDlpPath;
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
   * Uses youtubei.js to download audio (works on Railway without binary)
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

    // Use output template to ensure correct filename
    const outputTemplate = path.join(tempDir, `youtube_${videoId}_%(id)s.%(ext)s`);
    const audioPath = path.join(tempDir, `youtube_${videoId}_${videoId}.mp3`);

    try {
      // Get yt-dlp binary path
      const ytDlpBinary = this.getYtDlpPath();

      logger.info('[VideoTranscriptionService] Downloading YouTube audio with yt-dlp...', {
        videoId,
        youtubeUrl,
        ytDlpPath: ytDlpBinary,
      });

      // Download audio using yt-dlp
      try {
        await execFileAsync(ytDlpBinary, [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '0', // Best quality
          '--no-playlist',
          '--quiet',
          '--no-warnings',
          '-o', outputTemplate,
          youtubeUrl,
        ]);
      } catch (execError) {
        logger.error('[VideoTranscriptionService] yt-dlp exec failed', {
          videoId,
          error: execError.message,
          stderr: execError.stderr?.toString(),
          stdout: execError.stdout?.toString(),
        });
        throw new Error(`Failed to download YouTube audio: ${execError.message}`);
      }

      // Wait a bit for file to be written
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify file was written
      if (!fs.existsSync(audioPath)) {
        // Try to find the file with different naming
        const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`youtube_${videoId}_`));
        if (files.length > 0) {
          const foundFile = path.join(tempDir, files[0]);
          logger.info('[VideoTranscriptionService] Found audio file with different name', {
            expected: audioPath,
            found: foundFile,
          });
          // Use the found file
          const actualAudioPath = foundFile;
          const fileSize = fs.statSync(actualAudioPath).size;
          if (fileSize === 0) {
            throw new Error('Downloaded audio file is empty');
          }

          logger.info('[VideoTranscriptionService] Audio downloaded successfully', {
            videoId,
            audioPath: actualAudioPath,
            fileSize,
          });

          // Transcribe with Whisper
          logger.info('[VideoTranscriptionService] Transcribing with Whisper...', {
            videoId,
          });

          const transcript = await this.transcribeWithWhisper(actualAudioPath, { language: 'en' });

          if (!transcript || transcript.trim().length === 0) {
            throw new Error('Whisper transcription returned empty result');
          }

          // Clean up downloaded file
          try {
            if (fs.existsSync(actualAudioPath)) {
              fs.unlinkSync(actualAudioPath);
              logger.debug('[VideoTranscriptionService] Temporary audio file deleted', { audioPath: actualAudioPath });
            }
          } catch (cleanupError) {
            logger.warn('[VideoTranscriptionService] Failed to cleanup downloaded audio', {
              audioPath: actualAudioPath,
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
        }
        throw new Error('Audio file was not downloaded from YouTube. The download may have failed or the file path is incorrect.');
      }

      // File found with expected name
      const fileSize = fs.statSync(audioPath).size;
      if (fileSize === 0) {
        throw new Error('Downloaded audio file is empty');
      }

      logger.info('[VideoTranscriptionService] Audio downloaded successfully', {
        videoId,
        audioPath,
        fileSize,
      });

      // Transcribe with Whisper
      logger.info('[VideoTranscriptionService] Transcribing with Whisper...', {
        videoId,
      });

      const transcript = await this.transcribeWithWhisper(audioPath, { language: 'en' });

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Whisper transcription returned empty result');
      }

      // Clean up downloaded file
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

