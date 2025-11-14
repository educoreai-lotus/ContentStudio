import OpenAI from 'openai';

/**
 * OpenAI Client
 * Handles communication with OpenAI API (GPT-4o, Whisper)
 * 
 * IMPORTANT: Default model is GPT-4o (not mini) for better accuracy
 * Quality checks always use GPT-4o for accurate plagiarism detection
 */
export class OpenAIClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate text using OpenAI models (default: gpt-4o)
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation options
   * @param {string} options.model - Model to use (default: 'gpt-4o')
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    // Default to GPT-4o (not mini) - required for quality checks and accurate responses
    const model = options.model || 'gpt-4o';
    const temperature = options.temperature ?? 0.25;
    const max_tokens = options.max_tokens ?? 500;

    console.log('🚀 [OpenAIClient] CALLING OPENAI:');
    console.log({
      model,
      temperature,
      max_tokens,
      systemPromptLength: options.systemPrompt?.length || 0,
      promptLength: prompt?.length || 0,
    });

    try {
      const response = await this.client.chat.completions.create({
        model, // Always use the specified model (default: gpt-4o, not mini)
        temperature,
        max_tokens,
        messages: [
          {
            role: 'system',
            content: options.systemPrompt || 'You are an AI assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content || '';

      console.log('✅ [OpenAIClient] RAW RESPONSE:', content);

      return content;
    } catch (error) {
      console.error('❌ [OpenAIClient] API ERROR:', error);
      throw error;
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

