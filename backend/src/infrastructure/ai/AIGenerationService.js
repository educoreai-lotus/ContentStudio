import { AIGenerationService as IAIGenerationService } from '../../domain/services/AIGenerationService.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { TTSClient } from '../external-apis/openai/TTSClient.js';
import { GeminiClient } from '../external-apis/gemini/GeminiClient.js';
import { HeygenClient } from './HeygenClient.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { GoogleSlidesClient } from '../external-apis/google-slides/GoogleSlidesClient.js';

/**
 * AI Generation Service Implementation
 * Uses OpenAI and Gemini APIs for content generation
 */
export class AIGenerationService extends IAIGenerationService {
  constructor({
    openaiApiKey,
    geminiApiKey,
    heygenApiKey,
    supabaseUrl,
    supabaseServiceKey,
    googleServiceAccountJson,
  }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.ttsClient = openaiApiKey ? new TTSClient({ apiKey: openaiApiKey }) : null;
    this.geminiClient = geminiApiKey ? new GeminiClient({ apiKey: geminiApiKey }) : null;
    this.heygenClient = heygenApiKey ? new HeygenClient({ apiKey: heygenApiKey }) : null;
    this.storageClient = (supabaseUrl && supabaseServiceKey)
      ? new SupabaseStorageClient({ supabaseUrl, supabaseServiceKey })
      : null;
    this.googleSlidesClient = googleServiceAccountJson
      ? new GoogleSlidesClient({ serviceAccountJson: googleServiceAccountJson })
      : null;
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
        return this.generateAvatarVideo(prompt, config);
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
    // Try Gemini first, fallback to OpenAI if it fails
    if (this.geminiClient) {
      try {
        return await this.geminiClient.generateMindMap(topicText, config);
      } catch (error) {
        console.warn('[AIGenerationService] Gemini failed, falling back to OpenAI:', error.message);
      }
    }

    // Fallback: Use OpenAI to generate mind map
    if (!this.openaiClient) {
      throw new Error('Neither Gemini nor OpenAI client is configured for mind map generation');
    }

    // Extract variables from config or use topicText as fallback
    const topic_title = config.topic_title || topicText || 'Untitled Topic';
    const skills = Array.isArray(config.skills) ? config.skills : [];
    const trainer_prompt = config.trainer_prompt || config.lessonDescription || '';

    const prompt = `You are an expert educational Knowledge-Graph MindMap Generator.

Your task is to convert:
• the topic_title: "${topic_title}"
• the list of skills (for understanding only): ${JSON.stringify(skills)}
• the trainer_prompt: "${trainer_prompt}"

into a clear, professional conceptual MindMap.

IMPORTANT:
This is NOT a tree and NOT a hierarchy.
This is a radial knowledge map with conceptual clusters and semantic connections.

===============================
     OUTPUT FORMAT (JSON)
===============================

Return ONLY valid JSON:

{
  "nodes": [
    {
      "id": "string",
      "type": "concept",
      "data": {
        "label": "Concept Name",
        "description": "Short, accurate educational definition",
        "group": "core | primary | secondary | related | advanced"
      },
      "position": { "x": 0, "y": 0 },
      "style": {
        "backgroundColor": "HEX",
        "borderRadius": 12
      }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "node_id",
      "target": "node_id",
      "type": "smoothstep",
      "label": "explains | relates-to | depends-on | part-of | similar-to | leads-to",
      "animated": true
    }
  ]
}

===============================
     RULES (NOT A TREE!)
===============================

1. Place the topic_title in the center (group: core).

2. Create conceptual clusters, NOT levels:
   - primary concepts (closest to the core)
   - secondary concepts (expansions of primary)
   - related concepts (side-connections)
   - advanced concepts (deep insight)

3. No hierarchy. No parent-child.
   Use semantic connections only.

4. Colors by group:
   - core: "#E3F2FD"
   - primary: "#FFF3E0"
   - secondary: "#E8F5E9"
   - related: "#F3E5F5"
   - advanced: "#FCE4EC"

5. Every connection (edge) must have meaning:
   explains / relates-to / part-of / similar-to / depends-on / leads-to

6. Return 12–20 total concepts.

7. Skills are used only to help interpret the topic, never included in the JSON.

8. Output JSON ONLY (no text, no markdown).

Generate a radial non-hierarchical MindMap as described above.
Return ONLY the JSON.`;

    const response = await this.openaiClient.generateText(prompt, {
      systemPrompt: 'You are an expert educational Knowledge-Graph MindMap Generator. Create radial, non-hierarchical mind maps with semantic connections.',
      temperature: 0.3,
      max_tokens: 4000, // Increased for more concepts
    });

    // Parse JSON response
    const cleanedResponse = response.trim();
    // Remove markdown code blocks if present
    const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                     cleanedResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                     cleanedResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    }

    throw new Error('Invalid JSON response from OpenAI');
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

    // Upload audio to Supabase Storage
    let audioUrl = null;
    if (this.storageClient && audioData.audio) {
      try {
        const fileName = `audio_${Date.now()}.${audioData.format}`;
        const uploadResult = await this.storageClient.uploadFile(
          audioData.audio,
          fileName,
          `audio/${audioData.format}`
        );
        audioUrl = uploadResult.url;
        console.log('[AIGenerationService] Audio uploaded to storage:', audioUrl);
      } catch (uploadError) {
        console.warn('[AIGenerationService] Failed to upload audio to storage:', uploadError.message);
      }
    }

    return {
      audio: audioData.audio, // Keep buffer for backward compatibility
      audioUrl, // URL for playback
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

    let googleSlidesUrl = null;
    if (this.googleSlidesClient?.isEnabled?.()) {
      try {
        const slidesPayload = this.normalizeSlides(presentationData);
        if (slidesPayload.length > 0) {
          const lessonTopic = config.lessonTopic || topic;
          const { publicUrl } = await this.googleSlidesClient.createPresentation({
            lessonTopic,
            slides: slidesPayload,
            accentColor: '#00B894',
          });
          googleSlidesUrl = publicUrl;
          console.log('[AIGenerationService] Google Slides shared successfully:', googleSlidesUrl);
        }
      } catch (slidesError) {
        console.warn('[AIGenerationService] Google Slides generation failed:', slidesError.message);
      }
    }

    return {
      presentation: presentationData,
      format: 'json',
      slide_count: presentationData.slides?.length || 0,
      googleSlidesUrl,
      metadata: {
        style,
        generated_at: new Date().toISOString(),
        googleSlidesUrl,
        language: config.language,
      },
    };
  }

  normalizeSlides(presentationData) {
    if (!presentationData || !Array.isArray(presentationData.slides)) {
      return [];
    }

    return presentationData.slides.map((slide, index) => ({
      title: this.truncateWords(slide.title || `Slide ${index + 1}`, 7),
      points: Array.isArray(slide.content)
        ? slide.content.map(point => String(point).trim()).filter(Boolean)
        : Array.isArray(slide.points)
          ? slide.points.map(point => String(point).trim()).filter(Boolean)
          : [],
    }));
  }

  truncateWords(text = '', maxWords = 7) {
    const words = String(text)
      .split(/\s+/)
      .filter(Boolean);
    if (words.length <= maxWords) {
      return words.join(' ');
    }
    return `${words.slice(0, maxWords).join(' ')}…`;
  }

  /**
   * Build avatar text from lesson data - NO GPT, pure function
   * @param {Object} lessonData - Lesson data
   * @param {string} lessonData.lessonTopic - Topic name
   * @param {string} lessonData.lessonDescription - Topic description
   * @param {Array} lessonData.skillsList - Skills list
   * @param {string} lessonData.trainerRequestText - Optional trainer request
   * @param {string} lessonData.transcriptText - Optional transcript text
   * @returns {string} Avatar text
   */
  buildAvatarText(lessonData = {}) {
    const {
      lessonTopic = '',
      lessonDescription = '',
      skillsList = [],
      trainerRequestText = '',
      transcriptText = '',
    } = lessonData;

    // Ensure skillsList is an array
    let skillsArray = [];
    if (Array.isArray(skillsList)) {
      skillsArray = skillsList;
    } else if (typeof skillsList === 'string') {
      skillsArray = skillsList.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Build text from available data
    const parts = [];

    if (lessonTopic) {
      parts.push(`Today we'll learn about ${lessonTopic}.`);
    }

    if (lessonDescription) {
      parts.push(lessonDescription);
    }

    if (transcriptText && transcriptText.trim()) {
      // Use transcript text directly (first 500 chars to keep it concise)
      const transcriptExcerpt = transcriptText.trim().substring(0, 500);
      parts.push(transcriptExcerpt);
    } else if (trainerRequestText && trainerRequestText.trim()) {
      parts.push(trainerRequestText.trim());
    }

    if (skillsArray && skillsArray.length > 0) {
      const skillsText = skillsArray.join(', ');
      parts.push(`Key skills covered: ${skillsText}.`);
    }

    // Join all parts with spaces
    const finalText = parts.filter(p => p && p.trim()).join(' ').trim();

    // Fallback if no text available
    if (!finalText || finalText.length === 0) {
      return lessonTopic 
        ? `Welcome to the lesson about ${lessonTopic}.`
        : 'Welcome to this lesson.';
    }

    return finalText;
  }

  /**
   * Generate avatar video - NO GPT, uses buildAvatarText()
   * @param {string|Object} prompt - Prompt or lesson data object
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Avatar video result
   */
  async generateAvatarVideo(prompt, config = {}) {
    if (!this.heygenClient) {
      // Don't throw - return failed status
      return {
        script: '',
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: 'Heygen client not configured',
        errorCode: 'CLIENT_NOT_CONFIGURED',
        reason: 'Avatar video generation is not available. Please configure HeyGen API key.',
        metadata: {
          generation_status: 'failed',
          error_code: 'CLIENT_NOT_CONFIGURED',
          error_message: 'Heygen client not configured',
        },
      };
    }

    // Extract lesson data from prompt (can be object or string)
    let lessonData = {};
    if (typeof prompt === 'object' && prompt !== null) {
      lessonData = prompt;
    } else if (typeof prompt === 'string') {
      // If prompt is a string, try to parse it or use as description
      lessonData = {
        lessonDescription: prompt,
        ...config,
      };
    }

    // Merge config into lessonData
    lessonData = {
      ...lessonData,
      lessonTopic: config.lessonTopic || lessonData.lessonTopic,
      lessonDescription: config.lessonDescription || lessonData.lessonDescription,
      skillsList: config.skillsList || lessonData.skillsList || [],
      trainerRequestText: config.trainerRequestText || lessonData.trainerRequestText,
      transcriptText: config.transcriptText || lessonData.transcriptText,
    };

    // Build avatar text - NO GPT, pure function
    const avatarText = this.buildAvatarText(lessonData);

    if (!avatarText || avatarText.trim().length === 0) {
      return {
        script: '',
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: 'No text available for avatar video',
        errorCode: 'NO_TEXT',
        reason: 'Avatar video requires lesson content. Please provide lesson topic or description.',
        metadata: {
          generation_status: 'failed',
          error_code: 'NO_TEXT',
          error_message: 'No text available for avatar video',
        },
      };
    }

    // Generate video using Heygen - NO GPT, direct call
    try {
      const videoResult = await this.heygenClient.generateVideo(avatarText, {
        language: config.language || 'en',
        avatarId: config.avatarId,
        voiceId: config.voiceId,
      });

      // Handle failed status - return partial success instead of throwing
      if (videoResult.status === 'failed') {
        return {
          script: avatarText,
          videoUrl: null,
          videoId: videoResult.videoId || null,
          language: config.language || 'en',
          duration_seconds: 0,
          status: 'failed',
          fallback: false,
          error: videoResult.error || videoResult.errorMessage || 'Avatar video generation failed',
          errorCode: videoResult.errorCode || 'UNKNOWN_ERROR',
          reason: videoResult.reason || 'Avatar video failed due to unsupported voice engine. Please choose another voice.',
          metadata: {
            generation_status: 'failed',
            error_code: videoResult.errorCode || 'UNKNOWN_ERROR',
            error_message: videoResult.errorMessage || 'Avatar video generation failed',
            error_detail: videoResult.errorDetail || null,
          },
        };
      }

      return {
        script: avatarText,
        videoUrl: videoResult.videoUrl,
        videoId: videoResult.videoId,
        language: config.language || 'en',
        duration_seconds: videoResult.duration || 15,
        status: videoResult.status || 'completed',
        fallback: !!videoResult.fallback,
        metadata: {
          heygen_video_url: videoResult.heygenVideoUrl,
          generation_status: videoResult.status || 'completed',
          storage_fallback: !!videoResult.fallback,
          error: videoResult.error || null,
        },
      };
    } catch (error) {
      // Never throw - return failed status
      return {
        script: avatarText,
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: error.message || 'Avatar video generation failed',
        errorCode: 'GENERATION_ERROR',
        reason: 'Avatar video failed due to an error. Please try again or choose another voice.',
        metadata: {
          generation_status: 'failed',
          error_code: 'GENERATION_ERROR',
          error_message: error.message || 'Avatar video generation failed',
        },
      };
    }
  }
}

