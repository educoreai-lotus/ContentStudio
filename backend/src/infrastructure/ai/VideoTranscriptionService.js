import { getSubtitles } from 'youtube-captions-scraper';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { detectAudioTrack } from './detectAudioTrack.js';
import { convertVideoToMp3 } from './convertVideoToMp3.js';

const execAsync = promisify(exec);
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
   * Transcribe YouTube video using Whisper (fallback method)
   * Downloads audio using yt-dlp, then transcribes with Whisper
   * @param {string} youtubeUrl - YouTube URL
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} { transcript, source, videoType }
   * @throws {Error} If transcription fails
   */
  async transcribeYouTubeWithWhisper(youtubeUrl, videoId) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available. Please configure OpenAI API key.');
    }

    // Create temp directory if it doesn't exist
    // Use /app/uploads/temp for Railway or os.tmpdir() as fallback
    const tempDir = process.env.UPLOAD_DIR 
      ? path.join(process.env.UPLOAD_DIR, 'temp')
      : '/app/uploads/temp'; // Default to /app/uploads/temp for Railway
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      logger.info('[YouTube] Created temp directory', { tempDir });
    }

    // Use timestamp to create unique filename
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `yt_audio_${timestamp}.mp3`);
    let audioPath = null;

    try {
      // Step 1: Download audio using yt-dlp
      logger.info('[YouTube] Using yt-dlp to download audio...', {
        videoId,
        youtubeUrl,
        outputPath,
      });

      try {
        // Download MP3 using yt-dlp
        // -x: extract audio only
        // --audio-format mp3: convert to MP3
        // --audio-quality 0: best quality
        // -o: output path (yt-dlp will create the file at this path)
        // Escape paths for shell command
        // Use single quotes for Unix (Railway/Linux) and double quotes for Windows
        const isWindows = process.platform === 'win32';
        const escapePathForShell = (filePath) => isWindows 
          ? filePath.replace(/"/g, '\\"')
          : filePath.replace(/'/g, "'\"'\"'");
        const quote = isWindows ? '"' : "'";
        const escapedOutputPath = escapePathForShell(outputPath);
        const escapedYoutubeUrl = escapePathForShell(youtubeUrl);
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o ${quote}${escapedOutputPath}${quote} ${quote}${escapedYoutubeUrl}${quote}`;
        
        logger.info('[YouTube] Executing yt-dlp command...', { 
          command,
          outputPath,
          youtubeUrl,
          isWindows,
        });
        
        const execOptions = {
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        };
        
        // Use bash on Unix for better path handling, default shell on Windows
        if (!isWindows) {
          execOptions.shell = '/bin/bash';
        }
        
        const { stdout, stderr } = await execAsync(command, execOptions);

        if (stderr && !stderr.includes('WARNING') && !stderr.includes('ERROR')) {
          logger.warn('[YouTube] yt-dlp stderr output', { stderr: stderr.substring(0, 500) });
        }

        if (stdout) {
          logger.info('[YouTube] yt-dlp stdout output', { stdout: stdout.substring(0, 500) });
        }

        // Wait a bit for file system to sync
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if file was created at expected path
        if (fs.existsSync(outputPath)) {
          audioPath = outputPath;
        } else {
          // yt-dlp might have created a file with a different name
          // Check for the most recently created audio file in the temp directory
          // Look for files created in the last 2 minutes
          const minTime = Date.now() - 120000; // 2 minutes ago
          
          const audioFiles = fs.readdirSync(tempDir)
            .map(f => {
              const filePath = path.join(tempDir, f);
              try {
                const stat = fs.statSync(filePath);
                return {
                  name: f,
                  path: filePath,
                  stat,
                };
              } catch (err) {
                return null;
              }
            })
            .filter(f => 
              f !== null &&
              (f.name.endsWith('.mp3') || f.name.endsWith('.m4a') || f.name.endsWith('.webm') || f.name.endsWith('.opus')) &&
              f.stat.mtime.getTime() > minTime
            )
            .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

          if (audioFiles.length > 0) {
            audioPath = audioFiles[0].path;
            logger.info('[YouTube] Found audio file with different name', {
              audioPath,
              fileName: audioFiles[0].name,
              expectedPath: outputPath,
            });
          } else {
            logger.error('[YouTube] No audio file found after yt-dlp execution', {
              outputPath,
              tempDir,
              filesInDir: fs.readdirSync(tempDir),
            });
            throw new Error('yt-dlp did not create the audio file. Check if yt-dlp is installed and the video is accessible.');
          }
        }

        logger.info('[YouTube] Audio downloaded successfully', {
          videoId,
          audioPath,
          fileSize: fs.existsSync(audioPath) ? fs.statSync(audioPath).size : 0,
        });
      } catch (execError) {
        logger.error('[YouTube] yt-dlp download failed', {
          videoId,
          error: execError.message,
          stdout: execError.stdout,
          stderr: execError.stderr,
          code: execError.code,
        });
        throw new Error(`Failed to download audio with yt-dlp: ${execError.message}`);
      }

      // Step 2: Transcribe with Whisper
      logger.info('[Whisper] Transcribing audio...', {
        videoId,
        audioPath,
      });

      const transcript = await this.transcribeWithWhisper(audioPath, {
        language: 'en',
      });

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Whisper transcription returned empty result');
      }

      logger.info('[Whisper] Transcription completed', {
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
          logger.info('[VideoTranscriptionService] Temporary audio file deleted', { audioPath });
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
   * Detects audio track, converts to MP3, then transcribes with Whisper
   * @param {string} videoFilePath - Path to uploaded video file
   * @param {Object} options - Options
   * @returns {Promise<Object>} { transcript, source, videoType }
   * @throws {Error} If video has no audio track or transcription fails
   */
  async transcribeUploadedFile(videoFilePath, options = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available. Please configure OpenAI API key.');
    }

    logger.info('[VideoTranscriptionService] Starting video transcription', { videoFilePath });

    // Check if file exists
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`Video file not found: ${videoFilePath}`);
    }

    let mp3Path = null;
    let shouldDeleteOriginal = false;

    try {
      // Step 1: Detect audio track
      logger.info('[VideoTranscriptionService] Detecting audio track...', { videoFilePath });
      
      const hasAudio = await detectAudioTrack(videoFilePath);

      if (!hasAudio) {
        logger.error('[VideoTranscriptionService] No audio track found in video', { videoFilePath });
        throw new Error(
          'This video does not contain any audio track. Whisper can only transcribe audio.'
        );
      }

      logger.info('[VideoTranscriptionService] Audio track detected', { videoFilePath });

      // Step 2: Convert to MP3
      logger.info('[VideoTranscriptionService] Converting video to MP3...', { videoFilePath });
      
      mp3Path = await convertVideoToMp3(videoFilePath);
      
      logger.info('[VideoTranscriptionService] Video converted to MP3', {
        videoFilePath,
        mp3Path,
        mp3Size: fs.existsSync(mp3Path) ? fs.statSync(mp3Path).size : 0,
      });

      // Step 3: Transcribe with Whisper
      logger.info('[VideoTranscriptionService] Transcribing with Whisper...', {
        videoFilePath,
        mp3Path,
      });

      const transcript = await this.transcribeWithWhisper(mp3Path, {
        language: options.language || 'en',
      });

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Whisper transcription returned empty result');
      }

      logger.info('[VideoTranscriptionService] Transcription completed', {
        videoFilePath,
        transcriptLength: transcript.length,
      });

      // Step 4: Determine if we should delete original file
      // Only delete if it's in a temp directory (uploaded file)
      const isTempFile = videoFilePath.includes('temp') || videoFilePath.includes('upload');
      shouldDeleteOriginal = isTempFile;

      return {
        transcript,
        source: 'whisper',
        videoType: 'upload',
      };
    } catch (error) {
      logger.error('[VideoTranscriptionService] Video transcription failed', {
        videoFilePath,
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Failed to transcribe video: ${error.message}`);
    } finally {
      // Step 5: Cleanup - delete MP3 file
      if (mp3Path && fs.existsSync(mp3Path)) {
        try {
          fs.unlinkSync(mp3Path);
          logger.info('[VideoTranscriptionService] Temporary MP3 file deleted', { mp3Path });
        } catch (cleanupError) {
          logger.warn('[VideoTranscriptionService] Failed to cleanup MP3 file', {
            mp3Path,
            error: cleanupError.message,
          });
        }
      }

      // Step 6: Cleanup - delete original video file if it's a temp file
      if (shouldDeleteOriginal && videoFilePath && fs.existsSync(videoFilePath)) {
        try {
          fs.unlinkSync(videoFilePath);
          logger.info('[VideoTranscriptionService] Original video file deleted', { videoFilePath });
        } catch (cleanupError) {
          logger.warn('[VideoTranscriptionService] Failed to cleanup original video file', {
            videoFilePath,
            error: cleanupError.message,
          });
        }
      }
    }
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

