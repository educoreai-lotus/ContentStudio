import { AIGenerationService as IAIGenerationService } from '../../domain/services/AIGenerationService.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { TTSClient } from '../external-apis/openai/TTSClient.js';
import { GeminiClient } from '../external-apis/gemini/GeminiClient.js';

/**
 * AI Generation Service Implementation
 * Uses OpenAI and Gemini APIs for content generation
 */
export class AIGenerationService extends IAIGenerationService {
  constructor({ openaiApiKey, geminiApiKey }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.ttsClient = openaiApiKey ? new TTSClient({ apiKey: openaiApiKey }) : null;
    this.geminiClient = geminiApiKey ? new GeminiClient({ apiKey: geminiApiKey }) : null;
  }

  async generate(options) {
    const { prompt, content_type, config } = options;

    switch (content_type) {
      case 'text':
        return this.generateText(prompt, config);
      case 'code':
        return this.generateCode(prompt, config?.language, config);
      case 'mind_map':
        return this.generateMindMap(prompt, config);
      case 'audio':
        return this.generateAudio(prompt, config);
      case 'presentation':
        return this.generatePresentation(prompt, config);
      case 'avatar_video':
        return this.generateAvatarScript(prompt, config);
      default:
        throw new Error(`Unsupported content type for AI generation: ${content_type}`);
    }
  }

  async generateText(prompt, config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const systemPrompt = this.buildSystemPrompt('text', config);
    const fullPrompt = this.buildTextPrompt(prompt, config);

    return await this.openaiClient.generateText(fullPrompt, {
      systemPrompt,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 2000,
    });
  }

  async generateCode(prompt, language = 'javascript', config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const systemPrompt = `You are an expert ${language} programmer. Generate clean, well-documented code with comments explaining the logic.`;
    const fullPrompt = `Generate ${language} code for: ${prompt}\n\nInclude comments explaining the code logic.`;

    const generatedCode = await this.openaiClient.generateText(fullPrompt, {
      systemPrompt,
      temperature: config.temperature || 0.3, // Lower temperature for code
      max_tokens: config.max_tokens || 3000,
    });

    return {
      code: generatedCode,
      language: language,
      explanation: config.include_explanation
        ? await this.generateCodeExplanation(generatedCode, language)
        : null,
    };
  }

  async generateMindMap(topicText, config = {}) {
    if (!this.geminiClient) {
      throw new Error('Gemini client not configured');
    }

    return await this.geminiClient.generateMindMap(topicText, config);
  }

  buildSystemPrompt(contentType, config) {
    const style = config.style || 'educational';
    const difficulty = config.difficulty || 'intermediate';

    return `You are an expert educational content creator. Create ${style} content suitable for ${difficulty} level learners. 
The content should be clear, well-structured, and engaging.`;
  }

  buildTextPrompt(prompt, config) {
    const style = config.style || 'educational';
    const sections = config.sections || [];

    let fullPrompt = prompt;

    if (sections.length > 0) {
      fullPrompt += `\n\nStructure the content with the following sections: ${sections.join(', ')}`;
    }

    if (style === 'conversational') {
      fullPrompt += '\n\nUse a conversational, friendly tone.';
    } else if (style === 'formal') {
      fullPrompt += '\n\nUse a formal, academic tone.';
    }

    return fullPrompt;
  }

  async generateCodeExplanation(code, language) {
    if (!this.openaiClient) {
      return null;
    }

    const explanationPrompt = `Explain the following ${language} code in simple terms:\n\n${code}\n\nProvide a brief explanation of what the code does.`;                                                                                 

    return await this.openaiClient.generateText(explanationPrompt, {
      systemPrompt: 'You are a programming educator. Explain code clearly and simply.',
      temperature: 0.5,
      max_tokens: 500,
    });
  }

  /**
   * Generate audio narration from text
   * @param {string} text - Text to convert to audio
   * @param {Object} config - Audio generation config
   * @returns {Promise<Object>} Audio data with metadata
   */
  async generateAudio(text, config = {}) {
    if (!this.ttsClient) {
      throw new Error('TTS client not configured');
    }

    // If text is too long, summarize it first
    let textToConvert = text;
    if (text.length > 4000) {
      // Summarize long text for audio
      const summaryPrompt = `Summarize the following text in a clear, concise way suitable for audio narration (max 4000 characters):\n\n${text}`;
      textToConvert = await this.openaiClient.generateText(summaryPrompt, {
        systemPrompt: 'You are a content summarizer. Create clear, concise summaries suitable for audio narration.',
        temperature: 0.5,
        max_tokens: 2000,
      });
    }

    const audioData = await this.ttsClient.generateAudioWithMetadata(textToConvert, {
      voice: config.voice || 'alloy',
      model: config.model || 'tts-1',
      format: config.format || 'mp3',
      speed: config.speed || 1.0,
    });

    return {
      audio: audioData.audio,
      format: audioData.format,
      duration: audioData.duration,
      voice: audioData.voice,
      text: textToConvert,
      metadata: {
        original_text_length: text.length,
        converted_text_length: textToConvert.length,
        word_count: audioData.word_count,
      },
    };
  }

  /**
   * Generate presentation slides from text/topic
   * @param {string} topic - Topic or text for presentation
   * @param {Object} config - Presentation config
   * @returns {Promise<Object>} Presentation data
   */
  async generatePresentation(topic, config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const slideCount = config.slide_count || 10;
    const style = config.style || 'educational';

    const presentationPrompt = `Create a ${style} presentation about: ${topic}

Generate ${slideCount} slides with:
- Clear titles for each slide
- 3-5 bullet points per slide
- Logical flow and progression
- Engaging content suitable for learning

Format as JSON with this structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "slide_number": 1,
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", ...]
    },
    ...
  ]
}`;

    const generatedContent = await this.openaiClient.generateText(presentationPrompt, {
      systemPrompt: 'You are an expert presentation designer. Create well-structured, educational presentations.',
      temperature: 0.7,
      max_tokens: 3000,
    });

    // Try to parse JSON from response
    let presentationData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = generatedContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       generatedContent.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : generatedContent;
      presentationData = JSON.parse(jsonText);
    } catch (error) {
      // If parsing fails, create a simple structure
      const lines = generatedContent.split('\n').filter(line => line.trim());
      presentationData = {
        title: topic,
        slides: lines.slice(0, slideCount).map((line, index) => ({
          slide_number: index + 1,
          title: `Slide ${index + 1}`,
          content: [line.trim()],
        })),
      };
    }

    return {
      presentation: presentationData,
      format: 'json', // Will be converted to Google Slides format later
      slide_count: presentationData.slides?.length || 0,
      metadata: {
        style,
        generated_at: new Date().toISOString(),
      },
    };
  }

  async generateAvatarScript(prompt, config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const systemPrompt = 'You are a virtual presenter creating short, engaging video introductions.';
    const script = await this.openaiClient.generateText(prompt, {
      systemPrompt,
      temperature: config.temperature || 0.9,
      max_tokens: config.max_tokens || 400,
    });

    return {
      script,
      language: config.language || 'English',
      estimated_duration_seconds: config.duration_seconds || 15,
    };
  }
}

