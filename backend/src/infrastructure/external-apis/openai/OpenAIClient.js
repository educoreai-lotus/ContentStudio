import OpenAI from 'openai';

/**
 * OpenAI Client
 * Handles communication with OpenAI API (GPT-4o-mini, Whisper)
 */
export class OpenAIClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate text using OpenAI models (default: gpt-4o-mini)
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation options
   * @param {string} options.model - Model to use (default: 'gpt-4o-mini')
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    try {
      const model = options.model || 'gpt-4o-mini';
      const temperature = options.temperature || 0.7;
      const max_tokens = options.max_tokens || 2000;

      console.log('🔥 [OpenAIClient] Calling OpenAI with model:', model);
      console.log('🔥 [OpenAIClient] Request params:', {
        model,
        temperature,
        max_tokens,
        promptLength: prompt?.length || 0,
        systemPromptLength: options.systemPrompt?.length || 0,
      });

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              options.systemPrompt ||
              'You are an educational content creator. Generate clear, well-structured educational content.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens,
      });

      const content = response.choices[0]?.message?.content || '';
      console.log('✅ [OpenAIClient] OpenAI response received:', {
        model,
        responseLength: content.length,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : null,
      });

      return content;
    } catch (error) {
      console.error('❌ [OpenAIClient] OpenAI error:', {
        message: error.message,
        model: options.model || 'gpt-4o-mini',
        error: error,
      });
      throw new Error(`Failed to generate text: ${error.message}`);
    }
  }

  /**
   * Transcribe audio using Whisper
   * @param {Buffer|File} audioFile - Audio file to transcribe
   * @param {Object} options - Transcription options
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioFile, options = {}) {
    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options.language,
      });

      return transcription.text || '';
    } catch (error) {
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }
}

