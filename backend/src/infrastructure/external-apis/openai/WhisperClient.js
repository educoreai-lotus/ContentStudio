import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * Whisper Client for Audio/Video Transcription
 * Uses OpenAI Whisper API for speech-to-text conversion
 */
export class WhisperClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Whisper');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Transcribe audio/video file
   * @param {string|Buffer} filePathOrBuffer - File path or buffer
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code (optional, auto-detect if not provided)
   * @param {string} options.response_format - Response format (json, text, srt, verbose_json, vtt)
   * @param {number} options.temperature - Temperature (0-1)
   * @param {string} options.prompt - Optional prompt to guide the model
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(filePathOrBuffer, options = {}) {
    try {
      let file;

      // Handle file path or buffer
      if (typeof filePathOrBuffer === 'string') {
        // File path
        file = fs.createReadStream(filePathOrBuffer);
      } else {
        // Buffer - create a temporary file or use FormData
        // For now, assume it's a file path
        file = filePathOrBuffer;
      }

      const transcriptionOptions = {
        file,
        model: 'whisper-1',
        language: options.language,
        response_format: options.response_format || 'verbose_json',
        temperature: options.temperature || 0,
        prompt: options.prompt,
      };

      // Remove undefined options
      Object.keys(transcriptionOptions).forEach(
        key => transcriptionOptions[key] === undefined && delete transcriptionOptions[key]
      );

      const response = await this.openai.audio.transcriptions.create(transcriptionOptions);

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments || [],
        full_response: response,
      };
    } catch (error) {
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe with metadata
   * @param {string|Buffer} filePathOrBuffer - File path or buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription with metadata
   */
  async transcribeWithMetadata(filePathOrBuffer, options = {}) {
    const transcription = await this.transcribe(filePathOrBuffer, {
      ...options,
      response_format: 'verbose_json',
    });

    // Calculate word count and other metrics
    const wordCount = transcription.text.split(/\s+/).filter(word => word.length > 0).length;
    const charCount = transcription.text.length;

    return {
      ...transcription,
      metadata: {
        word_count: wordCount,
        character_count: charCount,
        estimated_reading_time_minutes: Math.ceil(wordCount / 200), // Average reading speed
        segments_count: transcription.segments?.length || 0,
      },
    };
  }
}



