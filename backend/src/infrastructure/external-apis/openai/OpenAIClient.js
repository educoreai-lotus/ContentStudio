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
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    // Default to GPT-4o (not mini) - required for quality checks and accurate responses
    const model = options.model || 'gpt-4o';
    const temperature = options.temperature ?? 0.25;
    const max_tokens = options.max_tokens ?? 500;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;

    console.log('🚀 [OpenAIClient] CALLING OPENAI:');
    console.log({
      model,
      temperature,
      max_tokens,
      systemPromptLength: options.systemPrompt?.length || 0,
      promptLength: prompt?.length || 0,
    });

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        }, {
          timeout: 120000, // 2 minutes timeout per request (passed as axios config)
        });

        const content = response.choices?.[0]?.message?.content || '';

        console.log('✅ [OpenAIClient] RAW RESPONSE:', content);

        return content;
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable network error
        const isRetryableError = 
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNABORTED' ||
          error.type === 'system' ||
          (error.message && (
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('fetch failed') ||
            error.message.includes('network') ||
            error.message.includes('timeout')
          ));

        const isLastAttempt = attempt >= maxRetries;

        if (isRetryableError && !isLastAttempt) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(`⚠️ [OpenAIClient] Retryable error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, {
            error: error.message,
            code: error.code,
            type: error.type,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Non-retryable error or last attempt
        console.error('❌ [OpenAIClient] API ERROR:', {
          error: error.message,
          code: error.code,
          type: error.type,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          isRetryable: isRetryableError,
        });
        throw error;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Failed to generate text after all retry attempts');
  }

  /**
   * Transcribe audio using Whisper
   * @param {Buffer|File} audioFile - Audio file to transcribe
   * @param {Object} options - Transcription options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioFile, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const transcription = await this.client.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: options.language,
        }, {
          timeout: 300000, // 5 minutes timeout for audio transcription
        });

        return transcription.text || '';
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable network error
        const isRetryableError = 
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNABORTED' ||
          error.type === 'system' ||
          (error.message && (
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('fetch failed') ||
            error.message.includes('network') ||
            error.message.includes('timeout')
          ));

        const isLastAttempt = attempt >= maxRetries;

        if (isRetryableError && !isLastAttempt) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(`⚠️ [OpenAIClient] Retryable error in transcribeAudio (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, {
            error: error.message,
            code: error.code,
            type: error.type,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Non-retryable error or last attempt
        throw new Error(`Failed to transcribe audio: ${error.message}`);
      }
    }

    // Should never reach here, but just in case
    throw new Error(`Failed to transcribe audio after all retry attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Extract text from image using OpenAI Vision API (OCR)
   * @param {string} imageBase64 - Base64 encoded image
   * @returns {Promise<string>} Extracted text from image
   */
  async extractTextFromImage(imageBase64) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o', // GPT-4o supports vision
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this slide image. Return only the text content, no explanations or formatting.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      });

      return response.choices?.[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }
}

