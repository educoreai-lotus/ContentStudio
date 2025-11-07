import OpenAI from 'openai';

/**
 * Text-to-Speech Client using OpenAI TTS API
 */
export class TTSClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for TTS');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate audio from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @param {string} options.voice - Voice to use (alloy, echo, fable, onyx, nova, shimmer)
   * @param {string} options.model - Model to use (tts-1, tts-1-hd)
   * @param {string} options.format - Output format (mp3, opus, aac, flac)
   * @param {number} options.speed - Speed (0.25 to 4.0)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async generateAudio(text, options = {}) {
    const {
      voice = 'alloy',
      model = 'tts-1',
      format = 'mp3',
      speed = 1.0,
    } = options;

    try {
      const response = await this.openai.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: format,
        speed,
      });

      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Generate audio with metadata
   * @param {string} text - Text to convert
   * @param {Object} options - TTS options
   * @returns {Promise<Object>} Audio data with metadata
   */
  async generateAudioWithMetadata(text, options = {}) {
    const audioBuffer = await this.generateAudio(text, options);

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60; // seconds

    return {
      audio: audioBuffer,
      format: options.format || 'mp3',
      duration: estimatedDuration,
      voice: options.voice || 'alloy',
      text_length: text.length,
      word_count: wordCount,
    };
  }
}

